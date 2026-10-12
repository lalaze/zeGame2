/** Read-only training selection and frozen-edge holdout verification. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { STYLE_DT, STYLE_OPEN_SECONDS, STYLE_SEEDS, STYLE_SECONDS, styleSourceHash, styleStats, type Pressure } from './cafe-style-lab';
import { frontierRoutes, frontierDesignHash, HOLDOUT_SEEDS, UNION, type FrontierRoute, type FrontierRow as StyleRow } from './cafe-style-frontier-lab';
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
  near(r.budget, UNION.funding, 'declared union funding'); near(setup.budget, r.budget, 'setup funding');
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

const PRIMARY: Metric[] = ['netLiquidProfit', 'lossRate', 'wasteCost', 'rating'];
const COST_PRIORITY: Metric[] = ['lossRate', 'wasteCost', 'rating', 'netLiquidProfit'];
const equivalent = (a: StyleRow[], b: StyleRow[]) => a.every((r, i) => PRIMARY.every(m => Math.abs(r[m] - b[i][m]) <= 1e-8));
function requirePhaseScope(pressures: string[], phase: 'training' | 'holdout' | 'pressure') {
  if (JSON.stringify(pressures) !== JSON.stringify(phase === 'pressure' ? ['feature', 'rush'] : ['base'])) throw new Error('Wrong training/holdout/pressure regression scope');
}
function requireFrozenSelection(selection: any, expected: any, sourceHash: string, designHash: string, hash: string) {
  if (!selection || selection.sourceHash !== sourceHash || selection.designHash !== designHash || selection.readerHash !== hash || JSON.stringify(selection) !== JSON.stringify(expected)) throw new Error('Missing, changed or incomplete frozen training selection');
}
function loadEvidence(label: string, cohort: 'training' | 'holdout') {
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe evidence label');
  const inheritedHarnessHash = createHash('sha256').update(readFileSync('scripts/cafe-style-lab.ts')).update(readFileSync('scripts/cafe-style-balance.test.ts')).digest('hex');
  if (inheritedHarnessHash !== '547d41cd492f63746f333ce8c70612bdbd3bed17d79aa1852a5c2dfb14387b1e') throw new Error('Original inherited accounting harness changed');
  const data = JSON.parse(readFileSync(`docs/cafe-styles/results/${label}.json`, 'utf8')) as { metadata: any; complete: boolean; batches: Record<string, StyleRow[]> };
  const expectedSeeds = cohort === 'training' ? STYLE_SEEDS : HOLDOUT_SEEDS;
  if (!data.complete || data.metadata.cohort !== cohort || data.metadata.sourceHash !== styleSourceHash() || data.metadata.sourceHash !== UNION.gameSourceHash || data.metadata.designHash !== frontierDesignHash()) throw new Error('Incomplete/stale frontier source or design');
  if (JSON.stringify(data.metadata.seeds) !== JSON.stringify(expectedSeeds) || data.metadata.seconds !== STYLE_SECONDS || data.metadata.dt !== STYLE_DT) throw new Error('Wrong frontier seeds/clock');
  if (!Array.isArray(data.metadata.pressures) || !data.metadata.pressures.length || data.metadata.pressures.some((p: string) => !['base', 'feature', 'rush'].includes(p)) || new Set(data.metadata.pressures).size !== data.metadata.pressures.length) throw new Error('Invalid frontier pressure scope');
  const routes = frontierRoutes(data.metadata.pressures), ids = routes.map(r => r.id);
  if (JSON.stringify(ids) !== JSON.stringify(data.metadata.fullScope) || JSON.stringify(ids) !== JSON.stringify(data.metadata.expectedRoutes) || Object.keys(data.batches).length !== ids.length || data.metadata.setups.length !== ids.length || new Set(data.metadata.setups.map((s: any) => s.routeId)).size !== ids.length) throw new Error('Incomplete frontier scope');
  const first = data.metadata.setups[0];
  for (const id of ids) {
    const setup = data.metadata.setups.find((s: any) => s.routeId === id), rows = data.batches[id];
    if (!setup || portfolioSignature(setup) !== portfolioSignature(first)) throw new Error('Unequal frontier investment/ownership/progress');
    near(setup.cashSpent, UNION.expectedPurchaseCash, 'independent union cost');
    if (!rows || rows.length !== 30 || rows.some((r, i) => r.routeId !== id || r.seed !== expectedSeeds[i])) throw new Error('Wrong frontier row identity');
    for (const row of rows) validateRow(row, setup);
  }
  return { ...data, routes };
}
function comparePolicy(treated: FrontierRoute, control: FrontierRoute, batches: Record<string, StyleRow[]>) {
  const deltas = paired(batches[treated.id], batches[control.id]);
  const favorable = PRIMARY.filter(m => deltas[m].favorable), equal = equivalent(batches[treated.id], batches[control.id]);
  return { control: control.id, style: control.style, menu: control.menu, deltas, equivalent: equal, frozenMetric: favorable[0] ?? null, favorable };
}
function strongest(edges: ReturnType<typeof comparePolicy>[], metric: Metric, batches: Record<string, StyleRow[]>) {
  return [...edges].sort((a, b) => direction[metric] * (styleStats(batches[b.control].map(r => r[metric])).mean - styleStats(batches[a.control].map(r => r[metric])).mean) || a.control.localeCompare(b.control))[0];
}
export function chooseGardenCandidate(routes: FrontierRoute[], batches: Record<string, StyleRow[]>) {
  const candidates = routes.filter(r => r.style === 'garden').map(route => {
    const plain = routes.find(r => r.menu === route.menu && r.pressure === route.pressure && r.style === null)!;
    const ownPlain = comparePolicy(route, plain, batches);
    const comparisons = routes.filter(r => r.id !== route.id).map(control => comparePolicy(route, control, batches));
    const otherFocus = comparisons.filter(c => c.style !== null && c.style !== 'garden');
    let headline: { comparator: string; metric: Metric } | null = null;
    for (const metric of PRIMARY) {
      const edges = otherFocus.filter(c => c.deltas[metric].favorable);
      if (edges.length) { headline = { comparator: strongest(edges, metric, batches).control, metric }; break; }
    }
    const costs = routes.filter(r => r.style !== null && r.style !== 'garden').map(control => ({ control: control.id, style: control.style, menu: control.menu, deltas: paired(batches[control.id], batches[route.id]), equivalent: false, frozenMetric: null, favorable: [] as Metric[] }));
    let downside: { comparator: string; metric: Metric } | null = null;
    for (const metric of COST_PRIORITY) {
      const edges = costs.filter(c => c.deltas[metric].favorable);
      if (edges.length) { downside = { comparator: strongest(edges, metric, batches).control, metric }; break; }
    }
    const operational = styleStats(batches[route.id].map(r => r.operatingProfit));
    const cashConstrainedRestocks = batches[route.id].reduce((n, r) => n + r.cashConstrainedRestocks, 0);
    const qualifies = ownPlain.favorable.length > 0 && comparisons.every(c => c.equivalent || c.favorable.length > 0) && downside !== null;
    return { route, qualifies, ownPlain, comparisons, costs, headline, downside, operational, cashConstrainedRestocks,
      meanNet: styleStats(batches[route.id].map(r => r.netLiquidProfit)).mean,
      unresolvedComparators: comparisons.filter(c => !c.equivalent && !c.favorable.length).map(c => c.control) };
  });
  const selected = candidates.filter(c => c.qualifies).sort((a, b) => b.meanNet - a.meanNet || a.route.menu.localeCompare(b.route.menu))[0] ?? null;
  return { candidates, selected };
}
const readerHash = () => createHash('sha256').update(readFileSync('scripts/cafe-style-frontier-verify.test.ts')).digest('hex');
function frozenCandidate(label: string, data: ReturnType<typeof loadEvidence>, selected: ReturnType<typeof chooseGardenCandidate>['selected']) {
  return selected ? { label, sourceHash: data.metadata.sourceHash, designHash: data.metadata.designHash, readerHash: readerHash(),
    trainingDataHash: createHash('sha256').update(readFileSync(`docs/cafe-styles/results/${label}.json`)).digest('hex'), route: selected.route,
    ownPlain: { comparator: selected.ownPlain.control, metric: selected.ownPlain.frozenMetric }, headline: selected.headline, downside: selected.downside,
    edges: selected.comparisons.map(c => ({ comparator: c.control, metric: c.frozenMetric, equivalent: c.equivalent })) } : null;
}
export function analyzeTraining(label = 'earned-union-v1-training') {
  const data = loadEvidence(label, 'training');
  requirePhaseScope(data.metadata.pressures, 'training');
  const result = chooseGardenCandidate(data.routes, data.batches);
  const report = { phase: 'training', label, generatedAt: new Date().toISOString(), sourceHash: data.metadata.sourceHash, designHash: data.metadata.designHash, readerHash: readerHash(), samples: 1050,
    status: result.selected ? 'candidate frozen; independent holdout still required' : 'no qualifying robust garden frontier candidate; do not choose another menu on holdout', ...result };
  writeFileSync(`docs/cafe-styles/results/${label}-analysis.json`, JSON.stringify(report, null, 2) + '\n');
  const frozen = frozenCandidate(label, data, result.selected);
  const selectionPath = `docs/cafe-styles/results/${label}-selection.json`;
  if (existsSync(selectionPath)) {
    const saved = JSON.parse(readFileSync(selectionPath, 'utf8'));
    if (JSON.stringify(saved.frozen) !== JSON.stringify(frozen)) throw new Error('Refusing to replace a changed frozen training selection');
  } else writeFileSync(selectionPath, JSON.stringify({ generatedAt: report.generatedAt, status: report.status, frozen }, null, 2) + '\n');
  return report;
}
export function analyzeHoldout(label = 'earned-union-v1-holdout', trainingLabel = 'earned-union-v1-training', pressureRegression = false) {
  const data = loadEvidence(label, 'holdout');
  requirePhaseScope(data.metadata.pressures, pressureRegression ? 'pressure' : 'holdout');
  const training = loadEvidence(trainingLabel, 'training');
  requirePhaseScope(training.metadata.pressures, 'training');
  const expectedSelection = frozenCandidate(trainingLabel, training, chooseGardenCandidate(training.routes, training.batches).selected);
  const selection = JSON.parse(readFileSync(`docs/cafe-styles/results/${trainingLabel}-selection.json`, 'utf8')).frozen;
  requireFrozenSelection(selection, expectedSelection, data.metadata.sourceHash, data.metadata.designHash, readerHash());
  const groups = (data.metadata.pressures as Pressure[]).map(pressure => {
    const remap = (id: string) => id.replace('/base/', `/${pressure}/`), selectedId = remap(selection.route.id);
    const rows = data.batches[selectedId];
    const ownDeltas = paired(rows, data.batches[remap(selection.ownPlain.comparator)]);
    const ownPlain = { comparator: remap(selection.ownPlain.comparator), metric: selection.ownPlain.metric as Metric, deltas: ownDeltas, pass: ownDeltas[selection.ownPlain.metric as Metric].favorable };
    const edges = selection.edges.map((edge: { comparator: string; metric: Metric | null; equivalent: boolean }) => {
      const comparator = remap(edge.comparator), control = data.batches[comparator], deltas = paired(rows, control);
      return { ...edge, comparator, deltas, pass: edge.equivalent ? equivalent(rows, control) : edge.metric !== null && deltas[edge.metric].favorable };
    });
    const downsideDeltas = paired(data.batches[remap(selection.downside.comparator)], rows);
    const downside = { comparator: remap(selection.downside.comparator), metric: selection.downside.metric as Metric, deltas: downsideDeltas, pass: downsideDeltas[selection.downside.metric as Metric].favorable };
    const operational = styleStats(rows.map(r => r.operatingProfit));
    const cashConstrainedRestocks = rows.reduce((n, r) => n + r.cashConstrainedRestocks, 0);
    return { pressure, selectedId, ownPlain, edges, downside, operational, cashConstrainedRestocks,
      payback: { recovered: rows.filter(r => !r.censored).length, censored: rows.filter(r => r.censored).length, times: rows.map(r => r.paybackSeconds) },
      pass: ownPlain.pass && edges.every((e: { pass: boolean }) => e.pass) && downside.pass,
      sustainableBase: operational.ci95Low > 0 && cashConstrainedRestocks === 0 };
  });
  const report = { phase: 'holdout', label, trainingLabel, generatedAt: new Date().toISOString(), sourceHash: data.metadata.sourceHash, designHash: data.metadata.designHash, readerHash: readerHash(), selection, groups,
    pass: groups.every(g => g.pass), positiveOperations: groups.every(g => g.operational.ci95Low > 0) };
  writeFileSync(`docs/cafe-styles/results/${label}-verification.json`, JSON.stringify(report, null, 2) + '\n');
  return report;
}
it('selects a material garden tradeoff, rejects a dominator, and never credits throughput alone', () => {
  const routes = [
    { id: 'earned-union/late/base/tea/plain', style: null, menu: 'tea', items: ['blacktea'], pressure: 'base' },
    { id: 'earned-union/late/base/tea/garden', style: 'garden', menu: 'tea', items: ['blacktea'], pressure: 'base' },
    { id: 'earned-union/late/base/coffee/takeaway', style: 'takeaway', menu: 'coffee', items: ['espresso'], pressure: 'base' },
  ] as FrontierRoute[];
  const row = (seed: number, netLiquidProfit: number, wasteCost: number) => ({ seed, netLiquidProfit, wasteCost, lossRate: .1, rating: 4.5, served: 900, unmetDemand: 100, arrivalAttempts: 1000, terminalLiveCustomers: 0, operatingProfit: netLiquidProfit + 1000, cashConstrainedRestocks: 0 } as StyleRow);
  const batches = Object.fromEntries(routes.map((r, i) => [r.id, STYLE_SEEDS.map(seed => row(seed, [100, 110, 80][i], i === 2 ? 0 : 10))]));
  expect(chooseGardenCandidate(routes, batches).selected?.route.style).toBe('garden');
  batches[routes[2].id] = STYLE_SEEDS.map(seed => row(seed, 120, 0));
  expect(chooseGardenCandidate(routes, batches).selected).toBeNull();
  batches[routes[1].id] = STYLE_SEEDS.map(seed => ({ ...row(seed, 100, 10), served: 10000 }));
  expect(chooseGardenCandidate(routes, batches).selected).toBeNull();
});
it.skipIf(process.env.FRONTIER_VERIFY !== 'training')('selects and freezes a training candidate under the preregistered rule', () => {
  expect(analyzeTraining(process.env.FRONTIER_VERIFY_LABEL).selected, 'No robust frontier candidate; inspect all preserved training comparisons').not.toBeNull();
});
it.skipIf(!['holdout', 'pressure'].includes(process.env.FRONTIER_VERIFY ?? ''))('verifies every frozen candidate edge on independent seeds and reports pressure regressions', () => {
  const result = analyzeHoldout(process.env.FRONTIER_VERIFY_LABEL, process.env.FRONTIER_TRAINING_LABEL, process.env.FRONTIER_VERIFY === 'pressure');
  expect(result.positiveOperations).toBe(true);
  if (process.env.FRONTIER_VERIFY === 'holdout') { expect(result.pass).toBe(true); expect(result.groups.every(g => g.sustainableBase)).toBe(true); }
});

it('rejects omitted frozen edges, stale reader identity and wrong holdout pressure scope', () => {
  const record = { sourceHash: 'game', designHash: 'design', readerHash: 'reader', edges: [{ comparator: 'all competitors retained', metric: 'rating' }] };
  expect(() => requireFrozenSelection(record, record, 'game', 'design', 'reader')).not.toThrow();
  expect(() => requireFrozenSelection({ ...record, edges: [] }, record, 'game', 'design', 'reader')).toThrow();
  expect(() => requireFrozenSelection(record, record, 'game', 'design', 'changed-reader')).toThrow();
  for (const scope of [[], ['feature'], ['base', 'rush']]) expect(() => requirePhaseScope(scope, 'holdout')).toThrow();
  expect(() => requirePhaseScope(['base'], 'holdout')).not.toThrow();
  expect(() => requirePhaseScope(['feature', 'rush'], 'pressure')).not.toThrow();
});
