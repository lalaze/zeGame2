/** Reproducible, opt-in economic experiments. Run via economy-lab.test.ts. */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INGREDIENTS, MENU, UPGRADES, ITEM_COST_GROWTH, type ItemId, type UpgradeId } from '../src/game/data';
import { MIN_SCENE_H, setSceneHeight, setKitchenLevel } from '../src/game/layout';
import { GOALS } from '../src/game/goals';
import { openShop } from '../src/game/day';
import { bakeForForecast, bulkCost, buyItem, buyUpgrade, dayNeeds, buyIngredient, restock, menuItems, servingCost } from '../src/game/economy';
import { KITCHEN_COST, unlockKitchen } from '../src/game/kitchen';
import { adoptCat, CARE_SECONDS, catDef, CATS, type CatId } from '../src/game/pets';
import { bookPromotion, promotionPlan, PROMOTION_PLANS, type PromotionId } from '../src/game/promotion';
import { REGIONS } from '../src/game/regions';
import { Sim } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';

export const DESIGN_VERSION = 3;
export const SEEDS = Array.from({ length: 30 }, (_, i) => (0x5eed1234 + i * 2654435761) >>> 0);
export const DAYS = 8;
export const OPEN_SECONDS = 180;
export const DT = 0.05;
export type Stage = 'early' | 'mid' | 'expanded';
export type Supply = 'forecast' | 'scarce-recover' | 'poor-rating' | 'zero-stock' | 'one-bean' | 'one-coin-shared' | 'nine-coin-complex';
export interface Scenario { id: string; stage: Stage; menuName: string; menu: ItemId[]; cat: boolean; cats?: CatId[]; capitalArm?: 'latte-unlock' | 'kitchen-roll' | 'espresso-ten'; promotion?: PromotionId; upgrade?: UpgradeId | 'espresso'; supply: Supply; pairId: string }
const BASIC: ItemId[] = ['espresso', 'americano', 'latte', 'blacktea', 'roll', 'bagel', 'donut'];
const LATER: ItemId[] = ['cappuccino', 'flatwhite', 'hotchoc', 'lemontea', 'baguette', 'cheesebun', 'scone', 'cookie'];
export const MENUS: Record<Stage, Record<string, ItemId[]>> = {
  early: { initial: ['espresso'] },
  mid: { fast: ['espresso'], high: ['latte'], drinks: ['espresso', 'americano', 'latte', 'blacktea'], bakery: ['roll', 'bagel', 'donut'], mixed: ['espresso', 'roll'], all: BASIC },
  expanded: { fast: ['espresso'], high: ['flatwhite'], drinks: ['flatwhite', 'lemontea'], bakery: ['baguette', 'cookie'], mixed: ['flatwhite', 'cookie'], all: [...BASIC, ...LATER] },
};
export function scenarios(): Scenario[] {
  const rows: Scenario[] = [];
  for (const stage of ['early', 'mid', 'expanded'] as Stage[]) for (const [menuName, menu] of Object.entries(MENUS[stage])) {
    const base = `${stage}/${menuName}`;
    const add = (suffix: string, options: Partial<Scenario> = {}) => rows.push({ id: `${base}/${suffix}`, stage, menuName, menu, cat: false, supply: 'forecast', pairId: `${base}/none`, ...options });
    add('none');
    // All interventions on the single early menu, and fast/mixed/all in later stages.
    if (stage === 'early' || ['fast', 'mixed', 'all'].includes(menuName)) {
      add('cat', { cat: true });
      if (stage !== 'early' && menuName === 'all') {
        add('premium-cat', { cats: ['mainecoon'] });
        add('three-cats', { cats: ['ginger', 'tuxedo', 'calico'] });
        add('three-cats-noteStar', { cats: ['ginger', 'tuxedo', 'calico'], promotion: 'noteStar' });
      }
      for (const plan of PROMOTION_PLANS) {
        add(plan.id, { promotion: plan.id });
        add(`cat-${plan.id}`, { cat: true, promotion: plan.id });
      }
    }
    if (stage === 'early') for (const capitalArm of ['latte-unlock', 'kitchen-roll', 'espresso-ten'] as const) add(capitalArm, { capitalArm });
    if (stage === 'early') for (const upgrade of ['espresso', 'machine', 'marketing'] as const) add(`upgrade-${upgrade}`, { upgrade });
    if (menuName === 'initial' || menuName === 'all') for (const supply of ['scarce-recover', 'poor-rating'] as Supply[]) add(supply, { supply });
    if (stage === 'early') for (const supply of ['zero-stock', 'one-bean', 'one-coin-shared', 'nine-coin-complex'] as Supply[]) add(supply, { supply });
  }
  return rows;
}

export function fixture(stage: Stage): GameState {
  const s = createInitialState(0);
  // Operational comparisons exclude one-off tutorial rewards.
  s.goal = GOALS.length;
  s.coins = stage === 'early' ? 1200 : stage === 'mid' ? 10000 : 50000;
  if (stage !== 'early') {
    s.kitchen = true;
    for (const id of BASIC) s.items[id] = 1;
  }
  if (stage === 'expanded') {
    for (const id of LATER) s.items[id] = 1;
    s.regions = ['reading', 'greenhouse'];
    Object.assign(s.upgrades, { marketing: 8, machine: 4, barista: 2, server: 1, cook: 1, tables: 2 });
  }
  return s;
}
export function liquidAssets(s: GameState) {
  const inventory = INGREDIENTS.reduce((sum, i) => sum + s.pantry[i.id] * i.cost, 0);
  const care = s.pets.reduce((sum, p) => sum + p.careSeconds / CARE_SECONDS * catDef(p.id)!.careCost, 0);
  const promotion = s.promotion ? s.promotion.remaining / promotionPlan(s.promotion.id)!.seconds * promotionPlan(s.promotion.id)!.cost : 0;
  return { cash: s.coins, inventory, care, promotion, total: s.coins + inventory + care + promotion };
}
export function fixtureInfo(stage: Stage) {
  const s = fixture(stage);
  const recipeCost = MENU.reduce((sum, m) => sum + (s.items[m.id] ? bulkCost(m.baseCost, ITEM_COST_GROWTH, m.id === 'espresso' ? 1 : 0, s.items[m.id] - (m.id === 'espresso' ? 1 : 0)) : 0), 0);
  const upgradesCost = UPGRADES.reduce((sum, u) => sum + bulkCost(u.baseCost, u.growth, 0, s.upgrades[u.id]), 0);
  const kitchenCost = s.kitchen ? KITCHEN_COST : 0;
  const regionsCost = REGIONS.filter((r) => s.regions.includes(r.id)).reduce((sum, r) => sum + r.cost, 0);
  return { stage, goalIndex: s.goal, goalRewards: 'exhausted/excluded', starting: liquidAssets(s), items: s.items, upgrades: s.upgrades, kitchen: s.kitchen, regions: s.regions, fixtureCosts: { recipes: recipeCost, upgrades: upgradesCost, kitchen: kitchenCost, regions: regionsCost, total: recipeCost + upgradesCost + kitchenCost + regionsCost }, note: 'Common owned fixture is endowed equally within stage, not paid again. Starter espresso/furniture are free. Working cash is experimental seed capital, not a claim about new-game progression.' };
}
export const rng = (seed: number) => { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; }; };
export function sample(scenario: Scenario, seed: number, days = DAYS, dt = DT) {
  const s = fixture(scenario.stage);
  setSceneHeight(MIN_SCENE_H);
  setKitchenLevel(s.kitchen ? s.upgrades.cook : 0);
  s.onMenu = [...scenario.menu];
  if (scenario.supply === 'zero-stock' || scenario.supply === 'one-bean') { s.coins = 0; s.pantry.beans = scenario.supply === 'one-bean' ? 1 : 0; }
  if (scenario.supply === 'one-coin-shared' || scenario.supply === 'nine-coin-complex') {
    s.pantry.beans = 0; s.coins = scenario.supply === 'one-coin-shared' ? 1 : 9;
    s.onMenu = scenario.supply === 'one-coin-shared' ? ['espresso', 'latte'] : ['latte', 'hotchoc'];
    for (const id of [...BASIC.filter((id) => ['espresso', 'americano', 'latte', 'blacktea'].includes(id)), 'hotchoc' as ItemId]) s.items[id] = 1;
  }
  if (scenario.supply === 'poor-rating') s.reputation.recent = Array.from({ length: 50 }, () => ({ stars: 1, reason: 'soldOut' as const, day: 0 }));
  if (menuItems(s).length !== s.onMenu.length) throw new Error(`Unavailable menu: ${scenario.id}`);
  const starting = liquidAssets(s);
  let capital = 0, investmentCash = 0, includedCare = 0;
  for (const id of scenario.cats ?? (scenario.cat ? ['ginger'] : [])) {
    const cat = catDef(id)!;
    if (!adoptCat(s, cat.id)) throw new Error('Unaffordable cat intervention');
    investmentCash += cat.adoption; includedCare += cat.careCost; capital += cat.adoption - cat.careCost;
  }
  if (scenario.upgrade) {
    const before = s.coins;
    const ok = scenario.upgrade === 'espresso' ? buyItem(s, 'espresso', 1) : buyUpgrade(s, scenario.upgrade, 1);
    if (!ok) throw new Error('Unaffordable upgrade intervention');
    capital += before - s.coins; investmentCash += before - s.coins;
  }
  if (scenario.capitalArm) {
    const before = s.coins;
    let ok = true;
    if (scenario.capitalArm === 'latte-unlock') { ok = buyItem(s, 'americano', 1) && buyItem(s, 'latte', 1); s.onMenu = ['latte']; }
    if (scenario.capitalArm === 'kitchen-roll') { ok = unlockKitchen(s) && buyItem(s, 'roll', 1); s.onMenu = ['espresso', 'roll']; }
    if (scenario.capitalArm === 'espresso-ten') ok = buyItem(s, 'espresso', 10);
    if (!ok) throw new Error('Unaffordable capital arm');
    capital += before - s.coins; investmentCash += before - s.coins;
  }
  const selectedMenu = [...s.onMenu];
  const sim = new Sim(rng(seed));
  const daily = [];
  let cumulativeOperatingProfit = 0, cumulativeRevenue = 0, cumulativeSpending = investmentCash;
  for (let day = 1; day <= days; day++) {
    const beforePrep = s.coins;
    let promotionBooked = 0;
    if (scenario.promotion && !s.promotion) {
      const before = s.coins;
      bookPromotion(s, scenario.promotion);
      promotionBooked = before - s.coins;
    }
    bakeForForecast(s);
    const needs = dayNeeds(s);
    const scarcityShare = scenario.supply === 'scarce-recover' && day <= 3 ? 0.2 : 1;
    // Exactly the game's proportional cash-constrained purchasing rule, with a
    // deliberate 20% target in the first three days of the scarcity probe.
    const order = INGREDIENTS.map((i) => ({ ...i, count: Math.max(0, Math.ceil((needs[i.id] ?? 0) * scarcityShare) - s.pantry[i.id]) }));
    const cost = order.reduce((sum, i) => sum + i.cost * i.count, 0);
    const share = cost > 0 ? Math.min(1, s.coins / cost) : 0;
    if (scarcityShare === 1) restock(s);
    else for (const i of order) { const count = Math.floor(i.count * share); if (count) buyIngredient(s, i.id, count); }
    const ingredientPurchases = beforePrep - s.coins - promotionBooked;
    const beforeOpen = s.coins;
    openShop(s);
    for (let step = 0; step < Math.round(OPEN_SECONDS / dt); step++) sim.update(s, dt);
    const queuedAtClosing = sim.customers.filter((c) => c.phase === 'queue').length;
    sim.beginClosing(s);
    let closingSteps = 0;
    while (!sim.finishedService && closingSteps < 300 / dt) { sim.update(s, dt); closingSteps++; }
    const closingTimedOut = !sim.finishedService;
    const report = sim.closeShop(s)!;
    const carePurchases = beforeOpen + report.revenue - s.coins;
    cumulativeSpending += ingredientPurchases + promotionBooked + carePurchases;
    cumulativeRevenue += report.revenue;
    cumulativeOperatingProfit += report.profit;
    const assets = liquidAssets(s);
    if (Object.values(s.pantry).some((n) => !Number.isFinite(n) || n < -1e-7) || Object.values(assets).some((n) => !Number.isFinite(n) || n < -1e-7)) throw new Error(`Invalid ending assets: ${scenario.id}`);
    if (closingTimedOut) throw new Error(`Service failed to drain within 300 seconds: ${scenario.id}`);
    const netLiquidProfit = assets.total - starting.total;
    const costOfSold = Object.entries(report.sales).reduce((sum, [id, n]) => sum + servingCost(id as ItemId) * n, 0);
    const wasteCost = Math.max(0, report.ingredientCost - costOfSold);
    const reconciliationError = netLiquidProfit - (cumulativeOperatingProfit - capital);
    if (Math.abs(reconciliationError) > 1e-5) throw new Error(`Accounting mismatch ${scenario.id}: ${reconciliationError}`);
    daily.push({ day, report, openSeconds: OPEN_SECONDS, closingSeconds: closingSteps * dt, closingTimedOut, queuedAtClosing,
      lostIncludingDoor: report.missed + report.doorLost, cancelled: report.reviews.reasons.cancelled ?? 0,
      wasteCost, wasteBeyondStaleCost: Math.max(0, wasteCost - report.staleCost),
      spending: { ingredients: ingredientPurchases, promotions: promotionBooked, care: carePurchases },
      assets, cumulativeSpending, cumulativeRevenue, cumulativeOperatingProfit,
      cashProfit: s.coins - starting.cash, netLiquidProfit, reconciliationError });
  }
  return { scenarioId: scenario.id, seed, starting, selectedMenu, investment: { cash: investmentCash, includedCare, capital }, daily };
}
export type Sample = ReturnType<typeof sample>;
export function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(1, values.length - 1));
  return { n: values.length, mean, sd, ci95Low: mean - 1.96 * sd / Math.sqrt(values.length), ci95High: mean + 1.96 * sd / Math.sqrt(values.length), min: sorted[0], p10: sorted[Math.floor((values.length - 1) * .1)], median: (sorted[Math.floor((values.length - 1) / 2)] + sorted[Math.ceil((values.length - 1) / 2)]) / 2, p90: sorted[Math.floor((values.length - 1) * .9)], max: sorted.at(-1) };
}
export function pairPayback(treated: Sample, control: Sample) {
  const increments = treated.daily.map((d, i) => d.cumulativeOperatingProfit - control.daily[i].cumulativeOperatingProfit);
  const capital = treated.investment.capital - control.investment.capital;
  const index = capital > 0 ? increments.findIndex((x) => x >= capital) : -1;
  return { seed: treated.seed, capital, incrementalOperatingBenefit: increments, paybackDay: index >= 0 ? index + 1 : null,
    censored: capital > 0 && index < 0, reason: capital <= 0 ? 'no-capital-investment' : index < 0 ? 'not-recovered-within-observation-window' : 'recovered',
    incrementalNetLiquidProfit: treated.daily.at(-1)!.netLiquidProfit - control.daily.at(-1)!.netLiquidProfit };
}
export function summarize(defs: Scenario[], batches: Record<string, Sample[]>) {
  return defs.filter((d) => batches[d.id]).map((scenario) => {
    const rows = batches[scenario.id];
    const last = rows.map((r) => r.daily.at(-1)!);
    const control = scenario.supply === 'forecast' ? batches[scenario.pairId] : undefined;
    const pairs = control ? rows.map((r) => pairPayback(r, control.find((c) => c.seed === r.seed)!)) : [];
    return { scenario, n: rows.length,
      operatingProfit: distribution(last.map((d) => d.cumulativeOperatingProfit)), cashProfit: distribution(last.map((d) => d.cashProfit)), netLiquidProfit: distribution(last.map((d) => d.netLiquidProfit)),
      served: distribution(rows.map((r) => r.daily.reduce((sum, d) => sum + d.report.served, 0))),
      lostIncludingDoor: distribution(rows.map((r) => r.daily.reduce((sum, d) => sum + d.lostIncludingDoor, 0))),
      wasteCost: distribution(rows.map((r) => r.daily.reduce((sum, d) => sum + d.wasteCost, 0))),
      endingRating: distribution(last.map((d) => d.report.rating)),
      closingTimeouts: rows.reduce((sum, r) => sum + r.daily.filter((d) => d.closingTimedOut).length, 0),
      daily: Array.from({ length: DAYS }, (_, i) => ({ day: i + 1, profit: distribution(rows.map((r) => r.daily[i].report.profit)), rating: distribution(rows.map((r) => r.daily[i].report.rating)), served: distribution(rows.map((r) => r.daily[i].report.served)) })),
      paired: { control: control ? scenario.pairId : null, note: control ? 'Same starting stage endowment; capital arms may change owned assets and menu only after paying.' : 'Diagnostic changes starting supply or reputation; no cross-endowment/policy pairing. Compare identical probe across code variants instead.', incrementalNetLiquidProfit: pairs.length ? distribution(pairs.map((p) => p.incrementalNetLiquidProfit)) : null, recovered: pairs.filter((p) => p.paybackDay !== null).length, censored: pairs.filter((p) => p.censored).length, raw: pairs } };
  });
}
function gameFingerprint() {
  const files = readdirSync('src/game').filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort();
  return createHash('sha256').update(files.map((f) => `${f}\n${readFileSync(join('src/game', f), 'utf8')}`).join('\n')).digest('hex');
}
function designFingerprint() {
  return createHash('sha256').update(readFileSync('scripts/economy-lab.ts')).update(readFileSync('scripts/economy-lab.test.ts')).update(JSON.stringify(scenarios())).digest('hex');
}
function validateBatch(def: Scenario, rows: Sample[]) {
  if (rows.length !== SEEDS.length || rows.some((r, i) => r.seed !== SEEDS[i] || r.scenarioId !== def.id || r.daily.length !== DAYS)) throw new Error(`Invalid/incomplete seed batch: ${def.id}`);
  for (const row of rows) for (const [i, d] of row.daily.entries()) {
    if (d.day !== i + 1 || d.openSeconds !== OPEN_SECONDS || Math.abs(d.report.duration - OPEN_SECONDS - d.closingSeconds) > 1e-5 || d.closingTimedOut) throw new Error(`Invalid duration/closing: ${def.id}`);
    const values = [d.cumulativeSpending, d.cumulativeRevenue, d.cumulativeOperatingProfit, d.cashProfit, d.netLiquidProfit, d.report.rating, d.wasteCost, d.report.profit, ...Object.values(d.assets)];
    if (!values.every(Number.isFinite) || Object.values(d.assets).some((n) => n < -1e-7) || Math.abs(d.reconciliationError) > 1e-5) throw new Error(`Invalid monetary/rating/accounting output: ${def.id}`);
  }
}
function writeAtomic(path: string, value: unknown) { writeFileSync(`${path}.tmp`, JSON.stringify(value, null, path.endsWith('-summary.json') ? 2 : undefined) + '\n'); renameSync(`${path}.tmp`, path); }
export function runLab() {
  const label = process.env.ECONOMY_LABEL ?? 'balanced';
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe label');
  const directory = 'docs/long-task/results'; mkdirSync(directory, { recursive: true });
  const path = `${directory}/${label}.json`;
  const defs = scenarios();
  const fingerprint = gameFingerprint();
  const designHash = designFingerprint();
  const metadata = { designVersion: DESIGN_VERSION, designHash, label, gitHead: process.env.ECONOMY_GIT_HEAD ?? execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(), fingerprint, seeds: SEEDS, days: DAYS, openSeconds: OPEN_SECONDS, dt: DT,
    catCatalog: CATS, fixtures: (['early', 'mid', 'expanded'] as Stage[]).map(fixtureInfo),
    constraints: [
      'Every sample resets global layout height to MIN_SCENE_H=240 and kitchen geometry to fixture cook level before forecasts; scenario order and resumed batch selection cannot leak prior layout state.',
      'Authoritative matrix uses 0.05-second ticks, matching the app maximum simulation substep. Earlier partial 0.1-second pilot is separate and not used for authoritative conclusions.',
      '30 predetermined independent seed labels, common seeds across strategies; divergent event paths do not imply customer-identical random draws.',
      'Eight days each, 180 seconds open, then accepted service drains for at most 300 seconds. No clicking. Closing duration and removed queue are separately recorded.',
      'Goal rewards are excluded, equivalent to exhausting all one-off goals. Zero-stock/no-cash inability to recover is conditional on no unclaimed goal rewards, refunds or outside capital; it is not a claim about a fresh new game.',
      'No salary/rent exists in current gameplay. Consumed ingredients include every bake, stale goods, discarded batches and accepted orders that do not sell.',
      'Cash profit is change in cash. Net-liquid profit includes pantry and prepaid care/promotion at cost, excludes illiquid capital resale. Operational profit expenses consumption once.',
      'Cat adoption includes a care pack; capital equals adoption price less included care value. Incremental operating profit already expenses all consumed care, including the included pack.',
      'Promotions are renewed only in preparation when expired; long plans span days. Promotion cost is operating expense, not capital. Only one plan can run at a time; combinations mean cat plus promotion.',
      'Capital-arm opportunity comparisons intentionally change menu after paying recipe/kitchen costs; their pair is the initial espresso hold strategy. Cat/promotion comparisons retain the same menu. No guaranteed resale/recovery is assumed.',
      'Payback pairs same seed/menu/stage with no investment. First day cumulative incremental operating benefit covers incremental capital. Unrecovered capital is explicitly censored, never an invented extrapolation.',
      'Forecast shopping is proportional to available cash. Scarcity probe targets 20% needs on days 1-3, then restores full target; no money or stock is injected for recovery.',
      'Poor-rating probe starts with 50 one-star reviews. Insolvency probes have zero cash and respectively zero/one bean; their altered starting endowments are explicit and are diagnostic, not equal-wealth strategy rankings.',
      'Normal stage comparisons start with identical coins, stock, owned menu unlocks and facilities. Strategy investments are then purchased from that common cash balance. Fixtures are experimental endowments, not progression-time measurements.',
      'Bakery is selected only for kitchen-owning stages; early owns only initial espresso. Later recipes owned equally in expanded fixture. Baseline means current HEAD rules, without historical MENU mutation.',
      'Mean normal-approximation 95% intervals are descriptive, not multiple-comparison-corrected significance tests; sample SD and raw seed rows are retained.'
    ] };
  let batches: Record<string, Sample[]> = {};
  if (existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    if (saved.metadata.fingerprint !== fingerprint || saved.metadata.designVersion !== DESIGN_VERSION || saved.metadata.designHash !== designHash) throw new Error(`Refusing to overwrite/resume ${label}: source or experiment design changed. Use a new ECONOMY_LABEL.`);
    batches = saved.batches;
  }
  const filter = process.env.ECONOMY_FILTER;
  for (const def of defs.filter((d) => !filter || d.id.includes(filter))) {
    if (batches[def.id]?.length === SEEDS.length) { validateBatch(def, batches[def.id]); continue; }
    const start = Date.now();
    batches[def.id] = SEEDS.map((seed) => sample(def, seed));
    validateBatch(def, batches[def.id]);
    if (gameFingerprint() !== fingerprint || designFingerprint() !== designHash) throw new Error('Source changed during experiment; use a new label after stabilizing source.');
    writeAtomic(path, { metadata, complete: defs.every((d) => batches[d.id]?.length === SEEDS.length), batches });
    writeAtomic(`${directory}/${label}-summary.json`, { metadata, completedBatches: Object.keys(batches).length, expectedBatches: defs.length, scenarios: summarize(defs, batches) });
    console.log(`${label}: ${def.id}: ${SEEDS.length} seeds in ${((Date.now() - start) / 1000).toFixed(1)}s (${Object.keys(batches).length}/${defs.length})`);
  }
  writeAtomic(`${directory}/${label}-summary.json`, { metadata, completedBatches: Object.keys(batches).length, expectedBatches: defs.length, scenarios: summarize(defs, batches) });
  writeAtomic(path, { metadata, complete: defs.every((d) => batches[d.id]?.length === SEEDS.length), batches });
  return { label, completed: Object.keys(batches).length, expected: defs.length };
}

