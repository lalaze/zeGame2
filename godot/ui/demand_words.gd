class_name DemandWords
extends RefCounted

## Who comes and what they like (src/ui/customer-demand.ts).


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func kind(id: String) -> String:
	return _t("demand.kind.%s" % id)


static func _suits(coverage: float) -> String:
	return _t("demand.good" if coverage >= 0.8 else ("demand.some" if coverage >= 0.5 else "demand.limited"))


## The card over today's menu; null before guests have tastes.
static func prep(s: Dictionary, items: Array, open: bool, turned: Callable) -> Control:
	if not CoreCustomerDemand.demand_enabled(s):
		return null
	var plan := CoreCustomerDemand.demand_plan(s, items)
	var condition := CoreConditions.today_condition(s)
	var suited := plan["guests"].filter(func(g: Dictionary) -> bool: return g["coverage"] >= 0.8).map(func(g: Dictionary) -> String: return kind(g["kind"])) as Array
	var details := Paper.col([Paper.words(_t("demand.explain"), "muted")], 6)
	for g: Dictionary in plan["guests"]:
		details.add_child(Paper.col([Paper.words(kind(g["kind"]), "strong"), Paper.words("%s · %s" % [_suits(g["coverage"]), _t("demand.share", {"pct": JsMath.js_round(g["share"] * 100.0)})], "small"), Paper.words(_t("demand.wants.%s" % g["kind"]), "muted")], 2))
	for effect: String in UiWords.condition_effects(condition):
		details.add_child(Paper.words(effect, "muted"))
	details.add_child(Paper.words(_t("demand.forecastNote"), "muted"))
	var card := Paper.card("note")
	card.add_child(Paper.col([
		Paper.words(_t("demand.title") if condition["id"] == "fair" else "%s · %s" % [UiWords.condition_name(condition), _t("demand.title")], "strong"),
		Paper.words(_t("demand.hint.%s" % condition["id"])),
		Paper.words(_t("demand.empty") if items.is_empty() else (_t("demand.suited", {"groups": UiWords.join(suited)}) if not suited.is_empty() else _t("demand.limitedMenu")), "muted"),
		Paper.fold(_t("demand.details"), details, open, turned),
	], 6))
	return card


## Who a dish suits; "" without anyone.
static func dish(s: Dictionary, item: Dictionary) -> String:
	if not CoreCustomerDemand.demand_enabled(s):
		return ""
	var kinds := CoreCustomerDemand.GUEST_KINDS.filter(func(k: String) -> bool: return CoreCustomerDemand.guest_affinity(k, item) >= 0.8).map(kind)
	return _t("demand.dish", {"groups": UiWords.join(kinds)}) if not kinds.is_empty() else ""


## What to expect tomorrow, for the day's report: its heading and hint, or nothing.
static func tomorrow(s: Dictionary, day: float) -> Array:
	if not CoreCustomerDemand.demand_enabled({"day": day + 1.0}):
		return []
	return [_t("demand.tomorrow"), _t("demand.hint.%s" % CoreConditions.condition_on(s, day + 1.0))]


## What each kind of guest did today; null without any.
static func report(r: Dictionary) -> Control:
	var guests: Dictionary = r["guests"]
	var groups := CoreCustomerDemand.GUEST_KINDS.filter(func(k: String) -> bool: return guests[k]["arrived"] > 0.0)
	if groups.is_empty():
		return null
	var best: String = JsUtil.stable_sort(groups.duplicate(), func(a: String, b: String) -> float: return guests[b]["served"] - guests[a]["served"])[0]
	var details := Paper.col([], 6)
	for k: String in groups:
		var g: Dictionary = guests[k]
		details.add_child(Paper.words(kind(k), "strong"))
		details.add_child(Paper.words(_t("demand.results", {"arrived": g["arrived"], "served": g["served"], "paired": g["paired"], "money": CoreFormat.format_account_money(g["revenue"])})))
		if g["stockLost"] > 0.0 or g["waitLost"] > 0.0:
			details.add_child(Paper.words(_t("demand.losses", {"stock": g["stockLost"], "wait": g["waitLost"]}), "muted"))
		if g["cancelled"] > 0.0 or g["dismissed"] > 0.0:
			details.add_child(Paper.words(_t("demand.closed", {"cancelled": g["cancelled"], "dismissed": g["dismissed"]}), "muted"))
	details.add_child(Paper.words(_t("demand.observedOnly"), "muted"))
	return Paper.col([Paper.words(_t("demand.report"), "strong"), Paper.words(_t("demand.reportBest", {"group": kind(best), "n": guests[best]["served"]}) if guests[best]["served"] > 0.0 else _t("demand.noService")), Paper.fold(_t("demand.reportDetails"), details)], 6)
