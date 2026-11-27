class_name LedgerDecor
extends RefCounted

## Furnishing the café (src/ui/panel.ts): Direction A lavender comfort card, category chips with counts +
## floor/wall spot readout, collapsible help fold, 3-column compact item cards, and sticky wooden arrange button.

const ACTIVE_CHIP_BG := Color8(0xe5, 0xdc, 0xf3)
const ACTIVE_CHIP_EDGE := Color8(0xbf, 0xb0, 0xd8)

var _ledger: CafeLedger
var _ui: CafeUi
var _session: CoreGameSession
var _category: String
var _comfort_val := Paper.words("", "h1", false)
var _comfort_tip := Paper.words("", "strong", false)
var _cat_btns: Dictionary = {}
var _spots_box: VBoxContainer = null
var _spots_floor: Label = null
var _spots_wall: Label = null
var _spots: Label = null
var _tiles: Dictionary = {}
var _notes: Dictionary = {}


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func name(id: String) -> String:
	return _t("decor.%s" % id)


func _catalog(category: String) -> Array:
	var s := _session.state
	# Chain rewards appear once the chain has given them.
	var items := CoreFurniture.FURNITURE.filter(func(d: Dictionary) -> bool: return d["category"] == category and (not d.get("reward", false) or CoreFurniture.stored_count(s, d["id"]) + CoreFurniture.placed_count(s, d["id"]) > 0.0))
	return JsUtil.stable_sort(items, func(a: Dictionary, b: Dictionary) -> float: return a["cost"] - b["cost"])


func _init(list: VBoxContainer, ledger: CafeLedger, ui: CafeUi, category: String) -> void:
	_ledger = ledger
	_ui = ui
	_session = ui.session
	_category = category
	# Top lavender comfort card (comfort value + tip %; linear, no next-tier bar).
	_comfort_val.add_theme_font_override("font", Paper.font(800))
	_comfort_val.add_theme_font_size_override("font_size", 26)
	_comfort_val.add_theme_color_override("font_color", Paper.LAVENDER_INK)
	var comfort_lbl := Paper.words(_t("decor.comfortLabel"), "small", false)
	comfort_lbl.add_theme_font_override("font", Paper.font(700))
	comfort_lbl.add_theme_color_override("font_color", Paper.LAVENDER_INK)
	var left := Paper.line([_comfort_val, comfort_lbl], 6)
	left.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	left.alignment = BoxContainer.ALIGNMENT_CENTER
	_comfort_tip.add_theme_font_override("font", Paper.font(800))
	_comfort_tip.add_theme_font_size_override("font_size", 17)
	_comfort_tip.add_theme_color_override("font_color", Paper.CARD_PRICE)
	_comfort_tip.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	var tip_lbl := Paper.words(_t("decor.tipLabel"), "tiny", false)
	tip_lbl.add_theme_color_override("font_color", Paper.INK_LIGHT)
	tip_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	var right := Paper.col([_comfort_tip, tip_lbl], 1)
	right.size_flags_horizontal = Control.SIZE_SHRINK_END
	var comfort_row := Paper.line([left, Paper.spring(), right], 8)
	comfort_row.alignment = BoxContainer.ALIGNMENT_CENTER
	var comfort_card := Paper.panel(Paper.cached_box(Paper.LAVENDER_BG, Paper.LAVENDER_EDGE, 2, 14, Vector2(14, 10)))
	comfort_card.add_child(comfort_row)
	list.add_child(comfort_card)

	# Category filter chips + compact 2-line floor/wall spot readout on the right.
	var filters := Paper.flow([], 4)
	filters.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for id: String in ["decoration", "furniture", "renovation"]:
		var text := _t("decor.category.%s" % id) if id == "renovation" else "%s %d" % [_t("decor.category.%s" % id), _catalog(id).size()]
		var b := Paper.button(text, "chip", ledger.choose_decor.bind(id))
		Paper.style_filter_chip_tinted(b, id == category, ACTIVE_CHIP_BG, ACTIVE_CHIP_EDGE)
		if id != "renovation":
			_cat_btns[id] = b
		filters.add_child(b)
	var bar_children: Array = [filters]
	if category != "renovation":
		_spots_floor = Paper.words("", "tiny", false)
		_spots_floor.add_theme_font_size_override("font_size", 10)
		_spots_floor.add_theme_color_override("font_color", Paper.INK_LIGHT)
		_spots_wall = Paper.words("", "tiny", false)
		_spots_wall.add_theme_font_size_override("font_size", 10)
		_spots_wall.add_theme_color_override("font_color", Paper.INK_LIGHT)
		var f_row := Paper.line([Paper.mark("ground", 12.0, Paper.INK_LIGHT), _spots_floor], 3)
		f_row.size_flags_horizontal = Control.SIZE_SHRINK_END
		f_row.alignment = BoxContainer.ALIGNMENT_CENTER
		var w_row := Paper.line([Paper.mark("wallframe", 12.0, Paper.INK_LIGHT), _spots_wall], 3)
		w_row.size_flags_horizontal = Control.SIZE_SHRINK_END
		w_row.alignment = BoxContainer.ALIGNMENT_CENTER
		_spots_box = Paper.col([f_row, w_row], 1)
		_spots_box.size_flags_horizontal = Control.SIZE_SHRINK_END
		_spots_box.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		_spots_box.visible = false
		bar_children.append(_spots_box)
	var bar := Paper.line(bar_children, 6)
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	list.add_child(bar)

	# Collapsible help disclosure matching pantry-help.
	var intro_key := "decor.decorationIntro" if category == "decoration" else ("furn.intro" if category == "furniture" else "decor.intro")
	var intro_lbl := Paper.words(_t(intro_key), "small")
	intro_lbl.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var help_children: Array = [intro_lbl]
	if category != "renovation":
		_spots = Paper.words("", "small")
		_spots.add_theme_color_override("font_color", Paper.INK_LIGHT)
		_spots.visible = false
		help_children.append(_spots)
	var help := Paper.help_fold(_t("pantry.noteLabel"), Paper.col(help_children, 4), ledger.decor_help_open, func(open: bool) -> void: ledger.decor_help_open = open)
	list.add_child(help)

	if category == "renovation":
		_ledger.set_footer(null)
		_build_rooms(list)
	else:
		_build_catalog(list)
		_ledger.set_footer(Paper.padded(Paper.wood_button(_t("furn.arrange"), "brush", _ui.arrange_browse), 0, 4, 0, 0))


func _build_catalog(list: VBoxContainer) -> void:
	var s := _session.state
	var catalog := _catalog(_category)
	var grid := Paper.grid(3, [], 6)
	list.add_child(grid)
	for def: Dictionary in catalog:
		var id: String = def["id"]
		var parts := PackedStringArray([_t("furn.surface.%s" % def["surface"])])
		if not s["decor"].get("building", false):
			parts.append("%s×%s" % [JsMath.number_to_string(def["w"]), JsMath.number_to_string(def["h"])])
		if def["comfort"] > 0.0:
			parts.append(_t("decor.comfort", {"n": def["comfort"]}))
		var meta := _centred(" · ".join(parts), "tiny")
		meta.add_theme_font_size_override("font_size", 10)
		meta.add_theme_color_override("font_color", Paper.INK_LIGHT)
		var count_lbl := _centred("", "tiny")
		count_lbl.add_theme_font_override("font", Paper.font(800))
		count_lbl.add_theme_font_size_override("font_size", 10)
		count_lbl.add_theme_color_override("font_color", Paper.CARD_PRICE)
		var count_pill := Paper.panel(Paper.cached_box(Color8(0xe8, 0xf2, 0xe2), Color.TRANSPARENT, 0, 6, Vector2(4, 1)))
		count_pill.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		count_pill.add_child(count_lbl)
		count_pill.visible = false
		var place := Paper.coin_action_btn(func() -> void:
			_ui.arrange_place(id)
			_ledger.update(), 26.0)
		Paper.set_coin_action(place, _t("furn.goPlace"), false, true, true)
		var buy := Paper.coin_action_btn(func() -> void:
			if CoreFurniture.buy_furniture(s, id):
				_session.panel_changed("decor", id)
				_ui.arrange_place(id)
				_ledger.update(), 26.0)
		var tile := _dc_tile(Portraits.icon("furniture:%s" % id, 52.0), [_dc_name(name(id)), meta, count_pill, Paper.spring(), place, buy])
		grid.add_child(tile)
		_tiles[id] = {"tile": tile, "buy": buy, "place": place, "count": count_lbl, "countPill": count_pill}


func _build_rooms(list: VBoxContainer) -> void:
	var s := _session.state
	for slot: String in CoreDecor.DECOR_SLOTS:
		var note := Paper.words("", "tiny", false)
		note.add_theme_color_override("font_color", Paper.INK_LIGHT)
		_notes[slot] = note
		list.add_child(Paper.section_head(_t("slot.%s" % slot), null, note))
		var grid := Paper.grid(3, [], 6)
		list.add_child(grid)
		for def: Dictionary in CoreDecor.decor_for_slot(slot):
			var id: String = def["id"]
			var use := Paper.coin_action_btn(func() -> void:
				if CoreDecor.use_decor(s, id):
					_ledger.bought("decor", id), 26.0)
			var parts: Array = [_dc_name(name(id))]
			if def["comfort"] > 0.0:
				var meta := _centred(_t("decor.comfort", {"n": def["comfort"]}), "tiny")
				meta.add_theme_font_size_override("font_size", 10)
				meta.add_theme_color_override("font_color", Paper.INK_LIGHT)
				parts.append(meta)
			parts.append(Paper.spring())
			parts.append(use)
			var tile := _dc_tile(Portraits.icon("decor:%s" % id, 48.0), parts)
			grid.add_child(tile)
			_tiles[id] = {"tile": tile, "use": use, "slot": slot, "cost": def["cost"]}


static func _dc_name(text: String) -> Label:
	var l := _centred(text, "strong")
	l.add_theme_font_override("font", Paper.font(800))
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", Paper.INK_A)
	return l


static func _centred(text: String, kind: String) -> Label:
	var l := Paper.words(text, kind)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


static func _dc_tile(picture: Control, children: Array) -> PanelContainer:
	var tile := Paper.panel(Paper.card_a_box(Paper.CARD_BORDER, Color.WHITE, Vector2(5, 6)))
	tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	picture.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var inside := Paper.col([picture] + children, 3)
	for c: Control in children:
		if not c is Label and not c is Button and not c is PanelContainer:
			c.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tile.add_child(inside)
	return tile


static func _mark(tile: PanelContainer, on: bool) -> void:
	if tile.get_meta("on", false) != on:
		tile.set_meta("on", on)
		var border := Paper.PLACED_EDGE if on else Paper.CARD_BORDER
		var fill := Paper.PLACED_BG if on else Color.WHITE
		tile.add_theme_stylebox_override("panel", Paper.card_a_box(border, fill, Vector2(5, 6)))


func update() -> void:
	var s := _session.state
	_comfort_val.text = JsMath.number_to_string(CoreDecor.comfort(s))
	_comfort_tip.text = "+%s%%" % JsMath.number_to_string(JsMath.js_round((CoreEconomy.tip_multiplier(s) - 1.0) * 100.0))
	for cat: String in _cat_btns:
		var text := "%s %d" % [_t("decor.category.%s" % cat), _catalog(cat).size()]
		if _cat_btns[cat].text != text:
			_cat_btns[cat].text = text
	for slot: String in _notes:
		_notes[slot].text = name(s["decor"]["equipped"][slot])
	for id: String in _tiles:
		var refs: Dictionary = _tiles[id]
		if refs.has("use"):
			var equipped: bool = s["decor"]["equipped"][refs["slot"]] == id
			var owned := CoreDecor.owns_decor(s, id)
			_mark(refs["tile"], equipped)
			var text := _t("decor.inUse") if equipped else (_t("decor.use") if owned else UiWords.money(refs["cost"]))
			Paper.set_coin_action(refs["use"], text, not equipped and not owned, not equipped and (owned or s["coins"] >= refs["cost"]), owned and not equipped)
			continue
		var placed := CoreFurniture.placed_count(s, id)
		var stored := CoreFurniture.stored_count(s, id)
		var cost: float = CoreFurniture.furniture_def(id)["cost"]
		var count_text := ""
		if placed > 0.0:
			count_text = "✓ %s" % (_t("furn.count", {"placed": placed, "stored": stored}) if stored > 0.0 else _t("furn.out", {"n": placed}))
		elif stored > 0.0:
			count_text = _t("furn.count", {"placed": placed, "stored": stored})
		refs["count"].text = count_text
		refs["countPill"].visible = not count_text.is_empty()
		# Starter pieces can't be bought again, only moved.
		refs["buy"].visible = cost != 0.0
		if cost != 0.0:
			Paper.set_coin_action(refs["buy"], _t("furn.buy", {"price": UiWords.money(cost)}), true, s["coins"] >= cost, false)
		refs["place"].visible = stored > 0.0
		_mark(refs["tile"], placed > 0.0)
	if _category != "renovation":
		_update_spots(s)


## In the building there are so many spots on each surface, more with every storey.
func _update_spots(s: Dictionary) -> void:
	var show_spots: bool = bool(s["decor"].get("building", false))
	if _spots_box != null:
		_spots_box.visible = show_spots
	if _spots != null:
		_spots.visible = show_spots
	if not show_spots:
		return
	var built := CoreFurniture.built_spots(s)
	var used := {"floor": 0.0, "wall": 0.0}
	for p: Dictionary in s["decor"]["placed"]:
		if p.has("spot") and p["spot"] is String:
			var def: Variant = CoreFurniture.furniture_def(p["id"])
			if def is Dictionary and used.has(def["surface"]):
				used[def["surface"]] += 1.0
	var total := {"floor": 0.0, "wall": 0.0}
	for spot: Dictionary in built:
		if total.has(spot["surface"]):
			total[spot["surface"]] += 1.0
	_spots_floor.text = _t("furn.spotsFloor", {"used": used["floor"], "total": total["floor"]})
	_spots_wall.text = _t("furn.spotsWall", {"used": used["wall"], "total": total["wall"]})
	_spots.text = _t("furn.spots", {"floorUsed": used["floor"], "floor": total["floor"], "wallUsed": used["wall"], "wall": total["wall"]}) + (_t("furn.spotsMore") if built.size() < CoreBuildingSpots.BUILDING_SPOTS.size() else "")
