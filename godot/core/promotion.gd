class_name CorePromotion
extends RefCounted

## Port of src/game/promotion.ts

static var PROMOTION_PLANS: Array = RulesData.section("promotion")["PROMOTION_PLANS"]


static func promotion_plan(id: Variant) -> Variant:
	for plan: Dictionary in PROMOTION_PLANS:
		if id is String and plan["id"] == id:
			return plan
	return JsUtil.UNDEFINED


## Also used in preparation forecasts; open time alone consumes the booking.
static func promotion_traffic(state: Dictionary) -> float:
	var campaign: Variant = state["promotion"]
	return 1.0 + promotion_plan(campaign["id"])["boost"] if campaign is Dictionary and not campaign["paused"] and campaign["remaining"] > 0.0 else 1.0


static func book_promotion(state: Dictionary, id: String) -> bool:
	var plan: Variant = promotion_plan(id)
	if not plan is Dictionary or state["promotion"] is Dictionary or state["phase"] == "closing" or state["coins"] < plan["cost"] or CoreEconomy.menu_items(state).is_empty():
		return false
	state["coins"] -= plan["cost"]
	state["promotion"] = {"id": plan["id"], "remaining": plan["seconds"], "paused": false}
	return true


static func toggle_promotion(state: Dictionary) -> bool:
	if not state["promotion"] is Dictionary:
		return false
	state["promotion"]["paused"] = not state["promotion"]["paused"]
	return true


## Charge cash once on booking, then expense the prepaid airtime as delivered.
static func update_promotion(state: Dictionary, dt: float) -> void:
	var campaign: Variant = state["promotion"]
	if not campaign is Dictionary or campaign["paused"] or state["phase"] != "open" or not is_finite(dt) or dt <= 0.0:
		return
	var plan: Dictionary = promotion_plan(campaign["id"])
	var used := JsMath.js_min(dt, campaign["remaining"])
	state["today"]["promotionCost"] += used / plan["seconds"] * plan["cost"]
	campaign["remaining"] = JsMath.js_max(0.0, campaign["remaining"] - used)
	if campaign["remaining"] < 1e-8:
		state["promotion"] = null


static func parse_promotion(value: Variant) -> Variant:
	var raw: Variant = JsUtil.as_object(value)
	if raw == null:
		return null
	var plan: Variant = promotion_plan(JsUtil.prop(raw, "id"))
	var remaining: Variant = JsUtil.prop(raw, "remaining")
	if not plan is Dictionary or not JsMath.is_finite_num(remaining) or remaining <= 0.0:
		return null
	var paused: Variant = JsUtil.prop(raw, "paused")
	return {"id": plan["id"], "remaining": JsMath.js_min(plan["seconds"], remaining), "paused": not (paused is bool and not paused)}
