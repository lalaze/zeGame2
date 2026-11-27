class_name PrepareDialog
extends RefCounted

## The morning's preparation chalkboard (src/ui/prepare.ts): today's menu, guest forecast, stock pills, and opening action.

var _ui: CafeUi
var _session: CoreGameSession
var _start: Callable
var _changed: Callable
var _narrow := false
var _board: PaperChalkboard
var _scroll: ScrollContainer
var _body := Paper.col([], 6)
var _footer := Paper.col([], 4)
var _receipt := ""
## How each fold stands, over a redraw.
var _open := {"dishes": false, "demand": false, "details": false, "style": false, "wish": false, "history": false}
var _wish_fold: Dictionary = {}


static func show_prepare(ui: CafeUi, start: Callable, changed: Callable) -> void:
	var d := PrepareDialog.new()
	d._ui = ui
	d._session = ui.session
	d._start = start
	d._changed = changed
	var vw := ui.get_viewport().get_visible_rect().size.x if ui.is_inside_tree() else 412.0
	d._narrow = vw < 380.0
	d._board = PaperChalkboard.new(d._narrow)
	d._board.set_meta("owner", d)
	var header := d._build_header(ui.session.state)
	d._scroll = Paper.scroller(Paper.padded(d._body, 0, 2, 8, 4))
	var shell := Paper.col([header, Paper.chalk_seam(), d._scroll, d._footer], 6)
	shell.size_flags_vertical = Control.SIZE_EXPAND_FILL
	d._board.add_child(shell)
	ui.dialogs.show_custom(d._board, {
		"top_offset": 86.0 if d._narrow else 92.0,
		"side_margin": 10 if d._narrow else 12,
		"bottom_margin": 10 if d._narrow else 14,
		"show_header": true,
	})
	d._render()


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _note(what: String) -> Callable:
	return func(open: bool) -> void: _open[what] = open


func _again() -> void:
	_changed.call()
	_render()


func _build_header(s: Dictionary) -> Control:
	var title := Paper.chalk_words(_t("prep.boardTitle"), "h2")
	if _narrow:
		title.add_theme_font_size_override("font_size", 19)
	var sub := Paper.chalk_words(_t("prep.boardSub"), "small")
	var copy := Paper.col([title, sub], 2)
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var row := Paper.line([copy], 6)
	row.alignment = BoxContainer.ALIGNMENT_BEGIN
	var sticky := DemandWords.sticky(s, _narrow)
	if sticky != null:
		var sticky_w := 134.0 if _narrow else 152.0
		var overhang_x := 16.0 if _narrow else 24.0
		var overhang_y := 22.0 if _narrow else 26.0
		var slot := Control.new()
		slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
		slot.size_flags_horizontal = Control.SIZE_SHRINK_END
		slot.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		slot.custom_minimum_size = Vector2(sticky_w - overhang_x, 42.0)
		sticky.custom_minimum_size.x = sticky_w
		sticky.size.x = sticky_w
		sticky.position = Vector2(0.0, -overhang_y)
		slot.add_child(sticky)
		var fit_slot := func() -> void:
			if not is_instance_valid(sticky) or not is_instance_valid(slot):
				return
			sticky.size = Vector2(sticky_w, sticky.get_combined_minimum_size().y)
			slot.custom_minimum_size = Vector2(sticky_w - overhang_x, maxf(38.0, sticky.size.y - overhang_y + 2.0))
		sticky.minimum_size_changed.connect(fit_slot, CONNECT_DEFERRED)
		fit_slot.call_deferred()
		row.add_child(slot)
	return row


func _render() -> void:
	var s := _session.state
	var scroll_y := _scroll.scroll_vertical
	Paper.clear(_body)
	var menu := CoreEconomy.menu_items(s)
	var on_menu := menu.map(func(m: Dictionary) -> String: return m["id"])
	var available := CoreEconomy.unlocked_items(s)
	var demand := CoreEconomy.day_demand(s)
	var has_bakery := available.any(func(m: Dictionary) -> bool: return CoreEconomy.can_prepare_item(s, m["id"]) and CoreEconomy.is_bakery(m["id"]))
	var check := CoreDay.check_open(s)
	var low: Array = check["items"] if not check["ok"] and check["reason"] == "lowStock" else []
	var quote := CoreEconomy.restock_quote(s)
	var plan := CoreEconomy.restock_plan(s)
	var full: bool = quote["cost"] <= 0.0
	if s["day"] == 1.0 and s["totalEarned"] == 0.0 and full and on_menu == ["espresso"] and CoreEconomy.ready_servings(s, "espresso") > 0.0:
		var starter := Paper.panel(Paper.cached_box(Color(1.0, 1.0, 1.0, 0.08), Color(1.0, 1.0, 1.0, 0.22), 1, 10, Vector2(10, 7)))
		starter.add_child(Paper.chalk_words(_t("prep.starterStock", {"n": CoreFormat.format_number(CoreEconomy.ready_servings(s, "espresso"))})))
		_body.add_child(starter)
	# Dish grid: 2 columns; eligible on-menu bakery tiles span a full row.
	var dishes := Paper.col([], 6 if _narrow else 7)
	var pending: Array = [null]
	var flush_pending := func() -> void:
		if pending[0] == null:
			return
		var spacer := Control.new()
		spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var pair := Paper.line([pending[0], spacer], 7 if _narrow else 9)
		dishes.add_child(pair)
		pending[0] = null
	for m: Dictionary in available:
		var id: String = m["id"]
		var eligible := CoreEconomy.can_prepare_item(s, id)
		var on: bool = id in on_menu
		var bake_open := eligible and CoreEconomy.is_bakery(id) and on
		var tile := _dish_tile(s, m, eligible, on, id in low, bake_open)
		if bake_open:
			flush_pending.call()
			tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			dishes.add_child(tile)
		elif pending[0] == null:
			tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			pending[0] = tile
		else:
			tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			dishes.add_child(Paper.line([pending[0], tile], 7 if _narrow else 9))
			pending[0] = null
	flush_pending.call()
	_body.add_child(dishes)
	if has_bakery:
		var b := Paper.chalk_button(_t("bake.all"), "chalk", func() -> void:
			CoreEconomy.bake_for_forecast(s)
			_receipt = ""
			_again())
		b.disabled = not on_menu.any(CoreEconomy.is_bakery)
		_body.add_child(b)
	_body.add_child(Paper.chalk_fold(_t("prep.dishDetails"), _dish_details(s, available, on_menu, demand), _open["dishes"], _note("dishes")))
	var trial := TrialCards.choice(_session, _again, _open["history"], _note("history"))
	if trial != null:
		Paper.chalk_retheme(trial)
		_body.add_child(trial)
	_body.add_child(Paper.chalk_seam())
	var guests := DemandWords.prep(s, menu, _open["demand"], _note("demand"), _narrow)
	if guests != null:
		_body.add_child(guests)
	var pills := _pantry_pills(s, menu, quote)
	if pills != null:
		_body.add_child(pills)
	if has_bakery:
		var bhint := Paper.panel(Paper.cached_box(Color(1.0, 1.0, 1.0, 0.08), Color(1.0, 1.0, 1.0, 0.22), 1, 10, Vector2(10, 7)))
		bhint.add_child(Paper.chalk_words(_t("prep.bakeryHint"), "muted"))
		_body.add_child(bhint)
	if menu.size() > 1:
		_body.add_child(Paper.chalk_words(_t("prep.average", {"price": UiWords.money(CoreEconomy.average_dish_price(s))}), "muted"))
	if CoreKitchen.kitchen_load(s) > 1.0:
		_body.add_child(Paper.chalk_words(_t("prep.capacity"), "warn"))
	if not low.is_empty():
		_body.add_child(Paper.chalk_words("%s %s %s" % [_t("prep.low"), UiWords.join(low.map(func(id: String) -> String: return I18n.item_name(id, s))), _t("prep.lowNext")], "warn"))
	var missing := Restocking.names(quote["buy"])
	if not missing.is_empty():
		_body.add_child(Paper.chalk_words(_t("prep.missing", {"items": missing}), "muted"))
	if not full:
		var buying := Restocking.names(plan["buy"])
		_body.add_child(Paper.chalk_words(_t("pantry.plan", {"items": buying if not buying.is_empty() else _t("prep.noPurchase"), "balance": UiWords.money(plan["balance"])}), "muted"))
		if plan["missingCost"] > 0.0:
			_body.add_child(Paper.chalk_words(_t("pantry.unmet", {"items": Restocking.names(plan["missing"]), "price": UiWords.money(plan["missingCost"])}), "warn"))
	if CoreRecovery.can_emergency_restock(s):
		_body.add_child(Paper.chalk_words(_t("prep.emergencyHint"), "warn"))
		_body.add_child(Paper.chalk_button(_t("prep.emergency"), "chalk", func() -> void:
			_receipt = _t("prep.emergencyReceived" if CoreRecovery.emergency_restock(s) else "prep.emergencyUnavailable")
			_again()))
	if not _receipt.is_empty():
		_body.add_child(Paper.chalk_words(_receipt, "good"))
	_body.add_child(Paper.chalk_button(_t("signature.entry"), "chalk", func() -> void: SignatureLab.show_lab(_ui, _changed, func() -> void: show_prepare(_ui, _start, _changed))))
	var style_body := StyleDialog.prep_summary(s, func() -> void: StyleDialog.show_styles(_ui, _changed, func() -> void: show_prepare(_ui, _start, _changed)))
	Paper.chalk_retheme(style_body)
	_body.add_child(Paper.chalk_fold(_t("style.prep.current", {"name": StyleDialog.style_name(s["cafeStyle"]["focus"])}), Paper.padded(style_body, 6, 4, 6, 4), _open["style"], _note("style")))
	var wish := WishCard.card(s, _again, true, _wish_fold)
	if wish != null:
		Paper.chalk_retheme(wish)
		_body.add_child(Paper.chalk_fold(WishCard.title(s), Paper.padded(wish, 6, 4, 6, 4), _open["wish"], _note("wish")))
	var shared := _shared(s, menu)
	_body.add_child(Paper.chalk_fold(_t("prep.details"), _details(s, has_bakery, shared), _open["details"], _note("details")))
	_render_footer(menu, quote, plan, full)
	_scroll.set_deferred("scroll_vertical", scroll_y)


static func _shared(s: Dictionary, menu: Array) -> String:
	var counts := {}
	for m: Dictionary in menu:
		if not CoreEconomy.is_bakery(m["id"]):
			for part: Array in CoreEconomy.recipe(m["id"]):
				counts[part[0]] = counts.get(part[0], 0) + 1
	var out := []
	for id: String in counts:
		if counts[id] > 1:
			out.append("%s ×%s" % [UiWords.ingredient(id), CoreFormat.format_number(s["pantry"][id])])
	return UiWords.join(out)


func _dish_tile(s: Dictionary, m: Dictionary, eligible: bool, on: bool, low: bool, bake_open: bool) -> PanelContainer:
	var id: String = m["id"]
	var bakery := CoreEconomy.is_bakery(id)
	var short_status := _t("prep.needsKitchenShort") if not eligible else (_t("menu.off") if not on else (_t("prep.dishBake", {"n": CoreFormat.format_number(s["bakePlan"].get(id, 0.0))}) if bakery else _t("prep.dishDrink", {"n": CoreFormat.format_number(CoreEconomy.ready_servings(s, id))})))
	var tick := Paper.chalk_check(on, func(checked: bool) -> void:
		CoreEconomy.set_on_menu(s, id, checked)
		_receipt = ""
		_again.call_deferred(), eligible, 18 if _narrow else 20)
	var name_lbl := Paper.chalk_words(I18n.item_name(id, s), "strong")
	name_lbl.add_theme_font_size_override("font_size", 12 if _narrow else 13)
	name_lbl.custom_minimum_size.x = 0.0
	var status_lbl := Paper.chalk_words(short_status, "small", false)
	status_lbl.add_theme_font_size_override("font_size", 10 if _narrow else 11)
	var sub_items: Array = [status_lbl]
	if on and low:
		var tag_lbl := Paper.chalk_words(_t("prep.lowTag"), "tiny", false)
		var tag_box := Paper.panel(Paper.cached_box(Color(232 / 255.0, 122 / 255.0, 93 / 255.0, 0.3), Color.TRANSPARENT, 0.0, 6.0, Vector2(5, 1)))
		tag_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tag_box.add_child(tag_lbl)
		sub_items.append(tag_box)
	var sub_row := Paper.flow(sub_items, 4)
	sub_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var copy := Paper.col([name_lbl, sub_row], 1)
	copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var pic := Portraits.icon("item:%s" % id, 30.0 if _narrow else 34.0)
	var header := Paper.line([tick, pic, copy], 5 if _narrow else 6)
	header.alignment = BoxContainer.ALIGNMENT_CENTER
	header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var is_low := on and low
	var tile_style := Paper.cached_box(Paper.CHALK_LOW_BG if is_low else Paper.CHALK_TILE, Paper.CHALK_LOW_EDGE if is_low else Color.TRANSPARENT, 1.5 if is_low else 0.0, 10.0, Vector2(5 if _narrow else 6, 5))
	var card := Paper.panel(tile_style)
	card.set_meta("dish_id", id)
	if not on or not eligible:
		card.modulate.a = 0.48
	var inside := Paper.col([header], 5)
	inside.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if bake_open:
		inside.add_child(Paper.chalk_seam())
		var step := func(by: float) -> void:
			CoreEconomy.set_bake_plan(s, id, s["bakePlan"].get(id, 0.0) + by)
			_receipt = ""
			_again()
		var less := Paper.chalk_button("−%s" % JsMath.number_to_string(CoreData.BAKE_STEP), "chalk_chip", step.bind(-CoreData.BAKE_STEP))
		var more := Paper.chalk_button("+%s" % JsMath.number_to_string(CoreData.BAKE_STEP), "chalk_chip", step.bind(CoreData.BAKE_STEP))
		var amount := Paper.entry(JsMath.number_to_string(s["bakePlan"].get(id, 0.0)), "", 4, Callable(), true)
		amount.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER
		amount.custom_minimum_size = Vector2(64.0, 34.0)
		amount.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		amount.alignment = HORIZONTAL_ALIGNMENT_CENTER
		amount.add_theme_stylebox_override("normal", Paper.cached_box(Color(0.0, 0.0, 0.0, 0.26), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.42), 1.5, 9, Vector2(6, 4)))
		amount.add_theme_stylebox_override("focus", Paper.cached_box(Color(0.0, 0.0, 0.0, 0.34), Paper.CHALK_GOOD, 1.5, 9, Vector2(6, 4)))
		amount.add_theme_color_override("font_color", Paper.CHALK_INK)
		amount.add_theme_color_override("caret_color", Paper.CHALK_INK)
		amount.add_theme_font_size_override("font_size", 14)
		var commit := func(_text: String = "") -> void:
			var n := JsMath.parse_float(amount.text)
			if is_nan(n) or n == s["bakePlan"].get(id, 0.0):
				return
			CoreEconomy.set_bake_plan(s, id, n)
			_receipt = ""
			_again.call_deferred()
		amount.text_submitted.connect(commit)
		amount.focus_exited.connect(commit)
		var sug := Paper.chalk_words(_t("bake.suggested", {"n": CoreEconomy.suggested_bake(s, id)}), "small", false)
		sug.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		inside.add_child(Paper.flow([less, amount, more, sug], 6))
	card.add_child(inside)
	# Tapping anywhere on the tile (or top header of an open bakery tile) toggles the dish.
	if eligible:
		var pressed_at := [Vector2(-9999.0, -9999.0)]
		var tap_target: Control = header if bake_open else card
		tap_target.mouse_filter = Control.MOUSE_FILTER_PASS
		tap_target.gui_input.connect(func(e: InputEvent) -> void:
			if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
				if e.pressed:
					pressed_at[0] = e.global_position
				elif pressed_at[0].x > -9000.0 and pressed_at[0].distance_to(e.global_position) <= 10.0:
					pressed_at[0] = Vector2(-9999.0, -9999.0)
					Paper._finish_typing(tap_target)
					tick.button_pressed = not tick.button_pressed)
	return card


func _dish_details(s: Dictionary, available: Array, on_menu: Array, demand: Dictionary) -> Control:
	var out := Paper.col([], 6)
	for i in available.size():
		var m: Dictionary = available[i]
		var id: String = m["id"]
		var eligible := CoreEconomy.can_prepare_item(s, id)
		var on: bool = id in on_menu
		var bakery := CoreEconomy.is_bakery(id)
		if i > 0:
			out.add_child(Paper.chalk_seam())
		var block := Paper.col([Paper.chalk_words(I18n.item_name(id, s), "strong")], 2)
		if not eligible:
			block.add_child(Paper.chalk_words(_t("menu.requiresKitchen"), "muted"))
		elif not bakery:
			block.add_child(Paper.chalk_words(_t("prep.drinkIngredients", {"items": UiWords.join(CoreEconomy.recipe(id).map(func(p: Array) -> String: return "%s ×%s" % [UiWords.ingredient(p[0]), JsMath.number_to_string(p[1])]))}), "muted"))
		elif on:
			block.add_child(Paper.chalk_words(_t("bake.forecast", {"n": ceilf(demand.get(id, 0.0))}), "muted"))
		block.add_child(Paper.chalk_words(TasteDialog.label(s, id), "muted"))
		if eligible:
			for extra: String in [UiWords.dish_condition(s, id), DemandWords.dish(s, m)]:
				if not extra.is_empty():
					block.add_child(Paper.chalk_words(extra, "good"))
		out.add_child(block)
	return Paper.padded(out, 6, 4, 6, 4)


func _pantry_pills(s: Dictionary, menu: Array, quote: Dictionary) -> Control:
	var used := {}
	for m: Dictionary in menu:
		for part: Array in CoreEconomy.recipe(m["id"]):
			used[part[0]] = true
	if used.is_empty():
		return null
	var row := Paper.flow([], 6)
	var buy: Dictionary = quote["buy"]
	for ing: Dictionary in CoreData.INGREDIENTS:
		var id: String = ing["id"]
		if not used.has(id):
			continue
		var missing: bool = buy.get(id, 0.0) > 0.0
		var pill_style := Paper.cached_box(Paper.CHALK_LOW_BG if missing else Paper.CHALK_PILL, Paper.CHALK_LOW_EDGE if missing else Color.TRANSPARENT, 1.5 if missing else 0.0, 14.0, Vector2(8, 3))
		var pill := Paper.panel(pill_style)
		var count_lbl := Paper.chalk_words(CoreFormat.format_number(s["pantry"][id]), "warn" if missing else "strong", false)
		count_lbl.add_theme_font_size_override("font_size", 12)
		var inside := HBoxContainer.new()
		inside.add_theme_constant_override("separation", 4)
		inside.alignment = BoxContainer.ALIGNMENT_CENTER
		inside.mouse_filter = Control.MOUSE_FILTER_IGNORE
		inside.add_child(Portraits.icon("ing:%s" % id, 22.0 if _narrow else 24.0))
		inside.add_child(count_lbl)
		pill.add_child(inside)
		row.add_child(pill)
	return row


func _details(s: Dictionary, has_bakery: bool, shared: String) -> Control:
	var out := Paper.col([], 4)
	var lines: Array = [_t("prep.menuHint")]
	if not shared.is_empty():
		lines.append(_t("prep.sharedStock", {"items": shared}))
	lines.append_array([
		_t("pantry.forecast", {"n": CoreFormat.format_number(CoreEconomy.expected_customers(s))}),
		_t("prep.forecastHint"),
		_t("prep.sharedIngredients"),
		_t("rating.prep", {"pct": UiWords.percent(CoreReputation.reputation_traffic(s["reputation"]))}),
	])
	if s["promotion"] != null:
		var campaign: Dictionary = s["promotion"]
		lines.append(_t("promo.prepPaused" if campaign["paused"] else "promo.prep", {"pct": JsMath.js_round(CorePromotion.promotion_plan(campaign["id"])["boost"] * 100.0), "seconds": ceilf(campaign["remaining"])}))
	if not s["pets"].is_empty():
		lines.append(_t("pet.forecast", {"pct": JsMath.js_round((CorePets.forecast_pet_traffic(s) - 1.0) * 100.0)}))
	if has_bakery:
		lines.append(_t("prep.kitchen"))
	for text: String in lines:
		out.add_child(Paper.chalk_words(text, "muted"))
	return Paper.padded(out, 6, 4, 6, 4)


## Fixed bottom of the chalkboard: missing summary, big golden action button, optional direct open, and "later".
func _render_footer(menu: Array, quote: Dictionary, plan: Dictionary, full: bool) -> void:
	Paper.clear(_footer)
	_footer.add_child(Paper.chalk_seam())
	var parts: Array = quote["buy"].keys().map(func(id: String) -> String: return "%s ×%s" % [UiWords.ingredient(id), JsMath.number_to_string(quote["buy"][id])])
	var first := UiWords.join(parts.slice(0, 2))
	var empty_menu := menu.is_empty()
	var can_restock_open: bool = not empty_menu and not full and plan["cost"] > 0.0
	var summary := _t("prep.emptyMenu") if empty_menu else (_t("prep.stockReadyShort") if full else _t("prep.stockMissingShort", {"items": _t("prep.stockMore", {"items": first, "n": float(parts.size() - 2)}) if parts.size() > 2 else first}))
	_footer.add_child(Paper.chalk_words(summary, "good" if (full and not empty_menu) else "warn"))
	var go_label := _t("prep.budgetOpen" if plan["missingCost"] > 0.0 else "prep.restockOpen", {"price": UiWords.money(plan["cost"])}) if can_restock_open else _t("prep.start")
	var go := PaperChalkboard.GoButton.new(go_label, _open_shop.bind(can_restock_open), _narrow)
	go.disabled = empty_menu
	_footer.add_child(go)
	if can_restock_open:
		var direct := Paper.chalk_button(_t("prep.openDirect"), "chalk_outline", _open_shop.bind(false))
		direct.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_footer.add_child(direct)
	var later := Paper.chalk_button(_t("prep.later"), "chalk_link", func() -> void: _ui.dialogs.close())
	later.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_footer.add_child(later)


func _open_shop(with_restock: bool) -> void:
	if not _ui.dialogs.is_open() or _session.state["phase"] != "prep":
		return
	var s := _session.state
	if CoreEconomy.menu_items(s).is_empty():
		return
	var bought := ""
	if with_restock and CoreEconomy.restock_quote(s)["cost"] > 0.0 and CoreEconomy.restock_plan(s)["cost"] > 0.0:
		bought = Restocking.restock(_session)
		_changed.call()
	_ui.dialogs.close()
	if _start.is_valid():
		_start.call()
	if not bought.is_empty():
		_ui.dialogs.append_note(_t("prep.bought", {"items": bought}))
