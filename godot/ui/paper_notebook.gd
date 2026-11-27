class_name PaperNotebook
extends PanelContainer

## Direction A notebook cover and lined cream page: dark brown leather cover (#8a5a3b, 18px radius, 7px rim),
## cream lined page (#fffaf0, 12px radius, 28px horizontal rules), 6px top color strip matching active tab,
## and a left column of binder rings.

var strip_color: Color = Color8(0xf0, 0xb9, 0xab)


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = 34.0
	empty.content_margin_top = 15.0
	empty.content_margin_right = 12.0
	empty.content_margin_bottom = 8.0
	add_theme_stylebox_override("panel", empty)
	resized.connect(queue_redraw)


func set_strip_color(color: Color) -> void:
	if strip_color != color:
		strip_color = color
		queue_redraw()


func _draw() -> void:
	if size.x <= 16.0 or size.y <= 16.0:
		return
	var cover_rect := Rect2(Vector2.ZERO, size)
	var shadow := PaperPlank._rounded_poly(Rect2(Vector2(0.0, 8.0), size), 18.0, 18.0)
	draw_colored_polygon(shadow, Color(0.0, 0.0, 0.0, 0.28))
	var cover := PaperPlank._rounded_poly(cover_rect, 18.0, 18.0)
	draw_colored_polygon(cover, Paper.BOOK_COVER)
	var rim := 7.0
	var page_rect := Rect2(Vector2(rim, rim), size - Vector2(rim * 2.0, rim * 2.0))
	if page_rect.size.x <= 4.0 or page_rect.size.y <= 4.0:
		return
	var page := PaperPlank._rounded_poly(page_rect, 12.0, 12.0)
	draw_colored_polygon(page, Paper.LIGHT)
	# 6px active-tab color strip across the top of the cream page, following the top rounded corners.
	var strip_h := 6.0
	var strip_poly := _top_strip_poly(page_rect, 12.0, strip_h)
	draw_colored_polygon(strip_poly, strip_color)
	# Subtle ruled lines every 28px down the page.
	var rule_col := Color(170 / 255.0, 140 / 255.0, 100 / 255.0, 0.16)
	var y := page_rect.position.y + 28.0
	while y < page_rect.end.y - 6.0:
		draw_line(Vector2(page_rect.position.x + 2.0, y), Vector2(page_rect.end.x - 2.0, y), rule_col, 1.0, false)
		y += 28.0
	# Left binder rings along the page margin.
	var ring_x := page_rect.position.x + 11.0
	var ry := page_rect.position.y + 22.0
	var ring_fill := Color8(0xd8, 0xc6, 0xa8)
	var ring_edge := Color8(0xa8, 0x8f, 0x6c)
	while ry < page_rect.end.y - 16.0:
		draw_circle(Vector2(ring_x, ry), 4.0, ring_edge)
		draw_circle(Vector2(ring_x, ry), 2.9, ring_fill)
		ry += 34.0


static func _top_strip_poly(page: Rect2, radius: float, strip_h: float) -> PackedVector2Array:
	var r := minf(radius, minf(page.size.x * 0.5, page.size.y * 0.5))
	var pts := PackedVector2Array()
	var dy := maxf(0.0, r - strip_h)
	var dx := sqrt(maxf(0.0, r * r - dy * dy))
	var left_cx := page.position.x + r
	var left_cy := page.position.y + r
	var right_cx := page.end.x - r
	var start_ang := atan2(-dy, -dx)
	var end_ang := -PI * 0.5
	for i in 7:
		var ang := lerpf(start_ang, end_ang, float(i) / 6.0)
		pts.append(Vector2(left_cx, left_cy) + Vector2(cos(ang), sin(ang)) * r)
	var r_start := -PI * 0.5
	var r_end := atan2(-dy, dx)
	for i in 7:
		var ang := lerpf(r_start, r_end, float(i) / 6.0)
		var pt := Vector2(right_cx, left_cy) + Vector2(cos(ang), sin(ang)) * r
		if pts.is_empty() or pts[pts.size() - 1].distance_squared_to(pt) > 0.01:
			pts.append(pt)
	return pts
