class_name SettingsDialog
extends RefCounted

## The café office (main.ts openSettings). A phone has no keyboard, so the page's line about keys is left out.


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func show_settings(ui: CafeUi) -> void:
	var s := ui.session.state
	var body := Paper.col([], 10)
	var profile: Variant = s["profile"]
	if profile != null:
		var copy := Paper.col([Paper.words(profile["cafeName"], "strong")], 2)
		var title := MilestoneBook.cafe_title(s)
		if not title.is_empty():
			copy.add_child(Paper.words(_t("milestone.cafeTitle", {"title": title}), "muted"))
		copy.add_child(Paper.words(profile["ownerName"] if not profile["ownerName"].is_empty() else _t("ob.char.defaultName"), "muted"))
		body.add_child(Paper.line([Portraits.person(profile["look"], 48.0), copy, Paper.button(_t("settings.edit"), "ghost", func() -> void:
			ui.dialogs.close()
			ui.edit_profile())], 10))
	body.add_child(Paper.button(_t("guide.replay"), "ghost", ui.guide.show_help))
	var languages := Paper.line([Paper.words(_t("settings.language"))])
	for l: Array in CafeUi.LOCALES:
		languages.add_child(Paper.button(l[1], "on" if l[0] == I18n.locale else "chip", func() -> void:
			ui.set_language(l[0])
			show_settings(ui)))
	body.add_child(languages)
	for e: Array in [[_t("settings.served"), UiWords.grouped(s["served"])], [_t("settings.earned"), UiWords.money(s["totalEarned"])], [_t("settings.days"), JsMath.number_to_string(s["day"] - 1.0)]]:
		body.add_child(Paper.line([Paper.words(e[0], "muted"), Paper.words(e[1], "strong", false)]))
	body.add_child(Paper.button(UiWords.here("搬家：导入或复制存档", "Move the café: import or copy a save"), "ghost", SaveTransfer.show_transfer.bind(ui)))
	body.add_child(Paper.words(_t("settings.pause"), "muted"))
	body.add_child(Paper.words(_t("save.temporary" if ui.session.session.mode == "temporary" else "settings.saves"), "muted"))
	ui.dialogs.show_dialog(_t("settings.title"), body, [{"label": _t("settings.back"), "kind": "primary"}, {"label": _t("settings.reset"), "kind": "danger", "pressed": confirm_restart.bind(ui)}])


static func confirm_restart(ui: CafeUi) -> void:
	ui.dialogs.show_dialog(_t("reset.title"), Paper.words(_t("reset.body")), [
		{"label": _t("reset.keep"), "kind": "primary", "pressed": show_settings.bind(ui)},
		{"label": _t("reset.confirm"), "kind": "danger", "pressed": ui.reset_game},
	])
