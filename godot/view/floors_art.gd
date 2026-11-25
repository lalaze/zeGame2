class_name FloorsArt
extends RefCounted

## What the building's pictures are and how they stack: the pure parts of src/render/floors/floors-decor-layers.ts,
## floors-places.ts, floors-fx.ts, floors-upgrades.ts, floors-looks.ts, floors-work.ts and floors-front.ts.

# ---------------------------------------------------------------- decor layers

## Back to front: the room, then its surfaces, then what stands in it, then what hangs over it.
const BACK_LAYERS: Array[String] = ["shell", "wallpaper", "floor", "rug", "shadow", "fixtures", "tablecloth", "centerpiece", "neon", "sill", "curtain", "ceiling"]
const FRONT_LAYERS: Array[String] = ["counter", "fixtures-front"]
## Back layers stack from this depth up, a step apart.
const LAYER_DEPTH := -2.0
const LAYER_STEP := 0.05
## In front of every back layer: a seating floor's stairs, then who is on the steps in their well.
const HALL_DEPTH := -1.3
const IN_WELL_DEPTH := -1.2

# ---------------------------------------------------------------- where a branch stands

## The glass of the rooms' windows on their layers; the ground floor's layer is the side window.
const PLACE_WINDOWS := {"2f": Rect2(133, 107, 112, 387), "1f": Rect2(140, 94, 127, 320)}
const FLOOR_WINDOWS := {"floor-3": "2f", "floor-2": "2f", "ground": "1f"}
## Where the moon and the sun hang over a place: clear of the landmark at its left edge and of the roof.
const PLACE_DISC := {"x": 336.0, "row": 212.0}


## "" in the old town, which is the building's own sky.
static func painted_place(location: String) -> String:
	return "" if location == "town" else location


static func place_sky(place: String, light: String) -> String:
	return "places/%s/%s" % [place, light]


static func place_glass(place: String, window: String) -> String:
	return "places/%s/glass-%s" % [place, window]


# ---------------------------------------------------------------- menu pictures

## Drinks served cold: no steam rises from them.
const _COLD: Array[String] = ["coldbrew", "dirty", "frappe", "smoothie", "lemontea", "affogato", "matchafloat"]
static var _drinks: Dictionary = {}


## The frame of fx/items.json that pictures a menu item. A signature drink is pictured by its base.
static func item_frame(id: String) -> String:
	if not id.begins_with("sig:"):
		return "item-%s" % id
	var definition: Variant = CoreSignatureDrinks.signature_definition(id)
	if definition != null:
		return "sig-%s" % definition["base"]
	var parts := id.split(":")
	return "sig-%s" % (parts[1] if parts.size() > 1 else "coffee")


## Whether a menu item is a drink (signature drinks all are) rather than a bread or a pastry.
static func is_drink_item(id: String) -> bool:
	if id.begins_with("sig:"):
		return true
	if _drinks.is_empty():
		for m: Dictionary in CoreData.MENU:
			_drinks[m["id"]] = CoreData.is_drink(m["category"])
	return _drinks.get(id, false)


static func is_hot_drink(id: String) -> bool:
	if id.begins_with("sig:"):
		var definition: Variant = CoreSignatureDrinks.signature_definition(id)
		return definition == null or definition["base"] != "fruit"
	return is_drink_item(id) and not _COLD.has(id)


# ---------------------------------------------------------------- upgrades

## The basement's table, which stands in front of whoever is behind it: where it is in the picture, and its outline.
const TABLE_BOX := Rect2(452, 498, 468, 214)
const TABLE_OUTLINE: Array[Vector2] = [Vector2(466, 498), Vector2(453, 524), Vector2(453, 543), Vector2(467, 543), Vector2(467, 711), Vector2(911, 711), Vector2(911, 543), Vector2(919, 543), Vector2(919, 524), Vector2(908, 498)]
## Machine levels with a look of their own.
const MACHINE_LEVELS: Array[float] = [5.0, 10.0, 15.0]


## The machine's look at a level: 0 is the one in the fixtures layer.
static func machine_tier(level: float) -> float:
	return float(MACHINE_LEVELS.filter(func(at: float) -> bool: return level >= at).size())


## The pieces the kitchen is made of now, back to front. `expanded` is how often it has been (0 to 2).
static func kitchen_pieces(equipment: Array, expanded: float) -> Array:
	var has := func(id: String) -> bool: return equipment.has(id)
	var out := []
	if expanded < 2.0:
		out.append("stage-1" if expanded < 1.0 else "stage-2")
	# Against the back wall: the cabinets take the place of the peels and the two halves of the shelves.
	if has.call("convection"):
		out.append("convection")
	elif not has.call("sheeter"):
		out.append("peels")
	out.append("proofer" if has.call("proofer") else "shelf-left")
	out.append("pastryFridge" if has.call("pastryFridge") else "shelf-right")
	# On the table, then on the floor.
	out.append("sheeter" if has.call("sheeter") else "bowl")
	out.append("standMixer" if has.call("standMixer") else "jars")
	if has.call("kettle") or has.call("fryer"):
		out.append_array(["kettle", "fryer"].filter(has))
	else:
		out.append("basket")
	out.append("mixer" if has.call("mixer") else "pot")
	return out


# ---------------------------------------------------------------- staff looks

const SKINS: Array[int] = [0xf4cfad, 0xdfaa7d, 0xb67c55, 0x80533f]
const HAIRS: Array[int] = [0x594237, 0x976546, 0xdfb96f, 0xb9674e, 0x626782, 0xcc8c9f]
const SHIRTS: Array[int] = [0xbb6b58, 0x799ba7, 0x8ba477, 0xd3a453, 0x9b87af, 0xcf929e, 0x69a295, 0xe5d7ba]
const PANTS: Array[int] = [0x53637b, 0x85664f, 0x585464]
## Cells of a staff strip, the same as every other character's.
const STAFF_FRAMES := {"walk": [0, 1, 2, 3], "front": 4, "happy": 5, "side": 6, "back": 7}


static func _mod(n: float, length: int) -> int:
	var whole := int(n)
	return posmod(whole, length)


## One name per distinct look: looks that paint the same picture share it.
static func look_id(look: Dictionary, styles: int = 32) -> String:
	return "%d.%d.%d.%d.%d" % [_mod(look["hairStyle"], styles), _mod(look["skin"], SKINS.size()), _mod(look["hair"], HAIRS.size()), _mod(look["shirt"], SHIRTS.size()), _mod(look["pants"], PANTS.size())]


## A cook's look shows in skin and hair colour; their hat, scarf and clothes are their own.
static func cook_id(look: Dictionary) -> String:
	return "%d.%d" % [_mod(look["skin"], SKINS.size()), _mod(look["hair"], HAIRS.size())]


## The game's own colours for a look. What the game calls the shirt is the apron everyone wears.
static func look_colours(look: Dictionary) -> Dictionary:
	return {
		"skin": float(SKINS[_mod(look["skin"], SKINS.size())]), "hair": float(HAIRS[_mod(look["hair"], HAIRS.size())]),
		"apron": float(SHIRTS[_mod(look["shirt"], SHIRTS.size())]), "pants": float(PANTS[_mod(look["pants"], PANTS.size())]),
	}


# ---------------------------------------------------------------- work, the board and the jar

## How much of a barista's order is made, from 0 to 1; null when they are not making one.
static func brew_share(barista: Dictionary) -> Variant:
	if barista["customerId"] == null or barista["total"] <= 0.0 or barista["remaining"] <= 0.0:
		return null
	return _share(barista["remaining"], barista["total"])


## How much of their time at this station cook `i` has put in, from 0 to 1; null when they are not at work at one.
static func bake_share(sim: CoreSim, state: Dictionary, i: int) -> Variant:
	var batch: Variant = sim.cooks[i]["batch"] if i < sim.cooks.size() else null
	var at: Variant = sim.cook_station(float(i))
	if batch == null or at == null or not at["working"]:
		return null
	return _share(batch["timer"], CoreKitchen.STATION_SECONDS[at["station"]] * CoreStyles.style_station_multiplier(state) * CorePartners.partner_station_time(state, sim.cooks[i].get("partnerId")))


static func _share(left: float, total: float) -> float:
	return minf(1.0, maxf(0.0, 1.0 - left / total))


## How many dishes the board shows at a time, and for how long.
const _ROWS := 2
const _PAGE_SECONDS := 5.0


## The dishes on the board at a moment, the menu's pages taking turns.
static func board_rows(menu: Array, seconds: float) -> Array:
	var pages := maxf(1.0, ceil(menu.size() / float(_ROWS)))
	var page := int(fmod(floor(maxf(0.0, seconds) / _PAGE_SECONDS), pages))
	return menu.slice(page * _ROWS, page * _ROWS + _ROWS)


## What a board writes as a dish's price: the rounded one the shop charges, without the ledger's "≈".
static func board_price(state: Dictionary, item: Dictionary) -> String:
	var price: float = item["basePrice"] if String(item["id"]).begins_with("sig:") else CoreEconomy.item_price(item, state["items"][item["id"]])
	return CoreFormat.format_transaction_money(price).trim_prefix("≈")


## How full the tip jar is, 0 to 2: what the franchises have waiting, or the day's guests.
static func till_jar_level(state: Dictionary, now: float) -> float:
	if not state["chain"]["franchises"].is_empty():
		var fill: float = CoreChain.franchise_earnings(state, now)["fill"]
		return 2.0 if fill >= 1.0 else (1.0 if fill >= 1.0 / 3.0 else 0.0)
	var served: float = state["today"]["served"]
	return 2.0 if served >= 45.0 else (1.0 if served >= 15.0 else 0.0)
