class_name CoreReputation
extends RefCounted

# Port of src/game/reputation.ts

static var REVIEW_WINDOW: float = RulesData.section("reputation")["REVIEW_WINDOW"]
static var NEW_CAFE_SAMPLE: float = RulesData.section("reputation")["NEW_CAFE_SAMPLE"]
static var NEUTRAL_RATING: float = RulesData.section("reputation")["NEUTRAL_RATING"]
static var REVIEW_REASONS: Array = RulesData.section("reputation")["REVIEW_REASONS"]

static func empty_reviews() -> Dictionary:
	return {"stars": [0.0, 0.0, 0.0, 0.0, 0.0], "reasons": {}, "totalScore": 0.0}

static func review_count(summary: Dictionary) -> float:
	var total := 0.0
	for n in summary["stars"]:
		total += float(n)
	return total

static func review_average(summary: Dictionary) -> Variant:
	var cnt := review_count(summary)
	return float(summary["totalScore"]) / cnt if cnt != 0.0 else null

static func reputation_score(reputation: Dictionary) -> float:
	var recent: Array = reputation["recent"]
	var rlen := float(recent.size())
	var sample := NEW_CAFE_SAMPLE
	var neutral := JsMath.js_max(0.0, sample - rlen)
	var sum := 0.0
	for r in recent:
		sum += float(r["stars"])
	return (sum + neutral * NEUTRAL_RATING) / JsMath.js_max(sample, rlen)

static func reputation_traffic(reputation: Dictionary) -> float:
	var score := reputation_score(reputation)
	var nr := NEUTRAL_RATING
	if score >= nr:
		return 1.0 + (score - nr) * 0.25
	return 1.0 - (nr - score) / 12.0

static func service_review(wait_seconds: float, missing_extra: bool) -> Dictionary:
	if wait_seconds > 40.0:
		return {"stars": 2.0, "reason": "verySlow"}
	if missing_extra:
		return {"stars": 3.0, "reason": "incomplete"}
	if wait_seconds > 25.0:
		return {"stars": 3.0, "reason": "slow"}
	if wait_seconds > 12.0:
		return {"stars": 4.0, "reason": "steady"}
	return {"stars": 5.0, "reason": "prompt"}

static func meal_review(state: Dictionary, items: Array, wait_seconds: float, missing_extra: bool) -> Dictionary:
	var service := service_review(wait_seconds, missing_extra)
	var taste := CoreTaste.meal_taste(state, items)
	var reason_str: String
	if float(service["stars"]) < taste:
		reason_str = service["reason"]
	elif taste >= 5.0:
		reason_str = "signatureTaste"
	elif taste > 4.0:
		reason_str = "skilledTaste"
	else:
		reason_str = "standardTaste"
	return {
		"stars": JsMath.js_round(JsMath.js_min(taste, float(service["stars"])) * 10.0) / 10.0,
		"reason": reason_str,
		"taste": JsMath.js_round(taste * 10.0) / 10.0,
		"items": items.duplicate(false),
	}

static func record_review(state: Dictionary, review: Dictionary) -> void:
	var entry := review.duplicate(false)
	entry["day"] = float(state["day"])
	var recent: Array = state["reputation"]["recent"]
	recent.append(entry)
	if float(recent.size()) > REVIEW_WINDOW:
		recent.pop_front()
	var stars_arr: Array = state["today"]["reviews"]["stars"]
	var idx := int(JsMath.js_round(float(review["stars"]))) - 1
	stars_arr[idx] = float(stars_arr[idx]) + 1.0
	var rev: Dictionary = state["today"]["reviews"]
	rev["totalScore"] = JsMath.js_round((float(rev["totalScore"]) + float(review["stars"])) * 10.0) / 10.0
	var reasons: Dictionary = rev["reasons"]
	var r_key: String = review["reason"]
	var prev := float(reasons[r_key]) if reasons.has(r_key) and not JsUtil.is_nullish(reasons[r_key]) else 0.0
	reasons[r_key] = prev + 1.0

static func _object(v: Variant) -> bool:
	return v is Dictionary

static func _count(v: Variant) -> float:
	if JsUtil.is_number(v) and JsMath.is_safe_integer(v) and float(v) >= 0.0:
		return JsMath.js_min(float(v), 1000000000.0)
	return 0.0

static func _is_reason(v: Variant) -> bool:
	return (v is String) and REVIEW_REASONS.has(v)

static func parse_reputation(value: Variant) -> Dictionary:
	if not _object(value) or not value.has("recent") or not (value["recent"] is Array):
		return {"recent": []}
	var raw_recent: Array = value["recent"]
	var win := int(REVIEW_WINDOW)
	var start := maxi(0, raw_recent.size() - win)
	var recent: Array = []
	for idx in range(start, raw_recent.size()):
		var raw = raw_recent[idx]
		if not _object(raw):
			continue
		var r_reason = raw["reason"] if raw.has("reason") else JsUtil.UNDEFINED
		var r_stars = raw["stars"] if raw.has("stars") else JsUtil.UNDEFINED
		if not _is_reason(r_reason) or not JsUtil.is_number(r_stars) or not is_finite(float(r_stars)):
			continue
		var st := float(r_stars)
		if st < 1.0 or st > 5.0:
			continue
		var review: Dictionary = {
			"stars": JsMath.js_round(st * 10.0) / 10.0,
			"reason": r_reason,
			"day": JsMath.js_max(1.0, _count(raw["day"] if raw.has("day") else JsUtil.UNDEFINED)),
		}
		if raw.has("items") and raw["items"] is Array:
			var raw_items: Array = raw["items"]
			var filtered: Array = []
			var lim := mini(2, raw_items.size())
			for j in range(lim):
				var item_id = raw_items[j]
				if CoreData.find_menu(item_id) != null or ((item_id is String) and CoreSignatureDrinks.signature_definition(item_id) != null):
					filtered.append(item_id)
			review["items"] = filtered
		var minimum_taste := 4.0
		if review.has("items") and not review["items"].is_empty():
			var rev_items: Array = review["items"]
			var tsum := 0.0
			for item_id in rev_items:
				var sdef = CoreSignatureDrinks.signature_definition(item_id)
				tsum += float(sdef["quality"]) if sdef != null else 4.0
			minimum_taste = JsMath.js_round(tsum / float(rev_items.size()) * 10.0) / 10.0
		if raw.has("taste") and JsUtil.is_number(raw["taste"]) and is_finite(float(raw["taste"])):
			var raw_t := float(raw["taste"])
			if raw_t >= minimum_taste and raw_t <= 5.0:
				review["taste"] = JsMath.js_round(raw_t * 10.0) / 10.0
		recent.append(review)
	return {"recent": recent}

static func parse_reviews(value: Variant) -> Dictionary:
	var summary := empty_reviews()
	if not _object(value):
		return summary
	var v: Dictionary = value
	if v.has("stars") and v["stars"] is Array:
		var raw_stars: Array = v["stars"]
		var new_stars: Array = []
		for i in range(5):
			var el = raw_stars[i] if i < raw_stars.size() else JsUtil.UNDEFINED
			new_stars.append(_count(el))
		summary["stars"] = new_stars
	var total := review_count(summary)
	var legacy_total := 0.0
	for i in range(5):
		legacy_total += float(summary["stars"][i]) * float(i + 1)
	var raw_ts = v["totalScore"] if v.has("totalScore") else JsUtil.UNDEFINED
	if JsUtil.is_number(raw_ts) and is_finite(float(raw_ts)) and float(raw_ts) >= total and float(raw_ts) <= total * 5.0:
		summary["totalScore"] = JsMath.js_round(float(raw_ts) * 10.0) / 10.0
	else:
		summary["totalScore"] = legacy_total
	if v.has("reasons") and _object(v["reasons"]):
		var raw_reasons: Dictionary = v["reasons"]
		var remaining := review_count(summary)
		for key in REVIEW_REASONS:
			var n := JsMath.js_min(remaining, _count(raw_reasons[key] if raw_reasons.has(key) else JsUtil.UNDEFINED))
			if n != 0.0:
				summary["reasons"][key] = n
			remaining -= n
	return summary
