import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import { conditionOn, FIRST_CONDITION_DAY } from './conditions';
import { INGREDIENTS } from './data';
import { finishDay, openShop } from './day';
import { GOALS } from './goals';
import {
  CHAPTERS, cafeTitleChapter, chapterDone, checkMilestones, claimChapter, claimableChapter, milestoneDone, openChapters,
  parseMilestones, recordDay, recordMomentAnswered,
} from './milestones';
import { REGULAR_GUESTS } from './regular-guests-content';
import { emptyReviews } from './reputation';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize, type GameState } from './state';

/** A café that has finished the guided goals. */
function graduate(): GameState {
  const s = createInitialState(0);
  s.goal = GOALS.length;
  return s;
}
const day = (served: number, missed = 0, sales: Record<string, number> = {}, on = 1, cancelled = 0) =>
  ({ day: on, served, missed, sales, reviews: { ...emptyReviews(), reasons: cancelled ? { cancelled } : {} } });
const dayOf = (id: string) => { for (let d = FIRST_CONDITION_DAY; d < 400; d++) if (conditionOn({ createdAt: 0 }, d) === id) return d; throw new Error(id); };
/** Every milestone of the first `n` chapters, done. */
function finishChapters(s: GameState, n: number) {
  for (const chapter of CHAPTERS.slice(0, n)) for (const m of chapter.milestones) if (!s.milestones.done.includes(m.id)) s.milestones.done.push(m.id);
}

describe('café milestones', () => {
  it('wait for the guided goals, then open each chapter once three of the one before are done', () => {
    const s = createInitialState(0);
    s.served = 5000;
    expect(checkMilestones(s)).toEqual([]);
    s.goal = GOALS.length;
    expect(openChapters(s)).toBe(1);
    // Only open chapters count: 5,000 guests is enough for chapter 3 as well, later.
    expect(checkMilestones(s)).toEqual(['served1000']);
    expect(milestoneDone(s, 'served3000')).toBe(false);
    s.regions = ['reading', 'greenhouse'];
    for (const id of ['espresso', 'americano', 'latte', 'cappuccino', 'flatwhite', 'cortado', 'mocha', 'vienna', 'macchiato', 'coldbrew', 'dirty', 'pourover'] as const) {
      s.items[id] = 1; s.taste.served[id] = 30;
    }
    // Three of four: chapter 2 opens without waiting for the smooth day.
    expect(checkMilestones(s).sort()).toEqual(['glasshouse', 'practiced12']);
    expect(chapterDone(s, 0)).toBe(false);
    expect(openChapters(s)).toBe(2);
    recordDay(s, day(160));
    expect(checkMilestones(s).sort()).toEqual(['busyDay150', 'smoothDay60']);
    expect(chapterDone(s, 0)).toBe(true);
  });

  it('let records collected earlier count as soon as their chapter opens', () => {
    const s = graduate();
    recordDay(s, day(160));
    finishChapters(s, 1);
    expect(checkMilestones(s)).toEqual(['busyDay150']);
  });

  it('keep the best day, the best smooth day and the special days won', () => {
    const s = graduate();
    recordDay(s, day(120, 3));
    expect(s.milestones.records).toMatchObject({ bestDay: 120, bestSmoothDay: 0 });
    // Guests turned away by a full queue never came in; only disappointed ones spoil a day.
    recordDay(s, day(80));
    expect(s.milestones.records).toMatchObject({ bestDay: 120, bestSmoothDay: 80 });
    // Settling early cancels orders still being made: those guests are disappointed too.
    recordDay(s, day(95, 0, {}, 1, 2));
    expect(s.milestones.records).toMatchObject({ bestDay: 120, bestSmoothDay: 80 });
    // Rain makes tea and chocolate popular, but 45 of 99 sales isn't half.
    recordDay(s, day(90, 0, { blacktea: 30, hotchoc: 15, espresso: 40, coldbrew: 14 }, dayOf('rain')));
    expect(s.milestones.records.weatherWins).toEqual([]);
    recordDay(s, day(60, 0, { blacktea: 30, hotchoc: 12, espresso: 18 }, dayOf('rain')));
    expect(s.milestones.records.weatherWins).toEqual(['rain']);
    // A fair day makes nothing popular, and a kind already won counts once.
    recordDay(s, day(90, 0, { blacktea: 99 }, dayOf('fair')));
    recordDay(s, day(60, 0, { blacktea: 60 }, dayOf('rain')));
    expect(s.milestones.records.weatherWins).toEqual(['rain']);
    recordMomentAnswered(s); recordMomentAnswered(s);
    expect(s.milestones.records.momentsAnswered).toBe(2);
  });

  it('never take a milestone back', () => {
    const s = graduate();
    finishChapters(s, 1);
    s.reputation.recent = Array.from({ length: 50 }, () => ({ stars: 5, reason: 'prompt' as const, day: 1 }));
    expect(checkMilestones(s)).toContain('rating40');
    s.reputation.recent = Array.from({ length: 50 }, () => ({ stars: 1, reason: 'soldOut' as const, day: 2 }));
    checkMilestones(s);
    expect(milestoneDone(s, 'rating40')).toBe(true);
    // A rating needs a full window of reviews.
    const fresh = graduate();
    finishChapters(fresh, 1);
    fresh.reputation.recent = Array.from({ length: 10 }, () => ({ stars: 5, reason: 'prompt' as const, day: 1 }));
    expect(checkMilestones(fresh)).not.toContain('rating40');
  });

  it('counts a regular story once all its chapters are earned', () => {
    const s = graduate();
    finishChapters(s, 1);
    for (const guest of REGULAR_GUESTS) {
      s.regularGuests.guests[guest.id] = { firstMetDay: 1, served: 5, unlockedChapters: [0, 1, 2, 3, 4], readChapters: [], lastUnlockDay: 9, servedVisitIds: [], pendingVisitIds: [], pendingDay: 9 };
    }
    s.regularGuests.guests[REGULAR_GUESTS[0].id]!.unlockedChapters = [0, 1, 2, 3];
    expect(checkMilestones(s)).not.toContain('stories12');
    s.regularGuests.guests[REGULAR_GUESTS[0].id]!.unlockedChapters = [0, 1, 2, 3, 4];
    expect(checkMilestones(s)).toContain('stories12');
  });

  it('lets a finished chapter be claimed even while an earlier one waits', () => {
    const s = graduate();
    s.milestones.done.push('glasshouse', 'served1000', 'practiced12');
    for (const m of CHAPTERS[1].milestones) s.milestones.done.push(m.id);
    expect(claimableChapter(s)).toBe(1);
    expect(claimChapter(s)?.chapter.id).toBe('favourite');
    expect(cafeTitleChapter(s)?.id).toBe('favourite');
    s.milestones.done.push('smoothDay60');
    expect(claimChapter(s)?.chapter.id).toBe('neighbourhood');
    // The title stays the furthest chapter claimed.
    expect(cafeTitleChapter(s)?.id).toBe('favourite');
  });

  it('gives each finished chapter a title and a finish, or its price when already owned', () => {
    const s = graduate();
    expect(claimChapter(s)).toBeNull();
    finishChapters(s, 2);
    expect(claimableChapter(s)).toBe(0);
    expect(claimChapter(s)).toEqual({ chapter: CHAPTERS[0], finish: 'ceiling_vines', coins: 0 });
    expect(s.decor.owned).toContain('ceiling_vines');
    expect(s.decor.equipped.ceiling).toBe('ceiling_vines');
    expect(cafeTitleChapter(s)?.id).toBe('neighbourhood');
    // Already owned: its price instead, and the better rug stays down.
    s.decor.owned.push('rug_blue', 'rug_round');
    s.decor.equipped.rug = 'rug_round';
    const coins = s.coins;
    expect(claimChapter(s)).toMatchObject({ finish: 'rug_blue', coins: 20000 });
    expect(s.coins).toBe(coins + 20000);
    expect(s.decor.equipped.rug).toBe('rug_round');
    expect(cafeTitleChapter(s)?.id).toBe('favourite');
    expect(claimChapter(s)).toBeNull();
  });

  it('saves and loads progress, dropping unknown or unearned claims', () => {
    const s = graduate();
    finishChapters(s, 1);
    recordDay(s, day(77));
    claimChapter(s);
    const loaded = deserialize(serialize(s), 0);
    expect(loaded.milestones).toEqual(s.milestones);
    expect(parseMilestones({ done: ['served1000', 'nope', 'served1000'], reachedOn: { served1000: 12, glasshouse: 3, nope: 4 }, claimed: ['neighbourhood', 'x'], records: { bestDay: -4, bestSmoothDay: 'x', momentsAnswered: 2.7, weatherWins: ['rain', 'fair', 'snow', 'rain'] } }))
      .toEqual({ done: ['served1000'], reachedOn: { served1000: 12 }, claimed: [], records: { bestDay: 0, bestSmoothDay: 0, weatherWins: ['rain'], momentsAnswered: 2 } });
    // Older saves start with nothing invented.
    const old = JSON.parse(serialize(createInitialState(0)));
    delete old.milestones; old.version = 17;
    expect(deserialize(JSON.stringify(old), 0).milestones).toEqual(parseMilestones(null));
  });

  it('reports a milestone reached during service as well as those reached at closing', () => {
    const s = graduate();
    for (const ing of INGREDIENTS) s.pantry[ing.id] = 1000;
    openShop(s);
    // The live check marks it mid-day; the day's report must still name it.
    s.served = 1000;
    expect(checkMilestones(s)).toEqual(['served1000']);
    s.regions = ['reading', 'greenhouse'];
    const report = finishDay(s);
    expect(report.newMilestones).toEqual(['glasshouse', 'served1000']);
    // Tomorrow's report starts empty.
    openShop(s);
    expect(finishDay(s).newMilestones).toEqual([]);
  });

  it('never counts a day settled early, with orders cancelled, as smooth', () => {
    const s = graduate();
    for (const ing of INGREDIENTS) s.pantry[ing.id] = 1000;
    openShop(s);
    const sim = new Sim(() => 0.5);
    let report = null;
    // Settle now as soon as someone is mid-order.
    for (let n = 0; n < 6000 && !report; n++) {
      sim.update(s, 0.05);
      if (s.today.served > 0 && sim.customers.some((c) => c.phase === 'ordering' || c.phase === 'waiting')) report = sim.closeShop(s);
    }
    expect(report!.reviews.reasons.cancelled).toBeGreaterThan(0);
    expect(report!.missed).toBe(0);
    expect(s.milestones.records.bestSmoothDay).toBe(0);
  });

  it('records a real day at closing and reports what it reached', () => {
    const s = graduate();
    s.served = 999;
    for (const ing of INGREDIENTS) s.pantry[ing.id] = 1000;
    openShop(s);
    const sim = new Sim(() => 0.5);
    for (let n = 0; n < 600; n++) sim.update(s, 0.05);
    const served = s.today.served, report = finishDay(s);
    expect(served).toBeGreaterThan(0);
    expect(s.milestones.records.bestDay).toBe(served);
    expect(report.newMilestones).toContain('served1000');
  });

  it('names every chapter and milestone in both languages', () => {
    for (const chapter of CHAPTERS) {
      for (const key of [`milestone.chapter.${chapter.id}`, ...chapter.milestones.map((m) => `milestone.${m.id}`)]) {
        expect(en, key).toHaveProperty([key]);
        expect(zh, key).toHaveProperty([key]);
      }
    }
  });
});
