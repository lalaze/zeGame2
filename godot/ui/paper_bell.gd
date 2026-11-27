class_name PaperBell
extends Button

## Direction A center arched green main button ("开门营业" / "准备菜单" / "帮忙"):
## arched top corners (44px), gentle bottom corners (18px), sage gradient, thick bottom lip, icon above words.

var words: String:
	get: return _label.text
	set(value):
		if value != _label.text:
			_label.text = value
			_fit()

var icon_name: String = "bell":
	set(value):
		if value != icon_name:
			icon_name = value
			_icon.texture = Paper.icon(value, 26)

var _icon: TextureRect
var _label := Label.new()
var _held := false
var _cached_size := Vector2(-1.0, -1.0)
var _pts := PackedVector2Array()
var _border := PackedVector2Array()
var _lip := PackedVector2Array()
var _shadow := PackedVector2Array()


func _init(said: String, icon_id: String = "bell") -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_filter = Control.MOUSE_FILTER_STOP
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	custom_minimum_size = Vector2(108.0, 82.0)
	var empty := StyleBoxEmpty.new()
	for state: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		add_theme_stylebox_override(state, empty)
	_icon = Paper.picture(Paper.icon(icon_id, 26), 26.0)
	icon_name = icon_id
	_icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_icon.modulate = Color.WHITE
	_label.text = said
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.add_theme_font_override("font", Paper.font(800))
	_label.add_theme_font_size_override("font_size", 14)
	_label.add_theme_color_override("font_color", Color.WHITE)
	var col := Paper.col([_icon, _label], 3)
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.offset_left = 8.0
	col.offset_right = -8.0
	col.offset_top = 8.0
	col.offset_bottom = -6.0
	add_child(col)
	resized.connect(_rebuild)
	button_down.connect(func() -> void:
		_held = true
		queue_redraw())
	button_up.connect(func() -> void:
		_held = false
		queue_redraw())


func _fit() -> void:
	var w := maxf(80.0, size.x - 16.0)
	var f := Paper.font(800)
	var fs := 14
	while fs > 11 and f.get_string_size(_label.text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > w:
		fs -= 1
	if fs != _label.get_theme_font_size("font_size"):
		_label.add_theme_font_size_override("font_size", fs)


func _rebuild() -> void:
	_cached_size = size
	_fit()
	if size.x <= 1.0 or size.y <= 1.0:
		return
	var r_top := minf(44.0, size.x * 0.42)
	var r_bot := 18.0
	_pts = PaperPlank._rounded_poly(Rect2(Vector2.ZERO, size), r_top, r_bot)
	_border = _pts.duplicate()
	_border.append(_pts[0])
	_lip = PaperPlank._rounded_poly(Rect2(Vector2(0.0, 4.0), size), r_top, r_bot)
	_shadow = PaperPlank._rounded_poly(Rect2(Vector2(0.0, 8.0), size), r_top, r_bot)
	queue_redraw()


func _draw() -> void:
	if _cached_size != size:
		_rebuild()
	if _pts.is_empty():
		return
	var down := _held and not disabled
	var dy := 2.0 if down else 0.0
	var top_c := Color8(0xc9, 0xbf, 0xae) if disabled else Paper.SAGE_A_TOP
	var bot_c := Color8(0xb9, 0xae, 0x9b) if disabled else Paper.SAGE_A_DARK
	var edge_c := Color8(0x9e, 0x90, 0x7e) if disabled else Paper.SAGE_A_EDGE
	var ink_c := Color8(0x74, 0x66, 0x58) if disabled else Color.WHITE
	_icon.modulate = ink_c
	_label.add_theme_color_override("font_color", ink_c)
	if not disabled:
		draw_colored_polygon(_shadow, Color(0.0, 0.0, 0.0, 0.28))
	draw_colored_polygon(_lip if not down and not disabled else PaperPlank._rounded_poly(Rect2(Vector2(0.0, 2.0 + dy), size), minf(44.0, size.x * 0.42), 18.0), edge_c)
	var shifted := PackedVector2Array()
	var colors := PackedColorArray()
	for p: Vector2 in _pts:
		shifted.append(p + Vector2(0.0, dy))
		colors.append(top_c.lerp(bot_c, clampf(p.y / maxf(1.0, size.y), 0.0, 1.0)))
	draw_polygon(shifted, colors)
	var bpts := shifted.duplicate()
	bpts.append(shifted[0])
	draw_polyline(bpts, edge_c, 2.0, true)
