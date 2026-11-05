import { PERK_BUILD_SHARE, hasPerk } from './chain-bonuses';
import type { GameState } from './state';

/**
 * The rooms behind the main café, opened in order. Each takes real time to build once
 * paid for (it finishes while you're away too), so the building grows over days rather
 * than in one sitting, however fast the café earns. Timings: docs/idle-pacing.
 */
export const REGIONS = [
  { id: 'reading', cost: 1_200, tables: 4, demand: 0.1, buildSeconds: 60 * 60 },
  { id: 'greenhouse', cost: 18_000, tables: 4, demand: 0.15, buildSeconds: 12 * 60 * 60 },
  { id: 'terrace', cost: 240_000, tables: 4, demand: 0.2, buildSeconds: 48 * 60 * 60 },
] as const;
/** Each branch opened so far makes building this much quicker: 1 / (1 + this × branches)... */
export const BUILD_SPEEDUP_PER_BRANCH = 1.5;
/** ...down to this share of the first café's build times. */
export const MIN_BUILD_SHARE = 0.25;

export type RegionId = (typeof REGIONS)[number]['id'];
/** The dining rooms, and the kitchen behind the scenes. */
export type AreaId = 'main' | RegionId | 'kitchen';
// The kitchen comes last so the furniture grid's columns for the other rooms never move.
export const AREA_IDS: readonly AreaId[] = ['main', ...REGIONS.map((r) => r.id), 'kitchen'];
export type Direction = 'left' | 'right' | 'up' | 'down';
/**
 * The front rooms face the street; the glasshouse and garden sit behind them, and
 * the kitchen is off the main café's left side.
 */
export const AREA_GRID: Record<AreaId, { col: number; row: number }> = {
  kitchen: { col: -1, row: 1 }, main: { col: 0, row: 1 }, reading: { col: 1, row: 1 },
  greenhouse: { col: 1, row: 0 }, terrace: { col: 0, row: 0 },
};
/** Shared doorways, rather than an ordering of screens. The garden has no street entrance. */
export const AREA_LINKS: readonly { from: AreaId; to: AreaId; direction: Direction }[] = [
  { from: 'main', to: 'kitchen', direction: 'left' },
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
/** Share of the first café's build times that a café takes after `branches` branches. */
export const buildShare = (branches: number) => Math.max(MIN_BUILD_SHARE, 1 / (1 + BUILD_SPEEDUP_PER_BRANCH * branches));
/** Real seconds this café takes to build a room: the chain's builders get quicker with every branch. */
export const buildSeconds = (state: Pick<GameState, 'chain'>, id: RegionId) =>
  Math.round(regionDef(id).buildSeconds * buildShare(state.chain?.branches ?? 0) * (state.chain && hasPerk(state, 'builders') ? PERK_BUILD_SHARE : 1));
export const isAreaOpen = (state: GameState, id: AreaId) =>
  id === 'main' || (id === 'kitchen' ? state.kitchen : state.regions.includes(id));
export const isRegion = (id: AreaId): id is RegionId => REGIONS.some((r) => r.id === id);
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

/** A room being built: paid for, opening at `finishAt` (ms since epoch) or the first closed moment after. */
export interface Construction {
  id: RegionId;
  finishAt: number;
}

/**
 * Rooms are built one after another. The first café builds one at a time; from the first
 * branch on, the chain's builders take bookings, so later rooms can be paid for ahead and
 * start the moment the one before is done.
 */
export const canBookAhead = (state: Pick<GameState, 'chain'>) => (state.chain?.branches ?? 0) > 0;

/** Keeps only an in-order run of bookings for the rooms after those already open. */
export function parseConstruction(value: unknown, regions: readonly RegionId[], now: number): Construction[] {
  const list = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  const out: Construction[] = [];
  let latest = now;
  for (const raw of list as Record<string, unknown>[]) {
    const index = REGIONS.findIndex((r) => r.id === raw?.id);
    if (index < 0 || index !== regions.length + out.length || typeof raw.finishAt !== 'number' || !Number.isFinite(raw.finishAt)) break;
    // A clock set back can't stretch a build beyond its own length.
    latest = Math.min(Math.max(raw.finishAt, out.at(-1)?.finishAt ?? -Infinity), latest + REGIONS[index].buildSeconds * 1000);
    out.push({ id: REGIONS[index].id, finishAt: latest });
  }
  return out;
}

export type RegionBlock = 'owned' | 'building' | 'previous' | 'busy' | 'open' | 'coins' | null;
export function regionBlock(state: GameState, id: RegionId): RegionBlock {
  if (isAreaOpen(state, id)) return 'owned';
  if (state.construction.some((c) => c.id === id)) return 'building';
  const index = REGIONS.findIndex((r) => r.id === id);
  const previous = REGIONS[index - 1];
  if (previous && !isAreaOpen(state, previous.id)) {
    // The room before is still being built: book this one only if the builders take bookings.
    if (state.construction.at(-1)?.id !== previous.id) return 'previous';
    if (!canBookAhead(state)) return 'busy';
  }
  if (state.phase !== 'prep') return 'open';
  if (state.coins < regionDef(id).cost) return 'coins';
  return null;
}

/** Pays for a room and opens it at once (tests, tools and migrations; play builds it with startConstruction). */
export function unlockRegion(state: GameState, id: RegionId): boolean {
  if (regionBlock(state, id) || state.construction.length) return false;
  state.coins -= regionDef(id).cost;
  state.regions.push(id);
  return true;
}

/** Pays for a room and builds it after any room ahead of it; it opens once its real build time has passed. */
export function startConstruction(state: GameState, id: RegionId, now: number): boolean {
  if (regionBlock(state, id)) return false;
  state.coins -= regionDef(id).cost;
  const start = Math.max(now, state.construction.at(-1)?.finishAt ?? now);
  state.construction.push({ id, finishAt: start + buildSeconds(state, id) * 1000 });
  return true;
}

/** The room being built, if any (the first of any bookings). */
export const constructionUnderway = (state: GameState): Construction | null => state.construction[0] ?? null;

/** Real seconds until `id` (by default the room being built) is finished; 0 once it only waits for closing time. */
export function constructionLeft(state: GameState, now: number, id?: RegionId): number {
  const c = id ? state.construction.find((b) => b.id === id) : state.construction[0];
  return c ? Math.max(0, (c.finishAt - now) / 1000) : 0;
}

/**
 * Opens every finished room. Rooms open only while the café is closed, as buying one
 * always did, so a build that finishes mid-service waits for the evening.
 */
export function finishConstruction(state: GameState, now: number): RegionId[] {
  const opened: RegionId[] = [];
  if (state.phase !== 'prep') return opened;
  while (state.construction.length && state.construction[0].finishAt <= now) {
    const c = state.construction.shift()!;
    state.regions.push(c.id);
    opened.push(c.id);
  }
  return opened;
}
