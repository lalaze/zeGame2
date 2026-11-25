class_name MenuPanel
extends Control

## Paper-journal Menu management drawer (scrollable list of menu items).
## Shows icon, localized name, level, price, stock availability, on-menu toggle,
## Unlock/Level-Up button, and TS-faithful dynamic ingredient restock.
## Strictly NEVER refreshes while closed (`visible == false`).

signal closed()
signal menu_changed()

var data: GameData
var state: CafeState

var _backdrop: ColorRect
var _margin: MarginContainer
var _sheet: PanelContainer
var _title_lbl: Label
var _pantry_lbl: Label
var _restock_btn: Button
var _close_btn: Button
var _lock_note: Label
var _list_box: VBoxContainer
var _scroll: ScrollContainer

var _rows: Dictionary = {} # item_id -> Dictionary of child controls
var _icon_cache: Dictionary = {}
var _refresh_count: int = 0


func setup(game_data: GameData, cafe_state: CafeState, paper_theme: Theme) -> void:
	data = game_data
	state = cafe_state
	theme = paper_theme
	visible = false
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

	_backdrop = ColorRect.new()
	_backdrop.color = Color(0.17, 0.12, 0.09, 0.45)
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT and ev.pressed:
			close_panel()
	)
	add_child(_backdrop)

	_margin = MarginContainer.new()
	_margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	_margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_safe_margins(12.0, 12.0, 12.0, 14.0)
	add_child(_margin)

	_sheet = PanelContainer.new()
	_sheet.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_sheet.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_sheet.mouse_filter = Control.MOUSE_FILTER_STOP
	_margin.add_child(_sheet)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	_sheet.add_child(vbox)

	# Header
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	vbox.add_child(header)

	_title_lbl = Label.new()
	_title_lbl.add_theme_font_size_override("font_size", 20)
	_title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title_lbl.clip_text = true
	_title_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	header.add_child(_title_lbl)

	_close_btn = Button.new()
	_close_btn.custom_minimum_size = Vector2(64, 38)
	_close_btn.add_theme_font_size_override("font_size", 13)
	_close_btn.pressed.connect(close_panel)
	header.add_child(_close_btn)

	# Pantry status bar + TS-rule restock button stacked so long English copy & prices never overflow narrow screens.
	var pantry_box := VBoxContainer.new()
	pantry_box.add_theme_constant_override("separation", 6)
	vbox.add_child(pantry_box)

	_pantry_lbl = Label.new()
	_pantry_lbl.add_theme_font_size_override("font_size", 12)
	_pantry_lbl.add_theme_color_override("font_color", theme.get_color("muted", "Cafe"))
	_pantry_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_pantry_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	pantry_box.add_child(_pantry_lbl)

	_restock_btn = Button.new()
	_restock_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_restock_btn.custom_minimum_size = Vector2(0, 36)
	_restock_btn.add_theme_font_size_override("font_size", 13)
	_restock_btn.pressed.connect(_on_restock_pressed)
	pantry_box.add_child(_restock_btn)

	_lock_note = Label.new()
	_lock_note.add_theme_font_size_override("font_size", 12)
	_lock_note.add_theme_color_override("font_color", theme.get_color("danger", "Cafe"))
	_lock_note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_lock_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_lock_note.visible = false
	vbox.add_child(_lock_note)

	var sep := HSeparator.new()
	vbox.add_child(sep)

	_scroll = ScrollContainer.new()
	_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.scroll_deadzone = 8
	vbox.add_child(_scroll)

	_list_box = VBoxContainer.new()
	_list_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list_box.mouse_filter = Control.MOUSE_FILTER_PASS
	_list_box.add_theme_constant_override("separation", 8)
	_scroll.add_child(_list_box)

	_build_rows()


func set_safe_margins(left: float, top: float, right: float, bottom: float) -> void:
	if _margin == null:
		return
	_margin.add_theme_constant_override("margin_left", int(roundf(maxf(10.0, left))))
	_margin.add_theme_constant_override("margin_right", int(roundf(maxf(10.0, right))))
	_margin.add_theme_constant_override("margin_top", int(roundf(maxf(12.0, top))))
	_margin.add_theme_constant_override("margin_bottom", int(roundf(maxf(12.0, bottom))))


func _build_rows() -> void:
	# Show all drink items (B0 has no kitchen) so player can scroll, unlock, toggle, and upgrade.
	var paper := theme.get_color("paper", "Cafe")
	var paper_light := theme.get_color("paper_light", "Cafe")
	var line := theme.get_color("line", "Cafe")
	var soft_line := theme.get_color("soft_line", "Cafe")
	var muted := theme.get_color("muted", "Cafe")
	var sage := theme.get_color("sage", "Cafe")
	var sage_dark := theme.get_color("sage_dark", "Cafe")
	var sage_soft := theme.get_color("sage_soft", "Cafe")

	var row_box_style := GameData._box(paper_light, soft_line, 2, 12, 8, 8)
	var sage_btn_style := GameData._box(sage, sage_dark, 2, 10, 7, 5)
	var on_btn_style := GameData._box(sage_soft, sage, 2, 10, 6, 5)
	var off_btn_style := GameData._box(paper, line, 2, 10, 6, 5)

	for m in data.menu_list:
		if bool(m.get("requiresKitchen", false)):
			continue
		var item_id: String = m["id"]
		var card := PanelContainer.new()
		card.add_theme_stylebox_override("panel", row_box_style)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		# PASS allows ScrollContainer to receive touch drags started anywhere on a card.
		card.mouse_filter = Control.MOUSE_FILTER_PASS
		_list_box.add_child(card)

		var hbox := HBoxContainer.new()
		hbox.add_theme_constant_override("separation", 6)
		hbox.mouse_filter = Control.MOUSE_FILTER_PASS
		card.add_child(hbox)

		var icon_rect := TextureRect.new()
		icon_rect.custom_minimum_size = Vector2(40, 40)
		icon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon_rect.mouse_filter = Control.MOUSE_FILTER_PASS
		icon_rect.texture = _load_item_icon(item_id)
		hbox.add_child(icon_rect)

		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.add_theme_constant_override("separation", 2)
		info.mouse_filter = Control.MOUSE_FILTER_PASS
		hbox.add_child(info)

		var name_lbl := Label.new()
		name_lbl.add_theme_font_size_override("font_size", 14)
		name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		name_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		info.add_child(name_lbl)

		var meta_lbl := Label.new()
		meta_lbl.add_theme_font_size_override("font_size", 11)
		meta_lbl.add_theme_color_override("font_color", muted)
		meta_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		meta_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		meta_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		info.add_child(meta_lbl)

		var stock_lbl := Label.new()
		stock_lbl.add_theme_font_size_override("font_size", 11)
		stock_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		stock_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		stock_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		info.add_child(stock_lbl)

		var actions := VBoxContainer.new()
		actions.add_theme_constant_override("separation", 4)
		actions.alignment = BoxContainer.ALIGNMENT_CENTER
		actions.size_flags_horizontal = Control.SIZE_SHRINK_END
		actions.mouse_filter = Control.MOUSE_FILTER_PASS
		hbox.add_child(actions)

		var toggle_btn := Button.new()
		toggle_btn.custom_minimum_size = Vector2(68, 30)
		toggle_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		toggle_btn.add_theme_font_size_override("font_size", 12)
		toggle_btn.mouse_filter = Control.MOUSE_FILTER_PASS
		toggle_btn.pressed.connect(_on_toggle_item.bind(item_id))
		actions.add_child(toggle_btn)

		var buy_btn := Button.new()
		buy_btn.custom_minimum_size = Vector2(68, 32)
		buy_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		buy_btn.add_theme_font_size_override("font_size", 12)
		buy_btn.mouse_filter = Control.MOUSE_FILTER_PASS
		buy_btn.add_theme_stylebox_override("normal", sage_btn_style)
		buy_btn.add_theme_stylebox_override("hover", sage_btn_style)
		buy_btn.add_theme_color_override("font_color", paper_light)
		buy_btn.add_theme_color_override("font_hover_color", paper_light)
		buy_btn.add_theme_color_override("font_pressed_color", paper_light)
		buy_btn.pressed.connect(_on_buy_item.bind(item_id))
		actions.add_child(buy_btn)

		_rows[item_id] = {
			"card": card,
			"icon": icon_rect,
			"name": name_lbl,
			"meta": meta_lbl,
			"stock": stock_lbl,
			"toggle": toggle_btn,
			"buy": buy_btn,
			"on_style": on_btn_style,
			"off_style": off_btn_style,
		}


func _load_item_icon(item_id: String) -> Texture2D:
	if _icon_cache.has(item_id):
		return _icon_cache[item_id]
	var path := "res://art/full/icons/item-%s.webp" % item_id
	var t: Texture2D = load(path)
	if t != null:
		_icon_cache[item_id] = t
	return t


func open_panel() -> void:
	visible = true
	refresh_if_open()


func close_panel() -> void:
	if not visible:
		return
	visible = false
	closed.emit()


## Strictly no-op while panel is closed.
func refresh_if_open() -> void:
	if not visible:
		return
	_refresh_count += 1
	var loc := state.locale
	_title_lbl.text = data.t(loc, "tab.menu")
	_close_btn.text = data.t(loc, "panel.collapse")

	var needed := state.needed_ingredients()
	var parts: Array[String] = []
	for ing in needed:
		var ing_id: String = str(ing["id"])
		var ing_name := data.t(loc, "ing.%s" % ing_id)
		parts.append("%s %d" % [ing_name, int(state.pantry.get(ing_id, 0))])
	_pantry_lbl.text = data.t(loc, "b0.pantryPrefix") + " · ".join(parts)

	var plan := state.restock_plan()
	var quote_cost := float(plan["quote_cost"])
	var plan_cost := float(plan["cost"])
	var missing_cost := float(plan["missing_cost"])
	var is_full := quote_cost <= 0.0
	if is_full:
		_restock_btn.text = data.t(loc, "pantry.full")
		_restock_btn.disabled = true
	elif plan_cost > 0.0:
		var key := "prep.budgetAction" if missing_cost > 0.0 else "prep.restockAction"
		_restock_btn.text = data.t(loc, key, {"price": data.format_money(plan_cost)})
		_restock_btn.disabled = (state.phase != "prep")
	else:
		_restock_btn.text = data.t(loc, "prep.restockAction", {"price": data.format_money(quote_cost)})
		_restock_btn.disabled = true

	_lock_note.text = data.t(loc, "menu.lockedOpen")
	_lock_note.visible = (state.phase != "prep")

	var sage_dark := theme.get_color("sage_dark", "Cafe")
	var danger := theme.get_color("danger", "Cafe")
	var ink := theme.get_color("ink", "Cafe")

	for item_id in _rows.keys():
		var r: Dictionary = _rows[item_id]
		var lv := int(state.items.get(item_id, 0))
		var avail := state.is_item_available(item_id)
		var name_lbl: Label = r["name"]
		var meta_lbl: Label = r["meta"]
		var stock_lbl: Label = r["stock"]
		var toggle_btn: Button = r["toggle"]
		var buy_btn: Button = r["buy"]

		var item_title := data.t(loc, "item.%s" % item_id)
		if lv > 0:
			name_lbl.text = "%s  %s" % [item_title, data.t(loc, "b0.level", {"n": lv})]
		else:
			name_lbl.text = item_title

		var display_lv := maxi(1, lv)
		var price := state.item_price(item_id, display_lv)
		var ing_cost := state.serving_cost(item_id)
		var prep := state.prep_time(item_id)
		meta_lbl.text = data.t(loc, "row.each", {
			"price": data.format_money(price),
			"cost": data.format_money(ing_cost),
			"time": str(snappedf(prep, 0.1)),
		})

		var servings := state.servings_left(item_id)
		if servings > 0:
			stock_lbl.text = data.t(loc, "b0.stockOk", {"n": servings})
			stock_lbl.add_theme_color_override("font_color", sage_dark)
		else:
			stock_lbl.text = data.t(loc, "b0.stockOut")
			stock_lbl.add_theme_color_override("font_color", danger)

		var is_on := state.on_menu.has(item_id)
		toggle_btn.visible = lv > 0
		toggle_btn.disabled = (state.phase != "prep")
		toggle_btn.text = data.t(loc, "menu.on" if is_on else "menu.off")
		if is_on:
			toggle_btn.add_theme_stylebox_override("normal", r["on_style"])
			toggle_btn.add_theme_color_override("font_color", sage_dark)
		else:
			toggle_btn.add_theme_stylebox_override("normal", r["off_style"])
			toggle_btn.add_theme_color_override("font_color", ink)

		var q := state.quote_item(item_id, 1)
		if not avail:
			buy_btn.text = data.t(loc, "b0.locked")
			buy_btn.disabled = true
		else:
			var verb := data.t(loc, "btn.levelUp" if lv > 0 else "btn.unlock")
			buy_btn.text = "%s %s" % [verb, data.format_money(float(q["cost"]))]
			buy_btn.disabled = not bool(q["affordable"])


func get_refresh_count() -> int:
	return _refresh_count


func snapshot_control_texts() -> Dictionary:
	var snap: Dictionary = {
		"title": _title_lbl.text,
		"close": _close_btn.text,
		"pantry": _pantry_lbl.text,
		"restock": _restock_btn.text,
		"restock_disabled": _restock_btn.disabled,
		"lock_note": _lock_note.text,
		"lock_visible": _lock_note.visible,
		"rows": {},
	}
	for item_id in _rows.keys():
		var r: Dictionary = _rows[item_id]
		snap["rows"][item_id] = {
			"name": (r["name"] as Label).text,
			"meta": (r["meta"] as Label).text,
			"stock": (r["stock"] as Label).text,
			"toggle": (r["toggle"] as Button).text,
			"buy": (r["buy"] as Button).text,
		}
	return snap


func _on_toggle_item(item_id: String) -> void:
	var is_on := state.on_menu.has(item_id)
	if state.set_on_menu(item_id, not is_on):
		refresh_if_open()
		menu_changed.emit()


func _on_buy_item(item_id: String) -> void:
	if state.buy_item(item_id, 1):
		refresh_if_open()
		menu_changed.emit()


func _on_restock_pressed() -> void:
	if state.phase != "prep":
		return
	if state.restock():
		refresh_if_open()
		menu_changed.emit()
