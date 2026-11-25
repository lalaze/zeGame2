extends Node2D

## Main controller for Tiny Bean Café B0 sample.
## Hosts the cross-section building view, mobile portrait HUD (safe-area aware),
## Menu management panel, Day settlement modal, Performance benchmark overlay,
## Android back-key handling, and CLI screenshot/bench automation hooks.

var data: GameData
var state: CafeState
var sim: CafeSim
var paper_theme: Theme

var building_view: BuildingView
var ui_layer: CanvasLayer
var safe_root: Control
var menu_panel: MenuPanel
var bench_runner: BenchRunner

# HUD elements
var _top_bar: HBoxContainer
var _name_lbl: Label
var _clock_lbl: Label
var _money_lbl: Label
var _closing_banner: PanelContainer
var _closing_lbl: Label
var _bottom_dock: HBoxContainer
var _open_btn: Button
var _speed_btn: Button
var _menu_btn: Button
var _lang_btn: Button
var _bench_btn: Button

# Day summary modal
var _report_overlay: Control
var _report_title: Label
var _report_body: Label
var _report_ok_btn: Button

# Benchmark overlay
var _bench_overlay: Control
var _bench_margin: MarginContainer
var _bench_title: Label
var _bench_status: Label
var _bench_warning_box: PanelContainer
var _bench_warning_lbl: Label
var _bench_warning_danger_sb: StyleBoxFlat
var _bench_warning_info_sb: StyleBoxFlat
var _bench_metrics: Label
var _bench_full_btn: Button
var _bench_half_btn: Button
var _bench_back_btn: Button

var _hud_timer: float = 0.0
var _bench_ui_last_usec: int = 0
var _auto_mode: Dictionary = {}


func _ready() -> void:
	# Defense-in-depth alongside project.godot `application/config/quit_on_go_back=false`.
	get_tree().quit_on_go_back = false

	data = GameData.new()
	paper_theme = data.create_paper_theme()
	state = CafeState.new(data)
	sim = CafeSim.new(data, state, 1)
	bench_runner = BenchRunner.new()

	sim.day_finished.connect(_on_day_finished)

	building_view = BuildingView.new()
	add_child(building_view)
	building_view.setup(data, state, sim)

	_build_ui()
	_apply_safe_area()
	get_viewport().size_changed.connect(_apply_safe_area)
	_refresh_hud()
	_parse_cli_args()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		handle_back_request()


func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			handle_back_request()


## Handles Android Back (and desktop Escape): closes any open drawer/modal first;
## when nothing is open on Android, moves the task to back via AndroidRuntime without killing the process.
func handle_back_request() -> String:
	if menu_panel != null and menu_panel.visible:
		menu_panel.close_panel()
		return "closed_menu"
	if _report_overlay != null and _report_overlay.visible:
		_report_overlay.visible = false
		building_view.drag_enabled = true
		_refresh_hud()
		return "closed_report"
	if _bench_overlay != null and _bench_overlay.visible:
		_exit_benchmark()
		return "closed_bench"
	if OS.get_name() == "Android":
		if Engine.has_singleton("AndroidRuntime"):
			var android_runtime := Engine.get_singleton("AndroidRuntime")
			if android_runtime != null:
				var activity: Variant = android_runtime.call("getActivity")
				if activity != null:
					activity.call("moveTaskToBack", true)
					return "minimized"
	return "noop"


func _build_ui() -> void:
	ui_layer = CanvasLayer.new()
	ui_layer.layer = 10
	add_child(ui_layer)

	safe_root = Control.new()
	safe_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	safe_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	safe_root.theme = paper_theme
	ui_layer.add_child(safe_root)

	var sage := paper_theme.get_color("sage", "Cafe")
	var sage_dark := paper_theme.get_color("sage_dark", "Cafe")
	var paper_light := paper_theme.get_color("paper_light", "Cafe")
	var paper := paper_theme.get_color("paper", "Cafe")
	var line := paper_theme.get_color("line", "Cafe")
	var muted := paper_theme.get_color("muted", "Cafe")

	var primary_sb := GameData._box(sage, sage_dark, 2, 14, 12, 8)
	var plaque_sb := GameData._box(paper, line, 2, 16, 12, 8)

	# Top bar: Left plaque (shop name + day/clock), Right plaque (coins)
	var top_vbox := VBoxContainer.new()
	top_vbox.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top_vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_vbox.add_theme_constant_override("separation", 6)
	safe_root.add_child(top_vbox)

	_top_bar = HBoxContainer.new()
	_top_bar.add_theme_constant_override("separation", 8)
	_top_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_vbox.add_child(_top_bar)

	var left_plaque := PanelContainer.new()
	left_plaque.add_theme_stylebox_override("panel", plaque_sb)
	left_plaque.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_top_bar.add_child(left_plaque)

	var left_v := VBoxContainer.new()
	left_v.add_theme_constant_override("separation", 2)
	left_plaque.add_child(left_v)

	_name_lbl = Label.new()
	_name_lbl.add_theme_font_size_override("font_size", 16)
	left_v.add_child(_name_lbl)

	_clock_lbl = Label.new()
	_clock_lbl.add_theme_font_size_override("font_size", 12)
	_clock_lbl.add_theme_color_override("font_color", muted)
	left_v.add_child(_clock_lbl)

	var right_plaque := PanelContainer.new()
	right_plaque.add_theme_stylebox_override("panel", plaque_sb)
	_top_bar.add_child(right_plaque)

	var right_h := HBoxContainer.new()
	right_h.add_theme_constant_override("separation", 6)
	right_h.alignment = BoxContainer.ALIGNMENT_CENTER
	right_plaque.add_child(right_h)

	_money_lbl = Label.new()
	_money_lbl.add_theme_font_size_override("font_size", 20)
	right_h.add_child(_money_lbl)

	# Secondary top-right row: language toggle + benchmark entry
	var util_row := HBoxContainer.new()
	util_row.alignment = BoxContainer.ALIGNMENT_END
	util_row.add_theme_constant_override("separation", 6)
	util_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_vbox.add_child(util_row)

	_lang_btn = Button.new()
	_lang_btn.custom_minimum_size = Vector2(56, 36)
	_lang_btn.pressed.connect(_on_toggle_locale)
	util_row.add_child(_lang_btn)

	_bench_btn = Button.new()
	_bench_btn.custom_minimum_size = Vector2(88, 36)
	_bench_btn.pressed.connect(_on_open_benchmark)
	util_row.add_child(_bench_btn)

	# Closing banner
	_closing_banner = PanelContainer.new()
	_closing_banner.add_theme_stylebox_override("panel", plaque_sb)
	_closing_banner.visible = false
	top_vbox.add_child(_closing_banner)

	_closing_lbl = Label.new()
	_closing_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_closing_lbl.add_theme_font_size_override("font_size", 13)
	_closing_banner.add_child(_closing_lbl)

	# Bottom dock: Menu | Open/Close Shop | Speed (1×/2×/4×)
	_bottom_dock = HBoxContainer.new()
	_bottom_dock.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_bottom_dock.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_bottom_dock.add_theme_constant_override("separation", 8)
	_bottom_dock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	safe_root.add_child(_bottom_dock)

	_menu_btn = Button.new()
	_menu_btn.custom_minimum_size = Vector2(88, 56)
	_menu_btn.pressed.connect(_on_open_menu)
	_bottom_dock.add_child(_menu_btn)

	_open_btn = Button.new()
	_open_btn.custom_minimum_size = Vector2(140, 56)
	_open_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_open_btn.add_theme_stylebox_override("normal", primary_sb)
	_open_btn.add_theme_stylebox_override("hover", primary_sb)
	_open_btn.add_theme_color_override("font_color", paper_light)
	_open_btn.add_theme_color_override("font_hover_color", paper_light)
	_open_btn.add_theme_color_override("font_pressed_color", paper_light)
	_open_btn.pressed.connect(_on_primary_shop_btn)
	_bottom_dock.add_child(_open_btn)

	_speed_btn = Button.new()
	_speed_btn.custom_minimum_size = Vector2(78, 56)
	_speed_btn.pressed.connect(_on_cycle_speed)
	_bottom_dock.add_child(_speed_btn)

	# Menu drawer (hidden by default; never refreshes while closed)
	menu_panel = MenuPanel.new()
	menu_panel.setup(data, state, paper_theme)
	menu_panel.closed.connect(func() -> void: building_view.drag_enabled = true)
	menu_panel.menu_changed.connect(_refresh_hud)
	ui_layer.add_child(menu_panel)

	_build_report_modal(primary_sb, paper_light)
	_build_bench_overlay(primary_sb, paper_light)


func _build_report_modal(primary_sb: StyleBoxFlat, paper_light: Color) -> void:
	_report_overlay = Control.new()
	_report_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_report_overlay.visible = false
	_report_overlay.theme = paper_theme
	ui_layer.add_child(_report_overlay)

	var bg := ColorRect.new()
	bg.color = Color(0.17, 0.12, 0.09, 0.48)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_report_overlay.add_child(bg)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_report_overlay.add_child(center)

	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(340, 260)
	center.add_child(card)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	card.add_child(vb)

	_report_title = Label.new()
	_report_title.add_theme_font_size_override("font_size", 20)
	vb.add_child(_report_title)

	var sep := HSeparator.new()
	vb.add_child(sep)

	_report_body = Label.new()
	_report_body.add_theme_font_size_override("font_size", 14)
	_report_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vb.add_child(_report_body)

	_report_ok_btn = Button.new()
	_report_ok_btn.custom_minimum_size = Vector2(0, 44)
	_report_ok_btn.add_theme_stylebox_override("normal", primary_sb)
	_report_ok_btn.add_theme_stylebox_override("hover", primary_sb)
	_report_ok_btn.add_theme_color_override("font_color", paper_light)
	_report_ok_btn.add_theme_color_override("font_hover_color", paper_light)
	_report_ok_btn.pressed.connect(func() -> void:
		_report_overlay.visible = false
		building_view.drag_enabled = true
		_refresh_hud()
	)
	vb.add_child(_report_ok_btn)


func _build_bench_overlay(primary_sb: StyleBoxFlat, paper_light: Color) -> void:
	_bench_overlay = Control.new()
	_bench_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_bench_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bench_overlay.visible = false
	_bench_overlay.theme = paper_theme
	ui_layer.add_child(_bench_overlay)

	_bench_margin = MarginContainer.new()
	_bench_margin.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_bench_margin.add_theme_constant_override("margin_left", 12)
	_bench_margin.add_theme_constant_override("margin_right", 12)
	_bench_margin.add_theme_constant_override("margin_top", 16)
	_bench_overlay.add_child(_bench_margin)

	var card := PanelContainer.new()
	_bench_margin.add_child(card)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 8)
	card.add_child(vb)

	_bench_title = Label.new()
	_bench_title.add_theme_font_size_override("font_size", 18)
	vb.add_child(_bench_title)

	_bench_status = Label.new()
	_bench_status.add_theme_font_size_override("font_size", 13)
	_bench_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vb.add_child(_bench_status)

	var danger := paper_theme.get_color("danger", "Cafe")
	var rose := paper_theme.get_color("rose", "Cafe")
	var soft_line := paper_theme.get_color("soft_line", "Cafe")
	var paper_2 := paper_theme.get_color("paper_2", "Cafe")
	_bench_warning_danger_sb = GameData._box(rose, danger, 2, 10, 10, 8)
	_bench_warning_info_sb = GameData._box(paper_2, soft_line, 2, 10, 10, 8)

	_bench_warning_box = PanelContainer.new()
	_bench_warning_box.add_theme_stylebox_override("panel", _bench_warning_danger_sb)
	_bench_warning_box.visible = false
	vb.add_child(_bench_warning_box)

	_bench_warning_lbl = Label.new()
	_bench_warning_lbl.add_theme_font_size_override("font_size", 13)
	_bench_warning_lbl.add_theme_color_override("font_color", danger)
	_bench_warning_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_bench_warning_box.add_child(_bench_warning_lbl)

	_bench_metrics = Label.new()
	_bench_metrics.add_theme_font_size_override("font_size", 13)
	_bench_metrics.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_bench_metrics.visible = false
	vb.add_child(_bench_metrics)

	var btn_row := HBoxContainer.new()
	btn_row.add_theme_constant_override("separation", 8)
	vb.add_child(btn_row)

	_bench_full_btn = Button.new()
	_bench_full_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_bench_full_btn.custom_minimum_size = Vector2(0, 42)
	_bench_full_btn.add_theme_stylebox_override("normal", primary_sb)
	_bench_full_btn.add_theme_stylebox_override("hover", primary_sb)
	_bench_full_btn.add_theme_color_override("font_color", paper_light)
	_bench_full_btn.add_theme_color_override("font_hover_color", paper_light)
	_bench_full_btn.pressed.connect(_start_benchmark.bind("full"))
	btn_row.add_child(_bench_full_btn)

	_bench_half_btn = Button.new()
	_bench_half_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_bench_half_btn.custom_minimum_size = Vector2(0, 42)
	_bench_half_btn.pressed.connect(_start_benchmark.bind("half"))
	btn_row.add_child(_bench_half_btn)

	_bench_back_btn = Button.new()
	_bench_back_btn.custom_minimum_size = Vector2(0, 38)
	_bench_back_btn.pressed.connect(_exit_benchmark)
	vb.add_child(_bench_back_btn)


func _apply_safe_area() -> void:
	if safe_root == null:
		return
	var vp := get_viewport_rect().size
	var win := Vector2(DisplayServer.window_get_size())
	var safe := DisplayServer.get_display_safe_area()
	var pad_left := 12.0
	var pad_right := 12.0
	var pad_top := 12.0
	var pad_bottom := 14.0
	if win.x > 0.0 and win.y > 0.0 and safe.size.x > 0 and safe.size.y > 0:
		var sx := vp.x / win.x
		var sy := vp.y / win.y
		pad_left = maxf(pad_left, float(safe.position.x) * sx + 8.0)
		pad_top = maxf(pad_top, float(safe.position.y) * sy + 8.0)
		pad_right = maxf(pad_right, (win.x - float(safe.position.x + safe.size.x)) * sx + 8.0)
		pad_bottom = maxf(pad_bottom, (win.y - float(safe.position.y + safe.size.y)) * sy + 10.0)
	safe_root.offset_left = pad_left
	safe_root.offset_top = pad_top
	safe_root.offset_right = -pad_right
	safe_root.offset_bottom = -pad_bottom
	if menu_panel != null:
		menu_panel.set_safe_margins(pad_left, pad_top, pad_right, pad_bottom)
	if _bench_margin != null:
		_bench_margin.add_theme_constant_override("margin_left", int(roundf(pad_left)))
		_bench_margin.add_theme_constant_override("margin_right", int(roundf(pad_right)))
		_bench_margin.add_theme_constant_override("margin_top", int(roundf(pad_top)))


func _refresh_hud() -> void:
	var loc := state.locale
	_name_lbl.text = data.t(loc, "app.title")
	var day_str := data.t(loc, "day.label", {"n": state.day})
	var clock_str := data.format_clock(state.day_time)
	var status_str := data.t(loc, "floors.sign.open" if state.phase == "open" else ("day.closing" if state.phase == "closing" else "floors.sign.closed"))
	_clock_lbl.text = "%s · %s · %s" % [day_str, clock_str, status_str]
	_money_lbl.text = data.format_money(state.coins)

	_lang_btn.text = data.t(loc, "b0.langToggle")
	_bench_btn.text = data.t(loc, "b0.benchBtn")
	_menu_btn.text = data.t(loc, "tab.menu")
	_speed_btn.text = "%d×" % state.speed

	if state.phase == "prep":
		_open_btn.text = data.t(loc, "b0.openShop")
		_open_btn.disabled = state.active_menu_items().is_empty()
		_closing_banner.visible = false
	elif state.phase == "open":
		_open_btn.text = data.t(loc, "b0.closeShop")
		_open_btn.disabled = false
		_closing_banner.visible = false
	else:
		_open_btn.text = data.t(loc, "day.finishNow")
		_open_btn.disabled = false
		_closing_lbl.text = data.t(loc, "b0.closingNote")
		_closing_banner.visible = true

	if _bench_overlay.visible:
		_refresh_bench_ui()


func _refresh_bench_ui() -> void:
	var loc := state.locale
	_bench_title.text = data.t(loc, "b0.benchTitle")
	_bench_full_btn.text = data.t(loc, "b0.benchStartFull")
	_bench_half_btn.text = data.t(loc, "b0.benchStartHalf")
	_bench_back_btn.text = data.t(loc, "b0.benchStop")
	_bench_full_btn.disabled = bench_runner.running
	_bench_half_btn.disabled = bench_runner.running
	if bench_runner.is_warming_up():
		_bench_status.text = data.t(loc, "b0.benchWarmup", {
			"sec": int(ceil(bench_runner.warmup_remaining_seconds())),
			"load": snappedf(bench_runner.load_ms + bench_runner.upload_ms, 0.1),
		})
		_bench_warning_box.visible = false
	elif bench_runner.running:
		_bench_status.text = data.t(loc, "b0.benchRunning", {"sec": int(ceil(bench_runner.remaining_seconds()))})
		_bench_warning_box.visible = false
	elif not bench_runner.last_result().is_empty():
		var r := bench_runner.last_result()
		_bench_status.text = data.t(loc, "b0.benchDone")
		var hz_val: Variant = r.get("refresh_rate_hz", null)
		var hz_str := data.t(loc, "b0.benchHzUnknown") if hz_val == null else ("%s Hz" % str(hz_val))
		if bool(r.get("pacing_invalid", false)):
			_bench_warning_box.add_theme_stylebox_override("panel", _bench_warning_danger_sb)
			_bench_warning_lbl.add_theme_color_override("font_color", paper_theme.get_color("danger", "Cafe"))
			_bench_warning_lbl.text = data.t(loc, "b0.benchPacingInvalid", {
				"avgFps": r["avg_fps"],
				"hz": hz_val,
			})
			_bench_warning_box.visible = true
		elif hz_val == null or not bool(r.get("pacing_checked", false)):
			_bench_warning_box.add_theme_stylebox_override("panel", _bench_warning_info_sb)
			_bench_warning_lbl.add_theme_color_override("font_color", paper_theme.get_color("muted", "Cafe"))
			_bench_warning_lbl.text = data.t(loc, "b0.benchPacingUnchecked")
			_bench_warning_box.visible = true
		else:
			_bench_warning_box.visible = false
		_bench_metrics.visible = true
		_bench_metrics.text = data.t(loc, "b0.benchMetrics", {
			"preset": r["preset"],
			"renderer": r["renderer"],
			"device": r["device"],
			"res": r["resolution"],
			"hz": hz_str,
			"vsync": r.get("vsync_mode", "unknown"),
			"load": r["load_total_ms"],
			"avgFps": r["avg_fps"],
			"p50": r["frame_ms_p50"],
			"p95": r["frame_ms_p95"],
			"max": r["frame_ms_max"],
			"slow": r["frames_over_25ms"],
			"frames": r["frames"],
			"draws": r["draw_calls_avg"],
			"vram": r["video_mem_mb"],
			"tex": r["texture_mem_mb"],
			"staticMem": r["static_mem_mb"],
		})
	else:
		_bench_status.text = data.t(loc, "b0.benchDesc")
		_bench_warning_box.visible = false
		_bench_metrics.visible = false


func _on_primary_shop_btn() -> void:
	if state.phase == "prep":
		if state.open_shop():
			# Matches TS openShop(): never reset sim so still-seated/exiting guests finish naturally.
			_refresh_hud()
			menu_panel.refresh_if_open()
	elif state.phase == "open":
		sim.begin_closing()
		_refresh_hud()
	elif state.phase == "closing":
		var report := sim.close_shop_now()
		if not report.is_empty():
			_on_day_finished(report)


func _on_cycle_speed() -> void:
	var speeds: Array = data.speeds
	if speeds.is_empty():
		return
	var idx := -1
	for i in range(speeds.size()):
		if int(speeds[i]) == state.speed:
			idx = i
			break
	state.speed = int(speeds[(idx + 1) % speeds.size()])
	_refresh_hud()


func _on_toggle_locale() -> void:
	state.locale = "en" if state.locale == "zh" else "zh"
	_refresh_hud()
	menu_panel.refresh_if_open()


func _on_open_menu() -> void:
	building_view.drag_enabled = false
	menu_panel.open_panel()


func _on_open_benchmark() -> void:
	menu_panel.close_panel()
	_report_overlay.visible = false
	safe_root.visible = false
	_bench_overlay.visible = true
	building_view.set_bench_mode(true, state.art_preset)
	_refresh_bench_ui()


func _start_benchmark(
	target_preset: String,
	duration_sec: float = BenchRunner.DEFAULT_DURATION,
	warmup_sec: float = BenchRunner.DEFAULT_WARMUP
) -> void:
	var t0 := Time.get_ticks_usec()
	building_view.set_bench_mode(true, target_preset)
	var measured_load_ms := float(Time.get_ticks_usec() - t0) / 1000.0
	bench_runner.start(target_preset, duration_sec, warmup_sec, measured_load_ms)
	_bench_ui_last_usec = Time.get_ticks_usec()
	_bench_metrics.visible = false
	_refresh_bench_ui()


func _exit_benchmark() -> void:
	bench_runner.cancel()
	_bench_overlay.visible = false
	safe_root.visible = true
	building_view.set_bench_mode(false, "full")
	building_view.drag_enabled = true
	_refresh_hud()


func _on_day_finished(report: Dictionary) -> void:
	var loc := state.locale
	_report_title.text = data.t(loc, "report.title", {"n": int(report["day"])})
	var lines: Array[String] = []
	lines.append("%s: %d" % [data.t(loc, "report.served"), int(report["served"])])
	lines.append("%s: %s" % [data.t(loc, "report.missed"), data.t(loc, "report.missedValue", {
		"n": int(report["missed"]),
		"sold": int(report["sold_out"]),
	})])
	lines.append("%s: %s" % [data.t(loc, "report.revenue"), data.format_money(float(report["revenue"]))])
	lines.append("%s: %s" % [data.t(loc, "report.ingredients"), data.format_money(float(report["ingredient_cost"]))])
	lines.append("%s: %s" % [data.t(loc, "report.profit"), data.format_money(float(report["profit"]))])
	var best := str(report.get("best_seller", ""))
	if not best.is_empty():
		lines.append(data.t(loc, "report.best", {
			"item": data.t(loc, "item.%s" % best),
			"n": int(report.get("best_count", 0)),
		}))
	elif int(report["served"]) == 0:
		lines.append(data.t(loc, "report.none"))
	_report_body.text = "\n".join(lines)
	_report_ok_btn.text = data.t(loc, "report.next")
	building_view.drag_enabled = false
	_report_overlay.visible = true
	_refresh_hud()
	menu_panel.refresh_if_open()


func _process(delta: float) -> void:
	if _bench_overlay.visible:
		building_view.update_visuals(delta)
		if bench_runner.running:
			var done := bench_runner.sample()
			var now_usec := Time.get_ticks_usec()
			if done or (now_usec - _bench_ui_last_usec) >= 250_000:
				_bench_ui_last_usec = now_usec
				_refresh_bench_ui()
			if done and bool(_auto_mode.get("quit_after_bench", false)):
				var out_shot: String = str(_auto_mode.get("screenshot", ""))
				if not out_shot.is_empty():
					_auto_mode["pending_shot"] = out_shot
					_auto_mode["shot_frames"] = 2
				else:
					_print_bench_and_quit()
	else:
		sim.advance(delta)
		building_view.update_visuals(delta)
		_hud_timer += delta
		if _hud_timer >= 0.2:
			_hud_timer = 0.0
			_refresh_hud()
			# Strictly only refreshes menu panel when open
			menu_panel.refresh_if_open()

	if _auto_mode.has("scroll_menu_bottom"):
		_auto_mode["scroll_frames"] = int(_auto_mode.get("scroll_frames", 0)) - 1
		if int(_auto_mode["scroll_frames"]) <= 0:
			_auto_mode.erase("scroll_menu_bottom")
			var vbar := menu_panel._scroll.get_v_scroll_bar()
			if vbar != null:
				menu_panel._scroll.scroll_vertical = int(vbar.max_value)

	if _auto_mode.has("pending_shot"):
		_auto_mode["shot_frames"] = int(_auto_mode.get("shot_frames", 0)) - 1
		if int(_auto_mode["shot_frames"]) <= 0:
			var shot_path: String = str(_auto_mode["pending_shot"])
			_auto_mode.erase("pending_shot")
			var img := get_viewport().get_texture().get_image()
			var err := img.save_png(shot_path)
			print("SCREENSHOT_SAVED:", shot_path, " err=", err)
			if bool(_auto_mode.get("quit_after_bench", false)):
				_print_bench_and_quit()
			elif bool(_auto_mode.get("quit_after_shot", false)):
				get_tree().quit(0)


func _print_bench_and_quit() -> void:
	print("BENCH_RESULT_JSON:", JSON.stringify(bench_runner.last_result()))
	get_tree().quit(0)


## Optional user CLI arguments (`godot --path godot -- --mode=... --lang=... --screenshot=...`)
## used for automated screenshot verification and benchmark collection.
func _parse_cli_args() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		return
	var opts: Dictionary = {}
	for a in args:
		if a.begins_with("--") and a.contains("="):
			var parts := a.substr(2).split("=", false, 1)
			opts[parts[0]] = parts[1]
		elif a.begins_with("--"):
			opts[a.substr(2)] = "1"

	if opts.has("lang"):
		state.locale = str(opts["lang"])
	if opts.has("preset"):
		building_view.set_preset(str(opts["preset"]))
	if opts.has("size"):
		var dims := str(opts["size"]).split("x")
		if dims.size() == 2:
			var sz := Vector2i(int(dims[0]), int(dims[1]))
			if sz.x > 0 and sz.y > 0:
				get_window().content_scale_size = sz
				get_window().size = sz
				_apply_safe_area()
	if opts.has("unlock"):
		var unlock_opt := str(opts["unlock"])
		var drink_ids: Array[String] = []
		for m in data.menu_list:
			if not bool(m.get("requiresKitchen", false)):
				drink_ids.append(str(m["id"]))
		var limit := drink_ids.size() if unlock_opt == "all" else mini(int(unlock_opt), drink_ids.size())
		for i in range(limit):
			var item_id := drink_ids[i]
			if int(state.items.get(item_id, 0)) < 1:
				state.items[item_id] = 1
			state.set_on_menu(item_id, true)
	if opts.has("coins"):
		state.coins = float(opts["coins"])

	var mode: String = str(opts.get("mode", ""))
	var shot: String = str(opts.get("screenshot", ""))

	if mode == "prep":
		_refresh_hud()
		if not shot.is_empty():
			_auto_mode = {"pending_shot": shot, "shot_frames": 6, "quit_after_shot": true}
	elif mode == "open":
		state.open_shop()
		sim.reset(42)
		# Advance ~45s so guests are queueing, ordering, seated, and server is moving!
		for _i in range(900):
			sim.step_fixed(0.05)
		building_view.update_visuals(0.05)
		_refresh_hud()
		if not shot.is_empty():
			_auto_mode = {"pending_shot": shot, "shot_frames": 6, "quit_after_shot": true}
	elif mode == "post_settle":
		state.open_shop()
		sim.reset(42)
		var guard := 0
		while state.phase != "prep" and guard < 12000:
			sim.step_fixed(0.05)
			guard += 1
		# Dismiss settlement modal so the cleared 1F building is clearly visible, then run 60s of prep.
		_report_overlay.visible = false
		building_view.drag_enabled = true
		for _i in range(1200): # 60.0s in prep
			sim.step_fixed(0.05)
		building_view.update_visuals(0.05)
		_refresh_hud()
		print("POST_SETTLE_CUSTOMERS:", sim.customers.size(), " SERVER_PHASE:", sim.servers[0]["phase"])
		if not shot.is_empty():
			_auto_mode = {"pending_shot": shot, "shot_frames": 6, "quit_after_shot": true}
	elif mode == "menu":
		if not opts.has("coins"):
			state.coins = 250.0
		_on_open_menu()
		_refresh_hud()
		var scroll_bottom := str(opts.get("scroll", "")) == "bottom"
		if not shot.is_empty():
			_auto_mode = {"pending_shot": shot, "shot_frames": 10 if scroll_bottom else 6, "quit_after_shot": true}
			if scroll_bottom:
				_auto_mode["scroll_menu_bottom"] = true
				_auto_mode["scroll_frames"] = 4
	elif mode == "bench":
		var preset_name: String = str(opts.get("preset", "full"))
		var dur := float(opts.get("seconds", str(BenchRunner.DEFAULT_DURATION)))
		var warmup := float(opts.get("warmup", str(BenchRunner.DEFAULT_WARMUP)))
		_on_open_benchmark()
		_start_benchmark(preset_name, dur, warmup)
		_auto_mode = {"quit_after_bench": true, "screenshot": shot}
