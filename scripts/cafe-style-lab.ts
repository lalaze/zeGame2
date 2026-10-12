/** Six operating styles: paid portfolios and exact-clock, real-Sim evidence. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { INGREDIENTS, MENU, type ItemId, type UpgradeId } from '../src/game/data';
import { openShop, type DayReport } from '../src/game/day';
import { useDecor } from '../src/game/decor';
import { bakeForForecast, buyItem, buyUpgrade, menuItems, quoteItem, requiresKitchen, restock, restockQuote, servingCost } from '../src/game/economy';
import { buyFurniture, canPlace, COLS, FLOOR_ROWS, placeFurniture } from '../src/game/furniture';
import { GOALS } from '../src/game/goals';
import { unlockKitchen } from '../src/game/kitchen';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { adoptCat, CARE_SECONDS, catDef, type CatId } from '../src/game/pets';
import { bookPromotion, promotionPlan, type PromotionId } from '../src/game/promotion';
import { reputationScore } from '../src/game/reputation';
import { mainTableCount, unlockRegion, type RegionId } from '../src/game/regions';
import { Sim } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import { researchSignature, signatureCost } from '../src/game/taste';

export const STYLE_LAB_VERSION = 2;
export const STYLE_IDS = ['coffee', 'bakery', 'cats', 'takeaway', 'garden', 'community'] as const;
export type StyleId = typeof STYLE_IDS[number];
export const STYLE_SEEDS = Array.from({ length: 30 }, (_, i) => (0x5eed1234 + i * 2654435761) >>> 0);
export const STYLE_DT = .05, STYLE_SECONDS = 1800, STYLE_OPEN_SECONDS = 180;
export const STYLE_BUDGETS = { early: 1800, mid: 15000, late: 350000 } as const;
export type Stage = keyof typeof STYLE_BUDGETS;
export type Panel = 'common-assets' | 'route-purchases';
export type Pressure = 'base' | 'feature' | 'rush';
export const PRESSURES: Record<Pressure, PromotionId | null> = { base: null, feature: 'noteLocal', rush: 'clipStar' };
export type StyleSetter = (state: GameState, id: StyleId | null) => boolean;
export interface Route { id: string; panel: Panel; stage: Stage; style: StyleId; pressure: Pressure; focus: boolean }
export interface Purchase { kind: 'recipe' | 'upgrade' | 'kitchen' | 'region' | 'decor' | 'furniture' | 'cat' | 'signature'; id: string; cash: number; capital: number; prepaidCare: number }
const rng = (seed: number) => { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; }; };
export const styleMenus: Record<Stage, Record<StyleId, ItemId[]>> = {
  early: { coffee: ['espresso'], bakery: ['roll'], cats: ['espresso'], takeaway: ['espresso'], garden: ['blacktea', 'roll'], community: ['blacktea'] },
  mid: { coffee: ['cappuccino'], bakery: ['baguette', 'scone'], cats: ['latte', 'roll'], takeaway: ['americano'], garden: ['hotchoc', 'scone'], community: ['blacktea', 'roll'] },
  late: { coffee: ['flatwhite'], bakery: ['cheesebun', 'cookie'], cats: ['flatwhite', 'cookie'], takeaway: ['cortado'], garden: ['lemontea', 'cookie'], community: ['lemontea', 'cookie'] },
};
export function styleRoutes(includeFocus = true): Route[] {
  return (['common-assets', 'route-purchases'] as Panel[]).flatMap(panel => (['early', 'mid', 'late'] as Stage[]).flatMap(stage =>
    (Object.keys(PRESSURES) as Pressure[]).flatMap(pressure => STYLE_IDS.flatMap(style => (includeFocus ? [false, true] : [false]).map(focus => ({
      id: `${panel}/${stage}/${pressure}/${style}/${focus ? 'focus' : 'plain'}`, panel, stage, pressure, style, focus,
    }))))));
}
export function styleAssets(s: GameState) {
  const pantry = INGREDIENTS.reduce((n, i) => n + s.pantry[i.id] * i.cost, 0);
  const care = s.pets.reduce((n, p) => n + p.careSeconds / CARE_SECONDS * catDef(p.id)!.careCost, 0);
  const promotion = s.promotion ? s.promotion.remaining / promotionPlan(s.promotion.id)!.seconds * promotionPlan(s.promotion.id)!.cost : 0;
  return { cash: s.coins, pantry, care, promotion, total: s.coins + pantry + care + promotion };
}
/** Identical stage progress is a declared synthetic fixture, not earned progression. */
function stageStart(stage: Stage): GameState {
  const s = createInitialState(0);
  s.coins = STYLE_BUDGETS[stage];
  // Every route buys its own stock; the actual fresh-save starter beans belong in progression evidence.
  for (const i of INGREDIENTS) s.pantry[i.id] = 0;
  s.goal = GOALS.length; // This experiment excludes all tutorial/reward injections.
  s.day = { early: 1, mid: 10, late: 30 }[stage];
  const experience = { early: 0, mid: 100, late: 300 }[stage];
  // The exact same capability is available even for recipes a portfolio does not choose to buy.
  for (const item of MENU) s.taste.served[item.id] = experience;
  s.served = experience * MENU.length;
  return s;
}
/** All purchases go through gameplay APIs; their real cash changes form the ledger. */
export function buildStylePortfolio(route: Route, setStyle?: StyleSetter) {
  setSceneHeight(MIN_SCENE_H); setKitchenLevel(0);
  const s = stageStart(route.stage), budget = s.coins;
  const stockReserve = budget * .12;
  const ledger: Purchase[] = [];
  function transact(kind: Purchase['kind'], id: string, action: () => boolean, prepaidCare = 0) {
    const cash = s.coins;
    if (!action()) throw new Error(`Rejected ${kind}/${id}: ${route.id}`);
    const paid = cash - s.coins;
    if (s.coins + 1e-7 < stockReserve) throw new Error(`Portfolio spent working reserve: ${route.id}: ${kind}/${id}`);
    ledger.push({ kind, id, cash: paid, capital: paid - prepaidCare, prepaidCare });
  }
  const kitchen = () => { if (!s.kitchen) transact('kitchen', 'kitchen', () => unlockKitchen(s)); };
  function recipe(id: ItemId) {
    if (requiresKitchen(id)) kitchen();
    const def = MENU.find(m => m.id === id)!;
    for (const m of MENU.filter(m => m.category === def.category)) {
      if (!s.items[m.id]) transact('recipe', m.id, () => buyItem(s, m.id, 1));
      if (m.id === id) break;
    }
  }
  const upgrade = (id: UpgradeId, target: number) => { while (s.upgrades[id] < target) transact('upgrade', id, () => buyUpgrade(s, id, 1)); };
  const cat = (id: CatId) => transact('cat', id, () => adoptCat(s, id), catDef(id)!.careCost);
  const decor = (id: string) => transact('decor', id, () => useDecor(s, id));
  function cozyPoster() {
    transact('furniture', 'poster_coffee', () => buyFurniture(s, 'poster_coffee'));
    for (let row = 0; row < FLOOR_ROWS; row++) for (let col = 0; col < COLS; col++) {
      if (canPlace(s, 'poster_coffee', col, row, mainTableCount(s))) {
        if (!placeFurniture(s, 'poster_coffee', col, row, mainTableCount(s))) throw new Error('Poster placement failed');
        return;
      }
    }
    throw new Error('No legal poster placement');
  }
  function region(id: RegionId) {
    for (const prior of ['reading', 'greenhouse', 'terrace'] as RegionId[]) {
      if (!s.regions.includes(prior)) transact('region', prior, () => unlockRegion(s, prior));
      if (prior === id) break;
    }
  }
  const menu = styleMenus[route.stage][route.style];
  if (route.panel === 'common-assets') {
    // All six policies in a stage receive the same paid portfolio, including sunk room/cat/decor costs.
    for (const id of [...new Set(Object.values(styleMenus[route.stage]).flat())]) recipe(id);
    cat('ginger'); decor('sill_cactus');
    upgrade('machine', route.stage === 'early' ? 1 : 3); if (route.stage !== 'early') upgrade('barista', 1);
    if (route.stage !== 'early') {
      cat('tuxedo'); region(route.stage === 'late' ? 'terrace' : 'reading');
      upgrade('server', 1); upgrade('cook', 1); upgrade('tables', 1);
      decor('ceiling_lights'); decor('counter_walnut');
      if (route.stage === 'late') { cat('calico'); decor('floor_terrazzo'); }
    }
    cozyPoster();
    const targets = [...new Set(Object.values(styleMenus[route.stage]).flat())];
    // Identical round-robin spending, independent of the selected policy/menu or outcomes.
    let progress = true;
    while (progress) {
      progress = false;
      for (const id of targets) {
        const q = quoteItem(s, id, 1);
        if (q.cost <= s.coins - stockReserve + 1e-8) { transact('recipe', id, () => buyItem(s, id, 1)); progress = true; }
      }
    }
  } else {
    for (const id of menu) recipe(id);
    const level = { early: 0, mid: 1, late: 2 }[route.stage];
    switch (route.style) {
      case 'coffee': upgrade('machine', level + 2); upgrade('barista', level); break;
      case 'bakery': upgrade('machine', level + 1); upgrade('cook', level); upgrade('barista', level); if (level) upgrade('server', 1); break;
      case 'cats': cat('ginger'); decor('ceiling_lights'); if (level) { cat('tuxedo'); region('reading'); upgrade('server', 1); } if (level === 2) { cat('calico'); decor('floor_terrazzo'); region('greenhouse'); upgrade('barista', 2); } break;
      case 'takeaway': upgrade('machine', level * 2 + 2); upgrade('barista', level + 1); break;
      case 'garden': decor('sill_cactus'); if (level) { region(level === 2 ? 'terrace' : 'reading'); upgrade('server', level); upgrade('barista', level); upgrade('cook', level); decor('ceiling_lights'); } break;
      case 'community': decor('ceiling_lights'); decor('sill_cactus'); if (level) { region('reading'); upgrade('server', level); decor('counter_walnut'); upgrade('barista', level); } if (level === 2) { decor('floor_terrazzo'); decor('neon_cafe'); } break;
    }
    if (route.style === 'garden') cozyPoster();
    if (route.stage !== 'early') {
      for (const id of menu) if (signatureCost(id) <= s.coins - stockReserve) transact('signature', id, () => researchSignature(s, id));
    }
    // All routes have the same explicit investment rule: cycle menu levels until the next level no longer fits.
    let progress = true;
    while (progress) {
      progress = false;
      for (const id of menu) if (quoteItem(s, id, 1).cost <= s.coins - stockReserve + 1e-8) {
        transact('recipe', id, () => buyItem(s, id, 1)); progress = true;
      }
    }
  }
  s.onMenu = [...menu];
  if (menuItems(s).length !== menu.length) throw new Error('Unavailable menu');
  setKitchenLevel(s.kitchen ? s.upgrades.cook : 0);
  if (route.focus && (!setStyle || !setStyle(s, route.style))) throw new Error('Focus route requires supported gameplay setter');
  if (!route.focus && setStyle && !setStyle(s, null)) throw new Error('Plain route must clear focus');
  const capital = ledger.reduce((n, x) => n + x.capital, 0), cashSpent = ledger.reduce((n, x) => n + x.cash, 0);
  if (Math.abs(budget - s.coins - cashSpent) > 1e-5 || Math.abs(styleAssets(s).total + capital - budget) > 1e-5) throw new Error('Portfolio ledger mismatch');
  return { state: s, budget, stockReserve, ledger, capital, cashSpent, remainingCash: s.coins,
    ownership: { items: { ...s.items }, upgrades: { ...s.upgrades }, regions: [...s.regions], kitchen: s.kitchen, pets: structuredClone(s.pets), decor: structuredClone(s.decor), taste: structuredClone(s.taste) } };
}
const foodCost = (items: Partial<Record<ItemId, number>>) => Object.entries(items).reduce((sum, [id, count]) => sum + servingCost(id as ItemId) * count!, 0);
/** Physical food is a diagnostic; paid ingredient expense never becomes primary liquid wealth. */
export function styleLiveFood(s: GameState, sim: Sim) {
  const live = sim.customers.filter(c => !c.hasCup && ['ordering', 'toSeat', 'waiting'].includes(c.phase));
  const acceptedCost = live.reduce((n, c) => n + servingCost(c.order) + (c.extra ? servingCost(c.extra) : 0), 0);
  const kitchenCost = foodCost(s.inProduction), shelfCost = foodCost(s.shelf);
  const batches: Partial<Record<ItemId, number>> = {};
  for (const cook of sim.cooks) if (cook.batch) batches[cook.batch.item] = (batches[cook.batch.item] ?? 0) + cook.batch.n;
  for (const id of new Set([...Object.keys(batches), ...Object.keys(s.inProduction)]) as Set<ItemId>) if ((batches[id] ?? 0) !== (s.inProduction[id] ?? 0)) throw new Error('Unreconciled kitchen work');
  return { acceptedCost, kitchenCost, shelfCost, total: acceptedCost + kitchenCost + shelfCost, activeOrders: live.length };
}
export function styleSample(route: Route, seed: number, setStyle?: StyleSetter, seconds = STYLE_SECONDS) {
  const setup = buildStylePortfolio(route, setStyle), s = setup.state;
  const ticks = Math.round(seconds / STYLE_DT);
  if (ticks <= 0 || Math.abs(ticks * STYLE_DT - seconds) > 1e-8) throw new Error('Invalid exact horizon');
  const sim = new Sim(rng(seed));
  let openTicks = 0, closingTicks = 0, liveOpen = 0, liveClosing = 0;
  let ingredientsPurchased = 0, promotionsPurchased = 0, queueRemovedAtClosing = 0;
  let promotionBookingAttempts = 0, promotionBookingFailures = 0, cashConstrainedRestocks = 0;
  let rolling = { revenue: 0, ingredientCost: 0, petCost: 0, promotionCost: 0 };
  const settled: { endedAt: number; openSeconds: number; closingSeconds: number; report: DayReport }[] = [];
  const checkpoints: { seconds: number; operating: number; netLiquid: number; capitalRecovered: boolean }[] = [];
  let paybackSeconds: number | null = null;
  for (let tick = 0; tick < ticks; tick++) {
    const now = tick * STYLE_DT;
    if (s.phase === 'open' && liveOpen === STYLE_OPEN_SECONDS / STYLE_DT) {
      queueRemovedAtClosing += sim.customers.filter(c => c.phase === 'queue').length;
      sim.beginClosing(s);
    }
    if (s.phase === 'closing' && sim.finishedService) {
      const report = sim.closeShop(s)!;
      for (const key of ['revenue', 'ingredientCost', 'petCost', 'promotionCost'] as const) rolling[key] += report[key];
      settled.push({ endedAt: now, openSeconds: liveOpen * STYLE_DT, closingSeconds: liveClosing * STYLE_DT, report });
    }
    if (s.phase === 'prep') {
      liveOpen = 0; liveClosing = 0;
      const promotion = PRESSURES[route.pressure];
      if (promotion && !s.promotion) {
        const before = s.coins;
        promotionBookingAttempts++;
        if (!bookPromotion(s, promotion)) promotionBookingFailures++;
        promotionsPurchased += before - s.coins;
      }
      bakeForForecast(s);
      if (restockQuote(s).cost > s.coins) cashConstrainedRestocks++;
      const before = s.coins; restock(s); ingredientsPurchased += before - s.coins;
      openShop(s);
    }
    const open = s.phase === 'open';
    sim.update(s, STYLE_DT);
    if (open) { openTicks++; liveOpen++; } else { closingTicks++; liveClosing++; }
    if (liveClosing > 300 / STYLE_DT) throw new Error(`Drain exceeded 300 seconds: ${route.id}: ${JSON.stringify({ customers: sim.customers.filter(c => !['sitting', 'exiting'].includes(c.phase)), cooks: sim.cooks.filter(c => c.batch), placed: s.decor.placed })}`);
    const operating = rolling.revenue + s.today.revenue - rolling.ingredientCost - s.today.ingredientCost - rolling.petCost - s.today.petCost - rolling.promotionCost - s.today.promotionCost;
    if (paybackSeconds === null && operating >= setup.capital) paybackSeconds = (tick + 1) * STYLE_DT;
    if ((tick + 1) % (STYLE_OPEN_SECONDS / STYLE_DT) === 0 || tick + 1 === ticks) checkpoints.push({ seconds: (tick + 1) * STYLE_DT, operating, netLiquid: styleAssets(s).total - setup.budget, capitalRecovered: operating >= setup.capital });
  }
  const reports = [...settled.map(x => x.report), s.today];
  const sum = (key: 'revenue' | 'ingredientCost' | 'petCost' | 'promotionCost' | 'served' | 'missed' | 'doorLost' | 'soldOut' | 'queueLost' | 'tableLost' | 'extraLost') => reports.reduce((n, r) => n + r[key], 0);
  const revenue = sum('revenue'), ingredientExpense = sum('ingredientCost'), careExpense = sum('petCost'), promotionExpense = sum('promotionCost');
  const operatingProfit = revenue - ingredientExpense - careExpense - promotionExpense;
  const assets = styleAssets(s), netLiquidProfit = assets.total - setup.budget;
  const reconciliationError = netLiquidProfit - (operatingProfit - setup.capital);
  const includedCare = setup.ledger.reduce((n, l) => n + l.prepaidCare, 0);
  const carePurchased = careExpense + assets.care - includedCare;
  const totalCashOut = setup.cashSpent + ingredientsPurchased + promotionsPurchased + carePurchased;
  const cashLedgerError = s.coins - (setup.budget + revenue - totalCashOut);
  const sales: Partial<Record<ItemId, number>> = {};
  for (const r of reports) for (const [id, n] of Object.entries(r.sales) as [ItemId, number][]) sales[id] = (sales[id] ?? 0) + n;
  const liveFood = styleLiveFood(s, sim), soldIngredientCost = foodCost(sales);
  const wasteCost = ingredientExpense - soldIngredientCost - liveFood.total;
  const missed = sum('missed'), doorLost = sum('doorLost');
  if (Math.abs(reconciliationError) > 1e-4 || Math.abs(cashLedgerError) > 1e-4 || wasteCost < -1e-6) throw new Error(`Accounting mismatch ${route.id}: ${reconciliationError}/${cashLedgerError}/${wasteCost}`);
  if ([...Object.values(assets), ...Object.values(s.pantry)].some(n => !Number.isFinite(n) || n < -1e-7)) throw new Error('Invalid ending assets');
  return { routeId: route.id, seed, seconds, openSeconds: openTicks * STYLE_DT, closingSeconds: closingTicks * STYLE_DT,
    budget: setup.budget, capital: setup.capital, investmentCash: setup.cashSpent, initialUnspentCash: setup.remainingCash,
    revenue, operatingProfit, netLiquidProfit, cashProfit: s.coins - setup.budget, assets,
    ingredientExpense, careExpense, promotionExpense, promotionBookingAttempts, promotionBookingFailures, cashConstrainedRestocks, spending: { ingredientsPurchased, promotionsPurchased, carePurchased, totalCashOut },
    served: sum('served'), missed, doorLost, lostIncludingDoor: missed + doorLost,
    queueRemovedAtClosing, unmetDemand: missed + doorLost + queueRemovedAtClosing,
    arrivalAttempts: sum('served') + missed + doorLost + queueRemovedAtClosing + sim.customers.filter(c => !c.hasCup && !['sitting', 'exiting'].includes(c.phase)).length,
    lossRate: (missed + doorLost + queueRemovedAtClosing) / Math.max(1, sum('served') + missed + doorLost + queueRemovedAtClosing + sim.customers.filter(c => !c.hasCup && !['sitting', 'exiting'].includes(c.phase)).length),
    soldOut: sum('soldOut'), queueLost: sum('queueLost'), tableLost: sum('tableLost'), extraLost: sum('extraLost'),
    wasteCost: Math.max(0, wasteCost), closedStaleCost: settled.reduce((n, d) => n + d.report.staleCost, 0), liveFood,
    rating: reputationScore(s.reputation), terminalPhase: s.phase, completedDays: settled.length,
    terminalLiveCustomers: sim.customers.filter(c => !c.hasCup && !['sitting', 'exiting'].includes(c.phase)).length,
    paybackSeconds, censored: paybackSeconds === null, terminalRecovered: operatingProfit >= setup.capital,
    checkpoints, reconciliationError, cashLedgerError };
}
export type StyleRow = ReturnType<typeof styleSample>;
export function styleStats(values: number[]) {
  const n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  const half = n > 1 ? 2.04523 * sd / Math.sqrt(n) : 0;
  const sorted = [...values].sort((a, b) => a - b);
  return { n, mean, sd, ci95Low: mean - half, ci95High: mean + half, min: sorted[0], median: (sorted[Math.floor((n - 1) / 2)] + sorted[Math.ceil((n - 1) / 2)]) / 2, max: sorted.at(-1) };
}
export function styleSummary(routes: Route[], batches: Record<string, StyleRow[]>) {
  const fields = ['netLiquidProfit', 'operatingProfit', 'cashProfit', 'revenue', 'served', 'lostIncludingDoor', 'queueRemovedAtClosing', 'unmetDemand', 'arrivalAttempts', 'lossRate', 'wasteCost', 'rating', 'careExpense', 'promotionExpense', 'openSeconds', 'closingSeconds', 'completedDays'] as const;
  return routes.filter(r => batches[r.id]?.length).map(route => {
    const rows = batches[route.id], controls = route.focus ? batches[route.id.replace(/focus$/, 'plain')] : undefined;
    const differences = controls?.length === rows.length ? rows.map(r => {
      const control = controls.find(c => c.seed === r.seed)!;
      return { seed: r.seed, net: r.netLiquidProfit - control.netLiquidProfit, served: r.served - control.served, unmet: r.unmetDemand - control.unmetDemand, waste: r.wasteCost - control.wasteCost, rating: r.rating - control.rating };
    }) : [];
    return { route, capital: rows[0].capital, investmentCash: rows[0].investmentCash, unspentCash: rows[0].initialUnspentCash,
      ...Object.fromEntries(fields.map(field => [field, styleStats(rows.map(r => r[field]))])),
      payback: { recovered: rows.filter(r => !r.censored).length, censored: rows.filter(r => r.censored).length, terminalRecovered: rows.filter(r => r.terminalRecovered).length, seconds: rows.map(r => r.paybackSeconds),
        meaning: 'Own-portfolio capital recovered from cumulative operating profit, not incremental payback versus another portfolio. Null means right-censored at the exact horizon.' },
      pairedFocus: differences.length ? { control: route.id.replace(/focus$/, 'plain'), net: styleStats(differences.map(r => r.net)), served: styleStats(differences.map(r => r.served)), unmet: styleStats(differences.map(r => r.unmet)), waste: styleStats(differences.map(r => r.waste)), rating: styleStats(differences.map(r => r.rating)), positiveNetSeeds: differences.filter(r => r.net > 0).length } : null };
  });
}
export function styleSourceHash() { return createHash('sha256').update(readdirSync('src/game').filter(p => p.endsWith('.ts') && !p.endsWith('.test.ts')).sort().map(p => `${p}\n${readFileSync(`src/game/${p}`, 'utf8')}`).join('\n')).digest('hex'); }
const runnerHash = () => createHash('sha256').update(readFileSync('scripts/cafe-style-lab.ts')).update(readFileSync('scripts/cafe-style-balance.test.ts')).digest('hex');
function atomic(path: string, value: unknown) { writeFileSync(path + '.tmp', JSON.stringify(value, null, path.includes('summary') ? 2 : undefined) + '\n'); renameSync(path + '.tmp', path); }
export async function runStyleLab(setStyle?: StyleSetter) {
  const baseline = process.env.CAFE_STYLE_BASELINE === '1', pilot = process.env.CAFE_STYLE_PILOT === '1';
  const label = process.env.CAFE_STYLE_LABEL ?? (baseline ? 'baseline-v1' : 'styles-v1');
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe evidence label');
  const filter = process.env.CAFE_STYLE_FILTER;
  const shard = process.env.CAFE_STYLE_SHARD ? Number(process.env.CAFE_STYLE_SHARD) : 0;
  const shardCount = process.env.CAFE_STYLE_SHARDS ? Number(process.env.CAFE_STYLE_SHARDS) : 1;
  if (!Number.isInteger(shard) || !Number.isInteger(shardCount) || shard < 0 || shard >= shardCount) throw new Error('Invalid shard');
  const fullScope = styleRoutes(!baseline).filter(r => !filter || r.id.includes(filter));
  const routes = fullScope.filter((_, i) => i % shardCount === shard);
  if (!routes.length) throw new Error('Empty scenario scope');
  const seeds = pilot ? STYLE_SEEDS.slice(0, 1) : STYLE_SEEDS;
  const sourceHash = styleSourceHash(), designHash = runnerHash();
  const setups = routes.map(route => { const { state: _, ...setup } = buildStylePortfolio(route, setStyle); return { routeId: route.id, ...setup }; });
  const metadata = { version: STYLE_LAB_VERSION, label, baseline, pilot, shard, shardCount, fullScope: fullScope.map(r => r.id), sourceHash, designHash, seeds, dt: STYLE_DT, seconds: STYLE_SECONDS, openSeconds: STYLE_OPEN_SECONDS, budgets: STYLE_BUDGETS, pressures: PRESSURES, expectedRoutes: routes.map(r => r.id), setups,
    fixture: { goalRewards: 'excluded', pantry: 'zero; all operating stock purchased', commonProgress: { early: { day: 1, servingsPerRecipe: 0 }, mid: { day: 10, servingsPerRecipe: 100 }, late: { day: 30, servingsPerRecipe: 300 } }, reputation: 'neutral/empty for every policy', capitalResale: 0, workingReserveFraction: .12 },
    methodology: 'Paid portfolios, exact elapsed clock including service drain, no terminal settlement or future sale credit. Same funding includes capex, prepaid care and retained cash; route-purchases do not claim equal spent capex. Traffic pressures are real paid promotion policies, renewing during prep if affordable. Same fixed seed labels do not imply identical customer draws. Intervals are descriptive t29 intervals, not multiplicity-corrected superiority tests.' };
  const dir = process.env.CAFE_STYLE_RESULTS_DIR ?? 'docs/cafe-styles/results'; mkdirSync(dir, { recursive: true });
  const path = `${dir}/${label}.json`;
  let batches: Record<string, StyleRow[]> = {};
  if (existsSync(path)) {
    const old = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of ['sourceHash', 'designHash', 'expectedRoutes', 'seeds'] as const) if (JSON.stringify(old.metadata[key]) !== JSON.stringify(metadata[key])) throw new Error(`Refusing incompatible resume: ${key}`);
    batches = old.batches;
  }
  const validate = (route: Route, rows: StyleRow[]) => {
    if (rows.length > seeds.length || rows.some((r, i) => r.seed !== seeds[i] || r.routeId !== route.id || r.seconds !== STYLE_SECONDS || Math.abs(r.openSeconds + r.closingSeconds - STYLE_SECONDS) > 1e-7 || Math.abs(r.reconciliationError) > 1e-4 || Math.abs(r.cashLedgerError) > 1e-4)) throw new Error('Invalid persisted seed batch');
  };
  const save = () => {
    const complete = routes.every(r => batches[r.id]?.length === seeds.length);
    atomic(path, { metadata, complete, batches });
    atomic(`${dir}/${label}-summary.json`, { metadata, complete, completedRoutes: routes.filter(r => batches[r.id]?.length === seeds.length).length, routes: styleSummary(routes, batches) });
  };
  for (const route of routes) {
    const rows = batches[route.id] ??= []; validate(route, rows);
    for (let i = rows.length; i < seeds.length; i++) {
      rows.push(styleSample(route, seeds[i], setStyle));
      if (rows.length % 5 === 0) { if (styleSourceHash() !== sourceHash || runnerHash() !== designHash) throw new Error('Source changed during run'); save(); }
    }
    if (styleSourceHash() !== sourceHash || runnerHash() !== designHash) throw new Error('Source changed during run');
    save(); console.log(`${label}: ${route.id}: ${rows.length}/${seeds.length}`);
  }
  save(); return { complete: routes.every(r => batches[r.id]?.length === seeds.length), scenarios: routes.length, seeds: seeds.length };
}

/** Validate and combine independently resumable shards without rerunning Sim. */
export function mergeStyleShards(prefix: string, directory = 'docs/cafe-styles/results') {
  if (!/^[a-zA-Z0-9_-]+$/.test(prefix)) throw new Error('Unsafe prefix');
  const files = readdirSync(directory).filter(p => p.startsWith(prefix + '-shard') && p.endsWith('.json') && !p.endsWith('-summary.json')).sort();
  if (!files.length) throw new Error('No shards found');
  const parts = files.map(p => JSON.parse(readFileSync(`${directory}/${p}`, 'utf8')));
  const reference = parts[0].metadata;
  if (parts.length !== reference.shardCount || new Set(parts.map(p => p.metadata.shard)).size !== reference.shardCount) throw new Error('Incomplete shard set');
  const batches: Record<string, StyleRow[]> = {};
  for (const part of parts) {
    for (const key of ['sourceHash', 'designHash', 'seeds', 'fullScope', 'shardCount', 'baseline', 'pilot']) {
      if (JSON.stringify(part.metadata[key]) !== JSON.stringify(reference[key])) throw new Error(`Incompatible shards: ${key}`);
    }
    if (!part.complete) throw new Error('Incomplete shard');
    for (const [id, rows] of Object.entries(part.batches) as [string, StyleRow[]][]) {
      if (batches[id] || rows.length !== reference.seeds.length || rows.some((r, i) => r.seed !== reference.seeds[i] || r.routeId !== id)) throw new Error('Overlapping/incomplete seed batch');
      batches[id] = rows;
    }
  }
  if (Object.keys(batches).length !== reference.fullScope.length || reference.fullScope.some((id: string) => !batches[id])) throw new Error('Incomplete matrix');
  const metadata = { ...reference, label: prefix, shard: null, mergedShards: files, expectedRoutes: reference.fullScope, setups: parts.flatMap(p => p.metadata.setups) };
  const routes = styleRoutes(!reference.baseline).filter(r => reference.fullScope.includes(r.id));
  atomic(`${directory}/${prefix}.json`, { metadata, complete: true, batches });
  atomic(`${directory}/${prefix}-summary.json`, { metadata, complete: true, completedRoutes: routes.length, routes: styleSummary(routes, batches) });
  return { complete: true, scenarios: routes.length, seeds: reference.seeds.length };
}
