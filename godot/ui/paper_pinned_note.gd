class_name PaperPinnedNote
extends PanelContainer

## Direction A pinned yellow note: pale yellow paper, subtle tilt (-1.2 deg), glossy red pushpin on the left, soft shadow.

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	rotation_degrees = -1.2
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = 30.0
	empty.content_margin_right = 14.0
	empty.content_margin_top = 10.0
	empty.content_margin_bottom = 10.0
	add_theme_stylebox_override("panel", empty)
	resized.connect(func() -> void:
		pivot_offset = size * 0.5
		queue_redraw())


func _draw() -> void:
	if size.x <= 1.0 or size.y <= 1.0:
		return
	var r := 3.0
	var shadow := PaperPlank._rounded_poly(Rect2(Vector2(0.0, 4.0), size), r, r)
	var body := PaperPlank._rounded_poly(Rect2(Vector2.ZERO, size), r, r)
	draw_colored_polygon(shadow, Color(0.0, 0.0, 0.0, 0.22))
	draw_colored_polygon(body, Paper.NOTE_YELLOW)
	var border := body.duplicate()
	border.append(body[0])
	draw_polyline(border, Color(140 / 255.0, 110 / 255.0, 55 / 255.0, 0.18), 1.0, true)
	# Glossy red pushpin on the left
	var pin := Vector2(15.5, 17.5)
	draw_circle(pin + Vector2(0.0, 1.5), 5.8, Color(0.0, 0.0, 0.0, 0.32))
	draw_circle(pin, 5.5, Color8(0xc9, 0x48, 0x3a))
	draw_circle(pin + Vector2(-1.6, -1.6), 2.4, Color8(0xff, 0x9c, 0x8a))
