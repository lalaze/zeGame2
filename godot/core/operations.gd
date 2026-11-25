class_name CoreOperations
extends RefCounted

## Port of src/game/operations.ts: what is holding the café up right now.


static func operation_status(state: Dictionary, sim: Object) -> Dictionary:
	if state["phase"] == "closing":
		return {"kind": "closing"}
	var items := CoreEconomy.menu_items(state)
	for m: Dictionary in items:
		var id: String = m["id"]
		if CoreEconomy.servings_left(state, id) < 1.0 and (not CoreEconomy.is_bakery(id) or state["shelf"].get(id, 0.0) == 0.0) and state["inProduction"].get(id, 0.0) == 0.0:
			var short := []
			for part: Array in CoreEconomy.recipe(id):
				if state["pantry"][part[0]] < part[1]:
					short.append(part[0])
			return {"kind": "ingredients", "item": id, "ingredients": short}
	# Plates backing up on the pass. With the line full too, new guests are being turned away.
	var holding := false
	for i in sim.baristas.size():
		holding = holding or sim.is_holding(i)
	if holding or sim.pass_plates.size() >= maxf(3.0, CoreEconomy.pass_capacity(state) / 2.0):
		return {"kind": "turnedAway" if sim.queue.size() >= CoreData.MAX_QUEUE else "delivery"}
	for m: Dictionary in items:
		var id: String = m["id"]
		if not CoreEconomy.is_bakery(id) or state["shelf"].get(id, 0.0) != 0.0:
			continue
		for cook: Dictionary in sim.cooks:
			var batch: Variant = cook["batch"]
			if batch is Dictionary and batch["item"] == id:
				# Remaining station work is a lower bound: movement also takes time.
				var work := JsMath.js_max(0.0, batch["timer"])
				var rest := 0.0
				for s: String in CoreKitchen.batch_steps(id).slice(int(batch["step"]) + 1):
					rest += CoreKitchen.STATION_SECONDS[s] * CoreStyles.style_station_multiplier(state)
				return {"kind": "baking", "item": id, "seconds": ceil(work + rest)}
		return {"kind": "shelf", "item": id}
	if sim.queue.size() >= 3:
		var all_brewing := true
		for i in sim.baristas.size():
			all_brewing = all_brewing and sim.is_brewing(i)
		if all_brewing:
			return {"kind": "counter"}
	if state["dayTime"] >= 20.0 and sim.queue.is_empty() and sim.pass_plates.is_empty():
		var idle := true
		for b: Dictionary in sim.baristas:
			idle = idle and b["customerId"] == null
		for s: Dictionary in sim.servers:
			idle = idle and s["plates"].is_empty()
		if idle:
			return {"kind": "quiet"}
	return {"kind": "steady"}


## Keeps brief transients from flickering the advice. Measured in simulation time.
class OperationMonitor extends RefCounted:
	var _candidate := ""
	var _since := 0.0
	var current := {"kind": "steady"}

	func update(state: Dictionary, sim: Object) -> Dictionary:
		var next := CoreOperations.operation_status(state, sim)
		var key := "%s:%s" % [next["kind"], next.get("item", "")]
		if key != _candidate or state["dayTime"] < _since:
			_candidate = key
			_since = state["dayTime"]
		if next["kind"] == "closing" or state["dayTime"] - _since >= 3.0:
			current = next
		return current

	func reset() -> void:
		_candidate = ""
		_since = 0.0
		current = {"kind": "steady"}
