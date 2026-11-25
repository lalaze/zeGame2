extends SceneTree

## Runs the vectors of `npm run godot:parity` against `res://core/*.gd`, bit for bit.
## A TypeScript module `customer-demand` is `core/customer_demand.gd`; `parseGuestStats` is `parse_guest_stats`.
## An exported constant is a static function or variable of the same name.

const MAX_SHOWN := 12

var passed := 0
var failed := 0
var cases := 0
var modules := 0
var _shown := 0


func _init() -> void:
	var t0 := Time.get_ticks_msec()
	var dir := "res://.parity/cases"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--dir="):
			dir = arg.trim_prefix("--dir=")
	var manifest: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join("manifest.json")))
	if not manifest is Array or manifest.is_empty():
		print("FAIL: no manifest in %s" % dir)
		quit(1)
		return
	_check_literals()
	for entry: Dictionary in manifest:
		_run_module(dir, entry)
	print("PARITY_SUMMARY: modules=%d total=%d passed=%d failed=%d elapsed_ms=%d" % [modules, cases, passed, failed, Time.get_ticks_msec() - t0])
	quit(0 if failed == 0 and cases > 0 else 1)


## Godot's own number parser is not exact for long decimals, and it also reads the literals in the scripts.
func _check_literals() -> void:
	var number := RegEx.create_from_string("(?<![\\w.\"'])\\d+\\.\\d+(e[+-]?\\d+)?")
	for file in DirAccess.get_files_at("res://core"):
		if not file.ends_with(".gd"):
			continue
		var seen := {}
		var code := RegEx.create_from_string("(?m)^\\s*#.*$").sub(FileAccess.get_file_as_string("res://core/" + file), "", true)
		for m in number.search_all(code):
			if seen.has(m.get_string()):
				continue
			seen[m.get_string()] = true
			cases += 1
			_check(file, "literal", ParityCompare.diff(JsMath.parse_float(m.get_string()), m.get_string().to_float(), m.get_string()))


func _run_module(dir: String, entry: Dictionary) -> void:
	var mod: String = entry["name"]
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join(mod + ".json")))
	if not data is Dictionary or data["cases"].size() != int(entry["cases"]) or data["constants"].size() != int(entry["constants"]):
		_fail(mod, "the vector file does not match the manifest")
		return
	var path := "res://core/%s.gd" % mod.replace("-", "_")
	var script: Script = load(path) if ResourceLoader.exists(path) else null
	if script == null:
		_fail(mod, "%s is missing" % path)
		return
	modules += 1
	var methods := {}
	for m in script.get_script_method_list():
		methods[m["name"]] = m
	var wire := ParityWire.new()
	wire.pool = data["pool"]
	var before := [passed, failed]
	for name: String in data["constants"]:
		cases += 1
		_check(mod, name, ParityCompare.diff(wire.value(data["constants"][name]), _constant(script, methods, name), name))
	var index := 0
	for c: Dictionary in data["cases"]:
		cases += 1
		_run_case(mod, script, methods, wire, c, index)
		index += 1
	for o: Dictionary in data.get("objects", []):
		cases += 1
		_check(mod, o["c"], _run_object(script, wire, o))
	_reset()
	print("PARITY_MODULE: %s constants=%d cases=%d objects=%d passed=%d failed=%d" % [
		mod, data["constants"].size(), data["cases"].size(), data.get("objects", []).size(), passed - before[0], failed - before[1],
	])


func _reset() -> void:
	CoreLayout.reset_layout_state()
	CoreClock.override = NAN


## The module state and the clock TypeScript made this call with.
func _enter(wire: ParityWire, c: Dictionary) -> void:
	_reset()
	CoreLayout.set_scene_height(float(c["h"]))
	CoreLayout.set_kitchen_level(float(c["k"]))
	CoreClock.override = wire.value(c["t"])


func _constant(script: Script, methods: Dictionary, name: String) -> Variant:
	if methods.has(name):
		return script.call(name)
	var constants := script.get_script_constant_map()
	return constants[name] if constants.has(name) else script.get(name)


func _run_case(mod: String, script: Script, methods: Dictionary, wire: ParityWire, c: Dictionary, index: int) -> void:
	var fn: String = c["f"].to_snake_case()
	var label := "%s#%d" % [c["f"], index]
	if fn == "round_trip":
		_enter(wire, c)
		_check(mod, label, ParityCompare.diff(wire.value(c["r"]), CoreState.serialize(CoreState.deserialize(wire.value(c["a"][0]), wire.value(c["a"][1]))), ""))
		return
	if not methods.has(fn):
		_fail(mod, "%s: no function %s" % [label, fn])
		return
	_enter(wire, c)
	var args: Array = []
	for a in c["a"]:
		args.append(wire.value(a))
	while not args.is_empty() and JsUtil.is_undefined(args.back()) and args.size() > methods[fn]["args"].size() - methods[fn]["default_args"].size():
		args.pop_back()
	var call_args := args.duplicate()
	# Only a duration needs the dictionary; TypeScript reads the current language itself.
	if fn == "format_duration":
		call_args.append(_translator(c["l"]))
	var ret: Variant = script.callv(fn, call_args)
	var expected: Variant = wire.value(c["r"])
	if ret == null and methods[fn]["return"]["type"] == TYPE_NIL and not (methods[fn]["return"]["usage"] & PROPERTY_USAGE_NIL_IS_VARIANT):
		ret = JsUtil.UNDEFINED
	var after: Array = []
	for a in c.get("b", c["a"]):
		after.append(wire.value(a))
	after.resize(args.size())
	var problem := ParityCompare.diff([expected, after, wire.value(c["g"])], [ret, args, [CoreLayout.scene_height(), CoreLayout.kitchen_level()]], "")
	_check(mod, label, problem)


func _translator(locale: String) -> Callable:
	var table: Dictionary = RulesData.section("i18nDuration")[locale]
	return func(key: String, params: Dictionary) -> String:
		var text: String = table[key]
		for k: String in params:
			text = text.replace("{%s}" % k, JsMath.number_to_string(float(params[k])))
		return text


func _run_object(script: Script, wire: ParityWire, o: Dictionary) -> String:
	var rng := ParityCompare.CountedRng.new(int(o["s"]))
	var made: Variant = script.get_script_constant_map()[o["c"]].new(rng.next_float)
	var at := 0
	for step: Dictionary in o["steps"]:
		var args: Array = []
		for a in step["a"]:
			args.append(wire.value(a))
		var problem := ParityCompare.diff(wire.value(step["r"]), made.callv(String(step["m"]).to_snake_case(), args), "step %d %s" % [at, step["m"]])
		if not problem.is_empty():
			return problem
		at += 1
	return "" if rng.draws == int(o["d"]) else "random numbers drawn: expected=%d actual=%d" % [int(o["d"]), rng.draws]


func _check(mod: String, label: String, problem: String) -> void:
	if problem.is_empty():
		passed += 1
	else:
		_fail(mod, "%s %s" % [label, problem])


func _fail(mod: String, text: String) -> void:
	failed += 1
	_shown += 1
	if _shown <= MAX_SHOWN:
		print("FAIL: [%s] %s" % [mod, text])
