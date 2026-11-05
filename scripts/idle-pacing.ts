/**
 * Real-time pacing for idle play: how long, in real hours, a player who checks in on a
 * schedule takes to reach each step of the unlock route.
 *
 * Days are modelled analytically (the manager's expected day profit, the same number away
 * earnings use) instead of with the 0.05-second Sim, so two weeks of check-ins take seconds.
 * Everything else goes through the real game functions: away earnings and the till,
 * construction, purchases, goals, branches. Decor, cats and promotions are not bought, so
 * comfort tips are missing and the timings are a little slow rather than fast.
 */
import { CATEGORIES, CHAIN_STAR_BONUS, MENU, UPGRADES, DAY_SECONDS, type ItemId } from '../src/game/data';
import { claimGoal } from '../src/game/goals';
import {
  buyItem, buyUpgrade, earn, expectedCustomers, isItemAvailable, quoteItem, quoteUpgrade, setOnMenu, upgradeMax,
} from '../src/game/economy';
import { KITCHEN_COST, unlockKitchen } from '../src/game/kitchen';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';
import * as managerModule from '../src/game/manager';
import { collectAwayEarnings, expectedDayProfit, hireManager, MANAGER_COST, managerUnlocked } from '../src/game/manager';
import * as chainModule from '../src/game/chain';
import * as ordersModule from '../src/game/orders';
import { branchUnlocked, openBranch, starsOnBranch } from '../src/game/chain';
import * as regionsModule from '../src/game/regions';
import { REGIONS, regionDef, unlockRegion, type RegionId } from '../src/game/regions';
import { createInitialState, type GameState } from '../src/game/state';

const HOUR = 3_600_000;
/** One on-screen day: the 180-second business day plus preparation, the manager's wait and the closing drain. */
export const ON_SCREEN_CYCLE_SECONDS = DAY_SECONDS + 20;

export interface CheckIn { at: number; minutes: number }
export interface Profile { id: string; label: string; checkIns: (days: number) => CheckIn[] }

/** Waking-hours check-ins at the given clock hours, every day after the first session. */
function daily(hours: number[], minutes: number) {
  return (days: number) => {
    const out: CheckIn[] = [];
    for (let d = 0; d < days; d++) for (const h of hours) {
      const at = d * 24 + h - 8; // the first session starts at 08:00 on day 1
      if (at > 0) out.push({ at, minutes });
    }
    return out;
  };
}

export const FIRST_SESSION_MINUTES = 20;
export const PROFILES: Profile[] = [
  { id: 'hourly', label: 'Every hour, 08:00–23:00, 3 min each', checkIns: daily(Array.from({ length: 16 }, (_, i) => 8 + i), 3) },
  { id: 'casual', label: 'Every 3 hours, 08:00–23:00, 3 min each', checkIns: daily([8, 11, 14, 17, 20, 23], 3) },
  { id: 'light', label: 'Three times a day (08:00, 13:00, 21:00), 5 min each', checkIns: daily([8, 13, 21], 5) },
  { id: 'workday', label: 'On screen 09:00–17:00 at 1×, plus 21:00 for 5 min', checkIns: (days) => {
    const out: CheckIn[] = [];
    for (let d = 0; d < days; d++) for (const [h, minutes] of [[9, 480], [21, 5]] as const) {
      const at = d * 24 + h - 8;
      if (at > 0) out.push({ at, minutes });
    }
    return out;
  } },
];

export type Milestone = 'manager' | 'kitchen' | RegionId | 'firstBranch' | 'secondTerrace' | string;
export interface PacingResult {
  profile: string;
  /** Real hours from the first session to each milestone. */
  reached: Partial<Record<Milestone, number>>;
  checkIns: number;
  /** Check-ins after the manager was hired that could not afford a single purchase. */
  dryReturns: number;
  /** Check-ins after the manager was hired. */
  managedReturns: number;
  /** Median away pay per check-in, in days of current expected profit. */
  medianAwayDays: number;
  final: { day: number; branches: number; stars: number; totalEarned: number; dishes: number; places: number };
  /** The most expensive dish unlocked in any café of the run: how far into the menu it got. */
  topDish: string;
}

// ---------------------------------------------------------------- spending policy

type Candidate = { key: string; cost: number; apply: (s: GameState) => boolean };

const shallow = (s: GameState): GameState => ({
  ...s,
  items: { ...s.items }, upgrades: { ...s.upgrades }, regions: [...s.regions], onMenu: [...s.onMenu],
  bakePlan: { ...s.bakePlan }, manager: { ...s.manager }, chain: { ...s.chain },
  trialSales: { ...s.trialSales },
  ...(Array.isArray(anyModule(s).construction) ? { construction: (anyModule(s).construction as object[]).map((c) => ({ ...c })) } : {}),
} as GameState);

const anyModule = (m: unknown) => m as Record<string, unknown>;
/** Optional mechanics, used only when the game has them. */
const optional = <T>(m: unknown, name: string) => anyModule(m)[name] as T | undefined;
/** Builds a room in real time where the game has construction, or opens it at once. */
const unlockRoom = (s: GameState, id: RegionId, now: number) =>
  optional<(s: GameState, id: RegionId, now: number) => boolean>(regionsModule, 'startConstruction')?.(s, id, now) ?? unlockRegion(s, id);
const collectFranchises = (s: GameState, now: number) => optional<(s: GameState, now: number) => number>(chainModule, 'collectFranchises')?.(s, now) ?? 0;
const franchiseHourly = (s: GameState) => optional<(s: GameState) => number>(chainModule, 'franchiseHourly')?.(s) ?? 0;
const finishBuilding = (s: GameState, now: number) => optional<(s: GameState, now: number) => unknown>(regionsModule, 'finishConstruction')?.(s, now);
type Orders = { ORDERS: { id: string; hours: number }[]; startOrder: (s: GameState, kind: string, now: number) => unknown; collectOrder: (s: GameState, now: number) => { payout: number } | null };
const orders = (): Orders | null => anyModule(ordersModule).ORDERS ? ordersModule as unknown as Orders : null;
const collectOrder = (s: GameState, now: number) => orders()?.collectOrder(s, now)?.payout ?? 0;
/** On the way out, the longest catering order that is ready by the next visit (or the shortest). */
function startOrderFor(s: GameState, gapSeconds: number, now: number) {
  const o = orders();
  if (!o || !s.manager.hired) return;
  const fits = o.ORDERS.filter((d) => d.hours * 3600 <= gapSeconds);
  const kind = (fits.at(-1) ?? o.ORDERS[0]).id;
  o.startOrder(s, kind, now);
}

/** Whether the next room can't be paid for yet because another is being built. */
const building = (s: GameState) => {
  const block = optional<(s: GameState, id: RegionId) => string | null>(regionsModule, 'regionBlock');
  const next = REGIONS.find((r) => !s.regions.includes(r.id) && !(anyModule(s).construction as { id: string }[] | undefined)?.some((c) => c.id === r.id));
  return !next || (!!block && ['busy', 'previous'].includes(block(s, next.id) ?? ''));
};
/** The next room nobody has paid for yet. */
const nextRoom = (s: GameState) => REGIONS.find((r) => !s.regions.includes(r.id) && !(anyModule(s).construction as { id: string }[] | undefined)?.some((c) => c.id === r.id));

/** Puts `id` on the menu, dropping one dish of the same category if that earns more. */
function addToMenu(s: GameState, id: ItemId) {
  setOnMenu(s, id, true);
  const category = MENU.find((m) => m.id === id)!.category;
  let best = expectedDayProfit(s), drop: ItemId | null = null;
  for (const other of s.onMenu) {
    if (other === id || MENU.find((m) => m.id === other)?.category !== category) continue;
    setOnMenu(s, other, false);
    const p = expectedDayProfit(s);
    if (p > best) (best = p), (drop = other);
    setOnMenu(s, other, true);
  }
  if (drop) setOnMenu(s, drop, false);
}

function candidates(s: GameState, now: number): Candidate[] {
  const out: Candidate[] = [];
  const level = (id: ItemId, n: 1 | 10, menu: boolean): Candidate | null => {
    const q = quoteItem(s, id, n);
    if (q.count <= 0 || !isItemAvailable(s, id)) return null;
    return { key: `item:${id}+${n}`, cost: q.cost, apply: (c) => {
      if (!buyItem(c, id, n)) return false;
      if (menu) addToMenu(c, id);
      return true;
    } };
  };
  for (const id of s.onMenu) for (const n of [1, 10] as const) { const c = level(id, n, false); if (c) out.push(c); }
  // Per category: the best owned dish not on the menu, and the next one to unlock.
  for (const cat of CATEGORIES) {
    const chain = MENU.filter((m) => m.category === cat);
    const off = [...chain].reverse().find((m) => s.items[m.id] > 0 && !s.onMenu.includes(m.id) && isItemAvailable(s, m.id));
    const next = chain.find((m) => s.items[m.id] === 0 && isItemAvailable(s, m.id));
    for (const m of [off, next]) if (m) for (const n of [1, 10] as const) { const c = level(m.id, n, true); if (c) out.push(c); }
  }
  for (const u of UPGRADES) {
    if (s.upgrades[u.id] >= upgradeMax(s, u.id)) continue;
    const q = quoteUpgrade(s, u.id, 1);
    if (q.count <= 0) continue;
    out.push({ key: `upgrade:${u.id}`, cost: q.cost, apply: (c) => buyUpgrade(c, u.id, 1) });
  }
  // The kitchen is worth nothing on its own: count it with its first bread.
  if (!s.kitchen) {
    const roll = quoteItem({ ...s, kitchen: true } as GameState, 'roll', 1).cost;
    out.push({ key: 'kitchen', cost: KITCHEN_COST + roll, apply: (c) => unlockKitchen(c) && buyItem(c, 'roll', 1) && (addToMenu(c, 'roll'), true) });
  }
  const next = nextRoom(s);
  if (next && !building(s)) out.push({ key: `region:${next.id}`, cost: regionDef(next.id).cost, apply: (c) => unlockRoom(c, next.id, now) });
  return out;
}

/** Rooms only pay off once built, which the analytic profit can't see, so value them as opened. */
function profitAfter(s: GameState, c: Candidate, now: number): number | null {
  const copy = shallow(s);
  copy.coins = Number.MAX_SAFE_INTEGER / 4;
  if (!c.apply(copy)) return null;
  if (c.key.startsWith('region:')) finishBuilding(copy, Number.MAX_SAFE_INTEGER);
  syncKitchen(copy);
  const p = expectedDayProfit(copy);
  syncKitchen(s);
  void now;
  return p;
}

const syncKitchen = (s: GameState) => setKitchenLevel(s.kitchen ? Math.min(2, s.upgrades.cook) : 0);

function canBuySomething(s: GameState, now: number): boolean {
  const cost = optional<(s: GameState) => number | null>(managerModule, 'tillUpgradeCost')?.(s);
  if (typeof cost === 'number' && cost <= s.coins) return true;
  const base = expectedDayProfit(s);
  return candidates(s, now).some((c) => c.cost <= s.coins && (profitAfter(s, c, now) ?? 0) > base * 1.001);
}

/** One pass of switching single dishes on or off while it earns more. */
function tidyMenu(s: GameState) {
  for (const m of MENU) {
    if (s.items[m.id] <= 0 || !isItemAvailable(s, m.id)) continue;
    const before = expectedDayProfit(s), on = s.onMenu.includes(m.id);
    if (on && s.onMenu.length === 1) continue;
    setOnMenu(s, m.id, !on);
    if (expectedDayProfit(s) <= before) setOnMenu(s, m.id, on);
  }
}

/**
 * Buys whatever pays for itself soonest, counting the wait to afford it, and saves up
 * when the best thing isn't affordable yet. Idle conveniences come first.
 */
function spend(s: GameState, incomePerHour: number, now: number): number {
  let bought = 0;
  finishBuilding(s, now);
  if (!s.manager.hired && managerUnlocked(s) && s.coins >= MANAGER_COST && hireManager(s)) bought++;
  // Players open new rooms and the kitchen as soon as they comfortably can, payback or not.
  for (let next = nextRoom(s); next && !building(s) && regionDef(next.id).cost <= s.coins * 0.5 && unlockRoom(s, next.id, now); next = nextRoom(s)) bought++;
  if (!s.kitchen && KITCHEN_COST * 4 <= s.coins && unlockKitchen(s)) { bought++; buyItem(s, 'roll', 1); addToMenu(s, 'roll'); syncKitchen(s); }
  const tillUpgrade = optional<(s: GameState) => boolean>(managerModule, 'upgradeTill');
  const tillCost = optional<(s: GameState) => number | null>(managerModule, 'tillUpgradeCost');
  for (let guard = 0; guard < 200; guard++) {
    const base = expectedDayProfit(s);
    if (tillUpgrade && tillCost && s.manager.hired) {
      const cost = tillCost(s);
      // A bigger till is bought once it's comfortably affordable.
      if (cost !== null && cost <= s.coins * 0.5 && tillUpgrade(s)) { bought++; continue; }
    }
    let best: { c: Candidate; score: number } | null = null;
    const perDay = incomePerHour / Math.max(1e-9, base);
    for (const c of candidates(s, now)) {
      const after = profitAfter(s, c, now);
      if (after === null) continue;
      const gain = after - base;
      if (gain <= 1e-9) continue;
      const wait = c.cost <= s.coins ? 0 : (c.cost - s.coins) / Math.max(1e-9, incomePerHour);
      // Hours to afford, plus hours of income to earn the price back.
      const score = wait + c.cost / (gain * perDay);
      if (!best || score < best.score) best = { c, score };
    }
    if (!best || best.c.cost > s.coins) break;
    if (!best.c.apply(s)) break;
    syncKitchen(s);
    bought++;
  }
  return bought;
}

// ---------------------------------------------------------------- the run

function playDay(s: GameState) {
  const profit = expectedDayProfit(s);
  s.served += expectedCustomers(s);
  earn(s, profit);
  s.day++;
  while (claimGoal(s) > 0) { /* claim every finished goal */ }
}

export interface RunOptions { days?: number; branchAtStars?: number }

export function runProfile(profile: Profile, options: RunOptions = {}): PacingResult {
  const days = options.days ?? 14;
  setSceneHeight(MIN_SCENE_H);
  let s = createInitialState(0);
  s.profile = { cafeName: 'Pacing', ownerName: '', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
  syncKitchen(s);
  const reached: PacingResult['reached'] = {};
  const mark = (key: Milestone, hours: number) => { if (reached[key] === undefined) reached[key] = Math.round(hours * 100) / 100; };
  const check = (hours: number) => {
    if (s.manager.hired) mark('manager', hours);
    if (s.kitchen) mark('kitchen', hours);
    for (let level = 1; level <= s.manager.till; level++) mark(`till${level}`, hours);
    for (const r of s.regions) mark(s.chain.branches === 0 ? r : `${r}@${s.chain.branches + 1}`, hours);
    if (s.chain.branches > 0) mark('firstBranch', reached.firstBranch ?? hours);
  };
  let dry = 0, managed = 0, topDish = MENU[0];
  void reached;
  const noteDishes = () => { for (const m of MENU) if (s.items[m.id] > 0 && m.baseCost > topDish.baseCost) topDish = m; };
  const awayDays: number[] = [];
  const hourly = (state: GameState) => expectedDayProfit(state) * 3600 / ON_SCREEN_CYCLE_SECONDS;
  const awayHourly = (state: GameState) => optional<(s: GameState) => number>(managerModule, 'awayHourly')?.(state) ?? 0;

  // The live café pauses off screen and resumes mid-day, so on-screen time carries over.
  let carry = 0;
  const session = (start: number, minutes: number, next: number) => {
    const now = start * HOUR;
    finishBuilding(s, now);
    const away = collectAwayEarnings(s, now);
    const franchise = collectFranchises(s, now) + collectOrder(s, now);
    const dayProfit = expectedDayProfit(s);
    if (s.manager.hired && dayProfit > 0) awayDays.push((away.amount + franchise) / dayProfit);
    while (claimGoal(s) > 0) { /* claim */ }
    tidyMenu(s);
    // A dry return: nothing that would raise the café's earnings is affordable on arrival.
    if (s.manager.hired) { managed++; if (!canBuySomething(s, now)) dry++; }
    // Plan with the income the player will see until next time: away pay once there's a manager.
    const income = () => Math.max(1e-9, (s.manager.hired ? awayHourly(s) || hourly(s) * 0.05 : hourly(s) * 0.05) + franchiseHourly(s));
    spend(s, income(), now);
    check(start);
    carry += minutes * 60;
    let played = 0;
    while (carry >= ON_SCREEN_CYCLE_SECONDS) {
      carry -= ON_SCREEN_CYCLE_SECONDS;
      playDay(s);
      played++;
      const at = start + (played * ON_SCREEN_CYCLE_SECONDS) / 3600;
      // Long sessions shop every few days, like a player glancing at the Upgrades tab.
      if (played % 5 === 0 || carry < ON_SCREEN_CYCLE_SECONDS) {
        finishBuilding(s, at * HOUR);
        if (played % 25 === 0) tidyMenu(s);
        spend(s, income(), at * HOUR);
      }
      check(at);
    }
    const end = start + minutes / 60;
    finishBuilding(s, end * HOUR);
    // A branch opens when it brings enough stars; the next café starts at once.
    // A branch opens once its stars would raise prices by another fifth (and it brings two or more).
    if (branchUnlocked(s) && starsOnBranch(s) >= Math.max(options.branchAtStars ?? 2, Math.ceil(0.2 * (1 + CHAIN_STAR_BONUS * s.chain.stars) / CHAIN_STAR_BONUS))) {
      // A new place each time, so the chain covers all five (the first café is in the old town).
      const places = ['seaside', 'forest', 'city', 'flowers', 'town'] as const;
      const next = openBranch({ ...s, phase: 'prep' }, places[s.chain.branches % places.length], end * HOUR);
      if (next) { s = next; syncKitchen(s); spend(s, income(), end * HOUR); }
    }
    noteDishes();
    check(end);
    startOrderFor(s, (next - end) * 3600, end * HOUR);
    s.manager.lastSeen = end * HOUR;
  };

  const checkIns = profile.checkIns(days);
  session(0, FIRST_SESSION_MINUTES, checkIns[0]?.at ?? Infinity);
  checkIns.forEach((c, i) => session(c.at, c.minutes, checkIns[i + 1]?.at ?? Infinity));
  const sorted = [...awayDays].sort((a, b) => a - b);
  return {
    profile: profile.id,
    reached,
    checkIns: checkIns.length + 1,
    dryReturns: dry,
    managedReturns: managed,
    medianAwayDays: Math.round((sorted[Math.floor(sorted.length / 2)] ?? 0) * 100) / 100,
    topDish: `${topDish.id} ($${topDish.baseCost.toLocaleString('en-US')})`,
    final: { day: s.day, branches: s.chain.branches, stars: s.chain.stars, places: new Set(s.chain.franchises.map((f) => f.location)).size, totalEarned: Math.round(s.totalEarned), dishes: MENU.filter((m) => s.items[m.id] > 0).length },
  };
}

export const runAll = (options?: RunOptions) => PROFILES.map((p) => runProfile(p, options));

/** Hours as "2d 5h" or "35m", for reports. */
export function formatHours(h: number | undefined): string {
  if (h === undefined) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h * 10) / 10}h`;
  return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
}

export function table(results: PacingResult[]): string {
  const cols: Milestone[] = ['manager', 'kitchen', 'reading', 'greenhouse', 'terrace', 'firstBranch', 'terrace@2', 'till1', 'till2', 'till3', 'till4'];
  const lines = [
    `| Profile | ${cols.join(' | ')} | Rerun to terrace | Dry returns | Median away pay (days) | Final day · branches · stars · dishes · places | Priciest dish reached |`,
    `|---|${cols.map(() => '---:').join('|')}|---:|---:|---:|---|---|`,
  ];
  for (const r of results) {
    const t1 = r.reached.terrace, b = r.reached.firstBranch, t2 = r.reached['terrace@2'];
    const rerun = t1 && b !== undefined && t2 !== undefined ? `${Math.round(((t2 - b) / t1) * 100)}%` : '—';
    lines.push(`| ${r.profile} | ${cols.map((c) => formatHours(r.reached[c])).join(' | ')} | ${rerun} | ${r.dryReturns}/${r.managedReturns} | ${r.medianAwayDays} | ${r.final.day} · ${r.final.branches} · ${r.final.stars} · ${r.final.dishes} · ${r.final.places ?? '—'} | ${r.topDish} |`);
  }
  return lines.join('\n');
}

// Re-exported so the report can name the tuning in force.
export const tuning = () => ({
  managerCost: MANAGER_COST,
  ...Object.fromEntries(Object.entries(anyModule(managerModule)).filter(([k, v]) => /^[A-Z_]+$/.test(k) && typeof v !== 'function')),
  ...Object.fromEntries(Object.entries(anyModule(chainModule)).filter(([k, v]) => /^[A-Z_]+$/.test(k) && typeof v !== 'function')),
  regions: REGIONS.map((r) => ({ id: r.id, cost: r.cost, ...(anyModule(r).buildSeconds ? { buildSeconds: anyModule(r).buildSeconds } : {}) })),
});
