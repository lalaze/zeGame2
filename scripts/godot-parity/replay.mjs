// Records runs with the TypeScript rules in several processes, then repeats them in Godot and compares.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PARITY_DIR } from './bundle.mjs';
import { GODOT, PROJECT, background, judge } from './run.mjs';

export const PROCESSES = 8;
export const partsOf = (name) => Array.from({ length: PROCESSES }, (_, i) => join(PARITY_DIR, name, String(i)));

/** Writes the runs; every process leaves a `gate.json` about its part. */
export async function record(bundled, name, args = []) {
  rmSync(join(PARITY_DIR, name), { recursive: true, force: true });
  const dirs = partsOf(name);
  const made = await Promise.all(dirs.map((dir, i) => background('node', [bundled, dir, String(i), String(PROCESSES), ...args])));
  const bad = made.find((r) => r.status !== 0);
  if (bad) throw new Error(bad.stdout + bad.stderr);
  return dirs.map((dir) => JSON.parse(readFileSync(join(dir, 'gate.json'), 'utf8')));
}

/** Null when Godot repeated every recorded run and step, else what went wrong. Parts without runs are skipped. */
export async function repeat(dirs, gates, script, label, stepsOf, project = PROJECT) {
  const some = dirs.filter((_, i) => gates[i].runs > 0);
  const results = await Promise.all(some.map((dir) => background(GODOT, ['--headless', '--path', project, '--script', `res://tests/${script}`, '--', `--dir=${dir}`])));
  for (const r of results) {
    const verdict = judge(r, label);
    if (verdict) return `${verdict}\n${(r.stdout + r.stderr).split('\n').filter((l) => /FAIL|ERROR|at:|SUMMARY/.test(l)).slice(0, 12).join('\n')}`;
  }
  const total = (pattern) => results.reduce((n, r) => n + Number(r.stdout.match(pattern)[1]), 0);
  const steps = total(/SUMMARY: steps=(\d+)/), runs = total(/SUMMARY: .*passed=(\d+)/), wanted = gates.reduce((n, g) => n + stepsOf(g), 0), wantedRuns = gates.reduce((n, g) => n + g.runs, 0);
  return steps === wanted && runs === wantedRuns ? null : `${label}: repeated ${runs} runs and ${steps} steps of ${wantedRuns} and ${wanted}`;
}
