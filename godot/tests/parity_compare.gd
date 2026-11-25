class_name ParityCompare
extends RefCounted

# Bit-exact comparator and deterministic counted RNG for TS <-> GDScript parity tests.
# Zero tolerance: floats are compared by 64-bit IEEE 754 hex representation (-0 != +0, NaN == NaN).

class CountedRng extends RefCounted:
	var _state: int
	var draws: int = 0

	func _init(seed_val: int) -> void:
		_state = seed_val & 0xffffffff

	func next_float() -> float:
		draws += 1
		_state = JsMath.ushr_i(JsMath.imul_i(_state, 1664525) + 1013904223, 0)
		return float(_state) / 4294967296.0

## Empty when equal. Containers with the same bytes are equal in every value, key and key order.
static func diff(expected: Variant, actual: Variant, path: String = "$") -> String:
	if expected is Array or expected is Dictionary:
		if typeof(expected) == typeof(actual) and var_to_bytes(expected) == var_to_bytes(actual):
			return ""
	var eu := JsUtil.is_undefined(expected)
	var au := JsUtil.is_undefined(actual)
	if eu or au:
		if eu and au:
			return ""
		return "%s: expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]

	if expected == null or actual == null:
		if expected == null and actual == null:
			return ""
		return "%s: expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]

	if expected is bool or actual is bool:
		if expected is bool and actual is bool and expected == actual:
			return ""
		return "%s: expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]

	if JsUtil.is_number(expected) or JsUtil.is_number(actual):
		if not (JsUtil.is_number(expected) and JsUtil.is_number(actual)):
			return "%s: type mismatch expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]
		var eh := JsMath.float_to_hex(float(expected))
		var ah := JsMath.float_to_hex(float(actual))
		if eh != ah:
			return "%s: float bits mismatch expected=%s (0x%s) actual=%s (0x%s)" % [
				path, JsMath.number_to_string(float(expected)), eh,
				JsMath.number_to_string(float(actual)), ah,
			]
		return ""

	if expected is String or actual is String:
		if expected is String and actual is String and expected == actual:
			return ""
		if expected is String and actual is String:
			var at := 0
			while at < mini(expected.length(), actual.length()) and expected[at] == actual[at]:
				at += 1
			return "%s: text differs at %d expected=…%s… actual=…%s…" % [path, at, expected.substr(maxi(0, at - 60), 120), actual.substr(maxi(0, at - 60), 120)]
		return "%s: string mismatch expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]

	if expected is Array or actual is Array:
		if not (expected is Array and actual is Array):
			return "%s: array type mismatch expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]
		if expected.size() != actual.size():
			return "%s.length: expected=%d actual=%d" % [path, expected.size(), actual.size()]
		for i in range(expected.size()):
			var d := diff(expected[i], actual[i], "%s[%d]" % [path, i])
			if not d.is_empty():
				return d
		return ""

	if expected is Dictionary or actual is Dictionary:
		if not (expected is Dictionary and actual is Dictionary):
			return "%s: object type mismatch expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]
		for k in expected.keys():
			if not actual.has(k):
				return "%s.%s: missing key in actual (expected=%s)" % [path, str(k), _fmt(expected[k])]
		for k in actual.keys():
			if not expected.has(k):
				return "%s.%s: extra key in actual (actual=%s)" % [path, str(k), _fmt(actual[k])]
		for k in expected.keys():
			var d := diff(expected[k], actual[k], "%s.%s" % [path, str(k)])
			if not d.is_empty():
				return d
		# JavaScript keeps insertion order (index-like keys first), and saves are written in it.
		if JsUtil.own_keys(expected) != JsUtil.own_keys(actual):
			return "%s: key order expected=%s actual=%s" % [path, str(JsUtil.own_keys(expected)), str(JsUtil.own_keys(actual))]
		return ""

	if expected != actual:
		return "%s: expected=%s actual=%s" % [path, _fmt(expected), _fmt(actual)]
	return ""

static func _fmt(v: Variant) -> String:
	if JsUtil.is_undefined(v):
		return "undefined"
	if v == null:
		return "null"
	if v is bool:
		return "true" if v else "false"
	if JsUtil.is_number(v):
		return "%s (0x%s)" % [JsMath.number_to_string(float(v)), JsMath.float_to_hex(float(v))]
	if v is String:
		return JsJson.stringify(v)
	if v is Array:
		return "Array(len=%d)" % v.size()
	if v is Dictionary:
		return "Object(keys=%s)" % str(v.keys())
	return str(v)
