class_name BenchRunner
extends RefCounted

## 30-second performance benchmark recorder using monotonic wall-clock `Time.get_ticks_usec()`.
## Excludes texture load, initial upload frame, and a 2.0-second warmup window from frame samples,
## reporting load/upload time, display refresh rate, renderer name, p50/p95/max, >25ms count,
## draw calls, VRAM, texture & static memory to `user://bench.json` (`full`/`half` separated).

const BENCH_PATH := "user://bench.json"
const DEFAULT_DURATION := 30.0
const DEFAULT_WARMUP := 2.0
const PACING_MAX_RATIO := 1.05

var output_path: String = BENCH_PATH
var refresh_rate_override: float = -INF
var vsync_mode_override: String = ""

var running: bool = false
var preset: String = "full"
var duration: float = DEFAULT_DURATION
var warmup_duration: float = DEFAULT_WARMUP
var elapsed: float = 0.0
var phase: String = "idle" # "idle" | "warmup" | "sampling"
var load_ms: float = 0.0
var upload_ms: float = 0.0

var _start_usec: int = 0
var _warmup_start_usec: int = 0
var _sample_start_usec: int = 0
var _last_tick_usec: int = 0
var _first_frame_done: bool = false

var _frame_ms: Array[float] = []
var _slow_frames: int = 0
var _draw_call_sum: float = 0.0
var _draw_call_peak: int = 0
var _vram_peak: float = 0.0
var _tex_peak: float = 0.0
var _static_peak: float = 0.0
var _last_result: Dictionary = {}


func start(
	target_preset: String,
	target_duration: float = DEFAULT_DURATION,
	target_warmup: float = DEFAULT_WARMUP,
	measured_load_ms: float = 0.0
) -> void:
	preset = "half" if target_preset == "half" else "full"
	duration = maxf(0.1, target_duration)
	warmup_duration = maxf(0.0, target_warmup)
	load_ms = maxf(0.0, measured_load_ms)
	upload_ms = 0.0
	elapsed = 0.0
	running = true
	phase = "warmup" if warmup_duration > 0.0 else "sampling"
	_start_usec = Time.get_ticks_usec()
	_warmup_start_usec = 0
	_sample_start_usec = 0
	_last_tick_usec = 0
	_first_frame_done = false
	_frame_ms.clear()
	_slow_frames = 0
	_draw_call_sum = 0.0
	_draw_call_peak = 0
	_vram_peak = 0.0
	_tex_peak = 0.0
	_static_peak = 0.0


func cancel() -> void:
	running = false
	phase = "idle"


## Sample one rendered frame using wall-clock `Time.get_ticks_usec()` (never `_process(delta)`).
## Returns true once sampling completes and writes `user://bench.json`.
func sample() -> bool:
	if not running:
		return false
	var now := Time.get_ticks_usec()

	# First frame after start covers GPU texture upload / pipeline setup: never counted as a sample.
	if not _first_frame_done:
		_first_frame_done = true
		upload_ms = float(now - _start_usec) / 1000.0
		_last_tick_usec = now
		if phase == "warmup":
			_warmup_start_usec = now
		else:
			_sample_start_usec = now
		return false

	if phase == "warmup":
		_last_tick_usec = now
		var w_elapsed := float(now - _warmup_start_usec) / 1_000_000.0
		if w_elapsed >= warmup_duration:
			phase = "sampling"
			_sample_start_usec = now
		return false

	# Sampling phase: exact wall-clock frame interval & total elapsed time.
	var frame_usec := now - _last_tick_usec
	_last_tick_usec = now
	var ms := float(frame_usec) / 1000.0
	elapsed = float(now - _sample_start_usec) / 1_000_000.0
	_frame_ms.append(ms)
	if ms > 25.0:
		_slow_frames += 1

	var draws := int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	_draw_call_sum += float(draws)
	if draws > _draw_call_peak:
		_draw_call_peak = draws
	_vram_peak = maxf(_vram_peak, Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED))
	_tex_peak = maxf(_tex_peak, Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED))
	_static_peak = maxf(_static_peak, Performance.get_monitor(Performance.MEMORY_STATIC))

	if elapsed >= duration:
		running = false
		phase = "idle"
		_last_result = _build_result()
		_save_result(_last_result)
		return true
	return false


func is_warming_up() -> bool:
	return running and phase == "warmup"


func warmup_remaining_seconds() -> float:
	if not is_warming_up():
		return 0.0
	if _warmup_start_usec <= 0:
		return warmup_duration
	var w_elapsed := float(Time.get_ticks_usec() - _warmup_start_usec) / 1_000_000.0
	return maxf(0.0, warmup_duration - w_elapsed)


func remaining_seconds() -> float:
	if not running:
		return 0.0
	if phase == "warmup":
		return duration
	return maxf(0.0, duration - elapsed)


func last_result() -> Dictionary:
	return _last_result


static func vsync_mode_name(mode: int) -> String:
	match mode:
		DisplayServer.VSYNC_DISABLED:
			return "disabled"
		DisplayServer.VSYNC_ENABLED:
			return "enabled"
		DisplayServer.VSYNC_ADAPTIVE:
			return "adaptive"
		DisplayServer.VSYNC_MAILBOX:
			return "mailbox"
		_:
			return "unknown(%d)" % mode


static func evaluate_pacing(avg_fps: float, raw_refresh_hz: float) -> Dictionary:
	if is_nan(raw_refresh_hz) or is_inf(raw_refresh_hz) or raw_refresh_hz <= 0.0:
		return {
			"refresh_rate_hz": null,
			"pacing_invalid": false,
			"pacing_checked": false,
			"pacing_status": "unchecked",
		}
	var hz := snappedf(raw_refresh_hz, 0.1)
	var invalid := avg_fps > PACING_MAX_RATIO * raw_refresh_hz
	return {
		"refresh_rate_hz": hz,
		"pacing_invalid": invalid,
		"pacing_checked": true,
		"pacing_status": "invalid" if invalid else "ok",
	}


func _build_result() -> Dictionary:
	var n := _frame_ms.size()
	var sorted := _frame_ms.duplicate()
	sorted.sort()
	var avg_fps := float(n) / maxf(0.001, elapsed)
	var p50 := _percentile(sorted, 0.50)
	var p95 := _percentile(sorted, 0.95)
	var max_ms := float(sorted[n - 1]) if n > 0 else 0.0
	var avg_draws := _draw_call_sum / float(maxi(1, n))

	var win_size := DisplayServer.window_get_size()
	var raw_hz := DisplayServer.screen_get_refresh_rate() if is_inf(refresh_rate_override) else refresh_rate_override
	var pacing := evaluate_pacing(avg_fps, raw_hz)
	var vsync_str := vsync_mode_override if not vsync_mode_override.is_empty() else vsync_mode_name(DisplayServer.window_get_vsync_mode())
	var render_method := RenderingServer.get_current_rendering_method()
	var render_driver := RenderingServer.get_current_rendering_driver_name()
	var renderer_str := "%s (%s)" % [render_method, render_driver] if not render_driver.is_empty() else render_method

	var model := OS.get_model_name()
	var adapter := RenderingServer.get_video_adapter_name()
	var device_str := model
	if device_str.is_empty() or device_str == "GenericDevice":
		device_str = "%s (%s)" % [OS.get_name(), adapter if not adapter.is_empty() else "CPU"]
	elif not adapter.is_empty() and not device_str.contains(adapter):
		device_str = "%s / %s" % [device_str, adapter]

	return {
		"preset": preset,
		"seed": 1337,
		"actors": 30,
		"warmup_sec": snappedf(warmup_duration, 0.01),
		"load_ms": snappedf(load_ms, 0.01),
		"upload_ms": snappedf(upload_ms, 0.01),
		"load_total_ms": snappedf(load_ms + upload_ms, 0.01),
		"duration_sec": snappedf(elapsed, 0.01),
		"frames": n,
		"avg_fps": snappedf(avg_fps, 0.1),
		"frame_ms_p50": snappedf(p50, 0.01),
		"frame_ms_p95": snappedf(p95, 0.01),
		"frame_ms_max": snappedf(max_ms, 0.01),
		"frames_over_25ms": _slow_frames,
		"draw_calls_avg": snappedf(avg_draws, 0.1),
		"draw_calls_peak": _draw_call_peak,
		"video_mem_mb": snappedf(_vram_peak / (1024.0 * 1024.0), 0.1),
		"texture_mem_mb": snappedf(_tex_peak / (1024.0 * 1024.0), 0.1),
		"static_mem_mb": snappedf(_static_peak / (1024.0 * 1024.0), 0.1),
		"vsync_mode": vsync_str,
		"refresh_rate_hz": pacing["refresh_rate_hz"],
		"pacing_invalid": pacing["pacing_invalid"],
		"pacing_checked": pacing["pacing_checked"],
		"pacing_status": pacing["pacing_status"],
		"renderer": renderer_str,
		"device": device_str,
		"resolution": "%dx%d" % [win_size.x, win_size.y],
		"timestamp": Time.get_datetime_string_from_system(true),
	}


static func _percentile(sorted: Array, q: float) -> float:
	if sorted.is_empty():
		return 0.0
	var idx := clampi(int(ceil(q * float(sorted.size()))) - 1, 0, sorted.size() - 1)
	return float(sorted[idx])


func _save_result(result: Dictionary) -> void:
	if output_path.is_empty():
		return
	var store: Dictionary = {"presets": {}}
	if FileAccess.file_exists(output_path):
		var f_read := FileAccess.open(output_path, FileAccess.READ)
		if f_read != null:
			var parsed: Variant = JSON.parse_string(f_read.get_as_text())
			f_read.close()
			if typeof(parsed) == TYPE_DICTIONARY:
				store = parsed
				if not store.has("presets") or typeof(store["presets"]) != TYPE_DICTIONARY:
					store["presets"] = {}
	store["latest"] = result
	store["presets"][preset] = result
	var f_write := FileAccess.open(output_path, FileAccess.WRITE)
	if f_write != null:
		f_write.store_string(JSON.stringify(store, "  ") + "\n")
		f_write.close()
