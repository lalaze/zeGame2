class_name CafeState
extends RefCounted

## Simplified B0 café state and economy rules, driven entirely by TS-exported JSON data.

var data: GameData
var coins: float = 0.0
var total_earned: float = 0.0
var served_total: int = 0
var day: int = 1
var day_time: float = 0.0
var phase: String = "prep" # "prep" | "open" | "closing"
var speed: int = 1
var kitchen: bool = false
var items: Dictionary = {} # item_id -> int level
var on_menu: Array[String] = []
var pantry: Dictionary = {} # ingredient_id -> int units
var today: Dictionary = {}
var last_report: Dictionary = {}
var locale: String = "zh"
var art_preset: String = "full" # "full" | "half"


func _init(game_data: GameData) -> void:
	data = game_data
	reset_to_starter()


func reset_to_starter() -> void:
	var s := data.starter_state
	coins = float(s.get("coins", 0.0))
	total_earned = 0.0
	served_total = 0
	day = int(s.get("day", 1))
	day_time = 0.0
	phase = "prep"
	speed = int(s.get("speed", 1))
	kitchen = bool(s.get("kitchen", false))
	items = {}
	for k in s.get("items", {}).keys():
		items[k] = int(s["items"][k])
	on_menu = []
	for id in s.get("onMenu", []):
		on_menu.append(str(id))
	pantry = {}
	for k in s.get("pantry", {}).keys():
		pantry[k] = int(s["pantry"][k])
	today = empty_day()
	last_report = {}


static func empty_day() -> Dictionary:
	return {
		"served": 0,
		"missed": 0,
		"sold_out": 0,
		"queue_lost": 0,
		"table_lost": 0,
		"door_lost": 0,
		"revenue": 0.0,
		"ingredient_cost": 0.0,
		"sales": {},
	}


func can_prepare_item(item_id: String) -> bool:
	var def := data.menu_item(item_id)
	if def.is_empty():
		return false
	if bool(def.get("requiresKitchen", false)) and not kitchen:
		return false
	return true


func is_item_available(item_id: String) -> bool:
	if not can_prepare_item(item_id):
		return false
	if int(items.get(item_id, 0)) > 0:
		return true
	var prev := data.previous_in_category(item_id)
	if prev.is_empty():
		return true
	return int(items.get(prev["id"], 0)) > 0


func milestone_multiplier(level: int) -> float:
	var mult := 1.0
	var factor := data.req_float(data.constants, "milestoneMultiplierFactor")
	for m in data.price_milestones:
		if level >= m:
			mult *= factor
	return mult


func next_milestone(level: int) -> int:
	for m in data.price_milestones:
		if m > level:
			return m
	return -1


func item_price(item_id: String, level: int) -> float:
	if level <= 0:
		return 0.0
	var def := data.menu_item(item_id)
	if def.is_empty():
		return 0.0
	var nxt := next_milestone(level)
	var prev := 1
	for m in data.price_milestones:
		if m <= level:
			prev = m
	var progress := 0.0
	if nxt > 0:
		progress = float(level - prev) / float(nxt - prev)
	var slope := data.req_float(data.constants, "milestoneProgressSlope")
	return float(def["basePrice"]) * float(level) * milestone_multiplier(level) * (1.0 + slope * progress)


func bulk_cost(base: float, growth: float, level: int, n: int) -> float:
	if n <= 0:
		return 0.0
	if n == 1:
		return base * pow(growth, float(level))
	return (base * pow(growth, float(level)) * (pow(growth, float(n)) - 1.0)) / (growth - 1.0)


func item_levels_cost(item_id: String, level: int, n: int = 1) -> float:
	if n <= 0:
		return 0.0
	var def := data.menu_item(item_id)
	if def.is_empty():
		return 0.0
	var base_cost := float(def["baseCost"])
	var mult := data.req_float(data.constants, "levelCostMultiplier")
	var growth := data.req_float(data.constants, "itemCostGrowth")
	var level_up := base_cost * mult
	if level > 0:
		return bulk_cost(level_up, growth, level, n)
	return base_cost + bulk_cost(level_up, growth, 1, n - 1)


func quote_item(item_id: String, n: int = 1) -> Dictionary:
	var lv := int(items.get(item_id, 0))
	var cost := item_levels_cost(item_id, lv, n)
	var ok := is_item_available(item_id) and cost <= coins + 1e-9
	return {"count": n, "cost": cost, "affordable": ok}


func buy_item(item_id: String, n: int = 1) -> bool:
	var q := quote_item(item_id, n)
	if not bool(q["affordable"]):
		return false
	coins = maxf(0.0, coins - float(q["cost"]))
	items[item_id] = int(items.get(item_id, 0)) + n
	return true


func set_on_menu(item_id: String, on: bool) -> bool:
	if phase != "prep":
		return false
	if not can_prepare_item(item_id):
		return false
	var unlocked := int(items.get(item_id, 0)) > 0
	var idx := on_menu.find(item_id)
	if on and unlocked:
		if idx < 0:
			on_menu.append(item_id)
		_sort_on_menu()
		return true
	if not on:
		if idx >= 0:
			on_menu.remove_at(idx)
		return true
	return false


func _sort_on_menu() -> void:
	var ordered: Array[String] = []
	for m in data.menu_list:
		var id: String = m["id"]
		if on_menu.has(id):
			ordered.append(id)
	on_menu = ordered


func unlocked_items() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for m in data.menu_list:
		var id: String = m["id"]
		if int(items.get(id, 0)) > 0 and can_prepare_item(id):
			result.append(m)
	return result


func active_menu_items() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for m in data.menu_list:
		var id: String = m["id"]
		if int(items.get(id, 0)) > 0 and can_prepare_item(id) and on_menu.has(id):
			result.append(m)
	return result


func needed_ingredients() -> Array[Dictionary]:
	var used: Dictionary = {}
	for m in unlocked_items():
		var rec: Dictionary = m.get("recipe", {})
		for ing_id in rec.keys():
			used[str(ing_id)] = true
	var result: Array[Dictionary] = []
	for ing in data.ingredients_list:
		if used.has(str(ing["id"])):
			result.append(ing)
	return result


func serving_cost(item_id: String) -> float:
	var def := data.menu_item(item_id)
	if def.is_empty():
		return 0.0
	var rec: Dictionary = def.get("recipe", {})
	var total := 0.0
	for ing_id in rec.keys():
		var ing := data.ingredient(ing_id)
		total += float(ing.get("cost", 0.0)) * float(rec[ing_id])
	return total


func servings_left(item_id: String, pantry_override: Dictionary = {}) -> int:
	var def := data.menu_item(item_id)
	if def.is_empty():
		return 0
	var rec: Dictionary = def.get("recipe", {})
	if rec.is_empty():
		return 0
	var src := pantry if pantry_override.is_empty() else pantry_override
	var min_servings := -1
	for ing_id in rec.keys():
		var need := int(rec[ing_id])
		if need <= 0:
			continue
		var have := int(src.get(ing_id, 0))
		var avail := int(have / need)
		min_servings = avail if min_servings < 0 else mini(min_servings, avail)
	return maxi(0, min_servings)


func has_service_supply() -> bool:
	for m in active_menu_items():
		if servings_left(m["id"]) >= 1:
			return true
	return false


func consume_serving(item_id: String) -> bool:
	if not can_prepare_item(item_id) or int(items.get(item_id, 0)) <= 0:
		return false
	if servings_left(item_id) < 1:
		return false
	var def := data.menu_item(item_id)
	var rec: Dictionary = def.get("recipe", {})
	for ing_id in rec.keys():
		var need := int(rec[ing_id])
		pantry[ing_id] = maxi(0, int(pantry.get(ing_id, 0)) - need)
	today["ingredient_cost"] = float(today["ingredient_cost"]) + serving_cost(item_id)
	return true


func buy_ingredient(ing_id: String, count: int) -> bool:
	if count <= 0:
		return false
	var ing := data.ingredient(ing_id)
	if ing.is_empty():
		return false
	var cost := float(ing["cost"]) * float(count)
	if cost > coins + 1e-9:
		return false
	coins = maxf(0.0, coins - cost)
	pantry[ing_id] = int(pantry.get(ing_id, 0)) + count
	return true


func counter_capacity(menu: Array[Dictionary] = []) -> float:
	var list := active_menu_items() if menu.is_empty() else menu
	if list.is_empty():
		return 0.0
	var share := 1.0 / float(list.size())
	var prep := 0.0
	for m in list:
		prep += share * prep_time(str(m["id"]))
	var walk := data.req_float(data.constants, "counterWalkSeconds")
	return 1.0 / maxf(0.001, prep + walk)


func expected_customers(menu: Array[Dictionary] = []) -> int:
	var list := active_menu_items() if menu.is_empty() else menu
	if list.is_empty():
		return 0
	var cap := counter_capacity(list)
	var day_sec := data.req_float(data.constants, "daySeconds")
	return int(ceil(minf(arrival_rate(list), cap) * day_sec))


## Matches src/game/economy.ts `dayNeeds` for B0 drinks (plus fallback to unlocked drinks if on_menu is empty).
func day_needs() -> Dictionary:
	var list := active_menu_items()
	if list.is_empty():
		return {}
	var customers := expected_customers(list)
	var share := 1.0 / float(list.size())
	var buf := data.req_float(data.constants, "drinkDemandBuffer")
	var sigma := data.req_float(data.constants, "drinkMixSigma")
	var raw_needs: Dictionary = {}
	for m in list:
		var servings := float(customers) * share
		var amount := servings * buf + sigma * sqrt(servings * maxf(0.0, 1.0 - servings / maxf(1.0, float(customers))))
		var rec: Dictionary = m.get("recipe", {})
		for ing_id in rec.keys():
			raw_needs[ing_id] = float(raw_needs.get(ing_id, 0.0)) + amount * float(rec[ing_id])
	var needs: Dictionary = {}
	for ing_id in raw_needs.keys():
		needs[ing_id] = int(ceil(float(raw_needs[ing_id])))
	return needs


## Exact port of src/game/economy.ts `restockQuote`.
func restock_quote() -> Dictionary:
	var buy: Dictionary = {}
	var total_cost := 0.0
	var needs := day_needs()
	for ing in data.ingredients_list:
		var ing_id: String = ing["id"]
		if not needs.has(ing_id):
			continue
		var need := int(needs[ing_id])
		var have := int(pantry.get(ing_id, 0))
		var n := maxi(0, need - have)
		if n <= 0:
			continue
		buy[ing_id] = n
		total_cost += float(n) * float(ing["cost"])
	return {"buy": buy, "cost": total_cost}


## Exact port of src/game/economy.ts `restockPlan`:
## tops up forecast proportionally within cash, falling back to one complete
## cheapest recipe when cash is scarce so the player always has a sellable drink.
func restock_plan() -> Dictionary:
	var q := restock_quote()
	var q_buy: Dictionary = q["buy"]
	var q_cost := float(q["cost"])
	if q_cost <= 0.0 or coins <= 0.0:
		return {
			"buy": {},
			"cost": 0.0,
			"balance": coins,
			"missing": q_buy.duplicate(true),
			"missing_cost": q_cost,
			"quote_cost": q_cost,
		}
	var share := clampf(coins / q_cost, 0.0, 1.0)
	var buy_map: Dictionary = {}
	for ing_id in q_buy.keys():
		var cnt := int(floor(float(q_buy[ing_id]) * share))
		if cnt > 0:
			buy_map[ing_id] = cnt

	var projected := pantry.duplicate(true)
	for ing_id in buy_map.keys():
		projected[ing_id] = int(projected.get(ing_id, 0)) + int(buy_map[ing_id])

	var list := active_menu_items()
	var has_supply := false
	for m in list:
		if servings_left(str(m["id"]), projected) >= 1:
			has_supply = true
			break

	if not has_supply:
		var best_cost := INF
		var best_deficits: Dictionary = {}
		for m in list:
			var rec: Dictionary = m.get("recipe", {})
			var deficits: Dictionary = {}
			var r_cost := 0.0
			for ing_id in rec.keys():
				var need := int(rec[ing_id])
				var have := int(pantry.get(ing_id, 0))
				var d := maxi(0, need - have)
				if d > 0:
					deficits[ing_id] = d
					var ing := data.ingredient(str(ing_id))
					r_cost += float(ing.get("cost", 0.0)) * float(d)
			if r_cost > 0.0 and r_cost <= coins + 1e-9 and r_cost < best_cost:
				best_cost = r_cost
				best_deficits = deficits
		buy_map = best_deficits

	var cost := 0.0
	var planned: Dictionary = {}
	for ing_id in buy_map.keys():
		var cnt := int(buy_map[ing_id])
		if cnt <= 0:
			continue
		planned[ing_id] = cnt
		var ing := data.ingredient(str(ing_id))
		cost += float(ing.get("cost", 0.0)) * float(cnt)

	var missing: Dictionary = {}
	for ing_id in q_buy.keys():
		var rem := int(q_buy[ing_id]) - int(planned.get(ing_id, 0))
		if rem > 0:
			missing[ing_id] = rem

	return {
		"buy": planned,
		"cost": cost,
		"balance": maxf(0.0, coins - cost),
		"missing": missing,
		"missing_cost": maxf(0.0, q_cost - cost),
		"quote_cost": q_cost,
	}


## Executes the exact `restock_plan()` shown on the Restock button.
func restock() -> bool:
	var plan := restock_plan()
	var buy_map: Dictionary = plan["buy"]
	var bought := false
	for ing_id in buy_map.keys():
		var cnt := int(buy_map[ing_id])
		if cnt > 0 and buy_ingredient(str(ing_id), cnt):
			bought = true
	return bought


func sale_price(item_id: String, vip: bool = false) -> float:
	if not can_prepare_item(item_id):
		return 0.0
	var base := item_price(item_id, int(items.get(item_id, 0)))
	var mult := data.req_float(data.constants, "vipMultiplier") if vip else 1.0
	return base * mult


func prep_time(item_id: String) -> float:
	var def := data.menu_item(item_id)
	return float(def["prepTime"])


func arrival_rate(menu: Array[Dictionary] = []) -> float:
	var list := active_menu_items() if menu.is_empty() else menu
	if list.is_empty():
		return 0.0
	var base := data.req_float(data.constants, "baseArrivalRate")
	var v_bonus := data.req_float(data.constants, "varietyBonus")
	var max_v := data.req_float(data.constants, "maxVarietyBonus")
	var variety := 1.0 + minf(max_v, v_bonus * float(maxi(0, list.size() - 1)))
	return base * variety


func earn(amount: float) -> void:
	coins += amount
	total_earned += amount


func open_shop() -> bool:
	if phase != "prep":
		return false
	if active_menu_items().is_empty():
		return false
	day_time = 0.0
	today = empty_day()
	phase = "open"
	return true


func finish_day() -> Dictionary:
	var best_seller := ""
	var best_count := 0
	var sales: Dictionary = today["sales"]
	for item_id in sales.keys():
		var cnt := int(sales[item_id])
		if cnt > best_count:
			best_count = cnt
			best_seller = str(item_id)
	var out_of_stock: Array[String] = []
	for m in active_menu_items():
		if servings_left(m["id"]) < 1:
			out_of_stock.append(m["id"])
	var revenue := float(today["revenue"])
	var ing_cost := float(today["ingredient_cost"])
	var report := {
		"day": day,
		"duration": day_time,
		"served": int(today["served"]),
		"missed": int(today["missed"]),
		"sold_out": int(today["sold_out"]),
		"queue_lost": int(today["queue_lost"]),
		"table_lost": int(today["table_lost"]),
		"door_lost": int(today["door_lost"]),
		"revenue": revenue,
		"ingredient_cost": ing_cost,
		"profit": revenue - ing_cost,
		"sales": sales.duplicate(true),
		"best_seller": best_seller,
		"best_count": best_count,
		"out_of_stock": out_of_stock,
	}
	last_report = report
	phase = "prep"
	day += 1
	day_time = 0.0
	today = empty_day()
	return report
