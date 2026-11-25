extends SceneTree

## Repeats the runs `scripts/godot-parity/lockstep.ts` wrote and compares every step: the state, everything in the
## simulation, the café moments, the cats, the operation status, the events and the random numbers drawn.
## `--dir=` picks the runs, `--only=` one of them.

var passed := 0
var failed := 0
var steps := 0
var _wire := ParityWire.new()
var _dir := ""
## With `--line=`, compares in detail with what `LOCKSTEP_DUMP=<run>:<line>` made the recorder write.
var _dump_line := -1


func _init() -> void:
	var t0 := Time.get_ticks_msec()
	var only := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--dir="):
			_dir = arg.trim_prefix("--dir=")
		if arg.begins_with("--only="):
			only = arg.trim_prefix("--only=")
		if arg.begins_with("--line="):
			_dump_line = int(arg.trim_prefix("--line="))
	for file in DirAccess.get_files_at(_dir):
		if file.ends_with(".jsonl") and (only.is_empty() or file.begins_with(only)):
			var problem := _run(FileAccess.get_file_as_string(_dir.path_join(file)).split("\n", false))
			# A script error ends the run early with an empty answer.
			if problem == "done":
				passed += 1
			else:
				failed += 1
				print("FAIL: [%s] %s" % [file, problem])
	print("LOCKSTEP_SUMMARY: steps=%d passed=%d failed=%d elapsed_ms=%d" % [steps, passed, failed, Time.get_ticks_msec() - t0])
	quit(0 if failed == 0 and passed > 0 else 1)


## As `momentStage` in src/main.ts, for a given room on screen.
static func _stage(state: Dictionary, cats: CoreLivingCats, area: Variant) -> Dictionary:
	var out := []
	if state["pets"].is_empty():
		if area is String and area == "main":
			out.append({"id": "window", "x": CoreLayout.CAT_SPOT["x"], "y": CoreLayout.CAT_SPOT["y"], "area": "main", "sill": true})
		return {"area": area, "cats": out}
	for cat: Dictionary in cats.actors.values():
		var here: bool = area is String and cat["area"] == area and cat["route"].is_empty() and not cat.has("interaction") and not cat["resting"]
		for p: Dictionary in state["pets"]:
			if here and p["id"] == cat["id"] and CorePets.pet_active(p):
				out.append({"id": cat["id"], "x": cat["x"], "y": cat["y"], "area": cat["area"]})
				break
	return {"area": area, "cats": out}


func _run(lines: PackedStringArray) -> String:
	var start: Dictionary = JSON.parse_string(lines[0])
	var state: Dictionary = _wire.value(start["state"])
	var clock: float = _wire.value(start["clock"])
	var dt: float = _wire.value(start["dt"])
	var chance := int(start["seed"])
	var rng := ParityCompare.CountedRng.new(chance)
	var moment_rng := ParityCompare.CountedRng.new(chance * 7 + 3)
	var cat_rng := ParityCompare.CountedRng.new(chance * 11 + 5)
	CoreLayout.reset_layout_state()
	CoreLayout.set_scene_height(_wire.value(start["height"]))
	CoreClock.override = clock
	var sim := CoreSim.new(rng.next_float)
	var moments := CoreMoments.MomentDirector.new(moment_rng.next_float)
	var cats := CoreLivingCats.new(cat_rng.next_float)
	var monitor := CoreOperations.OperationMonitor.new()
	var area: Variant = "main"
	var crowd := []
	var resume: Variant = _wire.value(start["resume"])
	if not JsUtil.is_undefined(resume):
		var restored := sim.restore(resume, state)
		if restored != _wire.value(start["restored"]):
			return "restore: expected=%s actual=%s" % [_wire.value(start["restored"]), restored]
	for n in range(1, lines.size()):
		var line: Dictionary = JSON.parse_string(lines[n])
		steps += 1
		var walls := true
		if line.has("close"):
			var report: Variant = sim.close_shop(state)
			if ParityWire.digest(report) != line["close"]:
				return "line %d: the day's report differs" % n
		else:
			var times := {"cats": dt, "real": dt, "sim": dt, "step": dt}
			for did: Dictionary in line.get("ops", []):
				var op: Array = _wire.value(did["op"])
				var ret: Variant = null
				match op[0]:
					"$LOOK":
						area = null if op[1].is_empty() else op[1]
					"$TIME":
						times[op[1]] = op[2]
					"$PET":
						for p: Dictionary in state["pets"]:
							if p["id"] == op[1]:
								p[op[2]] = op[3]
								break
					"$PETS":
						state["pets"] = op[2]
					"$GUESTS":
						for c: Dictionary in sim.customers:
							if c["id"] == op[2]:
								c[op[1]] = op[3]
								break
					"$CAT":
						if cats.actors.has(op[1]):
							cats.actors[op[1]]["x"] = op[2]
							cats.actors[op[1]]["y"] = op[3]
					"$CROWD":
						crowd = op[2]
					"$PUT":
						if JsUtil.is_undefined(op[3]):
							state[op[1]].erase(op[2])
						else:
							state[op[1]][op[2]] = op[3]
					"$GIVE":
						state["decor"]["stored"][op[1]] = 1.0
					"$MOM":
						ret = ParityWire.perform_on(moments, op, state, clock, sim)
					"$CATS":
						ret = ParityWire.perform_on(cats, op, state, clock, sim)
					"$MON":
						ret = ParityWire.perform_on(monitor, op, state, clock, sim)
					_:
						if op[1] == "$reload":
							var saved: Variant = JsJson.parse_or_fail(JsJson.stringify(sim.snapshot(state)))
							sim = CoreSim.new(rng.next_float)
							ret = sim.restore(saved, state)
						elif op[1] == "$resize":
							var from := CoreLayout.scene_height()
							CoreLayout.set_scene_height(op[2])
							sim.resize_scene(from)
						else:
							ret = ParityWire.perform(op, state, clock, sim)
				if ParityWire.digest(ret) != did["ret"]:
					return "line %d: %s returned something else: %s" % [n, op, ret]
			var events := sim.update(state, times["step"])
			monitor.update(state, sim)
			moments.update(state, sim, times["sim"], times["real"], _stage(state, cats, area))
			cats.update(state, times["cats"], sim.customers, sim.servers + crowd)
			if (ParityWire.digest(events) if not events.is_empty() else "0") != str(line["e"]).trim_suffix(".0"):
				return "line %d: events differ: %s" % [n, events]
			walls = line.has("w")
		var drawn := [rng.draws, moment_rng.draws, cat_rng.draws]
		if drawn != line["d"].map(func(x: float) -> int: return int(x)):
			return "line %d: random numbers drawn: expected=%s actual=%s" % [n, line["d"], drawn]
		if n == _dump_line:
			var dump: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(_dir.path_join("dump.json")))
			print("INSIDE ", ParityCompare.diff(_wire.value(dump["i"]), ParityWire.inside(sim), ""))
			print("STATE ", ParityCompare.diff(_wire.value(dump["s"]), state, ""))
			print("AROUND ", ParityCompare.diff(_wire.value(dump["x"]), ParityWire.around(moments, cats, monitor, walls), ""))
			print("ASKED ", ParityCompare.diff(_wire.value(dump["q"]), ParityWire.queries(sim, state), ""))
		if ParityWire.digest(ParityWire.inside(sim)) != line["i"]:
			return "line %d: the simulation differs (day %s, %s s, %s)" % [n, state["day"], state["dayTime"], state["phase"]]
		if ParityWire.digest(state) != line["s"]:
			return "line %d: the state differs (day %s, %s s, %s)" % [n, state["day"], state["dayTime"], state["phase"]]
		if ParityWire.digest(ParityWire.around(moments, cats, monitor, walls)) != line["x"]:
			return "line %d: moments, cats or the status differ (day %s, %s s, %s)" % [n, state["day"], state["dayTime"], state["phase"]]
		if line.has("q") and ParityWire.digest(ParityWire.queries(sim, state)) != line["q"]:
			return "line %d: an answer about the simulation differs (day %s, %s s, %s)" % [n, state["day"], state["dayTime"], state["phase"]]
	return "done"
