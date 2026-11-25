class_name UiWords
extends RefCounted

## Phrases several screens share (src/ui/{reputation,conditions,traffic-status,panel}.ts).


static var _tags := RegEx.create_from_string("</?[a-z]+>")


static func t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


## The few words the page keeps outside its locale files.
static func here(zh: String, en: String) -> String:
	return zh if I18n.locale == "zh" else en


static func money(n: float) -> String:
	return CoreFormat.format_transaction_money(n)


## toLocaleString for whole numbers: thousands apart.
static func grouped(n: float) -> String:
	var digits := JsMath.number_to_string(n)
	var out := ""
	while digits.length() > 3 and digits.is_valid_int():
		out = ",%s%s" % [digits.right(3), out]
		digits = digits.left(digits.length() - 3)
	return digits + out


static func join(list: Array) -> String:
	return t("list.sep").join(PackedStringArray(list))


static func ingredient(id: String) -> String:
	return t("ing.%s" % id)


## Without the page's tags.
static func plain(text: String) -> String:
	return _tags.sub(text, "", true)


static func percent(multiplier: float) -> String:
	var n := JsMath.js_round((multiplier - 1.0) * 100.0)
	return "+%d" % int(n) if n > 0.0 else ("−%d" % int(absf(n)) if n < 0.0 else "±0")


## JavaScript's toFixed for what the screens show.
static func fixed(n: float, digits: int) -> String:
	return JsMath.to_fixed(n, digits)


# ---------------------------------------------------------------- the day's weather

static func condition_name(condition: Dictionary) -> String:
	return t("condition.%s.name" % condition["id"])


static func _taste(taste: String) -> String:
	return t("condition.taste.%s" % taste if taste in ["iced", "bakery"] else "moment.flavor.%s" % taste)


static func _pct(multiplier: float) -> float:
	return JsMath.js_round(absf(multiplier - 1.0) * 100.0)


## Every effect of a day, in the player's words, straight from its numbers.
static func condition_effects(c: Dictionary) -> Array:
	var out := []
	if not c["favored"].is_empty():
		out.append(t("condition.popular", {"items": join(c["favored"].map(_taste))}))
	if not c["less"].is_empty():
		out.append(t("condition.lessPopular", {"items": join(c["less"].map(_taste))}))
	if c["traffic"] != 1.0:
		out.append(t("condition.traffic.more" if c["traffic"] > 1.0 else "condition.traffic.fewer", {"pct": _pct(c["traffic"])}))
	if c["matchBonus"] > 0.0:
		out.append(t("condition.match", {"pct": JsMath.js_round(c["matchBonus"] * 100.0)}))
	if c["patience"] > 0.0:
		out.append(t("condition.patience", {"n": c["patience"]}))
	if c["seating"] != 1.0:
		out.append(t("condition.seating.more" if c["seating"] > 1.0 else "condition.seating.fewer"))
	return out


## Short label for the day clock. Empty on a fair day.
static func condition_hud(state: Dictionary) -> String:
	var condition := CoreConditions.today_condition(state)
	return "" if condition["id"] == "fair" else condition_name(condition)


## A dish row's note: whether today calls for it; "" without one.
static func dish_condition(state: Dictionary, id: String) -> String:
	var mood: Variant = CoreConditions.dish_mood(state, id)
	return t("condition.dish.%s" % mood) if mood is String else ""


## Tomorrow, for the day's report: its name and what it calls for. "" if fair.
static func tomorrow(state: Dictionary, day: float) -> String:
	var c: Dictionary = CoreConditions.condition_def(CoreConditions.condition_on(state, day + 1.0))
	if c["id"] == "fair":
		return ""
	return "%s %s" % [t("condition.tomorrow", {"name": condition_name(c)}), " ".join(PackedStringArray(condition_effects(c).slice(0, 2)))]


## The service's rhythm in a sentence; "" while closed.
static func traffic_story(state: Dictionary) -> String:
	if state["phase"] != "open":
		return ""
	return t("flow.traffic.story.%s" % CoreTraffic.traffic_at(state["dayTime"])["phase"])
