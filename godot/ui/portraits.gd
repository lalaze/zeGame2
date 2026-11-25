class_name Portraits
extends RefCounted

## Pictures the screens show: people as they are painted in the building (floors-portraits.ts), and the painted icons of
## dishes, ingredients, upgrades, furniture and decor (floors-icons.ts).

static var library: FloorsLibrary = null
static var _staff: FloorsStaff = null


## The pictures of the building there is now.
static func use(lib: FloorsLibrary) -> void:
	library = lib
	_staff = null


static func _lib() -> FloorsLibrary:
	if library == null:
		library = FloorsLibrary.new()
	return library


## One frame of a strip, fitted into `size`.
static func _cut(strip: String, frame: int, size: Vector2, material: Material = null) -> TextureRect:
	var lib := _lib()
	var part := AtlasTexture.new()
	part.atlas = lib.texture(strip)
	part.region = lib.region(strip, frame)
	var t := Paper.picture(part, size.x)
	t.custom_minimum_size = size
	t.material = material
	return t


## A guest by cast appearance, from the front.
static func guest(appearance: float, width: float) -> Control:
	var key := FloorsScene.cast_art(appearance)
	if not _lib().sheets.has(key):
		return Paper.space(width)
	return _cut(key, 4, Vector2(width, width * 1.6))


## Someone of the café in their look, from the front.
static func person(look: Dictionary, width: float) -> Control:
	var lib := _lib()
	if _staff == null:
		_staff = FloorsStaff.new(lib)
	for style: String in [lib.staff["order"][posmod(int(look["hairStyle"]), lib.staff["order"].size())]]:
		lib.texture("staff/%s" % style)
		lib.texture("staff/%s-mask" % style)
	var key := _staff.look(look, "owner")
	return _cut(key, 4, Vector2(width, width * 1.6), lib.material(key))


static func cat(id: String, width: float) -> Control:
	return Paper.art("cats/%s-face" % id, width)


## A painted icon by the page's name for it ("item:espresso", "ing:milk", "upgrade:tables", "furniture:sofa",
## "decor:wall_mint", "promo:…"); a signature drink by its base.
static func icon_key(key: String) -> String:
	var parts := key.split(":")
	var painted := "icons/%s" % key.replace(":", "-")
	if ResourceLoader.exists("res://art/full/%s.webp" % painted):
		return painted
	match parts[0]:
		"item":
			if parts.size() > 2 and parts[1] == "sig":
				return "icons/sig-%s" % parts[2]
		"furniture": return "furniture/%s" % parts[1]
		"decor": return "thumbs/%s" % parts[1]
	return painted


static func icon(key: String, size: float) -> Control:
	return Paper.art(icon_key(key), size)


static func shared_library() -> FloorsLibrary:
	return _lib()


## The top of someone, down to the chin.
static func head(look: Dictionary, width: float) -> Control:
	var figure := person(look, width)
	var part: AtlasTexture = figure.texture
	part.region = Rect2(part.region.position, Vector2(part.region.size.x, part.region.size.y * 0.45))
	figure.custom_minimum_size = Vector2(width, width * part.region.size.y / part.region.size.x)
	return figure
