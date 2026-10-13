import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU, type ItemId } from './data';
import { openShop } from './day';
import { buyIngredient, prepTime, recipe, salePrice, servingCost } from './economy';
import { reviewAverage } from './reputation';
import { makeSignatureId, saveSignature, setSignatureOnMenu, signatureDefinition, trialSignature } from './signature-drinks';
import { Sim } from './sim';
import { createInitialState } from './state';

const choices: { name: string; id: ItemId }[] = [
  { name: 'stock espresso', id: 'espresso' },
  { name: 'stock latte', id: 'latte' },
  { name: 'custom black', id: makeSignatureId('coffee', { beans: 1 })! },
  { name: 'custom milky', id: makeSignatureId('coffee', { beans: 1, milk: 2 })! },
  { name: 'custom rich', id: makeSignatureId('coffee', { beans: 1, milk: 1, cream: 2, sugar: 2 })! },
];
function scenario(id: ItemId, marketing: number, seed: number) {
  const s = createInitialState(0);
  for (const m of MENU) s.items[m.id] = 1;
  for (const ing of INGREDIENTS) s.pantry[ing.id] = 10000;
  s.upgrades.marketing = marketing;
  s.onMenu = [];
  const def = signatureDefinition(id);
  if (def) {
    expect(trialSignature(s, def.base, def.recipe).ok).toBe(true);
    expect(saveSignature(s, id, 'Balance sample')).toBe(true);
    expect(setSignatureOnMenu(s, id, true)).toBe(true);
  } else s.onMenu = [id];
  const economics = { price: salePrice(s, id), cost: servingCost(id), seconds: prepTime(s, id) };
  const sim = new Sim(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  openShop(s);
  for (let i = 0; i < 3600; i++) sim.update(s, .05);
  sim.beginClosing(s);
  for (let i = 0; i < 10000 && !sim.finishedService; i++) sim.update(s, .05);
  expect(sim.finishedService).toBe(true);
  const r = sim.closeShop(s)!;
  expect(r.profit).toBeCloseTo(r.revenue - r.ingredientCost);
  return { ...economics, served: r.served, missed: r.missed, profit: r.profit, revenue: r.revenue, costUsed: r.ingredientCost, rating: reviewAverage(r.reviews) ?? 0 };
}

describe('reproducible signature drink balance checks', () => {
  it('retains a preparation tradeoff instead of a free duplicate of espresso', () => {
    const s = createInitialState(0);
    const id = choices[2].id;
    expect(salePrice(s, id) - servingCost(id)).toBeGreaterThan(salePrice(s, 'espresso') - servingCost('espresso'));
    expect((salePrice(s, id) - servingCost(id)) / prepTime(s, id)).toBeLessThan((salePrice(s, 'espresso') - servingCost('espresso')) / prepTime(s, 'espresso'));
    expect(prepTime(s, choices[4].id)).toBeGreaterThan(prepTime(s, choices[3].id));
  });
  it('runs equal-staff, equal-stock low/high demand service samples with reconciled books', () => {
    const rows = [];
    for (const marketing of [0, 12]) for (const choice of choices) {
      const runs = [12, 98, 143].map(seed => scenario(choice.id, marketing, seed));
      const average = (key: keyof typeof runs[number]) => Math.round(runs.reduce((sum, r) => sum + r[key], 0) / runs.length * 100) / 100;
      const row = { drink: choice.name, marketing, price: runs[0].price, ingredientCost: runs[0].cost, prepSeconds: runs[0].seconds, served: average('served'), missed: average('missed'), profit: average('profit'), rating: average('rating') };
      expect(row.served).toBeGreaterThan(0);
      expect(row.profit).toBeGreaterThan(0);
      rows.push(row);
    }
    console.log('SIGNATURE_BALANCE', JSON.stringify(rows));
  });
});


const budgetPairs: { base: string; custom: ItemId; stock: ItemId }[] = [
  { base: 'coffee', custom: makeSignatureId('coffee', { beans: 1, milk: 2 })!, stock: 'latte' },
  { base: 'tea', custom: makeSignatureId('tea', { tea: 1, milk: 1 })!, stock: 'blacktea' },
  { base: 'milk', custom: makeSignatureId('milk', { milk: 2, sugar: 1 })!, stock: 'hotchoc' },
  { base: 'fruit', custom: makeSignatureId('fruit', { fruit: 1, milk: 1, sugar: 1 })!, stock: 'smoothie' },
];
function budgetScenario(id: ItemId, seed: number, marketing = 4) {
  const s = createInitialState(0);
  const startup = 1000, budget = 300;
  s.coins = startup;
  for (const m of MENU) s.items[m.id] = 1;
  for (const ing of INGREDIENTS) s.pantry[ing.id] = 0;
  s.upgrades.marketing = marketing;
  s.onMenu = [];
  const portions = Math.floor(budget / servingCost(id));
  for (const [ing, dose] of recipe(id)) expect(buyIngredient(s, ing, portions * dose)).toBe(true);
  const purchase = startup - s.coins;
  expect(purchase).toBeLessThanOrEqual(budget);
  const def = signatureDefinition(id);
  if (def) {
    expect(trialSignature(s, def.base, def.recipe).ok).toBe(true);
    expect(saveSignature(s, id, 'Paired budget sample')).toBe(true);
    expect(setSignatureOnMenu(s, id, true)).toBe(true);
  } else s.onMenu = [id];
  const trial = def ? servingCost(id) * .25 : 0;
  const sim = new Sim(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  const paid = new Set<number>();
  let wait = 0;
  const tick = () => {
    sim.update(s, .05);
    for (const c of sim.customers) if (c.hasCup && !paid.has(c.id)) { paid.add(c.id); wait += c.waitSeconds; }
  };
  openShop(s);
  for (let i = 0; i < 3600; i++) tick();
  sim.beginClosing(s);
  for (let i = 0; i < 10000 && !sim.finishedService; i++) tick();
  expect(sim.finishedService).toBe(true);
  const r = sim.closeShop(s)!;
  expect(paid.size).toBe(r.served);
  const remaining = INGREDIENTS.reduce((sum, ing) => sum + s.pantry[ing.id] * ing.cost, 0);
  const waste = r.ingredientCost - (r.sales[id] ?? 0) * servingCost(id);
  expect(waste).toBeGreaterThanOrEqual(-1e-8);
  expect(purchase).toBeCloseTo(trial + r.ingredientCost + remaining);
  expect(s.coins - startup).toBeCloseTo(r.revenue - purchase);
  return { purchase, trial, revenue: r.revenue, consumed: r.ingredientCost, waste: Math.max(0, waste), remaining,
    cashNet: s.coins - startup, margin: r.revenue - r.ingredientCost - trial,
    served: r.served, missed: r.missed, wait: paid.size ? wait / paid.size : 0, rating: reviewAverage(r.reviews) ?? 0 };
}
describe('paired same-budget raw-material comparison', () => {
  it('compares all four bases with stock using identical assets, budget, duration and seeded random streams', () => {
    const rows = [];
    for (const pair of budgetPairs) for (const kind of ['stock', 'custom'] as const) {
      const runs = [12, 98, 143].map(seed => budgetScenario(pair[kind], seed));
      const mean = (key: keyof typeof runs[number]) => Math.round(runs.reduce((sum, r) => sum + r[key], 0) / runs.length * 100) / 100;
      rows.push({ base: pair.base, kind, id: pair[kind], ...Object.fromEntries(Object.keys(runs[0]).map(key => [key, mean(key as keyof typeof runs[number])])) });
    }
    console.log('SIGNATURE_FIXED_BUDGET', JSON.stringify(rows));
    // A second run uses the same complete PRNG stream, proving reproducibility.
    expect(budgetScenario(budgetPairs[0].custom, 12)).toEqual(budgetScenario(budgetPairs[0].custom, 12));
  });
});


// Fixed before looking at results. Each stock/custom scenario restarts the
// identical PRNG stream; event draw alignment can diverge as service changes.
const FINAL_SEEDS = [12, 109, 206, 303, 400, 497, 594, 691, 788, 885, 982, 1079, 1176, 1273, 1370,
  1467, 1564, 1661, 1758, 1855, 1952, 2049, 2146, 2243, 2340, 2437, 2534, 2631, 2728, 2825];
it.skipIf(process.env.SIGNATURE_BALANCE_LAB !== '1')('records final 30-seed equal-budget normal/peak paired evidence', () => {
  const raw = [];
  const summary = [];
  for (const marketing of [0, 12]) for (const pair of budgetPairs) for (const kind of ['stock', 'custom'] as const) {
    const runs = FINAL_SEEDS.map(seed => ({ seed, ...budgetScenario(pair[kind], seed, marketing) }));
    raw.push(...runs.map(run => ({ base: pair.base, kind, id: pair[kind], marketing, ...run })));
    const keys = Object.keys(runs[0]).filter(key => key !== 'seed') as (keyof typeof runs[number])[];
    summary.push({ base: pair.base, kind, id: pair[kind], marketing,
      ...Object.fromEntries(keys.map(key => [key, Math.round(runs.reduce((sum, run) => sum + run[key], 0) / runs.length * 100) / 100])) });
  }
  mkdirSync('docs/signature-drinks/evidence', { recursive: true });
  writeFileSync('docs/signature-drinks/evidence/balance-raw.json', JSON.stringify({
    schemaVersion: 1, seedAlgorithm: 'LCG: seed=(imul(seed,1664525)+1013904223)>>>0; seed/2**32',
    seeds: FINAL_SEEDS, startupCoins: 1000, rawMaterialBudget: 300, arrivalDurationSeconds: 180, tickSeconds: .05,
    closing: 'drain accepted service; no arrivals', assets: 'all stock dishes unlocked level1; default staff/machine/comfort/tables; no companion; neutral style; no kitchen',
    notes: 'Custom trial included in purchased inventory and deducted separately. No reinvestment/replenishment. Static unlock costs excluded equally. Same PRNG stream, not event-aligned customer cohorts.',
    summary, runs: raw,
  }, null, 2) + '\n');
  console.log('SIGNATURE_FINAL_BUDGET', JSON.stringify(summary));
}, 120000);
