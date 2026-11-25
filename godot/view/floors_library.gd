class_name FloorsLibrary
extends RefCounted

## The building's art: textures by the key they have in the web build (the file under build/ without its extension),
## strips and atlases by frame, and the pictures the game paints for itself. What is not needed at once is loaded in the
## background when first asked for.

## The pictures are drawn at this size: 1 for "full", 2 for "half".
var _scale := 1.0
var instant := false
var _root := "res://art/full/"
var _textures: Dictionary = {}
var _texels: Dictionary = {}
var _materials: Dictionary = {}
var _loading: Dictionary = {}
var _atlases: Dictionary = {}
var _regions: Dictionary = {}
var sheets: Dictionary
var decor: Dictionary
var furniture: Dictionary
var pieces: Dictionary
var frames: Dictionary
var staff: Dictionary
var cats: Dictionary
var sky: Dictionary
static var _blends: Dictionary = {}


func _init(preset: String = "full") -> void:
	_root = "res://art/%s/" % preset
	_scale = 1.0 if preset == "full" else 2.0
	sheets = json("sheets.json")
	decor = json("decor/decor.json")
	furniture = json("furniture/furniture.json")
	pieces = json("upgrades/pieces.json")
	frames = json("frame/frame.json")
	staff = json("staff/staff.json")
	cats = json("cats/cats.json")
	sky = json("sky/sky.json")
	for atlas: Array in [["fx", "fx/fx"], ["fx-items", "fx/items"], ["sky/sprites", "sky/sprites"]]:
		_atlas(atlas[0], atlas[1])


## Manifests are the same for both sizes: their numbers are full-size pixels.
func json(path: String) -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string("res://art/data/" + path))


func _atlas(key: String, file: String) -> void:
	var cells := {}
	var listed: Dictionary = json(file + ".json")["frames"]
	for name: String in listed:
		var f: Dictionary = listed[name]["frame"]
		cells[name] = Rect2(f["x"], f["y"], f["w"], f["h"])
	_atlases[key] = cells
	_textures[key] = _fetch(file)


func path(key: String) -> String:
	return _root + (key if key.ends_with(".webp") else key + ".webp")


func exists(key: String) -> bool:
	return _textures.has(key) or ResourceLoader.exists(path(key))


func _fetch(key: String) -> Texture2D:
	return load(path(key)) as Texture2D


func texture(key: String) -> Texture2D:
	if not _textures.has(key):
		_textures[key] = _fetch(key)
		_loading.erase(key)
	return _textures[key]


## Whether a texture is here; starts loading it otherwise.
func ready(key: String) -> bool:
	if _textures.has(key):
		return true
	if instant:
		_loading[key] = true
		return false
	if not _loading.has(key):
		_loading[key] = true
		if ResourceLoader.exists(path(key)):
			ResourceLoader.load_threaded_request(path(key))
		return false
	match ResourceLoader.load_threaded_get_status(path(key)):
		ResourceLoader.THREAD_LOAD_LOADED:
			_textures[key] = ResourceLoader.load_threaded_get(path(key))
			_loading.erase(key)
			return true
	return false


func all_ready(keys: Array) -> bool:
	var here := true
	for key: String in keys:
		here = ready(key) and here
	return here


## With `instant`, what was asked for is here from the next frame on; for tests.
func arrive() -> void:
	for key: String in _loading.keys():
		texture(key)


## Forgets a texture nobody shows any more.
func release(key: String) -> void:
	_textures.erase(key)
	_materials.erase(key)
	_regions.erase(key)


## Adds a picture the game made itself; it is at full size whatever the art is.
func add(key: String, made: Texture2D, texel_: float = 1.0) -> void:
	_textures[key] = made
	_texels[key] = texel_
	_regions.erase(key)


## Draws one texture through a material, under a key of its own.
func add_look(key: String, strip: String, mat: Material) -> void:
	_textures[key] = texture(strip)
	_texels[key] = texel(strip)
	_materials[key] = mat
	sheets[key] = sheets[strip]


func material(key: String) -> Material:
	return _materials.get(key)


func texel(key: String) -> float:
	return _texels.get(key, _scale)


## The part of the texture that is a frame, in the texture's own pixels.
func region(key: String, frame: Variant) -> Rect2:
	var by_frame: Dictionary = _regions.get_or_add(key, {})
	if by_frame.has(frame):
		return by_frame[frame]
	var out: Rect2
	if frame is String:
		var r: Rect2 = _atlases[key][frame]
		out = Rect2(r.position / texel(key), r.size / texel(key))
	elif sheets.get(key, {}).has("frameWidth"):
		# Half-size strips have cells of whole pixels.
		var cell := (Vector2(sheets[key]["frameWidth"], sheets[key]["frameHeight"]) / texel(key)).round()
		out = Rect2(Vector2(cell.x * int(frame), 0.0), cell)
	else:
		out = Rect2(Vector2.ZERO, texture(key).get_size())
	by_frame[frame] = out
	return out


## A frame's size at full size.
func extent(key: String, frame: Variant) -> Vector2:
	if frame is String:
		return _atlases[key][frame].size
	if sheets.get(key, {}).has("frameWidth"):
		return Vector2(sheets[key]["frameWidth"], sheets[key]["frameHeight"])
	return texture(key).get_size() * texel(key)


func has_frame(key: String, frame: String) -> bool:
	return _atlases.has(key) and _atlases[key].has(frame)


static func blending(mode: CanvasItemMaterial.BlendMode) -> CanvasItemMaterial:
	if not _blends.has(mode):
		var m := CanvasItemMaterial.new()
		m.blend_mode = mode
		_blends[mode] = m
	return _blends[mode]


## Multiplies what is behind by the picture's colour, as much as it is opaque.
static var _shade: ShaderMaterial = null
static func shading() -> ShaderMaterial:
	if _shade == null:
		var shader := Shader.new()
		shader.code = "shader_type canvas_item;\nrender_mode blend_mul;\nvoid fragment() {\n\tCOLOR = vec4(mix(vec3(1.0), COLOR.rgb, COLOR.a), 1.0);\n}\n"
		_shade = ShaderMaterial.new()
		_shade.shader = shader
	return _shade
