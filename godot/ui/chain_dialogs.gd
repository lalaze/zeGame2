class_name ChainDialogs
extends RefCounted

## The chain's places and perks (src/ui/chain-ui.ts), and the map where the next branch opens (src/ui/branch-map.ts).


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _pct(share: float) -> float:
	return JsMath.js_round(share * 100.0)


static func _hours(h: float) -> float:
	return JsMath.js_round(h * 10.0) / 10.0


static func place(id: String) -> String:
	return _t("location.%s.name" % id)


## What a place's franchises add, at the strength `count` of them give (one by default).
static func bonus(id: String, count: float = 1.0) -> String:
	var b: Dictionary = CoreChainBonuses.PLACE_BONUS[id]
	var strength := CoreChainBonuses.place_strength(maxf(1.0, count))
	if b["kind"] == "till":
		return _t("place.bonus.town", {"hours": _hours(b["hours"] * strength)})
	return _t("place.bonus.%s" % id, {"pct": _pct(b["share"] * strength)})


## The places: storefront, franchises there and what they add.
static func places(s: Dictionary) -> Array:
	var out := []
	for id: String in CoreLocations.LOCATION_IDS:
		var count := CoreChainBonuses.franchises_in(s, id)
		var picture := Paper.art("map/place-%s" % id, 36.0)
		picture.modulate.a = 1.0 if count > 0.0 else 0.45
		out.append(Paper.line([picture, Paper.words("%s ×%s" % [place(id), JsMath.number_to_string(count)] if count > 0.0 else place(id), "strong"), Paper.words(bonus(id, count), "small")]))
	return out


static func _perk_effect(id: String) -> String:
	match id:
		"till": return _t("perk.till.desc", {"hours": CoreChainBonuses.PERK_TILL_HOURS})
		"cats": return _t("perk.cats.desc", {"hours": _hours(CoreCatGifts.GIFT_INTERVAL_MS * CoreChainBonuses.PERK_GIFT_SHARE / 3600000.0)})
		"kitchen": return _t("perk.kitchen.desc")
		"builders": return _t("perk.builders.desc", {"pct": _pct(1.0 - CoreChainBonuses.PERK_BUILD_SHARE)})
		"catering": return _t("perk.catering.desc", {"pct": _pct(CoreChainBonuses.PERK_CATERING_SHARE - 1.0)})
	return _t("perk.manager.desc", {"pct": _pct(CoreChainBonuses.PERK_AWAY_SHARE - 1.0)})


## Free stars raise prices, spent ones buy a convenience for good. Spending takes a second tap on the same button, since
## stars never come back.
static func show_perks(dialogs: PaperDialogs, s: Dictionary, changed: Callable) -> void:
	var intro := Paper.words("", "muted")
	var body := Paper.col([intro], 10)
	var buttons := {}
	var arming := [""]
	var update := func() -> void:
		intro.text = _t("perk.intro", {"stars": s["chain"]["stars"], "free": CoreChainBonuses.stars_free(s), "pct": _pct(CoreData.CHAIN_STAR_BONUS)})
		for perk: Dictionary in CoreChainBonuses.PERKS:
			var block: Variant = CoreChainBonuses.perk_block(s, perk["id"])
			var b: Button = buttons[perk["id"]]
			b.disabled = block != null
			b.text = _t("perk.owned") if block is String and block == "owned" else _t("perk.confirm" if arming[0] == perk["id"] else "perk.buy", {"n": perk["cost"]})
	for perk: Dictionary in CoreChainBonuses.PERKS:
		var id: String = perk["id"]
		var b := Paper.button("", "primary", func() -> void:
			if CoreChainBonuses.perk_block(s, id) != null:
				return
			if arming[0] != id:
				arming[0] = id
				update.call()
				return
			arming[0] = ""
			if not CoreChainBonuses.buy_perk(s, id):
				return
			dialogs.note(_t("perk.bought", {"name": _t("perk.%s.name" % id)}))
			changed.call()
			update.call())
		buttons[id] = b
		var card := Paper.card("row")
		card.add_child(Paper.line([Paper.art("map/perk-%s" % id, 48.0), Paper.col([Paper.words(_t("perk.%s.name" % id), "strong"), Paper.words(_perk_effect(id), "muted")], 2), b], 10))
		body.add_child(card)
	update.call()
	dialogs.show_dialog(_t("perk.title"), body, [{"label": _t("map.back")}])


## Where the next café opens: each place shows the view from its windows and its own specialties before `pick`.
static func show_map(dialogs: PaperDialogs, s: Dictionary, pick: Callable) -> void:
	var here := CoreLocations.cafe_location(s)
	var chosen := [""]
	for l: Dictionary in CoreLocations.LOCATIONS:
		if l["id"] != here:
			chosen[0] = l["id"]
			break
	var map := Control.new()
	map.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var ground := Paper.art("map/map", 100.0)
	ground.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if ground is TextureRect:
		ground.stretch_mode = TextureRect.STRETCH_SCALE
	map.add_child(ground)
	var pins := {}
	var detail := Paper.col([], 6)
	var card := Paper.card("row")
	card.add_child(detail)
	var update := func() -> void:
		for id: String in pins:
			Paper.dress(pins[id], "on" if id == chosen[0] else "chip")
		_show_place(detail, s, chosen[0], pick)
	for l: Dictionary in CoreLocations.LOCATIONS:
		var id: String = l["id"]
		var shop := Paper.art("map/place-%s" % id, 44.0)
		shop.modulate = Color.WHITE if CoreChainBonuses.franchises_in(s, id) > 0.0 else Color(0.85, 0.85, 0.85)
		var pin := Paper.button("%s · %s" % [place(id), _t("map.current")] if id == here else place(id), "chip", func() -> void:
			chosen[0] = id
			update.call())
		pin.add_theme_font_size_override("font_size", 12)
		pin.custom_minimum_size = Vector2(44, 34)
		pins[id] = pin
		map.add_child(shop)
		map.add_child(pin)
		pin.set_meta("at", l["pin"])
		pin.set_meta("shop", shop)
	var place_pins := func() -> void:
		map.custom_minimum_size.y = map.size.x * 0.62
		for id: String in pins:
			var pin: Button = pins[id]
			var at: Array = pin.get_meta("at")
			var need := pin.get_combined_minimum_size()
			pin.size = need
			pin.position = Vector2(clampf(map.size.x * at[0] - need.x / 2.0, 0.0, maxf(0.0, map.size.x - need.x)), clampf(map.size.y * at[1] - need.y / 2.0, 44.0, maxf(44.0, map.size.y - need.y)))
			var shop: Control = pin.get_meta("shop")
			shop.size = Vector2(44, 44)
			shop.position = Vector2(pin.position.x + need.x / 2.0 - 22.0, pin.position.y - 40.0)
	map.resized.connect(place_pins)
	update.call()
	dialogs.show_dialog(_t("map.title"), Paper.col([map, Paper.words(_t("map.hint"), "muted"), card], 10), [{"label": _t("map.back")}])


static func _show_place(detail: VBoxContainer, s: Dictionary, id: String, pick: Callable) -> void:
	Paper.clear(detail)
	var def: Dictionary = CoreLocations.location_def(id)
	var count := CoreChainBonuses.franchises_in(s, id)
	var view := Paper.art("map/view-%s" % id, 96.0)
	view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail.add_child(view)
	detail.add_child(Paper.words(place(id), "h3"))
	detail.add_child(Paper.words(_t("location.%s.desc" % id)))
	detail.add_child(Paper.words(_t("map.specialties", {"pct": _pct(CoreLocations.SPECIALTY_PRICE_BONUS)}) if not def["specialties"].is_empty() else _t("map.noSpecialties"), "muted"))
	for item: String in def["specialties"]:
		detail.add_child(Paper.line([Portraits.icon("item:%s" % item, 28.0), Paper.words(I18n.item_name(item, s))]))
	detail.add_child(Paper.words("%s%s" % ["%s " % _t("map.franchises", {"n": count}) if count > 0.0 else "", _t("map.bonus", {"bonus": bonus(id, count + 1.0)})], "muted"))
	detail.add_child(Paper.button(_t("map.open"), "primary", pick.bind(id)))
