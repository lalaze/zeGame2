class_name PaperSeam
extends Control

## A dashed line across the paper.

var _colour: Color


func _init(colour: Color) -> void:
	_colour = colour
	custom_minimum_size.y = 2.0
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	draw_dashed_line(Vector2(0.0, 1.0), Vector2(size.x, 1.0), _colour, 2.0, 5.0)
