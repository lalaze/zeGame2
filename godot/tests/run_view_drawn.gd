extends SceneTree

## What only a screen can tell of the building (needs a window, not --headless): that what stands deeper is drawn over
## what does not, whichever was made first, and how wide the outline of words is.

const _SIZE := Vector2i(400, 400)
const _PAIRS := [[40000.3, 40000.1], [40000.3, 40000.0], [40000.12, 40000.1], [40000.1, 40000.0], [40001.5, 40001.0], [39998.01, 39998.0], [36010.0, 36000.0], [28000.5, 28000.0], [21512.4, 21512.1], [20000.5, 20000.0], [16001.0, 16000.0],
	[3100.03, 3100.02], [1712.02, 1712.01], [1712.01, 1712.0], [1712.002, 1712.0], [1600.0, 1599.99], [1600.01, 1599.99], [0.5, 0.0], [0.01, 0.0], [-9.49, -9.5], [-9.95, -9.96], [-3.0, -9.5]]
var passed := 0
var failed := 0
var _view := SubViewport.new()
var _scene := Node2D.new()
var _library: FloorsLibrary


func _init() -> void:
	_start.call_deferred()


func _check(label: String, ok: bool, more: Variant = "") -> void:
	if ok:
		passed += 1
	else:
		failed += 1
		print("FAIL: %s %s" % [label, more])


func _start() -> void:
	FloorsText.font = load("res://app/cafe_app.gd").fonts()
	_library = FloorsLibrary.new()
	FloorsTextures.make(_library)
	_view.size = _SIZE
	_view.transparent_bg = true
	_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(_view)
	_scene.y_sort_enabled = true
	_view.add_child(_scene)
	for pair: Array in _PAIRS:
		for first in 2:
			await _over(pair, first)
	await _outline()
	print("DRAWN_SUMMARY: passed=%d failed=%d" % [passed, failed])
	quit(0 if failed == 0 and passed == _PAIRS.size() * 2 + 3 else 1)


func _square(depth: float, colour: Color) -> void:
	var p := FloorsPic.new(_library, "plain")
	p.origin = Vector2(0.5, 0.5)
	p.depth = depth
	p.place = Vector2(200, 200)
	p.stretch = Vector2(200, 200) / p.size
	p.tint = colour
	_scene.add_child(p)


func _shown() -> Image:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	return _view.get_texture().get_image()


func _clear() -> void:
	for child in _scene.get_children():
		child.free()


## Two squares in one place; the deeper, green, is made first or last.
func _over(pair: Array, first: int) -> void:
	for i in 2:
		var which := (i + first) % 2
		_square(pair[which], [Color.GREEN, Color.RED][which])
	var at := (await _shown()).get_pixel(200, 200)
	_check("%s is drawn over %s, made %s" % [pair[0], pair[1], "first" if first == 0 else "last"], at.g > 0.9 and at.r < 0.1, at)
	_clear()


## The stroke of the web's words has half its width on each side of a letter.
func _outline() -> void:
	var w := FloorsText.new("—", 160.0, Color.RED, 40.0, Color.GREEN)
	w.origin = Vector2(0.5, 0.5)
	w.place = Vector2(200, 200)
	_scene.add_child(w)
	var image := await _shown()
	var red := Rect2i()
	var green := Rect2i()
	for y in _SIZE.y:
		for x in _SIZE.x:
			var c := image.get_pixel(x, y)
			if c.a > 0.5:
				var dot := Rect2i(x, y, 1, 1)
				if c.r > 0.5:
					red = dot if red.size == Vector2i.ZERO else red.merge(dot)
				green = dot if green.size == Vector2i.ZERO else green.merge(dot)
	_check("the words are there", red.size.x > 50, red)
	_check("the outline is half its width over the letter", absi(red.position.y - green.position.y - 20) <= 2, [red, green])
	_check("and under it", absi(green.end.y - red.end.y - 20) <= 2, [red, green])
	_clear()
