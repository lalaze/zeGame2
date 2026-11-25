class_name CoreGameSession
extends RefCounted

## The running café: what src/main.ts does between the rules and the screen. Every frame, the business day, the
## manager, coming and going, and saving. Functions keep main.ts's names and order.
##
## The screen is told what happened through `ui`, in the order main.ts would touch the page; it must react at once, so
## a dialog opened by a signal already counts as open for the rest of the frame. What the screen shows comes in
## through the plain variables below.

signal ui(what: String, args: Array)

const HINT_KEY := "tiny-bean-cafe/hint-done"
## Shown once per kind, the first time a guest has a moment for the player.
const MOMENT_HINT_KEY := "tiny-bean-cafe/moment-hint-"
const AUTOSAVE_SECONDS := 5.0
## Seconds the manager waits in an idle, closed café before opening the next day.
const MANAGER_DELAY := 4.0
const SIM_STEP := 0.05
const _UI_SECONDS := 0.25

# ---------------------------------------------------------------- what the screen says

var startup_complete := false
var drawer_paused := false
var modal_open := false
var onboarding_open := false
## The app is in the background.
var hidden := false
var panel_collapsed := true
var arranging := false
var mobile_hud_expanded := false
var street_open := false
var guide_simplify := false
## "stock" or "menu" while the first day's guide is at that step.
var guide_opening_step: Variant = null
var scene_area := "main"
var overview := false
var panning := false

## Text for a key, as `t(key, params)`; and names of dishes and spans of time.
var translate := func(key: String, params: Dictionary = {}) -> String: return key if params.is_empty() else key + JsJson.stringify(params)
var item_name := func(id: String) -> String: return id
var duration := func(seconds: float) -> String: return JsMath.number_to_string(seconds)

# ---------------------------------------------------------------- the café

var session: CoreSaveSession
var storage: CoreStorage.GuardedStorage
var state: Dictionary
var sim: CoreSim
## Optional service moments; never saved, never run while the café is paused.
var moments: CoreMoments.MomentDirector
var cats: CoreLivingCats
var monitor := CoreOperations.OperationMonitor.new()
var status: Dictionary = {"kind": "steady"}
## Whether the screen holds still: guests' thoughts and the cats stop with it.
var scene_paused := true
## Whether saving is stuck: "conflict" or "unavailable", else empty. The café waits behind this notice.
var notice := ""
var hint_shown := false
## Countdown before the manager opens a quiet, closed café, and whether it is running right now.
var manager_wait := MANAGER_DELAY
var manager_counting := false
var unsettled_furniture := 0.0
var _cued_moment: Variant = null
## Away time is measured from the last save made while the café was on screen. Until the away earnings from the
## previous visit are settled, saves leave that time untouched.
var _away_settled := false
## A catering order that finishes on screen is announced once.
var _announced_order := 0.0
var _ui_timer := 0.0
var _autosave := AUTOSAVE_SECONDS
## Milliseconds of a frame the autosave may take; 0 writes it at once, as the page does.
var autosave_slice := 0.0


func _init(save_session: CoreSaveSession, guarded: CoreStorage.GuardedStorage, moment_rng: Callable, cat_rng: Callable) -> void:
	session = save_session
	storage = guarded
	state = session.state
	sim = session.sim
	moments = CoreMoments.MomentDirector.new(moment_rng)
	cats = CoreLivingCats.new(cat_rng)
	unsettled_furniture = settle_furniture()


func _ui(what: String, args: Array = []) -> void:
	ui.emit(what, args)


func _toast(key: String, params: Dictionary = {}) -> void:
	_ui("toast", [translate.call(key, params)])


## The building has spots of its own for furniture: pieces on the old room's grid move to them.
func settle_furniture() -> float:
	return CoreFurniture.settle_in_building(state)


## The building always draws rooms of the same height.
func fit_scene() -> void:
	var previous := CoreLayout.scene_height()
	CoreLayout.set_scene_height(CoreLayout.MIN_SCENE_H)
	if previous != CoreLayout.scene_height():
		sim.resize_scene(previous)


## Back to the café's own room.
func _select_main() -> void:
	_ui("area", ["main"])
	scene_area = "main"
	overview = false
	update_day_hud()


## The management panel folds away.
func _collapse_panel() -> void:
	panel_collapsed = true
	_ui("panel")


## Once, when the first frame can be drawn.
func start() -> void:
	startup_complete = true
	_ui("refresh")
	if state["profile"] == null:
		start_onboarding()
	settle_away()
	var moved := CoreState.consume_furniture_moves_on_load(state)
	if moved > 0.0:
		save_game()
		_toast("toast.furnitureMovedOnLoad", {"n": moved})
	if unsettled_furniture > 0.0:
		save_game()
		_toast("toast.furnitureSettled", {"n": unsettled_furniture})
	if session.migrated_street_shops:
		save_game()
		_toast("street.migrated" if state["phase"] == "prep" else "street.migratingAfterClose")


func save_game() -> String:
	if _away_settled and not hidden:
		state["manager"]["lastSeen"] = CoreClock.now()
	var result := session.save(state)
	_saved(result)
	return result


func _saved(result: String) -> void:
	if result == "conflict" or result == "unavailable":
		notice = result
	elif result == "saved":
		notice = ""
	_ui("saved", [result])


## Real seconds go by, paused or not.
func advance_autosave(dt: float) -> void:
	if session.has_begun():
		var result := session.step(autosave_slice)
		if not result.is_empty():
			_saved(result)
	_autosave -= dt
	while _autosave <= 1e-9:
		_autosave += AUTOSAVE_SECONDS
		if not startup_complete:
			continue
		if autosave_slice <= 0.0:
			save_game()
		elif not session.has_begun():
			if _away_settled and not hidden:
				state["manager"]["lastSeen"] = CoreClock.now()
			session.begin(state)


func close() -> void:
	save_game()
	session.close()


# ---------------------------------------------------------------- one frame

func frame(dt: float) -> void:
	# Paused while a dialog (like the day report) is up or the app is in the background; sped up when the player asks.
	var paused := drawer_paused or not startup_complete or not session.active or not notice.is_empty() or modal_open or hidden or onboarding_open
	var sim_dt := 0.0
	if not paused:
		sim_dt = dt * state["speed"] if state["phase"] != "prep" else dt
	var was_open: bool = state["phase"] == "open"
	var remaining := sim_dt
	while remaining > 1e-6:
		var events := sim.update(state, minf(SIM_STEP, remaining))
		if not events.is_empty():
			_ui("events", [events])
		remaining -= SIM_STEP
	if was_open and state["phase"] == "closing":
		_doors_closed()
	if not paused and not modal_open and state["phase"] == "closing" and sim.finished_service():
		var report: Variant = sim.close_shop(state)
		if report != null:
			if CoreManager.manager_runs_days(state):
				manager_report(report)
			else:
				show_report(report)
	manager_tick(dt, paused)
	_update_moments(sim_dt, 0.0 if paused else dt)
	# Settlement can open a dialog in this frame.
	scene_paused = paused or modal_open
	if not street_open:
		cats.update(state, 0.0 if scene_paused else dt, sim.customers, sim.servers)
	_ui_timer -= dt
	if _ui_timer <= 0.0:
		_ui_timer = _UI_SECONDS
		# Milestones reached by buying or growing (a room, comfort) show up straight away.
		var reached := CoreMilestones.check_milestones(state)
		if not reached.is_empty():
			var names := PackedStringArray(reached.map(func(id: String) -> String: return translate.call("milestone.%s" % id, {})))
			_toast("milestone.toast.reached", {"name": translate.call("list.sep", {}).join(names)})
		_ui("tick")
		update_day_hud()


func _doors_closed() -> void:
	save_game()
	update_day_hud()
	var sold_out: bool = state["dayTime"] < CoreData.DAY_SECONDS
	if sold_out and CoreManager.manager_runs_days(state) and CoreManager.manager_restock(state) and sim.resume_after_restock(state):
		save_game()
		_ui("refresh")
		update_day_hud()
		_toast("manager.restocked")
		return
	_toast("toast.soldOutClosing" if sold_out else "toast.hoursClosing")
	if sold_out and not CoreManager.manager_runs_days(state):
		_ui("soldOut")


## The player restocks from the sold-out dialog and the doors open again.
func sold_out_resume() -> void:
	if CoreEconomy.restock(state):
		sim.resume_after_restock(state)
		save_game()
		_ui("refresh")
		update_day_hud()


func sold_out_finish() -> void:
	save_game()


func _update_moments(sim_dt: float, real_dt: float) -> void:
	moments.update(state, sim, sim_dt, real_dt, moment_stage())
	if moments.active != null and not (_cued_moment != null and is_same(moments.active, _cued_moment)):
		var key: String = MOMENT_HINT_KEY + moments.active["kind"]
		if not JsUtil.truthy(storage.preference(key)):
			_toast("moment.hint.%s" % moments.active["kind"])
			storage.set_preference(key, "1")
	_cued_moment = moments.active


## What the player can see right now, for choosing where a moment may start.
func moment_stage() -> Dictionary:
	var area: Variant = null if overview or panning else scene_area
	var list := []
	if state["pets"].is_empty():
		# The visiting cat on the windowsill.
		if area is String and area == "main":
			list.append({"id": "window", "x": CoreLayout.CAT_SPOT["x"], "y": CoreLayout.CAT_SPOT["y"], "area": "main", "sill": true})
		return {"area": area, "cats": list}
	# Awake residents standing still in this room.
	for cat: Dictionary in cats.actors.values():
		if not (area is String and cat["area"] == area and cat["route"].is_empty() and not cat.has("interaction") and not cat["resting"]):
			continue
		for p: Dictionary in state["pets"]:
			if p["id"] == cat["id"] and CorePets.pet_active(p):
				list.append({"id": cat["id"], "x": cat["x"], "y": cat["y"], "area": cat["area"]})
				break
	return {"area": area, "cats": list}


## The status bar: what is holding the café up, and whether to show the first hint.
func update_day_hud() -> void:
	_ui("hud")
	var open: bool = state["phase"] != "prep"
	status = monitor.update(state, sim)
	if not open:
		monitor.reset()
	hint_shown = open and not guide_simplify and not JsUtil.truthy(storage.preference(HINT_KEY))


## What the open button counts down to, or null.
func manager_countdown() -> Variant:
	return JsMath.js_max(1.0, ceil(manager_wait)) if manager_counting and state["phase"] == "prep" else null


# ---------------------------------------------------------------- the business day

func set_speed(speed: float) -> void:
	state["speed"] = speed if CoreData.SPEEDS.has(speed) else 1.0
	update_day_hud()


## The only way to open: prepare today's menu, then confirm.
func prepare_day() -> void:
	if state["phase"] != "prep":
		return
	var only_espresso := true
	for item: Dictionary in CoreEconomy.unlocked_items(state):
		only_espresso = only_espresso and item["id"] == "espresso"
	if guide_opening_step != null and not state["kitchen"] and only_espresso:
		_collapse_panel()
		_ui("firstOpening", [guide_opening_step])
	else:
		_ui("prepare")


## After the preparation dialog bought or chose something.
func stock_changed() -> void:
	save_game()
	_ui("refresh")


func start_day() -> void:
	if state["phase"] != "prep" or CoreEconomy.menu_items(state).is_empty():
		return
	var baked := CoreDay.open_shop(state)
	save_game()
	if baked > 0.0:
		_toast("toast.openedBaked", {"n": state["day"], "baked": baked})
	else:
		_toast("toast.opened", {"n": state["day"]})
	_ui("sparkles", [16])
	_ui("refresh")
	update_day_hud()


## The manager's morning: forecast bake, restock and open, or stop and say why.
func manager_start_day() -> void:
	var result := CoreManager.manager_open(state)
	if not result["ok"]:
		state["manager"]["auto"] = false
		save_game()
		_ui("refresh")
		update_day_hud()
		_toast("manager.noSupply")
		return
	save_game()
	_toast("manager.opened", {"n": state["day"]})
	_ui("sparkles", [16])
	_ui("refresh")
	update_day_hud()


## The manager opens the next day after a short wait in a quiet, closed café; any pause, dialog, open management
## panel, arrangement or first-day guide holds them back.
func manager_tick(dt: float, paused: bool) -> void:
	if not paused:
		_settle_legacy_interior()
		_announce_ready_order()
		_tick_cat_gifts()
	var idle: bool = (CoreManager.manager_runs_days(state) and state["phase"] == "prep" and not paused and state["profile"] != null
		and panel_collapsed and not arranging and guide_opening_step == null and not mobile_hud_expanded)
	manager_counting = idle
	if not idle:
		manager_wait = MANAGER_DELAY
		return
	manager_wait -= dt
	if manager_wait <= 0.0:
		manager_wait = MANAGER_DELAY
		manager_start_day()


## With the manager running days, only a trial result or new milestones open the report.
func manager_report(report: Dictionary) -> void:
	if JsUtil.truthy(report.get("trialSale")) or not report.get("newMilestones", []).is_empty():
		show_report(report)
		return
	save_game()
	_ui("refresh")
	update_day_hud()
	_toast("manager.dayDone", {"n": report["day"], "money": CoreFormat.format_money(report["profit"])})


func show_report(report: Dictionary) -> void:
	save_game()
	_ui("refresh")
	update_day_hud()
	_ui("report", [report])


## After the report's trial card bought or chose something.
func trial_result_changed() -> void:
	save_game()
	_ui("refresh")
	update_day_hud()


## The report's button for the next day.
func next_day() -> void:
	if not CoreManager.manager_runs_days(state):
		prepare_day()


## The player ends the day: the doors shut and the books are settled.
func close_day(confirmed: bool = false) -> void:
	if state["phase"] == "open" and not confirmed:
		# Closing cannot be undone and sits beside the speed buttons, so the player is asked first.
		_ui("modal", [translate.call("day.closeConfirm.title", {}), [translate.call("day.closeConfirm.body", {
			"clock": CoreBusinessClock.format_business_clock(state["dayTime"]),
			"time": duration.call(CoreBusinessClock.business_seconds(JsMath.js_max(0.0, CoreData.DAY_SECONDS - state["dayTime"]))),
		})]])
	elif state["phase"] == "open":
		sim.begin_closing(state)
		save_game()
		update_day_hud()
	elif state["phase"] == "closing":
		_ui("modal", [translate.call("day.finishNow", {}), [translate.call("day.discard", {})]])


## Confirmed: the guests still inside leave now.
func finish_now() -> void:
	var report: Variant = sim.close_shop(state)
	if report != null:
		show_report(report)


# ---------------------------------------------------------------- real time

## Resident cats leave gifts on the windowsills in real time.
func _tick_cat_gifts() -> void:
	var brought: Array = CoreCatGifts.bring_gifts(state, CoreClock.now()) if state["profile"] != null else []
	if brought.is_empty():
		return
	save_game()
	_toast("gift.arrived", {"cat": translate.call("pet.%s.name" % brought[0]["cat"], {})})


func pick_up_gift(id: float) -> void:
	var picked: Variant = CoreCatGifts.collect_gift(state, id)
	if picked == null:
		return
	_ui("tipAtGift", [id, picked["amount"]])
	save_game()
	_ui("refresh")
	var gift: Dictionary = picked["gift"]
	var text: String = translate.call("gift.collected", {"cat": translate.call("pet.%s.name" % gift["cat"], {}), "gift": translate.call("gift.%s" % gift["kind"], {}), "money": CoreFormat.format_money(picked["amount"])})
	_ui("toast", [text + (" " + translate.call("gift.first", {}) if picked["first"] else "")])


func _announce_ready_order() -> void:
	var order: Variant = state["orders"]["active"]
	if order == null or order["finishAt"] == _announced_order or not CoreOrders.order_ready(state, CoreClock.now()):
		return
	_announced_order = order["finishAt"]
	_toast("orders.readyToast", {"name": translate.call("orders.%s" % order["kind"], {})})
	_ui("refresh")


## Keeps an old service intact until closing, then retires its connected rooms.
func _settle_legacy_interior() -> void:
	if state["phase"] != "prep" or not CoreStreets.migrate_indoor_shops(state, CoreClock.now()):
		return
	sim.reset()
	cats.reset()
	save_game()
	_ui("refresh")
	_select_main()
	update_day_hud()


## The app goes to the background, or comes back.
func set_hidden(value: bool) -> void:
	hidden = value
	if hidden:
		leave_cafe()
	elif startup_complete:
		settle_away()


## The café leaves the screen: start the away clock and save.
func leave_cafe() -> void:
	if _away_settled:
		state["manager"]["lastSeen"] = CoreClock.now()
	_away_settled = false
	save_game()


## Empties the till: what the manager and the franchises earned since the café was last on screen.
func settle_away() -> void:
	if not session.active:
		return
	var now := CoreClock.now()
	# Franchise pay waits in the till for a real absence (or the Collect button), not every switch of apps.
	var away_seconds := JsMath.js_max(0.0, (now - state["manager"]["lastSeen"]) / 1000.0)
	var was_away := away_seconds >= CoreManager.AWAY_MIN_SECONDS
	var away := CoreManager.collect_away_earnings(state, now)
	var franchise := CoreChain.collect_franchises(state, now) if was_away else 0.0
	var order: Variant = CoreOrders.collect_order(state, now) if was_away else null
	if order != null:
		_announced_order = order["finishAt"]
	var street_ready := 0.0
	if was_away:
		for id: String in CoreStreets.street_lot_ids(state):
			if CoreStreets.street_production(state, id, now)["batches"] > 0.0:
				street_ready += 1.0
	var gifts: float = float(CoreCatGifts.bring_gifts(state, now).size()) if was_away and state["profile"] != null else 0.0
	_away_settled = true
	save_game()
	if away["amount"] <= 0.0 and franchise <= 0.0 and order == null and street_ready == 0.0 and gifts == 0.0 or state["profile"] == null:
		return
	_ui("refresh")
	update_day_hud()
	var lines := _away_lines(away_seconds, away, franchise, order, street_ready, gifts)
	if modal_open or onboarding_open:
		_ui("toast", [" ".join(PackedStringArray(lines.slice(1)))])
	else:
		_ui("modal", [translate.call("away.title", {}), lines])


func _away_lines(away_seconds: float, away: Dictionary, franchise: float, order: Variant, street_ready: float, gifts: float) -> Array:
	var payout: float = order["payout"] if order != null else 0.0
	var parts := [away["amount"], franchise, payout].filter(func(n: float) -> bool: return n > 0.0)
	var lines := [translate.call("away.body", {"time": duration.call(away_seconds)})]
	if away["amount"] > 0.0:
		lines.append(translate.call("away.till", {"money": CoreFormat.format_money(away["amount"]), "pct": JsMath.js_round(away["fill"] * 100.0)}))
	if franchise > 0.0:
		lines.append(translate.call("away.franchise", {"money": CoreFormat.format_money(franchise)}))
	if order != null:
		lines.append(translate.call("away.order", {"name": translate.call("orders.%s" % order["kind"], {}), "money": CoreFormat.format_money(payout)}))
	if parts.size() > 1:
		var total := 0.0
		for n: float in parts:
			total = n if total == 0.0 else total + n
		lines.append(translate.call("away.total", {"money": CoreFormat.format_money(total)}))
	if away["welcome"] > 0.0:
		lines.append(translate.call("away.welcome", {"money": CoreFormat.format_money(away["welcome"])}))
	if away["full"]:
		lines.append(translate.call("away.full", {"hours": CoreManager.till_seconds(state) / 3600.0, "pct": JsMath.js_round(CoreManager.OVERFLOW_SHARE * 100.0)}))
	if street_ready > 0.0:
		lines.append(translate.call("street.awayReady", {"n": street_ready}))
	if gifts > 0.0:
		lines.append(translate.call("away.gifts", {"n": float(state["catGifts"]["waiting"].size())}))
	return lines


# ---------------------------------------------------------------- the player's hand

## After the management panel bought or claimed something.
func panel_changed(kind: String, id: String) -> void:
	# A new table takes its spot (and the next one is reserved): clear any furniture in the way.
	if kind == "upgrade" and id == "tables":
		if arranging:
			_ui("arrange")
		var moved := CoreFurniture.evict_blocked(state, CoreRegions.main_table_count(state))
		if moved > 0.0:
			_toast("toast.evicted", {"n": moved})
	save_game()
	_ui("sparkles", [14 if kind == "goal" else 5])
	if kind == "goal":
		_toast("goal.claimed", {"reward": CoreFormat.format_money(JsMath.parse_float(id))})
	# A claimed chapter gives the café a new title.
	if kind == "milestone":
		_ui("brand")


## Answers the waiting moment. Only a recommendation asks anything more.
func open_moment() -> void:
	var moment: Variant = moments.active
	if moment == null or state["phase"] != "open" or arranging or panning or overview or not interaction_enabled():
		return
	match moment["kind"]:
		"greet":
			var guest_name: Variant = moments.greet(state, sim)
			if guest_name == null:
				return
			CoreMilestones.record_moment_answered(state)
			_toast("moment.greet.toast", {"name": translate.call(guest_name, {})})
		"cat":
			var cat_id: Variant = moment["spot"]["catId"]
			var coins: Variant = moments.tidy(state)
			if coins == null:
				return
			CoreMilestones.record_moment_answered(state)
			# The culprit gets a fuss anyway.
			if cats.actors.has(cat_id):
				pet_resident_cat(cat_id)
			else:
				_ui("petCat", [null])
			_ui("tipAtMoment", [coins])
			_toast("moment.cat.toast", {"money": CoreFormat.format_money(coins)})
		"photo":
			_ui("flashAtMoment")
			var coins: Variant = moments.photo(state, sim)
			if coins == null:
				return
			CoreMilestones.record_moment_answered(state)
			_ui("tipAtMoment", [coins])
			_toast("moment.photo.toast", {"money": CoreFormat.format_money(coins)})
		"delivery":
			var gift: Variant = moments.sign_delivery(state)
			if gift == null:
				return
			CoreMilestones.record_moment_answered(state)
			_ui("flashAtMoment")
			_toast("moment.delivery.toast", {"item": item_name.call(gift["item"]), "n": gift["servings"]})
		_:
			for c: Dictionary in sim.customers:
				if c["id"] == moment["customerId"]:
					_ui("recommend", [c["id"], moment["options"]])
					return


## The dish the player recommends; null lets the guest choose.
func answer_recommendation(item: Variant) -> void:
	if item == null:
		moments.dismiss()
		return
	var verdict: Variant = moments.recommend(state, sim, item)
	if verdict == null:
		return
	CoreMilestones.record_moment_answered(state)
	save_game()
	_toast("moment.recommend.toast.%s" % verdict)


func pet_resident_cat(id: String) -> bool:
	if not cats.actors.has(id) or not cats.interact(id):
		return false
	_ui("petCat", [id])
	return true


func greet_resident(id: String) -> void:
	if pet_resident_cat(id):
		_toast("pet.living.greeted", {"name": translate.call("pet.%s.name" % id, {})})
	else:
		_toast("pet.living.needsCare")


## Where a cat is right now, even while the café is paused; null when it is not in.
func locate_resident(id: String) -> Variant:
	cats.update(state, 0.0, sim.customers, sim.servers)
	if not cats.actors.has(id):
		return null
	_collapse_panel()
	_toast("pet.living.located", {"name": translate.call("pet.%s.name" % id, {})})
	return cats.actors[id]


func interaction_enabled() -> bool:
	return session.active and not (modal_open or drawer_paused) and not hidden and notice.is_empty() and not onboarding_open


func service_help_allowed() -> bool:
	return interaction_enabled() and not arranging and not panning and not overview and state["phase"] != "prep"


## What the player can do to help right now: {"kind", "title", "detail", "customerId"?, "index"?}.
func service_help_options() -> Array:
	var options := []
	if state["phase"] == "prep" or not sim.help_ready():
		return options
	for i in sim.baristas.size():
		if sim.is_brewing(i) and not sim.is_holding(i):
			options.append({"kind": "brew", "title": translate.call("flow.helpBrew", {}), "detail": translate.call("flow.helpBrewDetail", {})})
			break
	var trial_item: Variant = CoreTrialSales.trial_sale_item(state)
	if state["phase"] != "open":
		return options
	var index := 0
	for customer: Dictionary in sim.queue_choices():
		var item: String = item_name.call(customer["order"])
		if JsUtil.truthy(customer["extra"]):
			item += " + " + item_name.call(customer["extra"])
		var marked := item + " ★" if JsUtil.truthy(customer.get("vip")) else item
		if trial_item != null and sim.can_offer_trial_to(state, customer["id"]):
			options.append({"kind": "trial", "title": translate.call("flow.helpTrial", {"item": item_name.call(trial_item), "n": index + 1.0}), "detail": translate.call("flow.helpTrialDetail", {}), "customerId": customer["id"]})
		var first := index == 0
		options.append({
			"kind": "queue", "title": translate.call("flow.helpComfort", {}) if first else translate.call("flow.helpQueue", {"n": index + 1.0}),
			"detail": "%s · %s" % [translate.call("flow.helpOrder", {"item": marked}), translate.call("flow.helpComfortDetail" if first else "flow.helpQueueDetail", {"seconds": CoreSim.QUEUE_HELP_PATIENCE})],
			"customerId": customer["id"], "first": first, "item": marked,
		})
		index += 1
	return options


func perform_help(option: Dictionary) -> bool:
	match option["kind"]:
		"brew":
			var helped := help_brew()
			if helped:
				_toast("flow.helpBrewToast")
			return helped
		"trial":
			if not service_help_allowed():
				return false
			var trial_item: Variant = CoreTrialSales.trial_sale_item(state)
			if not sim.offer_trial_to(state, option["customerId"]):
				return false
			_ui("assist", [translate.call("flow.helpTrialEffect", {}), option["customerId"]])
			save_game()
			_toast("flow.helpTrialToast", {"item": item_name.call(trial_item)})
			return true
	if not service_help_allowed() or not sim.prioritize_queue(state, option["customerId"]):
		return false
	_ui("assist", [translate.call("flow.helpQueueEffect", {"seconds": CoreSim.QUEUE_HELP_PATIENCE}), option["customerId"]])
	save_game()
	_toast("flow.helpComfortToast" if option["first"] else "flow.helpQueueToast", {"item": option["item"], "seconds": CoreSim.QUEUE_HELP_PATIENCE})
	return true


## The room and the dock share one cooldown and the same visible feedback.
func help_brew() -> bool:
	if not service_help_allowed():
		return false
	var brewing := []
	for i in sim.baristas.size():
		if sim.is_brewing(i) and not sim.is_holding(i):
			brewing.append(sim.barista_pose(i))
	if not sim.boost():
		return false
	for pose: Dictionary in brewing:
		_ui("assist", [translate.call("flow.helpBrewEffect", {}), pose])
	if hint_shown:
		hint_shown = false
		storage.set_preference(HINT_KEY, "1")
	return true


# ---------------------------------------------------------------- another café

func start_branch(location: String) -> void:
	var next: Variant = CoreChain.open_branch(state, location, CoreClock.now())
	if next == null:
		return
	if arranging:
		arranging = false
		_ui("showArrange")
	_replace_state(next)
	_select_main()
	_ui("brand")
	save_game()
	update_day_hud()
	_ui("sparkles", [20])
	_toast("chain.opened", {"stars": state["chain"]["stars"], "bonus": CoreChain.chain_bonus_percent(CoreChainBonuses.stars_free(state))})


## The café as it is now, as text.
func save_text() -> String:
	save_game()
	return session.text(state)


## Another café's save takes the place of this one, which is kept beside it; this session ends. False when it could not
## be written, and then nothing changed.
func replace_save(text: String) -> bool:
	# What is kept is the café as it is now.
	if save_game() != "saved" or not session.replace(text, CoreClock.now()):
		return false
	session.close()
	return true


func reset_game() -> void:
	var fresh := CoreState.create_initial_state(CoreClock.now())
	storage.set_preference(HINT_KEY, "")
	_replace_state(fresh)
	_select_main()
	_ui("brand")
	save_game()
	start_onboarding()


func _replace_state(next: Dictionary) -> void:
	state = next
	settle_furniture()
	sim.reset()
	moments.reset()
	cats.reset()
	monitor.reset()
	_ui("state")


func start_onboarding() -> void:
	_ui("onboarding")


## The owner is named and dressed, the theme picked; straight on to the first day's preparation.
func finish_onboarding(profile: Dictionary, theme: String = "") -> void:
	apply_profile(profile, theme)
	_ui("sparkles", [24])
	update_day_hud()
	prepare_day()


func apply_profile(profile: Dictionary, theme: String = "") -> void:
	state["profile"] = profile
	if not theme.is_empty():
		CoreDecor.apply_theme(state, theme)
	save_game()
	_ui("brand")
	_ui("refresh")
