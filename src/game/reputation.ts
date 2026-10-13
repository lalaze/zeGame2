import { MENU, type ItemId } from './data';
import { signatureDefinition } from './signature-drinks';
import { mealTaste } from './taste';
import type { GameState } from './state';

export const REVIEW_WINDOW = 50;
export const NEW_CAFE_SAMPLE = 20;
export const NEUTRAL_RATING = 4;
export const REVIEW_REASONS = ['prompt', 'steady', 'slow', 'verySlow', 'incomplete', 'soldOut', 'queueWait', 'tableWait', 'cancelled', 'standardTaste', 'skilledTaste', 'signatureTaste'] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];
/** Reviews use tenths so combos retain their average flavor score. */
export interface Review {
  stars: number;
  reason: ReviewReason;
  day: number;
  taste?: number;
  items?: ItemId[];
}
export type ReviewInput = Omit<Review, 'day'>;
export interface Reputation { recent: Review[]; }
export interface ReviewSummary {
  /** Counts for one through five stars, including reviews older than the rolling window. */
  stars: [number, number, number, number, number];
  reasons: Partial<Record<ReviewReason, number>>;
  /** Exact score sum; the histogram groups fractional scores by nearest star. */
  totalScore: number;
}

export const emptyReviews = (): ReviewSummary => ({ stars: [0, 0, 0, 0, 0], reasons: {}, totalScore: 0 });
export const reviewCount = (summary: ReviewSummary) => summary.stars.reduce((sum, n) => sum + n, 0);
export const reviewAverage = (summary: ReviewSummary): number | null => {
  const count = reviewCount(summary);
  return count ? summary.totalScore / count : null;
};

/** Pad only the first 20 reviews with neutral four-star experiences, then use the
 * latest 50 real visits. Good service can always replace an old bad streak. */
export function reputationScore(reputation: Reputation): number {
  const recent = reputation.recent;
  const neutral = Math.max(0, NEW_CAFE_SAMPLE - recent.length);
  return (recent.reduce((sum, r) => sum + r.stars, 0) + neutral * NEUTRAL_RATING) / Math.max(NEW_CAFE_SAMPLE, recent.length);
}

/** Reputation affects arrivals only. Four stars is neutral; even the lowest
 * score retains 75% of the shop's otherwise expected foot traffic. */
export function reputationTraffic(reputation: Reputation): number {
  const score = reputationScore(reputation);
  return score >= NEUTRAL_RATING ? 1 + (score - NEUTRAL_RATING) * 0.25 : 1 - (NEUTRAL_RATING - score) / 12;
}

/** The wait covers arrival to handoff, including the queue and table delivery. */
export function serviceReview(waitSeconds: number, missingExtra: boolean): Pick<Review, 'stars' | 'reason'> {
  if (waitSeconds > 40) return { stars: 2, reason: 'verySlow' };
  if (missingExtra) return { stars: 3, reason: 'incomplete' };
  if (waitSeconds > 25) return { stars: 3, reason: 'slow' };
  if (waitSeconds > 12) return { stars: 4, reason: 'steady' };
  return { stars: 5, reason: 'prompt' };
}

/** Flavor sets the base; the service experience caps it. Read before advancing
 * proficiency so the threshold improves the next portion, not one already eaten. */
export function mealReview(state: GameState, items: ItemId[], waitSeconds: number, missingExtra: boolean): ReviewInput {
  const service = serviceReview(waitSeconds, missingExtra);
  const taste = mealTaste(state, items);
  const reason = service.stars < taste ? service.reason
    : taste >= 5 ? 'signatureTaste' : taste > 4 ? 'skilledTaste' : 'standardTaste';
  return { stars: Math.round(Math.min(taste, service.stars) * 10) / 10, reason, taste: Math.round(taste * 10) / 10, items: [...items] };
}

/** Called once when a visit has a final outcome, never when a dish is merely made. */
export function recordReview(state: GameState, review: ReviewInput): void {
  state.reputation.recent.push({ ...review, day: state.day });
  if (state.reputation.recent.length > REVIEW_WINDOW) state.reputation.recent.shift();
  state.today.reviews.stars[Math.round(review.stars) - 1]++;
  state.today.reviews.totalScore = Math.round((state.today.reviews.totalScore + review.stars) * 10) / 10;
  state.today.reviews.reasons[review.reason] = (state.today.reviews.reasons[review.reason] ?? 0) + 1;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? Math.min(v, 1_000_000_000) : 0;
const reason = (v: unknown): v is ReviewReason => REVIEW_REASONS.some((r) => r === v);

export function parseReputation(value: unknown): Reputation {
  if (!object(value) || !Array.isArray(value.recent)) return { recent: [] };
  const recent: Review[] = [];
  for (const raw of value.recent.slice(-REVIEW_WINDOW)) {
    if (!object(raw) || !reason(raw.reason) || typeof raw.stars !== 'number' || !Number.isFinite(raw.stars) || raw.stars < 1 || raw.stars > 5) continue;
    const review: Review = { stars: Math.round(raw.stars * 10) / 10, reason: raw.reason, day: Math.max(1, count(raw.day)) };
    if (Array.isArray(raw.items)) review.items = raw.items.slice(0, 2).filter((id): id is ItemId => MENU.some((m) => m.id === id) || typeof id === 'string' && signatureDefinition(id) !== null);
    // Custom recipes may start below four stars. Require valid canonical item
    // evidence, and retain the rounded combo floor rather than weakening stock reviews.
    const minimumTaste = review.items?.length
      ? Math.round(review.items.reduce((sum, id) => sum + (signatureDefinition(id)?.quality ?? 4), 0) / review.items.length * 10) / 10
      : 4;
    if (typeof raw.taste === 'number' && Number.isFinite(raw.taste) && raw.taste >= minimumTaste && raw.taste <= 5) review.taste = Math.round(raw.taste * 10) / 10;
    recent.push(review);
  }
  return { recent };
}

export function parseReviews(value: unknown): ReviewSummary {
  const summary = emptyReviews();
  if (!object(value)) return summary;
  if (Array.isArray(value.stars)) summary.stars = summary.stars.map((_, i) => count((value.stars as unknown[])[i])) as ReviewSummary['stars'];
  const total = reviewCount(summary);
  const legacyTotal = summary.stars.reduce((sum, n, i) => sum + n * (i + 1), 0);
  summary.totalScore = typeof value.totalScore === 'number' && Number.isFinite(value.totalScore) && value.totalScore >= total && value.totalScore <= total * 5
    ? Math.round(value.totalScore * 10) / 10 : legacyTotal;
  if (object(value.reasons)) {
    let remaining = reviewCount(summary);
    for (const key of REVIEW_REASONS) {
      const n = Math.min(remaining, count(value.reasons[key]));
      if (n) summary.reasons[key] = n;
      remaining -= n;
    }
  }
  return summary;
}
