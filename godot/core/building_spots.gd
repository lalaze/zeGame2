class_name CoreBuildingSpots
extends RefCounted

# Port of src/game/building-spots.ts

static var _by_id: Dictionary = {}
static var _by_id_ready: bool = false

static var BUILDING_SPOTS: Array = RulesData.section("building-spots")["BUILDING_SPOTS"]
static var FORMER_CELLS: Array = RulesData.section("building-spots")["FORMER_CELLS"]

static func storeys(tables: float) -> Array:
	var out: Array = ["roof"]
	if tables > 5.0:
		out.append("floor-3")
	if tables > 2.0:
		out.append("floor-2")
	out.append("ground")
	return out

static func _ensure_by_id() -> void:
	if _by_id_ready:
		return
	_by_id_ready = true
	for spot in BUILDING_SPOTS:
		_by_id[spot["id"]] = spot

static func building_spot(id: Variant) -> Variant:
	if JsUtil.is_undefined(id) or not (id is String):
		return JsUtil.UNDEFINED
	_ensure_by_id()
	if _by_id.has(id):
		return _by_id[id]
	return JsUtil.UNDEFINED
