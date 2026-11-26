// Writes what the TypeScript simulation does, step by step, for `godot/tests/run_lockstep.gd` to repeat.
// Each run is a starting state, a seed and a list of steps; every step may carry player actions. After each one the
// state, the whole simulation, the café moments, the cats, the operation status, the events and the number of random
// numbers drawn are compared. Arguments: where to write, which part of how many, and the start of the runs' names.
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reached, startCoverage, stretches } from './coverage';
import { damage } from './damage';
import { MODS, call } from './mods';
import { EPOCH, IDS, Random, play, prepOp, run, serviceOp, type Op, type Shot } from './ops';
import { lcg, wire } from './wire';
import type { LivingCats } from '../../src/game/living-cats';
import type { MomentDirector, MomentStage } from '../../src/game/moments';
import type { OperationMonitor } from '../../src/game/operations';
import type { GameState } from '../../src/game/state';
import type { Sim } from '../../src/game/sim';

type Dict = Record<string, unknown>;
type Any = (...a: unknown[]) => unknown;
startCoverage();
const layout = MODS.layout as Record<string, Any>;
/** Everything a Sim holds, private fields too. */
export const inside = (sim: Sim): Dict => {
  const s = sim as unknown as Dict & { customerCast: { snapshot(): unknown } };
  return { customers: s.customers, baristas: s.baristas, queue: s.queue, seats: s.seats, servers: s.servers, pass: s.pass, cooks: s.cooks, rack: s.rack, spawnTimer: s.spawnTimer, nextId: s.nextId,
    castRandomState: s.castRandomState, boostCooldown: s.boostCooldown, kitchenStage: s.kitchenStage, navigationTables: s.navigationTables, cast: s.customerCast.snapshot() };
};
const SMALL = (MODS.furniture.FURNITURE as { id: string; surface: string; w: number; h: number }[]).filter((f) => f.surface === 'floor').sort((a, b) => a.w * a.h - b.w * b.h)[0].id;
const WALL = (MODS.furniture.FURNITURE as { id: string; surface: string }[]).find((f) => f.surface === 'wall')!.id;
/** What the game reads from a Sim without changing it: poses, help, trial and furniture questions. */
const queries = (sim: Sim, state: GameState): unknown => [
  sim.finishedService, sim.helpReady, sim.queueChoices().map((c) => c.id), sim.queueChoices(1).map((c) => c.id), sim.customers.map((c) => sim.canOfferTrialTo(state, c.id)), sim.canOfferTrialTo(state, -5),
  [...sim.baristas.keys(), 9].map((i) => [sim.isHolding(i), sim.isBrewing(i), sim.baristaPose(i)]), [...sim.cooks.keys(), 9].map((i) => sim.cookStation(i)),
  sim.customers.map((c) => (MODS.sim.seated as Any)(c)), [0, 3, 9, 14, 22, 36, NaN, 900].map((col) => sim.furnitureSpaceClear('catbed', col, (col * 7) % 11)), sim.furnitureSpaceClear('catbed', 4, Infinity), sim.furnitureSpaceClear('nothing', 1, 1), sim.furnitureSpaceClear(WALL, 1, 1),
];
interface Social { moments: MomentDirector; cats: LivingCats; monitor: OperationMonitor }
const around = ({ moments, cats, monitor }: Social, walls: boolean): Dict => {
  const m = moments as unknown as Dict & { offered: Set<number> }, c = cats as unknown as Record<string, Map<unknown, unknown>> & { reselectAfterArrival: Set<unknown>; greetedGuests: Set<unknown> }, o = monitor as unknown as Dict;
  return {
    moments: [m.active, m.reaction, m.since, m.nextGap, [...m.offered], m.deliveries, m.last, m.day, m.serial, m.recommended],
    cats: [[...c.actors], [...c.arrivals], [...c.preferences], [...c.reselectAfterArrival], c.height, [...c.guests], [...c.guestBindings], [...c.guestCooldowns], [...c.greetedGuests], c.guestCooldown, [...c.blockedSeconds]],
    ...(walls ? { walls: [c.signature, [...c.geometry]] } : {}),
    monitor: [o.candidate, o.since, o.current],
  };
};
/** As `momentStage` in src/main.ts, for a given room on screen. */
function stageOf(state: GameState, cats: LivingCats, area: MomentStage['area']): MomentStage {
  const spot = layout.CAT_SPOT as unknown as { x: number; y: number };
  return { area, cats: state.pets.length
    ? [...cats.actors.values()].filter((cat) => cat.area === area && !cat.route.length && !cat.interaction && !cat.resting && state.pets.some((p) => p.id === cat.id && (MODS.pets.petActive as Any)(p)))
      .map((cat) => ({ id: cat.id, x: cat.x, y: cat.y, area: cat.area }))
    : area === 'main' ? [{ id: 'window', x: spot.x, y: spot.y, area: 'main' as const, sill: true }] : [] };
}
/** A short name for a value's exact bits and key order; Godot computes the same one. */
export const digest = (v: unknown): string => createHash('sha256').update(canon(v)).digest('hex').slice(0, 20);
const view = Buffer.alloc(8);
function canon(v: unknown): string {
  if (v === undefined) return 'u';
  if (v === null) return 'n';
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (typeof v === 'number') { view.writeDoubleLE(Number.isNaN(v) ? NaN : v); return Number.isNaN(v) ? 'd000000000000f87f' : `d${view.toString('hex')}`; }
  if (typeof v === 'string') return `s${JSON.stringify(v)}`;
  if (Array.isArray(v)) return `[${v.map(canon).join()}]`;
  return `{${Object.keys(v as Dict).filter((k) => typeof (v as Dict)[k] !== 'function').map((k) => `${k}:${canon((v as Dict)[k])}`).join()}}`; // Functions are code, not data.
}

interface Run { name: string; state: GameState; seed: number; dt: number; height: number; clock: number; steps: number; ops(step: number, s: GameState, sim: Sim, r: Random, x: Social): Op[]; resume?: unknown; /** Goes on after the day, through preparing and opening again. */ through?: boolean }
const called = new Set<string>();

function record(spec: Run): { text: string; steps: number } {
  const state = structuredClone(spec.state), rng = lcg(spec.seed), mrng = lcg(spec.seed * 7 + 3), crng = lcg(spec.seed * 11 + 5), r = new Random(lcg(spec.seed * 13 + 1));
  const SimClass = MODS.sim.Sim as new (rng: () => number) => Sim;
  layout.setSceneHeight(spec.height); layout.setKitchenLevel(0); Date.now = () => spec.clock;
  let sim = new SimClass(rng), area: MomentStage['area'] = 'main', crowd: { x: number; y: number }[] = [];
  const x: Social = { moments: new (MODS.moments.MomentDirector as new (rng: () => number) => MomentDirector)(mrng), cats: new (MODS['living-cats'].LivingCats as new (rng: () => number) => LivingCats)(crng),
    monitor: new (MODS.operations.OperationMonitor as new () => OperationMonitor)() };
  const start = { state: wire(state), seed: spec.seed, dt: wire(spec.dt), height: wire(spec.height), clock: wire(spec.clock), resume: wire(spec.resume) };
  const lines: string[] = [], draws = () => [rng.draws(), mrng.draws(), crng.draws()];
  const restored = spec.resume === undefined ? undefined : sim.restore(structuredClone(spec.resume), state);
  for (let i = 0; i < (heads ? 0 : spec.steps); i++) {
    const did: unknown[] = [];
    let catTime: unknown = spec.dt, realTime: unknown = spec.dt, simTime: unknown = spec.dt, dt = spec.dt;
    for (const op of spec.ops(i, state, sim, r, x)) {
      const sent = wire(op);
      let ret: unknown;
      const args = op.slice(2).map((a) => (a === '$S' ? state : a === '$SIM' ? sim : a));
      if (op[1] === '$reload') { // Saves the running service, reads it back as a save would, and continues in a new Sim.
        const saved = JSON.parse(JSON.stringify(sim.snapshot(state))); sim = new SimClass(rng); ret = sim.restore(saved, state);
      } else if (op[1] === '$resize') { const from = layout.sceneHeight() as number; layout.setSceneHeight(op[2] as number); sim.resizeScene(from); ret = null; }
      else if (op[0] === '$LOOK') { area = op[1] === '' ? null : op[1] as MomentStage['area']; ret = null; }
      else if (op[0] === '$TIME') { ret = null; if (op[1] === 'cats') catTime = op[2]; else if (op[1] === 'real') realTime = op[2]; else if (op[1] === 'step') dt = op[2] as number; else simTime = op[2]; }
      else if (op[0] === '$GUESTS') { const c = sim.customers.find((g) => g.id === op[2]); if (c) (c as unknown as Dict)[op[1]] = op[3]; ret = null; }
      else if (op[0] === '$CAT') { const a = x.cats.actors.get(op[1] as never); if (a) { a.x = op[2] as number; a.y = op[3] as number; } ret = null; }
      else if (op[0] === '$CROWD') { crowd = structuredClone(op[2]) as { x: number; y: number }[]; ret = null; }
      else if (op[0] === '$PUT') { const at = (state as unknown as Record<string, Dict>)[op[1]]; if (op[3] === undefined) delete at[op[2] as string]; else at[op[2] as string] = op[3]; ret = null; }
      else if (op[0] === '$GIVE') { (state.decor.stored as Dict)[op[1]] = 1; ret = null; }
      else if (op[0] === '$PET') { const pet = state.pets.find((p) => p.id === op[1]); if (pet) (pet as unknown as Dict)[op[2] as string] = op[3]; ret = null; }
      else if (op[0] === '$PETS') { state.pets = structuredClone(op[2]) as GameState['pets']; ret = null; }
      else if (op[0] === '$MOM') ret = (x.moments as unknown as Record<string, Any>)[op[1]](...args);
      else if (op[0] === '$CATS') ret = (x.cats as unknown as Record<string, Any>)[op[1]](...args);
      else if (op[0] === '$MON') ret = (x.monitor as unknown as Record<string, Any>)[op[1]](...args);
      else try { ret = run(op, state, spec.clock, sim); } catch { continue; }
      did.push({ op: sent, ret: digest(ret) });
    }
    const events = sim.update(state, dt);
    x.monitor.update(state, sim);
    x.moments.update(state, sim, simTime as number, realTime as number, stageOf(state, x.cats, area));
    x.cats.update(state, catTime as number, crowd.length ? { customers: sim.customers, servers: [...sim.servers, ...crowd] } : sim);
    const social = around(x, i % 40 === 0), asked = i % 10 === 0 ? queries(sim, state) : undefined;
    if (process.env.LOCKSTEP_DUMP === `${spec.name}:${lines.length + 1}`) writeFileSync(join(out, 'dump.json'), JSON.stringify({ i: wire(inside(sim)), s: wire(state), e: wire(events), x: wire(social), q: wire(asked) }));
    lines.push(JSON.stringify({ ...(did.length ? { ops: did } : {}), s: digest(state), i: digest(inside(sim)), e: events.length ? digest(events) : 0, x: digest(social), ...(i % 40 === 0 ? { w: 1 } : {}), ...(asked ? { q: digest(asked) } : {}), d: draws() }));
    if (state.phase === 'prep' && !spec.through) break;
    if (state.phase === 'closing' && sim.finishedService) {
      const report = sim.closeShop(state);
      lines.push(JSON.stringify({ close: digest(report), s: digest(state), i: digest(inside(sim)), x: digest(around(x, true)), d: draws() }));
    }
  }
  return { text: `${JSON.stringify({ name: spec.name, ...start, restored: wire(restored) })}\n${lines.join('\n')}\n`, steps: lines.length };
}

// ---------------------------------------------------------------- what to run

const out = process.argv[2], part = Number(process.argv[3] ?? 0), parts = Number(process.argv[4] ?? 1), only = process.argv[5], heads = process.argv[6] === '--heads';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const shots: Shot[] = [];
for (let seed = 1; seed <= 24; seed++) play(seed, 14, (shot) => shots.push(shot));
const openable = (s: GameState) => { const out = structuredClone(s); out.phase = 'prep'; call('economy', 'restock', [out]); return (call('day', 'checkOpen', [out]) as { reason?: string }).reason !== 'emptyMenu' ? out : null; };
/** The same café made big: every room, full staff, a long menu, plenty of stock. */
function grand(s: GameState, r: Random): GameState {
  const out = structuredClone(s);
  out.kitchen = true; out.day = Math.max(out.day, 20);
  for (const u of MODS.data.UPGRADES as { id: string; max: number }[]) (out.upgrades as Dict)[u.id] = r.chance(0.7) ? u.max : r.int(u.max + 1);
  for (const m of MODS.data.MENU as { id: string }[]) (out.items as Dict)[m.id] = 1 + r.int(60);
  out.onMenu = (MODS.data.MENU as { id: string }[]).filter(() => r.chance(0.5)).map((m) => m.id) as GameState['onMenu'];
  for (const i of MODS.data.INGREDIENTS as { id: string }[]) (out.pantry as Dict)[i.id] = r.chance(0.9) ? 4000 : 30;
  for (const id of out.onMenu) out.bakePlan[id] = r.int(30);
  if (r.chance(0.5)) out.regions = (MODS.regions.REGIONS as { id: string }[]).slice(0, r.int(6)).map((x) => x.id) as GameState['regions'];
  return out;
}
const pet = (r: Random, id: string): Dict => ({ id, careSeconds: r.pick([0, 20, 180, 900]), autoRefill: r.chance(0.6),
  ...(r.chance(0.8) ? { personality: r.pick(MODS.pets.CAT_PERSONALITIES as string[]), preferredArea: r.pick(MODS.pets.CAT_AREAS as string[]), preferredSpot: r.pick(MODS.pets.CAT_SPOTS as string[]) } : {}) });
const pets = (r: Random): Dict[] => { const ids = new Set<string>(); for (let n = r.int(4); ids.size < n;) ids.add(r.pick(IDS.cat)); return [...ids].map((id) => pet(r, id)); };
/** A café with cats, their beds, and furniture to walk around. */
function catCafe(s: GameState, r: Random): GameState {
  const out = structuredClone(s);
  out.pets = pets(r) as unknown as GameState['pets'];
  if (!out.pets.length) out.pets = [pet(r, 'ginger')] as unknown as GameState['pets'];
  if (r.chance(0.7)) out.regions = (MODS.regions.REGIONS as { id: string }[]).slice(0, 1 + r.int(6)).map((x) => x.id) as GameState['regions'];
  const tables = call('regions', 'mainTableCount', [out]);
  for (let n = r.int(4); n > 0; n--) { out.decor.stored.catbed = 1 as never; for (let tries = 0; tries < 300 && !call('furniture', 'placeFurniture', [out, 'catbed', r.int(40 * (1 + out.regions.length)), r.int(20), tables]); tries++); }
  for (let n = r.int(12); n > 0; n--) { const id = r.pick(IDS.furniture); out.decor.stored[id as never] = 1 as never; call('furniture', 'placeFurniture', [out, id, r.int(60), r.int(20), tables]); }
  return out;
}
/** Cats that want to be in a room they cannot get to. */
function cutOff(s: GameState, r: Random): GameState {
  const out = catCafe(s, r);
  out.regions = ['greenhouse', 'terrace'] as GameState['regions'];
  out.pets = ['tabby', 'white', 'calico'].map((id) => ({ ...pet(r, id), careSeconds: 900, personality: r.pick(['playful', 'affectionate']), preferredArea: r.pick(['greenhouse', 'terrace']), preferredSpot: 'explore' })) as unknown as GameState['pets'];
  return out;
}
const answers: Record<string, string> = { recommend: 'recommend', greet: 'greet', cat: 'tidy', photo: 'photo', delivery: 'signDelivery' };
/** What the player does to moments, cats and the view. */
function socialOps(s: GameState, sim: Sim, r: Random, { moments, cats }: Social, chance: number): Op[] {
  const list: Op[] = [], active = moments.active, areas = MODS.regions.AREA_IDS as string[];
  const sitting = sim.customers.filter((c) => c.phase === 'sitting' || c.phase === 'waiting');
  if (sitting.length && r.chance(chance * 0.05)) { const c = r.pick(sitting); list.push(['$GUESTS', 'x', c.id, c.x + 3]); } // Not quite on the chair.
  if (active && r.chance(0.002)) list.push(['$MOM', 'signDelivery', '$S']);
  if (active && r.chance(0.02)) {
    const kind = r.chance(0.12) ? r.pick(Object.keys(answers)) : active.kind, fn = r.chance(0.08) ? 'dismiss' : answers[kind];
    if ((active.kind === 'cat' || active.kind === 'photo') && r.chance(0.06)) list.push(['$STATE', 'onMenu', []], ['$STATE', 'signatureDrinks', { ...s.signatureDrinks, recipes: [] }]); // Nothing to tip for.
    if (r.chance(0.04)) list.push(['$STATE', 'onMenu', s.onMenu.filter((id) => !active.options.slice(1).includes(id as never))]);
    list.push(['$MOM', fn, ...(fn === 'recommend' ? ['$S', '$SIM', active.options.length && r.chance(0.93) ? (active.options.length > 1 && r.chance(0.6) ? active.options[1] : r.pick(active.options)) : r.pick(IDS.menu)] : fn === 'dismiss' ? [] : fn === 'tidy' || fn === 'signDelivery' ? ['$S'] : ['$S', '$SIM'])]);
  }
  if (r.chance(chance * 0.2)) list.push(['$LOOK', r.chance(0.5) ? 'main' : r.chance(0.1) ? '' : r.pick(areas)]);
  if (r.chance(chance * 0.01)) list.push(['$MOM', 'reset']);
  if (r.chance(chance * 0.01)) list.push(['$CATS', 'reset']);
  if (r.chance(chance * 0.02)) list.push(['$MON', 'reset']);
  if (r.chance(chance * 0.2)) list.push(['$TIME', r.pick(['cats', 'real', 'sim']), r.pick([0, 0, -1, 0.2, 1, 5, 30, 75, NaN, Infinity].slice(0, 10))]);
  if (!s.pets.length && !cats.actors.size) return list;
  const id = s.pets.length && r.chance(0.9) ? r.pick(s.pets).id : r.pick(IDS.cat);
  if (r.chance(chance * 0.4)) list.push(['$CATS', 'interact', id]);
  if (r.chance(chance * 0.2)) list.push(['$CATS', 'furnitureSpaceClear', r.pick([...IDS.furniture, 'nothing']), r.pick([r.int(80) - 2, r.int(40), NaN, 0.5]), r.pick([r.int(26) - 2, r.int(14), Infinity])]);
  if (r.chance(chance * 0.15)) list.push(['$PET', id, ...(r.pick([['careSeconds', 0], ['careSeconds', 400], ['autoRefill', r.chance(0.5)], ['personality', r.pick(MODS.pets.CAT_PERSONALITIES as string[])],
    ['preferredArea', r.pick(MODS.pets.CAT_AREAS as string[])], ['preferredSpot', r.pick([...(MODS.pets.CAT_SPOTS as string[]), 'roof'])]]) as [string, unknown])] as Op);
  const actor = cats.actors.get(id), near = (d: number) => r.int(2 * d + 1) - d;
  if (actor && r.chance(chance * 0.12)) list.push(['$CAT', id, ...(r.chance(0.3) && actor.route.length ? [actor.route[0].x, actor.route[0].y] : r.chance(0.2) ? [r.pick([-500, -20, 160, 400, 5000]), r.pick([-400, 80, 138, 238, 9000])] : [actor.x + near(40), actor.y + near(30)])] as Op);
  if (actor?.interaction?.phase === 'approach' && r.chance(0.02)) list.push(['$CAT', id, actor.x + r.pick([-260, 260, -400]), actor.y]); // A long way off again.
  if (actor?.interaction && r.chance(0.01)) { // Shut in by furniture, with one piece on the cat itself.
    const area = (layout.areaAtPoint as Any)(actor.x, actor.y) as string | null;
    if (area && area !== 'kitchen') {
      const o = (layout.areaOrigin as Any)(area) as { x: number; y: number }, col = Math.floor((actor.x - o.x + (MODS.regions.regionOffset as Any as (a: string) => number)(area)) / 8), row = Math.max(3, Math.floor((actor.y - o.y - 80) / 8));
      const ring = [-4, -3, -2, -1, 0, 1, 2, 3, 4].flatMap((dx) => [-4, -3, -2, -1, 0, 1, 2, 3, 4].flatMap((dy) => (Math.max(Math.abs(dx), Math.abs(dy)) === 4 || dx === 0 && dy === 0 ? [{ id: SMALL, col: col + dx, row: row + dy }] : [])));
      list.push(['$STATE', 'decor', { ...structuredClone(s.decor), placed: ring }]);
    }
  }
  if (actor?.interaction?.phase === 'response' && r.chance(0.2)) list.push(['$CAT', id, -500, 9000]); // No way back from there.
  if (actor?.route.length && r.chance(chance * 0.6)) { // Someone right ahead and people all round: nowhere to go, perhaps out of supplies too.
    const dx = actor.route[0].x - actor.x, dy = actor.route[0].y - actor.y, far = Math.hypot(dx, dy) || 1, d = 9.02 / Math.max(Math.abs(dx / far), Math.abs(dy / far));
    if (d < 9.9) list.push(...(r.chance(0.5) ? [['$PET', id, 'autoRefill', false], ['$PET', id, 'careSeconds', 0]] as Op[] : []),
      ['$CROWD', 'set', [{ x: actor.x + dx / far * d, y: actor.y + dy / far * d }, ...Array.from({ length: 24 }, (_, n) => ({ x: actor.x + Math.cos(n * 0.2618) * 24, y: actor.y + Math.sin(n * 0.2618) * 24 }))]]);
  }
  if (actor && r.chance(actor.resting && actor.route.length ? 0.1 : chance * 0.5)) {
    const goal = actor.route.at(-1) ?? actor, next = actor.route[0] ?? actor, far = Math.hypot(next.x - actor.x, next.y - actor.y) || 1;
    list.push(['$CROWD', 'set', r.pick([[], [], [{ x: actor.x + (next.x - actor.x) / far * 8, y: actor.y + (next.y - actor.y) / far * 8 }], [-6, 0, 6].flatMap((dx) => [-6, 0, 6].map((dy) => ({ x: goal.x + dx, y: goal.y + dy }))),
      Array.from({ length: 12 }, (_, n) => ({ x: actor.x + Math.cos(n * 0.5236) * 12, y: actor.y + Math.sin(n * 0.5236) * 12 })), [{ x: goal.x, y: goal.y }], [{ x: NaN, y: 3 }, { x: -120, y: 100 }, { x: actor.x, y: actor.y + 5 }]])]);
  }
  if (r.chance(chance * 0.05)) list.push(['$CATS', 'update', '$S', 0.05]);
  if (r.chance(chance * 0.02)) list.push(['$PETS', 'set', IDS.cat.map((c) => pet(r, c))], ['$STATE', 'regions', []]);
  if (r.chance(chance * 0.05)) list.push(['$PETS', 'set', r.chance(0.3) ? pets(r) : [...structuredClone(s.pets).filter(() => r.chance(0.7))]]);
  return list;
}
/** Furniture moved, sold and placed while guests and cats are about; rooms opened. */
function arrange(s: GameState, r: Random, chance: number, cats?: LivingCats): Op[] {
  if (!r.chance(chance)) return [];
  const under = cats && [...cats.actors.values()];
  if (under?.length && r.chance(0.6)) { // Where a cat stands or is going.
    const a = r.pick(under), at = r.pick([a, a.route.at(-1) ?? a]), id = r.pick(['catbed', ...IDS.furniture]), area = (layout.areaAtPoint as Any)(at.x, at.y) as string | null;
    if (area) {
      const o = (layout.areaOrigin as Any)(area) as { x: number; y: number }, col = Math.floor((at.x - o.x + (MODS.regions.regionOffset as Any as (a: string) => number)(area)) / 8), row = Math.max(0, Math.floor((at.y - o.y - 80) / 8));
      for (let n = 0; n < 12; n++) { const c = col - r.int(4), q = Math.max(0, row - r.int(3)); if (call('furniture', 'canPlace', [s, id, c, q, call('regions', 'mainTableCount', [s])])) return [['$GIVE', id], ['furniture', 'placeFurniture', '$S', id, c, q, call('regions', 'mainTableCount', [s])]]; }
    }
  }
  const stored = Object.keys(s.decor.stored), tables = call('regions', 'mainTableCount', [s]);
  return [r.pick<() => Op>([
    () => ['furniture', 'placeFurniture', '$S', r.pick(stored.length ? stored : IDS.furniture), r.int(60), r.int(20), tables], () => ['furniture', 'moveFurniture', '$S', r.int(s.decor.placed.length + 1), r.int(60), r.int(20), tables],
    () => ['furniture', 'moveFurniture', '$S', r.int(s.decor.placed.length + 1), r.int(60), r.int(20), tables], () => ['furniture', 'storeFurniture', '$S', r.int(s.decor.placed.length + 1)],
    () => ['$STATE', 'regions', (MODS.regions.REGIONS as { id: string }[]).filter(() => r.chance(0.5)).map((x) => x.id)], () => ['$STATE', 'phase', s.phase],
  ])()];
}
const runs: Run[] = [];
const quiet: Run['ops'] = () => [];
const busy = (chance: number): Run['ops'] => (_i, s, sim, r) => [
  ...(r.chance(chance) ? [r.chance(0.15) ? prepOp(s, r) : serviceOp(s, sim, r)] : []),
  ...(r.chance(chance * 0.004) ? [['$SIM', r.pick(['sendHome', 'reset'])] as Op] : [])];
const prepShots = shots.filter((s) => s.tag === 'prep'), r0 = new Random(lcg(77));
/** Things that go wrong: guests out of patience, shelves emptied, odd steps, the shop closed in the middle of it all. */
const edge = (chance: number): Run['ops'] => (_i, s, sim, r) => {
  const list: Op[] = [];
  if (sim.customers.length && r.chance(chance * 2)) { const c = r.pick(sim.customers); list.push(['$GUESTS', ...(r.pick<[string, unknown]>([['patience', 0.01], ['patience', 0.01], ['timer', 0.01], ['x', r.pick([c.x + 3, 2, 318, 420])], ['extra', r.pick([null, ...s.onMenu])], ['reviewed', true], ['hasCup', true], ['rememberedOrder', c.extra ?? c.order]]).flatMap((v, n) => (n ? [c.id, v] : [v])) as [string, number, unknown])]); }
  if (r.chance(chance * 0.15)) list.push(['$SIM', 'closeShop', '$S']);
  if (s.phase !== 'open' && r.chance(0.2)) list.push(['$SIM', 'beginClosing', '$S']);
  const waitingForBarista = sim.customers.find((c) => c.phase === 'waiting' && sim.baristas.some((b) => b.customerId === c.id && b.remaining > 0.2));
  if (waitingForBarista && r.chance(0.4)) list.push(['$GUESTS', 'timer', waitingForBarista.id, 0.01]);
  const withExtra = sim.customers.find((c) => c.phase === 'toCounter' && c.extra !== null);
  if (withExtra && r.chance(0.4)) {
    list.push(['$GUESTS', 'rememberedOrder', withExtra.id, withExtra.extra]);
    if (call('economy', 'isBakery', [withExtra.extra])) list.push(['$PUT', 'shelf', withExtra.extra!, 0]);
    else list.push(...(call('economy', 'recipe', [withExtra.extra]) as [string, number][]).map(([id]) => ['$PUT', 'pantry', id, 0] as Op));
  }
  if (s.phase === 'prep' && r.chance(0.05)) list.push(['economy', 'restock', '$S'], ['day', 'openShop', '$S']);
  if (r.chance(chance * 0.5)) list.push(['$TIME', 'step', r.pick([0, -1, NaN, Infinity, 0.4, 1.7, 0.0125])]);
  if (r.chance(chance * 0.3)) list.push(['$PUT', 'pantry', r.pick(IDS.ingredient), r.pick([0, 0, 1, 3, 200])]);
  if (r.chance(chance * 0.04)) for (const id of IDS.ingredient) list.push(['$PUT', 'pantry', id, r.pick([0, 0, 2])]);
  if (r.chance(chance * 0.2)) for (const id of IDS.ingredient) list.push(['$PUT', 'pantry', id, 300]);
  if (r.chance(chance * 0.2) && s.onMenu.length) list.push(['$PUT', r.pick(['shelf', 'inProduction']), r.pick(s.onMenu), r.pick([undefined, 0, 1, 2])]);
  if (r.chance(chance * 0.04)) list.push(['$STATE', 'onMenu', r.chance(0.3) ? [] : s.onMenu.filter(() => r.chance(0.8))]);
  if (r.chance(chance * 0.15)) list.push(['$PUT', 'upgrades', 'cook', Math.max(s.upgrades.cook, r.int(5))], ['$STATE', 'kitchen', true]);
  if (r.chance(chance * 0.15)) list.push(['$PUT', 'upgrades', r.pick(['barista', 'server', 'tables', 'pass']), r.int(3)]);
  const reserved = sim.customers.some((c) => c.trialSale === 'reserved' && c.extra && c.extra === s.trialSales.active?.item && (c.phase === 'toCounter' || c.phase === 'ordering'));
  if (reserved && r.chance(0.8)) { const extra = sim.customers.find((c) => c.trialSale === 'reserved' && c.extra)!; list.push(...(call('economy', 'recipe', [extra.extra]) as [string, number][]).map(([id]) => ['$PUT', 'pantry', id, 0] as Op)); }
  if (sim.customers.some((c) => c.order.startsWith('sig:') && !c.hasCup) && r.chance(chance * 0.3)) list.push(['$STATE', 'signatureDrinks', { ...s.signatureDrinks, recipes: [] }]);
  if (r.chance(chance * 0.1)) list.push(['$SIM', 'offerTrialTo', '$S', sim.customers.length ? r.pick(sim.customers).id : 2]);
  return list;
};
const day = (name: string, base: GameState | null, seed: number, height: number, ops: Run['ops'], steps = 6200, through = false) => {
  if (base) runs.push({ name, through, state: base, seed, dt: 0.05, height, clock: EPOCH + 5e9, steps, ops: (i, s, sim, r, x) => (i === 0 ? [['day', 'openShop', '$S'] as Op, ...ops(i, s, sim, r, x)] : ops(i, s, sim, r, x)) });
};
for (let seed = 1; seed <= 20; seed++) {
  const fresh = call('state', 'createInitialState', [EPOCH + seed]) as GameState, mid = openable(r0.pick(prepShots.filter((s) => s.state.day >= 5)).state), late = openable(grand(r0.pick(prepShots).state, r0));
  const height = r0.pick([240, 300, 360]);
  day(`early-${seed}`, fresh, seed, height, quiet); day(`mid-${seed}`, mid, seed + 100, height, quiet); day(`late-${seed}`, late, seed + 200, height, quiet);
}
for (let seed = 1; seed <= 24; seed++) {
  const base = openable(seed % 3 === 0 ? grand(r0.pick(prepShots).state, r0) : r0.pick(prepShots).state);
  day(`actions-${seed}`, base, seed + 300, 300, (i, s, sim, r, x) => [...busy(0.05)(i, s, sim, r, x), ...socialOps(s, sim, r, x, 0.02)]);
  day(`reload-${seed}`, base, seed + 400, 300, (i, s, sim, r, x) => [...(i > 0 && i % 211 === 0 ? [['$SIM', '$reload'] as Op] : []), ...(i % 397 === 396 ? [['$SIM', '$resize', r.pick([240, 280, 320, 360])] as Op] : []), ...busy(0.01)(i, s, sim, r, x)]);
}
// Cats, café moments and furniture that moves under them.
for (let seed = 1; seed <= 32; seed++) {
  const base = openable((seed % 8 === 7 ? cutOff : catCafe)(seed % 2 ? grand(r0.pick(prepShots).state, r0) : r0.pick(prepShots).state, r0));
  day(`cats-${seed}`, base, seed + 600, r0.pick([240, 300, 360]), (i, s, sim, r, x) => [...(seed % 4 === 0 && i % 613 === 612 ? [['$SIM', '$resize', r.pick([240, 280, 320, 360])] as Op] : []),
    ...(i % 401 === 400 ? [['$SIM', '$reload'] as Op] : []), ...socialOps(s, sim, r, x, seed % 3 ? 0.02 : 0.1), ...arrange(s, r, seed % 5 === 0 ? 0 : 0.01, x.cats)], 4000);
}
const blends = prepShots.filter((s) => s.state.signatureDrinks.recipes.length);
for (let seed = 1; seed <= 24; seed++) {
  const from = structuredClone(r0.pick(seed % 3 ? prepShots : blends).state);
  for (const recipe of from.signatureDrinks.recipes) recipe.onMenu = true;
  const base = openable(seed % 2 ? grand(from, r0) : from);
  if (base && seed % 3 === 0) { base.onMenu = []; for (const id of IDS.ingredient) (base.pantry as Dict)[id] = 500; } // Only blends.
  day(`edge-${seed}`, base, seed + 800, 300, (i, s, sim, r, x) => [...edge(0.03)(i, s, sim, r, x), ...socialOps(s, sim, r, x, 0.01)], 3500, true);
}
// A day of only bread rolls, tried without a kitchen: nothing a parcel could hold, and sometimes the trial ends under the guests.
for (let seed = 1; seed <= 4; seed++) {
  const base = structuredClone(r0.pick(prepShots).state);
  base.kitchen = false; base.onMenu = ['roll'] as GameState['onMenu']; base.signatureDrinks.recipes = []; base.trialSales.selected = null;
  base.pets = seed === 1 ? [{ id: 'ginger', careSeconds: 0, autoRefill: false }] as GameState['pets'] : [];
  if (seed === 1) base.upgrades.tables = 0;
  base.items.roll = 5; base.shelf.roll = 400; base.cafeStyle.bakeryTrialDay = base.day;
  for (const id of IDS.ingredient) (base.pantry as Dict)[id] = 100;
  day(`bakery-${seed}`, openable(base), seed + 1300, 240, (_i, s, sim, r, x) => [...(seed === 1 ? [] : socialOps(s, sim, r, x, 0.02)),
    ...(sim.customers.some((c) => c.phase === 'ordering') && r.chance(0.01) ? [['$STATE', 'cafeStyle', { ...structuredClone(s.cafeStyle), bakeryTrialDay: r.chance(0.5) ? null : s.day }] as Op] : [])], 3000);
}
// Unbaked shelf with kitchen open + bakery-main guest offered a trial drink (covers first-bake shelve, extra=trial, and extra-trial stockout).
{
  const base = structuredClone(r0.pick(prepShots).state);
  base.kitchen = true; base.items.espresso = 5; base.items.roll = 5; base.items.latte = 5;
  base.onMenu = ['espresso', 'roll'] as GameState['onMenu']; base.signatureDrinks.recipes = [];
  base.bakePlan = { roll: 0 }; base.shelf = { roll: 0 }; base.upgrades.barista = 0; base.upgrades.marketing = 6;
  for (const id of IDS.ingredient) (base.pantry as Dict)[id] = 300;
  call('trial-sales', 'selectTrialSale', [base, 'latte']);
  day('trial-extra-1', openable(base), 1701, 240, (i, s, sim, r) => {
    const out: Op[] = [];
    const bakeryGuest = sim.customers.find((c) => c.phase === 'queue' && c.order === 'roll' && c.extra === 'espresso' && sim.canOfferTrialTo(s, c.id));
    if (bakeryGuest) out.push(['$SIM', 'offerTrialTo', '$S', bakeryGuest.id]);
    const toZero = sim.customers.find((c) => c.phase === 'toCounter' && c.trialSale === 'reserved' && c.extra === 'latte');
    if (toZero && i > 400) out.push(['$PUT', 'pantry', 'milk', 0]);
    return out;
  }, 2400);
}
// Days with a trial drink offered to whoever may have it.
for (let n = 0, seed = 1; n < 400 && seed <= 10; n++) {
  const base = openable(n % 2 ? grand(r0.pick(prepShots).state, r0) : r0.pick(prepShots).state), drink = base && IDS.menu.filter((id) => call('trial-sales', 'canTrialDrink', [base, id]));
  if (!base || !drink?.length || !call('trial-sales', 'selectTrialSale', [base, r0.pick(drink)])) continue;
  for (const id of IDS.ingredient) (base.pantry as Dict)[id] = 500;
  for (const recipe of base.signatureDrinks.recipes) recipe.onMenu = true;
  day(`trial-${seed++}`, base, seed + 700, 300, (i, s, sim, r, x) => { const able = sim.customers.filter((c) => sim.canOfferTrialTo(s, c.id)); return [...(able.length && r.chance(0.1) ? [['$SIM', 'offerTrialTo', '$S', r.pick(able).id] as Op] : []), ...(n % 3 ? [] : edge(0.02)(i, s, sim, r, x))]; }, 2500);
}
// Services saved by a random player, continued from their snapshot; many after a resize or in the older format.
const saved = shots.filter((s) => s.snapshot && s.state.phase !== 'prep');
function older(snap: Dict, r: Random): Dict {
  const s = { ...snap, version: 1, height: 192 + r.int(170) } as Dict & { customers: Dict[] };
  delete s.customerCast; delete s.castRandomState;
  s.customers = s.customers.map((c) => { const out = { ...c }; for (const k of ['reviewed', 'waitSeconds', 'missingExtra', 'appearanceId']) if (r.chance(0.5)) delete out[k]; return out; });
  return s;
}
for (const [n, shot] of saved.filter((_, i) => i % 9 === 0).slice(0, 40).entries())
  runs.push({ name: `resume-${n}`, state: shot.state, seed: n + 500, dt: 0.05, height: n % 2 ? 240 : 330, clock: shot.now, steps: 700, ops: busy(0.02), resume: n % 4 === 3 ? older(structuredClone(shot.snapshot) as Dict, r0) : structuredClone(shot.snapshot) });
// The same, damaged: refused whole, or continued the same way.
for (let n = 0; n < 320; n++) {
  const shot = r0.pick(saved);
  let snap = structuredClone(shot.snapshot) as Dict;
  if (n % 4 === 0) snap = older(snap, r0);
  else if (n % 4 === 1) { // Someone stands elsewhere.
    const people = [...(snap.customers as Dict[]), ...(snap.servers as Dict[]), ...(snap.cooks as Dict[])], who = people.length ? r0.pick(people) : {};
    if (n % 20 === 1 && (snap.cooks as Dict[]).length) { (snap.cooks as Dict[])[0].x = -319; (snap.cooks as Dict[])[0].y = 110; }
    else if (r0.chance(0.3)) { who.x = -100 + r0.int(120); who.y = r0.pick([80, 138, 140, 170, 200]); } else { who.x = (who.x as number) + r0.int(120) - 60; who.y = (who.y as number) + r0.int(120) - 60; }
  } else snap = damage(snap, r0, 1) as Dict;
  runs.push({ name: `torn-${n}`, state: shot.state, seed: n + 900, dt: 0.05, height: r0.pick([240, 300, 360]), clock: shot.now, steps: 6, ops: quiet, resume: snap });
}
// Shelving when inProduction was cleared before first bake + guest rerouting from off-map x (covers sim:1061 and sim:596).
{
  const base = structuredClone(prepShots[0].state);
  base.kitchen = true; base.upgrades.cook = 1; base.items.espresso = 5; base.items.roll = 5;
  base.onMenu = ['espresso', 'roll'] as GameState['onMenu']; base.signatureDrinks.recipes = [];
  base.bakePlan = { roll: 0 }; base.shelf = { roll: 0 }; base.upgrades.marketing = 6;
  for (const id of IDS.ingredient) (base.pantry as Dict)[id] = 300;
  day('extra-branches-1', openable(base), 1702, 240, (i, s, sim) => {
    const out: Op[] = [];
    if (i === 1) out.push(['$PUT', 'shelf', 'roll', 0], ['$PUT', 'bakePlan', 'roll', 6]);
    const baking = sim.cooks.find((c) => c.batch && !s.today.baked[c.batch.item] && (s.inProduction[c.batch.item] ?? 0) > 0);
    if (baking?.batch) out.push(['$PUT', 'inProduction', baking.batch.item, 0]);
    if (i >= 600 && s.phase === 'open') {
      const c = sim.customers.find((g) => g.phase === 'queue');
      if (c) out.push(['$GUESTS', 'x', c.id, -500], ['$SIM', 'beginClosing', '$S']);
    }
    return out;
  }, 1500);
}
// Legacy v1 snapshot with a cook mid-batch (covers sim:299 cook.batch ? stationSpot(...)).
{
  const base = structuredClone(prepShots[0].state);
  base.kitchen = true; base.upgrades.cook = 1; base.items.roll = 5;
  base.onMenu = ['roll'] as GameState['onMenu']; base.signatureDrinks.recipes = [];
  base.bakePlan = { roll: 0 }; base.shelf = { roll: 0 };
  for (const id of IDS.ingredient) (base.pantry as Dict)[id] = 300;
  const s = openable(base)!;
  call('day', 'openShop', [s]);
  s.shelf.roll = 0; s.bakePlan.roll = 6;
  layout.setSceneHeight(240); layout.setKitchenLevel(1);
  const tmp = new (MODS.sim.Sim as new (rng: () => number) => Sim)(lcg(1703));
  for (let i = 0; i < 400 && !tmp.cooks.some((c) => c.batch); i++) tmp.update(s, 0.05);
  runs.push({ name: 'extra-v1-cook', state: s, seed: 1703, dt: 0.05, height: 240, clock: EPOCH + 5e9, steps: 20, ops: quiet, resume: older(tmp.snapshot(s) as unknown as Dict, r0) });
}
const chosen = runs.filter((spec, i) => i % parts === part && (!only || only.split(',').some((o) => spec.name === o || spec.name.startsWith(o.endsWith('*') ? o.slice(0, -1) : `${o}-`))));
// Every method must be used by some run: coverage alone does not report what was never called.
const CLASSES: Record<string, string> = { sim: 'Sim', moments: 'MomentDirector', 'living-cats': 'LivingCats', operations: 'OperationMonitor' }, methods: string[] = [];
for (const [mod, name] of Object.entries(CLASSES)) {
  const proto = (MODS[mod][name] as { prototype: object }).prototype;
  for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
    const id = `${name}.${key}`, f = (d.value ?? d.get) as Any;
    if (key === 'constructor') continue;
    methods.push(id);
    const counted = function (this: unknown, ...a: unknown[]) { called.add(id); return f.apply(this, a); };
    Object.defineProperty(proto, key, d.value ? { ...d, value: counted } : { ...d, get: counted });
  }
}
let steps = 0;
reached(); // Starts counting from zero.
for (const spec of chosen) {
  const made = record(spec);
  writeFileSync(join(out, `${spec.name}.jsonl`), made.text);
  steps += made.steps;
}
const { branches, map } = stretches();
writeFileSync(join(out, 'reached.bin'), map);
writeFileSync(join(out, 'gate.json'), JSON.stringify({ runs: chosen.length, all: runs.length, steps, branches, methods, called: [...called] }));
