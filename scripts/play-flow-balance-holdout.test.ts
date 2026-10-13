import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { atomic, designHashes, FLOW_SEEDS, flowScenarios, objectHash, observedFlowSample, PILOT_SEEDS, setupEvidence, type FlowRow } from './play-flow-balance-lab';
import { styleSourceHash } from './cafe-style-lab';
import { compareFlowRows, validateFlowRow } from './play-flow-balance-verify';
const HOLDOUT_SEEDS = Array.from({ length: 30 }, (_, i) => (0x686f6c64 + i * 2654435761) >>> 0);
const HOLDOUT_IDS = ['route-purchases/early/rush/bakery/focus', 'route-purchases/early/rush/community/focus', 'route-purchases/mid/rush/bakery/focus'];
const scenarios = HOLDOUT_IDS.map(id => flowScenarios().find(s => s.id === id)!);
const scope = scenarios.flatMap(scenario => [180, 1800].map(seconds => ({ scenario, seconds, id: `${scenario.id}@${seconds}` })));
const dir = process.env.PLAY_FLOW_RESULTS_DIR ?? 'docs/play-flow/evidence';
const holdoutHash = () => createHash('sha256').update(readFileSync('scripts/play-flow-balance-holdout.test.ts')).update(readFileSync('docs/play-flow/BALANCE-HOLDOUT.md')).digest('hex');
it('freezes six holdout cells and thirty completely independent labels', () => {
  expect(scope).toHaveLength(6); expect(HOLDOUT_SEEDS).toHaveLength(30);
  expect(new Set(HOLDOUT_SEEDS).size).toBe(30);
  expect(HOLDOUT_SEEDS.some(seed => [...FLOW_SEEDS, ...PILOT_SEEDS].includes(seed))).toBe(false);
});
it.skipIf(!process.env.PLAY_FLOW_HOLDOUT)('runs the independently registered holdout without changing the primary harness', () => {
  const label = process.env.PLAY_FLOW_HOLDOUT!;
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe label');
  const metadata = { label, sourceHash: styleSourceHash(), designHashes: designHashes(), holdoutHash: holdoutHash(),
    seeds: HOLDOUT_SEEDS, fullScope: scope.map(c => c.id), setups: scenarios.map(setupEvidence), generatedAt: new Date().toISOString() };
  const path = `${dir}/${label}.json`;
  let batches: Record<string, FlowRow[]> = {};
  if (existsSync(path)) {
    const old = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of ['sourceHash', 'designHashes', 'holdoutHash', 'seeds', 'fullScope', 'setups'] as const) if (objectHash(metadata[key]) !== objectHash(old.metadata[key])) throw new Error(`Incompatible holdout resume: ${key}`);
    batches = old.batches;
  }
  const save = () => {
    if (styleSourceHash() !== metadata.sourceHash || objectHash(designHashes()) !== objectHash(metadata.designHashes) || holdoutHash() !== metadata.holdoutHash) throw new Error('Holdout source changed');
    atomic(path, { metadata, complete: scope.every(c => batches[c.id]?.length === HOLDOUT_SEEDS.length), batches });
  };
  save();
  for (const cell of scope) {
    const rows = batches[cell.id] ??= [], started = Date.now();
    if (rows.length > 30 || rows.some((r, i) => r.seed !== HOLDOUT_SEEDS[i] || r.routeId !== cell.scenario.id || r.seconds !== cell.seconds)) throw new Error('Invalid holdout rows');
    for (let i = rows.length; i < HOLDOUT_SEEDS.length; i++) { rows.push(observedFlowSample(cell.scenario, HOLDOUT_SEEDS[i], cell.seconds)); if (rows.length % 5 === 0) save(); }
    save(); console.log(`${label}: ${cell.id}: 30/30; ${((Date.now() - started) / 1000).toFixed(2)}s`);
  }
}, 86_400_000);
it.skipIf(!process.env.PLAY_FLOW_HOLDOUT_VERIFY)('compares the separately retained holdout using the same review gates', () => {
  const baselineLabel = process.env.PLAY_FLOW_HOLDOUT_BASELINE!, treatmentLabel = process.env.PLAY_FLOW_HOLDOUT_VERIFY!;
  const b = JSON.parse(readFileSync(`${dir}/${baselineLabel}.json`, 'utf8')), t = JSON.parse(readFileSync(`${dir}/${treatmentLabel}.json`, 'utf8'));
  if (!b.complete || !t.complete) throw new Error('Incomplete holdout');
  for (const key of ['designHashes', 'holdoutHash', 'seeds', 'fullScope', 'setups']) if (objectHash(b.metadata[key]) !== objectHash(t.metadata[key])) throw new Error(`Unpaired holdout: ${key}`);
  if (objectHash(t.metadata.seeds) !== objectHash(HOLDOUT_SEEDS) || objectHash(t.metadata.fullScope) !== objectHash(scope.map(c => c.id)) || t.metadata.holdoutHash !== holdoutHash() || t.metadata.sourceHash !== styleSourceHash()) throw new Error('Unregistered/stale holdout');
  const results = scope.map(cell => {
    const br: FlowRow[] = b.batches[cell.id], tr: FlowRow[] = t.batches[cell.id];
    if (br.length !== 30 || tr.length !== 30 || br.some((r, i) => r.seed !== HOLDOUT_SEEDS[i])) throw new Error('Incomplete seed pairs');
    const setup = t.metadata.setups.find((s: any) => s.scenario === cell.scenario.id);
    for (const r of [...br, ...tr]) validateFlowRow(r, setup);
    return { id: cell.id, ...compareFlowRows(br, tr) };
  });
  const report = { independentHoldout: true, baselineLabel, treatmentLabel, baselineSourceHash: b.metadata.sourceHash, treatmentSourceHash: t.metadata.sourceHash,
    holdoutHash: holdoutHash(), seeds: HOLDOUT_SEEDS, results, flags: results.filter(r => r.flags.length).map(r => ({ id: r.id, flags: r.flags })),
    interpretation: 'Independent replication, not replacement or pooled acceptance. Original primary flags remain retained.' };
  writeFileSync(`${dir}/${treatmentLabel}-comparison.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ holdout: treatmentLabel, flags: report.flags, results: results.map(r => ({ id: r.id, profitFraction: r.profitFraction, loss: r.metrics.lossRate.delta, rating: r.metrics.rating.delta })) }));
});
