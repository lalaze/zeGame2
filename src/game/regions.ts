import type { GameState } from './state';

export const REGIONS = [
  { id: 'reading', cost: 1_200, tables: 4, demand: 0.1 },
  { id: 'greenhouse', cost: 18_000, tables: 4, demand: 0.15 },
  { id: 'terrace', cost: 240_000, tables: 4, demand: 0.2 },
] as const;

export type RegionId = (typeof REGIONS)[number]['id'];
export type AreaId = 'main' | RegionId;
export const AREA_IDS: readonly AreaId[] = ['main', ...REGIONS.map((r) => r.id)];
export type Direction = 'left' | 'right' | 'up' | 'down';
/** The front rooms face the street; the glasshouse and garden sit behind them. */
export const AREA_GRID: Record<AreaId, { col: number; row: number }> = {
  main: { col: 0, row: 1 }, reading: { col: 1, row: 1 },
  greenhouse: { col: 1, row: 0 }, terrace: { col: 0, row: 0 },
};
/** Shared doorways, rather than an ordering of screens. The garden has no street entrance. */
export const AREA_LINKS: readonly { from: AreaId; to: AreaId; direction: Direction }[] = [
  { from: 'main', to: 'reading', direction: 'right' },
  { from: 'reading', to: 'greenhouse', direction: 'up' },
  { from: 'greenhouse', to: 'terrace', direction: 'left' },
];
export const oppositeDirection = (direction: Direction): Direction =>
  ({ left: 'right', right: 'left', up: 'down', down: 'up' } as const)[direction];
export function adjacentArea(id: AreaId, direction: Direction): AreaId | null {
  for (const link of AREA_LINKS) {
    if (link.from === id && link.direction === direction) return link.to;
    if (link.to === id && oppositeDirection(link.direction) === direction) return link.from;
  }
  return null;
}
export const areaConnections = (id: AreaId) =>
  (['left', 'right', 'up', 'down'] as const).flatMap((direction) => {
    const to = adjacentArea(id, direction);
    return to ? [{ direction, to }] : [];
  });
/** Stable storage coordinates for furniture, independent of the building's floor plan. */
export const regionOffset = (id: AreaId) => AREA_IDS.indexOf(id) * 320;
export const areaAtX = (x: number): AreaId | undefined => AREA_IDS[Math.floor(x / 320)];
export const regionDef = (id: RegionId) => REGIONS.find((r) => r.id === id)!;
export const isAreaOpen = (state: GameState, id: AreaId) => id === 'main' || state.regions.includes(id);
export const mainTableCount = (state: GameState) => 2 + state.upgrades.tables;
export const regionTableStart = (id: RegionId) => 8 + REGIONS.findIndex((r) => r.id === id) * 4;
export const regionDemand = (state: GameState) =>
  REGIONS.reduce((sum, r) => sum + (isAreaOpen(state, r.id) ? r.demand : 0), 0);

/** Table indices stay stable when the main café gains another table. */
export function activeTableIndices(state: GameState): number[] {
  const tables = Array.from({ length: mainTableCount(state) }, (_, i) => i);
  for (const r of REGIONS) {
    if (isAreaOpen(state, r.id)) tables.push(...Array.from({ length: r.tables }, (_, i) => regionTableStart(r.id) + i));
  }
  return tables;
}

export type RegionBlock = 'owned' | 'previous' | 'open' | 'coins' | null;
export function regionBlock(state: GameState, id: RegionId): RegionBlock {
  if (isAreaOpen(state, id)) return 'owned';
  const index = REGIONS.findIndex((r) => r.id === id);
  if (index > 0 && !isAreaOpen(state, REGIONS[index - 1].id)) return 'previous';
  if (state.phase !== 'prep') return 'open';
  if (state.coins < regionDef(id).cost) return 'coins';
  return null;
}

export function unlockRegion(state: GameState, id: RegionId): boolean {
  if (regionBlock(state, id)) return false;
  state.coins -= regionDef(id).cost;
  state.regions.push(id);
  return true;
}
