class_name CoreTrialSales
extends RefCounted

# Port of src/game/trial-sales.ts

static var TRIAL_SALE_LIMIT: float = RulesData.section("trial-sales")["TRIAL_SALE_LIMIT"]

static func empty_trial_sales() -> Dictionary:
	return {"selected": null, "active": null, "last": null}

static func _definition(id: Variant) -> Variant:
	var m = CoreData.find_menu(id)
	if m != null:
		return m
	return CoreSignatureDrinks.signature_definition(id)

static func can_trial_drink(s: Dictionary, id: Variant) -> bool:
	if not (id is String):
		return false
	var def = _definition(id)
	if def == null or not CoreData.is_drink(def["category"]):
		return false
	if not bool(s["kitchen"]) and (id == "affogato" or id == "matchafloat"):
		return false
	if id.begins_with("sig:"):
		for recipe in s["signatureDrinks"]["recipes"]:
			if recipe["id"] == id and not bool(recipe["onMenu"]):
				return true
		return false
	var items: Dictionary = s["items"]
	var did: String = def["id"]
	var lv_ok := items.has(did) and JsUtil.is_number(items[did]) and float(items[did]) > 0.0
	return lv_ok and not s["onMenu"].has(did)

static func select_trial_sale(s: Dictionary, item: Variant) -> bool:
	if s["phase"] != "prep":
		return false
	if item != null and not can_trial_drink(s, item):
		return false
	if s["trialSales"]["selected"] == item:
		return false
	s["trialSales"]["selected"] = item
	return true

static func trial_sale_item(s: Dictionary) -> Variant:
	var item: Variant = null
	if s.has("trialSales") and s["trialSales"] is Dictionary:
		var ts: Dictionary = s["trialSales"]
		if s["phase"] == "prep":
			item = ts["selected"] if ts.has("selected") else null
		elif ts.has("active") and ts["active"] is Dictionary and float(ts["active"]["day"]) == float(s["day"]):
			item = ts["active"]["item"]
	if item is String and not item.is_empty() and can_trial_drink(s, item):
		return item
	return null

static func trial_sale_remaining(s: Dictionary) -> float:
	if trial_sale_item(s) == null:
		return 0.0
	if s["phase"] == "prep":
		return TRIAL_SALE_LIMIT
	return TRIAL_SALE_LIMIT - float(s["trialSales"]["active"]["prepared"])

static func trial_held_for_mina(s: Dictionary) -> bool:
	var wish = CoreRegularWishes.mina_wish(s)
	var item = trial_sale_item(s)
	return item != null and CoreRegularWishes.is_mina_wish_drink(item) and wish != null and wish["choice"] == "milky" and not bool(wish["paused"]) and wish["rehearsedDay"] == null

static func begin_trial_sales(s: Dictionary) -> void:
	var item = trial_sale_item(s)
	if item != null:
		var run: Dictionary = {"item": item}
		if (item as String).begins_with("sig:"):
			for recipe in s["signatureDrinks"]["recipes"]:
				if recipe["id"] == item:
					run["name"] = recipe["name"]
					break
		run["day"] = float(s["day"])
		run["prepared"] = 0.0
		run["served"] = 0.0
		run["reserved"] = 0.0
		run["visits"] = 0.0
		run["ingredientCost"] = 0.0
		run["revenue"] = 0.0
		run["feedback"] = {"love": 0.0, "fine": 0.0, "meh": 0.0}
		var t_served: Dictionary = s["taste"]["served"]
		run["practiceBefore"] = float(t_served[item]) if (t_served.has(item) and not JsUtil.is_nullish(t_served[item])) else 0.0
		run["qualityBefore"] = CoreTaste.taste_score(s, item)
		s["trialSales"]["active"] = run
	else:
		s["trialSales"]["active"] = null
		s["trialSales"]["selected"] = null

static func trial_offer_due(s: Dictionary, regular_id: Variant = JsUtil.UNDEFINED) -> bool:
	var run = s["trialSales"]["active"]
	if s["phase"] != "open" or not (run is Dictionary) or float(run["day"]) != float(s["day"]):
		return false
	if regular_id is String and not regular_id.is_empty():
		return regular_id == "mina" and trial_held_for_mina(s)
	run["visits"] = float(run["visits"]) + 1.0
	return fmod(float(run["visits"]), 3.0) == 0.0

static func can_reserve_trial_sale(s: Dictionary, regular_id: Variant = JsUtil.UNDEFINED) -> bool:
	var run = s["trialSales"]["active"]
	if s["phase"] != "open" or not (run is Dictionary) or trial_sale_item(s) == null:
		return false
	var hold := 1.0 if ((not (regular_id is String) or regular_id != "mina") and trial_held_for_mina(s)) else 0.0
	var limit := TRIAL_SALE_LIMIT - hold
	return float(run["prepared"]) + float(run["reserved"]) < limit

static func reserve_trial_sale(s: Dictionary, regular_id: Variant = JsUtil.UNDEFINED) -> bool:
	if not can_reserve_trial_sale(s, regular_id):
		return false
	s["trialSales"]["active"]["reserved"] = float(s["trialSales"]["active"]["reserved"]) + 1.0
	return true

static func release_trial_sale(s: Dictionary) -> void:
	var run = s["trialSales"]["active"]
	if run is Dictionary and float(run["day"]) == float(s["day"]):
		run["reserved"] = JsMath.js_max(0.0, float(run["reserved"]) - 1.0)

static func record_trial_prepared(s: Dictionary, cost: float) -> void:
	var run = s["trialSales"]["active"]
	if not (run is Dictionary) or float(run["day"]) != float(s["day"]) or float(run["reserved"]) <= 0.0 or float(run["prepared"]) >= TRIAL_SALE_LIMIT:
		return
	run["reserved"] = float(run["reserved"]) - 1.0
	run["prepared"] = float(run["prepared"]) + 1.0
	run["ingredientCost"] = float(run["ingredientCost"]) + cost

static func trial_feedback(item: Variant, guest: Dictionary) -> String:
	var taste := CoreFlavors.guest_taste(guest)
	var notes := CoreFlavors.item_flavors(item)
	var liked := notes.has(taste["liked"])
	var avoided := notes.has(taste["avoided"])
	if liked and not avoided:
		return "love"
	if avoided and not liked:
		return "meh"
	return "fine"

static func record_trial_served(s: Dictionary, amount: float, guest: Dictionary) -> void:
	var run = s["trialSales"]["active"]
	if not (run is Dictionary) or float(run["day"]) != float(s["day"]) or float(run["served"]) >= float(run["prepared"]):
		return
	run["served"] = float(run["served"]) + 1.0
	run["revenue"] = float(run["revenue"]) + amount
	var fb := trial_feedback(run["item"], guest)
	run["feedback"][fb] = float(run["feedback"][fb]) + 1.0

static func finish_trial_sales(s: Dictionary) -> Variant:
	var run = s["trialSales"]["active"]
	s["trialSales"]["active"] = null
	s["trialSales"]["selected"] = null
	if not (run is Dictionary) or float(run["day"]) != float(s["day"]):
		return JsUtil.UNDEFINED
	var report: Dictionary = {}
	for k in run.keys():
		if k == "reserved" or k == "visits":
			continue
		if k == "feedback":
			report["feedback"] = run["feedback"].duplicate(false)
		else:
			report[k] = run[k]
	report["qualityAfter"] = CoreTaste.taste_score(s, run["item"])
	s["trialSales"]["last"] = JsUtil.deep_clone(report)
	return report

static func _object(v: Variant) -> bool:
	return v is Dictionary

static func _count(v: Variant, max_val: Variant = JsUtil.UNDEFINED) -> bool:
	var mx := TRIAL_SALE_LIMIT if JsUtil.is_undefined(max_val) else float(max_val)
	return JsUtil.is_number(v) and JsMath.is_safe_integer(v) and float(v) >= 0.0 and float(v) <= mx

static func _money(v: Variant) -> bool:
	return JsUtil.is_number(v) and is_finite(float(v)) and float(v) >= 0.0

static func _quality(v: Variant) -> bool:
	return _money(v) and float(v) <= 5.0

static func _parse_stats(raw: Variant, day: float) -> Variant:
	if not _object(raw):
		return null
	var r: Dictionary = raw
	if not r.has("item") or not (r["item"] is String):
		return null
	var def = _definition(r["item"])
	if def == null or not CoreData.is_drink(def["category"]):
		return null
	var r_day = r["day"] if r.has("day") else JsUtil.UNDEFINED
	var r_prep = r["prepared"] if r.has("prepared") else JsUtil.UNDEFINED
	var r_srv = r["served"] if r.has("served") else JsUtil.UNDEFINED
	var r_ic = r["ingredientCost"] if r.has("ingredientCost") else JsUtil.UNDEFINED
	var r_rev = r["revenue"] if r.has("revenue") else JsUtil.UNDEFINED
	var r_qb = r["qualityBefore"] if r.has("qualityBefore") else JsUtil.UNDEFINED
	var r_pb = r["practiceBefore"] if r.has("practiceBefore") else JsUtil.UNDEFINED
	if (not _count(r_day, day) or float(r_day) < 1.0 or not _count(r_prep) or not _count(r_srv, float(r_prep))
		or not _money(r_ic) or not _money(r_rev) or not _quality(r_qb) or not _count(r_pb, 1000000000.0)
		or not r.has("feedback") or not _object(r["feedback"])):
		return null
	var fb: Dictionary = r["feedback"]
	var love = fb["love"] if fb.has("love") else JsUtil.UNDEFINED
	var fine = fb["fine"] if fb.has("fine") else JsUtil.UNDEFINED
	var meh = fb["meh"] if fb.has("meh") else JsUtil.UNDEFINED
	if not _count(love) or not _count(fine) or not _count(meh) or float(love) + float(fine) + float(meh) != float(r_srv):
		return null
	var out: Dictionary = {
		"item": r["item"],
		"day": float(r_day),
		"prepared": float(r_prep),
		"served": float(r_srv),
		"ingredientCost": float(r_ic),
		"revenue": float(r_rev),
		"feedback": {"love": float(love), "fine": float(fine), "meh": float(meh)},
		"practiceBefore": float(r_pb),
		"qualityBefore": float(r_qb),
	}
	if r.has("name") and r["name"] is String:
		out["name"] = JsUtil.js_trim(JsUtil.strip_ascii_control(r["name"])).substr(0, 24)
	return out

static func parse_trial_sales(raw: Variant, s: Dictionary) -> Dictionary:
	var out := empty_trial_sales()
	if not _object(raw):
		return out
	var r: Dictionary = raw
	if r.has("selected") and r["selected"] is String and can_trial_drink(s, r["selected"]):
		out["selected"] = r["selected"]
	var s_day := float(s["day"])
	var active = _parse_stats(r["active"] if r.has("active") else JsUtil.UNDEFINED, s_day)
	if s["phase"] != "prep" and active != null and float(active["day"]) == s_day and can_trial_drink(s, active["item"]) and _object(r["active"]):
		var raw_active: Dictionary = r["active"]
		var raw_res = raw_active["reserved"] if raw_active.has("reserved") else JsUtil.UNDEFINED
		var raw_vis = raw_active["visits"] if raw_active.has("visits") else JsUtil.UNDEFINED
		var sales: Dictionary = s["today"]["sales"]
		var item_sales := float(sales[active["item"]]) if (sales.has(active["item"]) and not JsUtil.is_nullish(sales[active["item"]])) else 0.0
		if _count(raw_res, TRIAL_SALE_LIMIT - float(active["prepared"])) and _count(raw_vis, 1000000000.0) and float(active["served"]) <= item_sales:
			var act_out: Dictionary = active.duplicate(false)
			act_out["reserved"] = float(raw_res)
			act_out["visits"] = float(raw_vis)
			out["active"] = act_out
			out["selected"] = active["item"]
	var last = _parse_stats(r["last"] if r.has("last") else JsUtil.UNDEFINED, s_day - 1.0)
	if last != null and _object(r["last"]):
		var raw_last: Dictionary = r["last"]
		var raw_qa = raw_last["qualityAfter"] if raw_last.has("qualityAfter") else JsUtil.UNDEFINED
		if _quality(raw_qa):
			var last_out: Dictionary = last.duplicate(false)
			last_out["qualityAfter"] = float(raw_qa)
			out["last"] = last_out
	return out
