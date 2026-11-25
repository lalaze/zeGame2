extends SceneTree

## Opens the game on a save and saves what screens show. For looking at them; not a test.
## --save=<json file> --out=<dir> --size=412x915 --locale=zh --steps=hud,menu,…

var _opts := {"out": "user://", "size": "824x1830", "locale": "zh", "steps": "hud"}
var _app: Node


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
	if _opts.has("save"):
		var text := FileAccess.get_file_as_string(_opts["save"])
		CoreClock.override = JSON.parse_string(text)["manager"]["lastSeen"]
		var f := FileAccess.open(dir.path_join(CoreState.SAVE_KEY.uri_encode()), FileAccess.WRITE)
		f.store_string(text)
		f.close()
	else:
		CoreClock.override = 1_763_000_000_000.0
	I18n.locale = _opts["locale"]
	_app = load("res://scenes/cafe.tscn").instantiate()
	_app.save_dir = dir
	root.add_child(_app)
	await _wait(40)
	I18n.locale = _opts["locale"]
	_app.ui.refresh()
	for step: String in _opts["steps"].split(","):
		_do(step.get_slice(":", 0), step.get_slice(":", 1))
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
		"scroll": ui.ledger.get("_scroll").scroll_vertical = int(what)
		"closed": ui.set_ledger(false)
		"prepare": ui.session.prepare_day()
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
