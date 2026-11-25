class_name CoreCustomerCast
extends RefCounted

# Port of src/game/customer-cast.ts

static var CUSTOMER_CAST: Array = RulesData.section("customer-cast")["CUSTOMER_CAST"]

static func valid_customer_cast_snapshot(value: Variant) -> bool:
	if not (value is Dictionary):
		return false
	var s: Dictionary = value
	if not s.has("previous") or not s.has("remaining"):
		return false
	var prev = s["previous"]
	var rem = s["remaining"]
	var cast_len := float(CUSTOMER_CAST.size())
	if not JsUtil.is_number(prev) or not JsMath.is_integer(prev):
		return false
	var prev_f := float(prev)
	if prev_f < -1.0 or prev_f >= cast_len:
		return false
	if not (rem is Array) or float(rem.size()) > cast_len:
		return false
	var seen: Dictionary = {}
	for id in rem:
		if not JsUtil.is_number(id) or not JsMath.is_integer(id):
			return false
		var id_f := float(id)
		if id_f < 0.0 or id_f >= cast_len or id_f == prev_f:
			return false
		var key := int(id_f)
		if seen.has(key):
			return false
		seen[key] = true
	return true

class CustomerCastCycle extends RefCounted:
	var _remaining: Array = []
	var _previous: float = -1.0
	var _random: Callable

	func _init(random_fn: Callable) -> void:
		_random = random_fn

	func snapshot() -> Dictionary:
		return {
			"remaining": _remaining.duplicate(false),
			"previous": _previous,
		}

	func restore(value: Variant) -> bool:
		if not CoreCustomerCast.valid_customer_cast_snapshot(value):
			return false
		var d: Dictionary = value
		_remaining = []
		for id in d["remaining"]:
			_remaining.append(float(id))
		_previous = float(d["previous"])
		return true

	func next() -> Dictionary:
		var cast := CoreCustomerCast.CUSTOMER_CAST
		if _remaining.is_empty():
			_remaining = []
			for c in cast:
				_remaining.append(float(c["id"]))
			for i in range(_remaining.size() - 1, 0, -1):
				var r := float(_random.call())
				var fl: float = floor(r * float(i + 1))
				var j_f: float = JsMath.js_min(float(i), JsMath.js_max(0.0, fl))
				var j := int(j_f)
				var tmp = _remaining[i]
				_remaining[i] = _remaining[j]
				_remaining[j] = tmp
			var last := _remaining.size() - 1
			if float(_remaining[last]) == _previous:
				var tmp = _remaining[0]
				_remaining[0] = _remaining[last]
				_remaining[last] = tmp
		_previous = float(_remaining.pop_back())
		return cast[int(_previous)]
