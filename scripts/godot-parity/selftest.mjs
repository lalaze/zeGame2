// Proves the parity checks fail when they should: each trap below breaks one thing and must be reported.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PARITY_DIR } from './bundle.mjs';
import { PROJECT, godot, importProject, judge } from './run.mjs';
import { branchGate, checkGate, moduleGate } from './gate.mjs';

/** A module's vectors, whichever process wrote them. */
const vectors = (mod) => {
  const dir = readdirSync(PARITY_DIR).find((d) => d.startsWith('cases-') && existsSync(join(PARITY_DIR, d, `${mod}.json`)));
  return JSON.parse(readFileSync(join(PARITY_DIR, dir, `${mod}.json`), 'utf8'));
};
const ulp = (hex) => { const b = Buffer.from(hex.slice(1), 'hex'); b.writeBigUInt64LE(b.readBigUInt64LE() + 1n); return `#${b.toString('hex')}`; };

export function selftest() {
  const problems = [], expect = (label, caught) => { console.log(`  ${caught ? 'caught' : 'MISSED'}: ${label}`); if (!caught) problems.push(label); };
  const compare = godot(['--script', 'res://tests/run_parity_selftest.gd']);
  process.stdout.write(compare.stdout);
  expect('the comparer tells values, keys, order, zeros and random draws apart', judge(compare, 'compare') === null);

  // Vectors that lie.
  const dir = mkdtempSync(join(tmpdir(), 'parity-'));
  try {
    const from = vectors;
    const lie = (label, mod, change) => {
      const cases = join(dir, label.replace(/\W+/g, '-')), data = from(mod), manifest = [{ name: mod, cases: data.cases.length, constants: Object.keys(data.constants).length }];
      mkdirSync(cases);
      const list = change(data, manifest) ?? manifest;
      writeFileSync(join(cases, `${mod}.json`), JSON.stringify(data));
      writeFileSync(join(cases, 'manifest.json'), JSON.stringify(list));
      return judge(godot(['--script', 'res://tests/run_parity.gd', '--', `--dir=${cases}`]), label);
    };
    expect('unchanged vectors pass', lie('unchanged', 'traffic', () => {}) === null);
    expect('a result one ulp off', !!lie('ulp', 'traffic', (d) => { const c = d.cases.find((x) => typeof x.r === 'string'); c.r = ulp(c.r); }));
    expect('a changed argument that should have stayed', !!lie('after', 'pets', (d) => { const c = d.cases.find((x) => x.f === 'updatePetCare' && x.b); delete c.b; }));
    expect('one field missing after the call', !!lie('field', 'pets', (d) => {
      const c = d.cases.find((x) => x.f === 'adoptCat' && x.b), state = { ...d.pool[c.b[0]['#p']] }; delete state.coins; d.pool.push(state); c.b[0] = { '#p': d.pool.length - 1 };
    }));
    expect('keys in another order', !!lie('order', 'pets', (d) => {
      const c = d.cases.find((x) => x.f === 'adoptCat' && x.b), state = d.pool[c.b[0]['#p']]; d.pool.push(Object.fromEntries(Object.entries(state).reverse())); c.b[0] = { '#p': d.pool.length - 1 };
    }));
    expect('one random number more', !!lie('draws', 'customer-cast', (d) => { d.objects[0].d++; }));
    expect('a constant that drifted', !!lie('constant', 'traffic', (d) => { d.constants.TRAFFIC_CYCLE_SECONDS++; }));
    expect('an export nobody ported', !!lie('unported', 'traffic', (d) => { d.cases[0].f = 'trafficTomorrow'; }));
    expect('cases that went missing', !!lie('missing', 'traffic', (d) => { d.cases.pop(); }));
    expect('no cases at all', !!lie('none', 'traffic', (_d, m) => { m.length = 0; }));
    expect('module state left changed', !!lie('globals', 'layout', (d) => { d.cases.find((x) => x.f === 'setSceneHeight').g[0] = 241; }));
  } finally { rmSync(dir, { recursive: true, force: true }); }

  // Godot code that misbehaves, in a copy of the project.
  const project = mkdtempSync(join(tmpdir(), 'parity-project-'));
  try {
    for (const part of ['core', 'tests', 'data', 'project.godot']) cpSync(join(PROJECT, part), join(project, part), { recursive: true });
    writeFileSync(join(project, 'project.godot'), 'config_version=5\n');
    mkdirSync(join(project, '.parity/cases'), { recursive: true });
    writeFileSync(join(project, '.parity/cases/traffic.json'), JSON.stringify(vectors('traffic')));
    const broken = (label, body) => {
      const file = join(project, 'core/traffic.gd'), good = readFileSync(file, 'utf8');
      writeFileSync(file, good.replace(/(static func traffic_at\([^\n]*\n)/, `$1${body}`));
      writeFileSync(join(project, '.parity/cases/manifest.json'), JSON.stringify([{ name: 'traffic', ...counts('traffic') }]));
      const verdict = judge(godot(['--script', 'res://tests/run_parity.gd'], project), label);
      writeFileSync(file, good);
      return verdict;
    };
    const counts = (mod) => { const d = vectors(mod); return { cases: d.cases.length, constants: Object.keys(d.constants).length }; };
    importProject(project);
    expect('the copy passes as it is', broken('copy', '') === null);
    expect('a script error', !!broken('error', '\tif day_time > 100.0:\n\t\tvar nothing: Variant = null\n\t\treturn nothing.missing\n'));
    expect('a script that does not parse', !!broken('parse', '\tthis is not gdscript\n'));
    expect('quitting halfway', !!broken('quit', '\tif day_time > 100.0:\n\t\tOS.kill(OS.get_process_id())\n'));
  } finally { rmSync(project, { recursive: true, force: true }); }

  // The gate.
  const tally = (cases, ...outcomes) => ({ cases, outcomes: new Set(outcomes), mutated: 0 });
  const gate = (tallies, functions = {}, elsewhere = {}) => checkGate('m', { f: (x) => x }, new Map(Object.entries(tallies)), { modules: ['m'], functions, elsewhere }).length;
  expect('an export without cases', gate({}) > 0);
  expect('an export compared elsewhere passes', gate({}, {}, { 'm.f': 'why' }) === 0);
  expect('compared elsewhere, but not exported', gate({ f: tally(90, '1', '2', '3') }, {}, { 'm.g': 'why' }) > 0);
  const ported = (found, modules, notPorted = {}) => moduleGate(found, { modules, notPorted }).length;
  expect('a new module nobody ported', ported(['m', 'n'], ['m']) > 0);
  expect('a module left out without a reason', ported(['m', 'n'], ['m'], { n: '' }) > 0);
  expect('a listed module that is gone', ported(['m'], ['m', 'n']) > 0 && ported(['m'], ['m'], { n: 'why' }) > 0);
  expect('every module ported or explained passes', ported(['m', 'n'], ['m'], { n: 'why' }) === 0);
  expect('too few cases', gate({ f: tally(5, '1', '2', '3') }) > 0);
  expect('always the same answer', gate({ f: tally(90, '1') }) > 0);
  expect('a yes/no that never says no', gate({ f: tally(90, 'true') }) > 0);
  expect('an exception that is no longer needed', gate({ f: tally(90, '1', '2', '3') }, { 'm.f': { outcomes: 2, reason: 'x' } }) > 0);
  expect('an exception without a reason', gate({ f: tally(90, '1', '2') }, { 'm.f': { outcomes: 2 } }) > 0);
  const part = (map, ...branches) => ({ map, branches: branches.map((at) => ({ key: `m:${at}: x`, at })) });
  expect('a branch no case reached', branchGate([part([1, 1, 0], 2), part([1, 1, 0], 2)], {}, ['m']).length === 1);
  expect('a branch inside a function another process never calls', branchGate([part([1, 1, 0], 2), part([0, 0, 0], 0)], {}, ['m']).length === 1);
  expect('a branch another process reached passes', branchGate([part([1, 1, 0], 2), part([1, 1, 1])], {}, ['m']).length === 0);
  expect('an allowed branch that is reached now', branchGate([part([1, 1, 1])], { branches: { 'm:2: x': 'why' } }, ['m']).length === 1);
  expect('a healthy function passes', gate({ f: tally(90, '1', '2', '3') }) === 0);
  return problems.length ? `The parity checks missed: ${problems.join('; ')}` : null;
}
