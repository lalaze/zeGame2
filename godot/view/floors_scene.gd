class_name FloorsScene
extends Node2D

## The café drawn as the cross-section building: port of src/render/floors/floors-scene.ts. Nothing here decides
## anything: each frame it reads who is doing what from the rules and walks each person to the matching spot of
## FloorsLayout. The rules' own floor plan is shorter than the stairs here, so people walk faster the further they have
## to go, to arrive about when the rules do.

## What a tap landed on: {"kind": "moment" | "partner" | "cat" | "gift" | "cafe", "id"?}.
signal tapped(target: Dictionary)
## While arranging: a piece was picked (its index), or a spot for the piece in hand (its id).
signal piece_tapped(index: int)
signal spot_tapped(id: String)
## The player opened the building's front walls by touching them.
signal wall_opened

const _SIDE := {"walk": [0, 1, 2, 3], "front": 4, "happy": 5, "side": 6, "back": 7}
const _MOVES := {"down": [0, 1, 2, 3], "up": [4, 5, 6, 7], "sit": 8, "hold": 9, "sip": 10, "laugh": 11}
const _DECOR_FLOORS := {"ground": "1f", "floor-2": "2f", "floor-3": "2f"}
## Wall furniture hangs between the shadows and the fixtures.
const _WALL_FURNITURE_DEPTH := FloorsArt.LAYER_DEPTH + FloorsArt.LAYER_STEP * (5.0 - 0.4)
## These four general looks stand in for a guest's own look while it loads.
const GUEST_ART: Array[String] = ["guest-beret", "guest-hoodie", "guest-cardigan", "guest-curls"]
## How long a new guest waits unseen at the door for their own look before borrowing one.
const _LOOK_WAIT := 2.0
## The frame's colours where its pictures end.
const _STREET_EDGE := Color8(0x65, 0x6c, 0x34)
const _SOIL_EDGE := Color8(0x65, 0x36, 0x2b)
## Floors with a stairwell, where the flight from below comes up beside their own.
const _HALL_FLOORS: Array[String] = ["floor-2", "floor-3"]
## Where the roof's slopes reach the sides, below the top floor's plate top.
const _EAVE := 123.0
## The ground floor's open front: the awning tucks under the beam.
const _AWNING_TOP := 18.0
const _AWNING_HEIGHT := 84.0
const _SIDE_WINDOW := {"floor": "ground", "x": 0.0, "y": 40.0}
const _WALLS := {"roof": "frame/wall-attic", "floor-3": "frame/wall-seating", "floor-2": "frame/wall-seating", "ground": "frame/wall-ground"}
## How much faster than at a stroll their legs move at most, however fast the player runs the day.
const _LEGS := 3.0
const _WALK_RATE := FloorsLayout.WALK / 30.0
## How far past its ends the building can be dragged, as a share of the screen.
const _OVERSCROLL := 1.0 / 3.0
## Screen pixels a press may move and still be a tap, and how far around a target touches count.
const _TAP_SLOP := 10.0
const _REACH := 22.0


## One walker.
class Actor extends RefCounted:
	var pic: FloorsPic
	var art: String
	var at: Dictionary
	## The walkway of the floor the actor is standing on, for the next route.
	var aisle: float
	var steps: Array = []
	## What the steps lead to; a new goal plans a new route.
	var goal: String
	var cup: FloorsPic = null
	var clock := 0.0
	var seen := true
	## How many times a stroll they are walking at now; their legs keep up.
	var rate := 1.0
	## How much of them a stairwell's front edge hides, from their feet up.
	var sunk := 0.0
	## The guest's own look while it loads; `art` stands in meanwhile.
	var wants := ""


var library: FloorsLibrary
var feed: FloorsFeed
var session: CoreGameSession
var built: Dictionary = {}
var upgrades: FloorsUpgrades
var sky: FloorsSky
var props: FloorsProps
var front: FloorsFront
var thoughts: FloorsThoughts
var cats: FloorsCats
var staff: FloorsStaff
var customers: Dictionary = {}
var servers: Array[Actor] = []
var cooks: Array[Actor] = []
var baristas: Array[FloorsPic] = []
## The cue bobbing over the waiting moment, once there has been one.
var cue: FloorsPic = null
## World y at the middle of the screen, and whether the player moved the camera from where it rests.
var focus_y := 0.0
var moved := false
var zoom := 1.0
var screen := Vector2(412, 915)
## Seconds since the scene began, whether the game is paused or not.
var now := 0.0
## How far the walls have faded in, 0 (open) to 1 (closed).
var wall_alpha := 0.0
var walls: Array[FloorsPic] = []
var arranging := false
var _floor_pics: Array[FloorsPic] = []
var _decor_signature := ""
var _placed: Array = []
var _placed_signature := ""
var _free_spots: FloorsMarks
var _free_signature := ""
var _ghost_mark: FloorsMarks
var _ghost_pic: FloorsPic = null
var _ghost_shown := ""
var _table_mark: FloorsMarks = null
var _table_label: FloorsText = null
var _earth: FloorsPic
var _earth_colour := _STREET_EDGE
var _sky_pic: FloorsPic
var _street: FloorsPic
var _soil_band: FloorsPic
var _soil_below: FloorsPic
var _frame_parts: Array[FloorsPic] = []
var _open_doors: Array[FloorsPic] = []
var _counter_front: FloorsPic
var _table_front: FloorsPic
var _glow: FloorsPic
var _calling: Array[bool] = []
var _moods: Dictionary = {}
var _rack: Variant = null
var _steam := 0.0
var _tempo := 1.0
var _rng := RandomNumberGenerator.new()
## A number in [0, 1) for choices people would notice; tests set it.
var random: Callable = _rng.randf
var _dragging := false
var _pressed_at := Vector2.ZERO
var _press_moved := false


func setup(lib: FloorsLibrary, core: CoreGameSession, told: FloorsFeed) -> void:
	library = lib
	session = core
	feed = told
	y_sort_enabled = true
	FloorsTextures.make(library)
	# The frame's rectangles of plain colour.
	_earth = pic("plain", 0, Vector2.ZERO, FloorsDepth.EARTH)
	_earth.stretch = Vector2(FloorsLayout.WORLD_W, 4000.0) / 8.0
	_sky_pic = pic("frame/sky", 0, Vector2(0.0, 1.0), FloorsDepth.SKY)
	sky = FloorsSky.new(self, _sky_pic)
	_street = pic("frame/street", 0, Vector2.ZERO, FloorsDepth.EARTH)
	# The street cut open over a basement: its paving and the top of the earth, then earth under the basement.
	_soil_band = pic("frame/soil", 0, Vector2.ZERO, FloorsDepth.EARTH)
	_soil_band.crop = Rect2(0.0, 0.0, FloorsLayout.WORLD_W, FloorsLayout.FRAME["soilBand"])
	_soil_below = pic("frame/soil", 0, Vector2.ZERO, FloorsDepth.EARTH)
	_soil_below.crop = Rect2(0.0, FloorsLayout.FRAME["soilBand"], FloorsLayout.WORLD_W, FloorsLayout.FRAME["soilBelow"])
	_counter_front = pic("counter-front", 0, Vector2.ZERO, 0.0)
	upgrades = FloorsUpgrades.new(library)
	upgrades.update_kitchen(state())
	_table_front = pic(FloorsUpgrades.TABLE, 0, Vector2.ZERO, 0.0)
	_free_spots = FloorsMarks.new()
	_free_spots.depth = FloorsDepth.MARKS
	add_child(_free_spots)
	_ghost_mark = FloorsMarks.new()
	_ghost_mark.depth = FloorsDepth.MARKS + 10.0
	add_child(_ghost_mark)
	_glow = pic("glow", 0, Vector2(0.5, 0.5), 1.0)
	_glow.blend(CanvasItemMaterial.BLEND_MODE_ADD)
	_glow.visible = false
	# What the first frame shows, so that nothing pops in.
	for p: Dictionary in state()["decor"]["placed"]:
		if library.furniture.has(p["id"]):
			library.texture(furniture_key(p["id"]))
	for pet: Dictionary in state()["pets"]:
		if library.cats["cats"].has(pet["id"]):
			library.texture("cats/%s" % pet["id"])
	for kind: String in library.cats["gifts"]:
		library.texture("cats/gift-%s" % kind)
	staff = FloorsStaff.new(library)
	props = FloorsProps.new(self)
	thoughts = FloorsThoughts.new(self)
	front = FloorsFront.new(self)
	cats = FloorsCats.new(self)


func state() -> Dictionary:
	return session.state


func sim() -> CoreSim:
	return session.sim


## A picture in the building.
func pic(key: String, frame: Variant = 0, origin: Vector2 = Vector2(0.5, 1.0), depth: float = 0.0, at: Vector2 = Vector2.ZERO) -> FloorsPic:
	var p := FloorsPic.new(library, key, frame)
	p.origin = origin
	p.depth = depth
	p.place = at
	add_child(p)
	return p


func words(text: String, size: float, colour: Color, depth: float, at: Vector2, outline: float = 0.0, outline_colour: Color = Color.WHITE) -> FloorsText:
	var w := FloorsText.new(text, size, colour, outline, outline_colour)
	w.depth = depth
	w.place = at
	add_child(w)
	return w


# ---------------------------------------------------------------- the frame

## The building's frame: the sky behind the roof, a pillar down each side from the eaves to the street, a beam over each
## join between floors, and the street, or with a basement the street cut open over it and the earth around it.
func _layout_frame(b: Dictionary) -> void:
	for part in _frame_parts:
		part.queue_free()
	_frame_parts.clear()
	var offsets: Dictionary = b["offsets"]
	var eave: float = offsets.get("roof", 0.0) + _EAVE
	_sky_pic.place.y = eave + 120.0
	_tile_pillar(eave, b["street"], 0.0, false)
	_tile_pillar(eave, b["street"], FloorsLayout.WORLD_W - FloorsLayout.FRAME["pillar"], true)
	# A beam over each join above the street.
	for floor_id: String in b["floors"].slice(1):
		if floor_id != "basement":
			var beam := _frame("frame/beam", Vector2(0.0, 0.5), FloorsDepth.FRAME - 1.0, Vector2(0.0, offsets[floor_id]))
			beam.stretch = Vector2(FloorsLayout.WORLD_W, FloorsLayout.FRAME["beam"]) / beam.size
	# The ground floor's open front: awning, folded-back doors at its corners, the step guests come in by.
	var ground: float = offsets.get("ground", 0.0)
	var pillar: float = FloorsLayout.FRAME["pillar"]
	var awning := _frame("frame/awning", Vector2.ZERO, FloorsDepth.FRAME - 2.0, Vector2(pillar, ground + _AWNING_TOP))
	awning.stretch = Vector2(FloorsLayout.WORLD_W - 2.0 * pillar, _AWNING_HEIGHT) / awning.size
	_open_doors = [
		_frame("frame/door-left", Vector2(0.0, 1.0), FloorsDepth.FRAME - 2.0, Vector2(pillar, b["street"])),
		_frame("frame/door-right", Vector2(1.0, 1.0), FloorsDepth.FRAME - 2.0, Vector2(FloorsLayout.WORLD_W - pillar, b["street"])),
	]
	_frame("frame/step", Vector2(0.5, 0.0), b["street"] - 1.0, Vector2(FloorsLayout.DOOR["x"], b["street"] - 16.0))
	# The old side door is a window now, drawn over the decor's wall and floor, under its tables.
	_frame("frame/side-window", Vector2.ZERO, FloorsArt.LAYER_DEPTH + FloorsArt.LAYER_STEP * (FloorsArt.BACK_LAYERS.find("fixtures") + 0.5),
		Vector2(_SIDE_WINDOW["x"], FloorsLayout.world_point(b, _SIDE_WINDOW).y))
	# The front walls; underground, the basement is hidden in the earth.
	walls.clear()
	for floor_id: String in b["floors"]:
		var y: float = offsets[floor_id]
		if _WALLS.has(floor_id):
			walls.append(_frame(_WALLS[floor_id], Vector2.ZERO, FloorsDepth.WALL, Vector2(0.0, y - FloorsLayout.FLOOR_ART[floor_id].get("above", 0.0))))
			continue
		# The soil picture below its paving, stretched over the basement and the earth under it.
		var soil := _frame("frame/soil", Vector2.ZERO, FloorsDepth.WALL, Vector2.ZERO)
		var band: float = FloorsLayout.FRAME["soilBand"]
		var rows: float = soil.size.y - band
		var taller: float = (FloorsLayout.FLOOR_ART[floor_id]["height"] + FloorsLayout.FRAME["soilBelow"]) / rows
		soil.crop = Rect2(0.0, band, FloorsLayout.WORLD_W, rows)
		soil.stretch = Vector2(1.0, taller)
		soil.place = Vector2(0.0, y - band * taller)
		walls.append(soil)
	_show_walls(0.0)
	var cellar := offsets.has("basement")
	_street.place.y = b["street"]
	_street.visible = not cellar
	_soil_band.place.y = b["street"]
	_soil_band.visible = cellar
	_soil_below.visible = cellar
	if cellar:
		_soil_below.place.y = offsets["basement"] + FloorsLayout.FLOOR_ART["basement"]["height"] - FloorsLayout.FRAME["soilBand"]
	_earth.place.y = b["height"]
	_earth_colour = _SOIL_EDGE if cellar else _STREET_EDGE
	_earth.tint = _earth_colour
	front.layout(b)
	var outside: Array[FloorsPic] = [_street, _soil_band, _soil_below]
	outside.append_array(_frame_parts)
	sky.layout(b, outside, walls, _earth, _earth_colour)


func _frame(key: String, origin: Vector2, depth: float, at: Vector2) -> FloorsPic:
	var part := pic(key, 0, origin, depth, at)
	_frame_parts.append(part)
	return part


## A pillar's picture, repeated down to the street.
func _tile_pillar(from: float, to: float, x: float, mirrored: bool) -> void:
	var y := from
	while y < to:
		var part := _frame("frame/pillar", Vector2.ZERO, FloorsDepth.FRAME, Vector2(x, y))
		part.flip = mirrored
		if y + part.size.y > to:
			part.crop = Rect2(0.0, 0.0, part.size.x, to - y)
		y += part.size.y


## Fades the front walls towards the player's choice: closed seen from the street, open while arranging furniture.
func _show_walls(dt: float) -> void:
	var target := 1.0 if feed.outer_wall and not arranging else 0.0
	if dt > 0.0:
		wall_alpha = lerpf(wall_alpha, target, minf(1.0, dt * 8.0))
	if absf(wall_alpha - target) < 0.01:
		wall_alpha = target
	for wall in walls:
		wall.alpha = wall_alpha
		wall.visible = wall_alpha > 0.0
	for door in _open_doors:
		door.alpha = 1.0 - wall_alpha


## Someone out on the street, in front of the ground floor, stands in front of the building's front walls.
func _depth_at(p: Dictionary) -> float:
	if FloorsLayout.in_well(p):
		return FloorsArt.IN_WELL_DEPTH
	var y := FloorsLayout.world_point(built, p).y
	return y + FloorsDepth.FRAME if p["floor"] == "ground" and y > built["street"] else y


# ---------------------------------------------------------------- the camera

func resized(size: Vector2) -> void:
	screen = size
	_frame_camera()


## The part of the building on screen, in world pixels.
func view() -> Rect2:
	var height := screen.y / zoom
	return Rect2(0.0, focus_y - height / 2.0, screen.x / zoom, height)


func _frame_camera() -> void:
	zoom = screen.x / FloorsLayout.WORLD_W
	if built.is_empty():
		return
	var tall := screen.y / zoom
	var half := tall / 2.0
	var rest := FloorsLayout.rest_focus(built, tall)
	if not moved:
		focus_y = rest
	# The building can be dragged a third of a screen up into the sky, and down to its bottom.
	var slack := tall * _OVERSCROLL
	var low := minf(rest, half) - slack
	var high := maxf(rest, built["height"] - half) + slack / 3.0
	focus_y = maxf(low, minf(high, focus_y))
	scale = Vector2(zoom, zoom)
	position = Vector2(0.0, screen.y / 2.0 - focus_y * zoom)


## The camera goes to a height in the building; `dt` glides there.
func focus_on(y: float, dt: float = 0.0) -> void:
	moved = true
	focus_y = lerpf(focus_y, y, minf(1.0, dt * 6.0)) if dt > 0.0 else y
	_frame_camera()


func scroll(pixels: float) -> void:
	focus_y -= pixels / zoom
	moved = true
	_frame_camera()


# ---------------------------------------------------------------- the floors

## The layers a decorated floor draws with this decor on: {"key", "front", "order"}.
func decor_layers(kind: String, equipped: Dictionary) -> Array:
	var entry: Dictionary = library.decor.get(kind, {})
	var out := []
	for side: Array in [["back", FloorsArt.BACK_LAYERS], ["front", FloorsArt.FRONT_LAYERS]]:
		for order in side[1].size():
			var name: String = side[1][order]
			var key := ""
			for fixed: String in entry[side[0]]:
				if fixed.ends_with("/%s.webp" % name):
					key = fixed
			if key.is_empty():
				key = entry["slots"].get(name, {}).get(equipped.get(name, ""), "")
			if not key.is_empty():
				out.append({"key": key, "front": side[0] == "front", "order": order})
	return out


## Lays out the floors the café has, in its decor, keeping the ground floor where it was on screen.
func _layout_building() -> Dictionary:
	var s := state()
	var next := FloorsLayout.building(float(CoreRegions.active_table_indices(s).size()), s["kitchen"])
	var equipped: Dictionary = s["decor"]["equipped"]
	var layers := {}
	var wanted := []
	for floor_id: String in next["floors"]:
		layers[floor_id] = decor_layers(_DECOR_FLOORS[floor_id], equipped) if _DECOR_FLOORS.has(floor_id) else []
		for l: Dictionary in layers[floor_id]:
			wanted.append(l["key"])
	var signature := "%s|%s|%d" % [",".join(PackedStringArray(next["floors"])), ",".join(PackedStringArray(wanted)), int(FloorsArt.machine_tier(s["upgrades"]["machine"]))]
	var same_floors: bool = not built.is_empty() and built["floors"] == next["floors"]
	if same_floors and signature == _decor_signature:
		return built
	var here := library.all_ready(wanted)
	if not built.is_empty() and same_floors and not here:
		return built
	if next["offsets"].has("basement"):
		upgrades.update_kitchen(s)
	for p in _floor_pics:
		p.queue_free()
	_floor_pics.clear()
	var counter_depth := FloorsLayout.world_point(next, FloorsLayout.COUNTER_FRONT).y
	for floor_id: String in next["floors"]:
		_lay_floor(next, floor_id, layers[floor_id], equipped, counter_depth)
	_decor_signature = signature
	# A seating floor's stairs, over every layer, and the stairwell's balustrade in front of who is in it.
	for floor_id: String in next["floors"]:
		if not _HALL_FLOORS.has(floor_id):
			continue
		var hall := Vector2(FloorsLayout.STAIRS_HALL["x"], FloorsLayout.world_y(next, floor_id, FloorsLayout.STAIRS_HALL["y"]))
		var rail := Vector2(FloorsLayout.STAIRS_RAIL["x"], FloorsLayout.world_y(next, floor_id, FloorsLayout.STAIRS_RAIL["y"]))
		_floor_pics.append(pic("frame/stairs-hall", 0, Vector2.ZERO, FloorsArt.HALL_DEPTH, hall))
		_floor_pics.append(pic("frame/stairs-rail", 0, Vector2.ZERO, FloorsLayout.world_y(next, floor_id, FloorsLayout.STAIRS_RAIL["railFoot"]), rail))
	var before := built
	built = next
	_layout_frame(next)
	# Drawn with decor layers, the ground floor's counter is one of them.
	_counter_front.place.y = FloorsLayout.world_y(next, "ground", 0.0)
	_counter_front.depth = counter_depth
	_counter_front.visible = layers["ground"].is_empty()
	var kitchen: bool = next["offsets"].has("basement")
	_table_front.visible = kitchen
	if kitchen:
		_table_front.depth = FloorsLayout.world_point(next, FloorsLayout.TABLE_FRONT).y
		_table_front.place = Vector2(FloorsArt.TABLE_BOX.position.x, next["offsets"]["basement"] + FloorsArt.TABLE_BOX.position.y)
	# A new branch starts small: the camera goes back to rest. A building that grows keeps the ground floor where the
	# player put it on screen.
	if not before.is_empty() and next["floors"].size() < before["floors"].size():
		moved = false
	elif not before.is_empty() and moved:
		focus_y += next["offsets"].get("ground", 0.0) - before["offsets"].get("ground", 0.0)
	_frame_camera()
	return next


func _lay_floor(b: Dictionary, floor_id: String, layers: Array, equipped: Dictionary, counter_depth: float) -> void:
	var y: float = b["offsets"][floor_id]
	if layers.is_empty():
		var art: Dictionary = FloorsLayout.FLOOR_ART[floor_id]
		_floor_pics.append(pic(art["image"], 0, Vector2.ZERO, FloorsArt.LAYER_DEPTH, Vector2(0.0, y - art.get("above", 0.0))))
		return
	for l: Dictionary in layers:
		var order: int = l["order"]
		var key: String = l["key"]
		if floor_id == "ground" and not l["front"] and FloorsArt.BACK_LAYERS[order] == "fixtures":
			key = upgrades.fixtures(key, state()["upgrades"]["machine"])
		var p := pic(key, 0, Vector2.ZERO, counter_depth + order * 0.01 if l["front"] else FloorsArt.LAYER_DEPTH + order * FloorsArt.LAYER_STEP, Vector2(0.0, y))
		if floor_id == "ground" and not l["front"]:
			var shift: Variant = FloorsLayout.GROUND_SHIFT.get(equipped.get(FloorsArt.BACK_LAYERS[order], ""))
			if shift != null:
				p.place = Vector2(shift["dx"], y + shift["dy"])
				p.crop = Rect2(shift["crop"]["x"], shift["crop"]["y"], shift["crop"]["w"], shift["crop"]["h"])
		_floor_pics.append(p)


# ---------------------------------------------------------------- each frame

## After the rules have run. `dt` is real seconds.
func update(dt: float) -> void:
	dt = minf(0.25, maxf(0.0, dt))
	now += dt
	visible = not feed.suspended
	if feed.suspended:
		props.drain({})
		return
	var s := state()
	var b := _layout_building()
	_show_walls(dt)
	upgrades.update(dt, s)
	sky.update(dt, s, b)
	var active := CoreRegions.active_table_indices(s)
	var step := 0.0 if feed.paused else dt
	_tempo = 1.0 if s["phase"] == "prep" else s["speed"]
	_sync_customers(b, active, step)
	_sync_baristas(b, step)
	_sync_servers(b, active, step)
	_sync_cooks(b, step)
	_restock(b)
	props.sync(b, active, step)
	front.update(dt, s, wall_alpha)
	thoughts.update(step, s, not feed.paused and not arranging and wall_alpha < 0.5)
	_sync_furniture(b, s)
	_sync_arrange(b, s)
	_sync_table_preview(b, s, active.size())
	cats.update(b, step, s)
	_show_moment(b)
	props.drain(b)


# ---------------------------------------------------------------- taps

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		# Dragging the building lets go of a cat it was following.
		cats.following = ""
	if event is InputEventScreenTouch and event.index == 0:
		if event.pressed:
			_dragging = true
			_press_moved = false
			_pressed_at = event.position
		elif _dragging:
			_dragging = false
			if not _press_moved:
				tap(to_world(event.position))
	elif event is InputEventScreenDrag and event.index == 0 and _dragging:
		if event.position.distance_to(_pressed_at) > _TAP_SLOP:
			_press_moved = true
		scroll(event.relative.y)
	elif event is InputEventMouseButton and event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
		scroll(60.0 if event.button_index == MOUSE_BUTTON_WHEEL_UP else -60.0)


func to_world(at: Vector2) -> Vector2:
	return (at - position) / zoom


## Matches a tap to what is under it: the waiting moment, a cat or its gift, a named partner, or the café itself.
func tap(at: Vector2) -> void:
	if not session.interaction_enabled() or _arrange_tap(at):
		return
	var reach := _REACH / zoom
	# Behind the walls only the cue floating over them can be touched; people are reached once it opens.
	var walled: bool = wall_alpha > 0.5 and at.y < built["street"]
	var moment: Variant = feed.moment
	if moment != null:
		var guest: Actor = customers.get(moment["customerId"]) if moment.has("customerId") and not walled else null
		var on_cue := false
		if cue != null and cue.visible:
			var shown := cue.shown_size()
			on_cue = at.distance_to(cue.place - Vector2(0.0, shown.y / 2.0)) <= reach + shown.x / 2.0
		if on_cue or (guest != null and guest.pic.bounds().has_point(at)):
			tapped.emit({"kind": "moment"})
			return
	# A gift a cat left, or a cat itself, before whoever stands behind it.
	var cat: Variant = null if walled else cats.tap(at, reach)
	if cat != null:
		tapped.emit(cat)
		return
	if walled:
		# With the walls up the café plays on behind its windows; a tap on the wall itself opens it.
		wall_opened.emit()
		return
	var partner := ""
	var lowest := -INF
	for entry: Array in _staff():
		var p: FloorsPic = entry[0]
		if entry[1] is String and p != null and p.visible and p.bounds().has_point(at) and p.place.y > lowest:
			lowest = p.place.y
			partner = entry[1]
	tapped.emit({"kind": "partner", "id": partner} if not partner.is_empty() else {"kind": "cafe"})


## Everyone who works here: [picture, the partner they are, if any].
func _staff() -> Array:
	var out := []
	for i in mini(baristas.size(), sim().baristas.size()):
		out.append([baristas[i], sim().baristas[i].get("partnerId")])
	for i in mini(servers.size(), sim().servers.size()):
		out.append([servers[i].pic, sim().servers[i].get("partnerId")])
	for i in mini(cooks.size(), sim().cooks.size()):
		out.append([cooks[i].pic, sim().cooks[i].get("partnerId")])
	return out


## Bobs a cue over the moment's guest, or over the parcel at the door or the cats on the roof.
func _show_moment(b: Dictionary) -> void:
	var moment: Variant = feed.moment
	var at: Variant = null
	if moment != null:
		if moment.has("customerId") and moment["customerId"] is float:
			var actor: Actor = customers.get(moment["customerId"])
			if actor != null and actor.pic.alpha > 0.5:
				at = head(actor.pic)
		elif moment["kind"] == "delivery":
			at = FloorsLayout.world_point(b, FloorsLayout.PARCEL) - Vector2(0.0, 108.0)
		else:
			at = cats.moment_point()
			if at == null:
				at = FloorsLayout.world_point(b, {"floor": "roof", "x": 790.0, "y": 560.0})
	if at == null:
		if cue != null:
			cue.visible = false
		return
	if cue == null:
		cue = pic("bubble-moment", 0, Vector2(0.5, 1.0), FloorsDepth.BUBBLE + 2.0)
		cue.stretch = Vector2(1.5, 1.5)
	cue.visible = true
	cue.place = at - Vector2(0.0, 14.0 * absf(sin(now * 1000.0 / 260.0)))


# ---------------------------------------------------------------- furniture

static func furniture_key(id: String) -> String:
	return "furniture/%s" % id


## Puts a furniture picture at a spot: standing there, no wider than it allows, or fitted into its box on the wall.
func _place_piece(b: Dictionary, p: FloorsPic, id: String, spot: Dictionary) -> void:
	var made: Dictionary = library.furniture[id]
	var at := FloorsLayout.world_point(b, spot)
	if spot.has("box"):
		p.origin = Vector2(0.5, 0.5)
		p.stretch = Vector2.ONE * minf(spot["box"]["w"] / made["width"], spot["box"]["h"] / made["height"])
		p.depth = _WALL_FURNITURE_DEPTH
	else:
		p.origin = Vector2(0.5, 1.0)
		p.stretch = Vector2.ONE * minf(1.0, spot["room"] / made["width"])
		p.depth = at.y
	p.place = at


## Draws the furniture standing in the building, loading pieces the first time they appear.
func _sync_furniture(b: Dictionary, s: Dictionary) -> void:
	var shown := []
	var keys := []
	for index in s["decor"]["placed"].size():
		var p: Dictionary = s["decor"]["placed"][index]
		var spot: Variant = FloorsLayout.furniture_spot(p["spot"]) if p.has("spot") else null
		if spot != null and library.furniture.has(p["id"]) and b["offsets"].has(spot["floor"]):
			shown.append([p["id"], spot, index])
			keys.append(furniture_key(p["id"]))
	var here := library.all_ready(keys)
	var signature := "%s|%s|%s" % [str(shown.map(func(x: Array) -> Array: return [x[0], x[1]["id"], x[2]])), b["floors"], here]
	if signature != _placed_signature:
		_placed_signature = signature
		for piece: Dictionary in _placed:
			piece["pic"].queue_free()
		_placed = []
		for x: Array in shown:
			if library.ready(furniture_key(x[0])):
				var p := pic(furniture_key(x[0]))
				_place_piece(b, p, x[0], x[1])
				_placed.append({"pic": p, "index": x[2]})
	# The piece being moved shows as the ghost instead.
	var moving: int = int(feed.ghost["skip"]) if arranging and feed.ghost != null else -1
	for piece: Dictionary in _placed:
		piece["pic"].visible = piece["index"] != moving


## While arranging: the open spots for the piece in hand, and the piece where it would go, red where it can't.
func _sync_arrange(b: Dictionary, s: Dictionary) -> void:
	arranging = feed.arrange != null
	var ghost: Variant = feed.ghost if arranging and feed.arrange["mode"] == "place" else null
	var open := []
	if ghost != null:
		for spot: Dictionary in CoreFurniture.open_spots(s, ghost["id"], float(ghost["skip"])):
			var where: Variant = FloorsLayout.furniture_spot(spot["id"])
			if where != null:
				open.append(where)
		if not ghost.has("spot") and not open.is_empty():
			# A new piece starts at the open spot nearest the middle of the screen, and is brought into view.
			var nearest: Dictionary = open[0]
			for spot: Dictionary in open:
				if absf(FloorsLayout.world_point(b, spot).y - focus_y) < absf(FloorsLayout.world_point(b, nearest).y - focus_y):
					nearest = spot
			ghost["spot"] = nearest["id"]
	var spot: Variant = FloorsLayout.furniture_spot(ghost.get("spot")) if ghost != null else null
	var name := "%s%s" % [ghost["id"], ghost["skip"]] if ghost != null else ""
	if spot != null and name != _ghost_shown:
		_ghost_shown = name
		var y := FloorsLayout.world_point(b, spot).y
		if absf(y - focus_y) > screen.y / zoom * 0.28:
			focus_on(y)
	elif ghost == null:
		_ghost_shown = ""
	var signature := "%s|%s" % [open.map(func(o: Dictionary) -> String: return o["id"]), b["floors"]] if ghost != null else ""
	if signature != _free_signature:
		_free_signature = signature
		_free_spots.clear()
		for free: Dictionary in open:
			_free_spots.spot(b, free, Color(Color8(0xff, 0xfa, 0xf0), 0.5), Color(Color8(0xff, 0xfa, 0xf0), 0.95), 5.0)
	_ghost_mark.clear()
	var key := furniture_key(ghost["id"]) if ghost != null else ""
	if ghost == null or spot == null or not b["offsets"].has(spot["floor"]) or not library.furniture.has(ghost["id"]) or not library.ready(key):
		if _ghost_pic != null:
			_ghost_pic.visible = false
		return
	var ok := CoreFurniture.can_stand(s, ghost["id"], spot["id"], float(ghost["skip"]))
	_ghost_mark.spot(b, spot, Color(Color8(0x7f, 0xbf, 0x7a) if ok else Color8(0xe0, 0x60, 0x5a), 0.4), Color(Color8(0x4f, 0x8a, 0x4a) if ok else Color8(0xb8, 0x3a, 0x36), 0.95), 6.0)
	if _ghost_pic == null:
		_ghost_pic = pic(key)
	_ghost_pic.show_frame(key)
	_ghost_pic.visible = true
	_ghost_pic.alpha = 0.85
	_place_piece(b, _ghost_pic, ghost["id"], spot)
	_ghost_pic.depth = FloorsDepth.MARKS + 20.0
	_ghost_pic.tint = Color.WHITE if ok else Color8(0xff, 0x9a, 0x90)


## While arranging, a tap picks up the piece under it or puts the one in hand at the spot under it.
func _arrange_tap(at: Vector2) -> bool:
	if feed.arrange == null:
		return false
	if feed.arrange["mode"] == "browse":
		var hit: Variant = null
		for piece: Dictionary in _placed:
			if piece["pic"].visible and piece["pic"].bounds().has_point(at) and (hit == null or piece["pic"].depth > hit["pic"].depth):
				hit = piece
		if hit != null:
			piece_tapped.emit(hit["index"])
		return true
	# The spot nearest the tap, within reach of it.
	var def: Variant = CoreFurniture.furniture_def(feed.arrange.get("id", ""))
	var reach := 26.0 / zoom
	var best := ""
	var nearest := 1.0
	for spot: Dictionary in FloorsLayout.FURNITURE_SPOTS:
		if def == null or spot["surface"] != def["surface"] or not built["offsets"].has(spot["floor"]):
			continue
		var p := FloorsLayout.world_point(built, spot)
		var away: float
		if spot.has("box"):
			away = Vector2((at.x - p.x) / (spot["box"]["w"] / 2.0 + reach), (at.y - p.y) / (spot["box"]["h"] / 2.0 + reach)).length()
		else:
			away = Vector2((at.x - p.x) / (minf(spot["room"], 220.0) / 2.0 + reach), (at.y - (p.y - 60.0)) / (140.0 + reach)).length()
		if away < nearest or (away <= 1.0 and best.is_empty()):
			nearest = away
			best = spot["id"]
	if not best.is_empty():
		spot_tapped.emit(best)
	return true


## "Show where": rings the place of the next table, or the join where a new floor would open for it.
func _sync_table_preview(b: Dictionary, s: Dictionary, tables: int) -> void:
	var spot: Variant = FloorsLayout.next_table_spot(float(tables)) if feed.table_preview and s["phase"] == "prep" and not arranging else null
	if spot == null:
		if _table_mark != null:
			_table_mark.queue_free()
			_table_label.queue_free()
			_table_mark = null
		return
	var here: bool = b["offsets"].has(spot["floor"])
	# A new floor opens over the topmost one below the roof.
	var at := FloorsLayout.world_point(b, spot) - Vector2(0.0, 60.0) if here else Vector2(FloorsLayout.WORLD_W / 2.0, b["offsets"][b["floors"][1]])
	if _table_mark == null:
		_table_mark = FloorsMarks.new()
		_table_mark.depth = FloorsDepth.MARKS
		add_child(_table_mark)
		_table_label = words(session.translate.call("floors.nextTable" if here else "floors.nextFloor", {}), 54.0, Color8(0xff, 0xfa, 0xf0), FloorsDepth.BUBBLE + 1.0, at, 14.0, Color8(0x52, 0x6f, 0x4f))
		focus_on(at.y)
	_table_mark.clear()
	_table_mark.modulate.a = 0.75 + 0.25 * sin(now * 1000.0 / 280.0)
	var fill := Color(Color8(0xe3, 0xeb, 0xd8), 0.42)
	var line := Color(Color8(0x6c, 0x8c, 0x68), 0.95)
	if here:
		_table_mark.ellipse(at, Vector2(480.0, 250.0), fill, line, 8.0)
	else:
		var pillar: float = FloorsLayout.FRAME["pillar"]
		_table_mark.box(Rect2(pillar, at.y - 58.0, FloorsLayout.WORLD_W - 2.0 * pillar, 116.0), 40.0, fill, line, 8.0)
	_table_label.place = at - Vector2(0.0, 140.0 if here else 70.0)


# ---------------------------------------------------------------- people

func _make_actor(art: String, at: Dictionary, goal: String) -> Actor:
	var actor := Actor.new()
	actor.pic = pic(art, _SIDE["front"])
	actor.art = art
	actor.at = {"floor": at["floor"], "x": at["x"], "y": at["y"]}
	actor.aisle = at["aisle"]
	actor.goal = goal
	actor.clock = random.call() * 3.0
	return actor


## Plans a walk to the goal's spot whenever the goal changes.
func _aim(actor: Actor, goal: String, spot: Dictionary) -> void:
	if actor.goal == goal:
		return
	actor.goal = goal
	actor.steps = FloorsLayout.route(actor.at, actor.aisle, spot)
	actor.aisle = spot["aisle"]


## Seconds of play until the rules have someone at the end of their way.
static func _sim_seconds(w: Dictionary, speed: float) -> float:
	var x: float = w["tx"]
	var y: float = w["ty"]
	var length := JsMath.js_hypot2(x - w["x"], y - w["y"])
	for p: Dictionary in w["via"]:
		length += JsMath.js_hypot2(p["x"] - x, p["y"] - y)
		x = p["x"]
		y = p["y"]
	return length / speed


## Walks along the steps, to arrive with the rules in `seconds` of play; "side", "down" or "up", or "" once there.
func _walk(actor: Actor, dt: float, seconds: float) -> String:
	actor.rate = FloorsLayout.walk_pace(FloorsLayout.steps_length(actor.at, actor.steps), seconds) * _tempo
	var left := FloorsLayout.WALK * actor.rate * dt
	var way := ""
	while not actor.steps.is_empty():
		var next: Dictionary = actor.steps[0]
		if next.get("jump", false):
			actor.at = {"floor": next["floor"], "x": next["x"], "y": next["y"]}
			actor.pic.alpha = 0.0
			actor.steps.pop_front()
			continue
		var dx: float = next["x"] - actor.at["x"]
		var dy: float = next["y"] - actor.at["y"]
		var distance := sqrt(dx * dx + dy * dy)
		way = "side" if absf(dx) >= absf(dy) * 0.8 else ("down" if dy > 0.0 else "up")
		if absf(dx) > 0.5:
			actor.pic.flip = dx < 0.0
		if left <= 0.0:
			break
		if distance <= left:
			actor.at = {"floor": next["floor"], "x": next["x"], "y": next["y"]}
			actor.steps.pop_front()
			left -= distance
			continue
		actor.at = {"floor": actor.at["floor"], "x": actor.at["x"] + dx / distance * left, "y": actor.at["y"] + dy / distance * left}
		left = 0.0
	# Fade out climbing into the floor above, or leaving through the door; fade in on arrival.
	var alpha: float = actor.pic.alpha + dt * 3.0 * actor.rate
	if not actor.steps.is_empty():
		var first: Dictionary = actor.steps[0]
		var away := JsMath.js_hypot2(first["x"] - actor.at["x"], first["y"] - actor.at["y"])
		if actor.steps.size() > 1 and actor.steps[1].get("jump", false):
			alpha = away / 140.0
		elif first.get("fadeOut", false) and actor.steps.size() == 1:
			alpha = away / 120.0
	actor.pic.alpha = clampf(alpha, 0.0, 1.0)
	return way


func _play_way(actor: Actor, way: String) -> void:
	var legs := minf(_LEGS, actor.rate)
	if way == "side":
		actor.pic.play("%s-side" % actor.art, actor.art, _SIDE["walk"], _WALK_RATE, legs)
	else:
		actor.pic.play("%s-%s" % [actor.art, way], "%s-moves" % actor.art, _MOVES[way], _WALK_RATE, legs)


## Puts the picture (and anything it carries) where the actor stands.
func _put(b: Dictionary, actor: Actor, carrying: bool, dt: float) -> void:
	var p := FloorsLayout.world_point(b, actor.at)
	actor.sunk = FloorsLayout.well_sink(actor.at)
	actor.pic.advance(dt)
	# On the steps in a stairwell: its front edge hides what is below it.
	actor.pic.crop = Rect2(0.0, 0.0, actor.pic.size.x, maxf(0.0, actor.pic.size.y - actor.sunk)) if actor.sunk > 0.0 else Rect2()
	var depth := _depth_at(actor.at)
	actor.pic.depth = depth
	actor.pic.place = p
	if carrying and actor.cup == null:
		actor.cup = pic("cup")
	if not carrying and actor.cup != null:
		actor.cup.queue_free()
		actor.cup = null
	if actor.cup != null:
		actor.cup.depth = depth + 0.01
		actor.cup.place = p + Vector2(-30.0 if actor.pic.flip else 30.0, -104.0)
		actor.cup.alpha = 0.0 if actor.sunk > 0.0 else actor.pic.alpha


func _remove(actor: Actor) -> void:
	actor.pic.queue_free()
	if actor.cup != null:
		actor.cup.queue_free()


## A bubble that pops up over a head and goes again.
func bubble(key: String, at: Vector2, seconds: float = 1.3) -> void:
	var p := pic(key, 0, Vector2(0.5, 1.0), FloorsDepth.BUBBLE, at)
	p.stretch = Vector2(0.2, 0.2)
	var tween := create_tween()
	tween.tween_property(p, "stretch", Vector2(1.35, 1.35), 0.24).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_interval(maxf(0.0, seconds - 0.24))
	tween.tween_property(p, "alpha", 0.0, 0.2)
	tween.tween_callback(p.queue_free)


func head(p: FloorsPic) -> Vector2:
	return p.place - Vector2(0.0, p.shown_size().y + 4.0)


## The head of whoever a thought belongs to ("customer:7", "server:0"), if they can be seen: {"x", "y", "arrived"}.
func thinker(id: String) -> Variant:
	var kind := id.get_slice(":", 0)
	var i := int(id.get_slice(":", 1))
	if kind == "barista":
		if i >= baristas.size() or not baristas[i].visible:
			return null
		var at := head(baristas[i])
		return {"x": at.x, "y": at.y, "arrived": true}
	var actor: Actor = null
	if kind == "customer":
		actor = customers.get(float(i))
	elif kind == "server" and i < servers.size():
		actor = servers[i]
	elif kind == "cook" and i < cooks.size():
		actor = cooks[i]
	if actor == null or not actor.pic.visible or actor.pic.alpha <= 0.6:
		return null
	var at := head(actor.pic)
	return {"x": at.x, "y": at.y, "arrived": actor.steps.is_empty()}


# ---------------------------------------------------------------- guests

func _customer_goal(c: Dictionary, active: Array) -> Array:
	match c["phase"]:
		"queue":
			var i := maxi(0, sim().queue.find(c["id"]))
			return ["queue-%d" % i, FloorsLayout.QUEUE[mini(i, FloorsLayout.QUEUE.size() - 1)]]
		"toCounter", "ordering":
			var i := maxi(0, int(c["spot"]))
			return ["counter-%d" % i, FloorsLayout.SERVICE[i % FloorsLayout.SERVICE.size()]]
		"toSeat", "waiting", "sitting":
			if c["seat"] >= 0.0:
				return ["seat-%d" % int(c["seat"]), _seat(c["seat"], active)]
	return ["door", _door()]


static func _seat(seat: float, active: Array) -> Dictionary:
	return FloorsLayout.table_seats(floor(seat / 2.0), active)[int(seat) % 2]


static func _door() -> Dictionary:
	var out := FloorsLayout.DOOR.duplicate()
	out["fadeOut"] = true
	return out


static func cast_art(appearance: float) -> String:
	return "cast-%02d" % int(appearance)


## Whether a guest's own look is here; starts loading it otherwise.
func _look_ready(look: String) -> bool:
	return library.sheets.has(look) and library.sheets.has("%s-moves" % look) and library.all_ready([look, "%s-moves" % look])


func _sync_customers(b: Dictionary, active: Array, dt: float) -> void:
	var first_frame: bool = customers.is_empty() and _rack == null
	for actor: Actor in customers.values():
		actor.seen = false
	for c: Dictionary in sim().customers:
		var actor: Actor = customers.get(c["id"])
		var aim := _customer_goal(c, active)
		if actor == null:
			var appearance: float = c["appearanceId"] if c.get("appearanceId") is float else c["id"]
			var own := cast_art(appearance)
			var art: String = own if _look_ready(own) else GUEST_ART[int(appearance) % GUEST_ART.size()]
			# Guests already inside when the café is drawn start where they are; new ones come in at the door.
			actor = _make_actor(art, aim[1] if first_frame else FloorsLayout.DOOR, aim[0] if first_frame else "arriving")
			if art != own and library.sheets.has(own):
				actor.wants = own
			if not first_frame:
				actor.pic.alpha = 0.0
			customers[c["id"]] = actor
		if not actor.wants.is_empty() and _look_ready(actor.wants):
			actor.art = actor.wants
			actor.wants = ""
			actor.pic.stop()
		actor.seen = true
		_aim(actor, aim[0], aim[1])
		if c["mood"] is String and c["mood"] == "sad" and _moods.get(c["id"]) != "sad":
			bubble("bubble-sad", head(actor.pic))
		_moods[c["id"]] = c["mood"] if c["mood"] is String else ""
		_pose_customer(b, actor, c, active, dt)
	# Gone from the rules: finish walking out of the door, then go.
	for id: float in customers.keys():
		var actor: Actor = customers[id]
		if actor.seen:
			continue
		_aim(actor, "door", _door())
		var way := _walk(actor, dt, 0.0)
		if not way.is_empty():
			_play_way(actor, way)
		_put(b, actor, actor.cup != null, dt)
		if actor.steps.is_empty():
			_remove(actor)
			customers.erase(id)
			_moods.erase(id)


func _pose_customer(b: Dictionary, actor: Actor, c: Dictionary, active: Array, dt: float) -> void:
	# A newcomer waits unseen where they are for their own look, then borrows one; they catch up after.
	if not actor.wants.is_empty() and actor.clock < _LOOK_WAIT and c["phase"] != "exiting":
		actor.clock += dt * _tempo
		actor.pic.alpha = 0.0
		_put(b, actor, false, dt)
		return
	var way := _walk(actor, dt, _sim_seconds(c, CoreSim.WALK_SPEED))
	var takeaway: bool = c["phase"] == "exiting" and c["hasCup"] and not c["dineIn"]
	if not way.is_empty():
		_play_way(actor, way)
	else:
		actor.pic.stop()
		actor.clock += dt
		if c["phase"] == "waiting" or c["phase"] == "sitting":
			var pose: int = _MOVES["sit"]
			if c["phase"] == "sitting":
				pose = _MOVES["hold"] if fmod(actor.clock, 1.7) < 0.8 else (_MOVES["sip"] if fmod(actor.clock, 3.4) < 1.7 else _MOVES["laugh"])
			actor.pic.show_frame("%s-moves" % actor.art, pose)
			actor.pic.flip = _seat(c["seat"], active)["faceLeft"]
		else:
			actor.pic.show_frame(actor.art, _SIDE["back"] if c["phase"] in ["ordering", "toCounter"] else _SIDE["side"])
			actor.pic.flip = false
	_put(b, actor, takeaway, dt)


# ---------------------------------------------------------------- staff

func _sync_baristas(b: Dictionary, dt: float) -> void:
	var list: Array = sim().baristas
	while baristas.size() > list.size():
		baristas.pop_back().queue_free()
	while baristas.size() < list.size():
		baristas.append(pic("owner" if baristas.is_empty() else "barista", _SIDE["front"]))
	_calling.resize(list.size())
	var brewing := false
	var profile: Variant = state()["profile"]
	for i in list.size():
		var barista: Dictionary = list[i]
		var p := baristas[i]
		var spot: Dictionary = FloorsLayout.BARISTAS[i % FloorsLayout.BARISTAS.size()]
		# Everyone wears their own look, the owner the one the player designed.
		var art := staff.look(profile["look"] if i == 0 and profile != null else barista["look"], "owner" if i == 0 else "barista")
		var at := Vector2(spot["x"] + floorf(i / float(FloorsLayout.BARISTAS.size())) * 60.0, FloorsLayout.world_y(b, spot["floor"], spot["y"]))
		var working: bool = barista["customerId"] != null and barista["total"] > 0.0 and barista["remaining"] > 0.0
		brewing = brewing or working
		p.visible = not art.is_empty()
		if p.visible:
			p.show_frame(art, _SIDE["happy"] if barista["calling"] > 0.0 else (_SIDE["side"] if working else _SIDE["front"]))
		p.depth = at.y
		p.place = at
		var calling: bool = barista["calling"] > 0.0
		if calling and not _calling[i]:
			bubble("bubble-coffee", head(p), 0.9)
		_calling[i] = calling
	_steam -= dt
	if brewing and _steam <= 0.0:
		_steam = 0.32
		var at := FloorsLayout.world_point(b, FloorsLayout.STEAM)
		var puff := pic("puff", 0, Vector2(0.5, 0.5), at.y, at + Vector2(_rng.randi_range(-16, 16), 0.0))
		puff.stretch = Vector2(0.6, 0.6)
		puff.alpha = 0.85
		var tween := create_tween().set_parallel()
		tween.tween_property(puff, "place:y", at.y - 70.0, 1.3)
		tween.tween_property(puff, "stretch", Vector2(1.5, 1.5), 1.3)
		tween.tween_property(puff, "alpha", 0.0, 1.3)
		tween.chain().tween_callback(puff.queue_free)


func _sync_servers(b: Dictionary, active: Array, dt: float) -> void:
	var list: Array = sim().servers
	while servers.size() > list.size():
		_remove(servers.pop_back())
	for i in list.size():
		var server: Dictionary = list[i]
		var home: Dictionary = FloorsLayout.SERVER_HOMES[i % FloorsLayout.SERVER_HOMES.size()]
		if i >= servers.size():
			servers.append(_make_actor("barista", home, "home"))
		var actor := servers[i]
		var art := staff.look(server["look"], "barista")
		if not art.is_empty():
			actor.art = art
		actor.pic.visible = not art.is_empty()
		var goal := "home"
		var spot := home
		if server["phase"] == "toPass":
			goal = "pass"
			spot = FloorsLayout.PASS
		elif server["phase"] == "delivering" and not server["plates"].is_empty():
			for c: Dictionary in sim().customers:
				if c["id"] == server["plates"][0]["customerId"] and c["seat"] >= 0.0:
					var seat := _seat(c["seat"], active)
					goal = "table-%d" % int(c["seat"])
					spot = {"floor": seat["floor"], "x": seat["x"], "y": seat["aisle"], "aisle": seat["aisle"]}
					break
		_aim(actor, goal, spot)
		var way := _walk(actor, dt, _sim_seconds(server, CoreSim.SERVER_SPEED))
		if not way.is_empty():
			_play_way(actor, "side")
		else:
			actor.pic.stop()
			actor.pic.show_frame(actor.art, _SIDE["front"] if server["phase"] == "idle" else _SIDE["side"])
		_put(b, actor, server["phase"] == "delivering", dt)


func _sync_cooks(b: Dictionary, dt: float) -> void:
	var list: Array = sim().cooks
	var kitchen: bool = b["offsets"].has("basement")
	while cooks.size() > (list.size() if kitchen else 0):
		_remove(cooks.pop_back())
	var baking := false
	if kitchen:
		for i in list.size():
			baking = _sync_cook(b, i, list[i], dt) or baking
	_glow.visible = baking
	if baking:
		var mouth := FloorsLayout.world_point(b, FloorsLayout.OVEN_MOUTH)
		_glow.place = mouth
		_glow.alpha = 0.45 + 0.3 * sin(now * 1000.0 / 300.0)


## Whether this cook is at the oven.
func _sync_cook(b: Dictionary, i: int, cook: Dictionary, dt: float) -> bool:
	var kind := "cook-chef" if i % 2 == 0 else "cook-scarf"
	if i >= cooks.size():
		cooks.append(_make_actor(kind, FloorsLayout.cook_home(i), "home"))
	var actor := cooks[i]
	# The cook in their own skin and hair.
	var painted := staff.cook(cook["look"], kind)
	actor.pic.visible = not painted.is_empty()
	if actor.pic.visible:
		actor.art = painted
	var art := actor.art
	var at: Variant = sim().cook_station(float(i))
	var place := FloorsLayout.kitchen_place(at["station"]) if at != null else ""
	_aim(actor, "station-%s" % place if not place.is_empty() else "home", FloorsLayout.kitchen_spot(place, i) if not place.is_empty() else FloorsLayout.cook_home(i))
	var way := _walk(actor, dt, _sim_seconds(cook, CoreSim.WALK_SPEED))
	var working: bool = at != null and at["working"]
	if not way.is_empty():
		if cook["batch"] != null:
			actor.pic.play("%s-carry" % art, "%s-work" % art, [4, 5, 6, 7], _WALK_RATE, minf(_LEGS, actor.rate))
		else:
			_play_way(actor, "side")
	elif working and place == "oven" and kind == "cook-chef":
		actor.pic.play("%s-oven" % art, "%s-work" % art, [0, 1, 1, 2], 1.5)
		actor.pic.flip = false
	elif working and place == "dough" and kind == "cook-scarf":
		actor.pic.play("%s-knead" % art, "%s-work" % art, [0, 1, 2, 3], 4.0)
		actor.pic.flip = false
	else:
		actor.pic.stop()
		actor.pic.show_frame(art, _SIDE["back"] if working else _SIDE["front"])
		actor.pic.flip = false
	_put(b, actor, false, dt)
	return way.is_empty() and working and place == "oven"


## A batch out of the oven rides up the food lift and turns up in the cake display.
func _restock(b: Dictionary) -> void:
	var rack: Array = sim().rack
	if _rack != null and is_same(rack, _rack):
		return
	var first: bool = _rack == null
	_rack = rack
	if not first and not rack.is_empty():
		props.restocked(b, rack[0])
