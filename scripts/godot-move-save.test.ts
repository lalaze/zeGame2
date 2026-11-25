// Moving a save into the app never loses one: run against a folder that stands for the app on the phone, with the scripts
// meant for the phone's shell run by this one's, and with every command failing in turn.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { APP, SAVE_KEY, VERSION, describe, fileOf, keep, pagesOf, push } from './godot-move-save.mjs';

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
const save = (day: number, more: object = {}) => JSON.stringify({ version: VERSION, items: { espresso: 1 }, coins: day * 10, day, profile: { cafeName: `第 ${day} 天的店` }, ...more });
type Said = { code: number; out: Buffer; why: string };
type Adb = (args: string[], input?: string | Buffer) => Said;

let place: string, phone: string, folder: string, calls: string[];
const main = () => join(phone, fileOf(SAVE_KEY));
const there = () => (existsSync(main()) ? readFileSync(main(), 'utf8') : null);
const beside = () => (existsSync(join(phone, 'files/save')) ? readdirSync(join(phone, 'files/save')).filter((f) => f.includes('-before-move-')).map((f) => readFileSync(join(phone, 'files/save', f), 'utf8')) : []);
const here = () => (existsSync(folder) ? readdirSync(folder).map((f) => readFileSync(join(folder, f), 'utf8')) : []);
function put(text: string) {
  mkdirSync(join(phone, 'files/save'), { recursive: true });
  writeFileSync(main(), text);
}

/** `adb shell` with the phone's `run-as` and `am` standing in. */
const adb: Adb = (args, input) => {
  expect(args[0]).toBe('shell');
  expect(args).toHaveLength(2);
  calls.push(args[1]);
  const done = spawnSync('/bin/sh', ['-c', args[1]], { cwd: place, input, env: { PATH: `${join(place, 'bin')}:${process.env.PATH}`, PHONE: phone } });
  return { code: done.status ?? -1, out: done.stdout, why: `${done.stderr}`.trim() };
};

beforeEach(() => {
  place = mkdtempSync(join(tmpdir(), 'move-save-'));
  phone = join(place, 'phone');
  folder = join(place, 'saves');
  calls = [];
  mkdirSync(phone);
  mkdirSync(join(place, 'bin'));
  for (const [name, text] of [['run-as', `#!/bin/sh\n[ "$1" = "${APP}" ] || exit 1\nif [ -e "$PHONE/release" ]; then echo "run-as: package not debuggable: $1" >&2; exit 1; fi\nshift\ncd "$PHONE" || exit 1\nexec "$@"\n`], ['am', `#!/bin/sh\n[ "$*" = "force-stop ${APP}" ]\n`]]) {
    writeFileSync(join(place, 'bin', name), text);
    chmodSync(join(place, 'bin', name), 0o755);
  }
});
afterEach(() => rmSync(place, { recursive: true, force: true }));

it('knows a save the app would take', () => {
  expect(describe(save(3))).toEqual({ ok: true, version: VERSION, day: 3, coins: 30, name: '第 3 天的店' });
  expect(describe(JSON.stringify({ version: 1, items: {}, coins: 0, day: 1, profile: null }))).toMatchObject({ ok: true, name: '' });
  for (const raw of [null, undefined, '', 'hello', '{"version":27', '[]', '"text"', 'null', '{"version":27,"items":{},"coins":1}', save(3, { version: VERSION + 1 }), save(3, { version: '27' }), save(3).replace('第', '\\ud83d'), save(3, { '\ud83d': 1 })]) expect(describe(raw as string), String(raw)).toMatchObject({ ok: false });
  expect(describe(save(3).replace('第', '\\ud83d\\ude00')), 'a whole letter').toMatchObject({ ok: true });
  expect(describe(save(3).replace('第', '\\\\ud83d')), 'a backslash').toMatchObject({ ok: true });
});

it('finds the pages that may be the game', () => {
  const page = (url: string, type = 'page') => ({ type, url, webSocketDebuggerUrl: 'ws://x/1' });
  const list = [page('https://a.example/'), page('chrome://newtab/'), page('https://a.example/sw.js', 'service_worker'), page('http://b.example:4175/'), { type: 'page', url: 'https://busy.example/' }];
  expect(pagesOf(list).map((p) => p.url)).toEqual(['https://a.example/', 'http://b.example:4175/']);
  expect(pagesOf(list, ':4175').map((p) => p.url)).toEqual(['http://b.example:4175/']);
});

it('writes where the app reads', () => {
  expect(fileOf(SAVE_KEY)).toBe('files/save/tiny-bean-cafe%2Fsave');
  expect(source('src/game/state.ts')).toContain(`'${SAVE_KEY}'`);
  expect(source('godot/app/cafe_app.gd')).toContain('var save_dir := "user://save"');
  expect(source('godot/export_presets.cfg')).toContain(`package/unique_name="${APP}"`);
});

it('moves a save into an app that has none', () => {
  push(adb, save(5), folder, () => {});
  expect(there()).toBe(save(5));
  expect([...beside(), ...here()]).toEqual([]);
  expect(readdirSync(join(phone, 'files/save'))).toEqual(['tiny-bean-cafe%2Fsave']);
});

it('keeps what the app had, on both sides, every time', () => {
  put(save(9));
  const said: string[] = [];
  push(adb, save(5), folder, (s: string) => said.push(s), new Date(1000));
  expect(there()).toBe(save(5));
  expect([beside(), here()]).toEqual([[save(9)], [save(9)]]);
  expect(said.join('\n')).toMatch(/第 9 天的店, day 9[^]*now has 第 5 天的店, day 5/);
  push(adb, save(6), folder, () => {}, new Date(2000));
  expect(there()).toBe(save(6));
  expect([beside(), here()]).toEqual([[save(9), save(5)], [save(9), save(5)]]);
  // Twice in the same moment: the second finds its name taken and stops.
  expect(() => push(adb, save(7), folder, () => {}, new Date(2000))).toThrow();
  expect(there()).toBe(save(6));
});

it('keeps a save it cannot read, and letters of any kind', () => {
  put('{"torn');
  push(adb, save(5, { x: `'"$HOME\`id\`\\ 😀 %2F\r\n` }), folder, () => {}, new Date(1000));
  expect(there()).toBe(save(5, { x: `'"$HOME\`id\`\\ 😀 %2F\r\n` }));
  expect([beside(), here()]).toEqual([['{"torn'], ['{"torn']]);
});

it('keeps the earlier save the app would go on from', () => {
  put('{"torn');
  writeFileSync(`${main()}.prev`, save(8));
  push(adb, save(5), folder, () => {}, new Date(1000));
  expect(there()).toBe(save(5));
  expect([beside().sort(), here().sort()]).toEqual([[save(8), '{"torn'].sort(), [save(8), '{"torn'].sort()]);
});

it('stops when the save cannot be read at all', () => {
  put(save(9));
  const never: Record<string, Adb> = {
    'fails': () => ({ code: 1, out: Buffer.from(''), why: 'error: closed' }),
    'is empty': () => ({ code: 0, out: Buffer.from(''), why: '' }),
    'is an error for an answer': () => ({ code: 0, out: Buffer.from('cat: files/save: No such file or directory\n'), why: '' }),
    'is half': (args, input) => { const done = adb(args, input); return { ...done, out: done.out.subarray(0, 40) }; },
  };
  for (const [how, read] of Object.entries(never)) {
    expect(() => push((args, input) => (args[1].includes(`cat "${fileOf(SAVE_KEY)}"`) ? read(args, input) : adb(args, input)), save(5), folder, () => {}, new Date(1000)), how).toThrow();
    expect([there(), beside(), here(), readdirSync(join(phone, 'files/save'))], how).toEqual([save(9), [], [], ['tiny-bean-cafe%2Fsave']]);
  }
  // A folder that cannot be looked into may have one.
  rmSync(main());
  chmodSync(join(phone, 'files/save'), 0o300);
  expect(() => push(adb, save(5), folder, () => {})).toThrow(/could not be read/);
  chmodSync(join(phone, 'files/save'), 0o755);
  expect(there()).toBe(null);
});

it('does nothing with what is no save, or to a build it cannot read', () => {
  put(save(9));
  for (const raw of ['', 'hello', save(5, { version: VERSION + 1 })]) expect(() => push(adb, raw, folder, () => {})).toThrow(/Not a save/);
  expect(calls).toEqual([]);
  writeFileSync(join(phone, 'release'), '');
  expect(() => push(adb, save(5), folder, () => {})).toThrow(/not the debug build: run-as: package not debuggable/);
  // Not even stopped.
  expect(calls.filter((c) => c.includes('force-stop'))).toEqual([]);
  expect([there(), beside(), here()]).toEqual([save(9), [], []]);
});

it('stops when the app saves meanwhile', () => {
  put(save(9));
  const late: Adb = (args, input) => {
    const done = adb(args, input);
    if (args[1].includes('.moving') && args[1].includes('cat >')) put(save(10));
    return done;
  };
  expect(() => push(late, save(5), folder, () => {})).toThrow(/saving meanwhile/);
  expect(there()).toBe(save(10));
  expect(readdirSync(join(phone, 'files/save')).filter((f) => f.endsWith('.moving'))).toEqual([]);
});

it('never loses a save, whichever command fails and however', { timeout: 120_000 }, () => {
  const faults: Record<string, (args: string[], input?: string | Buffer) => Said> = {
    'is not run': () => ({ code: 1, out: Buffer.from(''), why: 'error: closed' }),
    'is not run and says nothing': () => ({ code: 0, out: Buffer.from(''), why: '' }),
    'is run and says it failed': (args, input) => ({ ...adb(args, input), code: 255 }),
    'comes by half': (args, input) => { const done = adb(args, input); return { ...done, out: done.out.subarray(0, done.out.length >> 1) }; },
    'comes with noise': (args, input) => { const done = adb(args, input); return { ...done, out: Buffer.concat([Buffer.from('* daemon started *\n'), done.out]) }; },
    'writes by half': (args, input) => adb(args, input === undefined ? undefined : Buffer.from(input as Buffer).subarray(0, 20)),
  };
  let stopped = 0, tried = 0;
  for (const had of [save(9), null]) {
    calls = [];
    if (had) put(had);
    push(adb, save(5), folder, () => {}, new Date(1000));
    const ran = [...calls];
    expect(ran.length).toBeGreaterThan(had ? 10 : 7);
    for (const [how, fault] of Object.entries(faults)) for (let n = 0; n < ran.length; n++) {
      // Half a file only where one is written; without a save, only what could pass for "there is none".
      if (how === 'writes by half' && !ran[n].includes('cat >')) continue;
      if (!had && !how.startsWith('is not run')) continue;
      rmSync(join(phone, 'files'), { recursive: true, force: true });
      rmSync(folder, { recursive: true, force: true });
      if (had) put(had);
      let i = 0, failed = false;
      try { push((args, input) => (i++ === n ? fault(args, input) : adb(args, input)), save(5), folder, () => {}, new Date(1000)); } catch { failed = true; }
      const what = `${had ? 'with' : 'without'} a save, call ${n} ${how}`;
      tried++;
      if (failed) stopped++;
      // It worked, or the app still has its own café; and before that café was touched it was kept on both sides.
      if (!failed) expect(there(), what).toBe(save(5));
      else expect([had, save(5)], what).toContain(there());
      if (had && there() !== had) expect([beside(), here()], what).toEqual([[had], [had]]);
    }
    rmSync(join(phone, 'files'), { recursive: true, force: true });
    rmSync(folder, { recursive: true, force: true });
  }
  expect(stopped).toBeGreaterThan(tried / 2);
});

it('keeps saves on this computer without writing over any', () => {
  const path = keep(folder, 'web', save(1), new Date(1000));
  expect(readFileSync(path, 'utf8')).toBe(save(1));
  expect(() => keep(folder, 'web', save(2), new Date(1000))).toThrow();
  expect(here()).toEqual([save(1)]);
});
