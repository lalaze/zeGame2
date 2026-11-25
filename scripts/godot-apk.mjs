// Exports the app into gitignored `godot/build/`.
//   npm run godot:apk               Android arm64-v8a, debug
//   npm run godot:apk -- --release  Android arm64-v8a, release, signed with the same debug key: it installs over the other
//   npm run godot:ios               the Xcode project (`godot/build/ios/`), to build and sign in Xcode
// Needs Godot 4.7.2's export templates; does not download them.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const GODOT_DIR = join(ROOT, 'godot');
const BUILD_DIR = join(GODOT_DIR, 'build');
const GODOT_BIN = process.env.GODOT_BIN || '/opt/homebrew/bin/godot';
const GODOT_HOME = join(homedir(), 'Library/Application Support/Godot');
const ios = process.argv.includes('--ios'), release = process.argv.includes('--release');
const template = join(GODOT_HOME, 'export_templates/4.7.2.stable', ios ? 'ios.zip' : release ? 'android_release.apk' : 'android_debug.apk');
const out = join(BUILD_DIR, ios ? 'ios/TinyBeanCafe.xcodeproj' : release ? 'tiny-bean-cafe-release.apk' : 'tiny-bean-cafe.apk');

function stop(...why) {
  console.error(...why);
  process.exit(1);
}

function run(cmd, args, env = {}) {
  const done = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
  if (done.error) stop(done.error.message);
  if (done.status !== 0) process.exit(done.status ?? 1);
}

/** The key the editor signs debug builds with, for the release build too. */
function releaseKey() {
  const settings = readFileSync(join(GODOT_HOME, 'editor_settings-4.7.tres'), 'utf8');
  const of = (name) => settings.match(new RegExp(`export/android/${name} = "(.*)"`))?.[1];
  const path = of('debug_keystore');
  if (!path || !existsSync(path)) stop('No debug keystore in the editor settings.');
  return { GODOT_ANDROID_KEYSTORE_RELEASE_PATH: path, GODOT_ANDROID_KEYSTORE_RELEASE_USER: of('debug_keystore_user') ?? 'androiddebugkey', GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD: of('debug_keystore_pass') ?? 'android' };
}

if (!existsSync(template)) {
  console.error(`Export template not found: ${template}`);
  console.error('Install Godot 4.7.2.stable export templates first, then run this again.');
  process.exit(2);
}
// The art and data, and the engine's own copies of them.
run('node', [join(ROOT, 'scripts/godot-sync.mjs')]);
run(GODOT_BIN, ['--headless', '--path', GODOT_DIR, '--import']);
mkdirSync(join(out, '..'), { recursive: true });
if (!ios) rmSync(out, { force: true });
run(GODOT_BIN, ['--headless', '--path', GODOT_DIR, release ? '--export-release' : '--export-debug', ios ? 'iOS' : 'Android', out], release && !ios ? releaseKey() : {});
if (!existsSync(out)) stop(`Nothing was exported to ${out}`);
if (ios) {
  console.log(`Xcode project: ${out}`);
  process.exit(0);
}

// Tests stay out of the app, and what it cannot start without is in it.
const list = spawnSync('unzip', ['-Z1', out], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
if (list.status !== 0) stop('The APK cannot be read:', list.stderr);
const entries = list.stdout.split('\n').filter(Boolean);
const leaked = entries.filter((e) => /(^|\/)tests\//i.test(e) || /\/(run|bench)_\w+\.gd/i.test(e) || /\.parity/.test(e));
if (leaked.length > 0) stop('Tests are in the APK:', leaked);
const missing = ['assets/scenes/cafe.tscn', 'assets/data/rules.json', 'assets/data/locale-zh.json', 'assets/data/locale-en.json', 'assets/icudt_godot.dat', 'lib/arm64-v8a/libgodot_android.so'].filter((e) => !entries.includes(e) && !entries.includes(`${e}.remap`));
if (missing.length > 0) stop('Missing from the APK:', missing);
console.log(`APK: ${out} (${(statSync(out).size / (1024 * 1024)).toFixed(1)} MB, ${entries.length} entries)`);
