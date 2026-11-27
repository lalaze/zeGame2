class_name PetPanel
extends RefCounted

## The cats (src/ui/pets.ts): Direction A peach summary card with 3 paw slots, collapsible care guide,
## breed filter chips, and 2-column cat cards that expand full-width on tap.

const ACTIVE_CHIP_BG := Color8(0xfb, 0xe0, 0xc8)
const ACTIVE_CHIP_EDGE := Color8(0xe4, 0xa9, 0x7f)

var _ui: CafeUi
var _session: CoreGameSession
var _browsing: Dictionary
var _summary_count := Paper.words("", "strong")
var _summary_stats := Paper.words("", "tiny")
var _treasure := Paper.words("", "tiny")
var _paws: Array = []
var _groups: Dictionary = {}
var _cards_box := Paper.col([], 8)
var _pair_rows: Array[Control] = []
var _rows: Dictionary = {}
var _layout_sig := ""


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func start_browsing(_s: Dictionary = {}) -> Dictionary:
	return {"group": "all", "expanded": {}}


static func _pet(s: Dictionary, id: String) -> Variant:
	for pet: Dictionary in s["pets"]:
		if pet["id"] == id:
			return pet
	return null


func _init(list: VBoxContainer, ui: CafeUi, browsing: Dictionary, changed: Callable) -> void:
	_ui = ui
	_session = ui.session
	_browsing = browsing
	if not _browsing.has("group"):
		_browsing["group"] = "all"
	if not (_browsing.get("expanded") is Dictionary):
		_browsing["expanded"] = {}

	# Top peach summary card: 3 circular slots + adopted/traffic/care stats + treasure box.
	var paws_row := Paper.line([], 5)
	paws_row.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	paws_row.alignment = BoxContainer.ALIGNMENT_CENTER
	for i in int(CorePets.MAX_PETS):
		var slot_btn := Button.new()
		slot_btn.focus_mode = Control.FOCUS_NONE
		slot_btn.mouse_filter = Control.MOUSE_FILTER_PASS
		slot_btn.custom_minimum_size = Vector2(36.0, 36.0)
		slot_btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var sb := Paper.cached_box(Color.WHITE, Paper.ROSE_A, 2, 18, Vector2(2, 2))
		for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
			slot_btn.add_theme_stylebox_override(st, sb)
		var pic := TextureRect.new()
		pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		pic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		pic.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 3)
		slot_btn.add_child(pic)
		slot_btn.visible = false
		var slot_empty := Paper.EmptyPaw.new(36.0)
		var slot_data := {"btn": slot_btn, "pic": pic, "empty": slot_empty, "catId": ""}
		slot_btn.pressed.connect(func() -> void:
			Paper._finish_typing(slot_btn)
			var cat_id: String = slot_data["catId"]
			if cat_id.is_empty():
				return
			var cat: Dictionary = _rows[cat_id]["cat"]
			if _browsing["group"] != "all" and cat["group"] != _browsing["group"]:
				_browsing["group"] = "all"
			_browsing["expanded"][cat_id] = true
			update()
			_ui.show_in_ledger(_rows[cat_id]["card"]))
		paws_row.add_child(slot_btn)
		paws_row.add_child(slot_empty)
		_paws.append(slot_data)

	_summary_count.add_theme_font_override("font", Paper.font(800))
	_summary_count.add_theme_font_size_override("font_size", 13)
	_summary_count.add_theme_color_override("font_color", Paper.INK_A)
	_summary_stats.add_theme_font_size_override("font_size", 11)
	_summary_stats.add_theme_color_override("font_color", Paper.INK_LIGHT)
	_treasure.add_theme_font_size_override("font_size", 10)
	_treasure.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var sum_top := Paper.line([paws_row, Paper.col([_summary_count, _summary_stats], 2)], 10)
	sum_top.alignment = BoxContainer.ALIGNMENT_CENTER
	var sum_card := Paper.panel(Paper.cached_box(Paper.PEACH_BG, Paper.PEACH_EDGE, 2, 14, Vector2(11, 9)))
	sum_card.add_child(Paper.col([sum_top, PaperSeam.new(Color8(0xed, 0xd0, 0xb4)), _treasure], 6))
	list.add_child(sum_card)

	# Help disclosure (holds former title, intro, and accounting text).
	var count := float(CorePets.CATS.size())
	var help_title := Paper.words(_t("pet.title"), "strong")
	help_title.add_theme_font_size_override("font_size", 12)
	help_title.add_theme_color_override("font_color", Paper.INK_A)
	var help_intro := Paper.words(_t("pet.intro", {"count": count, "max": CorePets.MAX_PETS}), "small")
	help_intro.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var help_acc := Paper.words(_t("pet.accounting"), "small")
	help_acc.add_theme_color_override("font_color", Paper.INK_LIGHT)
	list.add_child(Paper.help_fold(_t("pet.careHelp"), Paper.col([help_title, help_intro, help_acc], 4)))

	# Breed filter chips.
	var filters := Paper.flow([], 4)
	for group: String in ["all"] + CorePets.CAT_GROUPS:
		var text := "%s %d" % [_t("pet.group.all"), CorePets.CATS.size()] if group == "all" else _t("pet.group.%s" % group)
		var b := Paper.button(text, "chip", func() -> void:
			_browsing["group"] = group
			update())
		_groups[group] = b
		filters.add_child(b)
	list.add_child(filters)

	# 2-column paired cat cards container.
	for cat: Dictionary in CorePets.CATS:
		_build_card(cat, changed)
	list.add_child(_cards_box)


func _build_card(cat: Dictionary, changed: Callable) -> void:
	var id: String = cat["id"]
	var r := {"cat": cat, "status": Paper.words("", "strong"), "progress": Paper.progress_a(0.0, 6.0, Paper.SAGE_A, Paper.TRACK_A), "personality": Paper.words("", "small"), "preference": Paper.words("", "small"), "activity": Paper.words("", "strong")}
	r["status"].add_theme_font_size_override("font_size", 12)
	r["personality"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["preference"].add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["activity"].add_theme_font_size_override("font_size", 12)

	var card := Paper.panel(Paper.card_a_box(Paper.CARD_BORDER, Color.WHITE, Vector2(8, 8)))
	r["card"] = card
	# Card face (clickable fold summary; no buttons inside so run_ui.gd emits 1 fold token).
	var win := Paper.panel(Paper.cached_box(Color8(0xf8, 0xe8, 0xce), Color.TRANSPARENT, 0, 32, Vector2(4, 4)))
	win.custom_minimum_size = Vector2(64.0, 64.0)
	win.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	win.mouse_filter = Control.MOUSE_FILTER_IGNORE
	win.add_child(Portraits.cat(id, 56.0))
	var name_lbl := Paper.words(_t("pet.%s.name" % id), "strong")
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_override("font", Paper.font(800))
	name_lbl.add_theme_font_size_override("font_size", 12)
	name_lbl.add_theme_color_override("font_color", Paper.INK_A)
	var bonus_lbl := Paper.words(_t("pet.cardTraffic", {"pct": JsMath.js_round(cat["traffic"] * 100.0)}), "tiny", false)
	bonus_lbl.add_theme_font_override("font", Paper.font(800))
	bonus_lbl.add_theme_font_size_override("font_size", 10)
	bonus_lbl.add_theme_color_override("font_color", Paper.CARD_PRICE)
	var bonus_pill := Paper.panel(Paper.cached_box(Paper.PILL_BG, Color.TRANSPARENT, 0, 8, Vector2(7, 2)))
	bonus_pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	bonus_pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bonus_pill.add_child(bonus_lbl)
	var face := Paper.col([win, name_lbl, bonus_pill], 3)
	face.size_flags_vertical = Control.SIZE_EXPAND_FILL
	face.set_meta("fold", true)
	face.mouse_filter = Control.MOUSE_FILTER_PASS
	var drag := {"down": false, "pos": Vector2.ZERO}
	face.gui_input.connect(func(e: InputEvent) -> void:
		if not (e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT):
			return
		if e.pressed:
			drag["down"] = true
			drag["pos"] = e.global_position
			return
		var dragged: bool = drag["down"] and (e.global_position - (drag["pos"] as Vector2)).length() > 12.0
		drag["down"] = false
		if dragged:
			return
		Paper._finish_typing(face)
		if _browsing["expanded"].has(id):
			_browsing["expanded"].erase(id)
		else:
			_browsing["expanded"][id] = true
		update())

	# Collapsible details body (shown full-width when card is expanded).
	var desc := Paper.words(_t("pet.%s.desc" % id), "small")
	desc.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var care_cost := Paper.words(_t("pet.cost", {"cost": UiWords.money(cat["careCost"]), "hours": CorePets.CARE_SECONDS / CoreBusinessClock.SECONDS_PER_BUSINESS_HOUR}), "small")
	care_cost.add_theme_color_override("font_color", Paper.INK_LIGHT)
	r["refill"] = Paper.button(_t("pet.refill", {"cost": UiWords.money(cat["careCost"])}), "ghost", func() -> void:
		if CorePets.refill_pet(_session.state, id):
			changed.call(id))
	r["auto"] = Paper.check(_t("pet.auto"), false, func(on: bool) -> void:
		var pet: Variant = _pet(_session.state, id)
		if pet != null and pet["autoRefill"] != on:
			pet["autoRefill"] = on
			changed.call(id))
	r["locate"] = Paper.button(_t("pet.living.locate"), "ghost", func() -> void: _ui.locate_cat(id))
	r["interact"] = Paper.button(_t("pet.living.pet"), "primary", func() -> void:
		_session.greet_resident(id)
		update())
	r["life"] = Paper.col([PaperSeam.new(Paper.CARD_BORDER), r["personality"], r["preference"], r["activity"], Paper.flow([r["locate"], r["interact"]], 6)], 5)
	var more := Paper.col([PaperSeam.new(Paper.CARD_BORDER), desc, care_cost, r["status"], r["progress"], r["refill"], r["auto"], r["life"]], 6)
	more.visible = _browsing["expanded"].has(id)
	r["more"] = more

	# Bottom primary action button (Adopt OR In café · Find).
	var adopt := Paper.button(_t("pet.adopt", {"cost": UiWords.money(cat["adoption"])}), "primary", func() -> void:
		if CorePets.adopt_cat(_session.state, id):
			changed.call(id))
	adopt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	adopt.custom_minimum_size = Vector2(0.0, 32.0)
	adopt.add_theme_font_override("font", Paper.font(800))
	adopt.add_theme_font_size_override("font_size", 11)
	adopt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var home_btn := Paper.button(_t("pet.inShop"), "ghost", func() -> void: _ui.locate_cat(id))
	home_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	home_btn.custom_minimum_size = Vector2(0.0, 32.0)
	home_btn.add_theme_font_override("font", Paper.font(800))
	home_btn.add_theme_font_size_override("font_size", 11)
	home_btn.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var home_sb := Paper.cached_box(Paper.PEACH_BG, Paper.PEACH_ORANGE, 2, 10, Vector2(6, 5))
	for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
		home_btn.add_theme_stylebox_override(st, home_sb)
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		home_btn.add_theme_color_override(tone, Paper.PEACH_INK)
	r["adopt"] = adopt
	r["homeLocate"] = home_btn
	var foot := Paper.col([adopt, home_btn], 4)
	card.add_child(Paper.col([face, more, foot], 6))

	# Top-right filled heart badge for adopted cats.
	var overlay := Control.new()
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	overlay.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var heart := Paper.mark("heartfill", 16.0, Color8(0xd9, 0x6b, 0x5b))
	heart.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	heart.offset_left = -16.0
	heart.offset_right = 0.0
	heart.offset_top = 0.0
	heart.offset_bottom = 16.0
	heart.visible = false
	overlay.add_child(heart)
	card.add_child(overlay)
	r["heart"] = heart
	_rows[id] = r


func _relayout_cards() -> void:
	var group: String = _browsing["group"]
	var parts := PackedStringArray([group])
	for cat: Dictionary in CorePets.CATS:
		var id: String = cat["id"]
		if _browsing["expanded"].has(id):
			parts.append(id)
	var sig := "|".join(parts)
	if sig == _layout_sig:
		return
	_layout_sig = sig
	for r: Dictionary in _rows.values():
		var card: Control = r["card"]
		if card.get_parent() != null:
			card.get_parent().remove_child(card)
	for row: Control in _pair_rows:
		if row.get_parent() != null:
			row.get_parent().remove_child(row)
		row.queue_free()
	_pair_rows.clear()
	var open_pair: HBoxContainer = null
	var open_spacer: Control = null
	for cat: Dictionary in CorePets.CATS:
		var id: String = cat["id"]
		var visible_card: bool = group == "all" or cat["group"] == group
		var card: Control = _rows[id]["card"]
		card.visible = visible_card
		if not visible_card:
			continue
		if _browsing["expanded"].has(id):
			open_pair = null
			open_spacer = null
			card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_cards_box.add_child(card)
		else:
			card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			card.size_flags_vertical = Control.SIZE_FILL
			if open_pair != null and open_spacer != null:
				open_pair.remove_child(open_spacer)
				open_spacer.queue_free()
				open_spacer = null
				open_pair.add_child(card)
				open_pair = null
			else:
				var pair := HBoxContainer.new()
				pair.add_theme_constant_override("separation", 8)
				pair.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				pair.add_child(card)
				var spacer := Control.new()
				spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
				pair.add_child(spacer)
				_cards_box.add_child(pair)
				_pair_rows.append(pair)
				open_pair = pair
				open_spacer = spacer


func update() -> void:
	var s := _session.state
	if _browsing["group"] != "all" and _browsing["group"] not in CorePets.CAT_GROUPS:
		_browsing["group"] = "all"
	var group: String = _browsing["group"]
	for i in _paws.size():
		var slot: Dictionary = _paws[i]
		var has_pet: bool = i < s["pets"].size()
		slot["btn"].visible = has_pet
		slot["empty"].visible = not has_pet
		if has_pet:
			var cat_id: String = s["pets"][i]["id"]
			if slot["catId"] != cat_id:
				slot["catId"] = cat_id
				var path := "res://art/full/cats/%s-face.webp" % cat_id
				slot["pic"].texture = load(path) if ResourceLoader.exists(path) else null
		else:
			slot["catId"] = ""
			slot["pic"].texture = null
	_summary_count.text = _t("pet.summaryCount", {"n": float(s["pets"].size()), "max": CorePets.MAX_PETS})
	_summary_stats.text = _t("pet.summaryStats", {"pct": JsMath.js_round((CorePets.pet_traffic(s) - 1.0) * 100.0), "cost": CoreFormat.format_account_money(s["today"]["petCost"])})
	var picked := 0.0
	for kind: String in s["catGifts"]["found"]:
		picked += s["catGifts"]["found"][kind]
	_treasure.text = _t("gift.box", {"n": CoreCatGifts.gift_kinds_found(s), "total": float(CoreCatGifts.GIFT_KINDS.size()), "count": picked}) if picked > 0.0 else _t("gift.boxHint")
	for id: String in _groups:
		Paper.style_filter_chip_tinted(_groups[id], id == group, ACTIVE_CHIP_BG, ACTIVE_CHIP_EDGE)
	_relayout_cards()
	for id: String in _rows:
		_update_row(s, id)


func _update_row(s: Dictionary, id: String) -> void:
	var r: Dictionary = _rows[id]
	var cat: Dictionary = r["cat"]
	var pet: Variant = _pet(s, id)
	var foster: bool = pet != null and _foster(pet)
	var full: bool = s["pets"].size() >= CorePets.MAX_PETS
	var expanded: bool = _browsing["expanded"].has(id)
	r["more"].visible = expanded
	var adopted: bool = pet != null
	r["heart"].visible = adopted
	if r.get("_adopted") != adopted:
		r["_adopted"] = adopted
		var border := Paper.PEACH_ORANGE if adopted else Paper.CARD_BORDER
		var fill := Color8(0xff, 0xfa, 0xf3) if adopted else Color.WHITE
		r["card"].add_theme_stylebox_override("panel", Paper.card_a_box(border, fill, Vector2(8, 8)))
	r["adopt"].visible = pet == null or foster
	r["adopt"].disabled = (full and not foster) or s["phase"] != "prep" or s["coins"] < cat["adoption"]
	var actor: Variant = _session.cats.actors.get(id) if pet != null else null
	r["homeLocate"].visible = pet != null and not foster
	r["homeLocate"].disabled = actor == null
	if not expanded:
		return
	for part: String in ["progress", "life"]:
		r[part].visible = pet != null
	r["refill"].visible = pet != null and not foster
	r["auto"].visible = pet != null and not foster
	if pet == null:
		r["status"].text = _t("pet.full" if full else ("pet.closedOnly" if s["phase"] != "prep" else ("pet.unaffordable" if s["coins"] < cat["adoption"] else "pet.included")), {"max": CorePets.MAX_PETS})
		return
	var active := CorePets.pet_active(pet)
	r["personality"].text = LivingCatCard.personality(pet)
	r["preference"].text = LivingCatCard.preference(pet)
	r["activity"].text = LivingCatCard.activity(actor)
	r["locate"].disabled = actor == null
	r["interact"].disabled = actor == null or not active
	var time := CoreFormat.format_number(ceilf(pet["careSeconds"] / CoreBusinessClock.SECONDS_PER_BUSINESS_HOUR * 10.0) / 10.0)
	r["status"].text = _t("pet.foster") if foster else (_t("pet.ready", {"time": time}) if active else _t("pet.resting"))
	r["progress"].value = pet["careSeconds"] / CorePets.MAX_CARE_SECONDS
	r["auto"].set_pressed_no_signal(pet["autoRefill"])
	r["refill"].disabled = s["coins"] < cat["careCost"] or pet["careSeconds"] + CorePets.CARE_SECONDS > CorePets.MAX_CARE_SECONDS + 1e-8


static func _foster(pet: Dictionary) -> bool:
	var until: Variant = pet.get("fosterUntilDay")
	return until is float and until != 0.0
