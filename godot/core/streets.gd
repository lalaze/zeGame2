class_name CoreStreets
extends RefCounted

## Port of src/game/streets.ts: shops on the streets outside.

static var STREETS: Array = RulesData.section("streets")["STREETS"]
static var STREET_PLOTS: Array = RulesData.section("streets")["STREET_PLOTS"]
static var BUSINESSES: Array = RulesData.section("streets")["BUSINESSES"]
const _LOCAL_BUSINESSES := {"town": [], "flowers": ["greenhouse", "terrace"], "seaside": ["observatory"], "forest": ["reading", "greenhouse"], "city": ["reading", "workshop"]}


static func _find(list: Array, id: Variant) -> Variant:
	for x: Dictionary in list:
		if id is String and x["id"] == id:
			return x
	return JsUtil.UNDEFINED


static func empty_street_estate() -> Dictionary:
	return {"selected": "town", "lots": {}}


static func street_def(id: Variant) -> Variant:
	return _find(STREETS, id)


static func business_def(id: Variant) -> Variant:
	return _find(BUSINESSES, id)


static func street_yield_multiplier(street: String, business: String) -> float:
	return 1.2 if _LOCAL_BUSINESSES[street].has(business) else 1.0


static func street_lot_id(street: String, plot: String) -> String:
	return "%s:%s" % [street, plot]


static func valid_street_lot_id(id: String) -> bool:
	for street: String in CoreLocations.LOCATION_IDS:
		for p: Dictionary in STREET_PLOTS:
			if street_lot_id(street, p["id"]) == id:
				return true
	return false


static func owned_plot_count(s: Dictionary) -> float:
	return s["streets"]["lots"].size()


static func owns_street_business(s: Dictionary, business: String) -> bool:
	for lot: Variant in s["streets"]["lots"].values():
		if lot is Dictionary and lot["business"] is String and lot["business"] == business and lot["readyAt"] <= CoreClock.now():
			return true
	return false


static func street_unlocked(s: Dictionary, street: String) -> bool:
	return street == CoreLocations.cafe_location(s) or owned_plot_count(s) >= street_def(street)["required"]


static func plot_price(street: String, plot: String) -> float:
	return JsMath.js_round(street_def(street)["price"] * _find(STREET_PLOTS, plot)["price"])


static func plot_purchase_block(s: Dictionary, street: String, plot: String) -> Variant:
	if s["streets"]["lots"].has(street_lot_id(street, plot)):
		return "owned"
	if not street_unlocked(s, street):
		return "street"
	if s["day"] < 3.0:
		return "day"
	return "coins" if s["coins"] < plot_price(street, plot) else null


static func buy_street_plot(s: Dictionary, street: String, plot: String, now: float) -> bool:
	if not CoreLocations.is_location(street) or not _find(STREET_PLOTS, plot) is Dictionary or plot_purchase_block(s, street, plot) != null:
		return false
	s["coins"] -= plot_price(street, plot)
	s["streets"]["lots"][street_lot_id(street, plot)] = {"business": null, "level": 0.0, "mode": "short", "readyAt": now, "since": now}
	return true


static func fit_out_price(business: String) -> float:
	return CoreRoomProjects.project_def(business_def(business)["project"])["cost"]


static func fit_out_seconds(s: Dictionary, business: String) -> float:
	return JsMath.js_round(business_def(business)["hours"] * 3600.0 * CoreRegions.build_share(s["chain"]["branches"]) * (CoreChainBonuses.PERK_BUILD_SHARE if CoreChainBonuses.has_perk(s, "builders") else 1.0))


static func fit_out_block(s: Dictionary, id: String, business: String) -> Variant:
	var lot: Variant = s["streets"]["lots"].get(id)
	if not lot is Dictionary:
		return "plot"
	if lot["business"] is String:
		return "owned"
	# Count other properties: buying the first plot still leaves the first business available.
	if owned_plot_count(s) - 1.0 < business_def(business)["required"]:
		return "business"
	return "coins" if s["coins"] < fit_out_price(business) else null


static func fit_out_street_plot(s: Dictionary, id: String, business: String, now: float) -> bool:
	if not business_def(business) is Dictionary or fit_out_block(s, id, business) != null:
		return false
	var lot: Dictionary = s["streets"]["lots"][id]
	s["coins"] -= fit_out_price(business)
	lot["business"] = business
	lot["level"] = 1.0
	lot["readyAt"] = now + fit_out_seconds(s, business) * 1000.0
	lot["since"] = lot["readyAt"]
	return true


static func street_production(s: Dictionary, id: String, now: float) -> Dictionary:
	var lot: Variant = s["streets"]["lots"].get(id)
	if not lot is Dictionary or not lot["business"] is String or now < lot["readyAt"]:
		return {"batches": 0.0, "capacity": 0.0, "coins": 0.0, "inspiration": 0.0, "progress": 0.0, "left": 0.0, "full": false}
	var def: Dictionary = CoreRoomProjects.project_def(business_def(lot["business"])["project"])
	var mode: Dictionary = CoreRoomProjects.PROJECT_MODES[lot["mode"]]
	var cycle := CoreRoomProjects.project_cycle_seconds(s, lot["mode"])
	var capacity := CoreRoomProjects.project_capacity(s, lot["mode"])
	var elapsed := JsMath.js_max(0.0, now - JsMath.js_max(lot["since"], lot["readyAt"])) / 1000.0
	var batches := JsMath.js_min(capacity, floor(elapsed / cycle))
	var full := batches == capacity
	var progress := 1.0 if full else fmod(elapsed, cycle) / cycle
	return {
		"batches": batches, "capacity": capacity, "full": full, "progress": progress, "left": 0.0 if full else cycle * (1.0 - progress),
		"coins": JsMath.js_round(batches * def["coins"] * mode["yield"] * lot["level"] * street_yield_multiplier(id.split(":")[0], lot["business"])),
		"inspiration": batches * def["inspiration"] * mode["yield"] * lot["level"],
	}


static func collect_street_shop(s: Dictionary, id: String, now: float) -> Dictionary:
	var reward := street_production(s, id, now)
	var lot: Variant = s["streets"]["lots"].get(id)
	if not lot is Dictionary or reward["batches"] == 0.0:
		return reward
	CoreEconomy.earn(s, reward["coins"])
	s["roomProjects"]["inspiration"] += reward["inspiration"]
	s["roomProjects"]["collected"] += reward["inspiration"]
	lot["since"] = now if reward["full"] else JsMath.js_max(lot["since"], lot["readyAt"]) + reward["batches"] * CoreRoomProjects.project_cycle_seconds(s, lot["mode"]) * 1000.0
	return reward


static func street_lot_ids(s: Dictionary) -> Array:
	return s["streets"]["lots"].keys().filter(valid_street_lot_id)


static func collect_street_shops(s: Dictionary, now: float) -> Dictionary:
	var total := {"coins": 0.0, "inspiration": 0.0}
	for id: String in street_lot_ids(s):
		var reward := collect_street_shop(s, id, now)
		total["coins"] += reward["coins"]
		total["inspiration"] += reward["inspiration"]
	return total


static func street_upgrade_price(s: Dictionary, id: String) -> Variant:
	var lot: Variant = s["streets"]["lots"].get(id)
	if not lot is Dictionary or not lot["business"] is String or lot["level"] >= 3.0:
		return null
	var index := 0.0
	while BUSINESSES[int(index)]["id"] != lot["business"]:
		index += 1.0
	return {"coins": fit_out_price(lot["business"]) * JsMath.js_pow(2.0, lot["level"]), "inspiration": lot["level"] * 15.0 * (index + 2.0)}


static func upgrade_street_shop(s: Dictionary, id: String, now: float) -> bool:
	var lot: Variant = s["streets"]["lots"].get(id)
	var cost: Variant = street_upgrade_price(s, id)
	if not lot is Dictionary or cost == null or now < lot["readyAt"] or s["coins"] < cost["coins"] or s["roomProjects"]["inspiration"] < cost["inspiration"]:
		return false
	collect_street_shop(s, id, now)
	s["coins"] -= cost["coins"]
	s["roomProjects"]["inspiration"] -= cost["inspiration"]
	lot["level"] += 1.0
	lot["since"] = now
	return true


static func set_street_schedule(s: Dictionary, id: String, mode: String, now: float) -> bool:
	var lot: Variant = s["streets"]["lots"].get(id)
	if not lot is Dictionary or not lot["business"] is String or now < lot["readyAt"] or lot["mode"] == mode or not CoreRoomProjects.PROJECT_MODES.has(mode):
		return false
	collect_street_shop(s, id, now)
	lot["mode"] = mode
	lot["since"] = now
	return true


## Blueprint research settles old rates and keeps fractions, never retroactive overflow.
static func prepare_street_blueprint(s: Dictionary, now: float) -> Array:
	var progress := []
	for id: String in street_lot_ids(s):
		if s["streets"]["lots"][id]["readyAt"] <= now:
			var output := street_production(s, id, now)
			progress.append({"id": id, "progress": 0.0 if output["full"] else output["progress"]})
	collect_street_shops(s, now)
	return progress


static func apply_street_blueprint(s: Dictionary, progress: Array, now: float) -> void:
	for p: Dictionary in progress:
		var lot: Dictionary = s["streets"]["lots"][p["id"]]
		lot["since"] = now - p["progress"] * CoreRoomProjects.project_cycle_seconds(s, lot["mode"]) * 1000.0


static func _stamp(n: Variant, now: float) -> float:
	return JsMath.js_max(0.0, n) if JsMath.is_finite_num(n) else now


static func parse_street_estate(value: Variant, now: float) -> Dictionary:
	var base := empty_street_estate()
	var data: Variant = JsUtil.as_object(value)
	if data == null:
		return base
	if CoreLocations.is_location(JsUtil.prop(data, "selected")):
		base["selected"] = data["selected"]
	var lots: Variant = JsUtil.as_object(JsUtil.prop(data, "lots"))
	if lots == null:
		return base
	for id: String in JsUtil.own_keys(lots):
		var lot: Variant = JsUtil.as_object(lots[id])
		if not valid_street_lot_id(id) or lot == null:
			continue
		var found: Variant = business_def(JsUtil.prop(lot, "business"))
		var business: Variant = found["id"] if found is Dictionary else null
		var level: Variant = JsUtil.prop(lot, "level")
		var mode: Variant = JsUtil.prop(lot, "mode")
		var ready_at: float = JsMath.js_min(_stamp(JsUtil.prop(lot, "readyAt"), now), now + found["hours"] * 3600000.0) if business != null else now
		base["lots"][id] = {
			"business": business,
			"level": JsMath.js_min(3.0, JsMath.js_max(1.0, floor(level))) if business != null and JsMath.is_finite_num(level) else (1.0 if business != null else 0.0),
			"mode": mode if mode is String and CoreRoomProjects.PROJECT_MODES.has(mode) else "short",
			"readyAt": ready_at, "since": JsMath.js_min(_stamp(JsUtil.prop(lot, "since"), now), JsMath.js_max(now, ready_at)),
		}
	return base


## Run at the live-save boundary. Preserve an in-flight service until closing.
static func migrate_indoor_shops(s: Dictionary, now: float) -> bool:
	if s["regions"].is_empty() and s["construction"].is_empty():
		return false
	var changed := false
	var street := CoreLocations.cafe_location(s)
	for i in CoreRegions.REGIONS.size():
		var region: String = CoreRegions.REGIONS[i]["id"]
		var construction: Variant = null
		for c: Dictionary in s["construction"]:
			if c["id"] == region and construction == null:
				construction = c
		if not s["regions"].has(region) and construction == null:
			continue
		var id := street_lot_id(street, STREET_PLOTS[i]["id"])
		var project: String = business_def(region)["project"]
		var facility: Variant = s["roomProjects"]["facilities"].get(project)
		if not s["streets"]["lots"].has(id):
			changed = true
			var ready_at: float = construction["finishAt"] if construction != null else now
			var known := facility is Dictionary
			s["streets"]["lots"][id] = {
				"business": region, "level": facility["level"] if known else 1.0, "mode": facility["mode"] if known else "short",
				"readyAt": JsMath.js_min(ready_at, facility["since"]) if known else ready_at, "since": facility["since"] if known else ready_at,
			}
		if facility is Dictionary:
			s["roomProjects"]["facilities"].erase(project)
			changed = true
	if not s["construction"].is_empty():
		changed = true
	s["construction"] = []
	if s["phase"] == "prep":
		changed = true
		# Room furnishings stay owned, ready to place in the main café; no item is discarded.
		var edge := CoreRegions.region_offset("reading")
		var kept := []
		for p: Dictionary in s["decor"]["placed"]:
			if p["col"] * 8.0 < edge:
				kept.append(p)
			else:
				s["decor"]["stored"][p["id"]] = s["decor"]["stored"].get(p["id"], 0.0) + 1.0
		s["decor"]["placed"] = kept
		s["regions"] = []
	return changed
