class_name FloorsStaff
extends RefCounted

## The café's own people in the looks the game gave them: one strip per hairstyle, painted in key colours, with a mask
## that says how much of each pixel is hair, apron, trousers or skin. A shader gives each part its new colour and keeps
## the shading it was painted with (the sums of src/render/floors/staff-paint.ts).

const _SHADER := """
shader_type canvas_item;
uniform sampler2D mask : filter_linear;
uniform vec3 key_hair; uniform vec3 key_apron; uniform vec3 key_pants; uniform vec3 key_skin;
uniform vec3 new_hair; uniform vec3 new_apron; uniform vec3 new_pants; uniform vec3 new_skin;
varying vec4 tone;
void vertex() { tone = COLOR; }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// Darker than the key colour multiplies the new colour down, lighter lifts it towards white.
vec3 painted(vec3 c, vec3 key, vec3 target, float tint) {
	float light = luma(c) / max(1.0 / 255.0, luma(key));
	vec3 ratio = light + (c / max(vec3(1.0 / 255.0), key) - light) * tint;
	return mix(target * ratio, 1.0 - (1.0 - target) / max(ratio, vec3(1.0)), step(vec3(1.0), ratio));
}
void fragment() {
	vec4 t = texture(TEXTURE, UV);
	vec3 cloth = texture(mask, vec2(UV.x, UV.y * 0.5)).rgb;
	float skin = texture(mask, vec2(UV.x, UV.y * 0.5 + 0.5)).r;
	float total = cloth.r + cloth.g + cloth.b + skin;
	// Lossy masks leave a faint haze outside the parts.
	if (total >= 6.0 / 255.0) {
		float s = 1.0 / max(1.0, total);
		t.rgb = t.rgb * (1.0 - total * s)
			+ painted(t.rgb, key_hair, new_hair, 0.3) * cloth.r * s + painted(t.rgb, key_apron, new_apron, 0.3) * cloth.g * s
			+ painted(t.rgb, key_pants, new_pants, 0.3) * cloth.b * s + painted(t.rgb, key_skin, new_skin, 0.9) * skin * s;
	}
	COLOR = t * tone;
}
"""
var _library: FloorsLibrary
var _shader := Shader.new()
var _known: Dictionary = {}
var _cooks: Dictionary = {}


func _init(library: FloorsLibrary) -> void:
	_library = library
	_shader.code = _SHADER


## The texture key of someone's look: "" while its strip is on its way, `stand_in` if it has no art.
func look(wanted: Dictionary, stand_in: String) -> String:
	var id := FloorsArt.look_id(wanted)
	if _known.has(id):
		return _known[id]
	var order: Array = _library.staff["order"]
	var style: String = order[posmod(int(wanted["hairStyle"]), order.size())]
	if not _library.staff["styles"].has(style):
		_known[id] = stand_in
		return stand_in
	if not _library.all_ready(["staff/%s" % style, "staff/%s-mask" % style]):
		return ""
	var entry: Dictionary = _library.staff["styles"][style]
	_library.sheets["staff/%s" % style] = entry
	var key := "staff/%s" % id
	_library.add_look(key, "staff/%s" % style, _painted(style, entry["key"], FloorsArt.look_colours(wanted)))
	_known[id] = key
	return key


## A cook in their look: the name their textures start with (`<name>` and `<name>-work`); "" while they are on their
## way, `kind` itself if the cook has no art to repaint.
func cook(wanted: Dictionary, kind: String) -> String:
	var id := "staff/%s/%s" % [kind, FloorsArt.cook_id(wanted)]
	if _cooks.has(id):
		return _cooks[id]
	var strips := [kind, "%s-work" % kind]
	for strip: String in strips:
		if not _library.staff.get("cooks", {}).has(strip):
			_cooks[id] = kind
			return kind
	if not _library.all_ready(strips.map(func(s: String) -> String: return "staff/%s" % s) + strips.map(func(s: String) -> String: return "staff/%s-mask" % s)):
		return ""
	for strip: String in strips:
		var entry: Dictionary = _library.staff["cooks"][strip]
		_library.sheets["staff/%s" % strip] = entry
		# The mask claims next to nothing for apron and trousers, so they are the same grey in every look.
		var keys := {"hair": entry["key"]["hair"], "skin": entry["key"]["skin"], "apron": [128.0, 128.0, 128.0], "pants": [128.0, 128.0, 128.0]}
		_library.add_look(id if strip == kind else "%s-work" % id, "staff/%s" % strip, _painted(strip, keys, FloorsArt.look_colours(wanted).merged({"apron": float(0x808080), "pants": float(0x808080)}, true)))
	_cooks[id] = id
	return id


func _painted(strip: String, keys: Dictionary, colours: Dictionary) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader
	m.set_shader_parameter("mask", _library.texture("staff/%s-mask" % strip))
	for part: String in ["hair", "apron", "pants", "skin"]:
		m.set_shader_parameter("key_%s" % part, Vector3(keys[part][0], keys[part][1], keys[part][2]) / 255.0)
		var c := FloorsSkyLight.color(colours[part])
		m.set_shader_parameter("new_%s" % part, Vector3(c.r, c.g, c.b))
	return m
