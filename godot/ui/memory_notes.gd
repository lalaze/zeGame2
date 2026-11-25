class_name MemoryNotes
extends RefCounted

## What familiar faces liked (src/ui/guest-memories.ts), known only after a loved drink was handed over.


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


## [appearance, memory] newest first.
static func _entries(s: Dictionary) -> Array:
	var out := []
	for id: String in s["guestMemories"]:
		out.append([id.to_float(), s["guestMemories"][id]])
	return JsUtil.stable_sort(out, func(a: Array, b: Array) -> float:
		var days: float = b[1]["learnedDay"] - a[1]["learnedDay"]
		return days if days != 0.0 else a[0] - b[0])


static func _name(s: Dictionary, m: Dictionary) -> String:
	var item: String = m["item"]
	if item.begins_with("sig:") and not s["signatureDrinks"]["recipes"].any(func(r: Dictionary) -> bool: return r["id"] == item):
		var kept: Variant = m.get("name")
		if kept is String and not kept.is_empty():
			return kept
	return I18n.item_name(item, s)


## All of them, or those served on a day; null without any.
static func notes(s: Dictionary, day: Variant = null) -> Control:
	var list := _entries(s).filter(func(e: Array) -> bool: return day == null or e[1]["lastServedDay"] == day)
	if list.is_empty():
		return null
	var body := Paper.col([Paper.words(_t("memory.journalNote"), "muted")], 8)
	for e: Array in list:
		var m: Dictionary = e[1]
		var copy := Paper.col([Paper.words(_name(s, m), "strong"), Paper.words(_t("memory.learned.%s" % m["source"], {"day": m["learnedDay"]}), "muted")], 2)
		if m["returns"] > 0.0:
			copy.add_child(Paper.words(_t("memory.returned", {"n": m["returns"]}), "muted"))
		var available: bool = CoreEconomy.menu_items(s).any(func(d: Dictionary) -> bool: return d["id"] == m["item"]) and CoreEconomy.ready_servings(s, m["item"]) > 0.0
		copy.add_child(Paper.words(_t("memory.available" if available else "memory.unavailable"), "muted"))
		body.add_child(Paper.line([Portraits.guest(e[0], 44.0), copy], 10))
	return Paper.fold(_t("memory.journalTitle" if day == null else "memory.reportTitle", {"n": float(list.size())}), body)


static func report(s: Dictionary, day: float) -> Control:
	var today := _entries(s).filter(func(e: Array) -> bool: return e[1]["lastServedDay"] == day)
	if today.is_empty():
		return null
	var learned := float(today.filter(func(e: Array) -> bool: return e[1]["learnedDay"] == day).size())
	var back := float(today.filter(func(e: Array) -> bool: return e[1]["learnedDay"] < day and e[1]["returns"] > 0.0).size())
	var out := Paper.col([Paper.words(_t("memory.reportHeading"), "h3")], 6)
	if learned > 0.0:
		out.add_child(Paper.words(_t("memory.reportLearned", {"n": learned})))
	if back > 0.0:
		out.add_child(Paper.words(_t("memory.reportReturned", {"n": back})))
	out.add_child(notes(s, day))
	return out
