// Takes the café from the web game in the phone's Chrome (the installed PWA too) to the app, over adb.
//   npm run godot:move -- [--serial=<device>] [--page=<part of its address>] [--push] [--file=<save.json>]
// Without --push it only reads: the save goes to godot/build/saves/ and nothing changes on the phone. With --push the app
// on the phone gets it. What the app had is kept first, on this computer (godot/build/saves/) and on the phone
// (files/save/…save-before-move-<time>), and both are read back; whatever cannot be read or kept for certain stops the
// move with the app's café untouched. --file pushes a save read earlier. The web game must be open in Chrome, USB or
// wireless debugging must be on, and --push needs the debug build of the app.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SAVE_KEY = 'tiny-bean-cafe/save';
export const APP = 'com.lalaze.tinybeancafe';
const ROOT = resolve(import.meta.dirname, '..');
export const VERSION = Number(readFileSync(join(ROOT, 'src/game/state.ts'), 'utf8').match(/export const SAVE_VERSION = (\d+);/)[1]);

const wellFormed = (value) => typeof value === 'string' ? value.isWellFormed() : !value || typeof value !== 'object' || Object.entries(value).every(([k, v]) => k.isWellFormed() && wellFormed(v));

/** What a save holds, or why it is none the app would take. The app itself reads it with the game's own rules. */
export function describe(raw) {
  if (typeof raw !== 'string' || raw === '') return { ok: false, why: 'there is no save' };
  let data;
  try { data = JSON.parse(raw); } catch { return { ok: false, why: 'it is not whole JSON' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, why: 'it is not a save' };
  for (const part of ['version', 'items', 'coins', 'day']) if (!(part in data)) return { ok: false, why: `it has no "${part}"` };
  if (typeof data.version !== 'number' || data.version > VERSION) return { ok: false, why: `its version is ${data.version}, the app's is ${VERSION}` };
  // The app's disk takes no half letters (file_store.gd reads with the engine's JSON).
  if (!wellFormed(data)) return { ok: false, why: 'it has broken letters' };
  return { ok: true, version: data.version, day: data.day, coins: data.coins, name: data.profile?.cafeName ?? '' };
}

const tell = (s) => `${s.name || 'a café'}, day ${s.day}, ${Math.floor(s.coins)} coins, save version ${s.version}`;

/** Where the app keeps a key (godot/scripts/file_store.gd): String.uri_encode() of it. */
export const fileOf = (key) => `files/save/${encodeURIComponent(key).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;

/** The pages of a DevTools list that may be the game. */
export const pagesOf = (targets, part = '') => targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl && /^https?:/.test(t.url) && t.url.includes(part));

/** Evaluates an expression in a page. */
export function ask(address, expression, milliseconds = 8000) {
  return new Promise((done, fail) => {
    const socket = new WebSocket(address);
    const late = setTimeout(() => { socket.close(); fail(new Error('the page did not answer')); }, milliseconds);
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    socket.onerror = () => { clearTimeout(late); fail(new Error('the page could not be reached')); };
    socket.onmessage = (event) => {
      const said = JSON.parse(event.data);
      if (said.id !== 1) return;
      clearTimeout(late);
      socket.close();
      if (said.error || said.result.exceptionDetails) fail(new Error('the page could not be read'));
      else done(said.result.result.value ?? null);
    };
  });
}

/** What adb says: {code, out}. Stops when there is no adb. */
function adbOf(device) {
  return (args, input) => {
    const done = spawnSync(process.env.ADB || 'adb', [...device, ...args], { input, maxBuffer: 64 << 20 });
    if (done.error) throw new Error(`adb could not be run (${done.error.code}). Install Android's platform-tools, or name it in ADB.`);
    return { code: done.status ?? -1, out: done.stdout, why: `${done.stderr}`.trim() || `${done.stdout}`.trim() };
  };
}

/** The app's own files, through `adb shell run-as`, which says whether what it ran worked. */
export function appOf(adb) {
  // Nothing here has a single quote in it, so this is one word to the phone's shell.
  const run = (script, input) => adb(['shell', `run-as ${APP} sh -c '${script}'`], input);
  const must = (what, script, input) => {
    const done = run(script, input);
    if (done.code !== 0) throw new Error(`${what}: ${done.why || `adb ended with ${done.code}`}`);
    return done.out;
  };
  return {
    /** Stops unless the app is there and lets its files be read. */
    check() { must(`${APP} is not on the phone, or not the debug build`, 'echo in'); },
    /** A file's bytes, or null when it is certainly not there. Stops when that cannot be told, or not all of it came. */
    read(file) {
      const out = must(`${file} could not be read`, `if [ -e "${file}" ]; then wc -c < "${file}" && cat "${file}" && printf :whole; elif [ -e files/save ] && ! ls -a files/save > /dev/null; then exit 9; else echo none; fi`);
      if (out.toString() === 'none\n') return null;
      const line = out.indexOf('\n'), size = Number(out.subarray(0, line).toString().trim()), rest = out.subarray(line + 1), end = Buffer.from(':whole');
      if (line < 0 || !Number.isInteger(size) || rest.length !== size + end.length || !rest.subarray(size).equals(end)) throw new Error(`${file} did not come whole`);
      return rest.subarray(0, size);
    },
    /** Writes a file and reads it back. */
    write(file, bytes) {
      must(`${file} could not be written`, `umask 077; mkdir -p files/save && cat > "${file}"`, bytes);
      if (!this.read(file)?.equals(bytes)) throw new Error(`${file} did not arrive whole`);
    },
    remove(file) { run(`rm -f "${file}"`); },
    move(from, to) { must(`${to} could not be written`, `mv "${from}" "${to}"`); },
  };
}

/** Puts a save in the app; what it had is kept on both sides first. */
export function push(adb, raw, folder, say = console.log, now = new Date()) {
  const save = describe(raw);
  if (!save.ok) throw new Error(`Not a save: ${save.why}.`);
  const app = appOf(adb), file = fileOf(SAVE_KEY), bytes = Buffer.from(raw);
  app.check();
  const stop = adb(['shell', `am force-stop ${APP}`]);
  if (stop.code !== 0) throw new Error(`The app could not be stopped: ${stop.why}`);
  const before = app.read(file), had = before && describe(before.toString());
  // When the save itself is torn or gone, the app goes on from these (file_store.gd).
  for (const kind of had?.ok ? [''] : ['', '.tmp', '.prev']) {
    const there = kind === '' ? before : app.read(file + kind);
    if (!there) continue;
    const path = keep(folder, `app${kind}`, there, now), holds = describe(there.toString());
    // Never over another: the name has the time in it, and is not used twice.
    let beside = `${file}-before-move-${now.getTime()}${kind}`;
    while (app.read(beside) !== null) beside += '-';
    app.write(beside, there);
    say(`The app had ${holds.ok ? tell(holds) : `a save that cannot be read (${holds.why})`}; kept at ${path} and beside it on the phone.`);
  }
  try {
    app.write(`${file}.moving`, bytes);
    // Nothing wrote it meanwhile (the app may have been opened).
    const still = app.read(file);
    if (before === null ? still !== null : !still?.equals(before)) throw new Error('The app was saving meanwhile; nothing was changed. Keep it closed and try again.');
    app.move(`${file}.moving`, file);
  } catch (error) {
    app.remove(`${file}.moving`);
    throw error;
  }
  if (!app.read(file)?.equals(bytes)) throw new Error('The save did not arrive whole; what the app had is kept (see above).');
  say(`The app now has ${tell(save)}.`);
}

/** Keeps bytes on this computer, under a name of their own, and reads them back. */
export function keep(folder, what, bytes, now = new Date()) {
  mkdirSync(folder, { recursive: true });
  const path = join(folder, `${now.toISOString().replace(/[:.]/g, '-')}-${what}.json`);
  writeFileSync(path, bytes, { flag: 'wx' });
  if (!readFileSync(path).equals(Buffer.from(bytes))) throw new Error(`${path} could not be written`);
  return path;
}

async function fromChrome(adb, part) {
  const forward = adb(['forward', 'tcp:0', 'localabstract:chrome_devtools_remote']);
  const port = `${forward.out}`.trim();
  if (forward.code !== 0 || !/^\d+$/.test(port)) throw new Error(`The phone could not be reached: ${forward.why}`);
  try {
    let list;
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { throw new Error('Chrome on the phone did not answer. Open the web game in it, keep the screen on and try again.'); }
    const found = [];
    for (const page of pagesOf(list, part)) {
      const origin = new URL(page.url).origin;
      try {
        const raw = await ask(page.webSocketDebuggerUrl.replace(/\/\/[^/]+/, `//127.0.0.1:${port}`), `localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
        if (raw && !found.some((f) => f.raw === raw)) found.push({ raw, origin, ...describe(raw) });
      } catch (error) { console.error(`${origin}: ${error.message}`); }
    }
    return found;
  } finally { adb(['forward', '--remove', `tcp:${port}`]); }
}

async function main() {
  const opts = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? true]; }));
  const unknown = Object.keys(opts).filter((k) => !['serial', 'page', 'push', 'file'].includes(k));
  if (unknown.length > 0) throw new Error(`Unknown: --${unknown.join(', --')}`);
  const adb = adbOf(opts.serial ? ['-s', opts.serial] : []), folder = join(ROOT, 'godot/build/saves');
  let raw;
  if (opts.file) raw = readFileSync(opts.file, 'utf8');
  else {
    const found = await fromChrome(adb, opts.page);
    for (const f of found) console.log(`${f.origin}: ${f.ok ? tell(f) : f.why}`);
    const good = found.filter((f) => f.ok);
    if (good.length !== 1) throw new Error(good.length ? 'More than one café: choose with --page=<part of its address>.' : 'No café found. Open the web game in Chrome on the phone and try again.');
    raw = good[0].raw;
    console.log(`Saved to ${keep(folder, 'web', raw)}`);
  }
  if (opts.push) push(adb, raw, folder);
  else console.log('Nothing was changed on the phone; add --push to put it in the app.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
