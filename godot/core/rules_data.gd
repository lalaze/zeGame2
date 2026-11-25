class_name RulesData
extends RefCounted

# Loads `res://data/rules.json` once through `JsJson.parse_or_fail` (bit-exact IEEE 754 floats).
# All `godot/core/*` rule modules read exported TS constants from here rather than hand-copying tables.

static var _data: Dictionary = {}
static var _loaded: bool = false

static func load_all() -> Dictionary:
	if _loaded:
		return _data
	var f := FileAccess.open("res://data/rules.json", FileAccess.READ)
	if f == null:
		push_error("RulesData: failed to open res://data/rules.json")
		return {}
	var text := f.get_as_text()
	f.close()
	var parsed = JsJson.parse_or_fail(text)
	if not (parsed is Dictionary):
		push_error("RulesData: res://data/rules.json root is not an object")
		return {}
	_data = parsed
	_loaded = true
	return _data

static func section(name: String) -> Dictionary:
	var all := load_all()
	if not all.has(name):
		push_error("RulesData: missing section '%s'" % name)
		return {}
	return all[name]

static func locale_order(name: String) -> Dictionary:
	var orders: Dictionary = section("localeOrder")
	if not orders.has(name):
		push_error("RulesData: missing localeOrder '%s'" % name)
		return {}
	return orders[name]
