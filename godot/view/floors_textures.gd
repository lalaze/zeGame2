class_name FloorsTextures
extends RefCounted

## The little pictures the game puts together itself: bubbles with something in them (as floors-fx.ts repaints the web
## view's), the bar over someone at work, the oven's glow, a lamp's light.

const CUE_KINDS: Array[String] = ["recommend", "greet", "cat", "photo", "delivery"]
## The bar over someone at work: its paper, and the sage it fills with from the left.
const BAR := {"key": "bar", "fill": "bar-fill", "width": 92.0, "height": 24.0, "edge": 5.0}
const _LINE := Color8(0x7a, 0x5a, 0x44)
const _PAPER := Color8(0xff, 0xfa, 0xf0)


static func make(library: FloorsLibrary) -> void:
	var plain := Image.create(8, 8, false, Image.FORMAT_RGBA8)
	plain.fill(Color.WHITE)
	library.add("plain", ImageTexture.create_from_image(plain))
	library.add("glow", _radial(Vector2i(260, 170), 84.0 / 130.0, [[0.07, Color(1.0, 190 / 255.0, 90 / 255.0, 0.95)], [0.5, Color(1.0, 150 / 255.0, 60 / 255.0, 0.45)], [1.0, Color(1.0, 120 / 255.0, 40 / 255.0, 0.0)]]))
	# A lamp's light: a soft white disc, tinted warm (or pink for neon) where it is used.
	library.add("sky/lamp", _radial(Vector2i(256, 256), 1.0, [[0.016, Color(1, 1, 1, 0.95)], [0.22, Color(1, 1, 1, 0.5)], [0.55, Color(1, 1, 1, 0.16)], [1.0, Color(1, 1, 1, 0.0)]]))
	for entry: Array in [["cup", Vector2i(44, 40), "cup", Vector2(22, 20), 40.0], ["bread", Vector2i(56, 40), "bread", Vector2(28, 20), 54.0], ["sparkle", Vector2i(40, 40), "sparkle", Vector2(20, 20), 38.0], ["puff", Vector2i(40, 40), "puff", Vector2(20, 20), 38.0]]:
		var image := Image.create(entry[1].x, entry[1].y, false, Image.FORMAT_RGBA8)
		_put(library, image, entry[2], entry[3], entry[4])
		library.add(entry[0], ImageTexture.create_from_image(image))
	# A barista's "order up" rings the bell; a sale leaves a heart.
	_bubble(library, "bubble-coffee", "bell", 66.0)
	_bubble(library, "bubble-heart", "heart", 58.0)
	_bubble(library, "bubble-bread", "bread", 66.0)
	_bubble(library, "bubble-sad", "rain", 66.0)
	_bubble(library, "bubble-moment", "bang", 62.0)
	for kind in CUE_KINDS:
		_bubble(library, "cue-%s" % kind, "cue-%s" % kind, 72.0)
	_bars(library)


static func _bubble(library: FloorsLibrary, key: String, inside: String, size: float) -> void:
	var image := Image.create(116, 124, false, Image.FORMAT_RGBA8)
	_put(library, image, "bubble", Vector2(58, 62), 124.0)
	_put(library, image, inside, Vector2(58, 52), size)
	library.add(key, ImageTexture.create_from_image(image))


## Centres an fx frame on a point, fitted to a square of `size`.
static func _put(library: FloorsLibrary, image: Image, frame: String, at: Vector2, size: float) -> void:
	var region := Rect2i(library.region("fx", frame))
	var part := picture(library, "fx").get_region(region)
	var longest := float(maxi(region.size.x, region.size.y))
	part.resize(maxi(1, roundi(region.size.x * size / longest)), maxi(1, roundi(region.size.y * size / longest)), Image.INTERPOLATE_LANCZOS)
	image.blend_rect(part, Rect2i(Vector2i.ZERO, part.get_size()), Vector2i((at - Vector2(part.get_size()) / 2.0).round()))


## A texture's pixels, as one can draw with them.
static func picture(library: FloorsLibrary, key: String) -> Image:
	var image := library.texture(key).get_image()
	if image.is_compressed():
		image.decompress()
	image.convert(Image.FORMAT_RGBA8)
	return image


static func _radial(size: Vector2i, reach: float, stops: Array) -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array(stops.map(func(s: Array) -> float: return s[0]))
	gradient.colors = PackedColorArray(stops.map(func(s: Array) -> Color: return s[1]))
	var out := GradientTexture2D.new()
	out.gradient = gradient
	out.width = size.x
	out.height = size.y
	out.fill = GradientTexture2D.FILL_RADIAL
	out.fill_from = Vector2(0.5, 0.5)
	# The gradient is as wide as it is high in the picture's own pixels.
	out.fill_to = Vector2(0.5 + reach / 2.0, 0.5)
	return out


## Where a point is, from inside (below 0) to outside a rounded box.
static func _outside(p: Vector2, rect: Rect2, radius: float) -> float:
	var q := (p - rect.get_center()).abs() - rect.size / 2.0 + Vector2(radius, radius)
	return Vector2(maxf(q.x, 0.0), maxf(q.y, 0.0)).length() + minf(maxf(q.x, q.y), 0.0) - radius


static func _bars(library: FloorsLibrary) -> void:
	var size := Vector2(BAR["width"], BAR["height"])
	var edge: float = BAR["edge"]
	var paper := Image.create(int(size.x), int(size.y), false, Image.FORMAT_RGBA8)
	var fill := Image.create(int(size.x), int(size.y), false, Image.FORMAT_RGBA8)
	var outer := Rect2(2.0, 2.0, size.x - 4.0, size.y - 4.0)
	var inner := Rect2(edge, edge, size.x - 2.0 * edge, size.y - 2.0 * edge)
	for y in int(size.y):
		for x in int(size.x):
			var p := Vector2(x + 0.5, y + 0.5)
			var far := _outside(p, outer, outer.size.y / 2.0)
			var colour := _PAPER.lerp(_LINE, clampf(far + 2.5, 0.0, 1.0))
			colour.a = clampf(2.5 - far, 0.0, 1.0)
			paper.set_pixel(x, y, colour)
			var sage := Color8(0xa5, 0xc3, 0x9c) if p.y < edge + inner.size.y * 0.4 else Color8(0x7f, 0xa2, 0x7a)
			sage.a = clampf(0.5 - _outside(p, inner, inner.size.y / 2.0), 0.0, 1.0)
			fill.set_pixel(x, y, sage)
	library.add(BAR["key"], ImageTexture.create_from_image(paper))
	library.add(BAR["fill"], ImageTexture.create_from_image(fill))


## A rounded box's outline, closed.
static func round_rect(rect: Rect2, radius: float) -> PackedVector2Array:
	var points := PackedVector2Array()
	var r := minf(radius, minf(rect.size.x, rect.size.y) / 2.0)
	for corner: Array in [[rect.end - Vector2(r, r), 0.0], [Vector2(rect.position.x + r, rect.end.y - r), PI / 2.0], [rect.position + Vector2(r, r), PI], [Vector2(rect.end.x - r, rect.position.y + r), PI * 1.5]]:
		for i in 9:
			points.append(corner[0] + Vector2.from_angle(corner[1] + PI / 2.0 * i / 8.0) * r)
	points.append(points[0])
	return points
