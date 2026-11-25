// Checks that the Godot simulation, café moments, cats and operation status (`godot/core/sim.gd`, `moments.gd`,
// `living_cats.gd`, `operations.gd`) go through every 0.05 s step exactly as `src/game` does, for the same seed and
// the same player: whole days of early, middle and late cafés, players who act, rearrange, upgrade, save and reload,
// snapshots of older versions and damaged ones.
// npm run godot:lockstep              everything, and that every branch of those modules was reached
// npm run godot:lockstep -- --quick   a few runs of every kind
// npm run godot:lockstep -- cats-3    the runs whose names start like this
// npm run godot:bench                 how long a step takes in the busiest cafés
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PARITY_DIR, ROOT, bundle } from './godot-parity/bundle.mjs';
import { branchGate } from './godot-parity/gate.mjs';
import { partsOf, record, repeat } from './godot-parity/replay.mjs';
import { background, godot, importProject } from './godot-parity/run.mjs';
import { LOCKSTEP_TRAPS, traps } from './godot-parity/traps.mjs';

const MODULES = ['sim', 'moments', 'living-cats', 'operations'];
const QUICK = 'early-1,mid-1,late-1,actions-1,actions-2,reload-1,cats-1,cats-2,cats-3,edge-1,edge-2,trial-1,resume-1,resume-3,resume-7,torn-1*,torn-2*';
const t0 = Date.now(), args = process.argv.slice(2).filter((a) => a !== '--'), quick = args.includes('--quick'), only = quick ? QUICK : args.join(','), since = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const fail = (reason) => { console.error(reason); process.exit(1); };

importProject();
if (args.includes('--bench')) { // Only the starts of the runs are needed.
  const dir = join(PARITY_DIR, 'bench'), r = await background('node', [await bundle('lockstep'), dir, '0', '1', 'late-1,late-2,late-3,late-4,late-5,late-6,late-7,late-8', '--heads']);
  if (r.status !== 0) fail(r.stderr);
  const b = godot(['--script', 'res://tests/bench_sim.gd', '--', `--dir=${dir}`]);
  console.log(b.stdout.split('\n').filter((l) => l.includes('_BENCH')).join('\n'));
  if (b.status !== 0 || /SCRIPT ERROR/.test(b.stderr + b.stdout)) fail(`Too slow, or not busy enough\n${b.stderr}`);
  const v = godot(['--script', 'res://tests/bench_view.gd']);
  console.log(v.stdout.split('\n').filter((l) => / ms/.test(l)).join('\n'));
  if (v.status !== 0 || /SCRIPT ERROR/.test(v.stderr + v.stdout)) fail(`The building is too slow, or keeps too many nodes\n${v.stderr}`);
  const u = godot(['--script', 'res://tests/bench_ui.gd', '--', '--most=6']);
  console.log(u.stdout.split('\n').filter((l) => / ms/.test(l)).join('\n'));
  if (u.status !== 0 || /SCRIPT ERROR/.test(u.stderr + u.stdout)) fail(`A screen takes too long to keep up\n${u.stderr}`);
  process.exit(0);
}
const gates = await record(await bundle('lockstep'), 'lockstep', only ? [only] : []), dirs = partsOf('lockstep');
const sum = (key) => gates.reduce((n, g) => n + g[key], 0);
if (sum('runs') === 0) fail(`No runs are called ${only}`);
console.log(`${sum('runs')} of ${gates[0].all} runs recorded, ${sum('steps')} steps (${since()})`);
if (!only) {
  const allow = JSON.parse(readFileSync(join(ROOT, 'scripts/godot-parity/allow.json'), 'utf8')), called = new Set(gates.flatMap((g) => g.called));
  const problems = branchGate(gates.map((g, i) => ({ branches: g.branches, map: readFileSync(join(dirs[i], 'reached.bin')) })), { branches: allow.lockstepBranches }, MODULES);
  problems.push(...gates[0].methods.filter((m) => !called.has(m)).map((m) => `no run calls ${m}`));
  if (problems.length) fail(`Coverage gate:\n  ${problems.join('\n  ')}`);
}
const problem = await repeat(dirs, gates, 'run_lockstep.gd', 'Lockstep', (g) => g.steps);
if (problem) fail(problem);
console.log(`All steps equal (${since()}).`);
if (!only || quick) {
  const missed = await traps(LOCKSTEP_TRAPS, 'run_lockstep.gd', dirs);
  if (missed) fail(missed);
  console.log(`Every trap was caught (${since()}).`);
}
