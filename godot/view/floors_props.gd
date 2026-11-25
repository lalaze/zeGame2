class_name FloorsProps
extends RefCounted

## What people order, carry and think: the drink or pastry in front of each seated guest, trays, takeaway cups, finished
## orders, the tip jar and the bell on the counter, the cake display, a parcel at the door, the bubbles over heads, the
## bars over people at work, and the coins, tips and sparkles the rules ask for. Port of floors-props.ts.

## Seated frames of a guest's moves sheet.
const _SIT := 8
const _HOLD := 9
const _SIP := 10
const _LAUGH := 11
## A served guest's drink stands on the table, then is picked up, sipped and enjoyed, in seconds of this cycle.
const _CYCLE := 7.0
const _ON_TABLE := 3.4
const _HOLDING := 4.3
const _SIPPING := 5.5
## Where things stand on a table, from a seat: the table top's near half, towards the guest.
const _TABLE := {"top": -84.0, "near": 62.0, "single": 46.0, "far": 28.0, "size": 56.0}
## The ground floor's counter: its top's front edge, the pass beside the display, the bell, the tip jar, a catering order
## at its left end, and Mina's map hanging on its front.
const _COUNTER := {"top": 375.0, "pass": [872.0, 914.0, 728.0], "bell": 1066.0, "jar": 742.0, "order": 520.0, "map": {"floor": "ground", "x": 560.0, "y": 492.0}, "size": 50.0}
## The cake display: where its emptied picture goes and where baked goods stand on its shelves.
const _CASE := {"x": 1066.0, "y": 286.0, "shelves": [386.0, 452.0], "columns": [1140.0, 1206.0, 1272.0], "size": 46.0}
## How much of a bubble's height, from its bottom, is tail, and so where its picture is centred.
const _INSIDE := {"bubble": 0.59, "thought": 0.64, "bubble-wide": 0.6}
## Where a speech bubble's paper ends and its tail begins, from its bottom.
const _FOOT := 0.2
const _INK := Color8(0x4f, 0x3b, 0x2f)
const _MONEY := Color8(0x8a, 0x5a, 0x1c)
const _PAPER := Color8(0xff, 0xfa, 0xf0)

var _scene: FloorsScene
var _pool: Dictionary = {}
var _used: Dictionary = {}
## Seconds of play: stops while the game is paused.
var _clock := 0.0
var _steam := 0.0
var _bell_rang := -1e9
## Where the moment's cue last was, for the tip or the flash its answer brings: {"at", "when"}.
var _last_cue: Dictionary = {}
var _rng := RandomNumberGenerator.new()
var _case := ""


func _init(scene: FloorsScene) -> void:
	_scene = scene
	if scene.library.exists("fx/case-empty"):
		_case = "fx/case-empty"


# ---------------------------------------------------------------- drawing

## A picture kept from frame to frame under a key; whatever is not asked for again goes.
func _show(key: String, texture: String, frame: Variant, at: Vector2, depth: float) -> FloorsPic:
	var p: FloorsPic = _pool.get(key)
	if p == null:
		p = _scene.pic(texture, frame)
		_pool[key] = p
	else:
		p.show_frame(texture, frame)
	_used[key] = true
	p.origin = Vector2(0.5, 1.0)
	p.depth = depth
	p.place = at
	p.alpha = 1.0
	p.turn = 0.0
	p.stretch = Vector2.ONE
	p.flip = false
	return p


static func _fit(p: FloorsPic, size: float) -> void:
	p.stretch = Vector2.ONE * size / maxf(p.size.x, p.size.y)


## A menu item's picture: [texture, frame]; a cup stands in for one without.
func _picture(id: String) -> Array:
	var frame := FloorsArt.item_frame(id)
	return ["fx-items", frame] if _scene.library.has_frame("fx-items", frame) else ["fx", "cup"]


func _item(key: String, id: String, at: Vector2, depth: float, size: float) -> FloorsPic:
	var of := _picture(id)
	var p := _show(key, of[0], of[1], at, depth)
	_fit(p, size)
	return p


## A bubble over a head with one or two pictures in it ([texture, frame, alpha?]), kept while it is asked for.
func _bubble(key: String, head: Vector2, kind: String, pictures: Array, stretch: float) -> void:
	var back := _show(key, "fx", kind, head, FloorsDepth.BUBBLE)
	back.stretch = Vector2.ONE * stretch
	var shown := back.shown_size()
	var y: float = head.y - shown.y * _INSIDE[kind]
	var side := minf(shown.y * 0.52, shown.x * (0.4 if pictures.size() > 1 else 0.62))
	for k in pictures.size():
		var of: Array = pictures[k]
		var p := _show("%s:%d" % [key, k], of[0], of[1], Vector2(head.x + (k - (pictures.size() - 1) / 2.0) * shown.x * 0.44, y), FloorsDepth.BUBBLE + 0.1 + k * 0.02)
		p.origin = Vector2(0.5, 0.5)
		_fit(p, side)
		p.alpha = of[2] if of.size() > 2 else 1.0


## A one-off picture that pops in, drifts up and fades.
func _pop(frame: String, at: Vector2, size: float = 60.0, rise: float = 60.0, seconds: float = 0.7, delay: float = 0.0) -> void:
	var p := _scene.pic("fx", frame, Vector2(0.5, 0.5), FloorsDepth.BUBBLE + 1.0, at)
	p.alpha = 0.0
	var full := size / maxf(p.size.x, p.size.y)
	p.stretch = Vector2.ONE * full * 0.3
	var grow := _scene.create_tween().set_parallel()
	grow.tween_property(p, "stretch", Vector2.ONE * full, 0.2).set_delay(delay).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	grow.tween_property(p, "alpha", 1.0, 0.2).set_delay(delay)
	var fade := _scene.create_tween().set_parallel()
	fade.tween_property(p, "place:y", at.y - rise, 0.45).set_delay(delay + seconds)
	fade.tween_property(p, "alpha", 0.0, 0.45).set_delay(delay + seconds)
	fade.chain().tween_callback(p.queue_free)


## Words that rise and fade, and what rises with them.
func _label(text: String, at: Vector2, size: float, colour: Color, rise: float = 70.0) -> FloorsText:
	var w := _scene.words(text, size, colour, FloorsDepth.BUBBLE + 2.0, at, roundf(size / 4.8), _PAPER)
	_float_away(w, rise)
	return w


func _float_away(what: Node2D, rise: float) -> void:
	var tween := _scene.create_tween().set_parallel()
	tween.tween_property(what, "place:y", what.place.y - rise, 1.0).set_delay(0.5)
	tween.tween_property(what, "alpha", 0.0, 1.0).set_delay(0.5)
	tween.chain().tween_callback(what.queue_free)


func _puff(at: Vector2, depth: float) -> void:
	var p := _scene.pic("fx", "puff", Vector2(0.5, 0.5), depth, at + Vector2(_rng.randi_range(-6, 6), 0.0))
	p.stretch = Vector2(0.3, 0.3)
	p.alpha = 0.8
	var tween := _scene.create_tween().set_parallel()
	tween.tween_property(p, "place:y", at.y - 46.0, 1.5)
	tween.tween_property(p, "stretch", Vector2(0.62, 0.62), 1.5)
	tween.tween_property(p, "alpha", 0.0, 1.5)
	tween.chain().tween_callback(p.queue_free)


func _ground(b: Dictionary, x: float, y: float) -> Vector2:
	return Vector2(x, FloorsLayout.world_y(b, "ground", y))


# ---------------------------------------------------------------- each frame

## Draws the props for where everyone is now. `dt` is 0 while the game is paused.
func sync(b: Dictionary, active: Array, dt: float) -> void:
	_clock += dt
	_steam -= dt
	var steaming := _steam <= 0.0
	if steaming:
		_steam = 0.9
	_used.clear()
	var s := _scene.state()
	# Behind the front walls only what floats over them would show: leave the heads bare.
	var heads := not _scene.feed.outer_wall
	for c: Dictionary in _scene.sim().customers:
		var actor: FloorsScene.Actor = _scene.customers.get(c["id"])
		if actor == null:
			continue
		_at_table(b, c, actor, active, steaming)
		if actor.cup != null:
			# Leaving with their order: a paper cup, or a bakery bag when there was nothing to drink.
			var drink := FloorsArt.is_drink_item(c["order"]) or (c["extra"] is String and FloorsArt.is_drink_item(c["extra"]))
			actor.cup.show_frame("fx", "takeaway" if drink else "bag")
		if heads and actor.pic.visible and actor.pic.alpha > 0.6:
			_over_head(c, actor)
	_on_counter(b, s, steaming)
	_reserved(b, s, active)
	if _scene.feed.moment != null and _scene.feed.moment["kind"] == "delivery":
		# The supplier's parcel waits on the front step until it is signed for or taken back.
		var at := FloorsLayout.world_point(b, FloorsLayout.PARCEL)
		_show("parcel", "fx", "parcel", at, at.y)
	_trays(heads)
	_batches(heads, s)
	_brewing(heads)
	_display(b, s)
	_cue()
	for key: String in _pool.keys():
		if not _used.has(key):
			_pool[key].queue_free()
			_pool.erase(key)


static func _seated(actor: FloorsScene.Actor) -> bool:
	return actor.pic.key == "%s-moves" % actor.art and actor.pic.frame is int and actor.pic.frame >= _SIT


## A seated guest's table: its number card while they wait, then what they ordered.
func _at_table(b: Dictionary, c: Dictionary, actor: FloorsScene.Actor, active: Array, steaming: bool) -> void:
	if c["seat"] < 0.0 or not c["phase"] in ["waiting", "sitting"]:
		return
	var p := actor.pic
	# Only once they have sat down: the scene has them on a seated frame.
	if not _seated(actor) or p.alpha < 0.6:
		return
	var seats := FloorsLayout.table_seats(floor(c["seat"] / 2.0), active)
	var seat: Dictionary = seats[int(c["seat"]) % 2]
	var centre: float = (seats[0]["x"] + seats[1]["x"]) / 2.0
	var side := -1.0 if seat["x"] < centre else 1.0
	var place := func(reach: float, lift: float = 0.0) -> Vector2:
		return Vector2(centre + side * reach, FloorsLayout.world_y(b, seat["floor"], seat["y"] + _TABLE["top"] + lift))
	var depth := p.depth + 0.5
	if c["phase"] == "waiting" or not c["hasCup"]:
		_show("tent:%d" % int(c["id"]), "fx", "tent", place.call(_TABLE["single"]), depth).flip = side > 0.0
		p.set_cell(_SIT)
		return
	var items := [c["order"], c["extra"]] if c["extra"] is String else [c["order"]]
	var drink := ""
	var food := ""
	for id: String in items:
		if FloorsArt.is_drink_item(id):
			drink = id if drink.is_empty() else drink
		else:
			food = id if food.is_empty() else food
	# With a drink they pick it up to sip; with only a pastry their hands stay in their lap.
	var phase := fmod(actor.clock + c["id"] * 1.3, _CYCLE)
	var on_table := drink.is_empty() or phase < _ON_TABLE
	p.set_cell(_SIT if on_table else (_HOLD if phase < _HOLDING else (_SIP if phase < _SIPPING else _LAUGH)))
	if not food.is_empty():
		_item("food:%d" % int(c["id"]), food, place.call(_TABLE["far"], 8.0) if not drink.is_empty() else place.call(_TABLE["single"]), depth + 0.01, _TABLE["size"])
	if not drink.is_empty() and on_table:
		var at: Vector2 = place.call(_TABLE["near"], -2.0) if not food.is_empty() else place.call(_TABLE["single"])
		var cup := _item("drink:%d" % int(c["id"]), drink, at, depth, _TABLE["size"])
		if steaming and FloorsArt.is_hot_drink(drink) and _rng.randf() < 0.45:
			_puff(at - Vector2(0.0, cup.shown_size().y - 6.0), depth + 0.02)


## Over a guest's head: a crown for a VIP, then what they ask for, miss, or wait for.
func _over_head(c: Dictionary, actor: FloorsScene.Actor) -> void:
	var head := _scene.head(actor.pic)
	var id := int(c["id"])
	var top := head.y
	# The moment's cue has the space over its guest.
	var moment: Variant = _scene.feed.moment
	if moment != null and moment.get("customerId") is float and moment["customerId"] == c["id"] and c["phase"] != "ordering":
		return
	if _scene.thoughts.speaking.has("customer:%d" % id):
		return
	var order := [_picture(c["order"])]
	if c["extra"] is String:
		order.append(_picture(c["extra"]))
	var urgent: bool = (c["phase"] == "queue" and c["patience"] < 12.0) or (c["phase"] == "waiting" and c["timer"] < 15.0)
	if c["phase"] == "ordering":
		_bubble("say:%d" % id, head, "bubble-wide" if order.size() > 1 else "bubble", order, 0.92 if order.size() > 1 else 1.0)
		top -= 150.0
	elif c.get("soldOut", false) and c["moodTimer"] > 0.0:
		# "Sorry, we're out": the order, crossed out.
		_bubble("say:%d" % id, head, "bubble", [order[0] + [0.45]], 1.0)
		var cross := _show("out:%d" % id, "fx", "cross", head - Vector2(0.0, 156.0 * _INSIDE["bubble"]), FloorsDepth.BUBBLE + 0.2)
		cross.origin = Vector2(0.5, 0.5)
		cross.stretch = Vector2.ONE * 84.0 / cross.size.x
		top -= 150.0
	elif c["mood"] is String and c["mood"] == "sad":
		_show("drop:%d" % id, "fx", "drop", head + Vector2(-46.0 if actor.pic.flip else 46.0, 74.0), actor.pic.depth + 0.2).stretch = Vector2(0.8, 0.8)
	elif urgent:
		# Running out of patience: the hourglass blinks.
		if int(_scene.now * 1000.0 / 520.0) % 2 == 0:
			_bubble("think:%d" % id, head, "thought", [["fx", "hourglass"]], 0.78)
		top -= 110.0
	elif c["phase"] == "waiting" and _seated(actor) and actor.pic.frame == _SIT:
		# At a table, thinking of what is on its way.
		_bubble("think:%d" % id, head, "thought", order.slice(0, 1), 0.74)
		top -= 106.0
	elif c["phase"] == "queue":
		# In line, a few at a time think of what they came for, so neighbours' bubbles never collide.
		var at := maxi(0, _scene.sim().queue.find(c["id"]))
		if int(_clock / 2.6) % 3 == at % 3:
			_bubble("think:%d" % id, head, "thought", order.slice(0, 1), 0.74)
			top -= 106.0
	if JsUtil.truthy(c.get("vip")):
		_show("vip:%d" % id, "fx", "crown", Vector2(head.x, top + 16.0), FloorsDepth.BUBBLE - 1.0).stretch = Vector2(0.9, 0.9)


## Mina's table, kept for her until she has sat there.
func _reserved(b: Dictionary, s: Dictionary, active: Array) -> void:
	var table: Variant = CoreRegularWishes.mina_reserved_table(s)
	if table == null or not active.has(table):
		return
	var seats := FloorsLayout.table_seats(table, active)
	var left: Dictionary = seats[0]
	_show("reserved", "fx", "reserved", Vector2((left["x"] + seats[1]["x"]) / 2.0 + 48.0, FloorsLayout.world_y(b, left["floor"], left["y"] + _TABLE["top"] + 12.0)),
		FloorsLayout.world_point(b, left).y + 0.6)


## On the counter: the tip jar, the bell, a catering order waiting to go, each barista's order as it is finished, and
## plates waiting on the pass; on its front, Mina's map once she has brought it.
func _on_counter(b: Dictionary, s: Dictionary, steaming: bool) -> void:
	var depth := FloorsLayout.world_point(b, FloorsLayout.COUNTER_FRONT).y + 0.5
	var y := _ground(b, 0.0, _COUNTER["top"]).y
	var clock := CoreClock.now()
	_show("jar", "fx", "jar-%d" % int(FloorsArt.till_jar_level(s, clock)), Vector2(_COUNTER["jar"], y), depth)
	if s["orders"]["active"] != null and CoreOrders.order_ready(s, clock):
		_show("order", "fx", "order-%s" % s["orders"]["active"]["kind"], Vector2(_COUNTER["order"], y), depth)
	var map: Variant = CoreRegularWishes.mina_map_choice(s)
	if map is String:
		_show("map", "fx", "map-%s" % map, FloorsLayout.world_point(b, _COUNTER["map"]), depth)
	var rung := _scene.now - _bell_rang
	var bell := _show("bell", "fx", "bell", Vector2(_COUNTER["bell"], y), depth)
	bell.stretch = Vector2(0.7, 0.7)
	bell.turn = deg_to_rad(14.0 * sin(rung * 42.0) * (1.0 - rung / 0.6)) if rung < 0.6 else 0.0
	var sim := _scene.sim()
	for i in sim.baristas.size():
		var barista: Dictionary = sim.baristas[i]
		# The order appears on the counter as it nears done, and waits there while the barista calls it.
		if barista["customerId"] == null or not ((barista["total"] > 0.0 and barista["remaining"] < barista["total"] * 0.4) or barista["calling"] > 0.0):
			continue
		for c: Dictionary in sim.customers:
			if c["id"] != barista["customerId"]:
				continue
			var spot: Dictionary = FloorsLayout.BARISTAS[i % FloorsLayout.BARISTAS.size()]
			var x: float = spot["x"] + floorf(i / float(FloorsLayout.BARISTAS.size())) * 60.0
			var items := [c["order"], c["extra"]] if c["extra"] is String else [c["order"]]
			for k in items.size():
				var at := Vector2(x + (k - (items.size() - 1) / 2.0) * 52.0, y)
				var made := _item("made:%d:%d" % [i, k], items[k], at, depth + 0.01 * k, _COUNTER["size"])
				if steaming and FloorsArt.is_hot_drink(items[k]):
					_puff(at - Vector2(0.0, made.shown_size().y - 6.0), depth + 0.1)
			break
	for k in mini(sim.pass_plates.size(), _COUNTER["pass"].size()):
		var items: Array = sim.pass_plates[k]["items"]
		if not items.is_empty():
			_item("pass:%d" % k, items[0], Vector2(_COUNTER["pass"][k], y - 2.0), depth + 0.2, _COUNTER["size"])


## A server on the way to a table carries a tray with the dishes on it; one who heard the bell says so.
func _trays(heads: bool) -> void:
	var sim := _scene.sim()
	for i in mini(sim.servers.size(), _scene.servers.size()):
		var server: Dictionary = sim.servers[i]
		var actor := _scene.servers[i]
		# The tray takes the place of the scene's cup.
		if actor.cup != null:
			actor.cup.visible = false
		var p := actor.pic
		if not p.visible or p.alpha < 0.05 or actor.sunk > 0.0:
			continue
		if not server["plates"].is_empty() and not server["phase"] in ["toPass", "idle"]:
			var at := p.place + Vector2(-44.0 if p.flip else 44.0, -84.0)
			var tray := _show("tray:%d" % i, "fx", "tray", at, p.depth + 0.02)
			tray.stretch = Vector2(0.8, 0.8)
			tray.alpha = p.alpha
			var dishes: Array = server["plates"].slice(0, 3)
			for k in dishes.size():
				if dishes[k]["items"].is_empty():
					continue
				var x := at.x + (k - (dishes.size() - 1) / 2.0) * 30.0
				_item("dish:%d:%d" % [i, k], dishes[k]["items"][0], Vector2(x, at.y - tray.shown_size().y * 0.42 + (k % 2) * 5.0), p.depth + 0.03 + k * 0.002, 44.0).alpha = p.alpha
		if heads and server["ack"] > 0.0 and p.alpha > 0.6:
			var head := _scene.head(p)
			_show("ack:%d" % i, "fx", "bang", head - Vector2(0.0, 6.0 * absf(sin(_scene.now * 1000.0 / 120.0))), FloorsDepth.BUBBLE).stretch = Vector2(0.62, 0.62)


## A bar filled as far as the work is, standing on a point.
func _bar(key: String, at: Vector2, done: float, depth: float = FloorsDepth.BUBBLE - 2.0) -> void:
	var bar := FloorsTextures.BAR
	_show(key, bar["key"], 0, at, depth).crop = Rect2()
	var inside: float = bar["width"] - 2.0 * bar["edge"]
	_show("%s:fill" % key, bar["fill"], 0, at, depth + 0.01).crop = Rect2(0.0, 0.0, bar["edge"] + inside * maxf(0.06, done), bar["height"])


## How much of each barista's order is made: on the bubble their guest orders in, or over their head.
func _brewing(heads: bool) -> void:
	if not heads:
		return
	var list: Array = _scene.sim().baristas
	for i in mini(list.size(), _scene.baristas.size()):
		var done: Variant = FloorsArt.brew_share(list[i])
		if done == null or not _scene.baristas[i].visible:
			continue
		var key := "say:%d" % int(list[i]["customerId"])
		if _used.has(key):
			var said: FloorsPic = _pool[key]
			_bar("brew:%d" % i, said.place + Vector2(0.0, FloorsTextures.BAR["height"] / 2.0 - said.shown_size().y * _FOOT), done, FloorsDepth.BUBBLE + 0.3)
		elif not _scene.thoughts.speaking.has("barista:%d" % i):
			_bar("brew:%d" % i, _scene.head(_scene.baristas[i]), done)


## A cook with a batch on thinks of what it is; at work on it, a bar shows how long they have left there.
func _batches(heads: bool, s: Dictionary) -> void:
	if not heads:
		return
	var list: Array = _scene.sim().cooks
	for i in mini(list.size(), _scene.cooks.size()):
		var actor := _scene.cooks[i]
		if list[i]["batch"] == null or not actor.pic.visible or actor.pic.alpha < 0.6 or _scene.thoughts.speaking.has("cook:%d" % i):
			continue
		var head := _scene.head(actor.pic)
		var done: Variant = null if not actor.steps.is_empty() else FloorsArt.bake_share(_scene.sim(), s, i)
		if done != null:
			_bar("bake:%d" % i, head, done)
		# Cooks work side by side: every other thought floats higher, clear of its neighbour.
		var lift := maxf(0.0 if done == null else FloorsTextures.BAR["height"], (i % 2) * 64.0)
		_bubble("batch:%d" % i, head - Vector2(0.0, lift), "thought", [_picture(list[i]["batch"]["item"])], 0.7)


## The cake display holds what is baked: today's plan while preparing, the shelf's stock once open.
func _display(b: Dictionary, s: Dictionary) -> void:
	if _case.is_empty():
		return
	var depth := FloorsLayout.world_point(b, FloorsLayout.COUNTER_FRONT).y + 0.3
	var case := _show("case", _case, 0, _ground(b, _CASE["x"], _CASE["y"]), depth)
	case.origin = Vector2.ZERO
	var stock: Dictionary = s["bakePlan"] if s["phase"] == "prep" else s["shelf"]
	var k := 0
	for m: Dictionary in CoreEconomy.menu_items(s):
		if FloorsArt.is_drink_item(m["id"]) or stock.get(m["id"], 0.0) <= 0.0:
			continue
		var columns: Array = _CASE["columns"]
		if k >= columns.size() * _CASE["shelves"].size():
			break
		_item("case:%d" % k, m["id"], _ground(b, columns[k % columns.size()], _CASE["shelves"][k / columns.size()]), depth + 0.02, _CASE["size"])
		k += 1


## The moment's cue shows what kind of moment it is, and remembers where it was.
func _cue() -> void:
	var cue := _scene.cue
	var moment: Variant = _scene.feed.moment
	if cue == null or moment == null:
		return
	cue.show_frame("cue-%s" % moment["kind"])
	if not cue.visible:
		return
	_last_cue = {"at": cue.place - Vector2(0.0, cue.shown_size().y * 0.6), "when": _scene.now}
	_scene.feed.moment_shown = true


# ---------------------------------------------------------------- what the rules ask for

## A batch out of the oven rides up the food lift and turns up in the cake display.
func restocked(b: Dictionary, item: String) -> void:
	var of := _picture(item)
	if not b["offsets"].has("basement"):
		_arrived(b, of)
		return
	var hatch := FloorsLayout.world_point(b, FloorsLayout.LIFT_HATCH)
	var riding := _scene.pic(of[0], of[1], Vector2(0.5, 0.5), 2.0, hatch)
	_fit(riding, 84.0)
	var tween := _scene.create_tween().set_parallel()
	tween.tween_property(riding, "place:y", FloorsLayout.world_point(b, FloorsLayout.LIFT_TOP).y, 1.1).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.tween_property(riding, "alpha", 0.0, 1.1).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(func() -> void:
		riding.queue_free()
		_arrived(b, of))


func _arrived(b: Dictionary, of: Array) -> void:
	var box := FloorsLayout.DISPLAY
	var top := _ground(b, 0.0, box["top"]).y
	var bottom := _ground(b, 0.0, box["bottom"]).y
	var at := Vector2((box["left"] + box["right"]) / 2.0, top - 8.0)
	var back := _scene.pic("fx", "bubble", Vector2(0.5, 1.0), FloorsDepth.BUBBLE, at)
	var inside := _scene.pic(of[0], of[1], Vector2(0.5, 0.5), FloorsDepth.BUBBLE + 0.1, at - Vector2(0.0, back.size.y * _INSIDE["bubble"]))
	_fit(inside, back.size.x * 0.62)
	for part: FloorsPic in [back, inside]:
		part.alpha = 0.0
		var tween := _scene.create_tween()
		tween.tween_property(part, "alpha", 1.0, 0.18)
		tween.tween_interval(1.42)
		tween.tween_property(part, "alpha", 0.0, 0.22)
		tween.tween_callback(part.queue_free)
	for k in 7:
		_pop("sparkle", Vector2(_rng.randf_range(box["left"], box["right"]), _rng.randf_range(top + 30.0, bottom)), 64.0, 20.0, 0.5, k * 0.13)


## Shows what the rules queued: sale coins over the paying guest, a moment's tip, the bell, help given to a barista or a
## guest, and celebrations. Nothing is drawn while the building is covered (`b` empty).
func drain(b: Dictionary) -> void:
	var feed := _scene.feed
	var effects := feed.effects.duplicate()
	var labels := feed.labels.duplicate()
	var sales := feed.sales.duplicate()
	var tips := feed.tips.duplicate()
	feed.effects.clear()
	feed.labels.clear()
	feed.sales.clear()
	feed.tips.clear()
	if b.is_empty():
		return
	if effects.has("bell"):
		_bell_rang = _scene.now
		_pop("sparkle", _ground(b, _COUNTER["bell"] + 26.0, _COUNTER["top"] - 64.0), 40.0, 26.0, 0.25)
	# Help: the words rise from whoever was helped, with sparkles and a heart (a guest) or steam (a brew).
	var for_guest := effects.has("heart")
	for i in labels.size():
		_helped(labels[i], i, for_guest)
	for sale: Dictionary in sales:
		_sale(b, sale)
	var cue: Variant = _last_cue["at"] if not _last_cue.is_empty() and _scene.now - _last_cue["when"] < 1.5 else null
	var view := _scene.view()
	for tip: Dictionary in tips:
		if tip.has("at"):
			_scene.cats.coins(tip["at"], tip["amount"])
			continue
		var at: Vector2 = cue if cue != null else view.get_center() - Vector2(0.0, view.size.y * 0.1)
		_pop("tip", at - Vector2(70.0, 0.0), 84.0, 70.0, 0.9)
		_label("+%s" % CoreFormat.format_money(tip["amount"]), at + Vector2(40.0, 26.0), 68.0, _MONEY)
	# Sparkles scattered over the room: a camera flash at the moment just answered, or a celebration over the middle.
	var sparkles := effects.count("sparkle") - labels.size() * 3
	if sparkles < 5:
		return
	for k in mini(14, sparkles):
		var at := view.get_center() + Vector2(_rng.randf_range(-view.size.x, view.size.x) * 0.4, _rng.randf_range(-view.size.y * 0.28, view.size.y * 0.12))
		if cue != null:
			at = cue + Vector2(_rng.randf_range(-110.0, 110.0), _rng.randf_range(-60.0, 150.0))
		_pop("sparkle", at, _rng.randf_range(50.0, 84.0), 30.0, 0.38, k * 0.055)


func _helped(label: Dictionary, i: int, for_guest: bool) -> void:
	var sim := _scene.sim()
	var p: FloorsPic = null
	if for_guest:
		var nearest := INF
		for c: Dictionary in sim.customers:
			var away := Vector2(c["x"] - label["x"], c["y"] - 38.0 - label["y"]).length()
			if away < nearest and _scene.customers.has(c["id"]):
				nearest = away
				p = _scene.customers[c["id"]].pic
	if p == null and not _scene.baristas.is_empty():
		var busy := _scene.baristas.filter(func(x: FloorsPic) -> bool: return sim.is_brewing(float(_scene.baristas.find(x))))
		p = busy[i] if i < busy.size() else _scene.baristas[0]
	if p == null:
		return
	var head := _scene.head(p)
	_label(label["text"], head - Vector2(0.0, 130.0), 58.0, _INK, 80.0)
	for dx: float in [-46.0, 0.0, 46.0]:
		_pop("sparkle", head + Vector2(dx, -20.0 - absf(dx) * 0.5), 46.0, 40.0, 0.4, absf(dx) * 0.003)
	_pop("heart" if for_guest else "puff", head - Vector2(0.0, 60.0), 60.0, 70.0, 0.6)


func _sale(b: Dictionary, sale: Dictionary) -> void:
	var actor: FloorsScene.Actor = _scene.customers.get(sale["customerId"]) if sale.get("customerId") is float else null
	var at := _scene.head(actor.pic) if actor != null else _ground(b, FloorsLayout.SERVICE[0]["x"], 330.0)
	if actor != null:
		_pop("heart", at - Vector2(0.0, 6.0), 56.0, 46.0, 0.65)
	var vip := JsUtil.truthy(sale.get("vip"))
	var text := _label("+%s" % CoreFormat.format_money(sale["amount"]), at + Vector2(30.0, -96.0), 80.0 if vip else 68.0, Color8(0xb7, 0x79, 0x1f) if vip else _MONEY)
	# The coin rides up beside the amount.
	var coin := _scene.pic("fx", "coin", Vector2(0.5, 0.5), FloorsDepth.BUBBLE + 2.0, text.place - Vector2(text.extent().x / 2.0 + 36.0, text.extent().y / 2.0))
	coin.stretch = Vector2.ONE * (66.0 if vip else 56.0) / coin.size.x
	_float_away(coin, 70.0)
	if vip:
		for k in 6:
			_pop("sparkle", at + Vector2(_rng.randf_range(-90.0, 90.0), -_rng.randf_range(0.0, 150.0)), 50.0, 30.0, 0.35, k * 0.07)
