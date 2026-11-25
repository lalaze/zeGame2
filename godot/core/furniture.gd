class_name CoreFurniture
extends RefCounted

# Port of src/game/furniture.ts

static var _by_id: Dictionary = {}
static var _by_id_ready: bool = false

static var FURNITURE: Array = RulesData.section("furniture")["FURNITURE"]
static var CELL: float = RulesData.section("furniture")["CELL"]
static var COLS: float = RulesData.section("furniture")["COLS"]
static var FLOOR_ROWS: float = RulesData.section("furniture")["FLOOR_ROWS"]
static var WALL_TOP: float = RulesData.section("furniture")["WALL_TOP"]
static var WALL_ROWS: float = RulesData.section("furniture")["WALL_ROWS"]
static var STARTER_FURNITURE: Array = RulesData.section("furniture")["STARTER_FURNITURE"]
static var DEFAULT_ART_SPOT: Dictionary = RulesData.section("furniture")["DEFAULT_ART_SPOT"]

static func _ensure_by_id() -> void:
	if _by_id_ready:
		return
	_by_id_ready = true
	for f in FURNITURE:
		_by_id[f["id"]] = f

static func furniture_def(id: Variant) -> Variant:
	_ensure_by_id()
	if id is String and _by_id.has(id):
		return _by_id[id]
	return JsUtil.UNDEFINED

static func _wall_free() -> Array:
	var wt := WALL_TOP
	var wh := WALL_ROWS * CELL
	return [
		{"x": 72.0, "y": wt, "w": 40.0, "h": wh},
		{"x": 216.0, "y": wt, "w": 32.0, "h": wh},
	]

static func _floor_reserved() -> Array:
	var fy := CoreLayout.FLOOR_Y
	var minh := CoreLayout.MIN_SCENE_H
	return [
		{"x": 64.0, "y": fy, "w": 192.0, "h": 48.0},
		{"x": 128.0, "y": fy + 48.0, "w": 64.0, "h": minh},
		{"x": 8.0, "y": fy, "w": 56.0, "h": 46.0},
		{"x": 256.0, "y": fy, "w": 56.0, "h": 46.0},
		{"x": 122.0, "y": minh - 15.0, "w": 12.0, "h": 9.0},
		{"x": 186.0, "y": minh - 15.0, "w": 12.0, "h": 9.0},
	]

static func _table_rect(i: float) -> Dictionary:
	var t := CoreLayout.table_spot_min(i)
	var hw := CoreLayout.TABLE_HALF_WIDTH
	return {
		"x": float(t["x"]) - hw,
		"y": float(t["y"]) - 30.0,
		"w": hw * 2.0,
		"h": 51.0,
	}

static func _overlaps(a: Dictionary, b: Dictionary) -> bool:
	return (float(a["x"]) < float(b["x"]) + float(b["w"])
		and float(b["x"]) < float(a["x"]) + float(a["w"])
		and float(a["y"]) < float(b["y"]) + float(b["h"])
		and float(b["y"]) < float(a["y"]) + float(a["h"]))

static func _inside(a: Dictionary, b: Dictionary) -> bool:
	return (float(a["x"]) >= float(b["x"])
		and float(a["y"]) >= float(b["y"])
		and float(a["x"]) + float(a["w"]) <= float(b["x"]) + float(b["w"])
		and float(a["y"]) + float(a["h"]) <= float(b["y"]) + float(b["h"]))

static func footprint(def: Dictionary, col: float, row: float) -> Dictionary:
	var top := WALL_TOP if def["surface"] == "wall" else CoreLayout.FLOOR_Y
	var cell := CELL
	return {
		"x": col * cell,
		"y": top + row * cell,
		"w": float(def["w"]) * cell,
		"h": float(def["h"]) * cell,
	}

static func can_place(state: Dictionary, id: Variant, col: float, row: float, tables: float, skip: float = -1.0) -> bool:
	var def = furniture_def(id)
	return not JsUtil.is_undefined(def) and _fits(state, def, col, row, tables, skip)

static func _fits(state: Dictionary, def: Dictionary, col: float, row: float, tables: float, skip: float) -> bool:
	var rows := WALL_ROWS if def["surface"] == "wall" else FLOOR_ROWS
	if not JsMath.is_integer(col) or not JsMath.is_integer(row):
		return false
	var cell := CELL
	var area_v = CoreRegions.area_at_x(col * cell)
	if JsUtil.is_undefined(area_v):
		return false
	var area: String = str(area_v)
	if area == "kitchen" or not CoreRegions.is_area_open(state, area):
		return false
	var start := CoreRegions.region_offset(area) / cell
	var dw := float(def["w"])
	var dh := float(def["h"])
	if col < start or row < 0.0 or col + dw > start + COLS or row + dh > rows:
		return false
	var box := footprint(def, col, row)
	var sw := CoreLayout.SCENE_W
	if def["surface"] == "wall":
		if area == "main":
			var any_in := false
			for free_r in _wall_free():
				if _inside(box, free_r):
					any_in = true
					break
			if not any_in:
				return false
		else:
			var reg_x := CoreRegions.region_offset(area)
			if not _inside(box, {"x": reg_x + 16.0, "y": WALL_TOP, "w": 288.0, "h": WALL_ROWS * cell}):
				return false
			if CoreRegions.adjacent_area(area, "up") != null and _overlaps(box, {"x": reg_x + 136.0, "y": WALL_TOP, "w": 48.0, "h": WALL_ROWS * cell}):
				return false
	else:
		var reg_x := CoreRegions.region_offset(area)
		if _overlaps(box, {"x": reg_x, "y": 126.0, "w": sw, "h": 24.0}):
			return false
		if col < start + 1.0 or col + dw > start + COLS - 1.0:
			return false
		if area == "main":
			for r in _floor_reserved():
				if _overlaps(box, r):
					return false
			var limit := int(JsMath.js_min(CoreLayout.MAX_TABLES, tables + 1.0))
			for i in range(limit):
				if _overlaps(box, _table_rect(float(i))):
					return false
		else:
			var reserved := [
				{"x": reg_x, "y": CoreLayout.FLOOR_Y, "w": sw, "h": 24.0},
				{"x": reg_x + 136.0, "y": 104.0, "w": 48.0, "h": CoreLayout.MIN_SCENE_H},
			]
			for r in reserved:
				if _overlaps(box, r):
					return false
			for idx in CoreRegions.active_table_indices(state):
				if _overlaps(box, _table_rect(float(idx))):
					return false
	var placed: Array = state["decor"]["placed"]
	for i in range(placed.size()):
		if float(i) == skip:
			continue
		var p: Dictionary = placed[i]
		var other = furniture_def(p["id"])
		if JsUtil.is_undefined(other):
			continue
		if p.has("spot") and not JsUtil.is_undefined(p["spot"]):
			continue
		if other["surface"] != def["surface"]:
			continue
		if _overlaps(box, footprint(other, float(p["col"]), float(p["row"]))):
			return false
	return true

static func blocks_next_table(state: Dictionary, id: Variant, col: float, row: float, tables: float) -> bool:
	var def = furniture_def(id)
	if JsUtil.is_undefined(def) or def["surface"] != "floor" or tables >= CoreLayout.MAX_TABLES:
		return false
	var area_v = CoreRegions.area_at_x(col * CELL)
	if JsUtil.is_undefined(area_v) or str(area_v) != "main" or not CoreRegions.is_area_open(state, "main"):
		return false
	return _overlaps(footprint(def, col, row), _table_rect(tables))

static func cell_free(state: Dictionary, surface: String, col: float, row: float, tables: float, skip: float = -1.0) -> bool:
	return _fits(state, {"id": "", "category": "decoration", "surface": surface, "w": 1.0, "h": 1.0, "cost": 0.0, "comfort": 0.0}, col, row, tables, skip)

static func stored_count(state: Dictionary, id: String) -> float:
	var stored: Dictionary = state["decor"]["stored"]
	return float(stored[id]) if stored.has(id) and not JsUtil.is_nullish(stored[id]) else 0.0

static func placed_count(state: Dictionary, id: String) -> float:
	var count := 0
	for p in state["decor"]["placed"]:
		if p["id"] == id:
			count += 1
	return float(count)

static func buy_furniture(state: Dictionary, id: Variant) -> bool:
	var def = furniture_def(id)
	if JsUtil.is_undefined(def) or (def.has("reward") and bool(def["reward"])) or float(state["coins"]) < float(def["cost"]):
		return false
	state["coins"] = float(state["coins"]) - float(def["cost"])
	state["decor"]["stored"][id] = stored_count(state, id) + 1.0
	return true

static func place_furniture(state: Dictionary, id: String, col: float, row: float, tables: float) -> bool:
	if stored_count(state, id) < 1.0 or not can_place(state, id, col, row, tables):
		return false
	var stored: Dictionary = state["decor"]["stored"]
	stored[id] = float(stored[id]) - 1.0
	if float(stored[id]) == 0.0:
		stored.erase(id)
	state["decor"]["placed"].append({"id": id, "col": col, "row": row})
	return true

static func move_furniture(state: Dictionary, index: float, col: float, row: float, tables: float) -> bool:
	var placed: Array = state["decor"]["placed"]
	var idx := int(index)
	if not JsMath.is_integer(index) or idx < 0 or idx >= placed.size():
		return false
	var p: Dictionary = placed[idx]
	if (p.has("spot") and not JsUtil.is_undefined(p["spot"])) or not can_place(state, p["id"], col, row, tables, index):
		return false
	p["col"] = col
	p["row"] = row
	return true

static func store_furniture(state: Dictionary, index: float) -> void:
	var placed: Array = state["decor"]["placed"]
	var removed := JsUtil.array_splice(placed, int(index), 1)
	if not removed.is_empty():
		var p: Dictionary = removed[0]
		state["decor"]["stored"][p["id"]] = stored_count(state, p["id"]) + 1.0

static func evict_blocked(state: Dictionary, tables: float) -> float:
	var moved := 0
	var placed: Array = state["decor"]["placed"]
	for i in range(placed.size() - 1, -1, -1):
		var p: Dictionary = placed[i]
		var has_spot := p.has("spot") and not JsUtil.is_undefined(p["spot"])
		var ok := can_stand(state, p["id"], str(p["spot"]), float(i)) if has_spot else can_place(state, p["id"], float(p["col"]), float(p["row"]), tables, float(i))
		if not ok:
			store_furniture(state, float(i))
			moved += 1
	return float(moved)

static func built_spots(state: Dictionary) -> Array:
	var st := CoreBuildingSpots.storeys(float(CoreRegions.active_table_indices(state).size()))
	var built: Dictionary = {}
	for s in st:
		built[s] = true
	var out: Array = []
	for spot in CoreBuildingSpots.BUILDING_SPOTS:
		if built.has(spot["storey"]):
			out.append(spot)
	return out

static func open_spots(state: Dictionary, id: Variant, skip: float = -1.0) -> Array:
	var def = furniture_def(id)
	if JsUtil.is_undefined(def):
		return []
	var taken: Dictionary = {}
	var placed: Array = state["decor"]["placed"]
	for i in range(placed.size()):
		if float(i) == skip:
			continue
		var p: Dictionary = placed[i]
		if p.has("spot") and not JsUtil.is_undefined(p["spot"]):
			taken[str(p["spot"])] = true
	var out: Array = []
	for spot in built_spots(state):
		if spot["surface"] == def["surface"] and not taken.has(spot["id"]):
			out.append(spot)
	return out

static func can_stand(state: Dictionary, id: Variant, spot: String, skip: float = -1.0) -> bool:
	for op in open_spots(state, id, skip):
		if op["id"] == spot:
			return true
	return false

static func stand_furniture(state: Dictionary, id: String, spot: String) -> bool:
	if stored_count(state, id) < 1.0 or not can_stand(state, id, spot):
		return false
	var stored: Dictionary = state["decor"]["stored"]
	stored[id] = float(stored[id]) - 1.0
	if float(stored[id]) == 0.0:
		stored.erase(id)
	state["decor"]["placed"].append({"id": id, "col": -1.0, "row": -1.0, "spot": spot})
	return true

static func move_to_spot(state: Dictionary, index: float, spot: String) -> bool:
	var placed: Array = state["decor"]["placed"]
	var idx := int(index)
	if not JsMath.is_integer(index) or idx < 0 or idx >= placed.size():
		return false
	var p: Dictionary = placed[idx]
	if not can_stand(state, p["id"], spot, index):
		return false
	p["col"] = -1.0
	p["row"] = -1.0
	p["spot"] = spot
	return true

static func _index_of_ref(arr: Array, target: Dictionary) -> int:
	for i in range(arr.size()):
		if is_same(arr[i], target):
			return i
	return -1

static func settle_in_building(state: Dictionary) -> float:
	state["decor"]["building"] = true
	var placed: Array = state["decor"]["placed"]
	var loose: Array = []
	for p in placed:
		if not p.has("spot") or JsUtil.is_undefined(p["spot"]):
			loose.append(p)
	if loose.is_empty():
		return 0.0
	var former := CoreBuildingSpots.FORMER_CELLS
	for p in loose:
		var def = furniture_def(p["id"])
		if JsUtil.is_undefined(def) or def["surface"] != "floor":
			continue
		var dw := float(def["w"])
		var dh := float(def["h"])
		var matched_spot: Variant = JsUtil.UNDEFINED
		for cell in former:
			if float(cell["col"]) - floor(dw / 2.0) == float(p["col"]) and float(cell["row"]) - dh + 1.0 == float(p["row"]):
				matched_spot = cell["spot"]
				break
		if not JsUtil.is_undefined(matched_spot):
			var idx := _index_of_ref(placed, p)
			if idx >= 0:
				move_to_spot(state, float(idx), str(matched_spot))
	var kinds: Dictionary = {}
	for p in placed:
		if p.has("spot") and not JsUtil.is_undefined(p["spot"]):
			kinds[p["id"]] = true
	var waiting: Array = []
	for p in loose:
		if p.has("spot") and not JsUtil.is_undefined(p["spot"]):
			continue
		var again := kinds.has(p["id"])
		kinds[p["id"]] = true
		var def = furniture_def(p["id"])
		var comfort_val := float(def["comfort"]) if not JsUtil.is_undefined(def) else 0.0
		waiting.append({"p": p, "rank": -1.0 if again else comfort_val})
	JsUtil.stable_sort(waiting, func(a, b): return float(b["rank"]) - float(a["rank"]))
	var moved := 0
	for entry in waiting:
		var p: Dictionary = entry["p"]
		var opens := open_spots(state, p["id"])
		if not opens.is_empty():
			var idx := _index_of_ref(placed, p)
			if idx >= 0 and move_to_spot(state, float(idx), opens[0]["id"]):
				continue
		var idx2 := _index_of_ref(placed, p)
		store_furniture(state, float(idx2))
		moved += 1
	return float(moved)

static func furniture_comfort(state: Dictionary) -> float:
	var kinds: Dictionary = {}
	for p in state["decor"]["placed"]:
		kinds[p["id"]] = true
	var total := 0.0
	for id in kinds.keys():
		var def = furniture_def(id)
		if not JsUtil.is_undefined(def):
			total += float(def["comfort"])
	return total
