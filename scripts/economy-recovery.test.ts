/** Opt-in emergency-bean evidence. Frozen earlier runners and data are untouched. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INGREDIENTS, type ItemId } from '../src/game/data';
import { openShop, type DayReport } from '../src/game/day';
import { bakeForForecast, ingredientDef, menuItems, restock, servingCost } from '../src/game/economy';
import { GOALS } from '../src/game/goals';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { canEmergencyRestock, emergencyRestock } from '../src/game/recovery';
import { reputationScore } from '../src/game/reputation';
import { Sim } from '../src/game/sim';
import { deserialize, serialize, type GameState } from '../src/game/state';
import { fixture, fixtureInfo, liquidAssets, rng, SEEDS, type Stage } from './economy-lab';

const DT = 0.05;
const OPEN_SECONDS = 180;
const HORIZON = 1800;
type Case = { id: string; stage: Stage; insolvent: boolean; offMenu: boolean; comfortDeadlock?: boolean; menu: ItemId[] };
export const CASES: Case[] = [
  { id: 'insolvent/espresso-on-menu', stage: 'early', insolvent: true, offMenu: false, menu: ['espresso'] },
  { id: 'insolvent/espresso-off-menu', stage: 'early', insolvent: true, offMenu: true, menu: ['latte'] },
  { id: 'insolvent/comfort-placement-deadlock', stage: 'early', insolvent: true, offMenu: false, comfortDeadlock: true, menu: ['espresso'] },
  { id: 'normal/early', stage: 'early', insolvent: false, offMenu: false, menu: ['espresso'] },
  { id: 'normal/mid', stage: 'mid', insolvent: false, offMenu: false, menu: ['espresso', 'roll'] },
  { id: 'normal/expanded', stage: 'expanded', insolvent: false, offMenu: false, menu: ['flatwhite', 'cookie'] },
];
function initial(c: Case) {
  const s = fixture(c.stage);
  setSceneHeight(MIN_SCENE_H); setKitchenLevel(s.kitchen ? s.upgrades.cook : 0);
  s.onMenu = [...c.menu];
  if (c.insolvent) {
    s.coins = 0;
    for (const ingredient of INGREDIENTS) s.pantry[ingredient.id] = 0;
    if (c.offMenu) { s.items.americano = 1; s.items.latte = 1; }
  }
  if (c.comfortDeadlock) {
    s.goal = GOALS.findIndex((g) => g.id === 'comfort');
    s.decor.stored = { art_cat: 1, art_landscape: 1, poster_bakery: 1 };
    // Main room has only two 4-by-5 wall panels: at most two height-3
    // decorations fit, so owned comfort 16 has legal maximum 12 < goal 15.
    if (s.regions.length || s.upgrades.tables || s.goal < 0) throw new Error('Invalid comfort deadlock fixture');
  }
  if (menuItems(s).length !== c.menu.length) throw new Error('Invalid experimental menu');
  return s;
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function paidFoodCost(s: GameState, sim: Sim) {
  const cost = (r: Partial<Record<ItemId, number>>) => Object.entries(r).reduce((sum, [id, n]) => sum + servingCost(id as ItemId) * n!, 0);
  const accepted = sim.customers.filter((c) => !c.hasCup && ['ordering', 'toSeat', 'waiting'].includes(c.phase));
  return cost(s.shelf) + cost(s.inProduction) + accepted.reduce((sum, c) => sum + servingCost(c.order) + (c.extra ? servingCost(c.extra) : 0), 0);
}
export function recoverySample(c: Case, seed: number, polling: boolean, seconds = HORIZON) {
  const steps = Math.round(seconds / DT);
  if (steps <= 0 || Math.abs(steps * DT - seconds) > 1e-8) throw new Error('Nonintegral clock');
  const s = initial(c);
  const starting = liquidAssets(s);
  const startingState = JSON.parse(serialize(s)) as GameState;
  const sim = new Sim(rng(seed));
  const settled: { atSeconds: number; openSeconds: number; closingSeconds: number; report: DayReport }[] = [];
  const grants: { atSeconds: number; day: number; beans: number; value: number; coinsBefore: number; coinsAfter: number; menuBefore: ItemId[]; menuAfter: ItemId[]; duplicateClaimBlocked: boolean }[] = [];
  let liveOpenTicks = 0, liveClosingTicks = 0, totalOpenTicks = 0, totalClosingTicks = 0;
  let ingredientsPurchased = 0, firstSaleAtSeconds: number | null = null, checks = 0;
  for (let tick = 0; tick < steps; tick++) {
    const now = tick * DT;
    if (s.phase === 'open' && liveOpenTicks === OPEN_SECONDS / DT) sim.beginClosing(s);
    if (s.phase === 'closing' && sim.finishedService) settled.push({ atSeconds: now, openSeconds: liveOpenTicks * DT, closingSeconds: liveClosingTicks * DT, report: sim.closeShop(s)! });
    if (polling) {
      checks++;
      if (canEmergencyRestock(s)) {
        const before = { beans: s.pantry.beans, coins: s.coins, earned: s.totalEarned, revenue: s.today.revenue, menu: [...s.onMenu], pantry: { ...s.pantry } };
        if (!emergencyRestock(s)) throw new Error('Eligible grant unexpectedly refused');
        if (s.pantry.beans !== before.beans + 1 || s.coins !== before.coins || s.totalEarned !== before.earned || s.today.revenue !== before.revenue) throw new Error('Grant minted cash/revenue or incorrect bean count');
        if (INGREDIENTS.some((i) => i.id !== 'beans' && s.pantry[i.id] !== before.pantry[i.id])) throw new Error('Grant changed other stock');
        if (!before.menu.every((id) => s.onMenu.includes(id)) || !s.onMenu.includes('espresso')) throw new Error('Grant removed menu choices or failed to enable espresso');
        const immediate = serialize(s);
        const duplicateClaimBlocked = !emergencyRestock(s);
        if (!duplicateClaimBlocked || serialize(s) !== immediate) throw new Error('Grant can be duplicated');
        grants.push({ atSeconds: now, day: s.day, beans: 1, value: ingredientDef('beans').cost, coinsBefore: before.coins, coinsAfter: s.coins, menuBefore: before.menu, menuAfter: [...s.onMenu], duplicateClaimBlocked });
      }
    }
    if (s.phase === 'prep') {
      liveOpenTicks = 0; liveClosingTicks = 0;
      bakeForForecast(s);
      const cashBefore = s.coins; restock(s); ingredientsPurchased += cashBefore - s.coins;
      openShop(s);
    }
    const open = s.phase === 'open';
    const events = sim.update(s, DT);
    if (firstSaleAtSeconds === null && events.some((event) => event.type === 'sale')) firstSaleAtSeconds = (tick + 1) * DT;
    if (open) { totalOpenTicks++; liveOpenTicks++; } else { totalClosingTicks++; liveClosingTicks++; }
  }
  // No administration, new grant, drain or settlement after the last tick.
  const assets = liquidAssets(s);
  const today = structuredClone(s.today);
  const reports = [...settled.map((d) => d.report), today];
  const sum = (key: 'revenue' | 'ingredientCost' | 'petCost' | 'promotionCost' | 'served' | 'missed' | 'doorLost') => reports.reduce((n, r) => n + r[key], 0);
  const revenue = sum('revenue');
  const operatingProfit = revenue - sum('ingredientCost') - sum('petCost') - sum('promotionCost');
  const grantValue = grants.reduce((n, g) => n + g.value, 0);
  const netResourceGain = assets.total - starting.total;
  // The gift is an in-kind capital contribution, never revenue. Consuming its
  // bean still expenses its ingredient cost, just like any purchased serving.
  const ledgerError = netResourceGain - operatingProfit - grantValue;
  const cashLedgerError = s.coins - (starting.cash + revenue - ingredientsPurchased);
  if (Math.abs(ledgerError) > 1e-5 || Math.abs(cashLedgerError) > 1e-5) throw new Error(`Aid ledger mismatch: ${ledgerError}/${cashLedgerError}`);
  if (Math.abs(s.totalEarned - startingState.totalEarned - revenue) > 1e-5) throw new Error('Grant entered earned revenue');
  if (totalOpenTicks + totalClosingTicks !== steps) throw new Error('Clock mismatch');
  const snapshot = sim.snapshot(s);
  const stateBytes = serialize(s), simBytes = JSON.stringify(snapshot);
  const observed = {
    seed, seconds: steps * DT, ticks: steps, starting, startingState, settled,
    terminal: { state: JSON.parse(stateBytes) as GameState, sim: snapshot, stateByteHash: hash(stateBytes), simByteHash: hash(simBytes), assets, liveFoodAtCostExcludedFromGain: paidFoodCost(s, sim) },
    completedDays: settled.length, openSeconds: totalOpenTicks * DT, closingSeconds: totalClosingTicks * DT,
    revenue, operatingProfit, netResourceGain, earnedNetProfitExcludingAid: netResourceGain - grantValue,
    ingredientsPurchased, ingredientsConsumed: sum('ingredientCost'), grantValue,
    served: sum('served'), lostIncludingDoor: sum('missed') + sum('doorLost'), rating: reputationScore(s.reputation), firstSaleAtSeconds,
    ledgerError, cashLedgerError,
  };
  return { polling, checks, grants, observed };
}
function pair(c: Case, seed: number) {
  const control = recoverySample(c, seed, false);
  const polled = recoverySample(c, seed, true);
  const byteEquivalent = JSON.stringify(control.observed) === JSON.stringify(polled.observed);
  if (!c.insolvent && (!byteEquivalent || polled.grants.length)) throw new Error(`Normal economy changed by polling: ${c.id}/${seed}`);
  if (JSON.stringify(control.observed.startingState) !== JSON.stringify(polled.observed.startingState)) throw new Error('Unequal starting fixtures');
  return { seed, control, polled, byteEquivalent, netResourceDelta: polled.observed.netResourceGain - control.observed.netResourceGain,
    earnedProfitDeltaExcludingAid: polled.observed.earnedNetProfitExcludingAid - control.observed.earnedNetProfitExcludingAid };
}
type Pair = ReturnType<typeof pair>;
function stats(xs: number[]) {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  const h = n > 1 ? 2.04523 * sd / Math.sqrt(n) : 0;
  return { n, mean, sd, ci95Low: mean - h, ci95High: mean + h, min: Math.min(...xs), max: Math.max(...xs) };
}
function validate(c: Case, rows: Pair[], seeds: number[]) {
  if (rows.length !== seeds.length) throw new Error('Incomplete seed batch');
  for (const [i, row] of rows.entries()) {
    if (row.seed !== seeds[i]) throw new Error('Seed mismatch');
    for (const trial of [row.control, row.polled]) {
      const r = trial.observed;
      if (r.seed !== row.seed || r.seconds !== HORIZON || r.ticks !== HORIZON / DT || Math.abs(r.openSeconds + r.closingSeconds - HORIZON) > 1e-7) throw new Error('Clock mismatch');
      if (r.settled.some((d) => d.atSeconds >= HORIZON) || trial.grants.some((g) => g.atSeconds >= HORIZON)) throw new Error('After-cutoff action');
      if (Math.abs(r.netResourceGain - r.operatingProfit - r.grantValue) > 1e-5 || Math.abs(r.cashLedgerError) > 1e-5) throw new Error('Invalid saved ledger');
      if (![r.revenue, r.operatingProfit, r.netResourceGain, r.rating, ...Object.values(r.terminal.assets)].every(Number.isFinite) || Object.values(r.terminal.assets).some((n) => n < -1e-7)) throw new Error('Invalid final assets');
      if (trial.grants.some((g) => g.beans !== 1 || !g.duplicateClaimBlocked || g.coinsBefore !== g.coinsAfter)) throw new Error('Invalid grant');
    }
    if (c.insolvent && (row.control.observed.served !== 0 || row.control.observed.netResourceGain !== 0 || row.polled.grants.length !== 1 || row.polled.observed.served <= 0 || row.polled.observed.earnedNetProfitExcludingAid <= 0)) throw new Error('Stranded control or recovery outcome mismatch');
    if (!c.insolvent && (row.polled.grants.length || !row.byteEquivalent || JSON.stringify(row.control.observed) !== JSON.stringify(row.polled.observed))) throw new Error('Ordinary play regression');
  }
}
function sourceHash() { return hash(readdirSync('src/game').filter((p) => p.endsWith('.ts') && !p.endsWith('.test.ts')).sort().map((p) => `${p}\n${readFileSync(join('src/game', p), 'utf8')}`).join('\n')); }
function runnerHash() { return hash(readFileSync('scripts/economy-recovery.test.ts', 'utf8') + readFileSync('scripts/economy-lab.ts', 'utf8')); }
function atomic(path: string, value: unknown) { writeFileSync(path + '.tmp', JSON.stringify(value, null, path.includes('summary') ? 2 : undefined) + '\n'); renameSync(path + '.tmp', path); }
function summaries(batches: Record<string, Pair[]>) {
  return CASES.filter((c) => batches[c.id]).map((c) => {
    const rows = batches[c.id];
    const side = (key: 'control' | 'polled') => {
      const rs = rows.map((r) => r[key]);
      return { grants: stats(rs.map((r) => r.grants.length)), grantValue: stats(rs.map((r) => r.observed.grantValue)),
        netResourceGain: stats(rs.map((r) => r.observed.netResourceGain)), earnedNetProfitExcludingAid: stats(rs.map((r) => r.observed.earnedNetProfitExcludingAid)),
        served: stats(rs.map((r) => r.observed.served)), revenue: stats(rs.map((r) => r.observed.revenue)),
        firstSaleSeconds: rs.some((r) => r.observed.firstSaleAtSeconds === null) ? null : stats(rs.map((r) => r.observed.firstSaleAtSeconds!)) };
    };
    return { case: c, n: rows.length, control: side('control'), polled: side('polled'), byteEquivalentSeeds: rows.filter((r) => r.byteEquivalent).length,
      recoverySuccessSeeds: rows.filter((r) => r.polled.observed.served > 0 && r.polled.observed.earnedNetProfitExcludingAid > 0).length,
      pairedNetResourceDelta: stats(rows.map((r) => r.netResourceDelta)), pairedEarnedProfitDeltaExcludingAid: stats(rows.map((r) => r.earnedProfitDeltaExcludingAid)) };
  });
}
export function runRecoveryExperiment() {
  const pilot = process.env.EMERGENCY_RECOVERY_PILOT === '1';
  const label = process.env.EMERGENCY_RECOVERY_LABEL ?? (pilot ? 'emergency-recovery-v2-pilot' : 'emergency-recovery-v2');
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe output label');
  const seeds = pilot ? SEEDS.slice(0, 1) : SEEDS;
  const source = sourceHash(), runner = runnerHash();
  const historical = JSON.parse(readFileSync('docs/long-task/results/fixed-clock-balanced.json', 'utf8')).metadata.sourceHash;
  const previous = JSON.parse(readFileSync('docs/long-task/results/emergency-recovery.json', 'utf8')).metadata;
  const metadata = { version: 2, previousRecoveryVersion: previous.version, previousRecoverySourceHash: previous.sourceHash, previousRecoveryRunnerHash: previous.runnerHash, label, pilot, sourceHash: source, runnerHash: runner, previousFixedClockSourceHash: historical, seeds,
    dt: DT, totalSeconds: HORIZON, openWindowSeconds: OPEN_SECONDS, cases: CASES, fixtures: (['early', 'mid', 'expanded'] as Stage[]).map(fixtureInfo),
    methodology: [
      'Each control/polled trajectory advances exactly 36,000 real Sim ticks at 0.05 seconds, including natural closing service, for 1,800 total seconds. Preparation is instantaneous. No grant, settlement, purchase or service happens after cutoff.',
      'Same source, same seed, same starting state: intervention is polling eligibility each tick and accepting an eligible grant. No-rescue control never calls the new API. This is not an original-source comparison; old source hashes/data remain historical and untouched.',
      'Insolvency means zero cash and empty pantry, existing espresso ownership. The first two probes exhaust all one-off goals; the comfort probe instead has current comfort goal 15 and three owned wall decorations (8+4+4) whose legal maximum is 12 in the main room. Off-menu probe starts with latte selected and espresso owned but unselected. The API may append espresso without deleting latte.',
      'Aid is exactly one bean at current purchase-cost value, recorded separately as an in-kind capital contribution. It never enters sales revenue or totalEarned. Consumption still expenses the serving ingredient cost.',
      'Net cash-plus-pantry/prepayment resource gain = operating profit + grant value. Earned net profit excluding aid subtracts the grant value. Independent cash ledger excludes the in-kind grant entirely. No other cash, stock, upgrades, loans, rewards, clicks or salvage are injected.',
      'Normal early espresso, mid mixed and expanded mixed each use 30 paired seeds. Zero grants and byte-identical complete observed economic trajectories, terminal serialized state and Sim snapshot are mandatory.',
      'Live shelf, kitchen WIP and accepted undelivered order costs stay expensed; they are diagnosed separately, never credited as cash or imagined sale proceeds. Global height/kitchen geometry reset before every trial.',
      '30 fixed seeds and descriptive paired Student t(29)=2.04523 intervals; not multiple-comparison corrected. A one-seed pilot has no inferential interval. Results concern fixed policies within the observed horizon.',
    ] };
  const dir = 'docs/long-task/results'; mkdirSync(dir, { recursive: true });
  const path = `${dir}/${label}.json`;
  let batches: Record<string, Pair[]> = {};
  if (existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    if (saved.metadata.sourceHash !== source || saved.metadata.runnerHash !== runner || JSON.stringify(saved.metadata.seeds) !== JSON.stringify(seeds)) throw new Error('Changed source/runner/seeds; use a new label');
    batches = saved.batches;
  }
  for (const c of CASES) {
    if (batches[c.id]) { validate(c, batches[c.id], seeds); continue; }
    const start = Date.now();
    batches[c.id] = seeds.map((seed) => pair(c, seed));
    validate(c, batches[c.id], seeds);
    if (sourceHash() !== source || runnerHash() !== runner) throw new Error('Source changed during experiment');
    const complete = CASES.every((c) => batches[c.id]);
    atomic(path, { metadata, complete, batches });
    atomic(`${dir}/${label}-summary.json`, { metadata, complete, completedCases: Object.keys(batches).length, expectedCases: CASES.length, cases: summaries(batches) });
    console.log(`${label}: ${c.id}: ${seeds.length} paired seeds in ${((Date.now() - start) / 1000).toFixed(1)}s (${Object.keys(batches).length}/${CASES.length})`);
  }
  const complete = CASES.every((c) => batches[c.id]);
  atomic(path, { metadata, complete, batches });
  atomic(`${dir}/${label}-summary.json`, { metadata, complete, completedCases: Object.keys(batches).length, expectedCases: CASES.length, cases: summaries(batches) });
  return { complete };
}

describe('emergency bean experimental accounting', () => {
  it('tracks an in-kind bean outside cash, sales and earned revenue', () => {
    const c = CASES[0]; const row = recoverySample(c, SEEDS[0], true, 10);
    expect(row.grants).toHaveLength(1); expect(row.observed.grantValue).toBe(1);
    expect(row.observed.netResourceGain).toBeCloseTo(row.observed.operatingProfit + 1, 6);
    expect(row.grants[0].coinsBefore).toBe(0); expect(row.grants[0].coinsAfter).toBe(0);
    expect(row.grants[0].duplicateClaimBlocked).toBe(true);
  });
  it('rescues the genuine legal-placement comfort deadlock', () => {
    const c = CASES.find((c) => c.comfortDeadlock)!;
    const s = initial(c);
    expect(s.goal).toBe(GOALS.findIndex((g) => g.id === 'comfort'));
    expect(canEmergencyRestock(s)).toBe(true);
    const row = recoverySample(c, SEEDS[0], true, 10);
    expect(row.grants).toHaveLength(1);
    expect(row.observed.served).toBeGreaterThan(0);
  });
  it('persists a granted bean and enabled espresso through ordinary save/reload without duplication', () => {
    const s = initial(CASES[1]);
    expect(s.onMenu).toEqual(['latte']); expect(emergencyRestock(s)).toBe(true);
    const loaded = deserialize(serialize(s), 0);
    expect(loaded.pantry.beans).toBe(1); expect(loaded.coins).toBe(0); expect(loaded.totalEarned).toBe(0);
    expect(loaded.onMenu).toContain('espresso'); expect(loaded.onMenu).toContain('latte');
    expect(loaded.goal).toBe(s.goal);
    const before = serialize(loaded); expect(emergencyRestock(loaded)).toBe(false); expect(serialize(loaded)).toBe(before);
  });
  it('is deterministic, exact-clock, and normal polling has no byte-level effect', () => {
    const c = CASES.find((c) => c.id === 'normal/early')!; const control = recoverySample(c, SEEDS[1], false, 180); const polled = recoverySample(c, SEEDS[1], true, 180);
    expect(polled.grants).toHaveLength(0); expect(polled.checks).toBe(3600);
    expect(JSON.stringify(polled.observed)).toBe(JSON.stringify(control.observed));
    // The trading day ends at 180 s (dcacd65): the cafe has just begun closing, but nothing settles or drains.
    expect(polled.observed.completedDays).toBe(0); expect(polled.observed.terminal.state.phase).toBe('closing');
    expect(polled.observed.openSeconds + polled.observed.closingSeconds).toBe(180);
  });
});
it.skipIf(process.env.EMERGENCY_RECOVERY !== '1')('writes paired rescue and ordinary-play evidence', () => {
  expect(runRecoveryExperiment().complete).toBe(true);
}, 86_400_000);
