class_name CoreRegions
extends RefCounted

# Port of src/game/regions.ts

static var REGIONS: Array = RulesData.section("regions")["REGIONS"]
static var BUILD_SPEEDUP_PER_BRANCH: float = RulesData.section("regions")["BUILD_SPEEDUP_PER_BRANCH"]
static var MIN_BUILD_SHARE: float = RulesData.section("regions")["MIN_BUILD_SHARE"]
static var AREA_IDS: Array = RulesData.section("regions")["AREA_IDS"]
static var AREA_GRID: Dictionary = RulesData.section("regions")["AREA_GRID"]
static var AREA_LINKS: Array = RulesData.section("regions")["AREA_LINKS"]

static func opposite_direction(direction: String) -> String:
	match direction:
		"left": return "right"
		"right": return "left"
		"up": return "down"
		"down": return "up"
	return ""

static func adjacent_area(id: String, direction: String) -> Variant:
	for link in AREA_LINKS:
		if link["from"] == id and link["direction"] == direction:
			return link["to"]
		if link["to"] == id and opposite_direction(link["direction"]) == direction:
			return link["from"]
	return null

static func area_connections(id: String) -> Array:
	var out: Array = []
	for direction in ["left", "right", "up", "down"]:
		var to = adjacent_area(id, direction)
		if to != null:
			out.append({"direction": direction, "to": to})
	return out

static func region_offset(id: String) -> float:
	return float(AREA_IDS.find(id) * 320)

static func area_at_x(x: float) -> Variant:
	var idx_f: float = floor(x / 320.0)
	if not is_finite(idx_f):
		return JsUtil.UNDEFINED
	var idx := int(idx_f)
	var ids := AREA_IDS
	if idx < 0 or idx >= ids.size():
		return JsUtil.UNDEFINED
	return ids[idx]

static func region_def(id: Variant) -> Variant:
	if not (id is String):
		return JsUtil.UNDEFINED
	for r in REGIONS:
		if r["id"] == id:
			return r
	return JsUtil.UNDEFINED

static func _region_index(id: Variant) -> int:
	if not (id is String):
		return -1
	var regs := REGIONS
	for i in range(regs.size()):
		if regs[i]["id"] == id:
			return i
	return -1

static func build_share(branches: float) -> float:
	return JsMath.js_max(MIN_BUILD_SHARE, 1.0 / (1.0 + BUILD_SPEEDUP_PER_BRANCH * branches))

static func build_seconds(state: Dictionary, id: String) -> float:
	var has_chain := state.has("chain") and state["chain"] is Dictionary
	var branches := 0.0
	if has_chain and state["chain"].has("branches") and not JsUtil.is_nullish(state["chain"]["branches"]):
		branches = float(state["chain"]["branches"])
	var perk_mult := CoreChainBonuses.PERK_BUILD_SHARE if (has_chain and CoreChainBonuses.has_perk(state, "builders")) else 1.0
	return JsMath.js_round(float(region_def(id)["buildSeconds"]) * build_share(branches) * perk_mult)

static func is_area_open(state: Dictionary, id: String) -> bool:
	if id == "main":
		return true
	if id == "kitchen":
		return bool(state["kitchen"])
	return state["regions"].has(id)

static func is_region(id: Variant) -> bool:
	return _region_index(id) >= 0

static func main_table_count(state: Dictionary) -> float:
	return 2.0 + float(state["upgrades"]["tables"])

static func region_table_start(id: String) -> float:
	return float(8 + _region_index(id) * 4)

static func region_demand(state: Dictionary) -> float:
	var total := 0.0
	for r in REGIONS:
		if is_area_open(state, r["id"]):
			total += float(r["demand"])
	return total

static func active_table_indices(state: Dictionary) -> Array:
	var tables: Array = []
	var main_cnt := int(main_table_count(state))
	for i in range(main_cnt):
		tables.append(float(i))
	for r in REGIONS:
		if is_area_open(state, r["id"]):
			var start := int(region_table_start(r["id"]))
			var cnt := int(r["tables"])
			for i in range(cnt):
				tables.append(float(start + i))
	return tables

static func can_book_ahead(state: Dictionary) -> bool:
	var branches := 0.0
	if state.has("chain") and state["chain"] is Dictionary:
		var ch: Dictionary = state["chain"]
		if ch.has("branches") and not JsUtil.is_nullish(ch["branches"]):
			branches = float(ch["branches"])
	return branches > 0.0

static func parse_construction(value: Variant, regions: Array, now: float) -> Array:
	var list: Array = []
	if value is Array:
		list = value
	elif value is Dictionary:
		list = [value]
	var out: Array = []
	var latest := now
	var regs := REGIONS
	for raw in list:
		if not (raw is Dictionary):
			break
		var raw_id = raw["id"] if raw.has("id") else null
		var index := _region_index(raw_id)
		var has_fin: bool = raw.has("finishAt") and JsUtil.is_number(raw["finishAt"]) and is_finite(float(raw["finishAt"]))
		if index < 0 or index != regions.size() + out.size() or not has_fin:
			break
		var prev_fin := float(out[out.size() - 1]["finishAt"]) if not out.is_empty() else -INF
		latest = JsMath.js_min(JsMath.js_max(float(raw["finishAt"]), prev_fin), latest + float(regs[index]["buildSeconds"]) * 1000.0)
		out.append({"id": regs[index]["id"], "finishAt": latest})
	return out

static func region_block(state: Dictionary, id: String) -> Variant:
	if is_area_open(state, id):
		return "owned"
	var construction: Array = state["construction"]
	for c in construction:
		if c["id"] == id:
			return "building"
	var index := _region_index(id)
	var regs := REGIONS
	if index > 0:
		var previous: Dictionary = regs[index - 1]
		if not is_area_open(state, previous["id"]):
			var last_id = construction[construction.size() - 1]["id"] if not construction.is_empty() else null
			if last_id != previous["id"]:
				return "previous"
			if not can_book_ahead(state):
				return "busy"
	if state["phase"] != "prep":
		return "open"
	if float(state["coins"]) < float(region_def(id)["cost"]):
		return "coins"
	return null

static func unlock_region(state: Dictionary, id: String) -> bool:
	if region_block(state, id) != null or not state["construction"].is_empty():
		return false
	state["coins"] = float(state["coins"]) - float(region_def(id)["cost"])
	state["regions"].append(id)
	return true

static func start_construction(state: Dictionary, id: String, now: float) -> bool:
	if region_block(state, id) != null:
		return false
	state["coins"] = float(state["coins"]) - float(region_def(id)["cost"])
	var construction: Array = state["construction"]
	var last_fin := float(construction[construction.size() - 1]["finishAt"]) if not construction.is_empty() else now
	var start := JsMath.js_max(now, last_fin)
	construction.append({"id": id, "finishAt": start + build_seconds(state, id) * 1000.0})
	return true

static func construction_underway(state: Dictionary) -> Variant:
	var construction: Array = state["construction"]
	return construction[0] if not construction.is_empty() else null

static func construction_left(state: Dictionary, now: float, id: Variant = JsUtil.UNDEFINED) -> float:
	var construction: Array = state["construction"]
	var c: Variant = null
	if not JsUtil.is_nullish(id) and (not (id is String) or not id.is_empty()):
		for b in construction:
			if b["id"] == id:
				c = b
				break
	elif not construction.is_empty():
		c = construction[0]
	if c == null:
		return 0.0
	return JsMath.js_max(0.0, (float(c["finishAt"]) - now) / 1000.0)

static func finish_construction(state: Dictionary, now: float) -> Array:
	var opened: Array = []
	if state["phase"] != "prep":
		return opened
	var construction: Array = state["construction"]
	while not construction.is_empty() and float(construction[0]["finishAt"]) <= now:
		var c: Dictionary = construction.pop_front()
		state["regions"].append(c["id"])
		opened.append(c["id"])
	return opened
