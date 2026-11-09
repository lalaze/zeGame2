import { earn } from './economy';
import { LOCATION_IDS, cafeLocation, isLocation, type LocationId } from './locations';
import { REGIONS, buildShare, regionOffset, type RegionId } from './regions';
import { hasPerk, PERK_BUILD_SHARE } from './chain-bonuses';
import { PROJECT_MODES, projectCapacity, projectCycleSeconds, projectDef, type ProjectId, type ProjectMode } from './room-projects';
import type { GameState } from './state';

/** One architectural kit per street. Shop identity changes displays, never the building style. */
export const STREETS = [
  { id: 'town', required: 0, price: 1, wall: '#dec6a0', trim: '#76513b', roof: '#a86e50', accent: '#758164', sky: '#dce7df', paving: '#c4b59a' },
  { id: 'flowers', required: 2, price: 1.3, wall: '#e8d5bd', trim: '#80624d', roof: '#b28370', accent: '#93876c', sky: '#e9e5dc', paving: '#cdbda8' },
  { id: 'seaside', required: 4, price: 1.7, wall: '#e4ddc9', trim: '#637b7c', roof: '#718b8c', accent: '#719995', sky: '#cde2e3', paving: '#c6c7bb' },
  { id: 'forest', required: 7, price: 2.2, wall: '#c9b99a', trim: '#5f5840', roof: '#69745b', accent: '#7d8d66', sky: '#d6dfcf', paving: '#b2b59e' },
  { id: 'city', required: 10, price: 3, wall: '#cab6a4', trim: '#5d5754', roof: '#6d7372', accent: '#8c7770', sky: '#dce0dc', paving: '#acaaa1' },
] as const satisfies readonly { id: LocationId; required: number; price: number; wall: string; trim: string; roof: string; accent: string; sky: string; paving: string }[];
export const STREET_PLOTS = [
  { id: '01', price: 1_200 }, { id: '02', price: 3_600 }, { id: '03', price: 9_000 },
  { id: '04', price: 24_000 }, { id: '05', price: 60_000 },
] as const;
export type PlotId = typeof STREET_PLOTS[number]['id'];
export type StreetLotId = `${LocationId}:${PlotId}`;
export const BUSINESSES = [
  { id: 'reading', project: 'bookbinding', required: 0, hours: .5 },
  { id: 'greenhouse', project: 'herbs', required: 1, hours: 2 },
  { id: 'terrace', project: 'flowers', required: 2, hours: 6 },
  { id: 'workshop', project: 'ceramics', required: 3, hours: 12 },
  { id: 'observatory', project: 'stargazing', required: 4, hours: 24 },
] as const satisfies readonly { id: RegionId; project: ProjectId; required: number; hours: number }[];
export interface StreetLot {
  business: RegionId | null;
  level: number;
  mode: ProjectMode;
  /** Renovation finishes without needing to close the main café. */
  readyAt: number;
  since: number;
}
export interface StreetEstate {
  selected: LocationId;
  lots: Partial<Record<StreetLotId, StreetLot>>;
}
export const emptyStreetEstate = (): StreetEstate => ({ selected: 'town', lots: {} });
export const streetDef = (id: LocationId) => STREETS.find(s => s.id === id)!;
export const businessDef = (id: RegionId) => BUSINESSES.find(b => b.id === id)!;
const LOCAL_BUSINESSES: Record<LocationId, readonly RegionId[]> = { town: [], flowers: ['greenhouse', 'terrace'], seaside: ['observatory'], forest: ['reading', 'greenhouse'], city: ['reading', 'workshop'] };
export const streetYieldMultiplier = (street: LocationId, business: RegionId) => LOCAL_BUSINESSES[street].includes(business) ? 1.2 : 1;
export const streetLotId = (street: LocationId, plot: PlotId): StreetLotId => `${street}:${plot}`;
export const validStreetLotId = (id: string): id is StreetLotId => LOCATION_IDS.some(street => STREET_PLOTS.some(p => streetLotId(street, p.id) === id));
export const ownedPlotCount = (s: GameState) => Object.keys(s.streets.lots).length;
export const ownsStreetBusiness = (s: GameState, business: RegionId) => Object.values(s.streets.lots).some(lot => lot?.business === business && lot.readyAt <= Date.now());
export const streetUnlocked = (s: GameState, street: LocationId) => street === cafeLocation(s) || ownedPlotCount(s) >= streetDef(street).required;
export const plotPrice = (street: LocationId, plot: PlotId) => Math.round(streetDef(street).price * STREET_PLOTS.find(p => p.id === plot)!.price);
export function plotPurchaseBlock(s: GameState, street: LocationId, plot: PlotId): 'owned' | 'street' | 'day' | 'coins' | null {
  if (s.streets.lots[streetLotId(street, plot)]) return 'owned';
  if (!streetUnlocked(s, street)) return 'street';
  if (s.day < 3) return 'day';
  if (s.coins < plotPrice(street, plot)) return 'coins';
  return null;
}
export function buyStreetPlot(s: GameState, street: LocationId, plot: PlotId, now: number): boolean {
  if (!isLocation(street) || !STREET_PLOTS.some(p => p.id === plot) || plotPurchaseBlock(s, street, plot)) return false;
  s.coins -= plotPrice(street, plot);
  s.streets.lots[streetLotId(street, plot)] = { business: null, level: 0, mode: 'short', readyAt: now, since: now };
  return true;
}
export const fitOutPrice = (business: RegionId) => projectDef(businessDef(business).project).cost;
export const fitOutSeconds = (s: GameState, business: RegionId) => Math.round(businessDef(business).hours * 3600 * buildShare(s.chain.branches) * (hasPerk(s, 'builders') ? PERK_BUILD_SHARE : 1));
export function fitOutBlock(s: GameState, id: StreetLotId, business: RegionId): 'plot' | 'owned' | 'business' | 'coins' | null {
  const lot = s.streets.lots[id];
  if (!lot) return 'plot';
  if (lot.business) return 'owned';
  // Count other properties: buying the first plot still leaves the first business available.
  if (ownedPlotCount(s) - 1 < businessDef(business).required) return 'business';
  if (s.coins < fitOutPrice(business)) return 'coins';
  return null;
}
export function fitOutStreetPlot(s: GameState, id: StreetLotId, business: RegionId, now: number): boolean {
  if (!BUSINESSES.some(b => b.id === business) || fitOutBlock(s, id, business)) return false;
  const lot = s.streets.lots[id]!;
  s.coins -= fitOutPrice(business);
  lot.business = business; lot.level = 1;
  lot.readyAt = now + fitOutSeconds(s, business) * 1000;
  lot.since = lot.readyAt;
  return true;
}
export function streetProduction(s: GameState, id: StreetLotId, now: number) {
  const lot = s.streets.lots[id];
  const empty = { batches: 0, capacity: 0, coins: 0, inspiration: 0, progress: 0, left: 0, full: false };
  if (!lot?.business || now < lot.readyAt) return empty;
  const def = projectDef(businessDef(lot.business).project), mode = PROJECT_MODES[lot.mode];
  const cycle = projectCycleSeconds(s, lot.mode), capacity = projectCapacity(s, lot.mode);
  const elapsed = Math.max(0, now - Math.max(lot.since, lot.readyAt)) / 1000;
  const batches = Math.min(capacity, Math.floor(elapsed / cycle)), full = batches === capacity;
  const progress = full ? 1 : elapsed % cycle / cycle;
  return { batches, capacity, full, progress, left: full ? 0 : cycle * (1 - progress),
    coins: Math.round(batches * def.coins * mode.yield * lot.level * streetYieldMultiplier(id.split(':')[0] as LocationId, lot.business)),
    inspiration: batches * def.inspiration * mode.yield * lot.level };
}
export function collectStreetShop(s: GameState, id: StreetLotId, now: number) {
  const reward = streetProduction(s, id, now), lot = s.streets.lots[id];
  if (!lot || !reward.batches) return reward;
  earn(s, reward.coins); s.roomProjects.inspiration += reward.inspiration; s.roomProjects.collected += reward.inspiration;
  lot.since = reward.full ? now : Math.max(lot.since, lot.readyAt) + reward.batches * projectCycleSeconds(s, lot.mode) * 1000;
  return reward;
}
export const streetLotIds = (s: GameState) => Object.keys(s.streets.lots).filter(validStreetLotId);
export function collectStreetShops(s: GameState, now: number) {
  return streetLotIds(s).reduce((total, id) => {
    const reward = collectStreetShop(s, id, now);
    return { coins: total.coins + reward.coins, inspiration: total.inspiration + reward.inspiration };
  }, { coins: 0, inspiration: 0 });
}
export function streetUpgradePrice(s: GameState, id: StreetLotId) {
  const lot = s.streets.lots[id];
  if (!lot?.business || lot.level >= 3) return null;
  return { coins: fitOutPrice(lot.business) * 2 ** lot.level,
    inspiration: lot.level * 15 * (BUSINESSES.findIndex(b => b.id === lot.business) + 2) };
}
export function upgradeStreetShop(s: GameState, id: StreetLotId, now: number): boolean {
  const lot = s.streets.lots[id], cost = streetUpgradePrice(s, id);
  if (!lot || !cost || now < lot.readyAt || s.coins < cost.coins || s.roomProjects.inspiration < cost.inspiration) return false;
  collectStreetShop(s, id, now);
  s.coins -= cost.coins; s.roomProjects.inspiration -= cost.inspiration;
  lot.level++; lot.since = now;
  return true;
}
export function setStreetSchedule(s: GameState, id: StreetLotId, mode: ProjectMode, now: number): boolean {
  const lot = s.streets.lots[id];
  if (!lot?.business || now < lot.readyAt || lot.mode === mode || !Object.hasOwn(PROJECT_MODES, mode)) return false;
  collectStreetShop(s, id, now); lot.mode = mode; lot.since = now; return true;
}
/** Blueprint research settles old rates and keeps fractions, never retroactive overflow. */
export function prepareStreetBlueprint(s: GameState, now: number) {
  const progress = streetLotIds(s).filter(id => s.streets.lots[id]!.readyAt <= now).map(id => {
    const output = streetProduction(s, id, now);
    return { id, progress: output.full ? 0 : output.progress };
  });
  collectStreetShops(s, now);
  return progress;
}
export function applyStreetBlueprint(s: GameState, progress: ReturnType<typeof prepareStreetBlueprint>, now: number): void {
  for (const p of progress) { const lot = s.streets.lots[p.id]!; lot.since = now - p.progress * projectCycleSeconds(s, lot.mode) * 1000; }
}

export function parseStreetEstate(value: unknown, now: number): StreetEstate {
  const base = emptyStreetEstate();
  if (!value || typeof value !== 'object') return base;
  const data = value as Record<string, unknown>;
  if (isLocation(data.selected)) base.selected = data.selected;
  if (!data.lots || typeof data.lots !== 'object') return base;
  for (const [id, raw] of Object.entries(data.lots)) {
    if (!validStreetLotId(id) || !raw || typeof raw !== 'object') continue;
    const lot = raw as Record<string, unknown>;
    const business = BUSINESSES.find(b => b.id === lot.business)?.id ?? null;
    const stamp = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : now;
    const readyAt = business ? Math.min(stamp(lot.readyAt), now + businessDef(business).hours * 3_600_000) : now;
    base.lots[id] = { business, level: business && typeof lot.level === 'number' && Number.isFinite(lot.level) ? Math.min(3, Math.max(1, Math.floor(lot.level))) : business ? 1 : 0,
      mode: typeof lot.mode === 'string' && Object.hasOwn(PROJECT_MODES, lot.mode) ? lot.mode as ProjectMode : 'short',
      readyAt, since: Math.min(stamp(lot.since), Math.max(now, readyAt)) };
  }
  return base;
}

/** Run at the live-save boundary. Preserve an in-flight service until closing. */
export function migrateIndoorShops(s: GameState, now: number): boolean {
  if (!s.regions.length && !s.construction.length) return false;
  let changed = false;
  const street = cafeLocation(s);
  for (const region of REGIONS) {
    const construction = s.construction.find(c => c.id === region.id);
    if (!s.regions.includes(region.id) && !construction) continue;
    const id = streetLotId(street, STREET_PLOTS[REGIONS.indexOf(region)].id);
    const projectId = businessDef(region.id).project, facility = s.roomProjects.facilities[projectId];
    if (!s.streets.lots[id]) {
      changed = true;
      const readyAt = construction?.finishAt ?? now;
      s.streets.lots[id] = { business: region.id, level: facility?.level ?? 1, mode: facility?.mode ?? 'short', readyAt: facility ? Math.min(readyAt, facility.since) : readyAt, since: facility?.since ?? readyAt };
    }
    if (facility) { delete s.roomProjects.facilities[projectId]; changed = true; }
  }
  if (s.construction.length) changed = true;
  s.construction = [];
  if (s.phase === 'prep') {
    changed = true;
    // Room furnishings stay owned, ready to place in the main café; no item is discarded.
    s.decor.placed = s.decor.placed.filter(p => {
      if (p.col * 8 < regionOffset('reading')) return true;
      s.decor.stored[p.id] = (s.decor.stored[p.id] ?? 0) + 1; return false;
    });
    s.regions = [];
  }
  return changed;
}
