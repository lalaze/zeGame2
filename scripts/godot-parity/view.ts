// Vectors for the building's pure functions (`godot/view/*.gd`): where everything is, how people and cats get about,
// the light, which picture is which, and what people think. They run the floors view's own TypeScript
// (src/render/floors), bundled with an empty Phaser.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IDS, Random, play, type Shot } from './ops';
import { MODS } from './mods';
import { lcg, wire } from './wire';
import type { GameState } from '../../src/game/state';
import type { Sim } from '../../src/game/sim';
import * as layout from '../../src/render/floors/floors-layout';
import * as cats from '../../src/render/floors/floors-cat-places';
import * as light from '../../src/render/floors/floors-sky-light';
import * as fx from '../../src/render/floors/floors-fx';
import * as upgrades from '../../src/render/floors/floors-upgrades';
import * as looks from '../../src/render/floors/floors-looks';
import * as work from '../../src/render/floors/floors-work';
import * as front from '../../src/render/floors/floors-front';
import * as places from '../../src/render/floors/floors-places';
import * as decor from '../../src/render/floors/floors-decor-layers';
import { HAIRS, PANTS, SHIRTS, SKINS } from '../../src/render/sprites';
import { tillJarLevel } from '../../src/render/idle-props-art';
import { thoughtCandidates } from '../../src/render/thoughts';
import { ThoughtBubbles } from '../../src/render/thought-bubbles';
import { showableThoughts } from '../../src/render/floors/floors-thoughts';

type Any = (...a: never[]) => unknown;
const r = new Random(lcg(20251124)), rows: unknown[] = [], seen: Record<string, Set<string>> = {};
const put = (f: string, a: unknown[], ret: unknown) => {
  rows.push({ f, a: a.map(wire), r: wire(ret) });
  (seen[f] ??= new Set()).add(JSON.stringify(wire(ret)));
};
/** Calls a function and writes down what it says; `as` is what Godot is given instead. */
const test = (f: string, fn: Any, a: unknown[], as: unknown[] = a) => put(f, as, (fn as (...x: unknown[]) => unknown)(...a));
const hexNumber = (hex: string) => parseInt(hex.slice(1), 16);

// ---------------------------------------------------------------- constants
const constants: Record<string, unknown> = {
  'layout.FRAME': layout.FRAME, 'layout.WORLD_W': layout.WORLD_W, 'layout.GROUND_SHIFT': layout.GROUND_SHIFT, 'layout.DOOR': layout.DOOR, 'layout.PARCEL': layout.PARCEL, 'layout.BOARD': layout.BOARD, 'layout.SHOP_SIGN': layout.SHOP_SIGN,
  'layout.QUEUE': layout.QUEUE, 'layout.BARISTAS': layout.BARISTAS, 'layout.SERVICE': layout.SERVICE, 'layout.PASS': layout.PASS, 'layout.SERVER_HOMES': layout.SERVER_HOMES, 'layout.COUNTER_FRONT': layout.COUNTER_FRONT, 'layout.STEAM': layout.STEAM, 'layout.DISPLAY': layout.DISPLAY, 'layout.FLOOR_TABLES': layout.FLOOR_TABLES,
  'layout.LIFT': layout.LIFT, 'layout.LIFT_HATCH': layout.LIFT_HATCH, 'layout.LIFT_TOP': layout.LIFT_TOP, 'layout.OVEN_MOUTH': layout.OVEN_MOUTH, 'layout.TABLE_FRONT': layout.TABLE_FRONT, 'layout.STAIRS_HALL': layout.STAIRS_HALL, 'layout.STAIRS_RAIL': layout.STAIRS_RAIL,
  'layout.WALK': layout.WALK, 'layout.CATCH_UP': layout.CATCH_UP, 'layout.FURNITURE_SPOTS': layout.FURNITURE_SPOTS, 'layout.FLOOR_ART': layout.FLOOR_ART,
  'cats.CAT_FRAMES': cats.CAT_FRAMES, 'cats.CAT_FLOORS': cats.CAT_FLOORS, 'cats.GIFT_PLACES': cats.GIFT_PLACES,
  'light.SKY_WEATHERS': light.SKY_WEATHERS, 'light.SKY_TIMES': light.SKY_TIMES, 'light.SKY_NAMES': light.SKY_NAMES, 'light.ROOM_WINDOWS': light.ROOM_WINDOWS,
  'art.BACK_LAYERS': decor.BACK_LAYERS, 'art.FRONT_LAYERS': decor.FRONT_LAYERS, 'art.LAYER_DEPTH': decor.LAYER_DEPTH, 'art.LAYER_STEP': decor.LAYER_STEP, 'art.HALL_DEPTH': decor.HALL_DEPTH, 'art.IN_WELL_DEPTH': decor.IN_WELL_DEPTH,
  'art.FLOOR_WINDOWS': places.FLOOR_WINDOWS, 'art.PLACE_DISC': places.PLACE_DISC, 'art.MACHINE_LEVELS': upgrades.MACHINE_LEVELS, 'art.STAFF_FRAMES': looks.STAFF_FRAMES,
  'art.SKINS': SKINS.map(hexNumber), 'art.HAIRS': HAIRS.map(hexNumber), 'art.SHIRTS': SHIRTS.map(hexNumber), 'art.PANTS': PANTS.map(hexNumber),
};
const lampsOf = (list: readonly light.Lamp[]) => list.map(({ x, y, reach, power, colour }) => ({ x, y, reach, power: power ?? 1, colour: colour ?? null }));
for (const [name, table] of Object.entries({ FLOOR_LAMPS: light.FLOOR_LAMPS, CEILING_LAMPS: light.CEILING_LAMPS, WALL_LAMPS: light.WALL_LAMPS })) for (const [key, list] of Object.entries(table)) put(`lamps.${name}`, [key], lampsOf(list));
put('lamps.STREET_LAMP', [], lampsOf(light.STREET_LAMP)); put('lamps.NEON_LAMP', [], lampsOf([light.NEON_LAMP]));

// ---------------------------------------------------------------- the building and walking in it
const FLOORS = ['roof', 'floor-3', 'floor-2', 'ground', 'basement'] as layout.FloorId[];
const buildings = Array.from({ length: 10 }, (_, n) => [false, true].map((kitchen) => layout.building(n, kitchen))).flat();
for (let n = 0; n < 12; n++) for (const kitchen of [false, true]) test('layout.building', layout.building as Any, [n, kitchen]);
for (const b of buildings) for (const view of [400, 1200, 2400, 3600, 5000]) test('layout.restFocus', layout.restFocus as Any, [b, view]);
for (const b of buildings) for (const floor of FLOORS) { const p = { floor, x: r.int(1672), y: r.int(900) }, at = layout.worldPoint(b, p); put('layout.worldPoint', [b, p], [at.x, at.y]); }
for (let n = 0; n < 12; n++) { test('layout.nextTableSpot', layout.nextTableSpot as Any, [n]); for (const active of [[0, 1], [0, 1, 2, 3, 4, 5, 6, 7], [3, 5, 1], [], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]) test('layout.tableSeats', layout.tableSeats as Any, [n, active]); }
for (const s of [...IDS.station, 'door', 'other']) test('layout.kitchenPlace', layout.kitchenPlace as Any, [s]);
const PLACES = ['oven', 'dough', 'cold', 'dry', 'lift'] as const;
for (const p of PLACES) for (let i = 0; i < 5; i++) test('layout.kitchenSpot', layout.kitchenSpot as Any, [p, i]);
for (let i = 0; i < 7; i++) test('layout.cookHome', layout.cookHome as Any, [i]);
for (const floors of [['roof', 'ground'], ['roof', 'floor-2', 'ground'], ['roof', 'floor-3', 'floor-2', 'ground']] as layout.FloorId[][]) {
  for (let i = 0; i < 8; i++) test('layout.serverHome', layout.serverHome as Any, [i, floors]);
}
for (const floor of ['ground', 'floor-2'] as layout.FloorId[]) {
  for (const rect of layout.FLOOR_TABLES[floor]!) test('layout.tableMaskRects', layout.tableMaskRects as Any, [rect]);
}
for (let i = 0; i < 5; i++) {
  for (const clock of [0, 0.5, 1.89, 1.9, 3.8, 5.7, 9.5, 15.2, 22.8, 37.9, 38, 75.5]) {
    test('layout.baristaIdlePose', layout.baristaIdlePose as Any, [i, clock]);
  }
}
for (const id of [...IDS.spot, 'nowhere']) put('layout.furnitureSpot', [id], layout.furnitureSpot(id) ?? null);
const tables = Array.from({ length: 8 }, (_, i) => i);
const allServerHomes = Array.from({ length: 6 }, (_, i) => layout.serverHome(i, ['roof', 'floor-3', 'floor-2', 'ground']));
const spots: layout.Spot[] = [layout.DOOR, ...layout.QUEUE, ...layout.SERVICE, layout.PASS, ...layout.SERVER_HOMES, ...allServerHomes, layout.LIFT, ...tables.flatMap((t) => [...layout.tableSeats(t, tables)]), ...PLACES.flatMap((p) => [0, 1, 2].map((i) => layout.kitchenSpot(p, i)))];
const routes: { from: layout.FloorPoint; steps: layout.Step[] }[] = [];
for (let n = 0; n < 900; n++) {
  const from = r.pick(spots), to = { ...r.pick(spots), ...(r.chance(0.2) ? { fadeOut: true } : {}) };
  if ((from.floor === 'basement') !== (to.floor === 'basement')) continue; // There are no stairs down to the kitchen.
  const start = r.chance(0.7) ? { floor: from.floor, x: from.x, y: from.y } : { floor: from.floor, x: r.int(1600), y: r.int(900) };
  if (start.floor === 'roof' || to.floor === 'roof') continue;
  test('layout.route', layout.route as Any, [start, from.aisle, to]);
  routes.push({ from: start, steps: layout.route(start, from.aisle, to) });
}
for (const { from, steps } of routes.slice(0, 200)) {
  test('layout.stepsLength', layout.stepsLength as Any, [from, steps]);
  for (const s of steps.slice(0, 12)) { const p = { floor: s.floor, x: s.x, y: s.y }; test('layout.inWell', layout.inWell as Any, [p]); test('layout.wellSink', layout.wellSink as Any, [p]); }
}
for (let n = 0; n < 200; n++) { const share = r.next() * 1.1, p = { floor: r.pick(FLOORS), x: 1378 + share * 85 + (r.next() - 0.5) * 8, y: 546 + share * 308 }; test('layout.inWell', layout.inWell as Any, [p]); test('layout.wellSink', layout.wellSink as Any, [p]); }
for (let n = 0; n < 200; n++) test('layout.walkPace', layout.walkPace as Any, [r.next() * 3000, r.next() * 12 - 1]);

// ---------------------------------------------------------------- cats
const pieces = () => new Map(Array.from({ length: r.int(6) }, () => [r.pick(IDS.spot), r.pick(['catbed', 'catbed', ...IDS.furniture])] as const));
const prefs = () => ({ personality: r.pick(['playful', 'quiet', 'affectionate']), preferredArea: r.pick(['main', 'reading', 'workshop', 'greenhouse', 'terrace', 'observatory']), preferredSpot: r.pick(['cozy', 'window', 'explore']) }) as Parameters<typeof cats.placeRank>[1];
for (let n = 0; n < 300; n++) {
  const { floors } = r.pick(buildings), out = pieces(), list = cats.catPlaces(floors, out), p = prefs();
  put('cats.catPlaces', [floors, Object.fromEntries(out)], list);
  for (const place of list.slice(0, 4)) test('cats.placeRank', cats.placeRank as Any, [place, p, floors]);
  test('cats.homeFloor', cats.homeFloor as Any, [p.preferredArea, floors]);
  const seed = r.int(1e9), plan = r.pick(['roam', 'nap', 'groom', 'watch'] as const), at = r.pick([undefined, ...list.map((x) => x.id)]), free = list.filter(() => r.chance(0.8)), random = lcg(seed);
  put('cats.choosePlace', [plan, p, free, floors, at, seed], cats.choosePlace(plan, p, free, floors, at, random) ?? null);
  const a = r.pick(list), b = r.pick(list);
  put('cats.catRoute', [a.from, b, floors], cats.catRoute(a.from, b, floors));
}
for (let n = 0; n < 120; n++) { const who = r.pick(['playful', 'quiet', 'affectionate'] as const), x = r.next(); test('cats.choosePlan', cats.choosePlan as Any, [who, x]); test('cats.planSeconds', cats.planSeconds as Any, [cats.choosePlan(who, x), who, x]); }
for (const f of cats.CAT_FLOORS) { test('cats.catEntry', cats.catEntry as Any, [f]); test('cats.catArrival', cats.catArrival as Any, [f]); for (const node of cats.catNodes(f)) test('cats.catNode', cats.catNode as Any, [node]); }
for (const f of FLOORS) test('cats.floorArea', cats.floorArea as Any, [f]);
for (const b of buildings) test('cats.catFloors', cats.catFloors as Any, [b.floors]);

// ---------------------------------------------------------------- light
const TOPS: light.SkyTops = { day: '#8dc3fc', dusk: '#8a6f9e', night: '#141b3f', clear: '#7fbdf2', overcast: '#a9b3c2' };
const tops = Object.fromEntries(Object.entries(TOPS).map(([k, v]) => [k, hexNumber(v)]));
for (let h = -2; h <= 26; h += 0.25) test('light.skyTimes', light.skyTimes as Any, [h]);
for (let n = 0; n < 260; n++) { const hour = n < 97 ? n / 4 : r.next() * 24, weather = r.pick([...light.SKY_WEATHERS, 'odd' as never]); test('light.skyLook', light.skyLook as Any, [hour, weather, TOPS], [hour, weather, tops]); }
for (let n = 0; n < 80; n++) { const s = { phase: r.pick(['prep', 'open', 'closing'] as const), dayTime: r.next() * 190 }; test('light.skyHour', light.skyHour as Any, [s]); }
for (const floor of FLOORS) for (const ceiling of [undefined, 'ceiling_none', 'ceiling_lights', 'ceiling_pendants', 'ceiling_chandelier']) for (const neon of [undefined, 'neon_none', 'neon_cafe', 'neon_heart']) {
  const equipped = { ...(ceiling ? { ceiling } : {}), ...(neon ? { neon } : {}) };
  put('lamps.floorLamps', [floor, equipped], lampsOf(light.floorLamps(floor, equipped)));
}

// ---------------------------------------------------------------- pictures
const shots: Shot[] = [];
for (let seed = 1; seed <= 24; seed++) play(seed, 6, (shot) => shots.push(shot));
for (const id of [...IDS.menu, ...IDS.base.map((b) => `sig:${b}:x`), 'sig:', 'sig:nothing', 'unknown']) for (const [name, fn] of [['itemFrame', fx.itemFrame], ['isDrinkItem', fx.isDrinkItem], ['isHotDrink', fx.isHotDrink]] as const) test(`art.${name}`, fn as Any, [id]);
for (const shot of shots.filter((s) => s.state.signatureDrinks.recipes.length).slice(0, 12)) for (const x of shot.state.signatureDrinks.recipes) { test('art.itemFrame', fx.itemFrame as Any, [x.id]); test('art.isHotDrink', fx.isHotDrink as Any, [x.id]); }
for (let n = 0; n < 24; n++) test('art.machineTier', upgrades.machineTier as Any, [n]);
for (let n = 0; n < 160; n++) { const has = new Set(['convection', 'sheeter', 'proofer', 'pastryFridge', 'standMixer', 'kettle', 'fryer', 'mixer', 'deckOven'].filter(() => r.chance(0.5))), expanded = r.int(4); put('art.kitchenPieces', [[...has], expanded], upgrades.kitchenPieces(has, expanded)); }
for (let n = 0; n < 160; n++) {
  const look = { skin: r.int(9) - 3, hair: r.int(12) - 3, hairStyle: r.int(80) - 20, shirt: r.int(16) - 4, pants: r.int(9) - 3 };
  test('art.lookId', looks.lookId as Any, [look]); test('art.cookId', looks.cookId as Any, [look]);
  const c = looks.lookColours(look); put('art.lookColours', [look], Object.fromEntries(Object.entries(c).map(([k, [x, y, z]]) => [k, x * 65536 + y * 256 + z])));
}
for (let n = 0; n < 120; n++) { const menu = Array.from({ length: r.int(8) }, (_, i) => i), seconds = r.next() * 60 - 2; test('art.boardRows', front.boardRows as Any, [menu, seconds]); }
for (const shot of shots.slice(0, 60)) {
  for (const item of (MODS.economy.menuItems as (s: GameState) => { id: string }[])(shot.state).slice(0, 6)) put('art.boardPrice', [shot.state, item], front.boardPrice(shot.state, item as never));
  const s = structuredClone(shot.state);
  if (r.chance(0.5)) s.chain.franchises = [{ location: 'harbor', hourly: r.int(900) }] as never;
  s.chain.collectedAt = shot.now - r.int(40) * 3_600_000; s.today.served = r.int(70);
  test('art.tillJarLevel', tillJarLevel as Any, [s, shot.now]);
}

// ---------------------------------------------------------------- people at work and what they think
const SimClass = MODS.sim.Sim as new (rng: () => number) => Sim;
const serving = shots.filter((s) => s.snapshot && s.state.phase !== 'prep');
let restored = 0;
for (const shot of serving) {
  const sim = new SimClass(lcg(1)), state = structuredClone(shot.state);
  if (!sim.restore(structuredClone(shot.snapshot), state)) continue;
  if (++restored > 160) break;
  const tweak = r.int(6);
  for (const c of sim.customers) { if (tweak === 1) c.patience = r.int(20); if (tweak === 2) c.timer = r.int(30); if (tweak === 3) c.moodTimer = r.next(); if (tweak === 4 && r.chance(0.5)) { c.hasCup = true; c.dineIn = true; } }
  const customers = structuredClone(sim.customers);
  put('thinking.candidates', [shot.state, shot.snapshot, customers], thoughtCandidates(sim, state));
  put('art.brewShare', [sim.baristas], sim.baristas.map((b) => work.brewShare(b)));
  put('art.bakeShare', [shot.state, shot.snapshot], sim.cooks.map((_, i) => work.bakeShare(sim, state, i)));
}
for (let n = 0; n < 60; n++) {
  const pacing = new ThoughtBubbles(), ids = ['customer:9', 'customer:10', 'barista:0', 'cook:1', 'server:0'], script: unknown[] = [], said: unknown[] = [];
  let list: ReturnType<typeof thoughtCandidates> = [];
  for (let step = 0; step < 220; step++) {
    if (step % 6 === 0) list = ids.filter(() => r.chance(0.7)).map((id) => ({ id, key: r.pick(['thought.customer.wait', 'thought.customer.cozy']) as never, x: 0, y: 0, priority: r.pick([15, 35, 50, 100, r.chance(0.04) ? 1000 : 35]), context: r.pick(['queue:a', 'taste:b', 'table:c', 'moment:1']) }));
    const dt = r.pick([0.016, 0.1, 0.25, 0.4]), room = r.chance(0.01) ? 'other' : 'building:zh', enabled = r.chance(0.97);
    script.push([dt, room, enabled, list]); said.push(pacing.update(dt, room, enabled, list).map((c) => c.id));
  }
  put('thinking.pacing', [script], said);
}
for (let n = 0; n < 120; n++) {
  const list = Array.from({ length: r.int(6) }, (_, i) => ({ id: `${r.pick(['customer', 'barista'])}:${i}`, key: 'thought.customer.wait' as never, x: 0, y: 0, priority: r.pick([35, 1000]), context: r.pick(['queue:a', 'table:b', 'taste:c', 'memory:d']) }));
  const heads = Object.fromEntries(list.filter(() => r.chance(0.8)).map((c) => [c.id, { x: r.int(1700), y: r.int(2400), arrived: r.chance(0.6) }])), view = { x: r.int(300), y: r.int(800), w: 900 + r.int(400), h: 1500 }, quiet = r.pick([undefined, 0, 1, 2]);
  put('thinking.showable', [list, heads, view, quiet], showableThoughts(list, (id) => heads[id] ?? null, view, quiet));
}

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const dull = Object.entries(seen).filter(([f, s]) => s.size < 2 && !/^lamps\.(STREET|NEON)/.test(f)).map(([f]) => f);
writeFileSync(join(out, 'view.json'), JSON.stringify({ constants: Object.fromEntries(Object.entries(constants).map(([k, v]) => [k, wire(v)])), rows }));
console.log(JSON.stringify({ rows: rows.length, functions: Object.keys(seen).length, constants: Object.keys(constants).length, dull }));
