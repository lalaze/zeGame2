class_name FileStore
extends RefCounted

## Saves on disk, as a source for CoreStorage.GuardedStorage: one file per key under a folder.
## A save is written whole to a temporary file, read back, and only then renamed over the old one, which is kept as
## the previous save. Reading takes the newest file that is whole, so a crash or a full disk at any point leaves a
## save to continue from. A file that is there but cannot be read counts as a save: it is never replaced.

## Keys whose value must be a whole JSON object, with a previous copy kept.
var guarded: Array[String] = []
var _dir: String
## The last text known to be whole, so that a big save is not parsed again every time.
var _whole: Dictionary = {}


func _init(dir: String = "user://save", guarded_keys: Array[String] = []) -> void:
	_dir = dir
	guarded = guarded_keys
	DirAccess.make_dir_recursive_absolute(dir)


## The file for a key; `kind` is "", ".tmp" or ".prev".
func path(key: String, kind: String = "") -> String:
	return _dir.path_join(key.uri_encode()) + kind


func get_item(key: String) -> Dictionary:
	if not DirAccess.dir_exists_absolute(_dir):
		return {"ok": false, "value": null}
	var current: Variant = _read(path(key))
	if not guarded.has(key):
		return {"ok": not current is bool, "value": null if current is bool else current}
	# When the last write did not finish: the temporary file if that one did, else the save before.
	for kind: String in ["", ".tmp", ".prev"]:
		var text: Variant = current if kind.is_empty() else _read(path(key, kind))
		if text is bool:
			return {"ok": false, "value": null}
		if text is String and _is_whole(key, text):
			return {"ok": true, "value": text}
	return {"ok": true, "value": current}


func set_item(key: String, value: String) -> bool:
	var temporary := path(key, ".tmp")
	# A full disk may only show when the file is read back.
	if not _write(temporary, value) or not _matches(_read(temporary), value):
		DirAccess.remove_absolute(temporary)
		return false
	var kept := false
	if guarded.has(key):
		var current: Variant = _read(path(key))
		if current is bool:
			DirAccess.remove_absolute(temporary)
			return false
		if current is String and _is_whole(key, current):
			kept = _rename(path(key), path(key, ".prev"))
			if not kept:
				DirAccess.remove_absolute(temporary)
				return false
	if not _rename(temporary, path(key)):
		if kept:
			_rename(path(key, ".prev"), path(key))
		DirAccess.remove_absolute(temporary)
		return false
	if guarded.has(key):
		_whole[key] = value
	return true


## Whether all of it was written, as far as the disk says.
func _write(file_path: String, text: String) -> bool:
	var file := FileAccess.open(file_path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(text)
	file.flush()
	var written := file.get_error() == OK
	file.close()
	return written


func _rename(from: String, to: String) -> bool:
	return DirAccess.rename_absolute(from, to) == OK


static func _matches(read: Variant, value: String) -> bool:
	return read is String and read == value


## The text, null when there is no such file, false when it cannot be read.
static func _read(file_path: String) -> Variant:
	if not FileAccess.file_exists(file_path):
		return null
	var file := FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		return false
	return file.get_as_text()


func _is_whole(key: String, text: String) -> bool:
	if _whole.has(key) and _whole[key] == text:
		return true
	var json := JSON.new()
	if json.parse(text) != OK or not json.data is Dictionary:
		return false
	_whole[key] = text
	return true
