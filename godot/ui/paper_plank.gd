class_name PaperPlank
extends PanelContainer

## Direction A wooden plank: vertical wood gradient, subtle woodgrain stripes, bottom 3px lip, soft shadow, optional ropes.
## Used for the hanging sign, the bottom shelf board, and future wood buttons / chalkboard frames.

var top_color: Color = Color8(0xb9, 0x83, 0x52)
var bottom_color: Color = Color8(0x8d, 0x5c, 0x35)
var lip_color: Color = Color8(0x6e, 0x45, 0x27)
var edge_color: Color = Color8(0x6b, 0x44, 0x26)
var radius: float = 12.0
var lip_height: float = 3.0
var flat_bottom: bool = false
var ropes: bool = false
var rope_height: float = 20.0
var rope_right_inset: float = 34.0
var upward_shadow: bool = false

var _cached_size := Vector2(-1.0, -1.0)
var _fill_pts := PackedVector2Array()
var _fill_colors := PackedColorArray()
var _border_pts := PackedVector2Array()
var _lip_pts := PackedVector2Array()
var _shadow_pts := PackedVector2Array()
var _grain: Array = []


func _init(pad: Vector2 = Vector2(14, 9), corner_radius: float = 12.0, with_ropes: bool = false, shelf: bool = false) -> void:
	radius = corner_radius
	ropes = with_ropes
	flat_bottom = shelf
	upward_shadow = shelf
	if shelf:
		top_color = Color8(0xa8, 0x74, 0x4a)
		bottom_color = Color8(0x7d, 0x51, 0x32)
		lip_height = 0.0
		edge_color = Color.TRANSPARENT
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = pad.x
	empty.content_margin_right = pad.x
	empty.content_margin_top = pad.y
	empty.content_margin_bottom = pad.y
	add_theme_stylebox_override("panel", empty)
	resized.connect(_rebuild)


func set_padding(left: float, top: float, right: float, bottom: float) -> void:
	var s := StyleBoxEmpty.new()
	s.content_margin_left = left
	s.content_margin_top = top
	s.content_margin_right = right
	s.content_margin_bottom = bottom
	add_theme_stylebox_override("panel", s)


static func _rounded_poly(rect: Rect2, r_top: float, r_bottom: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var rt := minf(r_top, minf(rect.size.x, rect.size.y) * 0.5)
	var rb := minf(r_bottom, minf(rect.size.x, rect.size.y) * 0.5)
	# Bottom-right, bottom-left, top-left, top-right
	var corners := [
		[Vector2(rect.end.x - rb, rect.end.y - rb), 0.0, rb],
		[Vector2(rect.position.x + rb, rect.end.y - rb), PI * 0.5, rb],
		[Vector2(rect.position.x + rt, rect.position.y + rt), PI, rt],
		[Vector2(rect.end.x - rt, rect.position.y + rt), PI * 1.5, rt],
	]
	for c: Array in corners:
		var center: Vector2 = c[0]
		var start: float = c[1]
		var r: float = c[2]
		if r <= 0.5:
			if pts.is_empty() or pts[pts.size() - 1].distance_squared_to(center) > 0.01:
				pts.append(center)
		else:
			for i in 7:
				var pt := center + Vector2.from_angle(start + PI * 0.5 * i / 6.0) * r
				if pts.is_empty() or pts[pts.size() - 1].distance_squared_to(pt) > 0.01:
					pts.append(pt)
	if pts.size() > 1 and pts[0].distance_squared_to(pts[pts.size() - 1]) <= 0.01:
		pts.remove_at(pts.size() - 1)
	return pts


func _rebuild() -> void:
	_cached_size = size
	_fill_pts.clear()
	_fill_colors.clear()
	_border_pts.clear()
	_lip_pts.clear()
	_shadow_pts.clear()
	_grain.clear()
	if size.x <= 1.0 or size.y <= 1.0:
		return
	var rect := Rect2(Vector2.ZERO, size)
	var rb := 0.0 if flat_bottom else radius
	_fill_pts = _rounded_poly(rect, radius, rb)
	for p: Vector2 in _fill_pts:
		var t := clampf(p.y / maxf(1.0, size.y), 0.0, 1.0)
		_fill_colors.append(top_color.lerp(bottom_color, t))
	_border_pts = _fill_pts.duplicate()
	_border_pts.append(_fill_pts[0])
	if lip_height > 0.0:
		_lip_pts = _rounded_poly(Rect2(Vector2(0.0, lip_height), size), radius, rb)
	var sh_offset := Vector2(0.0, -4.0) if upward_shadow else Vector2(0.0, lip_height + 4.0)
	_shadow_pts = _rounded_poly(Rect2(sh_offset, size), radius, rb)
	# Subtle alternating woodgrain bands clamped inside the rounded silhouette.
	var step := 7.0
	var y := 4.0
	var idx := 0
	while y < size.y - 3.0:
		var dy_top := y
		var dy_bot := size.y - y
		var inset := 2.0
		if dy_top < radius:
			inset = maxf(inset, radius - sqrt(maxf(0.0, radius * radius - (radius - dy_top) * (radius - dy_top))) + 1.0)
		if rb > 0.0 and dy_bot < rb:
			inset = maxf(inset, rb - sqrt(maxf(0.0, rb * rb - (rb - dy_bot) * (rb - dy_bot))) + 1.0)
		if size.x - inset * 2.0 > 6.0:
			var col := Color(1.0, 1.0, 1.0, 0.06) if idx % 2 == 0 else Color(0.0, 0.0, 0.0, 0.055)
			var slant := minf(2.0, (size.y - y - 2.0))
			_grain.append([Vector2(inset, y), Vector2(size.x - inset, y + slant * 0.5), col])
		y += step
		idx += 1
	queue_redraw()


func _draw() -> void:
	if _cached_size != size:
		_rebuild()
	if _fill_pts.is_empty():
		return
	if ropes:
		var rope_col := Color8(0x6b, 0x4a, 0x2f)
		var rope_edge := Color8(0x4a, 0x31, 0x1d)
		var rope_hi := Color(1.0, 0.94, 0.84, 0.28)
		var x1 := minf(28.0, size.x * 0.25)
		var x2 := maxf(x1 + 20.0, size.x - rope_right_inset)
		for rx: float in [x1, x2]:
			draw_rect(Rect2(rx - 2.0, -rope_height, 4.0, rope_height + 4.0), rope_edge, true)
			draw_rect(Rect2(rx - 1.2, -rope_height, 2.4, rope_height + 4.0), rope_col, true)
			draw_rect(Rect2(rx - 0.5, -rope_height, 0.8, rope_height + 4.0), rope_hi, true)
	if not _shadow_pts.is_empty():
		draw_colored_polygon(_shadow_pts, Color(40 / 255.0, 20 / 255.0, 5 / 255.0, 0.22 if upward_shadow else 0.24))
	if not _lip_pts.is_empty():
		draw_colored_polygon(_lip_pts, lip_color)
	draw_polygon(_fill_pts, _fill_colors)
	for g: Array in _grain:
		draw_line(g[0], g[1], g[2], 3.0, false)
	if edge_color.a > 0.0:
		draw_polyline(_border_pts, edge_color, 1.6, true)
