class_name CoreCustomerDemand
extends RefCounted

# Port of src/game/customer-demand.ts

const _BASE_COVERAGE: float = 0.625 # exact binary 5/8
static var _consts_ready: bool = false
static var _AUDIENCES: Dictionary = {}
static var _C015: float
static var _C025: float
static var _C030: float
static var _C035: float
static var _C040: float
static var _C045: float
static var _C060: float
static var _C065: float
static var _C070: float
static var _C080: float
static var _C085: float
static var _C120: float
static var _C135: float

static func _ensure_consts() -> void:
	if _consts_ready:
		return
	_consts_ready = true
	_C015 = 0.15
	_C025 = 0.25
	_C030 = 0.3
	_C035 = 0.35
	_C040 = 0.4
	_C045 = 0.45
	_C060 = 0.6
	_C065 = 0.65
	_C070 = 0.7
	_C080 = 0.8
	_C085 = 0.85
	_C120 = 1.2
	_C135 = 1.35
	var c02 := 0.2
	_AUDIENCES = {
		"fair": [0.5, _C030, c02],
		"rain": [_C030, _C040, _C030],
		"hot": [_C035, 0.5, _C015],
		"crisp": [_C060, c02, c02],
		"market": [_C065, _C015, c02],
		"quiet": [0.25, _C035, _C040],
	}

static var GUEST_KINDS: Array = RulesData.section("customer-demand")["GUEST_KINDS"]

static func demand_enabled(state: Dictionary) -> bool:
	return float(state["day"]) >= 3.0

static func is_guest_kind(value: Variant) -> bool:
	return (value is String) and GUEST_KINDS.has(value)

static func guest_affinity(kind: String, item: Dictionary) -> float:
	_ensure_consts()
	var flavors := CoreFlavors.item_flavors(item["id"])
	var drink := CoreData.is_drink(item["category"])
	if kind == "commuter":
		if not drink:
			return _C080 if item["category"] == "bread" else _C045
		var pt := float(item["prepTime"])
		if pt <= 3.0 and flavors.has("bold"):
			return 1.0
		if pt <= 3.0 and flavors.has("tea"):
			return _C060
		return _C030
	if kind == "leisure":
		if not drink:
			return _C070 if item["category"] == "pastry" else _C040
		for fl in flavors:
			if fl == "milky" or fl == "sweet" or fl == "cocoa" or fl == "fruity":
				return 1.0
		return _C035 if flavors.has("tea") else _C025
	if not drink:
		return _C085 if item["category"] == "pastry" else _C065
	if flavors.has("tea"):
		return 1.0
	for fl in flavors:
		if fl == "milky" or fl == "sweet" or fl == "cocoa" or fl == "fruity":
			return _C040
	return _C025

static func demand_plan(state: Dictionary, items: Array) -> Dictionary:
	_ensure_consts()
	if items.is_empty():
		return {"traffic": 0.0, "guests": [], "mains": []}
	var weather_raw = CoreConditions.menu_weights(state, items)
	var weather: Array = []
	if weather_raw == null:
		weather.resize(items.size())
		for i in range(items.size()):
			weather[i] = 1.0
	else:
		weather = weather_raw

	if not demand_enabled(state):
		var w_sum := 0.0
		for w in weather:
			w_sum += float(w)
		var mains_early: Array = []
		for i in range(items.size()):
			mains_early.append({
				"main": items[i],
				"probability": float(weather[i]) / w_sum,
			})
		var v_bonus := JsMath.js_min(CoreData.MAX_VARIETY_BONUS, CoreData.VARIETY_BONUS * JsMath.js_max(0.0, float(items.size() - 1)))
		return {
			"traffic": 1.0 + v_bonus,
			"guests": [],
			"mains": mains_early,
		}

	var cond_id: String = CoreConditions.today_condition(state)["id"]
	var audiences: Array = _AUDIENCES[cond_id]
	var kinds := GUEST_KINDS
	var affinities: Array = []
	var covered: Array = []
	var total := 0.0
	for i in range(kinds.size()):
		var scores: Array = []
		var mx := -INF
		for item in items:
			var sc := guest_affinity(kinds[i], item)
			scores.append(sc)
			if sc > mx:
				mx = sc
		affinities.append(scores)
		var cov := mx * float(audiences[i])
		covered.append(cov)
		total += cov

	var guests: Array = []
	var mains: Array = []
	for i in range(kinds.size()):
		var mx := -INF
		for sc in affinities[i]:
			if float(sc) > mx:
				mx = float(sc)
		var share := float(covered[i]) / total
		var guest := {
			"kind": kinds[i],
			"audience": float(audiences[i]),
			"coverage": mx,
			"share": share,
		}
		guests.append(guest)
		var weights: Array = []
		var wsum := 0.0
		for n in range(items.size()):
			var w := JsMath.js_pow(float(affinities[i][n]), 3.0) * float(weather[n])
			weights.append(w)
			wsum += w
		for n in range(items.size()):
			mains.append({
				"kind": kinds[i],
				"main": items[n],
				"probability": share * float(weights[n]) / wsum,
			})
	return {
		"traffic": total / _BASE_COVERAGE,
		"guests": guests,
		"mains": mains,
	}

static func guest_combo_chance(kind: Variant, style_chance: float) -> float:
	_ensure_consts()
	var ordinary: float
	if kind is String and kind == "commuter":
		ordinary = _C015
	elif kind is String and kind == "leisure":
		ordinary = _C040
	elif kind is String and kind == "teaTime":
		ordinary = _C065
	else:
		ordinary = CoreData.COMBO_CHANCE
	var raw := ordinary + style_chance - CoreData.COMBO_CHANCE
	if is_nan(raw):
		return NAN
	return JsMath.js_max(0.0, JsMath.js_min(_C085, raw))

static func guest_pair_weights(state: Dictionary, kind: Variant, items: Array) -> Array:
	if JsUtil.is_nullish(kind) or not (kind is String) or kind.is_empty():
		var ones: Array = []
		ones.resize(items.size())
		for i in range(items.size()):
			ones[i] = 1.0
		return ones
	var weather = CoreConditions.menu_weights(state, items)
	var out: Array = []
	for i in range(items.size()):
		var w := float(weather[i]) if weather != null else 1.0
		out.append(JsMath.js_pow(guest_affinity(kind, items[i]), 3.0) * w)
	return out

static func guest_seating_multiplier(kind: Variant = JsUtil.UNDEFINED) -> float:
	_ensure_consts()
	if kind is String:
		if kind == "commuter":
			return _C025
		if kind == "leisure":
			return _C120
		if kind == "teaTime":
			return _C135
	return 1.0

static func empty_guest_stats() -> Dictionary:
	var out: Dictionary = {}
	for kind in GUEST_KINDS:
		out[kind] = {
			"arrived": 0.0,
			"served": 0.0,
			"paired": 0.0,
			"stockLost": 0.0,
			"waitLost": 0.0,
			"cancelled": 0.0,
			"dismissed": 0.0,
			"revenue": 0.0,
		}
	return out

static func _object(value: Variant) -> bool:
	return value is Dictionary

static func _count(value: Variant) -> float:
	if JsUtil.is_number(value) and JsMath.is_safe_integer(value) and float(value) >= 0.0:
		return JsMath.js_min(1000000000.0, float(value))
	return 0.0

static func parse_guest_stats(value: Variant) -> Dictionary:
	var result := empty_guest_stats()
	if not _object(value):
		return result
	var v: Dictionary = value
	for kind in GUEST_KINDS:
		if not v.has(kind) or not _object(v[kind]):
			continue
		var raw: Dictionary = v[kind]
		var stats: Dictionary = result[kind]
		stats["arrived"] = _count(raw["arrived"] if raw.has("arrived") else JsUtil.UNDEFINED)
		var remaining := float(stats["arrived"])
		for key in ["served", "stockLost", "waitLost", "cancelled", "dismissed"]:
			var c := JsMath.js_min(remaining, _count(raw[key] if raw.has(key) else JsUtil.UNDEFINED))
			stats[key] = c
			remaining -= c
		stats["paired"] = JsMath.js_min(float(stats["served"]), _count(raw["paired"] if raw.has("paired") else JsUtil.UNDEFINED))
		var raw_rev = raw["revenue"] if raw.has("revenue") else JsUtil.UNDEFINED
		if float(stats["served"]) > 0.0 and JsUtil.is_number(raw_rev) and is_finite(float(raw_rev)) and float(raw_rev) >= 0.0:
			stats["revenue"] = float(raw_rev)
		else:
			stats["revenue"] = 0.0
	return result
