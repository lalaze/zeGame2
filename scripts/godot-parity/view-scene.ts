// Runs the floors view's own scene (src/render/floors/floors-scene.ts) without a screen (fake-phaser.ts) over a running
// café, and writes down, frame by frame, where everyone and everything is, for `godot/tests/run_view_scene.gd` to repeat.
// Random choices of the view are always the same number of a film's own; the rules have their own source.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODS, call } from './mods';
import { EPOCH, IDS, Random, play, serviceOp, run, type Op, type Shot } from './ops';
import { lcg, wire } from './wire';
import { installPage, type GameObject } from './fake-phaser';
import type { GameState } from '../../src/game/state';
import type { Sim } from '../../src/game/sim';

type Any = any;
installPage();
const { FloorsScene, SHEETS } = await import('../../src/render/floors/floors-scene');
const { CafeView } = await import('../../src/render/cafe-view');
const { setOuterWall } = await import('../../src/ui/floors-ui');
const { setLocale } = await import('../../src/i18n');
const read = async (f: string) => (await fetch(`floor-sample-v1/build/${f}`)).json();
const n2 = (v: number) => Math.round(v * 100) / 100;
const pic = (o: GameObject | null | undefined) => (o && !o.gone ? [o.texture.key, String(o.frame.name), n2(o.x), n2(o.y), n2(o.alpha), o.flipX, o.visible] : null);
const actor = (a: Any) => [a.at.floor, n2(a.at.x), n2(a.at.y), a.goal, a.steps.length, n2(a.rate), n2(a.sunk ?? 0), ...pic(a.sprite)!.slice(0, 2), n2(a.sprite.alpha), a.sprite.flipX, a.sprite.visible, a.cup ? String(a.cup.frame.name) : ''];

/** What was to be seen in the frames that are compared; a film that shows none of it proves nothing about it. */
const occurred = new Set<string>();
function note(seen: Any): void {
  const list = (kind: string, of: Any[], goal: number, texture: number) => { for (const a of of) { occurred.add(`${kind} at ${String(a[goal]).replace(/[\d-]+$/, '').replace(/^seat-.*/, 'seat')}`); if (a[texture + 3] !== false) occurred.add(`${kind} drawn ${a[texture] === a[texture].replace(/-work$/, '') ? 'plain' : 'working'}`); if (a[4 + (goal - 3)] > 0) occurred.add(`${kind} walking`); } };
  list('guest', seen.customers, 4, 8); list('server', seen.servers, 3, 7); list('cook', seen.cooks, 3, 7);
  for (const a of seen.cooks) if (String(a[7]).endsWith('-work')) occurred.add(`cook ${String(a[7]).replace(/^.*?(chef|scarf).*$/, '$1')} cell ${a[8]}`);
  for (const p of seen.pool) occurred.add(`prop ${String(p[0]).replace(/:.*$/, '').replace(/\d+$/, '')}`);
  for (const c of seen.cats) occurred.add(`cat ${c[4]}${c[7] ? ' hopping' : ''}`);
  if (seen.visitor) occurred.add(`visitor ${seen.visitor[0]}`);
  for (const [what, is] of [['gift', seen.gifts.length], ['spill', seen.spill], ['cue', seen.cue], ['thought', seen.speaking.length], ['wall', seen.wall > 0], ['ghost', seen.ghost], ['oven glow', seen.glow]] as const) if (is) occurred.add(what);
}

/** One café: what the player does, and what its building shows. */
async function film(name: string, shot: Shot, frames: number, script: (i: number, kit: Any) => void, chance: number): Promise<string> {
  const rng = lcg(shot.seed * 13 + 5), sim = new (MODS.sim.Sim as new (r: () => number) => Sim)(rng), state = structuredClone(shot.state) as GameState;
  let clock = shot.now;
  Date.now = () => Math.floor(clock);
  Math.random = () => chance;
  setLocale('en'); setOuterWall(false);
  (MODS.layout.setSceneHeight as Any)(240);
  const restored = shot.snapshot ? sim.restore(structuredClone(shot.snapshot), state) : false;
  if (shot.snapshot && !restored) return '';
  const view = new CafeView() as Any, arrange: Any = { now: null };
  view.paused = false;
  const scene = new FloorsScene(view, sim, () => state, { tick() {}, interactionState: () => arrange.now, interactionEnabled: () => true } as Any, await read('sheets.json'), () => {}, (e: Error) => { throw e; }, await read('decor/decor.json'), await read('furniture/furniture.json')) as Any;
  scene.preload(); scene.arrive(); scene.create(); scene.arrive(); scene.resized();
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); // The painted props are here before the first frame.
  const lines: string[] = [JSON.stringify({ name, state: wire(shot.state), snapshot: wire(shot.snapshot), clock: wire(shot.now), seed: shot.seed * 13 + 5, chance, sheets: SHEETS.length })];
  const ops: unknown[] = [], act = (op: Op) => { ops.push(wire(op)); if (op[0] === '$VIEW') { const v = op[2] as Any;
    if (op[1] === 'wall') setOuterWall(v); else if (op[1] === 'paused') view.paused = v; else if (op[1] === 'moment') view.moment = v; else if (op[1] === 'reaction') view.momentReaction = v; else if (op[1] === 'arrange') arrange.now = v; else if (op[1] === 'ghost') view.ghost = v ? { col: 0, row: 0, ok: true, ...v } : null;
    else if (op[1] === 'table') view.tablePreview = v; else if (op[1] === 'gifts') view.gifts = v; else if (op[1] === 'affection') { const a = view.livingCats.actors.get(v[0]); if (a) a.affection = v[1]; else view.livingCats.actors.set(v[0], { affection: v[1] }); } else if (op[1] === 'happy') view.catHappy = v; else if (op[1] === 'select') { view.selectedCat = v; view.catSelectionSeconds = 6; } else if (op[1] === 'drag') { scene.focusY += v; scene.moved = true; scene.frameCamera(); } else if (op[1] === 'sad') for (const c of sim.customers as Any[]) if (v.includes(c.id)) { c.mood = 'sad'; c.moodTimer = 6; }
  } else try { run(op, state, clock, sim); } catch { /* an id the game never passes */ } };
  for (let i = 0; i < frames; i++) {
    const dt = [0.05, 0.1, 1 / 60][i % 3];
    clock += dt * 1000;
    script(i, { act, state, sim });
    if (!view.paused) for (let left = state.phase === 'prep' ? dt : dt * state.speed; left > 1e-6; left -= 0.05) view.addEvents(sim.update(state, Math.min(0.05, left)));
    if (view.livingCats.actors.size) for (const a of view.livingCats.actors.values()) if (!a.breed) a.affection = Math.max(0, a.affection - dt);
    view.catHappy = Math.max(0, view.catHappy - dt); view.catSelectionSeconds = Math.max(0, view.catSelectionSeconds - dt);
    scene.time.now += dt * 1000; scene.game.loop.delta = dt * 1000;
    scene.update(0, dt * 1000);
    if (!view.paused) scene.animate(dt);
    scene.arrive();
    await new Promise((r) => setImmediate(r));
    if (i % 5 || i < 10) { lines.push(JSON.stringify({ ...(ops.length ? { ops: ops.splice(0) } : {}), dt: wire(dt) })); continue; }
    const pool = [...scene.props.pool as Map<string, GameObject>].map(([k, o]) => [k, o.texture.key, String(o.frame.name), n2(o.x), n2(o.y), n2(o.displayWidth), n2(o.alpha), n2(o.rotation), o.flipX, o.crop ? n2(o.crop[2]) : 0]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const cats = [...(scene.cats.cats as Map<string, Any>)].map(([id, c]) => [id, c.at.floor, n2(c.at.x), n2(c.at.y), c.plan, c.place.id, c.steps.length, !!c.hop, n2(c.alpha), c.facingLeft, c.sprite ? String(c.sprite.frame.name) : '']);
    const seen = {
      customers: [...(scene.customers as Map<number, Any>)].map(([id, a]) => [id, ...actor(a)]), servers: scene.servers.map(actor), cooks: scene.cooks.map(actor), baristas: scene.baristas.map((s: GameObject) => pic(s)), pool, cats,
      visitor: scene.cats.visitor ? [scene.cats.visitor.plan, scene.cats.visitor.happy, String(scene.cats.visitor.sprite?.frame.name ?? '')] : null, gifts: [...scene.cats.gifts.values()].map((g: Any) => [g.id, n2(g.at.x), n2(g.at.y)]), spill: scene.cats.spill ? [scene.cats.spill.at.floor, n2(scene.cats.spill.at.x), n2(scene.cats.spill.at.y), n2(scene.cats.spill.image.depth), scene.cats.spill.image.flipX] : null,
      cue: scene.cue?.visible ? [scene.cue.texture.key, n2(scene.cue.x), n2(scene.cue.y)] : null, speaking: [...scene.thoughts.speaking], focus: n2(scene.focusY), wall: n2(scene.wallAlpha), floors: scene.built.floors, placed: scene.placed.map((p: Any) => [p.index, n2(p.sprite.x), n2(p.sprite.y), n2(p.sprite.scaleX), p.sprite.visible]), ghost: view.ghost?.spot ?? null,
      glow: scene.glow.visible, look: [scene.skyFx.look.outside, scene.skyFx.look.room, n2(scene.skyFx.look.lamps)], lamps: scene.skyFx.lamps.map((l: Any) => [n2(l.image.x), n2(l.image.y), n2(l.image.displayWidth), n2(l.image.alpha), l.image.tint]), depths: [...(scene.customers as Map<number, Any>)].map(([, a]) => n2(a.sprite.depth % 50000)),
    };
    note(seen);
    lines.push(JSON.stringify({ ...(ops.length ? { ops: ops.splice(0) } : {}), dt: wire(dt), seen }));
  }
  return `${lines.join('\n')}\n`;
}

const out = process.argv[2], only = process.argv[3];
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const shots: Shot[] = [];
for (let seed = 1; seed <= 30; seed++) play(seed, 9, (shot) => shots.push(shot));
const restores = (s: Shot) => new (MODS.sim.Sim as new (r: () => number) => Sim)(lcg(1)).restore(structuredClone(s.snapshot), structuredClone(s.state) as GameState);
const open = shots.filter((s) => s.snapshot && s.state.phase === 'open' && (s.customers as unknown[]).length > 3 && restores(s)), late = open.filter((s) => s.state.kitchen && (call('regions', 'activeTableIndices', [s.state]) as unknown[]).length > 4), pets = open.filter((s) => s.state.pets.length > 1), prep = shots.filter((s) => !s.snapshot && s.state.decor.placed.some((p) => p.spot));
const r = new Random(lcg(77)), pickOf = (list: Shot[], n: number) => Array.from({ length: n }, (_, i) => list[Math.floor(i * list.length / n)]).filter(Boolean);
// New people's pictures take a frame or two to come, so nobody is hired just before a frame that is compared.
const films: [string, Shot, number, (i: number, kit: Any) => void][] = [
  ...pickOf(open, 6).map((s, i): [string, Shot, number, (i: number, k: Any) => void] => [`open-${i}`, s, 900, (f, { act, state, sim }) => { if (f % 60 === 30) act(['$STATE', 'speed', r.pick([1, 2, 4])]); if (f % 25 === 1 && r.chance(0.4)) act(serviceOp(state, sim, r)); }]),
  ...pickOf(late, 6).map((s, i): [string, Shot, number, (i: number, k: Any) => void] => [`late-${i}`, s, 900, (f, { act, sim }) => {
    if (f === 40) act(['$VIEW', 'wall', true]); if (f === 90) act(['$VIEW', 'wall', false]); if (f === 120) act(['$VIEW', 'drag', -700]); if (f === 200) act(['$VIEW', 'paused', true]); if (f === 230) act(['$VIEW', 'paused', false]);
    if (f === 260 && sim.customers.length) act(['$VIEW', 'moment', { kind: 'photo', customerId: sim.customers[0].id, options: [], age: 0 }]); if (f === 300) act(['$VIEW', 'moment', { kind: 'delivery', options: [], age: 0 }]); if (f === 340) act(['$VIEW', 'moment', null]); if (f === 400 && sim.customers.length) act(['$VIEW', 'reaction', { customerId: sim.customers[0].id, key: 'moment.photo.thanks', context: 'moment:1', ttl: 3 }]); if (f === 460) act(['$VIEW', 'reaction', null]); if (f === 520) act(['$VIEW', 'sad', sim.customers.map((c: Any) => c.id)]);
  }]),
  ...pickOf(late, 3).map((s, i): [string, Shot, number, (i: number, k: Any) => void] => [`cooks-${i}`, s, 900, (f, { act, state }) => {
    // A full bakery with nothing on its shelf, early in the day: both cooks are at work.
    if (f === 1) { const baked = (MODS.data.MENU as Any[]).filter((m) => call('economy', 'isBakery', [m.id])).map((m) => m.id);
      act(['$STATE', 'items', { ...state.items, ...Object.fromEntries(baked.map((id) => [id, 5])) }]); act(['$STATE', 'onMenu', [...state.onMenu.filter((id: string) => !baked.includes(id)), ...baked]]); act(['$STATE', 'pantry', Object.fromEntries(Object.keys(state.pantry).map((id) => [id, 5000]))]);
      act(['$STATE', 'upgrades', { ...state.upgrades, cook: Math.max(1, state.upgrades.cook) }]); act(['$STATE', 'shelf', {}]); act(['$STATE', 'orders', { ...state.orders, active: { kind: (['office', 'tea', 'banquet'] as const)[i], item: state.onMenu[0], servings: 12, cost: 10, payout: 90, finishAt: s.now - 1000 } }]); act(['$STATE', 'dayTime', 20]); act(['$STATE', 'speed', [1, 2, 4][i]]); }
    if (f === 450) act(['$STATE', 'shelf', {}]);
  }]),
  ...pickOf(pets, 4).map((s, i): [string, Shot, number, (i: number, k: Any) => void] => [`cats-${i}`, s, 1500, (f, { act, state }) => {
    const id = state.pets[0]?.id; if (f === 100) act(['$VIEW', 'affection', [id, 2]]); if (f === 180) act(['$VIEW', 'select', id]); if (f === 300) act(['$VIEW', 'gifts', [{ id: 3, cat: id, kind: 'coin', spot: 0 }, { id: 4, cat: id, kind: 'leaf', spot: 2 }]]); if (f === 420) act(['$VIEW', 'gifts', []]); if (f === 500) act(['$VIEW', 'moment', { kind: 'cat', options: [], spot: { x: 1, y: 1, area: 'main', catId: id }, age: 0 }]); if (f === 620) act(['$VIEW', 'moment', null]);
    if (f === 800) act(['$STATE', 'pets', []]); if (f === 850) act(['$VIEW', 'happy', 2]); if (f === 1000 && i % 2) act(['pets', 'adoptCat', '$S', IDS.cat[3]]);
  }]),
  ...pickOf(prep, 4).map((s, i): [string, Shot, number, (i: number, k: Any) => void] => [`prep-${i}`, s, 420, (f, { act, state }) => {
    if (f === 20) act(['$VIEW', 'table', true]); if (f === 60) act(['$VIEW', 'table', false]); if (f === 80) act(['$VIEW', 'arrange', { mode: 'browse' }]); const id = state.decor.placed[0]?.id;
    if (f === 110 && id) { act(['$VIEW', 'arrange', { mode: 'place', id, moving: 0 }]); act(['$VIEW', 'ghost', { id, skip: 0 }]); } if (f === 120) act(['$VIEW', 'wall', true]); if (f === 161) { act(['$VIEW', 'ghost', null]); act(['$VIEW', 'arrange', null]); } if (f === 190) act(['$VIEW', 'wall', false]);
    if (f === 400 && id) { act(['$VIEW', 'drag', 2500]); act(['$VIEW', 'arrange', { mode: 'place', id, moving: 0 }]); act(['$VIEW', 'ghost', { id, skip: 0 }]); }
    if (f === 200) { act(['economy', 'earn', '$S', 1e9]); act(['economy', 'buyUpgrade', '$S', 'tables', 1]); } if (f === 240) act(['kitchen', 'unlockKitchen', '$S']); if (f === 281) act(['economy', 'buyUpgrade', '$S', 'machine', 10]); if (f === 311) act(['economy', 'buyUpgrade', '$S', 'cook', 1]); if (f === 340) act(['decor', 'applyTheme', '$S', IDS.theme[(i + 1) % IDS.theme.length]]); if (f === 370) act(['furniture', 'settleInBuilding', '$S']);
  }]),
];
let frames = 0, done = 0;
for (const [name, shot, n, script] of films) {
  if (only && !name.startsWith(only)) continue;
  const text = await film(name, shot, n, script, name.startsWith('cats-') ? [.5, .04, .96, .3][Number(name.slice(5))] : .5);
  if (!text) { console.error(`No snapshot for ${name}`); process.exit(1); }
  writeFileSync(join(out, `${name}.jsonl`), text);
  done++; frames += n;
}
void EPOCH;
/** What the films have to show: a film of cooks who never left the oven would prove nothing about the oven. */
const MUST = ['cat groom', 'cat nap', 'cat nap hopping', 'cat roam', 'cat roam hopping', 'cat watch', 'cook at home', 'cook at station-cold', 'cook at station-dough', 'cook at station-dry', 'cook at station-lift', 'cook at station-oven',
  ...[0, 1, 2, 4, 5, 6, 7].map((n) => `cook chef cell ${n}`), ...[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `cook scarf cell ${n}`), 'cook drawn plain', 'cook drawn working', 'cook walking', 'cue', 'ghost', 'gift',
  'guest at counter', 'guest at door', 'guest at queue', 'guest at seat', 'guest walking', 'oven glow', ...['ack', 'bake', 'batch', 'bell', 'brew', 'case', 'dish', 'drink', 'drop', 'food', 'jar', 'made', 'map', 'order', 'out', 'parcel', 'pass', 'say', 'tent', 'think', 'tray', 'vip'].map((p) => `prop ${p}`),
  'server at home', 'server at pass', 'server at table', 'server walking', 'spill', 'thought', 'visitor groom', 'visitor watch', 'wall'];
const missing = only ? [] : MUST.filter((m) => !occurred.has(m));
if (missing.length) { console.error(`Never seen in any film: ${missing.join(', ')}`); process.exit(1); }
console.log(JSON.stringify({ films: done, frames }));
