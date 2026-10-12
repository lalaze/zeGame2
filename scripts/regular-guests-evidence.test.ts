/** Real Sim arrivals/handoffs from a labeled funded fixture. No injected story progress. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { openShop } from '../src/game/day';
import { setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { REGULAR_GUESTS } from '../src/game/regular-guests-content';
import { regularGuestChapterRequirement, regularGuestUnreadCount, markRegularGuestChapterRead } from '../src/game/regular-guests';
import { SaveSession } from '../src/game/save-session';
import { Sim } from '../src/game/sim';
import { createInitialState, deserialize, serialize } from '../src/game/state';

const enabled = process.env.REGULAR_GUESTS_EVIDENCE === '1';
const seeded = (start: number) => { let seed = start; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const out = 'docs/regular-guests';
const dt = 0.1;
function fixture() {
  const state = createInitialState(0);
  state.profile = { cafeName: 'Regular Guests QA', ownerName: 'QA', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
  state.goal = 15;
  // Explicit synthetic stock/funding. Normal espresso-only menu, base equipment and normal service.
  state.coins = 10000;
  state.pantry.beans = 100000;
  return state;
}
afterEach(() => { setSceneHeight(240); setKitchenLevel(0); });

describe('regular guest natural multi-day evidence', () => {
  it.skipIf(!enabled)('reaches all sixty chapters through actual arrivals and handoffs across business days', () => {
    mkdirSync(`${out}/logs`, { recursive: true }); mkdirSync(`${out}/fixtures`, { recursive: true });
    writeFileSync(`${out}/fixtures/fresh.json`, serialize(fixture()) + "\n");
    const runs: unknown[] = [];
    for (const seed of [13, 517, 2026]) {
      let state = fixture(); const sim = new Sim(seeded(seed));
      const unlocks: { guest: string; chapter: number; day: number; served: number; seconds: number }[] = [];
      const seen = new Set<string>();
      const days: unknown[] = [];
      const observe = () => {
        for (const guest of REGULAR_GUESTS) {
          const p = state.regularGuests.guests[guest.id];
          for (const chapter of p?.unlockedChapters ?? []) {
            const key = `${guest.id}/${chapter}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const req = regularGuestChapterRequirement(guest.id, chapter)!;
            expect(state.day).toBeGreaterThanOrEqual(req.day);
            expect(p!.served).toBeGreaterThanOrEqual(req.served);
            expect(unlocks.some(u => u.guest === guest.id && u.day === state.day)).toBe(false);
            unlocks.push({ guest: guest.id, chapter: chapter + 1, day: state.day, served: p!.served, seconds: state.dayTime });
          }
        }
      };
      // Latest debut + four two-day story intervals = day 19. Allow normal visit variability to day 30.
      while (state.day <= 30 && seen.size < 60) {
        openShop(state);
        for (let tick = 0; tick < 6000; tick++) { sim.update(state, dt); observe(); }
        sim.beginClosing(state);
        let closing = 0;
        while (!sim.finishedService && closing++ < 1200) { sim.update(state, dt); observe(); }
        expect(sim.finishedService).toBe(true);
        const report = sim.closeShop(state)!;
        days.push({ day: report.day, served: report.served, missed: report.missed, revenue: report.revenue, profit: report.profit, unlocked: seen.size });
        // Save every day; actual parse, no assignment to the story journal.
        const before = structuredClone(state.regularGuests);
        state = deserialize(serialize(state), 0);
        expect(state.regularGuests).toEqual(before);
        if (seed === 13 && report.day === 1) writeFileSync(`${out}/fixtures/first-day.json`, serialize(state) + "\n");
      }
      expect(seen.size).toBe(60);
      expect(regularGuestUnreadCount(state)).toBe(60);
      const beforeRead = structuredClone(state.regularGuests);
      for (const guest of REGULAR_GUESTS) {
        expect(state.regularGuests.guests[guest.id]!.unlockedChapters).toEqual([0, 1, 2, 3, 4]);
        expect(markRegularGuestChapterRead(state, guest.id, 4)).toBe(true);
        expect(markRegularGuestChapterRead(state, guest.id, 4)).toBe(false);
        expect(state.regularGuests.guests[guest.id]!.served).toBe(beforeRead.guests[guest.id]!.served);
      }
      expect(regularGuestUnreadCount(state)).toBe(48);
      expect(deserialize(serialize(state), 0).regularGuests).toEqual(state.regularGuests);
      if (seed === 13) {
        writeFileSync(`${out}/fixtures/all-stories.json`, serialize(state) + '\n');
        openShop(state);
        let ticks = 0;
        while (!sim.customers.some(c => c.regularGuestId && !c.hasCup && c.phase !== 'exiting') && ticks++ < 6000) sim.update(state, dt);
        expect(ticks).toBeLessThan(6000);
        const raw = JSON.stringify({ ...state, runtime: sim.snapshot(state) });
        const restored = new SaveSession({ getItem: () => raw, setItem: () => {} }, 0, () => {});
        expect(restored.state.regularGuests).toEqual(state.regularGuests);
        expect(restored.sim.customers.map(c => [c.id, c.regularGuestId, c.regularGuestVisitId, c.hasCup])).toEqual(sim.customers.map(c => [c.id, c.regularGuestId, c.regularGuestVisitId, c.hasCup]));
        writeFileSync(`${out}/fixtures/live-service.json`, raw + '\n');
        restored.close();
      }
      runs.push({ seed, businessDays: days.length, chapters: seen.size, unlockedByNaturalHandoffOnly: true, days, unlocks, journalHash: hash(state.regularGuests) });
    }
    const report = { schema: 1, createdAt: new Date().toISOString(), methodology: 'Automated seeded Node Sim; synthetic initial funding/100000 beans, normal espresso-only menu/base equipment. All identities, successful services and chapter unlocks come from actual Sim arrivals/handoffs. 600 seconds open/day; normal drain and settlement; actual save parse after each day. Not a human playtest or an unassisted economy-progression claim.', dt, sources: Object.fromEntries(['src/game/sim.ts', 'src/game/regular-guests.ts', 'src/game/regular-guests-content.ts'].map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')])), runs };
    writeFileSync(`${out}/logs/reachability.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(runs.map((r: any) => ({ seed: r.seed, days: r.businessDays, chapters: r.chapters }))));
  }, 120000);
});
