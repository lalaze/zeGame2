// Compare completed, matched experiment artifacts; never silently compare different designs.
import { readFileSync, writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const root = 'docs/long-task/results';
const [beforeLabel = 'baseline', afterLabel = 'balanced'] = process.argv.slice(2);
for (const label of [beforeLabel, afterLabel]) assert(/^[\w-]+$/.test(label), 'Unsafe result label');
const read = (label) => JSON.parse(readFileSync(`${root}/${label}.json`, 'utf8'));
const before = read(beforeLabel), after = read(afterLabel);
assert(before.complete && after.complete, 'Both experiments must have reached a complete terminal checkpoint');
for (const field of ['designVersion', 'designHash', 'seeds', 'days', 'openSeconds', 'dt', 'fixtures'])
  assert.deepEqual(before.metadata[field], after.metadata[field], `Mismatched experiment field: ${field}`);
assert(before.metadata.seeds.length >= 30);
assert.equal(before.metadata.dt, 0.05, 'Authoritative results must use the real simulation timestep');
const ids = Object.keys(before.batches).sort();
assert.deepEqual(ids, Object.keys(after.batches).sort(), 'Scenario sets differ');
function summary(values) {
  assert(values.every(Number.isFinite));
  const n = values.length, mean = values.reduce((a,b) => a+b, 0) / n;
  const sd = Math.sqrt(values.reduce((s,x) => s + (x-mean)**2, 0) / (n-1));
  // All current comparisons have n=30, with 29 degrees of freedom.
  const critical = n === 30 ? 2.04523 : 1.96;
  return { n, mean, sd, ci95Low: mean-critical*sd/Math.sqrt(n), ci95High: mean+critical*sd/Math.sqrt(n), interval: n===30 ? 'paired Student t, df29; unadjusted for multiple comparisons' : 'paired normal approximation; unadjusted for multiple comparisons' };
}
function metrics(row) {
  const last = row.daily.at(-1);
  assert.equal(row.daily.length, before.metadata.days);
  for (const day of row.daily) {
    assert.equal(day.openSeconds, before.metadata.openSeconds);
    assert(!day.closingTimedOut, 'Closing service did not finish');
    assert(Math.abs(day.reconciliationError)<1e-5, 'Unreconciled ledger');
    assert(day.assets.cash>=-1e-7 && day.assets.inventory>=-1e-7);
  }
  return {
    operatingProfit: last.cumulativeOperatingProfit,
    netLiquidProfit: last.netLiquidProfit,
    cashProfit: last.cashProfit,
    elapsedGameSeconds: row.daily.reduce((s,d) => s+d.openSeconds+d.closingSeconds, 0),
    netLiquidPerElapsedHour: last.netLiquidProfit / row.daily.reduce((s,d) => s+d.openSeconds+d.closingSeconds, 0) * 3600,
    lostCustomers: row.daily.reduce((s,d) => s+d.lostIncludingDoor, 0),
    closingQueueDismissals: row.daily.reduce((s,d) => s+d.queuedAtClosing, 0),
    wasteCost: row.daily.reduce((s,d) => s+d.wasteCost, 0),
    endingRating: last.report.rating,
    served: row.daily.reduce((s,d) => s+d.report.served, 0),
  };
}
const scenarios = ids.map(id => {
  const b = before.batches[id], a = after.batches[id];
  assert.equal(b.length,before.metadata.seeds.length); assert.equal(a.length,b.length);
  assert.deepEqual(b.map(r=>r.seed).sort((a,b)=>a-b), [...before.metadata.seeds].sort((a,b)=>a-b));
  assert.deepEqual(a.map(r=>r.seed).sort((a,b)=>a-b), [...before.metadata.seeds].sort((a,b)=>a-b));
  const pairs = b.map(row => {
    const other = a.find(r=>r.seed===row.seed);
    assert.deepEqual(row.starting,other.starting, `Different starting wealth in ${id}`);
    assert.deepEqual(row.investment,other.investment, `Different intervention spending in ${id}`);
    return { seed: row.seed, before: metrics(row), after: metrics(other) };
  });
  const fields = Object.keys(pairs[0].before);
  const compared = Object.fromEntries(fields.map(field => [field, {
    before: summary(pairs.map(p=>p.before[field])), after: summary(pairs.map(p=>p.after[field])),
    delta: summary(pairs.map(p=>p.after[field]-p.before[field])),
  }]));
  return { id, changed: fields.some(f=>pairs.some(p=>Math.abs(p.after[f]-p.before[f])>1e-7)), metrics:compared, raw:pairs };
});
const result = {
  before: beforeLabel, after: afterLabel, designHash: before.metadata.designHash,
  sourceFingerprints: { before: before.metadata.fingerprint, after: after.metadata.fingerprint },
  scenarios: scenarios.length, seedsPerScenario: before.metadata.seeds.length, daysPerSeed: before.metadata.days,
  changedScenarios: scenarios.filter(s=>s.changed).length, unchangedScenarios: scenarios.filter(s=>!s.changed).length,
  comparisons: scenarios,
};
writeFileSync(`${root}/comparison.json`,JSON.stringify(result,null,2)+'\n');
console.log(`Validated ${result.scenarios} matched scenarios × ${result.seedsPerScenario} seeds × ${result.daysPerSeed} days; ${result.changedScenarios} changed, ${result.unchangedScenarios} unchanged.`);
for (const row of scenarios.filter(s=>s.changed)) console.log(`${row.id}: net-liquid Δ${row.metrics.netLiquidProfit.delta.mean.toFixed(2)}, served Δ${row.metrics.served.delta.mean.toFixed(2)}, waste Δ${row.metrics.wasteCost.delta.mean.toFixed(2)}`);
