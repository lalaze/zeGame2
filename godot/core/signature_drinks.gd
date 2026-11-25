class_name CoreSignatureDrinks
extends RefCounted

# Port of src/game/signature-drinks.ts

static var SIGNATURE_BASES: Array = RulesData.section("signature-drinks")["SIGNATURE_BASES"]
static var BASE_INGREDIENT: Dictionary = RulesData.section("signature-drinks")["BASE_INGREDIENT"]
static var SIGNATURE_ADDONS: Array = RulesData.section("signature-drinks")["SIGNATURE_ADDONS"]
static var MAX_SIGNATURE_RECIPES: float = RulesData.section("signature-drinks")["MAX_SIGNATURE_RECIPES"]
static var MAX_SIGNATURE_MENU: float = RulesData.section("signature-drinks")["MAX_SIGNATURE_MENU"]
static var SIGNATURE_TRIAL_PORTION: float = RulesData.section("signature-drinks")["SIGNATURE_TRIAL_PORTION"]

static func is_plain_signature_copy(def: Dictionary) -> bool:
	var base: String = str(def["base"])
	if base != "coffee" and base != "tea":
		return false
	var recipe: Dictionary = def["recipe"]
	if recipe.size() != 1:
		return false
	var primary: String = BASE_INGREDIENT[base]
	return recipe.has(primary) and JsUtil.is_number(recipe[primary]) and float(recipe[primary]) == 1.0

static func empty_signature_drinks() -> Dictionary:
	return {"recipes": [], "tested": [], "served": {}}

static func _record(v: Variant) -> bool:
	return v is Dictionary

static func _clean_name(v: Variant) -> String:
	if not (v is String):
		return ""
	var cleaned := JsUtil.js_trim(JsUtil.strip_ascii_control(v))
	return cleaned.substr(0, 24)

static func _truthy(v: Variant) -> bool:
	if v == null or JsUtil.is_undefined(v):
		return false
	if v is bool:
		return v
	if JsUtil.is_number(v):
		var f := float(v)
		return f != 0.0 and not is_nan(f)
	if v is String:
		return not v.is_empty()
	return true

static func _incompatible(base: String, recipe: Dictionary) -> bool:
	var has_fruit := recipe.has("fruit") and _truthy(recipe["fruit"])
	var has_matcha := recipe.has("matcha") and _truthy(recipe["matcha"])
	var has_cocoa := recipe.has("cocoa") and _truthy(recipe["cocoa"])
	return (base == "coffee" and (has_fruit or has_matcha)) or (base == "tea" and has_cocoa) or (has_fruit and has_cocoa)

static func validate_signature_recipe(base: Variant, recipe: Variant) -> Dictionary:
	if not (base is String) or not SIGNATURE_BASES.has(base) or not _record(recipe):
		return {"ok": false, "error": "invalid"}
	var b: String = base
	var primary: String = BASE_INGREDIENT[b]
	var rec: Dictionary = recipe
	var entries: Array = []
	for k in JsUtil.own_keys(rec):
		var val = rec[k]
		if JsUtil.is_number(val) and float(val) == 0.0:
			continue
		entries.append([str(k), val])
	var primary_val = rec[primary] if rec.has(primary) else JsUtil.UNDEFINED
	var primary_ok := JsUtil.is_number(primary_val) and (float(primary_val) == 1.0 or float(primary_val) == 2.0)
	if entries.is_empty() or entries.size() > 4 or not primary_ok:
		return {"ok": false, "error": "invalid"}
	var addons := SIGNATURE_ADDONS
	var total := 0.0
	for entry in entries:
		var key: String = entry[0]
		var n = entry[1]
		if not JsUtil.is_number(n) or (float(n) != 1.0 and float(n) != 2.0):
			return {"ok": false, "error": "invalid"}
		if key != primary and not addons.has(key):
			return {"ok": false, "error": "invalid"}
		total += float(n)
	if total > 6.0:
		return {"ok": false, "error": "invalid"}
	if _incompatible(b, rec):
		return {"ok": false, "error": "incompatible"}
	var order_table := RulesData.locale_order("ingredients")
	JsUtil.stable_sort(entries, func(a, b_e): return float(JsUtil.locale_compare(a[0], b_e[0], order_table)))
	var parts: PackedStringArray = PackedStringArray()
	for entry in entries:
		parts.append("%s=%s" % [entry[0], JsMath.number_to_string(float(entry[1]))])
	var encoded := ",".join(parts)
	return {"ok": true, "error": null, "id": "sig:%s:%s" % [b, encoded]}

static func compatible_signature_addons(base: String, recipe: Dictionary = {}) -> Array:
	var primary: String = BASE_INGREDIENT[base]
	var out: Array = []
	for ing in SIGNATURE_ADDONS:
		if ing == primary:
			continue
		var probe := recipe.duplicate(false)
		probe[primary] = 1.0
		probe[ing] = 1.0
		if not _incompatible(base, probe):
			out.append(ing)
	return out

static func make_signature_id(base: Variant, recipe: Variant) -> Variant:
	var v := validate_signature_recipe(base, recipe)
	return v["id"] if v.has("id") else null

static func _parse_entry_token(entry: String) -> Array:
	# Matches /^([a-z]+)=([12])$/
	var eq := entry.find("=")
	if eq <= 0 or eq != entry.length() - 2:
		return []
	var rhs := entry.unicode_at(eq + 1)
	if rhs != 49 and rhs != 50: # '1' or '2'
		return []
	for i in range(eq):
		var c := entry.unicode_at(i)
		if c < 97 or c > 122: # 'a'..'z'
			return []
	return [entry.substr(0, eq), 1.0 if rhs == 49 else 2.0]

## The same recipe is looked up many times a step, so each id is worked out once. Read-only for callers.
static var _definitions: Dictionary = {}

static func signature_definition(id: Variant) -> Variant:
	if not (id is String) or not id.begins_with("sig:") or id.length() > 160:
		return null
	if not _definitions.has(id):
		_definitions[id] = _define(id)
	return _definitions[id]

static func _define(id: String) -> Variant:
	var parts: PackedStringArray = id.split(":")
	if parts.size() != 3 or parts[0] != "sig":
		return null
	var recipe: Dictionary = {}
	for entry in parts[2].split(","):
		var m := _parse_entry_token(entry)
		if m.is_empty() or recipe.has(m[0]):
			return null
		recipe[m[0]] = m[1]
	var validation := validate_signature_recipe(parts[1], recipe)
	if not validation["ok"] or validation["id"] != id:
		return null
	var base: String = parts[1]
	var cost := 0.0
	var units := 0.0
	for ing in recipe.keys():
		var n := float(recipe[ing])
		var ing_def: Dictionary = CoreData.find_ingredient(ing)
		cost += float(ing_def["cost"]) * n
		units += n
	var additions := float(recipe.size() - 1)
	var base_prep_time: float = float(CoreData.find_menu("blacktea")["prepTime"]) if base == "tea" else 1.2

	var flavor: Array = []
	if base == "coffee":
		flavor.append("roasted")
	elif base == "tea":
		flavor.append("fragrant")
	elif base == "milk":
		flavor.append("creamy")
	else:
		flavor.append("fruity")
	if recipe.has("sugar") and float(recipe["sugar"]) != 0.0:
		flavor.append("sweet" if float(recipe["sugar"]) == 2.0 else "lightly sweet")
	if ((recipe.has("milk") and float(recipe["milk"]) != 0.0) or (recipe.has("cream") and float(recipe["cream"]) != 0.0)) and base != "milk":
		flavor.append("creamy")
	if recipe.has("cocoa") and float(recipe["cocoa"]) != 0.0:
		flavor.append("chocolate")
	if recipe.has("spice") and float(recipe["spice"]) != 0.0:
		flavor.append("spiced")
	if recipe.has("matcha") and float(recipe["matcha"]) != 0.0:
		flavor.append("earthy")
	if recipe.has("fruit") and float(recipe["fruit"]) != 0.0 and base != "fruit":
		flavor.append("fruity")

	var q_raw := (4.0
		+ (0.1 if additions == 1.0 else 0.0)
		+ (0.2 if ((recipe.has("milk") and float(recipe["milk"]) == 2.0) or (recipe.has("cream") and float(recipe["cream"]) == 2.0)) else 0.0)
		- (0.2 if (recipe.has("sugar") and float(recipe["sugar"]) == 2.0) else 0.0)
		- (0.1 if (recipe.has("spice") and float(recipe["spice"]) == 2.0) else 0.0)
		- (0.1 if additions == 3.0 else 0.0))
	var quality := JsMath.js_round(JsMath.js_max(3.7, JsMath.js_min(4.3, q_raw)) * 10.0) / 10.0

	var feedback: Array = []
	if additions == 0.0:
		feedback.append("A clean, base-forward drink.")
	elif additions >= 3.0:
		feedback.append("Layered flavors take longer to prepare.")
	else:
		feedback.append("A focused blend with a clear base.")
	if recipe.has("sugar") and float(recipe["sugar"]) == 2.0:
		feedback.append("Extra sugar makes this noticeably sweeter.")
	if recipe.has("cream") and float(recipe["cream"]) == 2.0:
		feedback.append("Double cream gives a rich finish.")
	if recipe.has("spice") and float(recipe["spice"]) == 2.0:
		feedback.append("Double spice creates a bold, warming finish.")

	var base_price := JsMath.js_round((cost * 1.6 + 2.0) * 100.0) / 100.0
	var prep_time := JsMath.js_round((base_prep_time + 0.35 * (units - 1.0) + 0.25 * additions) * 100.0) / 100.0

	return {
		"id": validation["id"],
		"base": base,
		"category": "coffee" if base == "coffee" else "tea",
		"recipe": recipe,
		"cost": cost,
		"basePrice": base_price,
		"prepTime": prep_time,
		"baseCost": 0.0,
		"quality": quality,
		"flavor": flavor,
		"feedback": feedback,
	}

static func is_signature_id(id: Variant) -> bool:
	return (id is String) and signature_definition(id) != null

static func available_signature_ingredients(state: Dictionary) -> Array:
	var available := {"milk": true, "sugar": true}
	var items: Dictionary = state["items"]
	var has_kitchen := bool(state["kitchen"])
	var recipes := CoreData.RECIPES
	for m in CoreData.MENU:
		var mid: String = m["id"]
		var lv_ok := items.has(mid) and JsUtil.is_number(items[mid]) and float(items[mid]) > 0.0
		if not lv_ok:
			continue
		if not has_kitchen and (not CoreData.is_drink(m["category"]) or mid == "affogato" or mid == "matchafloat"):
			continue
		var rec: Dictionary = recipes[mid]
		for ing in rec.keys():
			available[ing] = true
	var out: Array = []
	for ing_def in CoreData.INGREDIENTS:
		if available.has(ing_def["id"]):
			out.append(ing_def["id"])
	return out

static func _unlocked(state: Dictionary, def: Dictionary) -> bool:
	var avail := available_signature_ingredients(state)
	var recipe: Dictionary = def["recipe"]
	for ing in recipe.keys():
		if not avail.has(ing):
			return false
	return true

static func trial_signature(state: Dictionary, base: Variant, recipe: Variant) -> Dictionary:
	if state["phase"] != "prep":
		return {"ok": false, "error": "open", "missing": {}}
	var validation := validate_signature_recipe(base, recipe)
	if not validation["ok"]:
		var res := validation.duplicate(false)
		res["missing"] = {}
		return res
	var def: Dictionary = signature_definition(validation["id"])
	if not _unlocked(state, def):
		var res := validation.duplicate(false)
		res["ok"] = false
		res["error"] = "locked"
		res["missing"] = {}
		return res
	var missing: Dictionary = {}
	var pantry: Dictionary = state["pantry"]
	var portion := SIGNATURE_TRIAL_PORTION
	var def_recipe: Dictionary = def["recipe"]
	for ing in def_recipe.keys():
		var n := float(def_recipe[ing])
		var raw_have = pantry[ing] if pantry.has(ing) else JsUtil.UNDEFINED
		var have: float = JsMath.js_max(0.0, float(raw_have)) if (JsUtil.is_number(raw_have) and is_finite(float(raw_have))) else 0.0
		if have < n * portion:
			missing[ing] = n * portion - have
	if not missing.is_empty():
		var res := validation.duplicate(false)
		res["ok"] = false
		res["error"] = "stock"
		res["missing"] = missing
		return res
	for ing in def_recipe.keys():
		var n := float(def_recipe[ing])
		pantry[ing] = float(pantry[ing]) - n * portion
	if not state.has("signatureDrinks") or JsUtil.is_nullish(state["signatureDrinks"]):
		state["signatureDrinks"] = empty_signature_drinks()
	var signatures: Dictionary = state["signatureDrinks"]
	if not signatures["tested"].has(def["id"]):
		signatures["tested"].append(def["id"])
	var ok_res := validation.duplicate(false)
	ok_res["missing"] = {}
	return ok_res

static func list_signature_drinks(state: Dictionary) -> Array:
	if state.has("signatureDrinks") and state["signatureDrinks"] is Dictionary:
		return state["signatureDrinks"]["recipes"]
	return []

static func save_signature(state: Dictionary, id: Variant, name: Variant) -> bool:
	var def = signature_definition(id)
	var title := _clean_name(name)
	var sig = state["signatureDrinks"] if state.has("signatureDrinks") else null
	if state["phase"] != "prep" or def == null or title.is_empty() or not (sig is Dictionary):
		return false
	if not sig["tested"].has(id) or not _unlocked(state, def):
		return false
	var recipes: Array = sig["recipes"]
	if float(recipes.size()) >= MAX_SIGNATURE_RECIPES:
		return false
	for r in recipes:
		if r["id"] == id:
			return false
	recipes.append({"id": def["id"], "name": title, "onMenu": false})
	return true

static func replace_signature(state: Dictionary, old_id: Variant, new_id: Variant, name: Variant) -> bool:
	if state["phase"] != "prep" or not state.has("signatureDrinks") or not (state["signatureDrinks"] is Dictionary):
		return false
	var signatures: Dictionary = state["signatureDrinks"]
	var recipes: Array = signatures["recipes"]
	var index := -1
	for i in range(recipes.size()):
		if recipes[i]["id"] == old_id:
			index = i
			break
	var def = signature_definition(new_id)
	var title := _clean_name(name)
	if index < 0 or def == null or title.is_empty() or not signatures["tested"].has(new_id) or not _unlocked(state, def):
		return false
	for i in range(recipes.size()):
		if i != index and recipes[i]["id"] == new_id:
			return false
	recipes[index] = {"id": def["id"], "name": title, "onMenu": recipes[index]["onMenu"]}
	if old_id != new_id and state.has("trialSales") and state["trialSales"] is Dictionary and state["trialSales"]["selected"] == old_id:
		state["trialSales"]["selected"] = null
	return true

static func rename_signature(state: Dictionary, id: Variant, name: Variant) -> bool:
	var recipe: Variant = null
	for r in list_signature_drinks(state):
		if r["id"] == id:
			recipe = r
			break
	var title := _clean_name(name)
	if state["phase"] != "prep" or recipe == null or title.is_empty():
		return false
	recipe["name"] = title
	return true

static func delete_signature(state: Dictionary, id: Variant) -> bool:
	if state["phase"] != "prep" or not state.has("signatureDrinks") or not (state["signatureDrinks"] is Dictionary):
		return false
	var recipes: Array = state["signatureDrinks"]["recipes"]
	var index := -1
	for i in range(recipes.size()):
		if recipes[i]["id"] == id:
			index = i
			break
	if index < 0:
		return false
	recipes.remove_at(index)
	if state.has("trialSales") and state["trialSales"] is Dictionary and state["trialSales"]["selected"] == id:
		state["trialSales"]["selected"] = null
	return true

static func set_signature_on_menu(state: Dictionary, id: Variant, on_menu: bool) -> bool:
	var recipes := list_signature_drinks(state)
	var recipe: Variant = null
	for r in recipes:
		if r["id"] == id:
			recipe = r
			break
	if state["phase"] != "prep" or recipe == null:
		return false
	if on_menu and not bool(recipe["onMenu"]):
		var on_count := 0
		for r in recipes:
			if bool(r["onMenu"]):
				on_count += 1
		if float(on_count) >= MAX_SIGNATURE_MENU or not _unlocked(state, signature_definition(id)):
			return false
	recipe["onMenu"] = on_menu
	if on_menu and state.has("trialSales") and state["trialSales"] is Dictionary and state["trialSales"]["selected"] == id:
		state["trialSales"]["selected"] = null
	return true

static func parse_signature_drinks(value: Variant) -> Dictionary:
	var out := empty_signature_drinks()
	if not _record(value):
		return out
	var v: Dictionary = value
	if v.has("tested") and v["tested"] is Array:
		for id in v["tested"]:
			if id is String and signature_definition(id) != null and not out["tested"].has(id):
				out["tested"].append(id)
	if v.has("served") and _record(v["served"]):
		var srv: Dictionary = v["served"]
		for id in JsUtil.own_keys(srv):
			var n = srv[id]
			if signature_definition(id) != null and JsUtil.is_number(n) and JsMath.is_safe_integer(n) and float(n) > 0.0:
				out["served"][id] = JsMath.js_min(1000000000.0, float(n))
	if v.has("recipes") and v["recipes"] is Array:
		var max_rec := int(MAX_SIGNATURE_RECIPES)
		var max_menu := int(MAX_SIGNATURE_MENU)
		for recipe in v["recipes"]:
			if out["recipes"].size() >= max_rec:
				break
			if not _record(recipe) or not recipe.has("id") or not (recipe["id"] is String):
				continue
			var def = signature_definition(recipe["id"])
			var nm := _clean_name(recipe["name"] if recipe.has("name") else JsUtil.UNDEFINED)
			if def == null or nm.is_empty() or not out["tested"].has(def["id"]):
				continue
			var dup := false
			for existing in out["recipes"]:
				if existing["id"] == def["id"]:
					dup = true
					break
			if dup:
				continue
			var on_count := 0
			for existing in out["recipes"]:
				if bool(existing["onMenu"]):
					on_count += 1
			var is_on: bool = recipe.has("onMenu") and (recipe["onMenu"] is bool) and recipe["onMenu"] == true and on_count < max_menu
			out["recipes"].append({"id": def["id"], "name": nm, "onMenu": is_on})
	return out
