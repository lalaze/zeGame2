class_name LedgerCards
extends RefCounted

## The operations group at the bottom of Upgrades (src/ui/panel.ts):
## 3 compact tiles (shop manager, catering orders, café chain) + one shared collapsible full-width detail card below.

var _ledger: CafeLedger
var _ui: CafeUi
var _session: CoreGameSession
var _tiles: Dictionary = {}
var _detail: VBoxContainer = null
var _cards: Dictionary = {}
var _manager: Dictionary = {}
var _orders: Dictionary = {}
var _chain: Dictionary = {}


func _init(ledger: CafeLedger, ui: CafeUi) -> void:
	_ledger = ledger
	_ui = ui
	_session = ui.session


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _money(n: float) -> String:
	return CoreFormat.format_transaction_money(n)


func build_ops_grid() -> Control:
	_tiles.clear()
	_cards.clear()
	var row := Paper.line([], 6)
	for kind: String in ["manager", "orders", "chain"]:
		var tile := _build_tile(kind)
		row.add_child(tile["button"])
		_tiles[kind] = tile
	_detail = Paper.col([], 0)
	_cards["manager"] = _build_manager()
	_cards["orders"] = _build_orders()
	_cards["chain"] = _build_chain()
	for kind: String in ["manager", "orders", "chain"]:
		_cards[kind].visible = _ledger.open_ops_tile == kind
		_detail.add_child(_cards[kind])
	_detail.visible = not _ledger.open_ops_tile.is_empty()
	return Paper.col([row, _detail], 8)


func _build_tile(kind: String) -> Dictionary:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(0.0, 74.0)
	var icon_rect := Paper.mark("lock", 20.0, Paper.INK_LIGHT)
	icon_rect.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var name_lbl := Paper.words(_t("%s.name" % kind), "strong")
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_override("font", Paper.font(800))
	name_lbl.add_theme_font_size_override("font_size", 12)
	name_lbl.add_theme_color_override("font_color", Paper.INK_A)
	var status_lbl := Paper.words("", "tiny")
	status_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_lbl.add_theme_font_override("font", Paper.font(700))
	status_lbl.add_theme_font_size_override("font_size", 10)
	status_lbl.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var inside := Paper.col([icon_rect, name_lbl, status_lbl], 3)
	inside.alignment = BoxContainer.ALIGNMENT_CENTER
	inside.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pad := Paper.padded(inside, 4, 7)
	pad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pad.set_anchors_preset(Control.PRESET_FULL_RECT)
	b.add_child(pad)
	pad.minimum_size_changed.connect(func() -> void: b.custom_minimum_size.y = maxf(74.0, pad.get_combined_minimum_size().y))
	b.pressed.connect(func() -> void:
		Paper._finish_typing(b)
		_ledger.open_ops_tile = "" if _ledger.open_ops_tile == kind else kind
		update()
		# The tiles sit at the foot of the page, so the panel they open can land below the screen.
		if not _ledger.open_ops_tile.is_empty():
			_ledger.reveal_below(_detail))
	return {"button": b, "icon": icon_rect, "name": name_lbl, "status": status_lbl, "styleKey": ""}


func _style_tile(kind: String, icon_name: String, status_text: String, locked: bool, open: bool, active: bool) -> void:
	var tile: Dictionary = _tiles[kind]
	var icon_rect: TextureRect = tile["icon"]
	icon_rect.texture = Paper.icon(icon_name, 20)
	icon_rect.modulate = Paper.SAGE_A_DARK if open else Paper.INK_LIGHT
	tile["status"].text = status_text
	tile["name"].add_theme_color_override("font_color", Paper.INK_LIGHT if locked else Paper.INK_A)
	tile["status"].add_theme_color_override("font_color", Paper.CARD_PRICE if open else Paper.INK_LIGHT)
	var style_key := "%s|%s|%s" % [locked, open, active]
	if tile["styleKey"] == style_key:
		return
	tile["styleKey"] = style_key
	var b: Button = tile["button"]
	var fill := Color8(0xf3, 0xf9, 0xef) if open else (Color(1.0, 1.0, 1.0, 0.58) if locked else Color.WHITE)
	var border := Paper.BOOK_COVER if active else (Paper.SAGE_A if open else (Color8(0xd6, 0xc4, 0xa8) if locked else Paper.LINE_A))
	var sb: StyleBoxFlat
	if locked and not active:
		sb = Paper.cached_box(fill, border, 1, 12, Vector2(4, 6))
	else:
		sb = Paper.card_a_box(border, fill, Vector2(4, 6))
	for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, sb)


func update() -> void:
	if _tiles.is_empty():
		return
	var s := _session.state
	var now := CoreClock.now()
	# Manager tile state
	var m_unlocked: bool = CoreManager.manager_unlocked(s)
	var m_hired: bool = s["manager"]["hired"]
	var m_waiting: float = CoreChain.franchise_earnings(s, now)["amount"] if not s["chain"]["franchises"].is_empty() else 0.0
	var m_locked: bool = not m_hired and not m_unlocked
	var m_open: bool = (not m_hired and m_unlocked and float(s["coins"]) >= CoreManager.MANAGER_COST) or (m_hired and m_waiting > 0.0)
	var m_status := _t("manager.tile.locked", {"n": CoreManager.MANAGER_UNLOCK_DAY}) if m_locked else (
		"%s %s" % [_t("manager.hire"), _money(CoreManager.MANAGER_COST)] if not m_hired else (
		_t("manager.tile.collect", {"money": _money(m_waiting)}) if m_waiting > 0.0 else _t("manager.hired")))
	_style_tile("manager", "lock" if m_locked else "people", m_status, m_locked, m_open, _ledger.open_ops_tile == "manager")
	# Orders tile state
	var active: Variant = s["orders"]["active"]
	var ready: bool = CoreOrders.order_ready(s, now)
	var o_locked: bool = not m_hired
	var o_open: bool = not o_locked and active != null and ready
	var o_status := _t("orders.tile.locked") if o_locked else (
		(_t("orders.tile.claim", {"money": _money(active["payout"])}) if ready else _duration(CoreOrders.order_left(s, now))) if active != null else _t("orders.tile.idle"))
	_style_tile("orders", "lock" if o_locked else "bag", o_status, o_locked, o_open, _ledger.open_ops_tile == "orders")
	# Chain tile state
	var c_unlocked: bool = CoreChain.branch_unlocked(s)
	var c_can_open: bool = CoreChain.can_open_branch(s)
	var c_locked: bool = not c_unlocked
	var c_status := _t("chain.tile.locked") if c_locked else (
		_t("chain.tile.open") if c_can_open else _t("chain.tile.stars", {"n": s["chain"]["stars"]}))
	_style_tile("chain", "lock" if c_locked else "star", c_status, c_locked, c_can_open, _ledger.open_ops_tile == "chain")
	# Show at most one detail card below the 3 tiles.
	_detail.visible = not _ledger.open_ops_tile.is_empty()
	for kind: String in ["manager", "orders", "chain"]:
		_cards[kind].visible = _ledger.open_ops_tile == kind
	if _ledger.open_ops_tile == "manager":
		_update_manager()
	elif _ledger.open_ops_tile == "orders":
		_update_orders()
	elif _ledger.open_ops_tile == "chain":
		_update_chain()


static func _card(children: Array) -> Control:
	var card := Paper.panel(Paper.card_a_box(Paper.LINE_A, Color.WHITE, Vector2(12, 10)))
	card.add_child(Paper.col(children, 8))
	return card


func _button(kind: String, pressed: Callable) -> Button:
	var b := Paper.button("", kind, pressed)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return b


func _build_manager() -> Control:
	var s := _session.state
	_manager = {
		"sub": Paper.words("", "muted"), "away": Paper.words("", "muted"), "franchise": Paper.words("", "muted"),
		"hire": _button("primary", func() -> void:
			if CoreManager.hire_manager(s):
				_ledger.bought("upgrade", "manager")),
		"till": _button("primary", func() -> void:
			if CoreManager.upgrade_till(s):
				_ledger.bought("upgrade", "till")),
		"collect": _button("primary", func() -> void:
			var amount := CoreChain.collect_franchises(s, CoreClock.now())
			if amount > 0.0:
				_ui.dialogs.note(_t("manager.collected", {"money": _money(amount)}))
				_ledger.bought("upgrade", "franchise")),
		"auto": _button("chip", func() -> void:
			s["manager"]["auto"] = not s["manager"]["auto"]
			_ledger.bought("upgrade", "manager")),
	}
	var m := _manager
	return _card([Paper.words(_t("manager.name"), "h3"), m["sub"], m["away"], m["franchise"], m["hire"], m["till"], m["collect"], m["auto"]])


func _update_manager() -> void:
	var m := _manager
	var s := _session.state
	var hired: bool = s["manager"]["hired"]
	var unlocked := CoreManager.manager_unlocked(s)
	m["sub"].text = _t("manager.desc") if unlocked or hired else _t("manager.locked", {"n": CoreManager.MANAGER_UNLOCK_DAY})
	var hours := CoreManager.till_seconds(s) / 3600.0
	var cost: Variant = CoreManager.till_upgrade_cost(s)
	Paper.say(m["away"], "" if not hired else _t("manager.away", {"money": _money(CoreManager.away_hourly(s)), "hours": hours, "pct": JsMath.js_round(CoreManager.OVERFLOW_SHARE * 100.0)}) + (" %s" % _t("manager.till.max", {"hours": hours}) if cost == null else ""))
	m["hire"].visible = not hired
	m["hire"].text = "%s %s" % [_t("manager.hire"), _money(CoreManager.MANAGER_COST)]
	m["hire"].disabled = not unlocked or s["coins"] < CoreManager.MANAGER_COST
	m["till"].visible = hired and cost != null
	if cost != null:
		m["till"].text = "%s %s" % [_t("manager.till", {"hours": hours, "next": CoreManager.TILL_HOURS[int(s["manager"]["till"]) + 1]}), _money(cost)]
		m["till"].disabled = s["coins"] < cost
	# Franchise pay fills the till on screen too, so it can be collected from here.
	var franchises := float(s["chain"]["franchises"].size())
	var waiting := CoreChain.franchise_earnings(s, CoreClock.now())
	m["collect"].visible = franchises > 0.0
	Paper.say(m["franchise"], "" if franchises == 0.0 else _t("manager.franchise", {"n": franchises, "money": _money(CoreChain.franchise_hourly(s)), "waiting": _money(waiting["amount"])}) + (" %s" % _t("manager.franchise.full") if waiting["full"] else ""))
	m["collect"].text = _t("manager.collect", {"money": _money(waiting["amount"])})
	m["collect"].disabled = waiting["amount"] <= 0.0
	m["auto"].visible = hired
	m["auto"].text = _t("manager.auto.on" if s["manager"]["auto"] else "manager.auto.off")


func _build_orders() -> Control:
	var s := _session.state
	_orders = {"sub": Paper.words("", "muted"), "status": Paper.words("", "muted"), "options": {}}
	var children: Array = [Paper.words(_t("orders.name"), "h3"), _orders["sub"], _orders["status"]]
	for o: Dictionary in CoreOrders.ORDERS:
		var kind: String = o["id"]
		var b := _button("primary", func() -> void:
			if CoreOrders.start_order(s, kind, CoreClock.now()) != null:
				_ui.dialogs.note(_t("orders.started", {"name": _t("orders.%s" % kind), "time": _duration(CoreOrders.order_left(s, CoreClock.now()))}))
				_ledger.bought("upgrade", "order"))
		_orders["options"][kind] = b
		children.append(b)
	_orders["collect"] = _button("primary", func() -> void:
		var order: Variant = CoreOrders.collect_order(s, CoreClock.now())
		if order != null:
			_ui.dialogs.note(_t("orders.delivered", {"name": _t("orders.%s" % order["kind"]), "money": _money(order["payout"])}))
			_ledger.bought("upgrade", "order"))
	return _card(children + [_orders["collect"]])


static func _duration(seconds: float) -> String:
	return CoreFormat.format_duration(seconds, I18n.t)


func _update_orders() -> void:
	var s := _session.state
	var now := CoreClock.now()
	var active: Variant = s["orders"]["active"]
	var ready := CoreOrders.order_ready(s, now)
	_orders["sub"].text = _t("orders.desc" if s["manager"]["hired"] else "orders.locked")
	if active != null:
		var name := _t("orders.%s" % active["kind"])
		Paper.say(_orders["status"], _t("orders.ready", {"name": name, "money": _money(active["payout"])}) if ready else _t("orders.active", {"name": name, "n": active["servings"], "item": I18n.item_name(active["item"], s), "time": _duration(CoreOrders.order_left(s, now))}))
	else:
		var block: Variant = CoreOrders.order_block(s, "office")
		Paper.say(_orders["status"], _t("orders.noMenu") if s["manager"]["hired"] and block is String and block == "noMenu" else "")
	for kind: String in _orders["options"]:
		var b: Button = _orders["options"][kind]
		var q: Variant = CoreOrders.quote_order(s, kind)
		b.visible = active == null and q != null
		if q == null:
			continue
		b.text = _t("orders.option", {"name": _t("orders.%s" % kind), "time": _duration(CoreOrders.order_def(kind)["hours"] * 3600.0), "money": _money(q["payout"] - q["cost"])})
		b.disabled = CoreOrders.order_block(s, kind) != null
	_orders["collect"].visible = ready
	if ready and active != null:
		_orders["collect"].text = _t("manager.collect", {"money": _money(active["payout"])})


func _build_chain() -> Control:
	_chain = {"places": Paper.col([], 6), "placesSignature": ""}
	for part: String in ["sub", "status", "perks", "gain", "handover", "note", "complete"]:
		_chain[part] = Paper.words("", "muted")
	_chain["open"] = _button("primary", _ui.open_branch_map)
	_chain["perksButton"] = _button("ghost", func() -> void: ChainDialogs.show_perks(_ui.dialogs, _session.state, func() -> void:
		_ledger.bought("upgrade", "perk")))
	var c := _chain
	return _card([Paper.words(_t("chain.name"), "h3"), c["sub"], c["status"], c["perks"], c["gain"], c["handover"], c["note"], c["places"], c["complete"], c["open"], c["perksButton"]])


func _update_chain() -> void:
	var c := _chain
	var s := _session.state
	var unlocked := CoreChain.branch_unlocked(s)
	var stars := CoreChain.stars_on_branch(s)
	var branches: float = s["chain"]["branches"]
	var here := CoreLocations.cafe_location(s)
	c["sub"].text = _t("chain.desc", {"pct": CoreChain.chain_bonus_percent(1.0), "share": JsMath.js_round(CoreChain.FRANCHISE_SHARE * 100.0)}) if unlocked else _t("chain.locked")
	Paper.say(c["status"], "" if s["chain"]["stars"] == 0.0 and branches == 0.0 else _t("chain.status", {"stars": s["chain"]["stars"], "bonus": CoreChain.chain_bonus_percent(CoreChainBonuses.stars_free(s)), "n": branches + 1.0, "place": ChainDialogs.place(here)}))
	Paper.say(c["perks"], "" if not unlocked and branches == 0.0 else _t("chain.perks", {"pct": JsMath.js_round(CoreRegions.build_share(branches + 1.0) * 100.0)}))
	var gain := ""
	if unlocked:
		if stars > 0.0:
			gain = "%s %s%s" % [_t("chain.gain", {"stars": stars, "money": _money(CoreChain.branch_earnings(s))}), _t("chain.next", {"money": _money(CoreChain.next_star_at(s) - CoreChain.branch_earnings(s))}), "" if s["phase"] == "prep" else " %s" % _t("chain.closedOnly")]
		else:
			gain = _t("chain.next", {"money": _money(CoreChain.STAR_EARNINGS - CoreChain.branch_earnings(s))})
	Paper.say(c["gain"], gain)
	c["open"].visible = unlocked
	c["open"].text = _t("chain.open")
	c["open"].disabled = not CoreChain.can_open_branch(s)
	# What handing this café over would add: the number that decides when to do it.
	Paper.say(c["handover"], "" if not unlocked else _t("chain.handover", {"money": _money(CoreManager.away_hourly(s) * CoreChain.FRANCHISE_SHARE), "bonus": ChainDialogs.bonus(here)}))
	var map: bool = unlocked or branches > 0.0
	for part: String in ["note", "places", "complete"]:
		c[part].visible = map
	c["note"].text = _t("chain.places")
	var signature := ",".join(PackedStringArray(s["chain"]["franchises"].map(func(f: Dictionary) -> String: return f["location"])))
	if signature != c["placesSignature"]:
		c["placesSignature"] = signature
		Paper.clear(c["places"])
		for row: Control in ChainDialogs.places(s):
			c["places"].add_child(row)
	c["complete"].text = _t("chain.completeDone" if CoreChainBonuses.chain_complete(s) else "chain.complete", {"pct": JsMath.js_round(CoreChainBonuses.COMPLETE_BONUS * 100.0)})
	c["perksButton"].visible = s["chain"]["stars"] > 0.0
	c["perksButton"].text = "%s · %s★" % [_t("chain.perksOpen"), JsMath.number_to_string(CoreChainBonuses.stars_free(s))]
