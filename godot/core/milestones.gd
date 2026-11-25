class_name CoreMilestones
extends RefCounted

## Port of src/game/milestones.ts. CHAPTERS is data; each milestone's progress is `milestone_progress`.

static var OPEN_AFTER: float = RulesData.section("milestones")["OPEN_AFTER"]
static var WEATHER_WIN: Dictionary = RulesData.section("milestones")["WEATHER_WIN"]
static var CHAPTERS: Array = RulesData.section("milestones")["CHAPTERS"]
const _RATING_REVIEWS := 50


static func _room(s: Dictionary, id: String) -> Array:
	return [1.0 if s["regions"].has(id) or CoreStreets.owns_street_business(s, id) else 0.0, 1.0]


## A rating over too few reviews isn't a reputation yet.
static func enough_reviews(s: Dictionary) -> bool:
	return s["reputation"]["recent"].size() >= _RATING_REVIEWS


static func _practiced(s: Dictionary) -> float:
	var n := 0.0
	for m: Dictionary in CoreData.MENU:
		if s["items"][m["id"]] > 0.0 and CoreTaste.taste_tier(s, m["id"]) != "standard":
			n += 1.0
	return n


static func _stories_complete(s: Dictionary) -> float:
	var n := 0.0
	for guest: Dictionary in CoreRegularGuestsContent.REGULAR_GUESTS:
		var progress: Variant = s["regularGuests"]["guests"].get(guest["id"])
		if (progress["unlockedChapters"].size() if progress is Dictionary else 0) >= guest["chapters"].size():
			n += 1.0
	return n


## [current, target]; reached when current >= target.
static func milestone_progress(id: String, s: Dictionary) -> Array:
	var r: Dictionary = s["milestones"]["records"]
	match id:
		"glasshouse": return _room(s, "greenhouse")
		"served1000": return [s["served"], 1000.0]
		"practiced12": return [_practiced(s), 12.0]
		"smoothDay60": return [r["bestSmoothDay"], 60.0]
		"busyDay150": return [r["bestDay"], 150.0]
		"rating40": return [CoreReputation.reputation_score(s["reputation"]), 4.0]
		"weatherWin": return [JsMath.js_min(1.0, r["weatherWins"].size()), 1.0]
		"stories12": return [_stories_complete(s), float(CoreRegularGuestsContent.REGULAR_GUESTS.size())]
		"terrace": return _room(s, "terrace")
		"signature5": return [float(s["taste"]["signature"].size()), 5.0]
		"moments60": return [r["momentsAnswered"], 60.0]
		"served3000": return [s["served"], 3000.0]
		"busyDay180": return [r["bestDay"], 180.0]
		"smoothDay150": return [r["bestSmoothDay"], 150.0]
		"weatherKinds3": return [float(r["weatherWins"].size()), 3.0]
		"comfort90": return [CoreDecor.comfort(s), 90.0]
	push_error("Unknown milestone %s" % id)
	return [0.0, 1.0]


## Extra condition before it can complete.
static func milestone_ready(id: String, s: Dictionary) -> bool:
	return id != "rating40" or enough_reviews(s)


static func milestone_def(id: Variant) -> Variant:
	for c: Dictionary in CHAPTERS:
		for m: Dictionary in c["milestones"]:
			if id is String and m["id"] == id:
				return m
	return JsUtil.UNDEFINED


static func chapter_of(id: String) -> Variant:
	for c: Dictionary in CHAPTERS:
		for m: Dictionary in c["milestones"]:
			if m["id"] == id:
				return c
	return JsUtil.UNDEFINED


static func empty_milestones() -> Dictionary:
	return {"done": [], "reachedOn": {}, "claimed": [], "records": {"bestDay": 0.0, "bestSmoothDay": 0.0, "weatherWins": [], "momentsAnswered": 0.0}}


## The track follows the guided goals.
static func milestones_started(s: Dictionary) -> bool:
	return s["goal"] >= CoreGoals.GOALS.size()


static func milestone_done(s: Dictionary, id: String) -> bool:
	return s["milestones"]["done"].has(id)


static func _done_in(done: Array, index: float) -> int:
	if index < 0.0 or index >= CHAPTERS.size():
		return 0
	var n := 0
	for m: Dictionary in CHAPTERS[int(index)]["milestones"]:
		if done.has(m["id"]):
			n += 1
	return n


static func chapter_done(s: Dictionary, index: float) -> bool:
	return index >= 0.0 and index < CHAPTERS.size() and _done_in(s["milestones"]["done"], index) == CHAPTERS[int(index)]["milestones"].size()


## The first chapter is open from the start; each later one once three of the one before are done.
static func chapter_open(s: Dictionary, index: float) -> bool:
	return milestones_started(s) and index >= 0.0 and index < CHAPTERS.size() and (index == 0.0 or _done_in(s["milestones"]["done"], index - 1.0) >= OPEN_AFTER)


## How many chapters are open, from the first.
static func open_chapters(s: Dictionary) -> float:
	var n := 0.0
	while chapter_open(s, n):
		n += 1.0
	return n


static func chapter_claimed(s: Dictionary, index: float) -> bool:
	return s["milestones"]["claimed"].has(CHAPTERS[int(index)]["id"])


## The first finished chapter whose reward is waiting, if any.
static func claimable_chapter(s: Dictionary) -> Variant:
	if milestones_started(s):
		for i in CHAPTERS.size():
			if chapter_done(s, i) and not chapter_claimed(s, i):
				return float(i)
	return null


## The café's title: the furthest chapter claimed.
static func cafe_title_chapter(s: Dictionary) -> Variant:
	for i in range(CHAPTERS.size() - 1, -1, -1):
		if chapter_claimed(s, i):
			return CHAPTERS[i]
	return null


## Marks every milestone in the open chapters that has been reached, and returns the new ones.
static func check_milestones(s: Dictionary) -> Array:
	if not milestones_started(s):
		return []
	var reached := []
	var opened := 0.0
	while opened != open_chapters(s):
		opened = open_chapters(s)
		for chapter: Dictionary in CHAPTERS.slice(0, int(opened)):
			for m: Dictionary in chapter["milestones"]:
				var id: String = m["id"]
				if milestone_done(s, id):
					continue
				var progress := milestone_progress(id, s)
				if progress[0] >= progress[1] and milestone_ready(id, s):
					s["milestones"]["done"].append(id)
					s["milestones"]["reachedOn"][id] = s["day"]
					reached.append(id)
	return reached


## Milestones reached on a given day, in chapter order.
static func milestones_reached_on(s: Dictionary, day: float) -> Array:
	var out := []
	for c: Dictionary in CHAPTERS:
		for m: Dictionary in c["milestones"]:
			var on: Variant = s["milestones"]["reachedOn"].get(m["id"])
			if milestone_done(s, m["id"]) and on is float and on == day:
				out.append(m["id"])
	return out


## The day's best-ever results, from the report of the day that just closed.
static func record_day(s: Dictionary, report: Dictionary) -> void:
	var r: Dictionary = s["milestones"]["records"]
	r["bestDay"] = JsMath.js_max(r["bestDay"], report["served"])
	# Settling early cancels orders still being made; those guests leave without them too.
	if report["missed"] == 0.0 and not JsUtil.truthy(report["reviews"]["reasons"].get("cancelled", 0.0)):
		r["bestSmoothDay"] = JsMath.js_max(r["bestSmoothDay"], report["served"])
	# A special day is won by a menu that suits it: its popular dishes are much of what sold.
	var day := {"createdAt": s["createdAt"], "day": report["day"]}
	var condition := CoreConditions.condition_on(s, report["day"])
	if condition == "fair" or r["weatherWins"].has(condition):
		return
	var total := 0.0
	var popular := 0.0
	for id: String in report["sales"]:
		total += report["sales"][id]
		var mood: Variant = CoreConditions.dish_mood(day, id)
		if mood is String and mood == "favored":
			popular += report["sales"][id]
	if popular >= WEATHER_WIN["popular"] and popular >= total * WEATHER_WIN["share"]:
		r["weatherWins"].append(condition)


static func record_moment_answered(s: Dictionary) -> void:
	s["milestones"]["records"]["momentsAnswered"] += 1.0


## Claims the next finished chapter: its title, and its finish, or the finish's price if it's already owned.
static func claim_chapter(s: Dictionary) -> Variant:
	var index: Variant = claimable_chapter(s)
	if index == null:
		return null
	var chapter: Dictionary = CHAPTERS[int(index)]
	var finish: Dictionary = CoreDecor.decor_def(chapter["finish"])
	var coins := 0.0
	if s["decor"]["owned"].has(finish["id"]):
		coins = finish["cost"]
		CoreEconomy.earn(s, coins)
	else:
		s["decor"]["owned"].append(finish["id"])
		var there: Variant = CoreDecor.decor_def(s["decor"]["equipped"][finish["slot"]])
		if finish["comfort"] > (there["comfort"] if there is Dictionary else 0.0):
			s["decor"]["equipped"][finish["slot"]] = finish["id"]
	s["milestones"]["claimed"].append(chapter["id"])
	return {"chapter": chapter, "finish": finish["id"], "coins": coins}


static func _count(v: Variant) -> float:
	return JsMath.js_min(1e9, floor(v)) if JsMath.is_finite_num(v) and v >= 0.0 else 0.0


## Reads saved milestones. Unknown ids are dropped; old saves start with nothing invented.
static func parse_milestones(value: Variant) -> Dictionary:
	var out := empty_milestones()
	var v: Variant = JsUtil.as_object(value)
	if v == null:
		return out
	var done: Variant = JsUtil.prop(v, "done")
	if done is Array:
		for id: Variant in done:
			if id is String and milestone_def(id) is Dictionary and not out["done"].has(id):
				out["done"].append(id)
	var reached_on: Variant = JsUtil.as_object(JsUtil.prop(v, "reachedOn"))
	for id: String in out["done"]:
		var day: Variant = JsUtil.prop(reached_on, id)
		if JsMath.is_safe_integer(day) and day >= 1.0:
			out["reachedOn"][id] = day
	var r: Variant = JsUtil.as_object(JsUtil.prop(v, "records"))
	var wins: Variant = JsUtil.prop(r, "weatherWins")
	var kinds := []
	for c: Dictionary in CoreConditions.CONDITIONS:
		if c["id"] != "fair" and wins is Array and JsUtil.includes(wins, c["id"]):
			kinds.append(c["id"])
	out["records"] = {
		"bestDay": _count(JsUtil.prop(r, "bestDay")), "bestSmoothDay": _count(JsUtil.prop(r, "bestSmoothDay")),
		"momentsAnswered": _count(JsUtil.prop(r, "momentsAnswered")), "weatherWins": kinds,
	}
	# A claim needs its chapter finished.
	var claimed: Variant = JsUtil.prop(v, "claimed")
	if claimed is Array:
		for i in CHAPTERS.size():
			if JsUtil.includes(claimed, CHAPTERS[i]["id"]) and _done_in(out["done"], i) == CHAPTERS[i]["milestones"].size():
				out["claimed"].append(CHAPTERS[i]["id"])
	return out
