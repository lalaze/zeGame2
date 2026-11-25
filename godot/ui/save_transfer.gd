class_name SaveTransfer
extends RefCounted

## Taking a café to another device, or here from the web version: its save as text, over the clipboard. The web game and
## this one write the same save, so either reads the other's. The page has no such screen.

static func _here(zh: String, en: String) -> String:
	return UiWords.here(zh, en)


## What a text holds: {"ok": true, "text", "name", "day", "coins"}, or {"ok": false, "why"}.
static func look(text: String, now: float) -> Dictionary:
	var trimmed := text.strip_edges()
	if trimmed.is_empty():
		return {"ok": false, "why": _here("剪贴板里没有文字。先在另一边复制存档，再回来导入。", "There is no text on the clipboard. Copy the save on the other side first, then come back.")}
	var parsed := JsJson.parse(trimmed)
	if not parsed["ok"] or not parsed["value"] is Dictionary or not CoreSaveSession.is_whole(trimmed):
		return {"ok": false, "why": _here("剪贴板里的文字不是完整的存档。", "The text on the clipboard is not a whole save.")}
	var data: Dictionary = parsed["value"]
	for part: String in ["version", "items", "coins", "day"]:
		if not data.has(part):
			return {"ok": false, "why": _here("剪贴板里的文字不是这个游戏的存档。", "The text on the clipboard is not a save of this game.")}
	if not data["version"] is float or data["version"] > CoreState.SAVE_VERSION:
		return {"ok": false, "why": _here("这份存档来自更新的版本，请先更新游戏。", "This save comes from a newer version. Update the game first.")}
	var state := CoreState.deserialize(trimmed, now)
	return {"ok": true, "text": trimmed, "name": _name(state), "day": state["day"], "coins": state["coins"]}


static func _name(state: Dictionary) -> String:
	return state["profile"]["cafeName"] if state["profile"] != null else I18n.t("app.title")


static func _tell(name: String, day: float, coins: float) -> String:
	return "%s · %s · %s" % [name, I18n.t("day.label", {"n": day}), CoreFormat.format_transaction_money(coins)]


## A moment as the phone's clock and calendar have it.
static func _when(at: float) -> String:
	return Time.get_datetime_string_from_unix_time(int(at / 1000.0) + int(Time.get_time_zone_from_system()["bias"]) * 60, true).left(16)


static func show_transfer(ui: CafeUi) -> void:
	var body := Paper.col([
		Paper.words(_here("把这家店带到别的设备，或把网页版的店带过来。", "Take this café to another device, or bring one here from the web version.")),
		Paper.button(_here("复制这家店的存档", "Copy this café's save"), "ghost", func() -> void:
			var text := ui.session.save_text()
			DisplayServer.clipboard_set(text)
			ui.dialogs.note(_here("存档已复制到剪贴板。", "The save is on the clipboard.") if DisplayServer.clipboard_get() == text else _here("没能复制到剪贴板。", "The save could not be copied."))),
		Paper.button(_here("从剪贴板导入存档", "Import a save from the clipboard"), "primary", func() -> void: ask(ui, DisplayServer.clipboard_get())),
		Paper.words(_here("导入会换掉这台设备上的店；换下来的店都留在这里，随时能换回。", "Importing replaces the café on this device. The cafés replaced stay here, and any of them can come back."), "muted"),
	], 10)
	var kept := ui.session.session.replaced()
	if not kept.is_empty():
		body.add_child(Paper.words(_here("换下来的店", "Replaced cafés"), "h3"))
	for e: Dictionary in kept:
		var found := look(e["text"], CoreClock.now())
		if found["ok"]:
			var card := Paper.card("row")
			card.add_child(Paper.line([Paper.col([Paper.words(_tell(found["name"], found["day"], found["coins"]), "strong"), Paper.words(_here("换下时间：%s", "Replaced %s") % _when(e["at"]), "small")], 2), Paper.button(_here("换回", "Bring back"), "chip", ask.bind(ui, e["text"]))]))
			body.add_child(card)
	ui.dialogs.show_dialog(_here("搬家", "Move the café"), body, [{"label": I18n.t("settings.back"), "kind": "primary", "pressed": SettingsDialog.show_settings.bind(ui)}])


## Says whose café it is and asks before it replaces this one.
static func ask(ui: CafeUi, text: String) -> void:
	var found := look(text, CoreClock.now())
	if not found["ok"]:
		ui.dialogs.show_dialog(_here("没有导入", "Nothing was imported"), Paper.words(found["why"]), [{"label": I18n.t("settings.back"), "kind": "primary", "pressed": show_transfer.bind(ui)}])
		return
	var s := ui.session.state
	var body := Paper.col([Paper.words(_here("要换上的店", "The café to bring in"), "small"), Paper.words(_tell(found["name"], found["day"], found["coins"]), "strong"),
		Paper.words(_here("这台设备上的店", "The café on this device"), "small"), Paper.words(_tell(_name(s), s["day"], s["coins"]), "strong"),
		Paper.words(_here("这台设备上的店会被换下，留在“搬家”里，随时能换回。", "The café on this device will be replaced. It stays under “Move the café” and can come back."))], 6)
	ui.dialogs.show_dialog(_here("换成这家店？", "Replace the café?"), body, [
		{"label": I18n.t("reset.keep"), "kind": "primary", "pressed": show_transfer.bind(ui)},
		{"label": _here("换上", "Replace"), "kind": "danger", "pressed": func() -> void: ui.import_save(found["text"])},
	])
