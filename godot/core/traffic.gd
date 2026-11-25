class_name CoreTraffic
extends RefCounted

# Port of src/game/traffic.ts

const _CALM_END: float = 30.0
const _RISE_END: float = 45.0
const _BUSY_END: float = 75.0
const _RAMP_SECONDS: float = 15.0

static var TRAFFIC_CYCLE_SECONDS: float = RulesData.section("traffic")["TRAFFIC_CYCLE_SECONDS"]
static var TRAFFIC_AMPLITUDE: float = RulesData.section("traffic")["TRAFFIC_AMPLITUDE"]
static var TRAFFIC_MIN_MULTIPLIER: float = RulesData.section("traffic")["TRAFFIC_MIN_MULTIPLIER"]
static var TRAFFIC_MAX_MULTIPLIER: float = RulesData.section("traffic")["TRAFFIC_MAX_MULTIPLIER"]

static func _slope() -> float:
	return (TRAFFIC_MAX_MULTIPLIER - TRAFFIC_MIN_MULTIPLIER) / _RAMP_SECONDS

static func _cycle_time(day_time: float) -> float:
	if not is_finite(day_time):
		return 0.0
	var clamped: float = JsMath.js_max(0.0, day_time)
	return fmod(clamped, TRAFFIC_CYCLE_SECONDS)

static func traffic_at(day_time: float) -> Dictionary:
	var time := _cycle_time(day_time)
	var min_m := TRAFFIC_MIN_MULTIPLIER
	var max_m := TRAFFIC_MAX_MULTIPLIER
	var slope := _slope()
	if time < _CALM_END:
		return {
			"phase": "calm",
			"multiplier": min_m,
			"nextPhase": "rising",
			"secondsToNextPhase": _CALM_END - time,
		}
	if time < _RISE_END:
		return {
			"phase": "rising",
			"multiplier": min_m + slope * (time - _CALM_END),
			"nextPhase": "busy",
			"secondsToNextPhase": _RISE_END - time,
		}
	if time < _BUSY_END:
		return {
			"phase": "busy",
			"multiplier": max_m,
			"nextPhase": "easing",
			"secondsToNextPhase": _BUSY_END - time,
		}
	return {
		"phase": "easing",
		"multiplier": max_m - slope * (time - _BUSY_END),
		"nextPhase": "calm",
		"secondsToNextPhase": TRAFFIC_CYCLE_SECONDS - time,
	}

static func _cycle_integral(time: float) -> float:
	var min_m := TRAFFIC_MIN_MULTIPLIER
	var max_m := TRAFFIC_MAX_MULTIPLIER
	var slope := _slope()
	if time <= _CALM_END:
		return time * min_m
	var calm_area := _CALM_END * min_m
	if time <= _RISE_END:
		var ramp := time - _CALM_END
		return calm_area + ramp * min_m + slope * ramp * ramp / 2.0
	var rise_area := calm_area + _RAMP_SECONDS
	if time <= _BUSY_END:
		return rise_area + (time - _RISE_END) * max_m
	var busy_area := rise_area + (_BUSY_END - _RISE_END) * max_m
	var ramp := time - _BUSY_END
	return busy_area + ramp * max_m - slope * ramp * ramp / 2.0

static func integrated_traffic_seconds(day_time: float, dt: float) -> float:
	if not is_finite(dt) or dt <= 0.0:
		return 0.0
	var cycle := TRAFFIC_CYCLE_SECONDS
	var time := _cycle_time(day_time)
	var cycles: float = floor(dt / cycle)
	var end := time + fmod(dt, cycle)
	var partial: float
	if end <= cycle:
		partial = _cycle_integral(end) - _cycle_integral(time)
	else:
		partial = cycle - _cycle_integral(time) + _cycle_integral(end - cycle)
	return cycles * cycle + partial
