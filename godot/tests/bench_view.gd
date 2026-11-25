extends SceneTree

## How long the building takes to update in a busy café, part by part, and how many nodes it keeps. Not a test of looks.
## `npm run godot:bench` runs it after the simulation's. `--save=` uses a café of your own.

var _scene: FloorsScene
var _session: CoreGameSession
var _feed := FloorsFeed.new()
var _rng := RandomNumberGenerator.new()


func _init() -> void:
	_start.call_deferred()


func _start() -> void:
	_rng.seed = 3
	FloorsText.font = load("res://app/cafe_app.gd").fonts()
	CoreClock.override = 1_763_000_000_000.0
	var storage := CoreStorage.GuardedStorage.new(CoreStorage.MemoryStore.new())
	_session = CoreGameSession.new(CoreSaveSession.acquire(storage, CoreClock.now(), _rng.randf), storage, _rng.randf, _rng.randf)
	_session.translate = I18n.t
	_session.item_name = func(id: String) -> String: return I18n.item_name(id, _session.state)
	_feed.follow(_session)
	_session.fit_scene()
	_session.start()
	_session.onboarding_open = false
	_grow(_session.state)
	_scene = FloorsScene.new()
	_scene.setup(FloorsLibrary.new(), _session, _feed)
	root.add_child(_scene)
	_scene.resized(Vector2(824, 1830))
	_session.start_day()
	_session.state["speed"] = 4.0
	var worst := 0.0
	var people := 0
	var nodes := 0
	var total := 0
	var n := 0
	for i in 60 * 40:
		CoreClock.override += 1000.0 / 60.0
		_session.modal_open = false
		_session.frame(1.0 / 60.0)
		_feed.update(1.0 / 60.0, _session)
		var t := Time.get_ticks_usec()
		_scene.update(1.0 / 60.0)
		var took := Time.get_ticks_usec() - t
		if i > 240:
			total += took
			n += 1
			worst = maxf(worst, took / 1000.0)
		people = maxi(people, _session.sim.customers.size())
		nodes = maxi(nodes, _scene.get_child_count())
		await process_frame
		if _session.state["phase"] == "prep":
			_grow(_session.state)
			_session.start_day()
	print("VIEW_BENCH: mean=%.3f ms worst=%.2f ms most_people=%d most_nodes=%d" % [total / 1000.0 / n, worst, people, nodes])
	_parts()
	quit(0 if total / 1000.0 / n < 4.0 and nodes < 900 else 1)


## Everything there is, so that the building is as busy as it gets.
func _grow(s: Dictionary) -> void:
	s["profile"] = {"cafeName": "小豆咖啡馆", "ownerName": "", "look": {"skin": 1.0, "hair": 2.0, "hairStyle": 3.0, "shirt": 2.0, "pants": 1.0}}
	CoreEconomy.earn(s, 1e12)
	CoreKitchen.unlock_kitchen(s)
	for item: Dictionary in CoreData.MENU:
		CoreEconomy.buy_item(s, item["id"], 10.0)
		CoreEconomy.set_on_menu(s, item["id"], true)
	for id: String in ["tables", "barista", "server", "cook", "marketing", "machine", "pass"]:
		for _i in 20:
			CoreEconomy.buy_upgrade(s, id, 1.0)
	for cat: Dictionary in CorePets.CATS.slice(0, 6):
		CorePets.adopt_cat(s, cat["id"])
	for ing: Dictionary in CoreData.INGREDIENTS:
		CoreEconomy.buy_ingredient(s, ing["id"], 5000.0)
	CoreEconomy.bake_for_forecast(s)
	CoreEconomy.restock(s)


func _parts() -> void:
	var s := _session.state
	var b: Dictionary = _scene.call("_layout_building")
	var active := CoreRegions.active_table_indices(s)
	var parts := {
		"layout": func() -> void: _scene.call("_layout_building"), "sky": func() -> void: _scene.sky.update(0.016, s, b), "customers": func() -> void: _scene.call("_sync_customers", b, active, 0.016),
		"baristas": func() -> void: _scene.call("_sync_baristas", b, 0.016), "servers": func() -> void: _scene.call("_sync_servers", b, active, 0.016), "cooks": func() -> void: _scene.call("_sync_cooks", b, 0.016),
		"props": func() -> void: _scene.props.sync(b, active, 0.016), "front": func() -> void: _scene.front.update(0.016, s, 0.0), "thoughts": func() -> void: _scene.thoughts.update(0.016, s, true),
		"furniture": func() -> void: _scene.call("_sync_furniture", b, s), "arrange": func() -> void: _scene.call("_sync_arrange", b, s), "cats": func() -> void: _scene.cats.update(b, 0.016, s), "upgrades": func() -> void: _scene.upgrades.update(0.016, s),
	}
	for name: String in parts:
		var t := Time.get_ticks_usec()
		for _i in 50:
			parts[name].call()
		print("  %s %.3f ms" % [name, (Time.get_ticks_usec() - t) / 50_000.0])
