extends SceneTree

## Repeats the careers `scripts/godot-parity/session.ts` played through main.ts's own functions, with CoreGameSession:
## the same choices, frames, absences, restarts and storage trouble. Compares, every few frames, the state, the
## simulation, the moments, the cats, the save, the session itself, the random numbers drawn and everything the screen
## was told. `--dir=` picks the runs, `--only=` one of them.

var passed := 0
var failed := 0
var steps := 0
var _dir := ""
var _dump_line := -1
var _wire := ParityWire.new()
var _log: Array = []
var _clock := 0.0
var _rngs: Array = []
var _store: CoreStorage.MemoryStore
var _game: CoreGameSession
## The title of the dialog on screen.
var _dialog := ""
## Whether the last report has a trial drink's card.
var _trial_report := false


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
			var problem := _run(_dir.path_join(file))
			# A script error ends the run early with an empty answer.
			if problem == "done":
				passed += 1
			else:
				failed += 1
				print("FAIL: [%s] %s" % [file, problem])
	print("SESSION_SUMMARY: steps=%d passed=%d failed=%d elapsed_ms=%d" % [steps, passed, failed, Time.get_ticks_msec() - t0])
	quit(0 if failed == 0 and passed > 0 else 1)


func _told(what: String, args: Array) -> void:
	match what:
		"events":
			args = [ParityWire.digest(args[0])]
		"report":
			_trial_report = JsUtil.truthy(args[0].get("trialSale"))
			args = [ParityWire.digest(args[0])]
		"hud":
			var n: Variant = _game.manager_countdown()
			args = [null if n == null else "manager.opening" + JsJson.stringify({"n": n})]
		"assist":
			args = [args[0], ParityWire.digest(args[1]) if args[1] is Dictionary else args[1]]
	_log.append([what] + args)
	if what in ["modal", "report"]:
		_dialog = args[0] if what == "modal" else "report"
	if what in ["modal", "report", "soldOut", "prepare", "firstOpening", "recommend"]:
		_game.modal_open = true
	elif what == "onboarding":
		_game.onboarding_open = true


func _set_clock(value: float) -> void:
	_clock = value
	CoreClock.override = floor(value)


func _launch(height: float = 240.0) -> void:
	var guarded := CoreStorage.GuardedStorage.new(_store)
	var session := CoreSaveSession.acquire(guarded, CoreClock.now(), _rngs[0].next_float)
	CoreLayout.set_scene_height(height)
	_game = CoreGameSession.new(session, guarded, _rngs[1].next_float, _rngs[2].next_float)
	_game.translate = func(key: String, params: Dictionary = {}) -> String: return key + (JsJson.stringify(params) if not params.is_empty() else "")
	_game.item_name = func(id: String) -> String: return "item:%s" % id
	_game.duration = func(seconds: float) -> String: return "dur:%s" % JsMath.number_to_string(seconds)
	_game.ui.connect(_told)
	_game.fit_scene()
	_game.start()


func _do(op: Array) -> Variant:
	match op[0]:
		"$G":
			return _choose(op[1], op.slice(2))
		"$UI":
			match op[1]:
				"modal": _game.modal_open = op[2]
				"drawer": _game.drawer_paused = op[2]
				"street": _game.street_open = op[2]
				"mobile": _game.mobile_hud_expanded = op[2]
				"step": _game.guide_opening_step = op[2]
				"simplify": _game.guide_simplify = op[2]
				"arrange": _game.arranging = op[2]
				"panelCollapsed": _game.panel_collapsed = op[2]
				"area": _game.scene_area = op[2]
				"overview": _game.overview = op[2]
				"panning": _game.panning = op[2]
			return null
		"$MOMENT":
			_game.moments.active = op[2]
			return null
		"$WAIT":
			_set_clock(_clock + op[2])
			return null
		"$HIDE":
			_game.set_hidden(true)
			return null
		"$SHOW":
			_game.set_hidden(false)
			return null
		"$STORE":
			match op[1]:
				"edit": _store.items[CoreState.SAVE_KEY] = op[2]
				"failReads": _store.fail_reads = op[2]
				"failWrites": _store.fail_writes = op[2]
			return null
		"$RESTART":
			if op[1] == "close":
				_game.close()
			_launch(op[2] if op.size() > 2 else 240.0)
			return _game.session.mode
	return ParityWire.perform(op, _game.state, _clock, _game.sim)


func _choose(what: String, args: Array) -> Variant:
	match what:
		"speed": _game.set_speed(args[0])
		"closeDay": _game.close_day(args[0])
		"press":
			match [_dialog, args[0]]:
				["day.closeConfirm.title", 1.0]: _game.close_day(true)
				["day.finishNow", 1.0]: _game.finish_now()
				["report", 0.0]: _game.next_day()
		"changed": _game.stock_changed()
		"trialAgain":
			if _trial_report:
				_game.trial_result_changed()
		"storyRead": _game.save_game()
		"answer": _game.answer_recommendation(args[0])
		"helpBrew": return _game.help_brew()
		"help":
			var options := _game.service_help_options()
			var list := options.map(func(o: Dictionary) -> Array: return [o["title"], o["detail"], o.get("customerId")])
			return [list, _game.perform_help(options[int(args[0]) % options.size()]) if not options.is_empty() else null]
		"helpTwice":
			var options := _game.service_help_options()
			if options.is_empty():
				return [0.0, null, null]
			return [float(options.size()), _game.perform_help(options[0]), _game.perform_help(options[-1])]
		"helpLate":
			var options := _game.service_help_options()
			_game.modal_open = true
			var done := options.map(_game.perform_help)
			_game.modal_open = false
			return done
		"onboarded":
			_game.onboarding_open = false
			_game.finish_onboarding(args[0]["profile"], args[0].get("theme", ""))
		"applyProfile": _game.apply_profile(args[0]["profile"], args[0].get("theme", ""))
		"greet": _game.greet_resident(args[0])
		"locate": _game.locate_resident(args[0])
		_: _game.callv(what.to_snake_case(), args)
	return null


func _inside() -> Dictionary:
	return {
		"startupComplete": _game.startup_complete, "managerWait": _game.manager_wait, "managerCounting": _game.manager_counting, "awaySettled": _game._away_settled, "announcedOrder": _game._announced_order,
		"uiTimer": _game._ui_timer, "hint": _game.hint_shown, "panelCollapsed": _game.panel_collapsed, "arranging": _game.arranging, "save": _store.items.get(CoreState.SAVE_KEY), "notice": not _game.notice.is_empty(), "area": _game.scene_area, "overview": _game.overview, "active": _game.session.active, "paused": _game.scene_paused,
	}


## Where an int hides: it would divide, overflow and print unlike JavaScript's numbers.
func _whole_number(v: Variant, where: String) -> String:
	match typeof(v):
		TYPE_INT:
			return where
		TYPE_ARRAY:
			for i in v.size():
				var at := _whole_number(v[i], "%s[%d]" % [where, i])
				if not at.is_empty():
					return at
		TYPE_DICTIONARY:
			for k: Variant in v:
				var at := _whole_number(v[k], "%s.%s" % [where, k])
				if not at.is_empty():
					return at
	return ""


func _run(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	var start: Dictionary = JSON.parse_string(file.get_line())
	var chance := int(start["seed"])
	_rngs = [ParityCompare.CountedRng.new(chance * 17 + 1), ParityCompare.CountedRng.new(chance * 19 + 2), ParityCompare.CountedRng.new(chance * 23 + 3)]
	_store = CoreStorage.MemoryStore.new()
	_log = []
	CoreLayout.reset_layout_state()
	_set_clock(_wire.value(start["clock"]))
	_launch()
	var n := 0
	while not file.eof_reached():
		var text := file.get_line()
		if text.is_empty():
			break
		n += 1
		steps += 1
		var line: Dictionary = JSON.parse_string(text)
		for did: Dictionary in line.get("ops", []):
			var op: Array = _wire.value(did["op"])
			var ret: Variant = _do(op)
			if ParityWire.digest(ret) != did["ret"]:
				return "line %d: %s returned something else: %s" % [n, str(op).left(200), str(ret).left(300)]
		var dt: float = _wire.value(line["dt"])
		for _i in int(line["n"]):
			_set_clock(_clock + dt * 1000.0)
			_game.frame(dt)
			_game.advance_autosave(dt)
		if n == _dump_line:
			var dump: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(_dir.path_join("dump.json")))
			print("INSIDE ", ParityCompare.diff(_wire.value(dump["i"]), ParityWire.inside(_game.sim), ""))
			print("STATE ", ParityCompare.diff(_wire.value(dump["s"]), _game.state, ""))
			print("AROUND ", ParityCompare.diff(_wire.value(dump["x"]), ParityWire.around(_game.moments, _game.cats, _game.monitor, false), ""))
			print("TOLD ", ParityCompare.diff(_wire.value(dump["log"]), _log, ""))
			var mine := _inside()
			for k: String in ["save", "notice", "area", "overview", "active", "paused"]:
				mine.erase(k)
			print("SESSION ", ParityCompare.diff(_wire.value(dump["g"]), mine, ""))
		var where := "line %d (day %s, %s s, %s)" % [n, _game.state["day"], _game.state["dayTime"], _game.state["phase"]]
		if ParityWire.digest(_log) != line["log"]:
			return "%s: the screen was told something else: %d things, expected %d: %s" % [where, _log.size(), int(line["told"]), str(_log).left(900)]
		_log = []
		var drawn := _rngs.map(func(r: ParityCompare.CountedRng) -> int: return r.draws)
		if drawn != line["d"].map(func(x: float) -> int: return int(x)):
			return "%s: random numbers drawn: expected=%s actual=%s" % [where, line["d"], drawn]
		if ParityWire.digest(ParityWire.inside(_game.sim)) != line["i"]:
			return "%s: the simulation differs" % where
		if ParityWire.digest(_game.state) != line["s"]:
			return "%s: the state differs" % where
		var whole := _whole_number(_game.state, "state")
		if not whole.is_empty():
			return "%s: an integer where JavaScript has a number: %s" % [where, whole]
		if ParityWire.digest(ParityWire.around(_game.moments, _game.cats, _game.monitor, false)) != line["x"]:
			return "%s: moments, cats or the status differ" % where
		if ParityWire.digest(_inside()) != line["g"]:
			return "%s: the session or its save differs" % where
	return "done" if n > 0 else "no lines"
