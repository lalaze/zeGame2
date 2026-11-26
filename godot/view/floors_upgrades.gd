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
var _split_fixtures: Dictionary = {}
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


## Splits a floor's `fixtures` layer into a back texture (with every table mask cleared, and on the ground floor the
## espresso machine of `level` composited in) and one piece texture per table containing only that table's masked pixels.
func fixtures_tables(key: String, tables: Array, level: float = 0.0) -> Dictionary:
	var tier := int(FloorsArt.machine_tier(level))
	var cached: Variant = _split_fixtures.get(key)
	if cached != null and cached["tier"] == tier:
		return {"back": cached["back"], "pieces": cached["pieces"]}
	var source := FloorsTextures.picture(_library, key)
	var texel := _library.texel(key)
	var back_img := source.duplicate() as Image
	var pieces: Array[String] = []
	var seam_keep: Array[Vector2i] = []
	var seam_rgb0: Array[Vector2i] = []
	if cached != null:
		pieces = cached["pieces"]
		seam_keep = cached["seam"]
		seam_rgb0 = cached["rgb0"]
	else:
		for i in tables.size():
			var table: Dictionary = tables[i]
			var piece_key := "%s|table-%d" % [key, i]
			var top: float = table.get("fixturesY", table["y"])
			var h: float = table["y"] + table["h"] - top
			var region := Rect2i(roundi(table["x"] / texel), roundi(top / texel), roundi(table["w"] / texel), roundi(h / texel))
			var piece_img := source.get_region(region)
			var ex_rects: Array[Rect2i] = []
			for ex: Dictionary in table.get("exclude", []):
				var er := Rect2i(roundi((ex["x"] - table["x"]) / texel), roundi((ex["y"] - top) / texel), roundi(ex["w"] / texel), roundi(ex["h"] / texel))
				ex_rects.append(er)
				piece_img.fill_rect(er, Color.TRANSPARENT)
			# Along interior cuts (chair overlapping sideboard/bookcase), keep exact RGB with alpha=0 on the cleared
			# side so bilinear filtering never bleeds white/black, and keep a 1-texel opaque guard in the back where
			# both sides are opaque (covered 100% by the piece) so background never leaks through the cut.
			for er in ex_rects:
				_guard_cut(source, piece_img, region.position, er, seam_keep, seam_rgb0)
			_library.add(piece_key, ImageTexture.create_from_image(piece_img), texel)
			pieces.append(piece_key)
	var back_key := "%s|back-%d" % [key, tier]
	if cached != null and cached["back"] != back_key:
		_library.release(cached["back"])
	if tier > 0:
		var clear: Array = _library.pieces["clear"]
		back_img.fill_rect(Rect2i(Rect2(Vector2(clear[0], clear[1]) / texel, Vector2(clear[2] - clear[0], clear[3] - clear[1]) / texel)), Color.TRANSPARENT)
		_put(back_img, "machine-%d" % tier)
	for table: Dictionary in tables:
		for r: Dictionary in FloorsLayout.table_mask_rects(table):
			back_img.fill_rect(Rect2i(roundi(r["x"] / texel), roundi(r["y"] / texel), roundi(r["w"] / texel), roundi(r["h"] / texel)), Color.TRANSPARENT)
	for pt in seam_rgb0:
		var c := source.get_pixel(pt.x, pt.y)
		back_img.set_pixel(pt.x, pt.y, Color(c.r, c.g, c.b, 0.0))
	for pt in seam_keep:
		back_img.set_pixel(pt.x, pt.y, source.get_pixel(pt.x, pt.y))
	_library.add(back_key, ImageTexture.create_from_image(back_img), texel)
	_split_fixtures[key] = {"back": back_key, "tier": tier, "pieces": pieces, "seam": seam_keep, "rgb0": seam_rgb0}
	return {"back": back_key, "pieces": pieces}


static func _guard_cut(source: Image, piece_img: Image, origin: Vector2i, er: Rect2i, seam_keep: Array[Vector2i], seam_rgb0: Array[Vector2i]) -> void:
	var pw := piece_img.get_width()
	var ph := piece_img.get_height()
	var edges: Array = [
		[er.position.x - 1, er.position.x, er.position.y, er.end.y, true],
		[er.end.x, er.end.x - 1, er.position.y, er.end.y, true],
		[er.position.y - 1, er.position.y, er.position.x, er.end.x, false],
		[er.end.y, er.end.y - 1, er.position.x, er.end.x, false],
	]
	for edge: Array in edges:
		var in_c: int = edge[0]
		var ex_c: int = edge[1]
		var vertical: bool = edge[4]
		if vertical and (in_c < 0 or in_c >= pw or ex_c < 0 or ex_c >= pw):
			continue
		if not vertical and (in_c < 0 or in_c >= ph or ex_c < 0 or ex_c >= ph):
			continue
		for k in range(edge[2], edge[3]):
			var inp := Vector2i(in_c, k) if vertical else Vector2i(k, in_c)
			var exp := Vector2i(ex_c, k) if vertical else Vector2i(k, ex_c)
			var cin := piece_img.get_pixel(inp.x, inp.y)
			var cex := source.get_pixel(origin.x + exp.x, origin.y + exp.y)
			if cin.a == 0.0 or cex.a == 0.0:
				continue
			piece_img.set_pixel(exp.x, exp.y, Color(cex.r, cex.g, cex.b, 0.0))
			if cin.a >= 0.99 and cex.a >= 0.99:
				seam_keep.append(origin + inp)
			else:
				seam_rgb0.append(origin + inp)


## Keeps the kitchen up to date; what it holds changes rarely, so it looks twice a second.
func update(dt: float, s: Dictionary) -> void:
	_timer -= dt
	if _timer > 0.0 or not s["kitchen"]:
		return
	_timer = 0.5
	update_kitchen(s)
