class_name PetPanel
extends RefCounted

## The cats (src/ui/pets.ts): the catalog to adopt from, those who live here, and their care.

var _ui: CafeUi
var _session: CoreGameSession
var _browsing: Dictionary
var _list: VBoxContainer
var _summary := Paper.words("")
var _treasure := Paper.words("", "muted")
var _tabs: Dictionary = {}
var _groups: Dictionary = {}
var _filters := Paper.flow([], 6)
var _grid := Paper.grid(3, [], 8)
var _tiles: Dictionary = {}
var _empty := Paper.words("", "muted")
var _rows: Dictionary = {}


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func start_browsing(s: Dictionary) -> Dictionary:
	var first: String = CorePets.CATS[0]["id"]
	for cat: Dictionary in CorePets.CATS:
		if _pet(s, cat["id"]) == null:
			first = cat["id"]
			break
	return {"mode": "catalog", "group": "all", "selected": first}


static func _pet(s: Dictionary, id: String) -> Variant:
	for pet: Dictionary in s["pets"]:
		if pet["id"] == id:
			return pet
	return null


func _init(list: VBoxContainer, ui: CafeUi, browsing: Dictionary, changed: Callable) -> void:
	_ui = ui
	_session = ui.session
	_browsing = browsing
	_list = list
	var count := float(CorePets.CATS.size())
	list.add_child(Paper.col([Paper.words(_t("pet.title"), "h3"), Paper.words(_t("pet.intro", {"count": count, "max": CorePets.MAX_PETS}), "muted"), _summary, _treasure, Paper.fold(_t("pet.careHelp"), Paper.words(_t("pet.accounting"), "muted"))], 8))
	var tabs := Paper.line([], 8)
	for mode: String in ["catalog", "owned"]:
		var b := Paper.button(_t("pet.%s" % mode), "chip", _choose.bind("mode", mode))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_tabs[mode] = b
		tabs.add_child(b)
	list.add_child(tabs)
	for group: String in ["all"] + CorePets.CAT_GROUPS:
		var b := Paper.button(_t("pet.group.%s" % group), "chip", _choose.bind("group", group))
		_groups[group] = b
		_filters.add_child(b)
	list.add_child(_filters)
	for cat: Dictionary in CorePets.CATS:
		_add_tile(cat)
	list.add_child(_grid)
	_empty.text = _t("pet.empty")
	list.add_child(_empty)
	for cat: Dictionary in CorePets.CATS:
		_add_row(cat, changed)


func _choose(what: String, value: String) -> void:
	_browsing[what] = value
	update()


static func _bonus(cat: Dictionary) -> String:
	return "+%s%%" % JsMath.number_to_string(JsMath.js_round(cat["traffic"] * 100.0))


func _add_tile(cat: Dictionary) -> void:
	var id: String = cat["id"]
	var badge := Paper.words("", "small")
	var inside := Paper.col([Portraits.cat(id, 64.0), Paper.words(_t("pet.%s.name" % id), "strong"), Paper.words("%s · %s" % [UiWords.money(cat["adoption"]), _bonus(cat)], "small"), badge], 2)
	inside.get_child(0).size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	for c: Control in inside.get_children():
		c.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if c is Label:
			c.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var pad := Paper.padded(inside, 8, 8)
	pad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	inside.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pad.set_anchors_preset(Control.PRESET_FULL_RECT)
	var b := Paper.button("", "chip", func() -> void:
		_choose("selected", id)
		_ui.show_in_ledger(_rows[id]["card"]))
	b.add_child(pad)
	b.custom_minimum_size.y = 150.0
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pad.minimum_size_changed.connect(func() -> void: b.custom_minimum_size.y = pad.get_combined_minimum_size().y)
	_grid.add_child(b)
	_tiles[id] = {"cat": cat, "button": b, "badge": badge}


func _add_row(cat: Dictionary, changed: Callable) -> void:
	var s := _session.state
	var id: String = cat["id"]
	var r := {"cat": cat, "name": Paper.words("", "h3"), "status": Paper.words("", "strong"), "progress": Paper.progress(0.0), "personality": Paper.words("", "muted"), "preference": Paper.words("", "muted"), "activity": Paper.words("")}
	r["adopt"] = Paper.button(_t("pet.adopt", {"cost": UiWords.money(cat["adoption"])}), "primary", func() -> void:
		if CorePets.adopt_cat(_session.state, id):
			changed.call(id))
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
	r["life"] = Paper.col([r["personality"], r["preference"], r["activity"], Paper.flow([r["locate"], r["interact"]])], 6)
	var card := Paper.card("row")
	r["card"] = card
	card.add_child(Paper.col([
		Paper.line([Portraits.cat(id, 64.0), Paper.col([r["name"], Paper.words(_t("pet.%s.desc" % id), "muted")], 2), Paper.words(_bonus(cat), "good", false)], 10),
		Paper.words(_t("pet.cost", {"cost": UiWords.money(cat["careCost"]), "hours": CorePets.CARE_SECONDS / CoreBusinessClock.SECONDS_PER_BUSINESS_HOUR}), "muted"),
		r["status"], r["progress"], Paper.flow([r["adopt"], r["refill"]]), r["auto"], r["life"],
	], 8))
	_list.add_child(card)
	_rows[id] = r


func update() -> void:
	var s := _session.state
	var candidates := CorePets.CATS.filter(func(cat: Dictionary) -> bool: return _browsing["group"] == "all" or cat["group"] == _browsing["group"])
	if not candidates.any(func(cat: Dictionary) -> bool: return cat["id"] == _browsing["selected"]):
		_browsing["selected"] = candidates[0]["id"]
	var mode: String = _browsing["mode"]
	var group: String = _browsing["group"]
	var picked := 0.0
	for kind: String in s["catGifts"]["found"]:
		picked += s["catGifts"]["found"][kind]
	_treasure.text = _t("gift.box", {"n": CoreCatGifts.gift_kinds_found(s), "total": float(CoreCatGifts.GIFT_KINDS.size()), "count": picked}) if picked > 0.0 else _t("gift.boxHint")
	_summary.text = _t("pet.summary", {"n": float(s["pets"].size()), "max": CorePets.MAX_PETS, "pct": JsMath.js_round((CorePets.pet_traffic(s) - 1.0) * 100.0), "cost": CoreFormat.format_account_money(s["today"]["petCost"])})
	_grid.visible = mode == "catalog"
	_filters.visible = mode == "catalog"
	_empty.visible = mode == "owned" and s["pets"].is_empty()
	for id: String in _tabs:
		Paper.dress(_tabs[id], "on" if id == mode else "chip")
	for id: String in _groups:
		Paper.dress(_groups[id], "on" if id == group else "chip")
	for id: String in _tiles:
		var tile: Dictionary = _tiles[id]
		tile["button"].visible = group == "all" or tile["cat"]["group"] == group
		Paper.dress(tile["button"], "on" if id == _browsing["selected"] else "chip")
		tile["badge"].text = _t("pet.adopted" if _pet(s, id) != null else "pet.choose")
	for id: String in _rows:
		_update_row(s, id, mode)


func _update_row(s: Dictionary, id: String, mode: String) -> void:
	var r: Dictionary = _rows[id]
	var cat: Dictionary = r["cat"]
	var pet: Variant = _pet(s, id)
	var full: bool = s["pets"].size() >= CorePets.MAX_PETS
	r["card"].visible = pet != null if mode == "owned" else id == _browsing["selected"]
	if not r["card"].visible:
		return
	var foster: bool = pet != null and _foster(pet)
	r["adopt"].visible = pet == null or foster
	r["adopt"].disabled = (full and not foster) or s["phase"] != "prep" or s["coins"] < cat["adoption"]
	for part: String in ["refill", "auto", "progress", "life"]:
		r[part].visible = pet != null
	r["name"].text = "%s%s" % ["%d. " % (s["pets"].find(pet) + 1) if pet != null else "", _t("pet.%s.name" % id)]
	if pet == null:
		r["status"].text = _t("pet.full" if full else ("pet.closedOnly" if s["phase"] != "prep" else ("pet.unaffordable" if s["coins"] < cat["adoption"] else "pet.included")), {"max": CorePets.MAX_PETS})
		return
	var actor: Variant = _session.cats.actors.get(id)
	var active := CorePets.pet_active(pet)
	r["personality"].text = LivingCatCard.personality(pet)
	r["preference"].text = LivingCatCard.preference(pet)
	r["activity"].text = LivingCatCard.activity(actor)
	r["locate"].disabled = actor == null
	r["interact"].disabled = actor == null or not active
	var time := CoreFormat.format_number(ceilf(pet["careSeconds"] / CoreBusinessClock.SECONDS_PER_BUSINESS_HOUR * 10.0) / 10.0)
	r["status"].text = _t("pet.foster") if foster else (_t("pet.ready", {"time": time}) if active else _t("pet.resting"))
	r["refill"].visible = not foster
	r["auto"].visible = not foster
	r["progress"].value = pet["careSeconds"] / CorePets.MAX_CARE_SECONDS
	r["auto"].set_pressed_no_signal(pet["autoRefill"])
	r["refill"].disabled = s["coins"] < cat["careCost"] or pet["careSeconds"] + CorePets.CARE_SECONDS > CorePets.MAX_CARE_SECONDS + 1e-8


static func _foster(pet: Dictionary) -> bool:
	var until: Variant = pet.get("fosterUntilDay")
	return until is float and until != 0.0
