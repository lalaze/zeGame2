class_name CoreChain
extends RefCounted

## Port of src/game/chain.ts: branches, stars and franchises.

static var STAR_EARNINGS: float = RulesData.section("chain")["STAR_EARNINGS"]
static var FRANCHISE_SHARE: float = RulesData.section("chain")["FRANCHISE_SHARE"]
const _MAX_FRANCHISES := 200


static func empty_chain(now: float = 0.0) -> Dictionary:
	return {"stars": 0.0, "branches": 0.0, "baseEarned": 0.0, "location": "town", "franchises": [], "franchiseSince": now, "perks": []}


static func _amount(v: Variant) -> bool:
	return JsMath.is_finite_num(v) and v >= 0.0


static func parse_chain(value: Variant, now: float = 0.0) -> Dictionary:
	var base := empty_chain(now)
	var c: Variant = JsUtil.as_object(value)
	if c == null:
		return base
	for key: String in ["stars", "branches"]:
		var n: Variant = JsUtil.prop(c, key)
		base[key] = floor(n) if _amount(n) else 0.0
	var earned: Variant = JsUtil.prop(c, "baseEarned")
	base["baseEarned"] = earned if _amount(earned) else 0.0
	if CoreLocations.is_location(JsUtil.prop(c, "location")):
		base["location"] = c["location"]
	var franchises: Variant = JsUtil.prop(c, "franchises")
	if franchises is Array:
		for f: Variant in franchises.slice(0, _MAX_FRANCHISES):
			var hourly: Variant = JsUtil.prop(f, "hourly")
			if CoreLocations.is_location(JsUtil.prop(f, "location")) and _amount(hourly):
				base["franchises"].append({"location": f["location"], "hourly": hourly})
	# As with away time, a timestamp in the future counts from now.
	var since: Variant = JsUtil.prop(c, "franchiseSince")
	if JsMath.is_finite_num(since) and since > 0.0:
		base["franchiseSince"] = JsMath.js_min(since, now)
	var perks: Variant = JsUtil.prop(c, "perks")
	if perks is Array:
		for p: Dictionary in CoreChainBonuses.PERKS:
			if JsUtil.includes(perks, p["id"]):
				base["perks"].append(p["id"])
	return base


## What every franchise together pays into the till per real hour.
static func franchise_hourly(state: Dictionary) -> float:
	var sum := 0.0
	for f: Dictionary in state["chain"]["franchises"]:
		sum += f["hourly"]
	return sum


## Franchise pay waiting in the till. It shares the till's size, on screen or away.
static func franchise_earnings(state: Dictionary, now: float) -> Dictionary:
	var hourly := franchise_hourly(state)
	if hourly <= 0.0:
		return {"amount": 0.0, "fill": 0.0, "full": false}
	var elapsed := JsMath.js_max(0.0, (now - state["chain"]["franchiseSince"]) / 1000.0)
	var capacity := CoreManager.till_seconds(state)
	return {"amount": floor(hourly * CoreManager.paid_seconds(elapsed, capacity) / 3600.0), "fill": JsMath.js_min(1.0, elapsed / capacity), "full": elapsed >= capacity}


## It isn't this branch's own takings, so it leaves the stars a new branch would bring unchanged.
static func collect_franchises(state: Dictionary, now: float) -> float:
	var amount: float = franchise_earnings(state, now)["amount"]
	if amount > 0.0:
		CoreEconomy.earn(state, amount)
		state["chain"]["baseEarned"] += amount
	state["chain"]["franchiseSince"] = now
	return amount


## What this branch has earned since it opened.
static func branch_earnings(state: Dictionary) -> float:
	return JsMath.js_max(0.0, state["totalEarned"] - state["chain"]["baseEarned"])


## Stars a new branch would bring now.
static func stars_on_branch(state: Dictionary) -> float:
	return stars_for(branch_earnings(state))


## One star at STAR_EARNINGS, one more per doubling.
static func stars_for(earned: float) -> float:
	var stars := 0.0
	var threshold := STAR_EARNINGS
	while earned >= threshold and is_finite(threshold):
		stars += 1.0
		threshold *= 2.0
	return stars


## What this branch must have earned in all for one more star.
static func next_star_at(state: Dictionary) -> float:
	return STAR_EARNINGS * JsMath.js_pow(2.0, stars_on_branch(state))


static func branch_unlocked(state: Dictionary) -> bool:
	return state["regions"].has("terrace") or CoreStreets.owns_street_business(state, "terrace")


static func can_open_branch(state: Dictionary) -> bool:
	return branch_unlocked(state) and state["phase"] == "prep" and stars_on_branch(state) > 0.0


static func chain_bonus_percent(stars: float) -> float:
	return JsMath.js_round(stars * CoreData.CHAIN_STAR_BONUS * 100.0)


## Starts a new branch: a fresh café with the owner, the manager, stories, cats, recipes and milestones carried over.
## The result is read back through the normal loader, so cross-checked state settles as it would for a loaded game.
static func open_branch(state: Dictionary, location: String, now: float) -> Variant:
	if not can_open_branch(state) or not CoreLocations.is_location(location):
		return null
	var chain: Dictionary = state["chain"]
	var waiting: float = franchise_earnings(state, now)["amount"]
	var franchises: Array = chain["franchises"].duplicate(false)
	franchises.append({"location": chain["location"], "hourly": CoreManager.away_hourly(state) * FRANCHISE_SHARE})
	franchises = franchises.slice(-mini(_MAX_FRANCHISES, franchises.size()))
	var fresh := CoreState.create_initial_state(state["createdAt"])
	# Settle side businesses on a copy; branch previews must never mutate the old café.
	var settled := state.duplicate(false)
	settled["roomProjects"] = state["roomProjects"].duplicate(true)
	var reward := CoreRoomProjects.collect_all_projects(settled, now)
	var carried := fresh.duplicate(false)
	for key: String in ["profile", "manager", "orders"]:
		carried[key] = state[key]
	carried["roomProjects"] = settled["roomProjects"].duplicate(false)
	carried["roomProjects"]["facilities"] = {}
	carried["streets"] = state["streets"].duplicate(true)
	for key: String in ["milestones", "goal", "day", "speed", "served", "guestMemories", "regularGuests", "regularWishes", "partners", "pets", "catGifts", "signatureDrinks"]:
		carried[key] = state[key]
	carried["cafeStyle"] = state["cafeStyle"].duplicate(false)
	carried["cafeStyle"].erase("bakeryTrialDay")
	carried["coins"] = fresh["coins"] + waiting + reward["coins"]
	carried["totalEarned"] = state["totalEarned"] + waiting + reward["coins"]
	carried["chain"] = {
		"stars": chain["stars"] + stars_on_branch(state), "branches": chain["branches"] + 1.0, "baseEarned": state["totalEarned"] + waiting + reward["coins"],
		"location": location, "franchises": franchises, "franchiseSince": now, "perks": chain["perks"].duplicate(false),
	}
	# The kitchen perk: every new branch opens with its kitchen already built.
	carried["kitchen"] = CoreChainBonuses.has_perk(state, "kitchen")
	var decor: Dictionary = fresh["decor"].duplicate(false)
	decor["stored"] = decor["stored"].duplicate(false)
	decor["stored"]["chain_map"] = 1.0
	var grown := chain.duplicate(false)
	grown["franchises"] = franchises
	if CoreChainBonuses.chain_complete({"chain": grown}):
		decor["stored"]["chain_plaque"] = 1.0
	carried["decor"] = decor
	return CoreState.deserialize(JsJson.stringify(carried), now)
