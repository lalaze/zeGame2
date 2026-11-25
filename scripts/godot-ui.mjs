// Checks that the screens in Godot (`godot/ui`) say and do what the page's own (src/ui) do: both walk through the same
// screens on the same cafés, press the same things, and are compared after every press (scripts/godot-parity/ui.ts).
// npm run godot:ui [screen,…]
import { join } from 'node:path';
import { build } from 'vite';
import { PARITY_DIR, ROOT } from './godot-parity/bundle.mjs';
import { GODOT, PROJECT, background, importProject, judge } from './godot-parity/run.mjs';

const fail = (reason) => { console.error(reason); process.exit(1); };
importProject();
await build({
  root: ROOT, configFile: false, logLevel: 'error', publicDir: false, resolve: { alias: { phaser: join(ROOT, 'scripts/godot-parity/fake-phaser.ts') } },
  build: { ssr: join(ROOT, 'scripts/godot-parity/ui.ts'), outDir: join(PARITY_DIR, 'bundle'), emptyOutDir: false, minify: false, target: 'node22', rollupOptions: { output: { entryFileNames: 'ui.mjs', format: 'es' } } },
});
const only = process.argv[2];
const parts = [0, 1, 2, 3], said = await Promise.all(parts.map((n) => background('node', ['--max-old-space-size=6144', join(PARITY_DIR, 'bundle/ui.mjs'), join(PARITY_DIR, 'ui'), String(n), ...(only ? [only] : [])])));
for (const made of said) if (made.status !== 0) fail(made.stdout + made.stderr);
const gates = said.map((made) => JSON.parse(made.stdout.trim().split('\n').pop()));
const gate = { walks: gates.reduce((n, x) => n + x.walks, 0), looks: gates.reduce((n, x) => n + x.looks, 0) };
console.log(`${gate.walks} walks through the page's screens, ${gate.looks} looks`);
// A screen on which nothing was ever pressed proves nothing.
const dull = only ? [] : gates[0].screens.filter((s) => !gates.some((x) => x.pressed[s] > 0));
if (dull.length) fail(`Nothing was ever pressed on: ${dull.join(', ')}`);
const results = await Promise.all([0, 1, 2, 3].map((n) => background(GODOT, ['--headless', '--path', PROJECT, '--script', 'res://tests/run_ui.gd', '--', `--only=${n}`])));
let problem = null;
for (const r of results) {
  process.stdout.write(r.stdout.split('\n').filter((l) => /FAIL|SUMMARY/.test(l)).join('\n') + '\n');
  const verdict = judge(r, 'Screens');
  if (verdict) { process.stderr.write(r.stderr.split('\n').slice(0, 30).join('\n')); problem = verdict; }
}
if (problem) fail(problem);
const sum = (what) => results.reduce((n, r) => n + Number(r.stdout.match(new RegExp(`UI_SUMMARY: .*${what}=(\\d+)`))?.[1] ?? 0), 0);
if (sum('passed') !== gate.walks || sum('looks') !== gate.looks) fail(`Walked ${sum('passed')} and looked ${sum('looks')} times of ${gate.walks} and ${gate.looks}`);
console.log(`Every look the same: ${sum('looks')}`);
