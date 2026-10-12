import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const executable = resolve('scripts/compare-economy.mjs');
function artifact() {
  return {
    complete: true,
    metadata: { designVersion: 2, designHash: 'same-design', seeds: Array.from({ length: 30 }, (_, i) => i), days: 8, openSeconds: 180, dt: 0.05, fixtures: [], fingerprint: 'baseline-source' },
    batches: { 'test/control': Array.from({ length: 30 }, (_, seed) => ({
      seed, starting: { cash: 100 }, investment: { capital: 0 }, daily: Array.from({ length: 8 }, (_, day) => ({
        openSeconds: 180, closingSeconds: 0, closingTimedOut: false, reconciliationError: 0, assets: { cash: 100+day, inventory: 0 },
        cumulativeOperatingProfit: day, netLiquidProfit: day, cashProfit: day, lostIncludingDoor: 0,
        queuedAtClosing: 0, wasteCost: 0, report: { rating: 4, served: 1 },
      })),
    })) },
  };
}
function run(mutate = () => {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'cafe-compare-'));
  try {
    const path = join(cwd, 'docs/long-task/results'); mkdirSync(path, { recursive: true });
    const before = artifact(), after = artifact(); after.metadata.fingerprint = 'candidate-source'; mutate(after);
    writeFileSync(join(path, 'baseline.json'), JSON.stringify(before)); writeFileSync(join(path, 'balanced.json'), JSON.stringify(after));
    const result = spawnSync(process.execPath, [executable], { cwd, encoding: 'utf8' });
    return { status: result.status, error: result.stderr, comparison: result.status === 0 ? JSON.parse(readFileSync(join(path, 'comparison.json'), 'utf8')) : null };
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}
it('accepts matched complete experiments from different source versions', () => {
  const result = run(); expect(result.status).toBe(0); expect(result.comparison.unchangedScenarios).toBe(1);
});
it.each([
  ['incomplete result', d => { d.complete = false; }],
  ['different timestep', d => { d.metadata.dt = .1; }],
  ['different design', d => { d.metadata.designHash = 'changed'; }],
  ['unequal starting wealth', d => { d.batches['test/control'][0].starting.cash = 101; }],
  ['different seed', d => { d.batches['test/control'][0].seed = 999; }],
  ['unsettled day', d => { d.batches['test/control'][0].daily[0].closingTimedOut = true; }],
  ['ledger error', d => { d.batches['test/control'][0].daily[0].reconciliationError = 1; }],
])('rejects %s', (_, mutate) => { expect(run(mutate).status).not.toBe(0); });
