class_name JsJson
extends RefCounted

# Bit-exact JavaScript JSON.parse and JSON.stringify, plus a lossless parity wire codec.
# - JSON.parse parses every number through JsMath.parse_float (stored as float).
# - JSON.stringify formats numbers through JsMath.number_to_string, maps NaN/Inf to null,
#   maps -0 to 0, skips JsUtil.UNDEFINED object properties, maps UNDEFINED array items to null,
#   and enumerates object keys in JS OrdinaryOwnPropertyKeys order.

static func stringify(value: Variant) -> Variant:
	if JsUtil.is_undefined(value):
		return JsUtil.UNDEFINED
	return _stringify_value(value)

static func _stringify_value(value: Variant) -> String:
	if value == null:
		return "null"
	if value is bool:
		return "true" if value else "false"
	if value is int:
		return JsMath.number_to_string(float(value))
	if value is float:
		if not is_finite(value):
			return "null"
		return JsMath.number_to_string(value)
	if value is String:
		return _quote_string(value)
	if value is Array:
		var parts: PackedStringArray = PackedStringArray()
		parts.resize(value.size())
		for i in range(value.size()):
			var el = value[i]
			if JsUtil.is_undefined(el):
				parts[i] = "null"
			else:
				parts[i] = _stringify_value(el)
		return "[" + ",".join(parts) + "]"
	if value is Dictionary:
		var keys := JsUtil.own_keys(value)
		var parts: PackedStringArray = PackedStringArray()
		for k in keys:
			var v = value[k]
			if JsUtil.is_undefined(v):
				continue
			parts.append(_quote_string(str(k)) + ":" + _stringify_value(v))
		return "{" + ",".join(parts) + "}"
	return "null"

static func _quote_string(s: String) -> String:
	var out: PackedStringArray = PackedStringArray()
	out.append("\"")
	var n := s.length()
	var start := 0
	for i in range(n):
		var cp := s.unicode_at(i)
		var esc := ""
		if cp == 34: # '"'
			esc = "\\\""
		elif cp == 92: # '\\'
			esc = "\\\\"
		elif cp == 8:
			esc = "\\b"
		elif cp == 12:
			esc = "\\f"
		elif cp == 10:
			esc = "\\n"
		elif cp == 13:
			esc = "\\r"
		elif cp == 9:
			esc = "\\t"
		elif cp < 0x20:
			esc = "\\u%04x" % cp
		if not esc.is_empty():
			if i > start:
				out.append(s.substr(start, i - start))
			out.append(esc)
			start = i + 1
	if start < n:
		out.append(s.substr(start, n - start))
	out.append("\"")
	return "".join(out)

# ---------------------------------------------------------------- JSON.parse

class _Parser extends RefCounted:
	var text: String
	var length: int
	var pos: int = 0
	var error: String = ""

	func _init(src: String) -> void:
		text = src
		length = src.length()

	func skip_ws() -> void:
		while pos < length:
			var c := text.unicode_at(pos)
			if c == 32 or c == 9 or c == 10 or c == 13:
				pos += 1
			else:
				break

	func parse_value() -> Variant:
		skip_ws()
		if pos >= length:
			error = "Unexpected end of JSON input"
			return null
		var c := text.unicode_at(pos)
		if c == 123: # '{'
			return parse_object()
		if c == 91: # '['
			return parse_array()
		if c == 34: # '"'
			return parse_string()
		if c == 116: # 't'
			if text.substr(pos, 4) == "true":
				pos += 4
				return true
			error = "Invalid token at %d" % pos
			return null
		if c == 102: # 'f'
			if text.substr(pos, 5) == "false":
				pos += 5
				return false
			error = "Invalid token at %d" % pos
			return null
		if c == 110: # 'n'
			if text.substr(pos, 4) == "null":
				pos += 4
				return null
			error = "Invalid token at %d" % pos
			return null
		if c == 45 or (c >= 48 and c <= 57):
			return parse_number()
		error = "Unexpected character '%s' at %d" % [text.substr(pos, 1), pos]
		return null

	func parse_object() -> Dictionary:
		pos += 1 # skip '{'
		var obj := {}
		skip_ws()
		if pos < length and text.unicode_at(pos) == 125: # '}'
			pos += 1
			return obj
		while true:
			skip_ws()
			if pos >= length or text.unicode_at(pos) != 34:
				error = "Expected string key at %d" % pos
				return obj
			var key := parse_string()
			if not error.is_empty():
				return obj
			skip_ws()
			if pos >= length or text.unicode_at(pos) != 58: # ':'
				error = "Expected ':' at %d" % pos
				return obj
			pos += 1
			var val = parse_value()
			if not error.is_empty():
				return obj
			obj[key] = val
			skip_ws()
			if pos >= length:
				error = "Unterminated object"
				return obj
			var sep := text.unicode_at(pos)
			if sep == 125: # '}'
				pos += 1
				return obj
			if sep == 44: # ','
				pos += 1
				continue
			error = "Expected ',' or '}' at %d" % pos
			return obj
		return obj

	func parse_array() -> Array:
		pos += 1 # skip '['
		var arr: Array = []
		skip_ws()
		if pos < length and text.unicode_at(pos) == 93: # ']'
			pos += 1
			return arr
		while true:
			var val = parse_value()
			if not error.is_empty():
				return arr
			arr.append(val)
			skip_ws()
			if pos >= length:
				error = "Unterminated array"
				return arr
			var sep := text.unicode_at(pos)
			if sep == 93: # ']'
				pos += 1
				return arr
			if sep == 44: # ','
				pos += 1
				continue
			error = "Expected ',' or ']' at %d" % pos
			return arr
		return arr

	func parse_string() -> String:
		pos += 1 # skip '"'
		var out: PackedStringArray = PackedStringArray()
		var chunk_start := pos
		while pos < length:
			var c := text.unicode_at(pos)
			if c == 34: # '"'
				if pos > chunk_start:
					out.append(text.substr(chunk_start, pos - chunk_start))
				pos += 1
				return "".join(out)
			if c < 0x20:
				error = "Unescaped control char in string at %d" % pos
				return ""
			if c == 92: # '\\'
				if pos > chunk_start:
					out.append(text.substr(chunk_start, pos - chunk_start))
				pos += 1
				if pos >= length:
					error = "Unterminated escape"
					return ""
				var esc := text.unicode_at(pos)
				pos += 1
				if esc == 34:
					out.append("\"")
				elif esc == 92:
					out.append("\\")
				elif esc == 47:
					out.append("/")
				elif esc == 98:
					out.append(char(8))
				elif esc == 102:
					out.append(char(12))
				elif esc == 110:
					out.append("\n")
				elif esc == 114:
					out.append("\r")
				elif esc == 116:
					out.append("\t")
				elif esc == 117: # 'u'
					var cp := _read_hex4()
					if cp < 0:
						return ""
					# Handle UTF-16 surrogate pairs
					if cp >= 0xd800 and cp <= 0xdbff and pos + 6 <= length and text.unicode_at(pos) == 92 and text.unicode_at(pos + 1) == 117:
						var saved := pos
						pos += 2
						var lo := _read_hex4()
						if lo >= 0xdc00 and lo <= 0xdfff:
							cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00)
						else:
							pos = saved
					out.append(char(cp))
				else:
					error = "Invalid escape at %d" % (pos - 1)
					return ""
				chunk_start = pos
			else:
				pos += 1
		error = "Unterminated string"
		return ""

	func _read_hex4() -> int:
		if pos + 4 > length:
			error = "Truncated \\u escape at %d" % pos
			return -1
		var val := 0
		for _i in range(4):
			var c := text.unicode_at(pos)
			pos += 1
			var d := -1
			if c >= 48 and c <= 57:
				d = c - 48
			elif c >= 65 and c <= 70:
				d = c - 55
			elif c >= 97 and c <= 102:
				d = c - 87
			if d < 0:
				error = "Invalid hex digit in \\u escape"
				return -1
			val = (val << 4) | d
		return val

	func parse_number() -> float:
		var start := pos
		if text.unicode_at(pos) == 45: # '-'
			pos += 1
		if pos >= length:
			error = "Invalid number at %d" % start
			return NAN
		var c := text.unicode_at(pos)
		if c == 48:
			pos += 1
		elif c >= 49 and c <= 57:
			pos += 1
			while pos < length:
				var d := text.unicode_at(pos)
				if d >= 48 and d <= 57:
					pos += 1
				else:
					break
		else:
			error = "Invalid number at %d" % start
			return NAN
		if pos < length and text.unicode_at(pos) == 46: # '.'
			pos += 1
			if pos >= length or text.unicode_at(pos) < 48 or text.unicode_at(pos) > 57:
				error = "Invalid fraction at %d" % start
				return NAN
			while pos < length:
				var d := text.unicode_at(pos)
				if d >= 48 and d <= 57:
					pos += 1
				else:
					break
		if pos < length:
			var ec := text.unicode_at(pos)
			if ec == 101 or ec == 69:
				pos += 1
				if pos < length and (text.unicode_at(pos) == 43 or text.unicode_at(pos) == 45):
					pos += 1
				if pos >= length or text.unicode_at(pos) < 48 or text.unicode_at(pos) > 57:
					error = "Invalid exponent at %d" % start
					return NAN
				while pos < length:
					var d := text.unicode_at(pos)
					if d >= 48 and d <= 57:
						pos += 1
					else:
						break
		var token := text.substr(start, pos - start)
		return JsMath.parse_float(token)

static func parse(text: String) -> Dictionary:
	var p := _Parser.new(text)
	var val = p.parse_value()
	if p.error.is_empty():
		p.skip_ws()
		if p.pos != p.length:
			p.error = "Trailing characters at %d" % p.pos
	if not p.error.is_empty():
		return {"ok": false, "error": p.error, "value": null}
	return {"ok": true, "error": "", "value": val}

static func parse_or_fail(text: String) -> Variant:
	var res := parse(text)
	if not res["ok"]:
		push_error("JsJson.parse_or_fail: %s" % res["error"])
		return null
	return res["value"]

# ---------------------------------------------------------------- Lossless parity wire codec
# Encodes/decodes JS values preserving undefined, NaN, Infinity, -Infinity, -0.0, and exact IEEE 754 bits.
# Tag format (only used for parity transport & exact exported data):
#   {"$t": "u"}               -> JsUtil.UNDEFINED
#   {"$t": "f", "h": "<16h>"} -> exact float from 64-bit IEEE 754 hex
#   {"$t": "o", "v": {...}}   -> escaped object if a real object ever had "$t" key

static func decode_wire(v: Variant) -> Variant:
	if v is Dictionary:
		if v.has("$t"):
			var tag := str(v["$t"])
			if tag == "u":
				return JsUtil.UNDEFINED
			if tag == "f":
				return JsMath.hex_to_float(str(v["h"]))
			if tag == "o":
				return decode_wire(v["v"])
		var out := {}
		for k in v.keys():
			out[k] = decode_wire(v[k])
		return out
	if v is Array:
		var out: Array = []
		out.resize(v.size())
		for i in range(v.size()):
			out[i] = decode_wire(v[i])
		return out
	if v is int:
		return float(v)
	return v

static func encode_wire(v: Variant) -> Variant:
	if JsUtil.is_undefined(v):
		return {"$t": "u"}
	if v == null or v is bool or v is String:
		return v
	if v is float or v is int:
		return {"$t": "f", "h": JsMath.float_to_hex(float(v))}
	if v is Array:
		var out: Array = []
		out.resize(v.size())
		for i in range(v.size()):
			out[i] = encode_wire(v[i])
		return out
	if v is Dictionary:
		var out := {}
		for k in v.keys():
			out[k] = encode_wire(v[k])
		if out.has("$t"):
			return {"$t": "o", "v": out}
		return out
	return null
