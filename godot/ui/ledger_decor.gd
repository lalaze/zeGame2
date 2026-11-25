class_name LedgerDecor
extends RefCounted

## Furnishing the café (src/ui/panel.ts): decorations and furniture to buy and place, and the rooms' finishes.

var _ledger: CafeLedger
var _ui: CafeUi
var _session: CoreGameSession
var _category: String
var _comfort := Paper.words("", "name")
var _spots := Paper.words("", "muted")
var _tiles: Dictionary = {}
var _notes: Dictionary = {}


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func name(id: String) -> String:
	return _t("decor.%s" % id)


func _init(list: VBoxContainer, ledger: CafeLedger, ui: CafeUi, category: String) -> void:
	_ledger = ledger
	_ui = ui
	_session = ui.session
	_category = category
	list.add_child(_comfort)
	if category == "renovation":
		_spots.free()
	var filters := Paper.line([], 8)
	for id: String in ["decoration", "furniture", "renovation"]:
		var b := Paper.button(_t("decor.category.%s" % id), "on" if id == category else "chip", ledger.choose_decor.bind(id))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		filters.add_child(b)
	list.add_child(filters)
	if category == "renovation":
		_build_rooms(list)
	else:
		_build_catalog(list)


static func _heading(text: String, aside: Label) -> Control:
	return Paper.col([Paper.line([Paper.words(text, "h3"), aside]), Paper.seam()], 4)


func _build_catalog(list: VBoxContainer) -> void:
	var s := _session.state
	# Chain rewards appear once the chain has given them.
	var catalog := CoreFurniture.FURNITURE.filter(func(d: Dictionary) -> bool: return d["category"] == _category and (not d.get("reward", false) or CoreFurniture.stored_count(s, d["id"]) + CoreFurniture.placed_count(s, d["id"]) > 0.0))
	catalog = JsUtil.stable_sort(catalog, func(a: Dictionary, b: Dictionary) -> float: return a["cost"] - b["cost"])
	list.add_child(_heading(_t("decor.category.%s" % _category), Paper.words(_t("decor.catalogCount", {"n": float(catalog.size())}), "small", false)))
	list.add_child(Paper.words(_t("decor.decorationIntro" if _category == "decoration" else "furn.intro"), "muted"))
	list.add_child(_spots)
	var arrange := Paper.button(_t("furn.arrange"), "ghost", _ui.arrange_browse)
	arrange.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	list.add_child(arrange)
	var grid := Paper.tiles(104.0)
	list.add_child(grid)
	for def: Dictionary in catalog:
		var id: String = def["id"]
		var surface := _t("furn.surface.%s" % def["surface"])
		if not s["decor"].get("building", false):
			surface += " · %s×%s" % [JsMath.number_to_string(def["w"]), JsMath.number_to_string(def["h"])]
		var count := _centred("", "small")
		var buy := Paper.button("", "primary", func() -> void:
			if CoreFurniture.buy_furniture(s, id):
				_session.panel_changed("decor", id)
				_ui.arrange_place(id)
				_ledger.update())
		var place := Paper.button(_t("furn.place"), "ghost", func() -> void:
			_ui.arrange_place(id)
			_ledger.update())
		var tile := _tile(Portraits.icon("furniture:%s" % id, 80.0), [_centred(name(id), "strong"), _centred(surface, "small"), _centred(_t("decor.comfort", {"n": def["comfort"]}) if def["comfort"] > 0.0 else "", "small"), count, Paper.spring(), buy, place])
		grid.add_child(tile)
		_tiles[id] = {"tile": tile, "buy": buy, "place": place, "count": count}


func _build_rooms(list: VBoxContainer) -> void:
	list.add_child(Paper.col([Paper.words(_t("decor.room"), "h3"), Paper.words(_t("decor.intro"), "muted")], 4))
	var s := _session.state
	for slot: String in CoreDecor.DECOR_SLOTS:
		var note := Paper.words("", "small", false)
		_notes[slot] = note
		list.add_child(_heading(_t("slot.%s" % slot), note))
		var grid := Paper.tiles(104.0)
		list.add_child(grid)
		for def: Dictionary in CoreDecor.decor_for_slot(slot):
			var id: String = def["id"]
			var use := Paper.button("", "primary", func() -> void:
				if CoreDecor.use_decor(s, id):
					_ledger.bought("decor", id))
			var tile := _tile(Portraits.icon("decor:%s" % id, 72.0), [_centred(name(id), "strong"), _centred(_t("decor.comfort", {"n": def["comfort"]}) if def["comfort"] > 0.0 else "", "small"), Paper.spring(), use])
			grid.add_child(tile)
			_tiles[id] = {"tile": tile, "use": use, "slot": slot, "cost": def["cost"]}


static func _centred(text: String, kind: String) -> Label:
	var l := Paper.words(text, kind)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


static func _tile(picture: Control, children: Array) -> PanelContainer:
	var tile := Paper.card("tile")
	tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	picture.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var inside := Paper.col([picture] + children, 4)
	for c: Control in children:
		if c is Button:
			c.add_theme_font_size_override("font_size", 12)
			c.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		elif not c is Label:
			c.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tile.add_child(inside)
	return tile


static func _mark(tile: PanelContainer, on: bool) -> void:
	if tile.get_meta("on", false) != on:
		tile.set_meta("on", on)
		tile.add_theme_stylebox_override("panel", Paper.tile_box(on))


func update() -> void:
	var s := _session.state
	_comfort.text = _t("decor.summary", {"n": CoreDecor.comfort(s), "pct": JsMath.js_round((CoreEconomy.tip_multiplier(s) - 1.0) * 100.0)})
	for slot: String in _notes:
		_notes[slot].text = name(s["decor"]["equipped"][slot])
	for id: String in _tiles:
		var refs: Dictionary = _tiles[id]
		if refs.has("use"):
			var equipped: bool = s["decor"]["equipped"][refs["slot"]] == id
			var owned := CoreDecor.owns_decor(s, id)
			_mark(refs["tile"], equipped)
			var use: Button = refs["use"]
			use.text = _t("decor.inUse") if equipped else (_t("decor.use") if owned else UiWords.money(refs["cost"]))
			use.disabled = equipped or (not owned and s["coins"] < refs["cost"])
			Paper.dress(use, "ghost" if owned and not equipped else "primary")
			continue
		var placed := CoreFurniture.placed_count(s, id)
		var stored := CoreFurniture.stored_count(s, id)
		var cost: float = CoreFurniture.furniture_def(id)["cost"]
		refs["count"].text = _t("furn.count", {"placed": placed, "stored": stored}) if stored > 0.0 else (_t("furn.out", {"n": placed}) if placed > 0.0 else "")
		# Starter pieces can't be bought again, only moved.
		refs["buy"].visible = cost != 0.0
		refs["buy"].text = _t("furn.buy", {"price": UiWords.money(cost)})
		refs["buy"].disabled = s["coins"] < cost
		refs["place"].visible = stored > 0.0
		_mark(refs["tile"], placed > 0.0)
	if _category != "renovation":
		_update_spots(s)


## In the building there are so many spots on each surface, more with every storey.
func _update_spots(s: Dictionary) -> void:
	if not s["decor"].get("building", false):
		_spots.visible = false
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
	Paper.say(_spots, _t("furn.spots", {"floorUsed": used["floor"], "floor": total["floor"], "wallUsed": used["wall"], "wall": total["wall"]}) + (_t("furn.spotsMore") if built.size() < CoreBuildingSpots.BUILDING_SPOTS.size() else ""))
