import { PERK_CATERING_SHARE, hasPerk } from './chain-bonuses';
import type { ItemId } from './data';
import { MENU } from './data';
import { dayDemand, earn, salePrice, servingCost } from './economy';
import { awayHourly } from './manager';
import type { GameState } from './state';

/**
 * Catering orders: the shop manager takes one at a time, buys its ingredients up front
 * and delivers it after a fixed stretch of real time, on screen or away. Choosing one
 * is the decision a player makes on the way out: short orders pay the most per hour,
 * so frequent visits are rewarded, and the long one covers a night.
 */
export type OrderKind = 'office' | 'tea' | 'banquet';

export interface OrderDef {
  id: OrderKind;
  hours: number;
  /** Profit per hour of the order, as a share of an hour's away pay. */
  rate: number;
}

export const ORDERS: readonly OrderDef[] = [
  { id: 'office', hours: 0.5, rate: 0.6 },
  { id: 'tea', hours: 2, rate: 0.4 },
  { id: 'banquet', hours: 8, rate: 0.25 },
];

export const orderDef = (id: OrderKind) => ORDERS.find((o) => o.id === id)!;
export const isOrderKind = (id: unknown): id is OrderKind => ORDERS.some((o) => o.id === id);

/** The terms are fixed when the order is taken, so later upgrades never change a promise. */
export interface OrderTerms {
  kind: OrderKind;
  item: ItemId;
  servings: number;
  /** Ingredients, paid when the order is taken. */
  cost: number;
  /** Paid on delivery. */
  payout: number;
}

export interface ActiveOrder extends OrderTerms {
  /** When it's ready to deliver (ms since epoch). */
  finishAt: number;
}

export interface OrdersState {
  active: ActiveOrder | null;
  delivered: number;
}

export const emptyOrders = (): OrdersState => ({ active: null, delivered: 0 });

const isItem = (id: unknown): id is ItemId => typeof id === 'string' && (id.startsWith('sig:') || MENU.some((m) => m.id === id));
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

export function parseOrders(value: unknown, now: number): OrdersState {
  const base = emptyOrders();
  if (!value || typeof value !== 'object') return base;
  const o = value as Record<string, unknown>;
  base.delivered = Math.floor(amount(o.delivered) ?? 0);
  const a = o.active as Record<string, unknown> | null | undefined;
  if (a && isOrderKind(a.kind) && isItem(a.item)) {
    const servings = amount(a.servings), cost = amount(a.cost), payout = amount(a.payout);
    if (servings !== null && cost !== null && payout !== null && typeof a.finishAt === 'number' && Number.isFinite(a.finishAt)) {
      // A clock set back can't stretch an order beyond its own length.
      const finishAt = Math.min(a.finishAt, now + orderDef(a.kind).hours * 3_600_000);
      base.active = { kind: a.kind, item: a.item, servings: Math.floor(servings), cost, payout, finishAt };
    }
  }
  return base;
}

/** The dish today's guests order most, as long as it earns something over its ingredients. */
function orderDish(state: GameState): ItemId | null {
  let best: ItemId | null = null, most = 0;
  for (const [id, servings] of dayDemand(state)) {
    if (servings > most && salePrice(state, id) > servingCost(id)) (best = id), (most = servings);
  }
  return best;
}

/** What taking an order of this kind would mean now, or null without a manager or a menu that sells. */
export function quoteOrder(state: GameState, kind: OrderKind): OrderTerms | null {
  if (!state.manager.hired) return null;
  const item = orderDish(state);
  if (!item) return null;
  const def = orderDef(kind);
  const price = salePrice(state, item), unitCost = servingCost(item);
  const profit = awayHourly(state) * def.hours * def.rate * (hasPerk(state, 'catering') ? PERK_CATERING_SHARE : 1);
  const servings = Math.max(1, Math.round(profit / (price - unitCost)));
  return { kind, item, servings, cost: Math.ceil(servings * unitCost), payout: Math.round(servings * price) };
}

export type OrderBlock = 'busy' | 'noManager' | 'noMenu' | 'coins' | null;
export function orderBlock(state: GameState, kind: OrderKind): OrderBlock {
  if (state.orders.active) return 'busy';
  if (!state.manager.hired) return 'noManager';
  const q = quoteOrder(state, kind);
  if (!q) return 'noMenu';
  if (state.coins < q.cost) return 'coins';
  return null;
}

/** Takes an order: pays its ingredients now and delivers it once its time has passed. */
export function startOrder(state: GameState, kind: OrderKind, now: number): ActiveOrder | null {
  if (orderBlock(state, kind)) return null;
  const q = quoteOrder(state, kind)!;
  state.coins -= q.cost;
  state.orders.active = { ...q, finishAt: now + orderDef(kind).hours * 3_600_000 };
  return state.orders.active;
}

export const orderReady = (state: GameState, now: number) => !!state.orders.active && now >= state.orders.active.finishAt;

/** Real seconds until the order is ready; 0 once it is. */
export const orderLeft = (state: GameState, now: number) =>
  state.orders.active ? Math.max(0, (state.orders.active.finishAt - now) / 1000) : 0;

/** Delivers a finished order and pays for it. */
export function collectOrder(state: GameState, now: number): ActiveOrder | null {
  const order = state.orders.active;
  if (!order || now < order.finishAt) return null;
  earn(state, order.payout);
  state.orders.active = null;
  state.orders.delivered++;
  return order;
}
