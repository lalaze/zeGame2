// Proves the step-by-step checks fail when they should: recorded runs that lie, and Godot rules with one thing wrong.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GODOT, PROJECT, background, importProject, judge } from './run.mjs';

/** One thing wrong in a file of `godot/`, and the recorded runs of which one must notice. */
export const LOCKSTEP_TRAPS = [
  ['core/sim.gd', /_boost_cooldown = 1\.0/, '_boost_cooldown = 1.001', 'actions-1 edge-1'],
  ['core/sim.gd', /func _rand_int\(n: float\) -> float:\n/, 'func _rand_int(n: float) -> float:\n\t_rng.call()\n', 'early-1'],
  ['core/sim.gd', /c\["mood"\] = "sad"/, 'c["mood"] = "happy"', 'edge-1'],
  ['core/sim_snapshot.gd', /return true\n*$/, 'return false\n', 'reload-1'],
  ['core/moments.gd', /_GAP_MIN := 20\.0/, '_GAP_MIN := 20.5', 'cats-1'],
  ['core/moments.gd', /_deliveries \+= 1\.0/, '_deliveries += 2.0', 'early-1 mid-1 late-1 actions-1'],
  ['core/living_cats.gd', /const _CLEARANCE := 4\.0/, 'const _CLEARANCE := 4.5', 'cats-1'],
  ['core/living_cats.gd', /_guest_cooldown - dt\)/, '_guest_cooldown - dt * 1.001)', 'cats-1'],
  ['core/operations.gd', /state\["dayTime"\] - _since >= 3\.0/, 'state["dayTime"] - _since >= 3.1', 'mid-1 late-1 edge-1 actions-1'],
  ['core/navigation.gd', /static func segment_crosses_obstacle\(([^\n]*)\n/, 'static func segment_crosses_obstacle($1\n\tb = b.duplicate()\n\tb["x"] += 0.001\n', 'cats-1 cats-2 edge-1 reload-1'],
];
export const SESSION_TRAPS = [
  ['core/game_session.gd', /MANAGER_DELAY := 4\.0/, 'MANAGER_DELAY := 4.3', 'grow-1'],
  ['core/game_session.gd', /AUTOSAVE_SECONDS := 5\.0/, 'AUTOSAVE_SECONDS := 5.2', 'careful-1'],
  ['core/game_session.gd', /\t_away_settled = false\n/, '\tpass\n', 'everything-1'],
  ['core/game_session.gd', /if not street_open:\n/, 'if true:\n', 'everything-1 everything-2 grow-1'],
  ['core/game_session.gd', /\tif not open:\n\t\tmonitor\.reset\(\)\n/, '', 'everything-1'],
  ['core/save_session.gd', /payload\["runtime"\] = sim\.snapshot\(to_save\)/, 'sim.snapshot(to_save)', 'everything-1'],
  ['core/save_session.gd', /\tif not _same\(current\["value"\], _expected\):\n\t\tclose\(\)\n\t\treturn "conflict"\n/, '', 'everything-1 everything-2 everything-3 everything-4 grow-1 grow-2'],
  ['core/game_session.gd', /\t\tarranging = false\n/, '', 'tour-1'],
  ['core/game_session.gd', /\tpanel_collapsed = true\n/, '', 'tour-1'],
  ['core/game_session.gd', /\tscene_area = "main"\n/, '', 'tour-1'],
  ['core/game_session.gd', /\tif not CoreManager\.manager_runs_days\(state\):\n\t\tprepare_day\(\)\n/, '\tpass\n', 'tour-1'],
  ['core/game_session.gd', /\t\tsim\.resize_scene\(previous\)\n/, '\t\tpass\n', 'tour-1'],
  ['core/game_session.gd', /\tif unsettled_furniture > 0\.0:\n/, '\tif false:\n', 'tour-1'],
  ['core/save_session.gd', /\["reserved"\] = 0\.0/, '["reserved"] += 0.0', 'tour-1'],
  ['core/day.gd', /state\["dayTime"\] = 0\.0\n(?![\s\S]*state\["dayTime"\] = 0\.0)/, 'state["dayTime"] = 0\n', 'careful-1'],
  ['core/storage.gd', /"ok": not fail_reads/, '"ok": true', 'everything-1 everything-2 everything-3 grow-1'],
];

/** Runs every trap; returns the first that nothing noticed, or null. `where` finds the folder of a recorded run. */
export async function traps(list, script, dirs) {
  const problems = [], expect = (label, caught) => { console.log(`  ${caught ? 'caught' : 'MISSED'}: ${label}`); if (!caught) problems.push(label); };
  const find = (name) => dirs.find((d) => existsSync(join(d, `${name}.jsonl`)));
  const play = (project, dir, only) => background(GODOT, ['--headless', '--path', project, '--script', `res://tests/${script}`, '--', `--dir=${dir}`, `--only=${only}`]);
  const temp = mkdtempSync(join(tmpdir(), 'lockstep-'));
  try {
    // A run that lies about one step.
    const run = list[0][3].split(' ')[0], source = readFileSync(join(find(run), `${run}.jsonl`), 'utf8').trimEnd().split('\n');
    const lie = async (label, change) => {
      const dir = join(temp, label.replace(/\W+/g, '-')), lines = [...source];
      mkdirSync(dir); change(lines);
      writeFileSync(join(dir, `${run}.jsonl`), `${lines.join('\n')}\n`);
      return judge(await play(PROJECT, dir, `${run}.`), label);
    };
    const edit = (lines, f) => { const at = Math.min(60, lines.length - 1), line = JSON.parse(lines[at]); f(line); lines[at] = JSON.stringify(line); };
    const flip = (s) => (s[0] === '0' ? '1' : '0') + s.slice(1);
    const [same, state, sim, around, drawn] = await Promise.all([lie('as recorded', (l) => l.splice(90)), lie('another state', (l) => edit(l, (x) => { x.s = flip(x.s); })), lie('another simulation', (l) => edit(l, (x) => { x.i = flip(x.i); })),
      lie('other moments or cats', (l) => edit(l, (x) => { x.x = flip(x.x); })), lie('one random number more', (l) => edit(l, (x) => { x.d[0]++; }))]);
    expect('an honest run passes', same === null);
    for (const [label, verdict] of [['another state', state], ['another simulation', sim], ['other moments or cats', around], ['one random number more', drawn]]) expect(label, !!verdict);

    const good = join(temp, 'project');
    for (const part of ['core', 'tests', 'data', 'scripts/file_store.gd']) cpSync(join(PROJECT, part), join(good, part), { recursive: true });
    writeFileSync(join(good, 'project.godot'), 'config_version=5\n');
    importProject(good);
    for (let at = 0; at < list.length; at += 5) await Promise.all(list.slice(at, at + 5).map(async ([file, what, instead, name], n) => {
      const project = join(temp, `trap-${at + n}`), text = readFileSync(join(good, file), 'utf8'), label = `${file.replace('core/', '')}: ${instead.trim().split('\n').pop()?.trim() || 'a step left out'}`;
      const wrong = text.replace(what, instead);
      if (wrong === text) { expect(`${label} (no such code any more)`, false); return; }
      cpSync(good, project, { recursive: true });
      writeFileSync(join(project, file), wrong);
      let caught = false;
      for (const one of name.split(' ')) if (!caught && find(one)) caught = /differences/.test(judge(await play(project, find(one), `${one}.`), label) ?? '');
      expect(label, caught);
    }));
  } finally { rmSync(temp, { recursive: true, force: true }); }
  return problems.length ? `Not noticed: ${problems.join('; ')}` : null;
}
