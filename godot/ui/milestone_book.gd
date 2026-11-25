class_name MilestoneBook
extends RefCounted

## The café's milestones (src/ui/milestones.ts): the goal card after the guided goals, and the book of chapters.


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func title(chapter: Dictionary) -> String:
	return _t("milestone.chapter.%s" % chapter["id"])


static func name(id: String) -> String:
	return _t("milestone.%s" % id)


static func _finish(chapter: Dictionary) -> String:
	return _t("decor.%s" % chapter["finish"])


## The café's title, for the header and the settings; "" before the first chapter.
static func cafe_title(s: Dictionary) -> String:
	var chapter: Variant = CoreMilestones.cafe_title_chapter(s)
	return title(chapter) if chapter != null else ""


static func _value(m: Dictionary, n: float) -> String:
	return UiWords.fixed(n, 1) if m.get("decimal", false) else CoreFormat.format_number(n)


static func _progress(s: Dictionary, m: Dictionary) -> Dictionary:
	var at := CoreMilestones.milestone_progress(m["id"], s)
	var done := CoreMilestones.milestone_done(s, m["id"])
	# One held back by its extra condition (too few reviews) says so, rather than looking done.
	var waiting: bool = not done and at[0] >= at[1] and not CoreMilestones.milestone_ready(m["id"], s)
	return {"done": done, "share": 1.0 if done else maxf(0.0, minf(0.99 if waiting else 1.0, at[0] / at[1])),
		"text": "%s / %s%s" % [_value(m, minf(at[0], at[1])), _value(m, at[1]), " · %s" % _t("milestone.needsReviews", {"n": 50.0}) if waiting else ""]}


static func _heading(index: int) -> String:
	return _t("milestone.card.chapter", {"n": index + 1.0, "total": float(CoreMilestones.CHAPTERS.size()), "title": title(CoreMilestones.CHAPTERS[index])})


## A chapter ready to claim, otherwise the open milestone closest to done; as the goal card of the ledger.
static func card(s: Dictionary) -> Dictionary:
	var out := {"claim": "", "note": "", "share": -1.0, "progress": "", "book": true, "chapter": false, "done": false}
	var ready: Variant = CoreMilestones.claimable_chapter(s)
	if ready != null:
		var chapter: Dictionary = CoreMilestones.CHAPTERS[int(ready)]
		out.merge({"done": true, "chapter": true, "sig": "ready:%s" % ready, "head": _heading(int(ready)), "text": _t("milestone.card.ready"), "claim": _t("milestone.card.claim", {"title": title(chapter), "finish": _finish(chapter)})}, true)
		return out
	var next := {}
	for index in int(CoreMilestones.open_chapters(s)):
		for m: Dictionary in CoreMilestones.CHAPTERS[index]["milestones"]:
			var p := _progress(s, m)
			# Ties keep the listed order.
			if not p["done"] and (next.is_empty() or p["share"] > next["share"]):
				next = p
				next["m"] = m
				next["index"] = index
	if next.is_empty():
		var earned := cafe_title(s)
		out.merge({"sig": "finished:%s" % earned, "head": earned, "text": _t("milestone.card.finished")}, true)
		return out
	var of: Array = CoreMilestones.CHAPTERS[next["index"]]["milestones"]
	var count := float(of.filter(func(m: Dictionary) -> bool: return CoreMilestones.milestone_done(s, m["id"])).size())
	out.merge({"sig": "open:%s:%s:%s:%s" % [next["index"], count, next["m"]["id"], next["text"]], "head": _heading(next["index"]), "text": name(next["m"]["id"]), "share": next["share"],
		"progress": "%s · %s" % [next["text"], _t("milestone.card.progress", {"n": count, "total": float(of.size())})]}, true)
	return out


## Claims the ready chapter and says what the café got: its id, or "".
static func claim(dialogs: PaperDialogs, s: Dictionary) -> String:
	var reward: Variant = CoreMilestones.claim_chapter(s)
	if reward == null:
		return ""
	var params := {"title": title(reward["chapter"]), "finish": _finish(reward["chapter"])}
	if reward["coins"] > 0.0:
		params["money"] = CoreFormat.format_money(reward["coins"])
	dialogs.note(_t("milestone.toast.claimedCoins" if reward["coins"] > 0.0 else "milestone.toast.claimed", params))
	return reward["chapter"]["id"]


## Every opened chapter, the next one's name, and the titles earned.
static func show_book(dialogs: PaperDialogs, s: Dictionary) -> void:
	var open := int(CoreMilestones.open_chapters(s))
	var chapters: Array = CoreMilestones.CHAPTERS
	var titles := []
	for i in chapters.size():
		if CoreMilestones.chapter_claimed(s, float(i)):
			titles.append(title(chapters[i]))
	var body := Paper.col([Paper.words(_t("milestone.book.intro")), Paper.words(_t("milestone.book.titles", {"titles": UiWords.join(titles)}) if not titles.is_empty() else _t("milestone.book.noTitles"), "muted")], 12)
	for i in mini(open + 1, chapters.size()):
		var section := Paper.col([Paper.words(_heading(i), "h3")], 6)
		if i >= open:
			# The next chapter's name is a promise; its milestones stay a surprise.
			section.add_child(Paper.words(_t("milestone.book.locked", {"n": float(i), "k": CoreMilestones.OPEN_AFTER}) if CoreMilestones.milestones_started(s) else _t("milestone.book.notStarted", {"n": float(CoreGoals.GOALS.size())}), "muted"))
		else:
			var status := _t("milestone.book.claimed") if CoreMilestones.chapter_claimed(s, float(i)) else (_t("milestone.book.ready") if CoreMilestones.chapter_done(s, float(i)) else "")
			if not status.is_empty():
				section.add_child(Paper.words(status, "good"))
			for m: Dictionary in chapters[i]["milestones"]:
				var p := _progress(s, m)
				section.add_child(Paper.line([Paper.words("✓" if p["done"] else "·", "strong", false), Paper.words(name(m["id"])), Paper.words(_t("milestone.book.done") if p["done"] else p["text"], "small", false)]))
				if not p["done"]:
					section.add_child(Paper.progress(p["share"], 5.0))
			section.add_child(Paper.words(_t("milestone.book.reward", {"title": title(chapters[i]), "finish": _finish(chapters[i])}), "muted"))
		var paper := Paper.card("row")
		paper.add_child(section)
		body.add_child(paper)
	dialogs.show_dialog(_t("milestone.book.title"), body, [{"label": _t("milestone.book.close"), "kind": "primary"}], {"tall": true})
