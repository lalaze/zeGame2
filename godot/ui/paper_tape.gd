class_name PaperTape
extends PanelContainer

## Direction A masking-tape strip for the Menu goal card: semi-transparent warm tape, slightly tilted (-0.6 deg).


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = 10.0
	empty.content_margin_right = 10.0
	empty.content_margin_top = 8.0
	empty.content_margin_bottom = 8.0
	add_theme_stylebox_override("panel", empty)
	resized.connect(queue_redraw)


func _draw() -> void:
	if size.x <= 4.0 or size.y <= 4.0:
		return
	var center := size * 0.5
	var hw := size.x * 0.5
	var hh := size.y * 0.5
	var ang := deg_to_rad(-0.6)
	var corners := [Vector2(-hw, -hh), Vector2(hw, -hh), Vector2(hw, hh), Vector2(-hw, hh)]
	var shadow := PackedVector2Array()
	var body := PackedVector2Array()
	for c: Vector2 in corners:
		var p := center + c.rotated(ang)
		body.append(p)
		shadow.append(p + Vector2(0.0, 1.5))
	draw_colored_polygon(shadow, Color(74 / 255.0, 52 / 255.0, 38 / 255.0, 0.10))
	draw_colored_polygon(body, Color(240 / 255.0, 200 / 255.0, 150 / 255.0, 0.58))
