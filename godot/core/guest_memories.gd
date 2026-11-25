class_name CoreGuestMemories
extends RefCounted

## Port of src/game/guest-memories.ts. Keys are guest numbers as text ("12"), as in a JavaScript object.


## Whether this appearance is an ordinary cast member; named regulars keep their stories.
static func memory_guest(id: Variant) -> bool:
	if not JsMath.is_integer(id) or id < 0.0 or id >= CoreCustomerCast.CUSTOMER_CAST.size():
		return false
	for g: Dictionary in CoreRegularGuestsContent.REGULAR_GUESTS:
		if g["appearanceId"] == id:
			return false
	return true


static func _drink(id: Variant) -> bool:
	var def: Variant = CoreEconomy.menu_item(id) if id is String else null
	return def != null and CoreData.is_drink(def["category"])


static func _loves(id: float, item: String) -> bool:
	var taste := CoreFlavors.guest_taste({"appearanceId": id, "look": CoreCustomerCast.CUSTOMER_CAST[int(id)]["look"]})
	var notes := CoreFlavors.item_flavors(item)
	return notes.has(taste["liked"]) and not notes.has(taste["avoided"])


static func _key(id: float) -> String:
	return str(int(id))


## No new arrival, pairing, price bonus or random draw: replace an existing drink slot.
static func remembered_order(s: Dictionary, appearance_id: Variant, order: String, extra: Variant) -> Dictionary:
	var memory: Variant = s["guestMemories"].get(_key(appearance_id)) if memory_guest(appearance_id) else null
	if not memory is Dictionary or not CoreEconomy._on(CoreEconomy.menu_items(s), memory["item"]) or CoreEconomy.ready_servings(s, memory["item"]) < 1.0:
		return {"order": order, "extra": extra}
	if _drink(order):
		return {"order": memory["item"], "extra": extra, "rememberedOrder": memory["item"]}
	if extra != null and _drink(extra):
		return {"order": order, "extra": memory["item"], "rememberedOrder": memory["item"]}
	return {"order": order, "extra": extra}


## Only the once-only payment/handoff path calls this, before clearing live order tags.
static func record_guest_memory(s: Dictionary, c: Dictionary, bought: Array, trial_item: Variant = JsUtil.UNDEFINED) -> void:
	var appearance: Variant = c.get("appearanceId")
	if s["phase"] == "prep" or c["hasCup"] or JsUtil.truthy(c.get("regularGuestId")) or not memory_guest(appearance):
		return
	var key := _key(appearance)
	var previous: Variant = s["guestMemories"].get(key)
	if previous is Dictionary and c.get("rememberedOrder") is String and c["rememberedOrder"] == previous["item"] and bought.has(previous["item"]):
		previous["lastServedDay"] = s["day"]
		previous["returns"] = JsMath.js_min(1e9, previous["returns"] + 1.0)
	var item: Variant = c["recommendation"] if c.get("recommendation") is String else trial_item
	if not item is String or item.is_empty() or not bought.has(item) or not _drink(item) or not _loves(appearance, item):
		return
	# Recommending the same favorite again doesn't invent a new discovery or reset history.
	if previous is Dictionary and previous["item"] == item:
		previous["lastServedDay"] = s["day"]
		return
	var memory := {"item": item}
	for recipe: Dictionary in s["signatureDrinks"]["recipes"]:
		if recipe["id"] == item and not recipe["name"].is_empty():
			memory["name"] = recipe["name"]
			break
	memory["source"] = "recommend" if JsUtil.truthy(c.get("recommendation")) else "trial"
	memory["learnedDay"] = s["day"]
	memory["lastServedDay"] = s["day"]
	memory["returns"] = 0.0
	s["guestMemories"][key] = memory


static func _int(v: Variant, least: float, most: float) -> bool:
	return JsMath.is_safe_integer(v) and v >= least and v <= most


## Missing legacy fields never infer a recommendation from ordinary historical sales.
static func parse_guest_memories(raw: Variant, day: float) -> Dictionary:
	var out := {}
	if not raw is Dictionary:
		return out
	for cast: Dictionary in CoreCustomerCast.CUSTOMER_CAST:
		var id: float = cast["id"]
		if not memory_guest(id):
			continue
		var v: Variant = JsUtil.prop(raw, _key(id))
		if not v is Dictionary:
			continue
		var item: Variant = JsUtil.prop(v, "item")
		var source: Variant = JsUtil.prop(v, "source")
		var learned: Variant = JsUtil.prop(v, "learnedDay")
		var last: Variant = JsUtil.prop(v, "lastServedDay")
		var returns: Variant = JsUtil.prop(v, "returns")
		if (not item is String or not _drink(item) or not _loves(id, item) or not source is String or source != "recommend" and source != "trial"
				or not _int(learned, 1.0, day) or not _int(last, learned, day) or not _int(returns, 0.0, 1e9)):
			continue
		var memory := {"item": item, "source": source, "learnedDay": learned, "lastServedDay": last, "returns": returns}
		var name: Variant = JsUtil.prop(v, "name")
		if name is String:
			memory["name"] = JsUtil.js_trim(JsUtil.strip_ascii_control(name)).substr(0, 24)
		out[_key(id)] = memory
	return out
