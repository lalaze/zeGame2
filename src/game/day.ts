import type { ItemId } from './data';
import { bakeMorning, dayDemand, menuItems, readyServings, servingCost, soldOutItems } from './economy';
import { emptyDay, type DayStats, type GameState } from './state';

export interface DayReport extends DayStats {
  day: number;
  /** Revenue minus what the ingredients used cost. */
  profit: number;
  bestSeller: ItemId | null;
  /** Menu dishes the pantry can't make anymore, for tomorrow's shopping list. */
  outOfStock: ItemId[];
  /** Breads and pastries that sold out on the shelf before closing. */
  shelfSoldOut: ItemId[];
  /** Unsold breads and pastries that went stale at closing, and what they cost to bake. */
  stale: Partial<Record<ItemId, number>>;
  staleCost: number;
}

export type OpenCheck = { ok: true } | { ok: false; reason: 'emptyMenu' } | { ok: false; reason: 'lowStock'; items: ItemId[] };

/**
 * Whether the shop can open: something must be on the menu. Also warns about dishes
 * whose ingredients won't last half a day.
 */
export function checkOpen(state: GameState): OpenCheck {
  if (state.phase !== 'prep') return { ok: true };
  const items = menuItems(state);
  if (items.length === 0) return { ok: false, reason: 'emptyMenu' };
  const demand = dayDemand(state);
  const low = items.filter((m) => readyServings(state, m.id) < Math.max(1, (demand.get(m.id) ?? 0) * 0.5)).map((m) => m.id);
  return low.length > 0 ? { ok: false, reason: 'lowStock', items: low } : { ok: true };
}

/** Opens for the day: bakes the morning batch, then lets customers in. Returns how many items were baked. */
export function openShop(state: GameState): number {
  if (state.phase !== 'prep') return 0;
  state.dayTime = 0;
  state.today = emptyDay();
  state.phase = 'open';
  return bakeMorning(state);
}

/** Closes the books on today and moves to planning the next day. */
export function finishDay(state: GameState): DayReport {
  const today = state.today;
  let bestSeller: ItemId | null = null;
  for (const [id, n] of Object.entries(today.sales) as [ItemId, number][]) {
    if (!bestSeller || n > (today.sales[bestSeller] ?? 0)) bestSeller = id;
  }
  // Whatever is left on the shelf goes stale.
  const stale: Partial<Record<ItemId, number>> = {};
  let staleCost = 0;
  const shelfSoldOut: ItemId[] = [];
  for (const [id, baked] of Object.entries(today.baked) as [ItemId, number][]) {
    const left = state.shelf[id] ?? 0;
    if (left > 0) {
      stale[id] = left;
      staleCost += left * servingCost(id);
    } else if (baked > 0) shelfSoldOut.push(id);
  }
  const report: DayReport = {
    ...today,
    sales: { ...today.sales },
    baked: { ...today.baked },
    day: state.day,
    profit: today.revenue - today.ingredientCost,
    bestSeller,
    outOfStock: soldOutItems(state).map((m) => m.id),
    shelfSoldOut,
    stale,
    staleCost,
  };
  state.shelf = {};
  state.phase = 'prep';
  state.day++;
  state.dayTime = 0;
  state.today = emptyDay();
  return report;
}

/** How long the shop has been open today, as m:ss (or h:mm:ss), for the day HUD. */
export function formatOpenTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
