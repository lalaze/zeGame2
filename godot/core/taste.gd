class_name CoreTaste
extends RefCounted

# Port of src/game/taste.ts

static var SKILLED_SERVINGS: float = RulesData.section("taste")["SKILLED_SERVINGS"]
static var SIGNATURE_SERVINGS: float = RulesData.section("taste")["SIGNATURE_SERVINGS"]

static func taste_tier(state: Dictionary, id: Variant) -> String:
	if CoreSignatureDrinks.signature_definition(id) != null:
		var sig_served: Dictionary = state["signatureDrinks"]["served"]
		var served := float(sig_served[id]) if sig_served.has(id) and not JsUtil.is_nullish(sig_served[id]) else 0.0
		if served >= SIGNATURE_SERVINGS:
			return "signature"
		if served >= SKILLED_SERVINGS:
			return "skilled"
		return "standard"
	if state["taste"]["signature"].has(id):
		return "signature"
	var t_served: Dictionary = state["taste"]["served"]
	var count := float(t_served[id]) if t_served.has(id) and not JsUtil.is_nullish(t_served[id]) else 0.0
	if count >= SKILLED_SERVINGS:
		return "skilled"
	return "standard"

static func _tier_base_score(tier: String) -> float:
	if tier == "signature":
		return 5.0
	if tier == "skilled":
		return 4.5
	return 4.0

static func _tier_custom_bonus(tier: String) -> float:
	if tier == "signature":
		return 0.5
	if tier == "skilled":
		return 0.3
	return 0.0

static func taste_score(state: Dictionary, id: Variant) -> float:
	var tier := taste_tier(state, id)
	var custom = CoreSignatureDrinks.signature_definition(id)
	if custom == null:
		return _tier_base_score(tier)
	var foundation := "espresso" if custom["base"] == "coffee" else "blacktea"
	var inherited := _tier_base_score(taste_tier(state, foundation)) + float(custom["quality"]) - 4.0
	var raw := JsMath.js_max(float(custom["quality"]), inherited) + _tier_custom_bonus(tier)
	return JsMath.js_min(5.0, JsMath.js_round(raw * 10.0) / 10.0)

static func meal_taste(state: Dictionary, items: Array) -> float:
	if items.is_empty():
		return 4.0
	var total := 0.0
	for id in items:
		total += taste_score(state, id)
	return total / float(items.size())

static func record_servings(state: Dictionary, items: Array) -> void:
	for id in items:
		if CoreSignatureDrinks.signature_definition(id) != null:
			var sig_served: Dictionary = state["signatureDrinks"]["served"]
			var cur := float(sig_served[id]) if sig_served.has(id) and not JsUtil.is_nullish(sig_served[id]) else 0.0
			var served := JsMath.js_min(1000000000.0, cur + 1.0)
			sig_served[id] = served
			state["taste"]["served"][id] = served
		elif CoreData.find_menu(id) != null:
			var t_served: Dictionary = state["taste"]["served"]
			var cur := float(t_served[id]) if t_served.has(id) and not JsUtil.is_nullish(t_served[id]) else 0.0
			t_served[id] = JsMath.js_min(1000000000.0, cur + 1.0)

static func signature_cost(id: Variant) -> float:
	var def = CoreData.find_menu(id)
	if def == null:
		return 0.0
	var c: float = ceil(float(def["basePrice"]) * 20.0)
	return JsMath.js_max(150.0, c)

static func research_block(state: Dictionary, id: Variant) -> Variant:
	if CoreSignatureDrinks.signature_definition(id) != null:
		return "owned" if taste_tier(state, id) == "signature" else "experience"
	if CoreData.find_menu(id) == null:
		return "locked"
	var items: Dictionary = state["items"]
	if not items.has(id) or not JsUtil.is_number(items[id]) or not (float(items[id]) > 0.0):
		return "locked"
	if state["taste"]["signature"].has(id):
		return "owned"
	var t_served: Dictionary = state["taste"]["served"]
	var count := float(t_served[id]) if t_served.has(id) and not JsUtil.is_nullish(t_served[id]) else 0.0
	if count < SIGNATURE_SERVINGS:
		return "experience"
	if state["phase"] != "prep":
		return "open"
	if float(state["coins"]) < signature_cost(id):
		return "coins"
	return null

static func research_signature(state: Dictionary, id: Variant) -> bool:
	if research_block(state, id) != null:
		return false
	state["coins"] = float(state["coins"]) - signature_cost(id)
	state["taste"]["signature"].append(id)
	return true

static func _valid_obj(v: Variant) -> bool:
	return v is Dictionary

static func parse_taste(value: Variant, legacy_sales: Dictionary) -> Dictionary:
	var source: Dictionary = value if _valid_obj(value) else {}
	var served: Dictionary = source["served"] if (source.has("served") and _valid_obj(source["served"])) else legacy_sales
	var out := {"served": {}, "signature": []}
	var has_sig_arr := source.has("signature") and source["signature"] is Array
	for m in CoreData.MENU:
		var mid: String = m["id"]
		if served.has(mid):
			var n = served[mid]
			if JsUtil.is_number(n) and JsMath.is_safe_integer(n) and float(n) > 0.0:
				out["served"][mid] = JsMath.js_min(1000000000.0, float(n))
		var out_n := float(out["served"][mid]) if out["served"].has(mid) else 0.0
		if has_sig_arr and source["signature"].has(mid) and out_n >= SIGNATURE_SERVINGS:
			out["signature"].append(mid)
	return out
