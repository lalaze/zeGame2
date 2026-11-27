class_name LedgerRows
extends RefCounted

## The ledger's lists (src/ui/panel.ts): 2-column Menu dish cards & Pantry ingredient cards with collapsible
## full-width details, plus grouped Upgrades with compact fold rows and 3-tile Operations section.

## Everything at once; tests ask for it. Otherwise what is out of sight is made and kept up a little each frame.
static var at_once := false
var _list: VBoxContainer
var _ledger: CafeLedger
var _ui: CafeUi
var _session: CoreGameSession
var _rows: Dictionary = {}
## The list's parts by key, the keys in order, those still to be made, and the rows still to be kept up.
var _nodes: Dictionary = {}
var _keys: Array = []
var _pending: Array = []
var _stale: Array = []
var _pair_rows: Array[Control] = []
var _open_pair: HBoxContainer = null
var _open_spacer: Control = null
var _can_append := false
## What every dish's row needs, worked out once for all of them.
var _today: Array = []
var _average := 0.0
var _cards: LedgerCards
var _projects_label: Label = null
var _ops_hint: Label = null
var _variety: Label = null
var _bake_all: Button = null
var _forecast: Label = null
var _restock: Button = null
var _restock_reason: Label = null


func _init(list: VBoxContainer, ledger: CafeLedger, ui: CafeUi, keys: Array) -> void:
	_list = list
	_ledger = ledger
	_ui = ui
	_session = ui.session
	_cards = LedgerCards.new(ledger, ui)
	sync(keys)


static func _is_grid_key(key: String) -> bool:
	var kind := key.get_slice(":", 0)
	return kind in ["item", "teaser", "ing"]


## Shows these rows, keeping those that are there already.
func sync(keys: Array) -> void:
	for key: String in _nodes.keys():
		# A heading counts its dishes, so it is made anew.
		if key not in keys or key.begins_with("cat:"):
			var node: Control = _nodes[key]
			if node.get_parent() != null:
				node.get_parent().remove_child(node)
			node.queue_free()
			_nodes.erase(key)
			_rows.erase(key)
	_keys = keys
	_pending = keys.filter(func(key: String) -> bool: return not _nodes.has(key))
	_stale.clear()
	# Build one screenful synchronously (6 dish cards on Menu), and everything on smaller lists.
	var cards_left := 6
	while not _pending.is_empty():
		var next_kind: String = _pending[0].get_slice(":", 0)
		if not at_once and next_kind in ["item", "cat", "teaser"] and cards_left <= 0:
			break
		var k: String = _pending.pop_front()
		_make(k)
		if next_kind in ["item", "teaser"]:
			cards_left -= 1
	_relayout()
	var highest_built := -1
	for i in _keys.size():
		if _nodes.has(_keys[i]):
			highest_built = i
	_can_append = true
	for pk: String in _pending:
		if _keys.find(pk) < highest_built:
			_can_append = false
			break


func _make(key: String) -> void:
	_nodes[key] = _build_node(key)


## Places all built `_nodes` into `_list` in `_keys` order, pairing collapsed Menu/Pantry cards 2-by-2.
func _relayout() -> void:
	for node: Control in _nodes.values():
		var p := node.get_parent()
		if p != null:
			p.remove_child(node)
	for row: Control in _pair_rows:
		if row.get_parent() != null:
			row.get_parent().remove_child(row)
		row.queue_free()
	_pair_rows.clear()
	_open_pair = null
	_open_spacer = null
	for k: String in _keys:
		if not _nodes.has(k):
			continue
		_append_to_list(k)


## O(1) incremental append of one newly built node into the existing 2-column / full-width layout.
func _append_to_list(k: String) -> void:
	var node: Control = _nodes[k]
	if _is_grid_key(k) and not _ledger.expanded_cards.has(k):
		node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		node.size_flags_vertical = Control.SIZE_FILL
		if _open_pair != null and _open_spacer != null:
			_open_pair.remove_child(_open_spacer)
			_open_spacer.queue_free()
			_open_spacer = null
			_open_pair.add_child(node)
			_open_pair = null
		else:
			var pair := HBoxContainer.new()
			pair.add_theme_constant_override("separation", 8)
			pair.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			pair.add_child(node)
			var spacer := Control.new()
			spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
			pair.add_child(spacer)
			_list.add_child(pair)
			_pair_rows.append(pair)
			_open_pair = pair
			_open_spacer = spacer
	else:
		_open_pair = null
		_open_spacer = null
		if _is_grid_key(k):
			node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_list.add_child(node)


## A little of what is left to make or to keep up; whether there is more.
func work(milliseconds: float) -> bool:
	var until := Time.get_ticks_usec() + int(milliseconds * 1000.0)
	var need_relayout := false
	while Time.get_ticks_usec() < until:
		if not _pending.is_empty():
			var key: String = _pending.pop_front()
			_make(key)
			if _can_append:
				_append_to_list(key)
			else:
				need_relayout = true
			if _rows.has(key):
				_update_row(_rows[key])
		elif not _stale.is_empty():
			var key: String = _stale.pop_front()
			if _rows.has(key):
				_update_row(_rows[key])
		else:
			if need_relayout:
				_relayout()
			return false
	if need_relayout:
		_relayout()
	return true


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _money(n: float) -> String:
	return CoreFormat.format_transaction_money(n)


func _build_node(key: String) -> Control:
	var s := _session.state
	var kind := key.get_slice(":", 0)
	var id := key.trim_prefix("%s:" % kind)
	match kind:
		"ugrp":
			var hint: Label = null
			if id == "ops":
				hint = Paper.words(_t("upgrade.group.opsHint"), "tiny", false)
				hint.add_theme_font_size_override("font_size", 10)
				hint.add_theme_color_override("font_color", Paper.INK_LIGHT)
				_ops_hint = hint
			return Paper.section_head(_t("upgrade.group.%s" % id), hint)
		"room-projects":
			return _build_projects_entry()
		"ops-grid":
			return _cards.build_ops_grid()
		"signature-workbench":
			var entry := Paper.button(_t("signature.entry"), "chip", func() -> void: SignatureLab.show_lab(_ui, func() -> void:
				_session.panel_changed("recipe", "signature")
				_ledger.refresh()))
			entry.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			entry.custom_minimum_size = Vector2(0.0, 30.0)
			entry.add_theme_font_size_override("font_size", 11)
			var sb := Paper.cached_box(Color.WHITE, Paper.LINE_A, 2, 12, Vector2(11, 4))
			for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
				entry.add_theme_stylebox_override(st, sb)
			return entry
		"style-prices":
			var note := Paper.words(_t("style.menu.prices"), "small")
			note.add_theme_color_override("font_color", Paper.INK_LIGHT)
			return note
		"pantry":
			return _pantry_intro()
		"variety":
			_variety = Paper.words("", "small")
			_variety.add_theme_color_override("font_color", Paper.INK_LIGHT)
			_bake_all = Paper.button(_t("bake.all"), "chip", func() -> void:
				CoreEconomy.bake_for_forecast(s)
				_ledger.bought("menu", "bake"))
			_bake_all.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			_bake_all.custom_minimum_size = Vector2(0.0, 28.0)
			_bake_all.add_theme_font_size_override("font_size", 11)
			return Paper.col([_variety, _bake_all], 4)
		"cat":
			var chain := CoreData.MENU.filter(func(m: Dictionary) -> bool: return m["category"] == id)
			var owned := chain.filter(func(m: Dictionary) -> bool: return s["items"][m["id"]] > 0.0)
			var cnt: Label = null
			if not _ledger.intro:
				cnt = Paper.words("%d/%d" % [owned.size(), chain.size()], "tiny", false)
				cnt.add_theme_color_override("font_color", Paper.INK_LIGHT)
			return Paper.section_head(_t("cat.%s" % id), cnt)
		"teaser":
			var card := Paper.panel(Paper.cached_box(Color(1.0, 1.0, 1.0, 0.65), Color.TRANSPARENT, 0, 14, Vector2(8, 12)), Color8(0xd9, 0xc6, 0xa6), 1.0, 14.0)
			card.modulate.a = 0.65
			var q := Paper.words("?", "h2", false)
			q.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			q.add_theme_color_override("font_color", Paper.INK_LIGHT)
			var q_box := Paper.panel(Paper.cached_box(Paper.CREAM_A, Color.TRANSPARENT, 0, 22, Vector2(12, 4)))
			q_box.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			q_box.add_child(q)
			var nm := Paper.words("???", "strong")
			nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			var sub := Paper.words(_t("row.teaser"), "tiny")
			sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			var col := Paper.col([q_box, nm, sub], 4)
			col.alignment = BoxContainer.ALIGNMENT_CENTER
			card.add_child(col)
			return card
		"item":
			return _build_item_card(key, id)
		"ing":
			return _build_ing_card(key, id)
		_:
			return _build_upgrade_row(key, id)


func _build_projects_entry() -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(0.0, 38.0)
	var sb := Paper.card_a_box(Paper.LINE_A, Paper.CREAM_A, Vector2(10, 6))
	for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, sb)
	_projects_label = Paper.words("", "strong")
	_projects_label.add_theme_font_override("font", Paper.font(700))
	_projects_label.add_theme_font_size_override("font_size", 12)
	_projects_label.add_theme_color_override("font_color", Paper.INK_A)
	var row := Paper.line([Paper.mark("map", 17.0, Paper.INK_LIGHT), _projects_label, Paper.mark("chevron", 15.0, Paper.INK_LIGHT)], 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pad := Paper.padded(row, 10, 6)
	pad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pad.set_anchors_preset(Control.PRESET_FULL_RECT)
	b.add_child(pad)
	pad.minimum_size_changed.connect(func() -> void: b.custom_minimum_size.y = maxf(38.0, pad.get_combined_minimum_size().y))
	b.pressed.connect(func() -> void:
		Paper._finish_typing(b)
		_ui.open_street())
	return b


func _wire_card_fold(face: Control, key: String, r: Dictionary, relayout_on_toggle: bool = true) -> void:
	face.set_meta("fold", true)
	face.mouse_filter = Control.MOUSE_FILTER_PASS
	var state := {"down": false, "pos": Vector2.ZERO}
	face.gui_input.connect(func(e: InputEvent) -> void:
		if not (e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT):
			return
		if e.pressed:
			state["down"] = true
			state["pos"] = e.global_position
			return
		var dragged: bool = state["down"] and (e.global_position - (state["pos"] as Vector2)).length() > 12.0
		state["down"] = false
		if dragged:
			return
		Paper._finish_typing(face)
		var open: bool = not _ledger.expanded_cards.has(key)
		if open:
			_ledger.expanded_cards[key] = true
		else:
			_ledger.expanded_cards.erase(key)
		r["more"].visible = open
		if r.has("desc"):
			var desc: Label = r["desc"]
			desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART if open else TextServer.AUTOWRAP_OFF
			desc.clip_text = not open
			desc.text_overrun_behavior = TextServer.OVERRUN_NO_TRIMMING if open else TextServer.OVERRUN_TRIM_ELLIPSIS
		if open:
			_update_row(r)
		if relayout_on_toggle:
			_relayout())


func _build_item_card(key: String, id: String) -> Control:
	var s := _session.state
	var r := {"kind": "item", "id": id, "key": key}
	var card := Paper.panel(Paper.card_a_box(Paper.CARD_BORDER, Color.WHITE, Vector2(8, 8)))
	r["card"] = card
	# Card face (clickable fold summary; no buttons inside so run_ui.gd merges text into 1 fold token).
	var pic := Portraits.icon("item:%s" % id, 52.0)
	pic.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var name_lbl := Paper.fitting(I18n.item_name(id), "strong", 112.0)
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_override("font", Paper.font(800))
	name_lbl.add_theme_font_size_override("font_size", 13)
	name_lbl.add_theme_color_override("font_color", Paper.INK_A)
	var name_row := Paper.flow([name_lbl], 4)
	name_row.alignment = FlowContainer.ALIGNMENT_CENTER
	if CoreLocations.is_specialty(s, id):
		var sp := Paper.words(_t("menu.specialty"), "tiny", false)
		sp.add_theme_color_override("font_color", Paper.SAGE_A_DARK)
		name_row.add_child(sp)
	r["level"] = Paper.words("", "tiny", false)
	r["level"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	name_row.add_child(r["level"])
	r["price"] = Paper.words("", "strong", false)
	r["price"].horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	r["price"].add_theme_font_override("font", Paper.font(800))
	r["price"].add_theme_font_size_override("font_size", 16)
	r["price"].add_theme_color_override("font_color", Paper.CARD_PRICE)
	r["bar"] = Paper.progress_a(0.0, 5.0, Paper.HONEY, Paper.TRACK_A)
	r["badgeLabel"] = Paper.words("", "tiny", true)
	r["badgeLabel"].horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	r["badgeLabel"].add_theme_font_override("font", Paper.font(800))
	r["badgeLabel"].add_theme_color_override("font_color", Paper.BADGE_INK)
	r["badge"] = Paper.panel(Paper.cached_box(Paper.BADGE_BG, Color.TRANSPARENT, 0, 8, Vector2(6, 2)))
	r["badge"].size_flags_horizontal = Control.SIZE_EXPAND_FILL
	r["badge"].add_child(r["badgeLabel"])
	r["badge"].visible = false
	var face := Paper.col([pic, name_row, r["price"], Paper.padded(r["bar"], 4, 2, 4, 2), r["badge"]], 2)
	face.size_flags_vertical = Control.SIZE_EXPAND_FILL
	# Collapsible details body (shown full-width when card is expanded).
	r["sub"] = Paper.words("", "small")
	r["sub"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["tradeoff"] = Paper.words("", "small")
	r["tradeoff"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["preview"] = Paper.words("", "good")
	r["preview"].add_theme_font_size_override("font_size", 12)
	r["details"] = Paper.button("", "link", _price_details.bind(r))
	r["details"].size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	r["details"].add_theme_font_size_override("font_size", 12)
	var more_items: Array = [PaperSeam.new(Paper.CARD_BORDER), r["sub"], r["tradeoff"], _recipe(r, id), _taste(r, id)]
	if CoreEconomy.is_bakery(id):
		more_items.append(_bake(r, id))
	more_items.append(r["preview"])
	more_items.append(r["details"])
	var more := Paper.col(more_items, 6)
	more.visible = _ledger.expanded_cards.has(key)
	r["more"] = more
	_wire_card_fold(face, key, r, true)
	# Buy / Upgrade / Unlock pill button at card bottom.
	r["buy"] = Paper.card_buy(_buy.bind(r))
	var body := Paper.col([face, more, r["buy"]], 6)
	card.add_child(body)
	# Overlay child holds top-right circular on-sale checkmark button (40x40 touch target, 26x26 visual circle).
	var overlay := Control.new()
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	overlay.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var toggle := PaperCheckButton.new(_toggle.bind(id))
	toggle.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	toggle.offset_left = -36.0
	toggle.offset_right = 4.0
	toggle.offset_top = -4.0
	toggle.offset_bottom = 36.0
	r["toggle"] = toggle
	overlay.add_child(toggle)
	card.add_child(overlay)
	_rows[key] = r
	return card


func _build_ing_card(key: String, id: String) -> Control:
	var r := {"kind": "ing", "id": id, "key": key}
	var card := Paper.panel(Paper.card_a_box(Paper.CARD_BORDER, Color.WHITE, Vector2(8, 8)))
	r["card"] = card
	var pic := Portraits.icon("ing:%s" % id, 48.0)
	pic.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var name_lbl := Paper.words(UiWords.ingredient(id), "strong")
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_override("font", Paper.font(800))
	name_lbl.add_theme_font_size_override("font_size", 13)
	name_lbl.add_theme_color_override("font_color", Paper.INK_A)
	r["stock"] = Paper.words("", "h2", false)
	r["stock"].horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	r["stock"].add_theme_font_override("font", Paper.font(800))
	r["stock"].add_theme_font_size_override("font_size", 19)
	r["stock"].add_theme_color_override("font_color", Paper.INK_A)
	r["unit"] = Paper.words("", "tiny")
	r["unit"].horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	r["unit"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["bar"] = Paper.progress_a(0.0, 5.0, Paper.HONEY, Paper.TRACK_A)
	var face := Paper.col([pic, name_lbl, r["stock"], r["unit"], Paper.padded(r["bar"], 4, 2, 4, 2)], 2)
	face.size_flags_vertical = Control.SIZE_EXPAND_FILL
	r["need"] = Paper.words("", "strong")
	r["need"].add_theme_font_size_override("font_size", 12)
	r["need"].add_theme_color_override("font_color", Paper.INK_A)
	r["sub"] = Paper.words("", "small")
	r["sub"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["details"] = Paper.button("", "link", _price_details.bind(r))
	r["details"].size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	r["details"].add_theme_font_size_override("font_size", 12)
	var more := Paper.col([PaperSeam.new(Paper.CARD_BORDER), r["need"], r["sub"], r["details"]], 6)
	more.visible = _ledger.expanded_cards.has(key)
	r["more"] = more
	_wire_card_fold(face, key, r, true)
	r["buy"] = Paper.card_buy(_buy.bind(r))
	card.add_child(Paper.col([face, more, r["buy"]], 6))
	_rows[key] = r
	return card


func _build_upgrade_row(key: String, id: String) -> Control:
	var def: Dictionary = CoreEconomy.upgrade_def(id)
	var use_pips: bool = def["max"] <= 6.0
	var expanded: bool = _ledger.expanded_cards.has(key)
	var r := {"kind": "upgrade", "id": id, "key": key}
	var card := Paper.panel(Paper.card_a_box(Paper.CARD_BORDER, Color.WHITE, Vector2(9, 7)))
	r["card"] = card
	# Left icon in cream rounded square.
	var picture := Paper.panel(Paper.cached_box(Color8(0xfb, 0xf0, 0xda), Color.TRANSPARENT, 0, 10, Vector2(3, 3)))
	picture.custom_minimum_size = Vector2(40.0, 40.0)
	picture.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picture.add_child(Portraits.icon("upgrade:%s" % id, 34.0))
	# Middle info column: name + level pill, pips or thin bar, 1-line description.
	var name_lbl := Paper.words(_t("upgrade.%s.name" % id), "strong", false)
	name_lbl.add_theme_font_override("font", Paper.font(800))
	name_lbl.add_theme_font_size_override("font_size", 13)
	name_lbl.add_theme_color_override("font_color", Paper.INK_A)
	name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_lbl.clip_text = true
	name_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	var lv_lbl := Paper.words("", "tiny", false)
	lv_lbl.add_theme_font_override("font", Paper.font(700))
	lv_lbl.add_theme_font_size_override("font_size", 10)
	lv_lbl.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var lv_pill := Paper.panel(Paper.cached_box(Paper.LV_PILL_BG, Color.TRANSPARENT, 0, 7, Vector2(5, 1)))
	lv_pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	lv_pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lv_pill.add_child(lv_lbl)
	r["level"] = lv_lbl
	r["levelPill"] = lv_pill
	var head := Paper.line([name_lbl, lv_pill], 5)
	head.alignment = BoxContainer.ALIGNMENT_CENTER
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var prog: Control
	if use_pips:
		var pips := Paper.PipsBar.new(int(def["max"] + 1.0) if id == "cook" else int(def["max"]))
		r["pips"] = pips
		prog = pips
	else:
		var bar := Paper.progress_a(0.0, 5.0, Paper.SAGE_A, Color8(0xe8, 0xdb, 0xc5))
		r["bar"] = bar
		prog = bar
	var desc := Paper.words(_upgrade_desc(id), "tiny", expanded)
	desc.add_theme_font_size_override("font_size", 11)
	desc.add_theme_color_override("font_color", Paper.INK_LIGHT)
	desc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	desc.clip_text = not expanded
	desc.text_overrun_behavior = TextServer.OVERRUN_NO_TRIMMING if expanded else TextServer.OVERRUN_TRIM_ELLIPSIS
	r["desc"] = desc
	var mid := Paper.col([head, prog, desc], 2)
	mid.alignment = BoxContainer.ALIGNMENT_CENTER
	mid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var face_row := Paper.line([picture, mid], 8)
	face_row.alignment = BoxContainer.ALIGNMENT_CENTER
	face_row.custom_minimum_size.y = 44.0
	face_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var face := Paper.padded(face_row, 0, 0, 84, 0)
	# Collapsible full-width details below face (effects, money details, optional table preview).
	r["sub"] = Paper.words("", "small")
	r["sub"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["details"] = Paper.button("", "link", _price_details.bind(r))
	r["details"].size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	r["details"].add_theme_font_size_override("font_size", 12)
	var more_actions := Paper.flow([r["details"]], 8)
	if id == "tables":
		var tp := Paper.button("", "chip", _preview_table)
		tp.custom_minimum_size = Vector2(0.0, 30.0)
		tp.add_theme_font_size_override("font_size", 11)
		r["tablePreview"] = tp
		more_actions.add_child(tp)
	var more := Paper.col([PaperSeam.new(Paper.CARD_BORDER), r["sub"], more_actions], 6)
	more.visible = expanded
	r["more"] = more
	_wire_card_fold(face, key, r, false)
	card.add_child(Paper.col([face, more], 6))
	# Overlay child holds right-side 2-line buy button OR tilted red-brown MaxStamp (visited after fold/more, matching Web DOM).
	var overlay := Control.new()
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	overlay.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var action_slot := Control.new()
	action_slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	action_slot.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	action_slot.offset_left = -76.0
	action_slot.offset_right = 0.0
	action_slot.offset_top = 0.0
	action_slot.offset_bottom = 44.0
	r["buy"] = Paper.two_line_buy(_buy.bind(r), 76.0)
	r["buy"].set_anchors_preset(Control.PRESET_FULL_RECT)
	r["stamp"] = Paper.MaxStamp.new(_t("btn.maxed"))
	r["stamp"].set_anchors_preset(Control.PRESET_FULL_RECT)
	r["stamp"].visible = false
	action_slot.add_child(r["buy"])
	action_slot.add_child(r["stamp"])
	overlay.add_child(action_slot)
	card.add_child(overlay)
	_rows[key] = r
	return card


func _recipe(r: Dictionary, id: String) -> Control:
	var row := Paper.flow([], 4)
	for part: Array in CoreEconomy.recipe(id):
		row.add_child(Portraits.icon("ing:%s" % part[0], 20.0))
		if part[1] > 1.0:
			row.add_child(Paper.words("×%s" % JsMath.number_to_string(part[1]), "small", false))
	r["recipe"] = row
	r["left"] = Paper.words("", "small", false)
	row.add_child(r["left"])
	return row


func _taste(r: Dictionary, id: String) -> Control:
	r["tasteLabel"] = Paper.words("", "strong")
	r["tasteLabel"].add_theme_font_size_override("font_size", 12)
	r["tasteLabel"].add_theme_color_override("font_color", Paper.SAGE_A_DARK)
	r["tasteProgress"] = Paper.words("", "tiny")
	r["tasteProgress"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	var b := Paper.button("", "selling", func() -> void: TasteDialog.show_taste(_ui.dialogs, _session, id, func() -> void: _ledger.bought("recipe", id)))
	var sb := Paper.cached_box(Paper.SAGE_SOFT, Color8(0xcb, 0xd9, 0xc3), 2, 10, Vector2(10, 5))
	for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, sb)
	var copy := Paper.col([r["tasteLabel"], r["tasteProgress"]], 2)
	var pad := Paper.padded(copy, 10, 6)
	copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pad.set_anchors_preset(Control.PRESET_FULL_RECT)
	b.add_child(pad)
	pad.minimum_size_changed.connect(func() -> void: b.custom_minimum_size.y = maxf(48.0, pad.get_combined_minimum_size().y))
	b.custom_minimum_size.y = 48.0
	r["taste"] = b
	return b


func _bake(r: Dictionary, id: String) -> Control:
	r["bakeLabel"] = Paper.words("", "small", false)
	r["bakeN"] = Paper.words("", "strong", false)
	r["bakeNote"] = Paper.words("", "small", false)
	r["bakeLess"] = Paper.button("−", "chip", _set_bake.bind(id, -CoreData.BAKE_STEP))
	r["bakeMore"] = Paper.button("+", "chip", _set_bake.bind(id, CoreData.BAKE_STEP))
	for btn: Button in [r["bakeLess"], r["bakeMore"]]:
		btn.custom_minimum_size = Vector2(32.0, 32.0)
	r["bake"] = Paper.flow([r["bakeLabel"], r["bakeLess"], r["bakeN"], r["bakeMore"], r["bakeNote"]], 6)
	return r["bake"]


# ---------------------------------------------------------------- what the buttons do

func _toggle(id: String) -> void:
	CoreEconomy.set_on_menu(_session.state, id, id not in _session.state["onMenu"])
	_ledger.bought("menu", id)


func _set_bake(id: String, step: float) -> void:
	CoreEconomy.set_bake_plan(_session.state, id, _session.state["bakePlan"].get(id, 0.0) + step)
	_ledger.bought("menu", id)


func _preview_table() -> void:
	_ledger.table_preview = not _ledger.table_preview
	if _ledger.table_preview:
		_ui.preview_table()
	_ledger.update()


func _buy(r: Dictionary) -> void:
	var s := _session.state
	var id: String = r["id"]
	if r["kind"] == "ing":
		if CoreEconomy.buy_ingredient(s, id, _ledger.pantry_amount()):
			_ledger.bought("ingredient", id)
		return
	var unlocking: bool = r["kind"] == "item" and s["items"][id] == 0.0
	if not (CoreEconomy.buy_item(s, id, _ledger.amount()) if r["kind"] == "item" else CoreEconomy.buy_upgrade(s, id, _ledger.amount())):
		return
	if r["kind"] == "upgrade" and id == "tables":
		_ledger.clear_table_preview()
	_ledger.bought(r["kind"], id)
	if unlocking:
		_ui.dialogs.note(_t("menu.unlockedOff", {"item": I18n.item_name(id, s)}))


func _price_details(r: Dictionary) -> void:
	# The same quote the buying would use now.
	var s := _session.state
	var id: String = r["id"]
	var cost: float = CoreEconomy.ingredient_def(id)["cost"] * _ledger.pantry_amount() if r["kind"] == "ing" else (CoreEconomy.quote_item(s, id, _ledger.amount()) if r["kind"] == "item" else CoreEconomy.quote_upgrade(s, id, _ledger.amount()))["cost"]
	SmallDialogs.money(_ui.dialogs, s["coins"], cost)


# ---------------------------------------------------------------- each time the rules say

func update() -> void:
	var s := _session.state
	if _projects_label != null:
		_projects_label.text = StreetMap.entry_label(s, CoreClock.now())
	if _ops_hint != null:
		_ops_hint.visible = not s["manager"]["hired"]
	_cards.update()
	if _forecast != null:
		_update_pantry()
		return
	_today = CoreEconomy.menu_items(s)
	_average = CoreEconomy.average_dish_price(s, _today) if not _rows.is_empty() else 0.0
	if _bake_all != null:
		_bake_all.visible = s["phase"] == "prep" and _today.any(func(m: Dictionary) -> bool: return CoreEconomy.is_bakery(m["id"]))
	if _variety != null:
		_variety.text = _t("demand.menuSummary" if CoreCustomerDemand.demand_enabled(s) else "menu.variety", {
			"n": float(_today.size()), "pct": JsMath.js_round(CoreEconomy.variety_bonus(s) * 100.0), "price": _money(_average)})
	# First the rows in sight.
	_stale.clear()
	for key: String in _rows:
		if at_once or _rows[key]["kind"] != "item" or _ledger.in_sight(_rows[key]["card"]):
			_update_row(_rows[key])
		else:
			_stale.append(key)


func _update_row(r: Dictionary) -> void:
	match r["kind"]:
		"item": _update_item(r)
		"ing": _update_ing(r, CoreEconomy.day_needs(_session.state))
		"upgrade": _update_upgrade(r)


func _price_at(def: Dictionary, level: float) -> String:
	var s := _session.state
	return _money(CoreEconomy.item_price(def, level) * CoreEconomy.tip_multiplier(s) * CoreEconomy.chain_price_multiplier(s, def["id"]))


func _update_item(r: Dictionary) -> void:
	var s := _session.state
	var id: String = r["id"]
	var def: Dictionary = CoreEconomy.menu_item(id)
	var level: float = s["items"][id]
	var prep: bool = s["phase"] == "prep"
	var q := CoreEconomy.quote_item(s, id, _ledger.amount())
	var eligible := CoreEconomy.can_prepare_item(s, id)
	var bakery := CoreEconomy.is_bakery(id)
	var left := CoreEconomy.servings_left(s, id)
	var display_price := _price_at(def, level) if level > 0.0 else _money(def["basePrice"] * CoreEconomy.tip_multiplier(s))
	Paper.say(r["level"], "Lv %s" % JsMath.number_to_string(level) if level > 0.0 else "")
	r["price"].text = display_price
	var next: Variant = CoreEconomy.next_milestone(level)
	var before := 0.0
	for m: float in CoreData.PRICE_MILESTONES:
		if m <= level:
			before = m
	r["bar"].value = (level - before) / (next - before) if next != null else 1.0
	var badge := ""
	if not eligible:
		badge = _t("menu.requiresKitchen")
	elif level > 0.0 and left < 1.0:
		badge = _t("bake.canBake" if bakery else "menu.left", {"n": CoreFormat.format_number(left)})
	r["badge"].visible = not badge.is_empty()
	if not badge.is_empty():
		r["badgeLabel"].text = badge
	Paper.set_card_buy(r["buy"], _t("btn.unlock") if level == 0.0 else ("+%s" % JsMath.number_to_string(q["count"]) if q["count"] > 1.0 else _t("btn.levelUp")), _money(q["cost"]), q["affordable"])
	var on: bool = eligible and id in s["onMenu"]
	r["card"].modulate.a = 0.65 if (level > 0.0 and not on) else (0.78 if level == 0.0 else 1.0)
	var toggle: PaperCheckButton = r["toggle"]
	toggle.visible = level > 0.0
	toggle.text = _t("menu.on" if on else "menu.off")
	toggle.active = on
	toggle.disabled = not prep or not eligible
	# Details inside the fold only need updating when open.
	if not r["more"].visible:
		return
	r["sub"].visible = eligible
	if eligible:
		r["sub"].text = _t("row.each", {"price": display_price, "time": UiWords.fixed(CoreEconomy.prep_time(s, id), 1), "cost": _money(CoreEconomy.serving_cost(id))}) if level > 0.0 else _t("row.sellsFor", {"price": display_price})
	Paper.say(r["tradeoff"], _tradeoff(s, def, level, eligible, on))
	r["recipe"].visible = eligible
	r["left"].text = _t("bake.canBake" if bakery else "menu.left", {"n": CoreFormat.format_number(left)}) if eligible else ""
	r["left"].add_theme_color_override("font_color", Paper.DANGER if left < 1.0 else Paper.MUTED)
	r["taste"].visible = level > 0.0
	r["tasteLabel"].text = TasteDialog.label(s, id)
	r["tasteProgress"].text = TasteDialog.progress(s, id)
	if r.has("bake"):
		r["bake"].visible = level > 0.0 and on
		r["bakeLess"].visible = prep
		r["bakeMore"].visible = prep
		var short := false
		if prep:
			var plan: float = s["bakePlan"].get(id, 0.0)
			r["bakeLabel"].text = _t("bake.label")
			r["bakeN"].text = JsMath.number_to_string(plan)
			r["bakeNote"].text = _t("bake.suggested", {"n": CoreEconomy.suggested_bake(s, id)})
			short = plan > left
		else:
			var shelf: float = s["shelf"].get(id, 0.0)
			r["bakeLabel"].text = _t("bake.shelf")
			r["bakeN"].text = "%s/%s" % [JsMath.number_to_string(shelf), JsMath.number_to_string(s["today"]["baked"].get(id, 0.0))]
			r["bakeNote"].text = ""
			short = shelf == 0.0
		r["bakeN"].add_theme_color_override("font_color", Paper.DANGER if short else Paper.INK)
	Paper.say(r["preview"], "" if not eligible or (level == 0.0 and q["count"] <= 1.0) else _t("row.afterUpgrade" if level > 0.0 else "row.afterUnlock", {"price": _price_at(def, level + q["count"])}))
	_update_details(r, q["cost"])


## Both demand and price, for a dish that is off the menu: a lower average need not mean lower earnings.
func _tradeoff(s: Dictionary, def: Dictionary, level: float, eligible: bool, on: bool) -> String:
	if not eligible or on or _today.is_empty():
		return ""
	var today := _today
	var before := _average
	var with := today + [def]
	var after := CoreEconomy.average_dish_price(s, with)
	if CoreCustomerDemand.demand_enabled(s):
		var change := JsMath.js_round((CoreEconomy.menu_traffic_multiplier(s, with) * CoreConditions.condition_traffic(s, with) / (CoreEconomy.menu_traffic_multiplier(s, today) * CoreConditions.condition_traffic(s, today)) - 1.0) * 100.0)
		return _t("demand.tradeoff", {"before": _money(before), "after": _money(after), "change": "%s%s%%" % ["+" if change >= 0.0 else "", JsMath.number_to_string(change)]})
	if after >= before - 0.005:
		return ""
	return _t("menu.tradeoffNew" if level == 0.0 else "menu.tradeoff", {"before": _money(before), "after": _money(after)})


func _upgrade_effect(s: Dictionary, id: String) -> String:
	match id:
		"marketing": return _t("effect.marketingCapped" if CoreEconomy.is_traffic_capped(s) else "effect.marketing", {"n": JsMath.js_round(CoreEconomy.arrival_rate(s) * CoreData.DAY_SECONDS)})
		"machine": return _t("effect.machine", {"n": UiWords.fixed(1.0 / CoreEconomy.prep_multiplier(s), 2)})
		"barista": return _t("effect.barista", {"n": CoreEconomy.barista_count(s)})
		"server": return _t("effect.server", {"n": CoreEconomy.server_count(s)})
		"cook": return _t("effect.cookLocked") if CoreEconomy.upgrade_locked(s, id) else _t("effect.cook", {"n": CoreEconomy.cook_count(s)})
		"tables": return _t("effect.tables", {"n": CoreRegions.main_table_count(s)})
	return _t("effect.pass", {"n": CoreEconomy.pass_capacity(s)})


static func _upgrade_desc(id: String) -> String:
	if id == "cook":
		var def: Dictionary = CoreEconomy.upgrade_def(id)
		return _t("upgrade.cook.desc", {"first": _money(def["baseCost"]), "second": _money(def["baseCost"] * def["growth"])})
	return _t("upgrade.%s.desc" % id)


func _update_upgrade(r: Dictionary) -> void:
	var s := _session.state
	var id: String = r["id"]
	var def: Dictionary = CoreEconomy.upgrade_def(id)
	var level: float = s["upgrades"][id]
	var q := CoreEconomy.quote_upgrade(s, id, _ledger.amount())
	# Servers are limited by the rooms opened so far; the card says what opens more.
	var most := CoreEconomy.upgrade_max(s, id)
	var maxed := level >= most
	var lv_text := (_t("upgrade.cook.stage", {"n": level + 1.0, "total": def["max"] + 1.0}) if s["kitchen"] else "") if id == "cook" else ("%s/%s" % [JsMath.number_to_string(level), JsMath.number_to_string(most)])
	r["level"].text = lv_text
	r["levelPill"].visible = not lv_text.is_empty()
	if r.has("pips"):
		var total_pips := int(def["max"] + 1.0) if id == "cook" else int(most)
		var filled_pips := (int(level + 1.0) if s["kitchen"] else 0) if id == "cook" else int(level)
		r["pips"].set_progress(filled_pips, total_pips)
	elif r.has("bar"):
		r["bar"].value = minf(1.0, level / maxf(1.0, most))
	r["buy"].visible = not maxed
	r["stamp"].visible = maxed
	Paper.set_two_line_buy(r["buy"], "+%s" % JsMath.number_to_string(q["count"]) if q["count"] > 1.0 else _t("btn.buy"), _money(q["cost"]), not maxed and q["affordable"])
	# Details inside the fold: update always if open (cheap enough, and ensures table_preview clears if phase changes).
	if r.has("tablePreview"):
		var available: bool = s["phase"] == "prep" and CoreRegions.main_table_count(s) < CoreLayout.MAX_TABLES
		if not available:
			_ledger.table_preview = false
		r["tablePreview"].visible = available
		r["tablePreview"].text = _t("upgrade.tables.hidePreview" if _ledger.table_preview else "upgrade.tables.preview")
	if not r["more"].visible:
		return
	var after := s.duplicate(false)
	after["upgrades"] = s["upgrades"].duplicate()
	after["upgrades"][id] = minf(most, level + q["count"])
	var locked := CoreEconomy.upgrade_locked(s, id)
	var capped_marketing := id == "marketing" and CoreEconomy.is_traffic_capped(s)
	r["sub"].text = "%s%s%s" % [_upgrade_effect(s, id), "" if maxed or locked or capped_marketing else " → %s" % _upgrade_effect(after, id), " · %s" % _t("upgrade.server.roomLimit") if maxed and most < def["max"] else ""]
	_update_details(r, q["cost"], maxed or locked)


func _update_details(r: Dictionary, cost: float, hidden: bool = false) -> void:
	r["details"].visible = not hidden
	var coins: float = _session.state["coins"]
	r["details"].text = _t("money.short", {"money": _money(cost - coins)}) if cost > coins else _t("money.details")


# ---------------------------------------------------------------- the pantry

func _pantry_intro() -> Control:
	_forecast = Paper.words("", "strong")
	_forecast.add_theme_font_size_override("font_size", 13)
	_forecast.add_theme_color_override("font_color", Paper.INK_A)
	_restock = Paper.button("", "primary", func() -> void:
		var bought := Restocking.restock(_session)
		if not bought.is_empty():
			_ui.dialogs.note(_t("prep.bought", {"items": bought}))
			_ledger.bought("ingredient", "restock"))
	_restock.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_restock.custom_minimum_size.y = 40.0
	_restock_reason = Paper.words("", "small")
	_restock_reason.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var note := Paper.words(_t("guide.pantryIntro" if _ledger.intro else "pantry.intro"), "small")
	note.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var help := Paper.help_fold(_t("pantry.noteLabel"), note, _ledger.pantry_help_open, func(open: bool) -> void: _ledger.pantry_help_open = open)
	return Paper.col([_forecast, _restock, _restock_reason, help], 6)


func _update_pantry() -> void:
	var s := _session.state
	var needs := CoreEconomy.day_needs(s)
	var quote := CoreEconomy.restock_quote(s)
	var plan := CoreEconomy.restock_plan(s)
	_forecast.text = _t("pantry.forecast", {"n": CoreFormat.format_number(CoreEconomy.expected_customers(s))}) + (" · %s" % _t("prep.partial", {"money": _money(s["coins"])}) if quote["cost"] > s["coins"] else "")
	var full: bool = quote["cost"] <= 0.0
	_restock.text = _t("pantry.full") if full else _t("pantry.budgetRestock" if plan["missingCost"] > 0.0 else "pantry.restock", {"price": _money(plan["cost"])})
	_restock.disabled = full or plan["cost"] <= 0.0
	Paper.say(_restock_reason, "" if full else Restocking.reason(plan))
	for r: Dictionary in _rows.values():
		_update_ing(r, needs)


func _update_ing(r: Dictionary, needs: Dictionary) -> void:
	var s := _session.state
	var id: String = r["id"]
	var def: Dictionary = CoreEconomy.ingredient_def(id)
	var stock: float = s["pantry"][id]
	var need: float = needs.get(id, 0.0)
	var cost: float = def["cost"] * _ledger.pantry_amount()
	var low: bool = need > 0.0 and stock < need
	var focus: bool = _ledger.shortfall(id)
	r["stock"].text = CoreFormat.format_number(stock)
	r["stock"].add_theme_color_override("font_color", Paper.BADGE_INK if low else Paper.INK_A)
	r["unit"].text = "%s · %s" % [_t("pantry.stockLabel"), _t("pantry.unitPrice", {"price": _money(def["cost"])})]
	r["bar"].value = minf(1.0, stock / need) if need > 0.0 else 1.0
	var low_now: bool = low
	if r.get("_bar_low") != low_now:
		r["_bar_low"] = low_now
		var fill_col := Color8(0xc9, 0x5d, 0x4c) if low_now else Paper.HONEY
		r["bar"].add_theme_stylebox_override("fill", Paper.cached_box(fill_col, Color.TRANSPARENT, 0, 2.5, Vector2.ZERO))
	Paper.set_card_buy(r["buy"], _t("pantry.buy", {"n": _ledger.pantry_amount()}), _money(cost), cost <= s["coins"])
	var border_key := 2 if focus else (1 if low_now else 0)
	if r.get("_border_key") != border_key:
		r["_border_key"] = border_key
		var border := Paper.DANGER if focus else (Paper.ROSE_A if low_now else Paper.CARD_BORDER)
		var fill := Color8(0xff, 0xf6, 0xf3) if focus else Color.WHITE
		r["card"].add_theme_stylebox_override("panel", Paper.card_a_box(border, fill, Vector2(8, 8)))
	if not r["more"].visible:
		return
	r["need"].text = _t("pantry.need", {"n": CoreFormat.format_number(need)})
	var names := CoreEconomy.used_by(s, id).map(func(m: Dictionary) -> String: return I18n.item_name(m["id"]))
	r["sub"].text = _t("pantry.usedBy", {"items": UiWords.join(names)})
	_update_details(r, cost)
