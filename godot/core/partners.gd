class_name CorePartners
extends RefCounted

# Port of src/game/partners.ts

static var PARTNER_ROLES: Array = RulesData.section("partners")["PARTNER_ROLES"]
static var PARTNERS: Array = RulesData.section("partners")["PARTNERS"]
static var PARTNER_RECRUIT_COST: float = RulesData.section("partners")["PARTNER_RECRUIT_COST"]
static var PARTNER_TRAIN_COST: float = RulesData.section("partners")["PARTNER_TRAIN_COST"]
static var PARTNER_TRAIN_XP: float = RulesData.section("partners")["PARTNER_TRAIN_XP"]
static var PARTNER_NODES: Array = RulesData.section("partners")["PARTNER_NODES"]

static func partner_definition(id: Variant) -> Variant:
	if not (id is String):
		return JsUtil.UNDEFINED
	for p in PARTNERS:
		if p["id"] == id:
			return p
	return JsUtil.UNDEFINED

static func fresh_partner() -> Dictionary:
	return {
		"xp": 0.0,
		"workedDays": 0.0,
		"lastWorkedDay": 0.0,
		"specialty": null,
		"unlocked": 0.0,
		"read": [],
		"todayDay": 0.0,
		"todayJobs": 0.0,
		"todayUnlocks": 0.0,
	}

static func empty_partners() -> Dictionary:
	return {"roster": {}, "active": {"barista": [], "server": [], "cook": []}}

static func partner_slots(s: Dictionary, role: String) -> float:
	var raw: float
	if role == "barista":
		raw = float(s["upgrades"]["barista"])
	elif role == "server":
		raw = 1.0 + float(s["upgrades"]["server"])
	else:
		raw = (1.0 + float(s["upgrades"]["cook"])) if bool(s["kitchen"]) else 0.0
	return JsMath.js_min(3.0, JsMath.js_max(0.0, raw))

static func sync_partners(s: Dictionary) -> Dictionary:
	if not s.has("partners") or JsUtil.is_nullish(s["partners"]):
		s["partners"] = empty_partners()
	var partners: Dictionary = s["partners"]
	var roster: Dictionary = partners["roster"]
	var active_map: Dictionary = partners["active"]
	for role in PARTNER_ROLES:
		var cap := int(partner_slots(s, role))
		var defs: Array = []
		for p in PARTNERS:
			if p["role"] == role:
				defs.append(p)
		var owned: Array = []
		for p in defs:
			if roster.has(p["id"]) and roster[p["id"]] is Dictionary:
				owned.append(p)
		for p in defs:
			if owned.size() >= cap:
				break
			if not roster.has(p["id"]) or not (roster[p["id"]] is Dictionary):
				roster[p["id"]] = fresh_partner()
				owned.append(p)
		var owned_ids: Dictionary = {}
		for p in owned:
			owned_ids[p["id"]] = true
		var seen: Dictionary = {}
		var active: Array = []
		for id in active_map[role]:
			if seen.has(id):
				continue
			seen[id] = true
			if owned_ids.has(id) and active.size() < cap:
				active.append(id)
		for p in owned:
			if active.size() < cap and not active.has(p["id"]):
				active.append(p["id"])
		active_map[role] = active
	return partners

static func _count(v: Variant, max_val: float = 1000000000.0) -> float:
	if JsUtil.is_number(v) and is_finite(float(v)):
		var fl: float = floor(float(v))
		return JsMath.js_min(max_val, JsMath.js_max(0.0, fl))
	return 0.0

static func parse_partners(raw: Variant, s: Dictionary) -> Dictionary:
	var value: Dictionary = JsUtil.as_object(raw) if JsUtil.as_object(raw) != null else {}
	var out := empty_partners()
	var s_day := float(s["day"])
	var nodes := PARTNER_NODES
	var raw_roster: Dictionary = value["roster"] if (value.has("roster") and value["roster"] is Dictionary) else {}
	for def in PARTNERS:
		var did: String = def["id"]
		var entry: Variant = JsUtil.as_object(JsUtil.prop(raw_roster, did))
		if entry == null:
			continue
		var p: Dictionary = entry
		var xp := _count(p["xp"] if p.has("xp") else JsUtil.UNDEFINED)
		var worked_days := JsMath.js_min(_count(p["workedDays"] if p.has("workedDays") else JsUtil.UNDEFINED, s_day), xp)
		var last_worked_day := _count(p["lastWorkedDay"] if p.has("lastWorkedDay") else JsUtil.UNDEFINED, s_day)
		var reachable := 0.0
		for n in nodes:
			if xp >= float(n["jobs"]) and worked_days >= float(n["days"]):
				reachable += 1.0
		var unlocked := JsMath.js_min(_count(p["unlocked"] if p.has("unlocked") else JsUtil.UNDEFINED, 3.0), reachable)
		var today_day := _count(p["todayDay"] if p.has("todayDay") else JsUtil.UNDEFINED, s_day)
		var spec_raw = p["specialty"] if p.has("specialty") else null
		var spec: Variant = spec_raw if (xp >= PARTNER_TRAIN_XP and (spec_raw is String) and (spec_raw == "a" or spec_raw == "b")) else null
		var read_arr: Array = []
		if p.has("read") and p["read"] is Array:
			var seen_r: Dictionary = {}
			for n in p["read"]:
				if JsUtil.is_number(n) and JsMath.is_integer(n):
					var nf := float(n)
					if nf >= 0.0 and nf < unlocked:
						var key := int(nf)
						if not seen_r.has(key):
							seen_r[key] = true
							read_arr.append(nf)
		var today_jobs := JsMath.js_min(_count(p["todayJobs"] if p.has("todayJobs") else JsUtil.UNDEFINED), xp) if today_day == s_day else 0.0
		var today_unlocks := JsMath.js_min(_count(p["todayUnlocks"] if p.has("todayUnlocks") else JsUtil.UNDEFINED, 3.0), unlocked) if today_day == s_day else 0.0
		out["roster"][did] = {
			"xp": xp,
			"workedDays": worked_days,
			"lastWorkedDay": last_worked_day,
			"unlocked": unlocked,
			"specialty": spec,
			"read": read_arr,
			"todayDay": today_day,
			"todayJobs": today_jobs,
			"todayUnlocks": today_unlocks,
		}
	var raw_active: Dictionary = value["active"] if (value.has("active") and value["active"] is Dictionary) else {}
	for role in PARTNER_ROLES:
		var filtered: Array = []
		if raw_active.has(role) and raw_active[role] is Array:
			for id in raw_active[role]:
				if id is String:
					var pdef = partner_definition(id)
					if not JsUtil.is_undefined(pdef) and pdef["role"] == role:
						filtered.append(id)
		out["active"][role] = filtered
	s["partners"] = out
	return sync_partners(s)

static func active_partner(s: Dictionary, role: String, index: float) -> Variant:
	var arr: Array = s["partners"]["active"][role]
	if not JsMath.is_integer(index):
		return JsUtil.UNDEFINED
	var idx := int(index)
	if idx < 0 or idx >= arr.size():
		return JsUtil.UNDEFINED
	return partner_definition(arr[idx])

static func recruit_partner(s: Dictionary, id: Variant) -> bool:
	sync_partners(s)
	var p = partner_definition(id)
	if JsUtil.is_undefined(p) or s["phase"] != "prep" or s["partners"]["roster"].has(id) or float(s["coins"]) < PARTNER_RECRUIT_COST:
		return false
	if p["role"] == "cook" and not bool(s["kitchen"]):
		return false
	s["coins"] = float(s["coins"]) - PARTNER_RECRUIT_COST
	s["partners"]["roster"][id] = fresh_partner()
	return true

static func assign_partner(s: Dictionary, id: Variant, slot: float) -> bool:
	sync_partners(s)
	var p = partner_definition(id)
	if JsUtil.is_undefined(p) or s["phase"] != "prep" or not s["partners"]["roster"].has(id):
		return false
	if not JsMath.is_integer(slot) or slot < 0.0 or slot >= partner_slots(s, p["role"]):
		return false
	var a: Array = s["partners"]["active"][p["role"]]
	var slot_i := int(slot)
	var old := a.find(id)
	var previous = a[slot_i]
	if old == slot_i:
		return false
	a[slot_i] = id
	if old >= 0:
		a[old] = previous
	return true

static func train_partner(s: Dictionary, id: Variant, choice: Variant) -> bool:
	var roster: Dictionary = s["partners"]["roster"]
	if not (id is String) or not roster.has(id):
		return false
	var p: Dictionary = roster[id]
	if s["phase"] != "prep" or float(p["xp"]) < PARTNER_TRAIN_XP or p["specialty"] == choice or float(s["coins"]) < PARTNER_TRAIN_COST:
		return false
	if not (choice is String) or (choice != "a" and choice != "b"):
		return false
	s["coins"] = float(s["coins"]) - PARTNER_TRAIN_COST
	p["specialty"] = choice
	return true

static func record_partner_work(s: Dictionary, id: Variant) -> void:
	if not (id is String) or id.is_empty() or s["phase"] == "prep":
		return
	var roster: Dictionary = s["partners"]["roster"]
	if not roster.has(id):
		return
	var p: Dictionary = roster[id]
	var s_day := float(s["day"])
	if float(p["todayDay"]) != s_day:
		p["todayDay"] = s_day
		p["todayJobs"] = 0.0
		p["todayUnlocks"] = 0.0
	p["xp"] = float(p["xp"]) + 1.0
	p["todayJobs"] = float(p["todayJobs"]) + 1.0
	if float(p["lastWorkedDay"]) != s_day:
		p["lastWorkedDay"] = s_day
		p["workedDays"] = float(p["workedDays"]) + 1.0
	var unlocked := 0.0
	for n in PARTNER_NODES:
		if float(p["xp"]) >= float(n["jobs"]) and float(p["workedDays"]) >= float(n["days"]):
			unlocked += 1.0
	p["todayUnlocks"] = float(p["todayUnlocks"]) + JsMath.js_max(0.0, unlocked - float(p["unlocked"]))
	p["unlocked"] = JsMath.js_max(float(p["unlocked"]), unlocked)

static func partner_contributions(s: Dictionary) -> Array:
	var out: Array = []
	var roster: Dictionary = s["partners"]["roster"]
	var s_day := float(s["day"])
	for d in PARTNERS:
		var did: String = d["id"]
		if not roster.has(did):
			continue
		var p: Dictionary = roster[did]
		if float(p["todayDay"]) == s_day and float(p["todayJobs"]) != 0.0:
			out.append({
				"id": did,
				"jobs": float(p["todayJobs"]),
				"unlocked": float(p["todayUnlocks"]),
				"xp": float(p["xp"]),
			})
	return out

static func read_partner_chapter(s: Dictionary, id: Variant, chapter: float) -> bool:
	var roster: Dictionary = s["partners"]["roster"]
	if not (id is String) or not roster.has(id):
		return false
	var p: Dictionary = roster[id]
	if not JsMath.is_integer(chapter) or chapter < 0.0 or chapter >= float(p["unlocked"]) or p["read"].has(chapter):
		return false
	p["read"].append(chapter)
	return true

static func partner_unread(s: Dictionary) -> float:
	var total := 0.0
	var roster: Dictionary = s["partners"]["roster"]
	for k in roster.keys():
		var p: Dictionary = roster[k]
		total += float(p["unlocked"]) - float(p["read"].size())
	return total

static func _specialty(s: Dictionary, id: Variant) -> Variant:
	if not (id is String) or id.is_empty():
		return null
	var roster: Dictionary = s["partners"]["roster"]
	if roster.has(id) and roster[id] is Dictionary:
		return roster[id]["specialty"]
	return null

static func partner_brew_multiplier(s: Dictionary, id: Variant, bakery: bool) -> float:
	var v = _specialty(s, id)
	if not (v is String) or v.is_empty():
		return 1.0
	var match_flag := (not bakery) if v == "a" else bakery
	return 0.8 if match_flag else 1.1

static func partner_server_speed(s: Dictionary, id: Variant, load_count: float) -> float:
	var v = _specialty(s, id)
	if v is String and v == "a":
		return 1.2
	if v is String and v == "b":
		return 1.1 if load_count >= 2.0 else 0.9
	return 1.0

static func partner_tray_size(s: Dictionary, id: Variant) -> float:
	var v = _specialty(s, id)
	return 1.0 if (v is String and v == "a") else 3.0

static func partner_cook_speed(s: Dictionary, id: Variant) -> float:
	var v = _specialty(s, id)
	if v is String and v == "a":
		return 0.9
	if v is String and v == "b":
		return 1.25
	return 1.0

static func partner_station_time(s: Dictionary, id: Variant) -> float:
	var v = _specialty(s, id)
	if v is String and v == "a":
		return 0.8
	if v is String and v == "b":
		return 1.1
	return 1.0
