class_name CoreNavigation
extends RefCounted

## Port of src/game/navigation.ts: pure, room-local walking geometry. Coordinates describe a walker's feet.
## Same arithmetic and same order of choices, on packed numbers; what only depends on the furniture is kept between calls.

const _EPSILON := 1e-7
const _UNKNOWN := 0
const _CLEAR := 1


static func _finite_point(p: Dictionary) -> bool:
	return is_finite(p["x"]) and is_finite(p["y"])


static func _finite_rect(r: Dictionary) -> bool:
	return _finite_point(r) and is_finite(r["w"]) and is_finite(r["h"])


static func _same(ax: float, ay: float, bx: float, by: float) -> bool:
	return absf(ax - bx) < _EPSILON and absf(ay - by) < _EPSILON


static func _contains(r: Dictionary, p: Dictionary) -> bool:
	return p["x"] >= r["x"] - _EPSILON and p["x"] <= r["x"] + r["w"] + _EPSILON and p["y"] >= r["y"] - _EPSILON and p["y"] <= r["y"] + r["h"] + _EPSILON


## A boundary tangent is clear; crossing any positive portion of the interior is not.
static func segment_crosses_obstacle(a: Dictionary, b: Dictionary, r: Dictionary) -> bool:
	if r["w"] <= 0.0 or r["h"] <= 0.0:
		return false
	return _crosses(a["x"], a["y"], b["x"], b["y"], r["x"] + _EPSILON, r["x"] + r["w"] - _EPSILON, r["y"] + _EPSILON, r["y"] + r["h"] - _EPSILON)


static func _crosses(ax: float, ay: float, bx: float, by: float, x0: float, x1: float, y0: float, y1: float) -> bool:
	var enter := 0.0
	var leave := 1.0
	var d := bx - ax
	if absf(d) < _EPSILON:
		if ax < x0 or ax > x1:
			return false
	else:
		var t1 := (x0 - ax) / d
		var t2 := (x1 - ax) / d
		if is_nan(t1) or is_nan(t2):
			return false
		enter = maxf(enter, minf(t1, t2))
		leave = minf(leave, maxf(t1, t2))
		if enter > leave:
			return false
	d = by - ay
	if absf(d) < _EPSILON:
		if ay < y0 or ay > y1:
			return false
	else:
		var t1 := (y0 - ay) / d
		var t2 := (y1 - ay) / d
		if is_nan(t1) or is_nan(t2):
			return false
		enter = maxf(enter, minf(t1, t2))
		leave = minf(leave, maxf(t1, t2))
	return enter <= leave


## The obstacles of one room, padded by the clearance, with the corners a route may turn at.
class Room:
	var bounds: Dictionary
	var count := 0
	# Padded boxes as the interior test uses them: low and high edges, each moved in by the epsilon.
	var x0 := PackedFloat64Array()
	var x1 := PackedFloat64Array()
	var y0 := PackedFloat64Array()
	var y1 := PackedFloat64Array()
	var rects: Array = []
	var corner_x := PackedFloat64Array()
	var corner_y := PackedFloat64Array()
	var sight := PackedByteArray()

	func _init(obstacles: Array, clearance: float, room_bounds: Dictionary) -> void:
		bounds = room_bounds
		for r: Dictionary in obstacles:
			if r["w"] > 0.0 and r["h"] > 0.0:
				var box := {"x": r["x"] - clearance, "y": r["y"] - clearance, "w": r["w"] + clearance * 2.0, "h": r["h"] + clearance * 2.0}
				rects.append(box)
				x0.append(box["x"] + _EPSILON)
				x1.append(box["x"] + box["w"] - _EPSILON)
				y0.append(box["y"] + _EPSILON)
				y1.append(box["y"] + box["h"] - _EPSILON)
		count = rects.size()
		# Corners inside another obstacle are not on the free-space boundary.
		for r: Dictionary in rects:
			var left: float = r["x"]
			var top: float = r["y"]
			var right: float = r["x"] + r["w"]
			var bottom: float = r["y"] + r["h"]
			_corner(left, top)
			_corner(right, top)
			_corner(left, bottom)
			_corner(right, bottom)
		sight.resize(corner_x.size() * corner_x.size())

	func _corner(x: float, y: float) -> void:
		if not bounds.is_empty() and not CoreNavigation._contains(bounds, {"x": x, "y": y}) or inside(x, y):
			return
		corner_x.append(x)
		corner_y.append(y)

	func inside(x: float, y: float) -> bool:
		for i in count:
			if x > x0[i] and x < x1[i] and y > y0[i] and y < y1[i]:
				return true
		return false

	func clear(ax: float, ay: float, bx: float, by: float) -> bool:
		var low_x := minf(ax, bx)
		var high_x := maxf(ax, bx)
		var low_y := minf(ay, by)
		var high_y := maxf(ay, by)
		for i in count:
			# Boxes the segment cannot touch; the exact test decides about the rest.
			if high_x < x0[i] - 0.001 or low_x > x1[i] + 0.001 or high_y < y0[i] - 0.001 or low_y > y1[i] + 0.001:
				continue
			if CoreNavigation._crosses(ax, ay, bx, by, x0[i], x1[i], y0[i], y1[i]):
				return false
		return true

	## Whether two corners see each other; remembered, since furniture rarely moves.
	func corners_clear(a: int, b: int) -> bool:
		var at := a * corner_x.size() + b
		if sight[at] == _UNKNOWN:
			sight[at] = _CLEAR if clear(corner_x[a], corner_y[a], corner_x[b], corner_y[b]) else 2
		return sight[at] == _CLEAR


static var _rooms: Dictionary = {}


static func _room(obstacles: Array, clearance: float, bounds: Dictionary) -> Room:
	var key := var_to_bytes([obstacles, clearance, bounds])
	var room: Variant = _rooms.get(key)
	if room == null:
		if _rooms.size() >= 24:
			_rooms.clear()
		room = Room.new(obstacles, clearance, bounds)
		_rooms[key] = room
	return room


## A shortest collision-free polyline in one room, after `from` and including `to`; null when there is none.
static func route_floor_segment(from: Dictionary, to: Dictionary, obstacles: Array, options: Dictionary = {}) -> Variant:
	var given: Variant = options.get("clearance")
	var clearance: float = given if JsUtil.is_number(given) else 3.0
	var bounds: Dictionary = options["bounds"] if options.get("bounds") is Dictionary else {}
	var bounded := not bounds.is_empty()
	if not _finite_point(from) or not _finite_point(to) or not is_finite(clearance) or clearance < 0.0:
		return null
	if bounded and (not _finite_rect(bounds) or bounds["w"] <= 0.0 or bounds["h"] <= 0.0):
		return null
	for r: Dictionary in obstacles:
		if not _finite_rect(r):
			return null
	if bounded and (not _contains(bounds, from) or not _contains(bounds, to)):
		return null
	if _same(from["x"], from["y"], to["x"], to["y"]):
		return []
	var start: Dictionary = options["startApproach"] if options.get("startApproach") is Dictionary else from
	var end: Dictionary = options["endApproach"] if options.get("endApproach") is Dictionary else to
	if not _finite_point(start) or not _finite_point(end) or bounded and (not _contains(bounds, start) or not _contains(bounds, end)):
		return null
	var room := _room(obstacles, clearance, bounds)
	var sx: float = start["x"]
	var sy: float = start["y"]
	var ex: float = end["x"]
	var ey: float = end["y"]
	if room.inside(sx, sy) or room.inside(ex, ey):
		return null
	# A chair portal exempts only the obstacle(s) that actually contain the chair.
	for i in room.count:
		if _crosses(from["x"], from["y"], sx, sy, room.x0[i], room.x1[i], room.y0[i], room.y1[i]) and not _contains(room.rects[i], from):
			return null
		if _crosses(ex, ey, to["x"], to["y"], room.x0[i], room.x1[i], room.y0[i], room.y1[i]) and not _contains(room.rects[i], to):
			return null
	var middle := []
	if _same(sx, sy, ex, ey):
		pass
	elif room.clear(sx, sy, ex, ey):
		middle = [end]
	else:
		var found: Variant = _around(room, sx, sy, ex, ey)
		if found == null:
			return null
		middle = found
	var result := []
	var px: float = from["x"]
	var py: float = from["y"]
	var points := [start]
	points.append_array(middle)
	points.append(end)
	points.append(to)
	for p: Dictionary in points:
		if not _same(px, py, p["x"], p["y"]):
			result.append({"x": p["x"], "y": p["y"]})
			px = p["x"]
			py = p["y"]
	return result


## Dijkstra over the corners, in the same order as TypeScript so that equal routes are settled the same way.
static func _around(room: Room, sx: float, sy: float, ex: float, ey: float) -> Variant:
	var x := PackedFloat64Array([sx, ex])
	var y := PackedFloat64Array([sy, ey])
	var corner := PackedInt32Array([-1, -1])
	for i in room.corner_x.size():
		var cx := room.corner_x[i]
		var cy := room.corner_y[i]
		var seen := false
		for v in x.size():
			if absf(x[v] - cx) < _EPSILON and absf(y[v] - cy) < _EPSILON:
				seen = true
				break
		if not seen:
			x.append(cx)
			y.append(cy)
			corner.append(i)
	var n := x.size()
	var distance := PackedFloat64Array()
	distance.resize(n)
	distance.fill(INF)
	var previous := PackedInt32Array()
	previous.resize(n)
	previous.fill(-1)
	var visited := PackedByteArray()
	visited.resize(n)
	distance[0] = 0.0
	while true:
		var current := -1
		var nearest := INF
		for i in n:
			if visited[i] == 0 and distance[i] < nearest:
				nearest = distance[i]
				current = i
		if current == -1:
			return null
		if current == 1:
			break
		visited[current] = 1
		var ax := x[current]
		var ay := y[current]
		var from_corner := corner[current]
		for next in n:
			if visited[next] != 0:
				continue
			var candidate := nearest + JsMath.js_hypot2(x[next] - ax, y[next] - ay)
			if candidate + _EPSILON >= distance[next]:
				continue
			var to_corner := corner[next]
			if not (room.corners_clear(from_corner, to_corner) if from_corner >= 0 and to_corner >= 0 else room.clear(ax, ay, x[next], y[next])):
				continue
			distance[next] = candidate
			previous[next] = current
	var middle := []
	var at := 1
	while at != 0:
		middle.append({"x": x[at], "y": y[at]})
		at = previous[at]
	middle.reverse()
	return middle
