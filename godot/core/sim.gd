class_name CoreSim
extends RefCounted

## Port of src/game/sim.ts: everyone in the café, one fixed step at a time.
## People are Dictionaries with the keys a saved service uses. `pass` is a keyword here, so the pass is `pass_plates`.

static var WALK_SPEED: float = CoreData.CUSTOMER_WALK_SPEED
static var SERVER_SPEED: float = CoreData.CUSTOMER_WALK_SPEED * 1.5
## A deliberate queue intervention buys one guest a little breathing room.
static var QUEUE_HELP_PATIENCE: float = RulesData.section("sim")["QUEUE_HELP_PATIENCE"]
const _TRAY_PLATES := 3.0
const _BOOST_SECONDS := 0.3
const _ORDER_SECONDS := 0.8
const _CALL_SECONDS := 1.4
const _WALK_CLEARANCE := 8.0

var customers: Array = []
var baristas: Array = []
## Customer ids waiting in line, front first.
var queue: Array = []
## Customer id occupying each seat (2 per table), or null.
var seats: Array = []
var servers: Array = []
## Table orders on the pass, oldest first.
var pass_plates: Array = []
var cooks: Array = []
## The last few batches out of the oven, newest first.
var rack: Array = []
var _spawn_timer := 1.5
var _next_id := 1.0
var _customer_cast: CoreCustomerCast.CustomerCastCycle
var _cast_random_state := 1
var _floor_state: Variant = null
var _navigation_signature := ""
var _kitchen_stage := -1.0
var _navigation_tables: Array = []
var _navigation_obstacles: Dictionary = {}
## Both seats of every open table, in table order.
var _seat_x := PackedFloat64Array()
var _seat_y := PackedFloat64Array()
var _seat_table_y := PackedFloat64Array()
var _boost_cooldown := 0.0
var _rng: Callable


func _init(rng: Callable) -> void:
	_rng = rng
	_customer_cast = CoreCustomerCast.CustomerCastCycle.new(_cast_random)


func _cast_random() -> float:
	_cast_random_state = JsMath.ushr_i(JsMath.imul_i(_cast_random_state, 1664525) + 1013904223, 0)
	return float(_cast_random_state) / 4294967296.0


## A new café starts with no staff jobs, customer visits, or cached routes.
func reset() -> void:
	customers = []
	baristas = []
	queue = []
	seats = []
	servers = []
	pass_plates = []
	cooks = []
	rack = []
	_spawn_timer = 1.5
	_next_id = 1.0
	_boost_cooldown = 0.0
	_cast_random_state = 1
	_customer_cast = CoreCustomerCast.CustomerCastCycle.new(_cast_random)
	_floor_state = null
	_navigation_signature = ""
	_kitchen_stage = -1.0
	_navigation_tables = []
	_navigation_obstacles = {}
	_seat_x.clear()
	_seat_y.clear()
	_seat_table_y.clear()
	CoreLayout.set_kitchen_level(0.0)


func snapshot(state: Dictionary) -> Dictionary:
	# Capture routes and cook positions against the same layout as the economic save.
	_sync(state)
	return {
		"version": 2.0, "kitchenLevel": _kitchen_stage, "day": state["day"], "phase": state["phase"], "served": state["today"]["served"], "height": CoreLayout.scene_height(),
		"customers": customers.duplicate(true), "baristas": baristas.duplicate(true), "servers": servers.duplicate(true), "cooks": cooks.duplicate(true),
		"queue": queue.duplicate(false), "seats": seats.duplicate(false), "pass": pass_plates.duplicate(true), "rack": rack.duplicate(false),
		"spawnTimer": _spawn_timer, "nextId": _next_id, "boostCooldown": _boost_cooldown,
		"customerCast": _customer_cast.snapshot(), "castRandomState": float(_cast_random_state),
	}


static func _place(w: Dictionary, point: Dictionary) -> void:
	w["tx"] = point["x"]
	w["x"] = point["x"]
	w["ty"] = point["y"]
	w["y"] = point["y"]
	w["via"] = []
	w["journey"] = []
	w["pathBlocked"] = false


static func _side(seat: float) -> float:
	return fmod(seat, 2.0)


static func _table(seat: float) -> float:
	return floor(seat / 2.0)


func restore(raw: Variant, state: Dictionary) -> bool:
	if not CoreSimSnapshot.valid_snapshot(raw, state):
		return false
	var saved: Dictionary = raw.duplicate(true)
	saved["kitchenLevel"] = state["upgrades"]["cook"] if state["kitchen"] else 0.0
	CoreLayout.set_kitchen_level(saved["kitchenLevel"])
	var first_version: bool = saved["version"] == 1.0
	if first_version:
		# v1 used a different counter, kitchen footprint and unchecked straight paths. Migrate visits and paid work
		# at safe semantic anchors rather than replaying obsolete coordinates.
		for c: Dictionary in saved["customers"]:
			var point: Dictionary
			if seated(c) and c["seat"] >= 0.0:
				point = CoreLayout.seat_spot(_table(c["seat"]), _side(c["seat"]))
			elif c["phase"] == "queue":
				point = CoreLayout.queue_spot(saved["queue"].find(c["id"]))
			elif c["phase"] == "exiting":
				point = CoreLayout.door_spot()
			elif c["phase"] == "toCounter":
				point = CoreLayout.queue_spot(0.0)
			else:
				point = CoreLayout.service_spot(JsMath.js_max(0.0, c["spot"]))
			_place(c, point)
		for i in saved["servers"].size():
			_place(saved["servers"][i], CoreLayout.pass_spot() if saved["servers"][i]["phase"] == "delivering" else CoreLayout.server_home(i))
		for i in saved["cooks"].size():
			var batch: Variant = saved["cooks"][i]["batch"]
			_place(saved["cooks"][i], CoreKitchen.station_spot(batch["steps"][int(batch["step"])]) if batch is Dictionary else CoreKitchen.cook_home(i))
		saved["height"] = CoreLayout.scene_height()
	# A layout-incompatible runtime is discarded atomically; economic progress remains valid.
	var geometry := CoreSim.new(_rng)
	geometry._refresh_navigation(state, false)
	var walkers: Array = saved["customers"].duplicate(false)
	walkers.append_array(saved["servers"])
	for w: Dictionary in walkers:
		if not _guest_position_clear(w, saved["height"], state, geometry):
			return false
	for w: Dictionary in saved["cooks"]:
		if w["x"] >= -12.0 and w["x"] <= 202.0 and absf(w["y"] - CoreLayout.doorway_y("main", "left")) < 0.001:
			continue
		var area: Variant = CoreLayout.area_at_point(w["x"], w["y"])
		if not area is String or area != "kitchen":
			return false
		for r: Dictionary in CoreKitchen.kitchen_obstacles():
			if CoreNavigation.segment_crosses_obstacle(w, w, r):
				return false
	var cook_routes := []
	for i in saved["cooks"].size():
		var cook: Dictionary = saved["cooks"][i]
		var batch: Variant = cook["batch"]
		var route: Variant = CoreKitchen.kitchen_path(cook, CoreKitchen.station_spot(batch["steps"][int(batch["step"])]) if batch is Dictionary else CoreKitchen.cook_home(i))
		if route == null:
			return false
		cook_routes.append(route)
	customers = []
	for c: Dictionary in saved["customers"]:
		c["reviewed"] = c["reviewed"] if c.get("reviewed") is bool else (c["hasCup"] or c["soldOut"] or c["phase"] == "sitting" or c["phase"] == "exiting")
		c["waitSeconds"] = c["waitSeconds"] if JsUtil.is_number(c.get("waitSeconds")) else 0.0
		c["missingExtra"] = c["missingExtra"] if c.get("missingExtra") is bool else false
		customers.append(c)
	baristas = saved["baristas"]
	servers = saved["servers"]
	cooks = saved["cooks"]
	queue = saved["queue"]
	seats = saved["seats"]
	pass_plates = saved["pass"]
	rack = saved["rack"]
	_spawn_timer = saved["spawnTimer"]
	_next_id = saved["nextId"]
	_boost_cooldown = saved["boostCooldown"]
	_cast_random_state = 1 if first_version else int(saved["castRandomState"])
	if first_version:
		var known := []
		for c: Dictionary in saved["customers"]:
			if JsUtil.is_number(c.get("appearanceId")):
				known.append(c["appearanceId"])
		var remaining := []
		if not known.is_empty():
			for cast: Dictionary in CoreCustomerCast.CUSTOMER_CAST:
				if not known.has(cast["id"]):
					remaining.append(cast["id"])
		_customer_cast.restore({"remaining": remaining, "previous": known.back() if not known.is_empty() else -1.0})
	else:
		_customer_cast.restore(saved["customerCast"])
	# JSON duplicates tray objects that also live on the pass. Restore shared identity.
	for server: Dictionary in servers:
		var shared := []
		for p: Dictionary in server["plates"]:
			var found := p
			for plate: Dictionary in pass_plates:
				if plate["customerId"] == p["customerId"]:
					found = plate
					break
			shared.append(found)
		server["plates"] = shared
	_kitchen_stage = saved["kitchenLevel"]
	_navigation_signature = ""
	_refresh_navigation(state, false)
	# Rebuild semantic destinations against the current viewport and furniture.
	resize_scene(saved["height"])
	for i in cooks.size():
		_walk(cooks[i], cook_routes[i])
	state["inProduction"] = {}
	for cook: Dictionary in cooks:
		if cook["batch"] is Dictionary:
			var item: String = cook["batch"]["item"]
			state["inProduction"][item] = state["inProduction"].get(item, 0.0) + cook["batch"]["n"]
	return true


static func _guest_position_clear(w: Dictionary, height: float, state: Dictionary, geometry: CoreSim) -> bool:
	var p := CoreLayout.resize_room_point(w, height)
	var h := CoreLayout.scene_height()
	if absf(p["x"] - 160.0) < 0.001 and p["y"] >= h - 8.0 and p["y"] <= h + 12.0:
		return true
	var area: Variant = CoreLayout.area_at_point(p["x"], p["y"])
	if not area is String or area == "kitchen" or area != "main" and not state["regions"].has(area):
		return false
	if geometry._chair_approach(p, false) is Dictionary:
		return true
	for r: Dictionary in geometry._navigation_obstacles.get(area, []):
		if CoreNavigation.segment_crosses_obstacle(p, p, r):
			return false
	return true


func begin_closing(state: Dictionary) -> void:
	if state["phase"] != "open":
		return
	state["phase"] = "closing"
	for c: Dictionary in customers:
		if c["phase"] == "queue":
			if c.get("guestKind") is String:
				state["today"]["guests"][c["guestKind"]]["dismissed"] += 1.0
			_exit(c)
	queue = []


## Keep the same ledger, clock and accepted orders after a sold-out restock.
func resume_after_restock(state: Dictionary) -> bool:
	if state["phase"] != "closing" or state["dayTime"] >= CoreData.DAY_SECONDS or not CoreEconomy.has_service_supply(state):
		return false
	state["phase"] = "open"
	return true


func finished_service() -> bool:
	for c: Dictionary in customers:
		if c["phase"] != "sitting" and c["phase"] != "exiting":
			return false
	for c: Dictionary in cooks:
		if c["batch"] is Dictionary:
			return false
	return true


func _resize_walker(w: Dictionary, from_height: float) -> void:
	var position := CoreLayout.resize_room_point(w, from_height)
	# Floor stretching must not squeeze an ordinary aisle into a chair's fixed-depth footprint.
	for table: float in _navigation_tables:
		var area: Variant = CoreLayout.area_at_point(w["x"], w["y"], from_height)
		if not area is String or CoreLayout.table_area(table) != area:
			continue
		var before := CoreLayout.table_pos_at_height(table, from_height)
		var after := CoreLayout.table_pos(table)
		if absf(w["x"] - before["x"]) >= CoreLayout.TABLE_HALF_WIDTH + _WALK_CLEARANCE:
			continue
		if w["y"] <= before["y"] - 10.0 - _WALK_CLEARANCE:
			position["y"] = JsMath.js_min(position["y"], after["y"] - 10.0 - _WALK_CLEARANCE)
		elif w["y"] >= before["y"] + 3.0 + _WALK_CLEARANCE:
			position["y"] = JsMath.js_max(position["y"], after["y"] + 3.0 + _WALK_CLEARANCE)
	var target := CoreLayout.resize_room_point({"x": w["tx"], "y": w["ty"]}, from_height)
	w["x"] = position["x"]
	w["y"] = position["y"]
	w["tx"] = target["x"]
	w["ty"] = target["y"]
	var moved := func(point: Dictionary) -> Dictionary: return CoreLayout.resize_room_point(point, from_height)
	w["via"] = w["via"].map(moved)
	w["journey"] = w["journey"].map(moved) if w.get("journey") is Array else JsUtil.UNDEFINED


func resize_scene(from_height: float) -> void:
	for w: Dictionary in servers:
		_resize_walker(w, from_height)
	# Kitchen geometry and its delivery lane are independent of viewport height.
	for c: Dictionary in customers:
		_resize_walker(c, from_height)
		if c["seat"] < 0.0:
			continue
		var seat := CoreLayout.seat_spot(_table(c["seat"]), _side(c["seat"]))
		if seated(c):
			c["tx"] = seat["x"]
			c["x"] = seat["x"]
			c["ty"] = seat["y"]
			c["y"] = seat["y"]
		elif c["phase"] == "toSeat":
			if not c["via"].is_empty():
				c["via"][-1] = seat
			else:
				c["tx"] = seat["x"]
				c["ty"] = seat["y"]
			if c.get("journey") is Array and not c["journey"].is_empty():
				c["journey"][-1] = seat
	if not _floor_state is Dictionary:
		return
	_refresh_navigation(_floor_state)
	# Restore semantic destinations: service positions stay attached to the counter.
	for c: Dictionary in customers:
		var area := _area_of(c)
		match c["phase"]:
			"queue":
				_walk(c, [CoreLayout.queue_spot(queue.find(c["id"]))])
			"toCounter":
				_walk(c, [CoreLayout.service_spot(c["spot"])])
			"ordering":
				_place_standing(c, CoreLayout.service_spot(c["spot"]))
			"toSeat":
				var stops := _to_table(c["seat"], area)
				stops.append(CoreLayout.seat_spot(_table(c["seat"]), _side(c["seat"])))
				_walk(c, stops)
			"exiting":
				var stops := CoreLayout.room_route(area, "main")
				stops.append(CoreLayout.door_spot())
				_walk(c, stops)
	for i in servers.size():
		var server: Dictionary = servers[i]
		if server["phase"] == "idle":
			var home := CoreLayout.server_home(i)
			server["tx"] = home["x"]
			server["x"] = home["x"]
			server["ty"] = home["y"]
			server["y"] = home["y"]
		elif server["phase"] == "toPass":
			_walk(server, [CoreLayout.pass_spot()])
		else:
			_head_out(server)


static func _place_standing(w: Dictionary, p: Dictionary) -> void:
	w["tx"] = p["x"]
	w["x"] = p["x"]
	w["ty"] = p["y"]
	w["y"] = p["y"]
	w["via"] = []
	w["journey"] = []


static func _area_of(w: Dictionary) -> String:
	var area: Variant = CoreLayout.area_at_point(w["x"], w["y"])
	return area if area is String else "main"


func _rand_int(n: float) -> float:
	return floor(_rng.call() * n)


func _random_look() -> Dictionary:
	return {"skin": _rand_int(4.0), "hair": _rand_int(6.0), "hairStyle": _rand_int(4.0), "shirt": _rand_int(8.0), "pants": _rand_int(3.0)}


func _sync(state: Dictionary) -> void:
	CorePartners.sync_partners(state)
	var stage: float = state["upgrades"]["cook"] if state["kitchen"] else 0.0
	CoreLayout.set_kitchen_level(stage)
	if _kitchen_stage >= 0.0 and _kitchen_stage != stage:
		# Keep cooks attached to their part of the floor as an expansion shifts storage and washing forward.
		var previous := _kitchen_stage
		for i in cooks.size():
			var cook: Dictionary = cooks[i]
			if cook["x"] < 0.0 and cook["y"] > 134.0:
				var old_end := CoreLayout.kitchen_floor_y(168.0, previous)
				var anchor: float = cook["y"] + 168.0 - old_end if cook["y"] >= old_end else 134.0 + (cook["y"] - 134.0) * 34.0 / (old_end - 134.0)
				cook["y"] = CoreLayout.kitchen_floor_y(anchor)
			var batch: Variant = cook["batch"]
			_cook_to(cook, CoreKitchen.station_spot(batch["steps"][int(batch["step"])]) if batch is Dictionary else CoreKitchen.cook_home(i))
	_kitchen_stage = stage
	_refresh_navigation(state)
	# Staff looks drop a clashing hair colour without an extra draw, so the RNG sequence is unchanged.
	while baristas.size() < CoreEconomy.barista_count(state):
		baristas.append({"look": CoreState.without_hair_clash(_random_look()), "customerId": null, "remaining": 0.0, "total": 0.0, "calling": 0.0})
	while servers.size() < CoreEconomy.server_count(state):
		var home := CoreLayout.server_home(servers.size())
		servers.append({"x": home["x"], "y": home["y"], "tx": home["x"], "ty": home["y"], "stride": 0.0, "via": [], "look": CoreState.without_hair_clash(_random_look()), "phase": "idle", "plates": [], "ack": 0.0})
	while cooks.size() < CoreEconomy.cook_count(state):
		var home := CoreKitchen.cook_home(cooks.size())
		cooks.append({"x": home["x"], "y": home["y"], "tx": home["x"], "ty": home["y"], "stride": 0.0, "via": [], "look": CoreState.without_hair_clash(_random_look()), "batch": null})
	for i in baristas.size():
		if i == 0:
			baristas[0]["partnerId"] = JsUtil.UNDEFINED
		else:
			_dress(baristas[i], CorePartners.active_partner(state, "barista", i - 1))
	for i in cooks.size():
		_dress(cooks[i], CorePartners.active_partner(state, "cook", i))
	for i in servers.size():
		_dress(servers[i], CorePartners.active_partner(state, "server", i))
	while seats.size() < CoreLayout.TOTAL_TABLE_SPOTS * 2.0:
		seats.append(null)


static func _dress(worker: Dictionary, partner: Variant) -> void:
	if partner is Dictionary:
		worker["partnerId"] = partner["id"]
		worker["look"] = partner["look"].duplicate(false)


## Cache static floor geometry; ordering and walking do not rebuild it.
func _refresh_navigation(state: Dictionary, replan: bool = true) -> void:
	_floor_state = state
	var tables := CoreRegions.active_table_indices(state)
	var parts := PackedStringArray([str(CoreLayout.scene_height()), str(tables)])
	for p: Dictionary in state["decor"]["placed"]:
		parts.append("%s,%s,%s" % [p["id"], p["col"], p["row"]])
	var signature := ";".join(parts)
	if signature == _navigation_signature:
		return
	_navigation_signature = signature
	_navigation_tables = tables
	_navigation_obstacles = {}
	_seat_x.clear()
	_seat_y.clear()
	_seat_table_y.clear()
	for table: float in tables:
		for side: float in [0.0, 1.0]:
			var seat := CoreLayout.seat_spot(table, side)
			_seat_x.append(seat["x"])
			_seat_y.append(seat["y"])
			_seat_table_y.append(CoreLayout.table_pos(table)["y"])
	for area: String in CoreRegions.AREA_IDS:
		var origin := CoreLayout.area_origin(area)
		var boxes := []
		_navigation_obstacles[area] = boxes
		if area == "main":
			boxes.append({"x": CoreLayout.COUNTER["x"], "y": CoreLayout.FLOOR_Y, "w": CoreLayout.COUNTER["w"] + CoreLayout.COUNTER_GATE["w"], "h": CoreLayout.COUNTER["bottom"] - CoreLayout.FLOOR_Y})
			for r: Dictionary in CoreLayout.MAIN_CUPBOARDS:
				boxes.append(r.duplicate(false))
			for p: Dictionary in CoreLayout.door_plant_spots():
				boxes.append({"x": p["x"] - 5.0, "y": p["y"] - 4.0, "w": 10.0, "h": 6.0})
		elif CoreRegions.adjacent_area(area, "up") is String:
			# The north passage is the only walkable part of the back wall.
			boxes.append({"x": origin["x"], "y": origin["y"], "w": 142.0, "h": CoreLayout.FLOOR_Y})
			boxes.append({"x": origin["x"] + 178.0, "y": origin["y"], "w": 142.0, "h": CoreLayout.FLOOR_Y})
	for i: float in tables:
		_navigation_obstacles[CoreLayout.table_area(i)].append(CoreLayout.table_footprint(i))
	for p: Dictionary in state["decor"]["placed"]:
		var def: Variant = CoreFurniture.furniture_def(p["id"])
		var area: Variant = CoreRegions.area_at_x(p["col"] * CoreFurniture.CELL)
		if not def is Dictionary or def["surface"] != "floor" or not area is String:
			continue
		var origin := CoreLayout.area_origin(area)
		var y := CoreLayout.floor_y(CoreLayout.FLOOR_Y + p["row"] * CoreFurniture.CELL)
		_navigation_obstacles[area].append({
			"x": origin["x"] + p["col"] * CoreFurniture.CELL - CoreRegions.region_offset(area), "y": origin["y"] + y,
			"w": def["w"] * CoreFurniture.CELL, "h": CoreLayout.floor_y(CoreLayout.FLOOR_Y + (p["row"] + def["h"]) * CoreFurniture.CELL) - y,
		})
	if not replan:
		return
	for c: Dictionary in customers:
		if not seated(c) and c.get("journey") is Array and not c["journey"].is_empty():
			_walk(c, c["journey"])
	for s: Dictionary in servers:
		if s.get("journey") is Array and not s["journey"].is_empty():
			_walk(s, s["journey"])


## Keep Arrange from placing solid furniture on a customer's or staff member's feet.
func furniture_space_clear(id: String, col: float, row: float) -> bool:
	var def: Variant = CoreFurniture.furniture_def(id)
	if not def is Dictionary:
		return false
	if def["surface"] == "wall":
		return true
	var area: Variant = CoreRegions.area_at_x(col * CoreFurniture.CELL)
	if not area is String or not is_finite(col) or not is_finite(row):
		return false
	var origin := CoreLayout.area_origin(area)
	var left: float = origin["x"] + col * CoreFurniture.CELL - CoreRegions.region_offset(area) - _WALK_CLEARANCE
	var right: float = left + def["w"] * CoreFurniture.CELL + _WALK_CLEARANCE * 2.0
	var top: float = origin["y"] + CoreLayout.floor_y(CoreLayout.FLOOR_Y + row * CoreFurniture.CELL) - _WALK_CLEARANCE
	var bottom: float = origin["y"] + CoreLayout.floor_y(CoreLayout.FLOOR_Y + (row + def["h"]) * CoreFurniture.CELL) + _WALK_CLEARANCE
	for group: Array in [customers, servers, cooks]:
		for w: Dictionary in group:
			if not (w["x"] < left or w["x"] > right or w["y"] < top or w["y"] > bottom):
				return false
	return true


## The only exemptions for table footprints are the short steps out of chairs.
func _chair_approach(point: Dictionary, exact: bool) -> Variant:
	var x: float = point["x"]
	var y: float = point["y"]
	for i in _seat_x.size():
		var dx := absf(x - _seat_x[i])
		if dx >= 2.0:
			continue
		if exact:
			if dx < 0.001 and absf(y - _seat_y[i]) < 0.001:
				return CoreLayout.seat_approach(_navigation_tables[i >> 1], i & 1)
		elif y >= _seat_table_y[i] - 20.0 and y <= _seat_table_y[i] + 13.0:
			# Preserve an in-progress chair step, leaving through the apron on the side the guest already occupies.
			return {"x": _seat_x[i], "y": _seat_table_y[i] - 20.0} if y < _seat_y[i] else CoreLayout.seat_approach(_navigation_tables[i >> 1], i & 1)
	return null


static func _on_street(p: Dictionary, h: float) -> bool:
	return absf(p["x"] - 160.0) < 0.001 and p["y"] > h - 8.0 + 0.001


## Route one already-selected room/door segment without inventing wall shortcuts. Null when there is none.
func _floor_route(from: Dictionary, to: Dictionary) -> Variant:
	var h := CoreLayout.scene_height()
	var threshold := {"x": 160.0, "y": h - 8.0}
	if _on_street(from, h):
		if _on_street(to, h):
			return [to]
		var rest: Variant = _floor_route(threshold, to)
		if rest != null:
			rest.push_front(threshold)
		return rest
	if _on_street(to, h):
		var rest: Variant = _floor_route(from, threshold)
		if rest != null:
			rest.append(to)
		return rest
	var a: Variant = CoreLayout.area_at_point(from["x"], from["y"])
	var b: Variant = CoreLayout.area_at_point(to["x"], to["y"])
	# Guest/server routes never use the staff-only production room.
	if not a is String or not b is String or a == "kitchen" or b == "kitchen":
		return null
	var origin := CoreLayout.area_origin(a)
	if a != b:
		for edge: Dictionary in CoreRegions.area_connections(a):
			if edge["to"] != b:
				continue
			var direction: String = edge["direction"]
			if direction == "left" or direction == "right":
				var boundary: float = origin["x"] + (CoreLayout.SCENE_W if direction == "right" else 0.0)
				return [to] if (absf(from["y"] - origin["y"] - CoreLayout.doorway_y(a, direction)) < 0.001 and absf(to["y"] - from["y"]) < 0.001
					and absf(from["x"] - boundary) <= 12.001 and absf(to["x"] - boundary) <= 12.001) else null
			var edge_y: float = origin["y"] + (h if direction == "down" else 0.0)
			return [to] if (absf(from["x"] - origin["x"] - 160.0) < 0.001 and absf(to["x"] - from["x"]) < 0.001
				and absf(from["y"] - edge_y) <= 12.001 and absf(to["y"] - edge_y) <= 12.001) else null
		return null
	var north := CoreRegions.adjacent_area(a, "up") is String
	var bounds := {"x": origin["x"] + 5.0, "y": origin["y"] + (0.0 if north else CoreLayout.FLOOR_Y), "w": 310.0, "h": h - 8.0 - (0.0 if north else CoreLayout.FLOOR_Y)}
	var start: Variant = _inset(from, a, origin, bounds, h)
	var end: Variant = _inset(to, a, origin, bounds, h)
	if start == null or end == null:
		return null
	var boxes: Array = _navigation_obstacles.get(a, [])
	var start_approach: Variant = _chair_approach(start, false)
	# Resizing may consume some clearance without moving feet into furniture: walk outward to the nearest clear margin.
	if start_approach == null and not _crosses_any(boxes, start, start):
		var padded := []
		for r: Dictionary in boxes:
			padded.append({"x": r["x"] - _WALK_CLEARANCE, "y": r["y"] - _WALK_CLEARANCE, "w": r["w"] + _WALK_CLEARANCE * 2.0, "h": r["h"] + _WALK_CLEARANCE * 2.0})
		if _crosses_any(padded, start, start):
			var candidates := []
			for r: Dictionary in padded:
				for p: Dictionary in [{"x": r["x"], "y": start["y"]}, {"x": r["x"] + r["w"], "y": start["y"]}, {"x": start["x"], "y": r["y"]}, {"x": start["x"], "y": r["y"] + r["h"]}]:
					if (p["x"] >= bounds["x"] and p["x"] <= bounds["x"] + bounds["w"] and p["y"] >= bounds["y"] and p["y"] <= bounds["y"] + bounds["h"]
							and not _crosses_any(padded, p, p) and not _crosses_any(boxes, start, p)):
						candidates.append(p)
			JsUtil.stable_sort(candidates, func(p: Dictionary, q: Dictionary) -> float:
				return JsMath.js_hypot2(p["x"] - start["x"], p["y"] - start["y"]) - JsMath.js_hypot2(q["x"] - start["x"], q["y"] - start["y"]))
			if not candidates.is_empty():
				start_approach = candidates[0]
	var options := {"bounds": bounds, "clearance": _WALK_CLEARANCE}
	if start_approach is Dictionary:
		options["startApproach"] = start_approach
	var end_approach: Variant = _chair_approach(end, true)
	if end_approach is Dictionary:
		options["endApproach"] = end_approach
	var path: Variant = CoreNavigation.route_floor_segment(start, end, boxes, options)
	if path == null:
		return null
	path.push_front(start)
	path.append(to)
	return path


static func _crosses_any(boxes: Array, a: Dictionary, b: Dictionary) -> bool:
	for r: Dictionary in boxes:
		if CoreNavigation.segment_crosses_obstacle(a, b, r):
			return true
	return false


## A reroute may happen while feet are actually inside an open doorway.
static func _inset(point: Dictionary, area: String, origin: Dictionary, bounds: Dictionary, h: float) -> Variant:
	if point["x"] < bounds["x"] or point["x"] > bounds["x"] + bounds["w"]:
		var direction := "left" if point["x"] < bounds["x"] else "right"
		if not CoreRegions.adjacent_area(area, direction) is String or absf(point["y"] - origin["y"] - CoreLayout.doorway_y(area, direction)) > 0.001:
			return null
		return {"x": origin["x"] + (12.0 if direction == "left" else 308.0), "y": point["y"]}
	if point["y"] > bounds["y"] + bounds["h"]:
		if not CoreRegions.adjacent_area(area, "down") is String or absf(point["x"] - origin["x"] - 160.0) > 0.001:
			return null
		return {"x": point["x"], "y": origin["y"] + h - 12.0}
	return point


func _find(id: Variant) -> Variant:
	for c: Dictionary in customers:
		if c["id"] == id:
			return c
	return null


func _spawn(state: Dictionary) -> void:
	var menu := CoreEconomy.menu_items(state)
	if menu.is_empty():
		return
	# One joint draw selects the visit's purpose and main dish.
	var choices := CoreEconomy.order_choices(menu, state)
	var weights := choices.map(func(option: Dictionary) -> float: return option["probability"])
	var choice: Dictionary = choices[int(CoreConditions.weighted_index(weights, _rng.call()))]
	var pairs: Array = choice["pairs"]
	var extra: Variant = null
	if not pairs.is_empty() and _rng.call() < choice["comboChance"]:
		extra = pairs[int(CoreConditions.weighted_index(choice["pairWeights"], _rng.call()))]["id"]
	var pos := CoreLayout.queue_spot(queue.size())
	var door := CoreLayout.door_spot()
	# Exactly five appearance draws: the visual cast must not perturb orders, VIP rolls or arrival timing.
	var seed_look := _random_look()
	_cast_random_state = 1 + int((((seed_look["skin"] * 6.0 + seed_look["hair"]) * 4.0 + seed_look["hairStyle"]) * 8.0 + seed_look["shirt"]) * 3.0 + seed_look["pants"])
	var appearance: Dictionary = _customer_cast.next()
	var regular: Variant = CoreRegularGuests.regular_guest_for_appearance(appearance["id"], state["day"])
	var visit_id: Variant = CoreRegularGuests.record_regular_guest_arrival(state, regular["id"]) if regular is Dictionary else null
	var regular_id: Variant = regular["id"] if regular is Dictionary else JsUtil.UNDEFINED
	var ordered := CoreRegularGuests.regular_guest_order(state, regular_id, choice["main"]["id"], extra)
	var remembered := CoreGuestMemories.remembered_order(state, appearance["id"], ordered["order"], ordered["extra"])
	var chosen := CoreEconomy.offer_trial_sale(state, remembered["order"], remembered["extra"], regular_id)
	var c := {}
	if choice.get("kind") is String:
		c["guestKind"] = choice["kind"]
	c["id"] = _next_id
	_next_id += 1.0
	c["reviewed"] = false
	c["waitSeconds"] = 0.0
	c["missingExtra"] = false
	c["x"] = door["x"]
	c["y"] = door["y"]
	c["tx"] = pos["x"]
	c["ty"] = pos["y"]
	c["phase"] = "queue"
	c["appearanceId"] = appearance["id"]
	if regular is Dictionary and visit_id != null:
		c["regularGuestId"] = regular["id"]
		c["regularGuestVisitId"] = visit_id
	c["look"] = appearance["look"].duplicate(false)
	c["order"] = chosen["order"]
	c["extra"] = chosen["extra"]
	if chosen.has("trialSale"):
		c["trialSale"] = chosen["trialSale"]
	elif remembered.has("rememberedOrder"):
		c["rememberedOrder"] = remembered["rememberedOrder"]
	c["vip"] = _rng.call() < CoreData.VIP_CHANCE
	c["patience"] = CoreEconomy.patience_seconds(state)
	c["spot"] = -1.0
	c["seat"] = -1.0
	c["timer"] = 0.0
	c["mood"] = null
	c["moodTimer"] = 0.0
	c["hasCup"] = false
	c["soldOut"] = false
	c["dineIn"] = false
	c["stride"] = 0.0
	c["via"] = []
	if c.has("guestKind"):
		state["today"]["guests"][c["guestKind"]]["arrived"] += 1.0
	customers.append(c)
	queue.append(c["id"])
	_walk(c, [pos])


func _relayout_queue() -> void:
	for i in queue.size():
		var c: Variant = _find(queue[i])
		if c != null:
			_walk(c, [CoreLayout.queue_spot(i)])


func _is_cook(w: Dictionary) -> bool:
	for cook: Dictionary in cooks:
		if is_same(cook, w):
			return true
	return false


func _cook_to(cook: Dictionary, spot: Dictionary) -> void:
	var path: Variant = CoreKitchen.kitchen_path(cook, spot)
	if path == null:
		push_error("No clear kitchen route")
		return
	_walk(cook, path)


## Sets someone walking through `points` in order.
func _walk(c: Dictionary, points: Array) -> void:
	var journey := []
	for p: Dictionary in points:
		journey.append(p.duplicate(false))
	c["journey"] = journey
	c["pathBlocked"] = false
	var cook := _is_cook(c)
	var routed := []
	var start := {"x": c["x"], "y": c["y"]}
	for point: Dictionary in points:
		var path: Variant = [point] if cook else _floor_route(start, point)
		if path == null:
			c["pathBlocked"] = true
			c["tx"] = c["x"]
			c["ty"] = c["y"]
			c["via"] = []
			return
		routed.append_array(path)
		start = point
	var unique := []
	var px: float = c["x"]
	var py: float = c["y"]
	for point: Dictionary in routed:
		if point["x"] != px or point["y"] != py:
			unique.append(point)
		px = point["x"]
		py = point["y"]
	var first: Variant = unique.pop_front()
	c["tx"] = first["x"] if first != null else c["x"]
	c["ty"] = first["y"] if first != null else c["y"]
	c["via"] = unique


func _exit(c: Dictionary) -> void:
	c.erase("recommendation")
	if not c["hasCup"]:
		c.erase("rememberedOrder")
	var known := _floor_state is Dictionary
	if known and c.get("trialSale") is String and c["trialSale"] == "reserved":
		CoreTrialSales.release_trial_sale(_floor_state)
	c.erase("trialSale")
	if known and c.get("regularGuestId") is String and JsUtil.is_number(c.get("regularGuestVisitId")):
		CoreRegularGuests.record_regular_guest_departure(_floor_state, c["regularGuestId"], c["regularGuestVisitId"])
	# Someone getting up from a table steps into its clear apron first.
	var stops := []
	var area: String
	if seated(c):
		stops.append(CoreLayout.seat_approach(_table(c["seat"]), _side(c["seat"])))
		area = CoreLayout.table_area(_table(c["seat"]))
	else:
		area = _area_of(c)
	if c["seat"] >= 0.0:
		seats[int(c["seat"])] = null
	c["seat"] = -1.0
	c["phase"] = "exiting"
	stops.append_array(CoreLayout.room_route(area, "main"))
	stops.append(CoreLayout.door_spot())
	_walk(c, stops)


## From a room to the spot in front of a seat, through the shared doors.
func _to_table(seat: float, from: String = "main") -> Array:
	var table := _table(seat)
	var approach := CoreLayout.seat_approach(table, _side(seat))
	var area := CoreLayout.table_area(table)
	if area == from:
		return [approach]
	var out := CoreLayout.room_route(from, area)
	out.append({"x": CoreLayout.area_origin(area)["x"] + 160.0, "y": approach["y"]})
	out.append(approach)
	return out


func _free_seat(state: Dictionary, c: Dictionary) -> float:
	var reserved: Variant = CoreRegularWishes.mina_reserved_table(state)
	if reserved is float and c.get("regularGuestId") is String and c["regularGuestId"] == "mina":
		for seat: float in [reserved * 2.0, reserved * 2.0 + 1.0]:
			if seats[int(seat)] == null:
				return seat
	var available := []
	for i: float in CoreRegions.active_table_indices(state):
		if reserved is float and i == reserved:
			continue
		for seat: float in [i * 2.0, i * 2.0 + 1.0]:
			if seats[int(seat)] == null:
				available.append(seat)
	return available[int(_rand_int(available.size()))] if not available.is_empty() else -1.0


func _review(state: Dictionary, c: Dictionary, review: Dictionary) -> void:
	if c["reviewed"]:
		return
	c["reviewed"] = true
	if c.get("guestKind") is String:
		var stats: Dictionary = state["today"]["guests"][c["guestKind"]]
		var reason: String = review["reason"]
		if reason == "soldOut":
			stats["stockLost"] += 1.0
		if reason == "queueWait" or reason == "tableWait":
			stats["waitLost"] += 1.0
		if reason == "cancelled":
			stats["cancelled"] += 1.0
	CoreReputation.record_review(state, review)


static func _meal(c: Dictionary) -> Array:
	return [c["order"], c["extra"]] if c["extra"] is String else [c["order"]]


## The customer pays for their order, wherever they get it.
func _charge(state: Dictionary, c: Dictionary, events: Array) -> void:
	if c["hasCup"]:
		return
	var bought := _meal(c).filter(func(id: String) -> bool: return CoreEconomy.can_prepare_item(state, id))
	if bought.is_empty():
		return
	var tip: float = 1.0 + (c["momentTip"] if JsUtil.is_number(c.get("momentTip")) else 0.0)
	var sum := 0.0
	for id: String in bought:
		sum += CoreEconomy.sale_price(state, id, c["vip"], c["dineIn"], bought)
	var amount := sum * tip
	var today: Dictionary = state["today"]
	CoreEconomy.earn(state, amount)
	state["served"] += 1.0
	today["served"] += 1.0
	today["revenue"] += amount
	if c.get("guestKind") is String:
		var stats: Dictionary = today["guests"][c["guestKind"]]
		stats["served"] += 1.0
		stats["revenue"] += amount
		if bought.size() > 1:
			stats["paired"] += 1.0
	for id: String in bought:
		today["sales"][id] = today["sales"].get(id, 0.0) + 1.0
	var trial: Variant = state["trialSales"]["active"]
	var prepared: bool = c.get("trialSale") is String and c["trialSale"] == "prepared"
	if prepared and trial is Dictionary and bought.has(trial["item"]):
		CoreTrialSales.record_trial_served(state, CoreEconomy.sale_price(state, trial["item"], c["vip"], c["dineIn"], bought) * tip, c)
	CoreGuestMemories.record_guest_memory(state, c, bought, trial["item"] if prepared and trial is Dictionary else JsUtil.UNDEFINED)
	c.erase("recommendation")
	c.erase("trialSale")
	events.append({"type": "sale", "amount": amount, "x": c["x"], "y": c["y"] - 52.0, "vip": c["vip"], "customerId": c["id"]})
	_review(state, c, CoreReputation.meal_review(state, bought, c["waitSeconds"], c["missingExtra"]))
	CoreTaste.record_servings(state, bought)
	CoreStyles.record_style_handoff(state, bought, c["dineIn"])
	if c.get("regularGuestId") is String and JsUtil.is_number(c.get("regularGuestVisitId")):
		CoreRegularGuests.record_regular_guest_service(state, c["regularGuestId"], c["regularGuestVisitId"], {"seat": c["seat"], "items": bought})
	c["hasCup"] = true
	c["mood"] = "happy"
	c["moodTimer"] = 1.5


func _call_next() -> void:
	for i in baristas.size():
		if queue.is_empty():
			return
		var b: Dictionary = baristas[i]
		if b["customerId"] != null:
			continue
		var c: Variant = _find(queue.pop_front())
		if c == null:
			continue
		c["phase"] = "toCounter"
		c["spot"] = float(i)
		_walk(c, [CoreLayout.service_spot(i)])
		b["customerId"] = c["id"]
		b["brewCredited"] = false
		b["remaining"] = 0.0
		b["total"] = 0.0
		_relayout_queue()


func _arrive(state: Dictionary, c: Dictionary, events: Array) -> void:
	if c["phase"] == "toSeat":
		c["phase"] = "waiting"
		c["timer"] = CoreEconomy.table_patience(state)
		return
	if c["phase"] != "toCounter":
		return
	var b: Dictionary = baristas[int(c["spot"])]
	var today: Dictionary = state["today"]
	var reserved: bool = c.get("trialSale") is String and c["trialSale"] == "reserved"
	var trial: Variant = state["trialSales"]["active"]["item"] if reserved and state["trialSales"]["active"] is Dictionary else null
	var order: String = c["order"]
	if not CoreEconomy.consume_serving(state, order, today):
		# Out of ingredients: sorry, no sale.
		b["customerId"] = null
		c["spot"] = -1.0
		c["soldOut"] = true
		c["mood"] = "sad"
		c["moodTimer"] = 2.2
		today["missed"] += 1.0
		today["soldOut"] += 1.0
		_review(state, c, {"stars": 1.0, "reason": "soldOut"})
		today["shortages"][order] = today["shortages"].get(order, 0.0) + 1.0
		events.append({"type": "soldout", "item": order, "x": c["x"], "y": c["y"] - 30.0})
		_exit(c)
		return
	if trial is String and trial == order:
		CoreTrialSales.record_trial_prepared(state, CoreEconomy.serving_cost(order))
		c["trialSale"] = "prepared"
	# The add-on is skipped (not a deal breaker) if it has sold out.
	var extra: Variant = c["extra"]
	if extra is String and not CoreEconomy.consume_serving(state, extra, today):
		if c.get("rememberedOrder") is String and c["rememberedOrder"] == extra:
			c.erase("rememberedOrder")
		today["extraLost"] += 1.0
		c["missingExtra"] = true
		today["shortages"][extra] = today["shortages"].get(extra, 0.0) + 1.0
		if c.get("trialSale") is String and c["trialSale"] == "reserved":
			CoreTrialSales.release_trial_sale(state)
			c.erase("trialSale")
		c["extra"] = null
	elif extra is String and trial is String and trial == extra:
		CoreTrialSales.record_trial_prepared(state, CoreEconomy.serving_cost(extra))
		c["trialSale"] = "prepared"
	c["phase"] = "ordering"
	var partner: Variant = b.get("partnerId", JsUtil.UNDEFINED)
	b["remaining"] = (CoreEconomy.prep_time(state, order) * CorePartners.partner_brew_multiplier(state, partner, CoreEconomy.is_bakery(order))
		+ (CoreEconomy.prep_time(state, c["extra"]) * CorePartners.partner_brew_multiplier(state, partner, CoreEconomy.is_bakery(c["extra"])) if c["extra"] is String else 0.0))
	b["total"] = b["remaining"]
	# With a table free, some stay: they take a seat and the order is brought over.
	var seat := _free_seat(state, c)
	var held: Variant = CoreRegularWishes.mina_reserved_table(state)
	var invited: bool = c.get("regularGuestId") is String and c["regularGuestId"] == "mina" and held is float and held == _table(seat)
	if seat >= 0.0 and (_rng.call() < CoreEconomy.order_seat_chance(state, _meal(c), c.get("guestKind", JsUtil.UNDEFINED)) or invited):
		seats[int(seat)] = c["id"]
		c["seat"] = seat
		c["dineIn"] = true
		c["timer"] = _ORDER_SECONDS


## Takeaway: handed over the counter, paid for, and out the door.
func _serve_at_counter(state: Dictionary, b: Dictionary, c: Dictionary, events: Array) -> void:
	_charge(state, c, events)
	b["customerId"] = null
	c["spot"] = -1.0
	_exit(c)


static func _bell() -> Dictionary:
	return {"type": "bell", "x": CoreLayout.PASS_BELL["x"], "y": CoreLayout.PASS_BELL["y"]}


## A table order is ready: onto the pass, and ring for a server. With the pass full the barista holds on to it.
func _send_to_pass(state: Dictionary, c: Dictionary, i: int, events: Array) -> void:
	var b: Dictionary = baristas[i]
	if pass_plates.size() >= CoreEconomy.pass_capacity(state):
		if b["calling"] <= 0.0:
			b["calling"] = _CALL_SECONDS
		return
	pass_plates.append({"customerId": c["id"], "items": _meal(c), "barista": float(i), "server": null, "waited": 0.0})
	b["customerId"] = null
	b["calling"] = _CALL_SECONDS
	events.append(_bell())


## A server at a guest's table hands over the order and the guest pays. False while the guest hasn't sat down yet.
func _deliver(state: Dictionary, server: Dictionary, events: Array) -> bool:
	var c: Variant = _find(server["plates"][0]["customerId"])
	# Their order can beat them to the table; the server waits for them to sit down.
	if c != null and (c["phase"] == "ordering" or c["phase"] == "toSeat"):
		return false
	if c != null and c["phase"] == "waiting":
		var unpaid: bool = not c["hasCup"]
		_charge(state, c, events)
		if unpaid and c["hasCup"]:
			CorePartners.record_partner_work(state, server.get("partnerId", JsUtil.UNDEFINED))
		c["phase"] = "sitting"
		c["timer"] = 6.0 + _rng.call() * 8.0 + CoreStyles.style_dwell_extra(state, _meal(c))
	server["plates"].pop_front()
	_head_out(server)
	return true


## On to the next table on the tray, nearest room and table first, or back to the kitchen door when it's empty.
func _head_out(server: Dictionary) -> void:
	# Orders for guests who gave up waiting are cleared away.
	var plates := []
	for p: Dictionary in server["plates"]:
		var c: Variant = _find(p["customerId"])
		if c != null and c["seat"] >= 0.0 and c["phase"] != "exiting":
			plates.append(p)
	server["plates"] = plates
	var area := _area_of(server)
	if not plates.is_empty():
		if plates.size() > 1:
			var distance := func(p: Dictionary) -> float:
				var seat: float = _find(p["customerId"])["seat"]
				var spot := CoreLayout.seat_approach(_table(seat), _side(seat))
				return _room_depth(_plate_room(p)) * 1e6 + JsMath.js_hypot2(spot["x"] - server["x"], spot["y"] - server["y"])
			JsUtil.stable_sort(plates, func(a: Dictionary, b: Dictionary) -> float: return distance.call(a) - distance.call(b))
		server["phase"] = "delivering"
		_walk(server, _to_table(_find(plates[0]["customerId"])["seat"], area))
		return
	server["phase"] = "returning"
	var stops := [] if area == "main" else [{"x": CoreLayout.area_origin(area)["x"] + 160.0, "y": server["y"]}]
	stops.append_array(CoreLayout.room_route(area, "main"))
	stops.append(CoreLayout.server_home(_server_index(server)))
	_walk(server, stops)


func _server_index(server: Dictionary) -> float:
	for i in servers.size():
		if is_same(servers[i], server):
			return i
	return -1.0


func _plate_patience(p: Dictionary) -> float:
	var c: Variant = _find(p["customerId"])
	return c["timer"] if c != null and c["phase"] == "waiting" else INF


## What a server answering the bell takes: the order whose guest is closest to giving up, plus whatever else fits on
## the tray, preferring the same room, then rooms on the way there, then rooms beyond it.
func _load_tray(limit: float) -> Array:
	var open := []
	for p: Dictionary in pass_plates:
		if p["server"] == null:
			open.append(p)
	if open.is_empty():
		return []
	var first: Dictionary = open[0]
	for p: Dictionary in open:
		if _plate_patience(p) < _plate_patience(first):
			first = p
	var room: Variant = _plate_room(first)
	var rank := func(p: Dictionary) -> float:
		var other: Variant = _plate_room(p)
		return 0.0 if _same_room(other, room) else (1.0 if _room_depth(other) < _room_depth(room) else 2.0)
	var out := []
	for p: Dictionary in open:
		if not is_same(p, first):
			out.append(p)
	if out.size() > 1:
		JsUtil.stable_sort(out, func(a: Dictionary, b: Dictionary) -> float: return rank.call(a) - rank.call(b))
	out.push_front(first)
	return out.slice(0, int(limit))


static func _same_room(a: Variant, b: Variant) -> bool:
	return (a == null and b == null) or (a is String and b is String and a == b)


## The room a plate's table is in.
func _plate_room(plate: Dictionary) -> Variant:
	var c: Variant = _find(plate["customerId"])
	return CoreLayout.table_area(_table(c["seat"])) if c != null and c["seat"] >= 0.0 else null


func _update_servers(state: Dictionary, dt: float, events: Array) -> void:
	# Plates nobody has come for: the barista rings again.
	for plate: Dictionary in pass_plates:
		if plate["server"] != null:
			continue
		plate["waited"] += dt
		if plate["waited"] >= CoreData.RING_AGAIN:
			plate["waited"] = 0.0
			if plate["barista"] < baristas.size():
				baristas[int(plate["barista"])]["calling"] = _CALL_SECONDS
			events.append(_bell())
	var pace := SERVER_SPEED * CoreStyles.style_server_multiplier(state)
	for i in servers.size():
		var server: Dictionary = servers[i]
		var partner: Variant = server.get("partnerId", JsUtil.UNDEFINED)
		server["ack"] = JsMath.js_max(0.0, server["ack"] - dt)
		_step(server, dt, pace * CorePartners.partner_server_speed(state, partner, server["plates"].size()))
		var there := _resting(server)
		match server["phase"]:
			"idle":
				var tray := _load_tray(CorePartners.partner_tray_size(state, partner))
				if tray.is_empty():
					continue
				for plate: Dictionary in tray:
					plate["server"] = float(i)
				server["plates"] = tray
				server["phase"] = "toPass"
				server["ack"] = 0.9
				_walk(server, [CoreLayout.pass_spot()])
			"toPass":
				if there:
					var left := []
					for p: Dictionary in pass_plates:
						var taken := false
						for mine: Dictionary in server["plates"]:
							taken = taken or is_same(mine, p)
						if not taken:
							left.append(p)
					pass_plates = left
					_head_out(server)
			"delivering":
				if there:
					_deliver(state, server, events)
			"returning":
				if there:
					server["phase"] = "idle"


## A free cook starts on whatever is running low, taking it from station to station and out through the door.
func _update_cooks(state: Dictionary, dt: float, events: Array) -> void:
	for i in cooks.size():
		var cook: Dictionary = cooks[i]
		var partner: Variant = cook.get("partnerId", JsUtil.UNDEFINED)
		_step(cook, dt, WALK_SPEED * CorePartners.partner_cook_speed(state, partner))
		if not _resting(cook):
			continue
		var batch: Variant = cook["batch"]
		if not batch is Dictionary:
			var baking := []
			for c: Dictionary in cooks:
				if c["batch"] is Dictionary:
					baking.append(c["batch"]["item"])
			var next: Variant = CoreKitchen.next_batch(state, baking)
			if next == null:
				continue
			CoreKitchen.start_batch(state, next["item"], next["n"])
			var steps := CoreKitchen.batch_steps(next["item"])
			cook["batch"] = {"item": next["item"], "n": next["n"], "steps": steps, "step": 0.0, "timer": _station_time(state, steps[0], partner)}
			_cook_to(cook, CoreKitchen.station_spot(steps[0]))
			continue
		batch["timer"] -= dt
		if batch["timer"] > 0.0:
			continue
		batch["step"] += 1.0
		if batch["step"] < batch["steps"].size():
			var station: String = batch["steps"][int(batch["step"])]
			batch["timer"] = _station_time(state, station, partner)
			_cook_to(cook, CoreKitchen.station_spot(station))
			continue
		var item: String = batch["item"]
		var baked: Dictionary = state["today"]["baked"]
		var before: float = baked.get(item, 0.0)
		CoreKitchen.shelve_batch(state, item, batch["n"])
		if baked.get(item, 0.0) > before:
			CorePartners.record_partner_work(state, partner)
		rack.push_front(item)
		rack = rack.slice(0, 3)
		events.append({"type": "restock", "item": item, "n": batch["n"]})
		cook["batch"] = null
		_cook_to(cook, CoreKitchen.cook_home(i))


static func _station_time(state: Dictionary, station: String, partner: Variant) -> float:
	return CoreKitchen.STATION_SECONDS[station] * CoreStyles.style_station_multiplier(state) * CorePartners.partner_station_time(state, partner)


## Where a cook's batch is: the station they're at or heading to, and whether they've started there.
func cook_station(i: float) -> Variant:
	var cook: Variant = cooks[int(i)] if i >= 0.0 and i < cooks.size() else null
	if cook == null or not cook["batch"] is Dictionary:
		return null
	return {"station": cook["batch"]["steps"][int(cook["batch"]["step"])], "working": _resting(cook)}


func update(state: Dictionary, dt: float) -> Array:
	var events := []
	_sync(state)
	if not is_finite(dt) or dt <= 0.0:
		return events
	_boost_cooldown = JsMath.js_max(0.0, _boost_cooldown - dt)

	# Close before admitting arrivals when a loaded or newly depleted menu is empty.
	if state["phase"] == "open" and (state["dayTime"] >= CoreData.DAY_SECONDS or not CoreEconomy.has_service_supply(state)):
		begin_closing(state)
	var open: bool = state["phase"] == "open"
	var running: bool = state["phase"] != "prep"
	var arrival_seconds := CoreTraffic.integrated_traffic_seconds(state["dayTime"], JsMath.js_min(dt, CoreData.DAY_SECONDS - state["dayTime"])) if open else dt
	if running:
		state["dayTime"] += dt
	if state["phase"] == "open" and state["dayTime"] >= CoreData.DAY_SECONDS:
		begin_closing(state)
	CorePets.update_pet_care(state, dt)
	CorePromotion.update_promotion(state, dt)
	# The saved timer is in mean-rate seconds; only open-shop arrivals follow the wave.
	_spawn_timer -= arrival_seconds
	if _spawn_timer <= 0.0:
		# Jittered so customers don't march in like clockwork.
		var rate := CoreEconomy.arrival_rate(state)
		# An empty menu must not leave an infinite saved timer.
		_spawn_timer = (0.5 + _rng.call()) / rate if rate > 0.0 else 1.0
		if state["phase"] == "open":
			if queue.size() < CoreData.MAX_QUEUE:
				_spawn(state)
			else:
				state["today"]["doorLost"] += 1.0

	_call_next()

	var today: Dictionary = state["today"]
	for c: Dictionary in customers:
		if running and not c["reviewed"] and c["phase"] != "sitting" and c["phase"] != "exiting":
			c["waitSeconds"] += dt
		if _step(c, dt, WALK_SPEED):
			_arrive(state, c, events)
		if c["moodTimer"] > 0.0:
			c["moodTimer"] -= dt
			if c["moodTimer"] <= 0.0:
				c["mood"] = null
		var phase: String = c["phase"]
		if phase == "queue":
			c["patience"] -= dt
			if c["patience"] <= 0.0:
				queue.erase(c["id"])
				_relayout_queue()
				c["mood"] = "sad"
				c["moodTimer"] = 2.0
				if running:
					today["missed"] += 1.0
					today["queueLost"] += 1.0
					_review(state, c, {"stars": 2.0, "reason": "queueWait"})
				events.append({"type": "walkout", "x": c["x"], "y": c["y"] - 30.0})
				_exit(c)
		elif phase == "ordering" and c["dineIn"]:
			# Ordered; payment happens when the server delivers.
			c["timer"] -= dt
			if c["timer"] <= 0.0:
				c["phase"] = "toSeat"
				c["spot"] = -1.0
				var stops := _to_table(c["seat"])
				stops.append(CoreLayout.seat_spot(_table(c["seat"]), _side(c["seat"])))
				_walk(c, stops)
		elif phase == "waiting":
			c["timer"] -= dt
			if c["timer"] <= 0.0:
				# Nobody brought it over: they leave without paying, and the order is wasted.
				var id: float = c["id"]
				pass_plates = pass_plates.filter(func(p: Dictionary) -> bool: return p["customerId"] != id or p["server"] != null)
				c["mood"] = "sad"
				c["moodTimer"] = 2.0
				if running:
					today["missed"] += 1.0
					today["tableLost"] += 1.0
					_review(state, c, {"stars": 1.0, "reason": "tableWait"})
				events.append({"type": "walkout", "x": c["x"], "y": c["y"] - 30.0})
				_exit(c)
		elif phase == "sitting":
			c["timer"] -= dt
			if c["timer"] <= 0.0:
				_exit(c)

	for i in baristas.size():
		var b: Dictionary = baristas[i]
		b["calling"] = JsMath.js_max(0.0, b["calling"] - dt)
		if b["customerId"] == null or b["total"] == 0.0:
			continue
		b["remaining"] -= dt
		if b["remaining"] > 0.0:
			continue
		var c: Variant = _find(b["customerId"])
		if c == null or c["phase"] == "exiting":
			b["customerId"] = null
			continue
		if not JsUtil.truthy(b.get("brewCredited")):
			CorePartners.record_partner_work(state, b.get("partnerId", JsUtil.UNDEFINED))
			b["brewCredited"] = true
		if c["dineIn"]:
			_send_to_pass(state, c, i, events)
		elif c["phase"] == "ordering":
			# A takeaway order waits for its customer to reach the counter.
			_serve_at_counter(state, b, c, events)

	_update_servers(state, dt, events)
	_update_cooks(state, dt, events)

	# The final serving can be reserved during this update: finish it through ordinary closing service.
	if state["phase"] == "open" and not CoreEconomy.has_service_supply(state):
		begin_closing(state)
	var staying := []
	for c: Dictionary in customers:
		if not (c["phase"] == "exiting" and _resting(c)):
			staying.append(c)
	customers = staying
	return events


## The player closes the shop: the doors shut on anyone still waiting and the day's books are settled.
func close_shop(state: Dictionary) -> Variant:
	if state["phase"] == "prep":
		return null
	for c: Dictionary in customers:
		var phase: String = c["phase"]
		if phase == "queue" and c.get("guestKind") is String:
			state["today"]["guests"][c["guestKind"]]["dismissed"] += 1.0
		if phase == "toCounter" or phase == "ordering" or phase == "toSeat" or phase == "waiting":
			_review(state, c, {"stars": 1.0, "reason": "cancelled"})
	send_home()
	return CoreDay.finish_day(state)


## Closing up: anyone still waiting leaves, the baristas stop, and the servers head back.
func send_home() -> void:
	for c: Dictionary in customers:
		if c["phase"] != "sitting" and c["phase"] != "exiting":
			_exit(c)
	queue = []
	pass_plates = []
	for b: Dictionary in baristas:
		b["customerId"] = null
		b["remaining"] = 0.0
		b["total"] = 0.0
		b["calling"] = 0.0
	for i in cooks.size():
		cooks[i]["batch"] = null
		_cook_to(cooks[i], CoreKitchen.cook_home(i))
	for i in servers.size():
		var server: Dictionary = servers[i]
		if server["phase"] == "idle":
			continue
		server["plates"] = []
		server["phase"] = "returning"
		var stops := CoreLayout.room_route(_area_of(server), "main")
		stops.append(CoreLayout.server_home(i))
		_walk(server, stops)


## Shared by all assistance actions; querying this never spends the cooldown.
func help_ready() -> bool:
	return _boost_cooldown <= 0.0


## Player taps to help: every brewing barista jumps ahead a bit.
func boost() -> bool:
	if _boost_cooldown > 0.0:
		return false
	var any := false
	for b: Dictionary in baristas:
		if b["customerId"] != null and b["total"] > 0.0 and b["remaining"] > 0.0:
			b["remaining"] = JsMath.js_max(0.01, b["remaining"] - _BOOST_SECONDS)
			any = true
	if any:
		_boost_cooldown = 1.0
	return any


## The first few people in line are the only guests worth presenting as choices.
func queue_choices(limit: float = 3.0) -> Array:
	var out := []
	for id: float in queue.slice(0, int(maxf(0.0, limit))):
		var c: Variant = _find(id)
		if c != null and c["phase"] == "queue":
			out.append(c)
	return out


## Move one waiting guest to the counter and give them time to stay with us.
func prioritize_queue(state: Dictionary, customer_id: float) -> bool:
	if state["phase"] != "open" or _boost_cooldown > 0.0:
		return false
	var index := queue.find(customer_id)
	var c: Variant = _find(customer_id)
	if index < 0 or c == null or c["phase"] != "queue":
		return false
	queue.remove_at(index)
	queue.push_front(customer_id)
	_relayout_queue()
	c["patience"] += QUEUE_HELP_PATIENCE
	c["mood"] = "happy"
	c["moodTimer"] = 2.0
	_boost_cooldown = 1.0
	return true


static func _drink_slot(c: Dictionary) -> bool:
	return not CoreEconomy.is_bakery(c["order"]) or c["extra"] != null and not CoreEconomy.is_bakery(c["extra"])


## Let the UI offer only trial choices the ordinary transaction can accept.
func can_offer_trial_to(state: Dictionary, customer_id: float) -> bool:
	if state["phase"] != "open" or not help_ready():
		return false
	var item: Variant = CoreTrialSales.trial_sale_item(state)
	var c: Variant = _find(customer_id)
	if item == null or c == null or c["phase"] != "queue" or c.has("trialSale"):
		return false
	var active: Variant = state["trialSales"]["active"]
	return (_drink_slot(c) and CoreEconomy.ready_servings(state, item) > (active["reserved"] if active is Dictionary else 0.0)
		and CoreTrialSales.can_reserve_trial_sale(state, c.get("regularGuestId", JsUtil.UNDEFINED)))


## Spend one help decision to put today's trial cup in a chosen guest's order.
func offer_trial_to(state: Dictionary, customer_id: float) -> bool:
	if not can_offer_trial_to(state, customer_id):
		return false
	var item: String = CoreTrialSales.trial_sale_item(state)
	var c: Dictionary = _find(customer_id)
	if not CoreTrialSales.reserve_trial_sale(state, c.get("regularGuestId", JsUtil.UNDEFINED)):
		return false
	if not CoreEconomy.is_bakery(c["order"]):
		c["order"] = item
	else:
		c["extra"] = item
	c.erase("rememberedOrder")
	c["trialSale"] = "reserved"
	c["mood"] = "happy"
	c["moodTimer"] = 2.0
	_boost_cooldown = 1.0
	return true


## A barista is done but the pass is full, so they're holding a table order.
func is_holding(i: float) -> bool:
	return is_brewing(i) and baristas[int(i)]["remaining"] <= 0.0


func is_brewing(i: float) -> bool:
	if i < 0.0 or i >= baristas.size():
		return false
	var b: Dictionary = baristas[int(i)]
	return b["customerId"] != null and b["total"] > 0.0


## Where a barista is inside the bar: facing the room to take an order, at the back bar to make it.
func barista_pose(i: float) -> Dictionary:
	var front := CoreLayout.barista_spot(i)
	if not is_brewing(i):
		return {"x": front["x"], "y": front["y"], "facing": "down", "walking": false, "working": false}
	var b: Dictionary = baristas[int(i)]
	var back := CoreLayout.barista_work_spot(i)
	var depth: float = front["y"] - back["y"]
	var trip := JsMath.js_min(depth / WALK_SPEED, b["total"] / 4.0)
	var elapsed: float = b["total"] - b["remaining"]
	var left := JsMath.js_max(0.0, b["remaining"])
	if elapsed < trip:
		return {"x": front["x"], "y": JsMath.js_round(front["y"] - (depth * elapsed) / trip), "facing": "up", "walking": true, "working": false}
	if left > trip:
		return {"x": back["x"], "y": back["y"], "facing": "up", "walking": false, "working": true}
	return {"x": front["x"], "y": JsMath.js_round(front["y"] - (depth * left) / trip), "facing": "down", "walking": left > 0.0, "working": false}


## At a table, whether still waiting for the order or eating it.
static func seated(c: Dictionary) -> bool:
	return c["phase"] == "waiting" or c["phase"] == "sitting"


## How far a room is from the main café along the shared doors; 0 for the main café.
static func _room_depth(area: Variant) -> float:
	return CoreLayout.room_route("main", area).size() if area is String else 0.0


## Standing still at the end of their path.
static func _resting(w: Dictionary) -> bool:
	return w["x"] == w["tx"] and w["y"] == w["ty"] and w["via"].is_empty() and not JsUtil.truthy(w.get("pathBlocked"))


## Moves a walker along its path; true on the step it reaches the end.
static func _step(w: Dictionary, dt: float, speed: float) -> bool:
	if w.get("pathBlocked", false):
		return false
	var left := speed * dt
	while left > 0.0:
		var dx: float = w["tx"] - w["x"]
		var dy: float = w["ty"] - w["y"]
		var dist := JsMath.js_hypot2(dx, dy)
		var via: Array = w["via"]
		if dist == 0.0:
			if via.is_empty():
				return false
			var next: Dictionary = via.pop_front()
			w["tx"] = next["x"]
			w["ty"] = next["y"]
			continue
		if dist > left:
			w["x"] += (dx / dist) * left
			w["y"] += (dy / dist) * left
			w["stride"] += left
			return false
		w["x"] = w["tx"]
		w["y"] = w["ty"]
		var journey: Variant = w.get("journey")
		if journey is Array:
			while not journey.is_empty() and absf(journey[0]["x"] - w["x"]) < 0.001 and absf(journey[0]["y"] - w["y"]) < 0.001:
				journey.pop_front()
		w["stride"] += dist
		left = 0.0
		if via.is_empty():
			return true
		var next: Dictionary = via.pop_front()
		w["tx"] = next["x"]
		w["ty"] = next["y"]
	return false
