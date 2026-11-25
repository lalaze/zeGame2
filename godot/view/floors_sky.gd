class_name FloorsSky
extends RefCounted

## The time of day and the weather in the building: the painted skies cross-fading with the clock, night falling on the
## street and the roof while the rooms stay warm under their lamps, lit windows on the front walls, stars and a moon,
## drifting clouds, and rain, snow or leaves falling outside. Port of floors-sky.ts; what shows when is decided in
## FloorsSkyLight.

## The painted skies beside the day sky.
const _SKIES := {"clear": "sky/clear", "dusk": "sky/dusk", "night": "sky/night", "overcast": "sky/overcast"}
## The light in each front wall's windows, by the wall's picture.
const _WINDOW_GLOWS := {"frame/wall-attic": "sky/glow-wall-attic", "frame/wall-seating": "sky/glow-wall-seating", "frame/wall-ground": "sky/glow-wall-ground"}
const _ATTIC_SHADE := "sky/shade-attic"
## Frame pictures that stand outside and darken with the night.
const _OUTSIDE: Array[String] = ["frame/pillar", "frame/beam", "frame/awning", "frame/door-left", "frame/door-right", "frame/step", "frame/street", "frame/soil", "frame/wall-attic", "frame/wall-seating", "frame/wall-ground"]
const _SPRITES := "sky/sprites"
const _LAMP := "sky/lamp"
## The clouds in the order they join the sky, and each one's height in the sky picture.
const _CLOUDS: Array[String] = ["cloud-6", "cloud-3", "cloud-2", "cloud-4", "cloud-5", "cloud-1"]
const _CLOUD_ROWS: Array[float] = [110.0, 300.0, 30.0, 220.0, -130.0, -290.0]
## Where the moon and the sun hang: in the corner of sky over the roof's left slope.
const _DISC := {"x": 205.0, "row": 330.0}
const _DISC_SCALE := 0.8
const _STARS := 26
## Between a room's fixtures (which hold its windows) and what stands in front of them.
const _GLASS_DEPTH := -2.0 + 0.05 * 5.6
## What a place shows through a window: both under the glass's night.
const _VIEW_DEPTH := {"2f": -2.0 + 0.05 * 4.5, "1f": -2.0 + 0.05 * 5.55}
## The side window's layer starts this far below the ground floor's plate top.
const _SIDE_WINDOW_Y := 16.0
## How bright a lamp's glow is at full strength, and the glow in the walls' windows.
const _GLOW := 0.5
const _WINDOW_GLOW := 0.5
## The roof's outline on the top floor's picture, ridge to eaves: rain splashes along it.
const _RIDGE := Vector2(836.0, 10.0)
const _EAVE_Y := 545.0
const _FALLS := {
	"rain": {"frames": ["drop"], "speed": [2300.0, 3100.0], "wind": -0.21, "scale": [0.75, 1.15], "sway": 0.0, "spin": 0.0, "alpha": 0.75},
	"snow": {"frames": ["flake-1", "flake-2", "flake-2"], "speed": [170.0, 320.0], "wind": -0.12, "scale": [0.6, 1.1], "sway": 60.0, "spin": 0.6, "alpha": 0.95},
	"leaves": {"frames": ["leaf-1", "leaf-2"], "speed": [230.0, 380.0], "wind": -0.9, "scale": [0.8, 1.15], "sway": 120.0, "spin": 2.2, "alpha": 1.0},
}

## A fixed hour or weather to show instead of the game's: {"hour"?, "weather"?}. For screenshots.
var preview: Dictionary = {}
var look: Dictionary = {}
var _scene: FloorsScene
var _day: FloorsPic
var _skies: Dictionary = {}
var _tops: Dictionary = {}
var _stars: Array[FloorsPic] = []
var _moon: FloorsPic
var _sun: FloorsPic
var _clouds: Array[FloorsPic] = []
var _balloons: Array[FloorsPic] = []
var _bird: FloorsPic
var _pieces: Array = []
var _falling := ""
var _splash := 0.0
var _clock := 0.0
# What belongs to the building as it is laid out now.
var _built: Array[Node] = []
var _outside: Array[FloorsPic] = []
var _walls: Array[FloorsPic] = []
var _earth: FloorsPic
var _earth_colour := Color.WHITE
var _rooms: Array[FloorsPic] = []
var _attic: FloorsPic = null
var _glass: Array[Polygon2D] = []
## {"pic", "power", "wall"?}.
var _lamps: Array = []
var _window_glows: Array = []
var _lamp_signature := ""
## The place whose pictures are showing; "" is the old town, the building's own sky.
var _place := ""
var _views: Array = []
var _rng := RandomNumberGenerator.new()


## A stable number in [0, 1) for a slot, so stars and clouds stay where they are between visits.
static func _scatter(i: int, salt: int) -> float:
	var v := sin(i * 127.1 + salt * 311.7) * 43758.5453
	return v - floorf(v)


## `day` is the scene's sky picture: the others lie over it and follow it.
func _init(scene: FloorsScene, day: FloorsPic) -> void:
	_scene = scene
	_day = day
	for name in FloorsSkyLight.SKY_NAMES:
		_tops[name] = String(scene.library.sky["skies"][name]["top"]).trim_prefix("#").hex_to_int()
	var step := 0
	for name: String in _SKIES:
		step += 1
		_skies[name] = scene.pic(_SKIES[name], 0, Vector2(0.0, 1.0), FloorsDepth.SKY + step * 0.01)
		_skies[name].alpha = 0.0
	for i in _STARS:
		var star := _sprite("star", FloorsDepth.SKY + 0.05)
		star.stretch = Vector2.ONE * (0.3 + 0.5 * _scatter(i, 3))
		_stars.append(star)
	_moon = _sprite("moon", FloorsDepth.SKY + 0.06)
	_moon.stretch = Vector2.ONE * _DISC_SCALE
	_sun = _sprite("sun", FloorsDepth.SKY + 0.06)
	for i in _CLOUDS.size():
		var cloud := _sprite(_CLOUDS[i], FloorsDepth.SKY + 0.07 + i * 0.002)
		# Spread along the sky to start with, each at its own height.
		cloud.place.x = _scatter(i, 1) * (FloorsLayout.WORLD_W + 600.0) - 300.0
		_clouds.append(cloud)
	for name: String in ["balloon-1", "balloon-2"]:
		_balloons.append(_sprite(name, FloorsDepth.BEHIND - 0.1))
	_bird = _sprite("bird", FloorsDepth.BEHIND - 0.1)
	_bird.place.x = -200.0


func _sprite(frame: String, depth: float) -> FloorsPic:
	var p := _scene.pic(_SPRITES, frame, Vector2(0.5, 0.5), depth)
	p.alpha = 0.0
	return p


## The building was laid out: `parts` are the scene's frame pictures; those that stand outside darken with the night.
func layout(b: Dictionary, parts: Array[FloorsPic], walls: Array[FloorsPic], earth: FloorsPic, earth_colour: Color) -> void:
	for node in _built:
		node.queue_free()
	_built.clear()
	_outside.clear()
	_walls.clear()
	_rooms.clear()
	_glass.clear()
	_views.clear()
	_window_glows.clear()
	_attic = null
	_earth = earth
	_earth_colour = earth_colour
	for part in parts:
		if _OUTSIDE.has(part.key):
			_outside.append(part)
	for wall in walls:
		if _WINDOW_GLOWS.has(wall.key):
			_walls.append(wall)
	for floor_id: String in b["floors"]:
		_lay_floor(b, floor_id)
	# The light in the front walls' windows.
	for wall in _walls:
		var glow := _keep(_scene.pic(_WINDOW_GLOWS[wall.key], 0, Vector2.ZERO, wall.depth + 0.5, wall.place))
		glow.stretch = Vector2(2.0, 2.0)
		glow.blend(CanvasItemMaterial.BLEND_MODE_ADD)
		glow.alpha = 0.0
		_window_glows.append([glow, wall])
	_lamp_signature = ""
	_splash = 0.0


func _keep(p: FloorsPic) -> FloorsPic:
	_built.append(p)
	return p


## Night in a room, its windows' glass, and what the place shows through them.
func _lay_floor(b: Dictionary, floor_id: String) -> void:
	var y: float = b["offsets"][floor_id]
	if floor_id == "roof":
		_attic = _keep(_scene.pic(_ATTIC_SHADE, 0, Vector2.ZERO, FloorsDepth.SHADE, Vector2(0.0, y - FloorsLayout.FLOOR_ART["roof"]["above"])))
		_attic.stretch = Vector2(2.0, 2.0)
		_attic.sprite.material = FloorsLibrary.shading()
	else:
		var room := _keep(_scene.pic("plain", 0, Vector2.ZERO, FloorsDepth.SHADE, Vector2(0.0, y)))
		room.stretch = Vector2(FloorsLayout.WORLD_W, FloorsLayout.FLOOR_ART[floor_id]["height"]) / 8.0
		room.sprite.material = FloorsLibrary.shading()
		_rooms.append(room)
	if FloorsSkyLight.ROOM_WINDOWS.has(floor_id):
		var glass := Polygon2D.new()
		FloorsDepth.stand(glass, _GLASS_DEPTH)
		var points := PackedVector2Array()
		for p: Array in FloorsSkyLight.ROOM_WINDOWS[floor_id]:
			points.append(Vector2(p[0], FloorsLayout.world_y(b, floor_id, p[1]) - glass.position.y))
		glass.polygon = points
		glass.material = FloorsLibrary.blending(CanvasItemMaterial.BLEND_MODE_MUL)
		_scene.add_child(glass)
		_built.append(glass)
		_glass.append(glass)
	if FloorsArt.FLOOR_WINDOWS.has(floor_id):
		var window: String = FloorsArt.FLOOR_WINDOWS[floor_id]
		var at: Rect2 = FloorsArt.PLACE_WINDOWS[window]
		var shown := _keep(_scene.pic("plain", 0, Vector2.ZERO, _VIEW_DEPTH[window], Vector2(at.position.x, y + at.position.y + (_SIDE_WINDOW_Y if window == "1f" else 0.0))))
		shown.visible = false
		_views.append([shown, window])
		if not _place.is_empty():
			shown.show_frame(FloorsArt.place_glass(_place, window))
			shown.visible = true


## The lamps of the floors the building has, with the decor that is on: made again when either changes.
func _lay_lamps(b: Dictionary, equipped: Dictionary) -> void:
	var signature := "%s|%s|%s|%s" % [b["floors"], b["street"], equipped.get("ceiling"), equipped.get("neon")]
	if signature == _lamp_signature:
		return
	_lamp_signature = signature
	for lamp: Dictionary in _lamps:
		lamp["pic"].queue_free()
	_lamps.clear()
	for floor_id: String in b["floors"]:
		for lamp: Dictionary in FloorsSkyLight.floor_lamps(floor_id, equipped):
			_lamp(Vector2(lamp["x"], FloorsLayout.world_y(b, floor_id, lamp["y"])), lamp, FloorsDepth.GLOW)
	# The street lamp stands on the street's picture, which a basement's cut-open street replaces.
	if not b["offsets"].has("basement"):
		for lamp: Dictionary in FloorsSkyLight.STREET_LAMP:
			_lamp(Vector2(lamp["x"], b["street"] + lamp["y"]), lamp, FloorsDepth.SHADE - 1.0)
	# The lamps painted on the front walls shine when the walls are up.
	for wall in _walls:
		for lamp: Dictionary in FloorsSkyLight.WALL_LAMPS.get(wall.key, []):
			_lamp(wall.place + Vector2(lamp["x"], lamp["y"]), lamp, wall.depth + 0.6, wall)


func _lamp(at: Vector2, lamp: Dictionary, depth: float, wall: FloorsPic = null) -> void:
	var p := _scene.pic(_LAMP, 0, Vector2(0.5, 0.5), depth, at)
	p.stretch = Vector2.ONE * lamp["reach"] * 2.0 / p.size.x
	p.tint = FloorsSkyLight.color(lamp.get("colour", 0xffc98a))
	p.blend(CanvasItemMaterial.BLEND_MODE_ADD)
	p.alpha = 0.0
	_lamps.append({"pic": p, "power": lamp.get("power", 1.0), "wall": wall})


## Shows a place behind the roof and through the windows, once its pictures are here.
func _stand_in(place: String) -> void:
	if place == _place:
		return
	if not place.is_empty():
		var keys := []
		for light in FloorsSkyLight.SKY_NAMES:
			keys.append(FloorsArt.place_sky(place, light))
		for window: String in FloorsArt.PLACE_WINDOWS:
			keys.append(FloorsArt.place_glass(place, window))
		if not _scene.library.all_ready(keys):
			return
	_place = place
	_day.show_frame("frame/sky" if place.is_empty() else FloorsArt.place_sky(place, "day"))
	for light: String in _SKIES:
		_skies[light].show_frame(_SKIES[light] if place.is_empty() else FloorsArt.place_sky(place, light))
	for view: Array in _views:
		if not place.is_empty():
			view[0].show_frame(FloorsArt.place_glass(place, view[1]))
		view[0].visible = not place.is_empty()


static func _appear(p: FloorsPic, alpha: float, least: float = 0.01) -> void:
	p.alpha = alpha
	p.visible = alpha > least


## Shows the hour and the weather of the game's day, in the place the café is in.
func update(dt: float, s: Dictionary, b: Dictionary) -> void:
	_stand_in(FloorsArt.painted_place(CoreLocations.cafe_location(s)))
	_clock += dt
	var hour: float = preview.get("hour", roundf(FloorsSkyLight.sky_hour(s) * 60.0) / 60.0)
	look = FloorsSkyLight.sky_look(hour, preview.get("weather", CoreConditions.today_condition(s)["id"]), _tops)
	var sky_top := _day.place.y - _day.shown_size().y
	# The skies: dusk and night over the day sky, the overcast sky over them all.
	var times: Dictionary = look["times"]
	var cover: float = look["cover"]
	_show_sky("clear", 1.0 if look["clear"] and times["day"] > 0.0 else 0.0)
	_show_sky("dusk", 0.0 if cover >= 1.0 or times["night"] >= 1.0 else times["dusk"] / (1.0 - times["night"]))
	_show_sky("night", 0.0 if cover >= 1.0 else times["night"])
	_show_sky("overcast", cover)
	_skies["overcast"].tint = FloorsSkyLight.color(look["coverTint"])
	RenderingServer.set_default_clear_color(FloorsSkyLight.color(look["top"]))
	# Night outside, and a warm dimness in the rooms.
	var outside := FloorsSkyLight.color(look["outside"])
	for part in _outside:
		part.tint = outside
	_earth.tint = _earth_colour * outside
	if _attic != null:
		_attic.tint = outside
		_attic.visible = look["outside"] != 0xffffff
	var room := FloorsSkyLight.color(look["room"])
	for p in _rooms:
		p.tint = room
		p.visible = look["room"] != 0xffffff
	for glass in _glass:
		glass.color = FloorsSkyLight.color(look["glass"])
		glass.visible = look["glass"] != 0xffffff
	# Lamps, and the windows of the front walls.
	_lay_lamps(b, s["decor"]["equipped"])
	var wall_alpha := 0.0
	for wall in _walls:
		wall_alpha = maxf(wall_alpha, wall.alpha if wall.visible else 0.0)
	for lamp: Dictionary in _lamps:
		var wall: FloorsPic = lamp["wall"]
		_appear(lamp["pic"], look["lamps"] * lamp["power"] * _GLOW * (1.0 if wall == null else (wall.alpha if wall.visible else 0.0)), 0.005)
	for glow: Array in _window_glows:
		_appear(glow[0], look["lamps"] * glow[1].alpha * _WINDOW_GLOW if glow[1].visible else 0.0)
	_show_disc(sky_top)
	_drift(dt, sky_top)
	_fall(dt, b, wall_alpha)
	_extras(dt, sky_top)


func _show_sky(name: String, alpha: float) -> void:
	var p: FloorsPic = _skies[name]
	p.place = _day.place
	_appear(p, alpha, 0.004)


## Stars, the moon and the sun.
func _show_disc(sky_top: float) -> void:
	for i in _stars.size():
		var twinkle := 0.6 + 0.4 * sin(_clock * (0.7 + 1.6 * _scatter(i, 5)) + i * 2.4)
		_stars[i].place = Vector2(20.0 + _scatter(i, 1) * (FloorsLayout.WORLD_W - 40.0), sky_top - 640.0 + _scatter(i, 2) * 1000.0)
		_appear(_stars[i], look["stars"] * twinkle)
	var disc: Dictionary = _DISC if _place.is_empty() else FloorsArt.PLACE_DISC
	var at := Vector2(disc["x"], sky_top + disc["row"])
	_moon.place = at
	_appear(_moon, look["moon"])
	_sun.place = at
	_appear(_sun, look["sun"])
	_sun.turn = _clock * 0.05
	_sun.stretch = Vector2.ONE * _DISC_SCALE * (1.0 + 0.03 * sin(_clock * 1.3))


## Clouds drift to the right and come round again.
func _drift(dt: float, sky_top: float) -> void:
	for i in _clouds.size():
		var cloud := _clouds[i]
		var target: float = look["cloudAlpha"] if i < look["clouds"] else 0.0
		_appear(cloud, cloud.alpha + (target - cloud.alpha) * minf(1.0, dt * 2.0))
		var x: float = cloud.place.x + look["drift"] * (0.8 + 0.4 * _scatter(i, 7)) * dt
		var half := cloud.shown_size().x / 2.0
		if x - half > FloorsLayout.WORLD_W + 80.0:
			x = -half - 80.0
		cloud.place = Vector2(x, sky_top + _CLOUD_ROWS[i])
		cloud.tint = FloorsSkyLight.color(look["cloudTint"])


func _spread(kind: String) -> void:
	for piece: Dictionary in _pieces:
		piece["pic"].queue_free()
	_pieces.clear()
	if kind.is_empty():
		return
	var spec: Dictionary = _FALLS[kind]
	for i in int(look["pieces"]) * 2:
		var near := i % 2 == 1
		var vy := _rng.randf_range(spec["speed"][0], spec["speed"][1])
		var p := _scene.pic(_SPRITES, spec["frames"][i % spec["frames"].size()], Vector2(0.5, 0.5), FloorsDepth.FRONT if near else FloorsDepth.BEHIND,
			Vector2(_rng.randf() * (FloorsLayout.WORLD_W + 400.0) - 200.0, _rng.randf() * 4000.0))
		p.stretch = Vector2.ONE * _rng.randf_range(spec["scale"][0], spec["scale"][1]) * (1.0 if near else 0.8)
		_pieces.append({"pic": p, "front": near, "vy": vy, "vx": vy * spec["wind"], "spin": (_rng.randf() - 0.5) * 2.0 * spec["spin"], "sway": spec["sway"], "phase": _rng.randf() * TAU, "alpha": spec["alpha"] * (1.0 if near else 0.8)})


## Rain, snow or leaves: behind the building against the sky, and in front of the street (and of the front walls when
## they are up).
func _fall(dt: float, b: Dictionary, wall_alpha: float) -> void:
	var kind: String = look["fall"] if look["fall"] != null else ""
	var signature := "%s|%s" % [kind, look["pieces"]]
	if signature != _falling:
		_falling = signature
		_spread(kind)
	if kind.is_empty():
		return
	var view := _scene.view()
	var top := view.position.y - 120.0
	var span := view.size.y + 240.0
	var width := FloorsLayout.WORLD_W + 400.0
	# Outdoors in front of the building: the street's paving; with a basement only its band of paving.
	var cellar: bool = b["offsets"].has("basement")
	var street: float = b["street"]
	var ground: float = street + (FloorsLayout.FRAME["soilBand"] - 30.0 if cellar else FloorsLayout.FRAME["street"])
	# With the building cut open, what falls in front of it all falls over the street.
	var open := wall_alpha < 0.02
	var street_top := street - 140.0
	var street_span := ground - street_top + 60.0
	for piece: Dictionary in _pieces:
		var p: FloorsPic = piece["pic"]
		var x: float = p.place.x + (piece["vx"] + sin(_clock * 1.7 + piece["phase"]) * piece["sway"]) * dt
		var y: float = p.place.y + piece["vy"] * dt
		p.turn += piece["spin"] * dt
		y = fposmod(y - street_top, street_span) + street_top if piece["front"] and open else fposmod(y - top, span) + top
		p.place = Vector2(fposmod(x + 200.0, width) - 200.0, y)
		var outdoors := 1.0
		if piece["front"]:
			outdoors = 0.0 if y > ground else (1.0 if y >= street - 6.0 else wall_alpha)
		_appear(p, piece["alpha"] * outdoors)
	if kind == "rain":
		_rain_splashes(dt, b, ground, cellar, view)


## Drops splash on the paving, and along the roof.
func _rain_splashes(dt: float, b: Dictionary, ground: float, cellar: bool, view: Rect2) -> void:
	_splash -= dt
	var roof_top: float = b["offsets"].get("roof", 0.0) - FloorsLayout.FLOOR_ART["roof"]["above"]
	var n := 0
	while _splash <= 0.0:
		_splash += 0.05
		var at := Vector2(_rng.randf_range(20.0, FloorsLayout.WORLD_W - 20.0), _rng.randf_range(b["street"] + 34.0, ground - (12.0 if cellar else 190.0)))
		var depth := -2.5
		if n % 2 == 1:
			var t := _rng.randf()
			var side := -1.0 if _rng.randf() < 0.5 else 1.0
			at = Vector2(_RIDGE.x + side * t * _RIDGE.x, roof_top + _RIDGE.y + t * (_EAVE_Y - _RIDGE.y) + 6.0)
			depth = FloorsDepth.FRONT
		n += 1
		if at.y < view.position.y or at.y > view.end.y:
			continue
		var splash := _scene.pic(_SPRITES, "splash", Vector2(0.5, 1.0), depth, at)
		splash.stretch = Vector2(0.35, 0.35)
		splash.alpha = 0.9
		var tween := _scene.create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tween.tween_property(splash, "stretch", Vector2(0.9, 0.9), 0.42)
		tween.tween_property(splash, "alpha", 0.0, 0.42)
		tween.chain().tween_callback(splash.queue_free)


## A market day's balloons rising from the town, a quiet day's bird gliding past.
func _extras(dt: float, sky_top: float) -> void:
	for i in _balloons.size():
		var balloon := _balloons[i]
		_appear(balloon, 1.0 if look["balloons"] else 0.0)
		if look["balloons"]:
			# Each rises from behind the roof into the sky above, then starts again.
			var climb := fmod(_clock * 34.0 + i * 900.0, 1800.0)
			balloon.place = Vector2((FloorsLayout.WORLD_W - 190.0 if i == 1 else 150.0) + sin(_clock * 0.5 + i * 2.0) * 36.0, sky_top + 760.0 - climb)
			balloon.turn = sin(_clock * 0.9 + i) * 0.07
	_appear(_bird, 1.0 if look["bird"] else 0.0)
	if look["bird"]:
		var x := _bird.place.x + 120.0 * dt
		if x > FloorsLayout.WORLD_W + 2200.0:
			x = -200.0
		_bird.place = Vector2(x, sky_top + 215.0 + sin(_clock * 1.4) * 26.0)
		_bird.turn = cos(_clock * 1.4) * 0.08
