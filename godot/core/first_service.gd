class_name CoreFirstService
extends RefCounted

## Port of src/game/first-service.ts


## No migration: established cafés only see guidance when they explicitly request help.
static func is_first_cafe(state: Dictionary) -> bool:
	if state["profile"] is Dictionary or state["day"] != 1.0 or state["served"] != 0.0 or state["totalEarned"] != 0.0 or state["kitchen"] or not state["regions"].is_empty() or not state["pets"].is_empty():
		return false
	for id: String in state["items"]:
		if state["items"][id] != (1.0 if id == "espresso" else 0.0):
			return false
	return true


static func first_service_step(state: Dictionary, checked_stock: bool) -> String:
	if state["phase"] == "closing":
		return "closing"
	if state["day"] > 1.0:
		return "complete" if state["phase"] == "open" else "reopen"
	if state["phase"] == "prep":
		return "prepare" if checked_stock else "stock"
	if state["dayTime"] >= 45.0 or state["today"]["served"] >= 5.0:
		return "close"
	for m: Dictionary in CoreEconomy.menu_items(state):
		if CoreEconomy.ready_servings(state, m["id"]) < 1.0:
			return "close"
	return "observe"
