class_name CoreGoals
extends RefCounted

## Port of src/game/goals.ts. GOALS is data; each goal's progress is `goal_progress`.

static var GOALS: Array = RulesData.section("goals")["GOALS"]


static func _days_done(s: Dictionary) -> float:
	return s["day"] - 1.0


static func _best_recipe_level(s: Dictionary) -> float:
	var best := -INF
	for item: Dictionary in CoreData.MENU:
		best = JsMath.js_max(best, s["items"][item["id"]])
	return best


static func _completed_style_stages(s: Dictionary, count: int) -> float:
	if not s["cafeStyle"]["focus"] is String:
		return 0.0
	var n := 0.0
	for stage: Dictionary in CoreStyles.style_stages(s, s["cafeStyle"]["focus"]).slice(0, count):
		if stage["done"]:
			n += 1.0
	return n


static func _drink_supply(s: Dictionary) -> float:
	var most := 0.0
	for m: Dictionary in CoreEconomy.menu_items(s):
		if CoreData.is_drink(m["category"]):
			most = JsMath.js_max(most, CoreEconomy.ready_servings(s, m["id"]))
	return most


## [current, target]; the goal is done when current >= target.
static func goal_progress(id: String, s: Dictionary) -> Array:
	var up: Dictionary = s["upgrades"]
	match id:
		"firstDay": return [_days_done(s), 1.0]
		"espresso5": return [_best_recipe_level(s), 2.0]
		"americano": return [float(CoreEconomy.unlocked_items(s).size()), 2.0]
		"latte": return [JsMath.js_max(CoreEconomy.unlocked_items(s).size(), _best_recipe_level(s)), 3.0]
		"milk": return [JsMath.js_min(20.0, JsMath.js_max(s["pantry"]["milk"], _drink_supply(s))), 20.0]
		"sign": return [JsMath.js_max(up["marketing"], up["machine"]), 1.0]
		"decor": return [1.0 if CoreDecor.has_bought_decor(s) else 0.0, 1.0]
		"table": return [JsMath.js_max(JsMath.js_max(up["tables"], 1.0 if s["kitchen"] else 0.0), JsMath.js_max(s["regions"].size(), CoreStreets.owned_plot_count(s))), 1.0]
		"barista": return [JsMath.js_max(JsMath.js_max(up["barista"], up["server"]), up["cook"]), 1.0]
		"days5": return [_days_done(s), 5.0]
		"variety": return [JsMath.js_max(CoreEconomy.unlocked_items(s).size(), _completed_style_stages(s, 1) * 6.0), 6.0]
		"comfort": return [CoreDecor.comfort(s), 15.0]
		"cappuccino": return [JsMath.js_max(5.0 if s["items"]["cappuccino"] > 0.0 else 0.0, _best_recipe_level(s)), 5.0]
		"served": return [s["served"], 500.0]
		"croissant": return [JsMath.js_max(2.0 if s["items"]["croissant"] > 0.0 else 0.0, _completed_style_stages(s, 2)), 2.0]
	push_error("Unknown goal %s" % id)
	return [0.0, 1.0]


static func current_goal(s: Dictionary) -> Variant:
	var at: float = s["goal"]
	return GOALS[int(at)] if JsMath.is_integer(at) and at >= 0.0 and at < GOALS.size() else null


static func goal_done(s: Dictionary) -> bool:
	var g: Variant = current_goal(s)
	if g == null:
		return false
	var progress := goal_progress(g["id"], s)
	return progress[0] >= progress[1]


static func claim_goal(s: Dictionary) -> float:
	var g: Variant = current_goal(s)
	if g == null or not goal_done(s):
		return 0.0
	CoreEconomy.earn(s, g["reward"])
	s["goal"] += 1.0
	return g["reward"]
