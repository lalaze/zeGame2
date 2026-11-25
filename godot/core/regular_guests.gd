class_name CoreRegularGuests
extends RefCounted

## Port of src/game/regular-guests.ts

const _MAX_COUNT := 1000000000.0
## More than the maximum number of simultaneously saved customer visits.
const _RECENT_SERVICES := 160
const _MAX_SAFE := 9007199254740991


static func empty_regular_guests() -> Dictionary:
	return {"guests": {}, "nextVisitId": 1.0}


static func regular_guest_definition(id: Variant) -> Variant:
	for guest: Dictionary in CoreRegularGuestsContent.REGULAR_GUESTS:
		if id is String and guest["id"] == id:
			return guest
	return JsUtil.UNDEFINED


static func regular_guest_for_appearance(appearance_id: Variant, day: float) -> Variant:
	for guest: Dictionary in CoreRegularGuestsContent.REGULAR_GUESTS:
		if JsUtil.is_number(appearance_id) and guest["appearanceId"] == appearance_id and day >= guest["debutDay"]:
			return guest
	return JsUtil.UNDEFINED


static func regular_guest_progress(state: Dictionary, id: Variant) -> Variant:
	return state["regularGuests"]["guests"].get(id, JsUtil.UNDEFINED) if regular_guest_definition(id) is Dictionary else JsUtil.UNDEFINED


static func regular_guest_chapter_requirement(id: String, index: float) -> Variant:
	var guest: Variant = regular_guest_definition(id)
	if guest is Dictionary and JsMath.is_integer(index) and index >= 0.0 and index < guest["chapters"].size():
		return {"day": guest["debutDay"] + index * 2.0, "served": index + 1.0}
	return null


## Encountered at the door, even when the visit later ends without a sale.
static func record_regular_guest_arrival(state: Dictionary, id: String) -> Variant:
	var guest: Variant = regular_guest_definition(id)
	if not guest is Dictionary or state["day"] < guest["debutDay"] or state["phase"] != "open" or state["regularGuests"]["nextVisitId"] >= float(_MAX_SAFE):
		return null
	var guests: Dictionary = state["regularGuests"]["guests"]
	if not guests.get(id) is Dictionary:
		guests[id] = {
			"firstMetDay": state["day"], "served": 0.0, "unlockedChapters": [], "readChapters": [],
			"lastUnlockDay": null, "servedVisitIds": [], "pendingVisitIds": [], "pendingDay": state["day"],
		}
	var progress: Dictionary = guests[id]
	if progress["pendingDay"] != state["day"]:
		progress["pendingVisitIds"] = []
	progress["pendingDay"] = state["day"]
	var visit_id: float = state["regularGuests"]["nextVisitId"]
	state["regularGuests"]["nextVisitId"] += 1.0
	progress["pendingVisitIds"].append(visit_id)
	return visit_id


static func _without(list: Array, v: float) -> Array:
	var out := []
	for x: Variant in list:
		if not (JsUtil.is_number(x) and x == v):
			out.append(x)
	return out


static func _same_number(a: Variant, b: Variant) -> bool:
	return JsUtil.is_number(a) and JsUtil.is_number(b) and a == b


## Called only at the existing, successful payment/handoff point. No economic effects.
static func record_regular_guest_service(state: Dictionary, id: String, visit_id: float, handoff: Variant = null) -> Variant:
	var progress: Variant = regular_guest_progress(state, id)
	if not progress is Dictionary:
		return null
	var guest: Dictionary = regular_guest_definition(id)
	if (state["day"] < guest["debutDay"] or state["phase"] == "prep" or not JsMath.is_safe_integer(visit_id) or visit_id < 1.0 or visit_id >= state["regularGuests"]["nextVisitId"]
			or progress["pendingDay"] != state["day"] or not JsUtil.includes(progress["pendingVisitIds"], visit_id) or JsUtil.includes(progress["servedVisitIds"], visit_id)):
		return null
	progress["pendingVisitIds"] = _without(progress["pendingVisitIds"], visit_id)
	var served: Array = progress["servedVisitIds"]
	served.append(visit_id)
	JsUtil.stable_sort(served, func(a: float, b: float) -> float: return a - b)
	if served.size() > _RECENT_SERVICES:
		served.pop_front()
	progress["served"] = JsMath.js_min(_MAX_COUNT, progress["served"] + 1.0)
	if id == "mina" and handoff is Dictionary:
		CoreRegularWishes.record_mina_wish_handoff(state, handoff)
	var index: float = progress["unlockedChapters"].size()
	var requirement: Variant = regular_guest_chapter_requirement(id, index)
	if requirement == null or _same_number(progress["lastUnlockDay"], state["day"]) or progress["served"] < requirement["served"] or state["day"] < requirement["day"]:
		return null
	progress["unlockedChapters"].append(index)
	progress["lastUnlockDay"] = state["day"]
	return index


## An abandoned visit does not grant service credit, including after a refresh.
static func record_regular_guest_departure(state: Dictionary, id: String, visit_id: float) -> void:
	var progress: Variant = regular_guest_progress(state, id)
	if progress is Dictionary:
		progress["pendingVisitIds"] = _without(progress["pendingVisitIds"], visit_id)


## The journal explicitly marks a completed read; opening or skipping changes nothing.
static func mark_regular_guest_chapter_read(state: Dictionary, id: String, index: float) -> bool:
	var progress: Variant = regular_guest_progress(state, id)
	if not progress is Dictionary or not JsUtil.includes(progress["unlockedChapters"], index) or JsUtil.includes(progress["readChapters"], index):
		return false
	progress["readChapters"].append(index)
	JsUtil.stable_sort(progress["readChapters"], func(a: float, b: float) -> float: return a - b)
	return true


static func regular_guest_unread_count(state: Dictionary, id: Variant = JsUtil.UNDEFINED) -> float:
	var total := 0.0
	for guest: Dictionary in CoreRegularGuestsContent.REGULAR_GUESTS:
		if id is String and guest["id"] != id:
			continue
		var progress: Variant = regular_guest_progress(state, guest["id"])
		if progress is Dictionary:
			for index: float in progress["unlockedChapters"]:
				if not JsUtil.includes(progress["readChapters"], index):
					total += 1.0
	return total


## Replace only a drink slot; preserve whether the original order was a combo and consume no RNG.
static func regular_guest_order(state: Dictionary, id: Variant, order: String, extra: Variant) -> Dictionary:
	var same := {"order": order, "extra": extra}
	var wish: Variant = CoreRegularWishes.mina_wish(state) if id is String and id == "mina" else null
	if wish is Dictionary and wish["choice"] == "milky" and not wish["paused"] and wish["rehearsedDay"] == null:
		for m: Dictionary in CoreEconomy.menu_items(state):
			if CoreRegularWishes.is_mina_wish_drink(m["id"]) and CoreEconomy.ready_servings(state, m["id"]) >= 1.0:
				var asked: Variant = CoreEconomy.menu_item(order)
				if asked != null:
					if CoreData.is_drink(asked["category"]):
						return {"order": m["id"], "extra": extra}
					if extra != null:
						return {"order": order, "extra": m["id"]}
				break
	var guest: Variant = regular_guest_definition(id)
	if not guest is Dictionary or state["day"] < guest["debutDay"]:
		return same
	var preferred: String = guest["preferredDrink"]
	if state["items"][preferred] <= 0.0 or not state["onMenu"].has(preferred) or CoreEconomy.ready_servings(state, preferred) < 1.0:
		return same
	var drink: Variant = CoreData.find_menu(preferred)
	if drink == null or not CoreData.is_drink(drink["category"]):
		return same
	if CoreData.is_drink(CoreEconomy.menu_item(order)["category"]):
		return {"order": preferred, "extra": extra}
	return {"order": order, "extra": null if extra == null else preferred}


static func _integer(v: Variant, least: float = 0.0) -> bool:
	return JsMath.is_safe_integer(v) and v >= least


## Unique integers from a saved list that pass `keep`.
static func _visits(list: Variant, keep: Callable) -> Array:
	var out := []
	if list is Array:
		for v: Variant in list:
			if _integer(v, 1.0) and keep.call(v) and not out.has(v):
				out.append(v)
	return out


## Read only saved evidence. Missing old-save data never invents encounters or chapters.
static func parse_regular_guests(value: Variant, day: float = 1.0) -> Dictionary:
	var out := empty_regular_guests()
	if not value is Dictionary:
		return out
	if _integer(JsUtil.prop(value, "nextVisitId"), 1.0):
		out["nextVisitId"] = value["nextVisitId"]
	var saved: Variant = JsUtil.prop(value, "guests")
	if not saved is Dictionary:
		return out
	var next_visit: float = out["nextVisitId"]
	for guest: Dictionary in CoreRegularGuestsContent.REGULAR_GUESTS:
		var source: Variant = JsUtil.prop(saved, guest["id"])
		var first: Variant = JsUtil.prop(source, "firstMetDay")
		if not source is Dictionary or not _integer(first, guest["debutDay"]) or first > day:
			continue
		var count: Variant = JsUtil.prop(source, "served")
		var served: float = JsMath.js_min(_MAX_COUNT, count) if _integer(count) else 0.0
		var unlocked := []
		var listed: Variant = JsUtil.prop(source, "unlockedChapters")
		if listed is Array:
			for i in guest["chapters"].size():
				var requirement: Dictionary = regular_guest_chapter_requirement(guest["id"], i)
				if not JsUtil.includes(listed, float(i)) or served < requirement["served"] or day < requirement["day"] or day < first + i:
					break
				unlocked.append(float(i))
		# A malformed timestamp must not let loading unlock a second chapter that day.
		var earliest := JsMath.js_max(guest["debutDay"] + (unlocked.size() - 1.0) * 2.0, first + unlocked.size() - 1.0)
		var last: Variant = JsUtil.prop(source, "lastUnlockDay")
		var read: Variant = JsUtil.prop(source, "readChapters")
		var visits := _visits(JsUtil.prop(source, "servedVisitIds"), func(v: float) -> bool: return v < next_visit)
		JsUtil.stable_sort(visits, func(a: float, b: float) -> float: return a - b)
		var pending_day: Variant = JsUtil.prop(source, "pendingDay")
		var pending := _visits(JsUtil.prop(source, "pendingVisitIds"), func(v: float) -> bool: return v < next_visit and not visits.has(v)) if _same_number(pending_day, day) else []
		out["guests"][guest["id"]] = {
			"firstMetDay": first, "served": served, "unlockedChapters": unlocked,
			"readChapters": unlocked.filter(func(i: float) -> bool: return read is Array and JsUtil.includes(read, i)),
			"lastUnlockDay": null if unlocked.is_empty() else (last if _integer(last, earliest) and last <= day else day),
			"servedVisitIds": visits.slice(-mini(_RECENT_SERVICES, visits.size())) if not visits.is_empty() else [],
			"pendingDay": pending_day if _integer(pending_day, first) and pending_day <= day else day,
			"pendingVisitIds": pending.slice(-mini(150, pending.size())) if not pending.is_empty() else [],
		}
	var issued := []
	for progress: Dictionary in out["guests"].values():
		var kept := []
		for v: float in progress["pendingVisitIds"]:
			if not issued.has(v):
				issued.append(v)
				kept.append(v)
		progress["pendingVisitIds"] = kept
	return out
