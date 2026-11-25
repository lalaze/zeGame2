class_name GameData
extends RefCounted

## Loads TS-exported JSON data (`res://data/*.json`) and provides formatting,
## translation, layout coordinate conversion, and paper-journal theme helpers.

const GAME_PATH := "res://data/game.json"
const LAYOUT_PATH := "res://data/layout.json"
const I18N_PATH := "res://data/i18n.json"

var game: Dictionary = {}
var layout: Dictionary = {}
var i18n: Dictionary = {}
var menu_by_id: Dictionary = {}
var menu_list: Array = []
var ingredients_list: Array = []
var ingredients_by_id: Dictionary = {}
var constants: Dictionary = {}
var starter_state: Dictionary = {}
var speeds: Array[int] = []
var price_milestones: Array[int] = []
var format_suffixes: Array[String] = []

var _ui_font: FontFile = null


func _init() -> void:
	game = _load_json(GAME_PATH)
	layout = _load_json(LAYOUT_PATH)
	i18n = _load_json(I18N_PATH)
	constants = game.get("constants", {})
	starter_state = game.get("starterState", {})
	menu_list = game.get("menu", [])
	for m in menu_list:
		menu_by_id[m["id"]] = m
	ingredients_list = game.get("ingredients", [])
	for ing in ingredients_list:
		ingredients_by_id[ing["id"]] = ing
	# JSON parses all numbers as floats; normalize integer constant arrays explicitly.
	speeds = []
	for s in constants.get("speeds", []):
		speeds.append(int(s))
	constants["speeds"] = speeds
	price_milestones = []
	for pm in constants.get("priceMilestones", []):
		price_milestones.append(int(pm))
	constants["priceMilestones"] = price_milestones
	format_suffixes = []
	for sf in constants.get("formatSuffixes", []):
		format_suffixes.append(str(sf))


func req_float(dict: Dictionary, key: String) -> float:
	if not dict.has(key):
		push_error("GameData: missing required float key '%s'" % key)
		return 0.0
	return float(dict[key])


func req_int(dict: Dictionary, key: String) -> int:
	if not dict.has(key):
		push_error("GameData: missing required int key '%s'" % key)
		return 0
	return int(dict[key])


static func _load_json(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("GameData: failed to open %s" % path)
		return {}
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("GameData: invalid JSON dictionary in %s" % path)
		return {}
	return parsed


func menu_item(id: String) -> Dictionary:
	return menu_by_id.get(id, {})


func ingredient(id: String) -> Dictionary:
	return ingredients_by_id.get(id, {})


func previous_in_category(id: String) -> Dictionary:
	var def := menu_item(id)
	if def.is_empty():
		return {}
	var cat: String = def["category"]
	var prev: Dictionary = {}
	for m in menu_list:
		if m["category"] != cat:
			continue
		if m["id"] == id:
			return prev
		prev = m
	return {}


func t(locale: String, key: String, vars: Dictionary = {}) -> String:
	var table: Dictionary = i18n.get(locale, i18n.get("zh", {}))
	var raw: String = str(table.get(key, key))
	for k in vars.keys():
		raw = raw.replace("{%s}" % str(k), str(vars[k]))
	# Strip simple HTML bold tags used in web copy (e.g. report.best).
	raw = raw.replace("<b>", "").replace("</b>", "")
	return raw


func format_number(n: float) -> String:
	if is_nan(n) or is_inf(n):
		return "∞"
	if n < 0.0:
		return "-" + format_number(-n)
	if n < 1000.0:
		return str(int(floor(n)))
	var tier := int(floor(log(n) / log(10.0) / 3.0))
	if tier >= format_suffixes.size():
		return "%.2e" % n
	var scaled := n / pow(1000.0, float(tier))
	var digits := 0 if scaled >= 100.0 else (1 if scaled >= 10.0 else 2)
	var factor := pow(10.0, float(digits))
	var truncated: float = floorf(scaled * factor) / factor
	if digits == 0:
		return "%d%s" % [int(truncated), format_suffixes[tier]]
	elif digits == 1:
		return "%.1f%s" % [truncated, format_suffixes[tier]]
	return "%.2f%s" % [truncated, format_suffixes[tier]]


func format_money(n: float) -> String:
	return "$" + format_number(n)


func format_clock(day_time: float) -> String:
	var day_sec := req_float(constants, "daySeconds")
	var open_hour := req_int(constants, "businessOpenHour")
	var hours := req_int(constants, "businessHours")
	var elapsed := clampf(day_time / maxf(1.0, day_sec), 0.0, 1.0)
	var elapsed_min := int(floor(elapsed * float(hours * 60)))
	var total_min := open_hour * 60 + elapsed_min
	var h := int(total_min / 60)
	var m := total_min % 60
	return "%02d:%02d" % [h, m]


func world_point(building: Dictionary, floor_id: String, x: float, y: float) -> Vector2:
	var offsets: Dictionary = building["offsets"]
	var floor_art: Dictionary = layout["floorArt"]
	var top := float(floor_art[floor_id]["top"])
	var offset := float(offsets.get(floor_id, 0.0))
	return Vector2(x, offset + y - top)


func rest_focus(building: Dictionary, view_h: float) -> float:
	var rf: Dictionary = layout.get("restFocus", {})
	var margin_ratio := req_float(rf, "marginRatio")
	var fit_ratio := req_float(rf, "fitRatio")
	var center_div := req_float(rf, "centerDivisor")
	var street_ratio := req_float(rf, "streetRatio")
	var street := float(building["street"])
	var margin := view_h * margin_ratio
	if street + margin <= view_h * fit_ratio:
		return view_h / center_div - margin
	return street - view_h * street_ratio


func get_ui_font() -> Font:
	if _ui_font != null:
		return _ui_font
	var latin: FontFile = load("res://fonts/nunito-latin.ttf")
	var cjk: FontFile = load("res://fonts/noto-sans-sc.ttf")
	if latin != null:
		_ui_font = latin.duplicate() as FontFile
		if cjk != null:
			_ui_font.fallbacks = [cjk]
		return _ui_font
	return cjk


func create_paper_theme() -> Theme:
	# Colors derived from src/ui/floors-ui.css ("paper journal").
	var paper := Color("#fbf3e4")
	var paper_2 := Color("#f3e6cc")
	var paper_light := Color("#fffaf0")
	var ink := Color("#4f3b2f")
	var muted := Color("#7d6656")
	var line := Color("#7a5a44")
	var soft_line := Color("#dcc6a4")
	var sage := Color("#6c8c68")
	var sage_dark := Color("#526f4f")
	var disabled_bg := Color("#efe5d3")
	var disabled_fg := Color("#8f7c6b")
	var disabled_border := Color("#b9a38a")

	var theme := Theme.new()
	var font := get_ui_font()
	if font != null:
		theme.default_font = font
	theme.default_font_size = 14

	theme.set_color("font_color", "Label", ink)
	theme.set_color("font_color", "Button", ink)
	theme.set_color("font_hover_color", "Button", ink)
	theme.set_color("font_pressed_color", "Button", ink)
	theme.set_color("font_focus_color", "Button", ink)
	theme.set_color("font_disabled_color", "Button", disabled_fg)
	theme.set_color("default_color", "RichTextLabel", ink)

	# Panel card style
	var panel_sb := _box(paper, line, 2, 18, 12, 10)
	theme.set_stylebox("panel", "PanelContainer", panel_sb)
	theme.set_stylebox("panel", "Panel", panel_sb)

	# Button styles
	var btn_normal := _box(paper, line, 2, 12, 10, 6)
	var btn_hover := _box(paper_light, line, 2, 12, 10, 6)
	var btn_pressed := _box(paper_2, line, 2, 12, 10, 6)
	var btn_disabled := _box(disabled_bg, disabled_border, 2, 12, 10, 6)
	theme.set_stylebox("normal", "Button", btn_normal)
	theme.set_stylebox("hover", "Button", btn_hover)
	theme.set_stylebox("pressed", "Button", btn_pressed)
	theme.set_stylebox("focus", "Button", btn_hover)
	theme.set_stylebox("disabled", "Button", btn_disabled)

	# Scrollbar styling
	var grabber := StyleBoxFlat.new()
	grabber.bg_color = soft_line
	grabber.set_corner_radius_all(4)
	theme.set_stylebox("grabber", "VScrollBar", grabber)
	theme.set_stylebox("grabber_highlight", "VScrollBar", grabber)
	theme.set_stylebox("grabber_pressed", "VScrollBar", grabber)

	# Helper metadata colors stored as theme constants/colors for UI scripts
	theme.set_color("paper", "Cafe", paper)
	theme.set_color("paper_2", "Cafe", paper_2)
	theme.set_color("paper_light", "Cafe", paper_light)
	theme.set_color("ink", "Cafe", ink)
	theme.set_color("muted", "Cafe", muted)
	theme.set_color("line", "Cafe", line)
	theme.set_color("soft_line", "Cafe", soft_line)
	theme.set_color("sage", "Cafe", sage)
	theme.set_color("sage_dark", "Cafe", sage_dark)
	theme.set_color("sage_soft", "Cafe", Color("#e3ebd8"))
	theme.set_color("rose", "Cafe", Color("#ecc3bd"))
	theme.set_color("rose_dark", "Cafe", Color("#b07a75"))
	theme.set_color("gold", "Cafe", Color("#d29a32"))
	theme.set_color("danger", "Cafe", Color("#b5614f"))
	return theme


static func _box(bg: Color, border: Color, bw: int, radius: int, pad_x: int, pad_y: int) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_y
	sb.content_margin_bottom = pad_y
	sb.shadow_color = Color(0.31, 0.23, 0.18, 0.22)
	sb.shadow_size = 0
	sb.shadow_offset = Vector2(0, 2)
	return sb
