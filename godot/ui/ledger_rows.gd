class_name LedgerRows
extends RefCounted

## The ledger's lists (src/ui/panel.ts): the dishes of the menu, the pantry's ingredients, and the upgrades with the
## manager, the orders and the chain.

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
## What every dish's row needs, worked out once for all of them.
var _today: Array = []
var _average := 0.0
var _cards: LedgerCards
var _projects: Button = null
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


## Shows these rows, keeping those that are there already.
func sync(keys: Array) -> void:
	for key: String in _nodes.keys():
		# A heading counts its dishes, so it is made anew.
		if key not in keys or key.begins_with("cat:"):
			_list.remove_child(_nodes[key])
			_nodes[key].queue_free()
			_nodes.erase(key)
			_rows.erase(key)
	_keys = keys
	_pending = keys.filter(func(key: String) -> bool: return not _nodes.has(key))
	for i in _keys.size():
		if _nodes.has(_keys[i]):
			_list.move_child(_nodes[_keys[i]], mini(i, _list.get_child_count() - 1))
	_stale.clear()
	# A screenful at once, and all of what is few.
	var first := 8
	while not _pending.is_empty() and (at_once or first > 0 or _pending[0].get_slice(":", 0) not in ["item", "cat", "teaser"]):
		_make(_pending.pop_front())
		first -= 1


func _make(key: String) -> void:
	_add(key)
	var node: Control = _list.get_child(_list.get_child_count() - 1)
	_nodes[key] = node
	var before := 0
	for k: String in _keys:
		if k == key:
			break
		if _nodes.has(k):
			before += 1
	_list.move_child(node, before)


## A little of what is left to make or to keep up; whether there is more.
func work(milliseconds: float) -> bool:
	var until := Time.get_ticks_usec() + int(milliseconds * 1000.0)
	while Time.get_ticks_usec() < until:
		if not _pending.is_empty():
			var key: String = _pending.pop_front()
			_make(key)
			if _rows.has(key):
				_update_row(_rows[key])
		elif not _stale.is_empty():
			var key: String = _stale.pop_front()
			if _rows.has(key):
				_update_row(_rows[key])
		else:
			return false
	return true


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _money(n: float) -> String:
	return CoreFormat.format_transaction_money(n)


func _add(key: String) -> void:
	var s := _session.state
	var kind := key.get_slice(":", 0)
	var id := key.trim_prefix("%s:" % kind)
	match kind:
		"room-projects":
			_projects = Paper.button("", "ghost", _ui.open_street)
			_list.add_child(_projects)
		"signature-workbench":
			var entry := Paper.button(_t("signature.entry"), "flat", func() -> void: SignatureLab.show_lab(_ui, func() -> void:
				_session.panel_changed("recipe", "signature")
				_ledger.refresh()))
			entry.alignment = HORIZONTAL_ALIGNMENT_LEFT
			_list.add_child(Paper.col([entry, Paper.seam()], 2))
		"style-prices": _list.add_child(Paper.words(_t("style.menu.prices"), "muted"))
		"pantry": _pantry_intro()
		"manager", "orders", "chain": _list.add_child(_cards.build(kind))
		"variety":
			_variety = Paper.words("", "muted")
			_bake_all = Paper.button(_t("bake.all"), "ghost", func() -> void:
				CoreEconomy.bake_for_forecast(s)
				_ledger.bought("menu", "bake"))
			_bake_all.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			_list.add_child(Paper.col([_variety, _bake_all], 8))
		"cat":
			var chain := CoreData.MENU.filter(func(m: Dictionary) -> bool: return m["category"] == id)
			var owned := chain.filter(func(m: Dictionary) -> bool: return s["items"][m["id"]] > 0.0)
			var head := Paper.line([Paper.words(_t("cat.%s" % id), "h3")])
			if not _ledger.intro:
				head.add_child(Paper.words("%d/%d" % [owned.size(), chain.size()], "small", false))
			_list.add_child(Paper.col([Paper.space(4.0), head, Paper.seam()], 4))
		"teaser":
			var card := Paper.card("row")
			card.modulate.a = 0.6
			card.add_child(Paper.line([Paper.words("?", "h1", false), Paper.col([Paper.words("???", "name"), Paper.words(_t("row.teaser"), "muted")], 2)], 18))
			_list.add_child(card)
		_: _add_row(key, kind, id)


func _add_row(key: String, kind: String, id: String) -> void:
	var s := _session.state
	var r := {"kind": kind, "id": id}
	var card := Paper.card("row")
	r["card"] = card
	var is_item := kind == "item"
	var name: String = I18n.item_name(id) if is_item else (UiWords.ingredient(id) if kind == "ing" else _t("upgrade.%s.name" % id))
	var head := Paper.flow([Paper.fitting(name, "name", 200.0)], 6)
	if is_item and CoreLocations.is_specialty(s, id):
		head.add_child(Paper.words(_t("menu.specialty"), "good", false))
	r["level"] = Paper.words("", "muted", false)
	head.add_child(r["level"])
	r["sub"] = Paper.words("", "muted")
	var info := Paper.col([head, r["sub"]], 4)
	r["details"] = Paper.button("", "link", _price_details.bind(r))
	r["details"].size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	if is_item:
		r["tradeoff"] = Paper.words("", "muted")
		info.add_child(r["tradeoff"])
		info.add_child(_recipe(r, id))
		info.add_child(_taste(r, id))
		if CoreEconomy.is_bakery(id):
			info.add_child(_bake(r, id))
	else:
		info.add_child(r["details"])
	if kind != "upgrade":
		r["bar"] = Paper.progress(0.0, 4.0)
		info.add_child(r["bar"])
	var picture := Paper.panel(Paper.box(Color8(0xf6, 0xe7, 0xcc), Color.TRANSPARENT, 0, 12, Vector2(4, 4)))
	picture.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	picture.add_child(Portraits.icon("%s:%s" % [kind, id], 40.0))
	var body := Paper.col([Paper.line([picture, info], 12)], 10)
	if is_item:
		r["preview"] = Paper.words("", "good")
		r["details"].size_flags_horizontal = Control.SIZE_SHRINK_END
		body.add_child(Paper.line([r["preview"], Paper.spring(), r["details"]]))
	if kind == "upgrade" and id == "tables":
		r["tablePreview"] = Paper.button("", "chip", _preview_table)
		body.add_child(r["tablePreview"])
	var actions := Paper.line([], 8)
	if is_item:
		r["toggle"] = Paper.button("", "selling", _toggle.bind(id))
		r["toggle"].size_flags_horizontal = Control.SIZE_EXPAND_FILL
		actions.add_child(r["toggle"])
	r["buy"] = Paper.priced("primary", _buy.bind(r))
	actions.add_child(r["buy"])
	body.add_child(actions)
	card.add_child(body)
	_rows[key] = r
	_list.add_child(card)


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
	r["tasteProgress"] = Paper.words("", "small")
	var b := Paper.button("", "flat", func() -> void: TasteDialog.show_taste(_ui.dialogs, _session, id, func() -> void: _ledger.bought("recipe", id)))
	var copy := Paper.col([r["tasteLabel"], r["tasteProgress"]], 0)
	copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
	copy.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	b.add_child(copy)
	b.custom_minimum_size.y = 46.0
	r["taste"] = b
	return b


func _bake(r: Dictionary, id: String) -> Control:
	r["bakeLabel"] = Paper.words("", "small", false)
	r["bakeN"] = Paper.words("", "strong", false)
	r["bakeNote"] = Paper.words("", "small", false)
	r["bakeLess"] = Paper.button("−", "chip", _set_bake.bind(id, -CoreData.BAKE_STEP))
	r["bakeMore"] = Paper.button("+", "chip", _set_bake.bind(id, CoreData.BAKE_STEP))
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
	if _projects != null:
		_projects.text = StreetMap.entry_label(s, CoreClock.now())
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
	Paper.say(r["level"], "Lv %s" % JsMath.number_to_string(level) if level > 0.0 else "")
	if not eligible:
		r["sub"].text = _t("menu.requiresKitchen")
	elif level > 0.0:
		r["sub"].text = _t("row.each", {"price": _price_at(def, level), "time": UiWords.fixed(CoreEconomy.prep_time(s, id), 1), "cost": _money(CoreEconomy.serving_cost(id))})
	else:
		r["sub"].text = _t("row.sellsFor", {"price": _money(def["basePrice"] * CoreEconomy.tip_multiplier(s))})
	var next: Variant = CoreEconomy.next_milestone(level)
	var before := 0.0
	for m: float in CoreData.PRICE_MILESTONES:
		if m <= level:
			before = m
	r["bar"].value = (level - before) / (next - before) if next != null else 1.0
	Paper.set_priced(r["buy"], _t("btn.unlock") if level == 0.0 else ("+%s" % JsMath.number_to_string(q["count"]) if q["count"] > 1.0 else _t("btn.levelUp")), _money(q["cost"]), q["affordable"])
	_update_details(r, q["cost"])
	Paper.say(r["preview"], "" if not eligible or (level == 0.0 and q["count"] <= 1.0) else _t("row.afterUpgrade" if level > 0.0 else "row.afterUnlock", {"price": _price_at(def, level + q["count"])}))
	var on: bool = eligible and id in s["onMenu"]
	r["card"].modulate.a = 0.75 if level > 0.0 and not on else 1.0
	Paper.say(r["tradeoff"], _tradeoff(s, def, level, eligible, on))
	r["toggle"].visible = level > 0.0
	r["toggle"].text = _t("menu.on" if on else "menu.off")
	Paper.dress(r["toggle"], "selling" if on else "chip")
	r["toggle"].disabled = not prep or not eligible
	r["taste"].visible = level > 0.0
	r["tasteLabel"].text = TasteDialog.label(s, id)
	r["tasteProgress"].text = TasteDialog.progress(s, id)
	var left := CoreEconomy.servings_left(s, id)
	r["recipe"].visible = eligible
	r["left"].text = _t("bake.canBake" if CoreEconomy.is_bakery(id) else "menu.left", {"n": CoreFormat.format_number(left)}) if eligible else ""
	r["left"].add_theme_color_override("font_color", Paper.DANGER if left < 1.0 else Paper.MUTED)
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
		"marketing": return _t("effect.marketing", {"n": JsMath.js_round(CoreEconomy.arrival_rate(s) * CoreData.DAY_SECONDS)})
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
	if id == "cook":
		Paper.say(r["level"], _t("upgrade.cook.stage", {"n": level + 1.0, "total": def["max"] + 1.0}) if s["kitchen"] else "")
	else:
		r["level"].text = "%s/%s" % [JsMath.number_to_string(level), JsMath.number_to_string(most)]
	var after := s.duplicate(false)
	after["upgrades"] = s["upgrades"].duplicate()
	after["upgrades"][id] = minf(most, level + q["count"])
	# A locked upgrade has no "after" to show, and money is not what it is waiting for.
	var locked := CoreEconomy.upgrade_locked(s, id)
	r["sub"].text = "%s · %s%s%s" % [_upgrade_desc(id), _upgrade_effect(s, id), "" if maxed or locked else " → %s" % _upgrade_effect(after, id), " · %s" % _t("upgrade.server.roomLimit") if maxed and most < def["max"] else ""]
	Paper.set_priced(r["buy"], _t("btn.maxed") if maxed else ("+%s" % JsMath.number_to_string(q["count"]) if q["count"] > 1.0 else _t("btn.buy")), "" if maxed else _money(q["cost"]), not maxed and q["affordable"])
	_update_details(r, q["cost"], maxed or locked)
	if r.has("tablePreview"):
		var available: bool = s["phase"] == "prep" and CoreRegions.main_table_count(s) < CoreLayout.MAX_TABLES
		if not available:
			_ledger.table_preview = false
		r["tablePreview"].visible = available
		r["tablePreview"].text = _t("upgrade.tables.hidePreview" if _ledger.table_preview else "upgrade.tables.preview")


func _update_details(r: Dictionary, cost: float, hidden: bool = false) -> void:
	r["details"].visible = not hidden
	var coins: float = _session.state["coins"]
	r["details"].text = _t("money.short", {"money": _money(cost - coins)}) if cost > coins else _t("money.details")


# ---------------------------------------------------------------- the pantry

func _pantry_intro() -> void:
	_forecast = Paper.words("", "h3")
	_restock = Paper.button("", "primary", func() -> void:
		var bought := Restocking.restock(_session)
		if not bought.is_empty():
			_ui.dialogs.note(_t("prep.bought", {"items": bought}))
			_ledger.bought("ingredient", "restock"))
	_restock.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_restock_reason = Paper.words("", "muted")
	_list.add_child(Paper.col([_forecast, Paper.words(_t("guide.pantryIntro" if _ledger.intro else "pantry.intro"), "muted"), _restock, _restock_reason], 8))


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
		var id: String = r["id"]
		var def: Dictionary = CoreEconomy.ingredient_def(id)
		var stock: float = s["pantry"][id]
		var need: float = needs.get(id, 0.0)
		var cost: float = def["cost"] * _ledger.pantry_amount()
		var names := CoreEconomy.used_by(s, id).map(func(m: Dictionary) -> String: return I18n.item_name(m["id"]))
		r["sub"].text = "%s\n%s" % [_t("pantry.stock", {"n": CoreFormat.format_number(stock), "price": _money(def["cost"])}), _t("pantry.usedBy", {"items": UiWords.join(names)})]
		r["level"].visible = false
		r["bar"].value = minf(1.0, stock / need) if need > 0.0 else 1.0
		r["sub"].add_theme_color_override("font_color", Paper.DANGER if need > 0.0 and stock < need else Paper.MUTED)
		Paper.set_priced(r["buy"], _t("pantry.buy", {"n": _ledger.pantry_amount()}), _money(cost), cost <= s["coins"])
		_update_details(r, cost)
		r["card"].add_theme_stylebox_override("panel", Paper.row_box(_ledger.shortfall(id)))
