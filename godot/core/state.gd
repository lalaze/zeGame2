class_name CoreState
extends RefCounted

## Port of src/game/state.ts: a new game, saving it, and reading any save since version 1.
## The state is a Dictionary with the save's own keys, in the save's own order.

static var SAVE_KEY: String = RulesData.section("state")["SAVE_KEY"]
static var SAVE_VERSION: float = RulesData.section("state")["SAVE_VERSION"]
static var LOOK_RANGES: Dictionary = RulesData.section("state")["LOOK_RANGES"]
static var NAME_MAX: float = RulesData.section("state")["NAME_MAX"]
static var STARTER_BEANS: float = RulesData.section("state")["STARTER_BEANS"]

## A load-only notice, not save data: how many pieces each loaded state had moved to storage.
static var _furniture_moves: Array = []


## Golden hair is never paired with the deepest skin.
static func hair_clashes(look: Dictionary) -> bool:
	return look["skin"] == 3.0 and look["hair"] == 2.0


## The look itself, or with dark brown hair in place of a clashing colour.
static func without_hair_clash(look: Dictionary) -> Dictionary:
	if not hair_clashes(look):
		return look
	var out := look.duplicate(false)
	out["hair"] = 0.0
	return out


static func empty_day() -> Dictionary:
	return {
		"guests": CoreCustomerDemand.empty_guest_stats(), "reviews": CoreReputation.empty_reviews(), "served": 0.0, "missed": 0.0, "soldOut": 0.0,
		"queueLost": 0.0, "tableLost": 0.0, "extraLost": 0.0, "doorLost": 0.0, "shortages": {}, "revenue": 0.0, "ingredientCost": 0.0,
		"petCost": 0.0, "promotionCost": 0.0, "sales": {}, "baked": {},
	}


static func _default_decor() -> Dictionary:
	var owned := []
	for d: Dictionary in CoreDecor.DECOR:
		if d["cost"] == 0.0:
			owned.append(d["id"])
	var equipped: Dictionary = CoreDecor.STARTER_THEMES[0]["equip"].duplicate(false)
	for slot: String in CoreDecor.DECOR_SLOTS:
		if not equipped.has(slot):
			for d: Dictionary in CoreDecor.DECOR:
				if d["slot"] == slot and d["cost"] == 0.0:
					equipped[slot] = d["id"]
					break
	var placed := []
	for p: Dictionary in CoreFurniture.STARTER_FURNITURE:
		placed.append(p.duplicate(false))
	return {"owned": owned, "equipped": equipped, "placed": placed, "stored": {}}


static func _zeros(list: Array) -> Dictionary:
	var out := {}
	for x: Dictionary in list:
		out[x["id"]] = 0.0
	return out


static func create_initial_state(now: float) -> Dictionary:
	var items := _zeros(CoreData.MENU)
	items["espresso"] = 1.0
	var pantry := _zeros(CoreData.INGREDIENTS)
	# Enough beans for the first day.
	pantry["beans"] = STARTER_BEANS
	var yue := CorePartners.fresh_partner()
	return {
		"version": SAVE_VERSION,
		"partners": {"roster": {"yue": yue}, "active": {"barista": [], "server": ["yue"], "cook": []}},
		"signatureDrinks": CoreSignatureDrinks.empty_signature_drinks(),
		"cafeStyle": CoreStyles.parse_cafe_style(null),
		"regularGuests": CoreRegularGuests.empty_regular_guests(),
		"regularWishes": CoreRegularWishes.empty_regular_wishes(),
		"trialSales": CoreTrialSales.empty_trial_sales(),
		"guestMemories": {},
		"milestones": CoreMilestones.empty_milestones(),
		"manager": CoreManager.empty_manager(now),
		"chain": CoreChain.empty_chain(now),
		"orders": CoreOrders.empty_orders(),
		"catGifts": CoreCatGifts.empty_cat_gifts(now),
		"roomProjects": CoreRoomProjects.empty_room_projects(),
		"streets": CoreStreets.empty_street_estate(),
		"pets": [],
		"promotion": null,
		"reputation": {"recent": []},
		"taste": {"served": {}, "signature": []},
		"coins": 0.0,
		"totalEarned": 0.0,
		"served": 0.0,
		"items": items,
		"upgrades": _zeros(CoreData.UPGRADES),
		"regions": [],
		"construction": [],
		"kitchen": false,
		"profile": null,
		"decor": _default_decor(),
		"goal": 0.0,
		"phase": "prep",
		"day": 1.0,
		"dayTime": 0.0,
		"speed": 1.0,
		"onMenu": ["espresso"],
		"pantry": pantry,
		"bakePlan": {},
		"shelf": {},
		"today": empty_day(),
		"inProduction": {},
		"createdAt": now,
	}


static func consume_furniture_moves_on_load(state: Dictionary) -> float:
	for i in _furniture_moves.size():
		if is_same(_furniture_moves[i][0], state):
			var moved: float = _furniture_moves[i][1]
			_furniture_moves.remove_at(i)
			return moved
	return 0.0


static func serialize(state: Dictionary) -> String:
	return JsJson.stringify(state)


static func _num(v: Variant, fallback: float, least: float = 0.0) -> float:
	return v if JsMath.is_finite_num(v) and v >= least else fallback


static func _whole(v: Variant, fallback: float = 0.0) -> float:
	return floor(_num(v, fallback))


static func clean_name(value: Variant) -> String:
	return JsUtil.js_trim(value).substr(0, int(NAME_MAX)) if value is String else ""


static func _parse_profile(value: Variant) -> Variant:
	var p: Variant = JsUtil.as_object(value)
	if p == null:
		return null
	var cafe_name := clean_name(JsUtil.prop(p, "cafeName"))
	if cafe_name.is_empty():
		return null
	var saved: Variant = JsUtil.prop(p, "look")
	var look := {}
	for k: String in LOOK_RANGES:
		look[k] = JsMath.js_min(LOOK_RANGES[k] - 1.0, JsMath.js_max(0.0, _whole(JsUtil.prop(saved, k))))
	return {"cafeName": cafe_name, "ownerName": clean_name(JsUtil.prop(p, "ownerName")), "look": without_hair_clash(look)}


static func _parse_decor(value: Variant, base: Dictionary) -> Dictionary:
	var d: Variant = JsUtil.as_object(value)
	if d == null:
		return base
	var owned: Array = base["owned"].duplicate(false)
	var saved_owned: Variant = JsUtil.prop(d, "owned")
	if saved_owned is Array:
		for id: Variant in saved_owned:
			if id is String and CoreDecor.decor_def(id) is Dictionary and not owned.has(id):
				owned.append(id)
	var equipped: Dictionary = base["equipped"].duplicate(false)
	var eq: Variant = JsUtil.prop(d, "equipped")
	for slot: String in CoreDecor.DECOR_SLOTS:
		var id: Variant = JsUtil.prop(eq, slot)
		if id is String and owned.has(id) and CoreDecor.decor_def(id)["slot"] == slot:
			equipped[slot] = id
	var placed: Array = base["placed"]
	var stored := {}
	var saved_placed: Variant = JsUtil.prop(d, "placed")
	if saved_placed is Array:
		# Each of the building's spots holds one piece that belongs there; any other claim to one ends in storage.
		var taken := []
		placed = []
		for p: Variant in saved_placed:
			var def: Variant = CoreFurniture.furniture_def(JsUtil.prop(p, "id"))
			if not def is Dictionary:
				continue
			var claim: Variant = JsUtil.prop(p, "spot")
			if JsUtil.is_undefined(claim):
				placed.append({"id": def["id"], "col": floor(_num(JsUtil.prop(p, "col"), -1.0, -1.0)), "row": floor(_num(JsUtil.prop(p, "row"), -1.0, -1.0))})
				continue
			var spot: Variant = CoreBuildingSpots.building_spot(claim)
			if not spot is Dictionary or spot["surface"] != def["surface"] or taken.has(spot["id"]):
				placed.append({"id": def["id"], "col": -1.0, "row": -1.0})
				continue
			taken.append(spot["id"])
			placed.append({"id": def["id"], "col": -1.0, "row": -1.0, "spot": spot["id"]})
		var saved_stored: Variant = JsUtil.prop(d, "stored")
		if saved_stored is Dictionary:
			for id: String in JsUtil.own_keys(saved_stored):
				var count := _whole(saved_stored[id])
				if CoreFurniture.furniture_def(id) is Dictionary and count > 0.0:
					stored[id] = count
	elif saved_owned is Array:
		# Before v6, wall art and floor plants were slots. What was bought becomes furniture.
		placed = []
		for p: Dictionary in base["placed"]:
			placed.append(p.duplicate(false))
		var art: Variant = JsUtil.prop(eq, "art")
		for id: Variant in saved_owned:
			if not id is String or not CoreFurniture.furniture_def(id) is Dictionary:
				continue
			if art is String and art == id:
				var piece := {"id": id}
				piece.merge(CoreFurniture.DEFAULT_ART_SPOT)
				placed.append(piece)
			else:
				stored[id] = stored.get(id, 0.0) + 1.0
	var out := {"owned": owned, "equipped": equipped, "placed": placed, "stored": stored}
	var building: Variant = JsUtil.prop(d, "building")
	if building is bool and building:
		out["building"] = true
	return out


## Parses a save, falling back to defaults for anything missing or malformed.
static func deserialize(raw: Variant, now: float) -> Dictionary:
	var base := create_initial_state(now)
	if not raw is String or raw.is_empty():
		return base
	var parsed := JsJson.parse(raw)
	var data: Variant = JsUtil.as_object(parsed["value"]) if parsed["ok"] else null
	if data == null:
		return base
	var version: Variant = JsUtil.prop(data, "version")

	var items: Variant = JsUtil.prop(data, "items")
	for m: Dictionary in CoreData.MENU:
		base["items"][m["id"]] = _whole(JsUtil.prop(items, m["id"]), base["items"][m["id"]])
	base["items"]["espresso"] = JsMath.js_max(1.0, base["items"]["espresso"])
	base["signatureDrinks"] = CoreSignatureDrinks.parse_signature_drinks(JsUtil.prop(data, "signatureDrinks"))
	for recipe: Dictionary in base["signatureDrinks"]["recipes"]:
		base["items"][recipe["id"]] = 1.0

	var upgrades: Variant = JsUtil.prop(data, "upgrades")
	for u: Dictionary in CoreData.UPGRADES:
		base["upgrades"][u["id"]] = JsMath.js_min(u["max"], _whole(JsUtil.prop(upgrades, u["id"])))
	var regions: Variant = JsUtil.prop(data, "regions")
	if regions is Array:
		for r: Dictionary in CoreRegions.REGIONS:
			if not JsUtil.includes(regions, r["id"]):
				break
			base["regions"].append(r["id"])
	base["construction"] = CoreRegions.parse_construction(JsUtil.prop(data, "construction"), base["regions"], now)
	base["kitchen"] = _is_true(JsUtil.prop(data, "kitchen"))

	base["cafeStyle"] = CoreStyles.parse_cafe_style(JsUtil.prop(data, "cafeStyle"))
	base["coins"] = _num(JsUtil.prop(data, "coins"), 0.0)
	base["totalEarned"] = _num(JsUtil.prop(data, "totalEarned"), base["coins"])
	base["served"] = _whole(JsUtil.prop(data, "served"))
	base["createdAt"] = _num(JsUtil.prop(data, "createdAt"), now)
	base["profile"] = _parse_profile(JsUtil.prop(data, "profile"))
	base["decor"] = _parse_decor(JsUtil.prop(data, "decor"), base["decor"])
	base["goal"] = _whole(JsUtil.prop(data, "goal"))

	base["day"] = JsMath.js_max(1.0, _whole(JsUtil.prop(data, "day"), 1.0))
	base["guestMemories"] = CoreGuestMemories.parse_guest_memories(JsUtil.prop(data, "guestMemories"), base["day"])
	base["regularGuests"] = CoreRegularGuests.parse_regular_guests(JsUtil.prop(data, "regularGuests"), base["day"])
	base["regularWishes"] = CoreRegularWishes.parse_regular_wishes(JsUtil.prop(data, "regularWishes"), base)
	base["milestones"] = CoreMilestones.parse_milestones(JsUtil.prop(data, "milestones"))
	base["partners"] = CorePartners.parse_partners(JsUtil.prop(data, "partners"), base)
	var phase: Variant = JsUtil.prop(data, "phase")
	base["phase"] = phase if phase is String and (phase == "closing" or phase == "open") else "prep"
	base["dayTime"] = _num(JsUtil.prop(data, "dayTime"), 0.0) if base["phase"] != "prep" else 0.0
	var speed: Variant = JsUtil.prop(data, "speed")
	base["speed"] = speed if JsUtil.is_number(speed) and JsUtil.includes(CoreData.SPEEDS, speed) else 1.0
	var pantry: Variant = JsUtil.prop(data, "pantry")
	for i: Dictionary in CoreData.INGREDIENTS:
		base["pantry"][i["id"]] = _num(JsUtil.prop(pantry, i["id"]), base["pantry"][i["id"]])
	# v3 sold "flour & butter" as one ingredient and had strawberries instead of fresh fruit.
	var old_pastry := _whole(JsUtil.prop(pantry, "pastry"))
	base["pantry"]["flour"] += old_pastry
	base["pantry"]["butter"] += old_pastry
	base["pantry"]["fruit"] += _whole(JsUtil.prop(pantry, "berries"))
	var saved_menu: Variant = JsUtil.prop(data, "onMenu")
	base["onMenu"] = []
	for m: Dictionary in CoreData.MENU:
		if base["items"][m["id"]] > 0.0 and (not saved_menu is Array or JsUtil.includes(saved_menu, m["id"])):
			base["onMenu"].append(m["id"])
	base["today"] = _parse_day(JsUtil.prop(data, "today"))
	base["pets"] = CorePets.parse_pets(JsUtil.prop(data, "pets"))
	base["catGifts"] = CoreCatGifts.parse_cat_gifts(JsUtil.prop(data, "catGifts"), now, base["pets"].map(func(p: Dictionary) -> String: return p["id"]))
	base["promotion"] = CorePromotion.parse_promotion(JsUtil.prop(data, "promotion"))
	base["manager"] = CoreManager.parse_manager(JsUtil.prop(data, "manager"), now)
	base["chain"] = CoreChain.parse_chain(JsUtil.prop(data, "chain"), now)
	base["orders"] = CoreOrders.parse_orders(JsUtil.prop(data, "orders"), now)
	base["roomProjects"] = CoreRoomProjects.parse_room_projects(JsUtil.prop(data, "roomProjects"), base, now)
	base["streets"] = CoreStreets.parse_street_estate(JsUtil.prop(data, "streets"), now)
	# Older saves only retain per-dish sales for the current day.
	base["taste"] = CoreTaste.parse_taste(JsUtil.prop(data, "taste"), base["today"]["sales"] if _num(version, 1.0) < 10.0 else {})
	base["taste"]["signature"] = base["taste"]["signature"].filter(func(id: String) -> bool: return base["items"].get(id, 0.0) > 0.0)
	# One canonical delivery history survives renaming, removal and recreating a recipe.
	for id: String in base["signatureDrinks"]["served"]:
		base["taste"]["served"][id] = base["signatureDrinks"]["served"][id]
	base["reputation"] = CoreReputation.parse_reputation(JsUtil.prop(data, "reputation"))
	base["bakePlan"] = _parse_counts(JsUtil.prop(data, "bakePlan"))
	base["inProduction"] = {} if base["phase"] == "prep" else _parse_counts(JsUtil.prop(data, "inProduction"))
	# Suspended pre-kitchen stock survives saves and a later kitchen purchase.
	base["shelf"] = _parse_counts(JsUtil.prop(data, "shelf"))
	base["trialSales"] = CoreTrialSales.parse_trial_sales(JsUtil.prop(data, "trialSales"), base)

	# v1 had a leveled "Cozy Decor" upgrade: refund what was spent and keep the tables it had built.
	var old_decor := _whole(JsUtil.prop(upgrades, "decor"))
	if _num(version, 1.0) < 2.0 and old_decor > 0.0:
		base["coins"] += CoreEconomy.bulk_cost(200.0, 2.2, 0.0, old_decor)
		var built := 0.0
		for l: float in [3.0, 6.0, 10.0]:
			if old_decor >= l:
				built += 1.0
		base["upgrades"]["tables"] = JsMath.js_max(base["upgrades"]["tables"], built)
	# The old leveled Shift Manager upgrade retired before v23's manager: what was spent comes back.
	var old_manager := JsMath.js_min(5.0, _whole(JsUtil.prop(upgrades, "manager")))
	if old_manager > 0.0:
		base["coins"] += CoreEconomy.bulk_cost(500.0, 4.0, 0.0, old_manager)
	# Anything placed off the grid or in a table's way goes to storage.
	var moved := CoreFurniture.evict_blocked(base, CoreRegions.main_table_count(base))
	if moved > 0.0:
		_furniture_moves.append([base, moved])
		if _furniture_moves.size() > 4:
			_furniture_moves.pop_front()
	# Move the old starter clock clear of the permanent wall lantern.
	if _num(version, 0.0) < 17.0:
		for i in base["decor"]["placed"].size():
			var piece: Dictionary = base["decor"]["placed"][i]
			if piece["id"] == "clock" and piece["col"] == 10.0 and piece["row"] == 0.0 and CoreFurniture.can_place(base, "clock", 11.0, 0.0, CoreRegions.main_table_count(base), i):
				piece["col"] = 11.0
	# Every bread and pastry on the menu gets a morning-bake amount.
	CoreEconomy.fill_bake_plan(base)
	if _num(version, 1.0) < 5.0 and base["phase"] == "open":
		CoreEconomy.bake_morning(base)
	# Before v3 there were no days or ingredients: start the first day with a full pantry.
	if _num(version, 1.0) < 3.0:
		var needs := CoreEconomy.day_needs(base)
		for id: String in needs:
			base["pantry"][id] += needs[id]
	return base


static func _is_true(v: Variant) -> bool:
	return v is bool and v


static func _parse_counts(value: Variant, include_signatures: bool = false) -> Dictionary:
	var out := {}
	if not value is Dictionary:
		return out
	for m: Dictionary in CoreData.MENU:
		var n: float = floor(_num(JsUtil.prop(value, m["id"]), -1.0))
		if n >= 0.0:
			out[m["id"]] = n
	if include_signatures:
		for id: String in JsUtil.own_keys(value):
			var n: float = floor(_num(value[id], -1.0))
			if CoreSignatureDrinks.signature_definition(id) != null and n >= 0.0:
				out[id] = n
	return out


static func _parse_day(value: Variant) -> Dictionary:
	var day := empty_day()
	var d: Variant = JsUtil.as_object(value)
	if d == null:
		return day
	day["guests"] = CoreCustomerDemand.parse_guest_stats(JsUtil.prop(d, "guests"))
	day["reviews"] = CoreReputation.parse_reviews(JsUtil.prop(d, "reviews"))
	for key: String in ["served", "missed", "soldOut", "queueLost", "tableLost", "extraLost", "doorLost"]:
		day[key] = _whole(JsUtil.prop(d, key))
	day["shortages"] = _parse_counts(JsUtil.prop(d, "shortages"), true)
	for key: String in ["revenue", "ingredientCost", "petCost", "promotionCost"]:
		day[key] = _num(JsUtil.prop(d, key), 0.0)
	var sales := _parse_counts(JsUtil.prop(d, "sales"), true)
	for id: String in sales:
		if sales[id] > 0.0:
			day["sales"][id] = sales[id]
	day["baked"] = _parse_counts(JsUtil.prop(d, "baked"))
	return day
