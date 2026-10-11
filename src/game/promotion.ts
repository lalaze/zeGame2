import type { GameState } from './state';

/** Platform campaigns: short-video bursts versus longer lifestyle features. */
export const PROMOTION_PLANS = [
  { id: 'clipLocal', platform: 'flash', cost: 60, seconds: 180, boost: 0.5 },
  { id: 'clipStar', platform: 'flash', cost: 180, seconds: 180, boost: 1 },
  { id: 'noteLocal', platform: 'orange', cost: 50, seconds: 360, boost: 0.25 },
  { id: 'noteStar', platform: 'orange', cost: 150, seconds: 360, boost: 0.6 },
] as const;
export type PromotionId = typeof PROMOTION_PLANS[number]['id'];
export interface Promotion { id: PromotionId; remaining: number; paused: boolean }
export const promotionPlan = (id: string) => PROMOTION_PLANS.find((plan) => plan.id === id);

/** Also used in preparation forecasts; open time alone consumes the booking. */
export function promotionTraffic(state: GameState): number {
  const campaign = state.promotion;
  return campaign && !campaign.paused && campaign.remaining > 0 ? 1 + promotionPlan(campaign.id)!.boost : 1;
}

export function bookPromotion(state: GameState, id: string): boolean {
  const plan = promotionPlan(id);
  if (!plan || state.promotion || state.phase === 'closing' || state.coins < plan.cost || !state.onMenu.length) return false;
  state.coins -= plan.cost;
  state.promotion = { id: plan.id, remaining: plan.seconds, paused: false };
  return true;
}

export function togglePromotion(state: GameState): boolean {
  if (!state.promotion) return false;
  state.promotion.paused = !state.promotion.paused;
  return true;
}

/** Charge cash once on booking, then expense the prepaid airtime as delivered. */
export function updatePromotion(state: GameState, dt: number): void {
  const campaign = state.promotion;
  if (!campaign || campaign.paused || state.phase !== 'open' || !Number.isFinite(dt) || dt <= 0) return;
  const plan = promotionPlan(campaign.id)!;
  const used = Math.min(dt, campaign.remaining);
  state.today.promotionCost += used / plan.seconds * plan.cost;
  campaign.remaining = Math.max(0, campaign.remaining - used);
  if (campaign.remaining < 1e-8) state.promotion = null;
}

export function parsePromotion(value: unknown): Promotion | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const plan = typeof raw.id === 'string' ? promotionPlan(raw.id) : undefined;
  if (!plan || typeof raw.remaining !== 'number' || !Number.isFinite(raw.remaining) || raw.remaining <= 0) return null;
  return { id: plan.id, remaining: Math.min(plan.seconds, raw.remaining), paused: raw.paused !== false };
}
