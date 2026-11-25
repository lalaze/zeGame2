class_name CoreKitchen
extends RefCounted

## Port of src/game/kitchen.ts: the back-of-house room where cooks bake while the shop is open.

static var KITCHEN_COST: float = RulesData.section("kitchen")["KITCHEN_COST"]
static var MAX_COOKS: float = RulesData.section("kitchen")["MAX_COOKS"]
static var BASE_EQUIPMENT: Array = RulesData.section("kitchen")["BASE_EQUIPMENT"]
static var WALL_EQUIPMENT: Dictionary = RulesData.section("kitchen")["WALL_EQUIPMENT"]
static var HOOD: Dictionary = RulesData.section("kitchen")["HOOD"]
static var BENCH: Dictionary = RulesData.section("kitchen")["BENCH"]
static var SHEETER_X: float = RulesData.section("kitchen")["SHEETER_X"]
static var STAND_MIXER_X: float = RulesData.section("kitchen")["STAND_MIXER_X"]
static var RACK: Dictionary = RulesData.section("kitchen")["RACK"]
static var PASTRY_FRIDGE: Dictionary = RulesData.section("kitchen")["PASTRY_FRIDGE"]
static var BINS: Dictionary = RulesData.section("kitchen")["BINS"]
static var DISH_PIT: Dictionary = RulesData.section("kitchen")["DISH_PIT"]
static var STATION_SECONDS: Dictionary = RulesData.section("kitchen")["STATION_SECONDS"]
static var ZONES: Dictionary = RulesData.section("kitchen")["ZONES"]

## Where a cook stands at a piece of equipment: `dy` from its front edge at the fully expanded size.
static var _STATION_SPOTS: Dictionary = {
	"cooler": _at_wall(23.0), "dryStore": _at_wall(62.0), "mixer": _at_wall(116.0), "proofer": _at_wall(144.0), "kettle": _at_wall(173.0),
	"deckOven": _at_wall(218.0), "convection": _at_wall(264.0), "fryer": _at_wall(295.0),
	"bench": _at_bench(132.0), "sheeter": _at_bench(SHEETER_X + 10.0), "standMixer": _at_bench(STAND_MIXER_X + 6.0),
	"rack": {"x": RACK["x"] - 10.0, "foot": RACK["foot"], "dy": -2.0, "facing": "right"},
	"pastryFridge": {"x": PASTRY_FRIDGE["x"] + PASTRY_FRIDGE["w"] / 2.0, "foot": PASTRY_FRIDGE["foot"], "dy": 10.0, "facing": "up"},
}
## Where idle cooks wait: at the bench, washing up, and at the other end of the bench.
static var _HOMES: Array = [_at_bench(150.0), {"x": DISH_PIT["x"] + 30.0, "foot": DISH_PIT["foot"], "dy": 10.0, "facing": "up"}, _at_bench(110.0)]

const _METHODS := {
	"roll": ["mixer", "deckOven"], "bagel": ["mixer", "kettle", "deckOven"], "baguette": ["mixer", "deckOven"], "cheesebun": ["mixer", "proofer", "deckOven"],
	"pretzel": ["mixer", "kettle", "deckOven"], "focaccia": ["mixer", "deckOven"], "ciabatta": ["mixer", "deckOven"], "raisinbread": ["mixer", "proofer", "deckOven"],
	"sourdough": ["mixer", "deckOven"], "rye": ["mixer", "deckOven"], "chocobread": ["mixer", "proofer", "deckOven"], "shokupan": ["mixer", "proofer", "deckOven"],
	"brioche": ["mixer", "proofer", "deckOven"], "fruitbrioche": ["mixer", "bench", "proofer", "deckOven"], "garlicbread": ["mixer", "deckOven"],
	"donut": ["bench", "proofer", "fryer"], "scone": ["bench", "convection"], "cookie": ["bench", "convection"], "croissant": ["sheeter", "proofer", "convection"],
	"painchoc": ["sheeter", "proofer", "convection"], "brownie": ["standMixer", "convection"], "cinnamon": ["bench", "proofer", "convection"], "muffin": ["standMixer", "convection"],
	"creampuff": ["standMixer", "convection"], "melonpan": ["mixer", "proofer", "convection"], "eggtart": ["bench", "convection"], "cake": ["standMixer", "convection"],
	"swissroll": ["standMixer", "convection"], "cheesecake": ["standMixer", "convection"], "macaron": ["standMixer", "convection"],
}
const _CHILLED := ["milk", "butter", "eggs", "cream", "fruit"]
## Bakes that set in the pastry fridge after cooling.
const _SET_IN_FRIDGE := ["cake", "cheesecake", "creampuff", "swissroll"]

## Routes only change with the kitchen's stage, the room's height and the style's pace.
static var _batch_seconds: Dictionary = {}


static func _at_wall(x: float) -> Dictionary:
	return {"x": x, "foot": CoreLayout.FLOOR_Y, "dy": 14.0, "facing": "up"}


## Behind the bench, facing into the room, with the worktop at their waist.
static func _at_bench(x: float) -> Dictionary:
	return {"x": x, "foot": BENCH["front"], "dy": -BENCH["depth"] - 6.0, "facing": "down"}


static func kitchen_block(state: Dictionary) -> Variant:
	if state["kitchen"]:
		return "owned"
	if state["phase"] != "prep":
		return "open"
	return "coins" if state["coins"] < KITCHEN_COST else null


## Builds the kitchen, which comes with its first cook.
static func unlock_kitchen(state: Dictionary) -> bool:
	if kitchen_block(state) != null:
		return false
	state["coins"] -= KITCHEN_COST
	state["kitchen"] = true
	CoreEconomy.fill_bake_plan(state)
	return true


## A spot in the kitchen at the current height, in building coordinates.
static func _place(spot: Dictionary) -> Dictionary:
	var o := CoreLayout.area_origin("kitchen")
	return {"x": o["x"] + spot["x"], "y": o["y"] + CoreLayout.kitchen_floor_y(spot["foot"]) + spot["dy"], "facing": spot["facing"]}


static func station_spot(station: String) -> Dictionary:
	# Deliveries end behind the counter beside the pickup pass.
	return {"x": 202.0, "y": CoreLayout.doorway_y("main", "left"), "facing": "down"} if station == "door" else _place(_STATION_SPOTS[station])


static func cook_home(i: float) -> Dictionary:
	return _place(_HOMES[int(i) % _HOMES.size()])


## Every stop a batch makes, from the cold room or dry store to the door.
static func batch_steps(item: String) -> Array:
	var chilled := false
	for part: Array in CoreEconomy.recipe(item):
		chilled = chilled or _CHILLED.has(part[0])
	var steps := ["cooler" if chilled else "dryStore"]
	steps.append_array(_METHODS.get(item, ["bench"]))
	steps.append("rack")
	if _SET_IN_FRIDGE.has(item):
		steps.append("pastryFridge")
	steps.append("door")
	return steps


## The equipment this café's unlocked dishes call for, plus the basics.
static func installed_equipment(state: Dictionary) -> Array:
	if not state["kitchen"]:
		return []
	var out := BASE_EQUIPMENT.duplicate(false)
	for m: Dictionary in CoreEconomy.unlocked_items(state):
		if not CoreEconomy.is_bakery(m["id"]):
			continue
		for s: String in batch_steps(m["id"]):
			if s != "door" and not out.has(s):
				out.append(s)
	return out


## Includes station work and the actual aisle route at the current room size.
static func batch_seconds(item: String, state: Variant = null) -> float:
	var pace := CoreStyles.style_station_multiplier(state)
	var key := "%s %s %s %s" % [item, CoreLayout.kitchen_level(), CoreLayout.scene_height(), pace]
	if not _batch_seconds.has(key):
		_batch_seconds[key] = _measure_batch(item, pace)
	return _batch_seconds[key]


static func _measure_batch(item: String, pace: float) -> float:
	var from := cook_home(0.0)
	var seconds := 0.0
	for station: String in batch_steps(item):
		for point: Dictionary in kitchen_path(from, station_spot(station)):
			seconds += JsMath.js_hypot2(point["x"] - from["x"], point["y"] - from["y"]) / 62.0
			from = point
		seconds += STATION_SECONDS[station] * pace
	for point: Dictionary in kitchen_path(from, cook_home(0.0)):
		seconds += JsMath.js_hypot2(point["x"] - from["x"], point["y"] - from["y"]) / 62.0
		from = point
	return seconds


## Portions per batch at this kitchen's stage.
static func cook_batch(state: Dictionary) -> float:
	return CoreData.COOK_BATCHES[int(maxf(0.0, minf(CoreData.COOK_BATCHES.size() - 1.0, state["upgrades"]["cook"])))]


## One shared estimate for the morning shelf, reorder level and kitchen workload. While the cooks can keep up, the
## morning bake only bridges until the first fresh batch; otherwise it covers the forecast in full.
## Every idle cook asks every step, so the last answer is kept. Read-only for callers.
static var _plan_key: Array = []
static var _plan: Dictionary = {}


static func bakery_plan(state: Dictionary) -> Dictionary:
	var forecast := CoreEconomy._forecast(state)
	var customers := CoreEconomy._customers(state, forecast)
	var key := [forecast["version"], customers, CoreLayout.kitchen_level(), CoreLayout.scene_height(), CoreStyles.style_station_multiplier(state), CoreEconomy.cook_count(state), cook_batch(state), state["kitchen"]]
	if key != _plan_key:
		_plan_key = key
		_plan = _make_plan(state, CoreEconomy._demand(customers, forecast))
	return _plan


static func _make_plan(state: Dictionary, demand: Dictionary) -> Dictionary:
	var dishes := []
	for m: Dictionary in CoreEconomy.menu_items(state):
		if CoreEconomy.is_bakery(m["id"]):
			dishes.append(m["id"])
	if dishes.is_empty():
		return {}
	var cooks := maxf(1.0, CoreEconomy.cook_count(state))
	var batch := cook_batch(state)
	var seconds := {}
	var cycle := 0.0
	var load := 0.0
	for id: String in dishes:
		seconds[id] = batch_seconds(id, state)
		cycle += seconds[id]
		load += demand.get(id, 0.0) / CoreData.DAY_SECONDS * seconds[id] / batch
	cycle /= cooks
	load /= cooks
	var out := {}
	for id: String in dishes:
		var forecast: float = demand.get(id, 0.0)
		var rate := forecast / CoreData.DAY_SECONDS
		var lead := JsMath.js_max(seconds[id], cycle)
		# At most a forecast's worth; slow-selling dishes need only one spare serving.
		var trigger := JsMath.js_min(ceil(forecast), JsMath.js_max(1.0, ceil(rate * lead) + 1.0))
		out[id] = {"rate": rate, "lead": lead, "trigger": trigger, "morning": JsMath.js_max(trigger, ceil(forecast)) if state["kitchen"] and load > 1.0 else trigger}
	return out


static func kitchen_load(state: Dictionary) -> float:
	if not state["kitchen"]:
		return 0.0
	var sum := 0.0
	var plan := bakery_plan(state)
	for id: String in plan:
		sum += plan[id]["rate"] * batch_seconds(id, state) / cook_batch(state)
	return sum / CoreEconomy.cook_count(state)


static func next_batch(state: Dictionary, baking: Array) -> Variant:
	if not state["kitchen"] or state["phase"] != "open":
		return null
	var remaining: float = CoreData.DAY_SECONDS - state["dayTime"]
	var best: Variant = null
	var plans := bakery_plan(state)
	for item: String in plans:
		if baking.has(item):
			continue
		var plan: Dictionary = plans[item]
		var left: float = state["shelf"].get(item, 0.0)
		if left > plan["trigger"]:
			continue
		# This batch's own route decides the closing cutoff.
		var lead := batch_seconds(item, state)
		if remaining <= lead:
			continue
		# Existing servings sell while the cook works.
		var shelf_at_delivery: float = JsMath.js_max(0.0, left - plan["rate"] * lead) + state["inProduction"].get(item, 0.0)
		var needed: float = ceil(plan["rate"] * (remaining - lead) - shelf_at_delivery)
		# A small demand-variation reserve rather than exactly the mean.
		var reserve: float = ceil(1.65 * sqrt(plan["rate"] * remaining))
		var n := JsMath.js_min(JsMath.js_min(cook_batch(state), CoreEconomy.servings_left(state, item)), needed + reserve if needed > 0.0 else 0.0)
		var urgency: float = left / JsMath.js_max(plan["rate"], 0.001) - plan["lead"]
		if n >= 1.0 and (best == null or urgency < best["urgency"]):
			best = {"item": item, "n": n, "urgency": urgency}
	return {"item": best["item"], "n": best["n"]} if best != null else null


## A cook takes the ingredients for a batch out of the pantry.
static func start_batch(state: Dictionary, item: String, n: float) -> void:
	if not state["kitchen"] or state["phase"] != "open" or not CoreEconomy.is_bakery(item) or not CoreEconomy._on(CoreEconomy.menu_items(state), item) or not JsMath.is_integer(n) or n <= 0.0 or n > CoreEconomy.servings_left(state, item):
		return
	state["inProduction"][item] = state["inProduction"].get(item, 0.0) + n
	for part: Array in CoreEconomy.recipe(item):
		state["pantry"][part[0]] -= part[1] * n
	state["today"]["ingredientCost"] += CoreEconomy.serving_cost(item) * n


## A finished batch goes into the pastry case.
static func shelve_batch(state: Dictionary, item: String, n: float) -> void:
	if not state["kitchen"] or state["phase"] == "prep" or not CoreEconomy.is_bakery(item) or state["items"][item] <= 0.0 or not JsMath.is_integer(n) or n <= 0.0 or n > state["inProduction"].get(item, 0.0):
		return
	state["inProduction"][item] = state["inProduction"].get(item, 0.0) - n
	state["shelf"][item] = state["shelf"].get(item, 0.0) + n
	state["today"]["baked"][item] = state["today"]["baked"].get(item, 0.0) + n


# ---------------------------------------------------------------- getting around

## Physical floor footprints, shared by all cook routes.
static func kitchen_obstacles() -> Array:
	var o := CoreLayout.area_origin("kitchen")
	var out := []
	for r: Array in [
		[0.0, 0.0, 320.0, CoreLayout.FLOOR_Y + 4.0],
		[BENCH["x"], CoreLayout.kitchen_floor_y(BENCH["front"]) - BENCH["depth"], BENCH["w"], BENCH["depth"]],
		[RACK["x"], CoreLayout.kitchen_floor_y(RACK["foot"]) - 8.0, RACK["w"], 8.0],
		[PASTRY_FRIDGE["x"], CoreLayout.kitchen_floor_y(PASTRY_FRIDGE["foot"]) - 8.0, PASTRY_FRIDGE["w"], 8.0],
		[BINS["x"], CoreLayout.kitchen_floor_y(BINS["foot"]) - 7.0, BINS["w"], 7.0],
		[DISH_PIT["x"], CoreLayout.kitchen_floor_y(DISH_PIT["foot"]) - 10.0, DISH_PIT["w"] + 10.0, 10.0],
	]:
		out.append({"x": o["x"] + r[0], "y": o["y"] + r[1], "w": r[2], "h": r[3]})
	return out


## Route within real kitchen walls, round every floor fixture, then through the shared staff door and along the
## clear aisle behind the café counter. Null where TypeScript throws: no clear route, or off the staff aisle.
static func kitchen_path(from: Dictionary, to: Dictionary) -> Variant:
	var o := CoreLayout.area_origin("kitchen")
	var y: float = o["y"] + CoreLayout.doorway_y("kitchen", "right")
	var inside := {"x": -12.0, "y": y}
	var outside := {"x": 12.0, "y": y}
	if from["x"] < 0.0 and to["x"] < 0.0:
		return _route_from_kitchen(o, from, to, inside)
	if not from["x"] < 0.0 and not to["x"] < 0.0:
		return _main_route(from, to, y)
	if from["x"] < 0.0:
		var approach: Variant = [] if from["x"] > inside["x"] and absf(from["y"] - y) < 0.001 else _local_route(o, from, inside)
		return _join([approach, [outside], _main_route(outside, to, y)])
	return _join([_main_route(from, outside, y), [inside], _local_route(o, inside, to)])


static func _join(parts: Array) -> Variant:
	var out := []
	for part: Variant in parts:
		if part == null:
			return null
		out.append_array(part)
	return out


static func _local_route(o: Dictionary, a: Dictionary, b: Dictionary) -> Variant:
	return CoreNavigation.route_floor_segment(a, b, kitchen_obstacles(), {
		"bounds": {"x": o["x"] + 5.0, "y": o["y"] + CoreLayout.FLOOR_Y, "w": 310.0, "h": CoreLayout.kitchen_height() - CoreLayout.FLOOR_Y - 8.0},
		"clearance": 3.0,
	})


## Cook positions in main are exclusively on this staff-only service lane.
static func _main_route(a: Dictionary, b: Dictionary, y: float) -> Variant:
	if absf(a["y"] - y) > 0.001 or absf(b["y"] - y) > 0.001:
		return null
	return [] if a["x"] == b["x"] else [{"x": b["x"], "y": b["y"]}]


## A close/resume can replan a cook while its feet straddle the door threshold.
static func _route_from_kitchen(o: Dictionary, a: Dictionary, b: Dictionary, inside: Dictionary) -> Variant:
	if a["x"] > inside["x"] and absf(a["y"] - inside["y"]) < 0.001:
		return _join([[inside], _local_route(o, inside, b)])
	return _local_route(o, a, b)
