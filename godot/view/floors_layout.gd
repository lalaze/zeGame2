class_name FloorsLayout
extends RefCounted

## Port of src/render/floors/floors-layout.ts: where the cross-section building puts the café's tables, counter,
## kitchen and staff, and how people walk between them. The rules keep their own floor plan; the view reads who is
## doing what from them and walks each person here to the matching spot, taking the stairs between floors.
##
## Points are pixels of their floor's plate, with the floor they are on: {"floor", "x", "y"}. Spots also have "aisle",
## the walkway they are reached from; steps may have "jump" (appears there: the far end of a flight of stairs) and
## "fadeOut" (leaves through it).

## Each floor's image and the plate rows it was cut from; the attic's picture carries the roof `above` them.
const FLOOR_ART := {
	"roof": {"image": "frame/attic", "top": 0.0, "height": 905.0, "above": 427.0},
	"floor-3": {"image": "floor-2", "top": 24.0, "height": 877.0},
	"floor-2": {"image": "floor-2", "top": 24.0, "height": 877.0},
	"ground": {"image": "floor-1", "top": 24.0, "height": 883.0},
	# Put together from what the kitchen holds (FloorsUpgrades).
	"basement": {"image": "upgrades/kitchen", "top": 30.0, "height": 911.0},
}
const WORLD_W := 1672.0
## The building's frame around its floors: the street under the ground floor, or with a basement a band of paving and
## earth over it and more earth under it.
const FRAME := {"street": 836.0, "soilBand": 150.0, "soilBelow": 420.0, "beam": 70.0, "pillar": 76.0}
## The awning hides the top of the ground floor's back wall, and the staff the part behind their heads: decor drawn
## there moves clear of them, by item. Only the part of its layer that holds the piece is drawn.
const _HUNG := {"x": 60.0, "y": 0.0, "w": 1245.0, "h": 300.0}
const _NEON := {"dx": -318.0, "dy": -10.0, "crop": {"x": 758.0, "y": 130.0, "w": 170.0, "h": 170.0}}
const GROUND_SHIFT := {
	"ceiling_lights": {"dx": 0.0, "dy": 76.0, "crop": _HUNG}, "ceiling_chandelier": {"dx": 0.0, "dy": 84.0, "crop": _HUNG},
	"neon_cafe": _NEON, "neon_heart": _NEON, "neon_cup": _NEON,
}
## Bottom up, so the stairs can be followed floor by floor.
const LEVELS: Array[String] = ["basement", "ground", "floor-2", "floor-3", "roof"]

## The ground floor's walkway between the counter and the tables; the basement's runs in front of the dough table.
const _GROUND_AISLE := 622.0
const _BASEMENT_AISLE := 786.0
## Where each floor's back and front walkways meet, by the stairs (and left of the dough table downstairs).
const _HUB_X := {"roof": 1330.0, "floor-3": 1288.0, "floor-2": 1288.0, "ground": 1350.0, "basement": 425.0}
## The front edge of a stairwell (plate row): what is below it of someone in the well is hidden by the floor.
const _WELL_EDGE := 752.0
## Where a seating floor's stairs, and their stairwell's balustrade alone, are on the plate. Who stands behind
## `railFoot` is behind the balustrade.
const STAIRS_HALL := {"x": 1288.0, "y": 47.0}
const STAIRS_RAIL := {"x": 1303.0, "y": 509.0, "railFoot": 626.0}
## Each floor's staircase up: its foot, its top, the open floor next to its foot, and the well the flight from below
## comes up in. People climb away from us in the well, from `inside`, deep in it, to its top step at `lip`, onto the
## landing (`on`) and off its open left end (`out`); they go down the same way.
const STAIRS := {
	"ground": {"foot": {"x": 1486.0, "y": 748.0}, "top": {"x": 1418.0, "y": 78.0}, "landing": {"floor": "ground", "x": 1350.0, "y": _GROUND_AISLE, "aisle": _GROUND_AISLE}},
	"floor-2": {"foot": {"x": 1556.0, "y": 757.0}, "top": {"x": 1440.0, "y": 78.0}, "landing": {"floor": "floor-2", "x": 1556.0, "y": 804.0, "aisle": 804.0},
		"well": {"inside": {"x": 1463.0, "y": 854.0}, "lip": {"x": 1378.0, "y": 546.0}, "on": {"x": 1372.0, "y": 510.0}, "out": {"floor": "floor-2", "x": 1288.0, "y": 510.0, "aisle": 630.0}}},
	"floor-3": {"foot": {"x": 1556.0, "y": 757.0}, "top": {"x": 1440.0, "y": 78.0}, "landing": {"floor": "floor-3", "x": 1556.0, "y": 804.0, "aisle": 804.0},
		"well": {"inside": {"x": 1463.0, "y": 854.0}, "lip": {"x": 1378.0, "y": 546.0}, "on": {"x": 1372.0, "y": 510.0}, "out": {"floor": "floor-3", "x": 1288.0, "y": 510.0, "aisle": 630.0}}},
}

## The front step, on the street just below the ground floor's front edge, between the two front tables.
const DOOR := {"floor": "ground", "x": 836.0, "y": 935.0, "aisle": _GROUND_AISLE}
## Where a supplier leaves a parcel: on the front step, beside the mat.
const PARCEL := {"floor": "ground", "x": 986.0, "y": 932.0}
## Today's menu on its board, on the street by the right-hand door: its foot below street level, and its size.
const BOARD := {"x": 1546.0, "y": 134.0, "w": 210.0, "h": 244.0}
## The middle of the blank hanging sign on the ground floor's front wall (pixels of frame/wall-ground), and its cup.
const SHOP_SIGN := {"x": 583.0, "y": 286.0, "cup": 92.0}
## Six places in line, the head nearest the till; the tail reaches towards the window seat.
const _QUEUE: Array = [[612.0, 606.0], [510.0, 608.0], [408.0, 610.0], [318.0, 614.0], [246.0, 598.0], [186.0, 584.0]]
## Behind the counter: the owner near the middle, then the hired baristas, staggered in depth and spacing.
const _BARISTAS: Array = [[758.0, 478.0], [1028.0, 452.0], [626.0, 464.0], [886.0, 458.0]]
## Where finished table orders wait for a server, and where idle servers stand.
const PASS := {"floor": "ground", "x": 1085.0, "y": 600.0, "aisle": _GROUND_AISLE}
const _SERVER_HOMES: Array = [
	["ground-display", "ground", 1288.0, 582.0, _GROUND_AISLE, true],
	["ground-left", "ground", 468.0, 548.0, _GROUND_AISLE, false],
	["ground-center", "ground", 714.0, 620.0, _GROUND_AISLE, false],
	["ground-pass", "ground", 1110.0, 550.0, _GROUND_AISLE, true],
	["ground-right", "ground", 958.0, 592.0, _GROUND_AISLE, true],
	["ground-tables", "ground", 1186.0, 622.0, _GROUND_AISLE, true],
]
const _FLOOR_2_HOMES: Array = [
	["floor-2-center", "floor-2", 804.0, 540.0, 630.0, false],
	["floor-2-stairs", "floor-2", 1378.0, 860.0, 875.0, true],
]
const _FLOOR_3_HOMES: Array = [
	["floor-3-center", "floor-3", 840.0, 546.0, 630.0, true],
	["floor-3-stairs", "floor-3", 1384.0, 856.0, 875.0, true],
]
## The counter, the cake display and what stands on them hide the staff from the waist down.
const COUNTER_FRONT := {"floor": "ground", "x": 0.0, "y": 525.0}
const STEAM := {"floor": "ground", "x": 1190.0, "y": 196.0}
const DISPLAY := {"floor": "ground", "left": 1095.0, "right": 1320.0, "top": 315.0, "bottom": 515.0}
## Dining tables with their chairs on each decorated floor's layers (layer-image pixels; plate y = y + FLOOR_ART[floor].top).
const _UPPER_TABLE_RECTS: Array = [
	{
		"x": 362.0, "y": 360.0, "w": 340.0, "h": 238.0, "fixturesY": 384.0, "seatY": 578.0,
		"exclude": [
			{"x": 450.0, "y": 384.0, "w": 42.0, "h": 16.0},
			{"x": 678.0, "y": 384.0, "w": 24.0, "h": 82.0},
			{"x": 634.0, "y": 590.0, "w": 68.0, "h": 8.0},
		],
	},
	{
		"x": 934.0, "y": 360.0, "w": 348.0, "h": 238.0, "fixturesY": 384.0, "seatY": 578.0,
		"exclude": [
			{"x": 1028.0, "y": 384.0, "w": 254.0, "h": 82.0},
			{"x": 934.0, "y": 590.0, "w": 78.0, "h": 8.0},
		],
	},
	{"x": 634.0, "y": 572.0, "w": 378.0, "h": 264.0, "fixturesY": 590.0, "seatY": 795.0},
]
const FLOOR_TABLES := {
	"ground": [
		{"x": 346.0, "y": 602.0, "w": 444.0, "h": 246.0, "seatY": 812.0},
		{"x": 904.0, "y": 602.0, "w": 420.0, "h": 246.0, "seatY": 812.0},
	],
	"floor-2": _UPPER_TABLE_RECTS,
	"floor-3": _UPPER_TABLE_RECTS,
}
const _BARISTA_IDLE_BEAT := 1.9
const _BARISTA_IDLE_CYCLE: Array[String] = [
	"RLBB", "RLBF", "RBBF", "RBBL", "RBLL",
	"FBLL", "FRLL", "BRLL", "BRRL", "BFRL",
	"BFRR", "BLRR", "FLRR", "FBRR", "LBRR",
	"LBFR", "LBBR", "FBBR", "FLBR", "FLBB",
]

static var QUEUE: Array = _QUEUE.map(func(p: Array) -> Dictionary: return _spot("ground", p[0], p[1], _GROUND_AISLE))
static var BARISTAS: Array = _BARISTAS.map(func(p: Array) -> Dictionary: return {"floor": "ground", "x": p[0], "y": p[1]})
## Where a guest orders from each barista.
static var SERVICE: Array = _BARISTAS.map(func(p: Array) -> Dictionary: return _spot("ground", p[0], 566.0, _GROUND_AISLE))
static var SERVER_HOMES: Array = _SERVER_HOMES.map(func(p: Array) -> Dictionary: return _server_spot(p))
static var _FLOOR_2_SERVER_HOMES: Array = _FLOOR_2_HOMES.map(func(p: Array) -> Dictionary: return _server_spot(p))
static var _FLOOR_3_SERVER_HOMES: Array = _FLOOR_3_HOMES.map(func(p: Array) -> Dictionary: return _server_spot(p))
## Every table's two seats, in the order the café opens them. The two back tables upstairs are reached from behind
## the front one, the front table from in front of it.
static var TABLES: Array = [
	[_seat("ground", 446.0, 812.0, false, _GROUND_AISLE), _seat("ground", 700.0, 815.0, true, _GROUND_AISLE)],
	[_seat("ground", 1001.0, 812.0, false, _GROUND_AISLE), _seat("ground", 1244.0, 815.0, true, _GROUND_AISLE)],
] + _upper_tables("floor-2") + _upper_tables("floor-3")

## Basement spots: the baker's oven and the cook's dough table, each with room for a second cook.
const LIFT := {"floor": "basement", "x": 1015.0, "y": 650.0, "aisle": _BASEMENT_AISLE}
const LIFT_HATCH := {"floor": "basement", "x": 1015.0, "y": 382.0}
const LIFT_TOP := {"floor": "basement", "x": 1015.0, "y": 70.0}
const OVEN_MOUTH := {"floor": "basement", "x": 362.0, "y": 362.0}
## The dough table hides whoever works behind it from the waist down.
const TABLE_FRONT := {"floor": "basement", "x": 0.0, "y": 746.0}
const _KITCHEN := {
	"oven": {"floor": "basement", "x": 428.0, "y": 690.0, "aisle": _BASEMENT_AISLE}, "dough": {"floor": "basement", "x": 690.0, "y": 612.0, "aisle": 612.0}, "lift": LIFT,
	"cold": {"floor": "basement", "x": 1280.0, "y": 720.0, "aisle": _BASEMENT_AISLE}, "dry": {"floor": "basement", "x": 280.0, "y": 770.0, "aisle": _BASEMENT_AISLE},
}
## Where the second and third cook at a place stand, from the first: one each side of them, or along the open floor.
const _COOK_SHIFT := {"oven": [0.0, -112.0, -212.0], "dough": [0.0, 118.0, -118.0], "lift": [0.0, 112.0, -112.0], "cold": [0.0, -112.0, 112.0], "dry": [0.0, 104.0, 208.0]}
## Where each cook waits for the next batch.
const _COOK_HOMES: Array[String] = ["oven", "dough", "lift"]

## View pixels a person walks per second of play, and how many times faster they go at most to keep up with the Sim.
const WALK := 240.0
const CATCH_UP := 3.6
## Someone the Sim has at their spot already still takes this long to come to a stop there, in seconds.
const _SETTLE := 1.0

const _SEATING_SPOTS := {
	"front-1": [156.0, 864.0, 190.0], "front-2": [346.0, 866.0, 188.0], "front-3": [540.0, 868.0, 190.0],
	"front-4": [1085.0, 866.0, 180.0], "front-5": [1252.0, 866.0, 140.0], "window": [230.0, 690.0, 200.0],
	"wall-1": {"x": 548.0, "y": 244.0, "w": 124.0, "h": 112.0}, "wall-2": {"x": 910.0, "y": 262.0, "w": 114.0, "h": 108.0}, "wall-3": {"x": 326.0, "y": 236.0, "w": 78.0, "h": 150.0},
}
const _SPOTS := {
	"ground": {
		"left": [272.0, 872.0, 168.0], "right": [1402.0, 874.0, 164.0],
		"wall-1": {"x": 590.0, "y": 108.0, "w": 166.0, "h": 100.0}, "wall-2": {"x": 770.0, "y": 108.0, "w": 180.0, "h": 100.0},
	},
	"floor-2": _SEATING_SPOTS,
	"floor-3": _SEATING_SPOTS,
	"roof": {
		"front-1": [425.0, 885.0, 190.0], "front-2": [615.0, 887.0, 180.0], "front-3": [1005.0, 885.0, 200.0], "back": [775.0, 566.0, 150.0],
		"wall-1": {"x": 392.0, "y": 256.0, "w": 200.0, "h": 108.0}, "wall-2": {"x": 738.0, "y": 250.0, "w": 112.0, "h": 108.0},
	},
}
## Where each of the building's furniture spots is on its floor's plate. A floor piece stands with its foot at x, y and
## may be `room` wide; a wall piece hangs in `box`.
static var FURNITURE_SPOTS: Array = _furniture_spots()
static var _spot_by_id: Dictionary = {}


static func _spot(floor_id: String, x: float, y: float, aisle: float) -> Dictionary:
	return {"floor": floor_id, "x": x, "y": y, "aisle": aisle}


static func _server_spot(p: Array) -> Dictionary:
	return {"id": p[0], "floor": p[1], "x": p[2], "y": p[3], "aisle": p[4], "faceLeft": p[5]}


## The idle home of server `i` in a building with `floors`.
static func server_home(i: int, floors: Array) -> Dictionary:
	var has2 := floors.has("floor-2")
	var has3 := floors.has("floor-3")
	var order: Array
	if has2 and has3:
		order = [SERVER_HOMES[0], SERVER_HOMES[1], _FLOOR_2_SERVER_HOMES[0], _FLOOR_3_SERVER_HOMES[0], _FLOOR_2_SERVER_HOMES[1], _FLOOR_3_SERVER_HOMES[1]]
	elif has2:
		order = [SERVER_HOMES[0], SERVER_HOMES[1], _FLOOR_2_SERVER_HOMES[0], SERVER_HOMES[2], _FLOOR_2_SERVER_HOMES[1], SERVER_HOMES[3]]
	else:
		order = SERVER_HOMES
	return order[i % order.size()]


## Non-overlapping rectangles covering a table's fixtures mask (`fixturesY..y+h` minus `exclude`).
static func table_mask_rects(table: Dictionary) -> Array:
	var top: float = table.get("fixturesY", table["y"])
	var rects: Array = [{"x": table["x"], "y": top, "w": table["w"], "h": table["y"] + table["h"] - top}]
	for ex: Dictionary in table.get("exclude", []):
		var next: Array = []
		var ex1: float = ex["x"] + ex["w"]
		var ey1: float = ex["y"] + ex["h"]
		for r: Dictionary in rects:
			var rx1: float = r["x"] + r["w"]
			var ry1: float = r["y"] + r["h"]
			var ix0 := maxf(r["x"], ex["x"])
			var iy0 := maxf(r["y"], ex["y"])
			var ix1 := minf(rx1, ex1)
			var iy1 := minf(ry1, ey1)
			if ix0 >= ix1 or iy0 >= iy1:
				next.append(r)
				continue
			if r["y"] < iy0:
				next.append({"x": r["x"], "y": r["y"], "w": r["w"], "h": iy0 - r["y"]})
			if iy1 < ry1:
				next.append({"x": r["x"], "y": iy1, "w": r["w"], "h": ry1 - iy1})
			if r["x"] < ix0:
				next.append({"x": r["x"], "y": iy0, "w": ix0 - r["x"], "h": iy1 - iy0})
			if ix1 < rx1:
				next.append({"x": ix1, "y": iy0, "w": rx1 - ix1, "h": iy1 - iy0})
		rects = next
	return rects


## Deterministic idle pose for barista `i` behind the counter at play time `clock`.
static func barista_idle_pose(i: int, clock: float) -> Dictionary:
	var step := posmod(int(floor(clock / _BARISTA_IDLE_BEAT)), _BARISTA_IDLE_CYCLE.size())
	var code := _BARISTA_IDLE_CYCLE[step][posmod(i, 4)]
	if code == "B":
		return {"pose": "back", "flip": false}
	if code == "F":
		return {"pose": "front", "flip": false}
	return {"pose": "side", "flip": code == "L"}


## A seat: where a seated guest's feet go and which way they face, towards their table.
static func _seat(floor_id: String, x: float, y: float, face_left: bool, aisle: float) -> Dictionary:
	return {"floor": floor_id, "x": x, "y": y, "aisle": aisle, "faceLeft": face_left}


static func _upper_tables(floor_id: String) -> Array:
	return [
		[_seat(floor_id, 448.0, 578.0, false, 630.0), _seat(floor_id, 628.0, 581.0, true, 630.0)],
		[_seat(floor_id, 1016.0, 578.0, false, 630.0), _seat(floor_id, 1204.0, 581.0, true, 630.0)],
		[_seat(floor_id, 706.0, 795.0, false, 875.0), _seat(floor_id, 930.0, 798.0, true, 875.0)],
	]


static func _furniture_spots() -> Array:
	return CoreBuildingSpots.BUILDING_SPOTS.map(func(spot: Dictionary) -> Dictionary:
		var id: String = spot["id"]
		var storey: String = spot["storey"]
		var where: Variant = _SPOTS[storey][id.substr(storey.length() + 1)]
		var out := spot.duplicate()
		out["floor"] = storey
		if where is Array:
			out.merge({"x": where[0], "y": where[1], "room": where[2]})
		else:
			out.merge({"x": where["x"] + where["w"] / 2.0, "y": where["y"] + where["h"] / 2.0, "room": where["w"], "box": where})
		return out)


static func furniture_spot(id: Variant) -> Variant:
	if _spot_by_id.is_empty():
		for spot: Dictionary in FURNITURE_SPOTS:
			_spot_by_id[spot["id"]] = spot
	return _spot_by_id.get(id)


# ---------------------------------------------------------------- the building

## The floors a café has: {"floors" top down, "offsets" where each floor's plate starts, "street" the street level,
## "height" of the whole picture}.
static func building(tables: float, kitchen: bool) -> Dictionary:
	var floors: Array = CoreBuildingSpots.storeys(tables)
	if kitchen:
		floors = floors + ["basement"]
	var offsets := {}
	var height: float = FLOOR_ART["roof"]["above"]
	var street := 0.0
	for floor_id: String in floors:
		if floor_id == "basement":
			height += FRAME["soilBand"]
		offsets[floor_id] = height
		height += FLOOR_ART[floor_id]["height"]
		if floor_id == "ground":
			street = height
	height += FRAME["soilBelow"] if kitchen else FRAME["street"]
	return {"floors": floors, "offsets": offsets, "street": street, "height": height}


## Where the camera rests, as the world y at the middle of a screen `view` tall: a building that fits between the
## page's bars is shown whole; a taller one with the street two thirds of the way down.
static func rest_focus(b: Dictionary, view: float) -> float:
	var margin := view * 0.1
	return view / 2.0 - margin if b["street"] + margin <= view * 0.88 else b["street"] - view * 0.18


static func world_point(b: Dictionary, p: Dictionary) -> Vector2:
	return Vector2(p["x"], world_y(b, p["floor"], p["y"]))


static func world_y(b: Dictionary, floor_id: String, y: float) -> float:
	return b["offsets"].get(floor_id, 0.0) + y - FLOOR_ART[floor_id]["top"]


## Whether someone is on the steps in a floor's stairwell.
static func in_well(p: Dictionary) -> bool:
	if not STAIRS.has(p["floor"]) or not STAIRS[p["floor"]].has("well"):
		return false
	var at: Dictionary = STAIRS[p["floor"]]["well"]
	var share: float = (p["y"] - at["lip"]["y"]) / (at["inside"]["y"] - at["lip"]["y"])
	return share > 0.002 and share < 1.01 and absf(p["x"] - at["lip"]["x"] - share * (at["inside"]["x"] - at["lip"]["x"])) < 3.0


## How much of someone in a stairwell its front edge hides, from their feet up; 0 for anyone else.
static func well_sink(p: Dictionary) -> float:
	return maxf(0.0, p["y"] - _WELL_EDGE) if in_well(p) else 0.0


static func stairs_of(floor_id: String) -> Variant:
	return STAIRS.get(floor_id)


# ---------------------------------------------------------------- tables and kitchen

## Where the café's next table goes: the middle of its two seats, or null once the building is full.
static func next_table_spot(tables: float) -> Variant:
	if tables < 0.0 or tables >= TABLES.size():
		return null
	var pair: Array = TABLES[int(tables)]
	return {"floor": pair[0]["floor"], "x": (pair[0]["x"] + pair[1]["x"]) / 2.0, "y": (pair[0]["y"] + pair[1]["y"]) / 2.0}


## The seats of the café's table with this index; the building gives each one a place in the order the café has them.
static func table_seats(table: float, active: Array) -> Array:
	return TABLES[maxi(0, active.find(table)) % TABLES.size()]


## Which part of the basement each of the Sim's kitchen stations is.
static func kitchen_place(station: String) -> String:
	if station in ["deckOven", "convection", "fryer", "kettle"]:
		return "oven"
	if station in ["mixer", "standMixer", "proofer", "bench", "sheeter"]:
		return "dough"
	if station in ["cooler", "pastryFridge"]:
		return "cold"
	return "dry" if station == "dryStore" else "lift"


## Cook `i` at a place: up to three cooks work side by side.
static func kitchen_spot(place: String, i: int) -> Dictionary:
	var at: Dictionary = _KITCHEN[place].duplicate()
	at["x"] += _COOK_SHIFT[place][i % 3]
	return at


static func cook_home(i: int) -> Dictionary:
	return kitchen_spot(_COOK_HOMES[i % 3], i / 3)


# ---------------------------------------------------------------- walking

## The walk across one floor: out to the walkway, along it (via the hub when walkways differ), and in.
static func _across(floor_id: String, from: Dictionary, from_aisle: float, to: Dictionary, to_aisle: float) -> Array:
	var points := [{"x": from["x"], "y": from_aisle}]
	if from_aisle != to_aisle:
		points.append_array([{"x": _HUB_X[floor_id], "y": from_aisle}, {"x": _HUB_X[floor_id], "y": to_aisle}])
	points.append_array([{"x": to["x"], "y": to_aisle}, to])
	var steps := []
	var last := from
	for p: Dictionary in points:
		if JsMath.js_hypot2(p["x"] - last["x"], p["y"] - last["y"]) < 1.0:
			continue
		steps.append({"floor": floor_id, "x": p["x"], "y": p["y"]})
		last = p
	return steps


static func _step(floor_id: String, p: Dictionary) -> Dictionary:
	return {"floor": floor_id, "x": p["x"], "y": p["y"]}


## The steps from where someone stands (on the walkway `from_aisle` of their floor) to a spot, taking the stairs when
## it is on another floor: up a flight to its top, and out of the well there; down into the well again.
static func route(from: Dictionary, from_aisle: float, to: Dictionary) -> Array:
	var a := LEVELS.find(from["floor"])
	var b := LEVELS.find(to["floor"])
	var steps := []
	var at := from
	var aisle := from_aisle
	var level := a
	while level != b:
		var floor_id := LEVELS[level]
		if b > a:
			var flight: Dictionary = STAIRS[floor_id]
			steps.append_array(_across(floor_id, at, aisle, flight["landing"], flight["landing"]["aisle"]))
			steps.append_array([_step(floor_id, flight["foot"]), _step(floor_id, flight["top"])])
			var next := LEVELS[level + 1]
			var arrival: Variant = STAIRS[next].get("well") if STAIRS.has(next) else null
			var into := _step(next, arrival["inside"] if arrival != null else flight["top"])
			into["jump"] = true
			steps.append(into)
			at = arrival["out"] if arrival != null else flight["top"]
			aisle = arrival["out"]["aisle"] if arrival != null else flight["top"]["y"]
			if arrival != null:
				steps.append_array([_step(next, arrival["lip"]), _step(next, arrival["on"]), _step(next, arrival["out"])])
		else:
			var here: Variant = STAIRS[floor_id].get("well") if STAIRS.has(floor_id) else null
			var below := LEVELS[level - 1]
			var flight: Dictionary = STAIRS[below]
			if here != null:
				steps.append_array(_across(floor_id, at, aisle, here["out"], here["out"]["aisle"]))
				steps.append_array([_step(floor_id, here["on"]), _step(floor_id, here["lip"]), _step(floor_id, here["inside"])])
			var out := _step(below, flight["top"])
			out["jump"] = true
			steps.append_array([out, _step(below, flight["foot"]), flight["landing"].duplicate()])
			at = flight["landing"]
			aisle = flight["landing"]["aisle"]
		level += 1 if b > a else -1
	steps.append_array(_across(to["floor"], at, aisle, to, to["aisle"]))
	if to.get("fadeOut", false) and not steps.is_empty():
		steps[-1]["fadeOut"] = true
	return steps


## How far is left to walk along the steps; appearing at the far end of a flight takes no walking.
static func steps_length(from: Dictionary, steps: Array) -> float:
	var length := 0.0
	var at := from
	for step: Dictionary in steps:
		if not step.get("jump", false):
			length += JsMath.js_hypot2(step["x"] - at["x"], step["y"] - at["y"])
		at = step
	return length


## How many times the walking speed someone goes with `left` pixels to walk, when the Sim has them there in `seconds`.
static func walk_pace(left: float, seconds: float) -> float:
	return minf(CATCH_UP, maxf(1.0, left / (WALK * maxf(_SETTLE, seconds))))
