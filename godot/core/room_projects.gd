class_name CoreRoomProjects
extends RefCounted

## Port of src/game/room-projects.ts: side businesses in real time.

static var ROOM_PROJECTS: Array = RulesData.section("room-projects")["ROOM_PROJECTS"]
static var PROJECT_MODES: Dictionary = RulesData.section("room-projects")["PROJECT_MODES"]
static var BLUEPRINTS: Array = RulesData.section("room-projects")["BLUEPRINTS"]


static func empty_room_projects() -> Dictionary:
	return {"inspiration": 0.0, "collected": 0.0, "blueprints": [], "facilities": {}}


static func project_def(id: Variant) -> Variant:
	for p: Dictionary in ROOM_PROJECTS:
		if id is String and p["id"] == id:
			return p
	return JsUtil.UNDEFINED


static func _project_index(id: String) -> float:
	for i in ROOM_PROJECTS.size():
		if ROOM_PROJECTS[i]["id"] == id:
			return i
	return -1.0


static func has_blueprint(s: Dictionary, id: String) -> bool:
	return s["roomProjects"]["blueprints"].has(id)


static func project_available(s: Dictionary, id: String) -> bool:
	return CoreRegions.is_area_open(s, project_def(id)["area"]) and (id != "postcards" or s["day"] >= 3.0)


static func project_cycle_seconds(s: Dictionary, mode: String) -> float:
	return PROJECT_MODES[mode]["seconds"] * (0.8 if has_blueprint(s, "clockwork") else 1.0)


static func project_capacity(s: Dictionary, mode: String) -> float:
	return PROJECT_MODES[mode]["capacity"] + (2.0 if has_blueprint(s, "shelves") else 0.0)


static func _facility(s: Dictionary, id: String) -> Variant:
	return s["roomProjects"]["facilities"].get(id)


static func project_production(s: Dictionary, id: String, now: float) -> Dictionary:
	var facility: Variant = _facility(s, id)
	if not facility is Dictionary or not project_available(s, id):
		return {"batches": 0.0, "capacity": 0.0, "coins": 0.0, "inspiration": 0.0, "progress": 0.0, "left": 0.0, "full": false}
	var def: Dictionary = project_def(id)
	var mode: Dictionary = PROJECT_MODES[facility["mode"]]
	var cycle := project_cycle_seconds(s, facility["mode"])
	var capacity := project_capacity(s, facility["mode"])
	var elapsed := JsMath.js_max(0.0, (now - facility["since"]) / 1000.0)
	var batches := JsMath.js_min(capacity, floor(elapsed / cycle))
	var full := batches == capacity
	var progress := 1.0 if full else fmod(elapsed, cycle) / cycle
	return {
		"batches": batches, "capacity": capacity, "full": full, "progress": progress, "left": 0.0 if full else cycle * (1.0 - progress),
		"coins": batches * def["coins"] * mode["yield"] * facility["level"],
		"inspiration": batches * def["inspiration"] * mode["yield"] * facility["level"],
	}


## Claim only finished batches; repeated claims never lose the partial cycle.
static func collect_project(s: Dictionary, id: String, now: float) -> Dictionary:
	var result := project_production(s, id, now)
	var facility: Variant = _facility(s, id)
	if not facility is Dictionary or result["batches"] == 0.0:
		return result
	CoreEconomy.earn(s, result["coins"])
	s["roomProjects"]["inspiration"] += result["inspiration"]
	s["roomProjects"]["collected"] += result["inspiration"]
	facility["since"] = now if result["full"] else facility["since"] + result["batches"] * project_cycle_seconds(s, facility["mode"]) * 1000.0
	return result


static func collect_all_projects(s: Dictionary, now: float) -> Dictionary:
	var total := {"coins": 0.0, "inspiration": 0.0}
	for p: Dictionary in ROOM_PROJECTS:
		var reward := collect_project(s, p["id"], now)
		total["coins"] += reward["coins"]
		total["inspiration"] += reward["inspiration"]
	return total


static func project_upgrade_cost(s: Dictionary, id: String) -> Variant:
	var facility: Variant = _facility(s, id)
	var level: float = facility["level"] if facility is Dictionary else 0.0
	if level >= 3.0:
		return null
	return {"coins": project_def(id)["cost"] * JsMath.js_pow(2.0, level), "inspiration": level * 15.0 * (_project_index(id) + 1.0)}


static func project_upgrade_block(s: Dictionary, id: String) -> Variant:
	if not project_available(s, id):
		return "locked"
	var cost: Variant = project_upgrade_cost(s, id)
	if cost == null:
		return "max"
	if s["coins"] < cost["coins"]:
		return "coins"
	return "inspiration" if s["roomProjects"]["inspiration"] < cost["inspiration"] else null


static func upgrade_project(s: Dictionary, id: String, now: float) -> bool:
	if project_upgrade_block(s, id) != null:
		return false
	var cost: Dictionary = project_upgrade_cost(s, id)
	# Settle the old level first. Changing a setup starts a new cycle, never retroactive output.
	collect_project(s, id, now)
	var old: Variant = _facility(s, id)
	s["coins"] -= cost["coins"]
	s["roomProjects"]["inspiration"] -= cost["inspiration"]
	s["roomProjects"]["facilities"][id] = {"level": (old["level"] if old is Dictionary else 0.0) + 1.0, "mode": old["mode"] if old is Dictionary else "short", "since": now}
	return true


static func set_project_mode(s: Dictionary, id: String, mode: String, now: float) -> bool:
	var facility: Variant = _facility(s, id)
	if not facility is Dictionary or not project_available(s, id) or facility["mode"] == mode or not PROJECT_MODES.has(mode):
		return false
	collect_project(s, id, now)
	facility["mode"] = mode
	facility["since"] = now
	return true


static func buy_blueprint(s: Dictionary, id: String, now: float) -> bool:
	var def: Variant = null
	for b: Dictionary in BLUEPRINTS:
		if b["id"] == id:
			def = b
	if def == null or has_blueprint(s, id) or s["roomProjects"]["inspiration"] < def["cost"]:
		return false
	# Preserve partial progress at the old speed; extra capacity never resurrects overflow.
	var before := {}
	for p: Dictionary in ROOM_PROJECTS:
		before[p["id"]] = project_production(s, p["id"], now)
	var street_progress := CoreStreets.prepare_street_blueprint(s, now)
	collect_all_projects(s, now)
	s["roomProjects"]["inspiration"] -= def["cost"]
	s["roomProjects"]["blueprints"].append(id)
	CoreStreets.apply_street_blueprint(s, street_progress, now)
	for p: Dictionary in ROOM_PROJECTS:
		var facility: Variant = _facility(s, p["id"])
		if facility is Dictionary:
			var was: Dictionary = before[p["id"]]
			facility["since"] = now - (0.0 if was["full"] else was["progress"]) * project_cycle_seconds(s, facility["mode"]) * 1000.0
	return true


static func _count(v: Variant) -> float:
	return JsMath.js_min(9007199254740991, JsMath.js_max(0.0, floor(v))) if JsMath.is_finite_num(v) else 0.0


## Only open rooms can restore production; old saves start with an empty project book.
static func parse_room_projects(value: Variant, s: Dictionary, now: float) -> Dictionary:
	var base := empty_room_projects()
	var data: Variant = JsUtil.as_object(value)
	if data == null:
		return base
	base["inspiration"] = _count(JsUtil.prop(data, "inspiration"))
	base["collected"] = _count(JsUtil.prop(data, "collected"))
	var saved: Variant = JsUtil.prop(data, "blueprints")
	for b: Dictionary in BLUEPRINTS:
		if saved is Array and JsUtil.includes(saved, b["id"]):
			base["blueprints"].append(b["id"])
	var facilities: Variant = JsUtil.as_object(JsUtil.prop(data, "facilities"))
	for def: Dictionary in ROOM_PROJECTS:
		var f: Variant = JsUtil.as_object(JsUtil.prop(facilities, def["id"]))
		if f == null or not project_available(s, def["id"]):
			continue
		var level := JsMath.js_min(3.0, _count(JsUtil.prop(f, "level")))
		if level == 0.0:
			continue
		var mode: Variant = JsUtil.prop(f, "mode")
		var since: Variant = JsUtil.prop(f, "since")
		base["facilities"][def["id"]] = {
			"level": level, "mode": mode if mode is String and PROJECT_MODES.has(mode) else "short",
			"since": JsMath.js_min(now, JsMath.js_max(0.0, since)) if JsMath.is_finite_num(since) else now,
		}
	return base
