class_name FloorsCatPlaces
extends RefCounted

## Port of src/render/floors/floors-cat-places.ts: where the café's cats live in the building, and how they get about:
## the places a cat sits, naps or watches from on each floor, the little paths between them, and which place suits
## which cat. Pure data and choices; FloorsCats draws the cats and walks them here.
##
## A cat's saved preferences are mapped onto the building: its preferred room becomes a floor, and its preferred spot a
## kind of place. Points are plate pixels of their floor, as in FloorsLayout. A place is {"id", "x", "y", "kind", "from",
## "hop"?, "naps"?, "behind"?, "floor"}; a step {"floor", "x", "y", "jump"?, "hop"?}.

## The poses of a breed's strip, in order.
const CAT_FRAMES: Array[String] = ["walk0", "walk1", "walk2", "walk3", "sit", "happy", "sleep", "groom"]
## Bottom up, the order the stairs join them. Cats keep out of the kitchen.
const CAT_FLOORS: Array[String] = ["ground", "floor-2", "floor-3", "roof"]

## The ground floor: cats keep to the walkway between the counter and the tables, and to the window seat.
const _GROUND := {
	"nodes": {"seat": [345.0, 628.0], "a1": [520.0, 628.0], "a2": [720.0, 628.0], "a3": [905.0, 628.0], "a4": [1120.0, 628.0], "land": [1350.0, 622.0]},
	"edges": [["seat", "a1"], ["a1", "a2"], ["a2", "a3"], ["a3", "a4"], ["a4", "land"]],
	"entry": "land",
	"places": [
		{"id": "window-seat", "x": 252.0, "y": 538.0, "kind": "window", "from": "seat", "hop": true, "naps": true},
		{"id": "queue", "x": 520.0, "y": 628.0, "kind": "explore", "from": "a1"},
		{"id": "counter", "x": 720.0, "y": 628.0, "kind": "people", "from": "a2"},
		{"id": "till", "x": 905.0, "y": 628.0, "kind": "people", "from": "a3"},
	],
}
## A seating floor: the sunny patch and the back tables on the left, the bookshelf side on the right, joined along the
## front edge. `land` is the open floor beside the stairwell's landing, `stairs` the foot of the flight up.
const _SEATING := {
	"nodes": {
		"sun": [322.0, 652.0], "mid": [556.0, 648.0], "fl": [322.0, 886.0], "fm": [560.0, 886.0], "fc": [830.0, 886.0], "fr": [1035.0, 886.0],
		"r0": [1035.0, 652.0], "books": [1196.0, 652.0], "land": [1288.0, 645.0], "sc": [1288.0, 886.0], "stairs": [1552.0, 836.0],
	},
	"edges": [["sun", "mid"], ["sun", "fl"], ["fl", "fm"], ["fm", "fc"], ["fc", "fr"], ["fr", "r0"], ["r0", "books"], ["books", "land"], ["land", "sc"], ["fr", "sc"], ["sc", "stairs"]],
	"entry": "stairs",
	"well": "land",
	"places": [
		{"id": "sun", "x": 322.0, "y": 652.0, "kind": "window", "from": "sun", "naps": true, "behind": ["window", "front-2"]},
		{"id": "tables", "x": 556.0, "y": 648.0, "kind": "people", "from": "mid", "behind": ["front-3"]},
		{"id": "front", "x": 830.0, "y": 886.0, "kind": "explore", "from": "fc"},
		{"id": "books", "x": 1196.0, "y": 652.0, "kind": "cozy", "from": "books", "naps": true, "behind": ["front-4"]},
	],
}
## The roof terrace: the cushion in the middle is the cats' bed, the terrace wall their lookout.
const _ROOF := {
	"nodes": {
		"door": [1490.0, 802.0], "p1": [1400.0, 862.0], "p2": [1150.0, 862.0], "t4": [1120.0, 800.0], "t3": [960.0, 800.0], "t2": [790.0, 800.0], "t1": [600.0, 800.0], "t0": [390.0, 800.0],
		"wall": [648.0, 700.0],
	},
	"edges": [["door", "p1"], ["p1", "p2"], ["p2", "t4"], ["t4", "t3"], ["t3", "t2"], ["t2", "t1"], ["t1", "t0"], ["t1", "wall"]],
	"entry": "door",
	"places": [
		{"id": "cushion", "x": 792.0, "y": 690.0, "kind": "bed", "from": "t2", "hop": true, "naps": true},
		{"id": "wall", "x": 668.0, "y": 380.0, "kind": "window", "from": "wall", "hop": true},
		{"id": "wall-2", "x": 588.0, "y": 380.0, "kind": "window", "from": "wall", "hop": true},
		{"id": "planter", "x": 390.0, "y": 800.0, "kind": "cozy", "from": "t0", "naps": true, "behind": ["front-1"]},
		{"id": "terrace", "x": 960.0, "y": 800.0, "kind": "explore", "from": "t3", "behind": ["front-3"]},
	],
}
const _PATHS := {"ground": _GROUND, "floor-2": _SEATING, "floor-3": _SEATING, "roof": _ROOF}
## The path node a cat gets to a cat bed from, at each spot of a floor (none: out of a cat's reach).
const _SEATING_BEDS := {"window": "sun", "front-1": "fl", "front-2": "fl", "front-3": "fm", "front-4": "fr", "front-5": "sc"}
const _BED_FROM := {
	"ground": {"left": "seat"}, "floor-2": _SEATING_BEDS, "floor-3": _SEATING_BEDS,
	"roof": {"front-1": "t0", "front-2": "t1", "front-3": "t3", "back": "wall"},
}
## How far above a piece's foot a cat lies in it.
const _BED_RISE := 16.0
## The floors a preferred room of the pixel café stands for, best first.
const _AREA_FLOORS := {
	"main": ["ground"], "reading": ["floor-2", "floor-3", "ground"], "workshop": ["floor-3", "floor-2", "ground"],
	"greenhouse": ["roof"], "terrace": ["roof"], "observatory": ["roof"],
}
## The kinds of place a preferred spot stands for.
const _SPOT_KINDS := {"cozy": ["cozy", "bed"], "window": ["window"], "explore": ["explore", "people"]}
## Where the gifts cats leave wait to be picked up, by their spot: on the ground floor's window seat, on the step at its
## foot, and on the terrace wall.
const GIFT_PLACES: Array = [{"floor": "ground", "x": 204.0, "y": 548.0}, {"floor": "ground", "x": 298.0, "y": 624.0}, {"floor": "roof", "x": 760.0, "y": 382.0}]
const _PLANS: Array[String] = ["roam", "nap", "groom", "watch"]
## How a cat of each personality spends its time.
const _PLAN_WEIGHTS := {"playful": [7.0, 1.0, 3.0, 3.0], "quiet": [1.0, 7.0, 3.0, 4.0], "affectionate": [4.0, 2.0, 3.0, 7.0]}
## Seconds a cat stays at each plan before choosing again; a quiet cat naps twice as long.
const _PLAN_SECONDS := {"roam": 7.0, "nap": 30.0, "groom": 7.0, "watch": 14.0}


static func _node_id(floor_id: String, node: String) -> String:
	return "%s/%s" % [floor_id, node]


static func _floor_of(id: String) -> String:
	return id.get_slice("/", 0)


## A path node as a point of its floor.
static func cat_node(id: String) -> Dictionary:
	var floor_id := _floor_of(id)
	var at: Array = _PATHS[floor_id]["nodes"][id.substr(floor_id.length() + 1)]
	return {"floor": floor_id, "x": at[0], "y": at[1]}


## The node at a floor's stairs, and the one where the flight from below comes up: by its stairwell, or the roof's door.
static func cat_entry(floor_id: String) -> String:
	return _node_id(floor_id, _PATHS[floor_id]["entry"])


static func cat_arrival(floor_id: String) -> String:
	return _node_id(floor_id, _PATHS[floor_id].get("well", _PATHS[floor_id]["entry"]))


## The floors of a building cats use, bottom up.
static func cat_floors(floors: Array) -> Array:
	return CAT_FLOORS.filter(func(f: String) -> bool: return floors.has(f))


## The places cats can use now: those of the floors the building has, less any a placed piece of furniture stands in
## front of, plus every cat bed the player has put out. `pieces` maps a spot to the piece standing there.
static func cat_places(floors: Array, pieces: Dictionary = {}) -> Array:
	var places := []
	for floor_id: String in cat_floors(floors):
		for place: Dictionary in _PATHS[floor_id]["places"]:
			var hidden := false
			for spot: String in place.get("behind", []):
				hidden = hidden or pieces.has("%s-%s" % [floor_id, spot])
			if hidden:
				continue
			var out := place.duplicate()
			out["id"] = _node_id(floor_id, place["id"])
			out["from"] = _node_id(floor_id, place["from"])
			out["floor"] = floor_id
			places.append(out)
	for id: String in pieces:
		var spot: Variant = FloorsLayout.furniture_spot(id)
		if spot == null or pieces[id] != "catbed" or not floors.has(spot["floor"]):
			continue
		var from: Variant = _BED_FROM[spot["floor"]].get(id.substr(spot["floor"].length() + 1))
		if from == null:
			continue
		places.append({"id": _node_id(spot["floor"], "bed-%s" % id), "floor": spot["floor"], "x": spot["x"], "y": spot["y"] - _BED_RISE, "kind": "bed",
			"from": _node_id(spot["floor"], from), "hop": true, "naps": true})
	return places


# ---------------------------------------------------------------- preferences

## The floor of this building a cat calls home: the first its preferred room maps to that exists.
static func home_floor(area: String, floors: Array) -> String:
	for floor_id: String in _AREA_FLOORS[area]:
		if floors.has(floor_id):
			return floor_id
	return "ground"


## The room name the pet panel shows for a floor.
static func floor_area(floor_id: String) -> String:
	return "terrace" if floor_id == "roof" else ("main" if floor_id == "ground" or floor_id == "basement" else "reading")


## How well a place suits a cat: its home floor first, then its kind of spot, then a real bed.
static func place_rank(place: Dictionary, prefs: Dictionary, floors: Array) -> float:
	return ((8.0 if place["floor"] == home_floor(prefs["preferredArea"], floors) else 0.0)
		+ (4.0 if _SPOT_KINDS[prefs["preferredSpot"]].has(place["kind"]) else 0.0) + (2.0 if place["kind"] == "bed" else 0.0))


static func choose_plan(personality: String, random: float) -> String:
	var weights: Array = _PLAN_WEIGHTS[personality]
	var value := maxf(0.0, minf(0.999999, random)) * float(weights.reduce(func(sum: float, w: float) -> float: return sum + w, 0.0))
	var index := 0
	while index < weights.size() - 1:
		value -= weights[index]
		if value < 0.0:
			break
		index += 1
	return _PLANS[index]


static func plan_seconds(plan: String, personality: String, random: float) -> float:
	return _PLAN_SECONDS[plan] * (0.8 + random * 0.7) * (2.0 if plan == "nap" and personality == "quiet" else 1.0)


## The place a cat goes to for a plan, from those free now (never where it already is), or null:
## - a nap is taken at the best-suited place soft enough for one;
## - watching is done from a window, or by an affectionate cat that isn't a window-watcher, among people;
## - roaming takes a playful cat anywhere, and others to one of the four places that suit them best.
## Without a fitting place the plan falls back to the best-suited free one.
static func choose_place(plan: String, prefs: Dictionary, free: Array, floors: Array, at: Variant, random: Callable) -> Variant:
	var ranked: Array = free.filter(func(place: Dictionary) -> bool: return not (at is String and place["id"] == at))
	ranked = JsUtil.stable_sort(ranked, func(a: Dictionary, b: Dictionary) -> float: return place_rank(b, prefs, floors) - place_rank(a, prefs, floors))
	if ranked.is_empty():
		return null
	if plan == "nap":
		var beds := ranked.filter(func(place: Dictionary) -> bool: return place.get("naps", false))
		return _pick(beds, 1 if prefs["personality"] == "quiet" else 2, random) if not beds.is_empty() else ranked[0]
	if plan == "watch":
		var people: bool = prefs["personality"] == "affectionate" and prefs["preferredSpot"] != "window" and random.call() < 0.7
		var spots := ranked.filter(func(place: Dictionary) -> bool: return place["kind"] == ("people" if people else "window"))
		return _pick(spots, 2, random) if not spots.is_empty() else ranked[0]
	return _pick(ranked, ranked.size() if prefs["personality"] == "playful" else 4, random)


static func _pick(list: Array, among: int, random: Callable) -> Dictionary:
	return list[int(floor(maxf(0.0, minf(0.999999, random.call())) * mini(among, list.size())))]


# ---------------------------------------------------------------- routes

## The nodes from one node of a floor to another, along its paths (both ends included).
static func _along(from: String, to: String) -> Array:
	var floor_id := _floor_of(from)
	var links := {}
	for edge: Array in _PATHS[floor_id]["edges"]:
		var a := _node_id(floor_id, edge[0])
		var b := _node_id(floor_id, edge[1])
		links.get_or_add(a, []).append(b)
		links.get_or_add(b, []).append(a)
	var came := {from: null}
	var queue := [from]
	while not queue.is_empty():
		var node: String = queue.pop_front()
		if node == to:
			break
		for next: String in links.get(node, []):
			if not came.has(next):
				came[next] = node
				queue.append(next)
	if not came.has(to):
		return [from]
	var path := []
	var at: Variant = to
	while at != null:
		path.push_front(at)
		at = came[at]
	return path


static func _walk(steps: Array, from: String, goal: String) -> void:
	for node: String in _along(from, goal).slice(1):
		steps.append(cat_node(node))


static func _at(floor_id: String, p: Dictionary) -> Dictionary:
	return {"floor": floor_id, "x": p["x"], "y": p["y"]}


## The steps from a path node to a place: along the floor's paths, by the stairs to another floor, and off the path to
## the place itself. A cat on a raised place first jumps down to the node it came by.
static func cat_route(from_node: String, to: Dictionary, floors: Array) -> Array:
	var levels := cat_floors(floors)
	var steps := []
	var node := from_node
	var level := levels.find(_floor_of(from_node))
	var target := levels.find(to["floor"])
	if level < 0 or target < 0:
		return []
	while level != target:
		var here: String = levels[level]
		var up := target > level
		var next: String = levels[level + (1 if up else -1)]
		# To the stairs: the foot of the flight up, or the well (or the roof's door) the one below comes up in.
		_walk(steps, node, cat_entry(here) if up else cat_arrival(here))
		if up:
			steps.append_array([_at(here, FloorsLayout.STAIRS[here]["foot"]), _at(here, FloorsLayout.STAIRS[here]["top"])])
			var arrival: Variant = FloorsLayout.STAIRS[next].get("well") if FloorsLayout.STAIRS.has(next) else null
			node = cat_arrival(next)
			if arrival != null:
				var into := _at(next, arrival["inside"])
				into["jump"] = true
				steps.append_array([into, _at(next, arrival["lip"]), _at(next, arrival["on"]), _at(next, arrival["out"]), cat_node(node)])
			else:
				var into := cat_node(node)
				into["jump"] = true
				steps.append(into)
		else:
			var leaving: Variant = FloorsLayout.STAIRS[here].get("well") if FloorsLayout.STAIRS.has(here) else null
			var flight: Dictionary = FloorsLayout.STAIRS[next]
			if leaving != null:
				steps.append_array([_at(here, leaving["out"]), _at(here, leaving["on"]), _at(here, leaving["lip"]), _at(here, leaving["inside"])])
			node = cat_entry(next)
			var out := _at(next, flight["top"])
			out["jump"] = true
			steps.append_array([out, _at(next, flight["foot"]), cat_node(node)])
		level += 1 if up else -1
	_walk(steps, node, to["from"])
	var last: Dictionary = steps[-1] if not steps.is_empty() else cat_node(from_node)
	if JsMath.js_hypot2(last["x"] - to["x"], last["y"] - to["y"]) >= 1.0 or last["floor"] != to["floor"]:
		var end := _at(to["floor"], to)
		if to.has("hop"):
			end["hop"] = to["hop"]
		steps.append(end)
	return steps
