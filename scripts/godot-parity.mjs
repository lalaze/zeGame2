// Checks that the Godot rules (`godot/core`) compute exactly what `src/game` does, bit for bit:
//   1. the number, JSON and sorting base (about 200,000 vectors),
//   2. fresh vectors for every exported function, with a gate on cases, outcomes and reached branches.
// npm run godot:parity                      everything ported so far, and the framework's own tests
// npm run godot:parity -- layout furniture  only these modules
import { join } from 'node:path';
import { PARITY_DIR, ROOT, bundle, gameModules, writeSignatures } from './godot-parity/bundle.mjs';
import { readFileSync, rmSync } from 'node:fs';
import { GODOT, PROJECT, background, godot, importProject, judge } from './godot-parity/run.mjs';
import { branchGate, moduleGate } from './godot-parity/gate.mjs';
import { generateFoundationVectors } from './godot-foundation-gen.mjs';
import { selftest } from './godot-parity/selftest.mjs';

const ALLOW = join(ROOT, 'scripts/godot-parity/allow.json'), PROCESSES = 8;
/** About how long a module takes, measured; the rest are 1. The longest go to the emptiest process first. */
const WEIGHT = { economy: 22, styles: 9, milestones: 8, kitchen: 6, partners: 6, furniture: 6, state: 12, streets: 6, 'room-projects': 5, 'settlement-advice': 5, layout: 4, regions: 4, reputation: 4, 'signature-drinks': 4, manager: 5, chain: 5, orders: 4, recovery: 5, 'trial-sales': 3, 'regular-guests': 3, goals: 3, taste: 2, pets: 2, 'guest-memories': 2, day: 3, 'cat-gifts': 2 };
function split(mods) {
  const weight = (m) => WEIGHT[m] ?? 1, groups = Array.from({ length: Math.min(PROCESSES, mods.length) }, () => ({ load: 0, mods: [] }));
  for (const m of [...mods].sort((a, b) => weight(b) - weight(a))) { const g = groups.reduce((x, y) => (y.load < x.load ? y : x)); g.load += weight(m); g.mods.push(m); }
  return groups.map((g) => g.mods);
}
const t0 = Date.now(), only = process.argv.slice(2).flatMap((a) => a.split(',')).filter((a) => a && a !== '--');
const step = (label) => console.log(`\n==> ${label}`);
const fail = (reason) => { console.error(reason); process.exit(1); };
const run = (script, label) => {
  const result = godot(['--script', `res://tests/${script}`]);
  process.stdout.write(result.stdout); process.stderr.write(result.stderr);
  const verdict = judge(result, label);
  if (verdict) fail(verdict);
};

importProject();
if (!only.length) {
  step('Numbers, JSON and sorting');
  console.log(generateFoundationVectors(20_000));
  run('run_foundation_parity.gd', 'Foundation parity');
}
step('Vectors from the TypeScript rules');
await writeSignatures();
const allow = JSON.parse(readFileSync(ALLOW, 'utf8')), chosen = only.length ? only : allow.modules;
const unported = moduleGate(gameModules(), allow);
if (unported.length) fail(`Coverage gate:\n  ${unported.join('\n  ')}`);
const groups = split(chosen), dirs = groups.map((_, i) => join(PARITY_DIR, `cases-${i}`)), bundled = await bundle('gen');
rmSync(PARITY_DIR + '/cases', { recursive: true, force: true });
for (let i = groups.length; i < 16; i++) rmSync(join(PARITY_DIR, `cases-${i}`), { recursive: true, force: true });
const made = await Promise.all(groups.map((mods, i) => background('node', [bundled, PARITY_DIR, mods.join(','), ALLOW, dirs[i]])));
for (const r of made) if (r.status !== 0) fail(r.stdout + r.stderr);
const gates = dirs.map((d) => JSON.parse(readFileSync(join(d, 'gate.json'), 'utf8')));
console.log(`${chosen.length} modules, ${gates.reduce((n, g) => n + g.cases, 0)} cases from ${gates[0].states} states`);
// Some branches are only reached through other modules, so a partial run cannot judge them.
const problems = [...gates.flatMap((g) => g.errors), ...(only.length ? [] : branchGate(gates.map((g, i) => ({ branches: g.branches, map: readFileSync(join(dirs[i], 'reached.bin')) })), allow, chosen))];
if (problems.length) fail(`Coverage gate:\n  ${problems.join('\n  ')}`);

step('The same calls in Godot');
const compared = await Promise.all(dirs.map((d) => background(GODOT, ['--headless', '--path', PROJECT, '--script', 'res://tests/run_parity.gd', '--', `--dir=${d}`])));
let total = 0;
for (const r of compared) {
  process.stdout.write(r.stdout.split('\n').filter((l) => /^(PARITY_MODULE|FAIL)/.test(l)).join('\n') + '\n');
  const verdict = judge(r, 'Module parity');
  if (verdict) { process.stderr.write(r.stderr); fail(verdict); }
  total += Number(r.stdout.match(/PARITY_SUMMARY: .*total=(\d+)/)[1]);
}
console.log(`${total} comparisons, all equal`);
if (!only.length) { step('The framework catches differences'); const problem = selftest(); if (problem) fail(problem); }
console.log(`\nAll godot:parity checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
