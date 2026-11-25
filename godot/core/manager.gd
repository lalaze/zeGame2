class_name CoreManager
extends RefCounted

## Port of src/game/manager.ts: the shop manager, away pay and the till.

static var MANAGER_COST: float = RulesData.section("manager")["MANAGER_COST"]
static var MANAGER_UNLOCK_DAY: float = RulesData.section("manager")["MANAGER_UNLOCK_DAY"]
static var AWAY_DAYS_PER_HOUR: float = RulesData.section("manager")["AWAY_DAYS_PER_HOUR"]
static var TILL_HOURS: Array = RulesData.section("manager")["TILL_HOURS"]
static var TILL_COSTS: Array = RulesData.section("manager")["TILL_COSTS"]
static var OVERFLOW_SHARE: float = RulesData.section("manager")["OVERFLOW_SHARE"]
static var OVERFLOW_MAX_SECONDS: float = RulesData.section("manager")["OVERFLOW_MAX_SECONDS"]
static var AWAY_MIN_SECONDS: float = RulesData.section("manager")["AWAY_MIN_SECONDS"]
static var WELCOME_MIN_SECONDS: float = RulesData.section("manager")["WELCOME_MIN_SECONDS"]
static var WELCOME_MIN: float = RulesData.section("manager")["WELCOME_MIN"]


static func empty_manager(now: float) -> Dictionary:
	return {"hired": false, "auto": true, "lastSeen": now, "till": 0.0, "welcomed": false}


static func parse_manager(value: Variant, now: float) -> Dictionary:
	var base := empty_manager(now)
	var m: Variant = JsUtil.as_object(value)
	if m == null:
		return base
	var hired: Variant = JsUtil.prop(m, "hired")
	var auto: Variant = JsUtil.prop(m, "auto")
	base["hired"] = hired is bool and hired
	base["auto"] = not (auto is bool and not auto)
	# A clock set back later must not pay twice, so a future timestamp counts from now.
	var seen: Variant = JsUtil.prop(m, "lastSeen")
	if JsMath.is_finite_num(seen) and seen > 0.0:
		base["lastSeen"] = JsMath.js_min(seen, now)
	var till: Variant = JsUtil.prop(m, "till")
	if JsMath.is_integer(till):
		base["till"] = JsMath.js_max(0.0, JsMath.js_min(TILL_HOURS.size() - 1.0, till))
	elif base["hired"]:
		# Before v24 a hired manager paid up to 8 hours: keep that.
		base["till"] = float(TILL_HOURS.find(8.0))
	var welcomed: Variant = JsUtil.prop(m, "welcomed")
	base["welcomed"] = welcomed if welcomed is bool else base["hired"]
	return base


## From day 3, or once the café has an extra room (older saves).
static func manager_unlocked(state: Dictionary) -> bool:
	return state["day"] >= MANAGER_UNLOCK_DAY or state["regions"].size() > 0


static func hire_manager(state: Dictionary) -> bool:
	if state["manager"]["hired"] or not manager_unlocked(state) or state["coins"] < MANAGER_COST:
		return false
	state["coins"] -= MANAGER_COST
	state["manager"]["hired"] = true
	state["manager"]["auto"] = true
	return true


static func manager_runs_days(state: Dictionary) -> bool:
	return state["manager"]["hired"] and state["manager"]["auto"]


## What a full ordinary day on today's menu is expected to earn, after ingredients.
static func expected_day_profit(state: Dictionary) -> float:
	var profit := 0.0
	var demand := CoreEconomy.day_demand(state)
	for id: String in demand:
		profit += demand[id] * (CoreEconomy.sale_price(state, id) - CoreEconomy.serving_cost(id))
	return JsMath.js_max(0.0, profit)


## What an hour away earns with the current menu, while the till has room.
static func away_hourly(state: Dictionary) -> float:
	return (expected_day_profit(state) * AWAY_DAYS_PER_HOUR * (CoreChainBonuses.PERK_AWAY_SHARE if CoreChainBonuses.has_perk(state, "manager") else 1.0)
		* (1.1 if CoreRoomProjects.has_blueprint(state, "ledger") else 1.0))


## Seconds of away pay the till holds now.
static func till_seconds(state: Dictionary) -> float:
	var level := int(maxf(0.0, minf(TILL_HOURS.size() - 1.0, state["manager"]["till"])))
	return (TILL_HOURS[level] + CoreChainBonuses.extra_till_hours(state)) * 3600.0


## What the next till costs, or null at the biggest.
static func till_upgrade_cost(state: Dictionary) -> Variant:
	var till := int(state["manager"]["till"])
	return TILL_COSTS[till] if till >= 0 and till < TILL_COSTS.size() else null


static func upgrade_till(state: Dictionary) -> bool:
	var cost: Variant = till_upgrade_cost(state)
	if not state["manager"]["hired"] or cost == null or state["coins"] < cost:
		return false
	state["coins"] -= cost
	state["manager"]["till"] += 1.0
	return true


## Seconds of pay for `elapsed` seconds into a till holding `capacity`: full rate, then a trickle.
static func paid_seconds(elapsed: float, capacity: float) -> float:
	return JsMath.js_min(elapsed, capacity) + OVERFLOW_SHARE * JsMath.js_min(JsMath.js_max(0.0, elapsed - capacity), OVERFLOW_MAX_SECONDS)


## What the manager put in the till between the last time the player looked and now.
static func away_earnings(state: Dictionary, now: float) -> Dictionary:
	var away := JsMath.js_max(0.0, (now - state["manager"]["lastSeen"]) / 1000.0)
	if not state["manager"]["hired"] or away < AWAY_MIN_SECONDS:
		return {"seconds": 0.0, "fill": 0.0, "full": false, "amount": 0.0, "welcome": 0.0}
	var capacity := till_seconds(state)
	var amount: float = floor(away_hourly(state) * paid_seconds(away, capacity) / 3600.0)
	var welcome := 0.0
	if not state["manager"]["welcomed"] and away >= WELCOME_MIN_SECONDS and amount < WELCOME_MIN:
		welcome = WELCOME_MIN - amount
		amount = WELCOME_MIN
	return {"seconds": away, "fill": JsMath.js_min(1.0, away / capacity), "full": away >= capacity, "amount": amount, "welcome": welcome}


## Empties the till and restarts the away clock.
static func collect_away_earnings(state: Dictionary, now: float) -> Dictionary:
	var result := away_earnings(state, now)
	if result["amount"] > 0.0:
		CoreEconomy.earn(state, result["amount"])
	if result["seconds"] >= WELCOME_MIN_SECONDS:
		state["manager"]["welcomed"] = true
	state["manager"]["lastSeen"] = now
	return result


## The manager's morning: bake for the forecast, stock what the budget allows, then open.
static func manager_open(state: Dictionary) -> Dictionary:
	if state["phase"] != "prep" or CoreEconomy.menu_items(state).is_empty():
		return {"ok": false, "reason": "emptyMenu"}
	CoreEconomy.bake_for_forecast(state)
	CoreEconomy.restock(state)
	if not CoreEconomy.has_service_supply(state):
		return {"ok": false, "reason": "noSupply"}
	return {"ok": true, "baked": CoreDay.open_shop(state)}


## Sold out during the day: restock and keep serving if that brings anything back.
static func manager_restock(state: Dictionary) -> bool:
	if state["dayTime"] >= CoreData.DAY_SECONDS:
		return false
	return CoreEconomy.restock(state) and CoreEconomy.has_service_supply(state)
