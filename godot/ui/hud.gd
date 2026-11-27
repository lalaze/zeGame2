class_name CafeHud
extends Control

## What is always on screen over the building on a phone (mobile-cafe-hud.ts, floors-ui.ts, play-flow.ts, regions.ts):
## Direction A "wood signs + notebook": hanging wood sign, coin purse, right-side kitchen stamp, bottom wooden shelf
## with 5 slots (Streets, Ledger, arched Bell/Help, Walls, More), and the taped paper card of "more".

signal opened(what: String)
const _WX_ICON := {"fair": "sun", "rain": "rain", "hot": "sun", "crisp": "leaf", "market": "bag", "quiet": "cloud"}
const _WX_TINT := {
	"fair": Color8(0xc9, 0x8a, 0x2a), "rain": Color8(0x5d, 0x86, 0xa8), "hot": Color8(0xd4, 0x6a, 0x34),
	"crisp": Color8(0x6d, 0x8f, 0x68), "market": Color8(0xb8, 0x73, 0x44), "quiet": Color8(0x7b, 0x94, 0xa8),
}
var session: CoreGameSession
var feed: FloorsFeed
## The sheet of more controls is up.
var expanded := false
var _ui: CafeUi
var _header: HBoxContainer
var _sign: PaperPlank
var _wx: PanelContainer
var _wx_icon: TextureRect
var _purse: PanelContainer
var _name: Label
var _time: Label
var _speed: Label
var _condition: Label
var _daybar: ProgressBar
var _coins: Label
var _kitchen: PaperStamp
var _dock := Control.new()
var _shelf_board: PaperPlank
var _dock_row := HBoxContainer.new()
var _street: PaperStamp
var _manage: PaperStamp
var _open: PaperBell
var _help: PaperBell
var _wall: PaperStamp
var _more: PaperStamp
var _hint: Label
var _veil := ColorRect.new()
var _sheet: PaperTapedCard
var _sheet_body: VBoxContainer
var _sheet_signature := ""
var _card: PanelContainer = null
var _offered := false
var _card_signature := ""
var _top := 8.0
var _bottom := 12.0
var _last_cond := ""
var _last_narrow := -1


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
	_hint.add_theme_stylebox_override("normal", Paper.strip_box(Vector2(14, 6)))
	_hint.add_theme_font_size_override("font_size", 12)
	_hint.add_theme_color_override("font_color", Paper.NOTE_INK)
	_hint.offset_bottom = -108.0
	add_child(_hint)
	resized.connect(_layout_chrome)


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _build_header() -> void:
	_header = Paper.line([], 6)
	_header.name = "Header"
	_header.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_header.offset_left = 12.0
	_header.offset_right = -12.0
	_header.offset_top = 14.0
	_header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_header)
	# Hanging wood sign (left)
	_sign = Paper.plank(Vector2(14, 9), 12.0, true, false)
	_sign.set_padding(14.0, 9.0, 28.0, 10.0)
	_sign.custom_minimum_size = Vector2(180.0, 58.0)
	_sign.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_sign.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	_name = Paper.words("", "tiny", false)
	_name.add_theme_font_override("font", Paper.font(700))
	_name.add_theme_font_size_override("font_size", 11)
	_name.add_theme_color_override("font_color", Color(1.0, 0.965, 0.902, 0.86))
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_time = Paper.words("", "h3", false)
	_time.add_theme_font_override("font", Paper.font(800))
	_time.add_theme_font_size_override("font_size", 16)
	_time.add_theme_color_override("font_color", Color8(0xff, 0xf6, 0xe6))
	_speed = Paper.words("", "tiny", false)
	_speed.add_theme_stylebox_override("normal", Paper.box(Color(1.0, 0.965, 0.902, 0.22), Color.TRANSPARENT, 0, 8, Vector2(6, 1)))
	_speed.add_theme_font_override("font", Paper.font(800))
	_speed.add_theme_font_size_override("font_size", 10)
	_speed.add_theme_color_override("font_color", Color8(0xff, 0xf6, 0xe6))
	_condition = Paper.words("", "tiny", false)
	_condition.add_theme_font_override("font", Paper.font(600))
	_condition.add_theme_font_size_override("font_size", 11)
	_condition.add_theme_color_override("font_color", Color(1.0, 0.94, 0.84, 0.92))
	_condition.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_condition.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_daybar = ProgressBar.new()
	_daybar.max_value = 1.0
	_daybar.step = 0.001
	_daybar.show_percentage = false
	_daybar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_daybar.custom_minimum_size.y = 6.0
	_daybar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_daybar.add_theme_stylebox_override("background", Paper.box(Color(0.0, 0.0, 0.0, 0.26), Color.TRANSPARENT, 0, 3, Vector2.ZERO))
	_daybar.add_theme_stylebox_override("fill", Paper.box(Color8(0xf4, 0xc3, 0x6b), Color.TRANSPARENT, 0, 3, Vector2.ZERO))
	_daybar.visible = false
	var time_row := Paper.line([_time, _speed], 6)
	time_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sign_col := Paper.col([_name, time_row, _condition, _daybar], 3)
	sign_col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_sign.add_child(sign_col)
	_sign.gui_input.connect(_tap.bind(func() -> void: set_expanded(not expanded)))
	_sign.resized.connect(_place_wx)
	var sign_wrap := MarginContainer.new()
	sign_wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sign_wrap.add_theme_constant_override("margin_right", 10)
	sign_wrap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sign_wrap.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	sign_wrap.add_child(_sign)
	_header.add_child(sign_wrap)
	# Coin purse (right)
	_purse = Paper.firm(Paper.panel(Paper.purse_box()))
	_purse.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	_coins = Paper.words("", "h1", false)
	_coins.add_theme_font_override("font", Paper.font(800))
	_coins.add_theme_font_size_override("font_size", 18)
	_coins.add_theme_color_override("font_color", Paper.INK_A)
	var inside := Paper.line([Paper.coin_badge(24.0), _coins], 7)
	inside.alignment = BoxContainer.ALIGNMENT_CENTER
	inside.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_purse.add_child(inside)
	_purse.gui_input.connect(_tap.bind(func() -> void: SmallDialogs.money(_ui.dialogs, session.state["coins"])))
	_purse.resized.connect(_layout_chrome)
	_header.add_child(_purse)
	# Weather disc overhanging the sign's right edge
	_wx = PanelContainer.new()
	_wx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var wx_style := StyleBoxFlat.new()
	wx_style.bg_color = Paper.LIGHT
	wx_style.border_color = Paper.WOOD_EDGE
	wx_style.set_border_width_all(2)
	wx_style.set_corner_radius_all(20)
	wx_style.corner_detail = 8
	wx_style.shadow_color = Color(0.0, 0.0, 0.0, 0.25)
	wx_style.shadow_size = 4
	wx_style.shadow_offset = Vector2(0.0, 2.0)
	_wx.add_theme_stylebox_override("panel", wx_style)
	_wx.custom_minimum_size = Vector2(38.0, 38.0)
	_wx.size = Vector2(38.0, 38.0)
	_wx_icon = Paper.mark("sun", 21.0, _WX_TINT["fair"])
	_wx_icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_wx_icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_wx.add_child(_wx_icon)
	add_child(_wx)


func _place_wx() -> void:
	if _sign == null or _wx == null:
		return
	var x := _header.offset_left + _sign.size.x - 22.0
	if size.x > 0.0:
		x = minf(x, size.x - _wx.size.x - 2.0)
	_wx.position = Vector2(x, _header.offset_top + 8.0)


func _layout_chrome() -> void:
	if _sign != null and _purse != null and size.x > 0.0:
		var narrow := size.x < 380.0
		var pad_x := 10.0 if narrow else 12.0
		_header.offset_left = pad_x
		_header.offset_right = -pad_x
		var cf := 16 if narrow else 18
		if _coins.get_theme_font_size("font_size") != cf:
			_coins.add_theme_font_size_override("font_size", cf)
		var pad_l := 12.0 if narrow else 14.0
		var pad_r := 24.0 if narrow else 28.0
		var narrow_tag := 1 if narrow else 0
		if narrow_tag != _last_narrow:
			_last_narrow = narrow_tag
			_sign.set_padding(pad_l, 8.0 if narrow else 9.0, pad_r, 9.0 if narrow else 10.0)
		var purse_w := maxf(96.0, _purse.get_combined_minimum_size().x)
		var avail := maxf(120.0, size.x - pad_x * 2.0 - purse_w - 16.0)
		var sign_w := minf(202.0, avail)
		if absf(_sign.custom_minimum_size.x - sign_w) > 1.0:
			_sign.custom_minimum_size.x = sign_w
		var inner_w := maxf(64.0, sign_w - pad_l - pad_r)
		var speed_w := (_speed.get_combined_minimum_size().x + 6.0) if _speed.visible else 0.0
		var f800 := Paper.font(800)
		var tf := 15 if narrow else 16
		while tf > 12 and f800.get_string_size(_time.text, HORIZONTAL_ALIGNMENT_LEFT, -1, tf).x + speed_w > inner_w:
			tf -= 1
		if _time.get_theme_font_size("font_size") != tf:
			_time.add_theme_font_size_override("font_size", tf)
		var tight := f800.get_string_size(_time.text, HORIZONTAL_ALIGNMENT_LEFT, -1, tf).x + speed_w > inner_w
		_time.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS if tight else TextServer.OVERRUN_NO_TRIMMING
		_time.size_flags_horizontal = Control.SIZE_EXPAND_FILL if tight else Control.SIZE_SHRINK_BEGIN
	_place_wx()
	if _sheet != null and size.x > 0.0:
		_sheet.custom_minimum_size.x = minf(304.0, maxf(256.0, size.x - 24.0))
		_sheet.tail_right = 28.0 if size.x >= 390.0 else 24.0


## A tap on paper that is not a button.
func _tap(event: InputEvent, pressed: Callable) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed and not _ui.dialogs.is_open():
		pressed.call()


func _build_side() -> void:
	_kitchen = Paper.stamp(_t("area.kitchen.name"), "kitchen", func() -> void: _offer(not _offered), {
		"disc": 46.0, "icon_size": 22.0, "font_size": 11, "label_pill": true,
	})
	_kitchen.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_kitchen.offset_left = -64.0
	_kitchen.offset_right = -10.0
	_kitchen.offset_top = 76.0
	_kitchen.offset_bottom = 148.0
	add_child(Paper.firm(_kitchen))


func _build_dock() -> void:
	_dock.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_dock.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_dock.offset_left = 0.0
	_dock.offset_right = 0.0
	_dock.offset_top = -100.0
	_dock.offset_bottom = 0.0
	_dock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_dock)
	_shelf_board = Paper.plank(Vector2.ZERO, 10.0, false, true)
	_shelf_board.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_shelf_board.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_shelf_board.offset_left = 0.0
	_shelf_board.offset_right = 0.0
	_shelf_board.offset_top = -46.0
	_shelf_board.offset_bottom = 0.0
	_dock.add_child(_shelf_board)
	_dock_row.add_theme_constant_override("separation", 4)
	_dock_row.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_dock_row.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_dock_row.offset_left = 8.0
	_dock_row.offset_right = -8.0
	_dock_row.offset_top = -94.0
	_dock_row.offset_bottom = -8.0
	_dock_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_dock_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dock.add_child(_dock_row)
	# 5 slots left-to-right: Streets, Ledger, Arched Primary (Open/Help), Walls, More.
	_street = Paper.stamp("", "map", _dock_pressed.bind(_ui.open_street))
	_manage = Paper.stamp("", "book", _dock_pressed.bind(func() -> void: _ui.set_ledger(true)))
	var primary_slot := HBoxContainer.new()
	primary_slot.add_theme_constant_override("separation", 0)
	primary_slot.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	primary_slot.size_flags_vertical = Control.SIZE_SHRINK_END
	primary_slot.size_flags_stretch_ratio = 2.2
	primary_slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_open = Paper.bell("", "bell", _dock_pressed.bind(session.prepare_day))
	_help = Paper.bell("", "help", _dock_pressed.bind(func() -> void: SmallDialogs.service_help(_ui.dialogs, session)))
	_help.visible = false
	primary_slot.add_child(Paper.firm(_open))
	primary_slot.add_child(Paper.firm(_help))
	_wall = Paper.stamp(_t("floors.wall"), "wall", func() -> void:
		set_expanded(false)
		_ui.set_wall(not feed.outer_wall))
	_more = Paper.stamp(_t("mobile.more"), "more", func() -> void: set_expanded(not expanded))
	for s: PaperStamp in [_street, _manage, _wall, _more]:
		s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		s.size_flags_vertical = Control.SIZE_SHRINK_END
		s.size_flags_stretch_ratio = 1.0
		s.custom_minimum_size = Vector2(46.0, 76.0)
	_dock_row.add_child(Paper.firm(_street))
	_dock_row.add_child(Paper.firm(_manage))
	_dock_row.add_child(primary_slot)
	_dock_row.add_child(Paper.firm(_wall))
	_dock_row.add_child(Paper.firm(_more))


func _dock_pressed(act: Callable) -> void:
	set_expanded(false)
	act.call()


func _build_sheet() -> void:
	_veil.color = Color(60 / 255.0, 38 / 255.0, 24 / 255.0, 0.22)
	_veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	_veil.visible = false
	_veil.gui_input.connect(_tap.bind(func() -> void: set_expanded(false)))
	add_child(_veil)
	move_child(_veil, 0)
	_sheet = Paper.taped_card(28.0, Vector2(12, 12))
	_sheet.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_sheet.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_sheet.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_sheet.offset_right = -12.0
	_sheet.offset_bottom = -112.0
	_sheet.offset_top = -112.0
	_sheet.custom_minimum_size.x = 296.0
	_sheet.visible = false
	_sheet_body = Paper.col([], 8)
	_sheet.add_child(_sheet_body)
	add_child(_sheet)


func set_expanded(on: bool) -> void:
	expanded = on
	session.mobile_hud_expanded = on
	_sheet.visible = on
	_veil.visible = on
	_sheet_signature = ""
	update()


## Keeps the hanging wood sign and coin purse bright above the chalkboard veil.
func set_header_raised(on: bool) -> void:
	var z := 1 if on else 0
	if _header != null:
		_header.z_index = z
	if _wx != null:
		_wx.z_index = z


func inset(top: float, bottom: float) -> void:
	_top = top
	_bottom = bottom
	_header.offset_top = top + 18.0
	_sign.rope_height = maxf(20.0, top + 20.0)
	_sign.queue_redraw()
	_kitchen.offset_top = top + 76.0
	_kitchen.offset_bottom = top + 148.0
	_dock.offset_top = -100.0 - bottom
	_dock.offset_bottom = 0.0
	_shelf_board.offset_top = -46.0 - bottom
	_shelf_board.offset_bottom = 0.0
	_dock_row.offset_top = -94.0 - bottom
	_dock_row.offset_bottom = -8.0 - bottom
	_sheet.offset_bottom = -112.0 - bottom
	_sheet.offset_top = -112.0 - bottom
	_hint.offset_bottom = -108.0 - bottom
	_layout_chrome()


# ---------------------------------------------------------------- each time the rules say

func update() -> void:
	var s := session.state
	var open: bool = s["phase"] != "prep"
	var clock := CoreBusinessClock.format_business_clock(s["dayTime"])
	var cafe_name: String = s["profile"]["cafeName"] if s["profile"] != null else "Tiny Bean Café"
	if _name.text != cafe_name:
		_name.text = cafe_name
	var header_changed := false
	var time_text := "%s · %s" % [_t("day.label", {"n": s["day"]}), clock if open else _t("day.closed")]
	if _time.text != time_text:
		_time.text = time_text
		header_changed = true
	var speed_text := "%d×" % int(s["speed"])
	if _speed.text != speed_text:
		_speed.text = speed_text
		header_changed = true
	if _speed.visible != open:
		_speed.visible = open
		header_changed = true
	var cond_text := UiWords.condition_hud(s)
	if _condition.text != cond_text:
		_condition.text = cond_text
	_condition.visible = not cond_text.is_empty()
	var cond_id: String = CoreConditions.today_condition(s)["id"]
	if cond_id != _last_cond:
		_last_cond = cond_id
		_wx_icon.texture = Paper.icon(_WX_ICON.get(cond_id, "sun"), 21)
		_wx_icon.modulate = _WX_TINT.get(cond_id, _WX_TINT["fair"])
	_daybar.visible = open
	if open:
		var share := clampf(s["dayTime"] / CoreData.DAY_SECONDS, 0.0, 1.0)
		if absf(_daybar.value - share) > 0.002:
			_daybar.value = share
	var coins_text := CoreFormat.format_transaction_money(s["coins"])
	if _coins.text != coins_text:
		_coins.text = coins_text
		header_changed = true
	if header_changed:
		_layout_chrome()
	_wall.words = _t("floors.wall")
	_wall.active = feed.outer_wall
	_kitchen.words = _t("area.kitchen.name")
	_kitchen.active = _offered
	_kitchen.visible = not s["kitchen"] and not _ui.arranging() and not expanded
	if s["kitchen"] and _card != null:
		_offer(false)
	_street.words = UiWords.here("街道", "Streets")
	_open.visible = not open and s["profile"] != null
	var counting: Variant = session.manager_countdown()
	_open.words = _t("manager.opening", {"n": counting}) if counting != null else _t("day.open", {"n": s["day"]})
	_help.visible = open
	_help.disabled = not session.service_help_allowed()
	_help.words = _t("flow.helpCooldownShort") if not session.sim.help_ready() else _t("flow.help" if not session.service_help_options().is_empty() else "flow.helpIdle")
	_manage.words = UiWords.here("手账", "Manage")
	_more.words = _t("mobile.less") if expanded else _t("mobile.more")
	_more.icon_name = "close" if expanded else "more"
	_more.active = expanded
	var total_unread := int(CorePartners.partner_unread(s)) + int(CoreRegularGuests.regular_guest_unread_count(s))
	_more.set_badge(0, total_unread > 0 and not expanded)
	var hint_text := _t("hint.tap")
	if _hint.text != hint_text:
		_hint.text = hint_text
	_hint.visible = session.hint_shown and not expanded and not _ui.life.visible and not _ui.arranging()
	_dock.visible = not _ui.arranging()
	if expanded:
		_update_sheet()
	if _card != null:
		_show_kitchen_card()


static func _compact_btn(text: String, active_on: bool, pressed: Callable) -> Button:
	var b := Paper.button(text, "on" if active_on else "chip", pressed)
	b.custom_minimum_size = Vector2(36.0, 34.0)
	b.add_theme_font_size_override("font_size", 12)
	var face := Paper.BLUSH if active_on else Paper.CREAM_A
	var normal := Paper.box(face, Paper.LINE_A, 1.5, 10, Vector2(9, 4), Paper.LINE_A, 2.0 if not active_on else 0.0)
	var down := Paper.box(Paper.BLUSH, Paper.LINE_A, 1.5, 10, Vector2(9, 4))
	for st: String in ["normal", "hover", "focus"]:
		b.add_theme_stylebox_override(st, normal)
	b.add_theme_stylebox_override("pressed", down)
	b.add_theme_stylebox_override("hover_pressed", down)
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(tone, Paper.INK_A)
	return b


func _update_sheet() -> void:
	var s := session.state
	var open: bool = s["phase"] != "prep"
	var signature := "%s|%s|%s|%s|%s|%s|%s" % [s["phase"], s["speed"], session.status["kind"], I18n.locale, SmallDialogs.rating_words(s), UiWords.traffic_story(s), _unread()]
	if signature == _sheet_signature:
		return
	_sheet_signature = signature
	Paper.clear(_sheet_body)
	var close := Paper.button("", "ghost", func() -> void: set_expanded(false), "close", 15)
	close.custom_minimum_size = Vector2(34.0, 34.0)
	var close_box := Paper.box(Paper.CREAM_A, Paper.LINE_A, 1.5, 17, Vector2(6, 6))
	for st: String in ["normal", "hover", "focus", "pressed"]:
		close.add_theme_stylebox_override(st, close_box)
	var heading := Paper.words(_t("mobile.controls"), "h3")
	heading.add_theme_font_size_override("font_size", 15)
	heading.add_theme_color_override("font_color", Paper.INK_A)
	_sheet_body.add_child(Paper.line([heading, close], 6))
	if open:
		var story := UiWords.traffic_story(s)
		if not story.is_empty():
			var sl := Paper.words(story, "small")
			sl.add_theme_color_override("font_color", Paper.INK_LIGHT)
			_sheet_body.add_child(sl)
		var speed_box := PanelContainer.new()
		speed_box.add_theme_stylebox_override("panel", Paper.box(Color.WHITE, Paper.LINE_A, 1.5, 10, Vector2(2, 2)))
		var seg := HBoxContainer.new()
		seg.add_theme_constant_override("separation", 2)
		for v: float in CoreData.SPEEDS:
			var sb := Paper.button("%d×" % int(v), "flat", func() -> void:
				session.set_speed(v)
				update())
			sb.custom_minimum_size = Vector2(34.0, 30.0)
			sb.add_theme_font_size_override("font_size", 12)
			var on_bg := Paper.box(Paper.BLUSH if v == s["speed"] else Color.TRANSPARENT, Color.TRANSPARENT, 0, 8, Vector2(6, 2))
			for st: String in ["normal", "hover", "focus", "pressed"]:
				sb.add_theme_stylebox_override(st, on_bg)
			for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
				sb.add_theme_color_override(tone, Paper.INK_A)
			seg.add_child(sb)
		speed_box.add_child(seg)
		var close_day_btn := _compact_btn(_t("day.finishNow" if s["phase"] == "closing" else "day.close"), false, func() -> void:
			set_expanded(false)
			session.close_day())
		close_day_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_sheet_body.add_child(Paper.line([speed_box, close_day_btn], 6))
		var kind: String = session.status["kind"]
		var status_btn := _compact_btn(_t("flow.shortageTitle" if kind == "ingredients" else "ops.%s" % kind), false, _go.bind("status"))
		status_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		status_btn.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var pantry_btn := _compact_btn(_t("flow.pantry"), false, _go.bind("pantry"))
		pantry_btn.size_flags_horizontal = Control.SIZE_SHRINK_END
		_sheet_body.add_child(Paper.line([status_btn, pantry_btn], 6))
		_sheet_body.add_child(Paper.seam())
	var links := Paper.grid(3, [
		Paper.more_stamp(SmallDialogs.rating_words(s), "star", Paper.MORE_TINTS["reputation"], _go.bind("reputation")),
		Paper.more_stamp(UiWords.here("伙伴", "Team"), "people", Paper.MORE_TINTS["partners"], _go.bind("partners"), int(CorePartners.partner_unread(s))),
		Paper.more_stamp(_t("regular.ui.button"), "heart", Paper.MORE_TINTS["regulars"], _go.bind("regulars"), int(CoreRegularGuests.regular_guest_unread_count(s))),
		Paper.more_stamp(_t("style.ui.button"), "brush", Paper.MORE_TINTS["style"], _go.bind("style")),
		Paper.more_stamp(_t("hud.settings"), "gear", Paper.MORE_TINTS["settings"], _go.bind("settings")),
	], 6)
	_sheet_body.add_child(links)


func _unread() -> String:
	return "%s/%s" % [CorePartners.partner_unread(session.state), CoreRegularGuests.regular_guest_unread_count(session.state)]


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
	if _kitchen != null:
		_kitchen.active = _offered


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
