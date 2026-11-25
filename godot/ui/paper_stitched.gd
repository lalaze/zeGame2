class_name PaperStitched
extends PanelContainer

## Paper with a dashed line sewn along its edge, or a little inside it.

var _colour: Color
var _inset: float
var _radius: float


func _init(colour: Color, inset: float, radius: float) -> void:
	_colour = colour
	_inset = inset
	_radius = radius
	resized.connect(queue_redraw)


func _draw() -> void:
	var rect := Rect2(Vector2(_inset, _inset), size - Vector2(_inset, _inset) * 2.0)
	if rect.size.x <= 0.0 or rect.size.y <= 0.0:
		return
	var points := FloorsTextures.round_rect(rect, _radius)
	var left := 0.0
	var on := true
	# One dash after another along the whole outline.
	for i in points.size() - 1:
		var from := points[i]
		var to := points[i + 1]
		var length := from.distance_to(to)
		var at := 0.0
		while at < length:
			var run := minf((5.0 if on else 4.0) - left, length - at)
			if on:
				draw_line(from.lerp(to, at / length), from.lerp(to, (at + run) / length), _colour, 2.0 if _inset <= 1.0 else 1.5, true)
			at += run
			left += run
			if left >= (5.0 if on else 4.0) - 0.001:
				left = 0.0
				on = not on
