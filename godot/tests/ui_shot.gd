extends SceneTree

## Opens the game on a save and saves what screens show. For looking at them; not a test.
## --save=<json file> --out=<dir> --size=412x915 --locale=zh --steps=hud,menu,…

var _opts := {"out": "user://", "size": "824x1830", "locale": "zh", "steps": "hud"}
var _app: Node
var _base_state: Dictionary = {}


func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		var pair := arg.trim_prefix("--").split("=", true, 1)
		_opts[pair[0]] = pair[1] if pair.size() > 1 else "1"
	_start.call_deferred()


func _start() -> void:
	var size := Vector2i(int(_opts["size"].get_slice("x", 0)), int(_opts["size"].get_slice("x", 1)))
	root.size = size
	var dir := OS.get_temp_dir().path_join("bean-shot-%d" % OS.get_process_id())
	DirAccess.make_dir_recursive_absolute(dir)
	DirAccess.make_dir_recursive_absolute(_opts["out"])
	if _opts.has("save"):
		var text := FileAccess.get_file_as_string(_opts["save"])
		CoreClock.override = JSON.parse_string(text)["manager"]["lastSeen"]
		var f := FileAccess.open(dir.path_join(CoreState.SAVE_KEY.uri_encode()), FileAccess.WRITE)
		f.store_string(text)
		f.close()
	else:
		CoreClock.override = 1_763_000_000_000.0
	var lf := FileAccess.open(dir.path_join(I18n.LOCALE_KEY.uri_encode()), FileAccess.WRITE)
	lf.store_string(_opts["locale"])
	lf.close()
	I18n.locale = _opts["locale"]
	_app = load("res://scenes/cafe.tscn").instantiate()
	_app.save_dir = dir
	root.add_child(_app)
	await _wait(40)
	I18n.locale = _opts["locale"]
	_app.ui.refresh()
	_app.ui.dialogs.hush()
	_base_state = _app.session.state.duplicate(true)
	for step: String in _opts["steps"].split(","):
		var colon := step.find(":")
		var cmd := step.substr(0, colon) if colon >= 0 else step
		var arg := step.substr(colon + 1) if colon >= 0 else ""
		_do(cmd, arg)
		if cmd in ["ops", "scrollbottom"]:
			await _wait(4)
			var sc: ScrollContainer = _app.ui.ledger.get("_scroll")
			if sc != null:
				sc.scroll_vertical = 99999
			await _wait(46)
		elif cmd == "settle_details":
			await _wait(6)
			var dbox: Control = _app.ui.dialogs.get("_box")
			if dbox != null:
				var scs := dbox.find_children("*", "ScrollContainer", true, false)
				if not scs.is_empty():
					(scs[0] as ScrollContainer).scroll_vertical = 460
			await _wait(44)
		else:
			await _wait(50)
		root.get_viewport().get_texture().get_image().save_png(_opts["out"].path_join("%s.png" % step.replace(":", "-")))
	quit()


func _wait(frames: int) -> void:
	for _i in frames:
		await process_frame


func _do(step: String, what: String) -> void:
	var ui: CafeUi = _app.ui
	match step:
		"hud": pass
		"menu", "pantry", "upgrades", "decor", "pets", "promotion": ui.show_tab(step)
		"decorkind": ui.ledger.choose_decor(what)
		"ops":
			ui.ledger.open_ops_tile = what
			ui.ledger.update()
			var sc: ScrollContainer = ui.ledger.get("_scroll")
			sc.set_deferred("scroll_vertical", 99999)
		"petexpand":
			var pb: Variant = ui.ledger.get("_pet_browsing")
			if pb is Dictionary:
				pb["expanded"][what] = true
				ui.ledger.update()
		"expand":
			var key := what if what.contains(":") else "item:%s" % what
			ui.ledger.expanded_cards[key] = true
			ui.ledger.refresh()
		"scroll": ui.ledger.get("_scroll").scroll_vertical = int(what)
		"scrollbottom": ui.ledger.get("_scroll").scroll_vertical = 99999
		"closed": ui.set_ledger(false)
		"prepare": ui.session.prepare_day()
		"prep_full":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			for ing: Dictionary in CoreData.INGREDIENTS:
				ui.session.state["pantry"][ing["id"]] = maxf(500.0, ui.session.state["pantry"].get(ing["id"], 0.0))
			ui.refresh()
			ui.session.prepare_day()
		"prep_budget":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			ui.session.state["coins"] = 2.0
			ui.session.state["pantry"]["beans"] = 0.0
			ui.refresh()
			ui.session.prepare_day()
		"prep_empty":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			ui.session.state["onMenu"] = []
			ui.refresh()
			ui.session.prepare_day()
		"prep_broke":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			ui.session.state["coins"] = 0.0
			ui.session.state["pantry"]["beans"] = 0.0
			ui.refresh()
			ui.session.prepare_day()
		"prep_bakery":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			ui.session.state["kitchen"] = true
			ui.session.state["items"]["roll"] = 1.0
			ui.session.state["items"]["croissant"] = 1.0
			CoreEconomy.set_on_menu(ui.session.state, "roll", true)
			ui.session.state["bakePlan"]["roll"] = 10.0
			ui.refresh()
			ui.session.prepare_day()
		"prep_dishes":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			ui.refresh()
			ui.session.prepare_day()
			var pbox: Control = ui.dialogs.get("_box")
			if pbox != null:
				var want := I18n.t("prep.dishDetails")
				for p: Node in pbox.find_children("*", "PanelContainer", true, false):
					if p.has_meta("fold"):
						var labels := p.find_children("*", "Label", true, false)
						if labels.any(func(l: Node) -> bool: return (l as Label).text == want):
							var click := InputEventMouseButton.new()
							click.button_index = MOUSE_BUTTON_LEFT
							click.pressed = false
							(p as Control).gui_input.emit(click)
							break
				var sc: ScrollContainer = pbox.find_children("*", "ScrollContainer", true, false)[0]
				sc.set_deferred("scroll_vertical", 200)
		"x": ui.back()
		"more": ui.hud.set_expanded(true)
		"street": ui.open_street()
		"lot":
			var shops: Dictionary = ui.street.get("_shops")
			ui.street.set("_plot", shops.keys()[0])
			ui.street.set("_open", true)
			ui.street.update()
		"settings", "partners", "regulars", "style", "reputation": ui.hud.opened.emit(step)
		"edit": ui.edit_profile()
		"onboarding": ui.session.start_onboarding()
		"next": ui.onboarding.next()
		"open": ui.session.start_day()
		"speed": ui.session.set_speed(float(what))
		"days":
			for _i in int(what):
				_app.session.frame(0.05)
		"settle":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			ui.session.sim.reset()
			ui.session.start_day()
			ui.session.set_speed(4.0)
			for _i in 4000:
				ui.session.moments.active = null
				if ui.dialogs.is_open() and ui.session.state["phase"] != "prep":
					ui.dialogs.close()
				ui.session.frame(0.05)
				if ui.session.state["phase"] == "prep":
					break
			ui.dialogs.hush()
		"settle_claim":
			var box: Control = ui.dialogs.get("_box")
			if box != null:
				for b: Node in box.find_children("*", "Button", true, false):
					var btn := b as Button
					if not btn.disabled and btn.text.begins_with(I18n.t("report.claimGoalBtn", {"reward": ""}).strip_edges()):
						btn.pressed.emit()
						break
		"settle_details":
			var box: Control = ui.dialogs.get("_box")
			if box != null:
				ui.dialogs.hush()
				var want := I18n.t("report.detailsTitle")
				for p: Node in box.find_children("*", "PanelContainer", true, false):
					if p.has_meta("fold"):
						var labels := p.find_children("*", "Label", true, false)
						if labels.any(func(l: Node) -> bool: return (l as Label).text == want):
							var click := InputEventMouseButton.new()
							click.button_index = MOUSE_BUTTON_LEFT
							click.pressed = false
							(p as Control).gui_input.emit(click)
							break
				var scs := box.find_children("*", "ScrollContainer", true, false)
				if not scs.is_empty():
					(scs[0] as ScrollContainer).set_deferred("scroll_vertical", 520)
		"settle_loss":
			ui.dialogs.close()
			ui.session.state = _base_state.duplicate(true)
			ui.session.state["phase"] = "prep"
			ui.session.state["goal"] = float(CoreGoals.GOALS.size())
			ui.session.state["milestones"]["done"] = []
			for ch: Dictionary in CoreMilestones.CHAPTERS:
				for m: Dictionary in ch["milestones"]:
					ui.session.state["milestones"]["done"].append(m["id"])
			ui.session.sim.reset()
			ui.refresh()
			var r := CoreState.empty_day()
			r.merge({
				"day": 18.0, "duration": 180.0, "rating": 3.2, "ratingCount": 4.0, "ratingTraffic": 0.96,
				"served": 8.0, "revenue": 42.0, "ingredientCost": 35.0, "petCost": 8.0, "promotionCost": 60.0,
				"profit": -61.0, "missed": 5.0, "soldOut": 3.0, "queueLost": 2.0, "doorLost": 9.0,
				"sales": {"latte": 5.0, "espresso": 3.0}, "bestSeller": "latte",
				"outOfStock": ["latte"], "shelfSoldOut": [], "stale": {}, "staleCost": 0.0,
			}, true)
			SettlementDialog.show_report(ui, r)
			ui.dialogs.hush()
		"settle_day1":
			ui.dialogs.close()
			var d1 := CoreState.create_initial_state(0.0)
			d1["day"] = 2.0
			d1["profile"] = {"cafeName": I18n.t("app.title"), "ownerName": "", "look": {"skin": 1.0, "hair": 2.0, "hairStyle": 3.0, "shirt": 2.0, "pants": 1.0}}
			ui.session.state = d1
			ui.session.sim.reset()
			ui.refresh()
			var r1 := CoreState.empty_day()
			r1.merge({
				"day": 1.0, "duration": 120.0, "rating": 4.5, "ratingCount": 3.0, "ratingTraffic": 1.05,
				"served": 14.0, "revenue": 56.0, "ingredientCost": 14.0, "profit": 42.0,
				"sales": {"espresso": 14.0}, "bestSeller": "espresso",
				"outOfStock": [], "shelfSoldOut": [], "stale": {}, "staleCost": 0.0,
			}, true)
			SettlementDialog.show_report(ui, r1)
			ui.dialogs.hush()
		"book": MilestoneBook.show_book(ui.dialogs, ui.session.state)
		"perks": ChainDialogs.show_perks(ui.dialogs, ui.session.state, Callable())
		"map": ChainDialogs.show_map(ui.dialogs, ui.session.state, func(_l: String) -> void: pass)
		"taste": TasteDialog.show_taste(ui.dialogs, ui.session, what, func() -> void: pass)
		"lab": SignatureLab.show_lab(ui, func() -> void: pass)
		"projects": ProjectsDialog.show_projects(ui, func() -> void: pass)
		"arrange": ui.arrange_browse()
		"place": ui.arrange_place(what)
		"partner": PartnerDialog.show_partners(ui, what)
		"help": ui.guide.show_help()
		"money": SmallDialogs.money(ui.dialogs, ui.session.state["coins"], 1e7)
		_: print("unknown step %s" % step)
