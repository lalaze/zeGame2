class_name CafeLedger
extends Control

## The café ledger (src/ui/panel.ts and the drawer of main.ts): Direction A notebook with protruding colored bookmarks,
## single-line header, goal tape (Menu only), and six tabs (menu, pantry, upgrades, decor, pets, promotion).

const TABS := ["menu", "pantry", "upgrades", "decor", "pets", "promotion"]
const PANTRY_AMOUNTS := [10.0, 50.0, 200.0]
var tab := "menu"
var intro := false
## The next table's place is shown in the room.
var table_preview := false
## Keys of expanded dish/ingredient cards; cleared on tab change and state replace.
var expanded_cards: Dictionary = {}
## Whether the Pantry intro notes fold is currently open.
var pantry_help_open := false
## Whether the Decor intro notes fold is currently open.
var decor_help_open := false
## Which operations tile is expanded on the Upgrades tab ("", "manager", "orders", "chain").
var open_ops_tile := ""
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

var _sheet := Control.new()
var _notebook := PaperNotebook.new()
var _title := Paper.words("", "h1", false)
var _status := Paper.words("", "small", false)
var _balance: Button
var _balance_lbl := Label.new()
var _tabs: Dictionary = {}
var _tab_row: HBoxContainer
var _task := Paper.card("sage")
var _task_title := Paper.words("", "h3")
var _task_detail := Paper.words("", "muted")
var _scroll: ScrollContainer
var _footer := Paper.col([], 0)
var _goal := Paper.col([], 0)
var _tools := Paper.col([], 6)
var _list := Paper.col([], 8)
var _part: RefCounted = null
var _want_scroll := -1
var _stamp: Array = []
var _styled_tab := ""
var _amount_btns: Array = []
var _pantry_amount_btns: Array = []


func _init(ui: CafeUi) -> void:
	_ui = ui
	session = ui.session
	theme = Paper.theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	visible = false
	var veil := ColorRect.new()
	veil.color = Color(60 / 255.0, 38 / 255.0, 24 / 255.0, 0.38)
	veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	veil.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
			_ui.set_ledger(false))
	add_child(veil)
	# Sheet spans the safe-area ledger region (top+12..bottom-12), holding both bookmarks and notebook cover.
	_sheet.name = "Sheet"
	_sheet.set_anchors_preset(Control.PRESET_FULL_RECT)
	_sheet.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_sheet)
	_notebook.set_anchors_preset(Control.PRESET_FULL_RECT)
	_notebook.offset_top = 46.0
	_sheet.add_child(_notebook)
	# Protruding colored bookmark tabs along the top rim of the notebook.
	_tab_row = Paper.line([], 4)
	_tab_row.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_tab_row.offset_left = 14.0
	_tab_row.offset_right = -14.0
	_tab_row.offset_top = 2.0
	_tab_row.offset_bottom = 54.0
	_tab_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for id: String in TABS:
		var b := PaperTool.new("", id, 17.0).small()
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_filter = Control.MOUSE_FILTER_PASS
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.size_flags_vertical = Control.SIZE_SHRINK_END
		b.custom_minimum_size = Vector2(0.0, 42.0)
		b.set_meta("kind", "flat")
		b.pressed.connect(show_tab.bind(id))
		_tabs[id] = b
		_tab_row.add_child(b)
	_sheet.add_child(_tab_row)
	# Single-line page header inside the cream page: active tab title + day/paused | gold coin + balance + circle close.
	_title.add_theme_font_size_override("font_size", 22)
	_title.add_theme_font_override("font", Paper.font(800))
	_title.add_theme_color_override("font_color", Paper.INK_A)
	_status.add_theme_font_size_override("font_size", 11)
	_status.add_theme_font_override("font", Paper.font(600))
	_status.add_theme_color_override("font_color", Paper.INK_LIGHT)
	_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_status.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_status.clip_text = true
	_balance = Button.new()
	_balance.focus_mode = Control.FOCUS_NONE
	_balance.mouse_filter = Control.MOUSE_FILTER_PASS
	_balance.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var empty := StyleBoxEmpty.new()
	for st: String in ["normal", "hover", "pressed", "focus", "hover_pressed"]:
		_balance.add_theme_stylebox_override(st, empty)
	_balance_lbl.add_theme_font_override("font", Paper.font(800))
	_balance_lbl.add_theme_font_size_override("font_size", 15)
	_balance_lbl.add_theme_color_override("font_color", Paper.INK_A)
	_balance_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bal_row := Paper.line([Paper.coin_badge(19.0), _balance_lbl], 5)
	bal_row.alignment = BoxContainer.ALIGNMENT_CENTER
	bal_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bal_row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_balance.add_child(bal_row)
	bal_row.minimum_size_changed.connect(func() -> void: _balance.custom_minimum_size = Vector2(bal_row.get_combined_minimum_size().x + 4.0, 34.0))
	_balance.custom_minimum_size = Vector2(44.0, 34.0)
	_balance.pressed.connect(func() -> void: SmallDialogs.money(_ui.dialogs, session.state["coins"]))
	var close := Paper.circle_close(func() -> void: _ui.set_ledger(false))
	var header := Paper.line([_title, _status, _balance, close], 6)
	header.alignment = BoxContainer.ALIGNMENT_CENTER
	_task.add_child(Paper.col([_task_title, _task_detail], 2))
	_task.visible = false
	var inside := Paper.col([_goal, _tools, _list], 8)
	_scroll = Paper.scroller(Paper.padded(inside, 0, 2, 4, 12))
	_footer.visible = false
	_notebook.add_child(Paper.col([header, _task, _scroll, _footer], 6))


func inset(top: float, bottom: float) -> void:
	_sheet.offset_left = 10.0
	_sheet.offset_right = -10.0
	_sheet.offset_top = top + 12.0
	_sheet.offset_bottom = -12.0 - bottom


func set_open(on: bool) -> void:
	if visible == on:
		return
	if not on:
		_scroll_at[tab] = _scroll.scroll_vertical
		clear_table_preview()
	visible = on
	_ui.hud.visible = not on
	_ui.dialogs.set_note_at_bottom(on, float(_ui.get("_bottom")))
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
	var moved := id != tab
	if moved:
		_scroll_at[tab] = _scroll.scroll_vertical
		expanded_cards.clear()
		pantry_help_open = false
		decor_help_open = false
		open_ops_tile = ""
	# Direct navigation, including scene shortcuts, must always reach every tool.
	if id not in ["menu", "pantry"]:
		intro = false
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
	var pets_copy: Variant = null
	if _pet_browsing is Dictionary:
		pets_copy = {"group": _pet_browsing.get("group", "all"), "expanded": _pet_browsing.get("expanded", {}).duplicate()}
	return {"tab": tab, "scroll": _scroll_at.duplicate(), "amount": _amount, "pantry": _pantry_amount, "category": _category, "decor": _decor_category, "pets": pets_copy}


func restore(context: Dictionary) -> void:
	clear_table_preview()
	tab = context["tab"]
	_scroll_at = context["scroll"].duplicate()
	_amount = context["amount"]
	_pantry_amount = context["pantry"]
	_category = context["category"]
	_decor_category = context["decor"]
	var pets_ctx: Variant = context["pets"]
	_pet_browsing = {"group": pets_ctx.get("group", "all"), "expanded": pets_ctx.get("expanded", {}).duplicate()} if pets_ctx is Dictionary else null
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


## Scrolls down just enough to show a part that opened below the screen, never past its top
## (like scrollIntoView({block: 'nearest'}) on the web).
func reveal_below(control: Control) -> void:
	if is_inside_tree():
		await get_tree().process_frame
	if not is_instance_valid(control) or not control.is_visible_in_tree():
		return
	var view := _scroll.get_global_rect()
	var rect := control.get_global_rect()
	var down := minf(rect.position.y - view.position.y, rect.end.y - view.end.y)
	if down > 0.0:
		_scroll.scroll_vertical += ceili(down)


func to_top() -> void:
	_scroll.scroll_vertical = 0


func clear_table_preview() -> void:
	table_preview = false


func set_state() -> void:
	_pet_browsing = null
	expanded_cards.clear()
	pantry_help_open = false
	decor_help_open = false
	open_ops_tile = ""
	clear_table_preview()
	_ui.navigated()
	refresh()


func set_footer(control: Control) -> void:
	Paper.clear(_footer)
	if control != null:
		_footer.add_child(control)
	_footer.visible = control != null


## Everything anew: another language, or other dishes and names.
func refresh() -> void:
	_signature = ""
	_goal_signature = ""
	update()


# ---------------------------------------------------------------- each time the rules say

func update() -> void:
	var s := session.state
	_title.text = _t("tab.%s" % tab)
	_status.text = "%s · %s" % [_t("day.label", {"n": s["day"]}), _t("ledger.paused")]
	_balance_lbl.text = UiWords.money(s["coins"])
	if not visible:
		return
	_notebook.set_strip_color(Paper.TAB_COLORS.get(tab, Paper.TAB_COLORS["menu"]))
	var restyle_tabs := _styled_tab != tab
	_styled_tab = tab
	for id: String in TABS:
		var b: PaperTool = _tabs[id]
		b.words = _t("tab.%s" % id)
		if restyle_tabs:
			var active: bool = id == tab
			var base_col: Color = Paper.TAB_COLORS.get(id, Paper.TAB_COLORS["menu"])
			var col: Color = base_col if active else base_col.lerp(Color8(0xe6, 0xda, 0xc7), 0.14)
			var sb := Paper.bookmark_box(col, active)
			for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
				b.add_theme_stylebox_override(st, sb)
			b.custom_minimum_size.y = 52.0 if active else 42.0
			b.modulate.a = 1.0
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
		"upgrades": return ["ugrp:staff", "upgrade:barista", "upgrade:server", "upgrade:cook", "ugrp:shop", "upgrade:marketing", "upgrade:machine", "upgrade:tables", "upgrade:pass", "room-projects", "ugrp:ops", "ops-grid"]
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
	set_footer(null)
	_amount_btns.clear()
	_pantry_amount_btns.clear()
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
	_tools.visible = not intro and tab in ["menu", "pantry", "upgrades"]
	if not _tools.visible:
		return
	if tab == "pantry":
		var seg := _segment(PANTRY_AMOUNTS.map(func(n: float) -> Array: return [n, "%d" % int(n)]), _pantry_amount, _pantry_amount_btns, func(n: float) -> void:
			_pantry_amount = n
			_style_segments(_pantry_amount_btns, _pantry_amount)
			update())
		var row := Paper.line([Paper.words(_t("buy.label"), "small", false), Paper.spring(), seg], 6)
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		_tools.add_child(row)
		return
	var seg_entries := [[1.0, "×1"], [10.0, "×10"], ["max", _t("buy.max")]]
	var amount_seg := _segment(seg_entries, _amount, _amount_btns, func(n: Variant) -> void:
		_amount = n
		_style_segments(_amount_btns, _amount)
		update())
	if tab == "menu":
		var kinds: Array = [["all", _t("cat.all")]]
		for cat: String in CoreData.CATEGORIES:
			kinds.append([cat, _t("catShort.%s" % cat)])
		var chips := HBoxContainer.new()
		chips.add_theme_constant_override("separation", 4)
		for k: Array in kinds:
			var b := Paper.button(k[1], "chip", func() -> void:
				if _category == k[0]:
					return
				_category = k[0]
				_scroll.scroll_vertical = 0
				_again())
			Paper.style_filter_chip(b, k[0] == _category)
			chips.add_child(b)
		var chip_scroll := ScrollContainer.new()
		chip_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
		chip_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		chip_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		chip_scroll.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		chip_scroll.custom_minimum_size.y = 32.0
		chip_scroll.scroll_deadzone = 6
		chip_scroll.add_child(chips)
		var row := Paper.line([chip_scroll, amount_seg], 6)
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		_tools.add_child(row)
		return
	var up_row := Paper.line([Paper.words(_t("buy.label"), "small", false), Paper.spring(), amount_seg], 6)
	up_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_tools.add_child(up_row)


func _segment(entries: Array, chosen: Variant, store: Array, choose: Callable) -> HBoxContainer:
	var box := HBoxContainer.new()
	box.add_theme_constant_override("separation", 0)
	box.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	for i in entries.size():
		var e: Array = entries[i]
		var pos := -1 if i == 0 else (1 if i == entries.size() - 1 else 0)
		var b := Paper.button(e[1], "chip", choose.bind(e[0]))
		var on: bool = typeof(e[0]) == typeof(chosen) and e[0] == chosen
		Paper.style_seg_btn(b, on, pos)
		store.append([b, e[0], pos])
		box.add_child(b)
	return box


static func _style_segments(store: Array, chosen: Variant) -> void:
	for item: Array in store:
		var on: bool = typeof(item[1]) == typeof(chosen) and item[1] == chosen
		Paper.style_seg_btn(item[0], on, item[2])


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


# ---------------------------------------------------------------- the goal tape (Menu tab only)

func _update_goal() -> void:
	if tab != "menu" or _pantry_task != null:
		_goal.visible = false
		return
	var s := session.state
	var goal: Variant = CoreGoals.current_goal(s)
	if goal == null and not CoreMilestones.milestones_started(s):
		_goal.visible = false
		return
	_goal.visible = true
	var card := {}
	if goal == null:
		card = MilestoneBook.card(s)
	else:
		var progress := CoreGoals.goal_progress(goal["id"], s)
		var done := CoreGoals.goal_done(s)
		var reward := CoreFormat.format_transaction_money(goal["reward"])
		card = {"sig": "%s|%s|%s" % [s["goal"], done, minf(progress[0], progress[1])], "done": done, "head": _t("goal.label", {"n": s["goal"] + 1.0, "total": float(CoreGoals.GOALS.size())}), "text": _t("goal.%s" % goal["id"]),
			"claim": _t("goal.claim", {"reward": reward}) if done else "", "note": "" if done else _t("goal.reward", {"reward": reward}), "share": -1.0 if done else minf(1.0, progress[0] / progress[1]),
			"progress": "" if done else "%s / %s · %s" % [CoreFormat.format_number(minf(progress[0], progress[1])), CoreFormat.format_number(progress[1]), _t("goal.reward", {"reward": reward})], "book": false, "chapter": false}
	var signature := "%s|%s|%s" % [I18n.locale, card["sig"], goal == null]
	if signature == _goal_signature:
		return
	_goal_signature = signature
	_show_goal(card)


func _show_goal(card: Dictionary) -> void:
	Paper.clear(_goal)
	var tape := PaperTape.new()
	var leaf := Paper.mark("leaf", 18.0, Paper.SAGE_A)
	var body := Paper.col([], 3)
	var title := Paper.words(card["text"], "strong")
	title.add_theme_font_size_override("font_size", 12)
	title.add_theme_font_override("font", Paper.font(800))
	title.add_theme_color_override("font_color", Paper.INK_A)
	var row := Paper.line([leaf, body], 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	if card["book"]:
		# Milestone mode: head + text + optional progress/actions, plus book button.
		if not card["head"].is_empty():
			var h := Paper.words(card["head"], "tiny")
			h.add_theme_color_override("font_color", Paper.INK_LIGHT)
			body.add_child(h)
		body.add_child(title)
		var book_btn := Paper.button(_t("milestone.card.book"), "chip", func() -> void: MilestoneBook.show_book(_ui.dialogs, session.state))
		book_btn.custom_minimum_size = Vector2(0.0, 30.0)
		book_btn.add_theme_font_size_override("font_size", 11)
		if card["chapter"]:
			var claim := _tape_claim(card["claim"], true)
			claim.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			claim.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			book_btn.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			body.add_child(claim)
			body.add_child(book_btn)
		else:
			if card["share"] >= 0.0:
				body.add_child(Paper.progress_a(card["share"], 4.0, Paper.SAGE_A, Color(74 / 255.0, 52 / 255.0, 38 / 255.0, 0.14)))
				var p := Paper.words(card["progress"], "tiny")
				p.add_theme_color_override("font_color", Paper.INK_LIGHT)
				body.add_child(p)
			row.add_child(book_btn)
	else:
		# Guided goal mode: compact single-band tape strip.
		body.add_child(title)
		if card["done"]:
			row.add_child(_tape_claim(card["claim"], false))
		else:
			var p := Paper.words(card["progress"], "tiny")
			p.add_theme_color_override("font_color", Paper.INK_LIGHT)
			body.add_child(p)
			body.add_child(Paper.progress_a(card["share"], 4.0, Paper.SAGE_A, Color(74 / 255.0, 52 / 255.0, 38 / 255.0, 0.14)))
			var pill := Paper.panel(Paper.box(Color(1.0, 0.98, 0.94, 0.72), Color.TRANSPARENT, 0, 10, Vector2(8, 3)))
			pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			var hl := Paper.words(card["head"], "tiny", false)
			hl.add_theme_font_override("font", Paper.font(700))
			hl.add_theme_color_override("font_color", Paper.INK_LIGHT)
			pill.add_child(hl)
			row.add_child(pill)
	tape.add_child(row)
	_goal.add_child(tape)


func _tape_claim(text: String, chapter: bool) -> Button:
	var b := Paper.button(text, "primary", _claim.bind(chapter))
	b.custom_minimum_size = Vector2(0.0, 30.0)
	b.add_theme_font_size_override("font_size", 12)
	b.add_theme_font_override("font", Paper.font(800))
	var normal := Paper.box(Paper.SAGE_A, Color.TRANSPARENT, 0, 10, Vector2(10, 5), Paper.SAGE_A_DARK, 2.0)
	var down := Paper.box(Paper.SAGE_A_DARK, Color.TRANSPARENT, 0, 10, Vector2(10, 5))
	for st: String in ["normal", "hover", "focus"]:
		b.add_theme_stylebox_override(st, normal)
	b.add_theme_stylebox_override("pressed", down)
	b.add_theme_stylebox_override("hover_pressed", down)
	return b


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
	_goal_signature = ""
	to_top()
	update()
