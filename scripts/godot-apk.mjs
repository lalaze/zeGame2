// Exports the Godot B0 Android debug APK into gitignored `godot/build/`.
// Does NOT download export templates; fails cleanly if templates are not yet installed.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const GODOT_DIR = join(ROOT, 'godot');
const BUILD_DIR = join(GODOT_DIR, 'build');
const APK_OUT = join(BUILD_DIR, 'tiny-bean-cafe-b0.apk');
const GODOT_BIN = process.env.GODOT_BIN || '/opt/homebrew/bin/godot';
const TEMPLATES_DIR = join(
  homedir(),
  'Library/Application Support/Godot/export_templates/4.7.2.stable',
);

const debugTemplate = join(TEMPLATES_DIR, 'android_debug.apk');
if (!existsSync(debugTemplate)) {
  console.error(`Android export template not found: ${debugTemplate}`);
  console.error('Install Godot 4.7.2.stable export templates first, then re-run `npm run godot:apk`.');
  process.exit(2);
}

// Ensure synced art & data exist before exporting
const syncRes = spawnSync('node', [join(ROOT, 'scripts/godot-sync.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (syncRes.status !== 0) process.exit(syncRes.status ?? 1);

// Ensure Godot resource import cache is up to date
const impRes = spawnSync(GODOT_BIN, ['--headless', '--path', GODOT_DIR, '--import'], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (impRes.status !== 0) process.exit(impRes.status ?? 1);

mkdirSync(BUILD_DIR, { recursive: true });
const expRes = spawnSync(
  GODOT_BIN,
  ['--headless', '--path', GODOT_DIR, '--export-debug', 'Android', 'build/tiny-bean-cafe-b0.apk'],
  { cwd: ROOT, stdio: 'inherit' },
);
if (expRes.status !== 0) process.exit(expRes.status ?? 1);

if (!existsSync(APK_OUT)) {
  console.error(`Expected APK not found at ${APK_OUT}`);
  process.exit(1);
}

// Verify test scripts and godot/tests/ were NOT packaged into the APK
const listRes = spawnSync('unzip', ['-Z1', APK_OUT], { cwd: ROOT, encoding: 'utf8' });
if (listRes.status !== 0) {
  console.error('Failed to inspect APK contents with unzip:', listRes.stderr);
  process.exit(1);
}
const apkEntries = listRes.stdout.split('\n').filter(Boolean);
const leakedTests = apkEntries.filter(
  (entry) => /(^|\/)tests\//i.test(entry) || /run_tests|run_baseline/i.test(entry),
);
if (leakedTests.length > 0) {
  console.error('ERROR: Test files leaked into APK:', leakedTests);
  process.exit(1);
}

const sizeMb = (statSync(APK_OUT).size / (1024 * 1024)).toFixed(2);
console.log(`APK exported: ${APK_OUT} (${sizeMb} MB, ${apkEntries.length} entries, 0 test files)`);
