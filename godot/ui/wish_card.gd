class_name WishCard
extends RefCounted

## Mina's wish (src/ui/regular-wishes.ts): the same optional card in the preparation and in the regulars' journal.


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func title(s: Dictionary) -> String:
	var wish: Variant = CoreRegularWishes.mina_wish(s)
	return _t("wish.mina.map.title" if wish != null and wish["completedDay"] != null else "wish.mina.title")


## Null before the wish. `fold` keeps how the plan's fold stands: {"open": bool}.
static func card(s: Dictionary, changed: Callable, compact: bool = false, fold: Dictionary = {}) -> Control:
	if not CoreRegularWishes.mina_wish_available(s):
		return null
	var root := Paper.col([], 6)
	_show(root, s, changed, compact, fold)
	return root


static func _show(root: VBoxContainer, s: Dictionary, changed: Callable, compact: bool, fold: Dictionary) -> void:
	Paper.clear(root)
	var wish: Variant = CoreRegularWishes.mina_wish(s)
	root.add_child(Paper.words(title(s), "h3"))
	var act := func(change: Callable) -> void:
		if not change.call():
			return
		changed.call()
		if root.is_inside_tree():
			_show(root, s, changed, compact, fold)
	if wish != null and wish["completedDay"] != null:
		if compact:
			root.add_child(Paper.words(_t("wish.mina.map.short"), "muted"))
			return
		root.add_child(Portraits.icon("wish:%s" % wish["choice"], 124.0))
		root.add_child(Paper.words(_t("wish.mina.memory.%s" % wish["choice"])))
		root.add_child(Paper.words(_t("wish.mina.map.date", {"day": wish["completedDay"]}), "muted"))
		var shown: bool = wish["displayed"]
		root.add_child(Paper.button(_t("wish.mina.map.hide" if shown else "wish.mina.map.show"), "ghost", act.bind(func() -> bool: return CoreRegularWishes.display_mina_map(s, not shown))))
		root.add_child(Paper.words(_t("wish.mina.map.hanging" if shown else "wish.mina.map.stored"), "muted"))
		return
	if wish != null and wish["rehearsedDay"] != null:
		if not compact:
			root.add_child(Paper.words(_t("wish.mina.rehearsed.%s" % wish["choice"])))
		root.add_child(Paper.words(_t("wish.mina.return"), "muted"))
		return
	if wish == null:
		root.add_child(Paper.words(_t("wish.mina.askShort" if compact else "wish.mina.ask")))
	else:
		root.add_child(Paper.words(_t("wish.mina.paused" if wish["paused"] else ("wish.mina.planShort.%s" if compact else "wish.mina.plan.%s") % wish["choice"])))
		if not wish["paused"] and wish["choice"] == "milky":
			root.add_child(Paper.words(_milky(s), "muted"))
	var closed: bool = s["phase"] == "prep"
	var plan := Paper.col([], 6)
	for choice: String in ["quiet", "milky"]:
		var on: bool = wish != null and wish["choice"] == choice and not wish["paused"]
		var b := Paper.button(_t("wish.mina.choice.%s" % choice), "on" if on else "ghost", act.bind(func() -> bool:
			var ok := CoreRegularWishes.choose_mina_wish(s, choice)
			if ok:
				fold["open"] = false
			return ok))
		b.disabled = not closed
		plan.add_child(b)
		plan.add_child(Paper.words(_t("wish.mina.plan.%s" % choice), "muted"))
	root.add_child(Paper.fold(_t("wish.mina.change" if wish != null else "wish.mina.arrange"), plan, fold.get("open", false), func(open: bool) -> void: fold["open"] = open))
	if wish != null:
		var paused: bool = wish["paused"]
		var b := Paper.button(_t("wish.mina.resume" if paused else "wish.mina.pause"), "ghost", act.bind(func() -> bool: return CoreRegularWishes.set_mina_wish_paused(s, not paused)))
		b.disabled = not closed
		root.add_child(b)
	root.add_child(Paper.words(_t("wish.mina.closedOnly" if not closed else ("wish.mina.optionalShort" if compact else "wish.mina.optional")), "muted"))


static func _milky(s: Dictionary) -> String:
	var menu := CoreEconomy.menu_items(s)
	var trial: Variant = CoreTrialSales.trial_sale_item(s)
	if trial != null and CoreRegularWishes.is_mina_wish_drink(trial) and CoreTrialSales.trial_sale_remaining(s) > 0.0 and CoreEconomy.ready_servings(s, trial) >= 1.0 and menu.any(func(m: Dictionary) -> bool: return CoreData.is_drink(m["category"])):
		return _t("trial.minaReady", {"drink": I18n.item_name(trial, s)})
	for m: Dictionary in menu:
		if CoreRegularWishes.is_mina_wish_drink(m["id"]) and CoreEconomy.ready_servings(s, m["id"]) >= 1.0:
			return _t("wish.mina.milky.ready", {"drink": I18n.item_name(m["id"], s)})
	return _t("wish.mina.milky.missing")


## A day's recap; missed chances have no deadline. Null when there is nothing to say.
static func report(s: Dictionary, day: float) -> Control:
	var wish: Variant = CoreRegularWishes.mina_wish(s)
	if wish == null or wish["paused"]:
		return null
	var map: bool = wish["completedDay"] is float and wish["completedDay"] == day
	var practiced: bool = wish["rehearsedDay"] is float and wish["rehearsedDay"] == day
	if not map and not practiced and wish["rehearsedDay"] != null:
		return null
	var body := _t("wish.mina.memory.%s" % wish["choice"]) if map else (_t("wish.mina.rehearsed.%s" % wish["choice"]) if practiced else _t("wish.mina.retry"))
	var next := _t("wish.mina.map.hanging" if wish["displayed"] else "wish.mina.map.stored") if map else _t("wish.mina.return" if practiced else "wish.mina.optional")
	return Paper.col([Paper.words(_t("wish.mina.map.title" if map else "wish.mina.title"), "h3"), Paper.words(body), Paper.words(next, "muted")], 4)
