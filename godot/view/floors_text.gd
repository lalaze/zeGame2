class_name FloorsText
extends Node2D

## Words in the building: at a place and a depth, like FloorsPic.

static var font: Font = null
var label := Label.new()
var origin := Vector2(0.5, 1.0)
var depth := 0.0:
	set(value):
		depth = value
		FloorsDepth.stand(self, value)
		_fit()
var place := Vector2.ZERO:
	set(value):
		place = value
		_fit()
var alpha := 1.0:
	set(value):
		alpha = value
		modulate.a = value
var stretch := 1.0:
	set(value):
		stretch = value
		label.scale = Vector2.ONE * value
		_fit()


func _init(text: String, size: float, colour: Color, outline: float = 0.0, outline_colour: Color = Color.WHITE, wrap: float = 0.0) -> void:
	var settings := LabelSettings.new()
	settings.font = font
	settings.font_size = int(size)
	settings.font_color = colour
	# Godot draws a quarter of the outline's size on each side of a letter, where the web's stroke has half of its width.
	settings.outline_size = int(outline * 2.0)
	settings.outline_color = outline_colour
	label.label_settings = settings
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(label)
	if wrap > 0.0 and measure().x > wrap:
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size.x = wrap
	label.size = label.get_combined_minimum_size()
	if wrap > 0.0 and label.autowrap_mode != TextServer.AUTOWRAP_OFF:
		var lines := font.get_multiline_string_size(text, HORIZONTAL_ALIGNMENT_CENTER, wrap, settings.font_size)
		label.size = Vector2(wrap, lines.y)


func measure() -> Vector2:
	var s := label.label_settings
	return s.font.get_string_size(label.text, HORIZONTAL_ALIGNMENT_LEFT, -1, s.font_size)


## The words' own size, before `stretch`.
func extent() -> Vector2:
	return label.size


func _fit() -> void:
	label.position = Vector2(place.x, place.y - position.y) - origin * label.size * stretch
