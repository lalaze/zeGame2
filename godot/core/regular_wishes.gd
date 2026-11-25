class_name CoreRegularWishes
extends RefCounted

# Port of src/game/regular-wishes.ts

static func empty_regular_wishes() -> Dictionary:
	return {"mina": null}

static func mina_wish(s: Dictionary) -> Variant:
	if s.has("regularWishes") and s["regularWishes"] is Dictionary:
		var rw: Dictionary = s["regularWishes"]
		if rw.has("mina") and not JsUtil.is_nullish(rw["mina"]):
			return rw["mina"]
	return null

static func mina_wish_available(s: Dictionary) -> bool:
	var guests: Dictionary = s["regularGuests"]["guests"]
	if not guests.has("mina") or not (guests["mina"] is Dictionary):
		return false
	var mina: Dictionary = guests["mina"]
	var served := float(mina["served"]) if mina.has("served") and not JsUtil.is_nullish(mina["served"]) else 0.0
	return served > 0.0

static func is_mina_wish_choice(v: Variant) -> bool:
	return (v is String) and (v == "quiet" or v == "milky")

static func choose_mina_wish(s: Dictionary, choice: Variant) -> bool:
	if s["phase"] != "prep" or not mina_wish_available(s) or not is_mina_wish_choice(choice):
		return false
	var previous = mina_wish(s)
	if previous != null and previous["rehearsedDay"] != null:
		return false
	if previous != null and previous["choice"] == choice and not bool(previous["paused"]):
		return false
	var accepted_day: float = float(previous["acceptedDay"]) if (previous != null and not JsUtil.is_nullish(previous["acceptedDay"])) else float(s["day"])
	s["regularWishes"]["mina"] = {
		"choice": choice,
		"acceptedDay": accepted_day,
		"paused": false,
		"rehearsedDay": null,
		"completedDay": null,
		"displayed": false,
	}
	return true

static func set_mina_wish_paused(s: Dictionary, paused: bool) -> bool:
	var wish = mina_wish(s)
	if s["phase"] != "prep" or wish == null or wish["rehearsedDay"] != null or bool(wish["paused"]) == paused:
		return false
	wish["paused"] = paused
	return true

static func mina_reserved_table(s: Dictionary) -> Variant:
	var wish = mina_wish(s)
	if wish != null and wish["choice"] == "quiet" and not bool(wish["paused"]) and wish["rehearsedDay"] == null:
		return 0.0
	return null

static func is_mina_wish_drink(id: Variant) -> bool:
	var item = CoreData.find_menu(id)
	if item == null:
		item = CoreSignatureDrinks.signature_definition(id)
	return item != null and CoreData.is_drink(item["category"]) and CoreFlavors.item_flavors(id).has("milky")

static func record_mina_wish_handoff(s: Dictionary, handoff: Dictionary) -> void:
	var wish = mina_wish(s)
	var items: Array = handoff["items"]
	if wish == null or bool(wish["paused"]) or wish["completedDay"] != null or s["phase"] == "prep" or items.is_empty():
		return
	if wish["rehearsedDay"] == null:
		var ready := false
		if wish["choice"] == "quiet":
			var seat := float(handoff["seat"])
			var res_table = mina_reserved_table(s)
			ready = seat >= 0.0 and res_table != null and floor(seat / 2.0) == float(res_table)
		else:
			for id in items:
				if is_mina_wish_drink(id):
					ready = true
					break
		if ready:
			wish["rehearsedDay"] = float(s["day"])
	elif float(s["day"]) > float(wish["rehearsedDay"]):
		wish["completedDay"] = float(s["day"])
		wish["displayed"] = true

static func display_mina_map(s: Dictionary, displayed: bool) -> bool:
	var wish = mina_wish(s)
	if wish == null or wish["completedDay"] == null or bool(wish["displayed"]) == displayed:
		return false
	wish["displayed"] = displayed
	return true

static func mina_map_choice(s: Dictionary) -> Variant:
	var wish = mina_wish(s)
	if wish != null and wish["completedDay"] != null and bool(wish["displayed"]):
		return wish["choice"]
	return null

static func _valid_day(value: Variant, min_day: float, max_day: float) -> bool:
	return JsUtil.is_number(value) and JsMath.is_safe_integer(value) and float(value) >= min_day and float(value) <= max_day

static func parse_regular_wishes(raw: Variant, s: Dictionary) -> Dictionary:
	var out := empty_regular_wishes()
	if not (raw is Dictionary) or not mina_wish_available(s):
		return out
	if not raw.has("mina") or not (raw["mina"] is Dictionary):
		return out
	var v: Dictionary = raw["mina"]
	var s_day := float(s["day"])
	var first_met := float(s["regularGuests"]["guests"]["mina"]["firstMetDay"])
	var choice = v["choice"] if v.has("choice") else JsUtil.UNDEFINED
	var accepted = v["acceptedDay"] if v.has("acceptedDay") else JsUtil.UNDEFINED
	if not is_mina_wish_choice(choice) or not _valid_day(accepted, first_met, s_day):
		return out
	var served := float(s["regularGuests"]["guests"]["mina"]["served"])
	var raw_reh = v["rehearsedDay"] if v.has("rehearsedDay") else JsUtil.UNDEFINED
	var rehearsed_day: Variant = float(raw_reh) if (served >= 2.0 and _valid_day(raw_reh, float(accepted), s_day)) else null
	var raw_comp = v["completedDay"] if v.has("completedDay") else JsUtil.UNDEFINED
	var completed_day: Variant = float(raw_comp) if (rehearsed_day != null and served >= 3.0 and _valid_day(raw_comp, float(rehearsed_day) + 1.0, s_day)) else null
	var paused: bool = rehearsed_day == null and v.has("paused") and (v["paused"] is bool) and v["paused"] == true
	var displayed: bool = completed_day != null and v.has("displayed") and (v["displayed"] is bool) and v["displayed"] == true
	out["mina"] = {
		"choice": choice,
		"acceptedDay": float(accepted),
		"paused": paused,
		"rehearsedDay": rehearsed_day,
		"completedDay": completed_day,
		"displayed": displayed,
	}
	return out
