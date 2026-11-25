extends SceneTree

## Draws a café for a while and saves what the screen shows. For looking at the building; not a test.
## --out=<png> --seconds=<of play> --size=<w>x<h> --hour= --weather= --save=<json file> --speed=

var _scene: FloorsScene
var _rng: RandomNumberGenerator
var _session: CoreGameSession
var _feed := FloorsFeed.new()
var _opts := {"out": "user://shot.png", "seconds": "20", "size": "824x1830", "warm": "60"}


func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		var pair := arg.trim_prefix("--").split("=", true, 1)
		_opts[pair[0]] = pair[1] if pair.size() > 1 else "1"
	_start.call_deferred()


func _start() -> void:
	var size := Vector2i(int(_opts["size"].get_slice("x", 0)), int(_opts["size"].get_slice("x", 1)))
	root.size = size
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	FloorsText.font = load("res://app/cafe_app.gd").fonts()
	_rng = RandomNumberGenerator.new()
	_rng.seed = 7
	CoreClock.override = 1_763_000_000_000.0
	var storage := CoreStorage.GuardedStorage.new(CoreStorage.MemoryStore.new())
	if _opts.has("save"):
		storage.write(CoreState.SAVE_KEY, FileAccess.get_file_as_string(_opts["save"]))
	var session := CoreSaveSession.acquire(storage, CoreClock.now(), _rng.randf)
	_session = CoreGameSession.new(session, storage, _rng.randf, _rng.randf)
	I18n.locale = _opts.get("locale", "zh")
	_session.translate = I18n.t
	_session.item_name = func(id: String) -> String: return I18n.item_name(id, _session.state)
	_feed.follow(_session)
	_session.fit_scene()
	_session.start()
	_session.onboarding_open = false
	if not _opts.has("save"):
		_grown(_session.state)
	if _opts.has("wall"):
		_feed.outer_wall = true
	var t0 := Time.get_ticks_msec()
	_scene = FloorsScene.new()
	_scene.setup(FloorsLibrary.new(_opts.get("preset", "full")), _session, _feed)
	root.add_child(_scene)
	_scene.resized(Vector2(size))
	print("SETUP ms=%d" % (Time.get_ticks_msec() - t0))
	if _opts.has("hour"):
		_scene.sky.preview["hour"] = float(_opts["hour"])
	if _opts.has("weather"):
		_scene.sky.preview["weather"] = _opts["weather"]
	if not _opts.has("closed") and _session.state["phase"] == "prep":
		_session.start_day()
		_session.state["speed"] = float(_opts.get("speed", "1"))
	_run()


## A café with two storeys of tables, a kitchen and a full menu.
func _grown(s: Dictionary) -> void:
	s["profile"] = {"cafeName": "小豆咖啡馆", "ownerName": "店主", "look": {"skin": 1.0, "hair": 2.0, "hairStyle": 3.0, "shirt": 2.0, "pants": 1.0}}
	CoreEconomy.earn(s, 5e6)
	CoreKitchen.unlock_kitchen(s)
	for item: Dictionary in CoreData.MENU.slice(0, 14):
		CoreEconomy.buy_item(s, item["id"], 1.0)
		CoreEconomy.set_on_menu(s, item["id"], true)
	for id: String in ["tables", "barista", "server", "cook", "marketing", "machine"]:
		CoreEconomy.buy_upgrade(s, id, 1.0 if id != "marketing" else 10.0)
		CoreEconomy.buy_upgrade(s, id, 1.0)
	for _i in 3:
		CoreEconomy.buy_upgrade(s, "tables", 1.0)
	for cat: Dictionary in CorePets.CATS.slice(0, 3):
		CorePets.adopt_cat(s, cat["id"])
	for ing: Dictionary in CoreData.INGREDIENTS:
		CoreEconomy.buy_ingredient(s, ing["id"], 200.0)
	CoreEconomy.bake_for_forecast(s)
	CoreEconomy.restock(s)


func _run() -> void:
	var left := float(_opts["seconds"])
	var warm := float(_opts["warm"])
	# The day runs on quickly first, then at its own pace while it is drawn.
	var worst := 0.0
	var drawn := 0
	var spent := 0
	while warm > 0.0:
		warm -= 0.1
		_step(0.1)
		if int(warm * 10.0) % 20 == 0:
			await process_frame
	while left > 0.0:
		var t := Time.get_ticks_usec()
		_step(1.0 / 60.0)
		var took := Time.get_ticks_usec() - t
		spent += took
		worst = maxf(worst, took / 1000.0)
		drawn += 1
		left -= 1.0 / 60.0
		await process_frame
	if _opts.has("dump"):
		_session.save_game()
		var f := FileAccess.open(_opts["dump"], FileAccess.WRITE)
		f.store_string(_session.storage.read(CoreState.SAVE_KEY)["value"])
		f.close()
	print("STEP mean_ms=%.3f worst_ms=%.2f people=%d children=%d" % [spent / 1000.0 / drawn, worst, _session.sim.customers.size(), _scene.get_child_count()])
	if DisplayServer.get_name() != "headless":
		if _opts.has("focus"):
			_scene.focus_on(float(_opts["focus"]))
			_step(0.0)
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(_opts["out"])
		print("SHOT %s" % _opts["out"])
	quit()


func _step(dt: float) -> void:
	CoreClock.override += dt * 1000.0
	if _session.state["phase"] == "open" and _session.moments.active != null and _opts.has("social"):
		_session.open_moment()
	_session.modal_open = false
	_session.frame(dt)
	_feed.update(dt, _session)
	_scene.update(dt)
