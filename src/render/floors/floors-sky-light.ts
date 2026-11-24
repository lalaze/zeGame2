// What the time of day and the weather look like in the cross-section building, as plain numbers:
// floors-sky.ts draws them. Nothing here touches Phaser, so it can be tested.
//
// The game's clock is the pixel view's (render/business-light.ts): 08:00 while the day is being
// planned (`prep`), 08:00 to 20:00 while the café is open, held at closing time (`closing`, by then
// 20:00 or a little before) until the last guest leaves. So a day runs morning, noon, afternoon,
// golden hour (17:30), sunset (19:00) and nightfall (20:00); deep night (21:00 on) is only seen
// with the preview hour. The weather is the day's condition (game/conditions.ts): fair, rain, hot,
// crisp, market, quiet. Snow is painted too, but no condition brings it yet.
import type { ConditionId } from '../../game/conditions';
import type { GameState } from '../../game/state';
import { businessLightDate } from '../business-light';
import { mix } from '../color';
import { lightingAt, weatherLight } from '../lighting';
import { GROUND_SHIFT, type FloorId } from './floors-layout';

export type SkyWeather = ConditionId | 'snow';
export const SKY_WEATHERS: readonly SkyWeather[] = ['fair', 'rain', 'hot', 'crisp', 'market', 'quiet', 'snow'];
/** The painted skies that follow the clock (build/frame/sky.webp, build/sky/{dusk,night}.webp). */
export type SkyTime = 'day' | 'dusk' | 'night';
export const SKY_TIMES: readonly SkyTime[] = ['day', 'dusk', 'night'];
/**
 * Every painted sky: `clear` (the day sky without its clouds) stands in for the day sky on a hot
 * day, and `overcast` covers the others in rain and snow (build/sky/{clear,overcast}.webp).
 */
export type SkyName = SkyTime | 'clear' | 'overcast';
export const SKY_NAMES: readonly SkyName[] = [...SKY_TIMES, 'clear', 'overcast'];
/** What falls outside the building. */
export type Fall = 'rain' | 'snow' | 'leaves';

/** How much of each sky shows at these hours; between them the skies cross-fade. Dawn borrows the dusk sky. */
const SKY_KEYS: readonly { hour: number; day: number; dusk: number; night: number }[] = [
  { hour: 0, day: 0, dusk: 0, night: 1 },
  { hour: 5.5, day: 0, dusk: 0, night: 1 },
  { hour: 6.5, day: 0, dusk: 1, night: 0 },
  { hour: 8, day: 1, dusk: 0, night: 0 },
  { hour: 15.5, day: 1, dusk: 0, night: 0 },
  { hour: 17.5, day: .4, dusk: .6, night: 0 },
  { hour: 18.5, day: 0, dusk: 1, night: 0 },
  { hour: 19.25, day: 0, dusk: .6, night: .4 },
  { hour: 20, day: 0, dusk: .1, night: .9 },
  { hour: 21, day: 0, dusk: 0, night: 1 },
  { hour: 24, day: 0, dusk: 0, night: 1 },
];

/** The share of each clock sky at an hour, adding up to 1. */
export function skyTimes(hour: number): Record<SkyTime, number> {
  const h = ((hour % 24) + 24) % 24;
  const i = Math.max(0, SKY_KEYS.findIndex(k => k.hour > h) - 1);
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const p = (h - a.hour) / (b.hour - a.hour), t = p * p * (3 - 2 * p);
  const day = a.day + (b.day - a.day) * t, night = a.night + (b.night - a.night) * t;
  return { day, night, dusk: Math.max(0, 1 - day - night) };
}

interface WeatherLook {
  /** How much of the overcast sky covers the clock's sky. */
  cover: number;
  /** Drifting clouds, their speed in building pixels a second, and their colour by day. */
  clouds: number;
  drift: number;
  cloud: string;
  fall?: Fall;
  /** How many pieces fall behind the building and in front of it. */
  pieces?: number;
  /** Multiplied into what stands outside as well: wet stone is darker, snow light is pale. */
  wet?: string;
  /** A cloudless day sky with a painted sun in it, balloons rising from the town, a bird gliding past. */
  sun?: boolean;
  balloons?: boolean;
  bird?: boolean;
}

const WEATHER: Record<SkyWeather, WeatherLook> = {
  fair: { cover: 0, clouds: 3, drift: 9, cloud: '#ffffff' },
  rain: { cover: 1, clouds: 5, drift: 24, cloud: '#aab3c4', fall: 'rain', pieces: 70, wet: '#c3ccdb' },
  hot: { cover: 0, clouds: 1, drift: 5, cloud: '#ffffff', sun: true },
  crisp: { cover: 0, clouds: 2, drift: 16, cloud: '#f4f8ff', fall: 'leaves', pieces: 9 },
  market: { cover: 0, clouds: 3, drift: 9, cloud: '#ffffff', balloons: true },
  quiet: { cover: 0, clouds: 2, drift: 4, cloud: '#ffffff', bird: true },
  snow: { cover: .75, clouds: 4, drift: 8, cloud: '#dfe5ee', fall: 'snow', pieces: 60, wet: '#e6ecf5' },
};

export interface SkyLook {
  /** The clock's skies, adding up to 1, and how much the overcast sky covers them. */
  times: Record<SkyTime, number>;
  cover: number;
  /** Whether the day sky is the cloudless one. */
  clear: boolean;
  /** Multiplied into the overcast sky, which is painted by day. */
  coverTint: number;
  /** The colour above the sky pictures (their top edges, blended the same way). */
  top: number;
  /** Multiplied into what stands outside: street, roof, pillars, front walls. White by day. */
  outside: number;
  /** Multiplied into the rooms: they dim a little at night and stay warm. */
  room: number;
  /** Multiplied into the glass of the rooms' own windows, which are painted looking out on a sunny day. */
  glass: number;
  /** How dark it is outside, 0 to 1, and how brightly the lamps glow, 0 to 1. */
  dark: number;
  lamps: number;
  stars: number;
  moon: number;
  sun: number;
  clouds: number;
  drift: number;
  cloudTint: number;
  cloudAlpha: number;
  fall: Fall | null;
  pieces: number;
  balloons: boolean;
  bird: boolean;
}

const num = (hex: string) => parseInt(hex.slice(1, 7), 16);
const blend = (colours: [string, number][]): string => {
  const total = colours.reduce((sum, [, w]) => sum + w, 0) || 1;
  const channel = (shift: number) => Math.round(colours.reduce((sum, [hex, w]) => sum + ((num(hex) >> shift) & 255) * w, 0) / total);
  return '#' + [16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('');
};
const multiply = (a: string, b: string): string =>
  '#' + [16, 8, 0].map(shift => Math.round(((num(a) >> shift) & 255) * ((num(b) >> shift) & 255) / 255).toString(16).padStart(2, '0')).join('');

/** The top-edge colour of each painted sky (build/sky/sky.json); the game continues the sky upward in it. */
export type SkyTops = Record<SkyName, string>;
/** Clouds by time of day: white, lit peach at sunset, slate at night. */
const CLOUD_BY_TIME: Record<SkyTime, string> = { day: '#ffffff', dusk: '#ffcdb4', night: '#5d6899' };
/** Night over the overcast sky, which is painted in daylight. */
const COVER_NIGHT = '#4a5586';
/** The warm dimness of a lamp-lit room at night. */
const ROOM_NIGHT = '#c8a88e';
/** Night seen through a room's window. */
const GLASS_NIGHT = '#4d5c98';
/** How much of the open sky's colour reaches what stands outside, and of the night's dimness the rooms. */
const OUTSIDE_SHARE = .82, ROOM_SHARE = .5;

/** Everything the building shows for an hour of the clock (0 to 24) in a weather. */
export function skyLook(hour: number, weather: SkyWeather, tops: SkyTops): SkyLook {
  const look = WEATHER[weather] ?? WEATHER.fair;
  // Snow has the grey light of rain; the other kinds are the pixel view's own.
  const light = weatherLight(lightingAt(hour), weather === 'snow' ? 'rain' : weather);
  const times = skyTimes(hour);
  const coverTint = mix('#ffffff', COVER_NIGHT, Math.min(1, light.dark * 1.05));
  const clear = blend(SKY_TIMES.map(name => [tops[name === 'day' && look.sun ? 'clear' : name], times[name]]));
  const clouds = blend(SKY_TIMES.map(name => [CLOUD_BY_TIME[name], times[name]]));
  const open = 1 - look.cover;
  const outside = multiply(mix('#ffffff', light.ambient, OUTSIDE_SHARE), look.wet ?? '#ffffff');
  return {
    times, cover: look.cover, clear: !!look.sun, coverTint: num(coverTint),
    top: num(mix(clear, multiply(tops.overcast, coverTint), look.cover)),
    outside: num(outside),
    glass: num(multiply(mix('#ffffff', GLASS_NIGHT, Math.min(1, light.dark) * .9), mix('#ffffff', outside, .4))),
    room: num(mix('#ffffff', ROOM_NIGHT, light.dark * ROOM_SHARE)),
    dark: light.dark, lamps: light.lamps,
    stars: times.night * open,
    moon: Math.min(1, Math.max(0, (times.night - .2) / .6)) * open,
    sun: look.sun ? times.day : 0,
    clouds: look.clouds, drift: look.drift,
    cloudTint: num(multiply(clouds, look.cloud)), cloudAlpha: 1 - .2 * times.night,
    fall: look.fall ?? null, pieces: look.pieces ?? 0,
    balloons: !!look.balloons && times.night < .5, bird: !!look.bird && times.night < .5,
  };
}

/** The hour the building shows: the pixel view's business clock. */
export function skyHour(state: Pick<GameState, 'phase' | 'dayTime'>): number {
  const date = businessLightDate(state);
  return date.getHours() + date.getMinutes() / 60;
}

/** `?floors&hour=21&weather=rain` on the dev server shows that hour (0 to 24) and weather; anything else is ignored. */
export function previewSky(search: string): { hour?: number; weather?: SkyWeather } {
  const params = new URLSearchParams(search), out: { hour?: number; weather?: SkyWeather } = {};
  const hour = params.get('hour'), weather = params.get('weather');
  if (hour !== null && hour.trim() !== '' && Number.isFinite(Number(hour)) && Number(hour) >= 0 && Number(hour) <= 24) out.hour = Number(hour);
  if (weather && (SKY_WEATHERS as readonly string[]).includes(weather)) out.weather = weather as SkyWeather;
  return out;
}

// ------------------------------------------------------------ lamps

/** A lamp painted on a floor's plate: where its light is (plate pixels), how far it reaches, how strong and what colour. */
export interface Lamp { x: number; y: number; reach: number; power?: number; colour?: number }
const lamp = (x: number, y: number, reach = 250, power = 1, colour?: number): Lamp => ({ x, y, reach, power, colour });

/** The lamps every floor's plate has, found by eye on the plates (the kits' angle plates and the decor build's fixtures layers). */
export const FLOOR_LAMPS: Record<FloorId, readonly Lamp[]> = {
  // The attic terrace: two wall lamps under the gable, the string of bulbs, the lanterns in the vine, the stair door's lamp.
  roof: [
    lamp(553, 31, 260), lamp(1117, 28, 260),
    lamp(360, 213, 150, .6), lamp(525, 243, 150, .6), lamp(708, 230, 150, .6), lamp(905, 195, 150, .6), lamp(1335, 205, 150, .6),
    lamp(205, 295, 170, .7), lamp(1518, 533, 210),
  ],
  // A seating floor: two ceiling lamps, the table lamp on the sideboard, the sconce by the stairs.
  'floor-3': [lamp(465, 130, 270), lamp(966, 130, 270), lamp(722, 300, 210, .8), lamp(1528, 152, 210, .8)],
  'floor-2': [lamp(465, 130, 270), lamp(966, 130, 270), lamp(722, 300, 210, .8), lamp(1528, 152, 210, .8)],
  // The ground floor: two ceiling lamps, the lantern by the side window, the sconce by the stairs, the lit cake display.
  ground: [lamp(465, 112, 270), lamp(966, 112, 270), lamp(118, 300, 220, .9), lamp(1528, 155, 210, .8), lamp(1205, 400, 170, .45)],
  // The basement: a lamp under each arch, and the oven's fire.
  basement: [lamp(562, 180, 290), lamp(1098, 180, 290), lamp(362, 362, 210, .55, 0xffa860)],
};
/** Lamps that come with the ceiling decor on the ground floor and the seating floors (the decor build's ceiling layers). */
export const CEILING_LAMPS: Record<string, readonly Lamp[]> = {
  ceiling_lights: [300, 500, 700, 900, 1100].map(x => lamp(x, 95, 150, .55)),
  ceiling_pendants: [lamp(580, 210, 240), lamp(835, 210, 240), lamp(1090, 210, 240)],
  ceiling_chandelier: [lamp(835, 110, 320)],
};
/** The ground floor's neon sign glows pink. Like its ceiling decor, it is drawn moved by GROUND_SHIFT (floors-layout.ts). */
export const NEON_LAMP: Lamp = lamp(835, 238, 170, .4, 0xff9fb8);
const DECORATED: readonly FloorId[] = ['ground', 'floor-2', 'floor-3'];

/** The lamps a floor has with this decor on. */
export function floorLamps(floor: FloorId, equipped: Partial<Record<string, string>> = {}): Lamp[] {
  const lamps = [...FLOOR_LAMPS[floor]];
  const moved = (lights: readonly Lamp[], item?: string) => {
    const shift = floor === 'ground' ? GROUND_SHIFT[item ?? ''] : undefined;
    return shift ? lights.map(l => ({ ...l, x: l.x + shift.dx, y: l.y + shift.dy })) : lights;
  };
  if (DECORATED.includes(floor)) lamps.push(...moved(CEILING_LAMPS[equipped.ceiling ?? ''] ?? [], equipped.ceiling));
  if (floor === 'ground' && equipped.neon && equipped.neon !== 'neon_none') lamps.push(...moved([NEON_LAMP], equipped.neon));
  return lamps;
}

/** Window glass inside the rooms that looks out on the day: at night it darkens with the sky (plate pixels). */
export const ROOM_WINDOWS: Partial<Record<FloorId, readonly [number, number][]>> = {
  'floor-3': [[135, 175], [245, 95], [245, 412], [135, 555]],
  'floor-2': [[135, 175], [245, 95], [245, 412], [135, 555]],
  ground: [[143, 440], [143, 230], [165, 160], [205, 112], [245, 100], [272, 125], [272, 380]],
};
/**
 * The lamps painted on the front walls (pixels of build/frame/wall-*.webp), lit when the walls are up:
 * the gable's two, the two between a seating floor's windows, the shopfront's lanterns.
 */
export const WALL_LAMPS: Record<string, readonly Lamp[]> = {
  'frame/wall-attic': [lamp(553, 458, 230), lamp(1117, 455, 230)],
  'frame/wall-seating': [lamp(600, 372, 220), lamp(1066, 372, 220)],
  'frame/wall-ground': [lamp(104, 282, 230), lamp(1566, 282, 230)],
};
/** The street lamp on the street's picture (pixels of build/frame/street.webp): its head and its pool of light. */
export const STREET_LAMP: readonly Lamp[] = [lamp(75, 125, 230), lamp(130, 420, 300, .35)];
