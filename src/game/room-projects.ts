import { earn } from './economy';
import { isAreaOpen, type AreaId } from './regions';
import type { GameState } from './state';
import { prepareStreetBlueprint, applyStreetBlueprint } from './streets';

/** Side businesses use real time, independently of service speed and the manager. */
export const ROOM_PROJECTS = [
  { id: 'postcards', area: 'main', cost: 180, coins: 12, inspiration: 1, art: 'magazine_rack' },
  { id: 'bookbinding', area: 'reading', cost: 600, coins: 30, inspiration: 2, art: 'bookshelf' },
  { id: 'herbs', area: 'greenhouse', cost: 5_000, coins: 120, inspiration: 3, art: 'plant_lavender' },
  { id: 'flowers', area: 'terrace', cost: 30_000, coins: 500, inspiration: 4, art: 'vase_daisies' },
  { id: 'ceramics', area: 'workshop', cost: 90_000, coins: 1_400, inspiration: 5, art: 'display_cabinet' },
  { id: 'stargazing', area: 'observatory', cost: 240_000, coins: 3_600, inspiration: 6, art: 'art_starry' },
] as const satisfies readonly { id: string; area: AreaId; cost: number; coins: number; inspiration: number; art: string }[];
export type ProjectId = typeof ROOM_PROJECTS[number]['id'];
export const PROJECT_MODES = {
  short: { seconds: 600, yield: 1, capacity: 6 },
  long: { seconds: 7_200, yield: 8, capacity: 4 },
  overnight: { seconds: 28_800, yield: 24, capacity: 2 },
} as const;
export type ProjectMode = keyof typeof PROJECT_MODES;
export const BLUEPRINTS = [
  { id: 'shelves', cost: 80 },
  { id: 'clockwork', cost: 200 },
  { id: 'ledger', cost: 400 },
] as const;
export type BlueprintId = typeof BLUEPRINTS[number]['id'];
export interface RoomProject {
  level: number;
  mode: ProjectMode;
  /** Beginning of the unfinished cycle. Full storage pauses production. */
  since: number;
}
export interface RoomProjectsState {
  inspiration: number;
  collected: number;
  blueprints: BlueprintId[];
  facilities: Partial<Record<ProjectId, RoomProject>>;
}
export const emptyRoomProjects = (): RoomProjectsState => ({ inspiration: 0, collected: 0, blueprints: [], facilities: {} });
export const projectDef = (id: ProjectId) => ROOM_PROJECTS.find(p => p.id === id)!;
export const hasBlueprint = (s: Pick<GameState, 'roomProjects'>, id: BlueprintId) => s.roomProjects.blueprints.includes(id);
export const projectAvailable = (s: GameState, id: ProjectId) => isAreaOpen(s, projectDef(id).area) && (id !== 'postcards' || s.day >= 3);
export const projectCycleSeconds = (s: GameState, mode: ProjectMode) => PROJECT_MODES[mode].seconds * (hasBlueprint(s, 'clockwork') ? .8 : 1);
export const projectCapacity = (s: GameState, mode: ProjectMode) => PROJECT_MODES[mode].capacity + (hasBlueprint(s, 'shelves') ? 2 : 0);

export function projectProduction(s: GameState, id: ProjectId, now: number) {
  const facility = s.roomProjects.facilities[id];
  if (!facility || !projectAvailable(s, id)) return { batches: 0, capacity: 0, coins: 0, inspiration: 0, progress: 0, left: 0, full: false };
  const def = projectDef(id), mode = PROJECT_MODES[facility.mode];
  const cycle = projectCycleSeconds(s, facility.mode), capacity = projectCapacity(s, facility.mode);
  const elapsed = Math.max(0, (now - facility.since) / 1000);
  const batches = Math.min(capacity, Math.floor(elapsed / cycle));
  const full = batches === capacity, progress = full ? 1 : elapsed % cycle / cycle;
  return { batches, capacity, full, progress, left: full ? 0 : cycle * (1 - progress),
    coins: batches * def.coins * mode.yield * facility.level,
    inspiration: batches * def.inspiration * mode.yield * facility.level };
}

/** Claim only finished batches; repeated claims never lose the partial cycle. */
export function collectProject(s: GameState, id: ProjectId, now: number) {
  const result = projectProduction(s, id, now), facility = s.roomProjects.facilities[id];
  if (!facility || result.batches === 0) return result;
  earn(s, result.coins);
  s.roomProjects.inspiration += result.inspiration;
  s.roomProjects.collected += result.inspiration;
  facility.since = result.full ? now : facility.since + result.batches * projectCycleSeconds(s, facility.mode) * 1000;
  return result;
}
export function collectAllProjects(s: GameState, now: number) {
  return ROOM_PROJECTS.reduce((total, p) => {
    const reward = collectProject(s, p.id, now);
    return { coins: total.coins + reward.coins, inspiration: total.inspiration + reward.inspiration };
  }, { coins: 0, inspiration: 0 });
}

export function projectUpgradeCost(s: GameState, id: ProjectId) {
  const level = s.roomProjects.facilities[id]?.level ?? 0;
  if (level >= 3) return null;
  return { coins: projectDef(id).cost * 2 ** level, inspiration: level * 15 * (ROOM_PROJECTS.findIndex(p => p.id === id) + 1) };
}
export function projectUpgradeBlock(s: GameState, id: ProjectId): 'locked' | 'max' | 'coins' | 'inspiration' | null {
  if (!projectAvailable(s, id)) return 'locked';
  const cost = projectUpgradeCost(s, id);
  if (!cost) return 'max';
  if (s.coins < cost.coins) return 'coins';
  if (s.roomProjects.inspiration < cost.inspiration) return 'inspiration';
  return null;
}
export function upgradeProject(s: GameState, id: ProjectId, now: number): boolean {
  if (projectUpgradeBlock(s, id)) return false;
  const cost = projectUpgradeCost(s, id)!;
  // Settle the old level first. Changing a setup starts a new cycle, never retroactive output.
  collectProject(s, id, now);
  const old = s.roomProjects.facilities[id];
  s.coins -= cost.coins;
  s.roomProjects.inspiration -= cost.inspiration;
  s.roomProjects.facilities[id] = { level: (old?.level ?? 0) + 1, mode: old?.mode ?? 'short', since: now };
  return true;
}
export function setProjectMode(s: GameState, id: ProjectId, mode: ProjectMode, now: number): boolean {
  const facility = s.roomProjects.facilities[id];
  if (!facility || !projectAvailable(s, id) || facility.mode === mode || !Object.hasOwn(PROJECT_MODES, mode)) return false;
  collectProject(s, id, now);
  facility.mode = mode;
  facility.since = now;
  return true;
}
export function buyBlueprint(s: GameState, id: BlueprintId, now: number): boolean {
  const def = BLUEPRINTS.find(b => b.id === id);
  if (!def || hasBlueprint(s, id) || s.roomProjects.inspiration < def.cost) return false;
  // Preserve partial progress at the old speed; extra capacity never resurrects overflow.
  const progress = new Map(ROOM_PROJECTS.map(p => [p.id, projectProduction(s, p.id, now).progress]));
  const full = new Set(ROOM_PROJECTS.filter(p => projectProduction(s, p.id, now).full).map(p => p.id));
  const streetProgress = prepareStreetBlueprint(s, now);
  collectAllProjects(s, now);
  s.roomProjects.inspiration -= def.cost;
  s.roomProjects.blueprints.push(id);
  applyStreetBlueprint(s, streetProgress, now);
  for (const def of ROOM_PROJECTS) {
    const facility = s.roomProjects.facilities[def.id];
    if (facility) facility.since = now - (full.has(def.id) ? 0 : progress.get(def.id)!) * projectCycleSeconds(s, facility.mode) * 1000;
  }
  return true;
}

/** Only open rooms can restore production; old saves start with an empty project book. */
export function parseRoomProjects(value: unknown, s: GameState, now: number): RoomProjectsState {
  const base = emptyRoomProjects();
  if (!value || typeof value !== 'object') return base;
  const data = value as Record<string, unknown>;
  const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(v))) : 0;
  base.inspiration = count(data.inspiration);
  base.collected = count(data.collected);
  base.blueprints = BLUEPRINTS.filter(b => Array.isArray(data.blueprints) && data.blueprints.includes(b.id)).map(b => b.id);
  const facilities = data.facilities && typeof data.facilities === 'object' ? data.facilities as Record<string, unknown> : {};
  for (const def of ROOM_PROJECTS) {
    const raw = facilities[def.id];
    if (!raw || typeof raw !== 'object' || !projectAvailable(s, def.id)) continue;
    const f = raw as Record<string, unknown>, level = Math.min(3, count(f.level));
    if (!level) continue;
    const mode = typeof f.mode === 'string' && Object.hasOwn(PROJECT_MODES, f.mode) ? f.mode as ProjectMode : 'short';
    const since = typeof f.since === 'number' && Number.isFinite(f.since) ? Math.min(now, Math.max(0, f.since)) : now;
    base.facilities[def.id] = { level, mode, since };
  }
  return base;
}
