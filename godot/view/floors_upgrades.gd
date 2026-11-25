class_name FloorsUpgrades
extends RefCounted

## What upgrades change in the building: the espresso machine on the ground floor at levels 5, 10 and 15, and the
## basement kitchen, put together from its pieces whenever what it holds changes. Port of floors-upgrades.ts.

## The basement's picture, and its table alone, which stands in front of whoever is behind it.
const KITCHEN := "upgrades/kitchen"
const TABLE := "upgrades/table"
const _PIECES := "upgrades/pieces"
var _library: FloorsLibrary
var _signature := ""
var _tiers: Dictionary = {}
var _timer := 0.0
var _kitchen: ImageTexture = null
var _table: ImageTexture = null


func _init(library: FloorsLibrary) -> void:
	_library = library


## Draws the basement's picture and the table as the café's kitchen is now.
func update_kitchen(s: Dictionary) -> void:
	var pieces := FloorsArt.kitchen_pieces(CoreKitchen.installed_equipment(s), s["upgrades"]["cook"])
	var signature := ",".join(PackedStringArray(pieces))
	if signature == _signature:
		return
	_signature = signature
	var picture := FloorsTextures.picture(_library, "upgrades/basement-bare")
	for piece: String in pieces:
		_put(picture, piece)
	var texel := _library.texel(_PIECES)
	var box := Rect2i(Rect2(FloorsArt.TABLE_BOX.position / texel, FloorsArt.TABLE_BOX.size / texel))
	var table := picture.get_region(box)
	_clip(table, texel)
	if _kitchen != null and Vector2i(_kitchen.get_size()) == picture.get_size():
		_kitchen.update(picture)
		_table.update(table)
		return
	_kitchen = ImageTexture.create_from_image(picture)
	_table = ImageTexture.create_from_image(table)
	_library.add(KITCHEN, _kitchen, texel)
	_library.add(TABLE, _table, texel)


func _put(picture: Image, name: String) -> void:
	if not _library.pieces["pieces"].has(name):
		return
	var piece: Dictionary = _library.pieces["pieces"][name]
	var texel := _library.texel(_PIECES)
	var from := Rect2i(Rect2(Vector2(piece["x"], piece["y"]) / texel, Vector2(piece["w"], piece["h"]) / texel))
	picture.blend_rect(FloorsTextures.picture(_library, _PIECES), from, Vector2i(Vector2(piece["at"][0], piece["at"][1]) / texel))


## Leaves only the table's own outline.
func _clip(table: Image, texel: float) -> void:
	var outline := PackedVector2Array()
	for p in FloorsArt.TABLE_OUTLINE:
		outline.append((p - FloorsArt.TABLE_BOX.position) / texel)
	for y in table.get_height():
		for x in table.get_width():
			if not Geometry2D.is_point_in_polygon(Vector2(x + 0.5, y + 0.5), outline):
				table.set_pixel(x, y, Color.TRANSPARENT)


## The ground floor's fixtures layer with the machine of this level in it; the layer itself at the first.
func fixtures(key: String, level: float) -> String:
	var tier := int(FloorsArt.machine_tier(level))
	if tier == 0:
		return key
	var name := "%s|machine-%d" % [key, tier]
	if not _tiers.has(name):
		_tiers[name] = true
		var picture := FloorsTextures.picture(_library, key)
		var texel := _library.texel(key)
		var clear: Array = _library.pieces["clear"]
		picture.fill_rect(Rect2i(Rect2(Vector2(clear[0], clear[1]) / texel, Vector2(clear[2] - clear[0], clear[3] - clear[1]) / texel)), Color.TRANSPARENT)
		_put(picture, "machine-%d" % tier)
		_library.add(name, ImageTexture.create_from_image(picture), texel)
	return name


## Keeps the kitchen up to date; what it holds changes rarely, so it looks twice a second.
func update(dt: float, s: Dictionary) -> void:
	_timer -= dt
	if _timer > 0.0 or not s["kitchen"]:
		return
	_timer = 0.5
	update_kitchen(s)
