extends SceneTree

## Walks through the screens the way `scripts/godot-parity/ui.ts` walked through the page's own: opens the same ones on
## the same cafés, presses the same things, and after every press compares what the screen says, which buttons work and
## the passing note, and in the end the save. `--only=` picks one of the files; `--walk=` one walk of it.

var passed := 0
var failed := 0
var looks := 0
var _wire := ParityWire.new()
var _scene: FloorsScene
var _ui: CafeUi
var _session: CoreGameSession
var _chance: ParityCompare.CountedRng
var _squash := RegEx.create_from_string("[\\s\\x{00a0}]+")


func _init() -> void:
	_start.call_deferred()


func _start() -> void:
	# The smallest phone there is room for.
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	root.size = Vector2i(360, 640)
	FloorsText.font = load("res://app/cafe_app.gd").fonts()
	var dir := "res://.parity/ui"
	var only := ""
	var one := -1
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--only="):
			only = arg.trim_prefix("--only=")
		if arg.begins_with("--walk="):
			one = int(arg.trim_prefix("--walk="))
	LedgerRows.at_once = true
	var ticks := [1000]
	StreetMap.ticks = func() -> int: return ticks[0]
	for file in DirAccess.get_files_at(dir):
		if not file.ends_with(".jsonl") or not file.begins_with(only):
			continue
		var lines := FileAccess.open(dir.path_join(file), FileAccess.READ)
		var n := -1
		while not lines.eof_reached():
			var text := lines.get_line()
			n += 1
			if text.is_empty() or (one >= 0 and n != one):
				continue
			var walk: Dictionary = JSON.parse_string(text)
			var problem: String = _hints(walk["rows"]) if walk["screen"] == "hints" else await _walk(walk, ticks)
			if problem.is_empty():
				passed += 1
			else:
				failed += 1
				if failed <= 12:
					print("FAIL: [%s %d] %s" % [file, n, problem])
			if _ui != null:
				_ui.queue_free()
				_ui = null
			await process_frame
	print("UI_SUMMARY: looks=%d passed=%d failed=%d" % [looks, passed, failed])
	quit(0 if failed == 0 and passed > 0 else 1)


func _walk(w: Dictionary, ticks: Array) -> String:
	_open(w)
	var what := "%s %s %s" % [w["screen"], _wire.value(w["arg"]), w["locale"]]
	var list := []
	for i in w["steps"].size():
		var step: Dictionary = w["steps"][i]
		var pressed := ""
		if i == 0:
			_show(w["screen"], _wire.value(w["arg"]), w)
		else:
			var can := list.filter(func(x: Dictionary) -> bool: return x["k"] != "text" and x["on"])
			var at := int(step["act"][0])
			if at >= can.size():
				return "%s, look %d: nothing to press at %d" % [what, i, at]
			_ui.dialogs.hush()
			pressed = " after %s" % can[at]["v"]
			_press(can[at], step["act"][1])
		await process_frame
		await process_frame
		# The heartbeat, four times a second.
		ticks[0] = int(step["ticks"])
		if _ui.street != null:
			_ui.street.update()
		_ui.heartbeat.emit()
		if _ui.ledger.visible and not _ui.dialogs.is_open():
			_ui.ledger.update()
		list = _seen()
		looks += 1
		var note: Label = _ui.dialogs.get("_note")
		var problem := _compare(step, list, _flat(note.text) if note.visible else "")
		if problem.is_empty():
			problem = _past_the_screen()
		if not problem.is_empty():
			return "%s, look %d%s: %s" % [what, i, pressed, problem]
	var end := CoreState.serialize(_session.state)
	return "" if end == w["end"] else "%s: the save differs, %s" % [what, _first(end, w["end"])]


## Every hint a style's goal can give.
func _hints(rows: Array) -> String:
	for row: Array in rows:
		var key := StyleDialog.hint_key({"id": row[0]}, row[1])
		if key != row[2]:
			return "%s of %s: expected %s, got %s" % [row[0], row[1], row[2], key]
	return "" if rows.size() > 30 else "only %d hints" % rows.size()


static func _first(a: String, b: String) -> String:
	for i in mini(a.length(), b.length()):
		if a[i] != b[i]:
			return "%s… and not …%s" % [a.substr(maxi(0, i - 60), 120), b.substr(maxi(0, i - 20), 80)]
	return "%d and %d letters" % [a.length(), b.length()]


# ---------------------------------------------------------------- a café and a screen

func _open(w: Dictionary) -> void:
	CoreClock.override = floor(_wire.value(w["clock"]))
	CoreLayout.reset_layout_state()
	CoreLayout.set_scene_height(240.0)
	I18n.locale = w["locale"]
	var storage := CoreStorage.GuardedStorage.new(CoreStorage.MemoryStore.new())
	var chance := func() -> float: return 0.5
	_session = CoreGameSession.new(CoreSaveSession.acquire(storage, CoreClock.now(), chance), storage, chance, chance)
	_session.translate = I18n.t
	_session.state = _wire.value(w["state"])
	_session.item_name = func(id: String) -> String: return I18n.item_name(id, _session.state)
	_session.duration = func(seconds: float) -> String: return CoreFormat.format_duration(seconds, I18n.t)
	_session.startup_complete = true
	storage.set_preference("tiny-bean-cafe/first-service/%s" % JsMath.number_to_string(_session.state["createdAt"]), "done")
	_chance = ParityCompare.CountedRng.new(int(w["seed"]))
	_session.sim = CoreSim.new(_chance.next_float)
	var snapshot: Variant = _wire.value(w["snapshot"])
	if not JsUtil.is_undefined(snapshot):
		_session.sim.restore(snapshot, _session.state)
	var feed := FloorsFeed.new()
	if _scene == null:
		_scene = FloorsScene.new()
		_scene.setup(FloorsLibrary.new(), _session, feed)
	_ui = CafeUi.new(_session, feed, _scene)
	root.add_child(_ui)
	_ui.inset(0.0, 0.0)


func _show(screen: String, arg: Variant, w: Dictionary) -> void:
	var s := _session.state
	match screen:
		"ledger": _ui.show_tab(arg)
		"intro":
			_ui.show_tab("menu")
			_ui.ledger.set_intro(true)
		"prepare": _session.prepare_day()
		"firstOpening": FirstOpening.show_opening(_ui, arg)
		"report": SettlementDialog.show_report(_ui, _wire.value(w["report"]))
		"reputation": SmallDialogs.reputation(_ui.dialogs, s)
		"money": SmallDialogs.money(_ui.dialogs, s["coins"], arg)
		"partners": PartnerDialog.show_partners(_ui, arg if arg is String else "")
		"regulars": RegularsDialog.show_regulars(_ui)
		"styles": StyleDialog.show_styles(_ui, _session.stock_changed)
		"taste": TasteDialog.show_taste(_ui.dialogs, _session, arg, func() -> void: pass)
		"book": MilestoneBook.show_book(_ui.dialogs, s)
		"perks": ChainDialogs.show_perks(_ui.dialogs, s, func() -> void: pass)
		"map": _ui.open_branch_map()
		"lab": SignatureLab.show_lab(_ui, _session.stock_changed)
		"street": _ui.open_street()
		"projects": ProjectsDialog.show_projects(_ui, _session.stock_changed)
		"soldOut": SmallDialogs.sold_out(_ui.dialogs, _session)
		"recommend":
			for c: Dictionary in _session.sim.customers:
				if c["id"] == arg:
					var options := [c["order"]]
					for id: String in s["onMenu"]:
						if id not in options:
							options.append(id)
					SmallDialogs.recommend(_ui.dialogs, _session, c, options.slice(0, 3))
		"trial": _ui.dialogs.show_dialog(I18n.t("trial.title"), TrialCards.result(_session, _session.stock_changed), [{"label": I18n.t("settings.back")}])
		"cat":
			for pet: Dictionary in s["pets"]:
				if pet["id"] == arg:
					LivingCatCard.show_cat(_ui.dialogs, pet, null, _session.greet_resident.bind(arg), func() -> void: pass)


func _press(x: Dictionary, value: Variant) -> void:
	var node: Control = x["node"]
	match x["k"]:
		"button": node.pressed.emit()
		"box": node.button_pressed = not node.button_pressed
		"list":
			node.select(int(value))
			node.item_selected.emit(int(value))
		"entry":
			node.text = value
			node.text_changed.emit(value)
			node.text_submitted.emit(value)
		"fold":
			var e := InputEventMouseButton.new()
			e.button_index = MOUSE_BUTTON_LEFT
			e.pressed = false
			node.gui_input.emit(e)


# ---------------------------------------------------------------- what a screen says

func _flat(text: String) -> String:
	return _squash.sub(text, "", true)


func _seen() -> Array:
	var out := []
	if _ui.dialogs.is_open():
		_gather(_ui.dialogs.get("_box"), out)
	elif _ui.street != null:
		_gather(_ui.street, out)
	elif _ui.ledger.visible:
		for part: String in ["_tab_row", "_task", "_scroll", "_footer"]:
			_gather(_ui.ledger.get(part), out)
	return out


func _say(text: String, out: Array) -> void:
	var flat := _flat(text)
	if flat.is_empty():
		return
	if not out.is_empty() and out[-1]["k"] == "text":
		out[-1]["v"] += flat
	else:
		out.append({"k": "text", "v": flat})


func _gather(of: Control, out: Array) -> void:
	if not of.visible or of.has_meta("mark") or of.is_queued_for_deletion():
		return
	if of is CheckBox:
		out.append({"k": "box", "v": "x" if of.button_pressed else "", "on": not of.disabled, "node": of})
		_say(of.text, out)
		return
	if of is OptionButton:
		out.append({"k": "list", "v": _flat(of.text), "on": not of.disabled, "node": of})
		return
	if of is LineEdit:
		out.append({"k": "entry", "v": of.text, "on": of.editable, "node": of})
		return
	if of is Button:
		var inside := []
		_say(of.text, inside)
		for child in of.get_children():
			if child is Control:
				_gather(child, inside)
		out.append({"k": "button", "v": "".join(PackedStringArray(inside.map(func(x: Dictionary) -> String: return x["v"]))), "on": not of.disabled, "node": of})
		return
	if of.has_meta("fold"):
		var title := []
		for child in of.get_children():
			_gather(child, title)
		out.append({"k": "fold", "v": title[0]["v"] if not title.is_empty() else "", "on": true, "node": of})
		return
	if of is Label:
		_say(of.text, out)
	for child in of.get_children():
		if child is Control:
			_gather(child, out)


## Something to read or to press, or paper, that is past the sides of the screen, where nothing scrolls to it.
func _past_the_screen() -> String:
	var page := root.get_visible_rect()
	var of: Control = _ui.dialogs.get("_box") if _ui.dialogs.is_open() else (_ui.street as Control if _ui.street != null else (_ui.ledger if _ui.ledger.visible else _ui.hud))
	for node: Node in of.find_children("*", "Control", true, false):
		var c := node as Control
		if not (c is Label or c is BaseButton or c is LineEdit or c is PanelContainer) or not c.is_visible_in_tree():
			continue
		var held := false
		var up: Node = c.get_parent()
		while up != null and up != of:
			held = held or (up is ScrollContainer and (up as ScrollContainer).horizontal_scroll_mode != ScrollContainer.SCROLL_MODE_DISABLED) or up is BaseButton
			up = up.get_parent()
		var rect := c.get_global_rect()
		if not held and (rect.position.x < page.position.x - 0.5 or rect.end.x > page.end.x + 0.5):
			return "past the screen: %s %s" % [c.get("text") if not c is PanelContainer else c.get_path(), rect]
	return ""


func _compare(step: Dictionary, list: Array, note: String) -> String:
	var want: Array = step["seen"]
	for i in maxi(want.size(), list.size()):
		var here: Variant = null
		if i < list.size():
			here = list[i]["v"] if list[i]["k"] == "text" else [list[i]["k"], list[i]["v"], list[i]["on"]]
		var there: Variant = want[i] if i < want.size() else null
		if typeof(here) != typeof(there) or here != there:
			if here is String and there is String:
				return "%d: %s" % [i, _first(here, there)]
			return "%d: expected %s, got %s" % [i, JSON.stringify(there), JSON.stringify(here)]
	if note != step["note"]:
		return "the note: expected \"%s\", got \"%s\"" % [step["note"], note]
	return ""
