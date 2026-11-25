class_name CafeLedger
extends Control

## The café ledger (src/ui/panel.ts and the drawer of main.ts): the goal, and a tab each for the menu, the pantry, the
## upgrades, the furnishings, the cats and promotion. Reading it pauses the café.

const TABS := ["menu", "pantry", "upgrades", "decor", "pets", "promotion"]
const PANTRY_AMOUNTS := [10.0, 50.0, 200.0]
var tab := "menu"
var intro := false
## The next table's place is shown in the room.
var table_preview := false
var session: CoreGameSession
var _ui: CafeUi
var _amount: Variant = 1.0
var _pantry_amount := 10.0
var _category := "all"
var _decor_category := "decoration"
var _pet_browsing: Variant = null
var _scroll_at: Dictionary = {}
var _pantry_task: Variant = null
var _signature := ""
var _goal_signature := ""
var _goal_expanded := false

var _cafe_name := Paper.words("", "muted", false)
var _title := Paper.words("", "h1", false)
var _pause := Paper.words("", "muted", false)
var _day := Paper.words("", "muted", false)
var _balance: Button
var _tabs: Dictionary = {}
var _tab_row: HBoxContainer
var _task := Paper.card("sage")
var _task_title := Paper.words("", "h3")
var _task_detail := Paper.words("", "muted")
var _scroll: ScrollContainer
var _goal := Paper.col([], 0)
var _tools := Paper.col([], 6)
var _list := Paper.col([], 12)
var _part: RefCounted = null
var _want_scroll := -1
var _stamp: Array = []


func _init(ui: CafeUi) -> void:
	_ui = ui
	session = ui.session
	theme = Paper.theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	visible = false
	var veil := ColorRect.new()
	veil.color = Paper.VEIL
	veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	veil.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
			_ui.set_ledger(false))
	add_child(veil)
	var sheet := Paper.card("sheet")
	sheet.name = "Sheet"
	sheet.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(sheet)
	var close := Paper.button("", "ghost", func() -> void: _ui.set_ledger(false), "close")
	close.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	close.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_balance = Paper.button("", "flat", func() -> void: SmallDialogs.money(_ui.dialogs, session.state["coins"]), "coin")
	for tone: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_focus_color", "icon_hover_pressed_color"]:
		_balance.add_theme_color_override(tone, Paper.GOLD)
	_tab_row = Paper.line([], 6)
	for id: String in TABS:
		var b := Paper.tool("", id, show_tab.bind(id), "ghost", 20.0)
		b.custom_minimum_size.y = 58.0
		_tabs[id] = b
		_tab_row.add_child(b)
	_task.add_child(Paper.col([_task_title, _task_detail], 2))
	_task.visible = false
	var inside := Paper.col([_goal, _tools, _list], 12)
	_scroll = Paper.scroller(Paper.padded(inside, 2, 4, 8, 12))
	var day := Paper.line([_day, Paper.spring(), _balance])
	sheet.add_child(Paper.col([Paper.line([Paper.col([_cafe_name, _title, _pause], 0), close]), day, Paper.seam(), _tab_row, _task, _scroll], 10))


func inset(top: float, bottom: float) -> void:
	var sheet: Control = get_node("Sheet")
	sheet.offset_left = 12.0
	sheet.offset_right = -12.0
	sheet.offset_top = top + 12.0
	sheet.offset_bottom = -12.0 - bottom


func set_open(on: bool) -> void:
	if visible == on:
		return
	if not on:
		_scroll_at[tab] = _scroll.scroll_vertical
		clear_table_preview()
	visible = on
	if on:
		update()
		_restore_scroll.call_deferred()


# ---------------------------------------------------------------- finding one's way

func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


## Intro mode is the first shift: only the owned dishes and one at a time.
func set_intro(on: bool) -> void:
	if intro == on:
		return
	intro = on
	clear_table_preview()
	update()


func show_tab(id: String) -> void:
	clear_table_preview()
	_ui.navigated()
	if id != tab:
		_scroll_at[tab] = _scroll.scroll_vertical
	# Direct navigation, including scene shortcuts, must always reach every tool.
	if id not in ["menu", "pantry"]:
		intro = false
	var moved := id != tab
	tab = id
	update()
	if moved:
		_restore_scroll.call_deferred()


## Back to where the list was, once it is long enough.
func _restore_scroll() -> void:
	if is_inside_tree():
		await get_tree().process_frame
	_want_scroll = int(_scroll_at.get(tab, 0))


## What is chosen for browsing, to come back to after a detour.
func browsing() -> Dictionary:
	if visible:
		_scroll_at[tab] = _scroll.scroll_vertical
	return {"tab": tab, "scroll": _scroll_at.duplicate(), "amount": _amount, "pantry": _pantry_amount, "category": _category, "decor": _decor_category, "pets": _pet_browsing.duplicate() if _pet_browsing is Dictionary else null}


func restore(context: Dictionary) -> void:
	clear_table_preview()
	tab = context["tab"]
	_scroll_at = context["scroll"].duplicate()
	_amount = context["amount"]
	_pantry_amount = context["pantry"]
	_category = context["category"]
	_decor_category = context["decor"]
	_pet_browsing = context["pets"]
	_signature = ""
	update()
	_restore_scroll.call_deferred()


## A detour for ingredients: {title, detail, ingredients}, or null.
func set_pantry_task(context: Variant) -> void:
	_pantry_task = context
	_tab_row.visible = context == null
	_task.visible = context != null
	if context != null:
		_task_title.text = context["title"]
		Paper.say(_task_detail, context["detail"])
	_update_goal()


## Brings a part of the list into view.
func reveal(control: Control) -> void:
	if is_inside_tree():
		await get_tree().process_frame
	_scroll.ensure_control_visible(control)


func to_top() -> void:
	_scroll.scroll_vertical = 0


func clear_table_preview() -> void:
	table_preview = false


func set_state() -> void:
	_pet_browsing = null
	clear_table_preview()
	_ui.navigated()
	refresh()


## Everything anew: another language, or other dishes and names.
func refresh() -> void:
	_signature = ""
	_goal_signature = ""
	update()


# ---------------------------------------------------------------- each time the rules say

func update() -> void:
	var s := session.state
	_cafe_name.text = s["profile"]["cafeName"] if s["profile"] != null else _t("app.title")
	_title.text = _t("panel.title")
	_pause.text = UiWords.here("已暂停 · 关闭后继续", "Paused · close to resume")
	_day.text = _t("day.label", {"n": s["day"]})
	_balance.text = _t("money.balance", {"money": UiWords.money(s["coins"])})
	if not visible:
		return
	for id: String in TABS:
		_tabs[id].words = _t("tab.%s" % id)
		Paper.dress(_tabs[id], "on" if id == tab else "ghost")
	var keys := _visible_keys()
	var signature := "%s|%s|%s|%s" % [I18n.locale, tab, intro, ",".join(PackedStringArray(keys))]
	_update_goal()
	if signature != _signature:
		# More or fewer rows of the same list, or another list.
		var same: bool = _part is LedgerRows and not _signature.is_empty() and _signature.substr(0, _signature.rfind("|")) == signature.substr(0, signature.rfind("|"))
		_signature = signature
		if same:
			_part.sync(keys)
		else:
			_build(keys)
	_stamp = [session.state["coins"], session.state["phase"], session.state["day"]]
	_part.update()


## Four times a second. While the ledger is read the café rests, so only what goes by the clock has to be kept up.
func heartbeat() -> void:
	if not visible or tab in ["upgrades", "pets", "promotion"] or _stamp != [session.state["coins"], session.state["phase"], session.state["day"]]:
		update()


func _process(_dt: float) -> void:
	if visible and _part is LedgerRows and _part.work(4.0) and _want_scroll >= 0:
		return
	if _want_scroll >= 0:
		_scroll.scroll_vertical = _want_scroll
		_want_scroll = -1


## Whether a row is on the screen, or nearly.
func in_sight(row: Control) -> bool:
	if not row.is_inside_tree():
		return true
	var page := _scroll.get_global_rect().grow(120.0)
	return page.intersects(row.get_global_rect())


func _visible_keys() -> Array:
	var s := session.state
	match tab:
		"promotion": return ["promotion"]
		"pets": return ["pets"]
		"decor": return ["decor", _decor_category]
		"upgrades": return ["room-projects", "manager", "orders", "chain"] + CoreData.UPGRADES.map(func(u: Dictionary) -> String: return "upgrade:%s" % u["id"])
		"pantry": return ["pantry"] + CoreEconomy.needed_ingredients(s).map(func(i: Dictionary) -> String: return "ing:%s" % i["id"])
	var keys: Array = ["signature-workbench"]
	if s["cafeStyle"]["focus"] != null:
		keys.append("style-prices")
	if intro:
		# Every owned dish, even if another filter was chosen before.
		for cat: String in CoreData.CATEGORIES:
			var owned := CoreData.MENU.filter(func(m: Dictionary) -> bool: return m["category"] == cat and s["items"][m["id"]] > 0.0)
			if not owned.is_empty():
				keys.append("cat:%s" % cat)
				keys.append_array(owned.map(func(m: Dictionary) -> String: return "item:%s" % m["id"]))
		return keys
	keys.append("variety")
	for cat: String in (CoreData.CATEGORIES if _category == "all" else [_category]):
		keys.append("cat:%s" % cat)
		# Each kind: what is unlocked, the one that can be unlocked next, then a mystery.
		for m: Dictionary in CoreData.MENU:
			if m["category"] != cat:
				continue
			var id: String = m["id"]
			var before: Variant = CoreEconomy.previous_in_category(id)
			if s["items"][id] > 0.0 or CoreEconomy.is_item_available(s, id) or (not CoreEconomy.can_prepare_item(s, id) and (before == null or s["items"][before["id"]] > 0.0)):
				keys.append("item:%s" % id)
			else:
				keys.append("teaser:%s" % id)
				break
	return keys


func _build(keys: Array) -> void:
	Paper.clear(_list)
	Paper.clear(_tools)
	_build_tools()
	match tab:
		"promotion": _part = PromotionPanel.new(_list, session, func() -> void: _bought("promotion", "campaign"))
		"pets":
			if _pet_browsing == null:
				_pet_browsing = PetPanel.start_browsing(session.state)
			_part = PetPanel.new(_list, _ui, _pet_browsing, func(id: String) -> void: _bought("pet", id))
		"decor": _part = LedgerDecor.new(_list, self, _ui, _decor_category)
		_: _part = LedgerRows.new(_list, self, _ui, keys)


func _build_tools() -> void:
	if intro or tab in ["decor", "pets", "promotion"]:
		return
	if tab == "pantry":
		_tools.add_child(_chooser(PANTRY_AMOUNTS.map(func(n: float) -> Array: return [n, "%d" % int(n)]), _pantry_amount, func(n: float) -> void: _pantry_amount = n))
		return
	if tab == "menu":
		var kinds: Array = [["all", _t("cat.all")]]
		for cat: String in CoreData.CATEGORIES:
			kinds.append([cat, _t("catShort.%s" % cat)])
		var row := Paper.line([], 4)
		for k: Array in kinds:
			var b := Paper.button(k[1], "on" if k[0] == _category else "chip", func() -> void:
				_category = k[0]
				_scroll.scroll_vertical = 0
				_again())
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(b)
		_tools.add_child(row)
	# The page has the amounts before the kinds, and shows them after.
	_tools.add_child(_chooser([[1.0, "x1"], [10.0, "x10"], ["max", _t("buy.max")]], _amount, func(n: Variant) -> void: _amount = n))


func _chooser(entries: Array, chosen: Variant, choose: Callable) -> Control:
	var row := Paper.line([Paper.words(_t("buy.label"), "small")], 4)
	for e: Array in entries:
		var on: bool = typeof(e[0]) == typeof(chosen) and e[0] == chosen
		row.add_child(Paper.button(e[1], "on" if on else "chip", func() -> void:
			choose.call(e[0])
			_again()))
	return row


func _again() -> void:
	_signature = ""
	update()


func choose_decor(category: String) -> void:
	_decor_category = category
	_scroll.scroll_vertical = 0
	_again()


func amount() -> Variant:
	return 1.0 if intro else _amount


func pantry_amount() -> float:
	return PANTRY_AMOUNTS[0] if intro else _pantry_amount


func shortfall(ingredient: String) -> bool:
	return _pantry_task != null and ingredient in _pantry_task["ingredients"]


func _bought(kind: String, id: String) -> void:
	session.panel_changed(kind, id)
	update()


## After something was bought or set, from one of the tab's parts.
func bought(kind: String, id: String) -> void:
	_bought(kind, id)


# ---------------------------------------------------------------- the goal

func _update_goal() -> void:
	var s := session.state
	var goal: Variant = CoreGoals.current_goal(s)
	if _pantry_task != null or (goal == null and not CoreMilestones.milestones_started(s)):
		_goal.visible = false
		return
	_goal.visible = true
	var card := {}
	if goal == null:
		# After the guided goals, the same card follows the café's milestones.
		card = MilestoneBook.card(s)
	else:
		var progress := CoreGoals.goal_progress(goal["id"], s)
		var done := CoreGoals.goal_done(s)
		var reward := CoreFormat.format_transaction_money(goal["reward"])
		card = {"sig": "%s|%s|%s" % [s["goal"], done, minf(progress[0], progress[1])], "done": done, "head": _t("goal.label", {"n": s["goal"] + 1.0, "total": float(CoreGoals.GOALS.size())}), "text": _t("goal.%s" % goal["id"]),
			"claim": _t("goal.claim", {"reward": reward}) if done else "", "note": "" if done else _t("goal.reward", {"reward": reward}), "share": -1.0 if done else minf(1.0, progress[0] / progress[1]),
			"progress": "" if done else "%s / %s" % [CoreFormat.format_number(minf(progress[0], progress[1])), CoreFormat.format_number(progress[1])], "book": false, "chapter": false}
	var signature := "%s|%s|%s" % [I18n.locale, card["sig"], goal == null]
	if signature == _goal_signature:
		return
	_goal_signature = signature
	_show_goal(card)


func _show_goal(card: Dictionary) -> void:
	Paper.clear(_goal)
	# A completed goal shows its claim at once.
	if card["done"]:
		_goal_expanded = true
	var paper := Paper.card("goal")
	var aside: String = card["claim"] if not card["claim"].is_empty() else card["progress"]
	var toggle := Paper.button("", "flat")
	toggle.custom_minimum_size.y = 44.0
	var sign := Paper.words("", "small", false)
	sign.set_meta("mark", true)
	var row := Paper.line([Paper.words(card["text"], "strong"), Paper.words(aside, "small", false), sign])
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	toggle.add_child(row)
	var details := Paper.col([Paper.words(card["head"], "small")], 6)
	var main := Paper.line([Paper.words(card["text"], "strong")])
	details.add_child(main)
	var actions := main
	if card["chapter"]:
		actions = Paper.line([])
		details.add_child(actions)
	if not card["claim"].is_empty():
		var claim := Paper.button(card["claim"], "primary", _claim.bind(card["chapter"]))
		if card["chapter"]:
			claim.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			claim.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		actions.add_child(claim)
	if not card["note"].is_empty():
		main.add_child(Paper.words(card["note"], "small", false))
	if card["book"]:
		actions.add_child(Paper.button(_t("milestone.card.book"), "chip", func() -> void: MilestoneBook.show_book(_ui.dialogs, session.state)))
	if card["share"] >= 0.0:
		details.add_child(Paper.progress(card["share"]))
		details.add_child(Paper.words(card["progress"], "small"))
	var fold := func() -> void:
		details.visible = _goal_expanded
		sign.text = "–" if _goal_expanded else "+"
	fold.call()
	toggle.pressed.connect(func() -> void:
		_goal_expanded = not _goal_expanded
		fold.call())
	paper.add_child(Paper.col([toggle, details], 4))
	_goal.add_child(paper)


func _claim(chapter: bool) -> void:
	if chapter:
		var id := MilestoneBook.claim(_ui.dialogs, session.state)
		if not id.is_empty():
			_bought("milestone", id)
	else:
		var reward := CoreGoals.claim_goal(session.state)
		if reward > 0.0:
			_bought("goal", JsMath.number_to_string(reward))


## Shows the goal's claim, from the day's report.
func reveal_goal() -> void:
	_goal_expanded = true
	_goal_signature = ""
	to_top()
	update()
