class_name TrialCards
extends RefCounted

## Trial sales (src/ui/trial-sales.ts): choosing a drink to try today, and how the last trial went.


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _money(n: float) -> String:
	return CoreFormat.format_account_money(n)


## Results stay after the settlement closes, with a removed recipe's name. Null without a trial.
static func result(session: CoreGameSession, changed: Callable, report: Variant = null) -> Control:
	var s := session.state
	if not report is Dictionary:
		report = s["trialSales"]["last"]
	if not report is Dictionary:
		return null
	var card := Paper.card("row")
	var body := Paper.col([], 6)
	card.add_child(body)
	_show_result(body, session, changed, report.duplicate(true))
	return card


static func _show_result(body: VBoxContainer, session: CoreGameSession, changed: Callable, report: Dictionary) -> void:
	var s := session.state
	Paper.clear(body)
	var item: String = report["item"]
	var named: Variant = report.get("name")
	var name: String = named if named is String and not named.is_empty() else I18n.item_name(item, s)
	var prepared: float = report["prepared"]
	var served: float = report["served"]
	var limit: float = CoreTrialSales.TRIAL_SALE_LIMIT
	body.add_child(Paper.words(_t("trial.result.title", {"day": report["day"], "item": name}), "h3"))
	body.add_child(Paper.words(_t("trial.result.cups", {"prepared": prepared, "served": served, "limit": limit})))
	body.add_child(Paper.words(_t("trial.result.money", {"revenue": _money(report["revenue"]), "cost": _money(report["ingredientCost"]), "profit": _money(report["revenue"] - report["ingredientCost"])})))
	if prepared > served:
		body.add_child(Paper.words(_t("trial.result.waste", {"n": prepared - served}), "muted"))
	body.add_child(Paper.words(_t("trial.result.feedback", report["feedback"]) if served > 0.0 else _t("trial.result.noFeedback")))
	if served > 0.0:
		body.add_child(Paper.words(_t("trial.result.practice", {"n": served, "before": UiWords.fixed(report["qualityBefore"], 1), "after": UiWords.fixed(report["qualityAfter"], 1)}), "muted"))
	body.add_child(Paper.words(_t("trial.result.costNote"), "muted"))
	var same := func() -> bool:
		var last: Variant = s["trialSales"]["last"]
		return s["phase"] == "prep" and last != null and last["day"] == report["day"] and last["item"] == item
	var current: bool = same.call()
	var available := CoreTrialSales.can_trial_drink(s, item)
	var on_menu := CoreEconomy.menu_items(s).any(func(m: Dictionary) -> bool: return m["id"] == item)
	var chosen: Variant = CoreTrialSales.trial_sale_item(s)
	var selected: bool = chosen is String and chosen == item
	var full: bool = item.begins_with("sig:") and s["signatureDrinks"]["recipes"].filter(func(r: Dictionary) -> bool: return r["onMenu"]).size() >= CoreSignatureDrinks.MAX_SIGNATURE_MENU
	var act := func(change: Callable) -> void:
		if same.call() and change.call():
			changed.call()
			if body.is_inside_tree():
				_show_result(body, session, changed, report)
	var repeat := Paper.button(_t("trial.repeatSelected" if selected else "trial.repeat"), "ghost", act.bind(func() -> bool: return CoreTrialSales.select_trial_sale(s, item)))
	repeat.disabled = not current or not available or selected
	var promote := Paper.button(_t("trial.promoted" if on_menu else "trial.promote"), "ghost", act.bind(func() -> bool: return CoreEconomy.promote_trial_sale(s)))
	promote.disabled = not current or not available or full
	body.add_child(Paper.flow([repeat, promote]))
	if full and available:
		body.add_child(Paper.words(_t("trial.customFull", {"n": CoreSignatureDrinks.MAX_SIGNATURE_MENU}), "muted"))
	elif not available and not on_menu:
		body.add_child(Paper.words(_t("trial.unavailable"), "muted"))


## Today's trial, for the preparation; null without a drink to try. `history` is how its fold stands.
static func choice(session: CoreGameSession, changed: Callable, history: bool, turned: Callable) -> Control:
	var s := session.state
	var drinks := CoreEconomy.unlocked_items(s).filter(func(m: Dictionary) -> bool: return CoreTrialSales.can_trial_drink(s, m["id"]))
	var selected: Variant = CoreTrialSales.trial_sale_item(s)
	if drinks.is_empty() and s["trialSales"]["last"] == null and selected == null:
		return null
	var limit: float = CoreTrialSales.TRIAL_SALE_LIMIT
	var entries: Array = [[null, _t("trial.none")]]
	for m: Dictionary in drinks:
		entries.append([m["id"], I18n.item_name(m["id"], s)])
	var body := Paper.col([Paper.words(_t("trial.title"), "h3"), Paper.words(_t("trial.intro", {"n": limit}), "muted"), Paper.line([Paper.words(_t("trial.choose")), Paper.select(entries, selected, func(id: Variant) -> void:
		if CoreTrialSales.select_trial_sale(s, id):
			changed.call(), s["phase"] == "prep")])], 6)
	if drinks.is_empty():
		body.add_child(Paper.words(_t("trial.noChoices"), "muted"))
	if selected != null:
		if not CoreEconomy.menu_items(s).any(func(m: Dictionary) -> bool: return CoreData.is_drink(m["category"])):
			body.add_child(Paper.words(_t("trial.noDrinks"), "bad"))
		body.add_child(Paper.words(_t("trial.preview", {"price": _money(CoreEconomy.sale_price(s, selected)), "cost": _money(CoreEconomy.serving_cost(selected)), "seconds": UiWords.fixed(CoreEconomy.prep_time(s, selected), 1)}), "muted"))
		body.add_child(Paper.words(_t("trial.stock", {"n": minf(limit, CoreEconomy.ready_servings(s, selected)), "limit": limit}), "muted"))
		body.add_child(Paper.words(_t("trial.stockNote", {"n": limit}), "muted"))
		if CoreTrialSales.trial_held_for_mina(s):
			body.add_child(Paper.words(_t("trial.mina"), "muted"))
	if s["trialSales"]["last"] != null:
		body.add_child(Paper.fold(_t("trial.last"), result(session, changed), history, turned))
	var card := Paper.card("note")
	card.add_child(body)
	return card
