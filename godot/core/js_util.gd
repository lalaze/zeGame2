class_name JsUtil
extends RefCounted

# JavaScript semantic utilities for bit-exact GDScript ports.

class JsUndefined extends RefCounted:
	pass

static var UNDEFINED := JsUndefined.new()

static func is_undefined(v: Variant) -> bool:
	return v is JsUndefined

static func is_nullish(v: Variant) -> bool:
	return v == null or v is JsUndefined

static func is_number(v: Variant) -> bool:
	return v is float or v is int

static func is_plain_object(v: Variant) -> bool:
	return v is Dictionary

## What `value && typeof value === 'object'` lets through, as a Dictionary: an array is an object with index keys.
static func as_object(v: Variant) -> Variant:
	if v is Dictionary:
		return v
	if v is Array:
		var out := {}
		for i in v.size():
			out[str(i)] = v[i]
		return out
	return null

## `object[key]`, undefined when it is not there.
static func prop(o: Variant, key: String) -> Variant:
	return o[key] if o is Dictionary and o.has(key) else UNDEFINED

## Array.includes. Godot's `has` does not find 3.0 in [3], and `==` between different types can be an error.
static func includes(list: Array, v: Variant) -> bool:
	for x: Variant in list:
		if same_value_zero(x, v):
			return true
	return false

static func same_value_zero(a: Variant, b: Variant) -> bool:
	if is_number(a) and is_number(b):
		return a == b or is_nan(a) and is_nan(b)
	return typeof(a) == typeof(b) and (is_same(a, b) if a is Array or a is Dictionary else a == b)

static func truthy(v: Variant) -> bool:
	if v == null or v is JsUndefined:
		return false
	if v is bool:
		return v
	if is_number(v):
		return v != 0 and not is_nan(v)
	return not v.is_empty() if v is String else true

static func as_float(v: Variant) -> float:
	if v is float:
		return v
	if v is int:
		return float(v)
	return NAN

static func shallow_clone(d: Dictionary) -> Dictionary:
	return d.duplicate(false)

static func deep_clone(v: Variant) -> Variant:
	if v is Dictionary:
		var out := {}
		for k in v.keys():
			out[k] = deep_clone(v[k])
		return out
	if v is Array:
		var out := []
		out.resize(v.size())
		for i in range(v.size()):
			out[i] = deep_clone(v[i])
		return out
	return v

static func stable_sort(arr: Array, compare_fn: Callable = Callable()) -> Array:
	# In-place stable merge sort matching ES2019+ Array.prototype.sort.
	var n := arr.size()
	if n <= 1:
		return arr
	var aux := []
	aux.resize(n)
	var width := 1
	while width < n:
		var left := 0
		while left < n:
			var mid := mini(left + width, n)
			var right := mini(left + width * 2, n)
			var i := left
			var j := mid
			var k := left
			while i < mid and j < right:
				var cmp_val: float
				if compare_fn.is_valid():
					cmp_val = float(compare_fn.call(arr[i], arr[j]))
				else:
					cmp_val = _default_sort_cmp(arr[i], arr[j])
				if cmp_val > 0.0:
					aux[k] = arr[j]
					j += 1
				else:
					# <= 0 or NaN preserves original order (stable).
					aux[k] = arr[i]
					i += 1
				k += 1
			while i < mid:
				aux[k] = arr[i]
				i += 1
				k += 1
			while j < right:
				aux[k] = arr[j]
				j += 1
				k += 1
			for idx in range(left, right):
				arr[idx] = aux[idx]
			left += width * 2
		width *= 2
	return arr

static func _default_sort_cmp(a: Variant, b: Variant) -> float:
	var au := is_undefined(a)
	var bu := is_undefined(b)
	if au and bu:
		return 0.0
	if au:
		return 1.0
	if bu:
		return -1.0
	var sa := _to_js_string(a)
	var sb := _to_js_string(b)
	return _utf16_cmp(sa, sb)

static func _to_js_string(v: Variant) -> String:
	if v == null:
		return "null"
	if v is JsUndefined:
		return "undefined"
	if v is bool:
		return "true" if v else "false"
	if v is String:
		return v
	if v is float or v is int:
		return JsMath.number_to_string(float(v))
	return str(v)

static func _utf16_cmp(a: String, b: String) -> float:
	var la := a.length()
	var lb := b.length()
	var m := mini(la, lb)
	for i in range(m):
		var ca := a.unicode_at(i)
		var cb := b.unicode_at(i)
		if ca != cb:
			return -1.0 if ca < cb else 1.0
	if la != lb:
		return -1.0 if la < lb else 1.0
	return 0.0

static func is_js_whitespace(cp: int) -> bool:
	if cp == 0x20 or cp == 0x09 or cp == 0x0a or cp == 0x0b or cp == 0x0c or cp == 0x0d:
		return true
	if cp == 0xa0 or cp == 0x1680 or cp == 0x2028 or cp == 0x2029 or cp == 0x202f or cp == 0x205f or cp == 0x3000 or cp == 0xfeff:
		return true
	if cp >= 0x2000 and cp <= 0x200a:
		return true
	return false

static func js_trim(s: String) -> String:
	var n := s.length()
	var start := 0
	while start < n and is_js_whitespace(s.unicode_at(start)):
		start += 1
	var end := n
	while end > start and is_js_whitespace(s.unicode_at(end - 1)):
		end -= 1
	return s.substr(start, end - start)

static func strip_ascii_control(s: String) -> String:
	# Matches /[\u0000-\u001f\u007f]/g
	var out := ""
	for i in range(s.length()):
		var cp := s.unicode_at(i)
		if cp <= 0x1f or cp == 0x7f:
			continue
		out += s.substr(i, 1)
	return out

static func _parse_array_index(k: String) -> int:
	# Returns canonical array index in [0, 4294967294], or -1 if not an array index.
	var n := k.length()
	if n == 0 or n > 10:
		return -1
	if n > 1 and k.unicode_at(0) == 48:
		return -1
	var val := 0
	for i in range(n):
		var c := k.unicode_at(i)
		if c < 48 or c > 57:
			return -1
		val = val * 10 + (c - 48)
	if val > 4294967294:
		return -1
	return val

static func own_keys(d: Dictionary) -> Array:
	# Matches JS OrdinaryOwnPropertyKeys: canonical array indices ascending, then remaining strings in insertion order.
	var idx_pairs: Array = []
	var str_keys: Array = []
	for k in d.keys():
		var ks := str(k)
		var idx := _parse_array_index(ks)
		if idx >= 0:
			idx_pairs.append([idx, k])
		else:
			str_keys.append(k)
	if idx_pairs.size() > 1:
		stable_sort(idx_pairs, func(a, b): return float(a[0] - b[0]))
	var out: Array = []
	for pair in idx_pairs:
		out.append(pair[1])
	for k in str_keys:
		out.append(k)
	return out

static func locale_compare(a: String, b: String, order_table: Dictionary) -> int:
	if not order_table.has(a) or not order_table.has(b):
		push_error("JsUtil.locale_compare: value outside exported order table: a=%s b=%s" % [a, b])
		assert(false, "JsUtil.locale_compare: value outside exported order table")
		return 0
	var ra: int = int(order_table[a])
	var rb: int = int(order_table[b])
	if ra < rb:
		return -1
	if ra > rb:
		return 1
	return 0

static func array_splice(arr: Array, start: int, delete_count: int) -> Array:
	var length := arr.size()
	var actual_start := maxi(length + start, 0) if start < 0 else mini(start, length)
	var actual_delete := mini(maxi(delete_count, 0), length - actual_start)
	var removed: Array = []
	for i in range(actual_delete):
		removed.append(arr[actual_start])
		arr.remove_at(actual_start)
	return removed
