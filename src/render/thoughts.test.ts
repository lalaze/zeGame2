import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CAST } from '../game/customer-cast';
import { seatSpot } from '../game/layout';
import { MENU, INGREDIENTS, type ItemId } from '../game/data';
import { makeSignatureId, trialSignature, saveSignature, setSignatureOnMenu, type SignatureBase, type SignatureRecipe } from '../game/signature-drinks';
import { batchSteps, stationSpot, type Station } from '../game/kitchen';
import { Sim, type Barista, type Cook, type Customer, type CustomerPhase, type Server } from '../game/sim';
import { createInitialState, serialize, type GameState } from '../game/state';
import { messagesFor, type MessageKey } from '../i18n';
import { CHAR_H } from './sprites';
import { thoughtCandidates } from './thoughts';
import { openShop } from '../game/day';

const look = { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 };
function customer(patch: Partial<Customer> = {}): Customer {
  return {
    id: 1, appearanceId: 0, look: { ...look }, x: 80, y: 160,
    tx: 80, ty: 160, stride: 60, via: [], phase: 'queue',
    order: 'espresso', extra: null, vip: false, patience: 40,
    spot: -1, seat: -1, timer: 35, mood: null, moodTimer: 0,
    hasCup: false, soldOut: false, dineIn: false,
    reviewed: false, waitSeconds: 0, missingExtra: false, ...patch,
  };
}
const barista = (patch: Partial<Barista> = {}): Barista => ({
  look: { ...look }, customerId: null, total: 0, remaining: 0, calling: 0, ...patch,
});
const server = (patch: Partial<Server> = {}): Server => ({
  look: { ...look }, x: 250, y: 100, tx: 250, ty: 100, via: [], stride: 0,
  phase: 'idle', plates: [], ack: 0, ...patch,
});
const openState = (): GameState => ({ ...createInitialState(0), phase: 'open' });
function setup(patch: Partial<Customer> = {}) {
  const state = openState();
  const sim = new Sim();
  sim.customers = [customer(patch)];
  return { state, sim, c: sim.customers[0] };
}
const keyOf = (sim: Sim, state: GameState, id = 'customer:1') => thoughtCandidates(sim, state).find(c => c.id === id)?.key;
const dining = { phase: 'sitting', dineIn: true, hasCup: true, seat: 0 } as const;

function freezeDeep(value: object): void {
  for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) freezeDeep(child);
  Object.freeze(value);
}

afterEach(() => vi.restoreAllMocks());

describe('contextual customer thoughts', () => {
  it('uses the actual arrival, queue, counter, seat and waiting phases', () => {
    const { state, sim, c } = setup({ stride: 0 });
    expect(keyOf(sim, state)).toBe('thought.customer.arrive');
    c.stride = 60;
    expect(keyOf(sim, state)).toBe('thought.customer.queue');
    c.phase = 'toCounter';
    expect(keyOf(sim, state)).toBe('thought.customer.myTurn');
    c.phase = 'toSeat';
    expect(keyOf(sim, state)).toBe('thought.customer.findSeat');
    c.phase = 'waiting';
    expect(keyOf(sim, state)).toBe('thought.customer.wait');
  });

  it('prioritizes urgent queue and table waits using their own real timers', () => {
    const { state, sim, c } = setup();
    const normal = thoughtCandidates(sim, state)[0];
    c.patience = 11;
    let urgent = thoughtCandidates(sim, state)[0];
    expect(urgent.key).toBe('thought.customer.urgent');
    expect(urgent.priority).toBeGreaterThan(normal.priority);
    c.phase = 'waiting';
    c.patience = 100;
    c.timer = 14;
    urgent = thoughtCandidates(sim, state)[0];
    expect(urgent.key).toBe('thought.customer.urgent');
    c.timer = 15;
    expect(keyOf(sim, state)).toBe('thought.customer.wait');
  });

  it('lets order and sold-out icons take precedence', () => {
    const { state, sim, c } = setup({ phase: 'ordering' });
    expect(thoughtCandidates(sim, state)).toEqual([]);
    c.phase = 'exiting';
    c.soldOut = true;
    c.moodTimer = 1;
    expect(thoughtCandidates(sim, state)).toEqual([]);
    c.moodTimer = 0;
    expect(keyOf(sim, state)).toBe('thought.customer.nextTime');
  });

  it('celebrates actual delivery before expressing stable food/drink tastes', () => {
    const { state, sim, c } = setup({ ...dining, mood: 'happy', moodTimer: 1.5 });
    expect(keyOf(sim, state)).toBe('thought.customer.served');
    c.moodTimer = 0;
    expect(keyOf(sim, state)).toBe('thought.like.bold');
    c.appearanceId = 5;
    expect(keyOf(sim, state)).toBe('thought.dislike.bold');
    c.order = 'cake';
    c.appearanceId = 6;
    expect(keyOf(sim, state)).toBe('thought.like.fruity');
    c.appearanceId = 7;
    expect(keyOf(sim, state)).toBe('thought.dislike.fruity');
  });

  it('also considers the actual paired item without depending on category indexes', () => {
    const { state, sim } = setup({ ...dining, appearanceId: 7, order: 'blacktea', extra: 'croissant' });
    expect(keyOf(sim, state)).toBe('thought.like.buttery');
    sim.customers[0].extra = 'cake';
    expect(keyOf(sim, state)).toBe('thought.dislike.fruity');
  });

  it('never tastes a takeaway order or an undelivered table order', () => {
    const { state, sim, c } = setup({ appearanceId: 5, dineIn: false, hasCup: true });
    for (const phase of ['queue', 'toCounter', 'ordering', 'toSeat', 'waiting', 'exiting'] as CustomerPhase[]) {
      c.phase = phase;
      expect(keyOf(sim, state) ?? '').not.toMatch(/^thought\.(like|dislike)\./);
    }
    expect(keyOf(sim, state)).toBe('thought.customer.takeaway');
    c.phase = 'sitting';
    expect(keyOf(sim, state)).toBeUndefined();
    c.dineIn = true;
    c.hasCup = false;
    expect(keyOf(sim, state)).toBeUndefined();
  });

  it('does not make unserved or unhappy departures thank the café for a meal', () => {
    const { state, sim, c } = setup({ phase: 'exiting', mood: 'sad' });
    expect(keyOf(sim, state)).toBe('thought.customer.leave');
    c.hasCup = true;
    expect(keyOf(sim, state)).toBe('thought.customer.takeaway');
    c.dineIn = true;
    expect(keyOf(sim, state)).toBe('thought.customer.goodbye');
  });

  it('keeps a cast member’s tastes across visit IDs, positions, days and order duration', () => {
    const { state, sim, c } = setup({ ...dining, appearanceId: 5 });
    const before = thoughtCandidates(sim, state)[0];
    c.id = 999;
    c.x += 25;
    c.timer = 2;
    state.day = 52;
    const after = thoughtCandidates(sim, state)[0];
    expect(after.key).toBe(before.key);
    expect(after.context).toBe(before.context);
    expect(after.id).toBe('customer:999');
    c.appearanceId = undefined;
    const fallback = keyOf(sim, state, 'customer:999');
    c.id = 1001;
    expect(keyOf(sim, state, 'customer:1001')).toBe(fallback);
  });

  it('attaches each seated identity to its actual left or right seat', () => {
    const state=openState(), sim=new Sim();
    sim.customers=[0,1,10,11].map((seat,id)=>{const p=seatSpot(Math.floor(seat/2),seat%2 as 0|1);return customer({...dining,id:id+1,seat,...p,tx:p.x,ty:p.y});});
    const thoughts=thoughtCandidates(sim,state);
    for(const guest of sim.customers){const p=seatSpot(Math.floor(guest.seat/2),guest.seat%2 as 0|1);const thought=thoughts.find(t=>t.id===`customer:${guest.id}`)!;expect(thought.x).toBe(p.x);expect(thought.y).toBe(p.y-CHAR_H-5);}
  });

  it('anchors at the head top and lifts seated customers by five pixels', () => {
    const { state, sim, c } = setup();
    expect(thoughtCandidates(sim, state)[0]).toMatchObject({ x: c.x, y: c.y - CHAR_H });
    c.phase = 'waiting';
    expect(thoughtCandidates(sim, state)[0].y).toBe(c.y - CHAR_H - 5);
    Object.assign(c, dining);
    expect(thoughtCandidates(sim, state)[0].y).toBe(c.y - CHAR_H - 5);
  });
});

describe('contextual employee thoughts', () => {
  it('distinguishes the owner, hired baristas, actual work and finished orders', () => {
    const state = openState(), sim = new Sim();
    sim.baristas = [barista(), barista()];
    expect(keyOf(sim, state, 'barista:0')).toBe('thought.owner.idle');
    expect(keyOf(sim, state, 'barista:1')).toBe('thought.barista.idle');
    sim.baristas.forEach(b => { b.customerId = 1; });
    expect(keyOf(sim, state, 'barista:0')).toBe('thought.owner.welcome');
    expect(keyOf(sim, state, 'barista:1')).toBe('thought.barista.welcome');
    sim.baristas.forEach(b => { b.total = 4; b.remaining = 2; });
    expect(keyOf(sim, state, 'barista:0')).toBe('thought.owner.working');
    expect(keyOf(sim, state, 'barista:1')).toBe('thought.barista.working');
    const owner = thoughtCandidates(sim, state)[0], pose = sim.baristaPose(0);
    expect(owner).toMatchObject({ x: pose.x, y: pose.y - CHAR_H });
    sim.baristas[0].remaining = 0;
    expect(keyOf(sim, state, 'barista:0')).toBe('thought.staff.orderReady');
    sim.baristas[0].calling = 1;
    expect(keyOf(sim, state, 'barista:0')).toBeUndefined();
  });

  it('follows a server’s tray out and return while preserving the acknowledgement icon', () => {
    const state = openState(), sim = new Sim();
    const s = server();
    sim.servers = [s];
    expect(keyOf(sim, state, 'server:0')).toBe('thought.server.idle');
    s.phase = 'toPass';
    s.ack = 0.9;
    expect(keyOf(sim, state, 'server:0')).toBeUndefined();
    s.ack = 0;
    expect(keyOf(sim, state, 'server:0')).toBe('thought.server.pickup');
    s.phase = 'delivering';
    s.plates = [{ customerId: 1, items: ['espresso'], barista: 0, server: 0, waited: 0 }];
    expect(keyOf(sim, state, 'server:0')).toBe('thought.server.deliver');
    s.phase = 'returning';
    s.plates = [];
    expect(keyOf(sim, state, 'server:0')).toBe('thought.server.return');
    expect(thoughtCandidates(sim, state)[0].y).toBe(s.y - CHAR_H);
  });

  it('matches real kitchen stations, travel and ready batches', () => {
    const state = openState(), sim = new Sim();
    state.kitchen = true;
    const cook: Cook = { look: { ...look }, x: -100, y: 100, tx: -100, ty: 100, stride: 0, via: [], batch: null };
    sim.cooks = [cook];
    expect(keyOf(sim, state, 'cook:0')).toBe('thought.cook.idle');
    const expectations: [Station, MessageKey][] = [
      ['cooler', 'thought.cook.gather'], ['dryStore', 'thought.cook.gather'],
      ['mixer', 'thought.cook.mix'], ['standMixer', 'thought.cook.mix'],
      ['proofer', 'thought.cook.rise'], ['bench', 'thought.cook.prep'],
      ['sheeter', 'thought.cook.fold'], ['kettle', 'thought.cook.boil'],
      ['deckOven', 'thought.cook.bake'], ['convection', 'thought.cook.bake'],
      ['fryer', 'thought.cook.fry'], ['rack', 'thought.cook.cool'],
      ['pastryFridge', 'thought.cook.chill'], ['door', 'thought.cook.ready'],
    ];
    for (const [station, key] of expectations) {
      const pos = stationSpot(station);
      Object.assign(cook, pos, { tx: pos.x, ty: pos.y });
      cook.batch = { item: 'cake', n: 5, steps: [station], step: 0, timer: 1 };
      expect(keyOf(sim, state, 'cook:0')).toBe(key);
    }
    cook.batch = { item: 'roll', n: 5, steps: batchSteps('roll'), step: 1, timer: 2 };
    cook.tx += 10;
    expect(keyOf(sim, state, 'cook:0')).toBe('thought.cook.carry');
    state.kitchen = false;
    expect(keyOf(sim, state, 'cook:0')).toBeUndefined();
  });
});

describe('cosmetic thoughts contract', () => {
  it('stays quiet while closed', () => {
    const { state, sim } = setup(dining);
    sim.baristas = [barista()];
    state.phase = 'prep';
    expect(thoughtCandidates(sim, state)).toEqual([]);
  });

  it('has short, complete translations and supports every cast member and dish', () => {
    const en = messagesFor('en'), zh = messagesFor('zh');
    for (const key of Object.keys(en).filter(k => k.startsWith('thought.')) as MessageKey[]) {
      expect([...en[key]].length, key).toBeLessThanOrEqual(30);
      expect([...zh[key]].length, key).toBeLessThanOrEqual(10);
    }
    const { state, sim, c } = setup(dining);
    const seen = new Set<MessageKey>();
    for (const cast of CUSTOMER_CAST) for (const item of MENU) {
      c.appearanceId = cast.id;
      c.order = item.id;
      const key = keyOf(sim, state)!;
      expect(en[key], key).toBeTruthy();
      expect(zh[key], key).toBeTruthy();
      seen.add(key);
    }
    for (const key of Object.keys(en).filter(k => /^thought\.(like|dislike)\./.test(k)) as MessageKey[]) expect(seen.has(key), key).toBe(true);
  });

  it('does not mutate even frozen simulation/save data or consume either random source', () => {
    const rng = vi.fn(() => 0.5), sim = new Sim(rng), state = openState();
    sim.customers = [customer(dining)];
    sim.baristas = [barista({ customerId: 1, total: 4, remaining: 2 })];
    sim.servers = [server()];
    const before = JSON.stringify([sim, state]);
    freezeDeep(sim);
    freezeDeep(state);
    const globalRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Cosmetic thoughts must not draw randomness'); });
    const first = thoughtCandidates(sim, state);
    for (let i = 0; i < 10; i++) expect(thoughtCandidates(sim, state)).toEqual(first);
    expect(JSON.stringify([sim, state])).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    expect(globalRandom).not.toHaveBeenCalled();
  });

  it('leaves seeded future gameplay, recipes, revenue and spawn decisions identical', () => {
    const seeded = () => {
      let seed = 12345;
      return vi.fn(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32));
    };
    const rngA = seeded(), rngB = seeded(), a = new Sim(rngA), b = new Sim(rngB);
    const stateA = openState(), stateB = openState();
    for (const state of [stateA, stateB]) {
      state.kitchen = true;
      state.pantry.beans = state.pantry.flour = state.pantry.butter = 200;
      state.items.roll = 1;
      state.shelf.roll = 10;
      state.onMenu = ['espresso', 'roll'];
    }
    for (let tick = 0; tick < 600; tick++) {
      expect(a.update(stateA, 0.25)).toEqual(b.update(stateB, 0.25));
      thoughtCandidates(a, stateA);
      thoughtCandidates(a, stateA);
    }
    expect(serialize(stateA)).toBe(serialize(stateB));
    expect(a.customers).toEqual(b.customers);
    expect(a.baristas).toEqual(b.baristas);
    expect(a.servers).toEqual(b.servers);
    expect(a.cooks).toEqual(b.cooks);
    expect(rngA).toHaveBeenCalledTimes(rngB.mock.calls.length);
  });
});


describe('custom drink dining thoughts', () => {
  const cases: [SignatureBase, SignatureRecipe, number, MessageKey][] = [
    ['coffee', { beans: 1 }, 0, 'thought.like.bold'],
    ['tea', { tea: 1 }, 4, 'thought.like.tea'],
    ['milk', { milk: 1 }, 1, 'thought.like.milky'],
    ['fruit', { fruit: 1 }, 6, 'thought.like.fruity'],
  ];
  it.each(cases)('renders %s flavor after the served celebration without mutating the simulation', (base, recipe, appearanceId, expected) => {
    const id = makeSignatureId(base, recipe)!;
    const { state, sim, c } = setup({ ...dining, order: id, appearanceId, mood: 'happy', moodTimer: 1 });
    expect(keyOf(sim, state)).toBe('thought.customer.served');
    c.moodTimer = 0;
    const before = serialize(state), customerBefore = JSON.stringify(c);
    freezeDeep(state); freezeDeep(c);
    for (let i = 0; i < 20; i++) expect(keyOf(sim, state)).toBe(expected);
    expect(serialize(state)).toBe(before); expect(JSON.stringify(c)).toBe(customerBefore);
  });
  it.each(cases)('considers %s custom drinks in either delivered combo position', (base, recipe, appearanceId, expected) => {
    const id = makeSignatureId(base, recipe)!;
    const neutral: ItemId = base === 'tea' ? 'espresso' : 'blacktea';
    for (const [order, extra] of [[id, neutral], [neutral, id]] as [ItemId, ItemId][]) {
      const { state, sim, c } = setup({ ...dining, order, extra, appearanceId });
      const before = serialize(state), customerBefore = JSON.stringify(c);
      freezeDeep(state); freezeDeep(c);
      expect(keyOf(sim, state)).toBe(expected);
      expect(serialize(state)).toBe(before); expect(JSON.stringify(c)).toBe(customerBefore);
    }
  });
  it.each([
    ['sig:coffee:beans=1,cocoa=1', 2, 'thought.like.cocoa'],
    ['sig:coffee:beans=1,sugar=1', 3, 'thought.like.sweet'],
    ['sig:coffee:beans=1,spice=1', 5, 'thought.like.spiced'],
    ['sig:milk:matcha=1,milk=1', 4, 'thought.like.tea'],
    ['sig:fruit:cream=1,fruit=1', 1, 'thought.like.milky'],
  ] as [ItemId, number, MessageKey][])('maps addon flavor for %s', (order, appearanceId, expected) => {
    const { state, sim } = setup({ ...dining, order, appearanceId });
    expect(keyOf(sim, state)).toBe(expected);
  });
});


it.each(['coffee', 'tea', 'milk', 'fruit'] as const)('continues rendered thoughts after a real %s custom dine-in handoff', (base) => {
  const s = createInitialState(0);
  for (const item of MENU) s.items[item.id] = 1;
  for (const ingredient of INGREDIENTS) s.pantry[ingredient.id] = 100;
  const recipe = { [base === 'coffee' ? 'beans' : base]: 1 };
  const id = makeSignatureId(base, recipe)!;
  expect(trialSignature(s, base, recipe).ok).toBe(true);
  expect(saveSignature(s, id, 'Real dining')).toBe(true);
  expect(setSignatureOnMenu(s, id, true)).toBe(true);
  s.onMenu = [];
  const sim = new Sim(() => 0);
  openShop(s);
  for (let i = 0; i < 3000 && !sim.customers.some(c => c.phase === 'sitting' && c.hasCup && c.moodTimer <= 0); i++) {
    sim.update(s, .05);
    expect(() => thoughtCandidates(sim, s)).not.toThrow();
  }
  const diner = sim.customers.find(c => c.phase === 'sitting' && c.hasCup && c.moodTimer <= 0);
  expect(diner).toBeDefined();
  expect(diner!.order).toBe(id);
  const stateBefore = serialize(s), snapshotBefore = JSON.stringify(sim.snapshot(s));
  expect(thoughtCandidates(sim, s).some(t => t.id === `customer:${diner!.id}` && t.context.startsWith('taste:'))).toBe(true);
  expect(serialize(s)).toBe(stateBefore);
  expect(JSON.stringify(sim.snapshot(s))).toBe(snapshotBefore);
});
