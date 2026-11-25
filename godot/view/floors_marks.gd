class_name FloorsMarks
extends Node2D

## Ovals and boxes drawn over the building: the spots of arranging, and where the next table would go.

var depth := 0.0:
	set(value):
		depth = value
		FloorsDepth.stand(self, value)
		queue_redraw()
var _shapes: Array = []


func clear() -> void:
	if not _shapes.is_empty():
		_shapes.clear()
		queue_redraw()


func ellipse(at: Vector2, size: Vector2, fill: Color, line: Color, width: float) -> void:
	var points := PackedVector2Array()
	for i in 49:
		points.append(at + Vector2(cos(TAU * i / 48.0) * size.x, sin(TAU * i / 48.0) * size.y) / 2.0)
	_shapes.append([points, fill, line, width])
	queue_redraw()


func box(rect: Rect2, radius: float, fill: Color, line: Color, width: float) -> void:
	_shapes.append([FloorsTextures.round_rect(rect, radius), fill, line, width])
	queue_redraw()


## Marks a furniture spot: an oval on the floor, the box on the wall.
func spot(b: Dictionary, where: Dictionary, fill: Color, line: Color, width: float) -> void:
	var at := FloorsLayout.world_point(b, where)
	if where.has("box"):
		var size := Vector2(where["box"]["w"], where["box"]["h"])
		box(Rect2(at - size / 2.0, size), 12.0, fill, line, width)
	else:
		ellipse(at - Vector2(0.0, 6.0), Vector2(minf(where["room"], 220.0), 56.0), fill, line, width)


func _draw() -> void:
	draw_set_transform(Vector2(0.0, -position.y))
	for shape: Array in _shapes:
		draw_colored_polygon(shape[0], shape[1])
		draw_polyline(shape[0], shape[2], shape[3], true)
