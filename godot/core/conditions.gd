class_name CoreConditions
extends RefCounted

# Port of src/game/conditions.ts

const _ICED: Array[String] = ["coldbrew", "frappe", "smoothie", "affogato", "matchafloat"]
static var _by_id: Dictionary = {}
static var _by_id_ready: bool = false

static var CONDITIONS: Array = RulesData.section("conditions")["CONDITIONS"]
static var FIRST_CONDITION_DAY: float = RulesData.section("conditions")["FIRST_CONDITION_DAY"]
static var FAVORED_WEIGHT: float = RulesData.section("conditions")["FAVORED_WEIGHT"]
static var LESS_WEIGHT: float = RulesData.section("conditions")["LESS_WEIGHT"]

static func _ensure_by_id() -> void:
	if _by_id_ready:
		return
	_by_id_ready = true
	for c in CONDITIONS:
		_by_id[c["id"]] = c

static func condition_def(id: Variant) -> Variant:
	_ensure_by_id()
	if id is String and _by_id.has(id):
		return _by_id[id]
	return JsUtil.UNDEFINED

static func _roll(seed_val: float, day: float) -> float:
	var finite_seed := seed_val if is_finite(seed_val) else 0.0
	var s_mod := fmod(floor(absf(finite_seed)), 4294967296.0)
	var h := JsMath.bxor_i(JsMath.to_int32(s_mod), JsMath.imul_i(JsMath.to_int32(day), 0x9e3779b1 - 0x100000000))
	h = JsMath.imul_i(JsMath.bxor_i(h, JsMath.ushr_i(h, 16)), 0x85ebca6b - 0x100000000)
	h = JsMath.imul_i(JsMath.bxor_i(h, JsMath.ushr_i(h, 13)), 0xc2b2ae35 - 0x100000000)
	var u := JsMath.ushr_i(JsMath.bxor_i(h, JsMath.ushr_i(h, 16)), 0)
	return float(u) / 4294967296.0

static func _drawn(seed_val: float, day: float) -> String:
	if not JsMath.is_integer(day) or day < FIRST_CONDITION_DAY:
		return "fair"
	var conds := CONDITIONS
	var total := 0.0
	for c in conds:
		total += float(c["chance"])
	var left := _roll(seed_val, day) * total
	for c in conds:
		left -= float(c["chance"])
		if left < 0.0:
			return c["id"]
	return conds[0]["id"]

static func condition_on(state: Dictionary, day: float) -> String:
	var created_at := float(state["createdAt"])
	var id := _drawn(created_at, day)
	if id != "fair" and _drawn(created_at, day - 1.0) == id and _drawn(created_at, day - 2.0) == id:
		return "fair"
	return id

static func today_condition(state: Dictionary) -> Dictionary:
	_ensure_by_id()
	return _by_id[condition_on(state, float(state["day"]))]

static func _tastes(id: Variant) -> Dictionary:
	var def = CoreData.find_menu(id)
	if def == null:
		def = CoreSignatureDrinks.signature_definition(id)
	var out: Dictionary = {}
	for fl in CoreFlavors.item_flavors(id):
		out[fl] = true
	if id is String and _ICED.has(id):
		out["iced"] = true
	if def != null and not CoreData.is_drink(def["category"]):
		out["bakery"] = true
	return out

static func dish_mood(state: Dictionary, id: Variant) -> Variant:
	var condition := today_condition(state)
	var own := _tastes(id)
	for taste in condition["less"]:
		if own.has(taste):
			return "less"
	for taste in condition["favored"]:
		if own.has(taste):
			return "favored"
	return null

static func menu_weights(state: Dictionary, items: Array) -> Variant:
	var cond := today_condition(state)
	var weather: bool = (not cond["favored"].is_empty()) or (not cond["less"].is_empty())
	var loc_def: Dictionary = CoreLocations.location_def(CoreLocations.cafe_location(state))
	if not weather and loc_def["specialties"].is_empty():
		return null
	var weights: Array = []
	for item in items:
		var id = item["id"]
		var mood = dish_mood(state, id) if weather else null
		var w := 1.0
		if mood == "favored":
			w = FAVORED_WEIGHT
		elif mood == "less":
			w = LESS_WEIGHT
		weights.append(w * CoreLocations.specialty_weight(state, id))
	if weights.is_empty():
		return null
	var first: float = weights[0]
	var all_equal := true
	for w in weights:
		if float(w) != first:
			all_equal = false
			break
	return null if all_equal else weights

static func weighted_index(weights: Array, r: float) -> float:
	var total := 0.0
	for w in weights:
		total += float(w)
	var left := r * total
	for i in range(weights.size()):
		left -= float(weights[i])
		if left < 0.0:
			return float(i)
	return float(weights.size() - 1)

static func condition_traffic(state: Dictionary, items: Array) -> float:
	var condition := today_condition(state)
	var match_bonus := float(condition["matchBonus"])
	var matched := false
	if match_bonus > 0.0:
		for item in items:
			if dish_mood(state, item["id"]) == "favored":
				matched = true
				break
	return float(condition["traffic"]) * ((1.0 + match_bonus) if matched else 1.0)

static func condition_patience(state: Dictionary) -> float:
	return float(today_condition(state)["patience"])

static func condition_seating(state: Dictionary) -> float:
	return float(today_condition(state)["seating"])
