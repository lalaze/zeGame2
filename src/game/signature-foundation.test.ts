import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUEST_KINDS, guestAffinity } from './customer-demand';
import { openShop } from './day';
import { menuItem, prepTime, salePrice, servingCost } from './economy';
import { makeSignatureId, saveSignature, setSignatureOnMenu, signatureDefinition, trialSignature } from './signature-drinks';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize } from './state';

const pureTea = makeSignatureId('tea', { tea: 1 })!;
const pureCoffee = makeSignatureId('coffee', { beans: 1 })!;

function service(custom: boolean, marketing: number, seed: number) {
  const state = createInitialState(0);
  state.day = 3;
  state.items.blacktea = 1;
  state.upgrades.marketing = marketing;
  state.pantry.tea = 1000;
  state.onMenu = custom ? [] : ['blacktea'];
  if (custom) {
    expect(trialSignature(state, 'tea', { tea: 1 }).ok).toBe(true);
    expect(saveSignature(state, pureTea, 'Pure tea')).toBe(true);
    expect(setSignatureOnMenu(state, pureTea, true)).toBe(true);
  }
  const sim = new Sim(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; });
  openShop(state);
  for (let i = 0; i < 3600; i++) sim.update(state, .05);
  sim.beginClosing(state);
  for (let i = 0; i < 10000 && !sim.finishedService; i++) sim.update(state, .05);
  expect(sim.finishedService).toBe(true);
  const report = sim.closeShop(state)!;
  return { custom, marketing, served: report.served, missed: report.missed, profit: report.profit, rating: report.rating };
}

describe('signature recipes retain their foundation tradeoffs', () => {
  it.each([1, 5, 10])('keeps one-ingredient copies at the base price and speed at level %s', level => {
    const state = createInitialState(0);
    for (const [stock, custom] of [['espresso', pureCoffee], ['blacktea', pureTea]] as const) {
      state.items[stock] = level;
      expect(servingCost(custom)).toBe(servingCost(stock));
      expect(prepTime(state, custom)).toBe(prepTime(state, stock));
      expect(salePrice(state, custom)).toBe(salePrice(state, stock));
      for (const kind of GUEST_KINDS) expect(guestAffinity(kind, menuItem(custom))).toBe(guestAffinity(kind, menuItem(stock)));
    }
  });

  it('keeps inventive blends valuable, slower and distinct from a plain cup', () => {
    const state = createInitialState(0);
    state.items.blacktea = 1;
    for (const [base, recipe, stock] of [
      ['coffee', { beans: 1, milk: 1 }, 'espresso'],
      ['coffee', { beans: 2 }, 'espresso'],
      ['tea', { tea: 1, milk: 1 }, 'blacktea'],
      ['tea', { tea: 2 }, 'blacktea'],
    ] as const) {
      const id = makeSignatureId(base, recipe)!;
      expect(salePrice(state, id)).toBeGreaterThan(salePrice(state, stock));
      expect(prepTime(state, id)).toBeGreaterThan(prepTime(state, stock));
    }
    const milkyTea = makeSignatureId('tea', { tea: 1, milk: 1 })!;
    expect(guestAffinity('leisure', menuItem(milkyTea))).toBeGreaterThan(guestAffinity('leisure', menuItem(pureTea)));
    expect(signatureDefinition(makeSignatureId('coffee', { beans: 1, milk: 1 })!)!.prepTime).toBe(1.8);
  });

  it('retains existing recipe names, menu choices, trial history and serving progress on reload', () => {
    const state = createInitialState(0);
    state.items.blacktea = 5;
    state.signatureDrinks = {
      recipes: [{ id: pureTea, name: 'My old tea', onMenu: true }],
      tested: [pureTea], served: { [pureTea]: 83 },
    };
    const loaded = deserialize(serialize(state), 0);
    expect(loaded.signatureDrinks).toEqual(state.signatureDrinks);
    expect(prepTime(loaded, pureTea)).toBe(prepTime(loaded, 'blacktea'));
    expect(salePrice(loaded, pureTea)).toBe(salePrice(loaded, 'blacktea'));
  });

  it('removes the pure-tea service and profit windfall at low, medium and peak demand', () => {
    const runs = [0, 4, 12].flatMap(marketing => [12, 98, 143, 731, 1091].flatMap(seed =>
      [false, true].map(custom => ({ seed, ...service(custom, marketing, seed) }))));
    const summary = [0, 4, 12].flatMap(marketing => [false, true].map(custom => {
      const rows = runs.filter(row => row.marketing === marketing && row.custom === custom);
      const mean = (key: 'served' | 'missed' | 'profit' | 'rating') => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
      return { marketing, custom, served: mean('served'), missed: mean('missed'), profit: mean('profit'), rating: mean('rating') };
    }));
    if (process.env.SIGNATURE_FOUNDATION_EVIDENCE) {
      const folder = 'artifacts/gameplay-fixes-2026-10-22/signature';
      mkdirSync(folder, { recursive: true });
      writeFileSync(`${folder}/${process.env.SIGNATURE_FOUNDATION_EVIDENCE}.json`, JSON.stringify({
        scope: 'Paired day-3 single-menu simulations with 180s arrivals plus accepted-service drain; five identical seeded streams per marketing level. Endowed stock, no reinvestment, trial cost excluded from operating profit.',
        summary, runs,
      }, null, 2) + '\n');
    }
    for (const marketing of [0, 4, 12]) {
      const stock = summary.find(row => row.marketing === marketing && !row.custom)!;
      const custom = summary.find(row => row.marketing === marketing && row.custom)!;
      expect(custom.served).toBeLessThanOrEqual(stock.served * 1.05);
      expect(custom.profit).toBeLessThanOrEqual(stock.profit * 1.1);
    }
  });
});
