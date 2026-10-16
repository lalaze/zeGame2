/** Real simulation regressions. Endowed fixtures are explicit; normal UI play is separate. */
import { describe, expect, it } from 'vitest';
import { MENU, PASS_SLOTS } from './data';
import { openShop } from './day';
import { isBakery } from './economy';
import { Sim, type SimEvent } from './sim';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import {
  assignPartner, partnerContributions, partnerSlots, readPartnerChapter,
  recruitPartner, syncPartners,
} from './partners';

const STEP = 0.1;
const rng = (seed = 731) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
function refill(s: GameState) {
  for (const id of Object.keys(s.pantry) as (keyof GameState['pantry'])[]) s.pantry[id] = 10_000;
}
function fixture(bakery = false) {
  const s = createInitialState(1);
  s.coins = 10_000;
  s.upgrades.barista = 1;
  s.kitchen = bakery;
  if (bakery) {
    const item = MENU.find(m => isBakery(m.id));
    if (!item) throw new Error('The game needs a bakery menu item for this fixture');
    s.items[item.id] = 1;
    s.onMenu = ['espresso', item.id];
    s.bakePlan[item.id] = 12;
  }
  refill(s);
  syncPartners(s);
  const sim = new Sim(rng());
  return { s, sim };
}
function tick(s: GameState, sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) events.push(...sim.update(s, STEP));
  return events;
}
function until(s: GameState, sim: Sim, ready: () => boolean, seconds = 600) {
  for (let i = 0; i < Math.ceil(seconds / STEP) && !ready(); i++) sim.update(s, STEP);
  expect(ready(), `Expected simulation condition within ${seconds} simulated seconds`).toBe(true);
}
function xp(s: GameState) {
  return Object.fromEntries(Object.entries(s.partners.roster).map(([id, p]) => [id, p.xp]));
}
function refresh(s: GameState, sim: Sim) {
  const snap = sim.snapshot(s);
  const copy = deserialize(serialize(s), 2);
  const resumed = new Sim(rng(993));
  // Exercise a real JSON boundary, including optional runtime completion markers.
  expect(resumed.restore(JSON.parse(JSON.stringify(snap)), copy)).toBe(true);
  return { s: copy, sim: resumed };
}

describe('partner growth through real simulation transitions', () => {
  it('attributes brewing and successful table delivery to separate on-duty people', () => {
    const { s, sim } = fixture();
    openShop(s);
    until(s, sim, () => s.partners.roster.lin.xp >= 3 && s.partners.roster.yue.xp >= 2);
    expect(sim.baristas.some(b => b.partnerId === 'lin')).toBe(true);
    expect(sim.servers[0].partnerId).toBe('yue');
    expect(s.partners.roster.yue.xp).toBeLessThanOrEqual(s.today.served);
    expect(s.partners.roster.lin.workedDays).toBe(1);
    expect(s.partners.roster.yue.workedDays).toBe(1);
    expect(s.partners.roster.lin.todayJobs).toBe(s.partners.roster.lin.xp);
  });

  it('credits cooks once per completed shelf batch, never for automatic morning baking', () => {
    const { s, sim } = fixture(true);
    const morning = openShop(s);
    expect(morning).toBeGreaterThan(0);
    expect(s.partners.roster.mei.xp).toBe(0);
    let batches = 0;
    let units = 0;
    for (let i = 0; i < 6000 && batches < 3; i++) {
      const before = Object.values(s.today.baked).reduce<number>((n, v) => n + (v ?? 0), 0);
      for (const e of sim.update(s, STEP)) if (e.type === 'restock') { batches++; units += e.n; }
      const after = Object.values(s.today.baked).reduce<number>((n, v) => n + (v ?? 0), 0);
      expect(after).toBeGreaterThanOrEqual(before);
      expect(s.partners.roster.mei.xp).toBe(batches);
    }
    expect(batches).toBeGreaterThanOrEqual(2);
    expect(Object.values(s.today.baked).reduce<number>((n, v) => n + (v ?? 0), 0)).toBe(morning + units);
    expect(sim.cooks[0].partnerId).toBe('mei');
  });

  it('does not advance work, inventory, money or timers while paused at dt=0', () => {
    const { s, sim } = fixture(true);
    openShop(s);
    until(s, sim, () => sim.cooks.some(c => c.batch !== null) && sim.baristas.some(b => b.total > 0 && b.remaining > 0));
    const before = serialize(s);
    const runtime = sim.snapshot(s);
    for (let i = 0; i < 30; i++) expect(sim.update(s, 0)).toEqual([]);
    expect(serialize(s)).toBe(before);
    expect(sim.snapshot(s)).toEqual(runtime);
  });

  it('refreshes in-flight work without granting XP; completed jobs continue after refresh', () => {
    const original = fixture(true);
    openShop(original.s);
    until(original.s, original.sim, () => original.sim.cooks.some(c => c.batch !== null)
      && original.sim.baristas.some(b => b.total > 0 && b.remaining > 0));
    const before = xp(original.s);
    let resumed = refresh(original.s, original.sim);
    for (let i = 0; i < 3; i++) {
      resumed.sim.update(resumed.s, 0);
      expect(xp(resumed.s)).toEqual(before);
      resumed = refresh(resumed.s, resumed.sim);
    }
    until(resumed.s, resumed.sim, () => resumed.s.partners.roster.lin.xp > before.lin
      && resumed.s.partners.roster.mei.xp > before.mei);
    const credited = xp(resumed.s);
    const again = refresh(resumed.s, resumed.sim);
    again.sim.update(again.s, 0);
    expect(xp(again.s)).toEqual(credited);
  });

  it('credits a finished brew exactly once while its order waits for a full pass', () => {
    const { s, sim } = fixture();
    openShop(s);
    until(s, sim, () => sim.baristas.some(b => b.partnerId === 'lin' && b.remaining > 1));
    const b = sim.baristas.find(b => b.partnerId === 'lin' && b.remaining > 1)!;
    const customer = sim.customers.find(c => c.id === b.customerId)!;
    // Fault injection only blocks the pass; the actual brew was started by Sim.
    customer.dineIn = true;
    customer.phase = 'waiting';
    customer.timer = 1000;
    b.remaining = STEP / 2;
    const before = s.partners.roster.lin.xp;
    const blockPass = () => {
      sim.pass = Array.from({ length: PASS_SLOTS }, (_, i) => ({
        customerId: -100 - i, items: [customer.order], barista: 0, server: null, waited: 0,
      }));
    };
    for (let i = 0; i < 20; i++) {
      blockPass();
      sim.update(s, STEP);
      expect(b.customerId).toBe(customer.id);
      expect(s.partners.roster.lin.xp).toBe(before + 1);
    }
    sim.pass = [];
    sim.update(s, STEP);
    expect(b.customerId).toBeNull();
    expect(s.partners.roster.lin.xp).toBe(before + 1);
    // Subsequent jobs must reset the per-job completion marker.
    until(s, sim, () => s.partners.roster.lin.xp >= before + 2);
  });

  it('forced close reports only completed work and cannot farm XP by closing again', () => {
    const { s, sim } = fixture(true);
    openShop(s);
    until(s, sim, () => s.partners.roster.lin.xp > 0 && sim.cooks.some(c => c.batch !== null));
    const before = xp(s);
    const contributions = partnerContributions(s);
    const report = sim.closeShop(s)!;
    expect(report.partners).toEqual(contributions);
    expect(xp(s)).toEqual(before);
    expect(s.phase).toBe('prep');
    expect(sim.cooks.every(c => c.batch === null)).toBe(true);
    expect(sim.closeShop(s)).toBeNull();
    tick(s, sim, 5);
    expect(xp(s)).toEqual(before);
  });

  it('normal closing allows pending work to finish and settlement adds no extra credit', () => {
    const { s, sim } = fixture(true);
    openShop(s);
    until(s, sim, () => sim.cooks.some(c => c.batch !== null));
    const beforeCook = s.partners.roster.mei.xp;
    sim.beginClosing(s);
    expect(s.phase).toBe('closing');
    until(s, sim, () => sim.finishedService, 300);
    expect(s.partners.roster.mei.xp).toBeGreaterThan(beforeCook);
    const before = xp(s);
    const contributions = partnerContributions(s);
    expect(sim.closeShop(s)!.partners).toEqual(contributions);
    expect(xp(s)).toEqual(before);
  });

  it('keeps reserves idle, then credits the replacement on the next working day', () => {
    const { s, sim } = fixture(true);
    for (const id of ['theo', 'ari', 'hugo']) expect(recruitPartner(s, id)).toBe(true);
    openShop(s);
    until(s, sim, () => s.partners.roster.lin.xp > 0 && s.partners.roster.yue.xp > 0 && s.partners.roster.mei.xp > 0);
    for (const id of ['theo', 'ari', 'hugo']) {
      expect(s.partners.roster[id].xp).toBe(0);
      expect(assignPartner(s, id, 0)).toBe(false);
    }
    sim.closeShop(s);
    const previous = xp(s);
    for (const id of ['theo', 'ari', 'hugo']) expect(assignPartner(s, id, 0)).toBe(true);
    // Reopen immediately: assignment must not depend on an intervening prep frame.
    expect(partnerSlots(s, 'barista')).toBe(1);
    expect(partnerSlots(s, 'server')).toBe(1);
    expect(partnerSlots(s, 'cook')).toBe(1);
    refill(s);
    openShop(s);
    until(s, sim, () => ['theo', 'ari', 'hugo'].every(id => s.partners.roster[id].xp > 0));
    for (const id of ['lin', 'yue', 'mei']) expect(s.partners.roster[id].xp).toBe(previous[id]);
  });

  it('repairs legacy paid staff slots without charges, fabricated jobs or duplicate active people', () => {
    const { s } = fixture(true);
    s.upgrades.barista = 3; s.upgrades.server = 2; s.upgrades.cook = 2;
    const raw = JSON.parse(serialize(s));
    delete raw.partners;
    raw.version = 15;
    const loaded = deserialize(JSON.stringify(raw), 2);
    expect(loaded.coins).toBe(s.coins);
    expect(Object.keys(loaded.partners.roster)).toHaveLength(9);
    for (const role of ['barista', 'server', 'cook'] as const) {
      expect(loaded.partners.active[role]).toHaveLength(3);
      expect(new Set(loaded.partners.active[role]).size).toBe(3);
    }
    for (const p of Object.values(loaded.partners.roster)) expect([p.xp, p.workedDays, p.unlocked]).toEqual([0, 0, 0]);
    expect(deserialize(serialize(loaded), 3).partners).toEqual(loaded.partners);
  });

  it('reaches every story chapter from real server deliveries across business days', () => {
    let { s, sim } = fixture();
    // No direct XP/worked-day mutation or calls to recordPartnerWork in this test.
    for (let day = 0; day < 12 && s.partners.roster.yue.unlocked < 3; day++) {
      refill(s);
      openShop(s);
      tick(s, sim, 600);
      if (day === 0) expect(s.partners.roster.yue.unlocked).toBeLessThanOrEqual(1);
      if (day === 1) expect(s.partners.roster.yue.unlocked).toBeLessThanOrEqual(2);
      sim.beginClosing(s);
      until(s, sim, () => sim.finishedService, 300);
      sim.closeShop(s);
      // Fresh sim after a normal closed-shop save; persistence must preserve progress.
      s = deserialize(serialize(s), 10 + day);
      sim = new Sim(rng(731 + day));
    }
    const p = s.partners.roster.yue;
    expect(p.xp).toBeGreaterThanOrEqual(60);
    expect(p.workedDays).toBeGreaterThanOrEqual(3);
    expect(p.unlocked).toBe(3);
    const before = p.xp;
    for (let chapter = 0; chapter < 3; chapter++) {
      expect(readPartnerChapter(s, 'yue', chapter)).toBe(true);
      expect(readPartnerChapter(s, 'yue', chapter)).toBe(false);
    }
    expect(p.xp).toBe(before);
    expect(deserialize(serialize(s), 99).partners.roster.yue.read).toEqual([0, 1, 2]);
  }, 30_000);
});
