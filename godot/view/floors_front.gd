class_name FloorsFront
extends RefCounted

## The café's front, lettered by the game: its name on a plaque over the awning with a tag saying whether it is open, a
## cup on the shopfront's hanging sign, and today's menu on a board by the step. Port of floors-front.ts.

const _INK := Color8(0x7a, 0x5a, 0x44)
const _DARK := Color8(0x4f, 0x3b, 0x2f)
const _PAPER := Color8(0xfb, 0xf3, 0xe4)
const _CREAM := Color8(0xff, 0xfa, 0xf0)
const _SAGE := Color8(0x6c, 0x8c, 0x68)
const _SLATE := Color8(0x4d, 0x4a, 0x44)
const _WOOD := Color8(0xb8, 0x80, 0x4f)
const _WOOD_DARK := Color8(0x6a, 0x45, 0x2c)
## The plaque's lettering, and how wide it may get before it is set smaller.
const _NAME_SIZE := 54.0
const _NAME_MAX := 820.0
const _NAME_HEIGHT := 92.0

var _scene: FloorsScene
var _plaque: Board
var _board: Board
var _cup: FloorsPic
var _signature := ""
var _board_signature := ""
var _clock := 0.0


## Shapes with words and pictures on them, at a place and a depth.
class Board extends Node2D:
	var depth := 0.0
	var place := Vector2.ZERO
	## [method, arguments] in order.
	var shapes: Array = []

	func put(at: Vector2, at_depth: float) -> void:
		place = at
		depth = at_depth
		position.x = at.x
		FloorsDepth.stand(self, at_depth)
		for child: Node2D in get_children():
			child.position = Vector2(0.0, at.y - position.y)
		queue_redraw()

	func clear() -> void:
		shapes.clear()
		for child in get_children():
			remove_child(child)
			child.queue_free()
		queue_redraw()

	func round_box(rect: Rect2, radius: float, fill: Color, line: Color = Color.TRANSPARENT, width: float = 0.0) -> void:
		shapes.append(["box", rect, radius, fill, line, width])

	func stroke(from: Vector2, to: Vector2, colour: Color, width: float) -> void:
		shapes.append(["line", from, to, colour, width])

	func oval(at: Vector2, size: Vector2, fill: Color) -> void:
		shapes.append(["oval", at, size, fill])

	## Words around a point; narrower than `room`.
	func write(text: String, size: float, colour: Color, at: Vector2, origin: Vector2, room: float = INF) -> FloorsText:
		var holder := Node2D.new()
		add_child(holder)
		holder.position = Vector2(0.0, place.y - position.y)
		var w := FloorsText.new(text, size, colour)
		w.origin = origin
		w.stretch = minf(1.0, room / w.extent().x)
		w.place = at
		holder.add_child(w)
		return w

	func picture(p: FloorsPic) -> void:
		var holder := Node2D.new()
		holder.position = Vector2(0.0, place.y - position.y)
		add_child(holder)
		holder.add_child(p)

	func _draw() -> void:
		draw_set_transform(Vector2(0.0, place.y - position.y))
		for s: Array in shapes:
			match s[0]:
				"box":
					var points := FloorsTextures.round_rect(s[1], s[2])
					draw_colored_polygon(points, s[3])
					if s[5] > 0.0:
						draw_polyline(points, s[4], s[5], true)
				"line":
					draw_line(s[1], s[2], s[3], s[4], true)
				"oval":
					var points := PackedVector2Array()
					for i in 40:
						points.append(s[1] + Vector2(cos(TAU * i / 40.0) * s[2].x, sin(TAU * i / 40.0) * s[2].y) / 2.0)
					draw_colored_polygon(points, s[3])


func _init(scene: FloorsScene) -> void:
	_scene = scene
	_plaque = Board.new()
	_board = Board.new()
	scene.add_child(_plaque)
	scene.add_child(_board)
	_cup = scene.pic("fx", "cup", Vector2(0.5, 0.5), FloorsDepth.WALL + 0.5)
	_cup.stretch = Vector2.ONE * FloorsLayout.SHOP_SIGN["cup"] / 56.0


func layout(b: Dictionary) -> void:
	var ground: float = b["offsets"].get("ground", 0.0)
	_plaque.put(Vector2(FloorsLayout.DOOR["x"], ground - 6.0), FloorsDepth.FRAME + 0.5)
	var foot: float = b["street"] + FloorsLayout.BOARD["y"]
	_board.put(Vector2(FloorsLayout.BOARD["x"], foot), foot + FloorsDepth.FRAME)
	_cup.place = Vector2(FloorsLayout.SHOP_SIGN["x"], ground + FloorsLayout.SHOP_SIGN["y"])


## `walls`: how far the front walls have faded in.
func update(dt: float, s: Dictionary, walls: float) -> void:
	_clock += dt
	var profile: Variant = s["profile"]
	_letter(profile["cafeName"] if profile != null else _t("app.title"), s["phase"] == "open")
	_chalk(s)
	_cup.alpha = walls
	_cup.visible = walls > 0.0


func _t(key: String) -> String:
	return _scene.session.translate.call(key, {})


func _letter(name: String, open: bool) -> void:
	var tag := _t("floors.sign.open" if open else "floors.sign.closed")
	var signature := "%s|%s|%s" % [name, tag, open]
	if signature == _signature:
		return
	_signature = signature
	_plaque.clear()
	var h := _NAME_HEIGHT
	var measured := FloorsText.font.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, int(_NAME_SIZE)).x
	var w := maxf(260.0, minf(_NAME_MAX, measured) + 88.0)
	# The tag hangs under the plaque on two strings.
	var tw := FloorsText.font.get_string_size(tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 38).x + 48.0
	var th := 60.0
	var ty := h / 2.0 + 16.0
	for x: float in [-tw / 4.0, tw / 4.0]:
		_plaque.stroke(Vector2(x, h / 2.0 - 2.0), Vector2(x, ty), _INK, 5.0)
	_plaque.round_box(Rect2(-tw / 2.0, ty, tw, th), 18.0, _SAGE if open else _PAPER, Color8(0x52, 0x6f, 0x4f) if open else _INK, 6.0)
	_plaque.write(tag, 38.0, _CREAM if open else _DARK, Vector2(0.0, h / 2.0 + 46.0), Vector2(0.5, 0.5))
	_plaque.round_box(Rect2(-w / 2.0, -h / 2.0 + 9.0, w, h), 26.0, Color(_DARK, 0.28))
	_plaque.round_box(Rect2(-w / 2.0, -h / 2.0, w, h), 26.0, _PAPER, _INK, 7.0)
	_plaque.round_box(Rect2(-w / 2.0 + 12.0, -h / 2.0 + 12.0, w - 24.0, h - 24.0), 16.0, Color.TRANSPARENT, Color(_INK, 0.35), 3.0)
	_plaque.write(name, _NAME_SIZE, _DARK, Vector2.ZERO, Vector2(0.5, 0.5), _NAME_MAX)


func _chalk(s: Dictionary) -> void:
	var rows := FloorsArt.board_rows(CoreEconomy.menu_items(s), _clock).map(func(item: Dictionary) -> Array: return [FloorsArt.item_frame(item["id"]), FloorsArt.board_price(s, item)])
	var title := _t("board.today")
	var signature := "%s|%s" % [title, rows]
	if signature == _board_signature:
		return
	_board_signature = signature
	_board.clear()
	var w: float = FloorsLayout.BOARD["w"]
	var h: float = FloorsLayout.BOARD["h"]
	var top := -h
	var frame := 14.0
	var legs := 34.0
	_board.oval(Vector2(0.0, -4.0), Vector2(w + 30.0, 30.0), Color(_DARK, 0.22))
	# Two splayed legs, then the framed slate.
	for wood: Array in [[_WOOD_DARK, 20.0, -6.0], [_WOOD, 12.0, -7.0]]:
		_board.stroke(Vector2(-w / 2.0 + 22.0, -legs - 8.0), Vector2(-w / 2.0 + 8.0, wood[2]), wood[0], wood[1])
		_board.stroke(Vector2(w / 2.0 - 22.0, -legs - 8.0), Vector2(w / 2.0 - 8.0, wood[2]), wood[0], wood[1])
	_board.round_box(Rect2(-w / 2.0, top, w, h - legs), 16.0, _WOOD, _WOOD_DARK, 6.0)
	_board.round_box(Rect2(-w / 2.0 + frame, top + frame, w - 2.0 * frame, h - legs - 2.0 * frame), 9.0, _SLATE)
	var inside := w - 2.0 * frame - 18.0
	_board.write(title, 36.0, Color8(0xf3, 0xe2, 0xb3), Vector2(0.0, top + frame + 8.0), Vector2(0.5, 0.0), inside)
	var row_top := top + frame + 56.0
	var row_height := (h - legs - frame - 56.0 - frame) / 2.0
	for i in rows.size():
		var y := row_top + row_height * (i + 0.5)
		var has: bool = _scene.library.has_frame("fx-items", rows[i][0])
		_board.write(rows[i][1], 38.0, Color8(0xfd, 0xf6, 0xe3), Vector2(inside / 2.0 if has else 0.0, y), Vector2(1.0 if has else 0.5, 0.5), inside - (66.0 if has else 0.0))
		if has:
			var icon := FloorsPic.new(_scene.library, "fx-items", rows[i][0])
			icon.place = Vector2(-inside / 2.0 + 30.0, y)
			icon.stretch = Vector2.ONE * 62.0 / maxf(icon.size.x, icon.size.y)
			_board.picture(icon)
	_board.visible = not rows.is_empty()
	_board.put(_board.place, _board.depth)
