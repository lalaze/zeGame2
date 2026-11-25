class_name PaperDialogs
extends Control

## The dialog on screen, one at a time (src/ui/modal.ts), and the passing note at the bottom.

signal changed(open: bool)
var _veil := ColorRect.new()
var _holder := MarginContainer.new()
var _box: PanelContainer = null
var _on_back: Callable
var _note := Label.new()
var _note_left := 0.0
## The margins over and under the dialog, and what fits it between them.
var _edges := 24.0
var _refit := Callable()
## How far down the passing note is.
var note_top := 84.0


func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = Paper.theme()
	_veil.color = Paper.VEIL
	_veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	_veil.visible = false
	add_child(_veil)
	_holder.set_anchors_preset(Control.PRESET_FULL_RECT)
	_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_holder)
	_note.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_note.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_note.add_theme_stylebox_override("normal", Paper.box(Paper.PAPER, Paper.LINE, 2, 14, Vector2(14, 8), Paper.STAMP, 3.0))
	_note.add_theme_font_override("font", Paper.font(700))
	_note.add_theme_font_size_override("font_size", 14)
	_note.add_theme_color_override("font_color", Paper.INK)
	_note.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_note.visible = false
	add_child(_note)


func margins(top: float, bottom: float) -> void:
	_holder.add_theme_constant_override("margin_left", 12)
	_holder.add_theme_constant_override("margin_right", 12)
	_holder.add_theme_constant_override("margin_top", int(top) + 12)
	_holder.add_theme_constant_override("margin_bottom", int(bottom) + 12)
	_edges = top + bottom + 24.0
	if _refit.is_valid():
		_refit.call_deferred()


func is_open() -> bool:
	return _box != null


## Buttons are {"label", "kind"? ("primary", "danger", "ghost"), "disabled"?, "pressed"?, "stay"?}. Options: "icon" beside
## the title, "footer" over the buttons, "tall" to fill the screen, "back" for the phone's back button. Gives back the
## buttons and the scroller.
func show_dialog(title: String, body: Control, buttons: Array, options: Dictionary = {}) -> Dictionary:
	_remove()
	_box = Paper.card("sheet")
	_box.theme = Paper.theme()
	_box.size_flags_vertical = Control.SIZE_EXPAND_FILL if options.get("tall", false) else Control.SIZE_SHRINK_CENTER
	var heading: Array = [Paper.words(title, "h2")]
	if options.has("icon"):
		heading.push_front(options["icon"])
	var actions := Paper.flow([], 8)
	actions.alignment = FlowContainer.ALIGNMENT_END
	var made := []
	for b: Dictionary in buttons:
		var button := Paper.button(b["label"], b.get("kind", "ghost"))
		button.disabled = b.get("disabled", false)
		button.pressed.connect(_answer.bind(b.get("pressed", Callable())))
		actions.add_child(button)
		made.append(button)
	var scroll := Paper.scroller(Paper.padded(body, 2, 2, 8, 4))
	var content := Paper.col([Paper.line(heading, 10), Paper.seam(), scroll, Paper.seam()], 12)
	if options.has("footer"):
		content.add_child(options["footer"])
	content.add_child(actions)
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_box.add_child(content)
	_holder.add_child(_box)
	_veil.visible = true
	_on_back = options.get("back", Callable())
	if not options.get("tall", false):
		# As tall as what it says, up to the screen.
		var fit := _fit.bind(_box, scroll, body)
		_refit = fit
		body.minimum_size_changed.connect(fit, CONNECT_DEFERRED)
		fit.call_deferred()
	changed.emit(true)
	return {"buttons": made, "scroll": scroll}


func _fit(box: PanelContainer, scroll: ScrollContainer, body: Control) -> void:
	if not is_instance_valid(scroll) or box != _box or not is_inside_tree():
		return
	var others := box.get_combined_minimum_size().y - scroll.get_combined_minimum_size().y
	scroll.custom_minimum_size.y = minf(body.get_combined_minimum_size().y + 8.0, maxf(80.0, size.y - _edges - others - 4.0))


func _answer(pressed: Callable) -> void:
	close()
	if pressed.is_valid():
		pressed.call()


func _remove() -> void:
	if _box != null:
		_box.queue_free()
		_holder.remove_child(_box)
		_box = null
		_refit = Callable()


func close() -> void:
	if _box == null:
		return
	_remove()
	_veil.visible = false
	changed.emit(false)


## The phone's back button: what the dialog asks for, or the dialog's end. False without a dialog.
func back() -> bool:
	if _box == null:
		return false
	if _on_back.is_valid():
		_on_back.call()
	else:
		close()
	return true


func note(text: String) -> void:
	_note.text = text
	_note.custom_minimum_size.x = minf(size.x - 48.0, _note.get_theme_font("font").get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x + 34.0)
	_note.reset_size()
	_note.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_note.position.y = note_top
	_note_left = 2.6
	_note.visible = true


func hush() -> void:
	_note_left = 0.0
	_note.visible = false


func _process(dt: float) -> void:
	if _note_left > 0.0:
		_note_left -= dt
		_note.visible = _note_left > 0.0


## What the dialog says, for tests.
func outline() -> Array:
	return Paper.outline(_box) if _box != null else []
