class_name CoreOrders
extends RefCounted

## Port of src/game/orders.ts: the shop manager's catering orders.

static var ORDERS: Array = RulesData.section("orders")["ORDERS"]


static func order_def(id: Variant) -> Variant:
	for o: Dictionary in ORDERS:
		if id is String and o["id"] == id:
			return o
	return JsUtil.UNDEFINED


static func is_order_kind(id: Variant) -> bool:
	return order_def(id) is Dictionary


static func empty_orders() -> Dictionary:
	return {"active": null, "delivered": 0.0}


static func _is_item(id: Variant) -> bool:
	return id is String and (id.begins_with("sig:") or CoreData.find_menu(id) != null)


static func _amount(v: Variant) -> Variant:
	return v if JsMath.is_finite_num(v) and v >= 0.0 else null


static func parse_orders(value: Variant, now: float) -> Dictionary:
	var base := empty_orders()
	var o: Variant = JsUtil.as_object(value)
	if o == null:
		return base
	var delivered: Variant = _amount(JsUtil.prop(o, "delivered"))
	base["delivered"] = floor(delivered) if delivered != null else 0.0
	var a: Variant = JsUtil.as_object(JsUtil.prop(o, "active"))
	if a != null and is_order_kind(JsUtil.prop(a, "kind")) and _is_item(JsUtil.prop(a, "item")):
		var servings: Variant = _amount(JsUtil.prop(a, "servings"))
		var cost: Variant = _amount(JsUtil.prop(a, "cost"))
		var payout: Variant = _amount(JsUtil.prop(a, "payout"))
		var finish_at: Variant = JsUtil.prop(a, "finishAt")
		if servings != null and cost != null and payout != null and JsMath.is_finite_num(finish_at):
			# A clock set back can't stretch an order beyond its own length.
			var finish := JsMath.js_min(finish_at, now + order_def(a["kind"])["hours"] * 3600000.0)
			base["active"] = {"kind": a["kind"], "item": a["item"], "servings": floor(servings), "cost": cost, "payout": payout, "finishAt": finish}
	return base


## The dish today's guests order most, as long as it earns something over its ingredients.
static func _order_dish(state: Dictionary) -> Variant:
	var best: Variant = null
	var most := 0.0
	var demand := CoreEconomy.day_demand(state)
	for id: String in demand:
		if demand[id] > most and CoreEconomy.sale_price(state, id) > CoreEconomy.serving_cost(id):
			best = id
			most = demand[id]
	return best


## What taking an order of this kind would mean now, or null without a manager or a menu that sells.
static func quote_order(state: Dictionary, kind: String) -> Variant:
	if not state["manager"]["hired"]:
		return null
	var item: Variant = _order_dish(state)
	if item == null:
		return null
	var def: Dictionary = order_def(kind)
	var price := CoreEconomy.sale_price(state, item)
	var unit_cost := CoreEconomy.serving_cost(item)
	var profit: float = CoreManager.away_hourly(state) * def["hours"] * def["rate"] * (CoreChainBonuses.PERK_CATERING_SHARE if CoreChainBonuses.has_perk(state, "catering") else 1.0)
	var servings := JsMath.js_max(1.0, JsMath.js_round(profit / (price - unit_cost)))
	return {"kind": kind, "item": item, "servings": servings, "cost": ceil(servings * unit_cost), "payout": JsMath.js_round(servings * price)}


static func order_block(state: Dictionary, kind: String) -> Variant:
	if state["orders"]["active"] is Dictionary:
		return "busy"
	if not state["manager"]["hired"]:
		return "noManager"
	var q: Variant = quote_order(state, kind)
	if q == null:
		return "noMenu"
	return "coins" if state["coins"] < q["cost"] else null


## Takes an order: pays its ingredients now and delivers it once its time has passed.
static func start_order(state: Dictionary, kind: String, now: float) -> Variant:
	if order_block(state, kind) != null:
		return null
	var q: Dictionary = quote_order(state, kind)
	state["coins"] -= q["cost"]
	q["finishAt"] = now + order_def(kind)["hours"] * 3600000.0
	state["orders"]["active"] = q
	return q


static func order_ready(state: Dictionary, now: float) -> bool:
	var active: Variant = state["orders"]["active"]
	return active is Dictionary and now >= active["finishAt"]


## Real seconds until the order is ready; 0 once it is.
static func order_left(state: Dictionary, now: float) -> float:
	var active: Variant = state["orders"]["active"]
	return JsMath.js_max(0.0, (active["finishAt"] - now) / 1000.0) if active is Dictionary else 0.0


## Delivers a finished order and pays for it.
static func collect_order(state: Dictionary, now: float) -> Variant:
	var order: Variant = state["orders"]["active"]
	if not order is Dictionary or now < order["finishAt"]:
		return null
	CoreEconomy.earn(state, order["payout"])
	state["orders"]["active"] = null
	state["orders"]["delivered"] += 1.0
	return order
