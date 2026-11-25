class_name FloorsFeed
extends RefCounted

## What the rules tell the building to show, and what the player is looking at: the part of src/render/cafe-view.ts the
## floors view uses. The scene empties the lists as it shows them.

var paused := true
## The street or another full screen covers the building.
var suspended := false
var moment: Variant = null
var moment_reaction: Variant = null
## Kinds of small effects: "bell", "sparkle", "heart", "steam".
var effects: Array[String] = []
var sales: Array = []
## Coins a moment or a cat's gift paid: {"amount", "at"? where the gift was}.
var tips: Array = []
## Words rising from whoever was helped: {"text", "x", "y"}.
var labels: Array = []
var gifts: Array = []
## Where the last moment's cue was shown, for the tip its answer brings.
var moment_shown := false
## Where the gifts on show are, by id.
var gift_shown: Dictionary = {}
var selected_cat: Variant = null
var cat_selection_seconds := 0.0
## Seconds the visiting cat stays pleased.
var cat_happy := 0.0
## The piece being placed: {"id", "skip", "spot"?}, or null.
var ghost: Variant = null
## {"mode": "browse" or "place", "id"?, "moving"?}, or null.
var arrange: Variant = null
var table_preview := false
var outer_wall := false


## Listens to a running café.
func follow(session: CoreGameSession) -> void:
	session.ui.connect(_told.bind(session))


func _told(what: String, args: Array, session: CoreGameSession) -> void:
	match what:
		"events":
			for e: Dictionary in args[0]:
				match e["type"]:
					"sale": sales.append(e)
					"bell": effects.append("bell")
					"restock": effects.append_array(["sparkle", "sparkle", "sparkle", "sparkle"])
		"sparkles":
			for _i in int(args[0]):
				effects.append("sparkle")
		"assist":
			_assist(args[0], args[1], session)
		"petCat":
			if args[0] == null:
				cat_happy = 2.0
			else:
				selected_cat = args[0]
				cat_selection_seconds = 6.0
		"tipAtMoment":
			if moment_shown and args[0] > 0.0:
				tips.append({"amount": args[0]})
		"tipAtGift":
			if gift_shown.has(args[0]) and args[1] > 0.0:
				tips.append({"amount": args[1], "at": gift_shown[args[0]]})
		"flashAtMoment":
			if moment_shown:
				effects.append_array(["sparkle", "sparkle", "sparkle", "sparkle", "sparkle"])


## Help given to a guest (by id) or to a brew (the barista's pose).
func _assist(text: String, who: Variant, session: CoreGameSession) -> void:
	var at := Vector2.ZERO
	var guest := not who is Dictionary
	if guest:
		for c: Dictionary in session.sim.customers:
			if c["id"] == who:
				at = Vector2(c["x"], c["y"])
	else:
		at = Vector2(who["x"], who["y"])
	labels.append({"text": text, "x": at.x, "y": at.y - 38.0})
	effects.append_array(["sparkle", "sparkle", "sparkle"])
	effects.append("heart" if guest else "steam")


## Once a frame, after the rules.
func update(dt: float, session: CoreGameSession) -> void:
	paused = session.scene_paused
	suspended = session.street_open
	moment = session.moments.active
	moment_reaction = session.moments.reaction
	gifts = session.state["catGifts"]["waiting"]
	if moment == null:
		moment_shown = false
	if not paused:
		cat_selection_seconds = maxf(0.0, cat_selection_seconds - dt)
		cat_happy = maxf(0.0, cat_happy - dt)
