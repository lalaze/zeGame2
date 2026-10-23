import { describe, expect, it } from 'vitest';
import { CUSTOMER_CAST, CustomerCastCycle } from './customer-cast';
import { PARTNERS, PARTNER_ROLES, assignPartner, recruitPartner, syncPartners } from './partners';
import { PARTNER_STORIES } from './partner-stories';
import { createInitialState, deserialize, serialize } from './state';
import { openShop } from './day';
import { Sim } from './sim';

describe('neighborhood guests and reserve staff', () => {
  it('finishes a saved original cast cycle before adding the new guests next cycle', () => {
    const cycle = new CustomerCastCycle(() => .5);
    expect(cycle.restore({ previous: 29, remaining: [0, 4, 17] })).toBe(true);
    expect([cycle.next().id, cycle.next().id, cycle.next().id]).toEqual([17, 4, 0]);
    const next = Array.from({ length: CUSTOMER_CAST.length }, () => cycle.next().id);
    expect(next[0]).not.toBe(0);
    expect(next.sort((a, b) => a - b)).toEqual(CUSTOMER_CAST.map(p => p.id));
  });

  it('offers five distinct candidates per role with complete bilingual stories', () => {
    expect(new Set(PARTNERS.map(p => p.id)).size).toBe(15);
    for (const role of PARTNER_ROLES) {
      const people = PARTNERS.filter(p => p.role === role);
      expect(people).toHaveLength(5);
      expect(new Set(people.map(p => JSON.stringify(p.look))).size).toBe(5);
    }
    for (const p of PARTNERS) {
      const story = PARTNER_STORIES[p.id];
      expect(story.chapters).toHaveLength(3);
      for (const text of [story.intro, ...story.chapters]) {
        expect(text.zh.length).toBeGreaterThan(15);
        expect(text.en.length).toBeGreaterThan(30);
      }
    }
  });

  it.each([['qinghe', 'xiaoman', 'chestnut'], ['amber', 'holly', 'bailu']])(
    'recruits and runs the new team %s / %s / %s through save and live-session reload', (barista, server, cook) => {
      const state = createInitialState(1);
      state.coins = 2000; state.kitchen = true; state.upgrades.barista = 1;
      syncPartners(state);
      const original = structuredClone(state.partners.active);
      for (const id of [barista, server, cook]) expect(recruitPartner(state, id)).toBe(true);
      expect(state.coins).toBe(1820);
      expect(state.partners.active).toEqual(original);
      for (const id of [barista, server, cook]) expect(assignPartner(state, id, 0)).toBe(true);
      const saved = deserialize(serialize(state), 2);
      expect(saved.partners).toEqual(state.partners);
      openShop(saved);
      const sim = new Sim(() => .5); sim.update(saved, 0);
      for (const [role, actors, id] of [
        ['barista', sim.baristas, barista], ['server', sim.servers, server], ['cook', sim.cooks, cook],
      ] as const) {
        const actor = actors.find(p => p.partnerId === id);
        expect(actor, role).toBeDefined();
        expect(actor!.look).toEqual(PARTNERS.find(p => p.id === id)!.look);
      }
      const resumed = new Sim(() => .5);
      expect(resumed.restore(JSON.parse(JSON.stringify(sim.snapshot(saved))), saved)).toBe(true);
      expect(resumed.servers[0].partnerId).toBe(server);
      expect(resumed.servers[0].look.hairStyle).toBe(PARTNERS.find(p => p.id === server)!.look.hairStyle);
    },
  );
});
