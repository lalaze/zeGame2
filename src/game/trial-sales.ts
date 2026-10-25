import { isDrink, MENU, type ItemId } from './data';
import { guestTaste, itemFlavors } from './flavors';
import { signatureDefinition } from './signature-drinks';
import { tasteScore } from './taste';
import { isMinaWishDrink, minaWish } from './regular-wishes';
import type { GameState, Look } from './state';

export const TRIAL_SALE_LIMIT = 5;
export type TrialFeedback = 'love' | 'fine' | 'meh';
export interface TrialSaleStats {
  item: ItemId;
  /** Remember a custom drink's label even if its saved recipe is later removed. */
  name?: string;
  day: number;
  prepared: number;
  served: number;
  ingredientCost: number;
  revenue: number;
  feedback: Record<TrialFeedback, number>;
  practiceBefore: number;
  qualityBefore: number;
}
export interface TrialSaleRun extends TrialSaleStats {
  /** Unprepared orders currently holding a place in the five-cup budget. */
  reserved: number;
  visits: number;
}
export interface TrialSaleReport extends TrialSaleStats { qualityAfter: number }
export interface TrialSalesState {
  selected: ItemId | null;
  active: TrialSaleRun | null;
  last: TrialSaleReport | null;
}
export const emptyTrialSales = (): TrialSalesState => ({ selected: null, active: null, last: null });
const definition = (id: string) => MENU.find(item => item.id === id) ?? signatureDefinition(id);

/** A trial is an owned, usable drink outside the regular menu. */
export function canTrialDrink(s: GameState, id: string): id is ItemId {
  const def = definition(id);
  if (!def || !isDrink(def.category) || !s.kitchen && (id === 'affogato' || id === 'matchafloat')) return false;
  if (id.startsWith('sig:')) return s.signatureDrinks.recipes.some(recipe => recipe.id === id && !recipe.onMenu);
  return s.items[def.id] > 0 && !s.onMenu.includes(def.id);
}

export function selectTrialSale(s: GameState, item: ItemId | null): boolean {
  if (s.phase !== 'prep' || item !== null && !canTrialDrink(s, item) || s.trialSales.selected === item) return false;
  s.trialSales.selected = item;
  return true;
}

export function trialSaleItem(s: GameState): ItemId | null {
  const item = s.phase === 'prep' ? s.trialSales?.selected : s.trialSales?.active?.day === s.day ? s.trialSales.active.item : null;
  return item && canTrialDrink(s, item) ? item : null;
}

/** Raw ingredients for unprepared reservations still belong in the stock quote. */
export const trialSaleRemaining = (s: GameState): number => trialSaleItem(s)
  ? s.phase === 'prep' ? TRIAL_SALE_LIMIT : TRIAL_SALE_LIMIT - s.trialSales.active!.prepared : 0;

export function trialHeldForMina(s: GameState): boolean {
  const wish = minaWish(s), item = trialSaleItem(s);
  return !!item && isMinaWishDrink(item) && wish?.choice === 'milky' && !wish.paused && wish.rehearsedDay === null;
}

export function beginTrialSales(s: GameState): void {
  // Called while still in preparation, after the player's last menu change.
  const item = trialSaleItem(s);
  s.trialSales.active = item ? {
    item, ...(item.startsWith('sig:') ? { name: s.signatureDrinks.recipes.find(recipe => recipe.id === item)!.name } : {}),
    day: s.day, prepared: 0, served: 0, reserved: 0, visits: 0,
    ingredientCost: 0, revenue: 0, feedback: { love: 0, fine: 0, meh: 0 },
    practiceBefore: s.taste.served[item] ?? 0, qualityBefore: tasteScore(s, item),
  } : null;
  if (!item) s.trialSales.selected = null;
}

/** Existing drink customers take turns trying the special; no additional arrivals. */
export function trialOfferDue(s: GameState, regularId?: string): boolean {
  const run = s.trialSales.active;
  if (s.phase !== 'open' || !run || run.day !== s.day) return false;
  if (regularId) return regularId === 'mina' && trialHeldForMina(s);
  run.visits++;
  return run.visits % 3 === 0;
}

export function canReserveTrialSale(s: GameState, regularId?: string): boolean {
  const run = s.trialSales.active;
  if (s.phase !== 'open' || !run || !trialSaleItem(s)) return false;
  const limit = TRIAL_SALE_LIMIT - (regularId !== 'mina' && trialHeldForMina(s) ? 1 : 0);
  return run.prepared + run.reserved < limit;
}

export function reserveTrialSale(s: GameState, regularId?: string): boolean {
  if (!canReserveTrialSale(s, regularId)) return false;
  s.trialSales.active!.reserved++;
  return true;
}

export function releaseTrialSale(s: GameState): void {
  const run = s.trialSales.active;
  if (run?.day === s.day) run.reserved = Math.max(0, run.reserved - 1);
}

/** The ordinary serving transaction already paid these ingredients; account only. */
export function recordTrialPrepared(s: GameState, cost: number): void {
  const run = s.trialSales.active;
  if (!run || run.day !== s.day || run.reserved <= 0 || run.prepared >= TRIAL_SALE_LIMIT) return;
  run.reserved--; run.prepared++; run.ingredientCost += cost;
}

export function trialFeedback(item: ItemId, guest: { appearanceId?: number; look: Look }): TrialFeedback {
  const taste = guestTaste(guest), notes = itemFlavors(item);
  const liked = notes.includes(taste.liked), avoided = notes.includes(taste.avoided);
  return liked && !avoided ? 'love' : avoided && !liked ? 'meh' : 'fine';
}

/** Called once at actual handoff. Practice and cash remain in the normal sale path. */
export function recordTrialServed(s: GameState, amount: number, guest: { appearanceId?: number; look: Look }): void {
  const run = s.trialSales.active;
  if (!run || run.day !== s.day || run.served >= run.prepared) return;
  run.served++; run.revenue += amount; run.feedback[trialFeedback(run.item, guest)]++;
}

export function finishTrialSales(s: GameState): TrialSaleReport | undefined {
  const run = s.trialSales.active;
  s.trialSales.active = null;
  s.trialSales.selected = null; // Continuing is an explicit next-day decision.
  if (!run || run.day !== s.day) return undefined;
  const { reserved: _reserved, visits: _visits, ...stats } = run;
  const report = { ...stats, feedback: { ...stats.feedback }, qualityAfter: tasteScore(s, run.item) };
  s.trialSales.last = structuredClone(report);
  return report;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown, max = TRIAL_SALE_LIMIT): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const money = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const quality = (v: unknown): v is number => money(v) && v <= 5;
function parseStats(raw: unknown, day: number): TrialSaleStats | null {
  if (!object(raw) || typeof raw.item !== 'string' || !definition(raw.item) || !isDrink(definition(raw.item)!.category)
      || !count(raw.day, day) || raw.day < 1 || !count(raw.prepared) || !count(raw.served, raw.prepared)
      || !money(raw.ingredientCost) || !money(raw.revenue) || !quality(raw.qualityBefore) || !count(raw.practiceBefore, 1e9)
      || !object(raw.feedback)) return null;
  const { love, fine, meh } = raw.feedback;
  if (!count(love) || !count(fine) || !count(meh) || love + fine + meh !== raw.served) return null;
  return {
    item: raw.item as ItemId, day: raw.day, prepared: raw.prepared, served: raw.served,
    ingredientCost: raw.ingredientCost, revenue: raw.revenue, feedback: { love, fine, meh },
    practiceBefore: raw.practiceBefore, qualityBefore: raw.qualityBefore,
    ...(typeof raw.name === 'string' ? { name: [...raw.name.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 24).join('') } : {}),
  };
}

/** Missing old-save fields never create a trial, refill a live quota or award progress. */
export function parseTrialSales(raw: unknown, s: GameState): TrialSalesState {
  const out = emptyTrialSales();
  if (!object(raw)) return out;
  if (typeof raw.selected === 'string' && canTrialDrink(s, raw.selected)) out.selected = raw.selected;
  const active = parseStats(raw.active, s.day);
  if (s.phase !== 'prep' && active?.day === s.day && canTrialDrink(s, active.item) && object(raw.active)
      && count(raw.active.reserved, TRIAL_SALE_LIMIT - active.prepared) && count(raw.active.visits, 1e9)
      && active.served <= (s.today.sales[active.item] ?? 0)) {
    out.active = { ...active, reserved: raw.active.reserved, visits: raw.active.visits };
    out.selected = active.item;
  }
  const last = parseStats(raw.last, s.day - 1);
  if (last && object(raw.last) && quality(raw.last.qualityAfter)) out.last = { ...last, qualityAfter: raw.last.qualityAfter };
  return out;
}
