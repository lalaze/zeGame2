class_name Onboarding
extends Control

## The opening flow (src/ui/onboarding.ts): name the café, dress the owner, pick a starter style; later also for editing
## the name and the owner.

const _SKINS := [0xf4cfad, 0xdfaa7d, 0xb67c55, 0x80533f]
const _HAIRS := [0x594237, 0x976546, 0xdfb96f, 0xb9674e, 0x626782, 0xcc8c9f]
const _SHIRTS := [0xbb6b58, 0x799ba7, 0x8ba477, 0xd3a453, 0x9b87af, 0xcf929e, 0x69a295, 0xe5d7ba]
## The owner as drawn in the game's own sample.
const _SAMPLE := {"skin": 0.0, "hair": 0.0, "hairStyle": 1.0, "shirt": 2.0, "pants": 1.0}
signal done(profile: Dictionary, theme: String)
signal cancelled
signal language(locale: String)
var draft: Dictionary
var index := 0
var _editing: bool
var _steps: Array
var _card := Paper.card("sheet")
var _holder := MarginContainer.new()
var _edges := 40.0
var _fit := Callable()


func _init(editing: bool, initial: Variant) -> void:
	_editing = editing
	_steps = ["name", "character"] if editing else ["welcome", "name", "character", "style", "opening"]
	var names := I18n.list("ob.names")
	draft = {"cafeName": initial["cafeName"] if initial != null else names[randi() % names.size()], "ownerName": initial["ownerName"] if initial != null else "", "look": initial["look"].duplicate() if initial != null else _random_look(), "theme": CoreDecor.STARTER_THEMES[0]["id"]}
	theme = Paper.theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var veil := ColorRect.new()
	veil.color = Paper.VEIL
	veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(veil)
	_holder.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "right", "top", "bottom"]:
		_holder.add_theme_constant_override("margin_%s" % side, 20)
	add_child(_holder)
	_card.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_holder.add_child(_card)
	render()


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _random_look() -> Dictionary:
	while true:
		var look := {}
		for part: String in CoreState.LOOK_RANGES:
			look[part] = float(randi() % int(CoreState.LOOK_RANGES[part]))
		if not CoreState.hair_clashes(look):
			return look
	return {}


func next() -> void:
	if _steps[index] == "name" and CoreState.clean_name(draft["cafeName"]).is_empty():
		return
	if index < _steps.size() - 1:
		index += 1
		render()
		return
	var name := CoreState.clean_name(draft["cafeName"])
	queue_free()
	done.emit({"cafeName": name if not name.is_empty() else I18n.list("ob.names")[0], "ownerName": CoreState.clean_name(draft["ownerName"]), "look": draft["look"]}, "" if _editing else draft["theme"])


## The phone's back button and the card's: a step back, or out of editing.
func back() -> void:
	if index > 0:
		index -= 1
		render()
	elif _editing:
		queue_free()
		cancelled.emit()


func render() -> void:
	Paper.clear(_card)
	var step: String = _steps[index]
	var dots := Paper.line([], 8)
	dots.alignment = BoxContainer.ALIGNMENT_CENTER
	for i in _steps.size():
		var dot := PanelContainer.new()
		dot.custom_minimum_size = Vector2(10, 10)
		dot.add_theme_stylebox_override("panel", Paper.box(Paper.SAGE if i <= index else Paper.SOFT_LINE, Color.TRANSPARENT, 0, 5, Vector2.ZERO))
		dots.add_child(dot)
	var body := Paper.col([], 10)
	match step:
		"welcome": _welcome(body)
		"name": _name(body)
		"character": _character(body)
		"style": _style(body)
		"opening": _opening(body)
	var label := _t("ob.save") if _editing and index == _steps.size() - 1 else _t({"opening": "ob.open.button", "welcome": "ob.start"}.get(step, "ob.next"))
	var back_label := (_t("ob.cancel") if _editing else "") if index == 0 else _t("ob.back")
	var actions := Paper.line([])
	if not back_label.is_empty():
		actions.add_child(Paper.button(back_label, "ghost", back))
	actions.add_child(Paper.spring())
	actions.add_child(Paper.button(label, "primary", next))
	var scroll := Paper.scroller(Paper.padded(body, 4))
	_card.add_child(Paper.col([dots, scroll, actions], 12))
	_fit = func() -> void:
		scroll.custom_minimum_size.y = minf(body.get_combined_minimum_size().y + 12.0, maxf(80.0, size.y - _edges - 130.0))
	body.minimum_size_changed.connect(_fit, CONNECT_DEFERRED)
	_fit.call_deferred()


## Between the notch and the keyboard, or the bottom of the screen.
func inset(top: float, bottom: float) -> void:
	_holder.add_theme_constant_override("margin_top", int(top) + 20)
	_holder.add_theme_constant_override("margin_bottom", int(bottom) + 20)
	_edges = top + bottom + 40.0
	_fit.call_deferred()


static func _centred(text: String, kind: String) -> Label:
	var l := Paper.words(text, kind)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


func _welcome(body: VBoxContainer) -> void:
	var logo := Paper.picture(load("res://art/full/app-icon.png"), 96.0)
	logo.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	body.add_child(logo)
	body.add_child(_centred(_t("ob.welcome.title"), "h2"))
	body.add_child(_centred(_t("ob.welcome.body"), ""))
	var row := Paper.line([])
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	for l: Array in CafeUi.LOCALES:
		row.add_child(Paper.button(l[1], "on" if l[0] == I18n.locale else "chip", func() -> void:
			# The suggested name keeps step with the language, unless it was typed.
			var suggested: bool = draft["cafeName"] in I18n.list("ob.names")
			language.emit(l[0])
			if suggested:
				var names := I18n.list("ob.names")
				draft["cafeName"] = names[randi() % names.size()]
			render()))
	body.add_child(row)


static func _plate(text: String) -> Array:
	var sign := _centred(text, "h2")
	sign.autowrap_mode = TextServer.AUTOWRAP_OFF
	var plate := Paper.panel(Paper.box(Paper.PAPER_2, Paper.LINE, 2, 14, Vector2(20, 10), Paper.STAMP, 3.0), Paper.STITCH, 5.0, 10.0)
	plate.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	plate.add_child(sign)
	return [plate, sign]


func _name(body: VBoxContainer) -> void:
	body.add_child(_centred(_t("ob.name.title"), "h2"))
	body.add_child(_centred(_t("ob.name.hint"), "muted"))
	var plate := _plate("")
	body.add_child(plate[0])
	var sync := func() -> void:
		var name := CoreState.clean_name(draft["cafeName"])
		plate[1].text = name if not name.is_empty() else "…"
	var input := Paper.entry(draft["cafeName"], "", int(CoreState.NAME_MAX), func(text: String) -> void:
		draft["cafeName"] = text
		sync.call())
	input.text_submitted.connect(func(_text: String) -> void: next())
	body.add_child(Paper.line([input, Paper.button(_t("ob.random"), "ghost", func() -> void:
		var others := Array(I18n.list("ob.names")).filter(func(n: String) -> bool: return n != draft["cafeName"])
		draft["cafeName"] = others[randi() % others.size()]
		input.text = draft["cafeName"]
		sync.call())]))
	sync.call()


func _character(body: VBoxContainer) -> void:
	body.add_child(_centred(_t("ob.char.title"), "h2"))
	var owner := Paper.col([], 0)
	body.add_child(owner)
	var groups := Paper.col([], 8)
	var paint := func(again: Callable) -> void:
		Paper.clear(owner)
		var figure := Portraits.person(draft["look"], 90.0)
		figure.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		owner.add_child(figure)
		Paper.clear(groups)
		for g: Array in [["skin", "ob.char.skin", _SKINS], ["hairStyle", "ob.char.style", []], ["hair", "ob.char.hair", _HAIRS], ["shirt", "ob.char.apron", _SHIRTS]]:
			groups.add_child(Paper.words(_t(g[1]), "small"))
			groups.add_child(_swatches(g[0], g[2], again))
	var again := func(f: Callable) -> void: paint.call(f)
	var repaint := [Callable()]
	repaint[0] = func() -> void: paint.call(repaint[0])
	repaint[0].call()
	body.add_child(groups)
	body.add_child(Paper.button(UiWords.here("使用样板店主造型", "Use cozy owner look"), "ghost", func() -> void:
		draft["look"] = _SAMPLE.duplicate()
		repaint[0].call()))
	var input := Paper.entry(draft["ownerName"], _t("ob.char.namePlaceholder"), int(CoreState.NAME_MAX), func(text: String) -> void: draft["ownerName"] = text)
	body.add_child(Paper.line([input, Paper.button(_t("ob.random"), "ghost", func() -> void:
		draft["look"] = _random_look()
		repaint[0].call())]))


func _swatches(part: String, colours: Array, again: Callable) -> Control:
	var row: Container = Paper.flow([], 6) if not colours.is_empty() else Paper.line([], 6)
	for i in int(CoreState.LOOK_RANGES[part]):
		var chosen: bool = draft["look"][part] == float(i)
		var b := Paper.button("", "on" if chosen else "chip", func() -> void:
			var look: Dictionary = draft["look"].duplicate()
			look[part] = float(i)
			draft["look"] = CoreState.without_hair_clash(look)
			again.call())
		b.custom_minimum_size = Vector2(44, 44)
		if not colours.is_empty():
			var dot := PanelContainer.new()
			dot.add_theme_stylebox_override("panel", Paper.box(Color.hex((colours[i] << 8) | 0xff), Paper.LINE, 1, 9, Vector2.ZERO))
			dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
			dot.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 8)
			b.add_child(dot)
			# A hair colour that clashes with the skin is not offered.
			var look: Dictionary = draft["look"].duplicate()
			look[part] = float(i)
			b.disabled = part == "hair" and CoreState.hair_clashes(look)
			dot.modulate.a = 0.35 if b.disabled else 1.0
		else:
			var look: Dictionary = draft["look"].duplicate()
			look["hairStyle"] = float(i)
			var head := Portraits.head(look, 40.0)
			head.set_anchors_preset(Control.PRESET_CENTER)
			head.position = -head.custom_minimum_size / 2.0
			head.size = head.custom_minimum_size
			b.add_child(head)
			b.custom_minimum_size = Vector2(54, 54)
		row.add_child(b)
	if not colours.is_empty():
		return row
	var strip := ScrollContainer.new()
	strip.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	strip.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	strip.scroll_deadzone = 8
	strip.custom_minimum_size.y = 60.0
	strip.mouse_filter = Control.MOUSE_FILTER_PASS
	strip.add_child(row)
	return strip


func _style(body: VBoxContainer) -> void:
	body.add_child(_centred(_t("ob.style.title"), "h2"))
	body.add_child(_centred(_t("ob.style.hint"), "muted"))
	for th: Dictionary in CoreDecor.STARTER_THEMES:
		var id: String = th["id"]
		var copy := Paper.col([Paper.words(_t("theme.%s" % id), "strong")], 2)
		for part: String in _t("theme.%s.description" % id).split(" · "):
			copy.add_child(Paper.words(part, "small"))
		var inside := Paper.padded(Paper.line([ThemePreview.control(id, 150.0), copy], 10), 10, 8)
		for c: Control in [inside, inside.get_child(0), copy]:
			c.mouse_filter = Control.MOUSE_FILTER_IGNORE
		inside.set_anchors_preset(Control.PRESET_FULL_RECT)
		var b := Paper.button("", "on" if draft["theme"] == id else "ghost", func() -> void:
			draft["theme"] = id
			render())
		b.add_child(inside)
		b.custom_minimum_size.y = 120.0
		body.add_child(b)


func _opening(body: VBoxContainer) -> void:
	var cafe := CoreState.clean_name(draft["cafeName"])
	body.add_child(_centred(_t("ob.open.title"), "h2"))
	body.add_child(_plate(cafe)[0])
	var figure := Portraits.person(draft["look"], 110.0)
	figure.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	body.add_child(figure)
	body.add_child(_centred(_t("ob.open.body", {"cafe": cafe}), ""))
