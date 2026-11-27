class_name PaperReceipt
extends PanelContainer

## Direction A Stage 5 closing receipt: white paper (#fffdf6) with masking tape at top, serrated sawtooth bottom,
## dashed dividers, dotted leader lines, tilted red rubber stamp, warm claim tape, and blue-pinned tomorrow sticky note.

const PAPER_WHITE := Color8(0xff, 0xfd, 0xf6)
const DASH_COLOR := Color8(0xd8, 0xc6, 0xaa)
const DOT_COLOR := Color8(0xd2, 0xbf, 0xa2)
const DOT_BAD := Color8(0xd8, 0x9d, 0x93)
const LOSS_RED := Color8(0xb5, 0x57, 0x4a)
const STAMP_RED := Color(201 / 255.0, 72 / 255.0, 58 / 255.0, 0.80)
const STAMP_RING := Color(201 / 255.0, 72 / 255.0, 58 / 255.0, 0.72)
const STAMP_INNER := Color(201 / 255.0, 72 / 255.0, 58 / 255.0, 0.56)
const PAL_BG := Color8(0xf8, 0xf1, 0xe4)
const AV_BG := Color8(0xf0, 0xdf, 0xc4)
const AV_EDGE := Color8(0xe2, 0xcb, 0xa6)
const TROPHY_GOLD := Color8(0xa8, 0x74, 0x20)
const RANK_COLORS := [Color8(0xe2, 0xb2, 0x57), Color8(0xc9, 0xb3, 0x9a), Color8(0xd9, 0xa7, 0x7f)]

var _tooth_w := 16.0
var _tooth_h := 9.0
var _cached_size := Vector2(-1.0, -1.0)
var _poly := PackedVector2Array()
var _shadow := PackedVector2Array()
var _border := PackedVector2Array()
var _tape := PackedVector2Array()


func _init(narrow: bool = false) -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = 11.0 if narrow else 13.0
	empty.content_margin_right = 11.0 if narrow else 13.0
	empty.content_margin_top = 12.0 if narrow else 13.0
	empty.content_margin_bottom = 18.0 if narrow else 20.0
	add_theme_stylebox_override("panel", empty)
	resized.connect(_rebuild)


func _rebuild() -> void:
	_cached_size = size
	_poly.clear()
	_shadow.clear()
	_border.clear()
	_tape.clear()
	if size.x <= 8.0 or size.y <= _tooth_h + 4.0:
		return
	var w := size.x
	var h := size.y
	var base_y := h - _tooth_h
	_poly.append(Vector2(0.0, 0.0))
	_poly.append(Vector2(w, 0.0))
	_poly.append(Vector2(w, base_y))
	var count := maxi(6, int(round(w / _tooth_w)))
	var step := w / float(count)
	for i in range(count - 1, -1, -1):
		var x_right := (i + 1) * step
		var x_mid := (i + 0.5) * step
		var x_left := i * step
		if i < count - 1:
			_poly.append(Vector2(x_right, base_y))
		_poly.append(Vector2(x_mid, h))
		_poly.append(Vector2(x_left, base_y))
	for p: Vector2 in _poly:
		_shadow.append(p + Vector2(0.0, 7.0))
	_border = _poly.duplicate()
	_border.append(_poly[0])
	# Top translucent masking tape strip tilted -2 deg.
	var tc := Vector2(w * 0.5, 2.0)
	var tw := 35.0
	var th := 9.0
	var ang := deg_to_rad(-2.0)
	for c: Vector2 in [Vector2(-tw, -th), Vector2(tw, -th), Vector2(tw, th), Vector2(-tw, th)]:
		_tape.append(tc + c.rotated(ang))
	queue_redraw()


func _draw() -> void:
	if _cached_size != size:
		_rebuild()
	if _poly.is_empty():
		return
	draw_colored_polygon(_shadow, Color(0.0, 0.0, 0.0, 0.30))
	draw_colored_polygon(_poly, PAPER_WHITE)
	draw_polyline(_border, Color(160 / 255.0, 130 / 255.0, 95 / 255.0, 0.22), 1.0, true)
	draw_colored_polygon(_tape, Color(240 / 255.0, 200 / 255.0, 150 / 255.0, 0.72))


## Horizontal dashed receipt separator (#d8c6aa).
class DashedRule extends Control:
	func _init() -> void:
		custom_minimum_size = Vector2(0.0, 2.0)
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		resized.connect(queue_redraw)

	func _draw() -> void:
		if size.x <= 2.0:
			return
		var y := size.y * 0.5
		var x := 0.0
		while x < size.x:
			var to := minf(size.x, x + 5.0)
			draw_line(Vector2(x, y), Vector2(to, y), DASH_COLOR, 1.5, false)
			x += 9.0


## Dotted leader line between label and figure.
class DottedLeader extends Control:
	var color: Color = DOT_COLOR

	func _init(bad: bool = false) -> void:
		color = DOT_BAD if bad else DOT_COLOR
		custom_minimum_size = Vector2(10.0, 14.0)
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		size_flags_vertical = Control.SIZE_SHRINK_END
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		resized.connect(queue_redraw)

	func _draw() -> void:
		if size.x <= 4.0:
			return
		var y := size.y - 4.0
		var x := 2.0
		while x < size.x - 2.0:
			draw_circle(Vector2(x, y), 0.9, color)
			x += 4.5


## Tilted circular double-ring red rubber stamp placed top-right on the receipt.
class RedStamp extends Control:
	var _diameter: float

	func _init(main_text: String, day_text: String, narrow: bool = false) -> void:
		_diameter = 64.0 if narrow else 72.0
		custom_minimum_size = Vector2(_diameter, _diameter)
		size = Vector2(_diameter, _diameter)
		pivot_offset = size * 0.5
		rotation_degrees = 14.0
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		var main_lbl := Label.new()
		main_lbl.text = main_text
		main_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		main_lbl.add_theme_font_override("font", Paper.font(800))
		main_lbl.add_theme_font_size_override("font_size", 11 if narrow else 13)
		main_lbl.add_theme_constant_override("line_spacing", -3)
		main_lbl.add_theme_color_override("font_color", STAMP_RED)
		main_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var day_lbl := Label.new()
		day_lbl.text = day_text
		day_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		day_lbl.add_theme_font_override("font", Paper.font(800))
		day_lbl.add_theme_font_size_override("font_size", 7 if narrow else 8)
		day_lbl.add_theme_color_override("font_color", STAMP_RED)
		day_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var stack := VBoxContainer.new()
		stack.alignment = BoxContainer.ALIGNMENT_CENTER
		stack.add_theme_constant_override("separation", 0)
		stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
		stack.set_anchors_preset(Control.PRESET_FULL_RECT)
		stack.offset_left = 4.0
		stack.offset_right = -4.0
		stack.offset_top = 4.0
		stack.offset_bottom = -4.0
		stack.add_child(main_lbl)
		stack.add_child(day_lbl)
		add_child(stack)
		resized.connect(func() -> void:
			pivot_offset = size * 0.5
			queue_redraw())

	func _draw() -> void:
		var c := size * 0.5
		var r := minf(size.x, size.y) * 0.5 - 2.0
		if r <= 8.0:
			return
		draw_arc(c, r, 0.0, TAU, 44, STAMP_RING, 2.8, true)
		draw_arc(c, r - 4.5, 0.0, TAU, 44, STAMP_INNER, 1.3, true)


## Translucent warm tape strip for the goal / chapter direct claim bar (drawn tilted without rotating bounds).
class ClaimStrip extends PanelContainer:
	var claimed := false

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_PASS
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var empty := StyleBoxEmpty.new()
		empty.content_margin_left = 10.0
		empty.content_margin_right = 10.0
		empty.content_margin_top = 7.0
		empty.content_margin_bottom = 7.0
		add_theme_stylebox_override("panel", empty)
		resized.connect(queue_redraw)

	func set_claimed(v: bool) -> void:
		claimed = v
		queue_redraw()

	func _draw() -> void:
		if size.x <= 4.0 or size.y <= 4.0:
			return
		var center := size * 0.5
		var hw := size.x * 0.5
		var hh := size.y * 0.5
		var ang := deg_to_rad(-0.8)
		var body := PackedVector2Array()
		for c: Vector2 in [Vector2(-hw, -hh), Vector2(hw, -hh), Vector2(hw, hh), Vector2(-hw, hh)]:
			body.append(center + c.rotated(ang))
		var fill := Color(227 / 255.0, 235 / 255.0, 216 / 255.0, 0.78) if claimed else Color(240 / 255.0, 200 / 255.0, 150 / 255.0, 0.54)
		draw_colored_polygon(body, fill)


## Yellow pinned sticky note for tomorrow's weather & guest hint, with a blue pushpin centered at the top.
## Draws its tilted paper inside axis-aligned bounds so it stays safely on screen at 360px.
class TomorrowNote extends PanelContainer:
	func _init(narrow: bool = false) -> void:
		mouse_filter = Control.MOUSE_FILTER_PASS
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var empty := StyleBoxEmpty.new()
		empty.content_margin_left = 10.0 if narrow else 12.0
		empty.content_margin_right = 10.0 if narrow else 12.0
		empty.content_margin_top = 14.0
		empty.content_margin_bottom = 10.0
		add_theme_stylebox_override("panel", empty)
		resized.connect(queue_redraw)

	func _draw() -> void:
		if size.x <= 8.0 or size.y <= 8.0:
			return
		var center := size * 0.5
		var hw := size.x * 0.5 - 2.0
		var hh := size.y * 0.5 - 2.0
		var ang := deg_to_rad(-2.2)
		var body := PackedVector2Array()
		var shadow := PackedVector2Array()
		for c: Vector2 in [Vector2(-hw, -hh), Vector2(hw, -hh), Vector2(hw, hh), Vector2(-hw, hh)]:
			var p := center + c.rotated(ang)
			body.append(p)
			shadow.append(p + Vector2(0.0, 5.0))
		draw_colored_polygon(shadow, Color(0.0, 0.0, 0.0, 0.28))
		draw_colored_polygon(body, Paper.STICKY_YELLOW)
		var border := body.duplicate()
		border.append(body[0])
		draw_polyline(border, Color(140 / 255.0, 110 / 255.0, 55 / 255.0, 0.18), 1.0, true)
		# Glossy blue pushpin centered near top edge.
		var pin := Vector2(size.x * 0.5, 5.5)
		draw_circle(pin + Vector2(0.0, 1.5), 6.0, Color(0.0, 0.0, 0.0, 0.34))
		draw_circle(pin, 5.6, Color8(0x3e, 0x6f, 0xc9))
		draw_circle(pin + Vector2(-1.6, -1.6), 2.4, Color8(0x9a, 0xc0, 0xff))


## Gold / silver / bronze rank badge circle.
static func rank_dot(rank_index: int) -> PanelContainer:
	var col: Color = RANK_COLORS[mini(rank_index, RANK_COLORS.size() - 1)]
	var st := Paper.cached_box(col, Color.TRANSPARENT, 0.0, 8.0, Vector2.ZERO)
	var badge := Paper.panel(st)
	badge.custom_minimum_size = Vector2(16.0, 16.0)
	badge.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var lbl := Label.new()
	lbl.text = str(rank_index + 1)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.add_theme_font_override("font", Paper.font(800))
	lbl.add_theme_font_size_override("font_size", 10)
	lbl.add_theme_color_override("font_color", Color.WHITE)
	lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.add_child(lbl)
	return badge


## Circular partner avatar frame showing the top half of the staff sprite.
static func avatar(look: Dictionary, diameter: float = 36.0) -> PanelContainer:
	var st := StyleBoxFlat.new()
	st.bg_color = AV_BG
	st.border_color = AV_EDGE
	st.set_border_width_all(1)
	st.set_corner_radius_all(int(diameter * 0.5))
	st.corner_detail = 8
	var circle := PanelContainer.new()
	circle.add_theme_stylebox_override("panel", st)
	circle.custom_minimum_size = Vector2(diameter, diameter)
	circle.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	circle.clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW
	circle.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var head := Portraits.head(look, diameter - 2.0)
	head.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	head.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	circle.add_child(head)
	return circle
