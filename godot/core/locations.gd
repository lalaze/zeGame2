class_name CoreLocations
extends RefCounted

# Port of src/game/locations.ts

static var LOCATIONS: Array = RulesData.section("locations")["LOCATIONS"]
static var LOCATION_IDS: Array = RulesData.section("locations")["LOCATION_IDS"]
static var SPECIALTY_WEIGHT: float = RulesData.section("locations")["SPECIALTY_WEIGHT"]
static var SPECIALTY_PRICE_BONUS: float = RulesData.section("locations")["SPECIALTY_PRICE_BONUS"]

static func is_location(id: Variant) -> bool:
	if not (id is String):
		return false
	return LOCATION_IDS.has(id)

static func location_def(id: Variant) -> Variant:
	if not (id is String):
		return JsUtil.UNDEFINED
	for l in LOCATIONS:
		if l["id"] == id:
			return l
	return JsUtil.UNDEFINED

static func cafe_location(state: Dictionary) -> String:
	if state.has("chain") and state["chain"] is Dictionary:
		var chain: Dictionary = state["chain"]
		if chain.has("location") and not JsUtil.is_nullish(chain["location"]):
			return str(chain["location"])
	return "town"

static func is_specialty(state: Dictionary, id: Variant) -> bool:
	var def: Dictionary = location_def(cafe_location(state))
	var specs: Array = def["specialties"]
	return specs.has(id)

static func specialty_weight(state: Dictionary, id: Variant) -> float:
	return SPECIALTY_WEIGHT if is_specialty(state, id) else 1.0

static func specialty_price_multiplier(state: Dictionary, id: Variant) -> float:
	return (1.0 + SPECIALTY_PRICE_BONUS) if is_specialty(state, id) else 1.0
