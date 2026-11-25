class_name CafeUi
extends CanvasLayer

## The screens over the building (src/main.ts): the HUD, the ledger, dialogs, the street, arranging and the opening flow.
## It answers what the rules tell, and tells them what is open.

## Four times a second, for what shows time passing.
signal heartbeat
## Another café's save is on the disk: the game starts again with it.
signal imported
const LOCALES := [["en", "English"], ["zh", "中文"]]
var session: CoreGameSession
var feed: FloorsFeed
var scene: FloorsScene
var dialogs := PaperDialogs.new()
var hud: CafeHud
var ledger: CafeLedger
var guide: FirstServiceGuide
var life: CafeLife
var street: StreetMap = null
var onboarding: Onboarding = null
var _root := Control.new()
## Where a detour to the pantry came from: {"browsing", "shortage"}, or null.
var _detour: Variant = null
var _arrange_bar: PanelContainer
var _arrange_words := Paper.words("", "strong")
var _arrange_store: Button
var _arrange_done: Button
## The ledger was open when arranging began.
var _arrange_from_ledger := false
var _return: Button
var _returning := Callable()
var _table_detached := false
var _intro := false
var _notice := PanelContainer.new()
var _notice_words := Paper.words("", "name")
var _temporary := Paper.words("", "small")
var _top := 0.0
var _bottom := 0.0
## How much of the screen's height, in pixels of the phone, the keyboard covers; tests put one there.
static var keyboard := func() -> int: return DisplayServer.virtual_keyboard_get_height() if DisplayServer.has_feature(DisplayServer.FEATURE_VIRTUAL_KEYBOARD) else 0
var _keyboard := 0.0


func _init(core: CoreGameSession, told: FloorsFeed, building: FloorsScene) -> void:
	session = core
	feed = told
	scene = building
	Portraits.use(building.library)
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.theme = Paper.theme()
	add_child(_root)
	hud = CafeHud.new(self)
	guide = FirstServiceGuide.new(self)
	life = CafeLife.new(self)
	ledger = CafeLedger.new(self)
	_root.add_child(hud)
	_root.add_child(guide)
	_root.add_child(life)
	_build_arrange()
	_build_return()
	_root.add_child(ledger)
	_root.add_child(dialogs)
	_build_notices()
	dialogs.changed.connect(_flags.unbind(1))
	hud.opened.connect(_opened)
	session.ui.connect(_told)
	scene.tapped.connect(_tapped)
	scene.wall_opened.connect(set_wall.bind(false))
	scene.spot_tapped.connect(_place_at)
	scene.piece_tapped.connect(_pick_up)


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


## Keeps clear of the phone's notch and gesture bar.
func inset(top: float, bottom: float) -> void:
	_top = top
	_bottom = bottom
	hud.inset(top, bottom)
	_lift()
	dialogs.note_top = top + 84.0
	if street != null:
		street.inset(top, bottom)
	guide.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	guide.grow_vertical = Control.GROW_DIRECTION_BEGIN
	guide.offset_left = 12.0
	guide.offset_right = -12.0
	guide.offset_bottom = -92.0 - bottom
	guide.offset_top = -92.0 - bottom
	life.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	life.grow_vertical = Control.GROW_DIRECTION_BEGIN
	life.offset_left = 12.0
	life.offset_bottom = -92.0 - bottom
	life.offset_top = -92.0 - bottom
	_arrange_bar.offset_bottom = -14.0 - bottom
	_arrange_bar.offset_top = -14.0 - bottom
	_temporary.offset_top = top
	_return.offset_bottom = -92.0 - bottom
	_return.offset_top = -92.0 - bottom


## On the first day the ledger shows only what the day needs, until the guide or the player goes further.
func follow_guide() -> void:
	if _intro != guide.simplify():
		_intro = guide.simplify()
		ledger.set_intro(_intro)


## What is open, for the rules.
func _flags() -> void:
	session.modal_open = dialogs.is_open() or street != null
	session.street_open = street != null
	feed.suspended = street != null
	session.drawer_paused = ledger.visible
	session.panel_collapsed = not ledger.visible
	session.onboarding_open = onboarding != null


func refresh() -> void:
	ledger.refresh()
	hud.update()
	if street != null:
		street.update()


## What is typed into stays over the keyboard.
func _lift() -> void:
	var bottom := maxf(_bottom, _keyboard)
	ledger.inset(_top, bottom)
	dialogs.margins(_top, bottom)
	if onboarding != null:
		onboarding.inset(_top, bottom)


func _process(_dt: float) -> void:
	# Without something to type into there is no keyboard, whatever the system last said.
	var typing := _root.is_inside_tree() and _root.get_viewport().gui_get_focus_owner() is LineEdit
	var pixels: int = keyboard.call() if typing else 0
	var now := 0.0 if pixels <= 0 else pixels * _root.size.y / maxf(1.0, get_window().size.y)
	if absf(now - _keyboard) < 1.0:
		return
	_keyboard = now
	_lift()
	# Once the screen has shrunk, the entry is brought back into sight.
	await get_tree().process_frame
	await get_tree().process_frame
	var typed := _root.get_viewport().gui_get_focus_owner()
	var at: Node = typed
	while at != null and not at is ScrollContainer:
		at = at.get_parent()
	if at is ScrollContainer:
		(at as ScrollContainer).ensure_control_visible(typed)


func set_language(locale: String) -> void:
	I18n.locale = locale
	_temporary.text = _t("save.temporary")
	session.storage.set_preference(I18n.LOCALE_KEY, locale)
	guide.update()
	refresh()


## The phone's back button. False when there is nothing left to close.
func back() -> bool:
	if not session.notice.is_empty():
		return false
	if onboarding != null:
		onboarding.back()
		return true
	if dialogs.back():
		return true
	if street != null:
		street.back()
		return true
	if arranging():
		_arrange_done.pressed.emit()
		return true
	if _return.visible:
		_return.pressed.emit()
		return true
	if ledger.visible:
		set_ledger(false)
		return true
	if hud.expanded:
		hud.set_expanded(false)
		return true
	return false


# ---------------------------------------------------------------- what the rules tell

func _told(what: String, args: Array) -> void:
	match what:
		"toast": dialogs.note(args[0])
		"tick": _tick()
		"hud":
			guide.update()
			follow_guide()
			hud.update()
		"refresh": refresh()
		"brand":
			ledger.update()
			hud.update()
		"state":
			arrange_stop()
			_detour = null
			guide.reset()
			ledger.set_state()
		"panel": set_ledger(false)
		"area": pass
		"showArrange": arrange_stop()
		"arrange": arrange_browse()
		"saved": _show_notice()
		"onboarding": _start_onboarding()
		"prepare": show_prepare()
		"firstOpening": FirstOpening.show_opening(self, args[0])
		"report":
			_return_from_detour()
			dialogs.hush()
			SettlementDialog.show_report(self, args[0])
		"soldOut": SmallDialogs.sold_out(dialogs, session)
		"recommend": _recommend(args[0], args[1])
		"modal": _ask(args[0], args[1])
	_flags()


func _tick() -> void:
	life.update(session.state, session.sim.customers, not session.scene_paused and not hud.expanded and not arranging() and street == null and not guide.visible)
	ledger.heartbeat()
	if street != null:
		street.update()
	_keep_table_preview()
	if _detour != null:
		if session.state["phase"] == "prep":
			_return_from_detour()
		else:
			ledger.set_pantry_task(_pantry_task(_detour["shortage"]))
	heartbeat.emit()


func _ask(title: String, lines: Array) -> void:
	var body := Paper.col([])
	for text: String in lines:
		body.add_child(Paper.words(text))
	if title == _t("day.closeConfirm.title"):
		dialogs.show_dialog(title, body, [{"label": _t("day.closeConfirm.keep"), "kind": "primary"}, {"label": _t("day.close"), "kind": "danger", "pressed": session.close_day.bind(true)}])
	elif title == _t("day.finishNow"):
		dialogs.show_dialog(title, body, [{"label": _t("day.keepServing")}, {"label": _t("day.finishNow"), "kind": "danger", "pressed": session.finish_now}])
	else:
		dialogs.show_dialog(title, body, [{"label": _t("away.collect"), "kind": "primary"}], {"icon": owner_icon()})


func _recommend(id: Variant, options: Array) -> void:
	for c: Dictionary in session.sim.customers:
		if c["id"] == id:
			SmallDialogs.recommend(dialogs, session, c, options)
			return


func owner_icon() -> Control:
	var profile: Variant = session.state["profile"]
	return Portraits.person(profile["look"] if profile != null else {"skin": 0.0, "hair": 1.0, "hairStyle": 1.0, "shirt": 0.0, "pants": 0.0}, 40.0)


func show_prepare() -> void:
	PrepareDialog.show_prepare(self, session.start_day, session.stock_changed)


func kitchen_opened() -> void:
	session.save_game()
	refresh()
	dialogs.note(_t("area.opened", {"name": _t("area.kitchen.name")}))
	for _i in 16:
		feed.effects.append("sparkle")


# ---------------------------------------------------------------- the HUD's doors

func _opened(what: String) -> void:
	match what:
		"status": show_status()
		"pantry": open_pantry()
		"reputation": SmallDialogs.reputation(dialogs, session.state)
		"partners": PartnerDialog.show_partners(self)
		"regulars": RegularsDialog.show_regulars(self)
		"style": StyleDialog.show_styles(self, _style_changed)
		"settings": SettingsDialog.show_settings(self)


func _style_changed() -> void:
	session.save_game()
	refresh()


## What is holding service up, and what would help.
func show_status() -> void:
	if not session.interaction_enabled():
		return
	var s := session.state
	var status: Dictionary = CoreOperations.operation_status(s, session.sim) if s["phase"] == "closing" else session.status
	var kind: String = status["kind"]
	if kind == "ingredients":
		open_pantry(true)
		return
	var body := Paper.col([Paper.words(_t("ops.%s.detail" % kind))])
	if status.get("item") is String:
		var extra := I18n.item_name(status["item"])
		var missing: Variant = status.get("ingredients")
		if missing is Array and not missing.is_empty():
			extra += " · %s" % UiWords.join(missing.map(UiWords.ingredient))
		if status.get("seconds") is float:
			extra += " · %s" % _t("ops.workRemaining", {"n": status["seconds"]})
		body.add_child(Paper.words(extra))
	if s["phase"] == "open":
		var traffic := CoreTraffic.traffic_at(s["dayTime"])
		body.add_child(Paper.words("%s %s" % [_t("flow.traffic.next", {"phase": _t("flow.traffic.%s" % traffic["nextPhase"]), "seconds": ceilf(traffic["secondsToNextPhase"])}), _t("flow.traffic.about")], "muted"))
	var buttons: Array = [{"label": _t("settings.back"), "kind": "primary"}]
	if kind not in ["closing", "steady"]:
		buttons.append({"label": _t("tab.upgrades"), "pressed": show_tab.bind("upgrades")})
	dialogs.show_dialog(_t("ops.%s" % kind), body, buttons)


func set_wall(up: bool) -> void:
	feed.outer_wall = up
	hud.update()


# ---------------------------------------------------------------- the ledger

func set_ledger(open: bool) -> void:
	_cancel_detour()
	if open:
		hud.set_expanded(false)
		_return.visible = false
	ledger.set_open(open)
	_flags()


func show_tab(tab: String) -> void:
	_return.visible = false
	set_ledger(true)
	ledger.show_tab(tab)


## The player went somewhere of their own accord: a detour has no way back any more.
func navigated() -> void:
	if _detour != null:
		_cancel_detour()


func show_in_ledger(control: Control) -> void:
	ledger.reveal(control)


func _pantry_task(shortage: bool) -> Dictionary:
	var s := session.state
	if s["phase"] == "closing":
		return {"title": _t("flow.pantryTitle"), "detail": _t("flow.closingStock"), "ingredients": []}
	var now := CoreOperations.operation_status(s, session.sim)
	var missing: Variant = now.get("ingredients")
	if shortage and now["kind"] == "ingredients" and now.get("item") is String and missing is Array and not missing.is_empty():
		return {"title": _t("flow.shortageTitle"), "detail": _t("flow.shortageDetail", {"item": I18n.item_name(now["item"], s), "ingredients": UiWords.join(missing.map(UiWords.ingredient))}), "ingredients": missing}
	return {"title": _t("flow.pantryTitle"), "detail": _t("flow.shortageResolved" if shortage else "flow.pantryDetail"), "ingredients": []}


## A look at the pantry during service, with a way back to what was being read.
func open_pantry(shortage: bool = false) -> void:
	if session.state["phase"] == "prep" or not session.interaction_enabled() or arranging():
		return
	if _detour != null:
		_detour["shortage"] = _detour["shortage"] or shortage
		return
	var before := ledger.browsing()
	ledger.set_open(true)
	ledger.show_tab("pantry")
	_detour = {"browsing": before, "shortage": shortage}
	ledger.set_pantry_task(_pantry_task(shortage))
	if shortage:
		ledger.to_top()
	_flags()


func _cancel_detour() -> void:
	if _detour != null:
		_detour = null
		ledger.set_pantry_task(null)


func _return_from_detour() -> void:
	if _detour == null:
		return
	var before: Dictionary = _detour["browsing"]
	_cancel_detour()
	ledger.set_open(false)
	ledger.restore(before)
	_flags()


# ---------------------------------------------------------------- a look at the room, and back to the ledger

func _build_return() -> void:
	_return = Paper.firm(Paper.button("", "primary", func() -> void:
		_return.visible = false
		if _returning.is_valid():
			_returning.call()))
	_return.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_return.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_return.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_return.visible = false
	_root.add_child(_return)


func _offer_return(label: String, back_to: Callable) -> void:
	_return.text = label
	_returning = back_to
	_return.visible = true


## Shows where the next table would stand.
func preview_table() -> void:
	_table_detached = true
	var before := ledger.browsing()
	ledger.set_open(false)
	ledger.table_preview = true
	_flags()
	_offer_return(UiWords.here("返回升级", "Back to upgrades"), func() -> void:
		_table_detached = false
		ledger.clear_table_preview()
		feed.table_preview = false
		set_ledger(true)
		ledger.restore(before))


func _keep_table_preview() -> void:
	if not _table_detached:
		ledger.clear_table_preview()
	if session.scene_paused or arranging() or session.state["phase"] != "prep" or CoreRegions.main_table_count(session.state) >= CoreLayout.MAX_TABLES:
		ledger.clear_table_preview()
	if not ledger.table_preview and _table_detached:
		_table_detached = false
		_return.visible = false
	feed.table_preview = ledger.table_preview


func locate_cat(id: String) -> void:
	var before := ledger.browsing()
	var was_open := ledger.visible
	dialogs.close()
	if session.locate_resident(id) == null:
		return
	ledger.set_open(false)
	_flags()
	scene.cats.locate(id)
	feed.selected_cat = id
	feed.cat_selection_seconds = 6.0
	_offer_return(UiWords.here("返回猫咪详情", "Back to cats"), func() -> void:
		show_tab("pets")
		if was_open:
			ledger.restore(before))


# ---------------------------------------------------------------- taps in the building

func _tapped(target: Dictionary) -> void:
	match target["kind"]:
		"moment": session.open_moment()
		"gift": session.pick_up_gift(target["id"])
		"partner": PartnerDialog.show_partners(self, target["id"])
		"cat": _tap_cat(target)
		"cafe": session.help_brew()
	_flags()


## A resident is marked and petted, the visiting cat just petted; a tap on a marked resident's name opens its card.
func _tap_cat(target: Dictionary) -> void:
	if not target.has("id"):
		feed.cat_happy = 2.0
		return
	var id: String = target["id"]
	feed.selected_cat = id
	feed.cat_selection_seconds = 6.0
	for pet: Dictionary in session.state["pets"]:
		if pet["id"] == id and target.get("card", false):
			LivingCatCard.show_cat(dialogs, pet, session.cats.actors.get(id), session.greet_resident.bind(id), locate_cat.bind(id))
			return
	session.greet_resident(id)


# ---------------------------------------------------------------- arranging furniture

func _build_arrange() -> void:
	_arrange_bar = Paper.card("sheet")
	_arrange_bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_arrange_bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_arrange_bar.offset_left = 12.0
	_arrange_bar.offset_right = -12.0
	_arrange_store = Paper.button("", "ghost", func() -> void:
		if arranging() and feed.arrange["mode"] == "place" and feed.arrange["moving"] >= 0:
			CoreFurniture.store_furniture(session.state, float(feed.arrange["moving"]))
		_release())
	_arrange_done = Paper.button("", "primary", func() -> void:
		if arranging() and feed.arrange["mode"] == "place":
			_release()
		else:
			arrange_stop())
	_arrange_bar.add_child(Paper.line([_arrange_words, _arrange_store, _arrange_done]))
	_arrange_bar.visible = false
	_root.add_child(_arrange_bar)


func arranging() -> bool:
	return feed.arrange != null


func arrange_browse() -> void:
	_cancel_detour()
	feed.arrange = {"mode": "browse"}
	feed.ghost = null
	_show_arrange()


func arrange_place(id: String) -> void:
	_cancel_detour()
	_hold(id, -1, arranging() and feed.arrange["mode"] == "browse")


## Picks a piece up: a new one starts at the free spot nearest the middle of the screen (floors_scene.gd).
func _hold(id: String, moving: int, from_browse: bool) -> void:
	feed.arrange = {"mode": "place", "id": id, "moving": moving, "fromBrowse": from_browse}
	feed.ghost = {"id": id, "skip": moving}
	if moving >= 0 and session.state["decor"]["placed"][moving].get("spot") is String:
		feed.ghost["spot"] = session.state["decor"]["placed"][moving]["spot"]
	_show_arrange()


func _pick_up(index: int) -> void:
	if arranging() and feed.arrange["mode"] == "browse" and index < session.state["decor"]["placed"].size():
		_hold(session.state["decor"]["placed"][index]["id"], index, true)


func _place_at(spot: String) -> void:
	if not arranging() or feed.arrange["mode"] != "place":
		return
	var s := session.state
	var ok: bool = CoreFurniture.move_to_spot(s, float(feed.arrange["moving"]), spot) if feed.arrange["moving"] >= 0 else CoreFurniture.stand_furniture(s, feed.arrange["id"], spot)
	if not ok:
		# Where it was tapped, in red, so it is clear why.
		if feed.ghost != null:
			feed.ghost["spot"] = spot
		dialogs.note(_t("arrange.blocked"))
		return
	for _i in 16:
		feed.effects.append("sparkle")
	_release()


## Back to browsing if the player came from there, otherwise done arranging.
func _release() -> void:
	var again: bool = arranging() and feed.arrange.get("fromBrowse", false)
	feed.arrange = {"mode": "browse"} if again else null
	feed.ghost = null
	session.save_game()
	_show_arrange()
	ledger.update()


func arrange_stop() -> void:
	if arranging() or feed.ghost != null:
		feed.arrange = null
		feed.ghost = null
		_show_arrange()


func _show_arrange() -> void:
	hud.set_expanded(false)
	session.arranging = arranging()
	if arranging() and ledger.visible:
		_arrange_from_ledger = true
		ledger.set_open(false)
	elif not arranging() and _arrange_from_ledger:
		_arrange_from_ledger = false
		ledger.set_open(true)
	_flags()
	_arrange_bar.visible = arranging()
	hud.update()
	if not arranging():
		return
	var place: bool = feed.arrange["mode"] == "place"
	var moving: int = feed.arrange.get("moving", -1)
	_arrange_words.text = _t("arrange.browse") if not place else _t("arrange.spot" if not CoreFurniture.open_spots(session.state, feed.arrange["id"], float(moving)).is_empty() else "arrange.full", {"name": LedgerDecor.name(feed.arrange["id"])})
	_arrange_store.visible = place and moving >= 0
	_arrange_store.text = _t("arrange.store")
	_arrange_done.text = _t("arrange.cancel" if place else "arrange.done")


# ---------------------------------------------------------------- the street, and another branch

func open_street() -> void:
	if street != null:
		return
	ledger.set_open(false)
	hud.set_expanded(false)
	street = StreetMap.new(self, func() -> void:
		session.save_game()
		refresh())
	_root.add_child(street)
	_root.move_child(street, dialogs.get_index())
	street.inset(_top, _bottom)
	_flags()


func close_street() -> void:
	if street != null:
		street.queue_free()
		street = null
		_flags()
		hud.update()


## Pick a place, then confirm what a new branch means.
func open_branch_map() -> void:
	if CoreChain.can_open_branch(session.state):
		ChainDialogs.show_map(dialogs, session.state, _confirm_branch)


func _confirm_branch(location: String) -> void:
	var s := session.state
	if not CoreChain.can_open_branch(s):
		return
	var stars := CoreChain.stars_on_branch(s)
	var here := CoreLocations.cafe_location(s)
	var body := Paper.col([])
	for text: String in [
		_t("chain.confirm.where", {"place": ChainDialogs.place(location)}),
		_t("chain.confirm.body", {"stars": stars, "bonus": CoreChain.chain_bonus_percent(CoreChainBonuses.stars_free(s) + stars)}),
		_t("chain.confirm.franchise", {"place": ChainDialogs.place(here), "money": CoreFormat.format_transaction_money(CoreManager.away_hourly(s) * CoreChain.FRANCHISE_SHARE), "bonus": ChainDialogs.bonus(here, CoreChainBonuses.franchises_in(s, here) + 1.0)}),
		_t("chain.confirm.resets"), _t("chain.confirm.keeps"), _t("chain.perks", {"pct": JsMath.js_round(CoreRegions.build_share(s["chain"]["branches"] + 1.0) * 100.0)}),
	]:
		body.add_child(Paper.words(text))
	dialogs.show_dialog(_t("chain.confirm.title"), body, [
		{"label": _t("chain.confirm.cancel"), "kind": "primary", "pressed": open_branch_map},
		{"label": _t("chain.confirm.ok"), "kind": "danger", "pressed": session.start_branch.bind(location)},
	], {"icon": owner_icon()})


# ---------------------------------------------------------------- the opening flow

func _start_onboarding() -> void:
	_show_onboarding(false, func(profile: Dictionary, picked: String) -> void:
		session.finish_onboarding(profile, picked))


func edit_profile() -> void:
	_show_onboarding(true, func(profile: Dictionary, _picked: String) -> void:
		session.apply_profile(profile)
		SettingsDialog.show_settings(self))


func _show_onboarding(editing: bool, done: Callable) -> void:
	if onboarding != null:
		onboarding.queue_free()
	onboarding = Onboarding.new(editing, session.state["profile"])
	_root.add_child(onboarding)
	# Only what cannot be saved is said over it.
	_root.move_child(onboarding, _notice.get_index())
	_lift()
	onboarding.language.connect(set_language)
	onboarding.done.connect(func(profile: Dictionary, picked: String) -> void:
		onboarding = null
		_flags()
		done.call(profile, picked))
	onboarding.cancelled.connect(func() -> void:
		onboarding = null
		_flags()
		SettingsDialog.show_settings(self))
	_flags()


## Puts another café in place of this one and starts with it.
func import_save(text: String) -> void:
	if session.replace_save(text):
		imported.emit()
	else:
		dialogs.note(UiWords.here("没能写入存档，这家店没有改动。", "The save could not be written. This café is unchanged."))


func reset_game() -> void:
	_cancel_detour()
	set_ledger(false)
	session.reset_game()


# ---------------------------------------------------------------- saving

func _build_notices() -> void:
	_notice.set_anchors_preset(Control.PRESET_FULL_RECT)
	_notice.add_theme_stylebox_override("panel", Paper.box(Paper.PAPER, Color.TRANSPARENT, 0, 0, Vector2(32, 32)))
	_notice_words.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_notice_words.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_notice.add_child(_notice_words)
	_notice.visible = false
	_root.add_child(_notice)
	_temporary.add_theme_stylebox_override("normal", Paper.box(Color8(0xff, 0xf0, 0xc2), Color.TRANSPARENT, 0, 0, Vector2(12, 6)))
	_temporary.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_temporary.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_temporary.visible = session.session.mode == "temporary"
	_temporary.text = _t("save.temporary")
	_root.add_child(_temporary)


func _show_notice() -> void:
	_notice.visible = not session.notice.is_empty()
	match session.notice:
		"conflict": _notice_words.text = UiWords.here("存档已在别处更改。为保护进度，游戏已暂停。请重新打开游戏以载入最新存档。", "Your save changed elsewhere. The game is paused to protect your progress. Open it again to load the latest save.")
		"unavailable": _notice_words.text = UiWords.here("无法保存进度。请检查手机的可用空间；恢复后进度会自动保存。", "Progress could not be saved. Check the phone's free space; saving will retry automatically.")
