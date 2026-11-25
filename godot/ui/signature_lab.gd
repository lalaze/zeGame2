class_name SignatureLab
extends RefCounted

## The workbench and recipe book of signature drinks (src/ui/signature-drinks.ts), with the page's own words.

const _COPY := {
	"en": {
		"doseRules": "Base: 1–2 portions. Each addition: 0–2 portions. Up to 3 addition types and 6 portions in total.",
		"pairingRules": "Game pairing rules: coffee cannot pair with fruit or matcha; tea cannot pair with cocoa; fruit and cocoa cannot mix. Incompatible additions are hidden.",
		"quality": "Recipe quality",
		"rating": "Current taste",
		"practice": "Recipe practice",
		"delivered": "Servings delivered",
		"standard": "New recipe",
		"skilled": "Practiced",
		"signature": "Mastered",
		"next": "Next milestone",
		"growth": "Practice grows only when a customer receives this drink. Tastings, saving and renaming give no experience. At 30 deliveries it becomes practiced; at 100 it masters automatically, with no research fee.",
		"mastered": "Mastery reached. Keep serving your house favorite.",
		"edit": "Edit formula",
		"title": "Signature drinks",
		"close": "Close",
		"create": "Develop a drink",
		"empty": "Your recipe book is waiting for its first drink.",
		"intro": "Milk and sugar are available from day one. House recipes inherit your espresso or tea technique and grow through serving. One portion of plain coffee or tea keeps the base price; extra portions or additions earn a 25% premium. Tea needs steeping time, and additions take longer.",
		"collection": "Recipe book",
		"back": "Back to recipes",
		"base": "1 · Choose a base",
		"additions": "2 · Add ingredients",
		"preview": "3 · Taste & refine",
		"name": "4 · Name your drink",
		"prep": "Research and menu changes are available during preparation only.",
		"locked": "Unlock a menu recipe using this ingredient first.",
		"dose": "Dose",
		"none": "None",
		"light": "1 portion",
		"extra": "2 portions",
		"cost": "Ingredients / serving",
		"price": "Current sale price",
		"time": "Current preparation time",
		"margin": "Ingredient margin / serving",
		"ingredients": "Ingredients per serving",
		"trial": "Taste ¼ serving",
		"trialRule": "Each tasting uses exactly ¼ of the listed ingredients. No extra cash fee.",
		"shortage": "Missing for a tasting",
		"tasted": "Tasting complete. You can now name and save this recipe.",
		"save": "Save recipe",
		"placeholder": "A name for your house drink",
		"invalid": "Choose a valid recipe: at most 3 additions and 6 total portions.",
		"incompatible": "These ingredients do not pair with this base.",
		"full": "Recipe book full. Delete a recipe before saving another.",
		"saved": "Recipe saved.",
		"duplicate": "This recipe is already in your book. Open it to rename or list it.",
		"listed": "On the menu",
		"unlisted": "Not on the menu",
		"list": "Add to menu",
		"unlist": "Remove from menu",
		"menuFull": "Three signature drinks are already on the menu. Remove one first.",
		"rename": "Rename",
		"remove": "Delete recipe",
		"confirm": "Delete this recipe from your book and menu?",
		"cancel": "Keep recipe",
		"detail": "Recipe details",
		"failed": "Could not save that change. Check the name, capacity and preparation phase.",
		"book": "saved",
		"menu": "on menu",
		"feedback": "Flavor notes",
		"estimated": "Current café bonuses included. Standard takeaway sale, before VIP or dine-in bonuses. Ingredient margin excludes other running costs.",
	},
	"zh": {
		"doseRules": "基底用量为 1–2 份，每种配料为 0–2 份；最多 3 种配料，总用量不超过 6 份。",
		"pairingRules": "游戏搭配规则：咖啡不能搭配水果或抹茶，茶不能搭配可可，水果与可可不能混用。不兼容的配料会隐藏。",
		"quality": "配方基础品质",
		"rating": "当前口味评分",
		"practice": "配方熟练度",
		"delivered": "已交付杯数",
		"standard": "新配方",
		"skilled": "熟练",
		"signature": "招牌大师",
		"next": "下一目标",
		"growth": "只有顾客实际收到饮品才会增加熟练度。试饮、保存和改名均不增加经验。交付 30 杯后熟练，100 杯后自动精通，无需支付研发费。",
		"mastered": "已精通这款配方，继续为顾客送上你的招牌风味吧。",
		"edit": "调整配方",
		"title": "招牌饮品",
		"close": "关闭",
		"create": "研发饮品",
		"empty": "配方本正等待你的第一款饮品。",
		"intro": "开局即可使用牛奶和糖。招牌承接浓缩或红茶的制作技术，交付后继续成长。单份纯咖啡或纯茶与基础款同价；增加用量或配料可享 25% 溢价。茶需要浸泡时间，加料也会增加耗时。",
		"collection": "配方本",
		"back": "返回配方本",
		"base": "1 · 选择基底",
		"additions": "2 · 添加配料",
		"preview": "3 · 试饮与调整",
		"name": "4 · 为饮品取名",
		"prep": "仅可在准备营业时研发饮品和调整菜单。",
		"locked": "先解锁使用此食材的菜单配方。",
		"dose": "用量",
		"none": "不添加",
		"light": "1 份",
		"extra": "2 份",
		"cost": "每杯食材成本",
		"price": "当前售价",
		"time": "当前制作时间",
		"margin": "每杯食材毛利",
		"ingredients": "每杯所需食材",
		"trial": "试饮 ¼ 杯",
		"trialRule": "每次试饮准确消耗所列食材的 ¼，不额外收取现金。",
		"shortage": "试饮缺少",
		"tasted": "试饮完成，可以取名并保存配方了。",
		"save": "保存配方",
		"placeholder": "为你的招牌饮品取个名字",
		"invalid": "请使用有效配方：最多 3 种配料，总用量不超过 6 份。",
		"incompatible": "这些配料不适合此基底。",
		"full": "配方本已满，请先删除一款配方。",
		"saved": "配方已保存。",
		"duplicate": "配方本已有此配方，可打开详情改名或上架。",
		"listed": "已上架",
		"unlisted": "未上架",
		"list": "加入菜单",
		"unlist": "移出菜单",
		"menuFull": "已有 3 款招牌饮品上架，请先移出一款。",
		"rename": "改名",
		"remove": "删除配方",
		"confirm": "从配方本和菜单中删除此配方？",
		"cancel": "保留配方",
		"detail": "配方详情",
		"failed": "未能保存更改，请检查名称、数量限制与营业阶段。",
		"book": "款已保存",
		"menu": "款已上架",
		"feedback": "风味笔记",
		"estimated": "已计入当前咖啡馆加成。按普通外带订单计算，不含贵宾或堂食加成。食材毛利未扣除其他运营成本。",
	},
}
const _NOTES := {
	"roasted": "烘焙香",
	"fragrant": "清香",
	"creamy": "奶香",
	"fruity": "果香",
	"sweet": "甜润",
	"lightly sweet": "微甜",
	"chocolate": "巧克力香",
	"spiced": "香料味",
	"earthy": "草木香",
	"A clean, base-forward drink.": "口感纯净，突出基底风味。",
	"Layered flavors take longer to prepare.": "风味层次丰富，制作也需要更长时间。",
	"A focused blend with a clear base.": "搭配协调，基底风味清晰。",
	"Extra sugar makes this noticeably sweeter.": "加倍的糖带来明显的甜味。",
	"Double cream gives a rich finish.": "双份奶油带来浓郁余味。",
	"Double spice creates a bold, warming finish.": "双份香料带来浓烈而温暖的余味。",
}
const _NAMES := {
	"coffee": ["Coffee", "咖啡"],
	"beans": ["Coffee beans", "咖啡豆"],
	"tea": ["Tea", "茶"],
	"milk": ["Milk", "牛奶"],
	"fruit": ["Fruit", "水果"],
	"sugar": ["Sugar", "糖"],
	"spice": ["Spice", "香料"],
	"cocoa": ["Cocoa", "可可"],
	"cream": ["Cream", "奶油"],
	"matcha": ["Matcha", "抹茶"],
	"flour": ["Flour", "面粉"],
	"butter": ["Butter", "黄油"],
	"eggs": ["Eggs", "鸡蛋"],
}
var _ui: CafeUi
var _session: CoreGameSession
var _changed: Callable
var _closed: Callable
var _root := Paper.col([], 10)
var _scroll: ScrollContainer = null
var _base := "coffee"
var _recipe: Dictionary = {"beans": 1.0}
var _tasted: Variant = null
var _editing: Variant = null
var _draft := ""
var _notice := ""


## `closed` reopens whatever dialog led here, such as the preparation.
static func show_lab(ui: CafeUi, changed: Callable, closed: Callable = Callable()) -> void:
	var lab := SignatureLab.new()
	lab._ui = ui
	lab._session = ui.session
	lab._changed = changed
	lab._closed = closed
	lab._list()
	# The dialog keeps the workbench alive as long as it is shown.
	lab._root.set_meta("lab", lab)
	lab._scroll = ui.dialogs.show_dialog(lab._w("title"), lab._root, [{"label": lab._w("close"), "pressed": closed}], {"tall": true, "back": func() -> void:
		ui.dialogs.close()
		if closed.is_valid():
			closed.call()})["scroll"]


func _w(key: String) -> String:
	return _COPY[I18n.locale][key]


static func _label(id: String) -> String:
	return _NAMES[id][1 if I18n.locale == "zh" else 0]


static func _flavor(text: String) -> String:
	return _NOTES.get(text, text) if I18n.locale == "zh" else text


static func _money(n: float) -> String:
	return CoreFormat.format_transaction_money(n)


func _prep() -> bool:
	return _session.state["phase"] == "prep"


## `drink` pictures a base as the finished drink rather than as its ingredient.
static func _art(id: String, drink: bool = false) -> Control:
	return Portraits.icon("sig:%s" % id if drink else ("item:espresso" if id == "coffee" else "ing:%s" % id), 48.0)


static func _button(text: String, pressed: Callable, enabled: bool = true, kind: String = "ghost") -> Button:
	var b := Paper.button(text, kind, pressed)
	b.disabled = not enabled
	return b


func _page(children: Array) -> void:
	Paper.clear(_root)
	for c: Control in children:
		_root.add_child(c)
	if _scroll != null:
		_scroll.scroll_vertical = 0


func _status() -> Label:
	var l := Paper.words(_notice if not _notice.is_empty() else ("" if _prep() else _w("prep")), "good")
	l.visible = not l.text.is_empty()
	return l


static func _ingredients(value: Dictionary, scale: float = 1.0) -> Control:
	var row := Paper.flow([], 10)
	for key: String in value:
		if value[key] > 0.0:
			row.add_child(Paper.line([Portraits.icon("ing:%s" % key, 28.0), Paper.words("%s × %s" % [_label(key), JsMath.number_to_string(value[key] * scale)], "", false)], 4))
	for c: Control in row.get_children():
		c.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	return row


func _list() -> void:
	var s := _session.state
	var drinks := CoreSignatureDrinks.list_signature_drinks(s)
	var cards := Paper.col([], 8)
	for drink: Dictionary in drinks:
		var def: Variant = CoreSignatureDrinks.signature_definition(drink["id"])
		if def == null:
			continue
		var card := Paper.card("row")
		card.add_child(Paper.line([_art(def["base"], true), Paper.col([Paper.words(drink["name"], "strong"), Paper.words(_w("listed" if drink["onMenu"] else "unlisted"), "muted")], 2), _button(_w("detail"), _detail.bind(drink["id"]))], 10))
		cards.add_child(card)
	if drinks.is_empty():
		cards.add_child(Paper.words(_w("empty"), "muted"))
	var listed := drinks.filter(func(d: Dictionary) -> bool: return d["onMenu"]).size()
	_page([Paper.words(_w("collection"), "h3"), Paper.words(_w("intro"), "muted"), Paper.words("%d/%d %s · %d/%d %s" % [drinks.size(), int(CoreSignatureDrinks.MAX_SIGNATURE_RECIPES), _w("book"), listed, int(CoreSignatureDrinks.MAX_SIGNATURE_MENU), _w("menu")], "strong"), _status(), cards,
		_button(_w("create"), func() -> void:
			_base = "coffee"
			_recipe = {"beans": 1.0}
			_tasted = null
			_editing = null
			_draft = ""
			_notice = ""
			_workbench(), _prep() and drinks.size() < CoreSignatureDrinks.MAX_SIGNATURE_RECIPES, "primary")])


func _summary(id: String) -> Control:
	var s := _session.state
	var def: Dictionary = CoreSignatureDrinks.signature_definition(id)
	var price := CoreEconomy.sale_price(s, id)
	var box := Paper.col([], 6)
	for e: Array in [[_w("cost"), _money(def["cost"])], [_w("price"), _money(price)], [_w("time"), "%ss" % JsMath.number_to_string(JsMath.parse_float(UiWords.fixed(CoreEconomy.prep_time(s, id), 2)))], [_w("margin"), _money(price - def["cost"])]]:
		box.add_child(Paper.line([Paper.words(e[0], "muted"), Paper.words(e[1], "strong", false)]))
	var delivered: float = s["signatureDrinks"]["served"].get(id, 0.0)
	var tier := CoreTaste.taste_tier(s, id)
	var growth := Paper.card("sage")
	growth.add_child(Paper.col([Paper.words(_w("practice"), "strong"), Paper.words("%s: %s / 5 · %s" % [_w("rating"), UiWords.fixed(CoreTaste.taste_score(s, id), 1), _w(tier)]), Paper.words("%s: %s / 5" % [_w("quality"), UiWords.fixed(def["quality"], 1)], "muted"), Paper.words("%s: %s" % [_w("delivered"), JsMath.number_to_string(delivered)]),
		Paper.words(_w("mastered") if tier == "signature" else "%s: %s / %s" % [_w("next"), JsMath.number_to_string(delivered), JsMath.number_to_string(CoreTaste.SKILLED_SERVINGS if tier == "standard" else CoreTaste.SIGNATURE_SERVINGS)]), Paper.words(_w("growth"), "muted")], 4))
	box.add_child(growth)
	box.add_child(Paper.words(_w("estimated"), "muted"))
	box.add_child(Paper.words(_w("feedback"), "strong"))
	box.add_child(Paper.words(" · ".join(PackedStringArray(def["flavor"].map(_flavor)))))
	for note: String in def["feedback"]:
		box.add_child(Paper.words(_flavor(note), "muted"))
	box.add_child(Paper.words(_w("ingredients"), "strong"))
	box.add_child(_ingredients(def["recipe"]))
	return box


func _workbench() -> void:
	var s := _session.state
	var unlocked := CoreSignatureDrinks.available_signature_ingredients(s)
	var bases := Paper.grid(2, [], 8)
	for value: String in CoreSignatureDrinks.SIGNATURE_BASES:
		var core: String = CoreSignatureDrinks.BASE_INGREDIENT[value]
		var b := Paper.multi([[_label(value), "strong"]], _art(value, true), func() -> void:
			_base = value
			_recipe = {core: 1.0}
			_tasted = null
			_notice = ""
			_workbench(), "on" if _base == value else "ghost")
		b.disabled = not _prep() or core not in unlocked
		bases.add_child(b)
	var doses := Paper.col([], 6)
	_add_dose(doses, CoreSignatureDrinks.BASE_INGREDIENT[_base], true, unlocked)
	for id: String in CoreSignatureDrinks.SIGNATURE_ADDONS:
		if id != CoreSignatureDrinks.BASE_INGREDIENT[_base]:
			_add_dose(doses, id, false, unlocked)
	var preview := Paper.col([Paper.words(_w("preview"), "h3")], 8)
	var check := CoreSignatureDrinks.validate_signature_recipe(_base, _recipe)
	var id: Variant = CoreSignatureDrinks.make_signature_id(_base, _recipe)
	var missing := {}
	for key: String in _recipe:
		var stock: float = s["pantry"].get(key, 0.0)
		var short: float = _recipe[key] * 0.25 - maxf(0.0, stock)
		if short > 0.0:
			missing[key] = short
	var locked := _recipe.keys().any(func(key: String) -> bool: return key not in unlocked)
	if id != null and check["ok"]:
		preview.add_child(_summary(id))
	else:
		preview.add_child(Paper.words(_w("incompatible" if check.get("error") is String and check["error"] == "incompatible" else "invalid")))
	preview.add_child(Paper.words(_w("trialRule"), "muted"))
	if not missing.is_empty():
		preview.add_child(Paper.words(_w("shortage"), "strong"))
		preview.add_child(_ingredients(missing))
		var cost := 0.0
		for key: String in missing:
			cost += ceilf(missing[key]) * CoreEconomy.ingredient_def(key)["cost"]
		preview.add_child(_button("%s · %s" % [UiWords.here("购买试饮缺少的食材", "Buy missing tasting ingredients"), _money(cost)], func() -> void:
			if not _prep() or s["coins"] < cost:
				return
			for key: String in missing:
				CoreEconomy.buy_ingredient(s, key, ceilf(missing[key]))
			_changed.call()
			_workbench(), _prep() and not locked and s["coins"] >= cost))
	if locked:
		preview.add_child(Paper.words(_w("locked"), "muted"))
	preview.add_child(_button(_w("trial"), _taste, _prep() and check["ok"] and not locked and missing.is_empty(), "primary"))
	var book_full := func() -> bool: return _editing == null and CoreSignatureDrinks.list_signature_drinks(s).size() >= CoreSignatureDrinks.MAX_SIGNATURE_RECIPES
	var can_save := func() -> bool: return _prep() and id != null and _tasted is String and _tasted == id and not _draft.strip_edges().is_empty() and not book_full.call()
	var save := _button(_w("save"), _save.bind(id), can_save.call(), "primary")
	var input := Paper.entry(_draft, _w("placeholder"), 24, func(text: String) -> void:
		_draft = text
		save.disabled = not can_save.call(), _prep())
	_page([_button(_w("back"), _list), Paper.words(_w("base"), "h3"), bases, Paper.words(_w("additions"), "h3"), Paper.words(_w("doseRules"), "muted"), Paper.words(_w("pairingRules"), "muted"), doses, preview, _status(), Paper.words(_w("name"), "h3"), input, save])


func _add_dose(doses: VBoxContainer, id: String, is_base: bool, unlocked: Array) -> void:
	# Compatibility is asked for one addition alone, whatever else is in.
	if not is_base and not _recipe.has(id) and id not in CoreSignatureDrinks.compatible_signature_addons(_base, _recipe):
		return
	var open: bool = id in unlocked
	var entries := []
	for n: int in ([1, 2] if is_base else [0, 1, 2]):
		entries.append([float(n), _w(["none", "light", "extra"][n])])
	var row := Paper.line([Portraits.icon("ing:%s" % id, 32.0), Paper.words(_label(id))])
	if not open:
		row.add_child(Paper.words(_w("locked"), "small"))
	row.add_child(Paper.select(entries, _recipe.get(id, 0.0), func(n: float) -> void:
		if not _prep():
			return
		if n > 0.0:
			_recipe[id] = n
		else:
			_recipe.erase(id)
		_tasted = null
		_notice = ""
		_workbench.call_deferred(), _prep() and open))
	doses.add_child(row)


func _taste() -> void:
	var result := CoreSignatureDrinks.trial_signature(_session.state, _base, _recipe)
	if result["ok"] and result.get("id") != null:
		_tasted = result["id"]
		_notice = _w("tasted")
		_changed.call()
	else:
		_notice = _w({"open": "prep", "locked": "locked", "stock": "shortage"}.get(result.get("error"), "invalid"))
	_workbench()


func _save(id: Variant) -> void:
	var s := _session.state
	if id == null or not (_tasted is String and _tasted == id):
		return
	for d: Dictionary in CoreSignatureDrinks.list_signature_drinks(s):
		if d["id"] == id and not (_editing is String and _editing == id):
			_notice = _w("duplicate")
			_workbench()
			return
	if CoreSignatureDrinks.replace_signature(s, _editing, id, _draft) if _editing != null else CoreSignatureDrinks.save_signature(s, id, _draft):
		_changed.call()
		_notice = _w("saved")
		_list()
	else:
		_notice = _w("failed")
		_workbench()


func _detail(id: String, confirming: bool = false) -> void:
	var s := _session.state
	var drinks := CoreSignatureDrinks.list_signature_drinks(s)
	var found := drinks.filter(func(d: Dictionary) -> bool: return d["id"] == id)
	if found.is_empty():
		_list()
		return
	var drink: Dictionary = found[0]
	var def: Dictionary = CoreSignatureDrinks.signature_definition(id)
	var name := Paper.entry(drink["name"], "", 24, Callable(), _prep())
	var full: bool = not drink["onMenu"] and drinks.filter(func(d: Dictionary) -> bool: return d["onMenu"]).size() >= CoreSignatureDrinks.MAX_SIGNATURE_MENU
	# Whether a change took: the words that say it did not.
	var after := func(ok: bool) -> void:
		if ok:
			_changed.call()
		_notice = "" if ok else _w("failed")
		_detail(id)
	var actions := Paper.flow([
		_button(_w("edit"), func() -> void:
			_base = def["base"]
			_recipe = def["recipe"].duplicate()
			_draft = drink["name"]
			_tasted = null
			_editing = id
			_notice = ""
			_workbench(), _prep()),
		_button(_w("rename"), func() -> void: after.call(CoreSignatureDrinks.rename_signature(s, id, name.text)), _prep()),
		_button(_w("unlist" if drink["onMenu"] else "list"), func() -> void: after.call(CoreSignatureDrinks.set_signature_on_menu(s, id, not drink["onMenu"])), _prep() and not full),
		_button(_w("remove"), _detail.bind(id, true), _prep()),
	])
	var children := [_button(_w("back"), func() -> void:
		_notice = ""
		_list()), Paper.words(drink["name"], "h3"), _art(def["base"], true), Paper.words(_w("listed" if drink["onMenu"] else "unlisted")), _summary(id), _status(), name, actions]
	if full:
		children.append(Paper.words(_w("menuFull"), "muted"))
	if confirming:
		children.append(Paper.words(_w("confirm"), "bad"))
		children.append(Paper.flow([_button(_w("cancel"), _detail.bind(id)), _button(_w("remove"), func() -> void:
			if CoreSignatureDrinks.delete_signature(s, id):
				_changed.call()
				_notice = ""
				_list()
			else:
				_notice = _w("failed")
				_detail(id), _prep(), "danger")]))
	_page(children)
