class_name PrepareDialog
extends RefCounted

## The morning's preparation (src/ui/prepare.ts): today's menu, what to bake, and the stock for it.

var _ui: CafeUi
var _session: CoreGameSession
var _start: Callable
var _changed: Callable
var _body := Paper.col([], 10)
var _footer := Paper.col([], 6)
var _start_button: Button
var _receipt := ""
## How each fold stands, over a redraw.
var _open := {"demand": false, "details": false, "style": false, "wish": false, "history": false}
var _wish_fold: Dictionary = {}


static func show_prepare(ui: CafeUi, start: Callable, changed: Callable) -> void:
	var d := PrepareDialog.new()
	d._ui = ui
	d._session = ui.session
	d._start = start
	d._changed = changed
	d._body.set_meta("owner", d)
	var made := ui.dialogs.show_dialog(_t("prep.title", {"n": ui.session.state["day"]}), d._body, [{"label": _t("prep.start"), "kind": "primary", "pressed": start}, {"label": _t("prep.later")}], {"tall": true, "footer": d._footer})
	d._start_button = made["buttons"][0]
	d._render()


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _note(what: String) -> Callable:
	return func(open: bool) -> void: _open[what] = open


func _again() -> void:
	_changed.call()
	_render()


func _render() -> void:
	var s := _session.state
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
	_body.add_child(Paper.words(_t("prep.menuHint")))
	if s["day"] == 1.0 and s["totalEarned"] == 0.0 and full and on_menu == ["espresso"] and CoreEconomy.ready_servings(s, "espresso") > 0.0:
		_body.add_child(Paper.words(_t("prep.starterStock", {"n": CoreFormat.format_number(CoreEconomy.ready_servings(s, "espresso"))}), "muted"))
	if has_bakery:
		_body.add_child(Paper.words(_t("prep.bakeryHint"), "muted"))
	var shared := _shared(s, menu)
	if not shared.is_empty():
		_body.add_child(Paper.words(_t("prep.sharedStock", {"items": shared}), "muted"))
	var guests := DemandWords.prep(s, menu, _open["demand"], _note("demand"))
	if guests != null:
		_body.add_child(guests)
	for m: Dictionary in available:
		_body.add_child(_row(s, m, m["id"] in on_menu, m["id"] in low, demand))
	var trial := TrialCards.choice(_session, _again, _open["history"], _note("history"))
	if trial != null:
		_body.add_child(trial)
	if menu.size() > 1:
		_body.add_child(Paper.words(_t("prep.average", {"price": UiWords.money(CoreEconomy.average_dish_price(s))}), "muted"))
	if menu.is_empty():
		_body.add_child(Paper.words(_t("prep.emptyMenu"), "bad"))
	if has_bakery:
		var b := Paper.button(_t("bake.all"), "ghost", func() -> void:
			CoreEconomy.bake_for_forecast(s)
			_receipt = ""
			_again())
		b.disabled = not on_menu.any(CoreEconomy.is_bakery)
		_body.add_child(b)
	if CoreKitchen.kitchen_load(s) > 1.0:
		_body.add_child(Paper.words(_t("prep.capacity"), "bad"))
	if not low.is_empty():
		_body.add_child(Paper.words("%s %s %s" % [_t("prep.low"), UiWords.join(low.map(func(id: String) -> String: return I18n.item_name(id, s))), _t("prep.lowNext")], "bad"))
	var missing := Restocking.names(quote["buy"])
	if not missing.is_empty():
		_body.add_child(Paper.words(_t("prep.missing", {"items": missing}), "muted"))
	if not full:
		var buying := Restocking.names(plan["buy"])
		_body.add_child(Paper.words(_t("pantry.plan", {"items": buying if not buying.is_empty() else _t("prep.noPurchase"), "balance": UiWords.money(plan["balance"])}), "muted"))
		if plan["missingCost"] > 0.0:
			_body.add_child(Paper.words(_t("pantry.unmet", {"items": Restocking.names(plan["missing"]), "price": UiWords.money(plan["missingCost"])}), "bad"))
	if CoreRecovery.can_emergency_restock(s):
		_body.add_child(Paper.words(_t("prep.emergencyHint"), "bad"))
		_body.add_child(Paper.button(_t("prep.emergency"), "primary", func() -> void:
			_receipt = _t("prep.emergencyReceived" if CoreRecovery.emergency_restock(s) else "prep.emergencyUnavailable")
			_again()))
	if not _receipt.is_empty():
		_body.add_child(Paper.words(_receipt, "good"))
	_body.add_child(Paper.button(_t("signature.entry"), "ghost", func() -> void: SignatureLab.show_lab(_ui, _changed, func() -> void: show_prepare(_ui, _start, _changed))))
	_body.add_child(Paper.fold(_t("style.prep.current", {"name": StyleDialog.style_name(s["cafeStyle"]["focus"])}), StyleDialog.prep_summary(s, func() -> void: StyleDialog.show_styles(_ui, _changed, func() -> void: show_prepare(_ui, _start, _changed))), _open["style"], _note("style")))
	var wish := WishCard.card(s, _again, true, _wish_fold)
	if wish != null:
		_body.add_child(Paper.fold(WishCard.title(s), wish, _open["wish"], _note("wish")))
	_body.add_child(Paper.fold(_t("prep.details"), _details(s, has_bakery), _open["details"], _note("details")))
	_render_footer(s, menu, quote, plan, full)
	_start_button.disabled = menu.is_empty()


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


func _row(s: Dictionary, m: Dictionary, on: bool, low: bool, demand: Dictionary) -> Control:
	var id: String = m["id"]
	var eligible := CoreEconomy.can_prepare_item(s, id)
	var bakery := CoreEconomy.is_bakery(id)
	var note := _t("menu.requiresKitchen") if not eligible else (_t("menu.off") if not on else (_t("bake.forecast", {"n": ceilf(demand.get(id, 0.0))}) if bakery else _t("prep.onlyDrinkStock", {"n": CoreFormat.format_number(CoreEconomy.ready_servings(s, id))})))
	var copy := Paper.col([Paper.words(I18n.item_name(id, s), "strong"), Paper.words(note, "small")], 1)
	if eligible and not bakery:
		copy.add_child(Paper.words(_t("prep.drinkIngredients", {"items": UiWords.join(CoreEconomy.recipe(id).map(func(p: Array) -> String: return "%s ×%s" % [UiWords.ingredient(p[0]), JsMath.number_to_string(p[1])]))}), "small"))
	copy.add_child(Paper.words(TasteDialog.label(s, id), "small"))
	if eligible:
		for extra: String in [UiWords.dish_condition(s, id), DemandWords.dish(s, m)]:
			if not extra.is_empty():
				copy.add_child(Paper.words(extra, "good"))
	var tick := Paper.check("", on, func(checked: bool) -> void:
		CoreEconomy.set_on_menu(s, id, checked)
		_receipt = ""
		_again.call_deferred(), eligible)
	tick.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var row := Paper.line([tick, Portraits.icon("item:%s" % id, 40.0), copy], 8)
	var card := Paper.card("row")
	if not on:
		card.modulate.a = 0.75
	elif low:
		card.add_theme_stylebox_override("panel", Paper.row_box(true))
	var inside := Paper.col([row], 6)
	if eligible and bakery:
		var step := func(by: float) -> void:
			CoreEconomy.set_bake_plan(s, id, s["bakePlan"].get(id, 0.0) + by)
			_receipt = ""
			_again()
		var less := Paper.button("−%s" % JsMath.number_to_string(CoreData.BAKE_STEP), "chip", step.bind(-CoreData.BAKE_STEP))
		var more := Paper.button("+%s" % JsMath.number_to_string(CoreData.BAKE_STEP), "chip", step.bind(CoreData.BAKE_STEP))
		var amount := Paper.entry(JsMath.number_to_string(s["bakePlan"].get(id, 0.0)), "", 4, Callable(), on)
		amount.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER
		amount.custom_minimum_size.x = 72.0
		amount.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		var commit := func(_text: String = "") -> void:
			var n := JsMath.parse_float(amount.text)
			if is_nan(n) or n == s["bakePlan"].get(id, 0.0):
				return
			CoreEconomy.set_bake_plan(s, id, n)
			_receipt = ""
			_again.call_deferred()
		amount.text_submitted.connect(commit)
		amount.focus_exited.connect(commit)
		less.disabled = not on
		more.disabled = not on
		inside.add_child(Paper.flow([less, amount, more, Paper.words(_t("bake.suggested", {"n": CoreEconomy.suggested_bake(s, id)}), "small", false)], 6))
	card.add_child(inside)
	return card


func _details(s: Dictionary, has_bakery: bool) -> Control:
	var out := Paper.col([], 4)
	var lines := [_t("pantry.forecast", {"n": CoreFormat.format_number(CoreEconomy.expected_customers(s))}), _t("prep.forecastHint"), _t("prep.sharedIngredients"), _t("rating.prep", {"pct": UiWords.percent(CoreReputation.reputation_traffic(s["reputation"]))})]
	if s["promotion"] != null:
		var campaign: Dictionary = s["promotion"]
		lines.append(_t("promo.prepPaused" if campaign["paused"] else "promo.prep", {"pct": JsMath.js_round(CorePromotion.promotion_plan(campaign["id"])["boost"] * 100.0), "seconds": ceilf(campaign["remaining"])}))
	if not s["pets"].is_empty():
		lines.append(_t("pet.forecast", {"pct": JsMath.js_round((CorePets.forecast_pet_traffic(s) - 1.0) * 100.0)}))
	if has_bakery:
		lines.append(_t("prep.kitchen"))
	for text: String in lines:
		out.add_child(Paper.words(text, "muted"))
	return out


## The stock decision stays beside opening the day.
func _render_footer(s: Dictionary, menu: Array, quote: Dictionary, plan: Dictionary, full: bool) -> void:
	Paper.clear(_footer)
	var parts: Array = quote["buy"].keys().map(func(id: String) -> String: return "%s ×%s" % [UiWords.ingredient(id), JsMath.number_to_string(quote["buy"][id])])
	var first := UiWords.join(parts.slice(0, 2))
	var summary := _t("prep.emptyMenu") if menu.is_empty() else ("" if full else _t("prep.stockMissingShort", {"items": _t("prep.stockMore", {"items": first, "n": float(parts.size() - 2)}) if parts.size() > 2 else first}))
	if not summary.is_empty():
		_footer.add_child(Paper.words(summary, "muted" if full else "bad"))
	if menu.is_empty():
		return
	var b := Paper.button(_t("prep.stockReadyShort") if full else _t("prep.budgetAction" if plan["missingCost"] > 0.0 else "prep.restockAction", {"price": UiWords.money(plan["cost"])}), "ghost" if full else "primary", func() -> void:
		var bought := Restocking.restock(_session)
		_receipt = _t("prep.bought", {"items": bought}) if not bought.is_empty() else _t("prep.noPurchase")
		_again())
	b.disabled = full or plan["cost"] <= 0.0
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_footer.add_child(b)
