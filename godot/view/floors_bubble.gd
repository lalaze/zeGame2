class_name FloorsBubble
extends Node2D

## A thought's paper: words in a rounded box, with two dots towards the head.

const _LINE := Color8(0x7a, 0x5a, 0x44)
const _PAPER := Color8(0xff, 0xfa, 0xf0)
var extent := Vector2.ZERO
var _words: FloorsText
var _towards := 0.0
var _at := Vector2.ZERO
static var _style: StyleBoxFlat = null


func _init(text: String, size: float, wrap: float, ink: Color) -> void:
	_words = FloorsText.new(text, size, ink, 0.0, Color.WHITE, wrap)
	_words.origin = Vector2(0.5, 0.5)
	extent = _words.extent() + Vector2(64.0, 40.0)
	FloorsDepth.stand(self, FloorsDepth.BUBBLE + 1.5)
	add_child(_words)
	if _style == null:
		_style = StyleBoxFlat.new()
		_style.bg_color = _PAPER
		_style.border_color = _LINE
		_style.set_border_width_all(6)
		_style.set_corner_radius_all(34)
		_style.shadow_color = Color(Color8(0x4f, 0x3b, 0x2f), 0.24)
		_style.shadow_size = 1
		_style.shadow_offset = Vector2(0.0, 8.0)


## Where its middle is, and how far aside the head it belongs to.
func put(at: Vector2, towards: float) -> void:
	if at != _at or towards != _towards:
		_at = at
		_towards = towards
		_words.place = at - Vector2(0.0, position.y)
		queue_redraw()


func _draw() -> void:
	var middle := _at - Vector2(0.0, position.y)
	draw_style_box(_style, Rect2(middle - extent / 2.0, extent))
	var lean := clampf(_towards, -extent.x / 2.0 + 40.0, extent.x / 2.0 - 40.0)
	for dot: Array in [[0.28, 13.0], [0.72, 9.0]]:
		var at := middle + Vector2(lerpf(lean, _towards, dot[0]), extent.y / 2.0 + 4.0 + 36.0 * dot[0])
		draw_circle(at, dot[1] + 2.5, _LINE, true, -1.0, true)
		draw_circle(at, dot[1] - 2.5, _PAPER, true, -1.0, true)
