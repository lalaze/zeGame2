class_name PaperTapedCard
extends PanelContainer

## Direction A paper card with a strip of masking tape across the top-left and an optional bottom-right pointer tail.

var tail_right: float = 0.0
var tape_left: float = 18.0


func _init(pointer_from_right: float = 0.0, pad: Vector2 = Vector2(14, 14)) -> void:
	tail_right = pointer_from_right
	mouse_filter = Control.MOUSE_FILTER_STOP
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = pad.x
	empty.content_margin_right = pad.x
	empty.content_margin_top = pad.y + 2.0
	empty.content_margin_bottom = pad.y
	add_theme_stylebox_override("panel", empty)
	resized.connect(queue_redraw)


func _draw() -> void:
	if size.x <= 1.0 or size.y <= 1.0:
		return
	var r := 14.0
	var shadow := PaperPlank._rounded_poly(Rect2(Vector2(0.0, 8.0), size), r, r)
	var body := PaperPlank._rounded_poly(Rect2(Vector2.ZERO, size), r, r)
	draw_colored_polygon(shadow, Color(0.0, 0.0, 0.0, 0.28))
	if tail_right > 0.0:
		var tx := clampf(size.x - tail_right, 24.0, size.x - 18.0)
		var sh_tri := PackedVector2Array([Vector2(tx - 11.0, size.y + 2.0), Vector2(tx + 11.0, size.y + 2.0), Vector2(tx, size.y + 13.0)])
		draw_colored_polygon(sh_tri, Color(0.0, 0.0, 0.0, 0.16))
	draw_colored_polygon(body, Paper.LIGHT)
	var border := body.duplicate()
	border.append(body[0])
	draw_polyline(border, Color(122 / 255.0, 90 / 255.0, 68 / 255.0, 0.18), 1.0, true)
	if tail_right > 0.0:
		var tx := clampf(size.x - tail_right, 24.0, size.x - 18.0)
		var tri := PackedVector2Array([Vector2(tx - 11.0, size.y - 1.0), Vector2(tx + 11.0, size.y - 1.0), Vector2(tx, size.y + 10.0)])
		draw_colored_polygon(tri, Paper.LIGHT)
	# Semi-transparent masking tape tilted -4 deg across the top-left edge
	var tc := Vector2(tape_left + 31.0, 0.0)
	var ang := deg_to_rad(-4.0)
	var hw := 31.0
	var hh := 9.0
	var tape := PackedVector2Array()
	for corner: Vector2 in [Vector2(-hw, -hh), Vector2(hw, -hh), Vector2(hw, hh), Vector2(-hw, hh)]:
		tape.append(tc + corner.rotated(ang))
	draw_colored_polygon(tape, Paper.TAPE_COLOR)
