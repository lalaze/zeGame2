class_name CoreStorage
extends RefCounted

## Port of src/game/storage.ts. A source has `get_item(key) -> {"ok": bool, "value": String or null}` and
## `set_item(key, value) -> bool`; FileStore keeps one on disk. GDScript has no exceptions, so a source says when it
## could not be read instead of throwing.


## Keeps an unreadable store apart from a key that is really absent: an unreadable save never becomes a new one.
class GuardedStorage extends RefCounted:
	var _preferences: Dictionary = {}
	var _source: Object

	func _init(source: Object) -> void:
		_source = source

	func read(key: String) -> Dictionary:
		return _source.get_item(key)

	func write(key: String, value: String) -> bool:
		return _source.set_item(key, value)

	## Preferences stay usable in this session even when storage is denied or full. Never use these for the save.
	func preference(key: String) -> Variant:
		if _preferences.has(key):
			return _preferences[key]
		var result := read(key)
		var value: Variant = result["value"] if result["ok"] else null
		_preferences[key] = value
		return value

	func set_preference(key: String, value: String) -> void:
		_preferences[key] = value
		write(key, value)


## A store in memory: for tests, and for a café that cannot be saved.
class MemoryStore extends RefCounted:
	var items: Dictionary = {}
	var fail_reads := false
	var fail_writes := false

	func get_item(key: String) -> Dictionary:
		return {"ok": not fail_reads, "value": null if fail_reads else items.get(key)}

	func set_item(key: String, value: String) -> bool:
		if not fail_writes:
			items[key] = value
		return not fail_writes
