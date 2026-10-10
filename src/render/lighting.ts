// How the light changes over the day. Each moment blends between keyframes: night,
// dawn, morning, noon, afternoon, golden hour, sunset and dusk. Everything that
// depends on the time of day (window skies, sunbeams, the color grade, lamps)
// reads from one Lighting value, so they always agree.
import type { AreaId } from '../game/regions';
import { mix } from './color';

export interface Sun {
  /** Progress across the sky: 0 at sunrise, 1 at sunset. */
  x: number;
  /** Height above the horizon, 0 to 1; 0 while it's down. */
  elevation: number;
  /** How bright the beams through windows are, 0 to 1. */
  strength: number;
  /** Color of the light it casts. */
  color: string;
  /** Color of the disc itself. */
  disc: string;
}

export interface Lighting {
  /** Color the scene is multiplied by under the open sky; white leaves it as painted. */
  ambient: string;
  /** How dark it is outside, 0 (day) to 1 (night). */
  dark: number;
  /** How brightly the lamps glow, 0 (off) to 1. */
  lamps: number;
  /** Window sky bands, top to bottom. */
  sky: readonly [string, string, string];
  cloud: string;
  sun: Sun;
}

interface Key {
  hour: number;
  ambient: string;
  sky: [string, string, string];
  cloud: string;
  sun: number;
  sunColor: string;
  disc: string;
  lamps: number;
  dark: number;
}

const NIGHT: Omit<Key, 'hour'> = {
  ambient: '#6c72a8',
  sky: ['#141a3c', '#1e2452', '#262d63'],
  cloud: '#3a4270',
  sun: 0,
  sunColor: '#ffe9b0',
  disc: '#fff6b0',
  lamps: 1,
  dark: 1,
};

const KEYS: Key[] = [
  { hour: 0, ...NIGHT },
  { hour: 5.5, ...NIGHT },
  { hour: 6.5, ambient: '#d9b8c4', sky: ['#f6b9a0', '#f9cfae', '#fbe2c3'], cloud: '#ffe2d6', sun: 0.3, sunColor: '#ffd2b0', disc: '#ffd9a0', lamps: 0.5, dark: 0.45 },
  { hour: 8, ambient: '#fff1df', sky: ['#8ccbec', '#a6d6f0', '#c6e6f5'], cloud: '#ffffff', sun: 0.8, sunColor: '#fff2cf', disc: '#fff6b0', lamps: 0, dark: 0 },
  { hour: 12, ambient: '#ffffff', sky: ['#79c1ea', '#97d0f0', '#b8e0f5'], cloud: '#ffffff', sun: 0.65, sunColor: '#fff8dc', disc: '#fff6b0', lamps: 0, dark: 0 },
  { hour: 15.5, ambient: '#fff3dc', sky: ['#7fbde6', '#a0cdea', '#c8e0ea'], cloud: '#ffffff', sun: 0.8, sunColor: '#fff0c0', disc: '#fff3a0', lamps: 0, dark: 0 },
  { hour: 17.5, ambient: '#ffd6a0', sky: ['#f0a070', '#f6b97f', '#fbd59a'], cloud: '#ffe0c0', sun: 1, sunColor: '#ffc777', disc: '#ffd27a', lamps: 0.3, dark: 0.1 },
  { hour: 19, ambient: '#c890a8', sky: ['#7a5a9a', '#e07a6a', '#f6a96b'], cloud: '#f0a0a0', sun: 0.35, sunColor: '#ff9f6a', disc: '#ff8a5a', lamps: 0.8, dark: 0.5 },
  { hour: 20, ambient: '#8e86b8', sky: ['#2a2f6a', '#3a3f7a', '#6a5a8a'], cloud: '#5a5a8a', sun: 0, sunColor: '#ff9f6a', disc: '#ff8a5a', lamps: 1, dark: 0.85 },
  { hour: 21, ...NIGHT },
  { hour: 24, ...NIGHT },
];

const SUNRISE = 6;
const SUNSET = 19.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lightingAt(hour: number): Lighting {
  const h = ((hour % 24) + 24) % 24;
  const i = KEYS.findIndex((k) => k.hour > h) - 1;
  const a = KEYS[Math.max(0, i)];
  const b = KEYS[Math.max(1, i + 1)];
  // Ease in and out of each keyframe so the light never visibly changes pace.
  const p = (h - a.hour) / (b.hour - a.hour);
  const t = p * p * (3 - 2 * p);
  const x = Math.min(1, Math.max(0, (h - SUNRISE) / (SUNSET - SUNRISE)));
  return {
    ambient: mix(a.ambient, b.ambient, t),
    dark: lerp(a.dark, b.dark, t),
    lamps: lerp(a.lamps, b.lamps, t),
    sky: [mix(a.sky[0], b.sky[0], t), mix(a.sky[1], b.sky[1], t), mix(a.sky[2], b.sky[2], t)],
    cloud: mix(a.cloud, b.cloud, t),
    sun: {
      x,
      elevation: h > SUNRISE && h < SUNSET ? Math.sin(Math.PI * x) : 0,
      strength: lerp(a.sun, b.sun, t),
      color: mix(a.sunColor, b.sunColor, t),
      disc: mix(a.disc, b.disc, t),
    },
  };
}

/**
 * How much of the outdoor light reaches each room: the garden patio is open to the
 * sky and the glasshouse nearly so, while the walled rooms keep some of their own light.
 */
const EXPOSURE: Record<AreaId, number> = { main: 0.65, reading: 0.55, greenhouse: 0.9, terrace: 1 };

/** The color a room is multiplied by. */
export const roomAmbient = (light: Lighting, area: AreaId) => mix('#ffffff', light.ambient, EXPOSURE[area]);

/**
 * A sunbeam's slant and reach for light falling through a window: it leans away from
 * the sun as it crosses the sky, and stretches out when the sun is low.
 */
export function beam(sun: Sun): { lean: number; length: number } {
  return { lean: Math.round((sun.x - 0.5) * -60), length: Math.round(20 + (1 - sun.elevation) * 36) };
}
