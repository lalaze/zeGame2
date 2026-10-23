import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { buildStylePortfolio, mergeStyleShards, PRESSURES, runStyleLab, STYLE_BUDGETS, STYLE_SEEDS, styleRoutes, styleSample, type StyleSetter } from './cafe-style-lab';

async function styleSetter(): Promise<StyleSetter | undefined> {
  if (!existsSync('src/game/styles.ts')) return undefined;
  // The untouched baseline deliberately has no styles module; no gameplay file is changed there.
  const path = '../src/game/styles';
  return (await import(path)).setCafeStyle;
}
describe('six styles fair comparison contract', () => {
  it('pre-registers 108 baseline and 216 focused/control scenarios with 30 fixed seeds', () => {
    expect(styleRoutes(false)).toHaveLength(108); expect(styleRoutes()).toHaveLength(216);
    expect(new Set(STYLE_SEEDS).size).toBe(30); expect(PRESSURES).toEqual({ base: null, feature: 'noteLocal', rush: 'clipStar' });
  });
  it('pays every prerequisite, preserves equal stage funding, and protects working cash', () => {
    for (const route of styleRoutes(false)) {
      const setup = buildStylePortfolio(route);
      expect(setup.budget).toBe(STYLE_BUDGETS[route.stage]);
      expect(setup.cashSpent + setup.remainingCash).toBeCloseTo(setup.budget, 6);
      expect(setup.remainingCash + 1e-6).toBeGreaterThanOrEqual(setup.stockReserve);
      expect(setup.ledger.every(p => p.cash >= 0 && p.capital >= 0)).toBe(true);
    }
  });
  it('common-assets panel has literally identical paid ownership and progress for every policy', () => {
    for (const stage of ['early', 'mid', 'late'] as const) {
      const routes = styleRoutes(false).filter(r => r.stage === stage && r.panel === 'common-assets');
      const first = buildStylePortfolio(routes[0]);
      for (const route of routes.slice(1)) {
        const setup = buildStylePortfolio(route);
        expect(setup.ownership).toEqual(first.ownership); expect(setup.ledger).toEqual(first.ledger); expect(setup.remainingCash).toBe(first.remainingCash);
      }
    }
  });
  it('stops exactly at the horizon without cancelling service, settling, draining or adding revenue', () => {
    const route = styleRoutes(false)[0], row = styleSample(route, STYLE_SEEDS[0], undefined, 180);
    expect(row.seconds).toBe(180); expect(row.openSeconds).toBe(180); expect(row.closingSeconds).toBe(0);
    // The trading day ends at 180 s (dcacd65): the cafe has just begun closing, but nothing settles or drains.
    expect(row.completedDays).toBe(0); expect(row.terminalPhase).toBe('closing');
    expect(row.reconciliationError).toBeCloseTo(0, 5); expect(row.cashLedgerError).toBeCloseTo(0, 5);
    expect(styleSample(route, STYLE_SEEDS[0], undefined, 180)).toEqual(row);
  });
  it('isolates forecasts from previous global layout and records food expense without invented salvage', () => {
    const route = styleRoutes(false).find(r => r.panel === 'route-purchases' && r.stage === 'mid' && r.style === 'bakery')!;
    setSceneHeight(360); setKitchenLevel(2); const row = styleSample(route, STYLE_SEEDS[0], undefined, 20);
    setSceneHeight(MIN_SCENE_H); setKitchenLevel(0); expect(styleSample(route, STYLE_SEEDS[0], undefined, 20)).toEqual(row);
    expect(row.netLiquidProfit).toBeCloseTo(row.operatingProfit - row.capital, 5);
    expect(row.wasteCost).toBeGreaterThanOrEqual(0); expect(row.censored).toBe(true); expect(row.paybackSeconds).toBeNull();
  });
  it('changes focus only through the game setter and preserves the paid-asset ledger', async () => {
    const setter = await styleSetter(); if (!setter) return;
    const route = styleRoutes().find(r => r.focus)!;
    const focused = buildStylePortfolio(route, setter), plain = buildStylePortfolio({ ...route, focus: false }, setter);
    expect(focused.ledger).toEqual(plain.ledger); expect(focused.ownership).toEqual(plain.ownership);
  });
});
it.skipIf(process.env.CAFE_STYLE_LAB !== '1')('writes the resumable real-Sim six-style matrix', async () => {
  expect((await runStyleLab(await styleSetter())).complete).toBe(true);
}, 86_400_000);

it.skipIf(!process.env.CAFE_STYLE_MERGE)('merges complete fingerprint-matched economic shards', () => {
  expect(mergeStyleShards(process.env.CAFE_STYLE_MERGE!, process.env.CAFE_STYLE_RESULTS_DIR).complete).toBe(true);
});
