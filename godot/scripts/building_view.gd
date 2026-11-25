class_name BuildingView
extends Node2D

## Renders the cross-section café building (roof, 3F, 2F, 1F playable, basement)
## matching `src/render/floors/floors-scene.ts`, with full/half texture preset switching,
## Y-sorted ground-floor characters, and a 30-actor benchmark mode.

const BENCH_GUESTS := [
	"guest-beret", "guest-hoodie", "guest-cardigan", "guest-curls",
	"cast-00", "cast-01", "cast-02", "cast-03", "cast-04", "cast-05",
	"cast-06", "cast-07", "cast-08", "cast-09", "cast-10", "cast-11",
	"cast-12", "cast-13", "cast-14", "cast-15", "cast-16", "cast-17",
	"cast-18", "cast-19", "cast-20", "cast-21", "cast-22", "cast-23",
	"cast-24", "cast-25",
]

var data: GameData
var state: CafeState
var sim: CafeSim
var _overscroll: float = 0.0
var _overscroll_bottom_div: float = 1.0
var _walk_fps: float = 0.0
var _max_leg_rate: float = 1.0
var _sky_offset_y: float = 0.0
var _step_offset_y: float = 0.0
var _cup_offset_x: float = 0.0
var _cup_offset_y: float = 0.0
var _sit_hold_period: float = 1.0
var _sit_hold_cutoff: float = 0.5
var _sit_sip_period: float = 2.0
var _sit_sip_cutoff: float = 1.0
var _side_walk: Array[int] = []
var _side_front: int = 0
var _side_happy: int = 0
var _side_side: int = 0
var _side_back: int = 0
var _moves_down: Array[int] = []
var _moves_up: Array[int] = []
var _moves_sit: int = 0
var _moves_hold: int = 0
var _moves_sip: int = 0
var _moves_laugh: int = 0

var preset: String = "full"
var _art_root: String = "res://art/full/"
var _tex_scale: float = 1.0 # 1.0 for full, 0.5 for half
var _inv_scale: float = 1.0 # 1.0 for full, 2.0 for half

var _building: Dictionary = {}
var _sheets: Dictionary = {}
var _decor_manifest: Dictionary = {}
var _frame_manifest: Dictionary = {}
var _pieces_manifest: Dictionary = {}
var _fx_manifest: Dictionary = {}
var _tex_cache: Dictionary = {} # rel_path -> Texture2D

var camera: Camera2D
var _bg_layer: Node2D
var _floors_layer: Node2D
var _actors_layer: Node2D # y_sort_enabled = true
var _street_layer: Node2D # z_index = 150 (in front of doors/frame)
var _frame_layer: Node2D  # z_index = 100
var _fx_layer: Node2D     # z_index = 180 (floating sale numbers)

var _barista_nodes: Array[Dictionary] = []
var _server_nodes: Array[Dictionary] = []
var _customer_nodes: Dictionary = {} # customer_id -> {root, sprite, cup, anim_t}
var _bench_actors: Array[Dictionary] = []
var _bench_mode: bool = false
var _bench_rng: SeededRng = SeededRng.new(1337)
var _floating_texts: Array[Dictionary] = []

var focus_y: float = 0.0
var camera_moved: bool = false
var drag_enabled: bool = true
var _touch_index: int = -1
var _mouse_dragging: bool = false
var _last_mouse_y: float = 0.0
var _world_w: float = 0.0


func setup(game_data: GameData, cafe_state: CafeState, cafe_sim: CafeSim) -> void:
	data = game_data
	state = cafe_state
	sim = cafe_sim
	var l := data.layout
	_world_w = data.req_float(l, "worldWidth")
	_overscroll = data.req_float(l, "overscroll")
	_overscroll_bottom_div = data.req_float(l, "overscrollBottomDivisor")
	_walk_fps = data.req_float(l, "walkFps")
	_max_leg_rate = data.req_float(l, "maxLegRate")
	_sky_offset_y = data.req_float(l, "skyOffsetY")
	_step_offset_y = data.req_float(l, "stepOffsetY")
	var cup_off: Dictionary = l.get("cupOffset", {})
	_cup_offset_x = data.req_float(cup_off, "x")
	_cup_offset_y = data.req_float(cup_off, "y")
	var sp: Dictionary = l.get("sitPose", {})
	_sit_hold_period = data.req_float(sp, "holdPeriod")
	_sit_hold_cutoff = data.req_float(sp, "holdCutoff")
	_sit_sip_period = data.req_float(sp, "sipPeriod")
	_sit_sip_cutoff = data.req_float(sp, "sipCutoff")
	var sf: Dictionary = l.get("sideFrames", {})
	_side_walk = []
	for f in sf.get("walk", []):
		_side_walk.append(int(f))
	_side_front = data.req_int(sf, "front")
	_side_happy = data.req_int(sf, "happy")
	_side_side = data.req_int(sf, "side")
	_side_back = data.req_int(sf, "back")
	var mf: Dictionary = l.get("movesFrames", {})
	_moves_down = []
	for f in mf.get("down", []):
		_moves_down.append(int(f))
	_moves_up = []
	for f in mf.get("up", []):
		_moves_up.append(int(f))
	_moves_sit = data.req_int(mf, "sit")
	_moves_hold = data.req_int(mf, "hold")
	_moves_sip = data.req_int(mf, "sip")
	_moves_laugh = data.req_int(mf, "laugh")
	_building = l["buildingFull"]

	camera = Camera2D.new()
	camera.enabled = true
	add_child(camera)

	_bg_layer = Node2D.new()
	_bg_layer.z_index = -20
	add_child(_bg_layer)

	_floors_layer = Node2D.new()
	_floors_layer.z_index = -10
	add_child(_floors_layer)

	_actors_layer = Node2D.new()
	_actors_layer.z_index = 0
	_actors_layer.y_sort_enabled = true
	add_child(_actors_layer)

	_frame_layer = Node2D.new()
	_frame_layer.z_index = 100
	add_child(_frame_layer)

	_street_layer = Node2D.new()
	_street_layer.z_index = 150
	_street_layer.y_sort_enabled = true
	add_child(_street_layer)

	_fx_layer = Node2D.new()
	_fx_layer.z_index = 180
	add_child(_fx_layer)

	sim.sale_made.connect(_on_sale_made)
	set_preset(state.art_preset)
	get_viewport().size_changed.connect(update_camera_fit)
	update_camera_fit()


func set_preset(new_preset: String) -> void:
	preset = "half" if new_preset == "half" else "full"
	state.art_preset = preset
	_art_root = "res://art/%s/" % preset
	var pmeta := GameData._load_json(_art_root + "preset.json")
	_tex_scale = float(pmeta.get("scale", 1.0 if preset == "full" else 0.5))
	_inv_scale = 1.0 / maxf(0.1, _tex_scale)

	_sheets = GameData._load_json(_art_root + "sheets.json")
	_decor_manifest = GameData._load_json(_art_root + "decor/decor.json")
	_frame_manifest = GameData._load_json(_art_root + "frame/frame.json")
	_pieces_manifest = GameData._load_json(_art_root + "upgrades/pieces.json")
	_fx_manifest = GameData._load_json(_art_root + "fx/fx.json")

	_clear_all_nodes()
	_tex_cache.clear()
	_build_static_building()
	if _bench_mode:
		_spawn_bench_actors()
	else:
		_sync_live_actors(0.0)


func _clear_all_nodes() -> void:
	_barista_nodes.clear()
	_server_nodes.clear()
	_customer_nodes.clear()
	_bench_actors.clear()
	_floating_texts.clear()
	for layer in [_bg_layer, _floors_layer, _actors_layer, _frame_layer, _street_layer, _fx_layer]:
		if layer == null:
			continue
		for ch in layer.get_children():
			layer.remove_child(ch)
			ch.free()


func _tex(rel_path: String) -> Texture2D:
	if _tex_cache.has(rel_path):
		return _tex_cache[rel_path]
	var full_path := _art_root + rel_path
	var t: Texture2D = load(full_path)
	if t == null:
		push_error("BuildingView: missing texture %s" % full_path)
		return null
	_tex_cache[rel_path] = t
	return t


func _make_sprite(rel_path: String, pos: Vector2 = Vector2.ZERO) -> Sprite2D:
	var sp := Sprite2D.new()
	sp.centered = false
	sp.texture = _tex(rel_path)
	sp.position = pos
	sp.scale = Vector2(_inv_scale, _inv_scale)
	return sp


func _build_static_building() -> void:
	var offsets: Dictionary = _building["offsets"]
	var floor_art: Dictionary = data.layout["floorArt"]
	var frame_cfg: Dictionary = data.layout["frame"]
	var edges: Dictionary = data.layout["frameEdges"]
	var eave_rel := float(data.layout["eave"])
	var roof_y := float(offsets.get("roof", 0.0))
	var eave_y := roof_y + eave_rel
	var street_y := float(_building["street"])
	var total_h := float(_building["height"])
	var pillar_w := float(frame_cfg["pillar"])
	var beam_h := float(frame_cfg["beam"])
	var soil_band_h := float(frame_cfg["soilBand"])
	var soil_below_h := float(frame_cfg["soilBelow"])

	# Sky fill above sky artwork
	var sky_rect := ColorRect.new()
	sky_rect.color = Color(edges["sky"])
	sky_rect.position = Vector2(-400.0, -2500.0)
	sky_rect.size = Vector2(_world_w + 800.0, eave_y + 2700.0)
	_bg_layer.add_child(sky_rect)

	# Sky backdrop behind roof
	var sky_tex := _tex("frame/sky.webp")
	if sky_tex != null:
		var sky_sp := Sprite2D.new()
		sky_sp.centered = false
		sky_sp.texture = sky_tex
		sky_sp.scale = Vector2(_inv_scale, _inv_scale)
		var sky_h := float(sky_tex.get_height()) * _inv_scale
		sky_sp.position = Vector2(0.0, eave_y + _sky_offset_y - sky_h)
		_bg_layer.add_child(sky_sp)

	# Soil cut over basement and below basement
	var soil_tex := _tex("frame/soil.webp")
	if soil_tex != null:
		var band_sp := Sprite2D.new()
		band_sp.centered = false
		band_sp.texture = soil_tex
		band_sp.region_enabled = true
		band_sp.region_rect = Rect2(0.0, 0.0, float(soil_tex.get_width()), soil_band_h * _tex_scale)
		band_sp.scale = Vector2(_inv_scale, _inv_scale)
		band_sp.position = Vector2(0.0, street_y)
		_bg_layer.add_child(band_sp)

		var below_sp := Sprite2D.new()
		below_sp.centered = false
		below_sp.texture = soil_tex
		below_sp.region_enabled = true
		below_sp.region_rect = Rect2(0.0, soil_band_h * _tex_scale, float(soil_tex.get_width()), soil_below_h * _tex_scale)
		below_sp.scale = Vector2(_inv_scale, _inv_scale)
		var base_y := float(offsets["basement"]) + float(floor_art["basement"]["height"])
		below_sp.position = Vector2(0.0, base_y)
		_bg_layer.add_child(below_sp)

	# Deep earth rectangle under soil
	var earth_rect := ColorRect.new()
	earth_rect.color = Color(edges["soil"])
	earth_rect.position = Vector2(-400.0, total_h - 4.0)
	earth_rect.size = Vector2(_world_w + 800.0, 3000.0)
	_bg_layer.add_child(earth_rect)

	# Floors (top down)
	var equipped: Dictionary = data.starter_state.get("equippedDecor", {})
	var back_order: Array = data.layout["decorLayers"]["back"]
	var front_order: Array = data.layout["decorLayers"]["front"]
	var side_win: Dictionary = data.layout["sideWindow"]
	var stairs_hall: Dictionary = data.layout["stairsHall"]
	var stairs_rail: Dictionary = data.layout["stairsRail"]

	for floor_id_var in _building["floors"]:
		var floor_id: String = str(floor_id_var)
		var fy := float(offsets[floor_id])
		if floor_id == "roof":
			var above := float(floor_art["roof"].get("above", 0.0))
			_floors_layer.add_child(_make_sprite("frame/attic.webp", Vector2(0.0, fy - above)))
		elif floor_id == "floor-3" or floor_id == "floor-2":
			_add_decor_layers("2f", floor_id, fy, equipped, back_order, [])
			var hall_pt := data.world_point(_building, floor_id, float(stairs_hall["x"]), float(stairs_hall["y"]))
			var rail_pt := data.world_point(_building, floor_id, float(stairs_rail["x"]), float(stairs_rail["y"]))
			_floors_layer.add_child(_make_sprite("frame/stairs-hall.webp", hall_pt))
			_floors_layer.add_child(_make_sprite("frame/stairs-rail.webp", rail_pt))
		elif floor_id == "ground":
			var side_pt := data.world_point(_building, "ground", float(side_win["x"]), float(side_win["y"]))
			_add_decor_layers("1f", floor_id, fy, equipped, back_order, front_order, side_pt)
		elif floor_id == "basement":
			_add_basement_layers(fy)

	# Building frame: pillars, beams, awning, folded doors, step
	var pillar_tex := _tex("frame/pillar.webp")
	if pillar_tex != null:
		var span := street_y - eave_y
		var tile_h := float(pillar_tex.get_height()) * _inv_scale
		var y_cur := eave_y
		while y_cur < street_y:
			var draw_h := minf(tile_h, street_y - y_cur)
			for side in [0, 1]:
				var psp := Sprite2D.new()
				psp.centered = false
				psp.texture = pillar_tex
				psp.region_enabled = true
				psp.region_rect = Rect2(0.0, 0.0, float(pillar_tex.get_width()), draw_h * _tex_scale)
				psp.scale = Vector2(_inv_scale, _inv_scale)
				psp.flip_h = (side == 1)
				psp.position = Vector2(0.0 if side == 0 else _world_w - pillar_w, y_cur)
				_frame_layer.add_child(psp)
			y_cur += tile_h

	# Beams between floors (above ground, floor-2, floor-3)
	var beam_tex := _tex("frame/beam.webp")
	if beam_tex != null:
		for floor_id_var in _building["floors"]:
			var fid: String = str(floor_id_var)
			if fid == "roof" or fid == "basement":
				continue
			var bsp := Sprite2D.new()
			bsp.centered = false
			bsp.texture = beam_tex
			bsp.position = Vector2(0.0, float(offsets[fid]) - beam_h * 0.5)
			bsp.scale = Vector2(_world_w / float(beam_tex.get_width()), beam_h / float(beam_tex.get_height()))
			_frame_layer.add_child(bsp)

	# Ground-floor open front: awning, folded doors, step
	var ground_y := float(offsets["ground"])
	var awning_cfg: Dictionary = data.layout["awning"]
	var awning_tex := _tex("frame/awning.webp")
	if awning_tex != null:
		var asp := Sprite2D.new()
		asp.centered = false
		asp.texture = awning_tex
		asp.position = Vector2(pillar_w, ground_y + float(awning_cfg["top"]))
		var aw_w := _world_w - 2.0 * pillar_w
		var aw_h := float(awning_cfg["height"])
		asp.scale = Vector2(aw_w / float(awning_tex.get_width()), aw_h / float(awning_tex.get_height()))
		_frame_layer.add_child(asp)

	var dl_tex := _tex("frame/door-left.webp")
	if dl_tex != null:
		var dl := Sprite2D.new()
		dl.centered = false
		dl.texture = dl_tex
		dl.scale = Vector2(_inv_scale, _inv_scale)
		dl.position = Vector2(pillar_w, street_y - float(dl_tex.get_height()) * _inv_scale)
		_frame_layer.add_child(dl)

	var dr_tex := _tex("frame/door-right.webp")
	if dr_tex != null:
		var dr := Sprite2D.new()
		dr.centered = false
		dr.texture = dr_tex
		dr.scale = Vector2(_inv_scale, _inv_scale)
		dr.position = Vector2(
			_world_w - pillar_w - float(dr_tex.get_width()) * _inv_scale,
			street_y - float(dr_tex.get_height()) * _inv_scale
		)
		_frame_layer.add_child(dr)

	var step_tex := _tex("frame/step.webp")
	if step_tex != null:
		var door_x := float(data.layout["door"]["x"])
		var ssp := Sprite2D.new()
		ssp.centered = false
		ssp.texture = step_tex
		ssp.scale = Vector2(_inv_scale, _inv_scale)
		ssp.z_index = -10 # under street walkers, over street
		ssp.position = Vector2(door_x - float(step_tex.get_width()) * _inv_scale * 0.5, street_y - _step_offset_y)
		_frame_layer.add_child(ssp)


func _add_decor_layers(
	kind: String,
	floor_id: String,
	fy: float,
	equipped: Dictionary,
	back_order: Array,
	front_order: Array,
	side_window_pos: Vector2 = Vector2.ZERO
) -> void:
	var entry: Dictionary = _decor_manifest.get(kind, {})
	if entry.is_empty():
		return
	var fixed_back: Array = entry.get("back", [])
	var fixed_front: Array = entry.get("front", [])
	var slots: Dictionary = entry.get("slots", {})

	for layer_name_var in back_order:
		var layer_name: String = str(layer_name_var)
		var path := _pick_decor_path(layer_name, fixed_back, slots, equipped)
		if not path.is_empty():
			_floors_layer.add_child(_make_sprite(path, Vector2(0.0, fy)))
		# Side window replaces old ground side door right after fixtures
		if floor_id == "ground" and layer_name == "fixtures":
			_floors_layer.add_child(_make_sprite("frame/side-window.webp", side_window_pos))

	if floor_id == "ground" and not front_order.is_empty():
		var cf: Dictionary = data.layout["counterFront"]
		var counter_y := data.world_point(_building, "ground", 0.0, float(cf["y"])).y
		var offset_step := 0.0
		for layer_name_var in front_order:
			var layer_name: String = str(layer_name_var)
			var path := _pick_decor_path(layer_name, fixed_front, slots, equipped)
			if path.is_empty():
				continue
			# Place inside y_sort_enabled _actors_layer anchored at counter_y!
			var holder := Node2D.new()
			holder.position = Vector2(0.0, counter_y + offset_step)
			var sp := _make_sprite(path, Vector2(0.0, fy - (counter_y + offset_step)))
			holder.add_child(sp)
			_actors_layer.add_child(holder)
			offset_step += 0.2


static func _pick_decor_path(layer_name: String, fixed: Array, slots: Dictionary, equipped: Dictionary) -> String:
	var suffix := "/%s.webp" % layer_name
	for p_var in fixed:
		var p: String = str(p_var)
		if p.ends_with(suffix):
			return p
	var slot_map: Dictionary = slots.get(layer_name, {})
	var chosen: String = str(equipped.get(layer_name, ""))
	return str(slot_map.get(chosen, ""))


func _add_basement_layers(fy: float) -> void:
	_floors_layer.add_child(_make_sprite("upgrades/basement-bare.webp", Vector2(0.0, fy)))
	var pieces_tex := _tex("upgrades/pieces.webp")
	if pieces_tex == null:
		return
	var pieces: Dictionary = _pieces_manifest.get("pieces", {})
	var starter_pieces := ["stage-1", "peels", "shelf-left", "shelf-right", "bowl", "jars", "basket", "pot"]
	for name_key in starter_pieces:
		if not pieces.has(name_key):
			continue
		var p: Dictionary = pieces[name_key]
		var sp := Sprite2D.new()
		sp.centered = false
		sp.texture = pieces_tex
		sp.region_enabled = true
		sp.region_rect = Rect2(float(p["x"]), float(p["y"]), float(p["w"]), float(p["h"]))
		sp.scale = Vector2(_inv_scale, _inv_scale)
		var at: Array = p["at"]
		sp.position = Vector2(float(at[0]) * _inv_scale, fy + float(at[1]) * _inv_scale)
		_floors_layer.add_child(sp)


# ------------------------------------------------------------------ Camera & touch drag

func update_camera_fit() -> void:
	if camera == null or _building.is_empty():
		return
	var vp_size := get_viewport_rect().size
	if vp_size.x <= 1.0 or vp_size.y <= 1.0:
		return
	var zoom_val := vp_size.x / _world_w
	camera.zoom = Vector2(zoom_val, zoom_val)
	var view_h := vp_size.y / zoom_val
	var half := view_h * 0.5
	var rest := data.rest_focus(_building, view_h)
	if not camera_moved or _bench_mode:
		focus_y = rest
	var slack := view_h * _overscroll
	var low := minf(rest, half) - slack
	var high := maxf(rest, float(_building["height"]) - half) + slack / _overscroll_bottom_div
	focus_y = clampf(focus_y, low, high)
	camera.position = Vector2(_world_w * 0.5, focus_y)


func reset_camera_to_rest() -> void:
	camera_moved = false
	update_camera_fit()


func _unhandled_input(event: InputEvent) -> void:
	if not drag_enabled or _bench_mode or camera == null:
		return
	# Ignore cross-emulated pointer events (DEVICE_ID_EMULATION) so touch drag and
	# desktop mouse drag each move the camera strictly 1:1 instead of double-counting.
	if event.device == InputEvent.DEVICE_ID_EMULATION:
		return
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed:
			if _touch_index < 0:
				_touch_index = st.index
		elif st.index == _touch_index:
			_touch_index = -1
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		if _touch_index < 0:
			_touch_index = sd.index
		if sd.index == _touch_index:
			focus_y -= sd.relative.y / maxf(0.01, camera.zoom.y)
			camera_moved = true
			update_camera_fit()
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_mouse_dragging = mb.pressed
			_last_mouse_y = mb.position.y
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			focus_y += 70.0 / maxf(0.01, camera.zoom.y)
			camera_moved = true
			update_camera_fit()
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			focus_y -= 70.0 / maxf(0.01, camera.zoom.y)
			camera_moved = true
			update_camera_fit()
	elif event is InputEventMouseMotion and _mouse_dragging:
		var mm := event as InputEventMouseMotion
		focus_y -= (mm.position.y - _last_mouse_y) / maxf(0.01, camera.zoom.y)
		_last_mouse_y = mm.position.y
		camera_moved = true
		update_camera_fit()


# ------------------------------------------------------------------ Live actors

func update_visuals(dt: float) -> void:
	if _bench_mode:
		_update_bench_actors(dt)
	else:
		_sync_live_actors(dt)
	_update_floating_texts(dt)


func _set_sheet_frame(sp: Sprite2D, sheet_key: String, frame_idx: int, flip_h: bool = false) -> void:
	var meta: Dictionary = _sheets.get(sheet_key, {})
	if meta.is_empty():
		return
	var tex := _tex(sheet_key + ".webp")
	if tex == null:
		return
	var fw := float(meta["frameWidth"])
	var fh := float(meta["frameHeight"])
	var total := int(meta["frames"])
	var f := posmod(frame_idx, maxi(1, total))
	sp.texture = tex
	sp.region_enabled = true
	sp.region_rect = Rect2(float(f) * fw, 0.0, fw, fh)
	sp.scale = Vector2(_inv_scale, _inv_scale)
	sp.centered = false
	sp.offset = Vector2(-fw * 0.5, -fh)
	sp.flip_h = flip_h


func _make_cup_sprite(frame_name: String = "takeaway") -> Sprite2D:
	var sp := Sprite2D.new()
	var fx_tex := _tex("fx/fx.webp")
	var frames: Dictionary = _fx_manifest.get("frames", {})
	var raw: Dictionary = frames.get(frame_name, frames.get("cup", {}))
	var rect_dict: Dictionary = raw.get("frame", raw)
	if fx_tex != null and rect_dict.has("x"):
		sp.texture = fx_tex
		sp.region_enabled = true
		sp.region_rect = Rect2(
			float(rect_dict["x"]),
			float(rect_dict["y"]),
			float(rect_dict["w"]),
			float(rect_dict["h"])
		)
		sp.scale = Vector2(_inv_scale, _inv_scale)
		sp.centered = true
	return sp


func _sync_live_actors(dt: float) -> void:
	var street_y := float(_building["street"])
	var anim_mult := float(state.speed) if state.phase != "prep" else 1.0

	# Baristas
	while _barista_nodes.size() < sim.baristas.size():
		var root := Node2D.new()
		var sp := Sprite2D.new()
		root.add_child(sp)
		_actors_layer.add_child(root)
		_barista_nodes.append({"root": root, "sprite": sp})

	for i in range(sim.baristas.size()):
		var b: Dictionary = sim.baristas[i]
		var node: Dictionary = _barista_nodes[i]
		var root: Node2D = node["root"]
		var sp: Sprite2D = node["sprite"]
		var pt := data.world_point(_building, "ground", float(b["x"]), float(b["y"]))
		root.position = pt
		var art := "owner" if i == 0 else "barista"
		var working := int(b["customer_id"]) >= 0 and float(b["remaining"]) > 0.0
		var frame := _side_happy if float(b["calling"]) > 0.0 else (_side_side if working else _side_front)
		_set_sheet_frame(sp, art, frame, false)

	# Servers
	while _server_nodes.size() < sim.servers.size():
		var root := Node2D.new()
		var sp := Sprite2D.new()
		var cup := _make_cup_sprite("tray-cups")
		cup.visible = false
		root.add_child(sp)
		root.add_child(cup)
		_actors_layer.add_child(root)
		_server_nodes.append({"root": root, "sprite": sp, "cup": cup, "anim_t": 0.0})

	for i in range(sim.servers.size()):
		var s: Dictionary = sim.servers[i]
		var node: Dictionary = _server_nodes[i]
		var root: Node2D = node["root"]
		var sp: Sprite2D = node["sprite"]
		var cup: Sprite2D = node["cup"]
		var pt := data.world_point(_building, "ground", float(s["x"]), float(s["y"]))
		root.position = pt
		var moving := bool(s["moving"])
		var flip := bool(s["facing_left"])
		if moving:
			node["anim_t"] = float(node["anim_t"]) + dt * minf(_max_leg_rate, anim_mult)
			var frame := _side_walk[int(floor(float(node["anim_t"]) * _walk_fps)) % maxi(1, _side_walk.size())]
			_set_sheet_frame(sp, "barista", frame, flip)
		else:
			var frame := _side_front if s["phase"] == "idle" else _side_side
			_set_sheet_frame(sp, "barista", frame, flip)
		var delivering: bool = (str(s["phase"]) == "delivering")
		cup.visible = delivering
		if delivering:
			cup.position = Vector2(-_cup_offset_x if flip else _cup_offset_x, -_cup_offset_y)

	# Customers
	var seen_ids: Dictionary = {}
	var tables: Array = data.layout["tables"]
	for c in sim.customers:
		var cid := int(c["id"])
		seen_ids[cid] = true
		var node: Dictionary
		if not _customer_nodes.has(cid):
			var root := Node2D.new()
			var sp := Sprite2D.new()
			var cup := _make_cup_sprite()
			cup.visible = false
			root.add_child(sp)
			root.add_child(cup)
			_actors_layer.add_child(root)
			node = {"root": root, "sprite": sp, "cup": cup, "anim_t": 0.0, "on_street": false}
			_customer_nodes[cid] = node
		else:
			node = _customer_nodes[cid]

		var root: Node2D = node["root"]
		var sp: Sprite2D = node["sprite"]
		var cup: Sprite2D = node["cup"]
		var pt := data.world_point(_building, "ground", float(c["x"]), float(c["y"]))
		var on_street := pt.y > street_y
		if on_street != bool(node["on_street"]):
			root.reparent(_street_layer if on_street else _actors_layer)
			node["on_street"] = on_street
		root.position = pt

		var art: String = str(c["art"])
		var moving := bool(c["moving"])
		var flip := bool(c["facing_left"])
		var phase: String = str(c["phase"])
		if moving:
			node["anim_t"] = float(node["anim_t"]) + dt * minf(_max_leg_rate, anim_mult)
			var step_idx := int(floor(float(node["anim_t"]) * _walk_fps))
			var way: String = str(c["way"])
			if way == "down":
				_set_sheet_frame(sp, art + "-moves", _moves_down[step_idx % maxi(1, _moves_down.size())], false)
			elif way == "up":
				_set_sheet_frame(sp, art + "-moves", _moves_up[step_idx % maxi(1, _moves_up.size())], false)
			else:
				_set_sheet_frame(sp, art, _side_walk[step_idx % maxi(1, _side_walk.size())], flip)
		else:
			if phase == "waiting" or phase == "sitting":
				var seat_idx := int(c["seat"])
				var face_left := false
				if seat_idx >= 0:
					var ti := int(seat_idx / 2)
					if ti < tables.size():
						face_left = bool(tables[ti][seat_idx % 2]["faceLeft"])
				var pose := _moves_sit
				if phase == "sitting":
					pose = _sit_pose_frame(float(c["sit_clock"]))
				_set_sheet_frame(sp, art + "-moves", pose, face_left)
			elif phase == "ordering" or phase == "toCounter":
				_set_sheet_frame(sp, art, _side_back, false)
			else:
				_set_sheet_frame(sp, art, _side_side, false)

		var show_cup := (phase == "exiting" and bool(c["has_cup"]) and not bool(c["dine_in"]))
		cup.visible = show_cup
		if show_cup:
			cup.position = Vector2(-_cup_offset_x if flip else _cup_offset_x, -_cup_offset_y)

	# Remove departed customer nodes
	var to_remove: Array = []
	for cid in _customer_nodes.keys():
		if not seen_ids.has(cid):
			to_remove.append(cid)
	for cid in to_remove:
		var node: Dictionary = _customer_nodes[cid]
		var root: Node2D = node["root"]
		if is_instance_valid(root):
			root.queue_free()
		_customer_nodes.erase(cid)


func _sit_pose_frame(clock_sec: float) -> int:
	if fmod(clock_sec, _sit_hold_period) < _sit_hold_cutoff:
		return _moves_hold
	if fmod(clock_sec, _sit_sip_period) < _sit_sip_cutoff:
		return _moves_sip
	return _moves_laugh


func _on_sale_made(amount: float, vip: bool, customer_id: int) -> void:
	if _bench_mode:
		return
	var b0: Dictionary = data.layout["baristas"][0]
	var pos := data.world_point(_building, "ground", float(b0["x"]), float(b0["y"])) + Vector2(0.0, -50.0)
	if _customer_nodes.has(customer_id):
		var root: Node2D = _customer_nodes[customer_id]["root"]
		pos = root.position + Vector2(0.0, -250.0)
	var lbl := Label.new()
	lbl.text = "+" + data.format_money(amount)
	var font := data.get_ui_font()
	if font != null:
		lbl.add_theme_font_override("font", font)
	lbl.add_theme_font_size_override("font_size", 52)
	lbl.add_theme_color_override("font_color", Color("#b7791f") if vip else Color("#8a5a1c"))
	lbl.add_theme_color_override("font_outline_color", Color("#fffaf0"))
	lbl.add_theme_constant_override("outline_size", 12)
	lbl.position = pos - Vector2(60.0, 0.0)
	_fx_layer.add_child(lbl)
	_floating_texts.append({"node": lbl, "life": 1.1})


func _update_floating_texts(dt: float) -> void:
	var kept: Array[Dictionary] = []
	for item in _floating_texts:
		item["life"] = float(item["life"]) - dt
		var lbl: Label = item["node"]
		if float(item["life"]) <= 0.0 or not is_instance_valid(lbl):
			if is_instance_valid(lbl):
				lbl.queue_free()
			continue
		lbl.position.y -= 65.0 * dt
		lbl.modulate.a = clampf(float(item["life"]) * 1.4, 0.0, 1.0)
		kept.append(item)
	_floating_texts = kept


# ------------------------------------------------------------------ 30-actor Benchmark Mode

func set_bench_mode(enabled: bool, bench_preset: String = "") -> void:
	_bench_mode = enabled
	if not bench_preset.is_empty():
		set_preset(bench_preset)
	else:
		_clear_all_nodes()
		_build_static_building()
		if _bench_mode:
			_spawn_bench_actors()
		else:
			_sync_live_actors(0.0)
	camera_moved = false
	update_camera_fit()


func _spawn_bench_actors() -> void:
	_bench_actors.clear()
	_bench_rng = SeededRng.new(1337)
	# Keep 1 barista behind the counter + 30 animated guests spread across visible floors
	# (20 on ground floor + 6 on 2F + 4 on 3F) to match heavy café load.
	var b_root := Node2D.new()
	var b_sp := Sprite2D.new()
	b_root.add_child(b_sp)
	var bspot: Dictionary = data.layout["baristas"][0]
	b_root.position = data.world_point(_building, "ground", float(bspot["x"]), float(bspot["y"]))
	_set_sheet_frame(b_sp, "owner", _side_side, false)
	_actors_layer.add_child(b_root)

	var tables: Array = data.layout["tables"]
	for i in range(30):
		var art: String = BENCH_GUESTS[i % BENCH_GUESTS.size()]
		var root := Node2D.new()
		var sp := Sprite2D.new()
		root.add_child(sp)
		_actors_layer.add_child(root)

		var floor_id := "ground"
		var seated := false
		var face_left := false
		var x := 220.0 + _bench_rng.next_float() * 1160.0
		var y := 580.0 + _bench_rng.next_float() * 260.0
		var vx := (140.0 + _bench_rng.next_float() * 120.0) * (1.0 if i % 2 == 0 else -1.0)
		var min_x := 180.0
		var max_x := 1420.0

		if i < 4:
			# Seated guests on 1F tables (sipping/laughing animations)
			var seat: Dictionary = tables[int(i / 2)][i % 2]
			x = float(seat["x"])
			y = float(seat["y"])
			face_left = bool(seat["faceLeft"])
			seated = true
			vx = 0.0
		elif i >= 20 and i < 26:
			floor_id = "floor-2"
			y = 630.0 + _bench_rng.next_float() * 200.0
		elif i >= 26:
			floor_id = "floor-3"
			y = 630.0 + _bench_rng.next_float() * 200.0

		root.position = data.world_point(_building, floor_id, x, y)
		_bench_actors.append({
			"root": root,
			"sprite": sp,
			"art": art,
			"floor": floor_id,
			"x": x,
			"y": y,
			"vx": vx,
			"min_x": min_x,
			"max_x": max_x,
			"seated": seated,
			"face_left": face_left,
			"clock": _bench_rng.next_float() * 4.0,
			"vertical": (not seated) and (i % 5 == 0),
			"vy": 120.0 if (i % 2 == 0) else -120.0,
		})
	_update_bench_actors(0.0)


func _update_bench_actors(dt: float) -> void:
	for a in _bench_actors:
		a["clock"] = float(a["clock"]) + dt
		var sp: Sprite2D = a["sprite"]
		var root: Node2D = a["root"]
		var art: String = str(a["art"])
		if bool(a["seated"]):
			var pose := _sit_pose_frame(float(a["clock"]))
			_set_sheet_frame(sp, art + "-moves", pose, bool(a["face_left"]))
			continue

		if bool(a["vertical"]):
			var ny := float(a["y"]) + float(a["vy"]) * dt
			if ny < 570.0:
				ny = 570.0
				a["vy"] = absf(float(a["vy"]))
			elif ny > 850.0:
				ny = 850.0
				a["vy"] = -absf(float(a["vy"]))
			a["y"] = ny
			var step_idx := int(floor(float(a["clock"]) * _walk_fps))
			var frame := _moves_down[step_idx % maxi(1, _moves_down.size())] if float(a["vy"]) > 0.0 else _moves_up[step_idx % maxi(1, _moves_up.size())]
			_set_sheet_frame(sp, art + "-moves", frame, false)
		else:
			var nx := float(a["x"]) + float(a["vx"]) * dt
			if nx < float(a["min_x"]):
				nx = float(a["min_x"])
				a["vx"] = absf(float(a["vx"]))
			elif nx > float(a["max_x"]):
				nx = float(a["max_x"])
				a["vx"] = -absf(float(a["vx"]))
			a["x"] = nx
			var step_idx := int(floor(float(a["clock"]) * _walk_fps))
			_set_sheet_frame(sp, art, _side_walk[step_idx % maxi(1, _side_walk.size())], float(a["vx"]) < 0.0)

		root.position = data.world_point(_building, str(a["floor"]), float(a["x"]), float(a["y"]))
