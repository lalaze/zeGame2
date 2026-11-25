class_name ProjectsDialog
extends RefCounted

## The café's own projects and the chain's blueprints (src/ui/room-projects.ts).

var _ui: CafeUi
var _session: CoreGameSession
var _changed: Callable
var _wallet := Paper.words("", "strong")
var _collect_all: Button
var _rows: Dictionary = {}
var _plans: Dictionary = {}


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _money(n: float) -> String:
	return CoreFormat.format_transaction_money(n)


static func _time(seconds: float) -> String:
	return CoreFormat.format_duration(seconds, I18n.t)


static func show_projects(ui: CafeUi, changed: Callable) -> void:
	var d := ProjectsDialog.new()
	d._ui = ui
	d._session = ui.session
	d._changed = changed
	var body := d._build()
	body.set_meta("owner", d)
	d.update()
	ui.heartbeat.connect(d.update)
	body.tree_exiting.connect(func() -> void: ui.heartbeat.disconnect(d.update))
	ui.dialogs.show_dialog(_t("projects.title"), body, [{"label": _t("map.back")}], {"tall": true})


func _finish() -> void:
	_changed.call()
	update()


func _reward(r: Dictionary) -> void:
	_ui.dialogs.note(_t("projects.collected", {"money": _money(r["coins"]), "n": r["inspiration"]}))


func _build() -> Control:
	var s := _session.state
	_collect_all = Paper.button("", "primary", func() -> void:
		_reward(CoreRoomProjects.collect_all_projects(s, CoreClock.now()))
		_finish())
	var body := Paper.col([Paper.words(_t("projects.intro")), Paper.line([_wallet, _collect_all]), Paper.words(_t("projects.strategy"), "muted")], 10)
	for def: Dictionary in CoreRoomProjects.ROOM_PROJECTS:
		if def["area"] == "main":
			body.add_child(_project(def))
	body.add_child(Paper.words(_t("projects.blueprints"), "h3"))
	body.add_child(Paper.words(_t("projects.carry"), "muted"))
	for def: Dictionary in CoreRoomProjects.BLUEPRINTS:
		var id: String = def["id"]
		var b := Paper.button("", "primary", func() -> void:
			if CoreRoomProjects.buy_blueprint(s, id, CoreClock.now()):
				_finish())
		_plans[id] = {"button": b, "cost": def["cost"]}
		body.add_child(Paper.line([Paper.col([Paper.words(_t("projects.blueprint.%s.name" % id), "strong"), Paper.words(_t("projects.blueprint.%s.desc" % id), "muted")], 2), b]))
	return body


func _project(def: Dictionary) -> Control:
	var s := _session.state
	var id: String = def["id"]
	var r := {"def": def, "level": Paper.words("", "good", false), "status": Paper.words(""), "progress": Paper.progress(0.0), "yield": Paper.words("", "muted"), "modes": Paper.flow([], 6), "note": Paper.words(_t("projects.restartHint"), "muted"), "reason": Paper.words("", "muted")}
	for mode: String in CoreRoomProjects.PROJECT_MODES:
		r["mode:%s" % mode] = Paper.button("", "chip", func() -> void:
			if CoreRoomProjects.set_project_mode(s, id, mode, CoreClock.now()):
				_finish())
		r["modes"].add_child(r["mode:%s" % mode])
	r["collect"] = Paper.button("", "primary", func() -> void:
		var reward := CoreRoomProjects.collect_project(s, id, CoreClock.now())
		if reward["batches"] > 0.0:
			_reward(reward)
			_finish())
	r["upgrade"] = Paper.button("", "ghost", func() -> void:
		if CoreRoomProjects.upgrade_project(s, id, CoreClock.now()):
			_ui.dialogs.note(_t("projects.upgraded", {"name": _t("projects.%s.name" % id)}))
			_finish())
	_rows[id] = r
	var card := Paper.card("row")
	card.add_child(Paper.col([
		Paper.line([Portraits.icon("furniture:%s" % def["art"], 48.0), Paper.col([Paper.words(_t("area.%s.name" % def["area"]), "small"), Paper.words(_t("projects.%s.name" % id), "h3")], 0), r["level"]], 10),
		Paper.words(_t("projects.%s.desc" % id)), r["status"], r["progress"], r["yield"], r["modes"], r["note"], Paper.flow([r["collect"], r["upgrade"]]), r["reason"],
	], 6))
	return card


func update() -> void:
	var s := _session.state
	var now := CoreClock.now()
	_wallet.text = _t("projects.wallet", {"n": s["roomProjects"]["inspiration"]})
	var total := 0.0
	for id: String in _rows:
		var r: Dictionary = _rows[id]
		var def: Dictionary = r["def"]
		var facility: Variant = s["roomProjects"]["facilities"].get(id)
		var output := CoreRoomProjects.project_production(s, id, now)
		var cost: Variant = CoreRoomProjects.project_upgrade_cost(s, id)
		var block: Variant = CoreRoomProjects.project_upgrade_block(s, id)
		total += output["coins"]
		r["level"].text = "Lv.%s/3" % JsMath.number_to_string(facility["level"]) if facility != null else _t("projects.unbuilt")
		if not CoreRoomProjects.project_available(s, id):
			r["status"].text = _t("projects.dayLocked")
		elif facility == null:
			r["status"].text = _t("projects.startHint")
		else:
			r["status"].text = _t("projects.full", {"n": output["capacity"]}) if output["full"] else _t("projects.running", {"n": output["batches"], "cap": output["capacity"], "time": _time(ceilf(output["left"]))})
		r["progress"].visible = facility != null
		r["progress"].value = output["progress"]
		var mode: String = facility["mode"] if facility != null else "short"
		var level: float = facility["level"] if facility != null else 1.0
		var terms: Dictionary = CoreRoomProjects.PROJECT_MODES[mode]
		r["yield"].text = _t("projects.yield", {"money": _money(def["coins"] * terms["yield"] * level), "n": def["inspiration"] * terms["yield"] * level, "time": _time(CoreRoomProjects.project_cycle_seconds(s, mode)), "storage": _time(CoreRoomProjects.project_cycle_seconds(s, mode) * CoreRoomProjects.project_capacity(s, mode))})
		for part: String in ["modes", "note", "collect"]:
			r[part].visible = facility != null
		for m: String in CoreRoomProjects.PROJECT_MODES:
			r["mode:%s" % m].text = _t("projects.mode.%s" % m, {"time": _time(CoreRoomProjects.project_cycle_seconds(s, m))})
			Paper.dress(r["mode:%s" % m], "on" if m == mode else "chip")
		r["collect"].disabled = output["batches"] == 0.0
		r["collect"].text = _t("projects.collect", {"money": _money(output["coins"]), "n": output["inspiration"]})
		r["upgrade"].disabled = block != null
		r["upgrade"].text = _t("projects.upgrade" if facility != null else "projects.unlock", {"money": _money(cost["coins"]), "n": cost["inspiration"]}) if cost != null else _t("projects.max")
		var reason := ""
		if block is String and block == "coins":
			reason = _t("projects.needCoins", {"money": _money(cost["coins"] - s["coins"])})
		elif block is String and block == "inspiration":
			reason = _t("projects.needInspiration", {"n": cost["inspiration"] - s["roomProjects"]["inspiration"]})
		Paper.say(r["reason"], reason)
	_collect_all.disabled = total == 0.0
	_collect_all.text = _t("projects.collectAll", {"money": _money(total)})
	for id: String in _plans:
		var owned := CoreRoomProjects.has_blueprint(s, id)
		_plans[id]["button"].disabled = owned or s["roomProjects"]["inspiration"] < _plans[id]["cost"]
		_plans[id]["button"].text = _t("projects.researched" if owned else "projects.research", {"n": _plans[id]["cost"]})
