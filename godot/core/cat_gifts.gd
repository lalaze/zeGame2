class_name CoreCatGifts
extends RefCounted

## Port of src/game/cat-gifts.ts: what resident cats leave on the windowsills.

static var GIFT_KINDS: Array = RulesData.section("cat-gifts")["GIFT_KINDS"]
static var GIFT_INTERVAL_MS: float = RulesData.section("cat-gifts")["GIFT_INTERVAL_MS"]
static var GIFT_SPOTS: Array = RulesData.section("cat-gifts")["GIFT_SPOTS"]
static var GIFT_HOURS: float = RulesData.section("cat-gifts")["GIFT_HOURS"]
static var COIN_HOURS: float = RulesData.section("cat-gifts")["COIN_HOURS"]
static var COIN_CHANCE: float = RulesData.section("cat-gifts")["COIN_CHANCE"]
static var GIFT_MIN: float = RulesData.section("cat-gifts")["GIFT_MIN"]


static func is_gift_kind(v: Variant) -> bool:
	return v is String and GIFT_KINDS.has(v)


static func gift_interval(state: Dictionary) -> float:
	return GIFT_INTERVAL_MS * (CoreChainBonuses.PERK_GIFT_SHARE if CoreChainBonuses.has_perk(state, "cats") else 1.0)


static func empty_cat_gifts(now: float) -> Dictionary:
	return {"waiting": [], "next": now + GIFT_INTERVAL_MS, "brought": 0.0, "found": {}}


static func _count(v: Variant) -> float:
	return floor(v) if JsMath.is_finite_num(v) and v >= 0.0 else 0.0


static func parse_cat_gifts(value: Variant, now: float, cats: Array) -> Dictionary:
	var base := empty_cat_gifts(now)
	var g: Variant = JsUtil.as_object(value)
	if g == null:
		return base
	base["brought"] = _count(JsUtil.prop(g, "brought"))
	# A clock set back can't push the next gift further than one interval away.
	var next: Variant = JsUtil.prop(g, "next")
	if JsMath.is_finite_num(next):
		base["next"] = JsMath.js_min(next, now + GIFT_INTERVAL_MS)
	var found: Variant = JsUtil.as_object(JsUtil.prop(g, "found"))
	for kind: String in GIFT_KINDS:
		var n := _count(JsUtil.prop(found, kind))
		if n > 0.0:
			base["found"][kind] = n
	var waiting: Variant = JsUtil.prop(g, "waiting")
	if waiting is Array:
		var spots := []
		for raw: Variant in waiting:
			var kind: Variant = JsUtil.prop(raw, "kind")
			var cat: Variant = JsUtil.prop(raw, "cat")
			if not is_gift_kind(kind) or not cat is String or not cats.has(cat):
				continue
			var spot := _count(JsUtil.prop(raw, "spot"))
			if spot >= GIFT_SPOTS.size() or spots.has(spot):
				continue
			spots.append(spot)
			base["waiting"].append({"id": _count(JsUtil.prop(raw, "id")), "cat": cat, "kind": kind, "spot": spot})
	return base


## A repeatable number in [0, 1) for the café's nth gift, so reloading never changes it.
static func _roll(created_at: float, n: float, salt: int) -> float:
	var h := JsMath.to_uint32(floor(created_at)) ^ JsMath.ushr_i(JsMath.imul_i(JsMath.to_uint32(n + 1.0), 0x9e3779b1), 0) ^ JsMath.ushr_i(JsMath.imul_i(salt, 0x85ebca6b), 0)
	h = JsMath.ushr_i(JsMath.imul_i(h ^ (h >> 16), 0x7feb352d), 0)
	h = JsMath.ushr_i(JsMath.imul_i(h ^ (h >> 15), 0x846ca68b), 0)
	return float(h ^ (h >> 16)) / 4294967296.0


## Brings every gift that has come due, while there's room on the sills.
static func bring_gifts(state: Dictionary, now: float) -> Array:
	var gifts: Dictionary = state["catGifts"]
	var pets: Array = state["pets"]
	var brought := []
	var interval := gift_interval(state)
	if pets.is_empty():
		if now >= gifts["next"]:
			gifts["next"] = now + interval
		return brought
	while now >= gifts["next"]:
		var free := _free_spot(gifts["waiting"])
		if free < 0.0:
			# Full sills: the next gift comes one interval after a spot could next be free.
			gifts["next"] = now + interval
			break
		var n: float = gifts["brought"]
		gifts["brought"] += 1.0
		var cat: String = pets[int(floor(_roll(state["createdAt"], n, 1) * pets.size()))]["id"]
		var kind: String = "coin" if _roll(state["createdAt"], n, 2) < COIN_CHANCE else GIFT_KINDS[int(floor(_roll(state["createdAt"], n, 3) * (GIFT_KINDS.size() - 1)))]
		var gift := {"id": n, "cat": cat, "kind": kind, "spot": free}
		gifts["waiting"].append(gift)
		brought.append(gift)
		gifts["next"] += interval
	return brought


static func _free_spot(waiting: Array) -> float:
	for i in GIFT_SPOTS.size():
		var taken := false
		for g: Dictionary in waiting:
			taken = taken or g["spot"] == i
		if not taken:
			return i
	return -1.0


## What picking up a gift pays now.
static func gift_value(state: Dictionary, kind: String) -> float:
	return JsMath.js_max(GIFT_MIN, JsMath.js_round(CoreManager.away_hourly(state) * (COIN_HOURS if kind == "coin" else GIFT_HOURS)))


## Picks a gift up: pays for it and files it in the treasure box.
static func collect_gift(state: Dictionary, id: float) -> Variant:
	var waiting: Array = state["catGifts"]["waiting"]
	for i in waiting.size():
		if waiting[i]["id"] != id:
			continue
		var gift: Dictionary = waiting[i]
		waiting.remove_at(i)
		var kind: String = gift["kind"]
		var amount := gift_value(state, kind)
		CoreEconomy.earn(state, amount)
		var found: Dictionary = state["catGifts"]["found"]
		var first: bool = found.get(kind, 0.0) == 0.0
		found[kind] = found.get(kind, 0.0) + 1.0
		return {"gift": gift, "amount": amount, "first": first}
	return null


## Kinds found at least once, for the treasure box.
static func gift_kinds_found(state: Dictionary) -> float:
	var n := 0.0
	for k: String in GIFT_KINDS:
		if state["catGifts"]["found"].get(k, 0.0) > 0.0:
			n += 1.0
	return n
