extends SceneTree

# Verifies godot/core numeric & JSON primitives bit-for-bit against Node 22 / V8 vectors
# generated into godot/.parity/*.tsv and json_cases.json.

var passed: int = 0
var failed: int = 0
var max_errors_per_section: int = 5

func _init() -> void:
	var t0 := Time.get_ticks_msec()
	_check_parse_float()
	_check_number_to_string()
	_check_hypot()
	_check_log()
	_check_log10()
	_check_pow()
	_check_round()
	_check_to_fixed()
	_check_to_exponential()
	_check_int32()
	_check_json()
	_check_stable_sort()
	var elapsed := Time.get_ticks_msec() - t0
	print("FOUNDATION_PARITY_SUMMARY: passed=%d failed=%d elapsed_ms=%d" % [passed, failed, elapsed])
	quit(0 if failed == 0 else 1)

func _read_lines(path: String) -> PackedStringArray:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		failed += 1
		print("FAIL: could not open %s" % path)
		return PackedStringArray()
	var text := f.get_as_text()
	f.close()
	return text.split("\n", false)

func _check_parse_float() -> void:
	var lines := _read_lines("res://.parity/parse_float.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var s: String = JsJson.parse_or_fail(parts[0])
		var expected_hex: String = parts[1]
		var actual := JsMath.parse_float(s)
		var actual_hex := JsMath.float_to_hex(actual)
		if actual_hex == expected_hex:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: parse_float(%s) expected=%s actual=%s" % [parts[0], expected_hex, actual_hex])
	passed += sec_pass
	failed += sec_fail
	print("  parse_float: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_number_to_string() -> void:
	var lines := _read_lines("res://.parity/number_to_string.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var x := JsMath.hex_to_float(parts[0])
		var expected: String = parts[1]
		var actual := JsMath.number_to_string(x)
		if actual == expected:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: number_to_string(%s) expected=%s actual=%s" % [parts[0], expected, actual])
	passed += sec_pass
	failed += sec_fail
	print("  number_to_string: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_hypot() -> void:
	var lines := _read_lines("res://.parity/hypot.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var a := JsMath.hex_to_float(parts[0])
		var b := JsMath.hex_to_float(parts[1])
		var expected_hex: String = parts[2]
		var actual_hex := JsMath.float_to_hex(JsMath.js_hypot2(a, b))
		if actual_hex == expected_hex:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: hypot(%s, %s) expected=%s actual=%s" % [parts[0], parts[1], expected_hex, actual_hex])
	passed += sec_pass
	failed += sec_fail
	print("  hypot: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_log() -> void:
	var lines := _read_lines("res://.parity/log.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var x := JsMath.hex_to_float(parts[0])
		var expected_hex: String = parts[1]
		var actual_hex := JsMath.float_to_hex(JsMath.js_log(x))
		if actual_hex == expected_hex:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: log(%s) expected=%s actual=%s" % [parts[0], expected_hex, actual_hex])
	passed += sec_pass
	failed += sec_fail
	print("  log: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_log10() -> void:
	var lines := _read_lines("res://.parity/log10.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var x := JsMath.hex_to_float(parts[0])
		var expected_hex: String = parts[1]
		var actual_hex := JsMath.float_to_hex(JsMath.js_log10(x))
		if actual_hex == expected_hex:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: log10(%s) expected=%s actual=%s" % [parts[0], expected_hex, actual_hex])
	passed += sec_pass
	failed += sec_fail
	print("  log10: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_pow() -> void:
	var lines := _read_lines("res://.parity/pow.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var x := JsMath.hex_to_float(parts[0])
		var y := JsMath.hex_to_float(parts[1])
		var expected_hex: String = parts[2]
		var actual_hex := JsMath.float_to_hex(JsMath.js_pow(x, y))
		if actual_hex == expected_hex:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: pow(%s, %s) expected=%s actual=%s" % [parts[0], parts[1], expected_hex, actual_hex])
	passed += sec_pass
	failed += sec_fail
	print("  pow: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_round() -> void:
	var lines := _read_lines("res://.parity/round.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var x := JsMath.hex_to_float(parts[0])
		var expected_hex: String = parts[1]
		var actual_hex := JsMath.float_to_hex(JsMath.js_round(x))
		if actual_hex == expected_hex:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: round(%s) expected=%s actual=%s" % [parts[0], expected_hex, actual_hex])
	passed += sec_pass
	failed += sec_fail
	print("  round: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_to_fixed() -> void:
	var lines := _read_lines("res://.parity/to_fixed.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var x := JsMath.hex_to_float(parts[0])
		var d := int(parts[1])
		var expected: String = parts[2]
		var actual := JsMath.to_fixed(x, d)
		if actual == expected:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: to_fixed(%s, %d) expected=%s actual=%s" % [parts[0], d, expected, actual])
	passed += sec_pass
	failed += sec_fail
	print("  to_fixed: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_to_exponential() -> void:
	var lines := _read_lines("res://.parity/to_exponential.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var x := JsMath.hex_to_float(parts[0])
		var d := int(parts[1])
		var expected: String = parts[2]
		var actual := JsMath.to_exponential(x, d)
		if actual == expected:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: to_exponential(%s, %d) expected=%s actual=%s" % [parts[0], d, expected, actual])
	passed += sec_pass
	failed += sec_fail
	print("  to_exponential: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_int32() -> void:
	var lines := _read_lines("res://.parity/int32.tsv")
	var sec_pass := 0
	var sec_fail := 0
	for line in lines:
		var parts := line.split("\t")
		var a := JsMath.hex_to_float(parts[0])
		var b := JsMath.hex_to_float(parts[1])
		var ok := (
			JsMath.float_to_hex(JsMath.imul(a, b)) == parts[2]
			and JsMath.float_to_hex(JsMath.ushr(a, b)) == parts[3]
			and JsMath.float_to_hex(JsMath.shr(a, b)) == parts[4]
			and JsMath.float_to_hex(JsMath.shl(a, b)) == parts[5]
			and JsMath.float_to_hex(JsMath.bxor(a, b)) == parts[6]
		)
		if ok:
			sec_pass += 1
		else:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: int32(%s, %s) imul=%s/%s ushr=%s/%s shr=%s/%s shl=%s/%s xor=%s/%s" % [
					parts[0], parts[1],
					JsMath.float_to_hex(JsMath.imul(a, b)), parts[2],
					JsMath.float_to_hex(JsMath.ushr(a, b)), parts[3],
					JsMath.float_to_hex(JsMath.shr(a, b)), parts[4],
					JsMath.float_to_hex(JsMath.shl(a, b)), parts[5],
					JsMath.float_to_hex(JsMath.bxor(a, b)), parts[6],
				])
	passed += sec_pass
	failed += sec_fail
	print("  int32: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_json() -> void:
	var f := FileAccess.open("res://.parity/json_cases.json", FileAccess.READ)
	if f == null:
		failed += 1
		print("FAIL: could not open json_cases.json")
		return
	var cases: Array = JsJson.parse_or_fail(f.get_as_text())
	f.close()
	var sec_pass := 0
	var sec_fail := 0
	for i in range(cases.size()):
		var c: Dictionary = cases[i]
		var val = JsJson.decode_wire(c["input"])
		var expected_str: String = c["expectedStringify"]
		var actual_str = JsJson.stringify(val)
		if typeof(actual_str) != TYPE_STRING or actual_str != expected_str:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: JSON.stringify[%d] expected=%s actual=%s" % [i, expected_str, str(actual_str)])
			continue
		# Round-trip JSON.parse -> JSON.stringify must match expected_str identically!
		var parsed := JsJson.parse(expected_str)
		if not parsed["ok"]:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: JSON.parse[%d] error=%s" % [i, parsed["error"]])
			continue
		var re_str = JsJson.stringify(parsed["value"])
		if re_str != expected_str:
			sec_fail += 1
			if sec_fail <= max_errors_per_section:
				print("FAIL: JSON roundtrip[%d] expected=%s actual=%s" % [i, expected_str, str(re_str)])
			continue
		sec_pass += 1
	passed += sec_pass
	failed += sec_fail
	print("  json: %d passed, %d failed" % [sec_pass, sec_fail])

func _check_stable_sort() -> void:
	var sec_pass := 0
	var sec_fail := 0
	# Build 200 items with only 7 distinct keys, verify stability
	var arr: Array = []
	for i in range(200):
		arr.append({"key": i % 7, "seq": i})
	JsUtil.stable_sort(arr, func(a, b): return float(a["key"] - b["key"]))
	var ok := true
	for i in range(1, arr.size()):
		if arr[i]["key"] < arr[i - 1]["key"]:
			ok = false
		if arr[i]["key"] == arr[i - 1]["key"] and arr[i]["seq"] < arr[i - 1]["seq"]:
			ok = false
	if ok:
		sec_pass += 1
	else:
		sec_fail += 1
		print("FAIL: stable_sort did not preserve order")
	passed += sec_pass
	failed += sec_fail
	print("  stable_sort: %d passed, %d failed" % [sec_pass, sec_fail])
