/** Real fresh-save reachability, deliberately separate from endowed balance fixtures.
 * CAFESTYLE_PROGRESSION=1 npx vitest run scripts/cafe-style-progression.test.ts
 * Optional: CAFESTYLE_PROGRESSION_SEEDS=3 CAFESTYLE_PROGRESSION_DAYS=120
 * CAFESTYLE_PROGRESSION_STYLES=coffee,bakery CAFESTYLE_PROGRESSION_LABEL=baseline
 * CAFESTYLE_PROGRESSION_SNAPSHOTS=1 exports untouched stage saves outside the repo.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU, type ItemId, type UpgradeId } from '../src/game/data';
import { createInitialState, type GameState } from '../src/game/state';
import { STYLE_IDS, setCafeStyle, styleStages, nextStyleGoal, type CafeStyleId } from '../src/game/styles';
import { Sim } from '../src/game/sim';
import { openShop, type DayReport } from '../src/game/day';
import { bakeForForecast, buyItem, buyUpgrade, dayNeeds, menuItems, quoteItem, quoteUpgrade, restock,
  servingCost, setOnMenu, previousInCategory, canPrepareItem, salePrice } from '../src/game/economy';
import { claimGoal, goalDone } from '../src/game/goals';
import { KITCHEN_COST, unlockKitchen } from '../src/game/kitchen';
import { adoptCat, CARE_SECONDS, catDef } from '../src/game/pets';
import { comfort, decorDef, useDecor } from '../src/game/decor';
import { buyFurniture, canPlace, COLS, FLOOR_ROWS, WALL_ROWS, furnitureDef, placeFurniture } from '../src/game/furniture';
import { mainTableCount, REGIONS, unlockRegion, type RegionId } from '../src/game/regions';
import { researchSignature, signatureCost } from '../src/game/taste';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';

const DT = .05, OPEN_SECONDS = 180, MAX_CLOSING_SECONDS = 300;
const POLICY_VERSION = 2;
const gameHash = () => createHash('sha256').update(readdirSync('src/game').filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort().map(f => `${f}\n${readFileSync(`src/game/${f}`, 'utf8')}`).join('\n')).digest('hex');
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const liquid = (s: GameState) => ({ cash: s.coins,
  pantry: INGREDIENTS.reduce((n, i) => n + s.pantry[i.id] * i.cost, 0),
  care: s.pets.reduce((n, p) => n + p.careSeconds / CARE_SECONDS * catDef(p.id)!.careCost, 0) });
const liquidTotal = (s: GameState) => Object.values(liquid(s)).reduce((a, b) => a + b, 0);
type Receipt = { day: number; elapsedSeconds: number; kind: 'capital' | 'stock' | 'goal'; action: string; cash: number; capital: number; includedCare: number };
type Completion = { day: number; phase: GameState['phase']; completedServiceDays: number; elapsedSeconds: number; served: number; capital: number; goalRewards: number; assets: ReturnType<typeof liquid>; goals: ReturnType<typeof styleStages>[number]['goals'] };
type Options = { days?: number; stopWhenComplete?: boolean; snapshotPrefix?: string };

/** This policy changes state only through player-facing economic/menu APIs. It
 * never fills coins, stock, recipe levels, taste, reviews or style counters. */
export function runStyleProgression(style: CafeStyleId, seed: number, options: Options = {}) {
  const maxDays = options.days ?? 120;
  setSceneHeight(MIN_SCENE_H); setKitchenLevel(0);
  const state = createInitialState(0);
  if (!setCafeStyle(state, style)) throw new Error('Could not select fresh-save style');
  const initial = { assets: liquid(state), coins: state.coins, served: state.served, pantry: { ...state.pantry },
    items: { ...state.items }, stages: styleStages(state, style) };
  const initialLiquid = liquidTotal(state);
  const sim = new Sim(rng(seed));
  const receipts: Receipt[] = [];
  const daily: { day: number; elapsedSeconds: number; openSeconds: number; closingSeconds: number; closingRevenue: number;
    closingIngredientCost: number; queueRemovedAtClosing: number; menu: ItemId[]; report: DayReport; wasteCost: number;
    stockPurchases: number; carePurchases: number; capital: number; goalRewards: number; assets: ReturnType<typeof liquid>;
    reconciliationError: number; checklist: ReturnType<typeof styleStages> }[] = [];
  const completions: Partial<Record<'early' | 'mid' | 'late', Completion>> = {};
  const snapshots: Partial<Record<'early' | 'mid' | 'late', string>> = {};
  let elapsed = 0, capital = 0, rewards = 0, operating = 0, reserve = 0;
  let blocker: string | null = null;
  let blockedLayout: unknown = null;
  const receipt = (kind: Receipt['kind'], action: string, before: number, includedCare = 0) => {
    const cash = before - state.coins;
    const invested = kind === 'capital' ? cash - includedCare : 0;
    capital += invested;
    receipts.push({ day: state.day, elapsedSeconds: round(elapsed), kind, action, cash: round(cash), capital: round(invested), includedCare });
  };
  const affordable = (cost: number) => state.coins + 1e-8 >= cost + reserve;
  const buyLevel = (id: ItemId, target: number): boolean => {
    if (state.items[id] >= target) return true;
    if (!canPrepareItem(state, id)) return false;
    const previous = previousInCategory(id);
    if (previous && !state.items[previous.id] && !buyLevel(previous.id, 1)) return false;
    for (let n = 0; n < 100 && state.items[id] < target; n++) {
      const q = quoteItem(state, id, 1);
      if (!q.affordable || !affordable(q.cost)) return false;
      const before = state.coins;
      if (!buyItem(state, id, 1)) throw new Error(`Legal item quote failed: ${id}`);
      receipt('capital', `${id} level ${state.items[id]}`, before);
    }
    return state.items[id] >= target;
  };
  const upgrade = (id: UpgradeId, target: number) => {
    for (let n = 0; n < 25 && state.upgrades[id] < target; n++) {
      const q = quoteUpgrade(state, id, 1);
      if (!q.affordable || !affordable(q.cost)) return;
      const before = state.coins;
      if (!buyUpgrade(state, id, 1)) throw new Error(`Legal upgrade quote failed: ${id}`);
      receipt('capital', `${id} upgrade ${state.upgrades[id]}`, before);
      setKitchenLevel(state.kitchen ? state.upgrades.cook : 0);
    }
  };
  const furnishing = (id: string) => {
    if (state.decor.placed.some(p => p.id === id)) return;
    const def = furnitureDef(id)!;
    const owned = (state.decor.stored[def.id] ?? 0) > 0;
    if (!owned && !affordable(def.cost)) return;
    for (let row = 0; row < (def.surface === 'wall' ? WALL_ROWS : FLOOR_ROWS); row++) for (let col = 0; col < COLS * 4; col++) {
      if (!canPlace(state, def.id, col, row, mainTableCount(state))) continue;
      if (!owned) { const before = state.coins; if (!buyFurniture(state, def.id)) throw new Error('Furniture purchase failed'); receipt('capital', def.id, before); }
      if (!placeFurniture(state, def.id, col, row, mainTableCount(state))) throw new Error('Legal plant placement failed');
      return;
    }
  };
  const cozy = (target: number) => {
    const choices = ['sill_cactus', 'ceiling_lights', 'rug_red', 'counter_walnut', 'wall_dots', 'floor_terrazzo'];
    for (const id of choices) {
      if (comfort(state) >= target) return;
      const d = decorDef(id)!;
      if (state.decor.equipped[d.slot] === id) continue;
      if (!affordable(state.decor.owned.includes(id) ? 0 : d.cost)) continue;
      const before = state.coins;
      if (!useDecor(state, id)) throw new Error(`Decor purchase failed: ${id}`);
      receipt('capital', id, before);
      if (id === 'sill_cactus') furnishing('poster_coffee');
    }
  };
  const menuForRoute = (): ItemId[] => {
    const owns = (id: ItemId) => state.items[id] > 0 && canPrepareItem(state, id);
    const available = (ids: ItemId[]) => ids.filter(owns);
    if (style === 'coffee') {
      const trained = state.taste.signature.filter(id => ['espresso', 'latte'].includes(id)).length >= 2;
      return owns('latte') ? available(trained ? ['latte', 'flatwhite'] : ['espresso', 'latte']) : ['espresso'];
    }
    if (style === 'bakery') {
      if (!owns('roll')) return ['espresso'];
      const trained = state.taste.signature.includes('roll') && state.taste.signature.includes('donut');
      return available(trained ? ['espresso', 'roll', 'croissant'] : ['espresso', 'roll', 'donut']);
    }
    if (style === 'garden') return owns('blacktea') ? available(['blacktea', 'scone']) : ['espresso'];
    if (style === 'takeaway') return owns('americano') ? available(['americano', 'cortado']) : ['espresso'];
    return available(['espresso', 'blacktea']);
  };
  const applyMenu = () => {
    const desired = new Set(menuForRoute());
    for (const item of MENU) setOnMenu(state, item.id, desired.has(item.id));
    bakeForForecast(state);
  };
  const buyStock = () => { const before = state.coins; restock(state); if (before !== state.coins) receipt('stock', 'forecast pantry restock', before); };
  const claim = () => {
    while (goalDone(state)) {
      const before = state.coins, index = state.goal;
      rewards += claimGoal(state);
      receipt('goal', `tutorial goal ${index}`, before);
    }
  };
  const checkStages = () => {
    for (const stage of styleStages(state, style)) if (stage.done && !completions[stage.id]) {
      completions[stage.id] = { day: state.day, phase: state.phase, completedServiceDays: daily.length, elapsedSeconds: round(elapsed), served: state.served,
        capital: round(capital), goalRewards: rewards, assets: liquid(state), goals: stage.goals };
      if (options.snapshotPrefix) {
        if (!/^[a-zA-Z0-9_-]+$/.test(options.snapshotPrefix)) throw new Error('Unsafe snapshot prefix');
        const directory = '/workspace/shared/cafe-styles-qa-fixtures'; mkdirSync(directory, { recursive: true });
        const file = `${directory}/${options.snapshotPrefix}-${style}-${seed}-${stage.id}.json`;
        if (existsSync(file)) throw new Error(`Preserve the existing actual-progression snapshot: ${file}`);
        const payload = { ...state, ...(state.phase === 'prep' ? {} : { runtime: sim.snapshot(state) }) };
        writeFileSync(file, JSON.stringify(payload) + '\n');
        writeFileSync(file.replace(/\.json$/, '.meta.json'), JSON.stringify({ style, seed, stage: stage.id,
          checkpoint: completions[stage.id], policyVersion: POLICY_VERSION, gameFingerprint: gameHash(),
          kind: 'Actual earned fresh-save progression, first observed qualifying checkpoint',
          note: 'Unmodified game state and live runtime when open. Profile remains null because the simulation policy does not invent onboarding identity.' }, null, 2) + '\n');
        snapshots[stage.id] = file;
      }
    }
  };
  const buyGoalAssets = () => {
    for (const g of styleStages(state, style).flatMap(stage => stage.goals)) {
      if (g.done) continue;
      if (g.id === 'kitchen' && !state.kitchen && affordable(KITCHEN_COST)) {
        const before = state.coins;
        if (!unlockKitchen(state)) throw new Error('Kitchen purchase failed');
        receipt('capital', 'kitchen with first cook', before); setKitchenLevel(state.upgrades.cook);
      }
      const region = REGIONS.find(r => r.id === g.id);
      if (region) for (const r of REGIONS.slice(0, REGIONS.indexOf(region) + 1)) {
        if (state.regions.includes(r.id)) continue;
        if (!affordable(r.cost)) break;
        const before = state.coins;
        if (!unlockRegion(state, r.id as RegionId)) break;
        receipt('capital', `room ${r.id}`, before);
      }
      if (g.id.startsWith('comfort')) cozy(g.target);
      if (g.id === 'planted') cozy(5);
      if (g.id === 'bookshelf') furnishing('bookshelf');
      if (/^cats\d+$/.test(g.id)) for (const id of ['ginger', 'black', 'tuxedo']) {
        if (state.pets.length >= g.target) break;
        if (state.pets.some(p => p.id === id)) continue;
        const cat = catDef(id)!;
        if (!affordable(cat.adoption)) break;
        const before = state.coins;
        if (!adoptCat(state, id)) throw new Error('Cat adoption failed');
        receipt('capital', `adopt ${id}`, before, cat.careCost);
      }
      const item = MENU.find(m => g.id === `${m.id}${g.target}`);
      if (item) buyLevel(item.id, g.target);
      for (const id of ['machine', 'marketing', 'barista', 'server', 'cook', 'tables'] as UpgradeId[])
        if (g.id === `${id}${g.target}`) upgrade(id, g.target);
    }
  };
  for (let day = 0; day < maxDays; day++) {
    const rewardBefore = rewards, capitalBefore = capital, receiptStart = receipts.length;
    claim(); applyMenu(); buyStock();
    // Carry one extra forecast's purchasing cash plus a full care pack. Paid
    // pantry is already present; no artificial replenishment or free subsidy.
    const needs = dayNeeds(state);
    reserve = Math.max(20, INGREDIENTS.reduce((sum, i) => sum + (needs[i.id] ?? 0) * i.cost, 0))
      + state.pets.reduce((sum, p) => sum + catDef(p.id)!.careCost, 0);
    // A short shared bootstrap is the game's only initial earning recipe. It is
    // capped at level 10 and abandoned when route-specific recipes are ready.
    if (style !== 'garden') buyLevel('espresso', 5);
    if (style === 'garden') buyLevel('blacktea', 3);
    if (style === 'cats' || style === 'community') buyLevel('blacktea', 3);
    // Reinvest at most 30% of spendable cash in the current route's prices, to
    // avoid freezing income while saving for later rooms/staff. No max-buy sink.
    const budget = Math.max(0, (state.coins - reserve) * .30);
    const floor = state.coins - budget;
    for (let count = 0; count < 8; count++) {
      const candidates = menuForRoute().filter(id => state.items[id] < (id === 'espresso' ? 10 : 25))
        .map(id => ({ id, cost: quoteItem(state, id, 1).cost, score: salePrice(state, id) / Math.max(1, quoteItem(state, id, 1).cost) }))
        .filter(x => x.cost <= state.coins - Math.max(reserve, floor)).sort((a, b) => b.score - a.score);
      if (!candidates.length) break;
      buyLevel(candidates[0].id, state.items[candidates[0].id] + 1);
    }
    buyGoalAssets();
    // Small, real capacity investments support the route rather than adding
    // free benchmark staff. Later stage goals may demand more specific levels.
    if (daily.at(-1)?.report.revenue && daily.at(-1)!.report.revenue >= 800) {
      upgrade('machine', 2);
      if (menuForRoute().length >= 2) upgrade('barista', 1);
    }
    for (const id of menuForRoute()) if ((state.taste.served[id] ?? 0) >= 100 && !state.taste.signature.includes(id) && affordable(signatureCost(id))) {
      const before = state.coins;
      if (!researchSignature(state, id)) throw new Error(`Research failed: ${id}`);
      receipt('capital', `signature ${id}`, before);
    }
    claim(); applyMenu(); buyStock(); checkStages();
    if (options.stopWhenComplete !== false && styleStages(state, style).every(stage => stage.done)) break;
    if (!menuItems(state).length) { blocker = 'No legal route menu remained'; break; }
    const selectedMenu = [...state.onMenu], beforeOpen = state.coins;
    openShop(state);
    for (let tick = 0; tick < OPEN_SECONDS / DT; tick++) {
      const servedBefore = state.served; sim.update(state, DT); elapsed += DT;
      if (state.served !== servedBefore) checkStages();
    }
    const queueRemovedAtClosing = sim.queue.length;
    const revenueAtClose = state.today.revenue, ingredientsAtClose = state.today.ingredientCost;
    sim.beginClosing(state);
    let closingTicks = 0;
    while (!sim.finishedService && closingTicks < MAX_CLOSING_SECONDS / DT) {
      const servedBefore = state.served; sim.update(state, DT); elapsed += DT; closingTicks++;
      if (state.served !== servedBefore) checkStages();
    }
    if (!sim.finishedService) {
      blocker = `Service did not drain within ${MAX_CLOSING_SECONDS} seconds on day ${state.day}`;
      blockedLayout = { placed: structuredClone(state.decor.placed), tables: state.upgrades.tables, regions: [...state.regions],
        customers: structuredClone(sim.customers), servers: structuredClone(sim.servers), pass: structuredClone(sim.pass),
        cooks: structuredClone(sim.cooks), today: structuredClone(state.today) };
      operating += state.today.revenue - state.today.ingredientCost - state.today.petCost - state.today.promotionCost;
      break;
    }
    const report = sim.closeShop(state)!;
    operating += report.profit;
    const error = liquidTotal(state) - initialLiquid - (operating + rewards - capital);
    if (Math.abs(error) > 1e-5) throw new Error(`Fresh-save ledger mismatch: ${style}/${seed}/${state.day}: ${error}`);
    if (INGREDIENTS.some(i => state.pantry[i.id] < -1e-8) || state.coins < -1e-8) throw new Error('Negative cash or ingredients');
    const costSold = Object.entries(report.sales).reduce((n, [id, count]) => n + servingCost(id as ItemId) * count!, 0);
    daily.push({ day: report.day, elapsedSeconds: round(elapsed), openSeconds: OPEN_SECONDS, closingSeconds: closingTicks * DT,
      closingRevenue: report.revenue - revenueAtClose, closingIngredientCost: report.ingredientCost - ingredientsAtClose,
      queueRemovedAtClosing, menu: selectedMenu, report,
      wasteCost: Math.max(0, report.ingredientCost - costSold),
      stockPurchases: receipts.slice(receiptStart).filter(r => r.kind === 'stock').reduce((n, r) => n + r.cash, 0),
      carePurchases: beforeOpen + report.revenue - state.coins,
      capital: capital - capitalBefore, goalRewards: rewards - rewardBefore, assets: liquid(state), reconciliationError: error,
      checklist: styleStages(state, style) });
    checkStages();
  }
  const stages = styleStages(state, style), complete = stages.every(stage => stage.done);
  const finalLedgerError = liquidTotal(state) - initialLiquid - (operating + rewards - capital);
  return { style, seed, policyVersion: POLICY_VERSION, observationBound: { maxDays, openSecondsPerDay: OPEN_SECONDS, maxClosingSeconds: MAX_CLOSING_SECONDS },
    status: complete ? 'complete' : blocker ? 'blocked' : 'censored-at-observation-bound', blocker, blockedLayout, initial,
    elapsedSeconds: round(elapsed), completedDays: daily.length, completions, snapshots, stages, nextGoal: nextStyleGoal(state, style),
    receipts, daily, final: { assets: liquid(state), served: state.served, items: state.items, upgrades: state.upgrades,
      kitchen: state.kitchen, regions: state.regions, pets: state.pets, taste: state.taste, comfort: comfort(state),
      placed: state.decor.placed, equipped: state.decor.equipped, handoffs: state.cafeStyle.handoffs,
      capital, goalRewards: rewards, operatingProfit: operating, netLiquidChange: liquidTotal(state) - initialLiquid,
      reconciliationError: finalLedgerError },
    limitations: ['A reproducible legal purchasing policy, not an optimal player or a guarantee for every player.',
      'Censoring at the explicit observation bound does not establish impossibility.',
      'First-passage stage times are retained; final checklists are separately revalidated.',
      'No manual boosts, emergency grants, injected capital, fixture assets, taste or stock. Tutorial rewards are claimed only when legally earned.',
      'Menus and investments change only in preparation. All time is actual simulated open and closing time; preparation clicks take no simulated time.'] };
}

describe('real fresh-save style progression', () => {
  it('earns its seed capital and reconciles paid progression without endowed fixtures', () => {
    const row = runStyleProgression('coffee', 0x5eed1234, { days: 3, stopWhenComplete: false });
    expect(row.initial.coins).toBe(0); expect(row.initial.assets.pantry).toBe(50); expect(row.initial.served).toBe(0);
    expect(row.completedDays).toBe(3); expect(row.final.served).toBeGreaterThan(60);
    expect(row.receipts.some(r => r.kind === 'capital')).toBe(true);
    expect(row.daily.every(d => Math.abs(d.reconciliationError) < 1e-5)).toBe(true);
    expect(row.final.reconciliationError).toBeCloseTo(0, 5);
  });
  it.skipIf(process.env.CAFESTYLE_PROGRESSION !== '1')('records legal early/mid/late reachability for all requested routes', () => {
    const seedCount = Math.max(1, Math.min(30, Number(process.env.CAFESTYLE_PROGRESSION_SEEDS ?? 3)));
    const maxDays = Math.max(1, Math.min(365, Number(process.env.CAFESTYLE_PROGRESSION_DAYS ?? 120)));
    const chosen = process.env.CAFESTYLE_PROGRESSION_STYLES?.split(',') ?? [...STYLE_IDS];
    if (!chosen.every(id => STYLE_IDS.includes(id as CafeStyleId))) throw new Error('Unknown progression style');
    const label = process.env.CAFESTYLE_PROGRESSION_LABEL ?? `run-${Date.now()}`;
    if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe evidence label');
    const gameFingerprint = gameHash();
    const runnerFingerprint = createHash('sha256').update(readFileSync('scripts/cafe-style-progression.test.ts')).digest('hex');
    const seeds = Array.from({ length: seedCount }, (_, i) => (0x5eed1234 + i * 2654435761) >>> 0);
    const rows: ReturnType<typeof runStyleProgression>[] = [];
    const directory = 'docs/cafe-styles/progression'; mkdirSync(directory, { recursive: true });
    const filename = `${directory}/${label}.json`;
    if (existsSync(filename)) throw new Error(`Evidence already exists; use a new label to preserve it: ${filename}`);
    const save = () => { writeFileSync(`${filename}.tmp`, JSON.stringify({ metadata: { policyVersion: POLICY_VERSION, gameFingerprint, runnerFingerprint,
      currentGameFingerprint: gameHash(), seeds, styles: chosen, maxDays, dt: DT, initialEndowment: 'Exactly createInitialState(0): 0 coins, 50 beans, starter espresso and furniture; no fixture subsidy.' },
      complete: rows.length === chosen.length * seeds.length, rows }, null, 2) + '\n'); renameSync(`${filename}.tmp`, filename); };
    save();
    for (const id of chosen) for (const seed of seeds) {
      const row = runStyleProgression(id as CafeStyleId, seed, { days: maxDays,
        snapshotPrefix: process.env.CAFESTYLE_PROGRESSION_SNAPSHOTS === '1' ? label : undefined }); rows.push(row); save();
      console.log(JSON.stringify({ style: id, seed, status: row.status, completedDays: row.completedDays, stages: row.completions,
        nextGoal: row.nextGoal, blocker: row.blocker, profit: row.final.operatingProfit, capital: row.final.capital }));
      expect(Math.abs(row.final.reconciliationError)).toBeLessThan(1e-5);
      expect(row.blocker).toBeNull();
    }
    // Evidence is still written for incomplete/censored trajectories.
    expect(gameHash(), 'Game source changed during the evidence run; rerun with a new label').toBe(gameFingerprint);
    expect(rows.every(row => row.status === 'complete'), 'Some routes remain unproven within the recorded observation bound; inspect raw evidence').toBe(true);
  }, 1_800_000);
});
