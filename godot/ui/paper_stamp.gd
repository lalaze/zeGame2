class_name PaperStamp
extends Button

## Direction A circular stamp button: paper/tinted disc with outline and bottom lip, line icon inside, label underneath,
## and optional rose unread dot or count badge at top-right of the disc.

var words: String:
	get: return _label.text
	set(value):
		if value != _label.text:
			_label.text = value
			_fit_label()

var icon_name: String = "":
	set(value):
		if value != icon_name:
			icon_name = value
			_icon.texture = Paper.icon(value, int(_icon_px)) if not value.is_empty() else null

var active: bool = false:
	set(value):
		if value != active:
			active = value
			_layout()
			queue_redraw()

var disc_max: float = 52.0
var disc_color: Color = Color8(0xff, 0xfa, 0xf0)
var active_color: Color = Color8(0xf2, 0xd2, 0xc8)
var disc_border: Color = Color8(0x7a, 0x52, 0x34)
var disc_lip: Color = Color8(0x7a, 0x52, 0x34)
var lip_drop: float = 3.0
var label_color: Color = Color8(0xff, 0xf3, 0xdf)
var label_shadow: bool = true
var label_pill: bool = false
var label_wrap: bool = false
var _icon_px: float = 24.0
var _label_size: int = 12
var _unread: int = 0
var _unread_dot: bool = false
var _held: bool = false
var _laid := Vector2(-1.0, -1.0)
var _icon: TextureRect
var _label := Label.new()
var _badge_bg := StyleBoxFlat.new()


func _init(said: String, icon_id: String, opts: Dictionary = {}) -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_filter = Control.MOUSE_FILTER_STOP
	disc_max = opts.get("disc", 52.0)
	disc_color = opts.get("fill", Color8(0xff, 0xfa, 0xf0))
	active_color = opts.get("active_fill", Color8(0xf2, 0xd2, 0xc8))
	disc_border = opts.get("border", Color8(0x7a, 0x52, 0x34))
	disc_lip = opts.get("lip", disc_border)
	lip_drop = opts.get("drop", 3.0)
	label_color = opts.get("label_color", Color8(0xff, 0xf3, 0xdf))
	label_shadow = opts.get("label_shadow", true)
	label_pill = opts.get("label_pill", false)
	label_wrap = opts.get("label_wrap", false)
	_icon_px = opts.get("icon_size", 24.0)
	_label_size = opts.get("font_size", 12)
	var empty := StyleBoxEmpty.new()
	for state: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		add_theme_stylebox_override(state, empty)
	_icon = Paper.picture(Paper.icon(icon_id, int(_icon_px)) if not icon_id.is_empty() else null, _icon_px)
	icon_name = icon_id
	_icon.modulate = Color8(0x4a, 0x34, 0x26)
	add_child(_icon)
	_label.text = said
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.add_theme_font_override("font", Paper.font(800 if not label_shadow else 700))
	_label.add_theme_font_size_override("font_size", _label_size)
	_label.add_theme_color_override("font_color", label_color)
	if label_shadow:
		_label.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.45))
		_label.add_theme_constant_override("shadow_offset_x", 0)
		_label.add_theme_constant_override("shadow_offset_y", 1)
	if label_pill:
		var pill := StyleBoxFlat.new()
		pill.bg_color = Color(74 / 255.0, 52 / 255.0, 38 / 255.0, 0.72)
		pill.set_corner_radius_all(8)
		pill.content_margin_left = 6.0
		pill.content_margin_right = 6.0
		pill.content_margin_top = 1.0
		pill.content_margin_bottom = 1.0
		_label.add_theme_stylebox_override("normal", pill)
	if label_wrap:
		_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	else:
		_label.clip_text = true
	add_child(_label)
	custom_minimum_size = Vector2(disc_max, disc_max + (24.0 if not label_wrap else 40.0))
	resized.connect(_layout)
	button_down.connect(func() -> void:
		_held = true
		_layout()
		queue_redraw())
	button_up.connect(func() -> void:
		_held = false
		_layout()
		queue_redraw())


func set_badge(count: int, dot_only: bool = false) -> void:
	if _unread == count and _unread_dot == dot_only:
		return
	_unread = count
	_unread_dot = dot_only
	queue_redraw()


func _disc_d() -> float:
	if size.x <= 0.0:
		return disc_max
	return minf(disc_max, maxf(42.0, size.x - 4.0))


func _fit_label() -> void:
	if label_wrap:
		return
	var at := _label_size
	var f := Paper.font(700)
	while at > 9 and size.x > 0.0 and f.get_string_size(_label.text, HORIZONTAL_ALIGNMENT_LEFT, -1, at).x > size.x - 2.0:
		at -= 1
	if at != _label.get_theme_font_size("font_size"):
		_label.add_theme_font_size_override("font_size", at)


func _layout() -> void:
	_laid = size
	var d := _disc_d()
	var dy := 2.0 if (active or _held) and not disabled else 0.0
	var cx := size.x * 0.5
	var ic := minf(_icon_px, d * 0.48)
	_icon.position = Vector2(cx - ic * 0.5, d * 0.5 - ic * 0.5 + dy)
	_icon.size = Vector2(ic, ic)
	if label_pill:
		var lw := minf(size.x, Paper.font(700).get_string_size(_label.text, HORIZONTAL_ALIGNMENT_LEFT, -1, _label_size).x + 14.0)
		_label.position = Vector2(cx - lw * 0.5, d + 5.0)
		_label.size = Vector2(lw, 20.0)
	else:
		_label.position = Vector2(0.0, d + 4.0)
		_label.size = Vector2(size.x, maxf(18.0, size.y - d - 4.0))
	_fit_label()


func _draw() -> void:
	# A size given before the stamp was in the tree sends no `resized`: lay out on the first draw at a new size.
	if size != _laid:
		_layout()
	var d := _disc_d()
	var r := d * 0.5
	var pressed_visual := (active or _held) and not disabled
	var dy := 2.0 if pressed_visual else 0.0
	var center := Vector2(size.x * 0.5, r + dy)
	_icon.modulate = Paper.OFF_TEXT if disabled else Color8(0x4a, 0x34, 0x26)
	# Soft drop shadow
	if not disabled:
		draw_circle(center + Vector2(0.0, 4.0 if not pressed_visual else 2.0), r, Color(0.0, 0.0, 0.0, 0.22))
		var drop := maxf(1.0, lip_drop - (2.0 if pressed_visual else 0.0))
		draw_circle(center + Vector2(0.0, drop), r, disc_lip)
	# Disc fill & crisp ring
	var fill := Paper.OFF_FACE if disabled else (active_color if pressed_visual else disc_color)
	var border := Paper.OFF_LINE if disabled else disc_border
	draw_circle(center, r, fill)
	draw_arc(center, r - 1.0, 0.0, TAU, 36, border, 2.0, true)
	# Unread rose badge / dot at top-right of the disc
	if _unread > 0 or _unread_dot:
		var bx := center.x + r * 0.68
		var by := center.y - r * 0.68
		if _unread > 0:
			var text := str(_unread)
			var f := Paper.font(800)
			var tw := f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
			var pw := maxf(18.0, tw + 8.0)
			var ph := 18.0
			var pr := ph * 0.5
			if pw <= ph + 0.5:
				draw_circle(Vector2(bx, by), pr + 1.5, Paper.LIGHT)
				draw_circle(Vector2(bx, by), pr, Paper.ROSE_A)
			else:
				var half_mid := (pw - ph) * 0.5
				var left_c := Vector2(bx - half_mid, by)
				var right_c := Vector2(bx + half_mid, by)
				draw_circle(left_c, pr + 1.5, Paper.LIGHT)
				draw_circle(right_c, pr + 1.5, Paper.LIGHT)
				draw_rect(Rect2(left_c.x, by - pr - 1.5, pw - ph, ph + 3.0), Paper.LIGHT)
				draw_circle(left_c, pr, Paper.ROSE_A)
				draw_circle(right_c, pr, Paper.ROSE_A)
				draw_rect(Rect2(left_c.x, by - pr, pw - ph, ph), Paper.ROSE_A)
			draw_string(f, Vector2(bx - tw * 0.5, by + 4.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Paper.LIGHT)
		else:
			draw_circle(Vector2(bx, by), 7.5, Paper.LIGHT)
			draw_circle(Vector2(bx, by), 5.5, Paper.ROSE_A)
