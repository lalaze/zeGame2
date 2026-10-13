/**
 * Optional, room-local presentation coordinates for the main cafe.
 *
 * Simulation positions, furniture footprints and saved coordinates stay logical.
 * Project a floor anchor once, then add a sprite's ordinary local offsets. Never
 * project every pixel/vertex of an upright sprite: its height must stay intact.
 */
export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface PixelDoorway {
  readonly side: 'left' | 'right';
  /** Room-local logical floor coordinate, already adjusted for room height. */
  readonly y: number;
}

export interface PixelProjectionOptions {
  /** Both enabled=true and area='main' are required to change coordinates. */
  readonly enabled?: boolean;
  readonly area?: string;
  readonly width?: number;
  readonly floorTop?: number;
  readonly floorBottom?: number;
  /** Horizontal scale at the rear floor edge; the front reaches scale 1. */
  readonly backScale?: number;
  /** Pass current doorwayY values when the room height changes. */
  readonly doorways?: readonly PixelDoorway[];
  /** Half the physical opening; this whole band retains an identity portal. */
  readonly doorHalfOpening?: number;
  /** Additional vertical distance over which the portal exception fades out. */
  readonly doorFade?: number;
  /** Distance from the wall that remains identity inside an open portal. */
  readonly doorIdentityWidth?: number;
  /** Distance from the wall where normal convergence resumes. */
  readonly doorBlendWidth?: number;
}

/** Base-height main room defaults; these are visual settings, not game geometry. */
export const MAIN_PIXEL_PROJECTION_DEFAULTS = Object.freeze({
  enabled: false,
  area: 'main',
  width: 320,
  floorTop: 80,
  floorBottom: 233,
  backScale: 0.9,
  doorways: Object.freeze([
    Object.freeze({ side: 'left' as const, y: 88 }),
    Object.freeze({ side: 'right' as const, y: 138 }),
  ]),
  doorHalfOpening: 14,
  doorFade: 10,
  doorIdentityWidth: 16,
  doorBlendWidth: 40,
});

const finite = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

interface Knot {
  logical: number;
  painted: number;
}

/**
 * A monotone piecewise-linear horizontal map, invertible without iteration.
 * Door exceptions affect only the narrow near-wall corridor, not half the cafe.
 * The same exception applies whether a neighboring room is open or locked, so
 * an unlock/door animation cannot suddenly shift the floor or a walking guest.
 */
function knots(y: number, options: PixelProjectionOptions): Knot[] | null {
  if (options.enabled !== true || options.area !== 'main') return null;
  const d = MAIN_PIXEL_PROJECTION_DEFAULTS;
  const width = finite(options.width, d.width);
  const top = finite(options.floorTop, d.floorTop);
  const bottom = finite(options.floorBottom, d.floorBottom);
  if (width <= 0 || bottom <= top || !Number.isFinite(y)) return null;
  const middle = width / 2;
  // A bounded, positive scale guarantees that no horizontal interval folds.
  const backScale = clamp(finite(options.backScale, d.backScale), 0.5, 1);
  const progress = clamp((y - top) / (bottom - top), 0, 1);
  const convergence = (1 - backScale) * (1 - progress);
  if (convergence === 0) return null;

  const opening = Math.max(0, finite(options.doorHalfOpening, d.doorHalfOpening));
  const fade = Math.max(0, finite(options.doorFade, d.doorFade));
  const identity = clamp(finite(options.doorIdentityWidth, d.doorIdentityWidth), middle * 0.01, middle * 0.4);
  const blend = clamp(finite(options.doorBlendWidth, d.doorBlendWidth), identity + middle * 0.01, middle * 0.8);
  const doors = options.doorways ?? d.doorways;
  const influence = (side: PixelDoorway['side']): number => {
    let strength = 0;
    for (const door of doors) {
      if (door.side !== side || !Number.isFinite(door.y)) continue;
      const distance = Math.abs(y - door.y);
      const amount = distance <= opening ? 1 : fade === 0 ? 0 : 1 - smoothstep(clamp((distance - opening) / fade, 0, 1));
      strength = Math.max(strength, amount);
    }
    return strength;
  };
  const left = 1 - influence('left');
  const right = 1 - influence('right');
  return [
    { logical: 0, painted: middle * convergence * left },
    { logical: identity, painted: identity + (middle - identity) * convergence * left },
    { logical: blend, painted: blend + (middle - blend) * convergence },
    { logical: middle, painted: middle },
    { logical: width - blend, painted: width - blend - (middle - blend) * convergence },
    { logical: width - identity, painted: width - identity - (middle - identity) * convergence * right },
    { logical: width, painted: width - middle * convergence * right },
  ];
}

function transform(point: PixelPoint, options: PixelProjectionOptions, inverse: boolean): PixelPoint {
  if (!Number.isFinite(point.x)) return { ...point };
  const row = knots(point.y, options);
  if (!row) return { ...point };
  const source: keyof Knot = inverse ? 'painted' : 'logical';
  const target: keyof Knot = inverse ? 'logical' : 'painted';
  let index = 0;
  while (index < row.length - 2 && point.x > row[index + 1][source]) index++;
  const a = row[index], b = row[index + 1];
  const fraction = (point.x - a[source]) / (b[source] - a[source]);
  return { x: a[target] + fraction * (b[target] - a[target]), y: point.y };
}

/** Logical floor point -> painted floor point. Coordinates remain unrounded. */
export function projectPoint(point: PixelPoint, options: PixelProjectionOptions = {}): PixelPoint {
  return transform(point, options, false);
}

/** Painted floor point -> logical floor point, before grid snapping/hit testing. */
export function unprojectPoint(point: PixelPoint, options: PixelProjectionOptions = {}): PixelPoint {
  return transform(point, options, true);
}

/**
 * Place an upright sprite/prop from its projected foot plus an unchanged offset.
 * `offset` can be its top-left, hand, tray, bubble or light attachment point.
 * Pixel-grid rounding belongs to the painter, after this calculation.
 */
export function projectSprite(anchor: PixelPoint, offset: PixelPoint, options: PixelProjectionOptions = {}): PixelPoint {
  const foot = projectPoint(anchor, options);
  return { x: foot.x + offset.x, y: foot.y + offset.y };
}
