extends SceneTree

## Headless automated test suite for Tiny Bean Café B0.
## Run via: godot --headless --path godot --script res://tests/run_tests.gd
## Exits with code 0 on all pass, code 1 on any failure.

var _passed: int = 0
var _failed: int = 0
var _errors: Array[String] = []


func _init() -> void:
	call_deferred("_run_all")


func _assert(cond: bool, msg: String) -> void:
	if cond:
		_passed += 1
	else:
		_failed += 1
		_errors.append(msg)
		printerr("FAIL: %s" % msg)


func _assert_near(a: float, b: float, eps: float, msg: String) -> void:
	_assert(absf(a - b) <= eps, "%s (got %s, expected %s)" % [msg, str(a), str(b)])


func _run_all() -> void:
	var data := GameData.new()
	_test_project_settings()
	_test_full_day_dine_in_and_vip(data)
	_test_server_delivery_load_tray_and_head_out(data)
	_test_stock_never_negative_and_sold_out_closes(data)
	_test_sold_out_customer_counted(data)
	_test_patience_walkout(data)
	_test_table_patience_walkout(data)
	_test_seed_reproducibility(data)
	_test_speed_1x_equals_4x(data)
	_test_finished_service_phases(data)
	_test_closing_waits_for_accepted_orders(data)
	_test_prep_drains_customers_and_servers(data)
	_test_menu_upgrade_cost_and_price(data)
	_test_restock_all_unlocked_drinks_and_budget_rules(data)
	_test_menu_panel_no_refresh_when_closed(data)
	_test_bench_runner_wall_clock_and_stall()
	_test_charset_in_i18n_and_fonts(data)
	await _test_live_scene_interactions()

	print("GODOT_TESTS_SUMMARY: passed=%d failed=%d" % [_passed, _failed])
	if _failed > 0:
		for e in _errors:
			printerr("  - %s" % e)
		quit(1)
	else:
		quit(0)


func _run_day_to_settlement(sim: CafeSim, state: CafeState, step_dt: float = 0.05) -> Dictionary:
	var reports: Array[Dictionary] = []
	var cb := func(r: Dictionary) -> void: reports.append(r)
	sim.day_finished.connect(cb)
	var ticks := 0
	while state.phase != "prep" and ticks < 12000:
		sim.step_fixed(step_dt)
		ticks += 1
	sim.day_finished.disconnect(cb)
	if reports.is_empty():
		return {}
	return reports[0]


func _test_project_settings() -> void:
	_assert(ProjectSettings.get_setting("application/config/quit_on_go_back") == false, "quit_on_go_back is disabled in project.godot")
	_assert(ProjectSettings.get_setting("application/config/auto_accept_quit") == false, "auto_accept_quit is disabled in project.godot")
	_assert(ProjectSettings.get_setting("application/run/delta_smoothing") == false, "delta_smoothing is disabled in project.godot")


func _test_full_day_dine_in_and_vip(data: GameData) -> void:
	var state := CafeState.new(data)
	var sim := CafeSim.new(data, state, 7)
	var acc := {"sum": 0.0, "count": 0, "dine_in_sitting": {}}
	sim.sale_made.connect(func(amount: float, _vip: bool, _cid: int) -> void:
		acc["sum"] = float(acc["sum"]) + amount
		acc["count"] = int(acc["count"]) + 1
	)
	_assert(data.format_clock(0.0) == "08:00", "clock starts at 08:00")
	_assert(data.format_clock(180.0) == "20:00", "clock ends at 20:00")
	_assert(state.open_shop(), "open_shop succeeds on starter state")

	var reports: Array[Dictionary] = []
	sim.day_finished.connect(func(r: Dictionary) -> void: reports.append(r))
	var ticks := 0
	while state.phase != "prep" and ticks < 12000:
		sim.step_fixed(0.05)
		for c in sim.customers:
			if bool(c["dine_in"]) and c["phase"] == "sitting":
				acc["dine_in_sitting"][int(c["id"])] = true
		ticks += 1

	_assert(not reports.is_empty(), "full day emits settlement report")
	var report: Dictionary = reports[0] if not reports.is_empty() else {}
	_assert(int(report.get("day", 0)) == 1, "report is for day 1")
	_assert(state.day == 2 and state.phase == "prep", "advances to day 2 prep after settlement")
	_assert(int(report["served"]) > 15, "serves realistic number of guests (>15, got %d)" % int(report["served"]))
	_assert(int(report["served"]) == int(acc["count"]), "served count equals sale event count")
	_assert_near(float(report["revenue"]), float(acc["sum"]), 0.001, "report revenue equals sum of all sale prices")
	_assert_near(state.coins, float(report["revenue"]), 0.001, "coins match earned revenue")
	_assert(float(report["duration"]) >= 180.0, "full day runs at least 180s to 20:00")
	_assert((acc["dine_in_sitting"] as Dictionary).size() >= 5, "multiple guests dine in and get served at tables (got %d)" % (acc["dine_in_sitting"] as Dictionary).size())
	_assert(int(report["table_lost"]) == 0, "starter day servers deliver without table walkouts")

	# Verify VIP pays 5x and appears across simulated seeds
	var vacc := {"seen": 0, "price_ok": true}
	for seed_i in range(1, 15):
		var vs := CafeState.new(data)
		var vsim := CafeSim.new(data, vs, seed_i)
		var base_p := vs.sale_price("espresso", false)
		var vip_p := vs.sale_price("espresso", true)
		_assert_near(vip_p, base_p * 5.0, 0.001, "VIP sale_price is 5x base")
		vsim.sale_made.connect(func(amt: float, is_vip: bool, _cid: int) -> void:
			if is_vip:
				vacc["seen"] = int(vacc["seen"]) + 1
				if absf(amt - vip_p) > 0.001:
					vacc["price_ok"] = false
		)
		vs.open_shop()
		_run_day_to_settlement(vsim, vs)
		if int(vacc["seen"]) > 0:
			break
	_assert(int(vacc["seen"]) > 0, "VIP customers spawn and pay across seeds")
	_assert(bool(vacc["price_ok"]), "VIP sales pay 5x price")


func _test_server_delivery_load_tray_and_head_out(data: GameData) -> void:
	# 1. Force 100% dine-in and verify servers deliver orders to seated guests
	var state := CafeState.new(data)
	state.pantry["beans"] = 200
	var sim := CafeSim.new(data, state, 21)
	sim._base_seat_chance = 1.0
	state.open_shop()
	var delivered := {}
	for _i in range(1200): # 60s
		sim.step_fixed(0.05)
		for c in sim.customers:
			if c["phase"] == "sitting" and bool(c["has_cup"]):
				delivered[int(c["id"])] = true
	_assert(delivered.size() >= 4, "servers actively deliver dine-in plates to sitting guests (got %d)" % delivered.size())
	_assert(int(state.today["served"]) >= 4, "dine-in deliveries record sales")
	_assert(int(state.today["table_lost"]) == 0, "no table walkouts when server delivers")

	# 2. loadTray: picks ONLY the single most urgent plate first, rest in pass order (NOT sorted by patience)
	var s2 := CafeState.new(data)
	var sim2 := CafeSim.new(data, s2, 1)
	sim2.customers = [
		{"id": 10, "phase": "waiting", "timer": 40.0, "seat": 0},
		{"id": 11, "phase": "waiting", "timer": 30.0, "seat": 1},
		{"id": 12, "phase": "waiting", "timer": 5.0, "seat": 2},
		{"id": 13, "phase": "waiting", "timer": 20.0, "seat": 3},
	]
	sim2.pass_plates = [
		{"customer_id": 10, "items": ["espresso"], "barista": 0, "server": -1, "waited": 0.0},
		{"customer_id": 11, "items": ["espresso"], "barista": 0, "server": -1, "waited": 0.0},
		{"customer_id": 12, "items": ["espresso"], "barista": 0, "server": -1, "waited": 0.0},
		{"customer_id": 13, "items": ["espresso"], "barista": 0, "server": -1, "waited": 0.0},
	]
	var tray := sim2._load_tray(3)
	_assert(tray.size() == 3, "loadTray respects tray limit 3")
	if tray.size() == 3:
		_assert(int(tray[0]["customer_id"]) == 12, "loadTray puts single most urgent plate first (id 12)")
		_assert(int(tray[1]["customer_id"]) == 10, "loadTray keeps remaining plates in pass order (2nd = id 10)")
		_assert(int(tray[2]["customer_id"]) == 11, "loadTray keeps remaining plates in pass order (3rd = id 11, not id 13)")

	# 3. headOut: always picks the nearest table from server's current position
	var srv: Dictionary = sim2.servers[0]
	srv["x"] = 1085.0 # pass x
	srv["y"] = 600.0
	srv["aisle"] = 622.0
	srv["plates"] = [
		{"customer_id": 10, "items": ["espresso"], "barista": 0, "server": 0, "waited": 0.0}, # seat 0 at x=446 (far)
		{"customer_id": 13, "items": ["espresso"], "barista": 0, "server": 0, "waited": 0.0}, # seat 3 at x=1244 (near)
	]
	sim2._head_out(srv, 0)
	_assert(srv["phase"] == "delivering", "headOut switches server to delivering")
	_assert(int(srv["plates"][0]["customer_id"]) == 13, "headOut delivers nearest table first (seat 3 at x=1244 before seat 0 at x=446)")


func _test_stock_never_negative_and_sold_out_closes(data: GameData) -> void:
	var state := CafeState.new(data)
	state.pantry["beans"] = 3
	var sim := CafeSim.new(data, state, 11)
	state.open_shop()
	var report := _run_day_to_settlement(sim, state)
	_assert(not report.is_empty(), "sold-out day settles cleanly")
	_assert(int(state.pantry["beans"]) == 0, "beans deplete to exactly 0, never negative")
	_assert(int(report["served"]) <= 3, "cannot serve more than 3 cups with 3 beans (got %d)" % int(report["served"]))
	_assert(float(report["duration"]) < 180.0, "sold-out shop auto-closes before 20:00")
	_assert(not state.has_service_supply(), "has_service_supply is false when beans == 0")
	for ing_id in state.pantry.keys():
		_assert(int(state.pantry[ing_id]) >= 0, "ingredient %s is non-negative" % str(ing_id))


func _test_sold_out_customer_counted(data: GameData) -> void:
	var state := CafeState.new(data)
	state.pantry["beans"] = 1
	var sim := CafeSim.new(data, state, 1)
	state.open_shop()
	var acc := {"sold_out_events": 0, "report": {}}
	sim.guest_walkout.connect(func(_cid: int, reason: String) -> void:
		if reason == "soldOut":
			acc["sold_out_events"] = int(acc["sold_out_events"]) + 1
	)
	sim.day_finished.connect(func(r: Dictionary) -> void:
		acc["report"] = r
	)
	# Put a customer walking directly to counter when beans are already 0 (e.g. last bean consumed by earlier guest).
	state.pantry["beans"] = 0
	var bspot: Dictionary = data.layout["service"][0]
	var c := {
		"id": 99,
		"appearance_id": 0,
		"art": "cast-00",
		"phase": "toCounter",
		"order": "espresso",
		"extra": "",
		"vip": false,
		"patience": 40.0,
		"spot": 0,
		"seat": -1,
		"timer": 0.0,
		"sit_clock": 0.0,
		"has_cup": false,
		"sold_out": false,
		"dine_in": false,
		"x": float(bspot["x"]) - 1.0,
		"y": float(bspot["y"]),
		"aisle": float(bspot["aisle"]),
		"path": [Vector2(float(bspot["x"]), float(bspot["y"]))],
		"facing_left": false,
		"moving": true,
		"way": "side",
	}
	sim.customers.append(c)
	sim.baristas[0]["customer_id"] = 99
	sim.step_fixed(0.05)
	_assert(int(acc["sold_out_events"]) == 1, "sold-out guest at counter emits guest_walkout('soldOut')")
	_assert(bool(c["sold_out"]), "sold-out guest flagged sold_out=true")
	var rep: Dictionary = acc["report"]
	if rep.is_empty():
		rep = sim.close_shop_now()
	_assert(int(rep.get("sold_out", 0)) == 1 and int(rep.get("missed", 0)) == 1, "report carries sold_out and missed counts (got sold_out=%s missed=%s)" % [str(rep.get("sold_out", -1)), str(rep.get("missed", -1))])


func _test_patience_walkout(data: GameData) -> void:
	var state := CafeState.new(data)
	state.items["pourover"] = 1 # 6s prep time
	state.on_menu = ["pourover"]
	state.pantry["beans"] = 200
	var sim := CafeSim.new(data, state, 3)
	sim._base_patience = 2.0
	state.open_shop()
	var acc := {
		"all_events": 0,
		"queue_events": 0,
		"all_ids": {},
		"queue_ids": {},
		"duplicate_walkout": false,
		"not_exiting_on_walkout": false,
	}
	sim.guest_walkout.connect(func(cid: int, reason: String) -> void:
		acc["all_events"] = int(acc["all_events"]) + 1
		var all_ids: Dictionary = acc["all_ids"]
		if all_ids.has(cid):
			acc["duplicate_walkout"] = true
		all_ids[cid] = true
		if reason == "queue":
			acc["queue_events"] = int(acc["queue_events"]) + 1
			(acc["queue_ids"] as Dictionary)[cid] = true
	)

	# Step manually so we can assert every walked-out guest immediately enters exiting and leaves queue.
	var reports: Array[Dictionary] = []
	var cb := func(r: Dictionary) -> void: reports.append(r)
	sim.day_finished.connect(cb)
	var ticks := 0
	while state.phase != "prep" and ticks < 12000:
		sim.step_fixed(0.05)
		for cid in (acc["queue_ids"] as Dictionary).keys():
			var c := sim._find_customer(int(cid))
			if not c.is_empty() and str(c["phase"]) != "exiting":
				acc["not_exiting_on_walkout"] = true
			if sim.queue.has(int(cid)):
				acc["not_exiting_on_walkout"] = true
		ticks += 1
	sim.day_finished.disconnect(cb)

	_assert(not reports.is_empty(), "patience walkout day settles cleanly")
	var report: Dictionary = reports[0] if not reports.is_empty() else {}
	var total_spawned := sim.next_id - 1
	var unique_walkouts := (acc["all_ids"] as Dictionary).size()
	var unique_queue_walkouts := (acc["queue_ids"] as Dictionary).size()

	_assert(int(acc["queue_events"]) > 0, "over-patience triggers queue guest_walkout events")
	_assert(not bool(acc["duplicate_walkout"]), "each guest emits guest_walkout at most once")
	_assert(not bool(acc["not_exiting_on_walkout"]), "every queue-timeout guest transitions immediately to exiting and leaves queue")
	_assert(int(report["missed"]) == int(acc["all_events"]), "report.missed (%d) equals total walkout events (%d)" % [int(report["missed"]), int(acc["all_events"])])
	_assert(int(report["missed"]) == unique_walkouts, "report.missed (%d) equals unique departed guest count (%d)" % [int(report["missed"]), unique_walkouts])
	_assert(int(report["queue_lost"]) == unique_queue_walkouts and unique_queue_walkouts > 0, "report.queue_lost (%d) equals unique queue walkout count (%d)" % [int(report["queue_lost"]), unique_queue_walkouts])
	_assert(int(report["served"]) + int(report["missed"]) <= total_spawned, "served + missed (%d) cannot exceed total spawned guests (%d)" % [int(report["served"]) + int(report["missed"]), total_spawned])

	# Drain prep and verify every walked-out guest physically exits the building.
	for _i in range(1200):
		sim.step_fixed(0.05)
	_assert(sim.customers.is_empty(), "all timed-out and seated guests leave building completely (left=%d)" % sim.customers.size())


func _test_table_patience_walkout(data: GameData) -> void:
	var state := CafeState.new(data)
	state.pantry["beans"] = 200
	var sim := CafeSim.new(data, state, 9)
	state.open_shop()
	var acc := {"table_walkouts": 0}
	sim.guest_walkout.connect(func(_cid: int, reason: String) -> void:
		if reason == "table":
			acc["table_walkouts"] = int(acc["table_walkouts"]) + 1
	)
	var seat0: Dictionary = data.layout["tables"][0][0]
	sim.seats[0] = 77
	var c := {
		"id": 77,
		"appearance_id": 1,
		"art": "cast-01",
		"phase": "waiting",
		"order": "espresso",
		"extra": "",
		"vip": false,
		"patience": 40.0,
		"spot": -1,
		"seat": 0,
		"timer": 1.5,
		"sit_clock": 0.0,
		"has_cup": false,
		"sold_out": false,
		"dine_in": true,
		"x": float(seat0["x"]),
		"y": float(seat0["y"]),
		"aisle": float(seat0["aisle"]),
		"path": [],
		"facing_left": false,
		"moving": false,
		"way": "side",
	}
	sim.customers.append(c)
	sim.spawn_timer = 999.0 # isolate this guest
	for _i in range(40): # 2.0s > 1.5s table patience
		sim.step_fixed(0.05)
	_assert(int(acc["table_walkouts"]) == 1, "table patience timeout emits guest_walkout('table')")
	_assert(int(state.today["table_lost"]) == 1, "today.table_lost increments on table walkout")
	_assert(int(state.today["missed"]) == 1, "today.missed increments on table walkout")
	_assert(sim.seats[0] == -1, "seat is freed after table patience walkout")
	_assert(c["phase"] == "exiting", "waiting guest transitions to exiting on table patience timeout")
	for _j in range(200): # 10s to walk out the door
		sim.step_fixed(0.05)
	_assert(sim._find_customer(77).is_empty(), "walked-out table guest exits building completely")


func _test_seed_reproducibility(data: GameData) -> void:
	var s1 := CafeState.new(data)
	var sim1 := CafeSim.new(data, s1, 42)
	s1.open_shop()
	var r1 := _run_day_to_settlement(sim1, s1)

	var s2 := CafeState.new(data)
	var sim2 := CafeSim.new(data, s2, 42)
	s2.open_shop()
	var r2 := _run_day_to_settlement(sim2, s2)

	_assert(int(r1["served"]) == int(r2["served"]), "same seed serves identical guest count")
	_assert_near(float(r1["revenue"]), float(r2["revenue"]), 0.0001, "same seed earns identical revenue")
	_assert(int(r1["missed"]) == int(r2["missed"]), "same seed has identical missed count")


func _snapshot_sim_and_state(sim: CafeSim, state: CafeState) -> String:
	var snap := {
		"state": {
			"coins": snappedf(state.coins, 0.0001),
			"total_earned": snappedf(state.total_earned, 0.0001),
			"served_total": state.served_total,
			"day": state.day,
			"day_time": snappedf(state.day_time, 0.0001),
			"phase": state.phase,
			"pantry": state.pantry,
		},
		"sim": {
			"next_id": sim.next_id,
			"spawn_timer": snappedf(sim.spawn_timer, 0.0001),
			"rng_state": sim.rng._state,
			"seats": sim.seats,
			"queue": sim.queue,
			"pass_plates": sim.pass_plates,
			"baristas": sim.baristas,
			"servers": sim.servers,
			"customers": sim.customers,
		},
	}
	return JSON.stringify(snap)


func _test_speed_1x_equals_4x(data: GameData) -> void:
	var seeds: Array[int] = [1, 2, 3, 5, 7, 11, 13, 19, 23, 29]
	var all_reports_match := true
	var all_states_match := true
	var all_events_match := true
	var all_faster := true

	for seed_val in seeds:
		var s1 := CafeState.new(data)
		s1.speed = 1
		var sim1 := CafeSim.new(data, s1, seed_val)
		s1.open_shop()
		var reps1: Array[Dictionary] = []
		var ev1: Array[String] = []
		sim1.day_finished.connect(func(r: Dictionary) -> void: reps1.append(r))
		sim1.sale_made.connect(func(amt: float, vip: bool, cid: int) -> void:
			ev1.append("sale:%d:%s:%.4f" % [cid, str(vip), amt])
		)
		sim1.guest_walkout.connect(func(cid: int, reason: String) -> void:
			ev1.append("out:%d:%s" % [cid, reason])
		)
		var frames1 := 0
		while s1.phase != "prep" and frames1 < 30000:
			sim1.advance(0.016)
			frames1 += 1

		var s4 := CafeState.new(data)
		s4.speed = 4
		var sim4 := CafeSim.new(data, s4, seed_val)
		s4.open_shop()
		var reps4: Array[Dictionary] = []
		var ev4: Array[String] = []
		sim4.day_finished.connect(func(r: Dictionary) -> void: reps4.append(r))
		sim4.sale_made.connect(func(amt: float, vip: bool, cid: int) -> void:
			ev4.append("sale:%d:%s:%.4f" % [cid, str(vip), amt])
		)
		sim4.guest_walkout.connect(func(cid: int, reason: String) -> void:
			ev4.append("out:%d:%s" % [cid, reason])
		)
		var frames4 := 0
		while s4.phase != "prep" and frames4 < 30000:
			sim4.advance(0.016)
			frames4 += 1

		if reps1.is_empty() or reps4.is_empty():
			all_reports_match = false
			continue
		if frames4 >= int(frames1 / 2):
			all_faster = false
		if JSON.stringify(reps1[0]) != JSON.stringify(reps4[0]):
			all_reports_match = false
			printerr("1x vs 4x report mismatch on seed %d:\n  1x=%s\n  4x=%s" % [seed_val, JSON.stringify(reps1[0]), JSON.stringify(reps4[0])])
		var snap1 := _snapshot_sim_and_state(sim1, s1)
		var snap4 := _snapshot_sim_and_state(sim4, s4)
		if snap1 != snap4:
			all_states_match = false
			printerr("1x vs 4x full state mismatch on seed %d" % seed_val)
		if ev1 != ev4:
			all_events_match = false
			printerr("1x vs 4x event stream mismatch on seed %d (1x=%d, 4x=%d)" % [seed_val, ev1.size(), ev4.size()])

	_assert(all_faster, "4x finishes in significantly fewer real frames than 1x across all %d seeds" % seeds.size())
	_assert(all_reports_match, "1x and 4x produce bit-identical settlement report JSON across all %d seeds" % seeds.size())
	_assert(all_states_match, "1x and 4x produce identical full CafeState and CafeSim snapshots across all %d seeds" % seeds.size())
	_assert(all_events_match, "1x and 4x produce identical ordered sale/walkout event streams across all %d seeds" % seeds.size())


func _test_finished_service_phases(data: GameData) -> void:
	var state := CafeState.new(data)
	var sim := CafeSim.new(data, state, 1)
	for active_phase in ["queue", "toCounter", "ordering", "toSeat", "waiting"]:
		sim.customers = [{"id": 1, "phase": active_phase}]
		_assert(not sim.finished_service(), "finished_service() must be false when a guest is in '%s'" % active_phase)
	for done_phase in ["sitting", "exiting"]:
		sim.customers = [{"id": 1, "phase": done_phase}]
		_assert(sim.finished_service(), "finished_service() must be true when guests are only '%s'" % done_phase)
	sim.customers = []
	_assert(sim.finished_service(), "finished_service() is true when empty")


func _test_closing_waits_for_accepted_orders(data: GameData) -> void:
	var state := CafeState.new(data)
	state.pantry["beans"] = 200
	var sim := CafeSim.new(data, state, 5)
	sim._base_seat_chance = 1.0 # ensure dine-in guest enters toSeat -> waiting across closing
	state.open_shop()
	var acc := {"settled": false}
	sim.day_finished.connect(func(_r: Dictionary) -> void: acc["settled"] = true)

	# Run until a dine-in guest is actively in toSeat or waiting, then trigger closing
	var triggered := false
	for _i in range(600):
		sim.step_fixed(0.05)
		for c in sim.customers:
			if c["phase"] == "toSeat" or c["phase"] == "waiting":
				sim.begin_closing()
				triggered = true
				break
		if triggered:
			break
	_assert(triggered, "found dine-in guest in toSeat/waiting before closing")
	_assert(state.phase == "closing", "shop entered closing phase")
	_assert(not sim.finished_service(), "finished_service is false while dine-in guest is toSeat/waiting")

	# Record next_id and force spawn_timer to expire during closing so any leaked arrival is caught immediately.
	var id_at_closing := sim.next_id
	var door_lost_at_closing := int(state.today["door_lost"])
	sim.spawn_timer = 0.0
	sim.step_fixed(0.05)
	_assert(not bool(acc["settled"]), "closing does not prematurely settle while dine-in guest waits")
	_assert(sim.next_id == id_at_closing, "closing admits no new guest even when spawn_timer expires (got %d vs %d)" % [sim.next_id, id_at_closing])
	_assert(sim.queue.is_empty(), "closing keeps queue empty")

	var leaked_in_closing := false
	var guard := 0
	while not bool(acc["settled"]) and guard < 2000:
		sim.step_fixed(0.05)
		if sim.next_id != id_at_closing or not sim.queue.is_empty():
			leaked_in_closing = true
		guard += 1
	_assert(not leaked_in_closing and sim.next_id == id_at_closing, "next_id stays unchanged throughout closing (start=%d end=%d)" % [id_at_closing, sim.next_id])
	_assert(int(state.last_report.get("door_lost", -1)) == door_lost_at_closing, "closing records no new door_lost arrivals")
	_assert(bool(acc["settled"]) and state.phase == "prep", "settles automatically once dine-in order is delivered")


func _test_prep_drains_customers_and_servers(data: GameData) -> void:
	var state := CafeState.new(data)
	state.pantry["beans"] = 200
	var sim := CafeSim.new(data, state, 42)
	sim._base_seat_chance = 1.0
	state.open_shop()
	# Run 45s so multiple guests are sitting/walking and server is active
	for _i in range(900):
		sim.step_fixed(0.05)
	_assert(sim.customers.size() > 0, "guests present before settlement")
	var rep := sim.close_shop_now()
	_assert(not rep.is_empty() and state.phase == "prep", "settled into prep phase")
	_assert(sim.customers.size() > 0, "sitting/exiting guests still in café immediately after settlement")

	# Advance 60 seconds in prep using advance() (same path as main._process)
	for _f in range(1200):
		sim.advance(0.05)

	_assert(sim.customers.is_empty(), "all guests clear out within 60s during prep (left=%d)" % sim.customers.size())
	for s in sim.servers:
		_assert(s["phase"] == "idle", "servers walk back to idle during prep (got %s)" % str(s["phase"]))
	_assert_near(state.day_time, 0.0, 0.0001, "day_time stays 0 during prep")
	_assert(int(state.today["served"]) == 0 and int(state.today["missed"]) == 0, "prep drain records no phantom sales or misses")


func _test_menu_upgrade_cost_and_price(data: GameData) -> void:
	var state := CafeState.new(data)
	state.coins = 5000.0
	var p1 := state.item_price("espresso", 1)
	_assert_near(p1, 3.0, 0.001, "espresso Lv1 price is $3")

	var q1 := state.quote_item("espresso", 1)
	_assert_near(float(q1["cost"]), 89.6, 0.01, "espresso Lv1->2 cost matches TS formula ($89.6)")
	var before_coins := state.coins
	_assert(state.buy_item("espresso", 1), "buy_item succeeds for espresso Lv1->2")
	_assert(int(state.items["espresso"]) == 2, "espresso level increments to 2")
	_assert_near(state.coins, before_coins - float(q1["cost"]), 0.01, "exact coins deducted on level up")

	var p2 := state.item_price("espresso", 2)
	_assert(p2 > p1, "leveling up raises price")
	_assert_near(p2, 6.0 * (1.0 + 0.8 / 9.0), 0.001, "espresso Lv2 price matches TS milestone progression")

	_assert(state.is_item_available("americano"), "americano available after espresso unlocked")
	_assert(not state.is_item_available("latte"), "latte locked until americano unlocked")
	var qa := state.quote_item("americano", 1)
	_assert_near(float(qa["cost"]), 40.0, 0.001, "americano unlock cost is $40")
	_assert(state.buy_item("americano", 1), "americano unlocks cleanly")
	_assert(int(state.items["americano"]) == 1, "americano is now Lv1")
	_assert(state.set_on_menu("americano", true), "unlocked americano can be toggled on menu")
	_assert(state.on_menu.has("americano"), "americano is on menu")


func _test_restock_all_unlocked_drinks_and_budget_rules(data: GameData) -> void:
	# 1. Unlock mocha (beans+milk+cocoa) and matcha (matcha+milk), restock buys every needed ingredient
	var state := CafeState.new(data)
	state.items["mocha"] = 1
	state.items["matcha"] = 1
	state.on_menu = ["espresso", "mocha", "matcha"]
	state.pantry["beans"] = 0
	state.pantry["milk"] = 0
	state.pantry["cocoa"] = 0
	state.pantry["matcha"] = 0
	state.coins = 5000.0

	var needed_ids: Array[String] = []
	for ing in state.needed_ingredients():
		needed_ids.append(str(ing["id"]))
	_assert(needed_ids.has("cocoa") and needed_ids.has("matcha") and needed_ids.has("milk"), "needed_ingredients includes cocoa, matcha, milk")

	var q := state.restock_quote()
	var q_buy: Dictionary = q["buy"]
	_assert(int(q_buy.get("beans", 0)) > 0, "restock_quote includes beans")
	_assert(int(q_buy.get("milk", 0)) > 0, "restock_quote includes milk")
	_assert(int(q_buy.get("cocoa", 0)) > 0, "restock_quote includes cocoa")
	_assert(int(q_buy.get("matcha", 0)) > 0, "restock_quote includes matcha")
	var before_coins := state.coins
	var expected_cost := float(q["cost"])
	_assert(state.restock(), "full restock succeeds")
	_assert_near(before_coins - state.coins, expected_cost, 0.01, "restock deducts exact quoted total price")
	_assert(state.servings_left("mocha") > 0 and state.servings_left("matcha") > 0, "unlocked mocha & matcha both have stock after restock")

	# 2. Low-cash proportional + single-recipe fallback (TS restockPlan rule)
	var low := CafeState.new(data)
	low.items["matcha"] = 1
	low.on_menu = ["espresso", "matcha"]
	low.pantry["beans"] = 0
	low.pantry["milk"] = 0
	low.pantry["matcha"] = 0
	low.coins = 1.0 # cannot cover proportional forecast, only 1 bean ($1) for 1 espresso
	var plan := low.restock_plan()
	_assert(int((plan["buy"] as Dictionary).get("beans", 0)) == 1, "scarce cash fallback buys 1 complete cheapest recipe (1 bean)")
	_assert_near(float(plan["cost"]), 1.0, 0.001, "scarce cash plan shows exact $1 cost")
	_assert(low.restock(), "scarce cash restock succeeds")
	_assert(low.servings_left("espresso") == 1 and low.coins < 0.001, "scarce cash restock restores sellable espresso")


func _test_menu_panel_no_refresh_when_closed(data: GameData) -> void:
	var state := CafeState.new(data)
	var panel := MenuPanel.new()
	var theme := data.create_paper_theme()
	panel.setup(data, state, theme)
	_assert(not panel.visible, "menu panel starts closed")

	# Before ever opening: control texts must not be touched while closed
	var snap0 := panel.snapshot_control_texts()
	state.coins = 1234.0
	state.locale = "en"
	panel.refresh_if_open()
	panel.refresh_if_open()
	_assert(panel.get_refresh_count() == 0, "menu panel does NOT refresh while closed initially")
	_assert(panel.snapshot_control_texts() == snap0, "menu panel control texts untouched while closed initially")

	# Open panel -> texts populate
	state.locale = "zh"
	panel.open_panel()
	_assert(panel.visible and panel.get_refresh_count() == 1, "menu panel refreshes when opened")
	var snap_open := panel.snapshot_control_texts()
	_assert(str(snap_open["title"]) == data.t("zh", "tab.menu"), "opened panel displays localized title")

	# Close panel -> mutate every state field -> refresh_if_open must change NOTHING
	panel.close_panel()
	state.locale = "en"
	state.coins = 99999.0
	state.pantry["beans"] = 777
	state.items["espresso"] = 9
	state.phase = "open"
	panel.refresh_if_open()
	panel.refresh_if_open()
	_assert(panel.get_refresh_count() == 1, "menu panel refresh count unchanged while closed")
	_assert(panel.snapshot_control_texts() == snap_open, "menu panel control texts strictly unchanged while closed")

	# Re-open -> now updates to English & Lv 9
	panel.open_panel()
	var snap_reopen := panel.snapshot_control_texts()
	_assert(str(snap_reopen["title"]) == data.t("en", "tab.menu"), "re-opened panel updates title to en")
	_assert(str((snap_reopen["rows"] as Dictionary)["espresso"]["name"]).contains("Lv 9"), "re-opened panel updates item level")
	panel.free()


func _test_bench_runner_wall_clock_and_stall() -> void:
	# Tests must NEVER touch the real user://bench.json file.
	var real_bench_existed := FileAccess.file_exists(BenchRunner.BENCH_PATH)
	var real_bench_before := ""
	if real_bench_existed:
		var rf := FileAccess.open(BenchRunner.BENCH_PATH, FileAccess.READ)
		if rf != null:
			real_bench_before = rf.get_as_text()
			rf.close()

	var test_bench_path := "user://bench_unit_test.json"
	if FileAccess.file_exists(test_bench_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(test_bench_path))

	# 1. Inject a real 80ms wall-clock stall and verify p50 / max / >25ms + pacing self-check
	var br := BenchRunner.new()
	br.output_path = test_bench_path
	br.refresh_rate_override = 60.0
	br.start("full", 0.22, 0.0, 12.5)
	br.sample() # baseline / upload frame
	var stalled := false
	var done := false
	var guard := 0
	while not done and guard < 100:
		if guard == 5 and not stalled:
			OS.delay_msec(80)
			stalled = true
		else:
			OS.delay_msec(8)
		done = br.sample()
		guard += 1
	_assert(done, "BenchRunner completes on wall clock")
	var r := br.last_result()
	_assert(float(r["frame_ms_max"]) >= 70.0 and float(r["frame_ms_max"]) <= 200.0, "injected 80ms wall-clock stall reported accurately (got %s ms)" % str(r["frame_ms_max"]))
	_assert(int(r["frames_over_25ms"]) >= 1, "injected 80ms stall counted in frames_over_25ms")
	_assert(float(r["frame_ms_p50"]) < 30.0, "normal ~8ms frames keep p50 low (got %s ms)" % str(r["frame_ms_p50"]))
	_assert_near(float(r["load_ms"]), 12.5, 0.01, "load_ms reported separately")
	_assert(r.has("vsync_mode") and not str(r["vsync_mode"]).is_empty(), "bench result includes vsync_mode")
	_assert(r.has("refresh_rate_hz"), "bench result includes refresh_rate_hz")
	_assert(r.has("renderer") and not str(r["renderer"]).is_empty(), "bench result includes renderer name")
	_assert(FileAccess.file_exists(test_bench_path), "BenchRunner writes to configured test output_path")

	# 2. Pacing self-check: super-refresh data flagged, normal data clean, unknown refresh -> null + unchecked
	var p_over := BenchRunner.evaluate_pacing(119.0, 60.0)
	_assert(bool(p_over["pacing_invalid"]) and bool(p_over["pacing_checked"]) and float(p_over["refresh_rate_hz"]) == 60.0, "119 fps on 60 Hz display flagged pacing_invalid=true")
	var p_edge := BenchRunner.evaluate_pacing(63.1, 60.0)
	_assert(bool(p_edge["pacing_invalid"]), "63.1 fps (>1.05x 60 Hz) flagged pacing_invalid=true")
	var p_ok := BenchRunner.evaluate_pacing(60.0, 60.0)
	_assert(not bool(p_ok["pacing_invalid"]) and bool(p_ok["pacing_checked"]) and str(p_ok["pacing_status"]) == "ok", "60 fps on 60 Hz display is pacing_invalid=false")
	var p_margin := BenchRunner.evaluate_pacing(62.5, 60.0)
	_assert(not bool(p_margin["pacing_invalid"]), "62.5 fps (<=1.05x 60 Hz) is not flagged invalid")
	var p_zero := BenchRunner.evaluate_pacing(60.0, 0.0)
	_assert(p_zero["refresh_rate_hz"] == null and not bool(p_zero["pacing_checked"]) and not bool(p_zero["pacing_invalid"]) and str(p_zero["pacing_status"]) == "unchecked", "refresh_rate <= 0 writes null and marks unchecked")
	var p_neg := BenchRunner.evaluate_pacing(60.0, -1.0)
	_assert(p_neg["refresh_rate_hz"] == null and not bool(p_neg["pacing_checked"]), "negative refresh_rate writes null and marks unchecked")

	# End-to-end BenchRunner with synthetic high-FPS vs 60 Hz vs 240 Hz vs unavailable refresh
	var br_fast := BenchRunner.new()
	br_fast.output_path = ""
	br_fast.refresh_rate_override = 60.0
	br_fast.start("full", 0.12, 0.0, 0.0)
	br_fast.sample()
	var g_fast := 0
	var done_fast := false
	while not done_fast and g_fast < 200:
		OS.delay_msec(4) # ~200+ fps >> 63 fps
		done_fast = br_fast.sample()
		g_fast += 1
	var r_fast := br_fast.last_result()
	_assert(done_fast and float(r_fast["avg_fps"]) > 63.0 and bool(r_fast["pacing_invalid"]), "end-to-end super-refresh bench run sets pacing_invalid=true (fps=%s)" % str(r_fast["avg_fps"]))

	var br_norm := BenchRunner.new()
	br_norm.output_path = ""
	br_norm.refresh_rate_override = 240.0
	br_norm.start("full", 0.12, 0.0, 0.0)
	br_norm.sample()
	var g_norm := 0
	var done_norm := false
	while not done_norm and g_norm < 100:
		OS.delay_msec(10) # ~100 fps << 252 fps
		done_norm = br_norm.sample()
		g_norm += 1
	var r_norm := br_norm.last_result()
	_assert(done_norm and not bool(r_norm["pacing_invalid"]) and bool(r_norm["pacing_checked"]), "end-to-end normal bench run keeps pacing_invalid=false (fps=%s vs 240Hz)" % str(r_norm["avg_fps"]))

	var br_unk := BenchRunner.new()
	br_unk.output_path = ""
	br_unk.refresh_rate_override = -1.0
	br_unk.start("full", 0.10, 0.0, 0.0)
	br_unk.sample()
	var g_unk := 0
	var done_unk := false
	while not done_unk and g_unk < 100:
		OS.delay_msec(10)
		done_unk = br_unk.sample()
		g_unk += 1
	var r_unk := br_unk.last_result()
	_assert(done_unk and r_unk["refresh_rate_hz"] == null and not bool(r_unk["pacing_checked"]), "end-to-end unknown refresh rate writes null and unchecked")

	# 3. Stall during warmup is excluded from measured samples
	var br2 := BenchRunner.new()
	br2.output_path = test_bench_path
	br2.refresh_rate_override = 240.0
	br2.start("half", 0.12, 0.12, 5.0)
	br2.sample() # baseline
	OS.delay_msec(60) # stall during warmup!
	br2.sample()
	OS.delay_msec(70) # finish warmup
	br2.sample() # transitions warmup -> sampling
	var done2 := false
	var g2 := 0
	while not done2 and g2 < 100:
		OS.delay_msec(8)
		done2 = br2.sample()
		g2 += 1
	var r2 := br2.last_result()
	_assert(done2, "BenchRunner with warmup finishes cleanly")
	_assert(int(r2["frames_over_25ms"]) == 0 and float(r2["frame_ms_max"]) < 35.0, "warmup stall is excluded from sampled frames (max=%s, slow=%s)" % [str(r2["frame_ms_max"]), str(r2["frames_over_25ms"])])

	# Clean up test file and assert real user://bench.json was NOT created or modified.
	if FileAccess.file_exists(test_bench_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(test_bench_path))
	var real_bench_now_exists := FileAccess.file_exists(BenchRunner.BENCH_PATH)
	if not real_bench_existed:
		_assert(not real_bench_now_exists, "tests did not create real user://bench.json")
	else:
		var rf2 := FileAccess.open(BenchRunner.BENCH_PATH, FileAccess.READ)
		var real_bench_after := rf2.get_as_text() if rf2 != null else ""
		if rf2 != null:
			rf2.close()
		_assert(real_bench_after == real_bench_before, "tests did not modify real user://bench.json")


func _test_live_scene_interactions() -> void:
	# Set headless window to portrait phone size (412x915) so input coordinates match 1:1.
	root.size = Vector2i(412, 915)
	await process_frame

	var packed: PackedScene = load("res://scenes/main.tscn")
	_assert(packed != null, "main.tscn loads cleanly")
	if packed == null:
		return
	var main := packed.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	# 1. Speed button via real `pressed` signal
	_assert(main.state.speed == 1 and main._speed_btn.text == "1×", "initial speed is 1×")
	main._speed_btn.pressed.emit()
	_assert(main.state.speed == 2 and main._speed_btn.text == "2×", "speed button pressed cycles 1× -> 2×")
	main._speed_btn.pressed.emit()
	_assert(main.state.speed == 4 and main._speed_btn.text == "4×", "speed button pressed cycles 2× -> 4×")
	main._speed_btn.pressed.emit()
	_assert(main.state.speed == 1 and main._speed_btn.text == "1×", "speed button pressed wraps 4× -> 1×")

	# 2. Android Back handling for every overlay + root no-quit
	main._on_open_menu()
	_assert(main.menu_panel.visible, "menu opened before back test")
	main.notification(Node.NOTIFICATION_WM_GO_BACK_REQUEST)
	_assert(not main.menu_panel.visible and main.building_view.drag_enabled, "Back closes menu and restores drag")

	main._report_overlay.visible = true
	main.building_view.drag_enabled = false
	main.notification(Node.NOTIFICATION_WM_GO_BACK_REQUEST)
	_assert(not main._report_overlay.visible and main.building_view.drag_enabled, "Back closes day report overlay")

	main._on_open_benchmark()
	_assert(main._bench_overlay.visible and not main.safe_root.visible, "benchmark overlay opened")
	main.notification(Node.NOTIFICATION_WM_GO_BACK_REQUEST)
	_assert(not main._bench_overlay.visible and main.safe_root.visible, "Back exits benchmark overlay")

	var res: String = main.handle_back_request()
	_assert(res == "noop" or res == "minimized", "Back with no overlay does not quit (got %s)" % res)
	await process_frame

	# 2b. Bench preset restoration after running half preset and exiting
	main._on_open_benchmark()
	main.bench_runner.output_path = ""
	main._start_benchmark("half", 0.5, 0.0)
	_assert(main.building_view.preset == "half" and main.state.art_preset == "half", "benchmark switches to half preset")
	main._exit_benchmark()
	_assert(main.building_view.preset == "full" and main.state.art_preset == "full", "exiting benchmark restores full art preset")

	# 2c. Bench overlay pacing warning UI (zh & en)
	main._on_open_benchmark()
	main.bench_runner._last_result = {
		"preset": "full", "renderer": "gl_compatibility", "device": "Test", "resolution": "412x915",
		"vsync_mode": "disabled", "refresh_rate_hz": 60.0, "pacing_invalid": true, "pacing_checked": true,
		"load_total_ms": 10.0, "avg_fps": 119.2, "frame_ms_p50": 8.0, "frame_ms_p95": 13.0, "frame_ms_max": 16.0,
		"frames_over_25ms": 0, "frames": 3500, "draw_calls_avg": 40.0, "video_mem_mb": 20.0, "texture_mem_mb": 18.0, "static_mem_mb": 30.0,
	}
	main.state.locale = "zh"
	main._refresh_bench_ui()
	_assert(main._bench_warning_box.visible and main._bench_warning_lbl.text.contains("119.2"), "bench UI shows prominent zh pacing warning when pacing_invalid=true")
	main.state.locale = "en"
	main._refresh_bench_ui()
	_assert(main._bench_warning_box.visible and main._bench_warning_lbl.text.contains("WARNING"), "bench UI shows prominent en pacing warning when pacing_invalid=true")
	main.bench_runner._last_result["pacing_invalid"] = false
	main._refresh_bench_ui()
	_assert(not main._bench_warning_box.visible, "bench UI hides pacing warning when pacing is valid")
	main.bench_runner._last_result["refresh_rate_hz"] = null
	main.bench_runner._last_result["pacing_checked"] = false
	main._refresh_bench_ui()
	_assert(main._bench_warning_box.visible and main._bench_metrics.text.contains("Unknown"), "bench UI notes unchecked pacing when refresh_rate_hz is null")
	main.bench_runner._last_result = {}
	main.state.locale = "zh"
	main._exit_benchmark()
	await process_frame

	# 3. Menu touch scroll starting from a card (real InputEventScreenTouch + InputEventScreenDrag via Input)
	main.state.coins = 250.0
	main._on_open_menu()
	await process_frame
	await process_frame
	var scroll: ScrollContainer = main.menu_panel._scroll
	var list_box: VBoxContainer = main.menu_panel._list_box
	_assert(list_box.size.y > scroll.size.y, "menu list overflows ScrollContainer vertically")
	_assert(scroll.scroll_vertical == 0, "menu starts at scroll_vertical == 0")

	var row0: Dictionary = main.menu_panel._rows["espresso"]
	var name_lbl: Label = row0["name"]
	var start_pt: Vector2 = name_lbl.get_global_rect().get_center()
	var scroll_rect := scroll.get_global_rect()
	_assert(scroll_rect.has_point(start_pt), "espresso card label center is inside ScrollContainer")

	var t_down := InputEventScreenTouch.new()
	t_down.index = 0
	t_down.pressed = true
	t_down.position = start_pt
	Input.parse_input_event(t_down)
	await process_frame

	var cur_pt := start_pt
	for _step in range(6):
		cur_pt += Vector2(0.0, -30.0)
		var drag := InputEventScreenDrag.new()
		drag.index = 0
		drag.position = cur_pt
		drag.relative = Vector2(0.0, -30.0)
		Input.parse_input_event(drag)
		await process_frame

	var t_up := InputEventScreenTouch.new()
	t_up.index = 0
	t_up.pressed = false
	t_up.position = cur_pt
	Input.parse_input_event(t_up)
	await process_frame

	_assert(scroll.scroll_vertical > 50, "touch drag starting on card text scrolls menu list (scroll_vertical=%d)" % scroll.scroll_vertical)

	# Verify buttons on cards remain clickable (unlock americano)
	var buy_btn: Button = main.menu_panel._rows["americano"]["buy"]
	_assert(not buy_btn.disabled, "americano unlock button is enabled with $250")
	buy_btn.pressed.emit()
	_assert(int(main.state.items.get("americano", 0)) == 1, "card button remains clickable and unlocks americano")
	main.menu_panel.close_panel()
	await process_frame

	# 4. Building floor drag 1:1 (real Input pipeline with touch->mouse & mouse->touch emulation active)
	var bv: BuildingView = main.building_view
	bv.drag_enabled = true
	bv.camera_moved = true
	bv.focus_y = 2200.0
	bv.update_camera_fit()
	var zoom_y := bv.camera.zoom.y
	var y0 := bv.focus_y

	var b_down := InputEventScreenTouch.new()
	b_down.device = 0
	b_down.index = 0
	b_down.pressed = true
	b_down.position = Vector2(206.0, 500.0)
	Input.parse_input_event(b_down)
	await process_frame

	var b_drag := InputEventScreenDrag.new()
	b_drag.device = 0
	b_drag.index = 0
	b_drag.position = Vector2(206.0, 400.0)
	b_drag.relative = Vector2(0.0, -100.0)
	Input.parse_input_event(b_drag)
	await process_frame

	var b_up := InputEventScreenTouch.new()
	b_up.device = 0
	b_up.index = 0
	b_up.pressed = false
	b_up.position = Vector2(206.0, 400.0)
	Input.parse_input_event(b_up)
	await process_frame

	var expected_touch_dy := 100.0 / zoom_y
	_assert_near(bv.focus_y - y0, expected_touch_dy, 1.0, "building touch drag moves 1:1 (not 2x)")

	# Desktop mouse drag 1:1
	var y1 := bv.focus_y
	var m_down := InputEventMouseButton.new()
	m_down.device = 0
	m_down.button_index = MOUSE_BUTTON_LEFT
	m_down.pressed = true
	m_down.position = Vector2(206.0, 500.0)
	Input.parse_input_event(m_down)
	await process_frame

	var m_move := InputEventMouseMotion.new()
	m_move.device = 0
	m_move.button_mask = MOUSE_BUTTON_MASK_LEFT
	m_move.position = Vector2(206.0, 420.0)
	m_move.relative = Vector2(0.0, -80.0)
	Input.parse_input_event(m_move)
	await process_frame

	var m_up := InputEventMouseButton.new()
	m_up.device = 0
	m_up.button_index = MOUSE_BUTTON_LEFT
	m_up.pressed = false
	m_up.position = Vector2(206.0, 420.0)
	Input.parse_input_event(m_up)
	await process_frame

	var expected_mouse_dy := 80.0 / zoom_y
	_assert_near(bv.focus_y - y1, expected_mouse_dy, 1.0, "building desktop mouse drag moves 1:1")

	# 5. Menu layout matrix: en/zh x starter/3-unlocked/all-unlocked x widths 360, 412, 480
	await _test_menu_layout_matrix(main)

	# 6. Safe area margins on MenuPanel
	main.menu_panel.open_panel()
	root.size = Vector2i(412, 915)
	main.menu_panel.set_safe_margins(18.0, 44.0, 20.0, 34.0)
	await process_frame
	await process_frame
	var sheet_safe: Rect2 = main.menu_panel._sheet.get_global_rect()
	_assert(sheet_safe.position.y >= 43.5 and sheet_safe.end.y <= 915.0 - 33.5, "menu panel respects top/bottom safe area margins (y=%s..%s)" % [str(sheet_safe.position.y), str(sheet_safe.end.y)])
	_assert(sheet_safe.position.x >= 17.5 and sheet_safe.end.x <= 412.0 - 19.5, "menu panel respects left/right safe area margins (x=%s..%s)" % [str(sheet_safe.position.x), str(sheet_safe.end.x)])
	main.menu_panel.close_panel()
	main._apply_safe_area()
	await process_frame

	# 7. Real main scene _process prep drain (catches skipping sim.advance during prep in main.gd)
	main.state.reset_to_starter()
	main.state.pantry["beans"] = 200
	main.sim.reset(42)
	main.sim._base_seat_chance = 1.0
	main.state.open_shop()
	for _i in range(900):
		main.sim.step_fixed(0.05)
	_assert(main.sim.customers.size() > 0, "main scene has active customers before settlement")
	var prep_rep: Dictionary = main.sim.close_shop_now()
	_assert(not prep_rep.is_empty() and main.state.phase == "prep", "main scene settled into prep")
	main._report_overlay.visible = false
	main.building_view.drag_enabled = true
	_assert(main.sim.customers.size() > 0, "sitting/exiting guests remain right after settlement in main scene")
	for _f in range(1200):
		main._process(0.05)
	_assert(main.sim.customers.is_empty(), "main scene _process drains all customers during prep (left=%d)" % main.sim.customers.size())
	for srv in main.sim.servers:
		_assert(str(srv["phase"]) == "idle", "main scene _process returns servers to idle during prep (got %s)" % str(srv["phase"]))
	_assert_near(main.state.day_time, 0.0, 0.0001, "main scene prep drain keeps day_time at 0")
	_assert(int(main.state.today["served"]) == 0 and int(main.state.today["missed"]) == 0, "main scene prep drain records no phantom sales/misses")

	# 8. Opening shop immediately after settlement must NOT clear still-seated guests (matches TS openShop)
	main.state.reset_to_starter()
	main.state.pantry["beans"] = 200
	main.sim.reset(21)
	main.sim._base_seat_chance = 1.0
	main.state.open_shop()
	var seated_before: Dictionary = {}
	for _k in range(1200):
		main.sim.step_fixed(0.05)
		seated_before.clear()
		for c in main.sim.customers:
			if str(c["phase"]) == "sitting":
				seated_before[int(c["id"])] = int(c["seat"])
		if seated_before.size() >= 2:
			break
	_assert(seated_before.size() >= 2, "found seated guests before Day 1 close (count=%d)" % seated_before.size())
	main.sim.close_shop_now()
	main._report_overlay.visible = false
	_assert(main.state.phase == "prep" and main.state.day == 2, "settled into Day 2 prep")
	var day2_double_charged := {"count": 0}
	var on_d2_sale := func(_amt: float, _vip: bool, cid: int) -> void:
		if seated_before.has(cid):
			day2_double_charged["count"] = int(day2_double_charged["count"]) + 1
	main.sim.sale_made.connect(on_d2_sale)
	# Immediately open Day 2 via primary shop button without waiting for prep drain!
	main._on_primary_shop_btn()
	_assert(main.state.phase == "open" and main.state.day == 2, "primary shop button opens Day 2 immediately")
	var preserved_all := true
	for cid in seated_before.keys():
		var c: Dictionary = main.sim._find_customer(int(cid))
		if c.is_empty() or str(c["phase"]) != "sitting" or int(c["seat"]) != int(seated_before[cid]):
			preserved_all = false
	_assert(preserved_all, "opening Day 2 preserves still-seated Day 1 guests without resetting sim")
	# Advance 35s of Day 2 so Day 1's seated guests finish sitting and walk out naturally
	for _m in range(700):
		main.sim.step_fixed(0.05)
	var all_finished := true
	for cid in seated_before.keys():
		if not main.sim._find_customer(int(cid)).is_empty():
			all_finished = false
	main.sim.sale_made.disconnect(on_d2_sale)
	_assert(all_finished, "preserved Day 1 seated guests finish sitting and exit naturally during Day 2")
	_assert(int(day2_double_charged["count"]) == 0, "preserved Day 1 seated guests are never charged twice on Day 2")

	main.queue_free()
	await process_frame


func _test_menu_layout_matrix(main: Node) -> void:
	var drink_ids: Array[String] = []
	for m in main.data.menu_list:
		if not bool(m.get("requiresKitchen", false)):
			drink_ids.append(str(m["id"]))

	var widths: Array[int] = [360, 412, 480]
	var locales: Array[String] = ["en", "zh"]
	var tiers: Array[String] = ["starter", "three", "all"]
	var violations: Array[String] = []

	var orig_scale_size: Vector2i = root.content_scale_size
	for w in widths:
		var h := 780 if w == 360 else (915 if w == 412 else 960)
		root.content_scale_size = Vector2i(w, h)
		root.size = Vector2i(w, h)
		main._apply_safe_area()
		await process_frame
		var vp_w: float = main.get_viewport_rect().size.x
		for loc in locales:
			for tier in tiers:
				main.state.reset_to_starter()
				main.state.locale = loc
				if tier == "three":
					main.state.coins = 5000.0
					for i in range(mini(3, drink_ids.size())):
						main.state.items[drink_ids[i]] = 1
						main.state.set_on_menu(drink_ids[i], true)
					main.state.pantry["beans"] = 0
					main.state.pantry["milk"] = 0
				elif tier == "all":
					main.state.coins = 500000.0
					for id in drink_ids:
						main.state.items[id] = 1
						main.state.set_on_menu(id, true)
					for ing in main.data.ingredients_list:
						main.state.pantry[str(ing["id"])] = 0
				else:
					main.state.coins = 250.0

				main.menu_panel.open_panel()
				await process_frame
				await process_frame

				var tag := "%s/%s/%dw(vp=%.0f)" % [loc, tier, w, vp_w]
				var sheet: PanelContainer = main.menu_panel._sheet
				var sheet_r: Rect2 = sheet.get_global_rect()
				if sheet_r.position.x < -0.5 or sheet_r.end.x > vp_w + 0.5:
					violations.append("%s: _sheet x=%.1f..%.1f > %.1f" % [tag, sheet_r.position.x, sheet_r.end.x, vp_w])

				var close_btn: Button = main.menu_panel._close_btn
				var restock_btn: Button = main.menu_panel._restock_btn
				for pair in [["close", close_btn], ["restock", restock_btn]]:
					var bname: String = pair[0]
					var btn: Button = pair[1]
					var br: Rect2 = btn.get_global_rect()
					var bmin: Vector2 = btn.get_combined_minimum_size()
					if br.end.x > vp_w + 0.5 or br.end.x > sheet_r.end.x + 0.5:
						violations.append("%s: %s btn end.x=%.1f > viewport/sheet (%.1f)" % [tag, bname, br.end.x, minf(vp_w, sheet_r.end.x)])
					if btn.size.x + 0.5 < bmin.x or btn.clip_text:
						violations.append("%s: %s btn clipped size=%.1f < min=%.1f text='%s'" % [tag, bname, btn.size.x, bmin.x, btn.text])

				for item_id in main.menu_panel._rows.keys():
					var row: Dictionary = main.menu_panel._rows[item_id]
					var card: PanelContainer = row["card"]
					var cr: Rect2 = card.get_global_rect()
					if cr.end.x > vp_w + 0.5 or cr.end.x > sheet_r.end.x + 0.5:
						violations.append("%s: card[%s] end.x=%.1f > %.1f" % [tag, item_id, cr.end.x, minf(vp_w, sheet_r.end.x)])
					for bkey in ["toggle", "buy"]:
						var btn: Button = row[bkey]
						if not btn.visible:
							continue
						var br: Rect2 = btn.get_global_rect()
						var bmin: Vector2 = btn.get_combined_minimum_size()
						if br.end.x > vp_w + 0.5 or br.end.x > sheet_r.end.x + 0.5:
							violations.append("%s: %s[%s] end.x=%.1f > %.1f (text='%s')" % [tag, bkey, item_id, br.end.x, minf(vp_w, sheet_r.end.x), btn.text])
						if btn.size.x + 0.5 < bmin.x or btn.clip_text:
							violations.append("%s: %s[%s] clipped size=%.1f < min=%.1f (text='%s')" % [tag, bkey, item_id, btn.size.x, bmin.x, btn.text])
					for lkey in ["name", "meta", "stock"]:
						var lbl: Label = row[lkey]
						var lr: Rect2 = lbl.get_global_rect()
						var lmin: Vector2 = lbl.get_combined_minimum_size()
						if lr.end.x > sheet_r.end.x + 0.5:
							violations.append("%s: %s[%s] end.x=%.1f > sheet %.1f" % [tag, lkey, item_id, lr.end.x, sheet_r.end.x])
						if lbl.clip_text or lbl.text_overrun_behavior != TextServer.OVERRUN_NO_TRIMMING:
							violations.append("%s: %s[%s] has clipping/truncation enabled" % [tag, lkey, item_id])
						if lbl.size.y + 0.5 < lmin.y:
							violations.append("%s: %s[%s] vertical clip size.y=%.1f < min.y=%.1f" % [tag, lkey, item_id, lbl.size.y, lmin.y])

				main.menu_panel.close_panel()

	if not violations.is_empty():
		for v in violations.slice(0, 12):
			printerr("  layout violation: %s" % v)
	_assert(violations.is_empty(), "menu panel fits inside 360/412/480 viewports with unclipped buttons & prices across en/zh x starter/3/all (%d violations)" % violations.size())
	root.content_scale_size = orig_scale_size
	root.size = Vector2i(412, 915)
	main._apply_safe_area()


func _test_charset_in_i18n_and_fonts(data: GameData) -> void:
	_assert(FileAccess.file_exists("res://fonts/nunito-latin.ttf"), "nunito-latin.ttf exists")
	_assert(FileAccess.file_exists("res://fonts/noto-sans-sc.ttf"), "noto-sans-sc.ttf exists")
	_assert(FileAccess.file_exists("res://fonts/OFL-Nunito.txt"), "OFL-Nunito.txt exists")
	_assert(FileAccess.file_exists("res://fonts/OFL-NotoSansSC.txt"), "OFL-NotoSansSC.txt exists")
	_assert(data.t("zh", "app.title") == "小豆咖啡馆", "zh app.title loaded from i18n.json")
	_assert(data.t("en", "app.title") == "Tiny Bean Café", "en app.title loaded from i18n.json")
