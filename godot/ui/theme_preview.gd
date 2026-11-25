class_name ThemePreview
extends RefCounted

## A starter theme as the building will wear it (src/render/floors/floors-theme-preview.ts): the ground floor's decor
## layers, back to front, cropped to the room.

const _CROP := Rect2(262, 86, 1152, 792)
const _SIDE_WINDOW_Y := 16.0


static func control(theme_id: String, width: float) -> Control:
	var scale := width / _CROP.size.x
	var box := Control.new()
	box.clip_contents = true
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.custom_minimum_size = Vector2(width, _CROP.size.y * scale)
	var s := CoreState.create_initial_state(0.0)
	CoreDecor.apply_theme(s, theme_id)
	var lib := Portraits.shared_library()
	for l: Array in _layers(lib, s["decor"]["equipped"]):
		var picture := TextureRect.new()
		picture.texture = lib.texture(l[0])
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
		picture.position = (Vector2(0, l[1]) - _CROP.position) * scale
		picture.size = lib.extent(l[0], 0) * scale
		box.add_child(picture)
	return box


## [texture, how far down] back to front; the window that replaced the side door is over the wall and the floor.
static func _layers(lib: FloorsLibrary, equipped: Dictionary) -> Array:
	var entry: Dictionary = lib.decor["1f"]
	var out := []
	for side: Array in [["back", FloorsArt.BACK_LAYERS], ["front", FloorsArt.FRONT_LAYERS]]:
		for name: String in side[1]:
			var key: String = entry["slots"].get(name, {}).get(equipped.get(name, ""), "")
			for fixed: String in entry[side[0]]:
				if fixed.ends_with("/%s.webp" % name):
					key = fixed
			if not key.is_empty():
				out.append([key, 0.0])
			if name == "fixtures":
				out.append(["frame/side-window", _SIDE_WINDOW_Y])
	return out
