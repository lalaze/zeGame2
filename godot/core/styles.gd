class_name CoreStyles
extends RefCounted

## Port of src/game/styles.ts: reversible operating choices.

static var STYLE_IDS: Array = RulesData.section("styles")["STYLE_IDS"]
static var HANDOFF_COUNTERS: Array = RulesData.section("styles")["HANDOFF_COUNTERS"]


static func empty_style_handoffs() -> Dictionary:
	return {"tableServed": 0.0, "catServed": 0.0, "fastServed": 0.0, "teaPairs": 0.0}


static func is_cafe_style(id: Variant) -> bool:
	return id is String and STYLE_IDS.has(id)


static func parse_cafe_style(value: Variant) -> Dictionary:
	var focus: Variant = JsUtil.prop(value, "focus")
	var source: Variant = JsUtil.prop(value, "handoffs")
	var handoffs := empty_style_handoffs()
	if source is Dictionary:
		for id: String in HANDOFF_COUNTERS:
			var n: Variant = JsUtil.prop(source, id)
			if JsMath.is_safe_integer(n) and n >= 0.0:
				handoffs[id] = JsMath.js_min(1000000000.0, n)
	var out := {"focus": focus if is_cafe_style(focus) else null, "handoffs": handoffs}
	var introductions: Variant = JsUtil.prop(value, "introductions")
	if introductions is Array:
		var list := []
		for id: Variant in introductions:
			if id is String and (id == "cats" or id == "bakery") and not list.has(id):
				list.append(id)
		out["introductions"] = list
	var trial: Variant = JsUtil.prop(value, "bakeryTrialDay")
	if JsMath.is_safe_integer(trial) and trial > 0.0 and out.has("introductions") and out["introductions"].has("bakery"):
		out["bakeryTrialDay"] = trial
	return out


static func _introduced(s: Dictionary, id: String) -> bool:
	return s["cafeStyle"].has("introductions") and s["cafeStyle"]["introductions"].has(id)


## A finite, saved welcome experience. Switching styles cannot repeat the grant.
static func start_style_welcome(s: Dictionary, id: String) -> bool:
	if s["phase"] != "prep" or not _focused(s, id) or _introduced(s, id):
		return false
	if id == "cats":
		if not s["pets"].is_empty():
			return false
		s["pets"].append({"id": "ginger", "careSeconds": CorePets.CARE_SECONDS, "autoRefill": false, "fosterUntilDay": s["day"]})
	else:
		if s["kitchen"]:
			return false
		s["items"]["roll"] = JsMath.js_max(1.0, s["items"]["roll"])
		s["shelf"]["roll"] = s["shelf"].get("roll", 0.0) + 6.0
		s["bakePlan"]["roll"] = 0.0
		if not s["onMenu"].has("roll"):
			s["onMenu"].append("roll")
		s["cafeStyle"]["bakeryTrialDay"] = s["day"]
	if not s["cafeStyle"].has("introductions"):
		s["cafeStyle"]["introductions"] = []
	s["cafeStyle"]["introductions"].append(id)
	return true


static func set_cafe_style(state: Dictionary, id: Variant) -> bool:
	if state["phase"] != "prep" or id != null and not is_cafe_style(id):
		return false
	state["cafeStyle"]["focus"] = id
	return true


static func cafe_style(state: Dictionary) -> Variant:
	return state["cafeStyle"]["focus"] if state.get("cafeStyle") is Dictionary else null


static func _focused(state: Variant, id: String) -> bool:
	var style: Variant = cafe_style(state) if state is Dictionary else null
	return style is String and style == id


static func _category(id: String) -> String:
	var def: Variant = CoreEconomy.menu_item(id)
	return def["category"] if def != null else ""


static func _servings(s: Dictionary, categories: Array) -> float:
	var sum := 0.0
	for m: Dictionary in CoreData.MENU:
		if categories.has(m["category"]):
			sum += s["taste"]["served"].get(m["id"], 0.0)
	var custom := 0.0
	for id: String in s["signatureDrinks"]["served"]:
		var def: Variant = CoreSignatureDrinks.signature_definition(id)
		if def != null and categories.has(def["category"]):
			custom += s["signatureDrinks"]["served"][id]
	return sum + custom


static func _signatures(s: Dictionary, categories: Array) -> float:
	var n := 0.0
	for id: String in s["taste"]["signature"]:
		if categories.has(_category(id)):
			n += 1.0
	for id: String in s["signatureDrinks"]["served"]:
		var def: Variant = CoreSignatureDrinks.signature_definition(id)
		if def != null and categories.has(def["category"]) and CoreTaste.taste_tier(s, id) == "signature":
			n += 1.0
	return n


static func _goal(id: String, current: float, target: float) -> Dictionary:
	return {"id": id, "current": JsMath.js_min(current, target), "target": target, "done": current >= target}


static func _placed(s: Dictionary, id: String) -> bool:
	for p: Dictionary in s["decor"]["placed"]:
		if p["id"] == id:
			return true
	return false


## No claimable money or stat rewards: these checklists reflect retained real assets and delivered servings.
static func style_stages(s: Dictionary, id: String) -> Array:
	var num := func(x: float) -> String: return JsMath.number_to_string(x)
	var item := func(name: String, target: float) -> Dictionary: return _goal(name + num.call(target), s["items"][name], target)
	var upgrade := func(name: String, target: float) -> Dictionary: return _goal(name + num.call(target), s["upgrades"][name], target)
	var cozy := func(target: float) -> Dictionary: return _goal("comfort" + num.call(target), CoreDecor.comfort(s), target)
	var region := func(name: String) -> Dictionary: return _goal(name, 1.0 if s["regions"].has(name) or CoreStreets.owns_street_business(s, name) else 0.0, 1.0)
	var sales := func(name: String, cats: Array, target: float) -> Dictionary: return _goal(name, _servings(s, cats), target)
	var research := func(name: String, cats: Array, target: float) -> Dictionary: return _goal(name, _signatures(s, cats), target)
	var kitchen := func() -> Dictionary: return _goal("kitchen", 1.0 if s["kitchen"] else 0.0, 1.0)
	var cat := func(target: float) -> Dictionary:
		var n := 0.0
		for p: Dictionary in s["pets"]:
			if not JsUtil.truthy(JsUtil.prop(p, "fosterUntilDay")):
				n += 1.0
		return _goal("cats" + num.call(target), n, target)
	var handoff := func(name: String, target: float) -> Dictionary: return _goal(name + num.call(target), s["cafeStyle"]["handoffs"][name], target)
	var reliable := func() -> Dictionary: return _goal("reliable", CoreReputation.reputation_score(s["reputation"]) if s["reputation"]["recent"].size() >= 20 else 0.0, 4.2)
	var stages: Array
	match id:
		"coffee":
			stages = [
				[item.call("espresso", 5.0), upgrade.call("machine", 1.0), sales.call("coffee30", ["coffee"], 30.0)],
				[item.call("latte", 5.0), upgrade.call("barista", 1.0), research.call("coffeeSignature1", ["coffee"], 1.0)],
				[item.call("flatwhite", 10.0), upgrade.call("machine", 4.0), research.call("coffeeSignature2", ["coffee"], 2.0)],
			]
		"bakery":
			stages = [
				[_goal("bakeryWelcome", 1.0 if s["kitchen"] or _introduced(s, "bakery") else 0.0, 1.0), kitchen.call(), item.call("roll", 3.0)],
				[item.call("donut", 3.0), upgrade.call("cook", 1.0), sales.call("bakery100", ["bread", "pastry"], 100.0)],
				[item.call("croissant", 5.0), upgrade.call("cook", 2.0), research.call("bakerySignature2", ["bread", "pastry"], 2.0)],
			]
		"cats":
			stages = [
				[_goal("catWelcome", 1.0 if not s["pets"].is_empty() or _introduced(s, "cats") else 0.0, 1.0), cat.call(1.0), cozy.call(5.0)],
				[cat.call(2.0), upgrade.call("server", 1.0), cozy.call(15.0)],
				[cat.call(3.0), cozy.call(30.0), handoff.call("catServed", 300.0)],
			]
		"takeaway":
			stages = [
				[item.call("espresso", 5.0), upgrade.call("machine", 1.0), handoff.call("fastServed", 30.0)],
				[item.call("americano", 10.0), upgrade.call("barista", 1.0), upgrade.call("machine", 3.0)],
				[item.call("cortado", 3.0), upgrade.call("barista", 2.0), upgrade.call("machine", 8.0), handoff.call("fastServed", 300.0)],
			]
		"garden":
			stages = [
				[item.call("blacktea", 3.0), _goal("planted", 1.0 if garden_ready(s) else 0.0, 1.0), sales.call("tea30", ["tea"], 30.0)],
				[kitchen.call(), item.call("scone", 3.0), upgrade.call("server", 1.0)],
				[region.call("greenhouse"), region.call("terrace"), upgrade.call("server", 2.0), handoff.call("teaPairs", 100.0)],
			]
		"community":
			stages = [
				[item.call("espresso", 5.0), cozy.call(5.0), handoff.call("tableServed", 30.0)],
				[region.call("reading"), upgrade.call("server", 1.0), reliable.call()],
				[_goal("bookshelf", 1.0 if _placed(s, "bookshelf") else 0.0, 1.0), upgrade.call("server", 2.0), handoff.call("tableServed", 300.0), reliable.call()],
			]
	var out := []
	for i in 3:
		var done := true
		for g: Dictionary in stages[i]:
			done = done and g["done"]
		out.append({"id": ["early", "mid", "late"][i], "done": done, "goals": stages[i]})
	return out


static func current_style_stage(s: Dictionary, id: String) -> Dictionary:
	var stages := style_stages(s, id)
	for stage: Dictionary in stages:
		if not stage["done"]:
			return stage
	return stages[2]


static func next_style_goal(s: Dictionary, id: String) -> Variant:
	for stage: Dictionary in style_stages(s, id):
		for g: Dictionary in stage["goals"]:
			if not g["done"]:
				return g
	return null


static func style_prep_multiplier(s: Dictionary, id: String) -> float:
	return 1.12 if _focused(s, "coffee") and _category(id) == "coffee" else 1.0


static func style_sale_multiplier(s: Dictionary, id: String, dine_in: bool = false, meal: Variant = null) -> float:
	var style: Variant = cafe_style(s)
	if style == null:
		return 1.0
	var dishes: Array = meal if meal is Array else [id]
	if style == "coffee" and _category(id) == "coffee":
		return {"standard": 1.04, "skilled": 1.08, "signature": 1.12}[CoreTaste.taste_tier(s, id)]
	if style == "takeaway" and not dine_in and fast_drink_meal(dishes):
		return 0.94
	if style == "cats" and dine_in and CoreDecor.comfort(s) >= 5.0:
		return 1.0 + 0.04 * minf(3.0, active_style_cats(s))
	if style == "garden" and dine_in and garden_ready(s):
		if tea_pastry_meal(dishes):
			return 1.12
		if _category(id) == "tea":
			return 1.06
	return 1.0


## Qualifies from the delivered meal; an actual add-on makes it ineligible.
static func fast_drink_meal(meal: Array) -> bool:
	if meal.is_empty():
		return false
	var sum := 0.0
	for id: String in meal:
		var category := _category(id)
		if category != "coffee" and category != "tea":
			return false
		sum += CoreEconomy.menu_item(id)["prepTime"]
	return sum <= 3.0


static func tea_pastry_meal(meal: Array) -> bool:
	var tea := false
	var pastry := false
	for id: String in meal:
		var category := _category(id)
		tea = tea or category == "tea"
		pastry = pastry or category == "pastry"
	return tea and pastry


static func active_style_cats(s: Dictionary) -> float:
	var n := 0.0
	for p: Dictionary in s["pets"]:
		if CorePets.pet_active(p):
			n += 1.0
	return n


static func garden_ready(s: Dictionary) -> bool:
	if CoreDecor.comfort(s) < 5.0:
		return false
	for p: Dictionary in s["decor"]["placed"]:
		if p["id"].begins_with("plant_"):
			return true
	return ["sill_cactus", "sill_tulips", "sill_bonsai"].has(s["decor"]["equipped"]["sill"])


## Called exactly once by successful payment. Counts are factual lifetime history, with no payout.
static func record_style_handoff(s: Dictionary, meal: Array, dine_in: bool) -> void:
	var handoffs: Dictionary = s["cafeStyle"]["handoffs"]
	var add := func(id: String) -> void: handoffs[id] = JsMath.js_min(1000000000.0, handoffs[id] + 1.0)
	if dine_in:
		add.call("tableServed")
	if active_style_cats(s) > 0.0:
		add.call("catServed")
	if not dine_in and fast_drink_meal(meal):
		add.call("fastServed")
	if dine_in and tea_pastry_meal(meal):
		add.call("teaPairs")


## Shared order model for the actual arrival and the forecasts.
static func style_order_pairs(s: Variant, main: Dictionary, menu: Array) -> Array:
	var category: String = main["category"]
	if (category == "tea" or category == "pastry") and _focused(s, "garden") and garden_ready(s):
		var other := "pastry" if category == "tea" else "tea"
		var pairs := []
		for m: Dictionary in menu:
			if m["category"] == other:
				pairs.append(m)
		if not pairs.is_empty():
			return pairs
	var drink := CoreData.is_drink(category)
	var out := []
	for m: Dictionary in menu:
		if CoreData.is_drink(m["category"]) != drink:
			out.append(m)
	return out


static func style_combo_chance(s: Variant, main: Dictionary, pairs: Array) -> float:
	if _focused(s, "bakery") and s["kitchen"]:
		return 0.5
	if _focused(s, "garden") and garden_ready(s):
		for p: Dictionary in pairs:
			if tea_pastry_meal([main["id"], p["id"]]):
				return 0.5
	return CoreData.COMBO_CHANCE


static func style_seat_chance(s: Dictionary, meal: Array) -> float:
	if _focused(s, "takeaway") and fast_drink_meal(meal):
		return 0.0
	return 0.8 if _focused(s, "garden") and garden_ready(s) and _has_tea(meal) else 0.6


static func _has_tea(meal: Array) -> bool:
	for id: String in meal:
		if _category(id) == "tea":
			return true
	return false


static func style_station_multiplier(s: Variant = null) -> float:
	return 0.9 if _focused(s, "bakery") and s["kitchen"] else 1.0


static func style_dwell_extra(s: Dictionary, meal: Array) -> float:
	if _focused(s, "cats") and CoreDecor.comfort(s) >= 5.0:
		return 4.0 * minf(3.0, active_style_cats(s))
	return 6.0 if _focused(s, "garden") and garden_ready(s) and _has_tea(meal) else 0.0


static func _community_ready(s: Dictionary) -> bool:
	return _focused(s, "community") and CoreDecor.comfort(s) >= 5.0


static func style_arrival_multiplier(s: Dictionary) -> float:
	return 0.9 if _community_ready(s) else 1.0


static func style_server_multiplier(s: Dictionary) -> float:
	return 1.15 if _community_ready(s) else 1.0


static func style_table_patience_extra(s: Dictionary) -> float:
	return 10.0 if _community_ready(s) else 0.0
