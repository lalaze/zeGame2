extends SceneTree

## How long the screens of a rich café take to open and to keep up, which the café does four times a second.
## `--most=` fails when a heartbeat takes longer than that many milliseconds.

var _most := INF


func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--most="):
			_most = float(arg.trim_prefix("--most="))
	_start.call_deferred()


func _start() -> void:
	root.size = Vector2i(412, 915)
	CoreClock.override = 1_763_000_000_000.0
	I18n.locale = "zh"
	var storage := CoreStorage.GuardedStorage.new(CoreStorage.MemoryStore.new())
	var chance := func() -> float: return 0.5
	var session := CoreGameSession.new(CoreSaveSession.acquire(storage, CoreClock.now(), chance), storage, chance, chance)
	session.translate = I18n.t
	session.startup_complete = true
	var s := session.state
	s["profile"] = {"cafeName": "小豆咖啡馆", "ownerName": "店主", "look": {"skin": 1.0, "hair": 2.0, "hairStyle": 3.0, "shirt": 2.0, "pants": 1.0}}
	CoreEconomy.earn(s, 1e12)
	CoreKitchen.unlock_kitchen(s)
	for m: Dictionary in CoreData.MENU:
		s["items"][m["id"]] = 5.0
		CoreEconomy.set_on_menu(s, m["id"], true)
	for ing: Dictionary in CoreData.INGREDIENTS:
		CoreEconomy.buy_ingredient(s, ing["id"], 300.0)
	var feed := FloorsFeed.new()
	var scene := FloorsScene.new()
	scene.setup(FloorsLibrary.new(), session, feed)
	var ui := CafeUi.new(session, feed, scene)
	root.add_child(ui)
	ui.inset(0.0, 0.0)
	await process_frame
	var worst := 0.0
	for tab: String in CafeLedger.TABS + ["hud", "street"]:
		var t0 := Time.get_ticks_usec()
		match tab:
			"hud": ui.set_ledger(false)
			"street": ui.open_street()
			_: ui.show_tab(tab)
		await process_frame
		var opened := (Time.get_ticks_usec() - t0) / 1000.0
		var t1 := Time.get_ticks_usec()
		for _i in 20:
			match tab:
				"hud": ui.hud.update()
				"street": ui.street.update()
				_: ui.ledger.update()
		var kept := (Time.get_ticks_usec() - t1) / 20000.0
		worst = maxf(worst, kept)
		print("UI_BENCH: %s opens in %.1f ms, keeps up in %.2f ms" % [tab, opened, kept])
	print("UI_BENCH_SUMMARY: worst=%.2f passed=%d failed=%d" % [worst, 1 if worst <= _most else 0, 0 if worst <= _most else 1])
	quit(0 if worst <= _most else 1)
