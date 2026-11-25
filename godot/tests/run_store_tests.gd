extends SceneTree

## FileStore and CoreSaveSession on a real disk: saves survive being interrupted at any point.

var KEY: String = CoreState.SAVE_KEY
var passed := 0
var failed := 0
var _dir := ""


func _init() -> void:
	_dir = OS.get_temp_dir().path_join("bean-store-%d" % OS.get_process_id())
	var tests := {
		"an absent key is not an error": _absent, "what is written is read back exactly": _round_trip, "the save before is kept": _previous, "a torn save falls back to the one before": _torn,
		"stopped before the rename: the old save": _before_rename, "stopped between the renames: the new save": _between_renames, "stopped while writing the temporary file": _torn_temporary,
		"a torn save never replaces a good previous one": _keeps_good_previous, "a folder that cannot be written": _unwritable, "a save that cannot be read is not replaced": _unreadable, "a failed rename leaves the old save": _rename_fails,
		"a save emptied by a power cut": _emptied, "a crash at any point of a save": _every_crash, "the disk loses part of what was written": _half_written, "the old save cannot be set aside": _first_rename_fails, "the new save cannot take its place": _second_rename_fails,
		"an unreadable copy is not replaced either": _unreadable_copies, "only whole saves are kept": _not_an_object,
		"preferences are separate files": _preferences, "a café saved, closed and opened again": _session, "a café whose last save was torn": _session_torn, "a save changed elsewhere stops this café": _session_conflict,
	}
	for label: String in tests:
		_remove(_dir)
		var problem: Variant = tests[label].call()
		if problem is String and problem == "ok":
			passed += 1
		else:
			failed += 1
			print("FAIL: %s: %s" % [label, problem])
	_remove(_dir)
	print("STORE_SUMMARY: passed=%d failed=%d" % [passed, failed])
	quit(0 if failed == 0 else 1)


func _remove(path: String) -> void:
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
	if not DirAccess.dir_exists_absolute(path):
		return
	FileAccess.set_unix_permissions(path, 0x1c0)
	for f in DirAccess.get_files_at(path):
		DirAccess.remove_absolute(path.path_join(f))
	for d in DirAccess.get_directories_at(path):
		_remove(path.path_join(d))
	DirAccess.remove_absolute(path)


func _store() -> FileStore:
	return FileStore.new(_dir, [KEY] as Array[String])


func _put(path: String, text: String) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(text)
	f.close()


func _is(actual: Variant, expected: Variant) -> String:
	return "ok" if typeof(actual) == typeof(expected) and actual == expected else "expected %s, got %s" % [str(expected).left(80), str(actual).left(80)]


func _absent() -> String:
	return _is(_store().get_item(KEY), {"ok": true, "value": null})


func _round_trip() -> String:
	var text := "{\"name\":\"小豆咖啡馆 👩‍🍳 \\\"é\\\"\",\"pad\":\"%s\"}" % "x".repeat(300_000)
	if not _store().set_item(KEY, text):
		return "not written"
	return _is(_store().get_item(KEY)["value"], text)


func _previous() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	s.set_item(KEY, "{\"n\":2}")
	if FileAccess.get_file_as_string(s.path(KEY, ".prev")) != "{\"n\":1}" or FileAccess.file_exists(s.path(KEY, ".tmp")):
		return "files"
	return _is(s.get_item(KEY)["value"], "{\"n\":2}")


func _torn() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	s.set_item(KEY, "{\"n\":2}")
	_put(s.path(KEY), "{\"n\":")
	var first := _is(_store().get_item(KEY)["value"], "{\"n\":1}")
	_put(s.path(KEY), "")
	return first if first != "ok" else _is(s.get_item(KEY)["value"], "{\"n\":1}")


func _before_rename() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	_put(s.path(KEY, ".tmp"), "{\"n\":2}")
	return _is(_store().get_item(KEY)["value"], "{\"n\":1}")


func _between_renames() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	_put(s.path(KEY, ".tmp"), "{\"n\":2}")
	DirAccess.rename_absolute(s.path(KEY), s.path(KEY, ".prev"))
	var again := _store()
	var first := _is(again.get_item(KEY)["value"], "{\"n\":2}")
	if first != "ok":
		return first
	again.set_item(KEY, "{\"n\":3}")
	return _is(_store().get_item(KEY)["value"], "{\"n\":3}")


func _torn_temporary() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	_put(s.path(KEY, ".tmp"), "{\"n\":2")
	DirAccess.rename_absolute(s.path(KEY), s.path(KEY, ".prev"))
	return _is(_store().get_item(KEY)["value"], "{\"n\":1}")


func _keeps_good_previous() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	s.set_item(KEY, "{\"n\":2}")
	_put(s.path(KEY), "{\"n\":")
	var again := _store()
	again.set_item(KEY, "{\"n\":3}")
	if FileAccess.get_file_as_string(again.path(KEY, ".prev")) != "{\"n\":1}":
		return "the previous save was lost"
	return _is(again.get_item(KEY)["value"], "{\"n\":3}")


func _unwritable() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	FileAccess.set_unix_permissions(_dir, 0x140)
	var written := s.set_item(KEY, "{\"n\":2}")
	var value: Variant = s.get_item(KEY)["value"]
	FileAccess.set_unix_permissions(_dir, 0x1c0)
	return "written anyway" if written else _is(value, "{\"n\":1}")


func _unreadable() -> String:
	var s := _store()
	s.set_item(KEY, "{\"n\":1}")
	FileAccess.set_unix_permissions(s.path(KEY), 0)
	var read: bool = s.get_item(KEY)["ok"]
	var session := CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(s), 1.0, func() -> float: return 0.5)
	var result := session.save(session.state)
	FileAccess.set_unix_permissions(s.path(KEY), 0x180)
	return "read" if read else (result if result != "temporary" else _is(s.get_item(KEY)["value"], "{\"n\":1}"))


func _rename_fails() -> String:
	var s := _store()
	s.set_item("pref", "a")
	# A folder where the file should go cannot be renamed over.
	DirAccess.remove_absolute(s.path("pref"))
	DirAccess.make_dir_absolute(s.path("pref"))
	_put(s.path("pref").path_join("x"), "x")
	var written := s.set_item("pref", "b")
	return "written" if written else _is(FileAccess.file_exists(s.path("pref", ".tmp")), false)


## A café whose file was emptied, zeroed or cut after its last save, opened by a new launch of the game.
func _emptied() -> String:
	for kind: String in ["no bytes", "zeroes", "half"]:
		_remove(_dir)
		var a := _open()
		for coins: float in [111.0, 222.0]:
			a.state["coins"] = coins
			a.save(a.state)
		var path := _store().path(KEY)
		var text := FileAccess.get_file_as_string(path)
		var zeroes := PackedByteArray()
		zeroes.resize(text.length())
		var f := FileAccess.open(path, FileAccess.WRITE)
		if kind == "zeroes":
			f.store_buffer(zeroes)
		elif kind == "half":
			f.store_string(text.left(text.length() / 2))
		f.close()
		var b := _open()
		if b.state["coins"] != 111.0:
			return "%s: %s coins" % [kind, b.state["coins"]]
		b.state["coins"] = 333.0
		if b.save(b.state) != "saved" or _open().state["coins"] != 333.0:
			return "%s: not saved again" % kind
		if JSON.parse_string(FileAccess.get_file_as_string(_store().path(KEY, ".prev")))["coins"] != 111.0:
			return "%s: the previous save was lost" % kind
	return "ok"


## Every file there can be after a crash while the third save is written: the old or the new save is read, and the
## next save works.
func _every_crash() -> String:
	var old := "{\"n\":2}"
	var new := "{\"n\":3,\"name\":\"小豆\"}"
	var bytes := new.to_utf8_buffer()
	for before: int in [0, 1, 2]: # How many saves there were.
		for stage: String in ["writing", "set aside"]:
			for cut in bytes.size() + 1:
				if stage == "set aside" and before == 0:
					continue
				_remove(_dir)
				var s := _store()
				for n in before:
					s.set_item(KEY, "{\"n\":%d}" % (3 - before + n))
				var f := FileAccess.open(s.path(KEY, ".tmp"), FileAccess.WRITE)
				f.store_buffer(bytes.slice(0, cut))
				f.close()
				if stage == "set aside":
					DirAccess.rename_absolute(s.path(KEY), s.path(KEY, ".prev"))
				var read: Dictionary = _store().get_item(KEY)
				var wanted: Variant = new if cut == bytes.size() and (stage == "set aside" or before == 0) else (old if before > 0 else null)
				if not read["ok"] or _is(read["value"], wanted) != "ok":
					return "%d saves, %s, %d bytes: %s" % [before, stage, cut, read]
				var again := _store()
				if not again.set_item(KEY, "{\"n\":4}") or _store().get_item(KEY)["value"] != "{\"n\":4}":
					return "%d saves, %s, %d bytes: not saved again" % [before, stage, cut]
	return "ok"


## A disk that says everything went well.
class LyingDisk extends FileStore:
	func _write(file_path: String, text: String) -> bool:
		super(file_path, text.left(text.length() / 2))
		return true


func _half_written() -> String:
	_store().set_item(KEY, "{\"n\":1}")
	var s := LyingDisk.new(_dir, [KEY] as Array[String])
	if s.set_item(KEY, "{\"n\":2}"):
		return "written"
	return _is([_store().get_item(KEY)["value"], FileAccess.file_exists(s.path(KEY, ".tmp"))], ["{\"n\":1}", false])


class StuckDisk extends FileStore:
	var stuck_from := ""
	func _rename(from: String, to: String) -> bool:
		return false if from == stuck_from else super(from, to)


func _stuck(kind: String) -> StuckDisk:
	var s := StuckDisk.new(_dir, [KEY] as Array[String])
	s.set_item(KEY, "{\"n\":1}")
	s.set_item(KEY, "{\"n\":2}")
	s.stuck_from = s.path(KEY, kind)
	return s


func _first_rename_fails() -> String:
	var s := _stuck("")
	if s.set_item(KEY, "{\"n\":3}"):
		return "written"
	return _is([_store().get_item(KEY)["value"], FileAccess.get_file_as_string(s.path(KEY, ".prev")), FileAccess.file_exists(s.path(KEY, ".tmp"))], ["{\"n\":2}", "{\"n\":1}", false])


func _second_rename_fails() -> String:
	var s := _stuck(".tmp")
	if s.set_item(KEY, "{\"n\":3}"):
		return "written"
	var left := [FileAccess.get_file_as_string(s.path(KEY)), FileAccess.file_exists(s.path(KEY, ".tmp"))]
	if left != ["{\"n\":2}", false]:
		return "left %s" % [left]
	s.stuck_from = ""
	return "not saved again" if not s.set_item(KEY, "{\"n\":4}") else _is(_store().get_item(KEY)["value"], "{\"n\":4}")


## The newest or the only good save may be one that cannot be read right now.
func _unreadable_copies() -> String:
	for kind: String in [".tmp", ".prev"]:
		for main: Variant in [null, "{\"n\":"]:
			_remove(_dir)
			var s := _store()
			_put(s.path(KEY, kind), "{\"n\":1}")
			if main != null:
				_put(s.path(KEY), main)
			FileAccess.set_unix_permissions(s.path(KEY, kind), 0)
			var read: bool = _store().get_item(KEY)["ok"]
			var session := _open()
			var result := session.save(session.state)
			FileAccess.set_unix_permissions(s.path(KEY, kind), 0x180)
			if read or result != "temporary" or FileAccess.get_file_as_string(s.path(KEY, kind)) != "{\"n\":1}":
				return "%s with %s: read %s, %s" % [kind, main, read, result]
	# One that became unreadable after the game read it.
	_remove(_dir)
	var t := _store()
	t.set_item(KEY, "{\"n\":1}")
	FileAccess.set_unix_permissions(t.path(KEY), 0)
	var written := t.set_item(KEY, "{\"n\":2}")
	FileAccess.set_unix_permissions(t.path(KEY), 0x180)
	return "written" if written else _is([_store().get_item(KEY)["value"], FileAccess.file_exists(t.path(KEY, ".tmp"))], ["{\"n\":1}", false])


## Text that is JSON but no save is not set aside over a good previous save.
func _not_an_object() -> String:
	for text: String in ["7", "[1]", "null", ""]:
		_remove(_dir)
		var s := _store()
		s.set_item(KEY, "{\"n\":1}")
		s.set_item(KEY, "{\"n\":2}")
		_put(s.path(KEY), text)
		var again := _store()
		if _is(again.get_item(KEY)["value"], "{\"n\":1}") != "ok":
			return "%s was read" % text
		again.set_item(KEY, "{\"n\":3}")
		if FileAccess.get_file_as_string(again.path(KEY, ".prev")) != "{\"n\":1}":
			return "%s replaced the previous save" % text
	return "ok"


func _preferences() -> String:
	var g := CoreStorage.GuardedStorage.new(_store())
	g.set_preference("tiny-bean-cafe/hint-done", "1")
	g.set_preference("a b/ü", "")
	var again := CoreStorage.GuardedStorage.new(_store())
	return _is([again.preference("tiny-bean-cafe/hint-done"), again.preference("a b/ü"), again.preference("none")], ["1", "", null])


func _open() -> CoreSaveSession:
	return CoreSaveSession.acquire(CoreStorage.GuardedStorage.new(_store()), 1_763_000_000_000.0, func() -> float: return 0.25)


func _session() -> String:
	var a := _open()
	a.state["coins"] = 1234.5
	CoreEconomy.restock(a.state)
	CoreDay.open_shop(a.state)
	for _i in 400:
		a.sim.update(a.state, 0.05)
	if a.save(a.state) != "saved":
		return "not saved"
	var b := _open()
	if b.sim.customers.is_empty():
		return "nobody in the café"
	return _is(_seen(b), _seen(a))


func _seen(s: CoreSaveSession) -> Array:
	var out := s.sim.customers.map(func(c: Dictionary) -> Array: return [c["id"], c["x"], c["y"], c["phase"], c["patience"]])
	for key: String in ["coins", "day", "dayTime", "phase", "pantry", "served", "today"]:
		out.append(JsJson.stringify(s.state[key]))
	return out


func _session_torn() -> String:
	var a := _open()
	a.state["coins"] = 100.0
	a.save(a.state)
	a.state["coins"] = 200.0
	a.save(a.state)
	var path := _store().path(CoreState.SAVE_KEY)
	var text := FileAccess.get_file_as_string(path)
	_put(path, text.left(text.length() / 2))
	return _is(_open().state["coins"], 100.0)


func _session_conflict() -> String:
	var a := _open()
	a.save(a.state)
	var b := _open()
	b.state["coins"] = 5.0
	b.save(b.state)
	return _is([a.save(a.state), a.save(a.state), _open().state["coins"]], ["conflict", "inactive", 5.0])
