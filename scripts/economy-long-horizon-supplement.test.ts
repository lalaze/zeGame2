/** Independent, resumable 30-day extension; leaves the shared eight-day runner unchanged. */
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { distribution, DT, fixtureInfo, OPEN_SECONDS, pairPayback, sample, scenarios, SEEDS, type Sample, type Scenario } from './economy-lab';
const DAYS = 30;
const base = scenarios().find(s => s.id === 'early/initial/espresso-ten')!;
const defs: Scenario[] = [
  { ...base, pairId: base.id },
  { ...base, id: `${base.id}-cat`, pairId: base.id, cat: true },
  { ...base, id: `${base.id}-noteLocal`, pairId: base.id, promotion: 'noteLocal' },
  { ...base, id: `${base.id}-cat-noteLocal`, pairId: base.id, cat: true, promotion: 'noteLocal' },
];
type Batches = Record<string, Sample[]>;
function pair(treated: Sample, control: Sample) {
  const usual = pairPayback(treated, control);
  const netByDay = treated.daily.map((d, i) => d.netLiquidProfit - control.daily[i].netLiquidProfit);
  const firstPositive = netByDay.findIndex(x => x > 1e-7);
  const sustained = netByDay.findIndex((x, i) => x > 1e-7 && netByDay.slice(i).every(v => v > 1e-7));
  return { ...usual, netByDay, firstPositiveDay: firstPositive < 0 ? null : firstPositive + 1,
    sustainedPositiveThroughDay30From: sustained < 0 ? null : sustained + 1, terminalPositive: netByDay.at(-1)! > 1e-7 };
}
function summarize(batches: Batches) {
  return defs.filter(s => batches[s.id]?.length === SEEDS.length).map(scenario => {
    const rows = batches[scenario.id], last = rows.map(r => r.daily.at(-1)!);
    const controls = batches[scenario.pairId];
    const pairs = controls?.length === SEEDS.length && scenario.id !== scenario.pairId
      ? rows.map(r => pair(r, controls.find(c => c.seed === r.seed)!)) : [];
    const total = (f: (d: Sample['daily'][number]) => number) => distribution(rows.map(r => r.daily.reduce((sum, d) => sum + f(d), 0)));
    return { scenario, operating: distribution(last.map(d => d.cumulativeOperatingProfit)), netLiquid: distribution(last.map(d => d.netLiquidProfit)),
      lost: total(d => d.lostIncludingDoor), waste: total(d => d.wasteCost), served: total(d => d.report.served), rating: distribution(last.map(d => d.report.rating)),
      careExpense: total(d => d.report.petCost), promotionExpense: total(d => d.report.promotionCost),
      closingTimeouts: rows.reduce((sum, r) => sum + r.daily.filter(d => d.closingTimedOut).length, 0),
      paired: { capital: pairs[0]?.capital ?? 0, firstCapitalRecoveryCount: pairs.filter(p => p.paybackDay !== null).length,
        censoredCapitalCount: pairs.filter(p => p.censored).length, terminalPositiveCount: pairs.filter(p => p.terminalPositive).length,
        recoveredThenLostCount: pairs.filter(p => p.paybackDay !== null && !p.terminalPositive).length,
        netAdvantage: pairs.length ? distribution(pairs.map(p => p.incrementalNetLiquidProfit)) : null, raw: pairs },
      daily: Array.from({ length: DAYS }, (_, i) => ({ day: i + 1, operating: distribution(rows.map(r => r.daily[i].report.profit)),
        rating: distribution(rows.map(r => r.daily[i].report.rating)), netLiquid: distribution(rows.map(r => r.daily[i].netLiquidProfit)) })) };
  });
}
function report(summary: ReturnType<typeof summarize>, metadata: unknown) {
  const f = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const ci = (d: ReturnType<typeof distribution>) => `${f(d.mean)} [${f(d.ci95Low)}, ${f(d.ci95High)}]`;
  const range = (v: (number | null)[]) => { const x = v.filter((n): n is number => n !== null); return x.length ? `${Math.min(...x)}–${Math.max(...x)}` : 'None'; };
  const lines = ['# Thirty-day upgraded-espresso attraction supplement', '', '## Scope and accounting', '',
    'This extends four upgraded-espresso fixed policies to 30 days with 30 predetermined seeds each (3,600 cafe-days). It uses the actual shared sample implementation, 0.05-second Sim steps, 180 seconds open per day, and accepted-service drain capped at 300 seconds. These are thirty-day observations, not infinite-horizon optimality or a reinvestment strategy study.', '',
    'All four scenarios start from the same early fixture, pay for ten espresso upgrades, and sell espresso only. The control buys those upgrades without attraction spending; interventions add ginger, renewed noteLocal, or both. Pairing against the upgraded control isolates attraction on a fast, high-margin product. Exact common fixtures and their capital valuation are in result metadata. No additional staff, kitchen, or marketing is endowed beyond the early fixture.', '',
    'All intervention costs are charged by actual game functions. Ginger adoption includes care: adoption cash is split into non-refundable capital and prepaid care. Care used and promotion airtime used are operating expenses. Promotions renew in preparation when expired; noteLocal spans two 180-second open days. Ingredients are forecast-restocked subject to cash; residual pantry and prepaid care/promotion remain in liquid wealth. No click income, reward claims, debt, revenue injection, rescue financing, or reinvestment is added.', '',
    'Net-liquid profit is final cash plus inventory/prepayments at cost minus starting liquid wealth. It equals cumulative operating profit minus intervention capital; every simulated day is checked by the imported runner. Capital has no assumed resale value. Formula-based mean confidence intervals are descriptive normal approximations (mean ±1.96×sample SD/√30), not simultaneous tests; raw seed results and SDs remain available. Near-zero count intervals can extend below zero without implying negative observed losses.', '',
    'Same predetermined seed labels are paired across strategies; different event paths do not imply customer-identical random draws. A first payback crossing can reverse later. We separately report terminal positive net advantage and the first day from which advantage stays positive through observed day30. This is bounded persistence through the observation window, not a guarantee about subsequent days.', '',
    '## Thirty-day outcomes', '', '| Scenario | Operating profit [95% CI] | Net-liquid profit [95% CI] | Lost customers [95% CI] | Waste cost [95% CI] | Final rating [95% CI] |', '|---|---:|---:|---:|---:|---:|'];
  for (const r of summary) lines.push(`| ${r.scenario.id} | ${ci(r.operating)} | ${ci(r.netLiquid)} | ${ci(r.lost)} | ${ci(r.waste)} | ${ci(r.rating)} |`);
  lines.push('', '## Paired intervention versus same-stage hold', '', 'Capital payback is the first cumulative incremental operating profit covering incremental capital. Pure promotion has no capital, so capital payback/censoring is not applicable; its expense is already deducted from operating profit. Every terminal advantage includes all charged adoption, consumed care, and consumed promotion costs.', '', '| Scenario | Terminal net advantage [95% CI] | First capital recovery /30 | Capital censored /30 | First recovery days | Positive at day30 /30 | Recovered then nonpositive /30 | Sustained-positive start days (through day30 only) |', '|---|---:|---:|---:|---|---:|---:|---|');
  for (const r of summary.filter(r => r.paired.netAdvantage)) {
    const p = r.paired, capital = p.capital > 0;
    lines.push(`| ${r.scenario.id} | ${ci(p.netAdvantage!)} | ${capital ? p.firstCapitalRecoveryCount : 'N/A'} | ${capital ? p.censoredCapitalCount : 'N/A'} | ${capital ? range(p.raw.map(x => x.paybackDay)) : 'N/A'} | ${p.terminalPositiveCount} | ${capital ? p.recoveredThenLostCount : 'N/A'} | ${range(p.raw.map(x => x.sustainedPositiveThroughDay30From))} |`);
  }
  lines.push('', '## Reproducibility and limitations', '',
    'Run `ECONOMY_LONG_HORIZON_SUPPLEMENT=1 npx vitest run scripts/economy-long-horizon-supplement.test.ts --silent=false --disableConsoleIntercept`. Atomic, resumable batches are saved in `results/economy-long-horizon-supplement.json`; an interrupted file remains `complete:false`. SHA-256 fingerprints cover gameplay and both shared and extension runners. A fingerprint mismatch refuses to resume; archive the old dataset rather than mixing code versions. Partial seed batches resume safely. Ordinary tests only validate the design.', '',
    'No spending/traffic policy is optimized here. Fixed single-drink fixtures are intentionally narrow; bakery dynamics, all-menu complexity, huge-budget progression, subjective cosmetic value, and dynamic upgrade decisions require other evidence. A negative intervention advantage does not mean the cafe as a whole loses money. These results should inform choices, not flatten distinct strategies or imply that all cats/promotions have identical returns.', '', 'Metadata:', '', '```json', JSON.stringify(metadata, null, 2), '```');
  writeFileSync('docs/long-task/LONG-HORIZON-SUPPLEMENT.md', lines.join('\n') + '\n');
}
it('uses four comparable upgraded-espresso scenarios, 30 seeds, and real 0.05-step duration', () => {
  expect(defs).toHaveLength(4); expect(new Set(defs.map(s => s.id)).size).toBe(4);
  expect(SEEDS).toHaveLength(30); expect(DT).toBe(.05); expect(OPEN_SECONDS).toBe(180);
  for (const s of defs) expect(s.menu).toEqual(defs.find(x => x.id === s.pairId)!.menu);
});
it.skipIf(process.env.ECONOMY_LONG_HORIZON_SUPPLEMENT !== '1')('runs and checkpoints the thirty-day intervention study', () => {
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  const gameFingerprint = hash(readdirSync('src/game').filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort().map(f => `${f}\n${readFileSync(`src/game/${f}`, 'utf8')}`).join('\n'));
  const runnerFingerprint = hash(readFileSync('scripts/economy-long-horizon-supplement.test.ts', 'utf8'));
  const sharedRunnerFingerprint = hash(readFileSync('scripts/economy-lab.ts', 'utf8'));
  const metadata = { gameFingerprint, runnerFingerprint, sharedRunnerFingerprint, seeds: SEEDS, expectedSeedCountPerScenario: SEEDS.length, days: DAYS, dt: DT, openSeconds: OPEN_SECONDS,
    fixtures: (['early'] as const).map(fixtureInfo) };
  const path = 'docs/long-task/results/economy-long-horizon-supplement.json'; mkdirSync('docs/long-task/results', { recursive: true });
  let batches: Batches = {};
  if (existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of ['gameFingerprint', 'runnerFingerprint', 'sharedRunnerFingerprint'] as const) expect(saved.metadata[key], `Refusing resume: ${key} changed`).toBe(metadata[key]);
    batches = saved.batches;
  }
  const valid = (r: Sample, seed: number) => r.seed === seed && r.daily.length === DAYS && r.daily.every((d, i) => d.day === i + 1 && !d.closingTimedOut && Math.abs(d.reconciliationError) < 1e-5);
  const save = () => {
    const completedScenarioCount = defs.filter(d => batches[d.id]?.length === SEEDS.length && batches[d.id].every((r, i) => valid(r, SEEDS[i]))).length;
    const complete = completedScenarioCount === defs.length;
    const summary = summarize(batches);
    writeFileSync(`${path}.tmp`, JSON.stringify({ complete, expectedScenarioCount: defs.length, completedScenarioCount, metadata, summary, batches }) + '\n'); renameSync(`${path}.tmp`, path);
    if (complete) report(summary, metadata);
  };
  save();
  for (const def of defs) {
    const rows = batches[def.id] ??= [];
    expect(rows.every((r, i) => valid(r, SEEDS[i])), `Invalid saved batch ${def.id}`).toBe(true);
    const started = Date.now();
    for (let index = rows.length; index < SEEDS.length; index++) {
      rows.push(sample(def, SEEDS[index], DAYS, DT));
      if (rows.length % 5 === 0) { save(); console.log(`${def.id}: ${rows.length}/${SEEDS.length} seeds, ${((Date.now() - started) / 1000).toFixed(1)}s`); }
    }
    save();
    const r = summarize(batches).find(r => r.scenario.id === def.id)!;
    console.log(JSON.stringify({ scenario: def.id, operating: r.operating, netLiquid: r.netLiquid, pairedNetAdvantage: r.paired.netAdvantage, capitalRecovered: r.paired.firstCapitalRecoveryCount, capitalCensored: r.paired.censoredCapitalCount, terminalPositive: r.paired.terminalPositiveCount }));
  }
  expect(defs.every(d => batches[d.id].length === SEEDS.length)).toBe(true);
}, 7_200_000);
