class_name CoreDecor
extends RefCounted

# Port of src/game/decor.ts

static var _by_id: Dictionary = {}
static var _by_id_ready: bool = false

static var DECOR_SLOTS: Array = RulesData.section("decor")["DECOR_SLOTS"]
static var DECOR: Array = RulesData.section("decor")["DECOR"]
static var STARTER_THEMES: Array = RulesData.section("decor")["STARTER_THEMES"]

static func _ensure_by_id() -> void:
	if _by_id_ready:
		return
	_by_id_ready = true
	for d in DECOR:
		_by_id[d["id"]] = d

static func decor_def(id: Variant) -> Variant:
	_ensure_by_id()
	if id is String and _by_id.has(id):
		return _by_id[id]
	return JsUtil.UNDEFINED

static func decor_for_slot(slot: String) -> Array:
	var out: Array = []
	for d in DECOR:
		if d["slot"] == slot:
			out.append(d)
	return out

static func comfort(state: Dictionary) -> float:
	var room := 0.0
	var equipped: Dictionary = state["decor"]["equipped"]
	for slot in DECOR_SLOTS:
		var eq_id = equipped[slot] if equipped.has(slot) else JsUtil.UNDEFINED
		var def = decor_def(eq_id)
		if not JsUtil.is_undefined(def):
			room += float(def["comfort"])
	return room + CoreFurniture.furniture_comfort(state)

static func owns_decor(state: Dictionary, id: String) -> bool:
	return state["decor"]["owned"].has(id)

static func has_bought_decor(state: Dictionary) -> bool:
	for id in state["decor"]["owned"]:
		var def = decor_def(id)
		if not JsUtil.is_undefined(def) and float(def["cost"]) > 0.0:
			return true
	for p in state["decor"]["placed"]:
		var fdef = CoreFurniture.furniture_def(p["id"])
		if not JsUtil.is_undefined(fdef) and float(fdef["cost"]) > 0.0:
			return true
	for id in state["decor"]["stored"].keys():
		var fdef = CoreFurniture.furniture_def(id)
		if not JsUtil.is_undefined(fdef) and float(fdef["cost"]) > 0.0:
			return true
	return false

static func use_decor(state: Dictionary, id: Variant) -> bool:
	var def = decor_def(id)
	if JsUtil.is_undefined(def):
		return false
	if not owns_decor(state, id):
		if float(state["coins"]) < float(def["cost"]):
			return false
		state["coins"] = float(state["coins"]) - float(def["cost"])
		state["decor"]["owned"].append(id)
	state["decor"]["equipped"][def["slot"]] = id
	return true

static func apply_theme(state: Dictionary, theme_id: String) -> void:
	var themes := STARTER_THEMES
	var theme: Dictionary = themes[0]
	for t in themes:
		if t["id"] == theme_id:
			theme = t
			break
	var equip: Dictionary = theme["equip"]
	for k in equip.keys():
		use_decor(state, equip[k])
