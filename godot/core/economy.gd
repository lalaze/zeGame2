class_name CoreEconomy
extends RefCounted

## Port of src/game/economy.ts. A TypeScript Map is a Dictionary here: both keep insertion order.

static var _MENU_BY_ID: Dictionary = _by_id(CoreData.MENU)
static var _UPGRADE_BY_ID: Dictionary = _by_id(CoreData.UPGRADES)
static var _INGREDIENT_BY_ID: Dictionary = _by_id(CoreData.INGREDIENTS)
static var _RECIPES: Dictionary = {}

## A server's round trip from the pass, by waypoints on the route from the main room: [route, seconds, plates].
const _SERVER_TRIPS := [[0.0, 5.8, 1.96], [4.0, 14.7, 2.01], [9.0, 21.4, 2.43], [13.0, 29.0, 2.61]]
const _DINE_IN_SHARE := 0.52
const _BASE_SEAT_CHANCE := 0.6
const _PASS_FLOW := [1.0, 1.3, 1.7]
const _SEAT_SECONDS := 55.0


static func _by_id(list: Array) -> Dictionary:
	var out := {}
	for x: Dictionary in list:
		out[x["id"]] = x
	return out


## Null for an id that is neither on the menu nor a valid custom recipe.
static func menu_item(id: Variant) -> Variant:
	return _MENU_BY_ID[id] if _MENU_BY_ID.has(id) else CoreSignatureDrinks.signature_definition(id)


## Ice-cream desserts need the kitchen despite their place on the drinks menu.
static func requires_kitchen(id: String) -> bool:
	return id == "affogato" or id == "matchafloat" or not CoreData.is_drink(menu_item(id)["category"])


static func can_prepare_item(state: Dictionary, id: String) -> bool:
	return state["kitchen"] or not requires_kitchen(id) or id == "roll" and JsUtil.prop(state["cafeStyle"], "bakeryTrialDay") is float and state["cafeStyle"]["bakeryTrialDay"] == state["day"]


static func upgrade_def(id: String) -> Variant:
	return _UPGRADE_BY_ID.get(id, JsUtil.UNDEFINED)


static func milestone_multiplier(level: float) -> float:
	var mult := 1.0
	for m: float in CoreData.PRICE_MILESTONES:
		if level >= m:
			mult *= 2.0
	return mult


static func next_milestone(level: float) -> Variant:
	for m: float in CoreData.PRICE_MILESTONES:
		if m > level:
			return m
	return null


static func item_price(def: Dictionary, level: float) -> float:
	if level <= 0.0:
		return 0.0
	var next: Variant = next_milestone(level)
	var previous := 1.0
	for m: float in CoreData.PRICE_MILESTONES:
		if m <= level:
			previous = m
	var progress: float = (level - previous) / (next - previous) if next != null else 0.0
	return def["basePrice"] * level * milestone_multiplier(level) * (1.0 + 0.8 * progress)


## Total cost of `n` purchases of something priced base * growth^level.
static func bulk_cost(base: float, growth: float, level: float, n: float) -> float:
	if n <= 0.0:
		return 0.0
	if n == 1.0:
		return base * JsMath.js_pow(growth, level)
	return (base * JsMath.js_pow(growth, level) * (JsMath.js_pow(growth, n) - 1.0)) / (growth - 1.0)


## Largest n (<= cap) such that bulk_cost(..., n) <= coins.
static func max_affordable(base: float, growth: float, level: float, coins: float, cap: float = INF) -> float:
	var first := base * JsMath.js_pow(growth, level)
	if coins < first or cap <= 0.0:
		return 0.0
	var n: float = floor(JsMath.js_log((coins * (growth - 1.0)) / first + 1.0) / JsMath.js_log(growth))
	n = JsMath.js_max(0.0, JsMath.js_min(n, cap))
	# Guard against floating point rounding at the boundary.
	while n > 0.0 and bulk_cost(base, growth, level, n) > coins:
		n -= 1.0
	return n


static func _quote(base: float, growth: float, level: float, coins: float, amount: Variant, cap: float) -> Dictionary:
	if cap <= 0.0:
		return {"count": 0.0, "cost": 0.0, "affordable": false}
	if amount is String:
		var n := max_affordable(base, growth, level, coins, cap)
		var most := JsMath.js_max(1.0, n)
		return {"count": most, "cost": bulk_cost(base, growth, level, most), "affordable": n > 0.0}
	var count := JsMath.js_min(amount, cap)
	var cost := bulk_cost(base, growth, level, count)
	return {"count": count, "cost": cost, "affordable": cost <= coins}


## The unlock at the dish's base cost, every level-up after it at LEVEL_COST_MULTIPLIER times that.
static func item_levels_cost(def: Dictionary, level: float, n: float) -> float:
	if n <= 0.0:
		return 0.0
	var level_up: float = def["baseCost"] * CoreData.LEVEL_COST_MULTIPLIER
	return bulk_cost(level_up, CoreData.ITEM_COST_GROWTH, level, n) if level > 0.0 else def["baseCost"] + bulk_cost(level_up, CoreData.ITEM_COST_GROWTH, 1.0, n - 1.0)


static func _item_quote(def: Dictionary, level: float, coins: float, amount: Variant) -> Dictionary:
	var level_up: float = def["baseCost"] * CoreData.LEVEL_COST_MULTIPLIER
	if level > 0.0:
		return _quote(level_up, CoreData.ITEM_COST_GROWTH, level, coins, amount, INF)
	# Unlocking first, then any further levels bought together with it.
	if not amount is String:
		var cost := item_levels_cost(def, 0.0, amount)
		return {"count": amount, "cost": cost, "affordable": cost <= coins}
	if coins < def["baseCost"]:
		return {"count": 1.0, "cost": def["baseCost"], "affordable": false}
	var more := max_affordable(level_up, CoreData.ITEM_COST_GROWTH, 1.0, coins - def["baseCost"])
	return {"count": 1.0 + more, "cost": item_levels_cost(def, 0.0, 1.0 + more), "affordable": true}


static func quote_item(state: Dictionary, id: String, amount: Variant) -> Dictionary:
	if id.begins_with("sig:"):
		return {"count": 0.0, "cost": 0.0, "affordable": false}
	var q := _item_quote(menu_item(id), state["items"][id], state["coins"], amount)
	if not is_item_available(state, id):
		q["affordable"] = false
	return q


## Cooks work in the kitchen, so there's no hiring them until it's built.
static func upgrade_locked(state: Dictionary, id: String) -> bool:
	return id == "cook" and not state["kitchen"]


## Servers are limited by the building: two hires to begin with and one more per opened room.
static func upgrade_max(state: Dictionary, id: String) -> float:
	var def: Dictionary = _UPGRADE_BY_ID[id]
	return JsMath.js_min(def["max"], 2.0 + JsMath.js_max(state["regions"].size(), CoreStreets.owned_plot_count(state))) if id == "server" else def["max"]


## Finished table orders the pass can hold before baristas have to keep hold of them.
static func pass_capacity(state: Dictionary) -> float:
	return CoreData.PASS_SLOTS * (1.0 + state["upgrades"].get("pass", 0.0))


static func quote_upgrade(state: Dictionary, id: String, amount: Variant) -> Dictionary:
	var def: Dictionary = _UPGRADE_BY_ID[id]
	var level: float = state["upgrades"][id]
	var q := _quote(def["baseCost"], def["growth"], level, state["coins"], amount, upgrade_max(state, id) - level)
	if upgrade_locked(state, id):
		q["affordable"] = false
	return q


## The item unlocked just before this one in its category, if any.
static func previous_in_category(id: String) -> Variant:
	var category: String = menu_item(id)["category"]
	var previous: Variant = null
	for m: Dictionary in CoreData.MENU:
		if m["category"] == category:
			if m["id"] == id:
				return previous
			previous = m
	return null


## Unlock after the preceding dish; owned dishes stay upgradeable as the menu grows.
static func is_item_available(state: Dictionary, id: String) -> bool:
	if id.begins_with("sig:") or not can_prepare_item(state, id):
		return false
	var prev: Variant = previous_in_category(id)
	return state["items"][id] > 0.0 or prev == null or state["items"][prev["id"]] > 0.0


static func buy_item(state: Dictionary, id: String, amount: Variant) -> bool:
	if not is_item_available(state, id):
		return false
	var q := quote_item(state, id, amount)
	if not q["affordable"]:
		return false
	state["coins"] -= q["cost"]
	# Unlocking expands the recipe book; it never changes today's menu by itself.
	state["items"][id] += q["count"]
	return true


static func buy_upgrade(state: Dictionary, id: String, amount: Variant) -> bool:
	var q := quote_upgrade(state, id, amount)
	if not q["affordable"] or q["count"] <= 0.0:
		return false
	state["coins"] -= q["cost"]
	state["upgrades"][id] += q["count"]
	return true


static func unlocked_items(state: Dictionary) -> Array:
	var out := []
	for m: Dictionary in CoreData.MENU:
		if state["items"][m["id"]] > 0.0:
			out.append(m)
	for r: Dictionary in state["signatureDrinks"]["recipes"]:
		var def: Variant = CoreSignatureDrinks.signature_definition(r["id"])
		if def != null:
			out.append(def)
	return out


static func barista_count(s: Dictionary) -> float:
	return 1.0 + s["upgrades"]["barista"]


## Servers carry orders from the pass to the tables; the café opens with one.
static func server_count(s: Dictionary) -> float:
	return 1.0 + s["upgrades"]["server"]


## The kitchen comes with one cook.
static func cook_count(s: Dictionary) -> float:
	return 1.0 + s["upgrades"]["cook"] if s["kitchen"] else 0.0


static func prep_multiplier(s: Dictionary) -> float:
	return JsMath.js_pow(0.9, s["upgrades"]["machine"])


## Extra customers drawn by a varied menu, as a share (0.12 = +12%).
static func variety_bonus(s: Dictionary) -> float:
	return JsMath.js_min(CoreData.MAX_VARIETY_BONUS, CoreData.VARIETY_BONUS * maxf(0.0, menu_items(s).size() - 1.0))


## Menu-driven arrivals, independent of stock, staff, promotion and reputation.
static func menu_traffic_multiplier(s: Dictionary, items: Variant = null) -> float:
	return CoreCustomerDemand.demand_plan(s, _or_menu(s, items))["traffic"]


static func _or_menu(s: Dictionary, items: Variant) -> Array:
	return items if items is Array else menu_items(s)


static func base_traffic_demand(s: Dictionary) -> float:
	var f := _forecast(s)
	return f["menuArrivals"] * CoreReputation.reputation_traffic(s["reputation"]) * CorePets.pet_traffic(s) * f["style"] * f["condition"]


static func traffic_demand(s: Dictionary) -> float:
	return base_traffic_demand(s) * CorePromotion.promotion_traffic(s)


static func arrival_cap(s: Dictionary, items: Variant = null) -> float:
	var capacity: float = service_capacity(s, items) if items is Array else _forecast(s)["capacity"]
	return JsMath.js_min(capacity * CoreData.ARRIVAL_CAPACITY_RATIO, CoreData.MAX_ARRIVAL_RATE)


static func is_traffic_capped(s: Dictionary) -> bool:
	var f := _forecast(s)
	if f["empty"]:
		return false
	var demand: float = f["menuArrivals"] * CoreReputation.reputation_traffic(s["reputation"]) * CorePets.pet_traffic(s) * f["style"] * f["condition"] * CorePromotion.promotion_traffic(s)
	return demand >= JsMath.js_min(f["capacity"] * CoreData.ARRIVAL_CAPACITY_RATIO, CoreData.MAX_ARRIVAL_RATE)


static func base_arrival_rate(s: Dictionary) -> float:
	return JsMath.js_min(base_traffic_demand(s), arrival_cap(s))


static func arrival_rate(s: Dictionary) -> float:
	return JsMath.js_min(traffic_demand(s), arrival_cap(s))


static func tip_multiplier(s: Dictionary) -> float:
	return 1.0 + CoreDecor.comfort(s) / 100.0


## Chain stars from earlier branches raise every price, permanently, unless spent on perks.
static func chain_multiplier(s: Dictionary) -> float:
	return 1.0 + CoreData.CHAIN_STAR_BONUS * CoreChainBonuses.stars_free(s)


## Everything the chain adds to one dish's price: unspent stars, the local specialty and franchise places.
static func chain_price_multiplier(s: Dictionary, id: String) -> float:
	return chain_multiplier(s) * CoreLocations.specialty_price_multiplier(s, id) * CoreChainBonuses.place_price_multiplier(s, menu_item(id)["category"], CoreFlavors.item_flavors(id))


## The café opens with a table in each nook; Expand the Shop adds the rest.
static func table_count(s: Dictionary) -> float:
	return CoreRegions.active_table_indices(s).size()


static func patience_seconds(s: Dictionary) -> float:
	return 40.0 + CoreDecor.comfort(s) / 5.0 + CoreConditions.condition_patience(s)


## How long a seated guest waits for their order to be brought over before giving up.
static func table_patience(s: Dictionary) -> float:
	return 50.0 + CoreDecor.comfort(s) / 4.0 + CoreStyles.style_table_patience_extra(s) + CoreConditions.condition_patience(s)


static func sale_price(state: Dictionary, id: String, vip: bool = false, dine_in: bool = false, meal: Variant = null) -> float:
	if not can_prepare_item(state, id):
		return 0.0
	return ((signature_price(state, id) if id.begins_with("sig:") else item_price(menu_item(id), state["items"][id])) * tip_multiplier(state) * chain_price_multiplier(state, id)
		* (CoreData.VIP_MULTIPLIER if vip else 1.0) * CoreStyles.style_sale_multiplier(state, id, dine_in, meal if meal is Array else [id]))


## Added doses or ingredients earn a 25% house premium; a plain copy retains its foundation's price.
static func signature_price(state: Dictionary, id: String) -> float:
	var def: Dictionary = CoreSignatureDrinks.signature_definition(id)
	var base: String = def["base"]
	var foundation: Dictionary = menu_item("espresso" if base == "coffee" else "blacktea")
	var level: float = state["items"][foundation["id"]]
	var established: float = item_price(foundation, level) if level > 0.0 else def["basePrice"] / 1.25
	if CoreSignatureDrinks.is_plain_signature_copy(def):
		return established
	var base_cost: float = ingredient_def("beans" if base == "coffee" else base)["cost"]
	return JsMath.js_max(def["basePrice"], established * 1.25 + JsMath.js_max(0.0, def["cost"] - base_cost) * 1.6)


static func prep_time(state: Dictionary, id: String) -> float:
	return menu_item(id)["prepTime"] * prep_multiplier(state) * CoreStyles.style_prep_multiplier(state, id)


## Expected main-dish takeaway price, weighted by today's demand. Locked dishes count as level 1.
static func average_dish_price(state: Dictionary, items: Variant = null) -> float:
	var list := _or_menu(state, items)
	if list.is_empty():
		return 0.0
	var sum := 0.0
	for choice: Dictionary in CoreCustomerDemand.demand_plan(state, list)["mains"]:
		var m: Dictionary = choice["main"]
		var id: String = m["id"]
		var price: float = ((signature_price(state, id) if id.begins_with("sig:") else item_price(m, JsMath.js_max(1.0, state["items"].get(id, 0.0))))
			* tip_multiplier(state) * chain_multiplier(state) * CoreLocations.specialty_price_multiplier(state, id) * CoreStyles.style_sale_multiplier(state, id, false, [id]))
		sum += price * choice["probability"]
	return sum


## Today's menu: unlocked items the player chose to sell.
static func menu_items(state: Dictionary) -> Array:
	var out := []
	var items: Dictionary = state["items"]
	var on_menu: Array = state["onMenu"]
	for m: Dictionary in CoreData.MENU:
		var id: String = m["id"]
		if items[id] > 0.0 and on_menu.has(id) and can_prepare_item(state, id):
			if id == "roll" and not state["kitchen"] and state["phase"] != "prep" and state["shelf"].get("roll", 0.0) < 1.0:
				continue
			out.append(m)
	for r: Dictionary in state["signatureDrinks"]["recipes"]:
		if r["onMenu"]:
			var def: Variant = CoreSignatureDrinks.signature_definition(r["id"])
			if def != null:
				out.append(def)
	return out


static func set_on_menu(state: Dictionary, id: String, on: bool) -> void:
	if id.begins_with("sig:"):
		CoreSignatureDrinks.set_signature_on_menu(state, id, on)
		return
	if state["phase"] != "prep" or not can_prepare_item(state, id):
		return
	var chosen := {}
	for x: String in state["onMenu"]:
		chosen[x] = true
	if on and state["items"][id] > 0.0:
		chosen[id] = true
	else:
		chosen.erase(id)
	var list := []
	for m: Dictionary in CoreData.MENU:
		if chosen.has(m["id"]):
			list.append(m["id"])
	state["onMenu"] = list
	if on and list.has(id) and JsUtil.prop(state.get("trialSales"), "selected") is String and state["trialSales"]["selected"] == id:
		state["trialSales"]["selected"] = null
	fill_bake_plan(state)


## A normal arrival may swap its one drink slot for a limited trial cup.
static func offer_trial_sale(state: Dictionary, order: String, extra: Variant, regular_id: Variant = JsUtil.UNDEFINED) -> Dictionary:
	var item: Variant = CoreTrialSales.trial_sale_item(state)
	var main_drink := CoreData.is_drink(menu_item(order)["category"])
	var extra_drink: bool = extra != null and CoreData.is_drink(menu_item(extra)["category"])
	if item == null or not main_drink and not extra_drink or not CoreTrialSales.trial_offer_due(state, regular_id):
		return {"order": order, "extra": extra}
	if ready_servings(state, item) <= state["trialSales"]["active"]["reserved"] or not CoreTrialSales.reserve_trial_sale(state, regular_id):
		return {"order": order, "extra": extra}
	return {"order": item if main_drink else order, "extra": extra if main_drink else item, "trialSale": "reserved"}


## Promoting uses the ordinary menu API, including the three-custom-drink limit.
static func promote_trial_sale(state: Dictionary) -> bool:
	var last: Variant = state["trialSales"]["last"]
	var item: Variant = last["item"] if last is Dictionary else null
	if state["phase"] != "prep" or item == null or not CoreTrialSales.can_trial_drink(state, item):
		return false
	set_on_menu(state, item, true)
	return _on(menu_items(state), item)


static func _on(list: Array, id: String) -> bool:
	for m: Dictionary in list:
		if m["id"] == id:
			return true
	return false


## Breads and pastries are baked in the morning; drinks are made to order.
static func is_bakery(id: String) -> bool:
	return not CoreData.is_drink(menu_item(id)["category"])


## One model shared by arriving guests, ingredient forecasts and service capacity. State may be undefined.
## It costs a lot and changes rarely, so the last answer is kept. Read-only for callers.
static var _choices_key := PackedByteArray()
static var _choices: Array = []


static func order_choices(items: Array, state: Variant = null) -> Array:
	var ids := []
	for m: Dictionary in items:
		ids.append(m["id"])
	var key: PackedByteArray
	if state is Dictionary:
		var focus: Variant = CoreStyles.cafe_style(state)
		key = var_to_bytes([ids, state["day"], state["createdAt"], state["chain"]["location"], state["kitchen"], focus, CoreStyles.garden_ready(state) if focus is String and focus == "garden" else false])
	else:
		key = var_to_bytes([ids])
	if key != _choices_key:
		_choices_key = key
		_choices = _make_choices(items, state)
	return _choices


static func _make_choices(items: Array, state: Variant) -> Array:
	var known := state is Dictionary
	var mains := []
	if known:
		mains = CoreCustomerDemand.demand_plan(state, items)["mains"]
	else:
		for m: Dictionary in items:
			mains.append({"main": m, "probability": 1.0 / items.size()})
	var out := []
	for choice: Dictionary in mains:
		var kind: Variant = choice.get("kind", JsUtil.UNDEFINED)
		var pairs := CoreStyles.style_order_pairs(state, choice["main"], items)
		var c := choice.duplicate(false)
		c["pairs"] = pairs
		if known:
			c["pairWeights"] = CoreCustomerDemand.guest_pair_weights(state, kind, pairs)
		else:
			var even := []
			even.resize(pairs.size())
			even.fill(1.0)
			c["pairWeights"] = even
		c["comboChance"] = CoreCustomerDemand.guest_combo_chance(kind, CoreStyles.style_combo_chance(state, choice["main"], pairs)) if not pairs.is_empty() else 0.0
		out.append(c)
	return out


static func order_seat_chance(state: Dictionary, meal: Array, kind: Variant = JsUtil.UNDEFINED) -> float:
	return JsMath.js_min(1.0, CoreStyles.style_seat_chance(state, meal) * CoreConditions.condition_seating(state) * CoreCustomerDemand.guest_seating_multiplier(kind))


static func _sum(list: Array) -> float:
	var sum := 0.0
	for x: float in list:
		sum += x
	return sum


## Expected portions per arrival, including actual pairing preferences.
static func order_shares(items: Array, state: Variant = null) -> Dictionary:
	var shares := {}
	for m: Dictionary in items:
		shares[m["id"]] = 0.0
	for choice: Dictionary in order_choices(items, state):
		var probability: float = choice["probability"]
		shares[choice["main"]["id"]] += probability
		var weights: Array = choice["pairWeights"]
		var total := _sum(weights)
		var pairs: Array = choice["pairs"]
		for i in pairs.size():
			shares[pairs[i]["id"]] += probability * choice["comboChance"] * weights[i] / total
	return shares


## Customers per second the baristas can take orders from and serve at the counter.
static func counter_capacity(state: Dictionary, items: Variant = null) -> float:
	var list := _or_menu(state, items)
	if list.is_empty():
		return 0.0
	var shares := order_shares(list, state)
	var front := CoreLayout.queue_spot(0.0)
	var capacity := 0.0
	for index in int(barista_count(state)):
		var crew: Array = state["partners"]["active"]["barista"]
		var partner: Variant = crew[index - 1] if index > 0 and index - 1 < crew.size() else JsUtil.UNDEFINED
		var prep := 0.0
		for id: String in shares:
			prep += shares[id] * prep_time(state, id) * CorePartners.partner_brew_multiplier(state, partner, is_bakery(id))
		var counter := CoreLayout.service_spot(index)
		# A queued customer walks from the head of the line to this till.
		var walk: float = JsMath.js_hypot2(counter["x"] - front["x"], counter["y"] - front["y"]) / CoreData.CUSTOMER_WALK_SPEED
		capacity += 1.0 / (prep + walk)
	return capacity


static func _server_trip(route: float) -> Array:
	var i := -1
	for n in _SERVER_TRIPS.size():
		if _SERVER_TRIPS[n][0] >= route:
			i = n
			break
	if i <= 0:
		var end: Array = _SERVER_TRIPS[_SERVER_TRIPS.size() - 1 if i < 0 else 0]
		return [end[1], end[2]]
	var a: Array = _SERVER_TRIPS[i - 1]
	var b: Array = _SERVER_TRIPS[i]
	var f: float = (route - a[0]) / (b[0] - a[0])
	return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]


## Customers per second the floor staff can keep up with: finished table orders leave the pass only as fast as
## the servers carry them. Infinite while the tables are too few for the servers to fall behind.
static func table_service_capacity(state: Dictionary, items: Variant = null) -> float:
	var list := _or_menu(state, items)
	# Until Mina receives her order, her table is unavailable to ordinary guests.
	var reserved: Variant = CoreRegularWishes.mina_reserved_table(state)
	var tables := []
	for index: float in CoreRegions.active_table_indices(state):
		if not (reserved is float and reserved == index):
			tables.append(index)
	if list.is_empty() or tables.is_empty():
		return INF
	var steps := 0.0
	for i: float in tables:
		steps += CoreLayout.room_route("main", CoreLayout.table_area(i)).size()
	var trip := _server_trip(steps / tables.size())
	var plates: float = server_count(state) * trip[1] / trip[0] * _PASS_FLOW[int(minf(_PASS_FLOW.size() - 1, state["upgrades"].get("pass", 0.0)))]
	# Guests only dine in at free seats, so a small dining room can't outpace its servers.
	if tables.size() * 2.0 / _SEAT_SECONDS <= plates:
		return INF
	var seat_chance := 0.0
	if CoreCustomerDemand.demand_enabled(state):
		for choice: Dictionary in order_choices(list, state):
			var weights: Array = choice["pairWeights"]
			var pair_total := _sum(weights)
			var kind: Variant = choice.get("kind", JsUtil.UNDEFINED)
			var main: String = choice["main"]["id"]
			var paired := 0.0
			for i in choice["pairs"].size():
				paired += order_seat_chance(state, [main, choice["pairs"][i]["id"]], kind) * weights[i] / pair_total
			seat_chance += choice["probability"] * ((1.0 - choice["comboChance"]) * order_seat_chance(state, [main], kind) + choice["comboChance"] * paired)
	else:
		var sum := 0.0
		for m: Dictionary in list:
			sum += CoreStyles.style_seat_chance(state, [m["id"]])
		seat_chance = sum / list.size() * CoreConditions.condition_seating(state)
	var dine_in := _DINE_IN_SHARE * seat_chance / _BASE_SEAT_CHANCE
	return plates / dine_in if dine_in > 0.0 else INF


## Customers per second the staff can actually serve: the counter, or the floor if it falls behind.
static func service_capacity(state: Dictionary, items: Variant = null) -> float:
	var list := _or_menu(state, items)
	return JsMath.js_min(counter_capacity(state, list), table_service_capacity(state, list))


static func earn(state: Dictionary, amount: float) -> void:
	state["coins"] += amount
	state["totalEarned"] += amount


# ---------------------------------------------------------------- pantry

static func ingredient_def(id: String) -> Variant:
	return _INGREDIENT_BY_ID.get(id, JsUtil.UNDEFINED)


## What one serving uses, as [ingredient, amount] pairs. Read-only for callers.
static func recipe(id: String) -> Array:
	if not _RECIPES.has(id):
		var def: Variant = CoreSignatureDrinks.signature_definition(id)
		var parts: Dictionary = def["recipe"] if def != null else CoreData.RECIPES[id]
		var list := []
		for ing: String in parts:
			list.append([ing, parts[ing]])
		_RECIPES[id] = list
	return _RECIPES[id]


## What one serving's ingredients cost.
static func serving_cost(id: String) -> float:
	var sum := 0.0
	for part: Array in recipe(id):
		sum += _INGREDIENT_BY_ID[part[0]]["cost"] * part[1]
	return sum


## How many servings the pantry's ingredients can make (or bake) of an item.
static func servings_left(state: Dictionary, id: String) -> float:
	var pantry: Dictionary = state["pantry"]
	var least := INF
	for part: Array in recipe(id):
		least = JsMath.js_min(least, floor(pantry[part[0]] / part[1]))
	return least


## Servings ready to sell today: the shelf (or the coming morning bake) for breads and pastries, the pantry for drinks.
static func ready_servings(state: Dictionary, id: String) -> float:
	if not can_prepare_item(state, id):
		return 0.0
	if state["phase"] != "prep":
		return state["shelf"].get(id, 0.0) if is_bakery(id) else servings_left(state, id)
	var projected := project_morning_bake(state)
	return projected["shelf"].get(id, 0.0) if is_bakery(id) else servings_left(projected, id)


## Whether today's menu has sellable stock or bakery stock the kitchen can replenish.
static func has_service_supply(state: Dictionary) -> bool:
	for m: Dictionary in menu_items(state):
		var id: String = m["id"]
		if ready_servings(state, id) >= 1.0 or state["kitchen"] and is_bakery(id) and state["inProduction"].get(id, 0.0) >= 1.0:
			return true
	if not state["kitchen"]:
		return false
	# A stocked bakery may resume from a sold-out closing state.
	var as_open := state
	if state["phase"] == "closing":
		as_open = state.duplicate(false)
		as_open["phase"] = "open"
	return CoreKitchen.next_batch(as_open, []) != null


## Sells one serving: from the shelf for breads and pastries, from the pantry for a drink. False if none left.
static func consume_serving(state: Dictionary, id: String, today: Variant = null) -> bool:
	if not can_prepare_item(state, id):
		return false
	if id.begins_with("sig:"):
		var owned := false
		for r: Dictionary in state["signatureDrinks"]["recipes"]:
			owned = owned or r["id"] == id
		if not owned:
			return false
	elif state["items"][id] <= 0.0:
		return false
	if is_bakery(id) and state["phase"] != "prep":
		if state["shelf"].get(id, 0.0) < 1.0:
			return false
		state["shelf"][id] -= 1.0
		return true
	if servings_left(state, id) < 1.0:
		return false
	for part: Array in recipe(id):
		state["pantry"][part[0]] -= part[1]
	if today is Dictionary:
		today["ingredientCost"] += serving_cost(id)
	return true


# ---------------------------------------------------------------- the morning bake

## Exact forecast portions, or enough shelf stock to bridge kitchen replenishment.
static func suggested_bake(state: Dictionary, id: String) -> float:
	if not can_prepare_item(state, id) or not is_bakery(id):
		return 0.0
	var demand: float = day_demand(state).get(id, 0.0)
	if not state["kitchen"]:
		return ceil(demand)
	var plan := CoreKitchen.bakery_plan(state)
	return plan[id]["morning"] if plan.has(id) else ceil(demand)


## Gives every bread and pastry on the menu a bake amount if it doesn't have one yet.
static func fill_bake_plan(state: Dictionary) -> void:
	for m: Dictionary in menu_items(state):
		var id: String = m["id"]
		if is_bakery(id) and not state["bakePlan"].has(id):
			state["bakePlan"][id] = suggested_bake(state, id)


static func set_bake_plan(state: Dictionary, id: String, n: float) -> void:
	if state["phase"] != "prep" or not can_prepare_item(state, id) or not is_bakery(id) or state["items"][id] <= 0.0 or not is_finite(n):
		return
	state["bakePlan"][id] = JsMath.js_max(0.0, JsMath.js_min(9999.0, JsMath.js_round(n)))


## Sets every bread and pastry on the menu to bake what a normal day sells.
static func bake_for_forecast(state: Dictionary) -> void:
	if state["phase"] != "prep":
		return
	for m: Dictionary in menu_items(state):
		if is_bakery(m["id"]):
			state["bakePlan"][m["id"]] = suggested_bake(state, m["id"])


## Projects the real bake order against a shared pantry without changing the game.
static func project_morning_bake(state: Dictionary) -> Dictionary:
	var pantry: Dictionary = state["pantry"].duplicate(false)
	var shelf: Dictionary = state["shelf"].duplicate(false)
	var projected := {"pantry": pantry, "shelf": shelf}
	if not state["kitchen"]:
		return projected
	for m: Dictionary in menu_items(state):
		var id: String = m["id"]
		if not is_bakery(id):
			continue
		var n := JsMath.js_min(state["bakePlan"].get(id, 0.0), servings_left(projected, id))
		for part: Array in recipe(id):
			pantry[part[0]] -= part[1] * n
		shelf[id] = shelf.get(id, 0.0) + n
	return projected


## Bakes the morning batch from the pantry onto the shelf. Returns how many items were baked in all.
static func bake_morning(state: Dictionary) -> float:
	if not state["kitchen"]:
		return 0.0
	var previous: Dictionary = state["shelf"]
	var projected := project_morning_bake(state)
	for ing: String in projected["pantry"]:
		state["pantry"][ing] = projected["pantry"][ing]
	state["shelf"] = projected["shelf"]
	var total := 0.0
	for id: String in state["shelf"]:
		var n: float = state["shelf"][id] - previous.get(id, 0.0)
		if n <= 0.0:
			continue
		state["today"]["baked"][id] = state["today"]["baked"].get(id, 0.0) + n
		state["today"]["ingredientCost"] += serving_cost(id) * n
		total += n
	return total


## Ingredients that any unlocked dish needs; the pantry only lists these.
static func needed_ingredients(state: Dictionary) -> Array:
	var used := {}
	for m: Dictionary in unlocked_items(state):
		if can_prepare_item(state, m["id"]):
			for part: Array in recipe(m["id"]):
				used[part[0]] = true
	for ing: String in CoreSignatureDrinks.available_signature_ingredients(state):
		used[ing] = true
	return CoreData.INGREDIENTS.filter(func(i: Dictionary) -> bool: return used.has(i["id"]))


## Dishes (unlocked) that use an ingredient.
static func used_by(state: Dictionary, ing: String) -> Array:
	return unlocked_items(state).filter(func(m: Dictionary) -> bool:
		if not can_prepare_item(state, m["id"]):
			return false
		for part: Array in recipe(m["id"]):
			if part[0] == ing:
				return true
		return false)


static func buy_ingredient(state: Dictionary, id: String, count: float) -> bool:
	if not JsMath.is_safe_integer(count) or count <= 0.0:
		return false
	var cost: float = _INGREDIENT_BY_ID[id]["cost"] * count
	if cost > state["coins"]:
		return false
	state["coins"] -= cost
	state["pantry"][id] += count
	return true


## The expensive part of a forecast. Idle cooks need it every step, and it only changes with what is listed here.
static var _forecast_key := PackedByteArray()
static var _forecast_parts: Dictionary = {}
static var _forecast_version := 0


static func _forecast(state: Dictionary) -> Dictionary:
	var specialties := []
	var roster: Dictionary = state["partners"]["roster"]
	for id: String in state["partners"]["active"]["barista"]:
		specialties.append(roster[id]["specialty"] if roster.has(id) else null)
	var recipes := []
	for r: Dictionary in state["signatureDrinks"]["recipes"]:
		recipes.append(r["id"])
		recipes.append(r["onMenu"])
	var style: Dictionary = state["cafeStyle"]
	var key := var_to_bytes([
		state["items"], state["upgrades"], state["onMenu"], state["kitchen"], state["phase"] == "prep", state["shelf"].get("roll", 0.0) < 1.0, state["day"], state["createdAt"],
		style["focus"], style.get("bakeryTrialDay", -1.0), state["decor"], state["regions"], state["chain"], state["partners"]["active"]["barista"], specialties, recipes,
		CoreRegularWishes.mina_reserved_table(state), CoreLayout.scene_height(),
	])
	if key != _forecast_key:
		var items := menu_items(state)
		_forecast_key = key
		_forecast_version += 1
		_forecast_parts = {
			"empty": items.is_empty(), "version": _forecast_version, "capacity": service_capacity(state, items) if not items.is_empty() else 0.0, "shares": order_shares(items, state),
			"menuArrivals": (CoreData.BASE_ARRIVAL_RATE * CoreChainBonuses.place_traffic_multiplier(state) * (1.0 + 0.2 * state["upgrades"]["marketing"])
				* (1.0 + 0.1 * state["upgrades"]["tables"] + CoreRegions.region_demand(state)) * menu_traffic_multiplier(state, items)),
			"style": CoreStyles.style_arrival_multiplier(state), "condition": CoreConditions.condition_traffic(state, items),
		}
	return _forecast_parts


## About how many customers a full day brings: the slower of arrivals and service.
static func expected_customers(state: Dictionary) -> float:
	return _customers(state, _forecast(state))


static func _customers(state: Dictionary, forecast: Dictionary) -> float:
	if forecast["empty"]:
		return 0.0
	var capacity: float = forecast["capacity"]
	var effective_cap := JsMath.js_min(capacity, CoreData.MAX_ARRIVAL_RATE)
	var promotion: Variant = state["promotion"]
	var promoted: float = minf(CoreData.DAY_SECONDS, promotion["remaining"]) if promotion is Dictionary and not promotion["paused"] else 0.0
	var pets := CorePets.pet_traffic(state)
	var care: float = CorePets.forecast_pet_traffic(state) / pets
	var base: float = forecast["menuArrivals"] * CoreReputation.reputation_traffic(state["reputation"]) * pets * forecast["style"] * forecast["condition"]
	return ceil(JsMath.js_min(base * CorePromotion.promotion_traffic(state) * care, effective_cap) * promoted
		+ JsMath.js_min(base * care, effective_cap) * (CoreData.DAY_SECONDS - promoted))


## Servings of each dish a full day on today's menu sells, roughly.
static func day_demand(state: Dictionary) -> Dictionary:
	var forecast := _forecast(state)
	return _demand(_customers(state, forecast), forecast)


static func _demand(customers: float, forecast: Dictionary) -> Dictionary:
	var demand := {}
	var shares: Dictionary = forecast["shares"]
	for id: String in shares:
		demand[id] = customers * shares[id]
	return demand


## Ingredients a full day on today's menu uses, with a little to spare.
static func day_needs(state: Dictionary) -> Dictionary:
	var needs := {}
	var demand := day_demand(state)
	var customers := expected_customers(state)
	var prep: bool = state["phase"] == "prep"
	for id: String in demand:
		if is_bakery(id) and not state["kitchen"]:
			continue # Neighbor-supplied trial stock cannot be replenished here.
		var servings: float = demand[id]
		# Cover planned morning production or forecast consumption, never both twice.
		var morning: float = state["bakePlan"].get(id, 0.0) if prep else 0.0
		var shelf: float = 0.0 if prep else state["shelf"].get(id, 0.0)
		var in_progress: float = 0.0 if prep else state["inProduction"].get(id, 0.0)
		var amount: float
		if is_bakery(id):
			amount = JsMath.js_max(morning, ceil(servings * 1.1) - shelf - in_progress)
		else:
			# A menu-mix reserve (~95th percentile per dish) on top of the percentage.
			amount = servings * 1.15 + 1.65 * sqrt(servings * JsMath.js_max(0.0, 1.0 - servings / JsMath.js_max(1.0, customers)))
		for part: Array in recipe(id):
			needs[part[0]] = needs.get(part[0], 0.0) + amount * part[1]
	for k: String in needs:
		needs[k] = ceil(needs[k])
	# A conservative five-cup reserve for a trial drink.
	var trial: Variant = CoreTrialSales.trial_sale_item(state)
	if trial != null:
		for part: Array in recipe(trial):
			needs[part[0]] = needs.get(part[0], 0.0) + CoreTrialSales.trial_sale_remaining(state) * part[1]
	return needs


## What it takes to top the pantry up to one day's needs.
static func restock_quote(state: Dictionary) -> Dictionary:
	var buy := {}
	var cost := 0.0
	var needs := day_needs(state)
	for ing: String in needs:
		# Tastings leave quarters, but suppliers sell whole ingredient units.
		var n := JsMath.js_max(0.0, ceil(needs[ing] - state["pantry"][ing]))
		if n == 0.0:
			continue
		buy[ing] = n
		cost += n * _INGREDIENT_BY_ID[ing]["cost"]
	return {"buy": buy, "cost": cost}


## Tops up a forecast proportionally, prioritizing one complete recipe when cash is scarce.
static func restock_plan(state: Dictionary) -> Dictionary:
	var q := restock_quote(state)
	if q["cost"] <= 0.0 or state["coins"] <= 0.0:
		return {"buy": {}, "cost": 0.0, "balance": state["coins"], "missing": q["buy"], "missingCost": q["cost"]}
	var share := JsMath.js_max(0.0, JsMath.js_min(1.0, state["coins"] / q["cost"]))
	var buy := []
	for ing: String in q["buy"]:
		buy.append([ing, floor(q["buy"][ing] * share)])
	var projected := {"pantry": state["pantry"].duplicate(false)}
	for part: Array in buy:
		projected["pantry"][part[0]] += part[1]
	var items := menu_items(state)
	var has_supply := false
	for m: Dictionary in items:
		var id: String = m["id"]
		if servings_left(projected, id) >= 1.0 or is_bakery(id) and (state["shelf"].get(id, 0.0) >= 1.0 or state["inProduction"].get(id, 0.0) >= 1.0):
			has_supply = true
			break
	if not has_supply:
		# Rounding a small budget can buy fragments of several recipes while completing none.
		var recipes := []
		for m: Dictionary in items:
			var deficits := []
			var price := 0.0
			for part: Array in recipe(m["id"]):
				var short := JsMath.js_max(0.0, ceil(part[1] - state["pantry"][part[0]]))
				deficits.append([part[0], short])
				price += _INGREDIENT_BY_ID[part[0]]["cost"] * short
			if price > 0.0 and price <= state["coins"]:
				recipes.append({"deficits": deficits, "cost": price})
		JsUtil.stable_sort(recipes, func(a: Dictionary, b: Dictionary) -> float: return a["cost"] - b["cost"])
		buy = recipes[0]["deficits"] if not recipes.is_empty() else []
	var planned := {}
	var cost := 0.0
	for part: Array in buy:
		if part[1] > 0.0:
			planned[part[0]] = part[1]
		cost += _INGREDIENT_BY_ID[part[0]]["cost"] * part[1]
	var missing := {}
	for ing: String in q["buy"]:
		var n: float = q["buy"][ing] - planned.get(ing, 0.0)
		if n > 0.0:
			missing[ing] = n
	return {"buy": planned, "cost": cost, "balance": state["coins"] - cost, "missing": missing, "missingCost": q["cost"] - cost}


## Execute the same quote shown before purchase.
static func restock(state: Dictionary) -> bool:
	var plan: Dictionary = restock_plan(state)["buy"]
	var bought := false
	for ing: String in plan:
		if plan[ing] > 0.0 and buy_ingredient(state, ing, plan[ing]):
			bought = true
	return bought


## Menu dishes the pantry can't make a single serving of.
static func sold_out_items(state: Dictionary) -> Array:
	return menu_items(state).filter(func(m: Dictionary) -> bool: return servings_left(state, m["id"]) < 1.0)
