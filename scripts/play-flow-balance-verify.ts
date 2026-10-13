/** Independent completeness/accounting/paired-gate reader; never changes gameplay. */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { atomic, designHashes, FLOW_SEEDS, flowScenarios, FLOW_HORIZONS, hash, objectHash, type FlowRow } from './play-flow-balance-lab';
import { styleSourceHash } from './cafe-style-lab';
const directory = 'docs/play-flow/evidence';
export function flowStats(values: number[]) {
  if (!values.length || values.some(x => !Number.isFinite(x))) throw new Error('Invalid metric sample');
  const n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  if (![2, 30].includes(n)) throw new Error('Unregistered sample count');
  const half = (n === 30 ? 2.045229642 : 12.706204736) * sd / Math.sqrt(n);
  return { n, mean, sd, ci95Low: mean - half, ci95High: mean + half, min: Math.min(...values), max: Math.max(...values) };
}
export const metrics = ['operatingProfit', 'lossRate', 'rating', 'served', 'revenue', 'ingredientExpense', 'careExpense', 'promotionExpense',
  'unmetDemand', 'missed', 'doorLost', 'queueRemovedAtClosing', 'terminalLiveCustomers', 'arrivalAttempts', 'resolvedLossRate', 'pendingLostRate',
  'peakQueue', 'meanQueue', 'servedWaitMean', 'servedWaitP95', 'servedWaitMax', 'openSeconds', 'closingSeconds', 'completedDays',
  'wasteCost', 'cashProfit', 'netLiquidProfit', 'cashConstrainedRestocks', 'promotionBookingFailures'] as const;
const near = (a: number, b: number, label: string) => { if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-4) throw new Error(`Accounting mismatch ${label}: ${a} versus ${b}`); };
export function validateFlowRow(r: FlowRow, setup: any) {
  near(r.openSeconds + r.closingSeconds, r.seconds, 'clock');
  if (!FLOW_HORIZONS.includes(r.seconds)) throw new Error('Unregistered horizon');
  if (r.seconds === 180 && (r.openSeconds !== 180 || r.completedDays !== 0 || r.terminalPhase !== 'open')) throw new Error('Primary terminal drain');
  near(r.assets.cash + r.assets.pantry + r.assets.care + r.assets.promotion, r.assets.total, 'asset total');
  near(r.assets.total - r.budget, r.netLiquidProfit, 'net wealth');
  near(r.revenue - r.ingredientExpense - r.careExpense - r.promotionExpense, r.operatingProfit, 'operating profit');
  near(r.netLiquidProfit, r.operatingProfit - r.capital, 'capital/wealth');
  near(r.budget, setup.budget, 'initial budget'); near(r.capital, setup.capital, 'capital');
  near(r.investmentCash, setup.investmentCash, 'investment'); near(r.initialUnspentCash, setup.remainingCash, 'starting retained cash');
  near(r.assets.cash, setup.initialCash + r.revenue - r.spending.totalCashOut, 'cash ledger');
  near(r.assets.cash - setup.initialCash, r.cashProfit, 'cash profit');
  near(r.investmentCash + r.spending.ingredientsPurchased + r.spending.promotionsPurchased + r.spending.carePurchased, r.spending.totalCashOut, 'cash out');
  near(r.missed + r.doorLost + r.queueRemovedAtClosing, r.unmetDemand, 'lost');
  near(r.served + r.unmetDemand + r.terminalLiveCustomers, r.arrivalAttempts, 'arrivals');
  near(r.lossRate, r.unmetDemand / Math.max(1, r.arrivalAttempts), 'loss rate');
  near(r.resolvedLossRate, r.unmetDemand / Math.max(1, r.served + r.unmetDemand), 'resolved loss rate');
  near(r.pendingLostRate, (r.unmetDemand + r.terminalLiveCustomers) / Math.max(1, r.arrivalAttempts), 'pending loss bound');
  near(Object.values(r.phases).reduce((n, p) => n + p.arrivalAttempts, 0), r.arrivalAttempts, 'observed arrivals');
  near(Object.values(r.phases).reduce((n, p) => n + p.openSeconds, 0), r.openSeconds, 'observed open duration');
  near(r.liveFood.acceptedCost + r.liveFood.kitchenCost + r.liveFood.shelfCost, r.liveFood.total, 'live food');
  near(r.reconciliationError, 0, 'generated wealth residual'); near(r.cashLedgerError, 0, 'generated cash residual');
  if (r.wasteCost < 0 || r.liveFood.total < 0 || r.ingredientExpense + 1e-5 < r.wasteCost + r.liveFood.total) throw new Error('Food bounds');
  if (metrics.some(m => !Number.isFinite(r[m])) || r.lossRate < 0 || r.lossRate > 1 || r.rating < 1 || r.rating > 5) throw new Error('Invalid metrics');
}
export function mergeFlowShards(prefix: string, dir = directory) {
  const files = readdirSync(dir).filter(p => p.startsWith(prefix + '-shard') && p.endsWith('.json')).sort();
  if (!files.length) throw new Error('No shard files');
  const parts = files.map(p => JSON.parse(readFileSync(`${dir}/${p}`, 'utf8'))), reference = parts[0].metadata;
  if (parts.length !== reference.shardCount || new Set(parts.map(p => p.metadata.shard)).size !== reference.shardCount) throw new Error('Missing/duplicate shards');
  const batches: Record<string, FlowRow[]> = {};
  for (const part of parts) {
    if (!part.complete) throw new Error('Incomplete shard');
    for (const key of ['sourceHash', 'designHashes', 'fullScope', 'seeds', 'setups', 'pilot', 'shardCount']) if (objectHash(part.metadata[key]) !== objectHash(reference[key])) throw new Error(`Incompatible shards: ${key}`);
    for (const [key, rows] of Object.entries(part.batches) as [string, FlowRow[]][]) {
      if (batches[key] || rows.length !== reference.seeds.length || rows.some((r, i) => r.seed !== reference.seeds[i])) throw new Error('Overlapping/incomplete rows');
      batches[key] = rows;
    }
  }
  if (Object.keys(batches).length !== reference.fullScope.length || reference.fullScope.some((id: string) => !batches[id])) throw new Error('Incomplete scope');
  const metadata = { ...reference, label: prefix, shard: null, expectedScope: reference.fullScope, mergedShards: files };
  atomic(`${dir}/${prefix}.json`, { metadata, complete: true, batches });
  return { cells: Object.keys(batches).length, seeds: reference.seeds.length };
}
export function compareFlowRows(control: FlowRow[], treatment: FlowRow[]) {
  if (control.length !== treatment.length || control.some((r, i) => r.seed !== treatment[i].seed || r.initialStateHash !== treatment[i].initialStateHash)) throw new Error('Unpaired labels/startup state');
  const summaries = Object.fromEntries(metrics.map(metric => [metric, { baseline: flowStats(control.map(r => r[metric])), treatment: flowStats(treatment.map(r => r[metric])),
    delta: flowStats(treatment.map((r, i) => r[metric] - control[i][metric])) }])) as Record<typeof metrics[number], { baseline: ReturnType<typeof flowStats>; treatment: ReturnType<typeof flowStats>; delta: ReturnType<typeof flowStats> }>;
  const profitFraction = summaries.operatingProfit.delta.mean / Math.max(1e-12, Math.abs(summaries.operatingProfit.baseline.mean));
  const flags = [profitFraction < -.05 ? 'profit' : null, summaries.lossRate.delta.mean > .02 ? 'lossRate' : null, summaries.rating.delta.mean < -.1 ? 'rating' : null].filter(Boolean) as string[];
  const pendingSensitivity = {
    bestCaseTreatmentDelta: flowStats(treatment.map((r, i) => r.lossRate - control[i].pendingLostRate)),
    worstCaseTreatmentDelta: flowStats(treatment.map((r, i) => r.pendingLostRate - control[i].lossRate)),
    meaning: 'Sensitivity extremes for unresolved guests, not predicted outcomes. Positive means more treatment losses.' };
  const phases = Object.fromEntries(Object.keys(control[0].phases).map(phase => [phase, Object.fromEntries(['openSeconds', 'admitted', 'doorLost', 'arrivalAttempts', 'baseRateExposure'].map(key => {
    const b = control.map(r => (r.phases as any)[phase][key]), t = treatment.map(r => (r.phases as any)[phase][key]);
    return [key, { baseline: flowStats(b), treatment: flowStats(t), delta: flowStats(t.map((x, i) => x - b[i])) }];
  }))]));
  const terminalFood = Object.fromEntries(['acceptedCost', 'kitchenCost', 'shelfCost', 'total', 'activeOrders'].map(key => {
    const b = control.map(r => (r.liveFood as any)[key]), t = treatment.map(r => (r.liveFood as any)[key]);
    return [key, { baseline: flowStats(b), treatment: flowStats(t), delta: flowStats(t.map((x, i) => x - b[i])) }];
  }));
  return { metrics: summaries, profitFraction, flags, pendingSensitivity, phases, terminalFood };
}
export function verifyFlowEvidence(baselineLabel: string, treatmentLabel: string, dir = directory) {
  const baseline = JSON.parse(readFileSync(`${dir}/${baselineLabel}.json`, 'utf8')), treatment = JSON.parse(readFileSync(`${dir}/${treatmentLabel}.json`, 'utf8'));
  if (!baseline.complete || !treatment.complete) throw new Error('Incomplete evidence');
  for (const key of ['designHashes', 'fullScope', 'seeds', 'setups', 'pilot']) if (objectHash(baseline.metadata[key]) !== objectHash(treatment.metadata[key])) throw new Error(`Different pairing protocol: ${key}`);
  if (objectHash(treatment.metadata.designHashes) !== objectHash(designHashes())) throw new Error('Stale harness evidence');
  if (treatment.metadata.sourceHash !== styleSourceHash()) throw new Error('Stale treatment game source');
  if (!treatment.metadata.pilot) {
    const expectedScope = flowScenarios().flatMap(s => FLOW_HORIZONS.map(h => `${s.id}@${h}`));
    if (objectHash(expectedScope) !== objectHash(treatment.metadata.fullScope) || objectHash(FLOW_SEEDS) !== objectHash(treatment.metadata.seeds)) throw new Error('Unregistered final scope or seeds');
  }
  const cells = treatment.metadata.fullScope.map((id: string) => {
    const b: FlowRow[] = baseline.batches[id], t: FlowRow[] = treatment.batches[id];
    if (!b || !t || b.length !== treatment.metadata.seeds.length || t.length !== b.length || b.some((r, i) => r.seed !== treatment.metadata.seeds[i])) throw new Error('Incomplete batch');
    const setup = treatment.metadata.setups.find((s: any) => s.scenario === t[0].scenarioId);
    for (const row of [...b, ...t]) validateFlowRow(row, setup);
    return { id, ...compareFlowRows(b, t) };
  });
  const report = { complete: true, baselineLabel, treatmentLabel, baselineSourceHash: baseline.metadata.sourceHash, treatmentSourceHash: treatment.metadata.sourceHash,
    designHashes: treatment.metadata.designHashes, verifierHash: hash(readFileSync('scripts/play-flow-balance-verify.ts')), pilot: treatment.metadata.pilot,
    seeds: treatment.metadata.seeds, scenarios: treatment.metadata.setups.length, cells: cells.length, pairedRuns: cells.length * treatment.metadata.seeds.length,
    gates: { operatingProfitFractionBelow: -.05, lossRateDeltaAbove: .02, ratingDeltaBelow: -.1 },
    flags: cells.filter((c: any) => c.flags.length).map((c: any) => ({ id: c.id, flags: c.flags, profitFraction: c.profitFraction, lossRateDelta: c.metrics.lossRate.delta, ratingDelta: c.metrics.rating.delta })),
    allCellsWithinReviewThresholds: cells.every((c: any) => c.flags.length === 0), results: cells,
    interpretation: 'Paired mean differences with descriptive t intervals; all cells shown, no multiplicity-corrected claim. Loss includes closing queue removals; pending outcomes remain censored. Exact elapsed clock includes closing drain; no terminal future revenue. Shared seeds are not event-aligned customers.' };
  writeFileSync(`${dir}/${treatmentLabel}-comparison.json`, JSON.stringify(report, null, 2) + '\n');
  const fmt = (n: number, digits = 2) => n.toFixed(digits);
  const lines = [`# Traffic economic comparison: ${treatmentLabel}`, '', `${report.scenarios} scenarios × 2 horizons × ${report.seeds.length} paired seeds = ${report.pairedRuns} paired observations. ${report.flags.length} cells cross a pre-registered review threshold.`, '',
    `Baseline game hash: ${report.baselineSourceHash}`, `Treatment game hash: ${report.treatmentSourceHash}`, '',
    'Profit percentage uses the absolute baseline mean. Intervals are paired 95% descriptive intervals, not adjusted for multiple comparisons. Rating is the game latest-50 score (neutral padding before 20 reviews). Loss includes closing queue removals; unresolved guests remain in its denominator. Full raw rows and all metrics/phase/pending sensitivities are in JSON.', '',
    '| Scenario @ seconds | Baseline profit | Treatment profit | Profit Δ [95% CI] | Profit Δ% | Lost rate Δ pp [95% CI] | Rating Δ [95% CI] | Flags |',
    '|---|---:|---:|---:|---:|---:|---:|---|'];
  for (const c of cells) {
    const p = c.metrics.operatingProfit, l = c.metrics.lossRate.delta, r = c.metrics.rating.delta;
    lines.push(`| ${c.id} | ${fmt(p.baseline.mean)} | ${fmt(p.treatment.mean)} | ${fmt(p.delta.mean)} [${fmt(p.delta.ci95Low)}, ${fmt(p.delta.ci95High)}] | ${fmt(c.profitFraction * 100)} | ${fmt(l.mean * 100)} [${fmt(l.ci95Low * 100)}, ${fmt(l.ci95High * 100)}] | ${fmt(r.mean, 3)} [${fmt(r.ci95Low, 3)}, ${fmt(r.ci95High, 3)}] | ${c.flags.join(', ') || 'none'} |`);
  }
  writeFileSync(`docs/play-flow/BALANCE-${treatmentLabel}.md`, lines.join('\n') + '\n');
  console.log(JSON.stringify({ treatmentLabel, cells: report.cells, pairedRuns: report.pairedRuns, flags: report.flags }));
  return report;
}
