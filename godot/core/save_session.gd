class_name CoreSaveSession
extends RefCounted

## Port of src/game/save-session.ts. One live simulation owns the save until the game closes. A phone runs one game at
## a time, so the browser's lock and page events (`acquireSaveSession`'s lock, `watchSavePage`) have no counterpart.

## Which saves imports took the place of; each is under this and when that was.
const REPLACED_KEY := "tiny-bean-cafe/replaced"
var state: Dictionary
var migrated_street_shops: bool
var sim: CoreSim
var active := true
var mode: String
var _expected: Variant = null
var _begun: Dictionary = {}
var _storage: CoreStorage.GuardedStorage
var _release: Callable


## The session for this launch. A save that cannot be read is left untouched: the café is then only temporary.
static func acquire(storage: CoreStorage.GuardedStorage, now: float, rng: Callable) -> CoreSaveSession:
	var readable: bool = storage.read(CoreState.SAVE_KEY)["ok"]
	return CoreSaveSession.new(storage if readable else null, now, func() -> void: pass, rng)


func _init(storage: CoreStorage.GuardedStorage, now: float, release: Callable, rng: Callable) -> void:
	sim = CoreSim.new(rng)
	_storage = storage
	_release = release
	mode = "persistent" if storage != null else "temporary"
	if storage != null:
		var result := storage.read(CoreState.SAVE_KEY)
		if not result["ok"]:
			push_error("Save storage is unavailable")
		_expected = result["value"]
	state = CoreState.deserialize(_expected, now)
	migrated_street_shops = CoreStreets.migrate_indoor_shops(state, now)
	var runtime: Variant = JsUtil.UNDEFINED
	if _expected is String:
		var parsed := JsJson.parse(_expected)
		if parsed["ok"] and parsed["value"] is Dictionary:
			runtime = parsed["value"].get("runtime", JsUtil.UNDEFINED)
	if not sim.restore(runtime, state):
		state["inProduction"] = {}
		# Lost unprepared orders release their places; consumed cups keep their cost and quota.
		if state["trialSales"]["active"] != null:
			state["trialSales"]["active"]["reserved"] = 0.0


## "saved", "inactive", "conflict", "unavailable" or "temporary".
func save(to_save: Dictionary) -> String:
	# A save begun a little earlier is older than this one.
	_begun.clear()
	var refused := _refused()
	return _write(CoreState.serialize(_payload(to_save))) if refused.is_empty() else refused


func _refused() -> String:
	if not active:
		return "inactive"
	# A temporary session never upgrades itself, even if storage later recovers.
	if _storage == null:
		return "temporary"
	var current := _storage.read(CoreState.SAVE_KEY)
	if not current["ok"]:
		return "unavailable"
	# Something else changed the save: keep both, by stopping here.
	if not _same(current["value"], _expected):
		close()
		return "conflict"
	return ""


func _payload(to_save: Dictionary) -> Dictionary:
	var payload := to_save.duplicate(false)
	if to_save["phase"] != "prep":
		payload["runtime"] = sim.snapshot(to_save)
	return payload


func _write(raw: String) -> String:
	if not _storage.write(CoreState.SAVE_KEY, raw):
		return "unavailable"
	_expected = raw
	return "saved"


## Begins the same save in slices, so that no frame writes all of it: the café as it is now, finished by `step`.
func begin(to_save: Dictionary) -> void:
	if not active or _storage == null:
		return
	_begun = {"payload": _payload(to_save).duplicate(true), "parts": PackedStringArray()}
	_begun["keys"] = JsUtil.own_keys(_begun["payload"])


func has_begun() -> bool:
	return not _begun.is_empty()


## Goes on with the save begun, for about this long: "" while there is more to write, then what `save` says.
func step(milliseconds: float) -> String:
	if _begun.is_empty():
		return ""
	var until := Time.get_ticks_usec() + int(milliseconds * 1000.0)
	var keys: Array = _begun["keys"]
	while not keys.is_empty():
		var key: String = keys.pop_front()
		var value: Variant = _begun["payload"][key]
		if not JsUtil.is_undefined(value):
			var pair := CoreState.serialize({key: value})
			_begun["parts"].append(pair.substr(1, pair.length() - 2))
		if Time.get_ticks_usec() >= until:
			return ""
	var raw := "{%s}" % ",".join(_begun["parts"])
	_begun.clear()
	var refused := _refused()
	return _write(raw) if refused.is_empty() else refused


## The café as a save says it, whether or not it could be written.
func text(of: Dictionary) -> String:
	return CoreState.serialize(_payload(of))


## Another save in place of this one, which is kept: every import keeps one more, and none of them is written over. False
## when anything cannot be read or written; the save and what was kept before are then as they were.
func replace(raw: String, now: float) -> bool:
	_begun.clear()
	if not active or _storage == null or not is_whole(raw):
		return false
	var kept: Variant = _kept()
	if not kept is Array:
		return false
	var before: Array = kept.duplicate()
	if _expected is String and not replaced().any(func(e: Dictionary) -> bool: return e["text"] == _expected):
		var at := now
		while true:
			var there := _storage.read(_kept_key(at))
			if not there["ok"]:
				return false
			if there["value"] == null:
				break
			at += 1.0
		if not _storage.write(_kept_key(at), _expected):
			return false
		kept.push_front(at)
		if not _storage.write(REPLACED_KEY, JsJson.stringify({"replaced": kept})):
			return false
	if not _storage.write(CoreState.SAVE_KEY, raw):
		if kept != before:
			_storage.write(REPLACED_KEY, JsJson.stringify({"replaced": before}))
		return false
	_expected = raw
	return true


## The saves that imports took the place of, newest first: [{"at", "text"}].
func replaced() -> Array:
	var out := []
	var kept: Variant = _kept()
	if kept is Array:
		for at: float in kept:
			var text: Variant = _storage.read(_kept_key(at))["value"]
			if text is String:
				out.append({"at": at, "text": text})
	return out


## Whether the disk will take a text for a whole save (FileStore reads no other).
static func is_whole(raw: String) -> bool:
	var json := JSON.new()
	return json.parse(raw) == OK and json.data is Dictionary


static func _kept_key(at: float) -> String:
	return "%s/%s" % [REPLACED_KEY, JsMath.number_to_string(at)]


## When each of the kept saves was replaced, or null when that cannot be read.
func _kept() -> Variant:
	if _storage == null:
		return null
	var list := _storage.read(REPLACED_KEY)
	if not list["ok"]:
		return null
	if not list["value"] is String:
		return []
	var parsed := JsJson.parse(list["value"])
	var kept: Variant = parsed["value"].get("replaced") if parsed["ok"] and parsed["value"] is Dictionary else null
	return kept.filter(func(at: Variant) -> bool: return at is float) if kept is Array else []


static func _same(a: Variant, b: Variant) -> bool:
	return a == b if a is String and b is String else a == null and b == null


func close() -> void:
	if not active:
		return
	active = false
	_release.call()
