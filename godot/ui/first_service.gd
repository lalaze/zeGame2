class_name FirstServiceGuide
extends PanelContainer

## The first day's guide (src/ui/first-service.ts): a small card, never a pause.

const _NUMBERS := {"stock": 1.0, "prepare": 2.0, "observe": 3.0, "close": 4.0, "closing": 4.0, "reopen": 5.0, "complete": 6.0}
var _ui: CafeUi
var _active := false
var _checked_stock := false
var _expanded := false
var _completed := false
var _key := ""
var _signature := ""
var _shown_step := ""
var _open := true
var _body := Paper.col([], 6)


func _init(ui: CafeUi) -> void:
	_ui = ui
	theme = Paper.theme()
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_theme_stylebox_override("panel", Paper.box(Paper.PAPER, Paper.LINE, 2, 18, Vector2(12, 8), Paper.STAMP, 3.0))
	add_child(_body)
	visible = false
	reset()


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _state() -> Dictionary:
	return _ui.session.state


func reset() -> void:
	_key = "tiny-bean-cafe/first-service/%s" % JsMath.number_to_string(_state()["createdAt"])
	var saved: Variant = _ui.session.storage.preference(_key)
	var text: String = saved if saved is String else ""
	_active = text.begins_with("active") if saved is String else CoreFirstService.is_first_cafe(_state())
	_checked_stock = text.contains("stock")
	_expanded = text.contains("tools")
	_completed = text.contains("complete")
	_signature = ""
	if _active:
		_persist()
	_tell()


func simplify() -> bool:
	return _active and not _expanded


func opening_step() -> Variant:
	var s := _state()
	if not _active or _expanded or _completed or s["day"] != 1.0 or s["phase"] != "prep":
		return null
	return "menu" if _checked_stock else "stock"


## The rules want to know: hints wait, and the manager holds back.
func _tell() -> void:
	_ui.session.guide_simplify = simplify()
	_ui.session.guide_opening_step = opening_step()


func confirm_stock() -> void:
	_checked_stock = true
	_persist()
	update()


func _persist() -> void:
	_ui.session.storage.set_preference(_key, "active%s%s%s" % [":stock" if _checked_stock else "", ":tools" if _expanded else "", ":complete" if _completed else ""] if _active else "done")


func _dismiss() -> void:
	_active = false
	_persist()
	update()
	_ui.follow_guide()


func _step() -> String:
	return "complete" if _completed else CoreFirstService.first_service_step(_state(), _checked_stock)


func _advance() -> void:
	match _step():
		"stock", "prepare", "reopen": _ui.session.prepare_day()
		"close": _ui.session.close_day(true)
		"observe": _ui.show_status()
		"complete": _dismiss()
	update()


func update() -> void:
	var step := _step()
	# Planning day 2 is the first real choice: everything must be on hand then.
	if _active and step == "reopen" and not _expanded:
		_expanded = true
		_persist()
	if _active and step == "complete" and not _completed:
		_completed = true
		_expanded = true
		_persist()
	_tell()
	visible = _active and _state()["profile"] != null and not _ui.arranging() and not _ui.hud.expanded
	var signature := "%s:%s:%s:%s" % [visible, step, I18n.locale, _expanded]
	if signature == _signature:
		return
	_signature = signature
	# Steps shown during service open folded, so the card does not cover the room.
	if step != _shown_step:
		_open = step in ["stock", "prepare"]
	_shown_step = step
	_show(step)


func _show(step: String) -> void:
	Paper.clear(_body)
	var details := Paper.col([Paper.words(_t("guide.%s.body" % step))], 6)
	var row := Paper.flow([_button(_t("guide.help"), "chip", show_help)], 6)
	if not _expanded:
		row.add_child(_button(_t("guide.tools"), "chip", func() -> void:
			_expanded = true
			_persist()
			update()
			_ui.follow_guide()))
	row.add_child(_button(_t("guide.done" if step == "complete" else "guide.skip"), "chip", _dismiss))
	details.add_child(row)
	_body.add_child(Paper.fold("%s · %s" % [_t("guide.progress", {"n": _NUMBERS[step]}), _t("guide.%s.title" % step)], details, _open, func(open: bool) -> void: _open = open))
	if step != "closing":
		_body.add_child(_button(_t("guide.%s.action" % step), "primary", _advance))


static func _button(text: String, kind: String, pressed: Callable) -> Button:
	var b := Paper.button(text, kind, pressed)
	b.mouse_filter = Control.MOUSE_FILTER_STOP
	return b


func show_help() -> void:
	var body := Paper.col([], 6)
	for topic: String in ["stock", "menu", "bake", "open", "close", "next"]:
		body.add_child(Paper.words(_t("guide.reference.%s.title" % topic), "h3"))
		body.add_child(Paper.words(_t("guide.reference.%s.body" % topic)))
	_ui.dialogs.show_dialog(_t("guide.helpTitle"), body, [{"label": _t("settings.back"), "kind": "primary"}])
