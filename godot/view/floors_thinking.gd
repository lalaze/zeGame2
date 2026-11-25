class_name FloorsThinking
extends RefCounted

## What guests and staff think, in words, and when: ports of src/render/thoughts.ts, the pacing of
## src/render/thought-bubbles.ts and showableThoughts of floors-thoughts.ts. FloorsThoughts draws them.
## A thought is {"id" who, "key" the words, "x", "y", "priority", "context" stable while the same situation holds}.

## Thoughts at or above this priority answer the player: they speak at once, ahead of chatter.
const URGENT := 1000.0
## A reply can be a line of a regular's story, so it stays up a little longer.
const _URGENT_SECONDS := 5.0
const _CHAR_H := 28.0
## The part of the screen thoughts show in, clear of the bars: shares of its height.
const _TOP := 0.16
const _BOTTOM := 0.8
const _STATION_KEYS := {
	"cooler": "gather", "dryStore": "gather", "mixer": "mix", "standMixer": "mix", "proofer": "rise", "bench": "prep", "sheeter": "fold", "kettle": "boil",
	"deckOven": "bake", "convection": "bake", "fryer": "fry", "rack": "cool", "pastryFridge": "chill",
}


static func _thought(key: String, context: String, priority: float) -> Dictionary:
	return {"key": key, "context": context, "priority": priority}


static func _taste(c: Dictionary) -> Dictionary:
	var taste := CoreFlavors.guest_taste(c)
	var items := [c["order"], c["extra"]] if JsUtil.truthy(c["extra"]) else [c["order"]]
	for item: String in items:
		var flavors := CoreFlavors.item_flavors(item)
		if flavors.has(taste["liked"]):
			return _thought("thought.like.%s" % taste["liked"], "taste:like:%s:%s" % [item, taste["liked"]], 50.0)
		if flavors.has(taste["avoided"]):
			return _thought("thought.dislike.%s" % taste["avoided"], "taste:dislike:%s:%s" % [item, taste["avoided"]], 50.0)
	return _thought("thought.customer.enjoy" if fmod(CoreFlavors.guest_identity(c), 2.0) != 0.0 else "thought.customer.cozy", "taste:enjoy", 40.0)


static func _customer(c: Dictionary, weather: String, state: Dictionary) -> Variant:
	# The existing order and crossed-out sold-out pictures have right of way.
	if c["phase"] == "ordering" or (c.get("soldOut", false) and c["moodTimer"] > 0.0):
		return null
	if c["hasCup"] and c.has("appearanceId"):
		var memory: Variant = state["guestMemories"].get(JsMath.number_to_string(c["appearanceId"]) if c["appearanceId"] is float else c["appearanceId"])
		if memory is Dictionary and memory["learnedDay"] == state["day"] and (c["order"] == memory["item"] or (c["extra"] is String and c["extra"] == memory["item"])):
			return _thought("memory.thought.loved", "memory:learned:%s" % memory["item"], 85.0)
	match c["phase"]:
		"queue":
			if c["patience"] < 12.0:
				return _thought("thought.customer.urgent", "queue:urgent", 100.0)
			if JsUtil.truthy(c.get("trialSale")):
				return _thought("trial.thought", "queue:trial", 60.0)
			if JsUtil.truthy(c.get("rememberedOrder")):
				return _thought("memory.thought.return", "memory:return:%s" % c["rememberedOrder"], 65.0)
			# Walking in, guests notice what kind of day it is.
			if c["stride"] < 24.0:
				return _thought("thought.customer.arrive" if weather == "fair" else "thought.weather.%s" % weather, "queue:arrive", 35.0)
			return _thought("thought.customer.queue", "queue:waiting", 30.0)
		"toCounter":
			return _thought("thought.customer.myTurn", "counter:approaching", 45.0)
		"toSeat":
			return _thought("thought.customer.findSeat", "seat:approaching", 40.0)
		"waiting":
			return _thought("thought.customer.urgent", "table:urgent", 100.0) if c["timer"] < 15.0 else _thought("thought.customer.wait", "table:waiting", 35.0)
		"sitting":
			# Delivery sets both fields. Never invent a taste before the order arrives.
			if not c["dineIn"] or not c["hasCup"]:
				return null
			if JsUtil.truthy(c["mood"]) and c["mood"] == "happy" and c["moodTimer"] > 0.0:
				return _thought("thought.customer.served", "table:served", 80.0)
			return _taste(c)
		"exiting":
			if c.get("soldOut", false):
				return _thought("thought.customer.nextTime", "exit:soldout", 45.0)
			if not c["hasCup"]:
				return _thought("thought.customer.leave", "exit:unserved", 40.0)
			return _thought("thought.customer.goodbye", "exit:dined", 40.0) if c["dineIn"] else _thought("thought.customer.takeaway", "exit:takeaway", 55.0)
	return null


static func _add(out: Array, id: String, x: float, y: float, value: Dictionary) -> void:
	out.append({"id": id, "x": x, "y": y, "key": value["key"], "priority": value["priority"], "context": value["context"]})


## Every plausible thought right now. Anchors are the rules' own positions; the view moves them to its heads.
static func candidates(sim: CoreSim, state: Dictionary) -> Array:
	var out := []
	if state["phase"] != "open":
		return out
	var weather: String = CoreConditions.today_condition(state)["id"]
	for c: Dictionary in sim.customers:
		var value: Variant = _customer(c, weather, state)
		if value != null:
			_add(out, "customer:%s" % JsMath.number_to_string(c["id"]), c["x"], c["y"] - _CHAR_H - (5.0 if CoreSim.seated(c) else 0.0), value)
	for i in sim.baristas.size():
		var b: Dictionary = sim.baristas[i]
		if b["calling"] > 0.0:
			continue
		var pose := sim.barista_pose(float(i))
		var value: Dictionary
		if sim.is_holding(float(i)):
			value = _thought("thought.staff.orderReady", "order:ready", 65.0)
		elif sim.is_brewing(float(i)):
			value = _thought("thought.owner.working" if i == 0 else "thought.barista.working", "order:working", 35.0)
		elif b["customerId"] != null:
			value = _thought("thought.owner.welcome" if i == 0 else "thought.barista.welcome", "order:welcome", 30.0)
		else:
			value = _thought("thought.owner.idle" if i == 0 else "thought.barista.idle", "order:idle", 15.0)
		_add(out, "barista:%d" % i, pose["x"], pose["y"] - _CHAR_H, value)
	for i in sim.servers.size():
		var server: Dictionary = sim.servers[i]
		if server["ack"] > 0.0:
			continue
		var value: Dictionary
		if server["phase"] == "delivering" and not server["plates"].is_empty():
			value = _thought("thought.server.deliver", "tray:delivering", 55.0)
		elif server["phase"] == "toPass":
			value = _thought("thought.server.pickup", "tray:pickup", 35.0)
		elif server["phase"] == "returning":
			value = _thought("thought.server.return", "tray:returning", 25.0)
		else:
			value = _thought("thought.server.idle", "tray:idle", 15.0)
		_add(out, "server:%d" % i, server["x"], server["y"] - _CHAR_H, value)
	if not state["kitchen"]:
		return out
	for i in sim.cooks.size():
		var at: Variant = sim.cook_station(float(i))
		var value: Dictionary
		if at == null:
			value = _thought("thought.cook.idle", "batch:idle", 15.0)
		elif at["station"] == "door":
			value = _thought("thought.cook.ready", "batch:ready", 65.0)
		elif not at["working"]:
			value = _thought("thought.cook.carry", "batch:carry:%s" % at["station"], 25.0)
		else:
			value = _thought("thought.cook.%s" % _STATION_KEYS[at["station"]], "batch:working:%s" % at["station"], 35.0)
		_add(out, "cook:%d" % i, sim.cooks[i]["x"], sim.cooks[i]["y"] - _CHAR_H, value)
	return out


## The thoughts that can show: of people in `view` ({"x", "y", "w", "h"}, world pixels) who are where the thought says
## they are. `head` gives {"x", "y", "arrived"} or null. A moment's guest (`quiet`) keeps quiet.
static func showable(list: Array, head: Callable, view: Dictionary, quiet: Variant = null) -> Array:
	var out := []
	for candidate: Dictionary in list:
		if quiet != null and not JsUtil.is_undefined(quiet) and candidate["id"] == "customer:%s" % JsMath.number_to_string(quiet) and candidate["priority"] < URGENT:
			continue
		var at: Variant = head.call(candidate["id"])
		var context: String = candidate["context"]
		if at == null or ((context.begins_with("table:") or context.begins_with("taste:") or context.begins_with("memory:")) and not at["arrived"]):
			continue
		var x: float = (at["x"] - view["x"]) / view["w"]
		var y: float = (at["y"] - view["y"]) / view["h"]
		if x > 0.02 and x < 0.98 and y > _TOP and y < _BOTTOM:
			var shown := candidate.duplicate()
			shown["x"] = at["x"]
			shown["y"] = at["y"]
			out.append(shown)
	return out


## One thought at a time, with pauses: real seconds, no random draws, never part of a save.
class Pacing extends RefCounted:
	var _active: Dictionary = {}
	var _cooldown: Dictionary = {}
	var _now := 0.0
	var _room := ""
	var _next := 0.0

	func clear() -> void:
		_active.clear()
		_cooldown.clear()
		_next = _now + 0.7

	func update(dt: float, room: String, enabled: bool, list: Array) -> Array:
		_now += minf(0.25, maxf(0.0, dt))
		if not enabled or room != _room:
			clear()
			_room = room
			return []
		var live := {}
		for c: Dictionary in list:
			live[c["id"]] = c
		for id: String in _active.keys():
			var a: Dictionary = _active[id]
			if not live.has(id) or live[id]["context"] != a["context"] or a["until"] <= _now:
				_active.erase(id)
		for id: String in _cooldown.keys():
			if not live.has(id):
				_cooldown.erase(id)
		var urgent: Variant = null
		for c: Dictionary in list:
			if c["priority"] >= FloorsThinking.URGENT and not _active.has(c["id"]) and not (_cooldown.has(c["id"]) and _cooldown[c["id"]]["context"] == c["context"]):
				urgent = c
				break
		if urgent != null:
			_active.clear()
			_active[urgent["id"]] = {"context": urgent["context"], "until": _now + FloorsThinking._URGENT_SECONDS}
			_cooldown[urgent["id"]] = {"until": _now + 19.0, "context": urgent["context"]}
			_next = _now + 2.4
		elif _active.is_empty() and _now >= _next:
			var open := list.filter(_may_speak)
			if not open.is_empty():
				open = JsUtil.stable_sort(open, func(a: Dictionary, b: Dictionary) -> float:
					return b["priority"] - a["priority"] if b["priority"] != a["priority"] else float(FloorsThinking._compare(a["id"], b["id"])))
				var c: Dictionary = open[0]
				_active[c["id"]] = {"context": c["context"], "until": _now + 3.6}
				_cooldown[c["id"]] = {"until": _now + 19.0, "context": c["context"]}
				_next = _now + 2.4
		return _active.keys().map(func(id: String) -> Dictionary: return live[id])

	func _may_speak(c: Dictionary) -> bool:
		var previous: Variant = _cooldown.get(c["id"])
		# A first taste must still fit into a short visit after a queue or service thought.
		var first_taste: bool = previous != null and String(c["context"]).begins_with("taste:") and not String(previous["context"]).begins_with("taste:")
		return not _active.has(c["id"]) and (previous == null or previous["until"] <= _now or first_taste)


## As localeCompare orders ids ("barista:0", "customer:12"): letters and digits by code, which is the same here.
static func _compare(a: String, b: String) -> int:
	return -1 if a < b else (1 if a > b else 0)
