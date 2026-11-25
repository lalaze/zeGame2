class_name RegularsDialog
extends RefCounted

## The regulars' journal (src/ui/regular-guests.ts): those met so far and the chapters they have told.

var _session: CoreGameSession
var _root := Paper.col([], 10)
var _scroll: ScrollContainer = null


static func show_regulars(ui: CafeUi) -> void:
	var d := RegularsDialog.new()
	d._session = ui.session
	d._root.set_meta("owner", d)
	d._list()
	d._scroll = ui.dialogs.show_dialog(_t("regular.ui.title"), d._root, [{"label": _t("regular.ui.close")}], {"tall": true})["scroll"]


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _page(children: Array) -> void:
	Paper.clear(_root)
	for c: Variant in children:
		if c != null:
			_root.add_child(c)
	if _scroll != null:
		_scroll.scroll_vertical = 0


func _profile(guest: Dictionary, full: bool = true) -> VBoxContainer:
	var s := _session.state
	var progress: Dictionary = CoreRegularGuests.regular_guest_progress(s, guest["id"])
	var out := Paper.col([Paper.line([Portraits.guest(guest["appearanceId"], 48.0), Paper.col([Paper.words(_t(guest["nameKey"]), "h3"), Paper.words(_t(guest["roleKey"]), "muted")], 2)], 10)], 6)
	if full:
		out.add_child(Paper.words(_t(guest["personalityKey"])))
		out.add_child(Paper.words(_t("regular.ui.preference", {"drink": _t("item.%s" % guest["preferredDrink"])}), "good"))
		out.add_child(Paper.words("%s · %s" % [_t("regular.ui.served", {"n": progress["served"]}), _t("regular.ui.progress", {"n": float(progress["unlockedChapters"].size()), "total": float(guest["chapters"].size())})], "muted"))
		if guest["id"] == "mina":
			var wish := WishCard.card(s, _session.save_game)
			if wish != null:
				out.add_child(wish)
	return out


static func _card(inside: Control) -> Control:
	var card := Paper.card("row")
	card.add_child(inside)
	return card


func _list() -> void:
	var s := _session.state
	var all: Array = CoreRegularGuestsContent.REGULAR_GUESTS
	var met := all.filter(func(g: Dictionary) -> bool: return CoreRegularGuests.regular_guest_progress(s, g["id"]) is Dictionary)
	var out: Array = [Paper.words(_t("regular.ui.met", {"n": float(met.size()), "total": float(all.size())}), "h3"), Paper.words(_t("regular.ui.quiet"), "muted"), MemoryNotes.notes(s)]
	for guest: Dictionary in met:
		var unread := CoreRegularGuests.regular_guest_unread_count(s, guest["id"])
		var inside := _profile(guest)
		inside.add_child(Paper.button(_t("regular.ui.stories") + (" · %s" % _t("regular.ui.unread", {"n": unread}) if unread > 0.0 else ""), "ghost", _chapters.bind(guest)))
		out.append(_card(inside))
	if met.is_empty():
		out.append(Paper.words(_t("regular.ui.empty")))
	if met.size() < all.size():
		out.append(Paper.words(_t("regular.ui.unknown", {"n": float(all.size() - met.size())}), "muted"))
	_page(out)


func _chapters(guest: Dictionary) -> void:
	var s := _session.state
	var progress: Variant = CoreRegularGuests.regular_guest_progress(s, guest["id"])
	if not progress is Dictionary:
		_list()
		return
	var total := float(guest["chapters"].size())
	var out: Array = [Paper.button(_t("regular.ui.back"), "ghost", _list), _card(_profile(guest))]
	for index: float in progress["unlockedChapters"]:
		if int(index) >= guest["chapters"].size():
			continue
		var read: bool = index in progress["readChapters"]
		out.append(Paper.multi([[_t("regular.ui.chapter", {"n": index + 1.0, "total": total}), "muted"], [_t(guest["chapters"][int(index)]["titleKey"]), "strong"], [_t("regular.ui.read" if read else "regular.ui.new"), "small" if read else "good"]], null, _chapter.bind(guest, index)))
	if progress["unlockedChapters"].is_empty():
		out.append(Paper.words(_t("regular.ui.noStories"), "muted"))
	var next: Variant = CoreRegularGuests.regular_guest_chapter_requirement(guest["id"], float(progress["unlockedChapters"].size()))
	if next != null:
		out.append(Paper.words(_t("regular.ui.nextRequirement", next)))
		out.append(Paper.words(_t("regular.ui.dailyLimit"), "muted"))
	_page(out)


func _chapter(guest: Dictionary, index: float) -> void:
	var s := _session.state
	var progress: Variant = CoreRegularGuests.regular_guest_progress(s, guest["id"])
	if not progress is Dictionary or index not in progress["unlockedChapters"] or int(index) >= guest["chapters"].size():
		_chapters(guest)
		return
	var chapter: Dictionary = guest["chapters"][int(index)]
	var read: bool = index in progress["readChapters"]
	var story := Paper.col([Paper.words("%s · %s" % [_t("regular.ui.chapter", {"n": index + 1.0, "total": float(guest["chapters"].size())}), _t("regular.ui.read" if read else "regular.ui.new")], "muted"), Paper.words(_t(chapter["titleKey"]), "h3")], 8)
	for paragraph: String in _t(chapter["textKey"]).split("\n", false):
		story.add_child(Paper.words(paragraph))
	var actions := Paper.flow([Paper.button(_t("regular.ui.chapters" if read else "regular.ui.finish"), "primary", func() -> void:
		if CoreRegularGuests.mark_regular_guest_chapter_read(s, guest["id"], index):
			_session.save_game()
		_chapters(guest))])
	if not read:
		actions.add_child(Paper.button(_t("regular.ui.later"), "ghost", _chapters.bind(guest)))
	var unlocked: Array = progress["unlockedChapters"].filter(func(i: float) -> bool: return int(i) < guest["chapters"].size())
	unlocked.sort()
	var at := unlocked.find(index)
	var previous := Paper.button(_t("regular.ui.previous"), "ghost", func() -> void: _chapter(guest, unlocked[at - 1]))
	previous.disabled = at <= 0
	var next := Paper.button(_t("regular.ui.next"), "ghost", func() -> void: _chapter(guest, unlocked[at + 1]))
	next.disabled = at >= unlocked.size() - 1
	_page([Paper.button(_t("regular.ui.chapters"), "ghost", _chapters.bind(guest)), _card(_profile(guest, false)), _card(story), actions, Paper.flow([previous, next]), Paper.words(_t("regular.ui.readHint"), "muted")])
