class_name PaperCheckButton
extends Button

## Circular on-sale checkmark toggle button on Menu dish cards.
## Keeps a 40x40 touch target while drawing the crisp 26x26 visual circle + checkmark centered inside.
## Keeps its accessibility/parity label in `text` (hidden visually).

const VISUAL_RADIUS := 11.5
static var _empty_sb: StyleBoxEmpty = null

var active := false:
	set(value):
		if active != value:
			active = value
			queue_redraw()
var _check_tex: Texture2D


func _init(pressed_cb: Callable = Callable()) -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_filter = Control.MOUSE_FILTER_PASS
	custom_minimum_size = Vector2(40.0, 40.0)
	clip_text = true
	if _empty_sb == null:
		_empty_sb = StyleBoxEmpty.new()
	for st: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		add_theme_stylebox_override(st, _empty_sb)
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color", "font_disabled_color"]:
		add_theme_color_override(tone, Color(0, 0, 0, 0))
	add_theme_font_size_override("font_size", 1)
	_check_tex = Paper.icon("check", 14)
	if pressed_cb.is_valid():
		pressed.connect(pressed_cb)


func _draw() -> void:
	var center := size * 0.5
	var r := minf(VISUAL_RADIUS, minf(size.x, size.y) * 0.5 - 1.5)
	var alpha := 0.55 if disabled else 1.0
	var fill := Color8(0xf0, 0xf6, 0xec) if active else Color.WHITE
	var edge := Paper.SAGE_A if active else Color8(0xcd, 0xbf, 0xa9)
	fill.a *= alpha
	edge.a *= alpha
	draw_circle(center, r, fill)
	draw_arc(center, r, 0.0, TAU, 28, edge, 2.0, true)
	if _check_tex != null:
		var icon_sz := Vector2(14.0, 14.0)
		draw_texture_rect(_check_tex, Rect2(center - icon_sz * 0.5, icon_sz), false, edge)
