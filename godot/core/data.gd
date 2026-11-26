class_name CoreData
extends RefCounted

# Port of src/game/data.ts — all constants loaded bit-exact from res://data/rules.json.

static var CATEGORIES: Array = RulesData.section("data")["CATEGORIES"]
static var MENU: Array = RulesData.section("data")["MENU"]
static var UPGRADES: Array = RulesData.section("data")["UPGRADES"]
static var CHAIN_STAR_BONUS: float = RulesData.section("data")["CHAIN_STAR_BONUS"]
static var ITEM_COST_GROWTH: float = RulesData.section("data")["ITEM_COST_GROWTH"]
static var LEVEL_COST_MULTIPLIER: float = RulesData.section("data")["LEVEL_COST_MULTIPLIER"]
static var PRICE_MILESTONES: Array = RulesData.section("data")["PRICE_MILESTONES"]
static var MAX_QUEUE: float = RulesData.section("data")["MAX_QUEUE"]
static var QUEUE_BALK_CHANCE: Array = RulesData.section("data")["QUEUE_BALK_CHANCE"]
static var BASE_ARRIVAL_RATE: float = RulesData.section("data")["BASE_ARRIVAL_RATE"]
static var MAX_ARRIVAL_RATE: float = RulesData.section("data")["MAX_ARRIVAL_RATE"]
static var ARRIVAL_CAPACITY_RATIO: float = RulesData.section("data")["ARRIVAL_CAPACITY_RATIO"]
static var VIP_CHANCE: float = RulesData.section("data")["VIP_CHANCE"]
static var VIP_MULTIPLIER: float = RulesData.section("data")["VIP_MULTIPLIER"]
static var PASS_SLOTS: float = RulesData.section("data")["PASS_SLOTS"]
static var MAX_PASS_SLOTS: float = RulesData.section("data")["MAX_PASS_SLOTS"]
static var RING_AGAIN: float = RulesData.section("data")["RING_AGAIN"]
static var CUSTOMER_WALK_SPEED: float = RulesData.section("data")["CUSTOMER_WALK_SPEED"]
static var INGREDIENTS: Array = RulesData.section("data")["INGREDIENTS"]
static var RECIPES: Dictionary = RulesData.section("data")["RECIPES"]
static var BAKE_STEP: float = RulesData.section("data")["BAKE_STEP"]
static var COOK_BATCHES: Array = RulesData.section("data")["COOK_BATCHES"]
static var MAX_COOK_BATCH: float = RulesData.section("data")["MAX_COOK_BATCH"]
static var COMBO_CHANCE: float = RulesData.section("data")["COMBO_CHANCE"]
static var VARIETY_BONUS: float = RulesData.section("data")["VARIETY_BONUS"]
static var MAX_VARIETY_BONUS: float = RulesData.section("data")["MAX_VARIETY_BONUS"]
static var DAY_SECONDS: float = RulesData.section("data")["DAY_SECONDS"]
static var SPEEDS: Array = RulesData.section("data")["SPEEDS"]

static func is_drink(c: Variant) -> bool:
	return (c is String) and (c == "coffee" or c == "tea")

static func find_menu(id: Variant) -> Variant:
	if not (id is String):
		return null
	for m in MENU:
		if m["id"] == id:
			return m
	return null

static func find_ingredient(id: Variant) -> Variant:
	if not (id is String):
		return null
	for ing in INGREDIENTS:
		if ing["id"] == id:
			return ing
	return null
