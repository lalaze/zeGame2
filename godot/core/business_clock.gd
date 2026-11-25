class_name CoreBusinessClock
extends RefCounted

# Port of src/game/business-clock.ts

static var BUSINESS_OPEN_HOUR: float = RulesData.section("business-clock")["BUSINESS_OPEN_HOUR"]
static var BUSINESS_HOURS: float = RulesData.section("business-clock")["BUSINESS_HOURS"]
static var SECONDS_PER_BUSINESS_HOUR: float = RulesData.section("business-clock")["SECONDS_PER_BUSINESS_HOUR"]

static func business_seconds(seconds: float) -> float:
	return seconds * 3600.0 / SECONDS_PER_BUSINESS_HOUR

static func business_elapsed_minutes(seconds: float) -> float:
	var elapsed: float = (seconds if seconds > 0.0 else 0.0) if is_finite(seconds) else 0.0
	var frac: float = JsMath.js_min(1.0, elapsed / CoreData.DAY_SECONDS)
	return floor(frac * BUSINESS_HOURS * 60.0)

static func business_clock_minutes(seconds: float) -> float:
	return BUSINESS_OPEN_HOUR * 60.0 + business_elapsed_minutes(seconds)

static func _hours_and_minutes(minutes: float, pad_hours: bool = false) -> String:
	var h_str := JsMath.number_to_string(floor(minutes / 60.0))
	if pad_hours and h_str.length() < 2:
		h_str = "0".repeat(2 - h_str.length()) + h_str
	var m_str := JsMath.number_to_string(fmod(minutes, 60.0))
	if m_str.length() < 2:
		m_str = "0".repeat(2 - m_str.length()) + m_str
	return "%s:%s" % [h_str, m_str]

static func format_business_clock(seconds: float) -> String:
	return _hours_and_minutes(business_clock_minutes(seconds), true)

static func format_business_duration(seconds: float) -> String:
	return _hours_and_minutes(business_elapsed_minutes(seconds), false)
