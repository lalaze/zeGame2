class_name CoreRecovery
extends RefCounted

## Port of src/game/recovery.ts: one free bean, only when ordinary stock, shopping and free goals cannot help.
## TypeScript turns any error from a malformed state into "no"; here the shape is checked first.

## Pure reachability results only, at most 32 of them.
static var _comfort_reachability: Dictionary = {}


static func _count(v: Variant) -> bool:
	return JsMath.is_safe_integer(v) and v >= 0.0


static func _amount(v: Variant) -> bool:
	return JsMath.is_finite_num(v) and v >= 0.0


## Every number finite, nothing undefined, nothing containing itself.
static func _finite_tree(v: Variant, inside: Array = []) -> bool:
	if JsUtil.is_number(v):
		return is_finite(v)
	if v == null or v is String or v is bool:
		return true
	if not (v is Dictionary or v is Array):
		return false
	for outer: Variant in inside:
		if is_same(outer, v):
			return false
	inside.append(v)
	var ok := true
	for child: Variant in (v.values() if v is Dictionary else v):
		if not _finite_tree(child, inside):
			ok = false
			break
	inside.pop_back()
	return ok


static func _valid_state(state: Dictionary) -> bool:
	for key: String in ["items", "pantry", "upgrades", "decor"]:
		if not state.get(key) is Dictionary:
			return false
	var sig: Variant = state.get("signatureDrinks")
	if not sig is Dictionary or not sig.get("recipes") is Array or not sig.get("tested") is Array or not sig.get("served") is Dictionary:
		return false
	var parsed := CoreSignatureDrinks.parse_signature_drinks(sig)
	if parsed["recipes"].size() != sig["recipes"].size() or parsed["tested"].size() != sig["tested"].size() or parsed["served"].size() != sig["served"].size():
		return false
	for i in parsed["tested"].size():
		if not JsUtil.same_value_zero(parsed["tested"][i], sig["tested"][i]):
			return false
	for i in parsed["recipes"].size():
		for key: String in ["id", "name", "onMenu"]:
			if not JsUtil.same_value_zero(parsed["recipes"][i][key], JsUtil.prop(sig["recipes"][i], key)):
				return false
	for id: String in parsed["served"]:
		if not JsUtil.same_value_zero(parsed["served"][id], JsUtil.prop(sig["served"], id)):
			return false
	if not _finite_tree(state) or not _amount(state.get("coins")) or not _amount(state.get("totalEarned")) or not _count(state.get("served")) or not _count(state.get("day")) or state["day"] < 1.0 or not _count(state.get("goal")) or state["goal"] > CoreGoals.GOALS.size() or not state.get("kitchen") is bool:
		return false
	for m: Dictionary in CoreData.MENU:
		if not _count(state["items"].get(m["id"])):
			return false
	if state["items"]["espresso"] < 1.0:
		return false
	for i: Dictionary in CoreData.INGREDIENTS:
		# Trial portions use quarters.
		var n: Variant = state["pantry"].get(i["id"])
		if not _amount(n) or not JsMath.is_safe_integer(n * 4.0):
			return false
	for u: Dictionary in CoreData.UPGRADES:
		var level: Variant = state["upgrades"].get(u["id"])
		if not _count(level) or level > u["max"]:
			return false
	for id: String in state["items"]:
		if CoreData.find_menu(id) == null and not (CoreSignatureDrinks.signature_definition(id) != null and sig["tested"].has(id) and JsUtil.same_value_zero(state["items"][id], 1.0)):
			return false
	for id: String in state["pantry"]:
		if not CoreEconomy.ingredient_def(id) is Dictionary:
			return false
	var on_menu: Variant = state.get("onMenu")
	if not on_menu is Array:
		return false
	for i in on_menu.size():
		if CoreData.find_menu(on_menu[i]) == null or state["items"][on_menu[i]] < 1.0 or on_menu.find(on_menu[i]) != i:
			return false
	for key: String in ["shelf", "inProduction", "bakePlan"]:
		var stock: Variant = state.get(key)
		if not stock is Dictionary:
			return false
		for id: String in stock:
			if CoreData.find_menu(id) == null or not _count(stock[id]):
				return false
	var regions: Variant = state.get("regions")
	if not regions is Array or regions.size() > CoreRegions.REGIONS.size():
		return false
	for i in regions.size():
		if not JsUtil.same_value_zero(regions[i], CoreRegions.REGIONS[i]["id"]):
			return false
	return _valid_decor(state["decor"])


static func _valid_decor(decor: Dictionary) -> bool:
	if not decor.get("owned") is Array or not decor.get("placed") is Array or not decor.get("stored") is Dictionary or not decor.get("equipped") is Dictionary:
		return false
	for id: Variant in decor["owned"]:
		if not CoreDecor.decor_def(id) is Dictionary:
			return false
	for slot: String in CoreDecor.DECOR_SLOTS:
		var id: Variant = decor["equipped"].get(slot)
		if not JsUtil.includes(decor["owned"], id) or CoreDecor.decor_def(id)["slot"] != slot:
			return false
	for p: Variant in decor["placed"]:
		var def: Variant = CoreFurniture.furniture_def(JsUtil.prop(p, "id"))
		if not def is Dictionary:
			return false
		var claim: Variant = JsUtil.prop(p, "spot")
		if JsUtil.is_undefined(claim):
			if not _count(JsUtil.prop(p, "col")) or not _count(JsUtil.prop(p, "row")):
				return false
		else:
			var spot: Variant = CoreBuildingSpots.building_spot(claim)
			if not spot is Dictionary or spot["surface"] != def["surface"]:
				return false
	for id: String in decor["stored"]:
		if not CoreFurniture.furniture_def(id) is Dictionary or not _count(decor["stored"][id]):
			return false
	return true


## Prove a free comfort goal route using only actual legal furniture placements.
static func _can_reach_owned_comfort(state: Dictionary, target: float) -> bool:
	var decor: Dictionary = state["decor"]
	var room := 0.0
	for slot: String in CoreDecor.DECOR_SLOTS:
		var best := 0.0
		for id: String in decor["owned"]:
			var def: Dictionary = CoreDecor.decor_def(id)
			if def["slot"] == slot:
				best = maxf(best, def["comfort"])
		room += best
	var needed := target - room
	if needed <= 0.0:
		return true
	var owned := {}
	for p: Dictionary in decor["placed"]:
		owned[p["id"]] = true
	for id: String in decor["stored"]:
		if decor["stored"][id] > 0.0:
			owned[id] = true
	var kinds := []
	for id: String in owned:
		var def: Dictionary = CoreFurniture.furniture_def(id)
		if def["comfort"] > 0.0:
			kinds.append(def)
	var order := RulesData.locale_order("furniture")
	JsUtil.stable_sort(kinds, func(a: Dictionary, b: Dictionary) -> float: return JsUtil.locale_compare(a["id"], b["id"], order))
	var total := 0.0
	for d: Dictionary in kinds:
		total += d["comfort"]
	if total < needed:
		return false
	if JsUtil.truthy(decor.get("building")):
		# One piece a spot, and any piece fits any spot on its surface: the cosiest kinds go up first.
		var reachable := 0.0
		for surface: String in ["floor", "wall"]:
			var comforts := []
			for d: Dictionary in kinds:
				if d["surface"] == surface:
					comforts.append(d["comfort"])
			JsUtil.stable_sort(comforts, func(a: float, b: float) -> float: return b - a)
			var room_for := 0
			for spot: Dictionary in CoreFurniture.built_spots(state):
				if spot["surface"] == surface:
					room_for += 1
			for c: float in comforts.slice(0, room_for):
				reachable += c
		return reachable >= needed
	var tables := CoreRegions.main_table_count(state)
	var key: String = JsJson.stringify([needed, tables, state["regions"], kinds.map(func(d: Dictionary) -> Array: return [d["id"], d["surface"], d["w"], d["h"], d["comfort"]])])
	if not _comfort_reachability.has(key):
		var result := _search_comfort_layout(state, needed, tables, kinds)
		if _comfort_reachability.size() >= 32:
			_comfort_reachability.erase(_comfort_reachability.keys()[0])
		_comfort_reachability[key] = result
	return _comfort_reachability[key]


static func _search_comfort_layout(state: Dictionary, needed: float, tables: float, kinds: Array) -> bool:
	var empty := state.duplicate(false)
	empty["decor"] = state["decor"].duplicate(false)
	empty["decor"]["placed"] = []
	# Identical footprints share placement choices.
	var shapes := {}
	for def: Dictionary in kinds:
		var key := "%s:%s:%s" % [def["surface"], def["w"], def["h"]]
		if not shapes.has(key):
			shapes[key] = {"def": def, "comforts": []}
		shapes[key]["comforts"].append(def["comfort"])
	var groups: Array = shapes.values()
	for group: Dictionary in groups:
		JsUtil.stable_sort(group["comforts"], func(a: float, b: float) -> float: return b - a)
	JsUtil.stable_sort(groups, func(a: Dictionary, b: Dictionary) -> float: return b["comforts"][0] - a["comforts"][0])
	var width := int(CoreFurniture.COLS) * CoreRegions.AREA_IDS.size()
	var candidates := []
	for group: Dictionary in groups:
		var def: Dictionary = group["def"]
		var wall: bool = def["surface"] == "wall"
		var rows := CoreFurniture.WALL_ROWS if wall else CoreFurniture.FLOOR_ROWS
		var band := int(CoreFurniture.FLOOR_ROWS) if wall else 0
		var masks := []
		var areas := ["main"]
		areas.append_array(state["regions"])
		for area: String in areas:
			var start: float = CoreRegions.region_offset(area) / CoreFurniture.CELL
			var col := start
			while col + def["w"] <= start + CoreFurniture.COLS:
				var row := 0.0
				while row + def["h"] <= rows:
					if CoreFurniture.can_place(empty, def["id"], col, row, tables):
						if group["comforts"][0] >= needed:
							return true
						var cells := PackedInt32Array()
						for x in range(int(col), int(col + def["w"])):
							for y in range(int(row), int(row + def["h"])):
								cells.append((y + band) * width + x)
						masks.append(cells)
					row += 1.0
				col += 1.0
		if masks.is_empty():
			continue
		var group_end := candidates.size() + (group["comforts"] as Array).size()
		for comfort: float in group["comforts"]:
			candidates.append({"comfort": comfort, "masks": masks, "groupEnd": group_end})
		# A witness using any already-enumerated subset is sufficient.
		if LayoutSearch.new(candidates).search(0, needed, {}, 0):
			return true
	return false


## No time or node cap: an exhausted finite search is an actual impossibility proof.
class LayoutSearch:
	var candidates: Array
	var remaining: Array = []
	var impossible: Dictionary = {}

	func _init(list: Array) -> void:
		candidates = list
		remaining.resize(list.size() + 1)
		remaining.fill(0.0)
		for i in range(list.size() - 1, -1, -1):
			remaining[i] = remaining[i + 1] + list[i]["comfort"]

	func _free(mask: PackedInt32Array, occupied: Dictionary) -> bool:
		for cell in mask:
			if occupied.has(cell):
				return false
		return true

	func search(index: int, shortfall: float, occupied: Dictionary, first_mask: int) -> bool:
		if shortfall <= 0.0:
			return true
		if remaining[index] < shortfall:
			return false
		var cells := occupied.keys()
		cells.sort()
		var key := "%d:%s:%s:%d" % [index, shortfall, cells, first_mask]
		if impossible.has(key):
			return false
		# An admissible bound: count each remaining kind only if one of its placements is still free.
		var available := 0.0
		var i := index
		while i < candidates.size() and available < shortfall:
			var masks: Array = candidates[i]["masks"]
			for j in range(first_mask if i < candidates[index]["groupEnd"] else 0, masks.size()):
				if _free(masks[j], occupied):
					available += candidates[i]["comfort"]
					break
			i += 1
		if available < shortfall:
			return false
		var candidate: Dictionary = candidates[index]
		for j in range(first_mask, candidate["masks"].size()):
			var mask: PackedInt32Array = candidate["masks"][j]
			if not _free(mask, occupied):
				continue
			var more := occupied.duplicate(false)
			for cell in mask:
				more[cell] = true
			# Canonical ordering eliminates permutations of identical footprints.
			if search(index + 1, shortfall - candidate["comfort"], more, j + 1 if index + 1 < candidate["groupEnd"] else 0):
				return true
		if search(candidate["groupEnd"], shortfall, occupied, 0):
			return true
		impossible[key] = true
		return false


static func can_emergency_restock(state: Dictionary) -> bool:
	if state.get("phase") != "prep" or not _valid_state(state):
		return false
	# At $1 or more a bean can be bought normally; below $1 every paid goal prerequisite is unaffordable.
	if state["pantry"]["beans"] >= 1.0 or state["coins"] >= CoreEconomy.ingredient_def("beans")["cost"]:
		return false
	# In-flight paid work blocks aid.
	for id: String in state["inProduction"]:
		if state["inProduction"][id] > 0.0:
			return false
	for m: Dictionary in CoreEconomy.unlocked_items(state):
		var id: String = m["id"]
		if not CoreEconomy.can_prepare_item(state, id):
			continue
		if state["shelf"].get(id, 0.0) > 0.0 or CoreEconomy.servings_left(state, id) >= 1.0:
			return false
		var cost := 0.0
		for part: Array in CoreEconomy.recipe(id):
			cost += JsMath.js_max(0.0, ceil(part[1] - state["pantry"][part[0]])) * CoreEconomy.ingredient_def(part[0])["cost"]
		if cost <= state["coins"]:
			return false
	if CoreGoals.goal_done(state):
		return false
	var goal: Variant = CoreGoals.current_goal(state)
	# Opening and closing an empty day is free.
	if goal != null and (goal["id"] == "firstDay" or goal["id"] == "days5"):
		return false
	return not (goal != null and goal["id"] == "comfort" and _can_reach_owned_comfort(state, CoreGoals.goal_progress("comfort", state)[1]))


## True only for an actual grant; the bean itself prevents a second grant until it is consumed.
static func emergency_restock(state: Dictionary) -> bool:
	if not can_emergency_restock(state):
		return false
	state["pantry"]["beans"] += 1.0
	if not state["onMenu"].has("espresso"):
		state["onMenu"].append("espresso")
	return true
