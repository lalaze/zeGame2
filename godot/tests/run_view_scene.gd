extends SceneTree

## Repeats what `scripts/godot-parity/view-scene.ts` filmed of the floors view's own scene: the same café, the same
## choices, and every few frames where everyone and everything is. `--only=` picks films by the start of their names.

const _NEAR := 0.03
var passed := 0
var failed := 0
var frames := 0
var compared := 0
var _wire := ParityWire.new()
var _session: CoreGameSession
var _scene: FloorsScene
var _feed: FloorsFeed
var _clock := 0.0
var _chance: ParityCompare.CountedRng


func _init() -> void:
	_start.call_deferred()


func _start() -> void:
	FloorsText.font = load("res://app/cafe_app.gd").fonts()
	var dir := "res://.parity/view-scene"
	var only := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--only="):
			only = arg.trim_prefix("--only=")
		if arg.begins_with("--dir="):
			dir = arg.trim_prefix("--dir=")
	for file in DirAccess.get_files_at(dir):
		if not file.ends_with(".jsonl") or not file.begins_with(only):
			continue
		var problem := _film(dir.path_join(file))
		if problem == "done":
			passed += 1
		else:
			failed += 1
			print("FAIL: [%s] %s" % [file, problem])
		if _scene != null:
			_scene.free()
			_scene = null
	print("SCENE_SUMMARY: frames=%d compared=%d passed=%d failed=%d" % [frames, compared, passed, failed])
	quit(0 if failed == 0 and passed > 0 else 1)


func _film(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	var head: Dictionary = JSON.parse_string(file.get_line())
	_clock = _wire.value(head["clock"])
	CoreClock.override = floor(_clock)
	CoreLayout.reset_layout_state()
	CoreLayout.set_scene_height(240.0)
	I18n.locale = "en"
	var storage := CoreStorage.GuardedStorage.new(CoreStorage.MemoryStore.new())
	_session = CoreGameSession.new(CoreSaveSession.acquire(storage, CoreClock.now(), func() -> float: return 0.5), storage, func() -> float: return 0.5, func() -> float: return 0.5)
	_session.translate = I18n.t
	_session.state = _wire.value(head["state"])
	_chance = ParityCompare.CountedRng.new(int(head["seed"]))
	_session.sim = CoreSim.new(_chance.next_float)
	var snapshot: Variant = _wire.value(head["snapshot"])
	if not JsUtil.is_undefined(snapshot) and not _session.sim.restore(snapshot, _session.state):
		return "the snapshot does not fit"
	_feed = FloorsFeed.new()
	_feed.paused = false
	_scene = FloorsScene.new()
	var chance: float = head["chance"]
	_scene.random = func() -> float: return chance
	var library := FloorsLibrary.new()
	library.instant = true
	_scene.setup(library, _session, _feed)
	root.add_child(_scene)
	_scene.resized(Vector2(824.0, 1830.0))
	var n := 0
	while not file.eof_reached():
		var text := file.get_line()
		if text.is_empty():
			break
		var line: Dictionary = JSON.parse_string(text)
		var dt: float = _wire.value(line["dt"])
		_clock += dt * 1000.0
		CoreClock.override = floor(_clock)
		for op: Array in line.get("ops", []):
			_do(_wire.value(op))
		if not _feed.paused:
			var s := _session.state
			var left: float = dt if s["phase"] == "prep" else dt * s["speed"]
			while left > 1e-6:
				_feed.call("_told", "events", [_session.sim.update(s, minf(0.05, left))], _session)
				left -= 0.05
		for id: String in _session.cats.actors:
			_session.cats.actors[id]["affection"] = maxf(0.0, _session.cats.actors[id]["affection"] - dt)
		_feed.cat_happy = maxf(0.0, _feed.cat_happy - dt)
		_feed.cat_selection_seconds = maxf(0.0, _feed.cat_selection_seconds - dt)
		_scene.update(dt)
		library.arrive()
		frames += 1
		if line.has("seen"):
			compared += 1
			var order := _order() + _placed()
			if not order.is_empty():
				return "frame %d: %s" % [n, order]
			var problem := _diff(line["seen"], _seen(), "")
			if not problem.is_empty():
				return "frame %d: %s" % [n, problem]
		n += 1
	return "done" if n > 0 else "no frames"


func _do(op: Array) -> void:
	if op[0] != "$VIEW":
		ParityWire.perform(op, _session.state, _clock, _session.sim)
		return
	var v: Variant = op[2]
	match op[1]:
		"wall": _feed.outer_wall = v
		"paused": _feed.paused = v
		"moment": _feed.moment = v
		"reaction": _feed.moment_reaction = v
		"arrange": _feed.arrange = v
		"ghost": _feed.ghost = v
		"table": _feed.table_preview = v
		"gifts": _feed.gifts = v
		"affection": _session.cats.actors[v[0]] = {"affection": v[1]}
		"happy": _feed.cat_happy = v
		"select":
			_feed.selected_cat = v
			_feed.cat_selection_seconds = 6.0
		"sad":
			for c: Dictionary in _session.sim.customers:
				if c["id"] in v:
					c["mood"] = "sad"
					c["moodTimer"] = 6.0
		"drag":
			_scene.focus_y += v
			_scene.moved = true
			_scene.call("_frame_camera")


func _frame_name(p: FloorsPic) -> String:
	return str(p.frame) if p.frame is String or _scene.library.sheets.has(p.key) else "__BASE"


func _actor(a: FloorsScene.Actor) -> Array:
	return [a.at["floor"], a.at["x"], a.at["y"], a.goal, float(a.steps.size()), a.rate, a.sunk, a.pic.key, _frame_name(a.pic), a.pic.alpha, a.pic.flip, a.pic.visible, _frame_name(a.cup) if a.cup != null else ""]


func _seen() -> Dictionary:
	var customers := []
	for id: float in _scene.customers:
		customers.append([id] + _actor(_scene.customers[id]))
	var pool := []
	var props: Dictionary = _scene.props.get("_pool")
	var keys := props.keys()
	keys.sort()
	for key: String in keys:
		var p: FloorsPic = props[key]
		pool.append([key, "fx-case" if p.key == "fx/case-empty" else p.key, _frame_name(p), p.place.x, p.place.y, p.shown_size().x, p.alpha, p.turn, p.flip, p.crop.size.x])
	var cats := []
	var list: Dictionary = _scene.cats.get("_cats")
	for id: String in list:
		var c: FloorsCats.Cat = list[id]
		cats.append([id, c.at["floor"], c.at["x"], c.at["y"], c.plan, c.place["id"], float(c.steps.size()), c.hop != null, c.alpha, c.facing_left, str(c.pic.frame) if c.pic != null else ""])
	var visitor: FloorsCats.Cat = _scene.cats.get("_visitor")
	var gifts := []
	var waiting: Dictionary = _scene.cats.get("_gifts")
	for id: float in waiting:
		gifts.append([id, waiting[id]["at"].x, waiting[id]["at"].y])
	var look := _scene.sky.look
	var spill: Dictionary = _scene.cats.get("_spill")
	return {
		"customers": customers, "servers": _scene.servers.map(_actor), "cooks": _scene.cooks.map(_actor),
		"baristas": _scene.baristas.map(func(p: FloorsPic) -> Array: return [p.key, _frame_name(p), p.place.x, p.place.y, p.alpha, p.flip, p.visible]),
		"pool": pool, "cats": cats, "visitor": [visitor.plan, visitor.happy, str(visitor.pic.frame) if visitor.pic != null else ""] if visitor != null else null,
		"gifts": gifts, "spill": null if spill.is_empty() else [spill["at"]["floor"], spill["at"]["x"], spill["at"]["y"], spill["pic"].depth, spill["pic"].flip],
		"cue": [_scene.cue.key, _scene.cue.place.x, _scene.cue.place.y] if _scene.cue != null and _scene.cue.visible else null,
		"speaking": _scene.thoughts.speaking.keys(), "focus": _scene.focus_y, "wall": _scene.wall_alpha, "floors": _scene.built["floors"],
		"placed": _scene.get("_placed").map(func(p: Dictionary) -> Array: return [float(p["index"]), p["pic"].place.x, p["pic"].place.y, p["pic"].stretch.x, p["pic"].visible]),
		"ghost": _feed.ghost.get("spot") if _feed.ghost != null else null,
		"glow": _scene.get("_glow").visible, "look": [look["outside"], look["room"], look["lamps"]], "lamps": _scene.sky.get("_lamps").map(func(l: Dictionary) -> Array: return [l["pic"].place.x, l["pic"].place.y, l["pic"].shown_size().x, l["pic"].alpha, float(l["pic"].tint.to_rgba32() >> 8)]),
		"depths": _scene.customers.values().map(func(a: FloorsScene.Actor) -> float: return fmod(a.pic.depth, FloorsDepth.FRAME)),
		"tables": _scene.get("_table_pics").map(func(p: FloorsPic) -> Array: return [p.key, p.place.x, p.place.y, [p.crop.position.x, p.crop.position.y, p.crop.size.x, p.crop.size.y] if p.crop.size != Vector2.ZERO else null, p.size.x, p.size.y, p.depth]),
		"backs": _scene.get("_floor_pics").map(func(p: FloorsPic) -> Array: return [p.key, p.place.x, p.place.y, p.depth]),
	}


func _diff(expected: Variant, actual: Variant, path: String) -> String:
	if (expected is float or expected is int) and (actual is float or actual is int):
		return "" if absf(expected - actual) <= _NEAR * maxf(1.0, absf(expected) * 1e-4) else "%s: expected %s, got %s" % [path, expected, actual]
	if typeof(expected) != typeof(actual):
		return "%s: expected %s, got %s" % [path, str(expected).left(200), str(actual).left(200)]
	if expected is Array:
		if expected.size() != actual.size():
			return "%s: %d things, expected %d: %s instead of %s" % [path, actual.size(), expected.size(), str(actual).left(600), str(expected).left(600)]
		for i in expected.size():
			var problem := _diff(expected[i], actual[i], "%s[%d]" % [path, i])
			if not problem.is_empty():
				return problem + ("  in %s" % str(expected).left(220) if path.count("[") == 1 else "")
		return ""
	if expected is Dictionary:
		for k: String in expected:
			var problem := _diff(expected[k], actual.get(k), "%s.%s" % [path, k])
			if not problem.is_empty():
				return problem
		return ""
	return "" if expected == actual else "%s: expected %s, got %s" % [path, expected, actual]


## What is drawn is where it says: a node's place is where it stands and what it shows together.
func _placed() -> String:
	for child in _scene.get_children():
		var off := Vector2.ZERO
		if child is FloorsPic:
			off = child.position + child.sprite.position - child.place
		elif child is FloorsText:
			off = child.position + child.label.position + child.origin * child.label.size * child.stretch - child.place
		elif child is FloorsFront.Board:
			for holder: Node2D in child.get_children():
				off = child.position + holder.position - child.place if off == Vector2.ZERO else off
		if off.length() > 0.01:
			return "%s is drawn %s from its place" % [child, off]
	return ""


## Godot sorts the scene by z, then by y, where y's closer than is_equal_approx tells count as the same: what stands
## deeper must still come after.
func _order() -> String:
	var deep := []
	for child in _scene.get_children():
		if child is FloorsPic or child is FloorsText or child is FloorsMarks:
			deep.append(child)
	deep.sort_custom(func(a: Node2D, b: Node2D) -> bool: return a.depth < b.depth)
	for i in range(1, deep.size()):
		var a: Node2D = deep[i - 1]
		var b: Node2D = deep[i]
		if b.depth - a.depth < 0.0005:
			continue
		if a.z_index > b.z_index or (a.z_index == b.z_index and (is_equal_approx(a.position.y, b.position.y) or a.position.y > b.position.y)):
			return "depth %s is not over %s" % [b.depth, a.depth]
	return ""
