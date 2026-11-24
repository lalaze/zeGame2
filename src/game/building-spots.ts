// Where the building (src/render/floors) has room for furniture. The pixel room places pieces on a
// grid (furniture.ts); the building has spots of its own on every storey, one piece each, and more of
// them with every floor it grows. What may stand where is here; where a spot is on its floor's
// picture is in render/floors/floors-layout.ts.
import type { Surface } from './furniture';

export type Storey = 'roof' | 'floor-3' | 'floor-2' | 'ground';
export interface BuildingSpot { id: string; surface: Surface; storey: Storey }

/**
 * The storeys a café has, top down: the ground floor seats its first two tables, a floor above opens
 * for tables three to five and another for six to eight, under a roof terrace.
 */
export function storeys(tables: number): Storey[] {
  return ['roof', ...(tables > 5 ? ['floor-3' as const] : []), ...(tables > 2 ? ['floor-2' as const] : []), 'ground'];
}

const spots = (storey: Storey, surface: Surface, names: readonly string[]): BuildingSpot[] =>
  names.map((name) => ({ id: `${storey}-${name}`, surface, storey }));
const seating = (storey: Storey) => [
  ...spots(storey, 'floor', ['front-1', 'front-2', 'front-3', 'front-4', 'front-5', 'window']),
  ...spots(storey, 'wall', ['wall-1', 'wall-2', 'wall-3']),
];
/** Every spot, in the order pieces without one fill them. */
export const BUILDING_SPOTS: readonly BuildingSpot[] = [
  ...spots('ground', 'floor', ['left', 'right']),
  ...spots('ground', 'wall', ['wall-1', 'wall-2']),
  ...seating('floor-2'),
  ...spots('roof', 'floor', ['front-1', 'front-2', 'front-3', 'back']),
  ...spots('roof', 'wall', ['wall-1', 'wall-2']),
  ...seating('floor-3'),
];
const BY_ID = new Map(BUILDING_SPOTS.map((spot) => [spot.id, spot]));
export const buildingSpot = (id: string | undefined) => (id === undefined ? undefined : BY_ID.get(id));

/** The grid cells the building showed as spots before it had its own: pieces standing on one keep their place. */
export const FORMER_CELLS: readonly { spot: string; col: number; row: number }[] = [
  { spot: 'ground-left', col: 3, row: 17 }, { spot: 'ground-right', col: 13, row: 17 },
  { spot: 'floor-2-front-1', col: 26, row: 17 }, { spot: 'floor-2-front-3', col: 31, row: 17 }, { spot: 'floor-2-front-4', col: 36, row: 17 },
];
