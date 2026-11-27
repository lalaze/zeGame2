class_name PaperChalkboard
extends PanelContainer

## Direction A Stage 4 chalkboard dialog frame: warm grained wood frame with a dark-green radial-gradient slate inside,
## plus helper widgets for the tilted yellow weather sticky note and the golden bell open button.

const SLATE_CENTER := Color8(0x3c, 0x5a, 0x48)
const SLATE_EDGE := Color8(0x2a, 0x40, 0x33)

var frame_pad := 11.0
var slate_pad := Vector4(13.0, 12.0, 13.0, 10.0) # left, top, right, bottom

var _cached_size := Vector2(-1.0, -1.0)
var _cached_pad := -1.0
var _frame_pts := PackedVector2Array()
var _frame_colors := PackedColorArray()
var _frame_border := PackedVector2Array()
var _lip_pts := PackedVector2Array()
var _shadow_pts := PackedVector2Array()
var _grain: Array = []
var _slate_pts := PackedVector2Array()
var _slate_uvs := PackedVector2Array()
var _slate_colors := PackedColorArray()
var _slate_border := PackedVector2Array()


func _init(narrow: bool = false) -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	set_compact(narrow)
	resized.connect(_rebuild)


func set_compact(narrow: bool) -> void:
	frame_pad = 9.0 if narrow else 11.0
	slate_pad = Vector4(10.0, 10.0, 10.0, 8.0) if narrow else Vector4(13.0, 12.0, 13.0, 10.0)
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = frame_pad + slate_pad.x
	empty.content_margin_top = frame_pad + slate_pad.y
	empty.content_margin_right = frame_pad + slate_pad.z
	empty.content_margin_bottom = frame_pad + slate_pad.w
	add_theme_stylebox_override("panel", empty)
	_cached_pad = -1.0
	queue_redraw()


static func _radial_slate_tex() -> ImageTexture:
	if Paper._icon_textures.has("chalk_slate"):
		return Paper._icon_textures["chalk_slate"]
	var dim := 64
	var img := Image.create(dim, dim, false, Image.FORMAT_RGBA8)
	var center := Vector2(0.30, 0.20)
	for y in dim:
		var v := (float(y) + 0.5) / float(dim)
		for x in dim:
			var u := (float(x) + 0.5) / float(dim)
			var dx := (u - center.x) / 0.70
			var dy := (v - center.y) / 0.70
			var dist := clampf(sqrt(dx * dx + dy * dy), 0.0, 1.0)
			var t := dist * dist * (3.0 - 2.0 * dist)
			img.set_pixel(x, y, SLATE_CENTER.lerp(SLATE_EDGE, t))
	var tex := ImageTexture.create_from_image(img)
	Paper._icon_textures["chalk_slate"] = tex
	return tex


func _rebuild() -> void:
	_cached_size = size
	_cached_pad = frame_pad
	_frame_pts.clear()
	_frame_colors.clear()
	_frame_border.clear()
	_lip_pts.clear()
	_shadow_pts.clear()
	_grain.clear()
	_slate_pts.clear()
	_slate_uvs.clear()
	_slate_colors.clear()
	_slate_border.clear()
	if size.x <= frame_pad * 2.0 + 4.0 or size.y <= frame_pad * 2.0 + 4.0:
		return
	var r := 16.0
	var rect := Rect2(Vector2.ZERO, size)
	_frame_pts = PaperPlank._rounded_poly(rect, r, r)
	for p: Vector2 in _frame_pts:
		var t := clampf(p.y / maxf(1.0, size.y), 0.0, 1.0)
		_frame_colors.append(Paper.WOOD_1.lerp(Paper.WOOD_2, t))
	_frame_border = _frame_pts.duplicate()
	_frame_border.append(_frame_pts[0])
	_lip_pts = PaperPlank._rounded_poly(Rect2(Vector2(0.0, 3.0), size), r, r)
	_shadow_pts = PaperPlank._rounded_poly(Rect2(Vector2(0.0, 10.0), size), r, r)
	# Subtle alternating woodgrain stripes along the frame.
	var step := 7.0
	var y := 4.0
	var idx := 0
	while y < size.y - 3.0:
		var dy_top := y
		var dy_bot := size.y - y
		var inset := 2.0
		if dy_top < r:
			inset = maxf(inset, r - sqrt(maxf(0.0, r * r - (r - dy_top) * (r - dy_top))) + 1.0)
		if dy_bot < r:
			inset = maxf(inset, r - sqrt(maxf(0.0, r * r - (r - dy_bot) * (r - dy_bot))) + 1.0)
		if size.x - inset * 2.0 > 6.0:
			var col := Color(1.0, 1.0, 1.0, 0.06) if idx % 2 == 0 else Color(0.0, 0.0, 0.0, 0.055)
			var slant := minf(2.0, size.y - y - 2.0)
			_grain.append([Vector2(inset, y), Vector2(size.x - inset, y + slant * 0.5), col])
		y += step
		idx += 1
	var slate_rect := Rect2(Vector2(frame_pad, frame_pad), size - Vector2(frame_pad * 2.0, frame_pad * 2.0))
	_slate_pts = PaperPlank._rounded_poly(slate_rect, 8.0, 8.0)
	for p: Vector2 in _slate_pts:
		_slate_uvs.append(Vector2((p.x - slate_rect.position.x) / maxf(1.0, slate_rect.size.x), (p.y - slate_rect.position.y) / maxf(1.0, slate_rect.size.y)))
		_slate_colors.append(Color.WHITE)
	_slate_border = _slate_pts.duplicate()
	_slate_border.append(_slate_pts[0])
	queue_redraw()


func _draw() -> void:
	if _cached_size != size or _cached_pad != frame_pad:
		_rebuild()
	if _frame_pts.is_empty():
		return
	draw_colored_polygon(_shadow_pts, Color(0.0, 0.0, 0.0, 0.34))
	draw_colored_polygon(_lip_pts, Paper.WOOD_3)
	draw_polygon(_frame_pts, _frame_colors)
	for g: Array in _grain:
		draw_line(g[0], g[1], g[2], 3.0, false)
	draw_polyline(_frame_border, Paper.WOOD_EDGE, 1.6, true)
	if not _slate_pts.is_empty():
		draw_polygon(_slate_pts, _slate_colors, _slate_uvs, _radial_slate_tex())
		draw_polyline(_slate_border, Color(0.0, 0.0, 0.0, 0.24), 1.4, true)


## Tilted pale-yellow sticky note pinned at the top-right edge of the chalkboard.
class StickyNote extends PanelContainer:
	func _init(narrow: bool = false) -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		rotation_degrees = 4.0
		var empty := StyleBoxEmpty.new()
		empty.content_margin_left = 8.0 if narrow else 10.0
		empty.content_margin_right = 8.0 if narrow else 10.0
		empty.content_margin_top = 7.0 if narrow else 9.0
		empty.content_margin_bottom = 7.0 if narrow else 8.0
		add_theme_stylebox_override("panel", empty)
		resized.connect(func() -> void:
			pivot_offset = size * 0.5
			queue_redraw())

	func _draw() -> void:
		if size.x <= 1.0 or size.y <= 1.0:
			return
		var shadow := PaperPlank._rounded_poly(Rect2(Vector2(0.0, 5.0), size), 2.0, 2.0)
		var body := PaperPlank._rounded_poly(Rect2(Vector2.ZERO, size), 2.0, 2.0)
		draw_colored_polygon(shadow, Color(0.0, 0.0, 0.0, 0.32))
		draw_colored_polygon(body, Paper.STICKY_YELLOW)
		var border := body.duplicate()
		border.append(body[0])
		draw_polyline(border, Color(140 / 255.0, 110 / 255.0, 55 / 255.0, 0.2), 1.0, true)


## Full-width golden action button with bell icon on the left and 4px warm-amber lip.
class GoButton extends Button:
	var _icon: TextureRect
	var _label: Label
	var _held := false
	var _cached_size := Vector2(-1.0, -1.0)
	var _pts := PackedVector2Array()
	var _lip := PackedVector2Array()

	func _init(said: String, pressed_cb: Callable, narrow: bool = false, icon_name: String = "bell") -> void:
		focus_mode = Control.FOCUS_NONE
		mouse_filter = Control.MOUSE_FILTER_PASS
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		custom_minimum_size = Vector2(0.0, 46.0 if narrow else 52.0)
		var empty := StyleBoxEmpty.new()
		for st: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
			add_theme_stylebox_override(st, empty)
		_icon = Paper.mark(icon_name, 19.0 if narrow else 21.0, Paper.GO_INK)
		_label = Paper.words(said, "strong", false)
		_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_label.add_theme_font_override("font", Paper.font(800))
		_label.add_theme_font_size_override("font_size", 15 if narrow else 16)
		_label.add_theme_color_override("font_color", Paper.GO_INK)
		var row := Paper.line([_icon, _label], 8)
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.set_anchors_preset(Control.PRESET_FULL_RECT)
		row.offset_left = 10.0
		row.offset_right = -10.0
		add_child(row)
		resized.connect(_rebuild)
		button_down.connect(func() -> void:
			_held = true
			queue_redraw())
		button_up.connect(func() -> void:
			_held = false
			queue_redraw())
		pressed.connect(Paper._finish_typing.bind(self))
		if pressed_cb.is_valid():
			pressed.connect(pressed_cb)

	func _fit() -> void:
		var avail := maxf(80.0, size.x - 48.0)
		var f := Paper.font(800)
		var fs := 16
		while fs > 11 and f.get_string_size(_label.text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > avail:
			fs -= 1
		if fs != _label.get_theme_font_size("font_size"):
			_label.add_theme_font_size_override("font_size", fs)

	func _rebuild() -> void:
		_cached_size = size
		_fit()
		if size.x <= 1.0 or size.y <= 1.0:
			return
		var face := Rect2(Vector2.ZERO, Vector2(size.x, maxf(1.0, size.y - 4.0)))
		_pts = PaperPlank._rounded_poly(face, 16.0, 16.0)
		_lip = PaperPlank._rounded_poly(Rect2(Vector2(0.0, 4.0), face.size), 16.0, 16.0)
		queue_redraw()

	func _draw() -> void:
		if _cached_size != size:
			_rebuild()
		if _pts.is_empty():
			return
		var ink := Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.48) if disabled else Paper.GO_INK
		_icon.modulate = ink
		_label.add_theme_color_override("font_color", ink)
		if disabled:
			var rect := Rect2(Vector2.ZERO, size)
			var pts := PaperPlank._rounded_poly(rect, 16.0, 16.0)
			draw_colored_polygon(pts, Color(1.0, 1.0, 1.0, 0.14))
			var border := pts.duplicate()
			border.append(pts[0])
			draw_polyline(border, Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.30), 1.5, true)
			return
		var down := _held
		var dy := 2.0 if down else 0.0
		draw_colored_polygon(_lip, Paper.GO_LIP)
		var shifted := PackedVector2Array()
		var colors := PackedColorArray()
		var h := maxf(1.0, size.y - 4.0)
		for p: Vector2 in _pts:
			shifted.append(p + Vector2(0.0, dy))
			colors.append(Paper.GO_TOP.lerp(Paper.GO_BOT, clampf(p.y / h, 0.0, 1.0)))
		draw_polygon(shifted, colors)
