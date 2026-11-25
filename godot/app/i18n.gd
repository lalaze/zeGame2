class_name I18n
extends RefCounted

## The game's words in Chinese and English: port of src/i18n.ts over the same locale files (data/locale-*.json).

const LOCALE_KEY := "tiny-bean-cafe/locale"
static var locale := "zh"
static var _messages: Dictionary = {}
static var _plural := RegEx.create_from_string("\\{(\\w+),\\s*([^{}|]*\\|[^{}]*)\\}")
static var _name := RegEx.create_from_string("\\{(\\w+)\\}")


static func detect(stored: Variant, languages: Array) -> String:
	if stored is String and stored in ["en", "zh"]:
		return stored
	for l: String in languages:
		if l.to_lower().begins_with("zh"):
			return "zh"
	return "en"


static func messages(of: String) -> Dictionary:
	if not _messages.has(of):
		_messages[of] = JSON.parse_string(FileAccess.get_file_as_string("res://data/locale-%s.json" % of))
	return _messages[of]


static func has(key: String) -> bool:
	return messages("en").has(key)


static func t(key: String, params: Dictionary = {}) -> String:
	var template: String = messages(locale).get(key, messages("en").get(key, key))
	return template if params.is_empty() else _fill(template, params)


## For messages that hold a '|'-separated list.
static func list(key: String) -> PackedStringArray:
	return t(key).split("|")


static func _text(value: Variant) -> String:
	return JsMath.number_to_string(float(value)) if value is float or value is int else str(value)


## Plural forms look like "{n, one|other}"; the count must also be among the parameters.
static func _fill(template: String, params: Dictionary) -> String:
	var out := ""
	var at := 0
	for m in _plural.search_all(template):
		out += template.substr(at, m.get_start() - at)
		at = m.get_end()
		out += _form(m, params)
	template = out + template.substr(at)
	out = ""
	at = 0
	for m in _name.search_all(template):
		out += template.substr(at, m.get_start() - at)
		at = m.get_end()
		out += _text(params[m.get_string(1)]) if params.has(m.get_string(1)) else m.get_string()
	return out + template.substr(at)


static func _form(m: RegExMatch, params: Dictionary) -> String:
	if not params.has(m.get_string(1)):
		return m.get_string()
	var forms := m.get_string(2).split("|")
	var value: Variant = params[m.get_string(1)]
	var count: float = float(value) if value is float or value is int else JsMath.parse_float(str(value))
	if not is_finite(count):
		return forms[-1]
	return forms[0] if count == 1.0 else forms[1]


## A dish's name; a signature drink's own, or what is in it.
static func item_name(id: String, state: Dictionary = {}) -> String:
	var custom: Variant = CoreSignatureDrinks.signature_definition(id)
	if custom == null:
		return t("item.%s" % id)
	for r: Dictionary in state.get("signatureDrinks", {}).get("recipes", []):
		if r["id"] == id:
			return r["name"]
	var bases := {"coffee": "咖啡", "tea": "茶", "milk": "奶饮", "fruit": "果饮"} if locale == "zh" else {"coffee": "Coffee", "tea": "Tea", "milk": "Milk", "fruit": "Fruit"}
	var parts := PackedStringArray()
	for ing: String in custom["recipe"]:
		parts.append("%s ×%s" % [t("ing.%s" % ing), JsMath.number_to_string(custom["recipe"][ing])])
	return "%s · %s" % [bases[custom["base"]], " + ".join(parts)]
