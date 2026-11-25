class_name CorePets
extends RefCounted

# Port of src/game/pets.ts

static var _EPSILON_READY: bool = false
static var _EPSILON: float

static func _eps() -> float:
	if not _EPSILON_READY:
		_EPSILON_READY = true
		_EPSILON = JsMath.parse_float("1e-8")
	return _EPSILON

static func _sec() -> Dictionary:
	return RulesData.section("pets")

static var MAX_PETS: float = RulesData.section("pets")["MAX_PETS"]
static var CAT_GROUPS: Array = RulesData.section("pets")["CAT_GROUPS"]
static var CATS: Array = RulesData.section("pets")["CATS"]
static var CAT_PERSONALITIES: Array = RulesData.section("pets")["CAT_PERSONALITIES"]
static var CAT_AREAS: Array = RulesData.section("pets")["CAT_AREAS"]
static var CAT_SPOTS: Array = RulesData.section("pets")["CAT_SPOTS"]
static var CARE_SECONDS: float = RulesData.section("pets")["CARE_SECONDS"]
static var MAX_CARE_SECONDS: float = RulesData.section("pets")["MAX_CARE_SECONDS"]
static func _DEFAULT_PREFERENCES() -> Dictionary: return _sec()["DEFAULT_PREFERENCES"]

static func pet_preferences(pet: Dictionary) -> Dictionary:
	var def: Dictionary = _DEFAULT_PREFERENCES()[pet["id"]]
	var pers = pet["personality"] if pet.has("personality") else JsUtil.UNDEFINED
	var area = pet["preferredArea"] if pet.has("preferredArea") else JsUtil.UNDEFINED
	var spot = pet["preferredSpot"] if pet.has("preferredSpot") else JsUtil.UNDEFINED
	return {
		"personality": pers if (pers is String and CAT_PERSONALITIES.has(pers)) else def["personality"],
		"preferredArea": area if (area is String and CAT_AREAS.has(area)) else def["preferredArea"],
		"preferredSpot": spot if (spot is String and CAT_SPOTS.has(spot)) else def["preferredSpot"],
	}

static func cat_def(id: Variant) -> Variant:
	if not (id is String):
		return JsUtil.UNDEFINED
	for cat in CATS:
		if cat["id"] == id:
			return cat
	return JsUtil.UNDEFINED

static func pet_active(pet: Dictionary) -> bool:
	return float(pet["careSeconds"]) > _eps()

static func pet_traffic(state: Dictionary) -> float:
	var total := 0.0
	for pet in state["pets"]:
		if pet_active(pet):
			total += float(cat_def(pet["id"])["traffic"])
	return 1.0 + total

static func forecast_pet_traffic(state: Dictionary) -> float:
	var reserve := float(state["coins"])
	var total := 0.0
	for pet in state["pets"]:
		var cat: Dictionary = cat_def(pet["id"])
		if pet_active(pet):
			total += float(cat["traffic"])
			continue
		if not bool(pet["autoRefill"]) or reserve < float(cat["careCost"]):
			continue
		reserve -= float(cat["careCost"])
		total += float(cat["traffic"])
	return 1.0 + total

static func adopt_cat(state: Dictionary, id: Variant) -> bool:
	var cat = cat_def(id)
	var pets: Array = state["pets"]
	var foster: Variant = null
	for p in pets:
		if p["id"] == id and p.has("fosterUntilDay") and JsUtil.is_number(p["fosterUntilDay"]) and not is_nan(float(p["fosterUntilDay"])) and float(p["fosterUntilDay"]) != 0.0:
			foster = p
			break
	if not JsUtil.is_undefined(cat) and foster != null and state["phase"] == "prep" and float(state["coins"]) >= float(cat["adoption"]):
		state["coins"] = float(state["coins"]) - float(cat["adoption"])
		foster.erase("fosterUntilDay")
		foster["autoRefill"] = true
		return true
	if JsUtil.is_undefined(cat) or float(pets.size()) >= MAX_PETS or state["phase"] != "prep":
		return false
	for p in pets:
		if p["id"] == id:
			return false
	if float(state["coins"]) < float(cat["adoption"]):
		return false
	state["coins"] = float(state["coins"]) - float(cat["adoption"])
	var prefs := pet_preferences({"id": cat["id"]})
	pets.append({
		"id": cat["id"],
		"careSeconds": CARE_SECONDS,
		"autoRefill": true,
		"personality": prefs["personality"],
		"preferredArea": prefs["preferredArea"],
		"preferredSpot": prefs["preferredSpot"],
	})
	return true

static func refill_pet(state: Dictionary, id: Variant) -> bool:
	var pet: Variant = null
	for p in state["pets"]:
		if p["id"] == id:
			pet = p
			break
	var cat = cat_def(id)
	if pet == null or JsUtil.is_undefined(cat):
		return false
	var care := CARE_SECONDS
	var max_care := MAX_CARE_SECONDS
	if float(pet["careSeconds"]) + care > max_care + _eps() or float(state["coins"]) < float(cat["careCost"]):
		return false
	state["coins"] = float(state["coins"]) - float(cat["careCost"])
	pet["careSeconds"] = JsMath.js_min(max_care, float(pet["careSeconds"]) + care)
	return true

static func update_pet_care(state: Dictionary, dt: float) -> void:
	if state["phase"] != "open" or not is_finite(dt) or dt <= 0.0:
		return
	var e := _eps()
	var care := CARE_SECONDS
	for pet in state["pets"]:
		if pet.has("fosterUntilDay") and JsUtil.is_number(pet["fosterUntilDay"]) and not is_nan(float(pet["fosterUntilDay"])) and float(pet["fosterUntilDay"]) != 0.0:
			continue
		var cat: Dictionary = cat_def(pet["id"])
		var remaining := dt
		while remaining > e:
			if not pet_active(pet):
				pet["careSeconds"] = 0.0
				if not bool(pet["autoRefill"]) or not refill_pet(state, pet["id"]):
					break
			var used := JsMath.js_min(remaining, float(pet["careSeconds"]))
			pet["careSeconds"] = JsMath.js_max(0.0, float(pet["careSeconds"]) - used)
			remaining -= used
			state["today"]["petCost"] = float(state["today"]["petCost"]) + used / care * float(cat["careCost"])

static func parse_pets(value: Variant) -> Array:
	if not (value is Array):
		return []
	var result: Array = []
	var max_p := int(MAX_PETS)
	var max_care := MAX_CARE_SECONDS
	for entry in value:
		if result.size() >= max_p:
			break
		if not (entry is Dictionary):
			continue
		var p: Dictionary = entry
		var raw_id = p["id"] if p.has("id") else JsUtil.UNDEFINED
		var cat = cat_def(raw_id) if (raw_id is String) else JsUtil.UNDEFINED
		if JsUtil.is_undefined(cat):
			continue
		var dup := false
		for existing in result:
			if existing["id"] == cat["id"]:
				dup = true
				break
		if dup:
			continue
		var raw_care = p["careSeconds"] if p.has("careSeconds") else JsUtil.UNDEFINED
		var care := float(raw_care) if (JsUtil.is_number(raw_care) and is_finite(float(raw_care))) else 0.0
		var obj: Dictionary = {
			"id": cat["id"],
			"careSeconds": JsMath.js_max(0.0, JsMath.js_min(max_care, care)),
			"autoRefill": p.has("autoRefill") and (p["autoRefill"] is bool) and p["autoRefill"] == true,
		}
		if p.has("fosterUntilDay") and JsUtil.is_number(p["fosterUntilDay"]) and JsMath.is_safe_integer(p["fosterUntilDay"]) and float(p["fosterUntilDay"]) > 0.0:
			obj["fosterUntilDay"] = float(p["fosterUntilDay"])
		var pref_in: Dictionary = {"id": cat["id"]}
		if p.has("personality"):
			pref_in["personality"] = p["personality"]
		if p.has("preferredArea"):
			pref_in["preferredArea"] = p["preferredArea"]
		if p.has("preferredSpot"):
			pref_in["preferredSpot"] = p["preferredSpot"]
		var prefs := pet_preferences(pref_in)
		obj["personality"] = prefs["personality"]
		obj["preferredArea"] = prefs["preferredArea"]
		obj["preferredSpot"] = prefs["preferredSpot"]
		result.append(obj)
	return result
