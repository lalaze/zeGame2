class_name FloorsPic
extends Node2D

## One picture in the building: where it is (world pixels), how deep it stands, and which part of which texture it
## shows. The scene sorts its children by y, so this node stands at its depth and its sprite makes up the difference.

var sprite := Sprite2D.new()
var library: FloorsLibrary
## The texture's key, and the frame of it: a cell number of a strip, or a name in an atlas.
var key := ""
var frame: Variant = 0
## The shown frame's size, at full size.
var size := Vector2.ZERO
## The point of the frame that `place` is.
var origin := Vector2(0.5, 0.5):
	set(value):
		origin = value
		_fit()
var place := Vector2.ZERO:
	set(value):
		place = value
		sprite.position = Vector2(value.x, value.y - position.y)
var depth := 0.0:
	set(value):
		depth = value
		FloorsDepth.stand(self, value)
		sprite.position.y = place.y - position.y
var stretch := Vector2.ONE:
	set(value):
		stretch = value
		sprite.scale = value * _texel
var turn := 0.0:
	set(value):
		turn = value
		sprite.rotation = value
var flip := false:
	set(value):
		flip = value
		sprite.flip_h = value
var alpha := 1.0:
	set(value):
		alpha = value
		sprite.modulate.a = value
var tint := Color.WHITE:
	set(value):
		tint = value
		sprite.self_modulate = value
## Only this part of the frame is drawn, where it would be anyway; no size means all of it.
var crop := Rect2():
	set(value):
		if value != crop:
			crop = value
			_fit()

# ---- a strip's animation
var clip := ""
var playing := false
var time_scale := 1.0
var _cells: Array = []
var _rate := 0.0
var _clock := 0.0
## Full-size pixels per pixel of the texture.
var _texel := Vector2.ONE
var _region := Rect2()


func _init(lib: FloorsLibrary, texture_key: String = "", shown: Variant = 0) -> void:
	library = lib
	sprite.centered = false
	sprite.region_enabled = true
	add_child(sprite)
	if not texture_key.is_empty():
		show_frame(texture_key, shown)


func show_frame(texture_key: String, shown: Variant = 0) -> void:
	if texture_key == key and typeof(shown) == typeof(frame) and shown == frame:
		return
	if texture_key != key:
		key = texture_key
		sprite.texture = library.texture(texture_key)
		sprite.material = library.material(texture_key)
	frame = shown
	_region = library.region(key, shown)
	size = library.extent(key, shown)
	_texel = size / _region.size
	sprite.scale = stretch * _texel
	_fit()


func set_cell(cell: int) -> void:
	if typeof(frame) != TYPE_INT or frame != cell:
		show_frame(key, cell)


func _fit() -> void:
	if crop.size == Vector2.ZERO:
		sprite.region_rect = _region
		sprite.offset = -origin * _region.size
		return
	var part := Rect2(crop.position / _texel, crop.size / _texel).intersection(Rect2(Vector2.ZERO, _region.size))
	sprite.region_rect = Rect2(_region.position + part.position, part.size)
	sprite.offset = part.position - origin * _region.size


## Its size on screen, in world pixels.
func shown_size() -> Vector2:
	return size * stretch.abs()


func bounds() -> Rect2:
	var s := shown_size()
	return Rect2(place - origin * s, s)


func blend(mode: CanvasItemMaterial.BlendMode) -> void:
	sprite.material = FloorsLibrary.blending(mode)


# ---------------------------------------------------------------- animation

func play(name: String, strip: String, cells: Array, rate: float, scale_: float = 1.0) -> void:
	time_scale = scale_
	if clip == name and playing:
		return
	clip = name
	playing = true
	_cells = cells
	_rate = rate
	_clock = 0.0
	show_frame(strip, cells[0])


func stop() -> void:
	playing = false


func advance(dt: float) -> void:
	if not playing or _cells.is_empty():
		return
	_clock += dt * time_scale
	set_cell(_cells[int(_clock * _rate) % _cells.size()])
