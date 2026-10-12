import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { STYLE_SEEDS, styleAssets } from './cafe-style-lab';
import { buildUnionPortfolio, frontierDesignHash, frontierRoutes, frontierSample, HOLDOUT_SEEDS, mergeFrontier, runFrontier, UNION } from './cafe-style-frontier-lab';
it('reconstructs the paid union with exact common ownership and protected cash for all 35 policies', () => {
  const routes = frontierRoutes(); expect(routes).toHaveLength(35);
  expect(HOLDOUT_SEEDS).toHaveLength(30); expect(new Set(HOLDOUT_SEEDS).size).toBe(30);
  expect(HOLDOUT_SEEDS.some(s => STYLE_SEEDS.includes(s))).toBe(false);
  const first = buildUnionPortfolio(routes[0]);
  for (const route of routes) {
    const setup = buildUnionPortfolio(route);
    expect(setup.ledger).toEqual(first.ledger); expect(setup.ownership).toEqual(first.ownership);
    expect(setup.remainingCash).toBe(first.remainingCash); expect(setup.remainingCash).toBeGreaterThanOrEqual(setup.stockReserve);
    expect(setup.cashSpent).toBeCloseTo(UNION.expectedPurchaseCash, 4);
    expect(styleAssets(setup.state).total + setup.capital).toBeCloseTo(setup.budget, 5);
  }
  if (process.env.FRONTIER_SETUP === '1') {
    const { state: _, ...setup } = first;
    writeFileSync('docs/cafe-styles/results/earned-late-union-setup.json', JSON.stringify({ designHash: frontierDesignHash(), ...setup }, null, 2) + '\n');
  }
});
it('retains the exact-clock, cash and operating identities in a short real-Sim smoke', () => {
  const row = frontierSample(frontierRoutes().find(r => r.style === 'garden' && r.menu === 'blacktea+scone')!, STYLE_SEEDS[0], 180);
  expect(row.seconds).toBe(180); expect(row.completedDays).toBe(0); expect(row.closingSeconds).toBe(0);
  expect(row.reconciliationError).toBeCloseTo(0, 5); expect(row.cashLedgerError).toBeCloseTo(0, 5);
});
it.skipIf(process.env.CAFE_STYLE_FRONTIER !== '1')('runs the immutable earned-union matrix', async () => {
  expect((await runFrontier()).complete).toBe(true);
}, 86_400_000);
it.skipIf(!process.env.FRONTIER_MERGE)('merges complete earned-union shards', () => {
  expect(mergeFrontier(process.env.FRONTIER_MERGE!, process.env.FRONTIER_RESULTS_DIR).complete).toBe(true);
});
