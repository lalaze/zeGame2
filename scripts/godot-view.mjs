// Checks that the building in Godot (`godot/view`) is what the floors view's own TypeScript (src/render/floors) draws:
//   1. the pure functions (where everything is, walks, light, pictures, thoughts), call by call,
//   2. the scene, frame by frame: the web's own scene runs without a screen (fake-phaser.ts) over running cafés, and
//      Godot repeats them: where everyone stands and walks, which picture they show, the props, cats, camera and light,
//   3. what only a screen tells: that what stands deeper is drawn over what does not (needs a window).
// npm run godot:view
import { join } from 'node:path';
import { build } from 'vite';
import { PARITY_DIR, ROOT } from './godot-parity/bundle.mjs';
import { GODOT, PROJECT, background, godot, importProject, judge } from './godot-parity/run.mjs';

const fail = (reason) => { console.error(reason); process.exit(1); };
importProject();
const bundle = (name) => build({
  root: ROOT, configFile: false, logLevel: 'error', publicDir: false, resolve: { alias: { phaser: join(ROOT, 'scripts/godot-parity/fake-phaser.ts') } },
  build: { ssr: join(ROOT, `scripts/godot-parity/${name}.ts`), outDir: join(PARITY_DIR, 'bundle'), emptyOutDir: false, minify: false, target: 'node22', rollupOptions: { output: { entryFileNames: `${name}.mjs`, format: 'es' } } },
});
await bundle('view');
const made = await background('node', [join(PARITY_DIR, 'bundle/view.mjs'), join(PARITY_DIR, 'view')]);
if (made.status !== 0) fail(made.stdout + made.stderr);
const gate = JSON.parse(made.stdout.trim().split('\n').pop());
console.log(`${gate.rows} cases of ${gate.functions} functions, ${gate.constants} constants`);
if (gate.dull.length) fail(`Always the same answer: ${gate.dull.join(', ')}`);
const result = godot(['--script', 'res://tests/run_view_parity.gd']);
process.stdout.write(result.stdout.split('\n').filter((l) => /FAIL|SUMMARY/.test(l)).join('\n') + '\n');
const verdict = judge(result, 'View parity');
if (verdict) { process.stderr.write(result.stderr); fail(verdict); }
const compared = Number(result.stdout.match(/VIEW_SUMMARY: .*cases=(\d+)/)?.[1]);
if (compared !== gate.rows + gate.constants) fail(`Compared ${compared} of ${gate.rows + gate.constants}`);

await bundle('view-scene');
const filmed = await background('node', [join(PARITY_DIR, 'bundle/view-scene.mjs'), join(PARITY_DIR, 'view-scene')]);
if (filmed.status !== 0) fail(filmed.stdout + filmed.stderr);
const films = JSON.parse(filmed.stdout.trim().split('\n').pop());
console.log(`${films.films} films of the web's scene, ${films.frames} frames`);
// Several Godots share the films by the start of their names.
const results = await Promise.all(['cats', 'cooks', 'late', 'open', 'prep'].map((only) => background(GODOT, ['--headless', '--path', PROJECT, '--script', 'res://tests/run_view_scene.gd', '--', `--only=${only}`])));
for (const r of results) {
  process.stdout.write(r.stdout.split('\n').filter((l) => /FAIL|SUMMARY/.test(l)).join('\n') + '\n');
  const problem = judge(r, 'View scene');
  if (problem) { process.stderr.write(r.stderr); fail(problem); }
}
const sum = (what) => results.reduce((n, r) => n + Number(r.stdout.match(new RegExp(`SCENE_SUMMARY: .*${what}=(\\d+)`))?.[1] ?? 0), 0);
if (sum('passed') !== films.films || sum('frames') !== films.frames) fail(`Repeated ${sum('passed')} films and ${sum('frames')} frames of ${films.films} and ${films.frames}`);
console.log(`Every frame equal: ${sum('compared')} compared`);

const drawn = await background(GODOT, ['--path', PROJECT, '--rendering-method', 'gl_compatibility', '--resolution', '400x400', '--script', 'res://tests/run_view_drawn.gd']);
process.stdout.write(drawn.stdout.split('\n').filter((l) => /FAIL|SUMMARY/.test(l)).join('\n') + '\n');
const unseen = judge(drawn, 'Drawn view');
if (unseen) { process.stderr.write(drawn.stderr); fail(unseen); }
