class_name PaperTool
extends Button

## A button with an icon over its words. (Button's own icon-on-top layout counts its margins twice.)

var words: String:
	get: return _label.text
	set(value):
		if value != _label.text:
			_label.text = value
			_fit()
var _icon: TextureRect
var _label := Label.new()
var _size := 13


func _init(said: String, icon_name: String, icon_size: float) -> void:
	_icon = Paper.picture(Paper.icon(icon_name, int(icon_size)), icon_size)
	_icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_label.text = said
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.add_theme_font_override("font", Paper.font(700))
	_label.add_theme_font_size_override("font_size", 13)
	var column := Paper.col([_icon, _label], 2)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(column)
	_label.clip_text = true
	resized.connect(_fit)


func small() -> PaperTool:
	_size = 11
	_fit()
	return self


## The words as large as there is room for.
func _fit() -> void:
	var at := _size
	while at > 8 and size.x > 0.0 and Paper.font(700).get_string_size(_label.text, HORIZONTAL_ALIGNMENT_LEFT, -1, at).x > size.x - 6.0:
		at -= 1
	if at != _label.get_theme_font_size("font_size"):
		_label.add_theme_font_size_override("font_size", at)


func _notification(what: int) -> void:
	if what == NOTIFICATION_DRAW:
		var ink: Color = Paper.OFF_TEXT if disabled else Paper.ink_of(self)
		_icon.modulate = ink
		_label.add_theme_color_override("font_color", ink)
