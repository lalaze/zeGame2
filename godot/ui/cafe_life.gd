class_name CafeLife
extends PanelContainer

## One optional conversation a day, offered quietly while the café is open (src/ui/cafe-life.ts). It never pauses service.

var _ui: CafeUi
var _offered: Dictionary = {}
var _day := ""
var _dismissed := true
var _hear: Button
var _read: Callable


func _init(ui: CafeUi) -> void:
	_ui = ui
	theme = Paper.theme()
	visible = false
	add_theme_stylebox_override("panel", Paper.box(Paper.PAPER, Paper.LINE, 2, 16, Vector2(10, 4), Paper.STAMP, 3.0))
	_hear = Paper.button("", "link", func() -> void:
		_dismiss()
		_read.call())
	_hear.mouse_filter = Control.MOUSE_FILTER_STOP
	var later := Paper.button("", "flat", _dismiss, "close", 14)
	later.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(Paper.line([_hear, later], 2))


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _dismiss() -> void:
	_dismissed = true
	visible = false


func update(state: Dictionary, visitors: Array, shown: bool) -> void:
	var day := "%s:%s" % [state["createdAt"], state["day"]]
	if not _day.is_empty() and _day != day:
		_dismissed = true
	_day = day
	if shown and state["phase"] == "open":
		_offer_wish(state, visitors, day)
		_offer_story(state, visitors, day)
	visible = shown and not _dismissed and state["phase"] == "open"


func _invite(label: String, read: Callable, keys: Array) -> void:
	_hear.text = label
	_read = read
	for key: String in keys:
		_offered[key] = true
	_dismissed = false


func _offer_wish(state: Dictionary, visitors: Array, day: String) -> void:
	var wish: Variant = CoreRegularWishes.mina_wish(state)
	if wish == null:
		return
	var event := "map" if wish["completedDay"] is float and wish["completedDay"] == state["day"] else ("rehearsed" if wish["rehearsedDay"] is float and wish["rehearsedDay"] == state["day"] else "")
	var key := "%s:mina:%s" % [day, event]
	if event.is_empty() or _offered.has(key) or not visitors.any(func(v: Dictionary) -> bool: return v.get("regularGuestId") is String and v["regularGuestId"] == "mina"):
		return
	_invite(_t("wish.mina.notice.%s" % event), func() -> void:
		var body := WishCard.card(state, _ui.session.save_game)
		if body != null:
			_ui.dialogs.show_dialog(_t("wish.mina.title"), body, [{"label": _t("regular.ui.close")}]), [key, day])


func _offer_story(state: Dictionary, visitors: Array, day: String) -> void:
	if _offered.has(day):
		return
	# Takeaway guests are on their way out in the tick their story unlocks; they count while they are still here.
	for v: Dictionary in visitors:
		var guest: Variant = CoreRegularGuests.regular_guest_definition(v.get("regularGuestId"))
		if not guest is Dictionary:
			continue
		var progress: Variant = CoreRegularGuests.regular_guest_progress(state, guest["id"])
		if not progress is Dictionary:
			continue
		for chapter: float in progress["unlockedChapters"]:
			if chapter not in progress["readChapters"]:
				_invite(_t("mobile.story", {"name": _t(guest["nameKey"])}), _tell.bind(state, guest, chapter), [day])
				return


func _tell(state: Dictionary, guest: Dictionary, index: float) -> void:
	var chapter: Dictionary = guest["chapters"][int(index)]
	var body := Paper.col([Paper.line([Portraits.guest(guest["appearanceId"], 48.0), Paper.col([Paper.words(_t("regular.ui.chapter", {"n": index + 1.0, "total": float(guest["chapters"].size())}), "muted"), Paper.words(_t(chapter["titleKey"]), "h3")], 2)], 10)])
	for paragraph: String in _t(chapter["textKey"]).split("\n", false):
		body.add_child(Paper.words(paragraph))
	_ui.dialogs.show_dialog(_t("life.arrival", {"name": _t(guest["nameKey"])}), body, [
		{"label": _t("regular.ui.finish"), "kind": "primary", "pressed": func() -> void:
			if CoreRegularGuests.mark_regular_guest_chapter_read(state, guest["id"], index):
				_ui.session.save_game()},
		{"label": _t("life.later")},
	])


## A partner who worked shares an unread chapter in the evening's report; null without one.
static func closing_story(state: Dictionary, report: Dictionary, save: Callable) -> Control:
	var worked: Variant = report.get("partners")
	for c: Dictionary in (worked if worked is Array else []):
		var progress: Variant = state["partners"]["roster"].get(c["id"])
		var partner: Variant = CorePartners.partner_definition(c["id"])
		if progress == null or not partner is Dictionary or c["jobs"] <= 0.0:
			continue
		for index in int(progress["unlocked"]):
			if float(index) in progress["read"]:
				continue
			var finished := Paper.button(_t("regular.ui.finish"), "primary")
			finished.pressed.connect(func() -> void:
				if CorePartners.read_partner_chapter(state, partner["id"], float(index)):
					save.call()
					finished.disabled = true
					finished.text = _t("regular.ui.read"))
			return Paper.fold(_t("life.closing", {"name": partner["name"][I18n.locale]}), Paper.col([Paper.words(CorePartnerStories.PARTNER_STORIES[partner["id"]]["chapters"][index][I18n.locale]), finished], 8))
	return null
