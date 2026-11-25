class_name CoreFlavors
extends RefCounted

# Port of src/game/flavors.ts

static func _sec() -> Dictionary:
	return RulesData.section("flavors")

static var FLAVORS: Array = RulesData.section("flavors")["FLAVORS"]
static func _ITEM_FLAVORS() -> Dictionary: return _sec()["ITEM_FLAVORS"]

static func item_flavors(id: Variant) -> Array:
	var custom = CoreSignatureDrinks.signature_definition(id)
	if custom == null:
		var table := _ITEM_FLAVORS()
		if id is String and table.has(id):
			return table[id]
		return []
	var recipe: Dictionary = custom["recipe"]
	var flavors: Array = []
	if recipe.has("beans") and float(recipe["beans"]) != 0.0:
		flavors.append("bold")
	if (recipe.has("milk") and float(recipe["milk"]) != 0.0) or (recipe.has("cream") and float(recipe["cream"]) != 0.0):
		flavors.append("milky")
	if recipe.has("cocoa") and float(recipe["cocoa"]) != 0.0:
		flavors.append("cocoa")
	if recipe.has("sugar") and float(recipe["sugar"]) != 0.0:
		flavors.append("sweet")
	if (recipe.has("tea") and float(recipe["tea"]) != 0.0) or (recipe.has("matcha") and float(recipe["matcha"]) != 0.0):
		flavors.append("tea")
	if recipe.has("spice") and float(recipe["spice"]) != 0.0:
		flavors.append("spiced")
	if recipe.has("fruit") and float(recipe["fruit"]) != 0.0:
		flavors.append("fruity")
	return flavors

static func guest_identity(c: Dictionary) -> float:
	if c.has("appearanceId") and JsUtil.is_number(c["appearanceId"]) and JsMath.is_integer(c["appearanceId"]) and float(c["appearanceId"]) >= 0.0:
		return float(c["appearanceId"])
	var l: Dictionary = c["look"]
	return (((float(l["skin"]) * 6.0 + float(l["hair"])) * 4.0 + float(l["hairStyle"])) * 8.0 + float(l["shirt"])) * 3.0 + float(l["pants"])

static func guest_taste(c: Dictionary) -> Dictionary:
	var person := guest_identity(c)
	var fl := FLAVORS
	var n := float(fl.size())
	var idx1 := int(fmod(person, n))
	var idx2 := int(fmod(person * 3.0 + 5.0, n))
	return {
		"liked": fl[idx1],
		"avoided": fl[idx2],
	}
