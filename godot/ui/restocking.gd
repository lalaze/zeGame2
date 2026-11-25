class_name Restocking
extends RefCounted

## Buying what the forecast misses, and saying what was bought (shared by panel.ts and prepare.ts).


static func names(items: Dictionary) -> String:
	return UiWords.join(items.keys().map(func(id: String) -> String: return "%s ×%s" % [UiWords.ingredient(id), JsMath.number_to_string(items[id])]))


## Buys it and gives back what was bought, in words; "" if nothing was.
static func restock(session: CoreGameSession) -> String:
	var pantry: Dictionary = session.state["pantry"]
	var before := pantry.duplicate()
	if not CoreEconomy.restock(session.state):
		return ""
	var bought := {}
	for id: String in pantry:
		if pantry[id] > before[id]:
			bought[id] = pantry[id] - before[id]
	return names(bought)


static func reason(plan: Dictionary) -> String:
	var buying := names(plan["buy"])
	var out := I18n.t("pantry.plan", {"items": buying if not buying.is_empty() else I18n.t("prep.noPurchase"), "balance": UiWords.money(plan["balance"])})
	if plan["missingCost"] > 0.0:
		out += " " + I18n.t("pantry.unmet", {"items": names(plan["missing"]), "price": UiWords.money(plan["missingCost"])})
	return out
