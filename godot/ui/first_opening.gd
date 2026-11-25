class_name FirstOpening
extends RefCounted

## The very first opening, step by step (src/ui/first-opening.ts): stock, menu, doors. It buys nothing.

var _ui: CafeUi
var _session: CoreGameSession
var _step := "stock"


static func show_opening(ui: CafeUi, step: String) -> void:
	var d := FirstOpening.new()
	d._ui = ui
	d._session = ui.session
	d._step = step
	d._render()


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _available() -> bool:
	return _session.state["phase"] == "prep" and _session.state["day"] == 1.0


func _ready_count() -> float:
	return CoreEconomy.ready_servings(_session.state, "espresso")


func _ready() -> bool:
	return _session.state["items"]["espresso"] > 0.0 and _ready_count() > 0.0


func _selected() -> bool:
	return "espresso" in _session.state["onMenu"]


func _to(step: String) -> void:
	_step = step
	_render()


func _render() -> void:
	if not _available():
		return
	var s := _session.state
	var count := _ready_count()
	var dots := Paper.line([], 8)
	for id: String in ["stock", "menu", "open"]:
		var l := Paper.words("%d" % (["stock", "menu", "open"].find(id) + 1), "strong", false)
		var name := Paper.words(_t("opening.%s.label" % id), "strong" if id == _step else "small", false)
		dots.add_child(Paper.line([l, name], 3))
	var body := Paper.col([dots, Paper.words(_t("opening.%s.title" % _step), "h3"), Paper.words(_t("opening.%s.body" % _step))], 10)
	match _step:
		"stock":
			body.add_child(Paper.line([Paper.words(CoreFormat.format_number(s["pantry"]["beans"]), "h1", false), Paper.words(_t("opening.beans"))]))
			body.add_child(Paper.words(_t("opening.stockCount", {"n": CoreFormat.format_number(count)}), "muted"))
		"menu":
			var card := Paper.card("row")
			var tick := Paper.check("", _selected(), func(on: bool) -> void:
				CoreEconomy.set_on_menu(s, "espresso", on)
				_session.stock_changed()
				_render.call_deferred())
			card.add_child(Paper.line([tick, Portraits.icon("item:espresso", 44.0), Paper.col([Paper.words(_t("item.espresso"), "strong"), Paper.words(_t("opening.recipe"), "small")], 2)]))
			body.add_child(card)
			if not _selected():
				body.add_child(Paper.words(_t("opening.selectHint"), "bad"))
		"open":
			for line: String in [_t("opening.menuReady"), _t("opening.stockReady", {"n": CoreFormat.format_number(count)}), _t("opening.teamReady")]:
				body.add_child(Paper.words(line, "good"))
			body.add_child(Paper.words(_t("opening.afterOpen"), "muted"))
	if not _ready():
		body.add_child(Paper.words(_t("opening.noStock"), "bad"))
	body.add_child(Paper.button(_t("opening.advanced"), "chip", func() -> void:
		if _available():
			_ui.dialogs.close()
			_ui.show_prepare()))
	body.set_meta("owner", self)
	var buttons: Array = [{"label": _t("opening.%s.next" % _step), "kind": "primary", "disabled": not _ready() or (_step != "stock" and not _selected()), "pressed": _next}]
	if _step != "stock":
		buttons.append({"label": _t("ob.back"), "pressed": func() -> void: _to("menu" if _step == "open" else "stock")})
	buttons.append({"label": _t("opening.later")})
	_ui.dialogs.show_dialog(_t("opening.title"), body, buttons)


func _next() -> void:
	if not _available():
		return
	if not _ready():
		_to("stock")
	elif _step == "stock":
		_ui.guide.confirm_stock()
		_to("menu")
	elif not _selected():
		_to("menu")
	elif _step == "menu":
		_to("open")
	else:
		_session.start_day()
