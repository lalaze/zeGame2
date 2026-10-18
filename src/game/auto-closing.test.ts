import { afterEach, describe, expect, it } from 'vitest';
import { openShop } from './day';
import { recipe } from './economy';
import { setKitchenLevel } from './layout';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize } from './state';

afterEach(() => setKitchenLevel(0));

function shop() {
  const state = createInitialState(0);
  openShop(state);
  const sim = new Sim(() => .5);
  sim.update(state, 0);
  return { state, sim };
}

function bakery() {
  const { state, sim } = shop();
  state.kitchen = true;
  state.items.roll = 1;
  state.onMenu = ['roll'];
  state.shelf.roll = 0;
  sim.update(state, 0);
  return { state, sim };
}

describe('automatic closing when the whole menu runs out', () => {
  it('closes before admitting guests without lost sales or reviews', () => {
    const { state, sim } = shop();
    state.pantry.beans = 0;
    const nextId = sim.snapshot(state).nextId;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
    expect(sim.snapshot(state).nextId).toBe(nextId);
    expect(sim.queue).toHaveLength(0);
    expect(state.today.missed).toBe(0);
    expect(state.reputation.recent).toHaveLength(0);
    expect(sim.finishedService).toBe(true);
    const report = sim.closeShop(state)!;
    expect(report.day).toBe(1);
    expect(state.phase).toBe('prep');
    expect(state.day).toBe(2);
  });

  it('finishes and charges for the final accepted order before settlement', () => {
    const { state, sim } = shop();
    state.pantry.beans = 1;
    for (let tick = 0; tick < 1200 && state.phase === 'open'; tick++) sim.update(state, .05);
    expect(state.phase).toBe('closing');
    expect(state.pantry.beans).toBe(0);
    expect(sim.finishedService).toBe(false);
    const restored = deserialize(serialize(state), 0);
    const resumed = new Sim(() => .5);
    expect(resumed.restore(sim.snapshot(state), restored)).toBe(true);
    for (let tick = 0; tick < 2400 && !resumed.finishedService; tick++) resumed.update(restored, .05);
    expect(resumed.finishedService).toBe(true);
    const report = resumed.closeShop(restored)!;
    expect(report.served).toBe(1);
    expect(report.revenue).toBeGreaterThan(0);
    expect(report.missed).toBe(0);
  });

  it('stays open while any other menu item can still be sold', () => {
    const { state, sim } = shop();
    state.items.blacktea = 1;
    state.onMenu.push('blacktea');
    state.pantry.beans = 0;
    for (const [id, n] of recipe('blacktea')) state.pantry[id] = n * 10;
    sim.update(state, .05);
    expect(state.phase).toBe('open');
  });

  it('counts baked shelf stock even when its raw ingredients are gone', () => {
    const { state, sim } = bakery();
    state.shelf.roll = 1;
    sim.update(state, .05);
    expect(state.phase).toBe('open');
    state.shelf.roll = 0;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
  });

  it('waits for kitchen replenishment and an already started final batch', () => {
    const { state, sim } = bakery();
    for (const [id, n] of recipe('roll')) state.pantry[id] = n;
    sim.update(state, .05);
    expect(state.phase).toBe('open');
    expect(state.inProduction.roll).toBe(1);
    sim.update(state, .05);
    expect(state.phase).toBe('open');
    for (let tick = 0; tick < 2400 && !state.shelf.roll; tick++) sim.update(state, .05);
    expect(state.shelf.roll).toBe(1);
    expect(state.phase).toBe('open');
    state.shelf.roll = 0;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
  });

  it('ignores off-menu stock and incomplete drink ingredients', () => {
    const { state, sim } = shop();
    state.pantry.beans = .5;
    state.pantry.milk = 100;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
  });

  it('does not close a paused shop or a shop still in preparation', () => {
    const { state, sim } = shop();
    state.pantry.beans = 0;
    sim.update(state, 0);
    expect(state.phase).toBe('open');
    state.phase = 'prep';
    sim.update(state, .05);
    expect(state.phase).toBe('prep');
  });
});

describe('the twelve-hour trading day', () => {
  it('closes at the end of the business day even with plenty of stock', () => {
    const { state, sim } = shop();
    state.dayTime = 179.95;
    const nextId = sim.snapshot(state).nextId;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
    expect(sim.snapshot(state).nextId).toBe(nextId);
    expect(state.pantry.beans).toBeGreaterThan(0);
  });

  it('finishes the final accepted order after the closing hour without extra arrivals', () => {
    const { state, sim } = shop();
    for (let tick = 0; tick < 1200 && !sim.customers.some(c => c.phase === 'ordering'); tick++) sim.update(state, .05);
    expect(sim.customers.some(c => c.phase === 'ordering')).toBe(true);
    state.dayTime = 179.95;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
    const nextId = sim.snapshot(state).nextId;
    for (let tick = 0; tick < 2400 && !sim.finishedService; tick++) sim.update(state, .05);
    expect(sim.finishedService).toBe(true);
    expect(sim.snapshot(state).nextId).toBe(nextId);
    expect(sim.closeShop(state)!.served).toBeGreaterThan(0);
  });

  it('closes an overdue saved day before admitting any new guests', () => {
    const { state, sim } = shop();
    state.dayTime = 33 * 60 + 9;
    const nextId = sim.snapshot(state).nextId;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
    expect(sim.snapshot(state).nextId).toBe(nextId);
  });
});
