// Compares 20 seeds of TS Sim vs Godot B0 GDScript Sim under the identical Day 1 starter config.
// Skipped during normal `npm test`; run with: GODOT_BASELINE=1 npx vitest run scripts/godot-baseline.test.ts
// or `npm run godot:baseline`.
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from '../src/game/data';
import { openShop } from '../src/game/day';
import { Sim } from '../src/game/sim';
import { createInitialState } from '../src/game/state';

const ENABLED = process.env.GODOT_BASELINE === '1';
const ROOT = resolve(import.meta.dirname, '..');
const GODOT_DIR = join(ROOT, 'godot');
const GODOT_BIN = process.env.GODOT_BIN || '/opt/homebrew/bin/godot';
const SEEDS = 20;
const SIM_STEP = 0.05;

function runTsBaseline(seedCount: number) {
  const runs: { seed: number; served: number; revenue: number }[] = [];
  for (let seed = 1; seed <= seedCount; seed++) {
    let n = seed;
    const state = createInitialState(0);
    openShop(state);
    const sim = new Sim(() => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 2 ** 32;
    });
    let ticks = 0;
    while (state.phase !== 'prep' && ticks < 12000) {
      sim.update(state, SIM_STEP);
      if (state.phase === 'closing' && sim.finishedService) {
        const rep = sim.closeShop(state)!;
        runs.push({ seed, served: rep.served, revenue: Math.round(rep.revenue * 100) / 100 });
        break;
      }
      ticks++;
    }
    if (state.phase !== 'prep') {
      const rep = sim.closeShop(state)!;
      runs.push({ seed, served: rep.served, revenue: Math.round(rep.revenue * 100) / 100 });
    }
  }
  const servedMean = runs.reduce((s, r) => s + r.served, 0) / runs.length;
  const revenueMean = runs.reduce((s, r) => s + r.revenue, 0) / runs.length;
  return {
    seeds: seedCount,
    daySeconds: DAY_SECONDS,
    servedMean: Math.round(servedMean * 100) / 100,
    revenueMean: Math.round(revenueMean * 100) / 100,
    runs,
  };
}

function runGodotBaseline(seedCount: number) {
  const res = spawnSync(
    GODOT_BIN,
    ['--headless', '--path', GODOT_DIR, '--script', 'res://tests/run_baseline.gd', '--', `--seeds=${seedCount}`],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (res.status !== 0) {
    throw new Error(`Godot baseline failed (exit ${res.status}):\n${res.stdout}\n${res.stderr}`);
  }
  const line = res.stdout.split('\n').find((l) => l.startsWith('BASELINE_JSON:'));
  if (!line) {
    throw new Error(`Missing BASELINE_JSON in output:\n${res.stdout}\n${res.stderr}`);
  }
  return JSON.parse(line.slice('BASELINE_JSON:'.length)) as {
    seeds: number;
    servedMean: number;
    revenueMean: number;
    runs: { seed: number; served: number; revenue: number }[];
  };
}

describe.skipIf(!ENABLED)('Godot B0 vs TS Sim 20-seed Day 1 baseline', () => {
  it('matches served count and revenue means within 10%', () => {
    const ts = runTsBaseline(SEEDS);
    const gd = runGodotBaseline(SEEDS);

    const servedDiffPct = Math.abs(gd.servedMean - ts.servedMean) / Math.max(1, ts.servedMean) * 100;
    const revenueDiffPct = Math.abs(gd.revenueMean - ts.revenueMean) / Math.max(1, ts.revenueMean) * 100;

    console.table([
      { engine: 'TS Sim', seeds: ts.seeds, servedMean: ts.servedMean, revenueMean: ts.revenueMean },
      { engine: 'Godot B0', seeds: gd.seeds, servedMean: gd.servedMean, revenueMean: gd.revenueMean },
      {
        engine: 'Diff %',
        seeds: SEEDS,
        servedMean: `${servedDiffPct.toFixed(2)}%`,
        revenueMean: `${revenueDiffPct.toFixed(2)}%`,
      },
    ]);

    expect(servedDiffPct).toBeLessThanOrEqual(10);
    expect(revenueDiffPct).toBeLessThanOrEqual(10);
  }, 60_000);
});
