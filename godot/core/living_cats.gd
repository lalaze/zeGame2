class_name CoreLivingCats
extends RefCounted

## Port of src/game/living-cats.ts: where the cats walk, rest and say hello. Visual companions only: never writes the
## state, charges care, reserves seats or blocks service.

const _CLEARANCE := 4.0
const _WEIGHTS := {"playful": [7.0, 1.0, 2.0, 3.0, 2.0], "quiet": [1.0, 7.0, 3.0, 2.0, 4.0], "affectionate": [4.0, 2.0, 3.0, 2.0, 7.0]}
const _BEHAVIORS := ["patrol", "sleep", "groom", "stretch", "watch"]
const _SECONDS := {"patrol": 5.0, "sleep": 22.0, "groom": 9.0, "stretch": 4.0, "watch": 12.0}

## Cat id to actor, in order of arrival.
var actors: Dictionary = {}
var _geometry: Dictionary = {}
var _signature := ""
## What `_signature` was made from, to see cheaply that nothing changed.
var _signed: Array = []
var _height := CoreLayout.scene_height()
var _arrivals: Dictionary = {}
var _preferences: Dictionary = {}
var _reselect_after_arrival: Dictionary = {}
var _guests: Dictionary = {}
var _guest_bindings: Dictionary = {}
var _guest_cooldowns: Dictionary = {}
var _greeted_guests: Dictionary = {}
var _guest_cooldown := 12.0
var _blocked_seconds: Dictionary = {}
var _random: Callable


func _init(random: Callable) -> void:
	_random = random


func reset() -> void:
	actors = {}
	_arrivals = {}
	_preferences = {}
	_reselect_after_arrival = {}
	_signature = ""
	_height = CoreLayout.scene_height()
	_guests = {}
	_guest_bindings = {}
	_guest_cooldowns = {}
	_greeted_guests = {}
	_guest_cooldown = 12.0
	_blocked_seconds = {}


static func _duration(behavior: String, random: float) -> float:
	return _SECONDS[behavior] * (0.8 + random * 0.7)


static func _padded(r: Dictionary) -> Dictionary:
	return {"x": r["x"] - _CLEARANCE, "y": r["y"] - _CLEARANCE, "w": r["w"] + _CLEARANCE * 2.0, "h": r["h"] + _CLEARANCE * 2.0}


static func _gap(a: Dictionary, b: Dictionary) -> float:
	return JsMath.js_hypot2(a["x"] - b["x"], a["y"] - b["y"])


static func _crosses_any(boxes: Array, a: Dictionary, b: Dictionary) -> bool:
	for r: Dictionary in boxes:
		if CoreNavigation.segment_crosses_obstacle(a, b, r):
			return true
	return false


func interact(id: String) -> bool:
	var actor: Variant = actors.get(id)
	if actor == null or actor["resting"]:
		return false
	actor["affection"] = 5.0 if actor["personality"] == "affectionate" else 3.0
	# Keep doorway journeys intact, so a greeting can never strand a cat in a wall.
	if actor["route"].is_empty():
		actor["behavior"] = "stretch" if actor["personality"] == "playful" else "watch"
		actor["remaining"] = _duration(actor["behavior"], _random.call())
		actor["elapsed"] = 0.0
	return true


func furniture_space_clear(id: String, col: float, row: float) -> bool:
	var def: Variant = CoreFurniture.furniture_def(id)
	var area: Variant = CoreRegions.area_at_x(col * CoreFurniture.CELL)
	if not def is Dictionary or not area is String or not is_finite(col) or not is_finite(row):
		return false
	if def["surface"] == "wall":
		return true
	var origin := CoreLayout.area_origin(area)
	var top := CoreLayout.floor_y(CoreLayout.FLOOR_Y + row * CoreFurniture.CELL)
	var box := _padded({
		"x": origin["x"] + col * CoreFurniture.CELL - CoreRegions.region_offset(area), "y": origin["y"] + top,
		"w": def["w"] * CoreFurniture.CELL, "h": CoreLayout.floor_y(CoreLayout.FLOOR_Y + (row + def["h"]) * CoreFurniture.CELL) - top,
	})
	for a: Dictionary in actors.values():
		if CoreNavigation.segment_crosses_obstacle(a, a, box):
			return false
	return true


static func _pet(state: Dictionary, id: String) -> Variant:
	for p: Dictionary in state["pets"]:
		if p["id"] == id:
			return p
	return null


## `customers` and `servers` are the people to keep clear of; seated customers may be greeted.
func update(state: Dictionary, dt: float, customers: Array = [], servers: Array = []) -> void:
	var changed := _refresh(state)
	var moving := is_finite(dt) and dt > 0.0
	if moving:
		_observe_guests(state, customers, minf(dt, 60.0))
	for id: String in actors.keys():
		if _pet(state, id) == null:
			for map: Dictionary in [actors, _arrivals, _preferences, _reselect_after_arrival, _guest_bindings, _guest_cooldowns, _blocked_seconds]:
				map.erase(id)
	for pet: Dictionary in state["pets"]:
		_update_pet(state, pet, dt, changed, moving, customers, servers)


func _update_pet(state: Dictionary, pet: Dictionary, dt: float, changed: bool, moving: bool, customers: Array, servers: Array) -> void:
	var id: String = pet["id"]
	var prefs := CorePets.pet_preferences(pet)
	if not actors.has(id) and not _settle(state, pet, prefs):
		return
	var actor: Dictionary = actors[id]
	actor["personality"] = prefs["personality"]
	var key: String = JsJson.stringify(prefs)
	var preference_changed: bool = _preferences.has(id) and _preferences[id] != key
	_preferences[id] = key
	if changed:
		_adapt(actor, pet, state)
		# Arrangement is synchronized during pause: invalidate the visit now.
		if actor.has("interaction"):
			_cancel_guest_interaction(actor, state)
	if preference_changed and dt > 0.0:
		actor["remaining"] = 0.0
		if actor["route"].is_empty():
			_choose(actor, pet, state)
	# Geometry and adoption synchronization is permitted at dt=0, but all clocks and movement freeze.
	if not moving:
		return
	actor["affection"] = JsMath.js_max(0.0, actor["affection"] - dt)
	var awake := CorePets.pet_active(pet)
	if actor.has("interaction") and (changed or not awake or not _guest_still_seated(actor)):
		_cancel_guest_interaction(actor, state)
	if not awake:
		_rest(actor, pet, state, dt, customers, servers)
		return
	if actor["resting"]:
		actor["resting"] = false
		actor["behavior"] = "stretch"
		actor["remaining"] = 4.0
		actor["elapsed"] = 0.0
	if not actor.has("interaction"):
		_maybe_greet_guest(actor, state)
	# Bounded substeps prevent huge background deltas from skipping through a doorway or guest.
	var time := minf(dt, 60.0)
	while time > 1e-8:
		var step := minf(time, 0.1)
		time -= step
		actor["elapsed"] += step
		if actor.has("interaction"):
			_advance_guest_interaction(actor, state, step, customers, servers)
		elif not actor["route"].is_empty():
			_walk(actor, step, customers, servers, state)
		else:
			actor["remaining"] -= step
			if actor["remaining"] <= 0.0:
				_choose(actor, pet, state)
	actor["area"] = _actor_area(actor)


func _settle(state: Dictionary, pet: Dictionary, prefs: Dictionary) -> bool:
	for p: Dictionary in _destinations(state, pet):
		var crowded := false
		for a: Dictionary in actors.values():
			crowded = crowded or _gap(a, p) < 15.0
		if crowded:
			continue
		var awake := CorePets.pet_active(pet)
		actors[pet["id"]] = {
			"id": pet["id"], "x": p["x"], "y": p["y"], "area": p["area"], "personality": prefs["personality"], "behavior": "watch" if awake else "sleep",
			"remaining": 2.0 + actors.size() * 2.0, "elapsed": 0.0, "facing": 1.0, "stride": 0.0, "affection": 0.0, "route": [], "targetKind": p["kind"], "resting": not awake,
		}
		_guest_cooldowns[pet["id"]] = 40.0 if prefs["personality"] == "playful" else 12.0
		return true
	return false


## The room changed: give up on furniture that is gone, plan again, and step out of anything new.
func _adapt(actor: Dictionary, pet: Dictionary, state: Dictionary) -> void:
	var id: String = actor["id"]
	var route: Array = actor["route"]
	if actor["targetKind"] == "bed" or actor["targetKind"] == "window":
		var destination: Dictionary = route[-1] if not route.is_empty() else actor
		var still_present := false
		for p: Dictionary in _destinations(state, pet):
			still_present = still_present or p["kind"] == actor["targetKind"] and _gap(p, destination) < 2.0
		if not still_present:
			actor["targetKind"] = "explore" if not route.is_empty() else "cozy"
			actor["remaining"] = JsMath.js_min(actor["remaining"], 1.0)
			if not route.is_empty():
				# Finish the safe doorway journey to its clear apron, then choose from the new layout.
				_arrivals[id] = "stretch"
				_reselect_after_arrival[id] = true
	if not route.is_empty():
		var planned: Variant = _route(actor, route[-1], state)
		actor["route"] = planned if planned != null else []
	if actor["route"].is_empty():
		var area: Variant = CoreLayout.area_at_point(actor["x"], actor["y"])
		var escape: Variant = _escape_margin(actor, area) if area is String and area != "kitchen" else null
		if escape != null:
			actor["route"] = [escape]
			actor["behavior"] = "patrol"
			_arrivals[id] = "stretch"


func _rest(actor: Dictionary, pet: Dictionary, state: Dictionary, dt: float, customers: Array, servers: Array) -> void:
	var newly_empty: bool = not actor["resting"]
	actor["resting"] = true
	actor["remaining"] = 30.0
	actor["elapsed"] += minf(dt, 60.0)
	# If supplies run out in an aisle, walk to the nearest clear resting apron before curling up.
	var area: Variant = CoreLayout.area_at_point(actor["x"], actor["y"])
	var origin := CoreLayout.area_origin(area if area is String else "main")
	if newly_empty and actor["route"].is_empty() and _in_aisle(actor["x"] - origin["x"], actor["y"] - origin["y"]):
		var choices := _destinations(state, pet).filter(func(p: Dictionary) -> bool: return (p["kind"] == "bed" or p["kind"] == "cozy") and _destination_free(p, actor["id"]))
		JsUtil.stable_sort(choices, func(p: Dictionary, q: Dictionary) -> float: return _gap(actor, p) - _gap(actor, q))
		for p: Dictionary in choices:
			var route: Variant = _route(actor, p, state)
			if route != null:
				actor["route"] = route
				actor["targetKind"] = p["kind"]
				break
	_arrivals[actor["id"]] = "sleep"
	actor["behavior"] = "patrol" if not actor["route"].is_empty() else "sleep"
	var time := minf(dt, 60.0)
	while not actor["route"].is_empty() and time > 1e-8:
		var step := minf(time, 0.1)
		time -= step
		_walk(actor, step, customers, servers, state)
	actor["area"] = _actor_area(actor)


static func _in_aisle(x: float, y: float) -> bool:
	return x < 20.0 or x > 300.0 or y < CoreLayout.FLOOR_Y + 10.0 or y > CoreLayout.scene_height() - 16.0 or absf(y - CoreLayout.floor_y(138.0)) < 10.0


func _observe_guests(state: Dictionary, customers: Array, dt: float) -> void:
	_guest_cooldown = JsMath.js_max(0.0, _guest_cooldown - dt)
	for id: String in _guest_cooldowns:
		_guest_cooldowns[id] = JsMath.js_max(0.0, _guest_cooldowns[id] - dt)
	var tables := CoreRegions.active_table_indices(state)
	var seen := {}
	for c: Dictionary in customers:
		var id: Variant = c.get("id")
		var seat: Variant = c.get("seat")
		var phase: Variant = c.get("phase")
		if (not JsMath.is_integer(id) or id < 0.0 or not JsMath.is_integer(seat) or seat < 0.0
				or not phase is String or phase != "sitting" and phase != "waiting" or not tables.has(floor(seat / 2.0))):
			continue
		var position := CoreLayout.seat_spot(floor(seat / 2.0), fmod(seat, 2.0))
		if _gap(position, c) > 1.0 or not is_finite(c["x"] + c["y"]):
			continue
		seen[id] = true
		var previous: Variant = _guests.get(id)
		var stable: float = previous["stable"] + dt if previous != null and previous["guest"]["seat"] == seat and _gap(previous["guest"], c) < 0.1 else 0.0
		_guests[id] = {"guest": {"id": id, "seat": seat, "x": c["x"], "y": c["y"]}, "stable": stable}
	for id: float in _guests.keys():
		if not seen.has(id):
			_guests.erase(id)
	for id: float in _greeted_guests.keys():
		if not seen.has(id):
			_greeted_guests.erase(id)


func _guest_still_seated(actor: Dictionary) -> bool:
	var binding: Variant = _guest_bindings.get(actor["id"])
	var current: Variant = _guests.get(binding["guest"]["id"]) if binding != null else null
	return current != null and current["guest"]["seat"] == binding["guest"]["seat"] and _gap(current["guest"], binding["guest"]) < 0.1


func _maybe_greet_guest(actor: Dictionary, state: Dictionary) -> void:
	var id: String = actor["id"]
	var affectionate: bool = actor["personality"] == "affectionate"
	if (actor["personality"] == "quiet" or actor["resting"] or not actor["route"].is_empty() or actor["behavior"] == "sleep"
			or not _guest_bindings.is_empty() or _guest_cooldown > 0.0 or _guest_cooldowns.get(id, 0.0) > 0.0):
		return
	# Retry on a sparse clock, not every frame, so frame rate cannot increase sociability.
	_guest_cooldowns[id] = 8.0 if affectionate else 20.0
	if _random.call() >= (0.8 if affectionate else 0.2):
		return
	var area := _actor_area(actor)
	var guests := _guests.values().filter(func(g: Dictionary) -> bool:
		return g["stable"] >= 1.5 and not _greeted_guests.has(g["guest"]["id"]) and CoreLayout.table_area(floor(g["guest"]["seat"] / 2.0)) == area)
	JsUtil.stable_sort(guests, func(a: Dictionary, b: Dictionary) -> float: return _gap(a["guest"], actor) - _gap(b["guest"], actor))
	for entry: Dictionary in guests:
		var guest: Dictionary = entry["guest"]
		var target := CoreLayout.seat_approach(floor(guest["seat"] / 2.0), fmod(guest["seat"], 2.0))
		if not _destination_free(target, id):
			continue
		var route: Variant = _route(actor, target, state)
		if route == null or route.is_empty() or not _stays_in(route, area):
			continue
		var distance := 0.0
		var previous := actor
		for p: Dictionary in route:
			distance += _gap(p, previous)
			previous = p
		if distance > 150.0:
			continue
		_guest_bindings[id] = {"guest": guest.duplicate(false), "origin": {"x": actor["x"], "y": actor["y"]}, "age": 0.0}
		actor["interaction"] = {"guestId": guest["id"], "phase": "approach", "elapsed": 0.0}
		actor["route"] = route
		actor["behavior"] = "patrol"
		actor["targetKind"] = "people"
		_arrivals[id] = "watch"
		_greeted_guests[guest["id"]] = true
		_guest_cooldowns[id] = 45.0 if affectionate else 100.0
		return


static func _stays_in(route: Array, area: String) -> bool:
	for p: Dictionary in route:
		var at: Variant = CoreLayout.area_at_point(p["x"], p["y"])
		if not at is String or at != area:
			return false
	return true


func _guest_retreat(actor: Dictionary, binding: Dictionary, state: Dictionary) -> Variant:
	var pet: Variant = _pet(state, actor["id"])
	var destinations := [binding["origin"]]
	if pet != null:
		var area := _actor_area(actor)
		destinations.append_array(_destinations(state, pet).filter(func(p: Dictionary) -> bool: return p["area"] == area))
	for destination: Dictionary in destinations:
		if not _destination_free(destination, actor["id"]):
			continue
		var route: Variant = _route(actor, destination, state)
		if route != null:
			return route
	return null


func _cancel_guest_interaction(actor: Dictionary, state: Dictionary) -> void:
	var id: String = actor["id"]
	var binding: Variant = _guest_bindings.get(id)
	actor.erase("interaction")
	_guest_bindings.erase(id)
	_guest_cooldown = 24.0
	# Visits are room-local: return along a newly validated route.
	var retreat: Variant = _guest_retreat(actor, binding, state) if binding != null else null
	if retreat != null:
		actor["route"] = retreat
	else:
		var escape: Variant = _escape_margin(actor, _actor_area(actor))
		actor["route"] = [escape] if escape != null else []
	actor["behavior"] = "patrol" if not actor["route"].is_empty() else "watch"
	actor["remaining"] = 3.0
	actor["elapsed"] = 0.0
	_arrivals[id] = "watch"


func _advance_guest_interaction(actor: Dictionary, state: Dictionary, dt: float, customers: Array, servers: Array) -> void:
	var id: String = actor["id"]
	var interaction: Dictionary = actor["interaction"]
	var binding: Variant = _guest_bindings.get(id)
	if binding == null:
		actor.erase("interaction")
		return
	binding["age"] += dt
	interaction["elapsed"] += dt
	var phase: String = interaction["phase"]
	if binding["age"] > 28.0 or phase == "approach" and interaction["elapsed"] > 10.0:
		_cancel_guest_interaction(actor, state)
		return
	if phase == "approach" or phase == "leave":
		if not actor["route"].is_empty():
			_walk(actor, dt, customers, servers, state)
		# A blocked approach can cancel its own binding while planning retreat.
		if not (actor.has("interaction") and is_same(actor["interaction"], interaction)) or not actor["route"].is_empty():
			return
		if phase == "leave":
			actor.erase("interaction")
			_guest_bindings.erase(id)
			_guest_cooldown = 24.0
			actor["behavior"] = "watch"
			actor["remaining"] = 4.0
			return
		var seat: float = binding["guest"]["seat"]
		if _gap(actor, CoreLayout.seat_approach(floor(seat / 2.0), fmod(seat, 2.0))) > 0.5:
			_cancel_guest_interaction(actor, state)
			return
		interaction["phase"] = "nuzzle"
		interaction["elapsed"] = 0.0
		actor["behavior"] = "watch"
		actor["elapsed"] = 0.0
		actor["facing"] = 1.0 if fmod(seat, 2.0) == 0.0 else -1.0
		return
	actor["behavior"] = "watch"
	if phase == "nuzzle" and interaction["elapsed"] >= 2.0:
		interaction["phase"] = "response"
		interaction["elapsed"] = 0.0
		actor["affection"] = 2.0
		return
	if phase == "response" and interaction["elapsed"] >= 3.0:
		var route: Variant = _guest_retreat(actor, binding, state)
		if route == null:
			_cancel_guest_interaction(actor, state)
			return
		actor["route"] = route
		actor["behavior"] = "patrol"
		interaction["phase"] = "leave"
		interaction["elapsed"] = 0.0
		_arrivals[id] = "watch"


func _actor_area(actor: Dictionary) -> String:
	var area: Variant = CoreLayout.area_at_point(actor["x"], actor["y"])
	return area if area is String and area != "kitchen" else actor["area"]


func _refresh(state: Dictionary) -> bool:
	var h := CoreLayout.scene_height()
	if _height != h:
		var from := _height
		for binding: Dictionary in _guest_bindings.values():
			binding["origin"] = CoreLayout.resize_room_point(binding["origin"], from)
		for a: Dictionary in actors.values():
			var moved := CoreLayout.resize_room_point(a, from)
			a["x"] = moved["x"]
			a["y"] = moved["y"]
			a["route"] = a["route"].map(func(p: Dictionary) -> Dictionary: return CoreLayout.resize_room_point(p, from))
		_height = h
	var tables := CoreRegions.active_table_indices(state)
	var parts := [h, state["regions"], tables, state["decor"]["placed"]]
	if not _signature.is_empty() and _unchanged(parts):
		return false
	_signed = parts.duplicate(true)
	var signature: String = JsJson.stringify(parts)
	if signature == _signature:
		return false
	_signature = signature
	_geometry = {}
	for area: String in CoreRegions.AREA_IDS:
		var o := CoreLayout.area_origin(area)
		var boxes := []
		_geometry[area] = boxes
		if area == "main":
			boxes.append({"x": CoreLayout.COUNTER["x"], "y": CoreLayout.FLOOR_Y, "w": CoreLayout.COUNTER["w"] + CoreLayout.COUNTER_GATE["w"], "h": CoreLayout.COUNTER["bottom"] - CoreLayout.FLOOR_Y})
			boxes.append_array(CoreLayout.MAIN_CUPBOARDS)
			for p: Dictionary in CoreLayout.door_plant_spots():
				boxes.append({"x": p["x"] - 5.0, "y": p["y"] - 4.0, "w": 10.0, "h": 6.0})
		if CoreRegions.adjacent_area(area, "up") is String:
			boxes.append({"x": o["x"], "y": o["y"], "w": 142.0, "h": CoreLayout.FLOOR_Y})
			boxes.append({"x": o["x"] + 178.0, "y": o["y"], "w": 142.0, "h": CoreLayout.FLOOR_Y})
	for i: float in tables:
		var p := CoreLayout.table_pos(i)
		_geometry[CoreLayout.table_area(i)].append({"x": p["x"] - 23.0, "y": p["y"] - 10.0, "w": 46.0, "h": 13.0})
	for p: Dictionary in state["decor"]["placed"]:
		var d: Variant = CoreFurniture.furniture_def(p["id"])
		var area: Variant = CoreRegions.area_at_x(p["col"] * CoreFurniture.CELL)
		if not d is Dictionary or not area is String or d["surface"] != "floor":
			continue
		var o := CoreLayout.area_origin(area)
		var y := CoreLayout.floor_y(CoreLayout.FLOOR_Y + p["row"] * CoreFurniture.CELL)
		_geometry[area].append({
			"x": o["x"] + p["col"] * CoreFurniture.CELL - CoreRegions.region_offset(area), "y": o["y"] + y,
			"w": d["w"] * CoreFurniture.CELL, "h": CoreLayout.floor_y(CoreLayout.FLOOR_Y + (p["row"] + d["h"]) * CoreFurniture.CELL) - y,
		})
	return true


func _unchanged(parts: Array) -> bool:
	if parts != _signed:
		return false
	# The signature is text, so another order of keys counts as a change too.
	var placed: Array = parts[3]
	for i in placed.size():
		if placed[i].keys() != _signed[3][i].keys():
			return false
	return true


func _destinations(state: Dictionary, pet: Dictionary) -> Array:
	var prefs := CorePets.pet_preferences(pet)
	var result := []
	for p: Dictionary in state["decor"]["placed"]:
		if p["id"] == "catbed":
			var area: Variant = CoreRegions.area_at_x(p["col"] * CoreFurniture.CELL)
			if area is String:
				_add(result, state, area, p["col"] * CoreFurniture.CELL - CoreRegions.region_offset(area) + 8.0, CoreLayout.floor_y(CoreLayout.FLOOR_Y + (p["row"] + 1.0) * CoreFurniture.CELL) + 8.0, "bed")
	for area: String in CoreRegions.AREA_IDS:
		if area == "kitchen" or not CoreRegions.is_area_open(state, area):
			continue
		_add(result, state, area, 26.0, CoreLayout.floor_y(112.0), "window")
		_add(result, state, area, 294.0, CoreLayout.floor_y(120.0), "window")
		for x: float in [26.0, 66.0, 194.0, 294.0]:
			_add(result, state, area, x, CoreLayout.floor_y(200.0), "cozy")
		for x: float in [50.0, 130.0, 190.0, 270.0]:
			_add(result, state, area, x, CoreLayout.floor_y(145.0), "explore")
		_add(result, state, area, 130.0, CoreLayout.floor_y(192.0), "people")
		_add(result, state, area, 190.0, CoreLayout.floor_y(192.0), "people")
	var rank := func(p: Dictionary) -> float:
		return (8.0 if p["area"] == prefs["preferredArea"] else 0.0) + (4.0 if p["kind"] == prefs["preferredSpot"] else 0.0) + (2.0 if p["kind"] == "bed" else 0.0)
	return JsUtil.stable_sort(result, func(a: Dictionary, b: Dictionary) -> float: return rank.call(b) - rank.call(a))


func _add(result: Array, state: Dictionary, area: String, x: float, y: float, kind: String) -> void:
	if area == "kitchen" or not CoreRegions.is_area_open(state, area) or x < 9.0 or x > 311.0 or y < CoreLayout.FLOOR_Y + 8.0 or y > CoreLayout.scene_height() - 12.0:
		return
	var o := CoreLayout.area_origin(area)
	var p := {"area": area, "x": o["x"] + x, "y": o["y"] + y, "kind": kind}
	for r: Dictionary in _geometry.get(area, []):
		if CoreNavigation.segment_crosses_obstacle(p, p, _padded(r)):
			return
	result.append(p)


func _escape_margin(point: Dictionary, area: String, extra: Array = []) -> Variant:
	var expanded := []
	for r: Dictionary in _geometry.get(area, []):
		expanded.append(_padded(r))
	for r: Dictionary in extra:
		expanded.append(_padded(r))
	if not _crosses_any(expanded, point, point):
		return null
	var origin := CoreLayout.area_origin(area)
	var candidates := []
	for r: Dictionary in expanded:
		for p: Dictionary in [{"x": r["x"] - 0.01, "y": point["y"]}, {"x": r["x"] + r["w"] + 0.01, "y": point["y"]}, {"x": point["x"], "y": r["y"] - 0.01}, {"x": point["x"], "y": r["y"] + r["h"] + 0.01}]:
			if (p["x"] < origin["x"] + 5.0 or p["x"] > origin["x"] + 315.0 or p["y"] < origin["y"] + CoreLayout.FLOOR_Y + 5.0 or p["y"] > origin["y"] + CoreLayout.scene_height() - 8.0
					or _crosses_any(expanded, p, p)):
				continue
			var through := false
			for other: Dictionary in expanded:
				if CoreNavigation.segment_crosses_obstacle(point, p, other) and not CoreNavigation.segment_crosses_obstacle(point, point, other):
					through = true
					break
			if not through:
				candidates.append(p)
	JsUtil.stable_sort(candidates, func(a: Dictionary, b: Dictionary) -> float: return _gap(a, point) - _gap(b, point))
	return candidates[0] if not candidates.is_empty() else null


func _route(from: Dictionary, goal: Dictionary, state: Dictionary, dynamic: Dictionary = {}) -> Variant:
	var a: Variant = CoreLayout.area_at_point(from["x"], from["y"])
	var b: Variant = CoreLayout.area_at_point(goal["x"], goal["y"])
	if not a is String or not b is String or a == "kitchen" or b == "kitchen" or not CoreRegions.is_area_open(state, b):
		return null
	var stops := CoreLayout.room_route(a, b)
	stops.append(goal)
	var route := []
	var previous := from
	for target: Dictionary in stops:
		var source_area: Variant = CoreLayout.area_at_point(previous["x"], previous["y"])
		var target_area: Variant = CoreLayout.area_at_point(target["x"], target["y"])
		if not source_area is String or not target_area is String or not CoreRegions.is_area_open(state, target_area) or target_area == "kitchen":
			return null
		var o := CoreLayout.area_origin(source_area)
		if source_area != target_area:
			if not _through_door(source_area, target_area, o, previous, target):
				return null
			route.append(target)
		else:
			var top: float = 0.0 if CoreRegions.adjacent_area(source_area, "up") is String else CoreLayout.FLOOR_Y
			var boxes: Array = _geometry.get(source_area, []).duplicate(false)
			boxes.append_array(dynamic.get(source_area, []))
			var options := {"clearance": _CLEARANCE, "bounds": {"x": o["x"], "y": o["y"] + top, "w": 320.0, "h": CoreLayout.scene_height() - top}}
			var approach: Variant = _escape_margin(previous, source_area, dynamic.get(source_area, []))
			if approach != null:
				options["startApproach"] = approach
			var segment: Variant = CoreNavigation.route_floor_segment(previous, target, boxes, options)
			if segment == null:
				return null
			route.append_array(segment)
		previous = target
	return route if route.size() <= 100 else null


static func _through_door(source: String, target_area: String, o: Dictionary, previous: Dictionary, target: Dictionary) -> bool:
	for link: Dictionary in CoreRegions.area_connections(source):
		if link["to"] != target_area:
			continue
		var direction: String = link["direction"]
		if direction == "left" or direction == "right":
			var boundary: float = o["x"] + (320.0 if direction == "right" else 0.0)
			return not (absf(previous["y"] - o["y"] - CoreLayout.doorway_y(source, direction)) > 0.01 or absf(target["y"] - previous["y"]) > 0.01
				or absf(previous["x"] - boundary) > 12.01 or absf(target["x"] - boundary) > 12.01)
		var edge: float = o["y"] + (CoreLayout.scene_height() if direction == "down" else 0.0)
		return not (absf(previous["x"] - o["x"] - 160.0) > 0.01 or absf(target["x"] - previous["x"]) > 0.01
			or absf(previous["y"] - edge) > 12.01 or absf(target["y"] - edge) > 12.01)
	return false


func _destination_free(point: Dictionary, id: String) -> bool:
	for other: Dictionary in actors.values():
		if other["id"] == id:
			continue
		var destination: Dictionary = other["route"][-1] if not other["route"].is_empty() else other
		if _gap(destination, point) < 14.0 or _gap(other, point) < 14.0:
			return false
	return true


func _choose(a: Dictionary, pet: Dictionary, state: Dictionary) -> void:
	var personality: String = a["personality"]
	var quiet := personality == "quiet"
	var weights: Array = _WEIGHTS[personality]
	var sum := 0.0
	for w: float in weights:
		sum += w
	var value := JsMath.js_max(0.0, JsMath.js_min(0.999999, _random.call())) * sum
	var index := 0
	while index < weights.size() - 1:
		value -= weights[index]
		if value < 0.0:
			break
		index += 1
	var behavior: String = _BEHAVIORS[index]
	if behavior == a["behavior"] and behavior != "patrol":
		behavior = "stretch"
	a["elapsed"] = 0.0
	a["remaining"] = _duration(behavior, _random.call()) * (2.0 if quiet and behavior == "sleep" else 1.0)
	var choices := _destinations(state, pet).filter(func(p: Dictionary) -> bool: return _destination_free(p, a["id"]))
	var bed := false
	for p: Dictionary in choices:
		bed = bed or p["kind"] == "bed"
	# Grooming and stretching happen where the cat settled; quiet companions also watch locally.
	if (behavior == "groom" or behavior == "stretch" or behavior == "watch" and quiet and a["targetKind"] == "window"
			or behavior == "sleep" and (a["targetKind"] == "bed" or a["targetKind"] == "cozy" and not bed)):
		a["behavior"] = behavior
		return
	# Quiet cats linger locally; playful cats roam; affectionate cats watch from an aisle apron.
	var prefs := CorePets.pet_preferences(pet)
	var watch_people: bool = personality == "affectionate" and prefs["preferredSpot"] != "window" and _random.call() < 0.7
	var area_choices := choices
	if quiet:
		var local := choices.filter(func(p: Dictionary) -> bool: return p["area"] == prefs["preferredArea"])
		if not local.is_empty():
			area_choices = local
	var preferred := area_choices.filter(func(p: Dictionary) -> bool:
		if behavior == "sleep":
			return p["kind"] == ("bed" if bed else "cozy")
		if behavior == "watch":
			return p["kind"] == ("people" if watch_people else "window")
		return p["area"] == prefs["preferredArea"] if quiet else true)
	var candidates := choices
	if not preferred.is_empty():
		candidates = preferred.duplicate(false)
		for p: Dictionary in choices:
			var listed := false
			for q: Dictionary in preferred:
				listed = listed or is_same(p, q)
			if not listed:
				candidates.append(p)
	var primary := preferred.size() if not preferred.is_empty() else candidates.size()
	var start := int(floor(_random.call() * mini(primary, 1 if behavior == "sleep" and bed else (primary if personality == "playful" else 4))))
	for i in candidates.size():
		var destination: Dictionary = candidates[(start + i) % primary if i < primary else i]
		if _gap(a, destination) < 12.0:
			continue
		var route: Variant = _route(a, destination, state)
		if route == null:
			continue
		a["route"] = route
		a["targetKind"] = destination["kind"]
		a["behavior"] = "patrol"
		_arrivals[a["id"]] = "watch" if behavior == "patrol" else behavior
		return
	a["behavior"] = "watch" if behavior == "patrol" else behavior


func _dynamic_obstacles(customers: Array, servers: Array) -> Dictionary:
	var result := {}
	for group: Array in [customers, servers]:
		for b: Dictionary in group:
			var area: Variant = CoreLayout.area_at_point(b["x"], b["y"])
			if not area is String or area == "kitchen" or not is_finite(b["x"] + b["y"]):
				continue
			# The planner's clearance expands this 10px square to the 9px personal space used by walking.
			if not result.has(area):
				result[area] = []
			result[area].append({"x": b["x"] - 5.0, "y": b["y"] - 5.0, "w": 10.0, "h": 10.0})
	return result


static func _in_passage(a: Dictionary) -> bool:
	var area: Variant = CoreLayout.area_at_point(a["x"], a["y"])
	if not area is String or area == "kitchen":
		return true
	var o := CoreLayout.area_origin(area)
	return _in_aisle(a["x"] - o["x"], a["y"] - o["y"])


func _recover_blocked_walk(a: Dictionary, state: Dictionary, customers: Array, servers: Array) -> void:
	var id: String = a["id"]
	_blocked_seconds[id] = 0.0
	var dynamic := _dynamic_obstacles(customers, servers)
	var goal: Variant = a["route"][-1] if not a["route"].is_empty() else null
	# A social approach stays tied to its exact seat apron; if it is no longer reachable, cancel it.
	if a.has("interaction"):
		var route: Variant = _route(a, goal, state, dynamic) if goal != null else null
		if route != null and not route.is_empty():
			a["route"] = route
			return
		_cancel_guest_interaction(a, state)
	if not a["resting"] and goal != null:
		var route: Variant = _route(a, goal, state, dynamic)
		if route != null and not route.is_empty():
			a["route"] = route
			return
	var pet: Variant = _pet(state, id)
	var area := _actor_area(a)
	if pet != null:
		var candidates := _destinations(state, pet).filter(func(p: Dictionary) -> bool:
			return p["area"] == area and (not a["resting"] or p["kind"] == "bed" or p["kind"] == "cozy") and _destination_free(p, id))
		JsUtil.stable_sort(candidates, func(p: Dictionary, q: Dictionary) -> float: return _gap(p, a) - _gap(q, a))
		for candidate: Dictionary in candidates:
			if _gap(candidate, a) < 2.0 or _in_passage(candidate):
				continue
			var route: Variant = _route(a, candidate, state, dynamic)
			if route == null or route.is_empty():
				continue
			a["route"] = route
			a["targetKind"] = candidate["kind"]
			a["behavior"] = "patrol"
			_arrivals[id] = "sleep" if a["resting"] else "watch"
			return
	# A settled clear floor point is a valid last resort, but never in a doorway, on furniture or in someone's space.
	if _in_passage(a):
		return
	for boxes: Array in [_geometry.get(area, []), dynamic.get(area, [])]:
		for r: Dictionary in boxes:
			if CoreNavigation.segment_crosses_obstacle(a, a, _padded(r)):
				return
	a["route"] = []
	a["behavior"] = "sleep" if a["resting"] else "watch"
	a["remaining"] = 4.0
	a["elapsed"] = 0.0
	_arrivals.erase(id)


func _walk(a: Dictionary, dt: float, customers: Array, servers: Array, state: Dictionary) -> void:
	var id: String = a["id"]
	var personality: String = a["personality"]
	var target: Dictionary = a["route"][0]
	var dx: float = target["x"] - a["x"]
	var dy: float = target["y"] - a["y"]
	var distance := JsMath.js_hypot2(dx, dy)
	var step := JsMath.js_min(distance, dt * (25.0 if personality == "playful" else (15.0 if personality == "quiet" else 20.0)))
	var px: float = target["x"] if distance < 1e-8 else a["x"] + dx / distance * step
	var py: float = target["y"] if distance < 1e-8 else a["y"] + dy / distance * step
	# Yield without changing the service simulation or trapping guests behind a solid cat.
	for group: Array in [customers, servers]:
		for b: Dictionary in group:
			var near := JsMath.js_hypot2(b["x"] - px, b["y"] - py)
			if near < 9.0 and near < JsMath.js_hypot2(b["x"] - a["x"], b["y"] - a["y"]):
				var blocked: float = _blocked_seconds.get(id, 0.0) + dt
				_blocked_seconds[id] = blocked
				if blocked >= (1.0 if a["resting"] else 2.0):
					_recover_blocked_walk(a, state, customers, servers)
				return
	if step > 1e-8:
		_blocked_seconds[id] = 0.0
	if absf(dx) > 0.01:
		a["facing"] = -1.0 if dx < 0.0 else 1.0
	a["x"] = px
	a["y"] = py
	a["stride"] += step
	if distance <= step + 1e-8:
		a["route"].pop_front()
	if a["route"].is_empty():
		a["behavior"] = _arrivals.get(id, "watch")
		a["remaining"] = _duration(a["behavior"], _random.call()) * (2.0 if personality == "quiet" and a["behavior"] == "sleep" else 1.0)
		a["elapsed"] = 0.0
		_arrivals.erase(id)
		if _reselect_after_arrival.erase(id):
			a["behavior"] = "stretch"
			a["remaining"] = 0.1
		if a["resting"] and _in_passage(a):
			_recover_blocked_walk(a, state, customers, servers)
