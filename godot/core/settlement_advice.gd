class_name CoreSettlementAdvice
extends RefCounted

## Port of src/game/settlement-advice.ts: read-only guidance after a day.

const _EPSILON := 1e-6


static func _cost_of(counts: Dictionary, drinks_only: bool = false) -> float:
	var sum := 0.0
	for id: String in counts:
		if not (drinks_only and CoreEconomy.is_bakery(id)):
			sum += CoreEconomy.serving_cost(id) * counts[id]
	return sum


static func settlement_advice(report: Dictionary, state: Dictionary) -> Dictionary:
	var total_cost: float = report["ingredientCost"] + report["petCost"] + report["promotionCost"]
	var unrecovered := JsMath.js_max(0.0, report["ingredientCost"] - _cost_of(report["sales"]) - report["staleCost"])
	var stale_count := 0.0
	for id: String in report["stale"]:
		stale_count += report["stale"][id]
	var cancelled: float = report["reviews"]["reasons"].get("cancelled", 0.0)
	var on_menu := CoreEconomy.menu_items(state)
	# Attribute the ledger's remainder to unfinished baking only when unpaid drinks cannot explain it.
	var any_bakery := false
	var all_bakery := true
	for m: Dictionary in on_menu:
		var bakery := CoreEconomy.is_bakery(m["id"])
		any_bakery = any_bakery or bakery
		all_bakery = all_bakery and bakery
	var no_unpaid_drinks: bool = all_bakery or (cancelled == 0.0 and report["tableLost"] == 0.0)
	var unfinished: float = JsMath.js_max(0.0, report["ingredientCost"] - _cost_of(report["baked"]) - _cost_of(report["sales"], true)) if state["kitchen"] and any_bakery and no_unpaid_drinks else 0.0
	var loss: bool = report["profit"] < -_EPSILON
	var reasons := []
	if loss:
		reasons.append({"kind": "loss", "amount": -report["profit"]})
	if report["soldOut"] != 0.0 or report["extraLost"] != 0.0:
		reasons.append({"kind": "stock", "count": report["soldOut"], "extra": report["extraLost"]})
	elif not report["outOfStock"].is_empty():
		reasons.append({"kind": "lowStock", "count": float(report["outOfStock"].size())})
	if report["queueLost"] != 0.0 or report["doorLost"] != 0.0:
		reasons.append({"kind": "counter", "count": report["queueLost"], "extra": report["doorLost"]})
	if report["tableLost"] != 0.0:
		reasons.append({"kind": "table", "count": report["tableLost"]})
	if stale_count != 0.0:
		reasons.append({"kind": "stale", "count": stale_count, "amount": report["staleCost"]})
	if loss:
		if report["promotionCost"] > _EPSILON:
			reasons.append({"kind": "promotion", "amount": report["promotionCost"]})
		if report["petCost"] > _EPSILON:
			reasons.append({"kind": "pets", "amount": report["petCost"]})
	if cancelled != 0.0:
		reasons.append({"kind": "unfinished", "count": cancelled})
	if unfinished > _EPSILON:
		reasons.append({"kind": "unfinishedBake", "amount": unfinished})
	if unrecovered > _EPSILON:
		reasons.append({"kind": "unrecovered", "amount": unrecovered})
	if reasons.is_empty():
		reasons.append({"kind": "healthy" if report["served"] != 0.0 else "empty"})

	var quote := CoreEconomy.restock_quote(state)
	var goal: Variant = CoreGoals.current_goal(state)
	var claimable: Variant = {"id": goal["id"], "reward": goal["reward"]} if goal != null and CoreGoals.goal_done(state) else null
	return {
		"reasons": reasons,
		"action": _next_action(report, state, {"onMenu": on_menu, "quote": quote, "goal": goal, "claimable": claimable, "cancelled": cancelled, "unfinished": unfinished, "stale": stale_count, "loss": loss, "unrecovered": unrecovered}),
		"ingredientReserve": quote["cost"], "totalCost": total_cost, "unrecoveredIngredientCost": unrecovered, "claimableGoal": claimable,
	}


static func _act(kind: String, tab: String, extra: Dictionary = {}) -> Dictionary:
	var out := {"kind": kind, "tab": tab, "cost": 0.0}
	for k: String in extra:
		out[k] = extra[k]
	return out


static func _next_action(report: Dictionary, state: Dictionary, f: Dictionary) -> Dictionary:
	var on_menu: Array = f["onMenu"]
	var goal: Variant = f["goal"]
	var stocked := CoreEconomy.unlocked_items(state).filter(func(m: Dictionary) -> bool:
		return CoreEconomy.can_prepare_item(state, m["id"]) and CoreEconomy.servings_left(state, m["id"]) > 0.0)
	JsUtil.stable_sort(stocked, func(a: Dictionary, b: Dictionary) -> float: return CoreEconomy.prep_time(state, a["id"]) - CoreEconomy.prep_time(state, b["id"]))
	if f["claimable"] != null:
		return _act("claimGoal", "menu", {"goal": f["claimable"]["id"], "reward": f["claimable"]["reward"]})
	var chapter: Variant = CoreMilestones.claimable_chapter(state)
	if chapter != null:
		return _act("claimChapter", "menu", {"goal": CoreMilestones.CHAPTERS[int(chapter)]["id"]})

	# Reproduce the existing affordable restock on a private pantry.
	if f["quote"]["cost"] > _EPSILON:
		var projected := state.duplicate(false)
		projected["pantry"] = state["pantry"].duplicate(false)
		if CoreEconomy.restock(projected):
			var ingredients := {}
			for id: String in state["pantry"]:
				var n: float = projected["pantry"][id] - state["pantry"][id]
				if n > 0.0:
					ingredients[id] = n
			return _act("restock", "pantry", {"cost": state["coins"] - projected["coins"], "ingredients": ingredients})
		if not stocked.is_empty():
			var available: Dictionary = stocked[0]
			for m: Dictionary in stocked:
				if CoreEconomy._on(on_menu, m["id"]):
					available = m
					break
			return _act("useStock" if CoreEconomy._on(on_menu, available["id"]) else "switchMenu", "menu", {"item": available["id"]})

	# An empty menu or exhausted unaffordable recipe can still have a free or cheaper route back to service.
	var sells := false
	for m: Dictionary in on_menu:
		sells = sells or CoreEconomy.servings_left(state, m["id"]) > 0.0
	if not sells:
		if not stocked.is_empty():
			return _act("switchMenu", "menu", {"item": stocked[0]["id"]})
		var affordable := []
		for m: Dictionary in CoreEconomy.unlocked_items(state):
			if not CoreEconomy.can_prepare_item(state, m["id"]):
				continue
			var cost := 0.0
			for part: Array in CoreEconomy.recipe(m["id"]):
				cost += JsMath.js_max(0.0, ceil(part[1] - state["pantry"][part[0]])) * CoreEconomy.ingredient_def(part[0])["cost"]
			if cost > 0.0 and cost <= state["coins"]:
				affordable.append({"id": m["id"], "cost": cost})
		JsUtil.stable_sort(affordable, func(a: Dictionary, b: Dictionary) -> float: return a["cost"] - b["cost"])
		if not affordable.is_empty():
			return _act("restartRecipe", "menu", {"cost": affordable[0]["cost"], "item": affordable[0]["id"]})
		if CoreRecovery.can_emergency_restock(state):
			return _act("emergency", "pantry")
		if goal != null and (goal["id"] == "firstDay" or goal["id"] == "days5"):
			return _act("dayGoal", "menu", {"goal": goal["id"], "reward": goal["reward"]})
		if goal != null and goal["id"] == "comfort":
			return _act("ownedDecor", "decor", {"reward": goal["reward"]})

	if f["cancelled"] != 0.0 or f["unfinished"] > _EPSILON:
		return _act("finishService", "menu")
	if f["stale"] != 0.0:
		# A dish that also ran short was baked at the wrong time, not too much.
		var item: Variant = null
		var mistimed: Variant = null
		for id: String in report["stale"]:
			if not state["onMenu"].has(id) or not CoreEconomy.is_bakery(id):
				continue
			var short: bool = report["shortages"].get(id, 0.0) > 0.0
			if item == null and not short and state["bakePlan"].get(id, 0.0) > 0.0:
				item = id
			if mistimed == null and short:
				mistimed = id
		if item == null and mistimed != null:
			return _act("reviewBake", "menu", {"item": mistimed})
		if item != null:
			return _act("reduceBake", "menu", {"item": item, "amount": JsMath.js_max(0.0, state["bakePlan"].get(item, 0.0) - JsMath.js_max(1.0, report["stale"].get(item, 0.0)))})
		for m: Dictionary in on_menu:
			if CoreEconomy.is_bakery(m["id"]):
				return _act("reviewBake", "menu", {"item": m["id"]})
		return _act("watchService", "menu")
	if f["loss"] and report["promotionCost"] > _EPSILON:
		var campaign: Variant = state["promotion"]
		return _act("pausePromotion" if campaign is Dictionary and not campaign["paused"] else "skipPromotion", "promotion" if campaign is Dictionary else "menu")
	if f["loss"] and report["petCost"] > _EPSILON:
		var refills := false
		for pet: Dictionary in state["pets"]:
			refills = refills or pet["autoRefill"]
		return _act("petRefill" if refills else "keepPetRefillOff", "pets")
	if report["soldOut"] != 0.0 or report["extraLost"] != 0.0:
		for m: Dictionary in on_menu:
			if CoreEconomy.is_bakery(m["id"]) and report["shortages"].get(m["id"], 0.0) > 0.0:
				return _act("reviewBake", "menu", {"item": m["id"]})
	# Table losses alone do not prove a shortage of servers: ask for the free observation first.
	if report["tableLost"] != 0.0:
		return _act("watchPass", "menu")
	if report["queueLost"] != 0.0 or report["doorLost"] != 0.0:
		for faster: Dictionary in stocked:
			for m: Dictionary in on_menu:
				if CoreEconomy.prep_time(state, m["id"]) > CoreEconomy.prep_time(state, faster["id"]):
					return _act("switchMenu", "menu", {"item": faster["id"]})
		for upgrade: String in ["machine", "barista"]:
			var q := CoreEconomy.quote_upgrade(state, upgrade, 1.0)
			if q["affordable"] and q["count"] > 0.0 and q["cost"] + f["quote"]["cost"] <= state["coins"]:
				return _act("upgrade", "upgrades", {"cost": q["cost"], "upgrade": upgrade})
		return _act("helpCounter", "menu")
	if f["unrecovered"] > _EPSILON:
		return _act("watchService", "menu")
	return _act("keepGoing", "menu")
