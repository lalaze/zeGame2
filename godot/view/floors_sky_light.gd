class_name FloorsSkyLight
extends RefCounted

## Port of src/render/floors/floors-sky-light.ts (with the parts of lighting.ts and business-light.ts it uses): what the
## time of day and the weather look like in the building, as plain numbers. FloorsSky draws them. Colours are 0xRRGGBB
## as numbers.

const SKY_WEATHERS: Array[String] = ["fair", "rain", "hot", "crisp", "market", "quiet", "snow"]
## The painted skies that follow the clock.
const SKY_TIMES: Array[String] = ["day", "dusk", "night"]
## Every painted sky: `clear` stands in for the day sky on a hot day, and `overcast` covers the others in rain and snow.
const SKY_NAMES: Array[String] = ["day", "dusk", "night", "clear", "overcast"]

## How much of each sky shows at these hours; between them the skies cross-fade: [hour, day, dusk, night].
const _SKY_KEYS: Array = [
	[0.0, 0.0, 0.0, 1.0], [5.5, 0.0, 0.0, 1.0], [6.5, 0.0, 1.0, 0.0], [8.0, 1.0, 0.0, 0.0], [15.5, 1.0, 0.0, 0.0], [17.5, 0.4, 0.6, 0.0],
	[18.5, 0.0, 1.0, 0.0], [19.25, 0.0, 0.6, 0.4], [20.0, 0.0, 0.1, 0.9], [21.0, 0.0, 0.0, 1.0], [24.0, 0.0, 0.0, 1.0],
]
const _WEATHER := {
	"fair": {"cover": 0.0, "clouds": 3.0, "drift": 9.0, "cloud": 0xffffff},
	"rain": {"cover": 1.0, "clouds": 5.0, "drift": 24.0, "cloud": 0xaab3c4, "fall": "rain", "pieces": 70.0, "wet": 0xc3ccdb},
	"hot": {"cover": 0.0, "clouds": 1.0, "drift": 5.0, "cloud": 0xffffff, "sun": true},
	"crisp": {"cover": 0.0, "clouds": 2.0, "drift": 16.0, "cloud": 0xf4f8ff, "fall": "leaves", "pieces": 9.0},
	"market": {"cover": 0.0, "clouds": 3.0, "drift": 9.0, "cloud": 0xffffff, "balloons": true},
	"quiet": {"cover": 0.0, "clouds": 2.0, "drift": 4.0, "cloud": 0xffffff, "bird": true},
	"snow": {"cover": 0.75, "clouds": 4.0, "drift": 8.0, "cloud": 0xdfe5ee, "fall": "snow", "pieces": 60.0, "wet": 0xe6ecf5},
}
## The light over the day: [hour, ambient, lamps, dark].
const _LIGHT_KEYS: Array = [
	[0.0, 0x5868a8, 1.0, 1.0], [5.5, 0x5868a8, 1.0, 1.0], [6.5, 0xd9b8c4, 0.5, 0.45], [8.0, 0xfff1df, 0.0, 0.0], [12.0, 0xffffff, 0.0, 0.0],
	[15.5, 0xfff3dc, 0.0, 0.0], [17.5, 0xffd6a0, 0.3, 0.1], [19.0, 0xc890a8, 0.8, 0.5], [20.0, 0x7e80b6, 1.0, 0.85], [21.0, 0x5868a8, 1.0, 1.0], [24.0, 0x5868a8, 1.0, 1.0],
]
## Clouds by time of day: white, lit peach at sunset, slate at night.
const _CLOUD_BY_TIME := {"day": 0xffffff, "dusk": 0xffcdb4, "night": 0x5d6899}
## Night over the overcast sky; the warm dimness of a lamp-lit room at night; night seen through a room's window.
const _COVER_NIGHT := 0x4a5586
const _ROOM_NIGHT := 0xc8a88e
const _GLASS_NIGHT := 0x4d5c98
## How much of the open sky's colour reaches what stands outside, and of the night's dimness the rooms.
const _OUTSIDE_SHARE := 0.82
const _ROOM_SHARE := 0.5

## Lamps painted on every floor's plate: {"x", "y", "reach", "power"?, "colour"?}.
const FLOOR_LAMPS := {
	"roof": [
		{"x": 553.0, "y": 31.0, "reach": 260.0}, {"x": 1117.0, "y": 28.0, "reach": 260.0},
		{"x": 360.0, "y": 213.0, "reach": 150.0, "power": 0.6}, {"x": 525.0, "y": 243.0, "reach": 150.0, "power": 0.6}, {"x": 708.0, "y": 230.0, "reach": 150.0, "power": 0.6},
		{"x": 905.0, "y": 195.0, "reach": 150.0, "power": 0.6}, {"x": 1335.0, "y": 205.0, "reach": 150.0, "power": 0.6},
		{"x": 205.0, "y": 295.0, "reach": 170.0, "power": 0.7}, {"x": 1518.0, "y": 533.0, "reach": 210.0},
	],
	"floor-3": _SEATING_LAMPS,
	"floor-2": _SEATING_LAMPS,
	"ground": [
		{"x": 465.0, "y": 112.0, "reach": 270.0}, {"x": 966.0, "y": 112.0, "reach": 270.0}, {"x": 118.0, "y": 300.0, "reach": 220.0, "power": 0.9},
		{"x": 1528.0, "y": 155.0, "reach": 210.0, "power": 0.8}, {"x": 1205.0, "y": 400.0, "reach": 170.0, "power": 0.45},
	],
	"basement": [{"x": 562.0, "y": 180.0, "reach": 290.0}, {"x": 1098.0, "y": 180.0, "reach": 290.0}, {"x": 362.0, "y": 362.0, "reach": 210.0, "power": 0.55, "colour": 0xffa860}],
}
const _SEATING_LAMPS: Array = [
	{"x": 465.0, "y": 130.0, "reach": 270.0}, {"x": 966.0, "y": 130.0, "reach": 270.0}, {"x": 722.0, "y": 300.0, "reach": 210.0, "power": 0.8}, {"x": 1528.0, "y": 152.0, "reach": 210.0, "power": 0.8},
]
## Lamps that come with the ceiling decor on the ground floor and the seating floors.
const CEILING_LAMPS := {
	"ceiling_lights": [
		{"x": 300.0, "y": 95.0, "reach": 150.0, "power": 0.55}, {"x": 500.0, "y": 95.0, "reach": 150.0, "power": 0.55}, {"x": 700.0, "y": 95.0, "reach": 150.0, "power": 0.55},
		{"x": 900.0, "y": 95.0, "reach": 150.0, "power": 0.55}, {"x": 1100.0, "y": 95.0, "reach": 150.0, "power": 0.55},
	],
	"ceiling_pendants": [{"x": 580.0, "y": 210.0, "reach": 240.0}, {"x": 835.0, "y": 210.0, "reach": 240.0}, {"x": 1090.0, "y": 210.0, "reach": 240.0}],
	"ceiling_chandelier": [{"x": 835.0, "y": 110.0, "reach": 320.0}],
}
## The ground floor's neon sign glows pink. Like its ceiling decor, it is drawn moved by FloorsLayout.GROUND_SHIFT.
const NEON_LAMP := {"x": 835.0, "y": 238.0, "reach": 170.0, "power": 0.4, "colour": 0xff9fb8}
const _DECORATED: Array[String] = ["ground", "floor-2", "floor-3"]
## Window glass inside the rooms that looks out on the day: at night it darkens with the sky (plate pixels).
const ROOM_WINDOWS := {
	"floor-3": [[135.0, 175.0], [245.0, 95.0], [245.0, 412.0], [135.0, 555.0]],
	"floor-2": [[135.0, 175.0], [245.0, 95.0], [245.0, 412.0], [135.0, 555.0]],
	"ground": [[143.0, 440.0], [143.0, 230.0], [165.0, 160.0], [205.0, 112.0], [245.0, 100.0], [272.0, 125.0], [272.0, 380.0]],
}
## The lamps painted on the front walls (pixels of frame/wall-*), lit when the walls are up.
const WALL_LAMPS := {
	"frame/wall-attic": [{"x": 553.0, "y": 458.0, "reach": 230.0}, {"x": 1117.0, "y": 455.0, "reach": 230.0}],
	"frame/wall-seating": [{"x": 600.0, "y": 372.0, "reach": 220.0}, {"x": 1066.0, "y": 372.0, "reach": 220.0}],
	"frame/wall-ground": [{"x": 104.0, "y": 282.0, "reach": 230.0}, {"x": 1566.0, "y": 282.0, "reach": 230.0}],
}
## The street lamp on the street's picture: its head and its pool of light.
const STREET_LAMP: Array = [{"x": 75.0, "y": 125.0, "reach": 230.0}, {"x": 130.0, "y": 420.0, "reach": 300.0, "power": 0.35}]


# ---------------------------------------------------------------- colours

static func _channel(c: int, shift: int) -> float:
	return float((c >> shift) & 255)


static func mix(a: int, b: int, t: float) -> int:
	var out := 0
	for shift: int in [16, 8, 0]:
		out |= int(JsMath.js_round(_channel(a, shift) * (1.0 - t) + _channel(b, shift) * t)) << shift
	return out


static func _blend(colours: Array) -> int:
	var total := 0.0
	for c: Array in colours:
		total += c[1]
	if total == 0.0:
		total = 1.0
	var out := 0
	for shift: int in [16, 8, 0]:
		var sum := 0.0
		for c: Array in colours:
			sum += _channel(c[0], shift) * c[1]
		out |= int(JsMath.js_round(sum / total)) << shift
	return out


static func multiply(a: int, b: int) -> int:
	var out := 0
	for shift: int in [16, 8, 0]:
		out |= int(JsMath.js_round(_channel(a, shift) * _channel(b, shift) / 255.0)) << shift
	return out


static func color(c: float, alpha: float = 1.0) -> Color:
	var n := int(c)
	return Color8((n >> 16) & 255, (n >> 8) & 255, n & 255, int(round(alpha * 255.0)))


# ---------------------------------------------------------------- the light

## The share of each clock sky at an hour, adding up to 1.
static func sky_times(hour: float) -> Dictionary:
	var h := fposmod(hour, 24.0)
	var i := 0
	while i < _SKY_KEYS.size() and _SKY_KEYS[i][0] <= h:
		i += 1
	i = maxi(0, i - 1)
	var a: Array = _SKY_KEYS[i]
	var b: Array = _SKY_KEYS[i + 1]
	var p: float = (h - a[0]) / (b[0] - a[0])
	var t := p * p * (3.0 - 2.0 * p)
	var day: float = a[1] + (b[1] - a[1]) * t
	var night: float = a[3] + (b[3] - a[3]) * t
	return {"day": day, "night": night, "dusk": maxf(0.0, 1.0 - day - night)}


## {"ambient", "dark", "lamps"} at an hour in a weather.
static func _light(hour: float, weather: String) -> Dictionary:
	var h := fposmod(hour, 24.0)
	var i := 0
	while i < _LIGHT_KEYS.size() and _LIGHT_KEYS[i][0] <= h:
		i += 1
	var a: Array = _LIGHT_KEYS[maxi(0, i - 1)]
	var b: Array = _LIGHT_KEYS[maxi(1, i)]
	var p: float = (h - a[0]) / (b[0] - a[0])
	var t := p * p * (3.0 - 2.0 * p)
	var out := {"ambient": mix(a[1], b[1], t), "dark": a[3] + (b[3] - a[3]) * t, "lamps": a[2] + (b[2] - a[2]) * t}
	match weather:
		"rain", "snow": # Snow has the grey light of rain.
			out["ambient"] = mix(out["ambient"], 0xaeb7c7, 0.55)
			out["lamps"] = maxf(out["lamps"], 0.4)
		"hot":
			out["ambient"] = mix(out["ambient"], 0xfff0d2, 0.3)
		"crisp":
			out["ambient"] = mix(out["ambient"], 0xe6eefc, 0.25)
	return out


## Everything the building shows for an hour of the clock (0 to 24) in a weather. `tops` has the top-edge colour of
## each painted sky; the sky goes on upward in it.
static func sky_look(hour: float, weather: String, tops: Dictionary) -> Dictionary:
	var look: Dictionary = _WEATHER.get(weather, _WEATHER["fair"])
	var light := _light(hour, weather)
	var times := sky_times(hour)
	var dark: float = light["dark"]
	var sun: bool = look.get("sun", false)
	var cover_tint := mix(0xffffff, _COVER_NIGHT, minf(1.0, dark * 1.05))
	var clear := _blend(SKY_TIMES.map(func(name: String) -> Array: return [tops["clear" if name == "day" and sun else name], times[name]]))
	var clouds := _blend(SKY_TIMES.map(func(name: String) -> Array: return [_CLOUD_BY_TIME[name], times[name]]))
	var open: float = 1.0 - look["cover"]
	var outside := multiply(mix(0xffffff, light["ambient"], _OUTSIDE_SHARE), look.get("wet", 0xffffff))
	return {
		"times": times, "cover": look["cover"], "clear": sun, "coverTint": float(cover_tint),
		"top": float(mix(clear, multiply(tops["overcast"], cover_tint), look["cover"])),
		"outside": float(outside),
		"glass": float(multiply(mix(0xffffff, _GLASS_NIGHT, minf(1.0, dark) * 0.9), mix(0xffffff, outside, 0.4))),
		"room": float(mix(0xffffff, _ROOM_NIGHT, dark * _ROOM_SHARE)),
		"dark": dark, "lamps": light["lamps"],
		"stars": times["night"] * open,
		"moon": minf(1.0, maxf(0.0, (times["night"] - 0.2) / 0.6)) * open,
		"sun": times["day"] if sun else 0.0,
		"clouds": look["clouds"], "drift": look["drift"],
		"cloudTint": float(multiply(clouds, look["cloud"])), "cloudAlpha": 1.0 - 0.2 * times["night"],
		"fall": look.get("fall"), "pieces": look.get("pieces", 0.0),
		"balloons": look.get("balloons", false) and times["night"] < 0.5, "bird": look.get("bird", false) and times["night"] < 0.5,
	}


## The hour the building shows: the business clock's, 08:00 while the day is being planned.
static func sky_hour(state: Dictionary) -> float:
	var minutes := CoreBusinessClock.business_clock_minutes(0.0 if state["phase"] == "prep" else state["dayTime"])
	return fposmod(floor(minutes), 1440.0) / 60.0


# ---------------------------------------------------------------- lamps

## The lamps a floor has with this decor on.
static func floor_lamps(floor_id: String, equipped: Dictionary = {}) -> Array:
	var lamps: Array = FLOOR_LAMPS[floor_id].duplicate()
	if _DECORATED.has(floor_id):
		lamps.append_array(_moved(floor_id, CEILING_LAMPS.get(equipped.get("ceiling", ""), []), equipped.get("ceiling", "")))
	if floor_id == "ground" and not equipped.get("neon", "").is_empty() and equipped["neon"] != "neon_none":
		lamps.append_array(_moved(floor_id, [NEON_LAMP], equipped["neon"]))
	return lamps


static func _moved(floor_id: String, lamps: Array, item: String) -> Array:
	if floor_id != "ground" or not FloorsLayout.GROUND_SHIFT.has(item):
		return lamps
	var shift: Dictionary = FloorsLayout.GROUND_SHIFT[item]
	return lamps.map(func(l: Dictionary) -> Dictionary:
		var out := l.duplicate()
		out["x"] += shift["dx"]
		out["y"] += shift["dy"]
		return out)
