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

# Direction A ("wood signs + notebook") shared palette
const WOOD_1 := Color8(0xb9, 0x83, 0x52)
const WOOD_2 := Color8(0x8d, 0x5c, 0x35)
const WOOD_3 := Color8(0x6e, 0x45, 0x27)
const WOOD_EDGE := Color8(0x6b, 0x44, 0x26)
const SHELF_1 := Color8(0xa8, 0x74, 0x4a)
const SHELF_2 := Color8(0x7d, 0x51, 0x32)
const CREAM_A := Color8(0xfb, 0xf1, 0xde)
const LINE_A := Color8(0xe4, 0xd3, 0xb8)
const INK_A := Color8(0x4a, 0x34, 0x26)
const INK_LIGHT := Color8(0x7a, 0x5f, 0x4c)
const SAGE_A := Color8(0x6d, 0x8f, 0x68)
const SAGE_A_DARK := Color8(0x56, 0x76, 0x4f)
const SAGE_A_TOP := Color8(0x86, 0xa9, 0x7f)
const SAGE_A_EDGE := Color8(0x3f, 0x5a, 0x3a)
const HONEY := Color8(0xe2, 0xb2, 0x57)
const ROSE_A := Color8(0xd9, 0x89, 0x7a)
const BLUSH := Color8(0xf2, 0xd2, 0xc8)
const NOTE_YELLOW := Color8(0xff, 0xf6, 0xc9)
const NOTE_INK := Color8(0x5b, 0x44, 0x30)
const PURSE_EDGE := Color8(0xc9, 0xa6, 0x79)
const STAMP_EDGE := Color8(0x7a, 0x52, 0x34)
const STAMP_LABEL := Color8(0xff, 0xf3, 0xdf)
const TAPE_COLOR := Color(240 / 255.0, 200 / 255.0, 150 / 255.0, 0.78)
const MORE_TINTS := {
	"reputation": Color8(0xfb, 0xe7, 0xb5),
	"partners": Color8(0xf3, 0xcf, 0xc4),
	"regulars": Color8(0xd9, 0xe6, 0xd2),
	"style": Color8(0xe3, 0xdb, 0xf0),
	"settings": Color8(0xef, 0xe6, 0xd8),
}
const BOOK_COVER := Color8(0x8a, 0x5a, 0x3b)
const CARD_BORDER := Color8(0xea, 0xd9, 0xbd)
const CARD_PRICE := Color8(0x3d, 0x6b, 0x3a)
const TRACK_A := Color8(0xef, 0xe3, 0xcf)
const BADGE_BG := Color8(0xfb, 0xea, 0xe5)
const BADGE_INK := Color8(0xb5, 0x57, 0x4a)
const LAVENDER_BG := Color8(0xf4, 0xee, 0xfa)
const LAVENDER_EDGE := Color8(0xdd, 0xd0, 0xef)
const LAVENDER_INK := Color8(0x6c, 0x55, 0x96)
const PEACH_BG := Color8(0xff, 0xf3, 0xe6)
const PEACH_EDGE := Color8(0xf0, 0xd2, 0xb6)
const PEACH_ORANGE := Color8(0xe9, 0xa7, 0x7f)
const PEACH_INK := Color8(0xb8, 0x61, 0x3f)
const SKY_BG := Color8(0xee, 0xf5, 0xfa)
const SKY_EDGE := Color8(0xc9, 0xdc, 0xe9)
const PLACED_BG := Color8(0xf7, 0xfb, 0xf3)
const PLACED_EDGE := Color8(0x9d, 0xb7, 0x95)
const PILL_BG := Color8(0xee, 0xf3, 0xe8)
const LV_PILL_BG := Color8(0xf3, 0xea, 0xdb)
const SEAM_A := Color8(0xe2, 0xcf, 0xb2)
const TAB_COLORS := {
	"menu": Color8(0xf0, 0xb9, 0xab),
	"pantry": Color8(0xf3, 0xd3, 0x8f),
	"upgrades": Color8(0xbc, 0xd3, 0xb3),
	"decor": Color8(0xcf, 0xc2, 0xe3),
	"pets": Color8(0xf3, 0xc7, 0xa8),
	"promotion": Color8(0xbc, 0xd3, 0xe3),
}
const CHALK_INK := Color8(0xf3, 0xef, 0xe2)
const CHALK_MUTED := Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.76)
const CHALK_GOOD := Color8(0xbf, 0xe0, 0xb0)
const CHALK_GOOD_INK := Color8(0xd8, 0xf0, 0xcc)
const CHALK_WARN := Color8(0xff, 0xd3, 0xa8)
const CHALK_LOW_EDGE := Color8(0xe8, 0x7a, 0x5d)
const CHALK_LOW_BG := Color(232 / 255.0, 122 / 255.0, 93 / 255.0, 0.16)
const CHALK_TILE := Color(1.0, 1.0, 1.0, 0.07)
const CHALK_PILL := Color(1.0, 1.0, 1.0, 0.09)
const CHALK_HR := Color(1.0, 1.0, 1.0, 0.25)
const STICKY_YELLOW := Color8(0xff, 0xf1, 0xa6)
const GO_TOP := Color8(0xf4, 0xc7, 0x66)
const GO_BOT := Color8(0xe0, 0xa4, 0x3c)
const GO_LIP := Color8(0xa8, 0x74, 0x20)
const GO_INK := Color8(0x4a, 0x2e, 0x12)

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
	"bell": "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0M12 3v2",
	"sun": "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5",
	"rain": "M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7zM8 18l-1 2M12 18l-1 2M16 18l-1 2",
	"cloud": "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z",
	"leaf": "M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19 13 11",
	"bag": "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
	"brush": "M14 4l6 6-8 8H6v-6zM11 7l6 6",
	"gear": "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
	"heart": "M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2c0 4.8-7 9.2-7 9.2z",
	"heartfill": "M12 19.5s-7.5-4.7-7.5-9.7A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 7.5 2.6c0 5-7.5 9.7-7.5 9.7z",
	"check": "M5 12.5 10 17l9-10",
	"lock": "M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6 11h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 6 11z",
	"ground": "M3.5 19.5h17M7.5 19.5V11h9v8.5M6 11h12",
	"wallframe": "M5 6.5h14v12H5zM9 6.5 12 3.5l3 3M8.5 14l2.5-2.8 2.2 2.2 1.8-1.8 1.5 2.4",
	"trophy": "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6",
}
const _SOLID: Array[String] = ["more", "heartfill"]
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


# ---------------------------------------------------------------- Direction A building blocks

## Wooden plank with grain, lip and shadow; `ropes` hangs it from above, `shelf` flattens the bottom edge.
static func plank(pad: Vector2 = Vector2(14, 9), radius: float = 12.0, ropes: bool = false, shelf: bool = false) -> PaperPlank:
	var p := PaperPlank.new(pad, radius, ropes, shelf)
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	return p


## Circular stamp button for the wooden shelf, floating side control, or colored More-menu entry.
static func stamp(text: String, icon_name: String, pressed: Callable = Callable(), opts: Dictionary = {}) -> PaperStamp:
	var s := PaperStamp.new(text, icon_name, opts)
	s.pressed.connect(_finish_typing.bind(s))
	if pressed.is_valid():
		s.pressed.connect(pressed)
	return s


## Colored circular stamp inside a paper card (e.g. More popover).
static func more_stamp(text: String, icon_name: String, tint: Color, pressed: Callable, unread: int = 0) -> PaperStamp:
	var s := stamp(text, icon_name, pressed, {
		"disc": 52.0, "fill": tint, "active_fill": tint.darkened(0.08),
		"border": Color(74 / 255.0, 52 / 255.0, 38 / 255.0, 0.25),
		"lip": Color(74 / 255.0, 52 / 255.0, 38 / 255.0, 0.2),
		"drop": 2.0, "label_color": INK_A, "label_shadow": false, "label_wrap": true,
		"font_size": 11 if text.length() > 6 else 12,
	})
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.set_badge(unread, false)
	return s


## Center arched green main action button on the wooden shelf.
static func bell(text: String, icon_name: String = "bell", pressed: Callable = Callable()) -> PaperBell:
	var b := PaperBell.new(text, icon_name)
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


## Pale yellow pinned note with red pushpin and gentle tilt.
static func pinned_note() -> PaperPinnedNote:
	return PaperPinnedNote.new()


## Paper card with a masking-tape strip at top-left and optional bottom-right pointer tail.
static func taped_card(pointer_from_right: float = 0.0, pad: Vector2 = Vector2(14, 14)) -> PaperTapedCard:
	return PaperTapedCard.new(pointer_from_right, pad)


## Coin purse frame: cream paper, honey-tan border + 3px lip, soft ambient shadow.
static func purse_box() -> StyleBoxFlat:
	var key := "purse_a"
	if not _row_boxes.has(key):
		var b := StyleBoxFlat.new()
		b.bg_color = LIGHT
		b.border_color = PURSE_EDGE
		b.border_width_left = 2
		b.border_width_top = 2
		b.border_width_right = 2
		b.border_width_bottom = 5
		b.set_corner_radius_all(14)
		b.corner_detail = 6
		b.content_margin_left = 10.0
		b.content_margin_right = 13.0
		b.content_margin_top = 7.0
		b.content_margin_bottom = 7.0
		b.shadow_color = Color(60 / 255.0, 30 / 255.0, 10 / 255.0, 0.25)
		b.shadow_size = 6
		b.shadow_offset = Vector2(0.0, 4.0)
		_row_boxes[key] = b
	return _row_boxes[key]


## Compact paper strip (tap hint, story notice).
static func strip_box(pad: Vector2 = Vector2(14, 7)) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = LIGHT
	b.border_color = LINE_A
	b.set_border_width_all(2)
	b.set_corner_radius_all(12)
	b.corner_detail = 6
	b.content_margin_left = pad.x
	b.content_margin_right = pad.x
	b.content_margin_top = pad.y
	b.content_margin_bottom = pad.y
	b.shadow_color = Color(60 / 255.0, 30 / 255.0, 10 / 255.0, 0.2)
	b.shadow_size = 4
	b.shadow_offset = Vector2(0.0, 3.0)
	return b


## Gold coin circle with radial sheen and embossed `$`, cached as an SVG texture.
static func coin_badge(size: float = 24.0) -> TextureRect:
	var key := "coin-badge@%d" % int(size)
	if not _icon_textures.has(key):
		var svg := "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><defs><radialGradient id=\"g\" cx=\"35%\" cy=\"30%\" r=\"70%\"><stop offset=\"0%\" stop-color=\"#ffe9a3\"/><stop offset=\"55%\" stop-color=\"#e9b23f\"/><stop offset=\"100%\" stop-color=\"#b77f1d\"/></radialGradient></defs><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"url(#g)\" stroke=\"#a26d16\" stroke-width=\"1.6\"/><path d=\"M12 6.2v11.6M14.6 9.3c-.6-.9-1.5-1.4-2.7-1.4-1.4 0-2.5.8-2.5 2 0 2.5 5.2 1.4 5.2 4.1 0 1.2-1.1 2-2.7 2-1.2 0-2.3-.5-2.9-1.4\" fill=\"none\" stroke=\"#8a5a10\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"
		var image := Image.new()
		image.load_svg_from_string(svg, size * 3.0 / 24.0)
		var tex := ImageTexture.create_from_image(image)
		tex.set_size_override(Vector2i(int(size), int(size)))
		_icon_textures[key] = tex
	return picture(_icon_textures[key], size)


## Direction A card box: white card, 1.5px warm border + 2px bottom lip, 14px radius.
static func card_a_box(border: Color = CARD_BORDER, fill: Color = Color.WHITE, pad: Vector2 = Vector2(8, 8)) -> StyleBoxFlat:
	var key := "card_a_%s_%s_%d_%d" % [border.to_html(), fill.to_html(), int(pad.x), int(pad.y)]
	if not _row_boxes.has(key):
		var b := StyleBoxFlat.new()
		b.bg_color = fill
		b.border_color = border
		b.border_width_left = 2
		b.border_width_top = 2
		b.border_width_right = 2
		b.border_width_bottom = 4
		b.set_corner_radius_all(14)
		b.corner_detail = 6
		b.content_margin_left = pad.x
		b.content_margin_right = pad.x
		b.content_margin_top = pad.y
		b.content_margin_bottom = pad.y
		_row_boxes[key] = b
	return _row_boxes[key]


## Direction A bookmark tab StyleBox (top rounded, flat bottom).
static func bookmark_box(color: Color, active: bool) -> StyleBoxFlat:
	var key := "bm_%s_%s" % [color.to_html(), active]
	if not _row_boxes.has(key):
		var b := StyleBoxFlat.new()
		b.bg_color = color
		b.corner_radius_top_left = 10
		b.corner_radius_top_right = 10
		b.corner_radius_bottom_left = 0
		b.corner_radius_bottom_right = 0
		b.corner_detail = 6
		b.content_margin_left = 2.0
		b.content_margin_right = 2.0
		b.content_margin_top = 5.0
		b.content_margin_bottom = 3.0
		if active:
			b.shadow_color = Color(0.0, 0.0, 0.0, 0.14)
			b.shadow_size = 4
			b.shadow_offset = Vector2(0.0, -2.0)
		else:
			b.border_width_bottom = 3
			b.border_color = Color(0.0, 0.0, 0.0, 0.08)
		_row_boxes[key] = b
	return _row_boxes[key]


## Direction A circular close button (34x34, cream fill, brown rim).
static func circle_close(pressed: Callable) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.custom_minimum_size = Vector2(34.0, 34.0)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.icon = icon("close", 17)
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var normal := box(LIGHT, BOOK_COVER, 2, 17, Vector2.ZERO, Color(0.0, 0.0, 0.0, 0.2), 2.0)
	var down := box(CREAM_A, BOOK_COVER, 2, 17, Vector2.ZERO, Color(0.0, 0.0, 0.0, 0.14), 1.0)
	for st: String in ["normal", "hover", "focus"]:
		b.add_theme_stylebox_override(st, normal)
	b.add_theme_stylebox_override("pressed", down)
	b.add_theme_stylebox_override("hover_pressed", down)
	for tone: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_focus_color", "icon_hover_pressed_color"]:
		b.add_theme_color_override(tone, INK_A)
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


## Direction A rounded filter chip.
static func style_filter_chip(b: Button, active: bool) -> void:
	var key := "fchip_%s" % active
	if not _row_boxes.has(key):
		var fill := BLUSH if active else Color.WHITE
		var edge := Color8(0xd9, 0xa5, 0x96) if active else LINE_A
		var sb := box(fill, edge, 2, 14, Vector2(9, 4))
		_row_boxes[key] = sb
	for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, _row_boxes[key])
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(tone, INK_A)
	b.add_theme_font_override("font", font(700))
	b.add_theme_font_size_override("font_size", 12)
	b.custom_minimum_size = Vector2(0.0, 30.0)


## Direction A segmented pill button (`pos`: -1 left, 0 mid, 1 right).
static func style_seg_btn(b: Button, active: bool, pos: int) -> void:
	var key := "seg_%s_%d" % [active, pos]
	if not _row_boxes.has(key):
		var sb := StyleBoxFlat.new()
		sb.bg_color = BLUSH if active else Color.WHITE
		sb.border_color = LINE_A
		sb.border_width_top = 2
		sb.border_width_bottom = 2
		sb.border_width_left = 2 if pos == -1 else 1
		sb.border_width_right = 2 if pos == 1 else 0
		sb.corner_radius_top_left = 11 if pos == -1 else 0
		sb.corner_radius_bottom_left = 11 if pos == -1 else 0
		sb.corner_radius_top_right = 11 if pos == 1 else 0
		sb.corner_radius_bottom_right = 11 if pos == 1 else 0
		sb.corner_detail = 6
		sb.content_margin_left = 7.0
		sb.content_margin_right = 7.0
		sb.content_margin_top = 4.0
		sb.content_margin_bottom = 4.0
		_row_boxes[key] = sb
	for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, _row_boxes[key])
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(tone, INK_A)
	b.add_theme_font_override("font", font(800))
	b.add_theme_font_size_override("font_size", 11)
	b.custom_minimum_size = Vector2(0.0, 30.0)


## Compact Direction A buy/upgrade pill button inside 2-column cards: label + coin + cost.
static func card_buy(pressed: Callable) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.custom_minimum_size = Vector2(0.0, 32.0)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if not _row_boxes.has("card_buy_on"):
		var on := StyleBoxFlat.new()
		on.bg_color = SAGE_A
		on.border_color = SAGE_A_DARK
		on.border_width_bottom = 2
		on.set_corner_radius_all(10)
		on.corner_detail = 6
		_row_boxes["card_buy_on"] = on
		var down := StyleBoxFlat.new()
		down.bg_color = SAGE_A_DARK
		down.set_corner_radius_all(10)
		down.corner_detail = 6
		_row_boxes["card_buy_down"] = down
		var off := StyleBoxFlat.new()
		off.bg_color = OFF_FACE
		off.border_color = Color8(0xc9, 0xba, 0xa4)
		off.set_border_width_all(1)
		off.set_corner_radius_all(10)
		off.corner_detail = 6
		_row_boxes["card_buy_off"] = off
	for st: String in ["normal", "hover", "focus"]:
		b.add_theme_stylebox_override(st, _row_boxes["card_buy_on"])
	b.add_theme_stylebox_override("pressed", _row_boxes["card_buy_down"])
	b.add_theme_stylebox_override("hover_pressed", _row_boxes["card_buy_down"])
	b.add_theme_stylebox_override("disabled", _row_boxes["card_buy_off"])
	var left := words("", "strong", false)
	var coin := coin_badge(14.0)
	var right := words("", "strong", false)
	for l: Label in [left, right]:
		l.add_theme_font_override("font", font(800))
		l.add_theme_font_size_override("font_size", 11)
	var row := line([left, coin, right], 3)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 4)
	b.add_child(row)
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


static func set_card_buy(b: Button, left: String, right: String, enabled: bool) -> void:
	var row: HBoxContainer = b.get_child(0)
	b.disabled = not enabled
	var tone: Color = Color.WHITE if enabled else OFF_TEXT
	var l_lbl: Label = row.get_child(0)
	var coin: TextureRect = row.get_child(1)
	var r_lbl: Label = row.get_child(2)
	if l_lbl.text != left:
		l_lbl.text = left
	if r_lbl.text != right:
		r_lbl.text = right
	l_lbl.add_theme_color_override("font_color", tone)
	r_lbl.add_theme_color_override("font_color", tone)
	coin.modulate.a = 1.0 if enabled else 0.65


## Cached flat box for pills, badges, and progress tracks.
static func cached_box(face: Color, line: Color = Color.TRANSPARENT, width: float = 0.0, radius: float = 8.0, pad: Vector2 = Vector2.ZERO) -> StyleBoxFlat:
	var key := "cb_%s_%s_%d_%d_%d_%d" % [face.to_html(), line.to_html(), int(width), int(radius), int(pad.x), int(pad.y)]
	if not _row_boxes.has(key):
		_row_boxes[key] = box(face, line, width, radius, pad)
	return _row_boxes[key]


## Progress bar with customizable fill & track colors for Direction A cards (uses cached StyleBoxes).
static func progress_a(share: float, height: float = 5.0, fill_color: Color = HONEY, track_color: Color = TRACK_A) -> ProgressBar:
	var p := ProgressBar.new()
	p.max_value = 1.0
	p.step = 0.001
	p.value = share
	p.show_percentage = false
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.custom_minimum_size.y = height
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var r := height * 0.5
	p.add_theme_stylebox_override("background", cached_box(track_color, Color.TRANSPARENT, 0, r, Vector2.ZERO))
	p.add_theme_stylebox_override("fill", cached_box(fill_color, Color.TRANSPARENT, 0, r, Vector2.ZERO))
	return p


## Direction A tinted filter chip (`active_fill` / `active_edge` customize tab accent).
static func style_filter_chip_tinted(b: Button, active: bool, active_fill: Color = BLUSH, active_edge: Color = Color8(0xd9, 0xa5, 0x96)) -> void:
	var fill := active_fill if active else Color.WHITE
	var edge := active_edge if active else LINE_A
	var sb := cached_box(fill, edge, 2, 14, Vector2(8, 4))
	for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, sb)
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(tone, INK_A)
	b.add_theme_font_override("font", font(700))
	b.add_theme_font_size_override("font_size", 11)
	b.custom_minimum_size = Vector2(0.0, 28.0)


## Direction A section heading: bold title + optional inline hint + dashed seam + optional right text.
static func section_head(title_text: String, hint_lbl: Label = null, right_lbl: Label = null) -> HBoxContainer:
	var title := words(title_text, "strong", false)
	title.add_theme_font_override("font", font(800))
	title.add_theme_font_size_override("font_size", 13)
	title.add_theme_color_override("font_color", INK_A)
	var head := line([title], 6)
	head.alignment = BoxContainer.ALIGNMENT_CENTER
	if hint_lbl != null:
		head.add_child(hint_lbl)
	var seam_line := PaperSeam.new(SEAM_A)
	seam_line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	seam_line.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(seam_line)
	if right_lbl != null:
		head.add_child(right_lbl)
	return head


## Direction A help disclosure styled like Pantry's notes fold.
static func help_fold(title: String, content: Control, open: bool = false, turned: Callable = Callable()) -> VBoxContainer:
	var out := fold(title, content, open, turned)
	var bar: PanelContainer = out.get_child(0)
	bar.add_theme_stylebox_override("panel", cached_box(CREAM_A, Color.TRANSPARENT, 0, 10, Vector2(10, 5)))
	var hbox: HBoxContainer = bar.get_child(0)
	for child in hbox.get_children():
		if child is Label:
			child.add_theme_color_override("font_color", INK_LIGHT)
			child.add_theme_font_size_override("font_size", 12)
	return out


## Direction A 2-line sage purchase button (top action label + bottom gold coin & price).
static func two_line_buy(pressed: Callable, width: float = 76.0) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.custom_minimum_size = Vector2(width, 44.0)
	b.size_flags_horizontal = Control.SIZE_SHRINK_END
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if not _row_boxes.has("card_buy_on"):
		var on := StyleBoxFlat.new()
		on.bg_color = SAGE_A
		on.border_color = SAGE_A_DARK
		on.border_width_bottom = 2
		on.set_corner_radius_all(10)
		on.corner_detail = 6
		_row_boxes["card_buy_on"] = on
		var down := StyleBoxFlat.new()
		down.bg_color = SAGE_A_DARK
		down.set_corner_radius_all(10)
		down.corner_detail = 6
		_row_boxes["card_buy_down"] = down
		var off := StyleBoxFlat.new()
		off.bg_color = OFF_FACE
		off.border_color = Color8(0xc9, 0xba, 0xa4)
		off.set_border_width_all(1)
		off.set_corner_radius_all(10)
		off.corner_detail = 6
		_row_boxes["card_buy_off"] = off
	for st: String in ["normal", "hover", "focus"]:
		b.add_theme_stylebox_override(st, _row_boxes["card_buy_on"])
	b.add_theme_stylebox_override("pressed", _row_boxes["card_buy_down"])
	b.add_theme_stylebox_override("hover_pressed", _row_boxes["card_buy_down"])
	b.add_theme_stylebox_override("disabled", _row_boxes["card_buy_off"])
	var top := words("", "strong", false)
	top.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top.add_theme_font_override("font", font(800))
	top.add_theme_font_size_override("font_size", 11)
	var coin := coin_badge(13.0)
	var cost := words("", "strong", false)
	cost.add_theme_font_override("font", font(800))
	cost.add_theme_font_size_override("font_size", 11)
	var price_row := line([coin, cost], 3)
	price_row.alignment = BoxContainer.ALIGNMENT_CENTER
	price_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var stack := col([top, price_row], 2)
	stack.alignment = BoxContainer.ALIGNMENT_CENTER
	stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stack.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 3)
	b.add_child(stack)
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


static func set_two_line_buy(b: Button, top_text: String, cost_text: String, enabled: bool) -> void:
	b.disabled = not enabled
	var stack: VBoxContainer = b.get_child(0)
	var top: Label = stack.get_child(0)
	var price_row: HBoxContainer = stack.get_child(1)
	var coin: TextureRect = price_row.get_child(0)
	var cost: Label = price_row.get_child(1)
	var tone: Color = Color.WHITE if enabled else OFF_TEXT
	if top.text != top_text:
		top.text = top_text
	if cost.text != cost_text:
		cost.text = cost_text
	top.add_theme_color_override("font_color", tone)
	cost.add_theme_color_override("font_color", tone)
	coin.modulate.a = 1.0 if enabled else 0.65


## Compact single-line button with optional gold coin badge (used in 3-col Decor tiles).
static func coin_action_btn(pressed: Callable, height: float = 28.0) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.custom_minimum_size = Vector2(0.0, height)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var coin := coin_badge(12.0)
	var lbl := words("", "strong", false)
	lbl.add_theme_font_override("font", font(800))
	lbl.add_theme_font_size_override("font_size", 10)
	lbl.clip_text = false
	var row := line([coin, lbl], 3)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 3)
	b.add_child(row)
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


static func set_coin_action(b: Button, text: String, show_coin: bool, enabled: bool, ghost: bool = false) -> void:
	b.disabled = not enabled
	var style_key := "off" if not enabled else ("ghost" if ghost else "primary")
	if b.get_meta("_ca_style", "") != style_key:
		b.set_meta("_ca_style", style_key)
		if style_key == "primary":
			if not _row_boxes.has("ca_primary_on"):
				var on := box(SAGE_A, SAGE_A_DARK, 0, 8, Vector2(3, 3))
				on.border_width_bottom = 2
				_row_boxes["ca_primary_on"] = on
				_row_boxes["ca_primary_down"] = box(SAGE_A_DARK, Color.TRANSPARENT, 0, 8, Vector2(3, 3))
			for st: String in ["normal", "hover", "focus"]:
				b.add_theme_stylebox_override(st, _row_boxes["ca_primary_on"])
			b.add_theme_stylebox_override("pressed", _row_boxes["ca_primary_down"])
			b.add_theme_stylebox_override("hover_pressed", _row_boxes["ca_primary_down"])
		elif style_key == "ghost":
			var gh := cached_box(CREAM_A, Color8(0xd4, 0xc1, 0xa3), 1, 8, Vector2(3, 3))
			for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
				b.add_theme_stylebox_override(st, gh)
		var off := cached_box(OFF_FACE, Color8(0xc9, 0xba, 0xa4), 1, 8, Vector2(3, 3))
		b.add_theme_stylebox_override("disabled", off)
	var row: HBoxContainer = b.get_child(0)
	var coin: TextureRect = row.get_child(0)
	var lbl: Label = row.get_child(1)
	coin.visible = show_coin
	coin.modulate.a = 1.0 if enabled else 0.65
	if lbl.text != text:
		lbl.text = text
	lbl.add_theme_color_override("font_color", OFF_TEXT if not enabled else (INK_A if ghost else Color.WHITE))


## Full-width wooden plank button (sticky Decor arrange button). Real Button for accessibility/parity.
static func wood_button(text: String, icon_name: String, pressed: Callable) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(0.0, 44.0)
	var empty := StyleBoxEmpty.new()
	for st: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		b.add_theme_stylebox_override(st, empty)
	var pl := plank(Vector2(14, 9), 13.0, false, false)
	pl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pl.set_anchors_preset(Control.PRESET_FULL_RECT)
	var lbl := words(text, "strong", false)
	lbl.add_theme_font_override("font", font(800))
	lbl.add_theme_font_size_override("font_size", 14)
	lbl.add_theme_color_override("font_color", STAMP_LABEL)
	var row := line([mark(icon_name, 18.0, STAMP_LABEL), lbl], 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pl.add_child(row)
	b.add_child(pl)
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


## Small horizontal rounded pips showing level progress for upgrades with max <= 6.
class PipsBar extends Control:
	var total := 0
	var filled := 0

	func _init(max_count: int = 3) -> void:
		total = max_count
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		custom_minimum_size = Vector2(0.0, 7.0)
		size_flags_horizontal = Control.SIZE_EXPAND_FILL

	func set_progress(cur: int, max_count: int) -> void:
		if cur != filled or max_count != total:
			filled = cur
			total = max_count
			queue_redraw()

	func _draw() -> void:
		if total <= 0:
			return
		var gap := 3.0
		var pip_w := minf(14.0, maxf(6.0, (size.x - gap * float(total - 1)) / float(total)))
		var pip_h := 5.0
		var y := (size.y - pip_h) * 0.5
		for i in total:
			var rect := Rect2(float(i) * (pip_w + gap), y, pip_w, pip_h)
			var col := Paper.SAGE_A if i < filled else Color8(0xe8, 0xdb, 0xc5)
			var sb := Paper.cached_box(col, Color.TRANSPARENT, 0, 2.5, Vector2.ZERO)
			sb.draw(get_canvas_item(), rect)


## Red-brown tilted "Maxed" stamp shown in place of the buy button when an upgrade is maxed.
class MaxStamp extends Control:
	var _lbl: Label

	func _init(text: String) -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		custom_minimum_size = Vector2(76.0, 44.0)
		_lbl = Paper.words(text, "strong", false)
		_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		_lbl.add_theme_font_override("font", Paper.font(800))
		_lbl.add_theme_font_size_override("font_size", 11)
		_lbl.add_theme_color_override("font_color", Paper.BADGE_INK)
		_lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
		add_child(_lbl)

	func _draw() -> void:
		var center := size * 0.5
		draw_set_transform(center, deg_to_rad(-5.0))
		var box_w := minf(size.x - 4.0, 68.0)
		var box_h := 26.0
		var sb := Paper.cached_box(Color.TRANSPARENT, Paper.BADGE_INK, 2, 8, Vector2.ZERO)
		sb.draw(get_canvas_item(), Rect2(-box_w * 0.5, -box_h * 0.5, box_w, box_h))
		draw_set_transform(Vector2.ZERO, 0.0)


## Dashed circular empty cat slot in the Cats summary card.
class EmptyPaw extends Control:
	func _init(diameter: float = 36.0) -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		custom_minimum_size = Vector2(diameter, diameter)
		size_flags_vertical = Control.SIZE_SHRINK_CENTER

	func _draw() -> void:
		var center := size * 0.5
		var r := minf(size.x, size.y) * 0.5 - 1.5
		draw_circle(center, r, Color.WHITE)
		var segs := 14
		var step := TAU / float(segs)
		for i in segs:
			draw_arc(center, r, float(i) * step, (float(i) + 0.55) * step, 4, Color8(0xdf, 0xb8, 0x92), 2.0, true)


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


## A chalk dashed line across the chalkboard.
static func chalk_seam() -> Control:
	return PaperSeam.new(CHALK_HR)


## Chalk-styled label for the preparation chalkboard.
static func chalk_words(text: String, kind: String = "", wrap: bool = true) -> Label:
	var l := Label.new()
	l.text = text
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var looks := {
		"": [13, 500, CHALK_INK],
		"muted": [12, 500, CHALK_MUTED],
		"small": [11, 500, CHALK_MUTED],
		"h2": [21, 800, CHALK_INK],
		"h3": [14, 800, CHALK_INK],
		"good": [12, 600, CHALK_GOOD],
		"warn": [12, 600, CHALK_WARN],
		"strong": [13, 700, CHALK_INK],
		"tiny": [10, 700, CHALK_WARN],
	}
	var look: Array = looks[kind]
	l.add_theme_font_size_override("font_size", look[0])
	l.add_theme_font_override("font", font(look[1]))
	l.add_theme_color_override("font_color", look[2])
	return l


## Chalk-styled fold bar for disclosures inside the chalkboard.
static func chalk_fold(title: String, content: Control, open: bool = false, turned: Callable = Callable()) -> VBoxContainer:
	var out := fold(title, content, open, turned)
	var bar: PanelContainer = out.get_child(0)
	bar.add_theme_stylebox_override("panel", cached_box(Color(1.0, 1.0, 1.0, 0.08), Color(1.0, 1.0, 1.0, 0.22), 1, 10, Vector2(10, 5)))
	var hbox: HBoxContainer = bar.get_child(0)
	for child in hbox.get_children():
		if child is Label:
			child.add_theme_color_override("font_color", CHALK_INK)
			child.add_theme_font_size_override("font_size", 12)
	return out


## Circular chalk-drawn checkmark box for chalkboard dish tiles.
static func chalk_check(on: bool, turned: Callable, enabled: bool = true, diameter: int = 20) -> CheckBox:
	var c := CheckBox.new()
	c.text = ""
	c.button_pressed = on
	c.disabled = not enabled
	c.focus_mode = Control.FOCUS_NONE
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.custom_minimum_size = Vector2(float(diameter), float(diameter))
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var empty := StyleBoxEmpty.new()
	for st: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		c.add_theme_stylebox_override(st, empty)
	for st: String in ["checked", "checked_disabled", "unchecked", "unchecked_disabled"]:
		c.add_theme_icon_override(st, _chalk_tick(st.begins_with("checked"), st.ends_with("disabled"), diameter))
	c.toggled.connect(func(_on: bool) -> void: _finish_typing(c))
	if turned.is_valid():
		c.toggled.connect(turned)
	return c


static func _chalk_tick(on: bool, off: bool, diameter: int) -> Texture2D:
	var key := "ctick-%s-%s-%d" % [on, off, diameter]
	if not _icon_textures.has(key):
		var opacity := "0.42" if off else ("1.0" if on else "0.72")
		var dash := "" if on else " stroke-dasharray=\"3.4 2.4\""
		var check := "<path d=\"M6.5 11.3l3.2 3.3 5.8-6.6\" fill=\"none\" stroke=\"#f3efe2\" stroke-opacity=\"%s\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" % opacity if on else ""
		var svg := "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"22\" height=\"22\" viewBox=\"0 0 22 22\"><circle cx=\"11\" cy=\"11\" r=\"9\" fill=\"none\" stroke=\"#f3efe2\" stroke-opacity=\"%s\" stroke-width=\"2\"%s/>%s</svg>" % [opacity, dash, check]
		var image := Image.new()
		image.load_svg_from_string(svg, float(diameter) * 3.0 / 22.0)
		var tex := ImageTexture.create_from_image(image)
		tex.set_size_override(Vector2i(diameter, diameter))
		_icon_textures[key] = tex
	return _icon_textures[key]


## Chalk-styled buttons for controls living on the dark chalkboard.
## Kinds: "chalk" (subtle translucent chip), "chalk_outline" (direct-open secondary), "chalk_link" (text-only "later"), "chalk_chip" (compact ±5).
static func chalk_button(text: String, kind: String = "chalk", pressed: Callable = Callable()) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.autowrap_mode = TextServer.AUTOWRAP_OFF if kind in ["chalk_link", "chalk_chip"] else TextServer.AUTOWRAP_WORD_SMART
	b.clip_text = false
	var pad := Vector2(12, 6)
	var min_h := 34.0
	var fs := 12
	var normal: StyleBox
	var down: StyleBox
	var off: StyleBox
	var ink := CHALK_INK
	match kind:
		"chalk_link":
			pad = Vector2(12, 2)
			# Looks like a line of text, but takes a whole fingertip.
			min_h = 40.0
			fs = 13
			ink = CHALK_MUTED
			normal = StyleBoxEmpty.new()
			normal.content_margin_left = pad.x
			normal.content_margin_right = pad.x
			normal.content_margin_top = pad.y
			normal.content_margin_bottom = pad.y
			down = cached_box(Color(1.0, 1.0, 1.0, 0.08), Color.TRANSPARENT, 0, 8, pad)
			off = normal
		"chalk_chip":
			pad = Vector2(10, 4)
			min_h = 34.0
			fs = 13
			normal = cached_box(Color(1.0, 1.0, 1.0, 0.12), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.36), 1.5, 9, pad)
			down = cached_box(Color(1.0, 1.0, 1.0, 0.22), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.5), 1.5, 9, pad)
			off = cached_box(Color(1.0, 1.0, 1.0, 0.05), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.18), 1, 9, pad)
		"chalk_outline":
			pad = Vector2(12, 4)
			min_h = 30.0
			fs = 13
			normal = cached_box(Color(1.0, 1.0, 1.0, 0.08), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.34), 1.5, 11, pad)
			down = cached_box(Color(1.0, 1.0, 1.0, 0.16), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.5), 1.5, 11, pad)
			off = cached_box(Color(1.0, 1.0, 1.0, 0.04), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.18), 1, 11, pad)
		_:
			normal = cached_box(Color(1.0, 1.0, 1.0, 0.11), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.32), 1.5, 10, pad)
			down = cached_box(Color(1.0, 1.0, 1.0, 0.2), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.45), 1.5, 10, pad)
			off = cached_box(Color(1.0, 1.0, 1.0, 0.05), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.18), 1, 10, pad)
	b.custom_minimum_size = Vector2(40.0 if kind == "chalk_chip" else 0.0, min_h)
	for st: String in ["normal", "hover", "focus"]:
		b.add_theme_stylebox_override(st, normal)
	b.add_theme_stylebox_override("pressed", down)
	b.add_theme_stylebox_override("hover_pressed", down)
	b.add_theme_stylebox_override("disabled", off)
	for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(tone, ink)
	b.add_theme_color_override("font_disabled_color", Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.42))
	b.add_theme_font_override("font", font(700))
	b.add_theme_font_size_override("font_size", fs)
	b.pressed.connect(_finish_typing.bind(b))
	if pressed.is_valid():
		b.pressed.connect(pressed)
	return b


## Restyles a sub-panel built for paper (StyleDialog, WishCard, TrialCards) so it reads cleanly on the dark chalkboard.
static func chalk_retheme(node: Control) -> void:
	if node is Label:
		var l := node as Label
		var col := l.get_theme_color("font_color")
		if col == DANGER:
			l.add_theme_color_override("font_color", CHALK_WARN)
		elif col == SAGE_DARK:
			l.add_theme_color_override("font_color", CHALK_GOOD)
		elif col == MUTED:
			l.add_theme_color_override("font_color", CHALK_MUTED)
		else:
			l.add_theme_color_override("font_color", CHALK_INK)
	elif node is OptionButton:
		var o := node as OptionButton
		var sb := cached_box(Color(0.0, 0.0, 0.0, 0.26), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.42), 1.5, 10, Vector2(10, 6))
		for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
			o.add_theme_stylebox_override(st, sb)
		for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
			o.add_theme_color_override(tone, CHALK_INK)
		o.add_theme_color_override("font_disabled_color", Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.42))
	elif node is Button:
		var b := node as Button
		var on_style: bool = b.get_meta("kind", "") == "on"
		var bg := Color(191 / 255.0, 224 / 255.0, 176 / 255.0, 0.22) if on_style else Color(1.0, 1.0, 1.0, 0.11)
		var edge := CHALK_GOOD if on_style else Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.32)
		var sb := cached_box(bg, edge, 1.5, 10, Vector2(10, 6))
		var off := cached_box(Color(1.0, 1.0, 1.0, 0.05), Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.18), 1, 10, Vector2(10, 6))
		for st: String in ["normal", "hover", "focus", "pressed", "hover_pressed"]:
			b.add_theme_stylebox_override(st, sb)
		b.add_theme_stylebox_override("disabled", off)
		for tone: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
			b.add_theme_color_override(tone, CHALK_GOOD_INK if on_style else CHALK_INK)
		b.add_theme_color_override("font_disabled_color", Color(243 / 255.0, 239 / 255.0, 226 / 255.0, 0.42))
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	elif node is PanelContainer:
		var p := node as PanelContainer
		if p.has_meta("fold"):
			p.add_theme_stylebox_override("panel", cached_box(Color(1.0, 1.0, 1.0, 0.08), Color(1.0, 1.0, 1.0, 0.22), 1, 10, Vector2(10, 5)))
		else:
			p.add_theme_stylebox_override("panel", cached_box(Color(1.0, 1.0, 1.0, 0.06), Color(1.0, 1.0, 1.0, 0.2), 1, 12, Vector2(10, 8)))
	for child in node.get_children():
		if child is Control:
			chalk_retheme(child)


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
