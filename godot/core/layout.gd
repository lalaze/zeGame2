class_name CoreLayout
extends RefCounted

# Port of src/game/layout.ts (with static var reset for test isolation).

static var _scene_h: float = 240.0
static var _kitchen_stage: int = 0
const _KITCHEN_HEIGHTS: Array[float] = [184.0, 216.0, 240.0]
const _ROW_Y_MIN: Array[float] = [112.0, 146.0, 180.0]
const _TABLE_SPOTS: Array = [
	{"x": 100.0, "y": 174.0}, {"x": 220.0, "y": 174.0},
	{"x": 40.0, "y": 174.0}, {"x": 280.0, "y": 174.0},
	{"x": 100.0, "y": 218.0}, {"x": 220.0, "y": 218.0},
	{"x": 40.0, "y": 218.0}, {"x": 280.0, "y": 218.0},
]
static var _FLOOR_SHARES_READY: bool = false
static var _FLOOR_SHARES: Array = []

static func _floor_shares() -> Array:
	if not _FLOOR_SHARES_READY:
		_FLOOR_SHARES_READY = true
		_FLOOR_SHARES = [
			[FLOOR_Y, 0.0],
			[128.0, 0.05],
			[150.0, 0.15],
			[174.0, 0.35],
			[218.0, 0.85],
			[MIN_SCENE_H - 7.0, 1.0],
		]
	return _FLOOR_SHARES

static func reset_layout_state() -> void:
	_scene_h = MIN_SCENE_H
	_kitchen_stage = 0

static var SCENE_W: float = RulesData.section("layout")["SCENE_W"]
static var MIN_SCENE_H: float = RulesData.section("layout")["MIN_SCENE_H"]
static var MAX_SCENE_H: float = RulesData.section("layout")["MAX_SCENE_H"]
static var FLOOR_Y: float = RulesData.section("layout")["FLOOR_Y"]
static var COUNTER: Dictionary = RulesData.section("layout")["COUNTER"]
static var COUNTER_RETURN: Dictionary = RulesData.section("layout")["COUNTER_RETURN"]
static var COUNTER_GATE: Dictionary = RulesData.section("layout")["COUNTER_GATE"]
static var PASTRY_CASE: Dictionary = RulesData.section("layout")["PASTRY_CASE"]
static var BACK_BAR: Dictionary = RulesData.section("layout")["BACK_BAR"]
static var BAR_AISLE: Dictionary = RulesData.section("layout")["BAR_AISLE"]
static var MAIN_CUPBOARDS: Array = RulesData.section("layout")["MAIN_CUPBOARDS"]
static var DOOR_W: float = RulesData.section("layout")["DOOR_W"]
static var DOOR_X: float = RulesData.section("layout")["DOOR_X"]
static var PASS: Dictionary = RulesData.section("layout")["PASS"]
static var PASS_COLUMNS: float = RulesData.section("layout")["PASS_COLUMNS"]
static var PASS_SLOT_W: float = RulesData.section("layout")["PASS_SLOT_W"]
static var PASS_BELL: Dictionary = RulesData.section("layout")["PASS_BELL"]
static var MAX_SERVERS: float = RulesData.section("layout")["MAX_SERVERS"]
static var MAX_BARISTAS: float = RulesData.section("layout")["MAX_BARISTAS"]
static var MAX_TABLES: float = RulesData.section("layout")["MAX_TABLES"]
static var TOTAL_TABLE_SPOTS: float = RulesData.section("layout")["TOTAL_TABLE_SPOTS"]
static var SEAT_OFFSET: float = RulesData.section("layout")["SEAT_OFFSET"]
static var TABLE_HALF_WIDTH: float = RulesData.section("layout")["TABLE_HALF_WIDTH"]
static var WINDOWS: Array = RulesData.section("layout")["WINDOWS"]
static var CAT_SPOT: Dictionary = RulesData.section("layout")["CAT_SPOT"]
static var CAT_SPOTS: Array = RulesData.section("layout")["CAT_SPOTS"]

static func scene_height() -> float:
	return _scene_h

static func set_scene_height(h: float) -> void:
	var r := JsMath.js_round(h)
	# Note: in JS Math.max(MIN, Math.min(MAX, NaN)) is NaN; GDScript maxf/minf differ on NaN,
	# so match JS NaN propagation explicitly!
	if is_nan(r):
		_scene_h = NAN
	else:
		_scene_h = maxf(MIN_SCENE_H, minf(MAX_SCENE_H, r))

static func kitchen_level() -> float:
	return float(_kitchen_stage)

static func set_kitchen_level(level: float) -> void:
	if is_finite(level):
		var fl: float = floor(level)
		_kitchen_stage = int(maxf(0.0, minf(2.0, fl)))
	else:
		_kitchen_stage = 0

static func kitchen_height() -> float:
	return _KITCHEN_HEIGHTS[_kitchen_stage]

static func kitchen_floor_y(anchor_y: float, level: Variant = JsUtil.UNDEFINED) -> float:
	var lv: float = float(_kitchen_stage) if JsUtil.is_undefined(level) else float(level)
	var cl_lv := NAN if is_nan(lv) else maxf(0.0, minf(2.0, lv))
	var shift := (2.0 - cl_lv) * 8.0
	var ratio := (anchor_y - 134.0) / 34.0
	var cl_ratio := NAN if is_nan(ratio) else maxf(0.0, minf(1.0, ratio))
	return anchor_y - shift * cl_ratio

static func door_spot() -> Dictionary:
	return {"x": SCENE_W / 2.0, "y": _scene_h + 12.0}

static func area_origin(area: String, height: Variant = JsUtil.UNDEFINED) -> Dictionary:
	var h: float = _scene_h if JsUtil.is_undefined(height) else float(height)
	var cell: Dictionary = CoreRegions.AREA_GRID[area]
	return {
		"x": float(cell["col"]) * SCENE_W,
		"y": (float(cell["row"]) - 1.0) * h,
	}

static func area_bounds(area: String, height: Variant = JsUtil.UNDEFINED) -> Dictionary:
	var h: float = _scene_h if JsUtil.is_undefined(height) else float(height)
	var o := area_origin(area, h)
	return {
		"x": o["x"],
		"y": o["y"],
		"w": SCENE_W,
		"h": kitchen_height() if area == "kitchen" else h,
	}

static func area_at_point(x: float, y: float, height: Variant = JsUtil.UNDEFINED) -> Variant:
	var h: float = _scene_h if JsUtil.is_undefined(height) else float(height)
	for area in CoreRegions.AREA_IDS:
		var b := area_bounds(area, h)
		var bx := float(b["x"])
		var by := float(b["y"])
		var bw := float(b["w"])
		var bh := float(b["h"])
		if x >= bx and x < bx + bw and y >= by and y < by + bh:
			return area
	return JsUtil.UNDEFINED

static func passage_spot(direction: String, area: Variant = JsUtil.UNDEFINED) -> Dictionary:
	var a: String = "main" if JsUtil.is_undefined(area) else str(area)
	if direction == "up":
		return {"x": 160.0, "y": 48.0}
	if direction == "down":
		return {"x": 160.0, "y": float(area_bounds(a)["h"]) - 5.0}
	return {"x": 5.0 if direction == "left" else SCENE_W - 5.0, "y": doorway_y(a, direction)}

static func passage_y() -> float:
	return floor_y(138.0)

static func doorway_y(area: String, direction: String, height: Variant = JsUtil.UNDEFINED) -> float:
	var h: float = _scene_h if JsUtil.is_undefined(height) else float(height)
	if (area == "main" and direction == "left") or (area == "kitchen" and direction == "right"):
		return 88.0
	return floor_y(138.0, h)

static func _room_route_search(area: String, target: String, visited: Array) -> Variant:
	for connection in CoreRegions.area_connections(area):
		var to_area: String = connection["to"]
		if visited.has(to_area):
			continue
		var edge := {"from": area, "direction": connection["direction"], "to": to_area}
		if to_area == target:
			return [edge]
		var next_visited := visited.duplicate()
		next_visited.append(to_area)
		var rest = _room_route_search(to_area, target, next_visited)
		if rest != null:
			var combined: Array = [edge]
			combined.append_array(rest)
			return combined
	return null

static func room_route(from: String, to: String) -> Array:
	if from == to:
		return []
	var path = _room_route_search(from, to, [from])
	if path == null:
		return []
	var out: Array = []
	for step in path:
		var a: String = step["from"]
		var b: String = step["to"]
		var direction: String = step["direction"]
		var source := area_origin(a)
		var dest := area_origin(b)
		var y := doorway_y(a, direction)
		if direction == "left" or direction == "right":
			var boundary: float = (float(source["x"]) + SCENE_W) if direction == "right" else float(source["x"])
			var sign_dir: float = 1.0 if direction == "right" else -1.0
			var service := a == "kitchen" or b == "kitchen"
			out.append({"x": float(source["x"]) + (202.0 if (service and a == "main") else 160.0), "y": float(source["y"]) + y})
			out.append({"x": boundary - sign_dir * 12.0, "y": float(source["y"]) + y})
			out.append({"x": boundary + sign_dir * 12.0, "y": float(source["y"]) + y})
			out.append({"x": float(dest["x"]) + (202.0 if (service and b == "main") else 160.0), "y": float(dest["y"]) + y})
		else:
			var boundary: float = float(source["y"]) if direction == "up" else (float(source["y"]) + _scene_h)
			var north := dest if direction == "up" else source
			var south := source if direction == "up" else dest
			var pts := [
				{"x": float(south["x"]) + 160.0, "y": float(south["y"]) + y},
				{"x": float(south["x"]) + 160.0, "y": float(south["y"]) + FLOOR_Y + 8.0},
				{"x": float(south["x"]) + 160.0, "y": float(south["y"]) + 12.0},
				{"x": float(north["x"]) + 160.0, "y": boundary - 12.0},
				{"x": float(north["x"]) + 160.0, "y": float(north["y"]) + y},
			]
			if direction != "up":
				pts.reverse()
			out.append_array(pts)
	return out

static func pass_slot(i: float) -> Dictionary:
	var p := PASS
	var cols := PASS_COLUMNS
	return {
		"x": float(p["x"]) + 2.0 + fmod(i, cols) * PASS_SLOT_W,
		"y": float(COUNTER["top"]) if i < cols else float(p["top"]) + 21.0,
	}

static func pass_spot() -> Dictionary:
	var p := PASS
	return {"x": float(p["x"]) + float(p["w"]) / 2.0 + 6.0, "y": float(COUNTER["bottom"]) + 8.0}

static func server_home(i: float) -> Dictionary:
	var fl: float = floor(i / 3.0)
	return {
		"x": 264.0 + fmod(i, 3.0) * 17.0 + (8.0 if i >= 3.0 else 0.0),
		"y": 119.0 + fl * 14.0,
	}

static func barista_spot(i: float) -> Dictionary:
	return {"x": 116.0 + i * 25.0, "y": 100.0}

static func barista_work_spot(i: float) -> Dictionary:
	return {"x": float(barista_spot(i)["x"]), "y": 87.0}

static func service_spot(i: float) -> Dictionary:
	return {"x": 116.0 + i * 25.0, "y": 145.0}

static func queue_spot(i: float) -> Dictionary:
	return {
		"x": 144.0 if i < 2.0 or i == 4.0 else 176.0,
		"y": floor_y(210.0 if i >= 4.0 else 158.0 + (28.0 if i == 1.0 or i == 2.0 else 0.0)),
	}

static func resize_room_point(point: Dictionary, from_height: float) -> Dictionary:
	var found = area_at_point(float(point["x"]), float(point["y"]), from_height)
	var area: String = "main" if JsUtil.is_undefined(found) else str(found)
	if area == "kitchen":
		return point.duplicate(false)
	var old_origin := area_origin(area, from_height)
	var new_origin := area_origin(area)
	var local_y := float(point["y"]) - float(old_origin["y"])
	var local_x := float(point["x"]) - float(old_origin["x"])
	var conns := CoreRegions.area_connections(area)
	var tol := 0.001
	for direction in ["left", "right"]:
		var near_edge := (local_x <= 12.0) if direction == "left" else (local_x >= SCENE_W - 12.0)
		if near_edge:
			var has_link := false
			for link in conns:
				if link["direction"] == direction:
					has_link = true
					break
			if has_link and absf(local_y - doorway_y(area, direction, from_height)) < tol:
				return {"x": float(point["x"]), "y": float(new_origin["y"]) + doorway_y(area, direction)}
	var y := local_y
	if local_y >= from_height - 7.0:
		y += _scene_h - from_height
	elif local_y > FLOOR_Y:
		var shares := _floor_shares()
		for i in range(1, shares.size()):
			var lo: float = shares[i - 1][0]
			var lo_share: float = shares[i - 1][1]
			var hi: float = shares[i][0]
			var hi_share: float = shares[i][1]
			var old_lo := lo + JsMath.js_round((from_height - MIN_SCENE_H) * lo_share)
			var old_hi := hi + JsMath.js_round((from_height - MIN_SCENE_H) * hi_share)
			if local_y > old_hi:
				continue
			var new_lo := lo + JsMath.js_round((_scene_h - MIN_SCENE_H) * lo_share)
			var new_hi := hi + JsMath.js_round((_scene_h - MIN_SCENE_H) * hi_share)
			y = new_lo + (local_y - old_lo) / (old_hi - old_lo) * (new_hi - new_lo)
			break
	return {"x": float(point["x"]), "y": float(new_origin["y"]) + y}

static func _floor_share(y_min: float) -> float:
	var shares := _floor_shares()
	if y_min <= float(shares[0][0]):
		return 0.0
	for i in range(1, shares.size()):
		var y1: float = shares[i][0]
		var s1: float = shares[i][1]
		if y_min <= y1:
			var y0: float = shares[i - 1][0]
			var s0: float = shares[i - 1][1]
			return s0 + ((y_min - y0) / (y1 - y0)) * (s1 - s0)
	return 1.0

static func floor_y(y_min: float, height: Variant = JsUtil.UNDEFINED) -> float:
	var h: float = _scene_h if JsUtil.is_undefined(height) else float(height)
	return y_min + JsMath.js_round((h - MIN_SCENE_H) * _floor_share(y_min))

static func floor_y_min(y: float) -> float:
	var best := FLOOR_Y
	var start := int(FLOOR_Y)
	var stop := int(MIN_SCENE_H)
	for y_min in range(start, stop + 1):
		if floor_y(float(y_min)) <= y:
			best = float(y_min)
	return best

static func table_row_y(row: float) -> float:
	return floor_y(_ROW_Y_MIN[int(row)])

static func table_pos(i: float) -> Dictionary:
	return table_pos_at_height(i, _scene_h)

static func table_pos_at_height(i: float, height: float) -> Dictionary:
	var spot := table_spot_min(i)
	var area := table_area(i)
	var o := area_origin(area, height)
	return {
		"x": float(o["x"]) + float(spot["x"]) - CoreRegions.region_offset(area),
		"y": float(o["y"]) + floor_y(float(spot["y"]), height),
	}

static func table_area(i: float) -> String:
	var max_t := MAX_TABLES
	if i < max_t:
		return "main"
	var idx := int(floor((i - max_t) / 4.0))
	return CoreRegions.REGIONS[idx]["id"]

static func table_spot_min(i: float) -> Dictionary:
	var max_t := MAX_TABLES
	if i >= max_t:
		var index := i - max_t
		var reg_idx := int(floor(index / 4.0))
		var region: Dictionary = CoreRegions.REGIONS[reg_idx]
		var x_local := 64.0 if fmod(index, 2.0) == 0.0 else 256.0
		var y_local := _ROW_Y_MIN[0 if fmod(index, 4.0) < 2.0 else 2]
		return {"x": CoreRegions.region_offset(region["id"]) + x_local, "y": y_local}
	var spot: Dictionary = _TABLE_SPOTS[int(i)]
	return spot.duplicate(false)

static func table_footprint(table: float) -> Dictionary:
	var p := table_pos(table)
	var hw := TABLE_HALF_WIDTH
	return {"x": float(p["x"]) - hw, "y": float(p["y"]) - 10.0, "w": hw * 2.0, "h": 13.0}

static func seat_spot(table: float, side: float) -> Dictionary:
	var p := table_pos(table)
	return {
		"x": float(p["x"]) + (-SEAT_OFFSET if side == 0.0 else SEAT_OFFSET),
		"y": float(p["y"]) + 1.0,
	}

static func seat_approach(table: float, side: float) -> Dictionary:
	var s := seat_spot(table, side)
	var p := table_pos(table)
	var area := table_area(table)
	var rear_aisle := area == "main" and float(table_spot_min(table)["y"]) == 218.0
	var y_val: float
	if rear_aisle:
		y_val = float(p["y"]) - 20.0
	else:
		y_val = minf(float(s["y"]) + 12.0, float(area_origin(area)["y"]) + _scene_h - 9.0)
	return {"x": float(s["x"]), "y": y_val}

static func door_plant_spots() -> Array:
	return [
		{"x": DOOR_X - 16.0, "y": _scene_h - 9.0},
		{"x": DOOR_X + DOOR_W + 16.0, "y": _scene_h - 9.0},
	]
