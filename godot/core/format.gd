class_name CoreFormat
extends RefCounted

# Port of src/game/format.ts
# Translation function `t_fn` is passed as an explicit Callable parameter (no global singleton).

const _SUFFIXES: Array[String] = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"]

static func format_number(n: float) -> String:
	if not is_finite(n):
		return "∞"
	if n < 0.0:
		return "-" + format_number(-n)
	if n < 1000.0:
		return JsMath.number_to_string(floor(n))
	var tier := int(floor(JsMath.js_log10(n) / 3.0))
	if tier >= _SUFFIXES.size():
		return JsMath.to_exponential(n, 2).replace("+", "")
	var scaled := n / JsMath.js_pow(1000.0, float(tier))
	var digits := 0 if scaled >= 100.0 else (1 if scaled >= 10.0 else 2)
	var factor := JsMath.js_pow(10.0, float(digits))
	var truncated: float = floor(scaled * factor) / factor
	return JsMath.to_fixed(truncated, digits) + _SUFFIXES[tier]

static func format_money(n: float) -> String:
	return "$" + format_number(n)

static func _match_compact_parts(s: String) -> Array:
	# Matches /^(-?[\d.]+)([A-Za-z]*)$/
	var length := s.length()
	var i := 0
	if i < length and s.unicode_at(i) == 45: # '-'
		i += 1
	var num_start := i
	while i < length:
		var c := s.unicode_at(i)
		if (c >= 48 and c <= 57) or c == 46:
			i += 1
		else:
			break
	if i == num_start:
		return []
	var num_str := s.substr(0, i)
	var suf_start := i
	while i < length:
		var c := s.unicode_at(i)
		if (c >= 65 and c <= 90) or (c >= 97 and c <= 122):
			i += 1
		else:
			return []
	return [num_str, s.substr(suf_start)]

static func format_transaction_money(n: float) -> String:
	if not is_finite(n):
		return format_money(n)
	if absf(n) < 1000.0 or (JsMath.is_integer(n) and absf(n) < 100000.0):
		var shown := JsMath.parse_float(JsMath.to_fixed(n, 2))
		if n != 0.0 and shown == 0.0:
			return "−<$0.01" if n < 0.0 else "<$0.01"
		return "%s$%s" % ["" if shown == n else "≈", JsMath.number_to_string(shown)]
	var compact := format_number(n)
	var parts := _match_compact_parts(compact)
	var exact := false
	if not parts.is_empty():
		var tier := _SUFFIXES.find(parts[1])
		if tier >= 0 and JsMath.parse_float(parts[0]) * JsMath.js_pow(1000.0, float(tier)) == n:
			exact = true
	return "%s$%s" % ["" if exact else "≈", compact]

static func format_exact_money(n: float) -> String:
	return "$" + JsMath.number_to_string(n)

static func format_account_money(n: float) -> String:
	if absf(n) < 1000000.0:
		return "$" + JsMath.to_fixed(n, 2)
	return format_money(n)

static func format_rate(n: float) -> String:
	if n > 0.0 and n < 100.0:
		return "$" + JsMath.number_to_string(floor(n * 10.0) / 10.0)
	return format_money(n)

static func format_duration(seconds: float, t_fn: Callable) -> String:
	var s: float = floor(seconds)
	var h: float = floor(s / 3600.0)
	var m: float = floor(fmod(s, 3600.0) / 60.0)
	if h > 0.0:
		return str(t_fn.call("duration.hm", {"h": h, "m": m}))
	if m > 0.0:
		return str(t_fn.call("duration.ms", {"m": m, "s": fmod(s, 60.0)}))
	return str(t_fn.call("duration.s", {"s": s}))
