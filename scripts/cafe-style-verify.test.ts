/** Fast acceptance reader; it never re-runs or changes the simulation. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { STYLE_BUDGETS, STYLE_DT, STYLE_IDS, STYLE_OPEN_SECONDS, STYLE_LAB_VERSION, STYLE_SEEDS, STYLE_SECONDS, styleRoutes, styleSourceHash, styleStats, type StyleRow } from './cafe-style-lab';

type Metric = 'netLiquidProfit' | 'lossRate' | 'wasteCost' | 'rating' | 'served';
const METRICS: Metric[] = ['netLiquidProfit', 'lossRate', 'wasteCost', 'rating', 'served'];
const direction: Record<Metric, 1 | -1> = { netLiquidProfit: 1, lossRate: -1, wasteCost: -1, rating: 1, served: 1 };
const minimumImprovement = (metric: Metric, controlMean: number) => {
  if (metric === 'lossRate') return .005; // half a percentage point
  if (metric === 'rating') return .05;
  return Math.max(1, Math.abs(controlMean) * .01); // at least 1 unit and 1% for money/throughput/waste
};
function lossSensitivity(treated: StyleRow[], control: StyleRow[]) {
  const resolved = (r: StyleRow) => r.unmetDemand / Math.max(1, r.served + r.unmetDemand);
  const upper = (r: StyleRow) => (r.unmetDemand + r.terminalLiveCustomers) / Math.max(1, r.arrivalAttempts);
  const resolvedDelta = styleStats(treated.map((r, i) => resolved(r) - resolved(control[i])));
  // Worst case for a claimed treatment improvement: all its pending guests lost,
  // while every control pending guest is served. Never select the friendlier bound.
  const conservativeImprovement = styleStats(treated.map((r, i) => control[i].lossRate - upper(r)));
  return { resolvedDelta, conservativeImprovement,
    robust: conservativeImprovement.ci95Low > 0 && conservativeImprovement.mean >= .005 };
}
function paired(treated: StyleRow[], control: StyleRow[]) {
  return Object.fromEntries(METRICS.map(metric => {
    const differences = treated.map((r, i) => {
      if (r.seed !== control[i].seed) throw new Error('Unpaired seeds');
      return r[metric] - control[i][metric];
    });
    const stats = styleStats(differences), sign = direction[metric];
    const controlMean = styleStats(control.map(r => r[metric])).mean;
    const improvement = stats.mean * sign, threshold = minimumImprovement(metric, controlMean);
    const lowerImprovementCI = sign === 1 ? stats.ci95Low : -stats.ci95High;
    const observedFavorable = lowerImprovementCI > 0 && improvement >= threshold;
    const censoringSensitivity = metric === 'lossRate' ? lossSensitivity(treated, control) : null;
    return [metric, { ...stats, seedWins: differences.filter(x => x * sign > 1e-8).length,
      improvement, threshold, observedFavorable, censoringSensitivity,
      favorable: observedFavorable && (!censoringSensitivity || censoringSensitivity.robust) }];
  })) as Record<Metric, ReturnType<typeof styleStats> & { seedWins: number; improvement: number; threshold: number;
    observedFavorable: boolean; censoringSensitivity: ReturnType<typeof lossSensitivity> | null; favorable: boolean }>;
}
const near = (a: number, b: number, label: string) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-4) throw new Error(`Unreconciled ${label}: ${a} != ${b}`);
};
const sumLedger = (setup: any, field: string): number => setup.ledger.reduce((n: number, p: any) => n + p[field], 0);
function validateRow(r: StyleRow, setup: any) {
  if (r.seconds !== STYLE_SECONDS || Math.abs(r.openSeconds + r.closingSeconds - STYLE_SECONDS) > 1e-7) throw new Error('Unequal clock');
  const amounts = [...Object.values(r.assets), ...Object.values(r.spending), r.capital, r.investmentCash,
    r.initialUnspentCash, r.revenue, r.ingredientExpense, r.careExpense, r.promotionExpense, r.wasteCost,
    r.closedStaleCost, ...Object.values(r.liveFood), r.openSeconds, r.closingSeconds];
  if (amounts.some(n => !Number.isFinite(n) || n < -1e-6) || !METRICS.every(m => Number.isFinite(r[m]))) throw new Error('Invalid numeric data');
  if (r.lossRate < 0 || r.lossRate > 1 || r.rating < 1 || r.rating > 5) throw new Error('Invalid rate/rating');
  const counters = [r.served, r.missed, r.doorLost, r.lostIncludingDoor, r.queueRemovedAtClosing, r.unmetDemand,
    r.arrivalAttempts, r.soldOut, r.queueLost, r.tableLost, r.extraLost, r.terminalLiveCustomers, r.completedDays,
    r.promotionBookingAttempts, r.promotionBookingFailures, r.cashConstrainedRestocks, r.liveFood.activeOrders];
  if (counters.some(n => !Number.isInteger(n) || n < 0) || r.promotionBookingFailures > r.promotionBookingAttempts) throw new Error('Invalid event counters');
  for (const p of setup.ledger) {
    if ([p.cash, p.capital, p.prepaidCare].some(n => !Number.isFinite(n) || n < 0)) throw new Error('Invalid purchase');
    near(p.cash, p.capital + p.prepaidCare, 'purchase capital/care split');
  }
  near(setup.cashSpent, sumLedger(setup, 'cash'), 'setup purchase cash');
  near(setup.capital, sumLedger(setup, 'capital'), 'setup capital');
  near(r.investmentCash, setup.cashSpent, 'row purchase cash'); near(r.capital, setup.capital, 'row capital');
  near(r.initialUnspentCash, setup.remainingCash, 'retained cash');
  const stage = r.routeId.split('/')[1] as keyof typeof STYLE_BUDGETS;
  near(r.budget, STYLE_BUDGETS[stage], 'declared stage funding'); near(setup.budget, r.budget, 'setup funding');
  near(r.investmentCash + r.initialUnspentCash, r.budget, 'funding allocation');
  near(setup.stockReserve, .12 * r.budget, 'working reserve');
  if (r.initialUnspentCash + 1e-6 < setup.stockReserve) throw new Error('Insufficient starting reserve');
  near(r.assets.total, r.assets.cash + r.assets.pantry + r.assets.care + r.assets.promotion, 'total liquid assets');
  near(r.netLiquidProfit, r.assets.total - r.budget, 'net liquid profit');
  near(r.cashProfit, r.assets.cash - r.budget, 'cash profit');
  near(r.operatingProfit, r.revenue - r.ingredientExpense - r.careExpense - r.promotionExpense, 'operating profit');
  near(r.netLiquidProfit, r.operatingProfit - r.capital, 'net profit versus capital');
  near(r.spending.totalCashOut, r.investmentCash + r.spending.ingredientsPurchased + r.spending.promotionsPurchased + r.spending.carePurchased, 'total cash spending');
  near(r.assets.cash, r.budget + r.revenue - r.spending.totalCashOut, 'independent cash identity');
  near(r.assets.pantry, r.spending.ingredientsPurchased - r.ingredientExpense, 'pantry supply');
  near(r.assets.promotion, r.spending.promotionsPurchased - r.promotionExpense, 'promotion supply');
  near(r.assets.care, sumLedger(setup, 'prepaidCare') + r.spending.carePurchased - r.careExpense, 'care supply');
  near(r.liveFood.total, r.liveFood.acceptedCost + r.liveFood.kitchenCost + r.liveFood.shelfCost, 'live food');
  if (r.wasteCost + r.liveFood.total > r.ingredientExpense + 1e-4) throw new Error('Waste/live food exceeds ingredient expense');
  if (r.closedStaleCost > r.wasteCost + 1e-4 || r.liveFood.activeOrders > r.terminalLiveCustomers) throw new Error('Invalid waste/live guest subsets');
  near(r.reconciliationError, r.netLiquidProfit - r.operatingProfit + r.capital, 'stored asset residual');
  near(r.cashLedgerError, r.assets.cash - r.budget - r.revenue + r.spending.totalCashOut, 'stored cash residual');
  near(r.missed, r.soldOut + r.queueLost + r.tableLost, 'missed guests');
  near(r.lostIncludingDoor, r.missed + r.doorLost, 'door-inclusive losses');
  near(r.unmetDemand, r.lostIncludingDoor + r.queueRemovedAtClosing, 'closing-inclusive losses');
  near(r.arrivalAttempts, r.served + r.unmetDemand + r.terminalLiveCustomers, 'observed arrivals');
  near(r.lossRate, r.unmetDemand / Math.max(1, r.arrivalAttempts), 'observed loss rate');
  if (r.censored !== (r.paybackSeconds === null) || r.terminalRecovered !== (r.operatingProfit >= r.capital)) throw new Error('Invalid payback indicators');
  if (r.terminalRecovered && r.censored) throw new Error('Recovered investment marked censored');
  if (r.paybackSeconds !== null && (!Number.isFinite(r.paybackSeconds) || r.paybackSeconds <= 0 || r.paybackSeconds > STYLE_SECONDS || Math.abs(r.paybackSeconds / STYLE_DT - Math.round(r.paybackSeconds / STYLE_DT)) > 1e-5)) throw new Error('Invalid payback tick');
  if (r.checkpoints.length !== STYLE_SECONDS / STYLE_OPEN_SECONDS) throw new Error('Incomplete checkpoints');
  r.checkpoints.forEach((cp, i) => {
    if (cp.seconds !== (i + 1) * STYLE_OPEN_SECONDS || !Number.isFinite(cp.operating) || cp.capitalRecovered !== (cp.operating >= r.capital)) throw new Error('Invalid recovery checkpoint');
    near(cp.netLiquid, cp.operating - r.capital, 'checkpoint capital');
    if (cp.capitalRecovered && (r.paybackSeconds === null || cp.seconds < r.paybackSeconds)) throw new Error('Checkpoint precedes claimed first recovery');
  });
  near(r.checkpoints.at(-1)!.operating, r.operatingProfit, 'terminal checkpoint operations');
  near(r.checkpoints.at(-1)!.netLiquid, r.netLiquidProfit, 'terminal checkpoint wealth');
}
function portfolioSignature(setup: any) {
  return JSON.stringify(Object.fromEntries(['budget', 'stockReserve', 'ledger', 'capital', 'cashSpent', 'remainingCash', 'ownership'].map(k => [k, setup[k]])));
}
function load(label: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe label');
  const path = `docs/cafe-styles/results/${label}.json`;
  if (!existsSync(path)) throw new Error(`Completed artifact missing: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as { metadata: any; complete: boolean; batches: Record<string, StyleRow[]> };
}
export function verifyStyleEvidence(finalLabel = 'final-v1', baselineLabel = 'untouched-v4') {
  const final = load(finalLabel), baseline = load(baselineLabel);
  const validate = (data: typeof final, focused: boolean) => {
    if (!data.complete || data.metadata.pilot || data.metadata.baseline !== !focused) throw new Error('Wrong/incomplete experiment kind');
    if (JSON.stringify(data.metadata.seeds) !== JSON.stringify(STYLE_SEEDS)) throw new Error('Expected all 30 preregistered seeds');
    const expected = styleRoutes(focused).map(r => r.id);
    if (data.metadata.version !== STYLE_LAB_VERSION || data.metadata.dt !== STYLE_DT || data.metadata.seconds !== STYLE_SECONDS || data.metadata.openSeconds !== STYLE_OPEN_SECONDS || JSON.stringify(data.metadata.budgets) !== JSON.stringify(STYLE_BUDGETS)) throw new Error('Wrong experiment clock/budgets/version');
    if (JSON.stringify(data.metadata.fullScope) !== JSON.stringify(expected) || JSON.stringify(data.metadata.expectedRoutes) !== JSON.stringify(expected)) throw new Error('Wrong declared scenario scope');
    if (data.metadata.setups.length !== expected.length || new Set(data.metadata.setups.map((s: any) => s.routeId)).size !== expected.length) throw new Error('Missing or duplicate portfolio setups');
    if (Object.keys(data.batches).length !== expected.length || expected.some(id => !data.batches[id])) throw new Error('Incomplete scenario coverage');
    for (const id of expected) {
      const rows = data.batches[id], setup = data.metadata.setups.find((s: any) => s.routeId === id);
      if (!setup || rows.length !== 30 || rows.some((r, i) => r.seed !== STYLE_SEEDS[i] || r.routeId !== id)) throw new Error(`Incomplete seed identity: ${id}`);
      for (const r of rows) validateRow(r, setup);
      if (focused && id.endsWith('/focus')) {
        const plain = data.metadata.setups.find((s: any) => s.routeId === id.replace(/focus$/, 'plain'));
        if (!plain || portfolioSignature(setup) !== portfolioSignature(plain)) throw new Error(`Focus/control portfolio mismatch: ${id}`);
      }
    }
    // This is the strict same-investment panel, not merely the equal-funding claim.
    for (const stage of ['early', 'mid', 'late']) {
      const setups = data.metadata.setups.filter((s: any) => s.routeId.startsWith(`common-assets/${stage}/`));
      const first = setups[0];
      if (setups.some((s: any) => portfolioSignature(s) !== portfolioSignature(first))) throw new Error('Common asset/capital mismatch');
    }
  };
  validate(baseline, false); validate(final, true);
  if (final.metadata.sourceHash !== styleSourceHash()) throw new Error('Final evidence does not match current game source fingerprint');
  if (baseline.metadata.sourceHash !== '5c0d2f7464a95274172b8c62f95083822abb8cc111f04edd41d96643a85bba4e') throw new Error('Wrong untouched baseline fingerprint');
  const currentDesignHash = createHash('sha256').update(readFileSync('scripts/cafe-style-lab.ts')).update(readFileSync('scripts/cafe-style-balance.test.ts')).digest('hex');
  if (final.metadata.designHash !== currentDesignHash || baseline.metadata.designHash !== currentDesignHash) throw new Error('Evidence runner design differs from current harness');
  const finalRoutes = styleRoutes();
  const focusRows = finalRoutes.filter(r => r.focus).map(route => {
    const rows = final.batches[route.id], control = final.batches[route.id.replace(/focus$/, 'plain')];
    const operating = styleStats(rows.map(r => r.operatingProfit));
    const deltas = paired(rows, control);
    return { route, operating, sustainableOperating: operating.ci95Low > 0, deltas,
      capital: rows[0].capital, unspentCash: rows[0].initialUnspentCash,
      payback: { recoveredSeeds: rows.filter(r => !r.censored).length, censoredSeeds: rows.filter(r => r.censored).length, terminalRecoveredSeeds: rows.filter(r => r.terminalRecovered).length, seconds: rows.map(r => r.paybackSeconds) },
      cashConstrainedRestocks: rows.reduce((n, r) => n + r.cashConstrainedRestocks, 0), campaignBookingFailures: rows.reduce((n, r) => n + r.promotionBookingFailures, 0) };
  });
  const commonRoutes = finalRoutes.filter(r => r.focus && r.panel === 'common-assets');
  const betweenRoutes = commonRoutes.flatMap(route => commonRoutes.filter(other => other.stage === route.stage && other.pressure === route.pressure && other.style !== route.style).map(control => ({
    route: route.id, style: route.style, control: control.id, deltas: paired(final.batches[route.id], final.batches[control.id]),
  })));
  const beforeAfterPlain = styleRoutes(false).map(route => ({ route: route.id, deltas: paired(final.batches[route.id], baseline.batches[route.id]) }));
  const styles = STYLE_IDS.map(style => {
    const focusEvidence = focusRows.filter(r => r.route.style === style).flatMap(r => METRICS.filter(metric => r.deltas[metric].favorable).map(metric => ({ scenario: r.route.id, metric, ...r.deltas[metric] })));
    const matchedPortfolioEvidence = betweenRoutes.filter(r => r.style === style).flatMap(r => METRICS.filter(metric => r.deltas[metric].favorable).map(metric => ({ scenario: r.route, control: r.control, metric, ...r.deltas[metric] })));
    return { style, hasFocusAdvantage: focusEvidence.some(e => e.metric !== 'served'), hasSameAssetComparisonAdvantage: matchedPortfolioEvidence.some(e => e.metric !== 'served'), focusEvidence, matchedPortfolioEvidence };
  });
  const reasonableStock = focusRows.filter(r => r.route.panel === 'route-purchases' && r.route.pressure === 'base');
  const report = { complete: true, generatedAt: new Date().toISOString(), verifierHash: createHash('sha256').update(readFileSync('scripts/cafe-style-verify.test.ts')).digest('hex'), finalLabel, baselineLabel, finalSourceHash: final.metadata.sourceHash, baselineSourceHash: baseline.metadata.sourceHash, designHash: final.metadata.designHash,
    seeds: 30, baselineScenarios: 108, finalScenarios: 216,
    interpretation: 'Positive operating profit means sustainable operations during this window; it does not mean capital payback. Favorable cells use a paired mean improvement of at least 1 unit and 1% for money/waste/served, .005 absolute guest loss rate, or .05 stars, with a descriptive paired 95% CI above zero. Scenario selection is exploratory, without multiple-testing correction; no global-optimum claim. Loss rate is observed by cutoff, with pending guests retained in its denominator; a favorable claim additionally must survive the conservative pending-outcome bound. Original observed results and resolved-outcome sensitivity remain visible, including disagreements. Rating is the terminal latest-50-review score. Fewer raw lost guests alone never qualifies. Served throughput is supporting evidence and cannot pass a route alone. Same-asset comparisons use identical investment; focus/plain controls use identical portfolios and menus.',
    allRouteStagesSustainableReasonableStock: reasonableStock.length === 18 && reasonableStock.every(r => r.sustainableOperating && r.cashConstrainedRestocks === 0),
    reasonableStockCells: reasonableStock.map(r => ({ scenario: r.route.id, operating: r.operating, cashConstrainedRestocks: r.cashConstrainedRestocks })),
    allFocusedOperatingPositive: focusRows.every(r => r.sustainableOperating), allStylesHaveFocusAdvantage: styles.every(s => s.hasFocusAdvantage), allStylesHaveSameAssetAdvantage: styles.every(s => s.hasSameAssetComparisonAdvantage),
    focusSensitivityDisagreements: focusRows.flatMap(r => r.deltas.lossRate.observedFavorable && !r.deltas.lossRate.favorable ? [{ scenario: r.route.id, ...r.deltas.lossRate }] : []),
    betweenRouteSensitivityDisagreements: betweenRoutes.filter(r => r.deltas.lossRate.observedFavorable && !r.deltas.lossRate.favorable).map(r => ({ scenario: r.route, control: r.control, ...r.deltas.lossRate })),
    validationLimits: ['Exact first payback crossing is generated at tick level; stored 180-second checkpoints only allow consistency validation.', 'Sold ingredient cost is not retained per row, so exact waste subtraction is trusted to the fingerprinted generator; the reader checks bounds and live-food sums.', 'Care refill spending is inferred from prepaid-care balances and consumption; the total cash identity is independently reconstructed.', 'Between-route favorable means a material advantage over at least one other style in the identical-asset panel, not best or nondominated.'],
    styles, focused: focusRows, betweenRoutes, beforeAfterPlain };
  writeFileSync(`docs/cafe-styles/results/${finalLabel}-acceptance.json`, JSON.stringify(report, null, 2) + '\n');
  return report;
}
it.skipIf(process.env.CAFE_STYLE_VERIFY !== '1')('verifies completed thirty-seed evidence and reports unmet economic acceptance criteria', () => {
  const result = verifyStyleEvidence(process.env.CAFE_STYLE_FINAL_LABEL, process.env.CAFE_STYLE_BASELINE_LABEL);
  expect(result.allRouteStagesSustainableReasonableStock, 'See acceptance artifact for route-stage base cells with nonpositive operations or constrained purchasing').toBe(true);
  expect(result.allFocusedOperatingPositive, 'See acceptance artifact for nonpositive operating cells').toBe(true);
  expect(result.allStylesHaveFocusAdvantage, 'See acceptance artifact for styles lacking a favorable focus/plain cell').toBe(true);
  expect(result.allStylesHaveSameAssetAdvantage, 'See acceptance artifact for styles lacking a favorable common-asset comparison').toBe(true);
});

it('does not credit fewer raw lost guests when only the number of arrivals fell', () => {
  const control = STYLE_SEEDS.map(seed => ({ seed, netLiquidProfit: 100, lossRate: .1, wasteCost: 0, rating: 4, served: 900, unmetDemand: 100, arrivalAttempts: 1000, terminalLiveCustomers: 0, lostIncludingDoor: 100 } as StyleRow));
  const treated = control.map(r => ({ ...r, served: 810, unmetDemand: 90, arrivalAttempts: 900, lostIncludingDoor: 90 }));
  const result = paired(treated, control);
  expect(result.lossRate.favorable).toBe(false); expect(result.lossRate.mean).toBe(0);
  expect(result.wasteCost.favorable).toBe(false);
});
it('requires material paired improvement, preserves seed wins and handles ties', () => {
  const control = STYLE_SEEDS.map(seed => ({ seed, netLiquidProfit: 100, lossRate: .1, wasteCost: 0, rating: 4, served: 900, unmetDemand: 100, arrivalAttempts: 1000, terminalLiveCustomers: 0 } as StyleRow));
  const treated = control.map(r => ({ ...r, netLiquidProfit: 100.5, lossRate: .094, unmetDemand: 94, served: 906 }));
  const result = paired(treated, control);
  expect(result.netLiquidProfit.favorable).toBe(false);
  expect(result.lossRate.favorable).toBe(true); expect(result.lossRate.seedWins).toBe(30);
  expect(result.rating.seedWins).toBe(0);
});

it('retains a favorable observed loss result but rejects advantage caused by pending outcomes', () => {
  const control = STYLE_SEEDS.map(seed => ({ seed, netLiquidProfit: 100, lossRate: .1, wasteCost: 0, rating: 4,
    served: 900, unmetDemand: 100, arrivalAttempts: 1000, terminalLiveCustomers: 0 } as StyleRow));
  const treated = control.map(r => ({ ...r, served: 900, unmetDemand: 94, lossRate: .094, terminalLiveCustomers: 6 }));
  const result = paired(treated, control).lossRate;
  expect(result.observedFavorable).toBe(true); expect(result.favorable).toBe(false);
  expect(result.censoringSensitivity!.conservativeImprovement.mean).toBeCloseTo(0);
});
function accountingFixture() {
  const setup = { budget: 1800, stockReserve: 216, remainingCash: 800, cashSpent: 1000, capital: 980,
    ledger: [{ cash: 1000, capital: 980, prepaidCare: 20 }] };
  const row = { routeId: 'common-assets/early/base/coffee/plain', seed: STYLE_SEEDS[0], seconds: STYLE_SECONDS,
    openSeconds: 1700, closingSeconds: 100, budget: 1800, capital: 980, investmentCash: 1000, initialUnspentCash: 800,
    assets: { cash: 1000, pantry: 100, care: 10, promotion: 10, total: 1120 }, cashProfit: -800, netLiquidProfit: -680,
    revenue: 500, ingredientExpense: 150, careExpense: 30, promotionExpense: 20, operatingProfit: 300,
    spending: { ingredientsPurchased: 250, carePurchased: 20, promotionsPurchased: 30, totalCashOut: 1300 },
    served: 80, missed: 10, doorLost: 2, queueRemovedAtClosing: 3, unmetDemand: 15, arrivalAttempts: 100, lossRate: .15,
    lostIncludingDoor: 12, terminalLiveCustomers: 5, soldOut: 4, queueLost: 3, tableLost: 3, extraLost: 0,
    completedDays: 8, promotionBookingAttempts: 3, promotionBookingFailures: 0, cashConstrainedRestocks: 0,
    liveFood: { acceptedCost: 3, kitchenCost: 2, shelfCost: 5, total: 10, activeOrders: 5 }, wasteCost: 40, closedStaleCost: 20, rating: 4,
    censored: true, paybackSeconds: null, terminalRecovered: false, reconciliationError: 0, cashLedgerError: 0,
    checkpoints: Array.from({ length: 10 }, (_, i) => ({ seconds: (i + 1) * 180, operating: (i + 1) * 30, netLiquid: (i + 1) * 30 - 980, capitalRecovered: false })) } as StyleRow;
  return { setup, row };
}
it('independently reconstructs assets and counters instead of trusting zero residual fields', () => {
  const valid = accountingFixture(); expect(() => validateRow(valid.row, valid.setup)).not.toThrow();
  const mutations = [
    (r: StyleRow) => { r.assets.cash++; }, (r: StyleRow) => { r.lossRate = .14; },
    (r: StyleRow) => { r.spending.totalCashOut++; }, (r: StyleRow) => { r.missed++; },
    (r: StyleRow) => { r.initialUnspentCash++; }, (r: StyleRow) => { r.checkpoints[0].operating++; },
    (r: StyleRow) => { r.terminalRecovered = true; }, (r: StyleRow) => { r.paybackSeconds = 1800.01; r.censored = false; },
  ];
  for (const mutate of mutations) { const { row, setup } = accountingFixture(); mutate(row); expect(() => validateRow(row, setup)).toThrow(); }
});
