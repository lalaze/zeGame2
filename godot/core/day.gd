class_name CoreDay
extends RefCounted

## Port of src/game/day.ts: opening, and closing the books.


## Whether the shop can open, with a warning about dishes without enough opening stock.
static func check_open(state: Dictionary) -> Dictionary:
	if state["phase"] != "prep":
		return {"ok": true}
	var items := CoreEconomy.menu_items(state)
	if items.is_empty():
		return {"ok": false, "reason": "emptyMenu"}
	var demand := CoreEconomy.day_demand(state)
	var projected := CoreEconomy.project_morning_bake(state)
	var low := []
	for m: Dictionary in items:
		var id: String = m["id"]
		var bakery := CoreEconomy.is_bakery(id)
		var needed := JsMath.js_max(1.0, CoreEconomy.suggested_bake(state, id)) if bakery and state["kitchen"] else JsMath.js_max(1.0, ceil(demand.get(id, 0.0) * 0.5))
		var ready: float = projected["shelf"].get(id, 0.0) if bakery else CoreEconomy.servings_left(projected, id)
		if ready < needed:
			low.append(id)
		# Reserve each drink's target, so they do not reuse the same ingredients.
		if not bakery:
			for part: Array in CoreEconomy.recipe(id):
				projected["pantry"][part[0]] -= part[1] * JsMath.js_min(ready, needed)
	var trial: Variant = CoreTrialSales.trial_sale_item(state)
	if trial != null and CoreEconomy.servings_left(projected, trial) < CoreTrialSales.TRIAL_SALE_LIMIT:
		low.append(trial)
	return {"ok": false, "reason": "lowStock", "items": low} if not low.is_empty() else {"ok": true}


## Opens for the day: bakes the morning batch, then lets customers in. Returns how many items were baked.
static func open_shop(state: Dictionary) -> float:
	if state["phase"] != "prep":
		return 0.0
	state["dayTime"] = 0.0
	state["today"] = CoreState.empty_day()
	CoreTrialSales.begin_trial_sales(state)
	state["phase"] = "open"
	return CoreEconomy.bake_morning(state)


## Closes the books on today and moves to planning the next day.
static func finish_day(state: Dictionary) -> Dictionary:
	var today: Dictionary = state["today"]
	var best: Variant = null
	for id: String in today["sales"]:
		if best == null or today["sales"][id] > today["sales"].get(best, 0.0):
			best = id
	# Whatever is left on the shelf goes stale.
	var stale := {}
	var stale_cost := 0.0
	var shelf_sold_out := []
	for id: String in today["baked"]:
		if not state["kitchen"]:
			continue
		var left: float = state["shelf"].get(id, 0.0)
		if left > 0.0:
			stale[id] = left
			stale_cost += left * CoreEconomy.serving_cost(id)
		elif today["baked"][id] > 0.0:
			shelf_sold_out.append(id)
	var report := today.duplicate(false)
	report["guests"] = today["guests"].duplicate(true)
	report["partners"] = CorePartners.partner_contributions(state)
	report["reviews"] = today["reviews"].duplicate(true)
	report["rating"] = CoreReputation.reputation_score(state["reputation"])
	report["ratingCount"] = float(state["reputation"]["recent"].size())
	report["ratingTraffic"] = CoreReputation.reputation_traffic(state["reputation"])
	report["sales"] = today["sales"].duplicate(false)
	report["baked"] = today["baked"].duplicate(false)
	report["day"] = state["day"]
	report["duration"] = state["dayTime"]
	report["profit"] = today["revenue"] - today["ingredientCost"] - today["petCost"] - today["promotionCost"]
	report["bestSeller"] = best
	report["outOfStock"] = CoreEconomy.sold_out_items(state).map(func(m: Dictionary) -> String: return m["id"])
	report["shelfSoldOut"] = shelf_sold_out
	report["stale"] = stale
	report["staleCost"] = stale_cost
	report["trialSale"] = CoreTrialSales.finish_trial_sales(state)
	# Loaned care and sample stock end with this day; paid adoption is retained.
	state["pets"] = state["pets"].filter(func(p: Dictionary) -> bool:
		var until: Variant = p.get("fosterUntilDay")
		return not JsUtil.truthy(until) or until > state["day"])
	if JsUtil.is_number(state["cafeStyle"].get("bakeryTrialDay")) and state["cafeStyle"]["bakeryTrialDay"] == state["day"]:
		state["cafeStyle"].erase("bakeryTrialDay")
		if not state["kitchen"]:
			state["shelf"].erase("roll")
			state["onMenu"] = state["onMenu"].filter(func(id: String) -> bool: return id != "roll")
	# The day's best-ever results, judged while it is still this day (its weather included).
	CoreMilestones.record_day(state, report)
	CoreMilestones.check_milestones(state)
	report["newMilestones"] = CoreMilestones.milestones_reached_on(state, report["day"])
	if state["kitchen"]:
		state["shelf"] = {}
	state["inProduction"] = {}
	state["phase"] = "prep"
	state["day"] += 1.0
	state["dayTime"] = 0.0
	state["today"] = CoreState.empty_day()
	return report


## How long the shop has been open today, as m:ss (or h:mm:ss).
static func format_open_time(seconds: float) -> String:
	var total := JsMath.js_max(0.0, floor(seconds))
	var h: float = floor(total / 3600.0)
	var m: float = floor(fmod(total, 3600.0) / 60.0)
	var s := JsMath.number_to_string(fmod(total, 60.0)).lpad(2, "0")
	if h > 0.0:
		return "%s:%s:%s" % [JsMath.number_to_string(h), JsMath.number_to_string(m).lpad(2, "0"), s]
	return "%s:%s" % [JsMath.number_to_string(m), s]
