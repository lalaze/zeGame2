class_name CafeHud
extends Control

## What is always on screen over the building on a phone (mobile-cafe-hud.ts, floors-ui.ts, play-flow.ts, regions.ts):
## the café's plaque and its money, the walls' button, the kitchen on offer, the row of tools, and the sheet of "more".

signal opened(what: String)
var session: CoreGameSession
var feed: FloorsFeed
## The sheet of more controls is up.
var expanded := false
var _ui: CafeUi
var _name: Label
var _time: Label
var _speed: Label
var _condition: Label
var _coins: Label
var _wall: PaperTool
var _kitchen: PaperTool
var _dock := HBoxContainer.new()
var _street: PaperTool
var _open: PaperTool
var _help: PaperTool
var _manage: PaperTool
var _more: PaperTool
var _hint: Label
var _veil := ColorRect.new()
var _sheet: PanelContainer
var _sheet_body: VBoxContainer
var _sheet_signature := ""
var _card: PanelContainer = null
var _offered := false
var _card_signature := ""
var _top := 8.0
var _bottom := 12.0


func _init(ui: CafeUi) -> void:
	_ui = ui
	session = ui.session
	feed = ui.feed
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_header()
	_build_side()
	_build_dock()
	_build_sheet()
	_hint = Paper.words("", "strong", false)
	_hint.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_hint.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_hint.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_hint.add_theme_stylebox_override("normal", Paper.box(Paper.PAPER, Paper.LINE, 2, 14, Vector2(14, 8), Paper.STAMP, 3.0))
	_hint.offset_bottom = -96.0
	add_child(_hint)


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _build_header() -> void:
	var row := Paper.line([], 8)
	row.name = "Header"
	row.set_anchors_preset(Control.PRESET_TOP_WIDE)
	row.offset_left = 12.0
	row.offset_right = -12.0
	row.offset_top = 10.0
	add_child(row)
	var clock := Paper.card("plaque")
	clock.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	clock.custom_minimum_size.y = 58.0
	_name = Paper.words("", "h3", false)
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_time = Paper.words("", "small", false)
	_speed = Paper.words("", "tiny", false)
	_speed.add_theme_stylebox_override("normal", Paper.box(Paper.SAGE, Color.TRANSPARENT, 0, 8, Vector2(7, 0)))
	_speed.add_theme_color_override("font_color", Paper.LIGHT)
	_condition = Paper.words("", "small", false)
	# The weather gives way when there is no room for it.
	_condition.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_condition.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	clock.add_child(Paper.col([Paper.line([Paper.mark("menu", 18.0), _name], 6), Paper.line([_time, _speed, _condition], 6)], 2))
	clock.gui_input.connect(_tap.bind(func() -> void: set_expanded(not expanded)))
	row.add_child(clock)
	var money := Paper.card("plaque")
	_coins = Paper.words("", "h1", false)
	_coins.add_theme_font_size_override("font_size", 21)
	var inside := Paper.line([Paper.mark("coin", 22.0, Paper.GOLD), _coins], 6)
	inside.alignment = BoxContainer.ALIGNMENT_CENTER
	money.add_child(inside)
	money.gui_input.connect(_tap.bind(func() -> void: SmallDialogs.money(_ui.dialogs, session.state["coins"])))
	row.add_child(money)


## A tap on paper that is not a button.
func _tap(event: InputEvent, pressed: Callable) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed and not _ui.dialogs.is_open():
		pressed.call()


func _build_side() -> void:
	_wall = Paper.tool(_t("floors.wall"), "wall", func() -> void: _ui.set_wall(not feed.outer_wall), "ghost", 22.0)
	_kitchen = Paper.tool(_t("area.kitchen.name"), "kitchen", func() -> void: _offer(not _offered), "ghost", 22.0)
	var y := 80.0
	for b: PaperTool in [_wall, _kitchen]:
		b.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
		b.offset_left = -68.0
		b.offset_right = -12.0
		b.offset_top = y
		b.offset_bottom = y + 58.0
		b.small()
		add_child(Paper.firm(b))
		y += 66.0


func _build_dock() -> void:
	_dock.add_theme_constant_override("separation", 8)
	_dock.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_dock.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_dock.offset_left = 12.0
	_dock.offset_right = -12.0
	_dock.offset_top = -78.0
	_dock.offset_bottom = -14.0
	add_child(_dock)
	# Every tool but "more" puts the sheet away.
	_street = Paper.tool("", "map", _dock_pressed.bind(_ui.open_street))
	_open = Paper.tool("", "menu", _dock_pressed.bind(session.prepare_day), "primary")
	_help = Paper.tool("", "help", _dock_pressed.bind(func() -> void: SmallDialogs.service_help(_ui.dialogs, session)), "primary")
	_manage = Paper.tool("", "book", _dock_pressed.bind(func() -> void: _ui.set_ledger(true)))
	_more = Paper.tool("", "more", func() -> void: set_expanded(not expanded))
	for b: PaperTool in [_street, _open, _help, _manage, _more]:
		b.custom_minimum_size.y = 64.0
		b.size_flags_stretch_ratio = 2.0 if b == _open or b == _help else 1.0
		_dock.add_child(Paper.firm(b))


func _dock_pressed(act: Callable) -> void:
	set_expanded(false)
	act.call()


func _build_sheet() -> void:
	_veil.color = Color(Paper.VEIL, 0.3)
	_veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	_veil.visible = false
	_veil.gui_input.connect(_tap.bind(func() -> void: set_expanded(false)))
	add_child(_veil)
	move_child(_veil, 0)
	_sheet = Paper.card("sheet")
	_sheet.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_sheet.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_sheet.offset_left = 12.0
	_sheet.offset_right = -12.0
	_sheet.offset_bottom = -92.0
	_sheet.offset_top = -92.0
	_sheet.visible = false
	_sheet_body = Paper.col([], 10)
	_sheet.add_child(_sheet_body)
	add_child(_sheet)


func set_expanded(on: bool) -> void:
	expanded = on
	session.mobile_hud_expanded = on
	_sheet.visible = on
	_veil.visible = on
	_sheet_signature = ""
	update()


func inset(top: float, bottom: float) -> void:
	_top = top
	_bottom = bottom
	get_node("Header").offset_top = top + 10.0
	_wall.offset_top = top + 80.0
	_wall.offset_bottom = top + 138.0
	_kitchen.offset_top = top + 146.0
	_kitchen.offset_bottom = top + 204.0
	_dock.offset_top = -78.0 - bottom
	_dock.offset_bottom = -14.0 - bottom
	_sheet.offset_bottom = -92.0 - bottom
	_sheet.offset_top = -92.0 - bottom
	_hint.offset_bottom = -96.0 - bottom


# ---------------------------------------------------------------- each time the rules say

func update() -> void:
	var s := session.state
	var open: bool = s["phase"] != "prep"
	var clock := CoreBusinessClock.format_business_clock(s["dayTime"])
	_name.text = s["profile"]["cafeName"] if s["profile"] != null else "Tiny Bean Café"
	_time.text = "%s · %s" % [_t("day.label", {"n": s["day"]}), clock if open else _t("day.closed")]
	_speed.text = "%d×" % int(s["speed"])
	_speed.visible = open
	_condition.text = UiWords.condition_hud(s)
	_condition.visible = not _condition.text.is_empty()
	_coins.text = CoreFormat.format_transaction_money(s["coins"])
	_wall.words = _t("floors.wall")
	Paper.dress(_wall, "on" if feed.outer_wall else "ghost")
	_kitchen.words = _t("area.kitchen.name")
	_kitchen.visible = not s["kitchen"] and not _ui.arranging()
	_wall.visible = not _ui.arranging()
	if s["kitchen"] and _card != null:
		_offer(false)
	_street.words = UiWords.here("街道", "Streets")
	_open.visible = not open and s["profile"] != null
	var counting: Variant = session.manager_countdown()
	_open.words = _t("manager.opening", {"n": counting}) if counting != null else _t("day.open", {"n": s["day"]})
	_help.visible = open
	_help.disabled = not session.service_help_allowed()
	_help.words = _t("flow.helpCooldownShort") if not session.sim.help_ready() else _t("flow.help" if not session.service_help_options().is_empty() else "flow.helpIdle")
	_manage.words = UiWords.here("管理", "Manage")
	_more.words = _t("mobile.more")
	Paper.dress(_more, "on" if expanded else "ghost")
	_hint.text = _t("hint.tap")
	_hint.visible = session.hint_shown and not expanded and not _ui.life.visible
	_dock.visible = not _ui.arranging()
	if expanded:
		_update_sheet()
	if _card != null:
		_show_kitchen_card()


func _update_sheet() -> void:
	var s := session.state
	var open: bool = s["phase"] != "prep"
	var signature := "%s|%s|%s|%s|%s|%s|%s" % [s["phase"], s["speed"], session.status["kind"], I18n.locale, SmallDialogs.rating_words(s), UiWords.traffic_story(s), _unread()]
	if signature == _sheet_signature:
		return
	_sheet_signature = signature
	Paper.clear(_sheet_body)
	var close := Paper.button("", "ghost", func() -> void: set_expanded(false), "close")
	_sheet_body.add_child(Paper.line([Paper.words(_t("mobile.controls"), "name"), close]))
	_sheet_body.add_child(Paper.seam())
	if open:
		var story := UiWords.traffic_story(s)
		if not story.is_empty():
			_sheet_body.add_child(Paper.words(story, "muted"))
		var speeds := CoreData.SPEEDS.map(func(v: float) -> Array: return [v, "%d×" % int(v)])
		var row := Paper.choices(speeds, s["speed"], func(v: float) -> void:
			session.set_speed(v)
			update())
		row.add_child(Paper.button(_t("day.finishNow" if s["phase"] == "closing" else "day.close"), "chip", func() -> void:
			set_expanded(false)
			session.close_day()))
		_sheet_body.add_child(row)
		var kind: String = session.status["kind"]
		_sheet_body.add_child(Paper.line([
			Paper.button(_t("flow.shortageTitle" if kind == "ingredients" else "ops.%s" % kind), "ghost", _go.bind("status")),
			Paper.button(_t("flow.pantry"), "ghost", _go.bind("pantry")),
		]))
	var links := Paper.grid(2, [
		Paper.button(SmallDialogs.rating_words(s), "ghost", _go.bind("reputation"), "star"),
		Paper.button(UiWords.here("伙伴", "Team") + _badge(CorePartners.partner_unread(s)), "ghost", _go.bind("partners"), "people"),
		Paper.button(_t("regular.ui.button") + _badge(CoreRegularGuests.regular_guest_unread_count(s)), "ghost", _go.bind("regulars"), "people"),
		Paper.button(_t("style.ui.button"), "ghost", _go.bind("style"), "decor"),
		Paper.button(_t("hud.settings"), "ghost", _go.bind("settings"), "settings"),
	])
	for link: Button in links.get_children():
		# Two columns alike, whatever they say.
		link.custom_minimum_size.x = 0.0
		link.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_sheet_body.add_child(links)


func _unread() -> String:
	return "%s/%s" % [CorePartners.partner_unread(session.state), CoreRegularGuests.regular_guest_unread_count(session.state)]


static func _badge(n: float) -> String:
	return "  %d" % int(n) if n > 0.0 else ""


func _go(what: String) -> void:
	set_expanded(false)
	opened.emit(what)


# ---------------------------------------------------------------- the kitchen on offer

func _offer(on: bool) -> void:
	_offered = on and not session.state["kitchen"]
	_card_signature = ""
	if _card != null:
		_card.queue_free()
		_card = null
	if _offered:
		_card = Paper.card("sheet")
		_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
		_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
		_card.grow_vertical = Control.GROW_DIRECTION_BOTH
		_card.custom_minimum_size.x = 320.0
		add_child(_card)
		_show_kitchen_card()


func _show_kitchen_card() -> void:
	var s := session.state
	var block: Variant = CoreKitchen.kitchen_block(s)
	# Made anew only when it says something else: a button made anew under a finger loses the press.
	var signature := "%s|%s" % [block, I18n.locale]
	if signature == _card_signature:
		return
	_card_signature = signature
	Paper.clear(_card)
	var reason := _t("area.closedOnly") if block is String and block == "open" else (_t("area.saveUp") if block is String and block == "coins" else _t("area.kitchen.ready"))
	var build := Paper.button("%s · %s" % [_t("area.kitchen.unlock"), CoreFormat.format_transaction_money(CoreKitchen.KITCHEN_COST)], "primary", func() -> void:
		if CoreKitchen.unlock_kitchen(s):
			_offer(false)
			_ui.kitchen_opened())
	build.disabled = block is String
	_card.add_child(Paper.col([
		Paper.words(_t("area.kitchen.kicker"), "small"), Paper.words(_t("area.kitchen.name"), "h2"), Paper.words(_t("area.kitchen.below")),
		Paper.words("· %s" % _t("area.kitchen.cook"), "good"), Paper.words("· %s" % _t("area.kitchen.fresh"), "good"), build,
		Paper.button(_t("prep.later"), "ghost", _offer.bind(false)), Paper.words(reason, "small"),
	], 8))
