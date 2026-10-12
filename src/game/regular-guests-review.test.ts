// @vitest-environment happy-dom
/** Independent review: direct contract checks plus real Sim handoffs, not fixture-unlocked UI evidence. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messagesFor, setLocale } from '../i18n';
import { closeModal, isModalOpen } from '../ui/modal';
import { showRegularGuests } from '../ui/regular-guests';
import { CUSTOMER_CAST } from './customer-cast';
import { INGREDIENTS, isDrink, MENU } from './data';
import { openShop } from './day';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from './layout';
import { REGULAR_GUESTS } from './regular-guests-content';
import {
  markRegularGuestChapterRead, parseRegularGuests, recordRegularGuestArrival,
  recordRegularGuestDeparture, recordRegularGuestService, regularGuestChapterRequirement,
  regularGuestForAppearance, regularGuestOrder, regularGuestUnreadCount,
} from './regular-guests';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize, type GameState } from './state';

vi.mock('../render/sprites', () => ({
  character: () => ({ stand: document.createElement('canvas') }),
  toDataURL: () => 'data:image/png;base64,',
}));
const seeded = (initial = 801) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
const guest0 = () => REGULAR_GUESTS[0];
const servedVisit = (s: GameState, id: string) => {
  const token = recordRegularGuestArrival(s, id);
  expect(token).not.toBeNull();
  return { token: token!, chapter: recordRegularGuestService(s, id, token!) };
};
const advance = (s: GameState, sim: Sim, ticks: number) => {
  for (let n = 0; n < ticks; n++) sim.update(s, 0.1);
};
beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '<main><button id="open-journal">Journal</button></main><div id="modal-root"></div>';
});
afterEach(() => {
  closeModal(); setLocale('en'); setSceneHeight(MIN_SCENE_H); setKitchenLevel(0);
  document.body.replaceChildren();
});

describe('independent regular-guest content contracts', () => {
  it('defines twelve unique cast identities, five real bilingual chapters each, without missing keys', () => {
    expect(REGULAR_GUESTS).toHaveLength(12);
    expect(new Set(REGULAR_GUESTS.map(g => g.id)).size).toBe(12);
    expect(new Set(REGULAR_GUESTS.map(g => g.appearanceId)).size).toBe(12);
    expect(REGULAR_GUESTS.map(g => g.debutDay).sort((a, b) => a - b)).toEqual([1, 1, 3, 3, 5, 5, 7, 7, 9, 9, 11, 11]);
    for (const locale of ['en', 'zh'] as const) {
      const messages = messagesFor(locale);
      const texts: string[] = [];
      for (const guest of REGULAR_GUESTS) {
        expect(CUSTOMER_CAST[guest.appearanceId]).toBeDefined();
        expect(isDrink(MENU.find(m => m.id === guest.preferredDrink)!.category)).toBe(true);
        for (const key of [guest.nameKey, guest.roleKey, guest.personalityKey]) expect(messages[key]?.trim().length).toBeGreaterThan(0);
        expect(guest.chapters).toHaveLength(5);
        for (const chapter of guest.chapters) {
          expect(messages[chapter.titleKey]?.trim().length).toBeGreaterThan(0);
          const prose = messages[chapter.textKey];
          expect(prose?.trim().length).toBeGreaterThan(locale === 'zh' ? 35 : 90);
          expect(prose).not.toMatch(/TODO|placeholder|待补充|示例文案|lorem ipsum/i);
          expect(prose).not.toMatch(/\{\w+\}/);
          texts.push(prose);
        }
      }
      expect(new Set(texts).size).toBe(60);
    }
    expect(Object.keys(messagesFor('zh')).sort()).toEqual(Object.keys(messagesFor('en')).sort());
  });

  it('never assigns an identity before debut and all sixty chapters are reachable without reading', () => {
    let totalUnlocked = 0;
    for (const g of REGULAR_GUESTS) {
      let s = createInitialState(0); s.phase = 'open';
      expect(regularGuestForAppearance(g.appearanceId, g.debutDay - 1)).toBeUndefined();
      s.day = g.debutDay;
      expect(regularGuestForAppearance(g.appearanceId, s.day)?.id).toBe(g.id);
      for (let chapter = 0; chapter < 5; chapter++) {
        const required = regularGuestChapterRequirement(g.id, chapter)!;
        expect(required).toEqual({ day: g.debutDay + chapter * 2, served: chapter + 1 });
        s.day = required.day;
        expect(servedVisit(s, g.id).chapter).toBe(chapter);
        const saved = s.regularGuests;
        s = deserialize(serialize(s), 99);
        expect(s.regularGuests).toEqual(saved);
        expect(servedVisit(s, g.id).chapter).toBeNull(); // A second success that day never adds a chapter.
      }
      expect(s.regularGuests.guests[g.id]!.unlockedChapters).toEqual([0, 1, 2, 3, 4]);
      expect(s.regularGuests.guests[g.id]!.readChapters).toEqual([]);
      totalUnlocked += regularGuestUnreadCount(s);
    }
    expect(totalUnlocked).toBe(60);
  });
});

describe('independent narrative durability and preference review', () => {
  it('reads and replayed/abandoned service tokens are idempotent across saved reloads', () => {
    let s = createInitialState(0); s.phase = 'open';
    const g = guest0();
    const paid = servedVisit(s, g.id);
    const failed = recordRegularGuestArrival(s, g.id)!;
    recordRegularGuestDeparture(s, g.id, failed);
    const before = JSON.stringify(s.regularGuests);
    for (const token of [paid.token, failed, 0, -1, Number.MAX_SAFE_INTEGER, 1.5]) recordRegularGuestService(s, g.id, token);
    expect(JSON.stringify(s.regularGuests)).toBe(before);
    s = deserialize(serialize(s), 5);
    for (const token of [paid.token, failed]) recordRegularGuestService(s, g.id, token);
    expect(s.regularGuests.guests[g.id]!.served).toBe(1);
    expect(markRegularGuestChapterRead(s, g.id, 4)).toBe(false);
    expect(markRegularGuestChapterRead(s, g.id, 0)).toBe(true);
    expect(markRegularGuestChapterRead(s, g.id, 0)).toBe(false);
    expect(regularGuestUnreadCount(s)).toBe(0);
    expect(deserialize(serialize(s), 99).regularGuests).toEqual(s.regularGuests);
  });


  it('does not lose late-start chapters or accept a retired receipt after hundreds of later services', () => {
    let s = createInitialState(0); s.phase = 'open'; s.day = 30;
    const id = guest0().id;
    const first = servedVisit(s, id).token;
    for (let n = 0; n < 205; n++) servedVisit(s, id);
    expect(s.regularGuests.guests[id]!.servedVisitIds.length).toBeLessThanOrEqual(160);
    for (let day = 31; day < 35; day++) {
      s.day = day;
      expect(servedVisit(s, id).chapter).toBe(day - 30);
      s = deserialize(serialize(s), day);
    }
    expect(s.regularGuests.guests[id]!.unlockedChapters).toEqual([0, 1, 2, 3, 4]);
    const before = JSON.stringify(s.regularGuests);
    recordRegularGuestService(s, id, first);
    expect(JSON.stringify(s.regularGuests)).toBe(before);
  });

  it('never counts one guest’s receipt for another or backfills old saves and malformed unlocks', () => {
    const s = createInitialState(0); s.phase = 'open'; s.day = 20;
    const [a, b] = REGULAR_GUESTS;
    const tokenA = recordRegularGuestArrival(s, a.id)!;
    recordRegularGuestArrival(s, b.id);
    expect(recordRegularGuestService(s, b.id, tokenA)).toBeNull();
    expect(s.regularGuests.guests[b.id]!.served).toBe(0);
    expect(parseRegularGuests(undefined, 99).guests).toEqual({});
    expect(parseRegularGuests({ nextVisitId: 2, guests: { [a.id]: {
      firstMetDay: a.debutDay, served: 0, unlockedChapters: [0, 1, 2, 3, 4], readChapters: [0, 4],
    } } }, 99).guests[a.id]!.unlockedChapters).toEqual([]);
    const old = JSON.parse(serialize(s)); old.version = 12; delete old.regularGuests;
    expect(deserialize(JSON.stringify(old), 99).regularGuests.guests).toEqual({});
  });

  it('uses only supplyable on-menu unlocked drinks, preserves bakery-only orders, and changes no economics', () => {
    for (const guest of REGULAR_GUESTS) {
      const s = createInitialState(0); s.phase = 'open'; s.day = guest.debutDay; s.kitchen = true;
      for (const ing of INGREDIENTS) s.pantry[ing.id] = 100;
      s.items[guest.preferredDrink] = 1;
      s.onMenu = ['espresso', 'roll', guest.preferredDrink];
      const before = serialize(s);
      expect(regularGuestOrder(s, guest.id, 'roll', null)).toEqual({ order: 'roll', extra: null });
      expect(regularGuestOrder(s, guest.id, 'roll', 'espresso')).toEqual({ order: 'roll', extra: guest.preferredDrink });
      expect(regularGuestOrder(s, guest.id, 'espresso', 'roll')).toEqual({ order: guest.preferredDrink, extra: 'roll' });
      expect(serialize(s)).toBe(before);
      s.onMenu = ['roll'];
      expect(regularGuestOrder(s, guest.id, 'espresso', null)).toEqual({ order: 'espresso', extra: null });
      s.onMenu.push(guest.preferredDrink); s.items[guest.preferredDrink] = 0;
      expect(regularGuestOrder(s, guest.id, 'espresso', null)).toEqual({ order: 'espresso', extra: null });
      s.items[guest.preferredDrink] = 1;
      for (const ing of INGREDIENTS) s.pantry[ing.id] = 0;
      expect(regularGuestOrder(s, guest.id, 'espresso', null)).toEqual({ order: 'espresso', extra: null });
    }
  });

  it('real sold-out Sim arrivals discover guests but cannot earn chapters', () => {
    const s = createInitialState(0); openShop(s); s.pantry.beans = 0;
    const sim = new Sim(seeded()); advance(s, sim, 8000);
    expect(Object.keys(s.regularGuests.guests).length).toBeGreaterThan(0);
    expect(s.today.served).toBe(0);
    for (const p of Object.values(s.regularGuests.guests)) {
      expect(p!.served).toBe(0); expect(p!.unlockedChapters).toEqual([]);
    }
  });

  it('resumes a real in-service guest and credits its successful handoff exactly once', () => {
    let s = createInitialState(0); s.pantry.beans = 1000; openShop(s);
    let sim = new Sim(seeded());
    for (let n = 0; n < 10000 && !sim.customers.some(c => c.regularGuestId && c.phase === 'ordering'); n++) sim.update(s, 0.1);
    const customer = sim.customers.find(c => c.regularGuestId && c.phase === 'ordering')!;
    expect(customer).toBeDefined();
    const id = customer.regularGuestId!, token = customer.regularGuestVisitId!;
    const servedBefore = s.regularGuests.guests[id]!.served;
    const raw = sim.snapshot(s);
    s = deserialize(serialize(s), 1);
    sim = new Sim(seeded(900)); expect(sim.restore(raw, s)).toBe(true);
    sim.beginClosing(s); advance(s, sim, 2500);
    expect(sim.finishedService).toBe(true);
    expect(s.regularGuests.guests[id]!.served).toBe(servedBefore + 1);
    const narrative = JSON.stringify(s.regularGuests);
    recordRegularGuestService(s, id, token); advance(s, sim, 100);
    expect(JSON.stringify(s.regularGuests)).toBe(narrative);
  });

  it('restores actual legacy live customers without inventing narrative history', () => {
    const s = createInitialState(0); s.pantry.beans = 1000; openShop(s);
    const sim = new Sim(seeded());
    for (let n = 0; n < 10000 && !sim.customers.some(c => c.regularGuestId && c.phase === 'ordering'); n++) sim.update(s, 0.1);
    expect(sim.customers.some(c => c.regularGuestId && c.phase === 'ordering')).toBe(true);
    const raw = sim.snapshot(s);
    for (const c of raw.customers) { delete c.regularGuestId; delete c.regularGuestVisitId; }
    const old = JSON.parse(serialize(s)); old.version = 12; delete old.regularGuests;
    const loaded = deserialize(JSON.stringify(old), 1);
    const resumed = new Sim(seeded(900)); expect(resumed.restore(raw, loaded)).toBe(true);
    resumed.beginClosing(loaded); advance(loaded, resumed, 2500);
    expect(resumed.finishedService).toBe(true);
    expect(loaded.regularGuests.guests).toEqual({});
  });
});

describe('independent journal dismissal and no-spoiler review', () => {
  it.each(['en', 'zh'] as const)('does not expose unknown identities or locked chapter text in %s', locale => {
    setLocale(locale); const s = createInitialState(0); s.phase = 'open';
    showRegularGuests(s, vi.fn());
    for (const g of REGULAR_GUESTS) expect(document.querySelector('.regular-journal')!.textContent).not.toContain(messagesFor(locale)[g.nameKey]);
    expect(document.querySelectorAll('.regular-portrait')).toHaveLength(0);
    closeModal();
    servedVisit(s, guest0().id); showRegularGuests(s, vi.fn());
    document.querySelector<HTMLButtonElement>('[data-regular-open]')!.click();
    expect(document.querySelectorAll('[data-regular-chapter]')).toHaveLength(1);
    for (const chapter of guest0().chapters.slice(1)) {
      expect(document.querySelector('.regular-journal')!.textContent).not.toContain(messagesFor(locale)[chapter.titleKey]);
      expect(document.querySelector('.regular-journal')!.textContent).not.toContain(messagesFor(locale)[chapter.textKey]);
    }
  });

  it('keeps one blocking modal across pages, preserves unread on Later/Escape, and rejects stale buttons', () => {
    const s = createInitialState(0); s.phase = 'open'; servedVisit(s, guest0().id);
    const save = vi.fn(); const opener = document.getElementById('open-journal')!; opener.focus();
    showRegularGuests(s, save);
    const modal = document.querySelector('[role="dialog"]');
    document.querySelector<HTMLButtonElement>('[data-regular-open]')!.click();
    document.querySelector<HTMLButtonElement>('[data-regular-chapter]')!.click();
    const staleFinish = document.querySelector<HTMLButtonElement>('[data-regular-finish]')!;
    document.querySelector<HTMLButtonElement>('[data-regular-later]')!.click();
    staleFinish.click();
    expect(regularGuestUnreadCount(s)).toBe(1); expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBe(modal);
    expect(isModalOpen()).toBe(true); expect(document.querySelector('main')!.inert).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-regular-chapter]')!.click();
    const finish = document.querySelector<HTMLButtonElement>('[data-regular-finish]')!;
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    finish.click();
    expect(isModalOpen()).toBe(false); expect(regularGuestUnreadCount(s)).toBe(1);
    expect(save).not.toHaveBeenCalled(); expect(document.activeElement).toBe(opener);
    showRegularGuests(s, save);
    document.querySelector<HTMLButtonElement>('[data-regular-open]')!.click();
    document.querySelector<HTMLButtonElement>('[data-regular-chapter]')!.click();
    const done = document.querySelector<HTMLButtonElement>('[data-regular-finish]')!;
    done.click(); done.click();
    expect(save).toHaveBeenCalledTimes(1); expect(regularGuestUnreadCount(s)).toBe(0);
  });
});
