// Runs the Godot tests: data drift, save files, the game as it starts, and everything against TypeScript (the long
// comparisons in their quick form; `npm run godot:lockstep` and `npm run godot:session` run all of them).
// Exits non-zero on any failure.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const GODOT_DIR = join(ROOT, 'godot');
const GODOT_BIN = process.env.GODOT_BIN || '/opt/homebrew/bin/godot';

function run(cmd, args, label) {
  console.log(`\n==> ${label}`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (res.error) {
    console.error(`${label} failed to spawn:`, res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`${label} failed with exit code ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

function runGodotTests(script, label, summary) {
  console.log(`\n==> ${label}`);
  const res = spawnSync(
    GODOT_BIN,
    ['--headless', '--path', GODOT_DIR, '--script', `res://tests/${script}`],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
  );
  const stdout = res.stdout ?? '';
  const stderr = res.stderr ?? '';
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  if (res.error) {
    console.error(`${label} failed to spawn:`, res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`${label} failed with exit code ${res.status}`);
    process.exit(res.status ?? 1);
  }

  const combined = `${stdout}\n${stderr}`;
  if (combined.includes('FAIL:')) {
    console.error(`${label} failed: output contains 'FAIL:'`);
    process.exit(1);
  }
  if (combined.includes('SCRIPT ERROR') || combined.includes('PARSE ERROR')) {
    console.error(`${label} failed: output contains script/parse error`);
    process.exit(1);
  }

  const summaryMatch = stdout.match(new RegExp(`^${summary}:\\s+passed=(\\d+)\\s+failed=(\\d+)\\s*$`, 'm'));
  if (!summaryMatch) {
    console.error(`${label} failed: missing ${summary} line (process may have exited early)`);
    process.exit(1);
  }
  const passed = Number(summaryMatch[1]);
  const failed = Number(summaryMatch[2]);
  if (!(passed > 0) || failed !== 0) {
    console.error(`${label} failed: invalid summary passed=${passed} failed=${failed}`);
    process.exit(1);
  }
}

if (!existsSync(join(GODOT_DIR, '.godot'))) {
  run(GODOT_BIN, ['--headless', '--path', GODOT_DIR, '--import'], 'Godot headless import');
}

runGodotTests('run_store_tests.gd', 'Save files', 'STORE_SUMMARY');
runGodotTests('run_app_tests.gd', 'The game as it starts', 'APP_SUMMARY');

run(
  'npx',
  ['vitest', 'run', 'scripts/godot-fonts.test.ts', 'scripts/godot-rules-data.test.ts'],
  'TS data drift & font charset coverage tests',
);

run('node', ['scripts/godot-parity.mjs'], 'TS <-> GDScript rules parity');
run('node', ['scripts/godot-lockstep.mjs', '--quick'], 'Simulation step by step');
run('node', ['scripts/godot-session.mjs', '--quick'], 'Careers as main.ts plays them');
run('node', ['scripts/godot-view.mjs'], 'The building as the floors view draws it');
run('node', ['scripts/godot-ui.mjs'], 'The screens as the page shows them');

console.log('\nAll godot:test checks passed.');
