class_name ParityWire
extends RefCounted

## Reads the values `scripts/godot-parity/wire.ts` writes: JSON integers, "#" + eight bytes in hex for every
## other number, "#u" for undefined, "#s" before a real string that starts with "#", and {"#p": n} for pooled values.

var pool: Array = []
var _decoded: Dictionary = {}


func value(v: Variant) -> Variant:
	match typeof(v):
		TYPE_STRING:
			if not v.begins_with("#"):
				return v
			if v == "#u":
				return JsUtil.UNDEFINED
			if v.begins_with("#s"):
				return v.substr(2)
			return v.substr(1).hex_decode().decode_double(0)
		TYPE_ARRAY:
			var out := []
			out.resize(v.size())
			for i in v.size():
				out[i] = value(v[i])
			return out
		TYPE_DICTIONARY:
			if v.size() == 1:
				if v.has("#p"):
					return pooled(int(v["#p"]))
				if v.has("#map"):
					var map := {}
					for pair: Array in value(v["#map"]):
						map[pair[0]] = pair[1]
					return map
				if v.has("#set"):
					return value(v["#set"])
			var out := {}
			for k in v:
				out[k] = value(v[k])
			return out
	return v


## A fresh copy each time, so a call that changes it cannot leak into the next case.
func pooled(at: int) -> Variant:
	if not _decoded.has(at):
		_decoded[at] = value(pool[at])
	var v: Variant = _decoded[at]
	return v.duplicate(true) if v is Dictionary or v is Array else v


# ---------------------------------------------------------------- lockstep runs

## The same short name `digest` in scripts/godot-parity/lockstep.ts gives a value: exact bits, exact key order.
static func digest(v: Variant) -> String:
	var parts := PackedStringArray()
	_canon(v, parts)
	return "".join(parts).sha256_text().substr(0, 20)


static func _canon(v: Variant, out: PackedStringArray) -> void:
	match typeof(v):
		TYPE_NIL:
			out.append("n")
		TYPE_BOOL:
			out.append("t" if v else "f")
		TYPE_FLOAT, TYPE_INT:
			out.append("d" + JsMath.float_to_hex_le(float(v)))
		TYPE_STRING:
			out.append("s" + JsJson.stringify(v))
		TYPE_ARRAY:
			out.append("[")
			for i in v.size():
				if i > 0:
					out.append(",")
				_canon(v[i], out)
			out.append("]")
		TYPE_DICTIONARY:
			out.append("{")
			var first := true
			for k: String in JsUtil.own_keys(v):
				out.append(("" if first else ",") + k + ":")
				first = false
				_canon(v[k], out)
			out.append("}")
		_:
			out.append("u")


## Everything a simulation holds, private fields too, named as in TypeScript.
static func inside(sim: CoreSim) -> Dictionary:
	return {
		"customers": sim.customers, "baristas": sim.baristas, "queue": sim.queue, "seats": sim.seats, "servers": sim.servers, "pass": sim.pass_plates, "cooks": sim.cooks, "rack": sim.rack,
		"spawnTimer": sim._spawn_timer, "nextId": sim._next_id, "castRandomState": sim._cast_random_state, "boostCooldown": sim._boost_cooldown, "kitchenStage": sim._kitchen_stage,
		"navigationTables": sim._navigation_tables, "cast": sim._customer_cast.snapshot(),
	}


static func _pairs(map: Dictionary) -> Array:
	var out := []
	for k: Variant in map:
		out.append([k, map[k]])
	return out


## Everything the café moments, the cats and the operation status hold.
static func around(moments: CoreMoments.MomentDirector, cats: CoreLivingCats, monitor: CoreOperations.OperationMonitor, walls: bool) -> Dictionary:
	var out := {
		"moments": [moments.active, moments.reaction, moments._since, moments._next_gap, moments._offered, moments._deliveries, moments._last, moments._day, moments._serial, moments._recommended],
		"cats": [_pairs(cats.actors), _pairs(cats._arrivals), _pairs(cats._preferences), cats._reselect_after_arrival.keys(), cats._height, _pairs(cats._guests), _pairs(cats._guest_bindings),
			_pairs(cats._guest_cooldowns), cats._greeted_guests.keys(), cats._guest_cooldown, _pairs(cats._blocked_seconds)],
	}
	if walls:
		out["walls"] = [cats._signature, _pairs(cats._geometry)]
	out["monitor"] = [monitor._candidate, monitor._since, monitor.current]
	return out


static func _wall() -> String:
	for f: Dictionary in CoreFurniture.FURNITURE:
		if f["surface"] == "wall":
			return f["id"]
	return ""


## What the game reads from a simulation without changing it.
static func queries(sim: CoreSim, state: Dictionary) -> Array:
	var id := func(c: Dictionary) -> float: return c["id"]
	var baristas := range(sim.baristas.size()) + [9]
	var cooks := range(sim.cooks.size()) + [9]
	return [
		sim.finished_service(), sim.help_ready(), sim.queue_choices().map(id), sim.queue_choices(1.0).map(id),
		sim.customers.map(func(c: Dictionary) -> bool: return sim.can_offer_trial_to(state, c["id"])), sim.can_offer_trial_to(state, -5.0),
		baristas.map(func(i: int) -> Array: return [sim.is_holding(i), sim.is_brewing(i), sim.barista_pose(i)]), cooks.map(func(i: int) -> Variant: return sim.cook_station(i)),
		sim.customers.map(func(c: Dictionary) -> bool: return CoreSim.seated(c)),
		[0.0, 3.0, 9.0, 14.0, 22.0, 36.0, NAN, 900.0].map(func(col: float) -> bool: return sim.furniture_space_clear("catbed", col, fmod(col * 7.0, 11.0))),
		sim.furniture_space_clear("catbed", 4.0, INF), sim.furniture_space_clear("nothing", 1.0, 1.0), sim.furniture_space_clear(_wall(), 1.0, 1.0),
	]


## A player's action on something that is not the simulation.
static func perform_on(on: Object, op: Array, state: Dictionary, now: float, sim: CoreSim) -> Variant:
	var args := []
	for a: Variant in op.slice(2):
		args.append(state if a is String and a == "$S" else (now if a is String and a == "$N" else (sim if a is String and a == "$SIM" else a)))
	return _called(on, on.get_method_list(), String(op[1]).to_snake_case(), args)


## A player's action, as scripts/godot-parity/ops.ts writes it: [module, function, ...arguments].
static func perform(op: Array, state: Dictionary, now: float, sim: CoreSim) -> Variant:
	var args := []
	for a: Variant in op.slice(2):
		args.append(state if a is String and a == "$S" else (now if a is String and a == "$N" else a))
	var fn: String = String(op[1]).to_snake_case()
	match op[0]:
		"$SIM":
			return _called(sim, sim.get_method_list(), fn, args)
		"$STATE":
			state[op[1]] = args[0]
			return JsUtil.UNDEFINED
		"$GUEST":
			for c: Dictionary in sim.customers:
				if c["id"] == args[0] and op[1] == "mark":
					c["vip"] = true
					c["extra"] = args[1]
				elif c["id"] == args[0] and not c["hasCup"]:
					c["order"] = args[1]
					c["recommendation"] = args[1]
			return JsUtil.UNDEFINED
	var script: Script = load("res://core/%s.gd" % String(op[0]).replace("-", "_"))
	return _called(script, script.get_script_method_list(), fn, args)


static func _called(on: Object, methods: Array, fn: String, args: Array) -> Variant:
	for m: Dictionary in methods:
		if m["name"] == fn:
			var ret: Variant = on.callv(fn, args)
			return JsUtil.UNDEFINED if ret == null and m["return"]["type"] == TYPE_NIL and not (m["return"]["usage"] & PROPERTY_USAGE_NIL_IS_VARIANT) else ret
	push_error("No function %s" % fn)
	return null
