class_name StreetMap
extends Control

## The street (src/ui/streets.ts): choosing a street, buying its lots, fitting them out, and what they bring in. It covers
## the whole screen; the café rests behind it.

const _PLOT := 300.0
const _WIDE := 252.0
const _LEFT := 18.0
## Two taps in a row never spend: a new surface waits this long for a hand.
const _GUARD := 600
## Milliseconds of real time; tests set it.
static var ticks: Callable = Time.get_ticks_msec
var _ui: CafeUi
var _session: CoreGameSession
var _changed: Callable
var _manifest: Dictionary
var _street := ""
var _plot := "01"
var _business := "reading"
var _open := false
var _pending: Variant = null
var _ready_at := 0
var _clock := 0.0
var _wallet := Paper.words("", "strong", false)
var _choices: Dictionary = {}
var _name := Paper.words("", "strong")
var _description := Paper.words("", "small")
var _collect_all: Button
var _guidance := Paper.words("", "small")
var _panorama: ScrollContainer
var _scenery := Control.new()
var _shops: Dictionary = {}
var _walkers: Array = []
var _detail: PanelContainer
var _d: Dictionary = {}
var _loaded_for := ""


## How the ledger names the street: with what is ready to collect.
static func entry_label(s: Dictionary, now: float) -> String:
	var ready := float(CoreStreets.street_lot_ids(s).filter(func(id: String) -> bool: return CoreStreets.street_production(s, id, now)["batches"] > 0.0).size())
	return _t("street.entryReady" if ready > 0.0 else "street.entry", {"n": ready})


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func street_name(id: String) -> String:
	return _t("street.%s.name" % id)


static func business_name(id: String) -> String:
	return _t("street.business.%s" % id)


static func _money(n: float) -> String:
	return CoreFormat.format_transaction_money(n)


static func _time(seconds: float) -> String:
	return CoreFormat.format_duration(seconds, I18n.t)


func _init(ui: CafeUi, changed: Callable) -> void:
	_ui = ui
	_session = ui.session
	_changed = changed
	_manifest = JSON.parse_string(FileAccess.get_file_as_string("res://art/data/street/street.json"))
	_street = _session.state["streets"]["selected"]
	theme = Paper.theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var paper := ColorRect.new()
	paper.color = Paper.PAPER
	paper.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(paper)
	var column := Paper.col([], 0)
	column.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(column)
	column.name = "Column"
	_build_top(column)
	_panorama = ScrollContainer.new()
	_panorama.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_panorama.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	_panorama.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_panorama.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_panorama.scroll_deadzone = 8
	_scenery.clip_contents = true
	_scenery.mouse_filter = Control.MOUSE_FILTER_PASS
	_scenery.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_panorama.add_child(_scenery)
	column.add_child(_panorama)
	_panorama.resized.connect(_rebuild.call_deferred)
	_build_walk()
	_build_detail()
	update()


func _build_top(column: VBoxContainer) -> void:
	var home := Paper.button(_t("street.back"), "ghost", _home, "left")
	var plans := Paper.button(_t("street.blueprints"), "ghost", func() -> void:
		_close_detail()
		_plot = "01"
		_business = "reading"
		ProjectsDialog.show_projects(_ui, _changed))
	plans.add_theme_constant_override("icon_max_width", 22)
	for tone: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_focus_color", "icon_hover_pressed_color"]:
		plans.add_theme_color_override(tone, Color.WHITE)
	plans.icon = load("res://art/full/street/blueprint.webp")
	# Long words go on another line rather than past the screen.
	for b: Button in [home, plans]:
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.custom_minimum_size.x = 116.0
	_wallet.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_wallet.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_wallet.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_wallet.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_wallet.add_theme_stylebox_override("normal", Paper.box(Paper.LIGHT, Paper.SOFT_LINE, 2, 12, Vector2(8, 4)))
	column.add_child(Paper.padded(Paper.line([home, _wallet, plans]), 12, 6, 12, 8))
	var row := Paper.line([], 8)
	for def: Dictionary in CoreStreets.STREETS:
		var id: String = def["id"]
		var badge := Paper.picture(null, 22.0)
		var note := Paper.words("", "small", false)
		var copy := Paper.col([Paper.words(street_name(id), "strong", false), note], 0)
		var inside := Paper.padded(Paper.line([badge, copy], 7), 12, 5)
		for c: Control in [inside, copy, inside.get_child(0)]:
			c.mouse_filter = Control.MOUSE_FILTER_IGNORE
		inside.set_anchors_preset(Control.PRESET_FULL_RECT)
		var b := Paper.button("", "chip", func() -> void:
			_close_detail()
			_street = id
			_plot = "01"
			_session.state["streets"]["selected"] = id
			_rebuild()
			_panorama.scroll_horizontal = 0
			_changed.call()
			update())
		b.add_child(inside)
		b.custom_minimum_size = Vector2(184, 48)
		_choices[id] = {"button": b, "badge": badge, "note": note}
		row.add_child(b)
	var strip := ScrollContainer.new()
	strip.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	strip.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	strip.scroll_deadzone = 8
	strip.add_child(Paper.padded(row, 8, 0, 8, 4))
	column.add_child(strip)
	_collect_all = Paper.button("", "primary", func() -> void:
		_reward(CoreStreets.collect_street_shops(_session.state, CoreClock.now()))
		_finish())
	_collect_all.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_collect_all.custom_minimum_size.x = 150.0
	column.add_child(Paper.padded(Paper.line([Paper.col([_name, _description], 0), _collect_all]), 8, 4, 12, 8))


func _build_walk() -> void:
	var bar := Paper.card("sheet")
	bar.add_theme_stylebox_override("panel", Paper.box(Paper.PAPER, Paper.LINE, 2, 20, Vector2(10, 6), Paper.STAMP, 3.0))
	bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.offset_left = 10.0
	bar.offset_right = -10.0
	bar.offset_bottom = -12.0
	bar.name = "Walk"
	var hint := Paper.words(_t("street.mapNote"), "small")
	for l: Label in [hint, _guidance]:
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var step := func(by: float) -> void:
		var to := _panorama.scroll_horizontal + by * maxf(280.0, _panorama.size.x * 0.7)
		create_tween().tween_property(_panorama, "scroll_horizontal", int(to), 0.35).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	var left := Paper.button("", "primary", step.bind(-1.0), "left")
	var right := Paper.button("", "primary", step.bind(1.0), "right")
	for b: Button in [left, right]:
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bar.add_child(Paper.line([left, Paper.col([hint, _guidance], 2), right]))
	add_child(bar)


func inset(top: float, bottom: float) -> void:
	get_node("Column").offset_top = top
	get_node("Walk").offset_bottom = -12.0 - bottom


# ---------------------------------------------------------------- the panorama

func _picture(name: String, at: Rect2, flip: bool = false, alpha: float = 1.0, parent: Control = null) -> TextureRect:
	var t := TextureRect.new()
	t.texture = load("res://art/full/street/%s.webp" % name)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_SCALE
	t.flip_h = flip
	t.modulate.a = alpha
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	t.position = at.position
	t.size = at.size
	(parent if parent != null else _scenery).add_child(t)
	return t


func _unit(name: String) -> Vector2:
	var of: Dictionary = _manifest["scenery"][name]
	return Vector2(of["width"], of["height"])


## How high the street is over the bottom of the panorama.
func _ground() -> float:
	return maxf(180.0, 180.0 + (_panorama.size.y - 600.0) * 0.5)


## The street anew: its scenery, the café if it stands here, and its lots.
func _rebuild() -> void:
	var tall := _panorama.size.y
	if tall <= 0.0:
		return
	var home: bool = _street == CoreLocations.cafe_location(_session.state)
	var width := _PLOT * (6.0 if home else 5.0) + 36.0
	Paper.clear(_scenery)
	_shops.clear()
	_walkers.clear()
	_scenery.custom_minimum_size = Vector2(width, 0)
	var ground := tall - _ground()
	var sky := GradientTexture2D.new()
	sky.fill_to = Vector2(0, 1)
	sky.gradient = Gradient.new()
	sky.gradient.offsets = PackedFloat32Array([0.0, 0.46, 0.72, 0.7201, 1.0])
	var meadow := Color.html(_manifest["hills"]["meadow"])
	sky.gradient.colors = PackedColorArray([Color8(0x9c, 0xcb, 0xf5), Color8(0xc4, 0xe1, 0xf6), Color8(0xe6, 0xf0, 0xe4), meadow, meadow])
	var back := TextureRect.new()
	back.texture = sky
	back.stretch_mode = TextureRect.STRETCH_SCALE
	back.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	back.size = Vector2(width, tall)
	_scenery.add_child(back)
	for i in 7:
		var name := "depth-cloud-small" if i % 2 == 1 else "cloud"
		var size := _unit(name)
		var top := clampf((tall - _ground() - (368.0 if i % 2 == 1 else 392.0)) * 0.5, 24.0 if i % 2 == 1 else 12.0, 106.0 if i % 2 == 1 else 90.0)
		_picture(name, Rect2(_LEFT + i * _PLOT + (76.0 if i % 2 == 1 else 24.0), top, size.x, size.y), false, 0.96)
	var hill: Dictionary = _manifest["hills"]
	var hills_top: float = ground - 100.0 - hill["height"]
	var tile := 0.0
	while tile < width:
		_picture("hills", Rect2(tile, hills_top, hill["span"], hill["height"]))
		tile += hill["span"]
	var field := ColorRect.new()
	field.color = meadow
	field.position = Vector2(0, ground - 100.0)
	field.size = Vector2(width, 104.0)
	field.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scenery.add_child(field)
	for i in 7:
		var x := _LEFT + i * _PLOT
		_picture("mound", Rect2(x + _PLOT * 0.61 - 84.0, ground - 296.0, 328.0, 296.0))
		var town := "depth-town" if i % 3 == 1 else "depth-hamlet"
		var size := _unit(town)
		_picture(town, Rect2(x + _PLOT * 0.61, ground - 270.0 - size.y, size.x, size.y))
		_picture("depth-hedge", Rect2(x + _PLOT * 0.2, ground - 222.0 - 33.0, 108.0, 33.0), i % 3 == 0)
		_picture("depth-tree", Rect2(x + _PLOT - 76.0, ground - 170.8, 134.0, 170.8), i % 2 == 1)
	_pave(width, ground, tall)
	for i in 5:
		if i % 2 == 0:
			_picture("lamp", Rect2(_LEFT + _WIDE + 18.0 + i * _PLOT, ground - 150.0, 36.0, 150.0))
		else:
			_picture("bench", Rect2(_LEFT + _WIDE + 4.0 + i * _PLOT, ground - 20.0, 48.0, 28.0))
	for i in 6:
		_add_walker(i, ground)
	if home:
		_add_home(ground)
	for i in CoreStreets.STREET_PLOTS.size():
		_add_shop(CoreStreets.STREET_PLOTS[i]["id"], _LEFT + (i + (1 if home else 0)) * _PLOT, ground)
	update()


func _pave(width: float, ground: float, tall: float) -> void:
	var of: Dictionary = _manifest["ground"]
	var edge := ColorRect.new()
	edge.color = Color.html(of["edge"])
	edge.position = Vector2(0, ground)
	edge.size = Vector2(width, tall - ground)
	edge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scenery.add_child(edge)
	var x := 0.0
	while x < width:
		_picture("ground", Rect2(x, ground, of["span"] * 2.0, of["height"] * 2.0))
		x += of["span"] * 2.0


func _seating() -> int:
	var s := _session.state
	var floors: Array = FloorsLayout.building(CoreRegions.active_table_indices(s).size(), s["kitchen"])["floors"]
	return clampi(floors.filter(func(f: String) -> bool: return f in ["floor-2", "floor-3"]).size(), 0, 2)


static func _sign(text: String) -> Label:
	var l := Paper.words(text, "strong", false)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


static func _plate() -> StyleBox:
	return Paper.box(Paper.PAPER, Paper.LINE, 2, 10, Vector2(10, 2), Paper.STAMP, 2.0)


## Puts words in the middle of a point.
static func _centre(l: Control, x: float, y: float) -> void:
	l.reset_size()
	l.position = Vector2(x - l.get_combined_minimum_size().x / 2.0, y)


func _add_home(ground: float) -> void:
	var of: Dictionary = _manifest["shops"]["cafe-%d" % _seating()]
	var middle := _LEFT + _WIDE / 2.0
	_picture("cafe-%d" % _seating(), Rect2(middle - of["width"] / 2.0, ground - of["height"], of["width"], of["height"]))
	var door := _tap(Rect2(middle - 126.0, ground - 300.0, 252.0, 350.0), _home)
	_scenery.add_child(door)
	var holder := _holder(door)
	var sign := _sign(_t("street.home"))
	sign.add_theme_stylebox_override("normal", _plate())
	holder.add_child(sign)
	_centre(sign, middle, ground - of["height"] + of["signY"] - 12.0)
	var note := _sign(_t("street.visitHome"))
	note.add_theme_stylebox_override("normal", _plate())
	holder.add_child(note)
	_centre(note, middle, ground + 22.0)


## An unseen button over a storefront.
func _tap(at: Rect2, pressed: Callable) -> Button:
	var b := Button.new()
	b.flat = true
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.position = at.position
	b.size = at.size
	for state: String in ["normal", "hover", "pressed", "focus", "hover_pressed"]:
		b.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	b.pressed.connect(pressed)
	return b


## What a button shows, in the scenery's own places.
static func _holder(door: Button) -> Control:
	var holder := Control.new()
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.position = -door.position
	door.add_child(holder)
	return holder


func _asset(business: Variant, plot: String) -> String:
	if business != null:
		return {"reading": "bookshop", "greenhouse": "plant-shop", "terrace": "florist", "workshop": "pottery", "observatory": "tea-shop"}[business]
	return "vacant-brick" if (int(plot) + ["town", "flowers", "seaside", "forest", "city"].find(_street)) % 2 != 0 else "vacant-blue"


func _add_shop(plot: String, x: float, ground: float) -> void:
	var door := _tap(Rect2(x, ground - 300.0, _WIDE, 350.0), func() -> void:
		_clear_pending()
		_plot = plot
		_open = true
		_guard()
		update())
	_scenery.add_child(door)
	_shops[plot] = {"holder": _holder(door), "x": x, "ground": ground, "signature": ""}


func _status(entry: Variant, now: float) -> String:
	if entry == null:
		return "sale"
	if entry["business"] == null:
		return "vacant"
	return "building" if entry["readyAt"] > now else "open"


func _show_shop(plot: String, now: float) -> void:
	var s := _session.state
	var shop: Dictionary = _shops[plot]
	var id := CoreStreets.street_lot_id(_street, plot)
	var entry: Variant = s["streets"]["lots"].get(id)
	var status := _status(entry, now)
	var locked := not CoreStreets.street_unlocked(s, _street)
	var business: Variant = entry["business"] if entry != null else null
	var ready: bool = CoreStreets.street_production(s, id, now)["batches"] > 0.0
	var note := _t("street.ready") if ready else ("%s %s" % [_t("street.land"), _money(CoreStreets.plot_price(_street, plot))] if status == "sale" else _t("street.status.%s" % status))
	var signature := "%s|%s|%s|%s|%s|%s" % [business, status, locked, ready, note, I18n.locale]
	if signature == shop["signature"]:
		return
	shop["signature"] = signature
	var holder: Control = shop["holder"]
	Paper.clear(holder)
	var asset := _asset(business, plot)
	var of: Dictionary = _manifest["shops"][asset]
	var middle: float = shop["x"] + _WIDE / 2.0
	var ground: float = shop["ground"]
	var at := Rect2(middle - of["width"] / 2.0, ground - of["height"], of["width"], of["height"])
	_picture(asset, at, false, 1.0, holder)
	if status == "building":
		var ladder := _unit("ladder")
		_picture("ladder", Rect2(at.position.x + 12.0, ground - ladder.y, ladder.x, ladder.y), false, 1.0, holder)
		var hoarding := _unit("hoarding")
		var x := at.position.x + at.size.x * 0.04
		while x < at.end.x - at.size.x * 0.04:
			var part := minf(hoarding.x, at.end.x - at.size.x * 0.04 - x)
			var board := _picture("hoarding", Rect2(x, ground - hoarding.y, hoarding.x, hoarding.y), false, 1.0, holder)
			if part < hoarding.x:
				board.queue_free()
				break
			x += part
		var barrier := _unit("barrier")
		_picture("barrier", Rect2(at.end.x - barrier.x * 0.9, ground - barrier.y + 12.0, barrier.x, barrier.y), false, 1.0, holder)
	var sign := _sign(business_name(business) if business != null else (_t("street.lockedSign" if locked else "street.forSale") if status == "sale" else _t("street.vacant")))
	if status in ["sale", "vacant"]:
		var board := Control.new()
		board.position = Vector2(middle - 56.0, ground - of["height"] * 0.09 - 84.0)
		board.rotation = deg_to_rad(-3.0)
		holder.add_child(board)
		var wood := _picture("sign", Rect2(0, 0, 112.0, 84.0), false, 1.0, board)
		wood.self_modulate = Color(0.8, 0.8, 0.8) if locked and status == "sale" else Color.WHITE
		sign.add_theme_color_override("font_color", Color8(0x7a, 0x4a, 0x36))
		sign.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		sign.size = Vector2(96, 44)
		sign.position = Vector2(8, 32)
		board.add_child(sign)
		var number := _sign(_t("street.plot", {"n": plot}))
		number.add_theme_color_override("font_color", Color8(0x4a, 0x33, 0x23))
		holder.add_child(number)
		_centre(number, middle, ground - of["height"] + of["signY"] - 12.0)
	else:
		sign.add_theme_color_override("font_color", Color8(0x4a, 0x33, 0x23))
		holder.add_child(sign)
		_centre(sign, middle, ground - of["height"] + of["signY"] - 12.0)
	var badge: String = "ready" if ready else ({"sale": "lock" if locked else "coin", "vacant": "key", "building": "fitout"}.get(status, ""))
	var words := Paper.words(note, "small", false)
	words.add_theme_color_override("font_color", Paper.LIGHT if ready else Paper.INK)
	var inside := Paper.line([words], 5)
	if not badge.is_empty():
		var mark := Paper.picture(load("res://art/full/street/%s.webp" % badge), 18.0)
		inside.add_child(mark)
		inside.move_child(mark, 0)
	var plate := PanelContainer.new()
	plate.add_theme_stylebox_override("panel", Paper.box(Paper.SAGE if ready else Paper.PAPER, Paper.SAGE_DARK if ready else Paper.LINE, 2, 12, Vector2(10, 4), Paper.STAMP, 2.0))
	plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	plate.add_child(inside)
	holder.add_child(plate)
	_centre(plate, middle, ground + 22.0)


func _add_walker(i: int, ground: float) -> void:
	var of: Dictionary = _manifest["walkers"]
	var part := AtlasTexture.new()
	part.atlas = load("res://art/full/street/guest-%d.webp" % (i % int(of["count"])))
	var t := TextureRect.new()
	t.texture = part
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	t.size = Vector2(of["width"], of["height"])
	t.flip_h = i % 2 == 1
	t.position.y = ground + (4.0 if i % 2 == 1 else 12.0)
	_scenery.add_child(t)
	_walkers.append({"rect": t, "i": i, "x": _LEFT + i * _PLOT + _WIDE - 40.0})


func _process(dt: float) -> void:
	_clock += dt
	var of: Dictionary = _manifest["walkers"]
	for w: Dictionary in _walkers:
		var i: int = w["i"]
		var along := fposmod(_clock + i * 4.0, 32.0) / 32.0
		if i % 2 == 1:
			along = 1.0 - along
		w["rect"].position.x = w["x"] - 130.0 + 600.0 * along
		var cell := int(_clock / 0.18) % int(of["frames"])
		var part: AtlasTexture = w["rect"].texture
		var size := Vector2(part.atlas.get_width() / of["frames"], part.atlas.get_height())
		part.region = Rect2(Vector2(cell * size.x, 0), size)


# ---------------------------------------------------------------- one lot

func _build_detail() -> void:
	_detail = Paper.card("sheet")
	_detail.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_detail.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_detail.visible = false
	add_child(_detail)
	var close := Paper.button("", "ghost", _close_detail, "close")
	close.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	close.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	_d = {"address": Paper.words("", "good"), "picture": Paper.picture(null, 104.0), "title": Paper.words("", "h3"), "status": Paper.words("", "good"), "description": Paper.words("", "muted"), "prices": Paper.words(""), "income": Paper.words(""), "reason": Paper.words("", "muted"),
		"schedule": Paper.words(_t("projects.restartHint"), "muted"), "quote": Paper.words(""), "progress": Paper.progress(0.0), "modes": Paper.flow([], 6)}
	_d["picture"].custom_minimum_size = Vector2(104, 78)
	_d["picture"].stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var entries: Array = CoreStreets.BUSINESSES.map(func(b: Dictionary) -> Array: return [b["id"], business_name(b["id"])])
	_d["picker"] = Paper.select(entries, _business, func(id: String) -> void:
		_clear_pending()
		_business = id
		update())
	_d["picker"].size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_d["choose"] = Paper.col([Paper.words(_t("street.businessLabel")), _d["picker"], _d["description"]], 6)
	for mode: String in CoreRoomProjects.PROJECT_MODES:
		_d["mode:%s" % mode] = Paper.button("", "chip", func() -> void:
			if CoreStreets.set_street_schedule(_session.state, _lot_id(), mode, CoreClock.now()):
				_finish())
		_d["modes"].add_child(_d["mode:%s" % mode])
	_d["buy"] = Paper.button("", "primary", _ask.bind("land"))
	_d["fitout"] = Paper.button("", "primary", _ask.bind("fitout"))
	_d["collect"] = Paper.button("", "primary", func() -> void:
		var r := CoreStreets.collect_street_shop(_session.state, _lot_id(), CoreClock.now())
		if r["batches"] > 0.0:
			_reward(r)
			_finish())
	_d["upgrade"] = Paper.button("", "ghost", func() -> void:
		if CoreStreets.upgrade_street_shop(_session.state, _lot_id(), CoreClock.now()):
			_finish())
	_d["pay"] = Paper.button("", "primary", _pay)
	_d["operations"] = Paper.col([_d["choose"], _d["prices"], _d["income"], _d["progress"], _d["modes"], _d["schedule"], _d["buy"], _d["fitout"], _d["collect"], _d["upgrade"], _d["reason"]], 8)
	_d["confirm"] = Paper.col([Paper.words(_t("street.confirmTitle"), "strong"), _d["quote"], Paper.words(_t("street.confirmHint"), "muted"), Paper.button(_t("street.cancelPayment"), "ghost", _cancel), _d["pay"]], 8)
	_d["confirm"].visible = false
	var scroll := Paper.scroller(Paper.col([_d["status"], _d["operations"], _d["confirm"]], 8))
	_d["scroll"] = scroll
	_detail.add_child(Paper.col([Paper.line([_d["picture"], Paper.col([_d["address"], _d["title"]], 4), close], 12), scroll], 8))


func _lot_id() -> String:
	return CoreStreets.street_lot_id(_street, _plot)


func _hand() -> bool:
	return ticks.call() >= _ready_at


func _guard() -> void:
	_ready_at = ticks.call() + _GUARD
	if is_inside_tree():
		get_tree().create_timer(_GUARD / 1000.0 + 0.01).timeout.connect(func() -> void:
			if is_inside_tree():
				update())


func _clear_pending() -> void:
	_pending = null
	_d["confirm"].visible = false
	_d["operations"].visible = true


func _cancel() -> void:
	_clear_pending()
	_guard()
	update()


func _close_detail() -> void:
	_clear_pending()
	_open = false
	_detail.visible = false
	update()


func _home() -> void:
	_ui.close_street()


## The phone's back button: one thing at a time.
func back() -> void:
	if _pending != null:
		_cancel()
	elif _open:
		_close_detail()
	else:
		_home()


func _finish() -> void:
	_changed.call()
	update()


func _reward(r: Dictionary) -> void:
	_ui.dialogs.note(_t("projects.collected", {"money": _money(r["coins"]), "n": r["inspiration"]}))


func _block(kind: String) -> Variant:
	return CoreStreets.plot_purchase_block(_session.state, _street, _plot) if kind == "land" else CoreStreets.fit_out_block(_session.state, _lot_id(), _business)


## A second, explicit confirmation is needed before either is paid.
func _ask(kind: String) -> void:
	if not _open or not _hand() or _pending != null or _block(kind) != null:
		return
	_pending = {"kind": kind, "street": _street, "plot": _plot, "business": _business}
	_d["operations"].visible = false
	_d["confirm"].visible = true
	var price: float = CoreStreets.plot_price(_street, _plot) if kind == "land" else CoreStreets.fit_out_price(_business)
	_d["quote"].text = _t("street.confirmLand" if kind == "land" else "street.confirmFitout", {"street": street_name(_street), "plot": _plot, "business": business_name(_business), "money": _money(price), "time": _time(CoreStreets.fit_out_seconds(_session.state, _business))})
	_d["pay"].text = _t("street.confirmPay", {"money": _money(price)})
	_guard()
	update()


func _pay() -> void:
	if _pending == null or not _open or not _hand() or _pending["street"] != _street or _pending["plot"] != _plot or _pending["business"] != _business:
		return
	var land: bool = _pending["kind"] == "land"
	var s := _session.state
	var ok := CoreStreets.buy_street_plot(s, _street, _plot, CoreClock.now()) if land else CoreStreets.fit_out_street_plot(s, _lot_id(), _business, CoreClock.now())
	_clear_pending()
	_guard()
	if ok:
		_ui.dialogs.note(_t("street.bought", {"name": street_name(_street), "n": _plot}) if land else _t("street.fitting", {"name": business_name(_business)}))
		_finish()
	else:
		update()


# ---------------------------------------------------------------- each time the rules say

func update() -> void:
	var s := _session.state
	var now := CoreClock.now()
	for id: String in _choices:
		var c: Dictionary = _choices[id]
		var unlocked := CoreStreets.street_unlocked(s, id)
		Paper.dress(c["button"], "on" if id == _street else ("chip" if unlocked else "locked"))
		c["badge"].texture = load("res://art/full/street/%s.webp" % ("flag" if unlocked else "lock"))
		c["note"].text = _t("street.available") if unlocked else _t("street.unlockAt", {"n": CoreStreets.street_def(id)["required"]})
	_wallet.text = _t("street.wallet", {"money": _money(s["coins"]), "n": s["roomProjects"]["inspiration"]})
	_name.text = street_name(_street)
	_description.text = _t("street.%s.bonus" % _street)
	var owned := float(CoreStreets.STREET_PLOTS.filter(func(p: Dictionary) -> bool: return s["streets"]["lots"].has(CoreStreets.street_lot_id(_street, p["id"]))).size())
	var count := CoreStreets.owned_plot_count(s)
	_guidance.text = _t("street.ownedCount", {"n": owned}) if CoreStreets.street_unlocked(s, _street) else _t("street.locked", {"n": maxf(0.0, CoreStreets.street_def(_street)["required"] - count)})
	for plot: String in _shops:
		_show_shop(plot, now)
	var total := 0.0
	for id: String in CoreStreets.street_lot_ids(s):
		total += CoreStreets.street_production(s, id, now)["coins"]
	_collect_all.disabled = total == 0.0
	_collect_all.text = _t("street.collectAll", {"money": _money(total)})
	_detail.visible = _open
	if _open:
		_update_detail(s, now, count)


func _update_detail(s: Dictionary, now: float, count: float) -> void:
	var id := _lot_id()
	var lot: Variant = s["streets"]["lots"].get(id)
	var business: Variant = lot["business"] if lot != null else null
	var building: bool = business != null and lot["readyAt"] > now
	var running: bool = business != null and not building
	var output := CoreStreets.street_production(s, id, now)
	var price := CoreStreets.plot_price(_street, _plot)
	var fit_price := CoreStreets.fit_out_price(_business)
	var of: String = business if business != null else _business
	_d["address"].text = "%s / %s" % [street_name(_street), _t("street.plot", {"n": _plot})]
	_d["picture"].texture = load("res://art/full/map/region-%s.webp" % of) if ResourceLoader.exists("res://art/full/map/region-%s.webp" % of) else null
	_d["picture"].visible = _d["picture"].texture != null
	_d["title"].text = "%s · Lv.%s" % [business_name(business), JsMath.number_to_string(lot["level"])] if business != null else _t("street.vacantTitle" if lot != null else "street.saleTitle")
	if building:
		_d["status"].text = _t("street.renovating", {"time": _time(ceilf((lot["readyAt"] - now) / 1000.0))})
	elif running:
		_d["status"].text = _t("projects.full", {"n": output["capacity"]}) if output["full"] else _t("projects.running", {"n": output["batches"], "cap": output["capacity"], "time": _time(ceilf(output["left"]))})
	else:
		_d["status"].text = _t("street.chooseUse" if lot != null else "street.purchaseHint")
	_d["choose"].visible = business == null
	var picker: OptionButton = _d["picker"]
	for i in CoreStreets.BUSINESSES.size():
		var def: Dictionary = CoreStreets.BUSINESSES[i]
		var unlocked: bool = maxf(0.0, count - (1.0 if lot != null else 0.0)) >= def["required"]
		picker.set_item_disabled(i, not unlocked)
		picker.set_item_text(i, "%s · %s%s" % [business_name(def["id"]), _money(CoreStreets.fit_out_price(def["id"])), "" if unlocked else " · %s" % _t("street.businessUnlock", {"n": def["required"] + 1.0})])
		if def["id"] == _business and picker.selected != i:
			picker.select(i)
	Paper.say(_d["prices"], "" if business != null else _t("street.fitoutQuote" if lot != null else "street.priceBreakdown", {"land": _money(price), "fitout": _money(fit_price), "total": _money(price + fit_price)}))
	_d["description"].text = _t("street.business.%s.desc" % _business)
	var mode: String = lot["mode"] if lot != null and lot.get("mode") is String else "short"
	var terms: Dictionary = CoreRoomProjects.PROJECT_MODES[mode]
	var def: Dictionary = CoreRoomProjects.project_def(CoreStreets.business_def(of)["project"])
	var level: float = lot["level"] if lot != null and lot["level"] is float and lot["level"] > 0.0 else 1.0
	_d["income"].text = _t("projects.yield", {"money": _money(JsMath.js_round(def["coins"] * terms["yield"] * level * CoreStreets.street_yield_multiplier(_street, of))), "n": def["inspiration"] * terms["yield"] * level, "time": _time(CoreRoomProjects.project_cycle_seconds(s, mode)), "storage": _time(CoreRoomProjects.project_cycle_seconds(s, mode) * CoreRoomProjects.project_capacity(s, mode))})
	for part: String in ["progress", "modes", "schedule"]:
		_d[part].visible = running
	_d["progress"].value = output["progress"]
	for m: String in CoreRoomProjects.PROJECT_MODES:
		_d["mode:%s" % m].text = _t("projects.mode.%s" % m, {"time": _time(CoreRoomProjects.project_cycle_seconds(s, m))})
		Paper.dress(_d["mode:%s" % m], "on" if m == mode else "chip")
	var block: Variant = CoreStreets.plot_purchase_block(s, _street, _plot)
	var fit_block: Variant = CoreStreets.fit_out_block(s, id, _business)
	var cost: Variant = CoreStreets.street_upgrade_price(s, id)
	_d["buy"].visible = lot == null
	_d["buy"].disabled = block != null or not _hand()
	_d["buy"].text = _t("street.buy", {"money": _money(price)})
	_d["fitout"].visible = lot != null and business == null
	_d["fitout"].disabled = fit_block != null or not _hand()
	_d["fitout"].text = _t("street.fitout", {"money": _money(fit_price), "time": _time(CoreStreets.fit_out_seconds(s, _business))})
	_d["pay"].disabled = _pending == null or not _hand()
	_d["collect"].visible = running
	_d["collect"].disabled = output["batches"] <= 0.0
	_d["collect"].text = _t("projects.collect", {"money": _money(output["coins"]), "n": output["inspiration"]})
	_d["upgrade"].visible = running
	_d["upgrade"].disabled = cost == null or s["coins"] < cost["coins"] or s["roomProjects"]["inspiration"] < cost["inspiration"]
	_d["upgrade"].text = _t("projects.upgrade", {"money": _money(cost["coins"]), "n": cost["inspiration"]}) if cost != null else _t("projects.max")
	var reason := _t("street.autoStaff")
	if lot == null:
		match block:
			"street": reason = _t("street.locked", {"n": CoreStreets.street_def(_street)["required"] - count})
			"day": reason = _t("projects.dayLocked")
			"coins": reason = _t("projects.needCoins", {"money": _money(price - s["coins"])})
			_: reason = _t("street.totalCost", {"money": _money(price + fit_price)})
	elif business == null:
		match fit_block:
			"coins": reason = _t("projects.needCoins", {"money": _money(fit_price - s["coins"])})
			"business": reason = _t("street.businessUnlock", {"n": CoreStreets.business_def(_business)["required"] + 1.0})
	elif running and cost != null:
		if s["coins"] < cost["coins"]:
			reason = _t("projects.needCoins", {"money": _money(cost["coins"] - s["coins"])})
		elif s["roomProjects"]["inspiration"] < cost["inspiration"]:
			reason = _t("projects.needInspiration", {"n": cost["inspiration"] - s["roomProjects"]["inspiration"]})
	_d["reason"].text = reason
	# As tall as what it says, up to most of the screen.
	var scroll: ScrollContainer = _d["scroll"]
	scroll.custom_minimum_size.y = minf(scroll.get_child(0).get_combined_minimum_size().y + 4.0, size.y * 0.55)
