extends Node

## The game: the rules (CoreGameSession) with the building (FloorsScene) and the screens (CafeUi) around them.

## Where the save is; tests use another place.
static var save_dir := "user://save"
## Where chance starts from; tests choose it.
static var chance := 0
## What the phone says of its screen, empty elsewhere; tests answer for it.
var phone := _phone
var session: CoreGameSession
var scene: FloorsScene
var feed := FloorsFeed.new()
var ui: CafeUi
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	get_tree().quit_on_go_back = false
	get_tree().auto_accept_quit = false
	_rng.randomize()
	if chance != 0:
		_rng.seed = chance
	FloorsText.font = fonts()
	var storage := CoreStorage.GuardedStorage.new(FileStore.new(save_dir, [CoreState.SAVE_KEY, CoreSaveSession.REPLACED_KEY] as Array[String]))
	I18n.locale = I18n.detect(storage.preference(I18n.LOCALE_KEY), [OS.get_locale()])
	session = CoreGameSession.new(CoreSaveSession.acquire(storage, CoreClock.now(), _rng.randf), storage, _rng.randf, _rng.randf)
	session.translate = I18n.t
	session.item_name = func(id: String) -> String: return I18n.item_name(id, session.state)
	session.duration = func(seconds: float) -> String: return CoreFormat.format_duration(seconds, I18n.t)
	# The page saves at once; here an autosave takes a millisecond of a few frames.
	session.autosave_slice = 1.0
	feed.follow(session)
	scene = FloorsScene.new()
	scene.setup(FloorsLibrary.new(art_size()), session, feed)
	add_child(scene)
	ui = CafeUi.new(session, feed, scene)
	add_child(ui)
	ui.imported.connect(_start_again)
	get_viewport().size_changed.connect(_resized)
	_resized()
	session.fit_scene()
	session.start()
	ui.refresh()


## Half-size pictures on a phone with little memory.
static func art_size() -> String:
	var memory: int = OS.get_memory_info()["physical"]
	return "half" if OS.has_feature("mobile") and memory > 0 and memory < 3_500_000_000 else "full"


## The letters of the building: rounded Latin with Chinese behind it, both thick, and whatever the phone has for the rest.
static func fonts() -> Font:
	return Paper.font(800)


func _process(dt: float) -> void:
	session.frame(dt)
	session.advance_autosave(dt)
	feed.update(dt, session)
	scene.update(dt)


func _notification(what: int) -> void:
	if session == null:
		return
	match what:
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT:
			if not session.hidden and (what == NOTIFICATION_APPLICATION_PAUSED or OS.has_feature("mobile")):
				session.set_hidden(true)
		NOTIFICATION_APPLICATION_RESUMED, NOTIFICATION_APPLICATION_FOCUS_IN:
			if session.hidden:
				session.set_hidden(false)
		NOTIFICATION_WM_GO_BACK_REQUEST:
			if not ui.back():
				_leave()
		NOTIFICATION_WM_CLOSE_REQUEST:
			_leave()


## Another café is on the disk: it is read as at any start.
func _start_again() -> void:
	if get_tree().current_scene == self:
		get_tree().reload_current_scene.call_deferred()


func _leave() -> void:
	session.close()
	get_tree().quit()


## How many times over the stretch to the window a unit is drawn, so that it is a point of the phone's own, whatever its
## shape: a short screen scrolls more instead of shrinking everything.
static func unit_scale(window: Vector2, density: float) -> float:
	var stretch := minf(window.x / 412.0, window.y / 915.0)
	var wide := clampf(window.x / maxf(0.5, density), 360.0, 480.0)
	return window.x / wide / stretch


## How many pixels are one of the phone's points. Android's screen_get_scale is a rounded density cut down to a desktop
## window's shape, so there it is taken from the dots per inch; the iPhone's is its own.
static func density(platform: String, scale: float, dots: int) -> float:
	return dots / 160.0 if platform == "Android" else scale


static func _phone() -> Dictionary:
	if not OS.has_feature("mobile"):
		return {}
	return {"system": OS.get_name(), "scale": DisplayServer.screen_get_scale(), "dots": DisplayServer.screen_get_dpi(), "safe": DisplayServer.get_display_safe_area()}


func _resized() -> void:
	var here: Dictionary = phone.call()
	var window := Vector2(get_window().size)
	if not here.is_empty():
		var factor := unit_scale(window, density(here["system"], here["scale"], here["dots"]))
		if absf(get_window().content_scale_factor - factor) > 0.001:
			get_window().content_scale_factor = factor
	var size := get_viewport().get_visible_rect().size
	scene.resized(size)
	var top := 0.0
	var bottom := 0.0
	if not here.is_empty():
		var safe: Rect2i = here["safe"]
		var factor := size.y / maxf(1.0, window.y)
		top = maxf(0.0, safe.position.y * factor)
		bottom = maxf(0.0, (window.y - safe.end.y) * factor)
	ui.inset(top, bottom)
