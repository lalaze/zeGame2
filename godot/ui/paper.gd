class_name Paper
extends RefCounted

## The "paper journal" look of the game's screens (src/ui/floors-ui.css) and the builders every screen is made with:
## cream paper, thin warm-brown outlines, a stamped shadow, sage for the main action and dusty rose for what is selected.
## Sizes are CSS pixels of the phone page (412 wide).

const PAPER := Color8(0xfb, 0xf3, 0xe4)
const PAPER_2 := Color8(0xf3, 0xe6, 0xcc)
const LIGHT := Color8(0xff, 0xfa, 0xf0)
const INK := Color8(0x4f, 0x3b, 0x2f)
const MUTED := Color8(0x7d, 0x66, 0x56)
const LINE := Color8(0x7a, 0x5a, 0x44)
const SOFT_LINE := Color8(0xdc, 0xc6, 0xa4)
const STITCH := Color(122 / 255.0, 90 / 255.0, 68 / 255.0, 0.35)
const STAMP := Color(79 / 255.0, 59 / 255.0, 47 / 255.0, 0.28)
const SAGE := Color8(0x6c, 0x8c, 0x68)
const SAGE_DARK := Color8(0x52, 0x6f, 0x4f)
const SAGE_SOFT := Color8(0xe3, 0xeb, 0xd8)
const ROSE := Color8(0xec, 0xc3, 0xbd)
const ROSE_DARK := Color8(0xb0, 0x7a, 0x75)
const GOLD := Color8(0xd2, 0x9a, 0x32)
const DANGER := Color8(0xb5, 0x61, 0x4f)
const DANGER_DARK := Color8(0x8c, 0x44, 0x36)
const OFF_FACE := Color8(0xef, 0xe5, 0xd3)
const OFF_TEXT := Color8(0x8f, 0x7c, 0x6b)
const OFF_LINE := Color8(0xb9, 0xa3, 0x8a)
const VEIL := Color(43 / 255.0, 30 / 255.0, 22 / 255.0, 0.42)

## Line icons on a 24-unit grid, stroked round at 1.9 units; those in _SOLID are filled.
const ICONS := {
	"map": "M4.5 10.5h15V20h-15zM3.5 10.5l2-5.5h13l2 5.5M3.5 10.5c0 1.4 1.1 2.2 2.6 2.2s2.6-.8 2.6-2.2c0 1.4 1.1 2.2 2.7 2.2s2.6-.8 2.6-2.2c0 1.4 1.1 2.2 2.6 2.2s2.6-.8 2.6-2.2M10 20v-4.5h4V20",
	"menu": "M5 9.5h11V14a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.6a2.4 2.4 0 0 1 0 4.8H16M8.5 3.8c.8 1 .8 2 0 3M12 3.8c.8 1 .8 2 0 3",
	"help": "M12 20s-7.5-4.6-7.5-10A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.4c0 5.4-7.5 10-7.5 10z",
	"book": "M3.5 5.5c2.8-1.2 5.6-1.2 8.5.5v13.5c-2.9-1.7-5.7-1.7-8.5-.5zM20.5 5.5c-2.8-1.2-5.6-1.2-8.5.5v13.5c2.9-1.7 5.7-1.7 8.5-.5z",
	"more": "M7.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0zM13.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0zM19.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z",
	"pantry": "M8 3.5h8V6H8zM7 6h10a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V7.5A1.5 1.5 0 0 1 7 6zM9 12.5h6",
	"upgrades": "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0zM12 16.5V8M8.5 11.2 12 7.8l3.5 3.4",
	"decor": "M5.5 11V8.3A2.3 2.3 0 0 1 7.8 6h8.4a2.3 2.3 0 0 1 2.3 2.3V11M3 12.2a2 2 0 0 1 4 0V14h10v-1.8a2 2 0 0 1 4 0V18H3zM5 18v1.8M19 18v1.8",
	"pets": "M5 20v-7.5L4 5.5l4.2 3h7.6l4.2-3-1 7V20zM9.3 13.2h.01M14.7 13.2h.01M11 16.5l1 .8 1-.8",
	"promotion": "M4 10v4.2h3l7.5 4.3V5.7L7 10zM17.5 9a4.2 4.2 0 0 1 0 6.2M7.5 14.2l1.2 4.3",
	"coin": "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0zM12 7.5v9M14.5 9.5c-.6-.8-1.5-1.2-2.6-1.2-1.4 0-2.4.8-2.4 1.9 0 2.6 5.2 1.4 5.2 4 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.2-.5-2.8-1.3",
	"star": "M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z",
	"people": "M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM3.5 19.5c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M15.5 5.2a2.8 2.8 0 0 1 0 5.6M16.8 14.2c2.2.5 3.7 2.5 3.7 5.3",
	"settings": "M4 7h10M18 7h2M4 17h2M10 17h10M18 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
	"close": "M6.5 6.5l11 11M17.5 6.5l-11 11",
	"chevron": "M9.5 5.5 16 12l-6.5 6.5",
	"wall": "M3.5 11.5 12 4.5l8.5 7M6 9.5v10h12v-10M10 19.5v-5h4v5M14.5 10.5h2.5v2.5h-2.5z",
	"kitchen": "M7 20v-6.2A4 4 0 0 1 6.6 6a5.6 5.6 0 0 1 10.8 0 4 4 0 0 1-.4 7.8V20zM7 16.8h10",
	"clock": "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 7.5V12l3 2",
	"left": "M19 12H5.5M11 6l-6 6 6 6",
	"right": "M5 12h13.5M13 6l6 6-6 6",
	"spark": "M12 3.5l1.9 5.2 5.6.3-4.4 3.5 1.5 5.4L12 14.8 7.4 17.9l1.5-5.4L4.5 9l5.6-.3z",
}
const _SOLID: Array[String] = ["more"]
static var _icon_textures: Dictionary = {}
static var _fonts: Dictionary = {}
static var _theme: Theme = null
static var _row_boxes: Dictionary = {}


# ---------------------------------------------------------------- letters

## The game's letters at a weight: 500 for text, 700 for buttons, 800 for headings. Chinese is thickened on its own, as a
## variation's thickening does not reach its fallbacks.
static func font(weight: int = 500) -> Font:
	if not _fonts.has(weight):
		var latin := FontVariation.new()
		latin.base_font = load("res://fonts/nunito-latin.ttf")
		latin.variation_embolden = {500: 0.0, 600: 0.2, 700: 0.45, 800: 0.65}[weight]
		var chinese := FontVariation.new()
		chinese.base_font = load("res://fonts/noto-sans-sc.ttf")
		chinese.variation_embolden = {500: 0.0, 600: 0.35, 700: 0.6, 800: 0.8}[weight]
		latin.fallbacks = [chinese] as Array[Font]
		_fonts[weight] = latin
	return _fonts[weight]


static func theme() -> Theme:
	if _theme != null:
		return _theme
	_theme = Theme.new()
	_theme.default_font = font()
	_theme.default_font_size = 14
	_theme.set_color("font_color", "Label", INK)
	_theme.set_constant("line_spacing", "Label", 0)
	for kind: String in ["VBoxContainer", "HBoxContainer"]:
		_theme.set_constant("separation", kind, 8)
	var grabber := StyleBoxFlat.new()
	grabber.bg_color = SOFT_LINE
	grabber.set_corner_radius_all(4)
	grabber.content_margin_left = 4.0
	var rail := StyleBoxEmpty.new()
	rail.content_margin_left = 4.0
	for look: String in ["grabber", "grabber_highlight", "grabber_pressed"]:
		_theme.set_stylebox(look, "VScrollBar", grabber)
	_theme.set_stylebox("scroll", "VScrollBar", rail)
	return _theme


# ---------------------------------------------------------------- boxes

static func box(face: Color, line: Color, width: float, radius: float, pad: Vector2 = Vector2(12, 10), shadow: Color = Color.TRANSPARENT, drop: float = 0.0) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = face
	b.border_color = line
	b.set_border_width_all(int(width))
	b.set_corner_radius_all(int(radius))
	b.corner_detail = 6
	b.content_margin_left = pad.x
	b.content_margin_right = pad.x
	b.content_margin_top = pad.y
	b.content_margin_bottom = pad.y
	if drop > 0.0:
		b.shadow_color = shadow
		b.shadow_size = 1
		b.shadow_offset = Vector2(0.0, drop)
	return b


## A container drawn as paper; `stitched` adds a dashed line inside or instead of the edge.
static func panel(style: StyleBox, stitched: Color = Color.TRANSPARENT, inset: float = 0.0, radius: float = 14.0) -> PanelContainer:
	var p: PanelContainer = PanelContainer.new() if stitched.a == 0.0 else PaperStitched.new(stitched, inset, radius)
	p.add_theme_stylebox_override("panel", style)
	p.mouse_filter = Control.MOUSE_FILTER_PASS
	return p


## Lets no touch through to what is under it.
static func firm(c: Control) -> Control:
	c.mouse_filter = Control.MOUSE_FILTER_STOP
	return c


## Cards and sheets by what they are for.
static func card(kind: String = "row") -> PanelContainer:
	match kind:
		"row": return panel(box(LIGHT, SOFT_LINE, 2, 16, Vector2(12, 12)))
		"soft": return panel(box(LIGHT, Color.TRANSPARENT, 0, 16, Vector2(14, 12)), SOFT_LINE, 1.0, 16.0)
		"sage": return panel(box(SAGE_SOFT, Color.TRANSPARENT, 0, 14, Vector2(14, 10)))
		"goal": return panel(box(SAGE_SOFT, Color.TRANSPARENT, 0, 14, Vector2(8, 6)), SAGE, 1.0, 14.0)
		"sheet": return firm(panel(box(PAPER, LINE, 2, 24, Vector2(18, 16), STAMP, 4.0)))
		"plaque": return firm(panel(box(PAPER, LINE, 2, 18, Vector2(14, 8), STAMP, 3.0), STITCH, 7.0, 12.0))
		"tile": return panel(tile_box(false))
		"note": return panel(box(Color.TRANSPARENT, Color.TRANSPARENT, 0, 16, Vector2(14, 12)), STITCH, 1.0, 16.0)
	return panel(box(LIGHT, SOFT_LINE, 2, 16))


static func tile_box(on: bool) -> StyleBox:
	var key := "tile%s" % on
	if not _row_boxes.has(key):
		_row_boxes[key] = box(SAGE_SOFT, SAGE, 2, 16, Vector2(8, 10)) if on else box(LIGHT, Color.TRANSPARENT, 0, 16, Vector2(8, 10))
	return _row_boxes[key]


## A list's row; `marked` is one the player was sent here for.
static func row_box(marked: bool) -> StyleBoxFlat:
	if not _row_boxes.has(marked):
		_row_boxes[marked] = box(LIGHT, DANGER if marked else SOFT_LINE, 2, 16, Vector2(12, 12))
	return _row_boxes[marked]


# ---------------------------------------------------------------- words

## Kinds: "" text, "muted", "small", "h1", "h2", "h3", "name", "good", "bad", "strong".
static func words(text: String, kind: String = "", wrap: bool = true) -> Label:
	var l := Label.new()
	l.text = text
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var looks := {"": [14, 500, INK], "muted": [13, 500, MUTED], "small": [12, 500, MUTED], "h1": [24, 800, INK], "h2": [22, 800, INK], "h3": [16, 800, INK], "name": [18, 800, INK], "good": [14, 600, SAGE_DARK], "bad": [14, 600, DANGER], "strong": [14, 700, INK], "tiny": [11, 600, MUTED]}
	var look: Array = looks[kind]
	l.add_theme_font_size_override("font_size", look[0])
	l.add_theme_font_override("font", font(look[1]))
	l.add_theme_color_override("font_color", look[2])
	return l


## Writes words that are there only when they say something.
static func say(l: Control, text: String) -> void:
	l.text = text
	l.visible = not text.is_empty()


static func col(children: Array = [], gap: int = 8) -> VBoxContainer:
	var b := VBoxContainer.new()
	b.add_theme_constant_override("separation", gap)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for c: Control in children:
		b.add_child(c)
	return b


static func line(children: Array = [], gap: int = 8) -> HBoxContainer:
	var b := HBoxContainer.new()
	b.add_theme_constant_override("separation", gap)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for c: Control in children:
		b.add_child(c)
	return b


## Children side by side, wrapping to another row when they must.
static func flow(children: Array = [], gap: int = 8) -> HFlowContainer:
	var b := HFlowContainer.new()
	b.add_theme_constant_override("h_separation", gap)
	b.add_theme_constant_override("v_separation", gap)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for c: Control in children:
		b.add_child(c)
	return b


static func grid(columns: int, children: Array = [], gap: int = 8) -> GridContainer:
	var g := GridContainer.new()
	g.columns = columns
	g.add_theme_constant_override("h_separation", gap)
	g.add_theme_constant_override("v_separation", gap)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for c: Control in children:
		c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		g.add_child(c)
	return g


## As many columns as there is room for, none narrower than `narrowest`.
static func tiles(narrowest: float, gap: int = 8) -> GridContainer:
	var g := grid(2, [], gap)
	g.resized.connect(func() -> void:
		var most := maxi(1, int((g.size.x + gap) / (narrowest + gap)))
		if most != g.columns:
			g.columns = most)
	return g


static func padded(child: Control, left: int, top: int = -1, right: int = -1, bottom: int = -1) -> MarginContainer:
	var m := MarginContainer.new()
	m.add_theme_constant_override("margin_left", left)
	m.add_theme_constant_override("margin_top", top if top >= 0 else left)
	m.add_theme_constant_override("margin_right", right if right >= 0 else left)
	m.add_theme_constant_override("margin_bottom", bottom if bottom >= 0 else (top if top >= 0 else left))
	m.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	m.add_child(child)
	return m


static func space(height: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size.y = height
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


static func spring() -> Control:
	var c := Control.new()
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


## A dashed line across.
static func seam() -> Control:
	return PaperSeam.new(STITCH)


# ---------------------------------------------------------------- buttons

## Kinds: "primary" (sage), "ghost" (paper), "danger", "chip" (small paper), "flat" (no edge), "link".
static func button(text: String, kind: String = "ghost", pressed: Callable = Callable(), icon_name: String = "", icon_size: int = 20) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	# A drag that starts on it still scrolls what it is in.
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.custom_minimum_size = Vector2(44.0, 44.0 if kind != "link" else 32.0)
	b.autowrap_mode = TextServer.AUTOWRAP_OFF
	b.clip_text = false
	dress(b, kind)
	if not icon_name.is_empty():
		b.icon = icon(icon_name, icon_size)
		if text.is_empty() and kind != "flat":
			b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


## What is being typed is taken before a press or a choice does anything, as the page's fields do.
static func _finish_typing(pressed: Control) -> void:
	var typed := pressed.get_viewport().gui_get_focus_owner() if pressed.is_inside_tree() else null
	if typed is LineEdit:
		typed.release_focus()


static var _looks: Dictionary = {}


static func _look(kind: String) -> Dictionary:
	if _looks.has(kind):
		return _looks[kind]
	var faces := {
		"primary": [SAGE, SAGE_DARK, LIGHT, SAGE_DARK], "ghost": [PAPER, LINE, INK, STAMP], "chip": [PAPER, LINE, INK, STAMP], "on": [ROSE, ROSE_DARK, INK, ROSE_DARK], "danger": [DANGER, DANGER_DARK, LIGHT, DANGER_DARK],
		"selling": [SAGE_SOFT, SAGE, SAGE_DARK, SAGE], "locked": [Color8(0xe8, 0xda, 0xbb), LINE, Color8(0x70, 0x53, 0x38), STAMP], "flat": [Color.TRANSPARENT, Color.TRANSPARENT, INK, Color.TRANSPARENT], "link": [Color.TRANSPARENT, Color.TRANSPARENT, SAGE_DARK, Color.TRANSPARENT],
	}
	var face: Array = faces[kind]
	var edge := 0.0 if kind in ["flat", "link"] else 2.0
	var pad := Vector2(12, 8) if kind != "chip" else Vector2(10, 6)
	if kind == "link":
		pad = Vector2(4, 4)
	_looks[kind] = {
		"normal": box(face[0], face[1], edge, 14, pad, face[3], 3.0 if edge > 0.0 else 0.0),
		"down": box(face[0], face[1], edge, 14, pad, face[3], 1.0 if edge > 0.0 else 0.0),
		"off": box(OFF_FACE if edge > 0.0 else Color.TRANSPARENT, OFF_LINE, edge, 14, pad),
		"ink": face[2],
	}
	return _looks[kind]


static func dress(b: Button, kind: String) -> void:
	if b.get_meta("kind", "") == kind:
		return
	b.set_meta("kind", kind)
	b.queue_redraw()
	var look := _look(kind)
	for state: String in ["normal", "hover", "focus"]:
		b.add_theme_stylebox_override(state, look["normal"])
	b.add_theme_stylebox_override("pressed", look["down"])
	b.add_theme_stylebox_override("hover_pressed", look["down"])
	b.add_theme_stylebox_override("disabled", look["off"])
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color", "icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_focus_color", "icon_hover_pressed_color"]:
		b.add_theme_color_override(tone, look["ink"])
	b.add_theme_color_override("font_disabled_color", OFF_TEXT)
	b.add_theme_color_override("icon_disabled_color", OFF_TEXT)
	b.add_theme_font_override("font", font(700))
	if not b.has_theme_font_size_override("font_size"):
		b.add_theme_font_size_override("font_size", 13)


## A button with an icon over its words.
static func tool(text: String, icon_name: String, pressed: Callable, kind: String = "ghost", icon_size: float = 24.0) -> PaperTool:
	var b := PaperTool.new(text, icon_name, icon_size)
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.custom_minimum_size = Vector2(44, 44)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dress(b, kind)
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


static func ink_of(b: Button) -> Color:
	return _look(b.get_meta("kind", "ghost"))["ink"]


## A row of choices of which one is on: entries are [value, words].
static func choices(entries: Array, chosen: Variant, picked: Callable, kind: String = "chip") -> HFlowContainer:
	var row := flow([], 6)
	for e: Array in entries:
		var b := button(e[1], "on" if e[0] == chosen else kind, picked.bind(e[0]))
		row.add_child(b)
	return row


## One button with words on the left and on the right; `set_priced` writes them.
static func priced(kind: String, pressed: Callable) -> Button:
	var b := button("", kind, pressed)
	var row := line([words("", "strong", false), spring(), words("", "strong", false)], 4)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 12)
	b.add_child(row)
	for l: Label in [row.get_child(0), row.get_child(2)]:
		l.add_theme_font_size_override("font_size", 13)
	row.get_child(0).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.get_child(0).clip_text = true
	row.get_child(1).visible = false
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return b


static func set_priced(b: Button, left: String, right: String, enabled: bool) -> void:
	var row := b.get_child(0)
	b.disabled = not enabled
	var tone: Color = (LIGHT if b.get_meta("kind", "") in ["primary", "danger"] else INK) if enabled else OFF_TEXT
	for e: Array in [[row.get_child(0), left], [row.get_child(2), right]]:
		e[0].text = e[1]
		e[0].add_theme_color_override("font_color", tone)


## Words that wrap only past `width`, so others can stand beside them.
static func fitting(text: String, kind: String, width: float) -> Label:
	var l := words(text, kind, false)
	if l.get_theme_font("font").get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, l.get_theme_font_size("font_size")).x > width:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size.x = width
	return l


# ---------------------------------------------------------------- pictures

## A line icon, as big as asked and sharp on a phone.
static func icon(name: String, size: int = 24) -> Texture2D:
	var key := "%s@%d" % [name, size]
	if not _icon_textures.has(key):
		var shape := "fill=\"#fff\"" if _SOLID.has(name) else "fill=\"none\" stroke=\"#fff\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\""
		var image := Image.new()
		image.load_svg_from_string("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"%s\" %s/></svg>" % [ICONS[name], shape], size * 3.0 / 24.0)
		var texture := ImageTexture.create_from_image(image)
		texture.set_size_override(Vector2i(size, size))
		_icon_textures[key] = texture
	return _icon_textures[key]


static func mark(name: String, size: float = 20.0, colour: Color = INK) -> TextureRect:
	var t := picture(icon(name, int(size)), size)
	t.modulate = colour
	return t


static func picture(texture: Texture2D, size: float) -> TextureRect:
	var t := TextureRect.new()
	t.texture = texture
	t.custom_minimum_size = Vector2(size, size)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


## A painted picture of the art by its key, or nothing in its place.
static func art(key: String, size: float) -> Control:
	var path := "res://art/full/%s.webp" % key
	if not ResourceLoader.exists(path):
		return space(size)
	return picture(load(path), size)


static func progress(share: float, height: float = 8.0) -> ProgressBar:
	var p := ProgressBar.new()
	p.max_value = 1.0
	p.step = 0.001
	p.value = share
	p.show_percentage = false
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.custom_minimum_size.y = height
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.add_theme_stylebox_override("background", box(Color8(0xea, 0xdc, 0xc4), Color.TRANSPARENT, 0, height / 2.0, Vector2.ZERO))
	p.add_theme_stylebox_override("fill", box(SAGE, Color.TRANSPARENT, 0, height / 2.0, Vector2.ZERO))
	return p


# ---------------------------------------------------------------- folding and scrolling

## A folding note: a bar of words that shows or hides what is under it. `turned` hears about it.
static func fold(title: String, content: Control, open: bool = false, turned: Callable = Callable()) -> VBoxContainer:
	var bar := card("sage")
	var sign := words("–" if open else "+", "good", false)
	sign.set_meta("mark", true)
	var name := words(title, "good")
	bar.add_child(line([sign, name]))
	bar.set_meta("fold", true)
	content.visible = open
	var out := col([bar, content], 6)
	out.set_meta("content", content)
	bar.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
			_finish_typing(bar)
			content.visible = not content.visible
			sign.text = "–" if content.visible else "+"
			if turned.is_valid():
				turned.call(content.visible))
	return out


## A box to tick, with words beside it.
static func check(text: String, on: bool, turned: Callable, enabled: bool = true) -> CheckBox:
	var c := CheckBox.new()
	c.text = text
	c.button_pressed = on
	c.disabled = not enabled
	c.focus_mode = Control.FOCUS_NONE
	c.mouse_filter = Control.MOUSE_FILTER_PASS
	c.custom_minimum_size = Vector2(44, 44)
	if not text.is_empty():
		c.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for state: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		c.add_theme_stylebox_override(state, box(Color.TRANSPARENT, Color.TRANSPARENT, 0, 8, Vector2(4, 4)))
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		c.add_theme_color_override(tone, INK)
	c.add_theme_color_override("font_disabled_color", OFF_TEXT)
	for state: String in ["checked", "checked_disabled", "unchecked", "unchecked_disabled"]:
		c.add_theme_icon_override(state, _tick(state.begins_with("checked"), state.ends_with("disabled")))
	c.toggled.connect(func(_on: bool) -> void: _finish_typing(c))
	if turned.is_valid():
		c.toggled.connect(turned)
	return c


static func _tick(on: bool, off: bool) -> Texture2D:
	var key := "tick-%s-%s" % [on, off]
	if not _icon_textures.has(key):
		var face := "#6c8c68" if on else "#fffaf0"
		var edge := "#526f4f" if on else "#7a5a44"
		if off:
			face = "#efe5d3"
			edge = "#b9a38a"
		var image := Image.new()
		image.load_svg_from_string("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"26\" height=\"26\" viewBox=\"0 0 26 26\"><rect x=\"2\" y=\"2\" width=\"22\" height=\"22\" rx=\"7\" fill=\"%s\" stroke=\"%s\" stroke-width=\"2\"/>%s</svg>" % [face, edge, "<path d=\"M7.5 13.5l4 4 7.5-8.5\" fill=\"none\" stroke=\"#fffaf0\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" if on else ""], 2.0)
		var texture := ImageTexture.create_from_image(image)
		texture.set_size_override(Vector2i(26, 26))
		_icon_textures[key] = texture
	return _icon_textures[key]


## A list to pick from: entries are [value, words].
static func select(entries: Array, chosen: Variant, picked: Callable, enabled: bool = true) -> OptionButton:
	var o := OptionButton.new()
	o.focus_mode = Control.FOCUS_NONE
	o.mouse_filter = Control.MOUSE_FILTER_PASS
	o.fit_to_longest_item = false
	o.custom_minimum_size = Vector2(110, 44)
	dress(o, "chip")
	for i in entries.size():
		o.add_item(entries[i][1])
		if entries[i][0] == chosen:
			o.select(i)
	o.disabled = not enabled
	o.item_selected.connect(func(i: int) -> void:
		_finish_typing(o)
		picked.call(entries[i][0]))
	return o


static func entry(text: String, holder: String, longest: int, changed: Callable = Callable(), enabled: bool = true) -> LineEdit:
	var e := LineEdit.new()
	e.text = text
	e.placeholder_text = holder
	e.max_length = longest
	e.editable = enabled
	e.custom_minimum_size.y = 46.0
	e.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	e.add_theme_stylebox_override("normal", box(LIGHT, LINE, 2, 14, Vector2(12, 8)))
	e.add_theme_stylebox_override("focus", box(Color.TRANSPARENT, SAGE, 2, 14, Vector2(12, 8)))
	e.add_theme_stylebox_override("read_only", box(OFF_FACE, OFF_LINE, 2, 14, Vector2(12, 8)))
	e.add_theme_color_override("font_color", INK)
	e.add_theme_color_override("font_placeholder_color", OFF_TEXT)
	e.add_theme_color_override("caret_color", INK)
	e.add_theme_font_size_override("font_size", 16)
	if changed.is_valid():
		e.text_changed.connect(changed)
	return e


## A button of several lines: [[words, kind], …], with a picture before them.
static func multi(lines: Array, pic: Control, pressed: Callable, kind: String = "ghost") -> Button:
	var copy := col([], 1)
	copy.alignment = BoxContainer.ALIGNMENT_CENTER
	for l: Array in lines:
		copy.add_child(words(l[0], l[1]))
	var row := line([copy] if pic == null else [pic, copy], 10)
	var pad := padded(row, 12, 8)
	for c: Control in [copy, row, pad]:
		c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var b := button("", kind, pressed)
	b.size_flags_vertical = Control.SIZE_FILL
	pad.set_anchors_preset(Control.PRESET_FULL_RECT)
	b.add_child(pad)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pad.minimum_size_changed.connect(func() -> void: b.custom_minimum_size.y = pad.get_combined_minimum_size().y)
	b.custom_minimum_size.y = maxf(44.0, pad.get_combined_minimum_size().y)
	return b


static func scroller(content: Control) -> ScrollContainer:
	var s := ScrollContainer.new()
	s.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	s.size_flags_vertical = Control.SIZE_EXPAND_FILL
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.scroll_deadzone = 8
	# What is being typed stays in sight.
	s.follow_focus = true
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.add_child(content)
	return s


static func clear(box_: Node) -> void:
	for child in box_.get_children():
		box_.remove_child(child)
		child.queue_free()


# ---------------------------------------------------------------- for tests

## What a screen says, in order: words, buttons as [words, enabled], boxes as "[x]", lists and entries as "<words>".
static func outline(of: Control) -> Array:
	var out := []
	if not of.visible or of.has_meta("mark"):
		return out
	if of is CheckBox:
		out.append("[x]" if of.button_pressed else "[ ]")
		if not of.text.is_empty():
			out.append(of.text)
		return out
	if of is OptionButton:
		return ["<%s>" % of.text]
	if of is LineEdit:
		return ["<%s>" % of.text]
	if of is Button:
		var said := PackedStringArray()
		if not of.text.is_empty():
			said.append(of.text)
		for child in of.get_children():
			if child is Control:
				for part: Variant in outline(child):
					said.append(part if part is String else part[0])
		out.append([" ".join(said), not of.disabled])
		return out
	if of is Label and not of.text.strip_edges().is_empty():
		out.append(of.text)
	elif of is RichTextLabel and not of.get_parsed_text().strip_edges().is_empty():
		out.append(of.get_parsed_text())
	for child in of.get_children():
		if child is Control:
			out.append_array(outline(child))
	return out
