class_name PaperDialogs
extends Control

## The dialog on screen, one at a time (src/ui/modal.ts), and the passing note at the bottom.

signal changed(open: bool)
signal header_raised(raised: bool)
var _veil := ColorRect.new()
var _holder := MarginContainer.new()
var _box: PanelContainer = null
var _on_back: Callable
var _note_card: PaperPinnedNote
var _note := Label.new()
var _note_left := 0.0
## The margins over and under the dialog, and what fits it between them.
var _edges := 24.0
var _safe_top := 0.0
var _safe_bottom := 0.0
var _top_offset := 12.0
var _side_margin := 12
var _bottom_margin := 12
var _is_header_raised := false
var _refit := Callable()
## How far down the passing note is.
var note_top := 96.0
var _note_at_bottom := false
var _note_bottom := 24.0


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
	_note_card = Paper.pinned_note()
	_note_card.z_index = 10
	_note_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_note_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_note_card.visible = false
	_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_note.add_theme_font_override("font", Paper.font(700))
	_note.add_theme_font_size_override("font_size", 13)
	_note.add_theme_color_override("font_color", Paper.NOTE_INK)
	_note.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_note.visible = false
	_note_card.add_child(_note)
	add_child(_note_card)


func margins(top: float, bottom: float) -> void:
	_safe_top = top
	_safe_bottom = bottom
	_apply_margins()
	if _refit.is_valid():
		_refit.call_deferred()


func _apply_margins() -> void:
	var kb := _safe_bottom > 100.0
	var top_off := minf(_top_offset, 8.0) if kb else _top_offset
	var bot_pad := mini(_bottom_margin, 6) if kb else _bottom_margin
	_holder.add_theme_constant_override("margin_left", _side_margin)
	_holder.add_theme_constant_override("margin_right", _side_margin)
	_holder.add_theme_constant_override("margin_top", int(_safe_top + top_off))
	_holder.add_theme_constant_override("margin_bottom", int(_safe_bottom) + bot_pad)
	_edges = _safe_top + _safe_bottom + top_off + float(bot_pad)


func _set_header_raised(on: bool) -> void:
	if _is_header_raised == on:
		return
	_is_header_raised = on
	_holder.z_index = 2 if on else 0
	header_raised.emit(on)


func is_open() -> bool:
	return _box != null


## Opens a custom-framed full dialog (such as the chalkboard menu preparation).
func show_custom(box: PanelContainer, options: Dictionary = {}) -> void:
	_remove()
	_box = box
	_box.theme = Paper.theme()
	_top_offset = float(options.get("top_offset", 12.0))
	_side_margin = int(options.get("side_margin", 12))
	_bottom_margin = int(options.get("bottom_margin", 12))
	_apply_margins()
	_holder.add_child(_box)
	_veil.visible = true
	_on_back = options.get("back", Callable())
	_set_header_raised(bool(options.get("show_header", false)))
	changed.emit(true)


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
	_top_offset = 12.0
	_side_margin = 12
	_bottom_margin = 12
	_apply_margins()
	_set_header_raised(false)


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


func set_note_at_bottom(at_bottom: bool, bottom_inset: float = 0.0) -> void:
	_note_at_bottom = at_bottom
	_note_bottom = bottom_inset + 24.0
	if _note_card.visible:
		_place_note()


func _place_note() -> void:
	if _note_at_bottom:
		_note_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
		_note_card.position.y = size.y - _note_card.size.y - _note_bottom
	else:
		_note_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
		_note_card.position.y = note_top


func note(text: String) -> void:
	_note.text = text
	var want_w := minf(minf(300.0, maxf(160.0, size.x - 48.0)), _note.get_theme_font("font").get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x + 52.0)
	_note_card.custom_minimum_size.x = maxf(140.0, want_w)
	_note_card.reset_size()
	_place_note()
	_note_left = 2.6
	_note.visible = true
	_note_card.visible = true


## Appends extra words to the currently shown toast (or shows them alone if none is up).
func append_note(extra: String) -> void:
	if extra.is_empty():
		return
	note("%s %s" % [_note.text, extra] if _note.visible and not _note.text.is_empty() else extra)


func hush() -> void:
	_note_left = 0.0
	_note.visible = false
	_note_card.visible = false


func _process(dt: float) -> void:
	if _note_left > 0.0:
		_note_left -= dt
		var shown := _note_left > 0.0
		_note.visible = shown
		_note_card.visible = shown


## What the dialog says, for tests.
func outline() -> Array:
	return Paper.outline(_box) if _box != null else []
