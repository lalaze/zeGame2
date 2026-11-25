class_name StyleDialog
extends RefCounted

## The café's style (src/ui/cafe-styles.ts): what it is known for, how far along it is, and the others to choose.

var _ui: CafeUi
var _session: CoreGameSession
var _changed: Callable
var _root := Paper.col([], 10)
var _scroll: ScrollContainer = null
var _viewed: Variant = null
var _browse := false
var _details := false


## `back` reopens the preparation it came from.
static func show_styles(ui: CafeUi, changed: Callable, back: Callable = Callable()) -> void:
	var d := StyleDialog.new()
	d._ui = ui
	d._session = ui.session
	d._changed = changed
	d._viewed = ui.session.state["cafeStyle"]["focus"]
	d._browse = d._viewed == null
	d._root.set_meta("owner", d)
	d._render()
	d._scroll = ui.dialogs.show_dialog(_t("style.ui.title"), d._root, [{"label": _t("style.ui.backPrep" if back.is_valid() else "style.ui.close"), "pressed": back}], {"tall": true, "back": func() -> void:
		ui.dialogs.close()
		if back.is_valid():
			back.call()})["scroll"]


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func style_name(id: Variant) -> String:
	return _t("style.%s.name" % (id if id != null else "mixed"))


static func _num(n: float) -> String:
	return CoreFormat.format_number(n) if JsMath.is_integer(n) else JsMath.number_to_string(floorf(n * 100.0) / 100.0)


static func _goal(goal: Dictionary) -> String:
	return _t("style.goal.%s" % goal["id"])


static func _progress(goal: Dictionary) -> String:
	return _t("style.ui.progress", {"current": _num(goal["current"]), "target": _num(goal["target"])})


## The key of what a goal hints at.
static func hint_key(goal: Dictionary, focus: String) -> String:
	var id: String = goal["id"]
	var starts := func(list: Array) -> bool: return list.any(func(p: String) -> bool: return id.begins_with(p))
	var hint := "menu"
	if id.ends_with("Welcome"):
		hint = "welcome"
	elif id.contains("Signature") or id.begins_with("signature"):
		hint = "taste"
	elif starts.call(["machine", "barista", "server", "cook"]):
		hint = "upgrade"
	elif id.begins_with("fastServed"):
		hint = "fastService"
	elif id.begins_with("teaPairs"):
		hint = "teaPairs"
	elif id.begins_with("catServed"):
		hint = "catService"
	elif id.begins_with("tableServed"):
		hint = "tableService"
	elif id in ["planted", "bookshelf"]:
		hint = id
	elif id.begins_with("cats"):
		hint = "cats"
	elif id.begins_with("comfort"):
		hint = "comfort"
	elif id in ["reading", "greenhouse", "terrace"]:
		hint = "rooms"
	elif id == "kitchen":
		hint = "bakeryKitchen" if focus == "bakery" else "kitchen"
	elif id == "reliable":
		hint = "reliable"
	elif starts.call(["coffee30", "tea30", "bakery100", "served", "tableServed", "catServed", "teaPairs"]):
		hint = "service"
	return "style.hint.%s" % hint


## The style as the preparation shows it.
static func prep_summary(s: Dictionary, pick: Callable) -> Control:
	var focus: Variant = s["cafeStyle"]["focus"]
	var copy := Paper.col([Paper.words(_t("style.prep.current", {"name": style_name(focus)}), "strong")], 2)
	if focus != null:
		var goal: Variant = CoreStyles.next_style_goal(s, focus)
		copy.add_child(Paper.words(_t("style.prep.next", {"goal": _goal(goal), "current": _num(goal["current"]), "target": _num(goal["target"])}) if goal != null else _t("style.ui.established"), "muted"))
	return Paper.line([copy, Paper.button(_t("style.prep.edit" if focus != null else "style.prep.choose"), "chip", pick)])


func _render() -> void:
	var s := _session.state
	var focus: Variant = s["cafeStyle"]["focus"]
	var id: String = _viewed if _viewed != null else "mixed"
	var active: bool = typeof(_viewed) == typeof(focus) and _viewed == focus
	var closed: bool = s["phase"] == "prep"
	Paper.clear(_root)
	_root.add_child(Paper.words(_t("style.ui.intro")))
	var card := Paper.col([Paper.words(_t("style.ui.current" if active else "style.ui.preview"), "small"), Paper.words(style_name(_viewed), "h3"), Paper.words(_t("style.%s.intro" % id))], 6)
	if _viewed != null:
		_add_stage(card, s)
	var choose := Paper.button(_t("style.ui.selected" if active else "style.ui.select"), "primary", func() -> void:
		if CoreStyles.set_cafe_style(s, _viewed):
			_changed.call()
			_browse = false
			_render())
	choose.disabled = active or not closed
	card.add_child(choose)
	if active and id in ["cats", "bakery"]:
		_add_welcome(card, s, id, closed)
	if not closed:
		card.add_child(Paper.words(_t("style.ui.closeOnly"), "muted"))
	var paper := Paper.card("row")
	paper.add_child(card)
	_root.add_child(paper)
	var choices := Paper.grid(2, [], 8)
	for style: Variant in CoreStyles.STYLE_IDS + [null]:
		var lines: Array = [[style_name(style), "strong"], [_t("style.%s.short" % (style if style != null else "mixed")), "small"]]
		if typeof(style) == typeof(focus) and style == focus:
			lines.append([_t("style.ui.current"), "good"])
		choices.add_child(Paper.multi(lines, null, func() -> void:
			_viewed = style
			_browse = true
			_details = false
			_render()
			_scroll.scroll_vertical = 0, "on" if typeof(style) == typeof(_viewed) and style == _viewed else "ghost"))
	_root.add_child(Paper.fold(_t("style.ui.browse"), choices, _browse, func(open: bool) -> void: _browse = open))
	_root.add_child(Paper.fold(_t("style.ui.details"), _all_details(s, id), _details, func(open: bool) -> void: _details = open))
	_root.add_child(Paper.words(_t("style.ui.keep"), "muted"))


func _add_stage(card: VBoxContainer, s: Dictionary) -> void:
	var stage := CoreStyles.current_style_stage(s, _viewed)
	var done := float(stage["goals"].filter(func(g: Dictionary) -> bool: return g["done"]).size())
	card.add_child(Paper.words(_t("style.ui.stage", {"stage": _t("style.stage.%s" % stage["id"]), "done": done, "total": float(stage["goals"].size())}), "good"))
	var goal: Variant = CoreStyles.next_style_goal(s, _viewed)
	card.add_child(Paper.words(_t("style.ui.next" if goal != null else "style.ui.done"), "strong"))
	if goal != null:
		card.add_child(Paper.words("%s · %s" % [_goal(goal), _progress(goal)]))
		card.add_child(Paper.words(_t(hint_key(goal, _viewed)), "muted"))
	else:
		card.add_child(Paper.words(_t("style.ui.established")))


func _add_welcome(card: VBoxContainer, s: Dictionary, id: String, closed: bool) -> void:
	var cats := id == "cats"
	var trial: bool = s["pets"].any(func(p: Dictionary) -> bool: return p.get("fosterUntilDay") is float and p["fosterUntilDay"] == s["day"]) if cats else (s["cafeStyle"].get("bakeryTrialDay") is float and s["cafeStyle"]["bakeryTrialDay"] == s["day"])
	var had: Variant = s["cafeStyle"].get("introductions")
	var eligible: bool = not (had is Array and id in had) and (s["pets"].is_empty() if cats else not s["kitchen"])
	if trial:
		card.add_child(Paper.words(_t("style.welcome.catActive" if cats else "style.welcome.bakeryActive"), "good"))
	elif eligible:
		card.add_child(Paper.words(_t("style.welcome.%s" % id), "muted"))
		var b := Paper.button(_t("style.welcome.startCats" if cats else "style.welcome.startBakery"), "primary", func() -> void:
			if CoreStyles.start_style_welcome(s, id):
				_changed.call()
				_render())
		b.disabled = not closed
		card.add_child(b)


func _all_details(s: Dictionary, id: String) -> Control:
	var out := Paper.col([Paper.words(_t("style.ui.effects"), "strong"), Paper.words(_t("style.%s.effects" % id)), Paper.words(_t("style.ui.cost"), "strong"), Paper.words(_t("style.%s.cost" % id))], 6)
	if _viewed != null:
		for stage: Dictionary in CoreStyles.style_stages(s, _viewed):
			out.add_child(Paper.words("%s%s" % [_t("style.stage.%s" % stage["id"]), " · %s" % _t("style.ui.done") if stage["done"] else ""], "strong"))
			for goal: Dictionary in stage["goals"]:
				out.add_child(Paper.words("%s · %s%s" % [_goal(goal), _progress(goal), " · %s" % _t("style.ui.done") if goal["done"] else ""], "good" if goal["done"] else ""))
	out.add_child(Paper.words(_t("style.ui.stacking"), "muted"))
	out.add_child(Paper.words(_t("style.ui.progressNote"), "muted"))
	return out
