class_name CoreSimSnapshot
extends RefCounted

## Port of src/game/sim-snapshot.ts: rejects a corrupt saved service as a whole; the economic save stays usable.

const _PHASES := ["queue", "toCounter", "ordering", "toSeat", "waiting", "sitting", "exiting"]
const _SERVER_PHASES := ["idle", "toPass", "delivering", "returning"]


static func _p(o: Variant, key: String) -> Variant:
	return JsUtil.prop(o, key)


static func _eq(a: Variant, b: Variant) -> bool:
	if JsUtil.is_number(a) and JsUtil.is_number(b):
		return a == b
	return typeof(a) == typeof(b) and not a is Object and a == b


static func _missing(v: Variant) -> bool:
	return JsUtil.is_undefined(v)


static func _finite(v: Variant) -> bool:
	return JsMath.is_finite_num(v)


static func _positive(v: Variant) -> bool:
	return _finite(v) and v >= 0.0


static func _integer(v: Variant) -> bool:
	return _positive(v) and JsMath.is_safe_integer(v)


static func _item(v: Variant) -> bool:
	return v is String and CoreEconomy.menu_item(v) != null


static func _list(v: Variant, most: float, check: Callable) -> bool:
	if not v is Array or v.size() > most:
		return false
	for x: Variant in v:
		if not check.call(x):
			return false
	return true


static func _point(v: Variant) -> bool:
	return v is Dictionary and _spot(_p(v, "x"), _p(v, "y"))


static func _spot(x: Variant, y: Variant) -> bool:
	return _finite(x) and _finite(y) and absf(x) < 10000.0 and absf(y) < 10000.0


static func _look(v: Variant) -> bool:
	if not v is Dictionary:
		return false
	for k: String in ["skin", "hair", "hairStyle", "shirt", "pants"]:
		if not _integer(_p(v, k)) or v[k] >= 8.0:
			return false
	return true


static func _walker(v: Dictionary) -> bool:
	var blocked: Variant = _p(v, "pathBlocked")
	var journey: Variant = _p(v, "journey")
	return (_point(v) and _spot(_p(v, "tx"), _p(v, "ty")) and _positive(_p(v, "stride")) and _list(_p(v, "via"), 128.0, _point)
		and (_missing(blocked) or blocked is bool) and (_missing(journey) or _list(journey, 64.0, _point)))


static func _nullable_id(v: Variant) -> bool:
	return v == null or _integer(v)


static func _plate(v: Variant) -> bool:
	if not v is Dictionary or not _integer(_p(v, "customerId")) or not _list(_p(v, "items"), 2.0, _item) or not _integer(_p(v, "barista")) or v["barista"] >= 4.0 or not _finite(_p(v, "waited")):
		return false
	var server: Variant = _p(v, "server")
	return server == null or _integer(server) and server < CoreLayout.MAX_SERVERS


static func _customer(v: Variant) -> bool:
	if not v is Dictionary or not _walker(v) or not _look(_p(v, "look")) or not _integer(_p(v, "id")) or not _item(_p(v, "order")):
		return false
	var extra: Variant = _p(v, "extra")
	if not (extra == null or _item(extra)):
		return false
	var kind: Variant = _p(v, "guestKind")
	if not (_missing(kind) or CoreCustomerDemand.is_guest_kind(kind)):
		return false
	var appearance: Variant = _p(v, "appearanceId")
	if not (_missing(appearance) or _integer(appearance) and appearance < CoreCustomerCast.CUSTOMER_CAST.size()):
		return false
	var regular: Variant = _p(v, "regularGuestId")
	if not (_missing(regular) or regular is String):
		return false
	var visit: Variant = _p(v, "regularGuestVisitId")
	if not (_missing(visit) or _integer(visit) and visit > 0.0):
		return false
	var trial: Variant = _p(v, "trialSale")
	if not (_missing(trial) or trial is String and (trial == "reserved" or trial == "prepared")):
		return false
	for key: String in ["recommendation", "rememberedOrder"]:
		if not (_missing(_p(v, key)) or _item(v[key])):
			return false
	for key: String in ["reviewed", "missingExtra"]:
		if not (_missing(_p(v, key)) or v[key] is bool):
			return false
	var waited: Variant = _p(v, "waitSeconds")
	if not (_missing(waited) or _positive(waited)):
		return false
	var phase: Variant = _p(v, "phase")
	if not phase is String or not _PHASES.has(phase):
		return false
	for key: String in ["patience", "timer", "moodTimer", "spot", "seat"]:
		if not _finite(_p(v, key)):
			return false
	if not JsMath.is_integer(v["seat"]) or v["seat"] < -1.0 or v["seat"] >= CoreLayout.TOTAL_TABLE_SPOTS * 2.0:
		return false
	for key: String in ["vip", "hasCup", "soldOut", "dineIn"]:
		if not _p(v, key) is bool:
			return false
	var mood: Variant = _p(v, "mood")
	if not (mood == null or mood is String and (mood == "happy" or mood == "sad")):
		return false
	var tip: Variant = _p(v, "momentTip")
	return _missing(tip) or _finite(tip) and tip >= 0.0 and tip <= 1.0


static func _barista(v: Variant) -> bool:
	return v is Dictionary and _look(_p(v, "look")) and _nullable_id(_p(v, "customerId")) and _finite(_p(v, "remaining")) and _finite(_p(v, "total")) and _finite(_p(v, "calling"))


static func _station(v: Variant) -> bool:
	return v is String and CoreKitchen.STATION_SECONDS.has(v)


static func _cook(v: Variant) -> bool:
	if not v is Dictionary or not _walker(v) or not _look(_p(v, "look")):
		return false
	var batch: Variant = _p(v, "batch")
	if batch == null:
		return true
	return (batch is Dictionary and _item(_p(batch, "item")) and _integer(_p(batch, "n")) and batch["n"] > 0.0 and batch["n"] <= CoreData.MAX_COOK_BATCH
		and _list(_p(batch, "steps"), 16.0, _station) and _integer(_p(batch, "step")) and batch["step"] < batch["steps"].size() and _finite(_p(batch, "timer")))


static func _server(v: Variant) -> bool:
	if not v is Dictionary or not _walker(v) or not _look(_p(v, "look")):
		return false
	var phase: Variant = _p(v, "phase")
	return phase is String and _SERVER_PHASES.has(phase) and _list(_p(v, "plates"), 3.0, _plate) and _finite(_p(v, "ack"))


static func valid_snapshot(value: Variant, state: Dictionary) -> bool:
	if not value is Dictionary:
		return false
	var version: Variant = _p(value, "version")
	if not JsUtil.is_number(version) or version != 1.0 and version != 2.0:
		return false
	var second: bool = version == 2.0
	if second and not _eq(_p(value, "kitchenLevel"), state["upgrades"]["cook"] if state["kitchen"] else 0.0):
		return false
	if not _eq(_p(value, "day"), state["day"]) or not _eq(_p(value, "phase"), state["phase"]) or not _eq(_p(value, "served"), state["today"]["served"]):
		return false
	var height: Variant = _p(value, "height")
	if not _finite(height) or height < (CoreLayout.MIN_SCENE_H if second else 192.0) or height > CoreLayout.MAX_SCENE_H or not _finite(_p(value, "spawnTimer")) or not _integer(_p(value, "nextId")) or not _positive(_p(value, "boostCooldown")) or value["boostCooldown"] > 1.0:
		return false
	if (not _list(_p(value, "customers"), 150.0, _customer) or not _list(_p(value, "baristas"), 4.0, _barista) or not _list(_p(value, "cooks"), 3.0, _cook) or not _list(_p(value, "servers"), CoreLayout.MAX_SERVERS, _server)
			or not _list(_p(value, "queue"), 6.0, _integer) or not _list(_p(value, "seats"), CoreLayout.TOTAL_TABLE_SPOTS * 2.0, _nullable_id) or not _list(_p(value, "pass"), CoreData.MAX_PASS_SLOTS, _plate) or not _list(_p(value, "rack"), 3.0, _item)):
		return false
	if second and (not CoreCustomerCast.valid_customer_cast_snapshot(_p(value, "customerCast")) or not _integer(_p(value, "castRandomState")) or value["castRandomState"] > 4294967295.0):
		return false
	return _recipes_known(value, state) and _orders_consistent(value, state) and _regulars_consistent(value, state) and _ids_consistent(value)


## A syntactically valid custom recipe must still exist in this economic save.
static func _recipes_known(s: Dictionary, state: Dictionary) -> bool:
	var in_flight := []
	for c: Dictionary in s["customers"]:
		in_flight.append(c["order"])
		if c["extra"] != null:
			in_flight.append(c["extra"])
	for p: Dictionary in s["pass"]:
		in_flight.append_array(p["items"])
	in_flight.append_array(s["rack"])
	for server: Dictionary in s["servers"]:
		for p: Dictionary in server["plates"]:
			in_flight.append_array(p["items"])
	for cook: Dictionary in s["cooks"]:
		if cook["batch"] is Dictionary:
			in_flight.append(cook["batch"]["item"])
	for id: String in in_flight:
		var known := CoreData.find_menu(id) != null
		for recipe: Dictionary in state["signatureDrinks"]["recipes"]:
			known = known or recipe["id"] == id
		if not known:
			return false
	return true


static func _has(c: Dictionary, key: String) -> bool:
	return JsUtil.truthy(_p(c, key))


static func _orders_consistent(s: Dictionary, state: Dictionary) -> bool:
	for c: Dictionary in s["customers"]:
		var recommended: Variant = _p(c, "recommendation")
		if not _missing(recommended) and (not _eq(recommended, c["order"]) or _has(c, "trialSale") or _has(c, "regularGuestId") or c["hasCup"] or c["phase"] == "exiting"):
			return false
		var remembered: Variant = _p(c, "rememberedOrder")
		if not _missing(remembered) and (not CoreGuestMemories.memory_guest(_p(c, "appearanceId")) or _has(c, "trialSale") or _has(c, "regularGuestId")
				or not _eq(remembered, c["order"]) and not _eq(remembered, c["extra"]) or not state["guestMemories"].get(CoreGuestMemories._key(c["appearanceId"])) is Dictionary):
			return false
	var trial: Variant = state["trialSales"]["active"] if state.get("trialSales") is Dictionary else null
	var reserved := 0.0
	var prepared := 0.0
	for c: Dictionary in s["customers"]:
		if not _has(c, "trialSale"):
			continue
		if not trial is Dictionary or trial["day"] != state["day"] or c["hasCup"] or c["phase"] == "exiting" or not _eq(c["order"], trial["item"]) and not _eq(c["extra"], trial["item"]):
			return false
		if c["trialSale"] == "reserved":
			reserved += 1.0
			if not ["queue", "toCounter"].has(c["phase"]):
				return false
		else:
			prepared += 1.0
			if not ["ordering", "toSeat", "waiting"].has(c["phase"]):
				return false
	if reserved != (trial["reserved"] if trial is Dictionary else 0.0) or prepared > (trial["prepared"] - trial["served"] if trial is Dictionary else 0.0):
		return false
	return state["kitchen"] or s["cooks"].is_empty()


## Present narrative fields must agree with their saved appearance, debut and visit receipt.
static func _regulars_consistent(s: Dictionary, state: Dictionary) -> bool:
	var visits := []
	for c: Dictionary in s["customers"]:
		var id: Variant = _p(c, "regularGuestId")
		var visit: Variant = _p(c, "regularGuestVisitId")
		if _missing(id) and _missing(visit):
			continue
		var guest: Variant = CoreRegularGuests.regular_guest_definition(id)
		if not guest is Dictionary or not _eq(guest["appearanceId"], _p(c, "appearanceId")) or state["day"] < guest["debutDay"] or _missing(visit) or visit >= state["regularGuests"]["nextVisitId"]:
			return false
		var progress: Variant = state["regularGuests"]["guests"].get(guest["id"])
		if not progress is Dictionary:
			return false
		if not c["hasCup"] and c["phase"] != "exiting" and (progress["pendingDay"] != state["day"] or not JsUtil.includes(progress["pendingVisitIds"], visit)):
			return false
		visits.append(visit)
	return _unique(visits)


static func _unique(list: Array) -> bool:
	var seen := {}
	for v: float in list:
		if seen.has(v):
			return false
		seen[v] = true
	return true


static func _ids_consistent(s: Dictionary) -> bool:
	var phases := {}
	for c: Dictionary in s["customers"]:
		if phases.has(c["id"]) or c["id"] >= s["nextId"]:
			return false
		phases[c["id"]] = c["phase"]
	for id: float in s["queue"]:
		if phases.get(id, "") != "queue":
			return false
	if not _unique(s["queue"]):
		return false
	for id: Variant in s["seats"]:
		if id != null and not phases.has(id):
			return false
	for c: Dictionary in s["customers"]:
		if c["seat"] >= s["seats"].size() or c["spot"] < -1.0 or c["spot"] >= s["baristas"].size() or not JsMath.is_integer(c["spot"]):
			return false
	for b: Dictionary in s["baristas"]:
		if b["customerId"] != null and not phases.has(b["customerId"]):
			return false
	for p: Dictionary in s["pass"]:
		if not phases.has(p["customerId"]) or p["barista"] >= s["baristas"].size() or p["server"] != null and p["server"] >= s["servers"].size():
			return false
	return true
