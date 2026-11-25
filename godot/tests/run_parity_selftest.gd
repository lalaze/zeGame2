extends SceneTree

## The comparer behind the parity tests: what must count as equal, and what must not.

var passed := 0
var failed := 0


func _init() -> void:
	var one_ulp := JsMath.from_words(0x3ff00000, 1)
	_same("equal numbers", 1.5, 1.5)
	_same("an integer and the same float", 3, 3.0)
	_same("NaN and NaN", NAN, NAN)
	_same("nested values", {"a": [1.0, {"b": null}]}, {"a": [1.0, {"b": null}]})
	_same("index keys are in number order in JavaScript", {"2": 1.0, "10": 2.0}, {"10": 2.0, "2": 1.0})
	_differ("one ulp", 1.0, one_ulp)
	_differ("one ulp deep inside", {"a": [{"b": 1.0}]}, {"a": [{"b": one_ulp}]})
	# Not written -0.0: GDScript keeps one constant for 0.0 and -0.0 inside a function.
	_differ("0 and -0", 0.0, JsMath.from_words(0x80000000, 0))
	_differ("a missing key", {"a": 1.0, "b": 2.0}, {"a": 1.0})
	_differ("an extra key", {"a": 1.0}, {"a": 1.0, "b": 2.0})
	_differ("another key order", {"a": 1.0, "b": 2.0}, {"b": 2.0, "a": 1.0})
	_differ("swapped items", [1.0, 2.0], [2.0, 1.0])
	_differ("a shorter array", [1.0, 2.0], [1.0])
	_differ("null and undefined", null, JsUtil.UNDEFINED)
	_differ("an undefined value and no key", {"a": JsUtil.UNDEFINED}, {})
	_differ("false and 0", false, 0.0)
	_differ("a number and its text", 1.0, "1")
	_differ("an empty array and an empty object", [], {})
	var a := ParityCompare.CountedRng.new(7)
	var b := ParityCompare.CountedRng.new(7)
	b.next_float()
	_differ("one random number more", a.draws, b.draws)
	_layout_search()
	print("SELFTEST_SUMMARY: passed=%d failed=%d" % [passed, failed])
	quit(0 if failed == 0 else 1)


func _same(label: String, x: Variant, y: Variant) -> void:
	_result(label, ParityCompare.diff(x, y, "").is_empty())


func _differ(label: String, x: Variant, y: Variant) -> void:
	_result(label, not ParityCompare.diff(x, y, "").is_empty() and not ParityCompare.diff(y, x, "").is_empty())


func _result(label: String, ok: bool) -> void:
	if ok:
		passed += 1
	else:
		failed += 1
		print("FAIL: %s" % label)


## The furniture search against trying every combination, on small rooms where many pieces do not fit together.
func _layout_search() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var answers := {true: 0, false: 0}
	for _n in 400:
		var candidates := []
		for _g in rng.randi_range(1, 3):
			var masks := []
			for _m in rng.randi_range(1, 4):
				var cells := {}
				for _c in rng.randi_range(1, 3):
					cells[rng.randi_range(0, 5)] = true
				var mask := PackedInt32Array(cells.keys())
				masks.append(mask)
			var kinds := rng.randi_range(1, 2)
			var end := candidates.size() + kinds
			var comforts := []
			for _k in kinds:
				comforts.append(float(rng.randi_range(1, 5)))
			comforts.sort()
			comforts.reverse()
			for comfort: float in comforts:
				candidates.append({"comfort": comfort, "masks": masks, "groupEnd": end})
		var needed := float(rng.randi_range(1, 14))
		var found := CoreRecovery.LayoutSearch.new(candidates).search(0, needed, {}, 0)
		answers[found] += 1
		_result("layout search %d" % _n, found == (_best(candidates, 0, {}) >= needed))
	_result("both answers occur", answers[true] > 40 and answers[false] > 40)


func _best(candidates: Array, index: int, occupied: Dictionary) -> float:
	if index >= candidates.size():
		return 0.0
	var best := _best(candidates, index + 1, occupied)
	for mask: PackedInt32Array in candidates[index]["masks"]:
		var free := true
		for cell in mask:
			free = free and not occupied.has(cell)
		if free:
			var more := occupied.duplicate()
			for cell in mask:
				more[cell] = true
			best = maxf(best, candidates[index]["comfort"] + _best(candidates, index + 1, more))
	return best
