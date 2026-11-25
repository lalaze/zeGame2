class_name CoreMoments
extends RefCounted

## Port of src/game/moments.ts: optional café moments during service. They have their own random source, so the
## simulation is untouched when nobody plays.

static var RECOMMEND_TIP: Dictionary = RulesData.section("moments")["RECOMMEND_TIP"]
static var GREET_TIP: float = RulesData.section("moments")["GREET_TIP"]
static var GREET_PATIENCE: float = RulesData.section("moments")["GREET_PATIENCE"]
static var CAT_REWARD: float = RulesData.section("moments")["CAT_REWARD"]
static var PHOTO_REWARD: float = RulesData.section("moments")["PHOTO_REWARD"]
static var DELIVERY_VALUE: float = RulesData.section("moments")["DELIVERY_VALUE"]
static var SAMPLE_SERVINGS: Dictionary = RulesData.section("moments")["SAMPLE_SERVINGS"]
static var DELIVERIES_PER_DAY: float = RulesData.section("moments")["DELIVERIES_PER_DAY"]
static var CUE_SECONDS: float = RulesData.section("moments")["CUE_SECONDS"]
const _FIRST_GAP := 12.0
const _GAP_MIN := 20.0
const _GAP_SPREAD := 20.0
const _REACTION_SECONDS := 5.5
const _MIN_PATIENCE := 15.0
const _PHOTO_SITTING := 5.0
const _PHOTO_WAITING := 20.0
const _WEIGHTS := {"recommend": 3.0, "photo": 2.0, "cat": 2.0, "delivery": 1.0}


## How a dish lands with a guest: a liked note without an avoided one is a hit.
static func recommend_verdict(item: String, taste: Dictionary) -> String:
	var flavors := CoreFlavors.item_flavors(item)
	var liked := flavors.has(taste["liked"])
	var avoided := flavors.has(taste["avoided"])
	return "love" if liked and not avoided else ("meh" if avoided and not liked else "fine")


## Servings already spoken for by guests ahead in line or at the counter.
static func _claimed(sim: CoreSim, id: String, guest: Dictionary) -> float:
	var n := 0.0
	for c: Dictionary in sim.customers:
		if not is_same(c, guest) and (c["phase"] == "queue" or c["phase"] == "toCounter") and (c["order"] == id or c["extra"] is String and c["extra"] == id):
			n += 1.0
	return n


## Keep the original order or try one alternative of the same kind.
static func recommend_options(state: Dictionary, sim: CoreSim, c: Dictionary, random: Callable) -> Array:
	var order: String = c["order"]
	var bakery := CoreEconomy.is_bakery(order)
	var taste := CoreFlavors.guest_taste(c)
	var pool := []
	for m: Dictionary in CoreEconomy.menu_items(state):
		var id: String = m["id"]
		if not (c["extra"] is String and c["extra"] == id) and CoreEconomy.is_bakery(id) == bakery and CoreEconomy.ready_servings(state, id) >= _claimed(sim, id, c) + 2.0:
			pool.append(id)
	if not pool.has(order):
		return []
	var alternatives := pool.filter(func(id: String) -> bool: return id != order)
	if alternatives.is_empty():
		return []
	var original := recommend_verdict(order, taste)
	var contrasting := alternatives.filter(func(id: String) -> bool: return recommend_verdict(id, taste) != original)
	var choices := contrasting if not contrasting.is_empty() else alternatives
	for verdict: String in ["love", "fine", "meh"]:
		var best := choices.filter(func(id: String) -> bool: return recommend_verdict(id, taste) == verdict)
		if not best.is_empty():
			return [order, best[int(floor(random.call() * best.size()))]]
	return []


## Just inside the front door, off the runner.
static func delivery_spot() -> Dictionary:
	return {"x": CoreLayout.DOOR_X + CoreLayout.DOOR_W + 44.0, "y": CoreLayout.scene_height() - 32.0, "area": "main"}


## The ingredients for a few servings of one of today's dishes.
static func delivery_gift(state: Dictionary, random: Callable) -> Variant:
	# Bakery stock is baked ahead; only a kitchen turns new flour into more of it.
	var dishes := []
	for m: Dictionary in CoreEconomy.menu_items(state):
		if (not CoreEconomy.is_bakery(m["id"]) or state["kitchen"]) and CoreEconomy.serving_cost(m["id"]) > 0.0:
			dishes.append(m["id"])
	if dishes.is_empty():
		return null
	var item: String = dishes[int(floor(random.call() * dishes.size()))]
	var servings := JsMath.js_max(SAMPLE_SERVINGS["min"], JsMath.js_min(SAMPLE_SERVINGS["max"], JsMath.js_round(DELIVERY_VALUE * CoreEconomy.average_dish_price(state) / CoreEconomy.serving_cost(item))))
	var ingredients := {}
	for part: Array in CoreEconomy.recipe(item):
		ingredients[part[0]] = part[1] * servings
	return {"item": item, "servings": servings, "ingredients": ingredients}


## Coins paid on the spot; they count toward today's takings.
static func _reward(state: Dictionary, dishes: float) -> float:
	var amount := JsMath.js_round(dishes * CoreEconomy.average_dish_price(state) * 100.0) / 100.0
	if amount <= 0.0:
		return 0.0
	CoreEconomy.earn(state, amount)
	state["today"]["revenue"] += amount
	return amount


static func _still_waiting(m: Dictionary, c: Dictionary) -> bool:
	if m["kind"] == "recommend":
		return c["phase"] == "queue"
	if m["kind"] == "photo":
		return CoreSim.seated(c)
	return c["phase"] == "queue" or c["phase"] == "toCounter"


class MomentDirector extends RefCounted:
	var active: Variant = null
	var reaction: Variant = null
	## Real open-service seconds since the last moment ended.
	var _since := 0.0
	var _next_gap := _FIRST_GAP
	var _offered: Array = []
	var _deliveries := 0.0
	var _last: Variant = null
	var _day := -1.0
	var _serial := 0.0
	var _recommended := false
	var _random: Callable

	func _init(random: Callable) -> void:
		_random = random

	## A new café or a reloaded service: nothing pending, nobody asked yet.
	func reset() -> void:
		active = null
		reaction = null
		_offered = []
		_since = 0.0
		_next_gap = _FIRST_GAP
		_day = -1.0
		_deliveries = 0.0
		_last = null
		_recommended = false

	## `sim_dt` follows the café clock; `real_dt` is how much real time passed. Both are 0 while paused.
	func update(state: Dictionary, sim: CoreSim, sim_dt: float, real_dt: float, stage: Dictionary = {"area": "main", "cats": []}) -> void:
		if reaction != null:
			reaction["ttl"] -= real_dt
			if reaction["ttl"] <= 0.0:
				reaction = null
		if state["day"] != _day:
			reset()
			_day = state["day"]
		if state["phase"] != "open":
			active = null
			return
		if active != null:
			var m: Dictionary = active
			var c: Variant = _guest(sim, m)
			m["age"] += real_dt
			if m.has("customerId") and (c == null or not CoreMoments._still_waiting(m, c)) or m["age"] > CoreMoments.CUE_SECONDS:
				_end()
			return
		if sim_dt <= 0.0 or real_dt <= 0.0:
			return
		_since += real_dt
		if _since < _next_gap or not stage["area"] is String:
			return
		var kinds := []
		if stage["area"] == "main":
			kinds.append("recommend")
			# The first eligible recommendation takes precedence over incidental tips. After that, named regulars do.
			if not _recommended:
				var recommendation: Variant = _offer("recommend", state, sim, stage)
				if recommendation != null:
					_start(recommendation)
					return
			for c: Dictionary in sim.customers:
				if JsUtil.truthy(c.get("regularGuestId")) and c["phase"] == "queue" and not _offered.has(c["id"]):
					_start({"kind": "greet", "customerId": c["id"], "options": [], "age": 0.0})
					return
			if _deliveries < CoreMoments.DELIVERIES_PER_DAY:
				kinds.append("delivery")
		kinds.append("photo")
		kinds.append("cat")
		while not kinds.is_empty():
			var sum := 0.0
			for k: String in kinds:
				sum += _weight(k)
			var roll: float = _random.call() * sum
			var kind: String = kinds[-1]
			for k: String in kinds:
				roll -= _weight(k)
				if roll < 0.0:
					kind = k
					break
			kinds.erase(kind)
			var moment: Variant = _offer(kind, state, sim, stage)
			if moment != null:
				_start(moment)
				return

	func _weight(kind: String) -> float:
		return _WEIGHTS[kind] * (0.25 if _last is String and kind == _last else 1.0)

	func _guest(sim: CoreSim, m: Dictionary) -> Variant:
		if m.has("customerId"):
			for c: Dictionary in sim.customers:
				if c["id"] == m["customerId"]:
					return c
		return null

	func _offer(kind: String, state: Dictionary, sim: CoreSim, stage: Dictionary) -> Variant:
		match kind:
			"recommend":
				var waiting := sim.customers.filter(func(c: Dictionary) -> bool:
					return c["phase"] == "queue" and not JsUtil.truthy(c.get("regularGuestId")) and not JsUtil.truthy(c.get("trialSale")) and not _offered.has(c["id"]) and c["patience"] >= _MIN_PATIENCE)
				while not waiting.is_empty():
					var at := int(floor(_random.call() * waiting.size()))
					var c: Dictionary = waiting[at]
					waiting.remove_at(at)
					var options := CoreMoments.recommend_options(state, sim, c, _random)
					if options.size() == 2:
						return {"kind": "recommend", "customerId": c["id"], "options": options, "age": 0.0}
			"delivery":
				var gift: Variant = CoreMoments.delivery_gift(state, _random)
				if gift != null:
					return {"kind": "delivery", "options": [], "spot": CoreMoments.delivery_spot(), "gift": gift, "age": 0.0}
			"photo":
				var posing := sim.customers.filter(func(c: Dictionary) -> bool:
					if _offered.has(c["id"]):
						return false
					var area: Variant = CoreLayout.area_at_point(c["x"], c["y"])
					return area is String and area == stage["area"] and (c["timer"] >= _PHOTO_SITTING if c["phase"] == "sitting" else c["phase"] == "waiting" and c["timer"] >= _PHOTO_WAITING))
				var at := int(floor(_random.call() * posing.size()))
				if at < posing.size():
					return {"kind": "photo", "customerId": posing[at]["id"], "options": [], "age": 0.0}
			"cat":
				var cats: Array = stage["cats"].filter(func(cat: Dictionary) -> bool: return cat["area"] == stage["area"])
				var at := int(floor(_random.call() * cats.size()))
				if at < cats.size():
					# The cup lands beside the cat: on the sill, or on the floor away from the near wall.
					var cat: Dictionary = cats[at]
					var sill: Variant = cat.get("sill", JsUtil.UNDEFINED)
					var side := -10.0 if not JsUtil.truthy(sill) and fmod(cat["x"], CoreLayout.SCENE_W) > CoreLayout.SCENE_W - 60.0 else 10.0
					return {"kind": "cat", "options": [], "spot": {"x": cat["x"] + side, "y": cat["y"], "area": cat["area"], "catId": cat["id"], "sill": sill}, "age": 0.0}
		return null

	func _is_active(kind: String) -> bool:
		return active != null and active["kind"] == kind

	## The player's pick: the guest orders it, and tips by how well it suits them.
	func recommend(state: Dictionary, sim: CoreSim, item: String) -> Variant:
		var c: Variant = _guest(sim, active) if _is_active("recommend") and active["options"].has(item) else null
		if (c == null or state["phase"] != "open" or c["phase"] != "queue" or JsUtil.truthy(c.get("trialSale")) or JsUtil.truthy(c.get("regularGuestId"))
				or not CoreEconomy._on(CoreEconomy.menu_items(state), item) or CoreEconomy.is_bakery(item) != CoreEconomy.is_bakery(c["order"])
				or CoreEconomy.ready_servings(state, item) < CoreMoments._claimed(sim, item, c) + 1.0):
			_end()
			return null
		var verdict := CoreMoments.recommend_verdict(item, CoreFlavors.guest_taste(c))
		c["order"] = item
		c["recommendation"] = item
		var remembered: Variant = c.get("rememberedOrder")
		if not (remembered is String and (remembered == item or c["extra"] is String and remembered == c["extra"])):
			c.erase("rememberedOrder")
		c["momentTip"] = CoreMoments.RECOMMEND_TIP[verdict]
		if verdict == "love":
			c["mood"] = "happy"
			c["moodTimer"] = 1.5
		_react(c, "moment.recommend.%s" % verdict)
		_end()
		return verdict

	## Waving back: the regular shares what's on their mind, waits a little longer and tips a little more.
	func greet(state: Dictionary, sim: CoreSim) -> Variant:
		var c: Variant = _guest(sim, active) if _is_active("greet") else null
		var guest: Variant = CoreRegularGuests.regular_guest_definition(c.get("regularGuestId")) if c != null else null
		if not guest is Dictionary or not CoreMoments._still_waiting(active, c):
			_end()
			return null
		c["momentTip"] = CoreMoments.GREET_TIP
		if c["phase"] == "queue":
			c["patience"] += CoreMoments.GREET_PATIENCE
		c["mood"] = "happy"
		c["moodTimer"] = 1.5
		var progress: Variant = CoreRegularGuests.regular_guest_progress(state, guest["id"])
		var unlocked: int = progress["unlockedChapters"].size() if progress is Dictionary else 0
		_react(c, "moment.greet.%s.%d" % [guest["id"], mini(unlocked, guest["chapters"].size() - 1) + 1])
		_end()
		return guest["nameKey"]

	## Tidying up after the cat. Returns the coins.
	func tidy(state: Dictionary) -> Variant:
		var ok: bool = _is_active("cat") and state["phase"] == "open"
		_end()
		return CoreMoments._reward(state, CoreMoments.CAT_REWARD) if ok else null

	## Taking the guest's photo. Returns the coins.
	func photo(state: Dictionary, sim: CoreSim) -> Variant:
		var c: Variant = _guest(sim, active) if _is_active("photo") else null
		if c == null or not CoreMoments._still_waiting(active, c) or state["phase"] != "open":
			_end()
			return null
		c["mood"] = "happy"
		c["moodTimer"] = 1.5
		_react(c, "moment.photo.thanks")
		_end()
		return CoreMoments._reward(state, CoreMoments.PHOTO_REWARD)

	## Signing for the parcel: the sample goes straight into the pantry.
	func sign_delivery(state: Dictionary) -> Variant:
		var gift: Variant = active.get("gift") if _is_active("delivery") else null
		_end()
		if gift == null or state["phase"] != "open":
			return null
		for ing: String in gift["ingredients"]:
			state["pantry"][ing] += gift["ingredients"][ing]
		return gift

	## "Let them choose": the guest keeps their own order.
	func dismiss() -> void:
		_end()

	func _start(moment: Dictionary) -> void:
		if moment["kind"] == "recommend":
			_recommended = true
		if moment.has("customerId") and not _offered.has(moment["customerId"]):
			_offered.append(moment["customerId"])
		if moment["kind"] == "delivery":
			_deliveries += 1.0
		active = moment
		_last = moment["kind"]

	func _end() -> void:
		active = null
		_since = 0.0
		_next_gap = _GAP_MIN + _random.call() * _GAP_SPREAD

	func _react(c: Dictionary, key: String) -> void:
		_serial += 1.0
		reaction = {"customerId": c["id"], "key": key, "context": "moment:%s" % JsMath.number_to_string(_serial), "ttl": _REACTION_SECONDS}
