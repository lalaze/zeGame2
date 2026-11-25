class_name CoreClock
extends RefCounted

## The wall clock, for the few rules that read it themselves (`Date.now()` in TypeScript).
## Milliseconds since 1970. Tests set `override`.

static var override: float = NAN


static func now() -> float:
	return floor(Time.get_unix_time_from_system() * 1000.0) if is_nan(override) else override
