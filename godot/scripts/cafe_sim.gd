class_name CafeSim
extends RefCounted

## Fixed-step (0.05s), deterministic-seed B0 simulation for 1F service:
## arrive -> queue -> counter order -> brew -> takeaway or server delivery -> dine -> exit.
## Every numeric constant and coordinate comes from TS-exported `godot/data/*.json`.

signal day_finished(report: Dictionary)
signal sale_made(amount: float, vip: bool, customer_id: int)
signal guest_walkout(customer_id: int, reason: String)

var data: GameData
var state: CafeState
var rng: SeededRng

var customers: Array[Dictionary] = []
var baristas: Array[Dictionary] = []
var servers: Array[Dictionary] = []
var queue: Array[int] = []
var seats: Array[int] = [] # 4 seats on 1F (2 tables * 2), -1 = empty
var pass_plates: Array[Dictionary] = []

var spawn_timer: float = 0.0
var next_id: int = 1
var _accum: float = 0.0

var _sim_step: float = 0.0
var _walk_speed: float = 0.0
var _server_speed: float = 0.0
var _day_seconds: float = 0.0
var _max_queue: int = 0
var _pass_slots: int = 0
var _ring_again: float = 0.0
var _initial_spawn_timer: float = 0.0
var _arrival_jitter_base: float = 0.0
var _arrival_empty_fallback: float = 0.0
var _look_skin: int = 0
var _look_hair: int = 0
var _look_hair_style: int = 0
var _look_shirt: int = 0
var _look_pants: int = 0
var _cast_count: int = 0
var _guest_fallbacks: Array[String] = []
var _route_min_step: float = 0.0
var _walk_side_ratio: float = 0.0
var _walk_flip_deadzone: float = 0.0
var _order_seconds: float = 0.0
var _call_seconds: float = 0.0
var _tray_plates: int = 0
var _sit_min_seconds: float = 0.0
var _sit_range_seconds: float = 0.0
var _vip_chance: float = 0.0
var _combo_chance: float = 0.0
var _base_patience: float = 0.0
var _base_table_patience: float = 0.0
var _base_seat_chance: float = 0.0
var _traffic_cycle: float = 0.0
var _traffic_amp: float = 0.0
var _traffic_calm_end: float = 0.0
var _traffic_rise_end: float = 0.0
var _traffic_busy_end: float = 0.0
var _traffic_ramp_sec: float = 0.0
var _ground_aisle: float = 0.0

var _door_spot: Dictionary = {}
var _queue_spots: Array = []
var _barista_spots: Array = []
var _service_spots: Array = []
var _pass_spot: Dictionary = {}
var _server_homes: Array = []
var _seat_spots: Array = [] # ground-floor seats

var _cast_bag: Array[int] = []
var _cast_rng: SeededRng


func _init(game_data: GameData, cafe_state: CafeState, seed_value: int = 1) -> void:
	data = game_data
	state = cafe_state
	rng = SeededRng.new(seed_value)
	_cast_rng = SeededRng.new(1)
	_load_constants()
	reset(seed_value)


func _load_constants() -> void:
	var c := data.constants
	_sim_step = data.req_float(c, "simStep")
	_day_seconds = data.req_float(c, "daySeconds")
	_max_queue = data.req_int(c, "maxQueue")
	_pass_slots = data.req_int(c, "passSlots")
	_ring_again = data.req_float(c, "ringAgain")
	_initial_spawn_timer = data.req_float(c, "initialSpawnTimer")
	_arrival_jitter_base = data.req_float(c, "arrivalJitterBase")
	_arrival_empty_fallback = data.req_float(c, "arrivalEmptyFallback")
	var look_ranges: Dictionary = c.get("randomLookRanges", {})
	_look_skin = data.req_int(look_ranges, "skin")
	_look_hair = data.req_int(look_ranges, "hair")
	_look_hair_style = data.req_int(look_ranges, "hairStyle")
	_look_shirt = data.req_int(look_ranges, "shirt")
	_look_pants = data.req_int(look_ranges, "pants")
	_cast_count = data.req_int(c, "castCount")
	_order_seconds = data.req_float(c, "orderSeconds")
	_call_seconds = data.req_float(c, "callSeconds")
	_tray_plates = data.req_int(c, "trayPlates")
	_sit_min_seconds = data.req_float(c, "sitMinSeconds")
	_sit_range_seconds = data.req_float(c, "sitRangeSeconds")
	_vip_chance = data.req_float(c, "vipChance")
	_combo_chance = data.req_float(c, "comboChance")
	_base_patience = data.req_float(c, "basePatience")
	_base_table_patience = data.req_float(c, "baseTablePatience")
	_base_seat_chance = data.req_float(c, "baseSeatChance")
	_traffic_cycle = data.req_float(c, "trafficCycleSeconds")
	_traffic_amp = data.req_float(c, "trafficAmplitude")
	_traffic_calm_end = data.req_float(c, "trafficCalmEnd")
	_traffic_rise_end = data.req_float(c, "trafficRiseEnd")
	_traffic_busy_end = data.req_float(c, "trafficBusyEnd")
	_traffic_ramp_sec = data.req_float(c, "trafficRampSeconds")

	var l := data.layout
	_walk_speed = data.req_float(l, "walk")
	_server_speed = _walk_speed * data.req_float(c, "serverSpeedMultiplier")
	_route_min_step = data.req_float(l, "routeMinStep")
	_walk_side_ratio = data.req_float(l, "walkSideRatio")
	_walk_flip_deadzone = data.req_float(l, "walkFlipDeadzone")
	_guest_fallbacks = []
	for ga in l.get("guestArt", []):
		_guest_fallbacks.append(str(ga))
	_door_spot = l["door"]
	_ground_aisle = float(_door_spot["aisle"])
	_queue_spots = l["queue"]
	_barista_spots = l["baristas"]
	_service_spots = l["service"]
	_pass_spot = l["pass"]
	_server_homes = l["serverHomes"]
	_seat_spots = []
	var tables: Array = l["tables"]
	# Collect all ground-floor table seats directly from exported layout metadata.
	for pair in tables:
		if (pair as Array).is_empty() or str(pair[0].get("floor", "")) != "ground":
			continue
		for s in pair:
			_seat_spots.append(s)


func reset(seed_value: int = -1) -> void:
	if seed_value >= 0:
		rng = SeededRng.new(seed_value)
		_cast_rng = SeededRng.new(1)
	customers.clear()
	baristas.clear()
	servers.clear()
	queue.clear()
	pass_plates.clear()
	seats = []
	for _i in range(_seat_spots.size()):
		seats.append(-1)
	spawn_timer = _initial_spawn_timer
	next_id = 1
	_accum = 0.0
	_cast_bag.clear()
	_ensure_staff()


func _draw_random_look() -> int:
	# Mirrors TS Sim.randomLook() (5 RNG draws) so VIP rolls & arrival timing match sim.ts.
	var skin := rng.next_int(_look_skin)
	var hair := rng.next_int(_look_hair)
	var hair_style := rng.next_int(_look_hair_style)
	var shirt := rng.next_int(_look_shirt)
	var pants := rng.next_int(_look_pants)
	return 1 + ((((skin * _look_hair + hair) * _look_hair_style + hair_style) * _look_shirt + shirt) * _look_pants + pants)


func _ensure_staff() -> void:
	if baristas.is_empty():
		_draw_random_look()
		var bspot: Dictionary = _barista_spots[0]
		baristas.append({
			"index": 0,
			"x": float(bspot["x"]),
			"y": float(bspot["y"]),
			"customer_id": -1,
			"remaining": 0.0,
			"total": 0.0,
			"calling": 0.0,
		})
	if servers.is_empty():
		_draw_random_look()
		var hspot: Dictionary = _server_homes[0]
		servers.append({
			"index": 0,
			"x": float(hspot["x"]),
			"y": float(hspot["y"]),
			"aisle": float(hspot["aisle"]),
			"path": [],
			"phase": "idle", # "idle" | "toPass" | "delivering" | "returning"
			"plates": [],
			"facing_left": false,
			"moving": false,
			"way": "side",
		})


func _next_appearance_id() -> int:
	if _cast_bag.is_empty():
		var total := _cast_count + _guest_fallbacks.size()
		for i in range(total):
			_cast_bag.append(i)
		for i in range(_cast_bag.size() - 1, 0, -1):
			var j := _cast_rng.next_int(i + 1)
			var tmp := _cast_bag[i]
			_cast_bag[i] = _cast_bag[j]
			_cast_bag[j] = tmp
	return int(_cast_bag.pop_back())


func art_key_for_appearance(appearance_id: int) -> String:
	if appearance_id >= _cast_count and not _guest_fallbacks.is_empty():
		return _guest_fallbacks[(appearance_id - _cast_count) % _guest_fallbacks.size()]
	return "cast-%02d" % (appearance_id % maxi(1, _cast_count))


## Exact port of src/game/traffic.ts `integratedTrafficSeconds`.
func integrated_traffic_seconds(t_start: float, dt: float) -> float:
	if dt <= 0.0:
		return 0.0
	var cycle := _traffic_cycle
	var t0 := fposmod(maxf(0.0, t_start), cycle)
	var cycles: float = floorf(dt / cycle)
	var rem := fposmod(dt, cycle)
	var t1 := t0 + rem
	var partial := 0.0
	if t1 <= cycle:
		partial = _cycle_integral(t1) - _cycle_integral(t0)
	else:
		partial = cycle - _cycle_integral(t0) + _cycle_integral(t1 - cycle)
	return cycles * cycle + partial


func _cycle_integral(t: float) -> float:
	var min_m := 1.0 - _traffic_amp
	var max_m := 1.0 + _traffic_amp
	var calm_end := _traffic_calm_end
	var rise_end := _traffic_rise_end
	var busy_end := _traffic_busy_end
	var ramp_sec := _traffic_ramp_sec
	var slope := (max_m - min_m) / ramp_sec
	if t <= calm_end:
		return t * min_m
	var calm_area := calm_end * min_m
	if t <= rise_end:
		var r := t - calm_end
		return calm_area + r * min_m + slope * r * r * 0.5
	var rise_area := calm_area + ramp_sec
	if t <= busy_end:
		return rise_area + (t - rise_end) * max_m
	var busy_area := rise_area + (busy_end - rise_end) * max_m
	var r2 := t - busy_end
	return busy_area + r2 * max_m - slope * r2 * r2 * 0.5


func begin_closing() -> void:
	if state.phase != "open":
		return
	state.phase = "closing"
	for c in customers:
		if c["phase"] == "queue":
			_start_exit(c)
	queue.clear()


func finished_service() -> bool:
	for c in customers:
		var p: String = c["phase"]
		if p != "sitting" and p != "exiting":
			return false
	return true


func advance(real_dt: float) -> void:
	var clamped := clampf(real_dt, 0.0, 0.25)
	var was_running := state.phase != "prep"
	var speed_mult := float(state.speed) if was_running else 1.0
	_accum += clamped * speed_mult
	var guard := 0
	while _accum >= _sim_step - 1e-9 and guard < 64:
		_accum = maxf(0.0, _accum - _sim_step)
		step_fixed(_sim_step)
		guard += 1
		if was_running and state.phase == "prep":
			_accum = 0.0
			break


## Advances exactly one fixed step (`dt`, normally 0.05s).
## Matches TS `Sim.update`: in `prep`, existing customers still finish sitting/exiting
## and servers still walk back to idle, without advancing `day_time` or admitting new arrivals.
func step_fixed(dt: float) -> void:
	_ensure_staff()
	if dt <= 0.0:
		return

	if state.phase == "open" and (state.day_time >= _day_seconds or not state.has_service_supply()):
		begin_closing()

	var is_open := state.phase == "open"
	var running := state.phase != "prep"
	var arrival_dt := dt
	if is_open:
		arrival_dt = integrated_traffic_seconds(state.day_time, minf(dt, _day_seconds - state.day_time))
	if running:
		state.day_time += dt
	if state.phase == "open" and state.day_time >= _day_seconds:
		begin_closing()

	spawn_timer -= arrival_dt
	if spawn_timer <= 0.0:
		var rate := state.arrival_rate()
		spawn_timer = (_arrival_jitter_base + rng.next_float()) / rate if rate > 0.0 else _arrival_empty_fallback
		if state.phase == "open":
			if queue.size() < _max_queue:
				_spawn_customer()
			else:
				state.today["door_lost"] = int(state.today["door_lost"]) + 1

	_call_next()

	for c in customers:
		var arrived := _step_walker(c, dt, _walk_speed)
		if arrived:
			_on_customer_arrive(c)

		var p: String = c["phase"]
		if p == "queue":
			c["patience"] = float(c["patience"]) - dt
			if float(c["patience"]) <= 0.0:
				var qidx := queue.find(int(c["id"]))
				if qidx >= 0:
					queue.remove_at(qidx)
				_relayout_queue()
				if running:
					state.today["missed"] = int(state.today["missed"]) + 1
					state.today["queue_lost"] = int(state.today["queue_lost"]) + 1
				guest_walkout.emit(int(c["id"]), "queue")
				_start_exit(c)
		elif p == "ordering" and bool(c["dine_in"]):
			c["timer"] = float(c["timer"]) - dt
			if float(c["timer"]) <= 0.0:
				c["phase"] = "toSeat"
				c["spot"] = -1
				var seat_idx := int(c["seat"])
				var seat: Dictionary = _seat_spots[seat_idx]
				_route_ground(c, seat)
		elif p == "waiting":
			c["timer"] = float(c["timer"]) - dt
			if float(c["timer"]) <= 0.0:
				_drop_unclaimed_plate(int(c["id"]))
				if running:
					state.today["missed"] = int(state.today["missed"]) + 1
					state.today["table_lost"] = int(state.today["table_lost"]) + 1
				guest_walkout.emit(int(c["id"]), "table")
				_start_exit(c)
		elif p == "sitting":
			c["timer"] = float(c["timer"]) - dt
			c["sit_clock"] = float(c["sit_clock"]) + dt
			if float(c["timer"]) <= 0.0:
				_start_exit(c)

	# Update baristas
	for bi in range(baristas.size()):
		var b: Dictionary = baristas[bi]
		b["calling"] = maxf(0.0, float(b["calling"]) - dt)
		var cid := int(b["customer_id"])
		if cid < 0 or float(b["total"]) <= 0.0:
			continue
		b["remaining"] = float(b["remaining"]) - dt
		if float(b["remaining"]) > 0.0:
			continue
		var c := _find_customer(cid)
		if c.is_empty() or c["phase"] == "exiting":
			b["customer_id"] = -1
		elif bool(c["dine_in"]):
			_send_to_pass(c, bi)
		elif c["phase"] == "ordering":
			_serve_at_counter(b, c)

	_update_servers(dt)

	if state.phase == "open" and not state.has_service_supply():
		begin_closing()

	# Remove customers who finished walking out the door
	var remaining: Array[Dictionary] = []
	for c in customers:
		if c["phase"] == "exiting" and (c["path"] as Array).is_empty():
			continue
		remaining.append(c)
	customers = remaining

	# Auto-settle once closing and all accepted orders are delivered
	if state.phase == "closing" and finished_service():
		var report := close_shop_now()
		if not report.is_empty():
			day_finished.emit(report)


func close_shop_now() -> Dictionary:
	if state.phase == "prep":
		return {}
	for c in customers:
		if c["phase"] != "sitting" and c["phase"] != "exiting":
			_start_exit(c)
	queue.clear()
	pass_plates.clear()
	for b in baristas:
		b["customer_id"] = -1
		b["remaining"] = 0.0
		b["total"] = 0.0
		b["calling"] = 0.0
	for si in range(servers.size()):
		var s: Dictionary = servers[si]
		s["plates"] = []
		if s["phase"] != "idle":
			s["phase"] = "returning"
			_route_ground(s, _server_homes[si % _server_homes.size()])
	var report := state.finish_day()
	return report


func _spawn_customer() -> void:
	var menu := state.active_menu_items()
	if menu.is_empty():
		return
	# 1. Main dish draw
	var main_def: Dictionary = menu[rng.next_int(menu.size())]
	var main_id: String = main_def["id"]
	# 2. Optional combo draw if both drink and bakery items are on the menu
	var extra_id := ""
	var pairs: Array[Dictionary] = []
	var main_drink := bool(main_def["isDrink"])
	for m in menu:
		if bool(m["isDrink"]) != main_drink:
			pairs.append(m)
	if not pairs.is_empty() and rng.next_float() < _combo_chance:
		extra_id = str(pairs[rng.next_int(pairs.size())]["id"])

	# 3. Five appearance look RNG draws (matches sim.ts spawn() sequence before VIP roll)
	var look_seed := _draw_random_look()
	_cast_rng = SeededRng.new(look_seed)
	var appearance := _next_appearance_id()

	# 4. VIP roll
	var vip := rng.next_float() < _vip_chance
	var q_spot: Dictionary = _queue_spots[mini(queue.size(), _queue_spots.size() - 1)]

	var c := {
		"id": next_id,
		"appearance_id": appearance,
		"art": art_key_for_appearance(appearance),
		"phase": "queue",
		"order": main_id,
		"extra": extra_id,
		"vip": vip,
		"patience": _base_patience,
		"spot": -1,
		"seat": -1,
		"timer": 0.0,
		"sit_clock": 0.0,
		"has_cup": false,
		"sold_out": false,
		"dine_in": false,
		"x": float(_door_spot["x"]),
		"y": float(_door_spot["y"]),
		"aisle": _ground_aisle,
		"path": [],
		"facing_left": false,
		"moving": false,
		"way": "up",
	}
	next_id += 1
	customers.append(c)
	queue.append(int(c["id"]))
	_route_ground(c, q_spot)


func _relayout_queue() -> void:
	for i in range(queue.size()):
		var c := _find_customer(queue[i])
		if c.is_empty():
			continue
		var q_spot: Dictionary = _queue_spots[mini(i, _queue_spots.size() - 1)]
		_route_ground(c, q_spot)


func _call_next() -> void:
	for bi in range(baristas.size()):
		if queue.is_empty():
			break
		var b: Dictionary = baristas[bi]
		if int(b["customer_id"]) >= 0:
			continue
		var cid := int(queue.pop_front())
		var c := _find_customer(cid)
		if c.is_empty():
			continue
		c["phase"] = "toCounter"
		c["spot"] = bi
		_route_ground(c, _service_spots[bi % _service_spots.size()])
		b["customer_id"] = cid
		b["remaining"] = 0.0
		b["total"] = 0.0
		_relayout_queue()


func _on_customer_arrive(c: Dictionary) -> void:
	var p: String = c["phase"]
	if p == "toCounter":
		var bi := int(c["spot"])
		var b: Dictionary = baristas[bi]
		var order_id: String = c["order"]
		if not state.consume_serving(order_id):
			b["customer_id"] = -1
			c["spot"] = -1
			c["sold_out"] = true
			state.today["missed"] = int(state.today["missed"]) + 1
			state.today["sold_out"] = int(state.today["sold_out"]) + 1
			guest_walkout.emit(int(c["id"]), "soldOut")
			_start_exit(c)
			return
		var extra_id: String = c["extra"]
		if not extra_id.is_empty() and not state.consume_serving(extra_id):
			c["extra"] = ""
			extra_id = ""
		c["phase"] = "ordering"
		var prep := state.prep_time(order_id) + (state.prep_time(extra_id) if not extra_id.is_empty() else 0.0)
		b["total"] = prep
		b["remaining"] = prep

		var seat := _find_free_seat()
		if seat >= 0 and rng.next_float() < _base_seat_chance:
			seats[seat] = int(c["id"])
			c["seat"] = seat
			c["dine_in"] = true
			c["timer"] = _order_seconds
	elif p == "toSeat":
		c["phase"] = "waiting"
		c["timer"] = _base_table_patience


func _find_free_seat() -> int:
	var free: Array[int] = []
	for i in range(seats.size()):
		if seats[i] < 0:
			free.append(i)
	if free.is_empty():
		return -1
	return free[rng.next_int(free.size())]


func _charge(c: Dictionary) -> void:
	if bool(c["has_cup"]):
		return
	var bought: Array[String] = [str(c["order"])]
	var extra_id: String = c["extra"]
	if not extra_id.is_empty():
		bought.append(extra_id)
	var vip := bool(c["vip"])
	var amount := 0.0
	for item_id in bought:
		amount += state.sale_price(item_id, vip)
	state.earn(amount)
	state.served_total += 1
	state.today["served"] = int(state.today["served"]) + 1
	state.today["revenue"] = float(state.today["revenue"]) + amount
	var sales: Dictionary = state.today["sales"]
	for item_id in bought:
		sales[item_id] = int(sales.get(item_id, 0)) + 1
	c["has_cup"] = true
	sale_made.emit(amount, vip, int(c["id"]))


func _serve_at_counter(b: Dictionary, c: Dictionary) -> void:
	_charge(c)
	b["customer_id"] = -1
	c["spot"] = -1
	_start_exit(c)


func _send_to_pass(c: Dictionary, bi: int) -> void:
	var b: Dictionary = baristas[bi]
	if pass_plates.size() >= _pass_slots:
		if float(b["calling"]) <= 0.0:
			b["calling"] = _call_seconds
		return
	var plate_items: Array[String] = [str(c["order"])]
	if not str(c["extra"]).is_empty():
		plate_items.append(str(c["extra"]))
	pass_plates.append({
		"customer_id": int(c["id"]),
		"items": plate_items,
		"barista": bi,
		"server": -1,
		"waited": 0.0,
	})
	b["customer_id"] = -1
	b["calling"] = _call_seconds


func _drop_unclaimed_plate(customer_id: int) -> void:
	var kept: Array[Dictionary] = []
	for p in pass_plates:
		if int(p["customer_id"]) == customer_id and int(p["server"]) < 0:
			continue
		kept.append(p)
	pass_plates = kept


func _update_servers(dt: float) -> void:
	for p in pass_plates:
		if int(p["server"]) >= 0:
			continue
		p["waited"] = float(p["waited"]) + dt
		if float(p["waited"]) >= _ring_again:
			p["waited"] = 0.0
			var bi := int(p["barista"])
			if bi >= 0 and bi < baristas.size():
				baristas[bi]["calling"] = _call_seconds

	for si in range(servers.size()):
		var s: Dictionary = servers[si]
		_step_walker(s, dt, _server_speed)
		var resting := (s["path"] as Array).is_empty()
		var sp: String = s["phase"]
		if sp == "idle":
			var tray := _load_tray(_tray_plates)
			if tray.is_empty():
				continue
			for p in tray:
				p["server"] = si
			s["plates"] = tray
			s["phase"] = "toPass"
			_route_ground(s, _pass_spot)
		elif sp == "toPass" and resting:
			var remaining_pass: Array[Dictionary] = []
			var s_plates: Array = s["plates"]
			for p in pass_plates:
				if not s_plates.has(p):
					remaining_pass.append(p)
			pass_plates = remaining_pass
			_head_out(s, si)
		elif sp == "delivering" and resting:
			_deliver(s, si)
		elif sp == "returning" and resting:
			s["phase"] = "idle"


## Matches TS `Sim.loadTray`: picks the single most urgent open plate first,
## then fills the remaining tray slots in pass order (oldest first).
func _load_tray(limit: int) -> Array[Dictionary]:
	var open_plates: Array[Dictionary] = []
	for p in pass_plates:
		if int(p["server"]) < 0:
			open_plates.append(p)
	if open_plates.is_empty() or limit <= 0:
		return []
	var best_idx := 0
	var best_pat := _plate_patience(open_plates[0])
	for i in range(1, open_plates.size()):
		var pat := _plate_patience(open_plates[i])
		if pat < best_pat:
			best_pat = pat
			best_idx = i
	var out: Array[Dictionary] = [open_plates[best_idx]]
	for i in range(open_plates.size()):
		if out.size() >= limit:
			break
		if i == best_idx:
			continue
		out.append(open_plates[i])
	return out


func _plate_patience(plate: Dictionary) -> float:
	var c := _find_customer(int(plate["customer_id"]))
	if not c.is_empty() and c["phase"] == "waiting":
		return float(c["timer"])
	return INF


## Matches TS `Sim.headOut`: filters out walked-out orders, then sorts remaining
## tray plates nearest-table-first from the server's current position.
func _head_out(s: Dictionary, si: int) -> void:
	var valid_plates: Array = []
	for p in s["plates"]:
		var c := _find_customer(int(p["customer_id"]))
		if not c.is_empty() and int(c["seat"]) >= 0 and c["phase"] != "exiting":
			valid_plates.append(p)
	if not valid_plates.is_empty():
		var sx := float(s["x"])
		var sy := float(s["y"])
		valid_plates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
			return _plate_distance(a, sx, sy) < _plate_distance(b, sx, sy)
		)
		s["plates"] = valid_plates
		var first_c := _find_customer(int(valid_plates[0]["customer_id"]))
		var seat: Dictionary = _seat_spots[int(first_c["seat"])]
		var target := {"x": float(seat["x"]), "y": float(seat["aisle"]), "aisle": float(seat["aisle"])}
		s["phase"] = "delivering"
		_route_ground(s, target)
		return
	s["plates"] = valid_plates
	s["phase"] = "returning"
	_route_ground(s, _server_homes[si % _server_homes.size()])


func _plate_distance(plate: Dictionary, sx: float, sy: float) -> float:
	var c := _find_customer(int(plate["customer_id"]))
	if c.is_empty() or int(c["seat"]) < 0:
		return INF
	var seat: Dictionary = _seat_spots[int(c["seat"])]
	return Vector2(float(seat["x"]) - sx, float(seat["aisle"]) - sy).length()


func _deliver(s: Dictionary, si: int) -> void:
	var plates: Array = s["plates"]
	if plates.is_empty():
		_head_out(s, si)
		return
	var c := _find_customer(int(plates[0]["customer_id"]))
	if not c.is_empty() and (c["phase"] == "ordering" or c["phase"] == "toSeat"):
		return
	if not c.is_empty() and c["phase"] == "waiting":
		_charge(c)
		c["phase"] = "sitting"
		c["timer"] = _sit_min_seconds + rng.next_float() * _sit_range_seconds
		c["sit_clock"] = 0.0
	plates.pop_front()
	_head_out(s, si)


func _start_exit(c: Dictionary) -> void:
	var seat_idx := int(c["seat"])
	if seat_idx >= 0 and seat_idx < seats.size():
		if seats[seat_idx] == int(c["id"]):
			seats[seat_idx] = -1
	c["seat"] = -1
	c["phase"] = "exiting"
	_route_ground(c, _door_spot)


## Ground-floor waypoint routing matching floors-layout.ts `across()`.
func _route_ground(w: Dictionary, to_spot: Dictionary) -> void:
	var fx := float(w["x"])
	var fy := float(w["y"])
	var f_aisle := float(w["aisle"])
	var tx := float(to_spot["x"])
	var ty := float(to_spot["y"])
	var t_aisle := float(to_spot.get("aisle", _ground_aisle))

	var pts: Array[Vector2] = [
		Vector2(fx, f_aisle),
		Vector2(tx, t_aisle),
		Vector2(tx, ty),
	]
	var path: Array = []
	var last := Vector2(fx, fy)
	for pt in pts:
		if pt.distance_to(last) >= _route_min_step:
			path.append(pt)
			last = pt
	w["path"] = path
	w["aisle"] = t_aisle


func _step_walker(w: Dictionary, dt: float, spd: float) -> bool:
	var path: Array = w["path"]
	if path.is_empty():
		w["moving"] = false
		return false
	var left := spd * dt
	var reached_end := false
	while left > 0.0 and not path.is_empty():
		var target: Vector2 = path[0]
		var cx := float(w["x"])
		var cy := float(w["y"])
		var dx := target.x - cx
		var dy := target.y - cy
		var dist := sqrt(dx * dx + dy * dy)
		if absf(dx) >= absf(dy) * _walk_side_ratio:
			w["way"] = "side"
		elif dy > 0.0:
			w["way"] = "down"
		else:
			w["way"] = "up"
		if absf(dx) > _walk_flip_deadzone:
			w["facing_left"] = dx < 0.0
		if dist <= left:
			w["x"] = target.x
			w["y"] = target.y
			path.pop_front()
			left -= dist
			if path.is_empty():
				reached_end = true
		else:
			w["x"] = cx + (dx / dist) * left
			w["y"] = cy + (dy / dist) * left
			left = 0.0
	w["moving"] = not path.is_empty()
	return reached_end


func _find_customer(cid: int) -> Dictionary:
	for c in customers:
		if int(c["id"]) == cid:
			return c
	return {}
