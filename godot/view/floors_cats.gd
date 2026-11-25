class_name FloorsCats
extends RefCounted

## The café's cats in the building: every adopted cat walks its floor, takes the stairs, sits, washes and naps at the
## places of FloorsCatPlaces that suit it, and can be petted; the gifts cats leave wait on the window seat and the terrace
## wall. With no cat adopted the visiting cat sits on the terrace wall. Port of floors-cats.ts. Nothing here changes the
## game: care, petting, gifts and the cat moment stay with the rules.

const _WALK: Array = [0, 1, 2, 3]
const _SIT := 4
const _HAPPY := 5
const _SLEEP := 6
const _GROOM := 7
## The cat that visits a café without cats.
const _VISITOR := "ginger"
## Plate pixels a second: a playful cat trots, a quiet one ambles.
const _SPEED := {"playful": 190.0, "quiet": 120.0, "affectionate": 150.0}
## How far before its paws the cup a cat knocked over lies; how wide a waiting gift is drawn.
const _SPILL_REACH := 62.0
const _GIFT_SIZE := 72.0
## Just over the terrace's plate, under everything that stands on it.
const _PATCH_DEPTH := -1.95
const _INK := Color8(0x4f, 0x3b, 0x2f)
const _PAPER := Color8(0xff, 0xfa, 0xf0)


class Cat extends RefCounted:
	## The resident's id; "" for the visiting cat.
	var id: String
	var breed: String
	var pic: FloorsPic = null
	var at: Dictionary
	## The path node it left the paths at, or last passed.
	var node: String
	## Where it is, or is going.
	var place: Dictionary
	var steps: Array = []
	## {"from", "to", "t", "seconds"} in mid-jump.
	var hop: Variant = null
	var plan: String
	## Seconds until it chooses what to do next.
	var timer := 2.0
	var clock := 0.0
	## The rules' affection for it last frame: a rise is a petting.
	var affection := 0.0
	var happy := false
	var alpha := 1.0
	var facing_left := false
	var snooze := 0.0

	func moving() -> bool:
		return not steps.is_empty() or hop != null


## The cat the building is following for "find cat", or "".
var following := ""
var _scene: FloorsScene
var _cats: Dictionary = {}
var _visitor: Cat = null
## {"pic", "at", "twinkle"} by id.
var _gifts: Dictionary = {}
## The cup the cat of the moment knocked over: {"moment", "at", "over", "pic"}.
var _spill: Dictionary = {}
var _patches: Array[FloorsPic] = []
var _places: Array = []
var _places_key := ""
var _tag: FloorsText = null
var _tag_text := ""
var _happy_visitor := 0.0
var _rng := RandomNumberGenerator.new()


func _init(scene: FloorsScene) -> void:
	_scene = scene
	scene.library.add("cat-heart", _heart())


static func _heart() -> ImageTexture:
	var image := Image.create(44, 44, false, Image.FORMAT_RGBA8)
	var curve := Curve2D.new()
	curve.add_point(Vector2(22, 39), Vector2.ZERO, Vector2(-28, -19))
	curve.add_point(Vector2(22, 13), Vector2(-16, -15), Vector2(16, -15))
	curve.add_point(Vector2(22, 39), Vector2(28, -19))
	var outline := curve.tessellate()
	for y in 44:
		for x in 44:
			var p := Vector2(x + 0.5, y + 0.5)
			var inside := Geometry2D.is_point_in_polygon(p, outline)
			var edge := INF
			for i in outline.size() - 1:
				edge = minf(edge, p.distance_to(Geometry2D.get_closest_point_to_segment(p, outline[i], outline[i + 1])))
			var colour := Color8(0xee, 0x9a, 0xa6) if inside else Color8(0x7a, 0x5a, 0x44)
			colour = Color8(0x7a, 0x5a, 0x44).lerp(colour, clampf(edge - 1.0, 0.0, 1.0)) if inside else colour
			colour.a = 1.0 if inside else clampf(2.0 - edge, 0.0, 1.0)
			image.set_pixel(x, y, colour)
	return ImageTexture.create_from_image(image)


## Whether a breed's strip is here; starts loading it otherwise.
func _ready(breed: String) -> bool:
	if not _scene.library.cats["cats"].has(breed):
		return false
	_scene.library.sheets["cats/%s" % breed] = _scene.library.cats["cats"][breed]
	return _scene.library.ready("cats/%s" % breed)


# ---------------------------------------------------------------- each frame

## `dt` is the café's time (0 while paused).
func update(b: Dictionary, dt: float, s: Dictionary) -> void:
	_lay_patches(b)
	_sync_places(b, s)
	_sync_residents(b, dt, s)
	_sync_visitor(b, dt, s)
	_sync_gifts(b)
	_sync_spill(b)
	_show_selection(b)


func _lay_patches(b: Dictionary) -> void:
	var roof: Array = _scene.library.cats.get("roof", [])
	if _patches.is_empty():
		for patch: Dictionary in roof:
			_patches.append(_scene.pic("cats/%s" % patch["file"], 0, Vector2.ZERO, _PATCH_DEPTH))
	for i in _patches.size():
		_patches[i].place = Vector2(roof[i]["x"], FloorsLayout.world_y(b, "roof", roof[i]["y"]))


## The places open to cats follow the building and the furniture the player has out.
func _sync_places(b: Dictionary, s: Dictionary) -> void:
	var pieces := {}
	for piece: Dictionary in s["decor"]["placed"]:
		if piece.has("spot"):
			var def: Variant = CoreFurniture.furniture_def(piece["id"])
			if def != null and def["surface"] == "floor":
				pieces[piece["spot"]] = piece["id"]
	var key := "%s|%s" % [b["floors"], pieces]
	if key == _places_key:
		return
	_places_key = key
	_places = FloorsCatPlaces.cat_places(b["floors"], pieces)
	# A cat whose place has gone thinks again.
	for cat: Cat in _cats.values():
		if not _has_place(cat.place):
			cat.timer = 0.0


func _has_place(place: Dictionary) -> bool:
	return _places.any(func(p: Dictionary) -> bool: return p["id"] == place["id"])


func _everyone() -> Array:
	return _cats.values() + ([_visitor] if _visitor != null else [])


func _free(me: Cat = null) -> Array:
	var taken := {}
	for cat: Cat in _everyone():
		if cat != me:
			taken[cat.place["id"]] = true
	return _places.filter(func(p: Dictionary) -> bool: return not taken.has(p["id"]))


func _make_cat(id: String, breed: String, place: Dictionary, plan: String) -> Cat:
	var cat := Cat.new()
	cat.id = id
	cat.breed = breed
	cat.at = {"floor": place["floor"], "x": place["x"], "y": place["y"]}
	cat.node = place["from"]
	cat.place = place
	cat.plan = plan
	cat.timer = 2.0 + _cats.size() * 2.0
	cat.clock = _scene.random.call() * 3.0
	cat.facing_left = _scene.random.call() < 0.5
	return cat


func _sync_residents(b: Dictionary, dt: float, s: Dictionary) -> void:
	for id: String in _cats.keys():
		if not s["pets"].any(func(p: Dictionary) -> bool: return p["id"] == id):
			if _cats[id].pic != null:
				_cats[id].pic.queue_free()
			_cats.erase(id)
	for pet: Dictionary in s["pets"]:
		var prefs := CorePets.pet_preferences(pet)
		var resting := not CorePets.pet_active(pet)
		if not _cats.has(pet["id"]):
			# A new resident starts at the free place that suits it best (a nap place when out of supplies).
			var home: Variant = null
			for place: Dictionary in _free():
				if (not resting or place.get("naps", false)) and (home == null or FloorsCatPlaces.place_rank(place, prefs, b["floors"]) > FloorsCatPlaces.place_rank(home, prefs, b["floors"])):
					home = place
			if home == null:
				continue
			_cats[pet["id"]] = _make_cat(pet["id"], pet["id"], home, "nap" if resting else "watch")
		var cat: Cat = _cats[pet["id"]]
		var logic: Variant = _scene.session.cats.actors.get(pet["id"])
		var affection: float = logic["affection"] if logic != null else 0.0
		if affection > cat.affection + 0.25:
			_petted(cat)
		cat.affection = affection
		cat.happy = affection > 0.0
		_live(b, cat, dt, prefs, resting)
		_draw(b, cat, dt, resting)


## Walks a cat on, or lets it choose what to do next once its time at a plan is up.
func _live(b: Dictionary, cat: Cat, dt: float, prefs: Dictionary, resting: bool) -> void:
	if dt <= 0.0:
		return
	cat.clock += dt
	# A petted cat stops to enjoy it, unless it is in mid-jump or on the stairs.
	if cat.moving() and not (cat.happy and cat.hop == null and cat.alpha >= 1.0):
		_walk(cat, dt, _SPEED[prefs["personality"]])
		return
	# It stays by the cup it knocked over; out of supplies it sleeps where it can, until it is cared for again.
	if cat.moving() or cat.happy or _culprit() == cat or (resting and cat.plan == "nap" and cat.place.get("naps", false)):
		return
	cat.timer -= dt
	if cat.timer > 0.0 and not (resting and cat.plan != "nap"):
		return
	cat.plan = "nap" if resting else FloorsCatPlaces.choose_plan(prefs["personality"], _scene.random.call())
	cat.timer = FloorsCatPlaces.plan_seconds(cat.plan, prefs["personality"], _scene.random.call())
	if cat.plan == "groom" or (cat.plan == "nap" and cat.place.get("naps", false) and _has_place(cat.place)):
		return
	var goal: Variant = FloorsCatPlaces.choose_place(cat.plan, prefs, _free(cat), b["floors"], cat.place["id"], _scene.random)
	if goal != null:
		_send(cat, goal, b)


## Plans the walk to a place: down from a raised place to the path first.
func _send(cat: Cat, goal: Dictionary, b: Dictionary) -> void:
	var node := FloorsCatPlaces.cat_node(cat.node)
	cat.steps = []
	if JsMath.js_hypot2(node["x"] - cat.at["x"], node["y"] - cat.at["y"]) >= 1.0:
		if cat.place.get("hop", false):
			node["hop"] = true
		cat.steps.append(node)
	cat.steps.append_array(FloorsCatPlaces.cat_route(cat.node, goal, b["floors"]))
	cat.place = goal
	cat.node = goal["from"]


static func _point(p: Dictionary) -> Dictionary:
	return {"floor": p["floor"], "x": p["x"], "y": p["y"]}


func _walk(cat: Cat, dt: float, speed: float) -> void:
	if cat.hop != null:
		var hop: Dictionary = cat.hop
		hop["t"] = minf(1.0, hop["t"] + dt / hop["seconds"])
		cat.at = {"floor": hop["to"]["floor"], "x": lerpf(hop["from"]["x"], hop["to"]["x"], hop["t"]), "y": lerpf(hop["from"]["y"], hop["to"]["y"], hop["t"])}
		if hop["t"] >= 1.0:
			cat.at = _point(hop["to"])
			cat.hop = null
		return
	var left := speed * dt
	while not cat.steps.is_empty():
		var next: Dictionary = cat.steps[0]
		if next.get("jump", false):
			cat.at = _point(next)
			cat.alpha = 0.0
			cat.steps.pop_front()
			continue
		var dx: float = next["x"] - cat.at["x"]
		var dy: float = next["y"] - cat.at["y"]
		var distance := sqrt(dx * dx + dy * dy)
		if absf(dx) > 0.5:
			cat.facing_left = dx < 0.0
		if next.get("hop", false):
			cat.hop = {"from": _point(cat.at), "to": _point(next), "t": 0.0, "seconds": clampf(distance / 420.0, 0.32, 0.7)}
			cat.steps.pop_front()
			break
		if left <= 0.0:
			break
		if distance <= left:
			cat.at = _point(next)
			cat.steps.pop_front()
			left -= distance
			continue
		cat.at = {"floor": cat.at["floor"], "x": cat.at["x"] + dx / distance * left, "y": cat.at["y"] + dy / distance * left}
		left = 0.0
	# Fade out climbing into the floor above (or going down to the one below); fade in on arrival.
	var alpha := cat.alpha + dt * 3.0
	if cat.steps.size() > 1 and cat.steps[1].get("jump", false):
		alpha = JsMath.js_hypot2(cat.steps[0]["x"] - cat.at["x"], cat.steps[0]["y"] - cat.at["y"]) / 140.0
	cat.alpha = clampf(alpha, 0.0, 1.0)


## Puts the cat's picture where it is, in the pose of what it is doing.
func _draw(b: Dictionary, cat: Cat, dt: float, resting: bool) -> void:
	if not _ready(cat.breed):
		return
	var key := "cats/%s" % cat.breed
	if cat.pic == null:
		cat.pic = _scene.pic(key, _SIT)
	var p := cat.pic
	var at := FloorsLayout.world_point(b, cat.at)
	# The jump's arc, and a little squash of breath in a sleeping cat.
	var lift := 0.0
	if cat.hop != null:
		lift = sin(PI * cat.hop["t"]) * (36.0 + JsMath.js_hypot2(cat.hop["to"]["x"] - cat.hop["from"]["x"], cat.hop["to"]["y"] - cat.hop["from"]["y"]) * 0.18)
	var guilty := _culprit() == cat
	var asleep := not cat.moving() and not cat.happy and not guilty and (resting or cat.plan == "nap")
	var breathe := 1.0
	p.flip = cat.facing_left
	if cat.hop != null:
		p.stop()
		p.set_cell(_WALK[0] if cat.hop["t"] < 0.5 else _WALK[2])
	elif cat.moving() and not cat.happy:
		p.play("%s-walk" % key, key, _WALK, 8.0)
		p.advance(dt)
	else:
		p.stop()
		var cell := _HAPPY if cat.happy else (_SLEEP if asleep else (_GROOM if cat.plan == "groom" and not guilty else _SIT))
		p.set_cell(cell)
		if asleep:
			breathe = 1.0 + 0.025 * sin(cat.clock * 2.2)
		elif cell == _GROOM:
			breathe = 1.0 + 0.02 * sin(cat.clock * 9.0)
		elif cat.happy:
			breathe = 1.0 + 0.03 * sin(cat.clock * 12.0)
	# On the steps in a stairwell: its front edge hides what is below it.
	var sunk := FloorsLayout.well_sink(cat.at)
	p.crop = Rect2(0.0, 0.0, p.size.x, maxf(0.0, p.size.y - sunk)) if sunk > 0.0 else Rect2()
	# On a bed a cat is drawn over the bed, which stands a little lower.
	p.depth = FloorsArt.IN_WELL_DEPTH if FloorsLayout.in_well(cat.at) else at.y + (24.0 if cat.place["kind"] == "bed" else 0.0) + 0.5
	p.place = at - Vector2(0.0, lift)
	p.stretch = Vector2(1.0, breathe)
	p.alpha = cat.alpha
	if asleep and dt > 0.0 and cat.alpha >= 1.0:
		cat.snooze -= dt
		if cat.snooze <= 0.0:
			cat.snooze = 1.9
			_float("z", at + Vector2(26.0, -p.shown_size().y * 0.8), 30.0, p.depth + 0.1)


# ---------------------------------------------------------------- the visiting cat

## Without residents the visiting cat sits on the terrace wall.
func _sync_visitor(b: Dictionary, dt: float, s: Dictionary) -> void:
	if not s["pets"].is_empty():
		if _visitor != null and _visitor.pic != null:
			_visitor.pic.queue_free()
		_visitor = null
		return
	if _visitor == null:
		for place: Dictionary in _places:
			if place["id"] == "roof/wall":
				_visitor = _make_cat("", _VISITOR, place, "watch")
	if _visitor == null:
		return
	var happy := _scene.feed.cat_happy
	if happy > _happy_visitor + 0.25:
		_petted(_visitor)
	_happy_visitor = happy
	_visitor.happy = happy > 0.0
	_visitor.facing_left = false
	_visitor.clock += dt
	# Now and then it washes a paw.
	_visitor.plan = "groom" if fmod(_visitor.clock, 16.0) > 12.0 else "watch"
	_draw(b, _visitor, dt, false)


# ---------------------------------------------------------------- petting, taps, the moment

func _head(cat: Cat) -> Variant:
	if cat == null or cat.pic == null or cat.pic.alpha <= 0.5:
		return null
	return _scene.head(cat.pic)


## Hearts over a cat that has just been petted.
func _petted(cat: Cat) -> void:
	var at: Variant = _head(cat)
	if at == null:
		return
	for i in 3:
		var heart := _scene.pic("cat-heart", 0, Vector2(0.5, 0.5), FloorsDepth.BUBBLE, at + Vector2(-30.0 + i * 30.0, 10.0))
		heart.stretch = Vector2.ZERO
		var rise := _scene.create_tween().set_parallel()
		rise.tween_property(heart, "place:y", at.y - 60.0 - (i % 2) * 26.0, 0.42).set_delay(i * 0.11).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		rise.tween_property(heart, "stretch", Vector2(1.25, 1.25), 0.42).set_delay(i * 0.11).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		var fade := _scene.create_tween()
		fade.tween_property(heart, "alpha", 0.0, 0.38).set_delay(0.7 + i * 0.11)
		fade.tween_callback(heart.queue_free)


func _float(text: String, at: Vector2, size: float, depth: float) -> void:
	var w := _scene.words(text, size, _INK, depth, at, 8.0, _PAPER)
	var tween := _scene.create_tween().set_parallel()
	tween.tween_property(w, "place", at + Vector2(22.0, -54.0), 1.7)
	tween.tween_property(w, "alpha", 0.0, 1.7)
	tween.tween_property(w, "stretch", 1.3, 1.7).from(0.8)
	tween.chain().tween_callback(w.queue_free)


## Coins a gift paid, over where it was.
func coins(at: Vector2, amount: float) -> void:
	var w := _scene.words("+%s" % CoreFormat.format_money(amount), 70.0, Color8(0x8a, 0x5a, 0x1c), FloorsDepth.BUBBLE + 1.0, at, 16.0, _PAPER)
	var tween := _scene.create_tween().set_parallel()
	tween.tween_property(w, "place:y", at.y - 80.0, 1.0).set_delay(0.5)
	tween.tween_property(w, "alpha", 0.0, 1.0).set_delay(0.5)
	tween.chain().tween_callback(w.queue_free)
	for i in 5:
		_twinkle(at + Vector2(_rng.randf_range(-60.0, 60.0), _rng.randf_range(-70.0, 10.0)), FloorsDepth.BUBBLE, 1.6, 0.7, i * 0.09)


func _twinkle(at: Vector2, depth: float, size: float, seconds: float, delay: float = 0.0, turn: float = 0.0) -> void:
	var star := _scene.pic("sparkle", 0, Vector2(0.5, 0.5), depth, at)
	star.stretch = Vector2.ZERO
	var tween := _scene.create_tween().set_parallel()
	tween.tween_property(star, "stretch", Vector2(size, size), seconds).set_delay(delay)
	tween.tween_property(star, "alpha", 0.0, seconds).set_delay(delay)
	tween.tween_property(star, "turn", turn, seconds).set_delay(delay)
	tween.chain().tween_callback(star.queue_free)


## What a tap lands on: a waiting gift, the name over a marked cat, or a cat (the nearest, each at least `reach` around).
## A cat without an id is the visiting one.
func tap(at: Vector2, reach: float) -> Variant:
	following = ""
	for id: float in _gifts:
		if at.distance_to(_gifts[id]["at"] - Vector2(0.0, _GIFT_SIZE / 2.0)) <= reach + _GIFT_SIZE / 2.0:
			return {"kind": "gift", "id": id}
	# The name floating over a marked cat opens its card.
	var selected: Variant = _scene.feed.selected_cat
	if _tag != null and _tag.visible and selected != null:
		var size := _tag.extent()
		if Rect2(_tag.place - Vector2(size.x / 2.0, size.y), size).has_point(at):
			return {"kind": "cat", "id": selected, "card": true}
	var best: Cat = null
	var nearest := INF
	for cat: Cat in _everyone():
		if cat.pic == null or cat.pic.alpha <= 0.5:
			continue
		var size := cat.pic.shown_size()
		var centre := cat.pic.place - Vector2(0.0, size.y * 0.45)
		if absf(at.x - centre.x) <= maxf(reach, size.x * 0.4) and absf(at.y - centre.y) <= maxf(reach, size.y * 0.55) and at.distance_to(centre) < nearest:
			nearest = at.distance_to(centre)
			best = cat
	if best == null:
		return null
	return {"kind": "cat", "id": best.id} if not best.id.is_empty() else {"kind": "cat"}


## The cat that made the mess, or the visiting cat.
func _culprit() -> Cat:
	var moment: Variant = _scene.feed.moment
	if moment == null or moment["kind"] != "cat":
		return null
	var id: Variant = moment["spot"].get("catId") if moment.get("spot") is Dictionary else null
	if _cats.has(id):
		return _cats[id]
	return _visitor if _visitor != null else (_cats.values()[0] if not _cats.is_empty() else null)


## Where the cat moment's cue floats: over that cat; null without one.
func moment_point() -> Variant:
	return _head(_culprit())


## The cup it knocked over lies before its paws until it is tidied up (or the moment passes).
func _sync_spill(b: Dictionary) -> void:
	var cat := _culprit()
	if not _spill.is_empty() and (cat == null or not is_same(_spill["moment"], _scene.feed.moment)):
		var gone: FloorsPic = _spill["pic"]
		var tween := _scene.create_tween()
		tween.tween_property(gone, "alpha", 0.0, 0.26)
		tween.tween_callback(gone.queue_free)
		_spill = {}
	if cat == null or cat.pic == null:
		return
	if _spill.is_empty() and cat.hop == null and cat.pic.alpha > 0.5:
		var at := _point(cat.at)
		at["x"] += -_SPILL_REACH if cat.facing_left else _SPILL_REACH
		at["y"] += 4.0
		_spill = {"moment": _scene.feed.moment, "at": at, "over": cat.pic.depth - FloorsLayout.world_point(b, cat.at).y, "pic": _scene.pic("fx", "spill")}
		_spill["pic"].flip = cat.facing_left
	if _spill.is_empty() or not b["offsets"].has(_spill["at"]["floor"]):
		return
	var p := FloorsLayout.world_point(b, _spill["at"])
	_spill["pic"].depth = p.y + _spill["over"] + 0.3
	_spill["pic"].place = p


# ---------------------------------------------------------------- the pet panel

## What the pet panel says of a cat: {"area", "behavior", "affection", "targetKind"}; null when it is not in.
func view_of(id: String) -> Variant:
	if not _cats.has(id):
		return null
	var cat: Cat = _cats[id]
	return {
		"area": FloorsCatPlaces.floor_area(cat.at["floor"]),
		"behavior": "patrol" if cat.moving() else ("sleep" if cat.plan == "nap" else ("groom" if cat.plan == "groom" else "watch")),
		"affection": cat.affection,
		"targetKind": cat.place["kind"],
	}


## "Find cat": the building scrolls to the cat and stays with it while it is marked.
func locate(id: String) -> bool:
	if not _cats.has(id):
		return false
	following = id
	return true


## The selected cat's name floats over it; a cat being found also keeps the building on it.
func _show_selection(b: Dictionary) -> void:
	var id: Variant = _scene.feed.selected_cat
	var cat: Cat = _cats.get(id) if id != null and _scene.feed.cat_selection_seconds > 0.0 else null
	if cat == null:
		following = ""
	var at: Variant = _head(cat)
	if at == null:
		if _tag != null:
			_tag.visible = false
		return
	# The chevron says the name can be tapped, for the cat's card.
	var name := "%s ›" % String(_scene.session.translate.call("pet.%s.name" % cat.breed, {})).get_slice(" · ", 0)
	if _tag == null or name != _tag_text:
		if _tag != null:
			_tag.queue_free()
		_tag_text = name
		_tag = _scene.words(name, 54.0, _INK, FloorsDepth.BUBBLE + 1.0, at, 14.0, _PAPER)
	_tag.visible = true
	_tag.place = at - Vector2(0.0, 6.0 + 6.0 * absf(sin(_scene.now * 1000.0 / 300.0)))
	if following == cat.id:
		_scene.focus_on(FloorsLayout.world_point(b, cat.at).y - 120.0, _scene.get_process_delta_time())


# ---------------------------------------------------------------- gifts

## Shows the gifts waiting at their places.
func _sync_gifts(b: Dictionary) -> void:
	var feed := _scene.feed
	for id: float in _gifts.keys():
		if feed.gifts.any(func(g: Dictionary) -> bool: return g["id"] == id):
			continue
		var gone: FloorsPic = _gifts[id]["pic"]
		var tween := _scene.create_tween().set_parallel()
		tween.tween_property(gone, "stretch", gone.stretch * 1.5, 0.22)
		tween.tween_property(gone, "alpha", 0.0, 0.22)
		tween.chain().tween_callback(gone.queue_free)
		_gifts.erase(id)
	feed.gift_shown.clear()
	for g: Dictionary in feed.gifts:
		var place: Dictionary = FloorsCatPlaces.GIFT_PLACES[int(g["spot"]) % FloorsCatPlaces.GIFT_PLACES.size()]
		if not _gifts.has(g["id"]):
			var key := "cats/gift-%s" % g["kind"]
			if not _scene.library.ready(key):
				continue
			var made := _scene.pic(key)
			made.stretch = Vector2.ONE * _GIFT_SIZE / made.size.x
			_gifts[g["id"]] = {"pic": made, "at": Vector2.ZERO, "twinkle": _scene.now + _rng.randf() * 2.0}
		var gift: Dictionary = _gifts[g["id"]]
		var at := FloorsLayout.world_point(b, place)
		gift["at"] = at
		gift["pic"].depth = at.y + 0.4
		gift["pic"].place = at - Vector2(0.0, 5.0 * absf(sin(_scene.now * 2.4 + g["id"])))
		feed.gift_shown[g["id"]] = at - Vector2(0.0, _GIFT_SIZE + 10.0)
		# A twinkle now and then, so a gift is noticed.
		if _scene.now > gift["twinkle"]:
			gift["twinkle"] = _scene.now + 1.8 + _rng.randf()
			_twinkle(at + Vector2(_rng.randf_range(-24.0, 24.0), -_GIFT_SIZE + _rng.randf_range(-6.0, 22.0)), at.y + 0.6, 1.1, 0.8, 0.0, deg_to_rad(45.0))
