class_name CoreChainBonuses
extends RefCounted

# Port of src/game/chain-bonuses.ts

static var PLACE_BONUS: Dictionary = RulesData.section("chain-bonuses")["PLACE_BONUS"]
static var REPEAT_SHARE: float = RulesData.section("chain-bonuses")["REPEAT_SHARE"]
static var COMPLETE_BONUS: float = RulesData.section("chain-bonuses")["COMPLETE_BONUS"]
static var PERKS: Array = RulesData.section("chain-bonuses")["PERKS"]
static var PERK_TILL_HOURS: float = RulesData.section("chain-bonuses")["PERK_TILL_HOURS"]
static var PERK_BUILD_SHARE: float = RulesData.section("chain-bonuses")["PERK_BUILD_SHARE"]
static var PERK_CATERING_SHARE: float = RulesData.section("chain-bonuses")["PERK_CATERING_SHARE"]
static var PERK_AWAY_SHARE: float = RulesData.section("chain-bonuses")["PERK_AWAY_SHARE"]
static var PERK_GIFT_SHARE: float = RulesData.section("chain-bonuses")["PERK_GIFT_SHARE"]

static func franchises_in(state: Dictionary, place: String) -> float:
	var count := 0
	var franchises: Array = state["chain"]["franchises"]
	for f in franchises:
		if f["location"] == place:
			count += 1
	return float(count)

static func place_strength(count: float) -> float:
	return 0.0 if count <= 0.0 else 1.0 + (count - 1.0) * REPEAT_SHARE

static func places_covered(state: Dictionary) -> float:
	var count := 0
	for place in CoreLocations.LOCATION_IDS:
		if franchises_in(state, place) > 0.0:
			count += 1
	return float(count)

static func chain_complete(state: Dictionary) -> bool:
	return places_covered(state) == float(CoreLocations.LOCATION_IDS.size())

static func place_price_multiplier(state: Dictionary, category: String, flavors: Array) -> float:
	var share := COMPLETE_BONUS if chain_complete(state) else 0.0
	var pb := PLACE_BONUS
	for place in CoreLocations.LOCATION_IDS:
		var bonus: Dictionary = pb[place]
		if bonus["kind"] != "price":
			continue
		var fits := false
		if bonus.has("categories") and bonus["categories"].has(category):
			fits = true
		if not fits and bonus.has("flavors"):
			for f in bonus["flavors"]:
				if flavors.has(f):
					fits = true
					break
		if fits:
			share += float(bonus["share"]) * place_strength(franchises_in(state, place))
	return 1.0 + share

static func place_traffic_multiplier(state: Dictionary) -> float:
	var share := 0.0
	var pb := PLACE_BONUS
	for place in CoreLocations.LOCATION_IDS:
		var bonus: Dictionary = pb[place]
		if bonus["kind"] == "traffic":
			share += float(bonus["share"]) * place_strength(franchises_in(state, place))
	return 1.0 + share

static func extra_till_hours(state: Dictionary) -> float:
	var hours := PERK_TILL_HOURS if has_perk(state, "till") else 0.0
	var pb := PLACE_BONUS
	for place in CoreLocations.LOCATION_IDS:
		var bonus: Dictionary = pb[place]
		if bonus["kind"] == "till":
			hours += float(bonus["hours"]) * place_strength(franchises_in(state, place))
	return hours

static func is_perk(id: Variant) -> bool:
	if not (id is String):
		return false
	for p in PERKS:
		if p["id"] == id:
			return true
	return false

static func perk_def(id: Variant) -> Variant:
	if not (id is String):
		return JsUtil.UNDEFINED
	for p in PERKS:
		if p["id"] == id:
			return p
	return JsUtil.UNDEFINED

static func has_perk(state: Dictionary, id: String) -> bool:
	return state["chain"]["perks"].has(id)

static func stars_spent(state: Dictionary) -> float:
	var total := 0.0
	for id in state["chain"]["perks"]:
		total += float(perk_def(id)["cost"])
	return total

static func stars_free(state: Dictionary) -> float:
	return JsMath.js_max(0.0, float(state["chain"]["stars"]) - stars_spent(state))

static func perk_block(state: Dictionary, id: String) -> Variant:
	if has_perk(state, id):
		return "owned"
	if stars_free(state) < float(perk_def(id)["cost"]):
		return "stars"
	return null

static func buy_perk(state: Dictionary, id: String) -> bool:
	if perk_block(state, id) != null:
		return false
	state["chain"]["perks"].append(id)
	return true
