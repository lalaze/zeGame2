extends SceneTree

## Repeats the calls `scripts/godot-parity/view.ts` made of the floors view's TypeScript, with `res://view/*.gd`.

const SCRIPTS := {
	"layout": "res://view/floors_layout.gd", "cats": "res://view/floors_cat_places.gd", "light": "res://view/floors_sky_light.gd", "art": "res://view/floors_art.gd", "thinking": "res://view/floors_thinking.gd",
}
var passed := 0
var failed := 0
var _wire := ParityWire.new()


func _init() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://.parity/view/view.json"))
	for name: String in data["constants"]:
		var script: Script = load(SCRIPTS[name.get_slice(".", 0)])
		var constant := name.get_slice(".", 1)
		var value: Variant = script.get_script_constant_map()[constant] if script.get_script_constant_map().has(constant) else script.get(constant)
		_check(name, ParityCompare.diff(_plain(_wire.value(data["constants"][name])), _plain(value), ""))
	for row: Dictionary in data["rows"]:
		var f: String = row["f"]
		var args: Array = _wire.value(row["a"])
		_check("%s%s" % [f, str(args).left(160)], ParityCompare.diff(_plain(_wire.value(row["r"])), _plain(_call(f.get_slice(".", 0), f.get_slice(".", 1), args)), ""))
	print("VIEW_SUMMARY: cases=%d passed=%d failed=%d" % [passed + failed, passed, failed])
	quit(0 if failed == 0 and passed > 0 else 1)


func _check(label: String, problem: String) -> void:
	if problem.is_empty():
		passed += 1
	else:
		failed += 1
		if failed < 14:
			print("FAIL: %s: %s" % [label, problem])


## Numbers as JavaScript has them, and keys in one order: nothing here depends on it.
func _plain(v: Variant) -> Variant:
	match typeof(v):
		TYPE_INT:
			return float(v)
		TYPE_ARRAY:
			return v.map(_plain)
		TYPE_VECTOR2:
			return [float(v.x), float(v.y)]
		TYPE_DICTIONARY:
			var out := {}
			var keys: Array = v.keys()
			keys.sort()
			for k: Variant in keys:
				out[k] = _plain(v[k])
			return out
	return v


func _lamps(list: Array) -> Array:
	return list.map(func(l: Dictionary) -> Dictionary: return {"x": l["x"], "y": l["y"], "reach": l["reach"], "power": l.get("power", 1.0), "colour": float(l["colour"]) if l.has("colour") else null})


func _sim(state: Dictionary, snapshot: Variant) -> CoreSim:
	var sim := CoreSim.new(ParityCompare.CountedRng.new(1).next_float)
	sim.restore(snapshot, state)
	return sim


func _call(mod: String, name: String, args: Array) -> Variant:
	if mod == "lamps":
		match name:
			"floorLamps": return _lamps(FloorsSkyLight.floor_lamps(args[0], args[1]))
			"STREET_LAMP": return _lamps(FloorsSkyLight.STREET_LAMP)
			"NEON_LAMP": return _lamps([FloorsSkyLight.NEON_LAMP])
			"FLOOR_LAMPS": return _lamps(FloorsSkyLight.FLOOR_LAMPS[args[0]])
			"CEILING_LAMPS": return _lamps(FloorsSkyLight.CEILING_LAMPS[args[0]])
			"WALL_LAMPS": return _lamps(FloorsSkyLight.WALL_LAMPS[args[0]])
	match "%s.%s" % [mod, name]:
		"layout.worldPoint":
			var at := FloorsLayout.world_point(args[0], args[1])
			return [float(at.x), float(at.y)]
		"cats.choosePlace":
			return FloorsCatPlaces.choose_place(args[0], args[1], args[2], args[3], args[4], ParityCompare.CountedRng.new(int(args[5])).next_float)
		"thinking.candidates":
			var sim := _sim(args[0], args[1])
			sim.customers = args[2]
			return FloorsThinking.candidates(sim, args[0])
		"art.brewShare":
			return args[0].map(FloorsArt.brew_share)
		"art.bakeShare":
			var sim := _sim(args[0], args[1])
			var out := []
			for i in sim.cooks.size():
				out.append(FloorsArt.bake_share(sim, args[0], i))
			return out
		"thinking.pacing":
			var pacing := FloorsThinking.Pacing.new()
			return args[0].map(func(step: Array) -> Array: return pacing.update(step[0], step[1], step[2], step[3]).map(func(c: Dictionary) -> String: return c["id"]))
		"thinking.showable":
			return FloorsThinking.showable(args[0], func(id: String) -> Variant: return args[1].get(id), args[2], args[3])
	var script: Script = load(SCRIPTS[mod])
	var fn := name.to_snake_case()
	for m: Dictionary in script.get_script_method_list():
		if m["name"] == fn:
			return script.callv(fn, args)
	print("FAIL: no function %s in %s" % [fn, mod])
	return null
