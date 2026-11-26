extends SceneTree

## The game as it starts on a phone (scenes/cafe.tscn), played for a while without a screen: the opening flow, the guide,
## serving, the HUD and what main.ts does around the screens, taps, walls, arranging, saving, going to the background and
## starting again. What each screen says is compared with the page's in run_ui.gd.

## A disk that takes everything but some keys.
class PickyStore extends CoreStorage.MemoryStore:
	var refused: Array = []
	## It fails the first time only.
	var once := false

	func set_item(key: String, value: String) -> bool:
		if once:
			once = false
			return false
		return not refused.has(key) and super(key, value)


var passed := 0
var failed := 0
var _dir := ""
var _app: Node


func _init() -> void:
	_dir = OS.get_temp_dir().path_join("bean-app-%d" % OS.get_process_id())
	_play.call_deferred()


func _check(label: String, ok: bool, more: Variant = "") -> void:
	if ok:
		passed += 1
	else:
		failed += 1
		print("FAIL: %s %s" % [label, more])


func _launch() -> void:
	_app = load("res://scenes/cafe.tscn").instantiate()
	_app.save_dir = _dir
	_app.chance = 20251125
	root.add_child(_app)
	await process_frame
	await process_frame


func _frames(n: int, dt: float = 1.0 / 60.0) -> void:
	for _i in n:
		CoreClock.override += dt * 1000.0
		_app._process(dt)
	await process_frame


## The buttons of what is on top, in order.
func _buttons(of: Control = null) -> Array:
	var ui: CafeUi = _app.ui
	if of == null:
		of = ui.onboarding if ui.onboarding != null else (ui.dialogs.get("_box") if ui.dialogs.is_open() else (ui.street if ui.street != null else (ui.ledger if ui.ledger.visible else ui.hud)))
	var out := []
	for b: Node in of.find_children("*", "Button", true, false):
		if (b as Button).is_visible_in_tree() and not b.is_queued_for_deletion():
			out.append(b)
	return out


static func _words_of(b: Button) -> String:
	var said := b.text
	for l: Node in b.find_children("*", "Label", true, false):
		said += (l as Label).text
	return said


## Presses the button on top that says it; whether there was one.
func _press(says: String, of: Control = null) -> bool:
	for b: Button in _buttons(of):
		if _words_of(b).contains(says) and not b.disabled:
			b.pressed.emit()
			await _frames(1)
			return true
	_check("there is a button \"%s\"" % says, false, _buttons(of).map(_words_of))
	return false


## What the dialog on top is called.
func _title() -> String:
	var box: Control = _app.ui.dialogs.get("_box")
	return (box.find_children("*", "Label", true, false)[0] as Label).text if box != null else ""


func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


## How many of the scene's pictures and words show a part of the effects.
func _shown(what: String) -> int:
	return _app.scene.get_children().filter(func(c: Node) -> bool: return not c.is_queued_for_deletion() and ((c is FloorsPic and c.key == "fx" and str(c.frame) == what) or (c is FloorsText and c.label.text.begins_with(what)))).size()


## What sales, help and tips throw over the room, and that it goes away again.
func _effects() -> void:
	var s: CoreGameSession = _app.session
	var scene: FloorsScene = _app.scene
	_app.ui.dialogs.close()
	_app.ui.set_ledger(false)
	await _frames(2)
	var sparkles := _shown("sparkle")
	_app.feed.sales.append({"amount": 12.0, "vip": false})
	_app.feed.sales.append({"amount": 34.0, "vip": true})
	await _frames(1)
	_check("a sale is a coin and its amount", _shown("coin") == 2 and _shown("+$12") == 1 and _shown("+$34") == 1, [_shown("coin"), _shown("+$12")])
	_check("a VIP's has sparkles", _shown("sparkle") == sparkles + 6, _shown("sparkle"))
	_app.feed.tips.append({"amount": 5.0})
	_app.feed.labels.append({"text": "Helped"})
	_app.feed.effects.append("bell")
	await _frames(1)
	_check("a tip, a helping word and the bell show", _shown("tip") == 1 and _shown("+$5") == 1 and _shown("Helped") == 1 and _shown("sparkle") > sparkles + 6, _shown("sparkle"))
	_check("and are shown once", _app.feed.sales.is_empty() and _app.feed.tips.is_empty() and _app.feed.labels.is_empty() and _app.feed.effects.is_empty())
	var from := Time.get_ticks_msec()
	while Time.get_ticks_msec() - from < 4000 and _shown("+$") + _shown("coin") + _shown("Helped") > 0:
		await process_frame
	_check("then it is gone", _shown("+$") + _shown("coin") + _shown("Helped") == 0)


## A piece in hand goes to the spot under the tap, within a finger's reach of it.
func _arranging() -> void:
	var scene: FloorsScene = _app.scene
	var spots := []
	var keep := func(id: String) -> void: spots.append(id)
	scene.spot_tapped.connect(keep)
	var piece := ""
	for def: Dictionary in CoreFurniture.FURNITURE:
		if def["surface"] == "floor" and def["cost"] > 0.0:
			piece = def["id"]
			break
	_app.feed.arrange = {"mode": "place", "id": piece, "moving": -1}
	await _frames(1)
	var reach := 26.0 / scene.zoom
	for spot: Dictionary in FloorsLayout.FURNITURE_SPOTS:
		if spot["surface"] != "floor" or not scene.built["offsets"].has(spot["floor"]):
			continue
		var at := FloorsLayout.world_point(scene.built, spot) - Vector2(0.0, 60.0)
		spots.clear()
		scene.tap(at)
		_check("a tap on %s is that spot's" % spot["id"], spots == [spot["id"]], spots)
		spots.clear()
		# Just inside the reach over it, and just past it.
		scene.tap(at - Vector2(0.0, 140.0 + reach - 4.0))
		_check("so is one within reach of it", not spots.is_empty(), spots)
		spots.clear()
		scene.tap(at - Vector2(0.0, 140.0 + reach + 4.0))
		_check("one past its reach is not", spot["id"] not in spots, spots)
		break
	var pieces := []
	var index := func(i: int) -> void: pieces.append(i)
	scene.piece_tapped.connect(index)
	_app.feed.arrange = {"mode": "browse"}
	await _frames(2)
	for p: Dictionary in scene.get("_placed"):
		if p["pic"].visible:
			scene.tap(p["pic"].bounds().get_center())
			_check("a tap on a placed piece picks one up", pieces.size() == 1, pieces)
			break
	_app.feed.arrange = null
	scene.spot_tapped.disconnect(keep)
	scene.piece_tapped.disconnect(index)
	await _frames(1)


func _touch(at: Vector2, down: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.position = at
	e.pressed = down
	root.push_input(e)


func _drag(at: Vector2, by: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.position = at
	e.relative = by
	root.push_input(e)


## A finger on the glass: a tap, a drag, and a press that lets go of the cat the building was following.
func _touching() -> void:
	var s: CoreGameSession = _app.session
	var scene: FloorsScene = _app.scene
	var targets := []
	var keep := func(t: Dictionary) -> void: targets.append(t)
	scene.tapped.connect(keep)
	var middle := Vector2(206.0, 420.0)
	_touch(middle, true)
	_touch(middle, false)
	await _frames(1)
	_check("a touch is a tap", targets.size() == 1, targets)
	targets.clear()
	scene.focus_on(scene.built["street"] - 900.0)
	await _frames(60)
	var rest := scene.focus_y
	_touch(middle, true)
	_drag(middle - Vector2(0.0, 60.0), Vector2(0.0, -60.0))
	_touch(middle - Vector2(0.0, 60.0), false)
	await _frames(1)
	_check("a drag moves the building with the finger", absf(scene.focus_y - rest - 60.0 / scene.zoom) < 1.0, [rest, scene.focus_y])
	_check("and is not a tap", targets.is_empty(), targets)
	s.state["phase"] = "prep"
	CoreEconomy.earn(s.state, 1e9)
	_check("a cat moves in", CorePets.adopt_cat(s.state, CorePets.CATS[0]["id"]))
	await _frames(240)
	var id: String = CorePets.CATS[0]["id"]
	_app.feed.selected_cat = id
	_app.feed.cat_selection_seconds = 60.0
	_check("a cat can be found", scene.cats.locate(id))
	await _frames(120)
	_check("the building follows it", scene.cats.following == id)
	_touch(middle, true)
	_check("a press lets go of it", scene.cats.following == "")
	_drag(middle - Vector2(0.0, 80.0), Vector2(0.0, -80.0))
	_touch(middle - Vector2(0.0, 80.0), false)
	var left := scene.focus_y
	await _frames(60)
	_check("and the building stays where the finger left it", absf(scene.focus_y - left) < 0.01, [left, scene.focus_y])
	scene.tapped.disconnect(keep)


## Opening the café for the first time, with the guide beside it.
func _first_day() -> void:
	var s: CoreGameSession = _app.session
	var ui: CafeUi = _app.ui
	_check("the first launch asks who the owner is", s.onboarding_open and ui.onboarding != null)
	_check("and the café waits behind it", not s.interaction_enabled())
	await _press("English")
	_check("in the language picked", I18n.locale == "en" and s.storage.preference(I18n.LOCALE_KEY) == "en")
	_check("with a name to suit", ui.onboarding.draft["cafeName"] in I18n.list("ob.names"), ui.onboarding.draft["cafeName"])
	await _press("中文")
	await _press(_t("ob.start"))
	var entry: LineEdit = ui.onboarding.find_children("*", "LineEdit", true, false)[0]
	entry.text = "  "
	entry.text_changed.emit("  ")
	await _press(_t("ob.next"))
	_check("a café needs a name", ui.onboarding.index == 1)
	entry = ui.onboarding.find_children("*", "LineEdit", true, false)[0]
	entry.text = "夜雨小店"
	entry.text_changed.emit("夜雨小店")
	await _press(_t("ob.next"))
	var look: Dictionary = ui.onboarding.draft["look"].duplicate()
	await _press(UiWords.here("使用样板店主造型", ""))
	_check("the owner can be dressed", ui.onboarding.draft["look"]["shirt"] == 2.0 and ui.onboarding.draft["look"].size() == look.size())
	ui.back()
	await _frames(1)
	_check("the back button goes a step back", ui.onboarding.index == 1)
	await _press(_t("ob.next"))
	await _press(_t("ob.next"))
	await _press(_t("theme.%s" % CoreDecor.STARTER_THEMES[1]["id"]))
	await _press(_t("ob.next"))
	await _press(_t("ob.open.button"))
	_check("the café has its name", s.state["profile"]["cafeName"] == "夜雨小店" and s.state["profile"]["look"]["shirt"] == 2.0)
	_check("and its style", s.state["decor"]["equipped"]["wallpaper"] == CoreDecor.STARTER_THEMES[1].get("wallpaper", s.state["decor"]["equipped"]["wallpaper"]))
	_check("then the first opening, step by step", s.modal_open and _title() == _t("opening.title"), _title())
	await _press(_t("opening.later"))
	_check("which can wait", not s.modal_open and ui.guide.visible and s.guide_simplify)
	_check("with its own button in the guide", await _press(_t("guide.stock.action"), ui.guide) and s.modal_open)
	await _press(_t("opening.stock.next"))
	_check("the guide remembers the stock", s.guide_opening_step == "menu", s.guide_opening_step)
	await _press(_t("opening.menu.next"))
	await _press(_t("opening.open.next"))
	_check("which opens the first day", s.state["phase"] == "open" and not s.modal_open)
	await _frames(30)
	_check("the guide goes on", ui.guide.visible and s.state["phase"] == "open")
	_check("the tools stay simple meanwhile", s.guide_simplify and not s.hint_shown)
	# The first day's ledger has only what the day needs.
	ui.show_tab("menu")
	await _frames(1)
	var rows := func() -> int: return (ui.ledger.get("_list") as Control).get_child_count()
	var tools := func() -> int: return (ui.ledger.get("_tools") as Control).get_child_count()
	var simple: int = rows.call()
	_check("the first day's menu is the owned dishes, without amounts and kinds", ui.ledger.intro and tools.call() == 0, [simple, tools.call()])
	ui.show_tab("pantry")
	await _frames(1)
	_check("and its pantry says how to begin", ui.ledger.find_children("*", "Label", true, false).any(func(l: Node) -> bool: return (l as Label).text == _t("guide.pantryIntro")))
	ui.set_ledger(false)
	await _unfold(ui.guide)
	await _press(_t("guide.tools"), ui.guide)
	ui.show_tab("menu")
	await _frames(1)
	_check("all the tools are there when asked for", not ui.ledger.intro and tools.call() > 0 and rows.call() > simple)
	ui.set_ledger(false)
	await _unfold(ui.guide)
	await _press(_t("guide.skip"), ui.guide)
	await _frames(20)
	_check("and the guide can be skipped", not ui.guide.visible and not s.guide_simplify and s.hint_shown)
	ui.guide.reset()


## The HUD, and what main.ts does around the screens during service.
func _service() -> void:
	var s: CoreGameSession = _app.session
	var ui: CafeUi = _app.ui
	ui.hud.set_expanded(true)
	await _frames(1)
	_check("the sheet of more tools holds the manager back", s.mobile_hud_expanded)
	await _press("2×")
	_check("the speed can be set there", s.state["speed"] == 2.0)
	await _press("1×")
	await _press(_t("hud.settings"))
	_check("settings open over the café", s.modal_open and _title() == _t("settings.title"))
	_check("and close the sheet", not ui.hud.expanded)
	await _press("English")
	_check("the language changes at once", I18n.locale == "en" and _title() == "Café Office", _title())
	await _press("中文")
	await _press(_t("settings.edit"))
	_check("the owner can be edited", s.onboarding_open and not s.modal_open)
	ui.back()
	await _frames(1)
	_check("or not", not s.onboarding_open and _title() == _t("settings.title"))
	await _press(_t("settings.back"))
	# A look at the pantry, and back to what was being read.
	ui.set_ledger(true)
	_check("the ledger pauses the café", s.drawer_paused and not s.panel_collapsed)
	ui.show_tab("decor")
	ui.set_ledger(false)
	_check("and closing it goes on", not s.drawer_paused and s.panel_collapsed)
	ui.open_pantry()
	await _frames(1)
	_check("a look at the pantry opens there", ui.ledger.visible and ui.ledger.tab == "pantry" and (ui.ledger.get("_task") as Control).visible)
	_check("without the other tabs", not (ui.ledger.get("_tab_row") as Control).visible)
	ui.set_ledger(false)
	_check("and leaves with it", not (ui.ledger.get("_task") as Control).visible and ui.ledger.get("_tab_row").visible)
	# What holds service up.
	ui.show_status()
	await _frames(1)
	_check("the status says how it goes", _title().begins_with(_t("ops.%s" % s.status["kind"])) or ui.ledger.visible, _title())
	ui.dialogs.close()
	ui.set_ledger(false)
	# Help: one thing to do is done at once, more are asked.
	s.state["upgrades"]["marketing"] = 20.0
	CoreEconomy.buy_ingredient(s.state, "beans", 400.0)
	s.state["pantry"]["beans"] = 400.0
	for _i in 120:
		await _frames(30)
		if s.service_help_options().size() > 1:
			break
	_check("there is more than one way to help", s.service_help_options().size() > 1, s.service_help_options())
	ui.hud.set_expanded(true)
	await _press(ui.hud.get("_help").words)
	_check("which is asked, with the sheet put away", s.modal_open and _title() == _t("flow.helpTitle") and not ui.hud.expanded and not s.mobile_hud_expanded, _title())
	var first: Dictionary = s.service_help_options()[0]
	await _press(first["title"])
	_check("and done", not s.sim.help_ready() and not s.modal_open)
	await _moments_and_gifts()
	# Someone with a story.
	var guest: Dictionary = CoreRegularGuestsContent.REGULAR_GUESTS[0]
	s.state["regularGuests"]["guests"][guest["id"]] = {"firstMetDay": 1.0, "served": 2.0, "unlockedChapters": [0.0], "readChapters": [], "lastUnlockDay": 1.0, "servedVisitIds": [], "pendingVisitIds": [], "pendingDay": 1.0}
	ui.life.set("_offered", {})
	ui.life.update(s.state, [{"regularGuestId": guest["id"], "phase": "seated"}], true)
	_check("a regular with a story offers it", ui.life.visible)
	await _press(_t("mobile.story", {"name": _t(guest["nameKey"])}), ui.life)
	_check("and tells it", s.modal_open and not ui.life.visible)
	await _press(_t("regular.ui.finish"))
	_check("once", 0.0 in s.state["regularGuests"]["guests"][guest["id"]]["readChapters"])
	ui.life.update(s.state, [{"regularGuestId": guest["id"], "phase": "seated"}], true)
	_check("and no more that day", not ui.life.visible)
	# Closing asks first.
	ui.hud.set_expanded(true)
	await _frames(1)
	await _press(_t("day.close"))
	_check("closing asks first", s.modal_open and _title() == _t("day.closeConfirm.title"))
	ui.back()
	await _frames(1)
	_check("and can be left with the back button", not s.modal_open and s.state["phase"] == "open")


## Furniture from the ledger to a spot of the building, and the other ways between the two.
func _between_ledger_and_room() -> void:
	var s: CoreGameSession = _app.session
	var ui: CafeUi = _app.ui
	var scene: FloorsScene = _app.scene
	ui.show_tab("decor")
	ui.ledger.choose_decor("furniture")
	var id := ""
	for def: Dictionary in CoreFurniture.FURNITURE:
		if def["category"] == "furniture" and def["surface"] == "floor" and def["cost"] > 0.0:
			id = def["id"]
			break
	await _frames(1)
	CoreEconomy.earn(s.state, 1e6)
	_check("furniture can be bought", CoreFurniture.buy_furniture(s.state, id))
	ui.arrange_place(id)
	await _frames(2)
	_check("placing it clears the ledger away", s.arranging and not ui.ledger.visible and (ui.get("_arrange_bar") as Control).visible)
	_check("and the HUD", not (ui.hud.get("_dock") as Control).visible and not s.service_help_allowed())
	var spot: String = CoreFurniture.open_spots(s.state, id)[0]["id"]
	scene.spot_tapped.emit(spot)
	await _frames(1)
	_check("a tap on a spot stands it there", s.state["decor"]["placed"].any(func(p: Dictionary) -> bool: return p.get("spot") is String and p["spot"] == spot))
	_check("and the ledger is back", not s.arranging and ui.ledger.visible)
	ui.arrange_browse()
	await _frames(2)
	var index: int = s.state["decor"]["placed"].size() - 1
	scene.piece_tapped.emit(index)
	_check("a placed piece can be picked up", ui.feed.arrange["mode"] == "place" and ui.feed.arrange["moving"] == index)
	await _press(_t("arrange.store"), ui.get("_arrange_bar"))
	_check("and put away", CoreFurniture.stored_count(s.state, id) == 1.0 and ui.feed.arrange["mode"] == "browse")
	ui.back()
	await _frames(1)
	_check("the back button ends arranging", not s.arranging and ui.ledger.visible)
	ui.set_ledger(false)
	# Where the next table would stand.
	s.state["phase"] = "prep"
	ui.show_tab("upgrades")
	ui.preview_table()
	await _frames(20)
	_check("the next table's place is shown in the room", not ui.ledger.visible and ui.feed.table_preview and (ui.get("_return") as Control).visible)
	ui.back()
	await _frames(1)
	_check("and the way back is to the upgrades", ui.ledger.visible and ui.ledger.tab == "upgrades" and not ui.feed.table_preview)
	ui.set_ledger(false)
	# The kitchen on offer: a finger that rests on the button over several heartbeats still presses it.
	s.state["coins"] = 1e6
	ui.hud.update()
	await _press(_t("area.kitchen.name"))
	await _frames(2)
	var build := Vector2.ZERO
	for b: Button in _buttons(ui.hud.get("_card")):
		if _words_of(b).contains(_t("area.kitchen.unlock")):
			build = b.get_global_rect().get_center()
	_finger(build, true)
	for _i in 10:
		await _frames(5, 0.1)
	_finger(build, false)
	await _frames(2)
	_check("the kitchen can be built from the HUD, however long the finger rests", s.state["kitchen"])
	# The street covers everything, and the phone's back button leaves it a layer at a time.
	await _press(UiWords.here("街道", ""))
	_check("the street covers the café", ui.street != null and s.modal_open and s.street_open and ui.feed.suspended)
	ui.street.set("_open", true)
	ui.street.update()
	ui.back()
	_check("the back button closes the lot first", ui.street != null and not ui.street.get("_open"))
	ui.back()
	await _frames(1)
	_check("then the street", ui.street == null and not s.modal_open and not ui.feed.suspended)
	_check("then nothing is left to close", not ui.back())


## The guide's fold, open or shut.
func _unfold(of: Control) -> void:
	for bar: Node in of.find_children("*", "PanelContainer", true, false):
		if bar.has_meta("fold") and not (bar.get_parent() as Control).get_meta("content").visible:
			var tap := InputEventMouseButton.new()
			tap.button_index = MOUSE_BUTTON_LEFT
			bar.gui_input.emit(tap)
	await _frames(1)


## What a tap in the building leads to: a moment, a gift, a cat.
func _moments_and_gifts() -> void:
	var s: CoreGameSession = _app.session
	var ui: CafeUi = _app.ui
	var scene: FloorsScene = _app.scene
	for c: Dictionary in s.sim.customers:
		if c["phase"] == "sitting" or c["phase"] == "queue":
			s.moments.active = {"kind": "recommend", "customerId": c["id"], "options": [c["order"]], "age": 0.0, "spot": null}
			break
	_check("a guest has a question", s.moments.active != null)
	scene.tapped.emit({"kind": "moment"})
	await _frames(1)
	_check("a tap on it opens it", _title() == _t("moment.recommend.title"), _title())
	ui.back()
	await _frames(1)
	_check("and the back button leaves it", not s.modal_open and s.moments.active == null)
	s.state["phase"] = "prep"
	CoreEconomy.earn(s.state, 1e6)
	var id: String = CorePets.CATS[1]["id"]
	CorePets.adopt_cat(s.state, id)
	s.state["phase"] = "open"
	s.state["catGifts"]["waiting"] = [{"id": 71.0, "cat": id, "kind": "leaf", "spot": 0.0}]
	scene.tapped.emit({"kind": "gift", "id": 71.0})
	_check("a tap on a gift picks it up", s.state["catGifts"]["waiting"].is_empty() and s.state["catGifts"]["found"].get("leaf", 0.0) == 1.0)
	await _frames(120)
	scene.tapped.emit({"kind": "cat", "id": id, "card": true})
	await _frames(1)
	_check("a tap on a cat's name opens its card", _title() == _t("pet.%s.name" % id), _title())
	await _press(_t("pet.living.locate"))
	_check("the cat can be found from there", scene.cats.following == id and (ui.get("_return") as Control).visible and not s.modal_open)
	await _press(UiWords.here("返回猫咪详情", ""), ui.get("_root"))
	_check("with a way back to its page", ui.ledger.visible and ui.ledger.tab == "pets" and not (ui.get("_return") as Control).visible)
	ui.set_ledger(false)
	scene.cats.following = ""


## Opening and closing everything leaves nothing behind.
func _nothing_left() -> void:
	var ui: CafeUi = _app.ui
	var round_trip := func() -> void:
		ui.open_street()
		await _frames(1)
		ui.close_street()
		for tab: String in CafeLedger.TABS:
			ui.show_tab(tab)
			for kind: String in (["decoration", "furniture", "renovation"] if tab == "decor" else []):
				ui.ledger.choose_decor(kind)
			await _frames(1)
		ui.set_ledger(false)
		for show: Callable in [SettingsDialog.show_settings.bind(ui), PartnerDialog.show_partners.bind(ui), RegularsDialog.show_regulars.bind(ui), SmallDialogs.reputation.bind(ui.dialogs, ui.session.state), MilestoneBook.show_book.bind(ui.dialogs, ui.session.state)]:
			show.call()
			await _frames(1)
			ui.dialogs.close()
		await _frames(1)
	await round_trip.call()
	await process_frame
	var orphans := Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT)
	var nodes := Performance.get_monitor(Performance.OBJECT_NODE_COUNT)
	for _i in 10:
		await round_trip.call()
	await process_frame
	await process_frame
	_check("opening and closing everything leaves no nodes behind", Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT) <= orphans and Performance.get_monitor(Performance.OBJECT_NODE_COUNT) <= nodes + 120, [orphans, Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT), nodes, Performance.get_monitor(Performance.OBJECT_NODE_COUNT)])


## The keyboard comes up over the lower part of the screen: what is typed into moves over it, and back.
func _keyboard() -> void:
	var ui: CafeUi = _app.ui
	var state: Dictionary = _app.session.state
	ui.edit_profile()
	ui.onboarding.next()
	await _frames(1)
	await _over_keyboard("the owner's name", ui.onboarding, _buttons(ui.onboarding)[-1])
	ui.back()
	ui.back()
	ui.dialogs.close()
	# What to bake this morning.
	var phase: String = state["phase"]
	state["phase"] = "prep"
	CoreEconomy.earn(state, 1e9)
	CoreKitchen.unlock_kitchen(state)
	for m: Dictionary in CoreData.MENU:
		if CoreEconomy.is_bakery(m["id"]) and CoreEconomy.can_prepare_item(state, m["id"]):
			state["items"][m["id"]] = maxf(1.0, state["items"].get(m["id"], 0.0))
			CoreEconomy.set_on_menu(state, m["id"], true)
	PrepareDialog.show_prepare(ui, func() -> void: pass, func() -> void: pass)
	await _frames(1)
	var box: Control = ui.dialogs.get("_box")
	var amount := await _over_keyboard("how many to bake", box, _buttons()[-1])
	# A number being typed is taken before what is pressed next.
	if amount != null:
		amount.grab_focus()
		amount.text = "7"
		await _press(_t("bake.all"))
		for _i in 3:
			await process_frame
		var plan: Dictionary = state["bakePlan"].duplicate()
		CoreEconomy.bake_for_forecast(state)
		_check("a number half typed does not undo the forecast", plan == state["bakePlan"], [plan, state["bakePlan"]])
	ui.dialogs.close()
	# The name of a drink of one's own.
	SignatureLab.show_lab(ui, func() -> void: pass)
	await _frames(1)
	var lab: SignatureLab = (ui.dialogs.get("_box") as Control).find_children("*", "VBoxContainer", true, false).filter(func(n: Node) -> bool: return n.has_meta("lab"))[0].get_meta("lab")
	lab.call("_workbench")
	await _frames(1)
	await _over_keyboard("a drink's name", ui.dialogs.get("_box"), _buttons()[-1])
	ui.dialogs.close()
	state["phase"] = phase
	await _frames(1)


## Types into what is asked for: the entry, what it is in and the button to go on are over the keyboard, and all is back
## where it was without it.
func _over_keyboard(what: String, of: Control, next: Button) -> LineEdit:
	# A menu that pops up has an entry of its own.
	var entries := of.find_children("*", "LineEdit", true, false).filter(func(n: Node) -> bool: return (n as LineEdit).editable and not n.is_queued_for_deletion() and n.get_viewport() == of.get_viewport())
	_check("%s is asked for" % what, not entries.is_empty())
	if entries.is_empty():
		return null
	var before := CafeUi.keyboard
	var entry: LineEdit = entries[-1]
	for _i in 4:
		await process_frame
	var whole := next.get_global_rect()
	entry.grab_focus()
	var window := float(root.size.y)
	for part: float in [0.4, 0.5]:
		CafeUi.keyboard = func() -> int: return int(window * part)
		for _i in 8:
			await process_frame
		var screen := Rect2(Vector2.ZERO, Vector2((_app.ui.get("_root") as Control).size.x, (_app.ui.get("_root") as Control).size.y * (1.0 - part)))
		_check("%s is over a keyboard of %d%%" % [what, part * 100.0], screen.encloses(entry.get_global_rect()), [entry.get_global_rect(), screen])
		_check("and so is the next step", screen.encloses(next.get_global_rect()), [next.get_global_rect(), screen])
		_check("in sight, not scrolled away", _in_sight(entry), entry.get_global_rect())
	CafeUi.keyboard = before
	for _i in 8:
		await process_frame
	_check("and all is back without the keyboard", next.get_global_rect().is_equal_approx(whole), [next.get_global_rect(), whole])
	return entry


## Not cut off by what it scrolls in.
static func _in_sight(c: Control) -> bool:
	var up: Node = c.get_parent()
	while up != null:
		if up is ScrollContainer and not (up as Control).get_global_rect().grow(1.0).encloses(c.get_global_rect()):
			return false
		up = up.get_parent()
	return true


## A menu longer than the screen is made a little each frame, whole in the end.
func _long_menu() -> void:
	var s: Dictionary = _app.session.state
	var items: Dictionary = s["items"].duplicate()
	for m: Dictionary in CoreData.MENU:
		s["items"][m["id"]] = 3.0
	var ledger: CafeLedger = _app.ui.ledger
	_app.ui.show_tab("menu")
	await _frames(1)
	var list: Control = ledger.get("_list")
	var keys: Array = ledger.call("_visible_keys")
	_check("the menu opens with a screenful", list.get_child_count() < keys.size(), [list.get_child_count(), keys.size()])
	for _i in 200:
		await process_frame
		if list.get_child_count() == keys.size() and (ledger.get("_part") as LedgerRows).get("_stale").is_empty():
			break
	var rows: Dictionary = (ledger.get("_part") as LedgerRows).get("_rows")
	_check("and is whole a little later", list.get_child_count() == keys.size() and rows.values().all(func(r: Dictionary) -> bool: return r["level"].text == "Lv 3" and not (r["buy"].get_child(0).get_child(2) as Label).text.is_empty()))
	_check("in its order", range(keys.size()).all(func(i: int) -> bool: return (ledger.get("_part") as LedgerRows).get("_nodes")[keys[i]].get_index() == i))
	# What changes out of sight is kept up too.
	for m: Dictionary in CoreData.MENU:
		s["items"][m["id"]] = 4.0
	ledger.update()
	var late := rows.values().filter(func(r: Dictionary) -> bool: return r["level"].text != "Lv 4").size()
	_check("a change shows at once where it is seen", late < rows.size() and late > 0, late)
	for _i in 60:
		await process_frame
	_check("and everywhere a little later", rows.values().all(func(r: Dictionary) -> bool: return r["level"].text == "Lv 4"))
	s["items"] = items
	_app.ui.set_ledger(false)


## A finger on the ledger: dragging scrolls, over buttons too, and only a tap presses.
func _ledger_touch() -> void:
	var ui: CafeUi = _app.ui
	ui.show_tab("menu")
	for _i in 4:
		await _frames(1)
	var scroll: ScrollContainer = ui.ledger.get("_scroll")
	var at := scroll.get_global_rect().get_center()
	for b: Button in _buttons(scroll):
		if scroll.get_global_rect().grow(-20.0).encloses(b.get_global_rect()) and b.get_global_rect().position.y > scroll.get_global_rect().get_center().y - 100.0:
			at = b.get_global_rect().get_center()
	var pressed := [0]
	for b: Button in _buttons(scroll):
		b.pressed.connect(func() -> void: pressed[0] += 1)
	_finger(at, true)
	for i in 8:
		_slide(at - Vector2(0.0, 20.0 * (i + 1)), Vector2(0.0, -20.0))
		await process_frame
	_finger(at - Vector2(0.0, 160.0), false)
	await _frames(2)
	_check("dragging on a button scrolls the list", scroll.scroll_vertical > 60, [scroll.scroll_vertical, scroll.get_v_scroll_bar().max_value, scroll.size, at])
	_check("and does not press it", pressed[0] == 0 and at != scroll.get_global_rect().get_center())
	var b: Button = ui.ledger.get("_tabs")["pantry"]
	_finger(b.get_global_rect().get_center(), true)
	await process_frame
	_finger(b.get_global_rect().get_center(), false)
	await _frames(2)
	_check("a tap on a tab shows it", ui.ledger.tab == "pantry", ui.ledger.tab)
	ui.set_ledger(false)


func _finger(at: Vector2, down: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.position = at
	e.pressed = down
	Input.parse_input_event(e)
	Input.flush_buffered_events()


func _slide(at: Vector2, by: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.position = at
	e.relative = by
	Input.parse_input_event(e)
	Input.flush_buffered_events()


## An autosave in slices writes what a save at once would, whatever happens meanwhile.
func _slices() -> void:
	var s: CoreGameSession = _app.session
	var save: CoreSaveSession = s.session
	var storage: CoreStorage.GuardedStorage = save.get("_storage")
	var disk := func() -> String: return storage.read(CoreState.SAVE_KEY)["value"]
	_check("the phone's autosave is in slices", s.autosave_slice > 0.0)
	var phase: String = s.state["phase"]
	for p: String in ["prep", "open"]:
		s.state["phase"] = p
		s.save_game()
		var at_once: String = disk.call()
		_check("a save %s" % p, at_once == CoreState.serialize(save.call("_payload", s.state)) and _read(at_once).has("runtime") == (p == "open"))
		save.begin(s.state)
		var coins: float = s.state["coins"]
		var said := ""
		var steps := 0
		while said.is_empty() and steps < 1000:
			s.state["coins"] += 1.0
			s.state["items"]["espresso"] = 1.0 + steps
			said = save.step(0.0)
			steps += 1
		s.state["coins"] = coins
		_check("in slices while %s: the café as it was when it began" % p, said == "saved" and disk.call() == at_once and steps > 20, [said, steps])
	# A save at once takes the place of one half done.
	save.begin(s.state)
	save.step(0.0)
	s.state["coins"] += 7.0
	s.save_game()
	var now: String = disk.call()
	_check("a save at once ends one half done", not save.has_begun() and save.step(5.0).is_empty() and disk.call() == now and _read(now)["coins"] == s.state["coins"])
	# Played, not only called: an autosave comes every few seconds and ends within a few frames.
	s.state["phase"] = phase
	var before: String = disk.call()
	s.state["coins"] += 3.0
	var most := 0
	var running := 0
	for _i in 400:
		await _frames(1)
		running = running + 1 if save.has_begun() else 0
		most = maxi(most, running)
	_check("autosaves go on by themselves", disk.call() != before and _read(disk.call())["coins"] >= s.state["coins"] - 1e6 and most < 60, most)
	# With the moment it was begun as when the café was last seen.
	while save.has_begun():
		s.advance_autosave(0.0)
	CoreClock.override += 60_000.0
	var seen := CoreClock.now()
	s.advance_autosave(CoreGameSession.AUTOSAVE_SECONDS)
	_check("an autosave begins", save.has_begun())
	while save.has_begun():
		s.advance_autosave(0.0)
	_check("and says when the café was last seen", _read(disk.call())["manager"]["lastSeen"] == seen)
	# One that fails is said, until one does not.
	var fails := CoreStorage.MemoryStore.new()
	fails.items = {CoreState.SAVE_KEY: save.get("_expected")}
	fails.fail_writes = true
	save.set("_storage", CoreStorage.GuardedStorage.new(fails))
	for bad: bool in [true, false]:
		fails.fail_writes = bad
		s.advance_autosave(CoreGameSession.AUTOSAVE_SECONDS)
		while save.has_begun():
			s.advance_autosave(0.0)
		_check("an autosave that fails is said" if bad else "and no longer once it works", (_app.ui.get("_notice") as Control).visible == bad and s.interaction_enabled() != bad)
	save.set("_storage", storage)
	save.set("_expected", disk.call())
	# What another writes meanwhile is never overwritten.
	var memory := CoreStorage.MemoryStore.new()
	memory.items = {CoreState.SAVE_KEY: now}
	var other := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(memory), CoreClock.now(), randf)
	other.begin(other.state)
	other.step(0.0)
	var theirs: String = disk.call()
	memory.items[CoreState.SAVE_KEY] = theirs
	_check("nor over what another wrote", theirs != now and other.step(1000.0) == "conflict" and memory.items[CoreState.SAVE_KEY] == theirs and not other.active)
	# Nor begun without a place for it.
	var nowhere := CoreStorage.MemoryStore.new()
	nowhere.fail_reads = true
	var temporary := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(nowhere), CoreClock.now(), randf)
	temporary.begin(temporary.state)
	_check("nor begun without a place for it", not temporary.has_begun() and temporary.mode == "temporary")


## The café moves to another device and back, as text; every café an import takes the place of can come back.
func _moving() -> void:
	var s: CoreGameSession = _app.session
	var ui: CafeUi = _app.ui
	var storage: CoreStorage.GuardedStorage = s.session.get("_storage")
	for e: Array in [["", "剪贴板里没有文字"], ["  \n", "剪贴板里没有文字"], ["hello", "不是完整的存档"], ["{\"version\":27,", "不是完整的存档"], ["[1]", "不是完整的存档"], ["{}", "不是这个游戏的存档"], ["{\"version\":27,\"items\":{},\"coins\":1}", "不是这个游戏的存档"],
		["{\"version\":%d,\"items\":{},\"coins\":1,\"day\":1}" % int(CoreState.SAVE_VERSION + 1.0), "更新的版本"], ["{\"version\":\"27\",\"items\":{},\"coins\":1,\"day\":1}", "更新的版本"], ["{\"version\":27,\"items\":{},\"coins\":1,\"day\":1,\"x\":\"\\ud83d\"}", "不是完整的存档"]]:
		var no := SaveTransfer.look(e[0], CoreClock.now())
		_check("\"%s\" is not taken" % e[0], not no["ok"] and (no["why"] as String).contains(e[1]), no)
	# The save of a café much further on.
	var other: Dictionary = JsJson.parse(s.save_text())["value"]
	other["day"] = 41.0
	other["coins"] = 123456.0
	other["profile"]["cafeName"] = "搬来的店"
	var text: String = JsJson.stringify(other)
	var found := SaveTransfer.look("\n%s \n" % text, CoreClock.now())
	_check("a save is taken, whatever is around it", found["ok"] and found["text"] == text and found["day"] == 41.0 and found["name"] == "搬来的店" and found["coins"] == 123456.0, found)
	var mine: String = storage.read(CoreState.SAVE_KEY)["value"]
	SettingsDialog.show_settings(ui)
	await _press("搬家")
	_check("the settings lead to moving", _title() == "搬家" and _buttons().size() == 3)
	SaveTransfer.ask(ui, "hello")
	_check("a text that is no save changes nothing", _title() == "没有导入")
	SaveTransfer.ask(ui, text)
	_check("a save is asked about", _title() == "换成这家店？" and _buttons().size() == 2)
	await _press(_t("reset.keep"))
	_check("and may be left", _title() == "搬家" and storage.read(CoreState.SAVE_KEY)["value"] == mine and s.session.active)
	# When something cannot be written or read, nothing changes: neither the café nor what was kept before.
	var kept := "{\"kept\":\"before\"}"
	var was := {CoreState.SAVE_KEY: mine, CoreSaveSession.REPLACED_KEY: "{\"replaced\":[5]}", "%s/5" % CoreSaveSession.REPLACED_KEY: kept}
	for refused: Array in [[CoreState.SAVE_KEY], [CoreSaveSession.REPLACED_KEY], ["%s/%s" % [CoreSaveSession.REPLACED_KEY, JsMath.number_to_string(CoreClock.now())]], [], ["read"]]:
		var picky := PickyStore.new()
		picky.items = was.duplicate()
		picky.refused = refused
		picky.fail_writes = refused.is_empty()
		var session := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(picky), CoreClock.now(), randf)
		picky.fail_reads = refused == ["read"]
		var done := session.replace(text, CoreClock.now())
		picky.fail_reads = false
		_check("an import does not happen without %s" % [refused], not done and session.active and picky.items[CoreState.SAVE_KEY] == mine and session.replaced() == [{"at": 5.0, "text": kept}], picky.items.keys())
		picky.refused = []
		picky.fail_writes = false
		_check("and can be tried again", session.replace(text, CoreClock.now()) and picky.items[CoreState.SAVE_KEY] == text and session.replaced().map(func(e: Dictionary) -> String: return e["text"]) == [mine, kept], session.replaced())
	# Two imports in the same moment keep two cafés.
	var twice := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(CoreStorage.MemoryStore.new()), 1.0, randf)
	_check("two imports in one moment keep both", twice.replace(mine, 7.0) and twice.replace(text, 7.0) and twice.replace(mine + " ", 7.0) and twice.replaced().map(func(e: Dictionary) -> Array: return [e["at"], e["text"]]) == [[8.0, text], [7.0, mine]], twice.replaced().size())
	_check("one that is kept already is not kept twice", twice.replace(mine, 8.0) and twice.replace(text, 9.0) and twice.replace("{}", 10.0) and twice.replaced().map(func(e: Dictionary) -> String: return e["text"]) == [mine + " ", text, mine], twice.replaced().size())
	# On a disk, half a list gives way to the list before.
	var dir := _dir.path_join("list")
	var disk := FileStore.new(dir, [CoreState.SAVE_KEY, CoreSaveSession.REPLACED_KEY] as Array[String])
	var listed := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(disk), 1.0, randf)
	listed.replace(mine, 1.0)
	listed.replace(text, 2.0)
	listed.replace(mine, 3.0)
	_check("a list on a disk", listed.replaced().map(func(e: Dictionary) -> float: return e["at"]) == [3.0, 2.0])
	var torn := FileAccess.open(disk.path(CoreSaveSession.REPLACED_KEY), FileAccess.WRITE)
	torn.store_string("{\"repl")
	torn.close()
	var again := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(FileStore.new(dir, [CoreState.SAVE_KEY, CoreSaveSession.REPLACED_KEY] as Array[String])), 1.0, randf)
	_check("half a list gives way to the list before", again.replaced().map(func(e: Dictionary) -> String: return e["text"]) == [mine], again.replaced().size())
	for f in DirAccess.get_files_at(dir):
		DirAccess.remove_absolute(dir.path_join(f))
	DirAccess.remove_absolute(dir)
	_check("the game keeps its list so", (storage.get("_source") as FileStore).guarded.has(CoreSaveSession.REPLACED_KEY))
	var strict := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(CoreStorage.MemoryStore.new()), CoreClock.now(), randf)
	_check("a text the disk would not take back is not written", not strict.replace("{\"x\":\"\\ud83d\"}", 1.0) and not strict.replace("[]", 1.0))
	var full := CoreStorage.MemoryStore.new()
	full.items = {CoreState.SAVE_KEY: mine}
	full.fail_writes = true
	s.session.set("_storage", CoreStorage.GuardedStorage.new(full))
	s.session.set("_expected", mine)
	SaveTransfer.ask(ui, text)
	await _press("换上")
	_check("an import that cannot be written changes nothing", full.items == {CoreState.SAVE_KEY: mine} and s.session.active and s.state["day"] != 41.0)
	s.session.set("_storage", storage)
	s.session.set("_expected", storage.read(CoreState.SAVE_KEY)["value"])
	s.save_game()
	# Nor does one when the café it would keep cannot be saved first.
	var once := PickyStore.new()
	once.items = {CoreState.SAVE_KEY: storage.read(CoreState.SAVE_KEY)["value"]}
	once.once = true
	s.session.set("_storage", CoreStorage.GuardedStorage.new(once))
	s.state["coins"] += 5.0
	var tried := s.replace_save(text)
	_check("an import waits for a save that works", not tried and s.session.replaced().is_empty() and s.session.active)
	s.session.set("_storage", storage)
	s.save_game()
	# An import, with what was earned since the last save.
	s.state["coins"] += 17.0
	var first: float = s.state["coins"]
	var first_name: String = s.state["profile"]["cafeName"]
	var started := [0]
	ui.imported.connect(func() -> void: started[0] += 1)
	SaveTransfer.ask(ui, text)
	await _press("换上")
	_check("an import takes the place of the café", storage.read(CoreState.SAVE_KEY)["value"] == text and started[0] == 1)
	var replaced: Array = s.session.replaced()
	_check("which is kept as it was", replaced.size() == 1 and _read(replaced[0]["text"])["coins"] == first, replaced.size())
	# What the café that was goes on to save is not written over it.
	s.save_game()
	s.advance_autosave(20.0)
	s.set_hidden(true)
	_check("nothing is written over it", storage.read(CoreState.SAVE_KEY)["value"] == text and not s.session.active)
	_app.queue_free()
	await process_frame
	await process_frame
	await _launch()
	s = _app.session
	_check("and the game starts with it", s.state["profile"]["cafeName"] == "搬来的店" and s.state["day"] == 41.0, [s.state["profile"], s.state["day"]])
	# Another one at once: the first café is still kept, and the game starts again by itself.
	_app.ui.dialogs.close()
	other["day"] = 3.0
	other["profile"]["cafeName"] = "又一家店"
	await _bring(JsJson.stringify(other))
	_check("another import starts the game again with it", _app.session.state["profile"]["cafeName"] == "又一家店" and not _app.session.onboarding_open)
	replaced = _app.session.session.replaced()
	_check("and keeps both", replaced.size() == 2 and _read(replaced[0]["text"])["day"] == 41.0 and _read(replaced[1]["text"])["coins"] == first, replaced.map(func(e: Dictionary) -> Array: return [e["at"], _read(e["text"])["day"]]))
	_app.ui.dialogs.close()
	SaveTransfer.show_transfer(_app.ui)
	await _frames(1)
	var back := _buttons().filter(func(b: Button) -> bool: return _words_of(b) == "换回")
	_check("they are offered", back.size() == 2 and _says(_app.ui.dialogs.get("_box")).contains("搬来的店") and _says(_app.ui.dialogs.get("_box")).contains(first_name))
	back[1].pressed.emit()
	await _frames(1)
	_check("and asked about", _title() == "换成这家店？" and _says(_app.ui.dialogs.get("_box")).contains(first_name))
	await _bring("")
	_check("and the first one comes back", _app.session.state["profile"]["cafeName"] == first_name and absf(_app.session.state["coins"] - first) < 1e6 and _app.session.state["day"] < 41.0)
	_check("with the others kept", _app.session.session.replaced().size() == 3)
	_app.ui.dialogs.close()


## Agrees to another café and waits for the game to start again with it; the text of one asks first.
func _bring(text: String) -> void:
	current_scene = _app
	if not text.is_empty():
		SaveTransfer.ask(_app.ui, text)
	var before := _app
	await _press("换上")
	for _i in 10:
		await process_frame
	_check("the game starts again", current_scene != null and not is_instance_valid(before))
	_app = current_scene
	current_scene = null


## All that a screen says.
static func _says(of: Control) -> String:
	return "\n".join(of.find_children("*", "Label", true, false).map(func(l: Node) -> String: return (l as Label).text))


## A save as JavaScript reads it, to the last digit.
static func _read(text: String) -> Dictionary:
	return JsJson.parse(text)["value"]


func _play() -> void:
	CoreClock.override = 1_763_000_000_000.0
	I18n.locale = "zh"
	root.size = Vector2i(412, 915)
	await _launch()
	I18n.locale = "zh"
	_app.ui.refresh()
	var s: CoreGameSession = _app.session
	var scene: FloorsScene = _app.scene
	var ui: CafeUi = _app.ui
	await _first_day()
	await _frames(600)
	_check("guests come", s.sim.customers.size() > 0 and scene.customers.size() > 0)
	_check("every guest of the rules is in the building", s.sim.customers.all(func(c: Dictionary) -> bool: return scene.customers.has(c["id"])))
	# The building: dragging, walls, taps.
	var rest := scene.focus_y
	scene.scroll(120.0)
	_check("dragging moves the building", scene.focus_y < rest and scene.moved)
	await _press(_t("floors.wall"))
	await _frames(60)
	_check("the walls come up", scene.wall_alpha == 1.0 and scene.walls.all(func(p: FloorsPic) -> bool: return p.visible))
	var targets := []
	var keep := func(t: Dictionary) -> void: targets.append(t)
	scene.tapped.connect(keep)
	scene.tap(Vector2(836.0, scene.built["street"] - 300.0))
	await _frames(60)
	_check("a tap on the wall opens it", not _app.feed.outer_wall and scene.wall_alpha == 0.0)
	scene.tap(Vector2(836.0, scene.built["street"] - 840.0))
	_check("a tap on the café is the café's", targets == [{"kind": "cafe"}], targets)
	targets.clear()
	for c: Dictionary in s.sim.customers:
		var actor: FloorsScene.Actor = scene.customers[c["id"]]
		if actor.pic.alpha > 0.9 and actor.steps.is_empty():
			s.moments.active = {"kind": "photo", "customerId": c["id"], "options": [], "age": 0.0}
			await _frames(2)
			scene.tap(actor.pic.bounds().get_center())
			break
	_check("a tap on the moment's guest is the moment's", targets.is_empty() or targets[0]["kind"] == "moment", targets)
	_check("the cue floats over that guest", scene.cue == null or scene.cue.depth > 1000.0)
	scene.tap(Vector2(668.0, FloorsLayout.world_y(scene.built, "roof", 360.0)))
	_check("the visiting cat can be petted", targets.any(func(t: Dictionary) -> bool: return t["kind"] == "cat"), targets)
	scene.tapped.disconnect(keep)
	await _service()
	# A whole day at four times the speed, as the phone would draw it.
	s.set_speed(4.0)
	s.moments.active = null
	var nodes := 0
	for _i in 160:
		if s.modal_open and s.state["phase"] != "prep":
			ui.dialogs.back()
			if ui.dialogs.is_open():
				ui.dialogs.close()
		await _frames(30)
		nodes = maxi(nodes, scene.get_child_count())
		if s.state["phase"] == "prep":
			break
	_check("the day ends", s.state["day"] >= 2.0, "%s %s" % [s.state["phase"], s.state["dayTime"]])
	_check("with nothing left lying about", nodes < 700, nodes)
	_check("and its report", _title() == _t("report.title", {"n": 1.0}), _title())
	await _press(_t("report.next"))
	_check("the next day starts with its menu", _title() == _t("prep.title", {"n": 2.0}), _title())
	await _press(_t("prep.later"))
	await _between_ledger_and_room()
	await _ledger_touch()
	# Away and back, and another launch.
	s.state["phase"] = "prep"
	var coins: float = s.state["coins"]
	_app._notification(Node.NOTIFICATION_APPLICATION_PAUSED)
	_check("in the background the game holds still", s.hidden)
	CoreClock.override += 60_000.0
	_app._notification(Node.NOTIFICATION_APPLICATION_RESUMED)
	_check("and goes on afterwards", not s.hidden)
	_check("the save is on the disk", FileAccess.file_exists(_dir.path_join(CoreState.SAVE_KEY.uri_encode())))
	_app.queue_free()
	await process_frame
	await process_frame
	await _launch()
	_check("another launch continues the café", _app.session.state["day"] >= 2.0 and absf(_app.session.state["coins"] - coins) < 1e6 and _app.session.state["profile"] != null)
	_check("without asking who the owner is", not _app.session.onboarding_open)
	# The building grows with the café, and a new branch starts small.
	s = _app.session
	scene = _app.scene
	ui = _app.ui
	ui.dialogs.close()
	CoreEconomy.earn(s.state, 1e12)
	await _frames(3)
	var before: int = scene.built["floors"].size()
	for _i in 3:
		CoreEconomy.buy_upgrade(s.state, "tables", 1.0)
	CoreKitchen.unlock_kitchen(s.state)
	await _frames(3)
	await _long_menu()
	_check("the building grows", scene.built["floors"].size() > before, scene.built["floors"])
	scene.scroll(400.0)
	s.state["regions"] = ["terrace"]
	ui.open_branch_map()
	await _frames(2)
	_check("the map asks where the next café opens", _title() == _t("map.title"), _title())
	await _press(_t("map.open"))
	_check("and what that means", _title() == _t("chain.confirm.title"), _title())
	await _press(_t("chain.confirm.ok"))
	await _frames(3)
	_check("a new branch starts small, seen from where it rests", scene.built["floors"].size() <= before and not scene.moved and s.state["chain"]["branches"] == 1.0, scene.built["floors"])
	for locale in ["en", "zh"]:
		ui.set_language(locale)
		await _frames(20)
	await _effects()
	await _arranging()
	await _touching()
	await _nothing_left()
	await _keyboard()
	# Saving that does not work covers the café until it does.
	var storage: CoreStorage.GuardedStorage = s.session.get("_storage")
	var full := CoreStorage.MemoryStore.new()
	full.items = {CoreState.SAVE_KEY: s.session.get("_expected")}
	full.fail_writes = true
	s.session.set("_storage", CoreStorage.GuardedStorage.new(full))
	s.save_game()
	_check("a save that fails is said, over everything", (ui.get("_notice") as Control).visible and not s.interaction_enabled())
	_check("the opening flow too", (ui.get("_notice") as Control).get_index() == (ui.get("_root") as Control).get_child_count() - 2)
	full.fail_writes = false
	s.save_game()
	_check("and no longer than it lasts", not (ui.get("_notice") as Control).visible and s.interaction_enabled())
	s.session.set("_storage", storage)
	s.session.set("_expected", storage.read(CoreState.SAVE_KEY)["value"])
	# A unit is a point of the phone's own, on a tall one, a short one and a tablet: what 4.7.2 says of the screen (Android's
	# scale is the rounded density, cut down to width / 800 and height / 600), and how wide it is in units.
	var screen := root.size
	for e: Array in [
		["Android", Vector2(1080, 2340), 1.35, 420, 411.4], ["Android", Vector2(1440, 3120), 1.8, 560, 411.4], ["Android", Vector2(1080, 2340), 1.35, 450, 384.0], ["Android", Vector2(720, 1600), 0.9, 320, 360.0],
		["Android", Vector2(1080, 1920), 1.35, 480, 360.0], ["Android", Vector2(720, 1280), 0.9, 320, 360.0], ["Android", Vector2(1600, 2560), 2.0, 320, 480.0], ["Android", Vector2(640, 960), 0.8, 320, 360.0],
		["iOS", Vector2(1179, 2556), 3.0, 460, 393.0], ["iOS", Vector2(750, 1334), 2.0, 326, 375.0], ["iOS", Vector2(640, 1136), 2.0, 326, 360.0], ["iOS", Vector2(1640, 2360), 2.0, 264, 480.0],
	]:
		var size: Vector2 = e[1]
		_app.phone = func() -> Dictionary: return {"system": e[0], "scale": e[2], "dots": e[3], "safe": Rect2i(0, 100, int(size.x), int(size.y) - 160)}
		root.size = Vector2i(size)
		_app.call("_resized")
		await process_frame
		var seen := root.get_visible_rect().size
		_check("%s's screen of %s at %d dpi is %s wide" % [e[0], size, e[3], e[4]], absf(seen.x - e[4]) < 1.0 and absf(seen.x / seen.y - size.x / size.y) < 0.001, seen)
		var sheet: Rect2 = (ui.ledger.get_node("Sheet") as Control).get_global_rect()
		_check("clear of its edges", absf(sheet.position.y - 12.0 - 100.0 * seen.x / size.x) < 1.0 and absf(seen.y - sheet.end.y - 12.0 - 60.0 * seen.x / size.x) < 1.0, sheet)
	# A dialog as tall as what it says stays on the screen as the screen changes under it.
	SettingsDialog.show_settings(ui)
	for high: int in [1920, 1280, 1000, 1920]:
		root.size = Vector2i(1080, high)
		_app.phone = func() -> Dictionary: return {"system": "Android", "scale": 1.35, "dots": 420, "safe": Rect2i(0, 100, 1080, high - 160)}
		_app.call("_resized")
		for _i in 6:
			await process_frame
		var unit := root.get_visible_rect().size.x / 1080.0
		var shown: Rect2 = (ui.dialogs.get("_box") as Control).get_global_rect()
		_check("a dialog fits a screen of %d" % high, shown.position.y >= 100.0 * unit and shown.end.y <= (high - 60.0) * unit, [shown, unit])
	ui.dialogs.close()
	_app.phone = func() -> Dictionary: return {}
	root.content_scale_factor = 1.0
	root.size = Vector2i(screen)
	_app.call("_resized")
	await _slices()
	await _crowd_limits()
	await _moving()
	s = _app.session
	ui = _app.ui
	# Starting over.
	SettingsDialog.show_settings(ui)
	await _press(_t("settings.reset"))
	_check("starting over is asked twice", _title() == _t("reset.title"))
	await _press(_t("reset.confirm"))
	_check("and starts with the owner", s.onboarding_open and s.state["profile"] == null and s.state["day"] == 1.0)
	_app.queue_free()
	for f in DirAccess.get_files_at(_dir):
		DirAccess.remove_absolute(_dir.path_join(f))
	DirAccess.remove_absolute(_dir)
	await process_frame
	print("APP_SUMMARY: passed=%d failed=%d" % [passed, failed])
	quit(0 if failed == 0 and passed > 0 else 1)


func _all_labels_text(node: Node) -> String:
	var parts := PackedStringArray()
	for l: Node in node.find_children("*", "Label", true, false):
		if (l as Label).is_visible_in_tree() and not l.is_queued_for_deletion():
			parts.append((l as Label).text)
	return "\n".join(parts)


## A5 (traffic-cap notice in upgrades and promotion panels) and A7 (legacy 6-person queue snapshot restore).
func _crowd_limits() -> void:
	var s: CoreGameSession = _app.session
	var ui: CafeUi = _app.ui
	var saved_locale := I18n.locale
	var saved_state: Dictionary = s.state.duplicate(true)

	# A5: below cap vs at/above cap in both zh and en.
	for pair: Array in [["zh", "客流已满"], ["en", "traffic capped"]]:
		I18n.locale = pair[0]
		var needle: String = pair[1]
		var fresh := CoreState.create_initial_state(0.0)
		s.state = fresh
		s.sim.reset()
		ui.set_ledger(true)
		ui.ledger.show_tab("upgrades")
		ui.refresh()
		await _frames(1)
		_check("uncapped marketing hides cap hint (%s)" % pair[0], not _all_labels_text(ui.ledger).to_lower().contains(needle))
		ui.ledger.show_tab("promotion")
		ui.refresh()
		await _frames(1)
		_check("uncapped promotion hides cap hint (%s)" % pair[0], not _all_labels_text(ui.ledger).to_lower().contains(needle))

		var capped := CoreState.create_initial_state(0.0)
		capped["coins"] = 1e9
		capped["upgrades"]["marketing"] = 20.0
		capped["upgrades"]["barista"] = 3.0
		capped["upgrades"]["server"] = 5.0
		capped["upgrades"]["machine"] = 14.0
		capped["upgrades"]["tables"] = 6.0
		capped["regions"] = ["reading", "greenhouse", "terrace"]
		for ing: Dictionary in CoreData.INGREDIENTS:
			capped["pantry"][ing["id"]] = 1000.0
		s.state = capped
		ui.ledger.show_tab("upgrades")
		ui.refresh()
		await _frames(1)
		_check("capped marketing shows cap hint (%s)" % pair[0], _all_labels_text(ui.ledger).to_lower().contains(needle))
		ui.ledger.show_tab("promotion")
		ui.refresh()
		await _frames(1)
		var promo_text := _all_labels_text(ui.ledger)
		_check("capped promotion shows cap hint (%s)" % pair[0], promo_text.to_lower().contains(needle) and promo_text.contains(I18n.t("promo.capped")))

	# A7: legacy 6-person queue snapshot restores cleanly and drains naturally.
	var legacy_state := CoreState.create_initial_state(0.0)
	legacy_state["pantry"]["beans"] = 1000.0
	CoreDay.open_shop(legacy_state)
	var sim_rng := RandomNumberGenerator.new()
	sim_rng.seed = 11
	var legacy_sim := CoreSim.new(sim_rng.randf)
	legacy_sim.update(legacy_state, 0.05)
	var snap := legacy_sim.snapshot(legacy_state)
	var custs := []
	for i in 6:
		var spot := CoreLayout.queue_spot(float(i))
		custs.append({
			"id": float(i + 1), "x": spot["x"], "y": spot["y"], "tx": spot["x"], "ty": spot["y"],
			"via": [], "journey": [], "pathBlocked": false, "stride": 0.0,
			"look": {"skin": 0.0, "hair": 0.0, "hairStyle": 0.0, "shirt": 0.0, "pants": 0.0},
			"order": "espresso", "extra": null, "phase": "queue",
			"patience": 40.0, "timer": 0.0, "spot": -1.0, "seat": -1.0,
			"vip": false, "mood": null, "moodTimer": 0.0, "hasCup": false, "soldOut": false, "dineIn": false,
			"reviewed": false, "waitSeconds": 0.0, "missingExtra": false,
		})
	snap["customers"] = custs
	snap["queue"] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
	snap["nextId"] = 7.0
	_check("legacy 6-queue snapshot is valid", CoreSimSnapshot.valid_snapshot(snap, legacy_state))
	var restored := CoreSim.new(sim_rng.randf)
	_check("legacy 6-queue snapshot restores", restored.restore(snap, legacy_state))
	_check("legacy 6-queue keeps all 6 guests", restored.queue.size() == 6 and restored.customers.size() == 6, restored.queue.size())
	for _step in 600:
		if restored.queue.is_empty():
			break
		restored.update(legacy_state, 0.05)
	_check("legacy 6-queue drains naturally", restored.queue.is_empty() and legacy_state["today"]["served"] >= 4.0, [restored.queue.size(), legacy_state["today"]["served"]])

	I18n.locale = saved_locale
	s.state = saved_state
	ui.set_ledger(false)
	ui.refresh()
	await _frames(1)
