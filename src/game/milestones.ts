// Café milestones: a second goal track for after the 15 guided goals. Four chapters of
// four milestones carry a café from about day 11 to day 45, rewarding running it well
// (smooth, busy, well-reviewed days, menus chosen for the weather) as well as growing it.
// Milestones complete by themselves and never un-complete. A chapter opens once three of
// the previous chapter's four are done, so one hard milestone never stalls the track; each
// finished chapter gives a café title and a free finish. Plan and evidence: docs/milestones/PLAN.md.
import { CONDITIONS, conditionOn, dishMood, type ConditionId } from './conditions';
import { MENU, type ItemId } from './data';
import type { DayReport } from './day';
import { comfort, decorDef } from './decor';
import { earn } from './economy';
import { GOALS } from './goals';
import { REGULAR_GUESTS } from './regular-guests-content';
import { reputationScore } from './reputation';
import type { GameState } from './state';
import { tasteTier } from './taste';

export interface MilestoneRecords {
  /** Most guests served in one day. */
  bestDay: number;
  /**
   * Most guests served in one day with nobody who came in leaving disappointed: no sold-out
   * orders, queue or table walkouts, and no orders cancelled by settling early. Guests
   * turned away by a full queue never came in.
   */
  bestSmoothDay: number;
  /** Kinds of special day (rain, heat, a crisp morning, market) the menu won over. */
  weatherWins: ConditionId[];
  /** Little moments the player answered. */
  momentsAnswered: number;
}
export interface MilestoneState {
  /** Milestones reached; they never un-complete. */
  done: string[];
  /** The day each milestone was reached, so that day's report can name it wherever it happened. */
  reachedOn: Record<string, number>;
  /** Chapters whose reward has been claimed. */
  claimed: ChapterDef['id'][];
  records: MilestoneRecords;
}

export interface MilestoneDef {
  id: string;
  /** [current, target]; reached when current >= target. */
  progress: (s: GameState) => [number, number];
  /** Shown with one decimal, like a rating. */
  decimal?: boolean;
  /** Extra condition before it can complete, e.g. enough reviews to count as a rating. */
  ready?: (s: GameState) => boolean;
}
export interface ChapterDef {
  id: 'neighbourhood' | 'favourite' | 'town' | 'institution';
  milestones: readonly MilestoneDef[];
  /** The free finish this chapter gives (an existing decor id). */
  finish: string;
}

const RATING_REVIEWS = 50;
/** A chapter opens once this many of the previous chapter's milestones are done. */
export const OPEN_AFTER = 3;
/** A special day is won when its popular dishes sell at least this many, and make up this share of sales. */
export const WEATHER_WIN = { popular: 40, share: 0.5 } as const;
const room = (s: GameState, id: 'greenhouse' | 'terrace'): [number, number] => [Number(s.regions.includes(id)), 1];
const rating = (s: GameState, target: number): [number, number] => [reputationScore(s.reputation), target];
/** A rating over too few reviews isn't a reputation yet. */
export const enoughReviews = (s: GameState) => s.reputation.recent.length >= RATING_REVIEWS;
const practiced = (s: GameState) => MENU.filter((m) => s.items[m.id] > 0 && tasteTier(s, m.id) !== 'standard').length;
const storiesComplete = (s: GameState) => REGULAR_GUESTS.filter((guest) =>
  (s.regularGuests.guests[guest.id]?.unlockedChapters.length ?? 0) >= guest.chapters.length).length;
const records = (s: GameState) => s.milestones.records;

export const CHAPTERS: readonly ChapterDef[] = [
  { id: 'neighbourhood', finish: 'ceiling_vines', milestones: [
    { id: 'glasshouse', progress: (s) => room(s, 'greenhouse') },
    { id: 'served1000', progress: (s) => [s.served, 1000] },
    { id: 'practiced12', progress: (s) => [practiced(s), 12] },
    { id: 'smoothDay60', progress: (s) => [records(s).bestSmoothDay, 60] },
  ] },
  { id: 'favourite', finish: 'rug_blue', milestones: [
    { id: 'busyDay150', progress: (s) => [records(s).bestDay, 150] },
    { id: 'rating40', progress: (s) => rating(s, 4), decimal: true, ready: enoughReviews },
    { id: 'weatherWin', progress: (s) => [Math.min(1, records(s).weatherWins.length), 1] },
    { id: 'stories12', progress: (s) => [storiesComplete(s), REGULAR_GUESTS.length] },
  ] },
  { id: 'town', finish: 'counter_marble', milestones: [
    { id: 'terrace', progress: (s) => room(s, 'terrace') },
    { id: 'signature5', progress: (s) => [s.taste.signature.length, 5] },
    { id: 'moments60', progress: (s) => [records(s).momentsAnswered, 60] },
    { id: 'served3000', progress: (s) => [s.served, 3000] },
  ] },
  { id: 'institution', finish: 'floor_herringbone', milestones: [
    { id: 'busyDay180', progress: (s) => [records(s).bestDay, 180] },
    { id: 'smoothDay150', progress: (s) => [records(s).bestSmoothDay, 150] },
    { id: 'weatherKinds3', progress: (s) => [records(s).weatherWins.length, 3] },
    { id: 'comfort90', progress: (s) => [comfort(s), 90] },
  ] },
];
const ALL = CHAPTERS.flatMap((c) => c.milestones);
export const milestoneDef = (id: string) => ALL.find((m) => m.id === id);
export const chapterOf = (id: string) => CHAPTERS.find((c) => c.milestones.some((m) => m.id === id));

export const emptyMilestones = (): MilestoneState => ({
  done: [], reachedOn: {}, claimed: [], records: { bestDay: 0, bestSmoothDay: 0, weatherWins: [], momentsAnswered: 0 },
});

/** The track follows the guided goals. */
export const milestonesStarted = (s: GameState) => s.goal >= GOALS.length;
export const milestoneDone = (s: GameState, id: string) => s.milestones.done.includes(id);
const doneIn = (done: readonly string[], index: number) => CHAPTERS[index]?.milestones.filter((m) => done.includes(m.id)).length ?? 0;
export const chapterDone = (s: GameState, index: number) =>
  !!CHAPTERS[index] && doneIn(s.milestones.done, index) === CHAPTERS[index].milestones.length;
/** The first chapter is open from the start; each later one once three of the one before are done. */
export const chapterOpen = (s: GameState, index: number) =>
  milestonesStarted(s) && index >= 0 && index < CHAPTERS.length && (index === 0 || doneIn(s.milestones.done, index - 1) >= OPEN_AFTER);
/** How many chapters are open, from the first. */
export function openChapters(s: GameState): number {
  let n = 0;
  while (chapterOpen(s, n)) n++;
  return n;
}
export const chapterClaimed = (s: GameState, index: number) => s.milestones.claimed.includes(CHAPTERS[index].id);
/** The first finished chapter whose reward is waiting, if any. */
export function claimableChapter(s: GameState): number | null {
  if (!milestonesStarted(s)) return null;
  const index = CHAPTERS.findIndex((_, i) => chapterDone(s, i) && !chapterClaimed(s, i));
  return index < 0 ? null : index;
}
/** The café's title: the furthest chapter claimed. */
export function cafeTitleChapter(s: GameState): ChapterDef | null {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (chapterClaimed(s, i)) return CHAPTERS[i];
  return null;
}

/**
 * Marks every milestone in the open chapters that has been reached, and returns the
 * new ones. Records collected before a chapter opened count as soon as it does.
 */
export function checkMilestones(s: GameState): string[] {
  if (!milestonesStarted(s)) return [];
  const reached: string[] = [];
  for (let opened = 0; opened !== openChapters(s);) {
    opened = openChapters(s);
    for (const chapter of CHAPTERS.slice(0, opened)) for (const m of chapter.milestones) {
      const [current, target] = m.progress(s);
      if (!milestoneDone(s, m.id) && current >= target && (m.ready?.(s) ?? true)) {
        s.milestones.done.push(m.id);
        s.milestones.reachedOn[m.id] = s.day;
        reached.push(m.id);
      }
    }
  }
  return reached;
}

/** Milestones reached on a given day, in chapter order: during service, while preparing or at closing. */
export const milestonesReachedOn = (s: GameState, day: number): string[] =>
  ALL.filter((m) => milestoneDone(s, m.id) && s.milestones.reachedOn[m.id] === day).map((m) => m.id);

/** The day's best-ever results, from the report of the day that just closed. */
export function recordDay(s: GameState, report: Pick<DayReport, 'day' | 'served' | 'missed' | 'sales' | 'reviews'>): void {
  const r = s.milestones.records;
  r.bestDay = Math.max(r.bestDay, report.served);
  // Settling early cancels orders still being made; those guests leave without them too.
  if (report.missed === 0 && !(report.reviews.reasons.cancelled ?? 0)) r.bestSmoothDay = Math.max(r.bestSmoothDay, report.served);
  // A special day is won by a menu that suits it: its popular dishes are much of what sold.
  const day = { createdAt: s.createdAt, day: report.day }, condition = conditionOn(s, report.day);
  if (condition === 'fair' || r.weatherWins.includes(condition)) return;
  const sales = Object.entries(report.sales) as [ItemId, number][];
  const total = sales.reduce((sum, [, n]) => sum + n, 0);
  const popular = sales.reduce((sum, [id, n]) => sum + (dishMood(day, id) === 'favored' ? n : 0), 0);
  if (popular >= WEATHER_WIN.popular && popular >= total * WEATHER_WIN.share) r.weatherWins.push(condition);
}

export function recordMomentAnswered(s: GameState): void {
  s.milestones.records.momentsAnswered++;
}

export type ChapterReward = { chapter: ChapterDef; finish: string; coins: number };
/**
 * Claims the next finished chapter: its title, and its finish (equipped when it's more
 * comfortable than what's there), or the finish's price if it's already owned.
 */
export function claimChapter(s: GameState): ChapterReward | null {
  const index = claimableChapter(s);
  if (index === null) return null;
  const chapter = CHAPTERS[index], finish = decorDef(chapter.finish)!;
  let coins = 0;
  if (s.decor.owned.includes(finish.id)) {
    coins = finish.cost;
    earn(s, coins);
  } else {
    s.decor.owned.push(finish.id);
    if (finish.comfort > (decorDef(s.decor.equipped[finish.slot])?.comfort ?? 0)) s.decor.equipped[finish.slot] = finish.id;
  }
  s.milestones.claimed.push(chapter.id);
  return { chapter, finish: finish.id, coins };
}

const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(1e9, Math.floor(value)) : 0;

/** Reads saved milestones. Unknown ids are dropped; old saves start with nothing invented. */
export function parseMilestones(value: unknown): MilestoneState {
  const out = emptyMilestones();
  if (!value || typeof value !== 'object') return out;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.done)) out.done = [...new Set(v.done.filter((id): id is string => typeof id === 'string' && !!milestoneDef(id)))];
  const reachedOn = (v.reachedOn ?? {}) as Record<string, unknown>;
  for (const id of out.done) {
    const day = reachedOn[id];
    if (typeof day === 'number' && Number.isSafeInteger(day) && day >= 1) out.reachedOn[id] = day;
  }
  const r = (v.records ?? {}) as Record<string, unknown>;
  const kinds = CONDITIONS.map((c) => c.id).filter((id) => id !== 'fair');
  out.records = {
    bestDay: count(r.bestDay), bestSmoothDay: count(r.bestSmoothDay), momentsAnswered: count(r.momentsAnswered),
    weatherWins: Array.isArray(r.weatherWins) ? kinds.filter((id) => (r.weatherWins as unknown[]).includes(id)) : [],
  };
  // A claim needs its chapter finished.
  out.claimed = Array.isArray(v.claimed)
    ? CHAPTERS.filter((c, i) => (v.claimed as unknown[]).includes(c.id) && doneIn(out.done, i) === c.milestones.length).map((c) => c.id)
    : [];
  return out;
}
