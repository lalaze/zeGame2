/** Reversible operating choices. Purchased systems are never tied to a class. */
import { COMBO_CHANCE, MENU, isDrink, type MenuItemDef, type ItemId } from './data';
import { comfort } from './decor';
import { petActive } from './pets';
import { reputationScore } from './reputation';
import { tasteTier } from './taste';
import type { GameState } from './state';

export const STYLE_IDS = ['coffee', 'bakery', 'cats', 'takeaway', 'garden', 'community'] as const;
export type CafeStyleId = typeof STYLE_IDS[number];
export const HANDOFF_COUNTERS = ['tableServed', 'catServed', 'fastServed', 'teaPairs'] as const;
export type HandoffCounter = typeof HANDOFF_COUNTERS[number];
export interface CafeStyleState { focus: CafeStyleId | null; handoffs: Record<HandoffCounter, number> }
export const emptyStyleHandoffs = (): Record<HandoffCounter, number> => ({ tableServed: 0, catServed: 0, fastServed: 0, teaPairs: 0 });
export const isCafeStyle = (id: unknown): id is CafeStyleId => STYLE_IDS.some((style) => style === id);
export function parseCafeStyle(value: unknown): CafeStyleState {
  const focus = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).focus : null;
  const source = value && typeof value === 'object' ? (value as { handoffs?: unknown }).handoffs : null;
  const handoffs = emptyStyleHandoffs();
  if (source && typeof source === 'object' && !Array.isArray(source)) for (const id of HANDOFF_COUNTERS) {
    const n = (source as Record<string, unknown>)[id];
    if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) handoffs[id] = Math.min(1_000_000_000, n);
  }
  return { focus: isCafeStyle(focus) ? focus : null, handoffs };
}
export function setCafeStyle(state: GameState, id: CafeStyleId | null): boolean {
  if (state.phase !== 'prep' || id !== null && !isCafeStyle(id)) return false;
  state.cafeStyle.focus = id;
  return true;
}
export const cafeStyle = (state: GameState): CafeStyleId | null => state.cafeStyle?.focus ?? null;
export interface StyleGoal { id: string; current: number; target: number; done: boolean }
export interface StyleStage { id: 'early' | 'mid' | 'late'; done: boolean; goals: StyleGoal[] }
const category = (id: ItemId) => MENU.find((m) => m.id === id)!.category;
const servings = (s: GameState, categories: string[]) => MENU.filter((m) => categories.includes(m.category)).reduce((sum, m) => sum + (s.taste.served[m.id] ?? 0), 0);
const signatures = (s: GameState, categories: string[]) => s.taste.signature.filter((id) => categories.includes(category(id))).length;
const goal = (id: string, current: number, target: number): StyleGoal => ({ id, current: Math.min(current, target), target, done: current >= target });
/** No claimable money or stat rewards: these checklists reflect retained real assets
 * and delivered servings. Switching/reloading cannot mint or stack anything. */
export function styleStages(s: GameState, id: CafeStyleId): StyleStage[] {
  const item = (name: ItemId, target: number) => goal(`${name}${target}`, s.items[name], target);
  const upgrade = (name: keyof GameState['upgrades'], target: number) => goal(`${name}${target}`, s.upgrades[name], target);
  const cozy = (target: number) => goal(`comfort${target}`, comfort(s), target);
  const region = (name: 'reading' | 'greenhouse' | 'terrace') => goal(name, Number(s.regions.includes(name)), 1);
  const sales = (name: string, cats: string[], target: number) => goal(name, servings(s, cats), target);
  const research = (name: string, cats: string[], target: number) => goal(name, signatures(s, cats), target);
  const kitchen = () => goal('kitchen', Number(s.kitchen), 1);
  const cat = (target: number) => goal(`cats${target}`, s.pets.length, target);
  const handoff = (name: HandoffCounter, target: number) => goal(`${name}${target}`, s.cafeStyle.handoffs[name], target);
  const bookshelf = () => goal('bookshelf', Number(s.decor.placed.some((p) => p.id === 'bookshelf')), 1);
  const reliable = () => goal('reliable', s.reputation.recent.length >= 20 ? reputationScore(s.reputation) : 0, 4.2);
  const all: Record<CafeStyleId, StyleGoal[][]> = {
    coffee: [
      [item('espresso', 5), upgrade('machine', 1), sales('coffee30', ['coffee'], 30)],
      [item('latte', 5), upgrade('barista', 1), research('coffeeSignature1', ['coffee'], 1)],
      [item('flatwhite', 10), upgrade('machine', 4), research('coffeeSignature2', ['coffee'], 2)],
    ],
    bakery: [
      [item('espresso', 5), kitchen(), item('roll', 3)],
      [item('donut', 3), upgrade('cook', 1), sales('bakery100', ['bread', 'pastry'], 100)],
      [item('croissant', 5), upgrade('cook', 2), research('bakerySignature2', ['bread', 'pastry'], 2)],
    ],
    cats: [
      [item('espresso', 5), cat(1), cozy(5)],
      [cat(2), upgrade('server', 1), cozy(15)],
      [cat(3), cozy(30), handoff('catServed', 300)],
    ],
    takeaway: [
      [item('espresso', 5), upgrade('machine', 1), handoff('fastServed', 30)],
      [item('americano', 10), upgrade('barista', 1), upgrade('machine', 3)],
      [item('cortado', 3), upgrade('barista', 2), upgrade('machine', 8), handoff('fastServed', 300)],
    ],
    garden: [
      [item('blacktea', 3), goal('planted', Number(gardenReady(s)), 1), sales('tea30', ['tea'], 30)],
      [kitchen(), item('scone', 3), upgrade('server', 1)],
      [region('greenhouse'), region('terrace'), upgrade('server', 2), handoff('teaPairs', 100)],
    ],
    community: [
      [item('espresso', 5), cozy(5), handoff('tableServed', 30)],
      [region('reading'), upgrade('server', 1), reliable()],
      [bookshelf(), upgrade('server', 2), handoff('tableServed', 300), reliable()],
    ],
  };
  return all[id].map((goals, i) => ({ id: (['early', 'mid', 'late'] as const)[i], done: goals.every((g) => g.done), goals }));
}
export const currentStyleStage = (s: GameState, id: CafeStyleId): StyleStage => {
  const stages = styleStages(s, id);
  return stages.find((stage) => !stage.done) ?? stages[2];
};
export const nextStyleGoal = (s: GameState, id: CafeStyleId): StyleGoal | null => styleStages(s, id).flatMap((stage) => stage.goals).find((g) => !g.done) ?? null;

/** The first complete policy: deliberate coffee preparation, with a premium that
 * grows through real delivered portions and purchased signature research. */
export function stylePrepMultiplier(s: GameState, id: ItemId): number {
  return cafeStyle(s) === 'coffee' && category(id) === 'coffee' ? 1.12 : 1;
}
export function styleSaleMultiplier(s: GameState, id: ItemId, dineIn = false, meal: readonly ItemId[] = [id]): number {
  if (cafeStyle(s) === 'coffee' && category(id) === 'coffee') return { standard: 1.04, skilled: 1.08, signature: 1.12 }[tasteTier(s, id)];
  if (cafeStyle(s) === 'takeaway' && !dineIn && fastDrinkMeal(meal)) return .94;
  if (cafeStyle(s) === 'cats' && dineIn && comfort(s) >= 5) return 1 + .04 * Math.min(3, activeStyleCats(s));
  if (cafeStyle(s) === 'garden' && dineIn && gardenReady(s)) {
    if (teaPastryMeal(meal)) return 1.12;
    if (category(id) === 'tea') return 1.06;
  }
  return 1;
}

/** Qualifies from the delivered meal; upgraded machines do not turn elaborate
 * recipes into commuter orders, and an actual add-on makes it ineligible. */
export function fastDrinkMeal(meal: readonly ItemId[]): boolean {
  return meal.length > 0 && meal.every((id) => ['coffee', 'tea'].includes(category(id)))
    && meal.reduce((sum, id) => sum + MENU.find((m) => m.id === id)!.prepTime, 0) <= 3;
}
export const teaPastryMeal = (meal: readonly ItemId[]): boolean => meal.some((id) => category(id) === 'tea') && meal.some((id) => category(id) === 'pastry');
export const activeStyleCats = (s: GameState): number => s.pets.filter(petActive).length;
export const gardenReady = (s: GameState): boolean => comfort(s) >= 5 && (s.decor.placed.some((p) => p.id.startsWith('plant_')) || ['sill_cactus', 'sill_tulips', 'sill_bonsai'].includes(s.decor.equipped.sill));
/** Called exactly once by successful payment, never by baking or arrival. Counts
 * are factual lifetime history regardless of focus, with no associated payout. */
export function recordStyleHandoff(s: GameState, meal: readonly ItemId[], dineIn: boolean): void {
  const add = (id: HandoffCounter) => { s.cafeStyle.handoffs[id] = Math.min(1_000_000_000, s.cafeStyle.handoffs[id] + 1); };
  if (dineIn) add('tableServed');
  if (activeStyleCats(s) > 0) add('catServed');
  if (!dineIn && fastDrinkMeal(meal)) add('fastServed');
  if (dineIn && teaPastryMeal(meal)) add('teaPairs');
}

/** Shared order model for the actual arrival and ingredient/production forecast. */
export function styleOrderPairs(s: GameState | undefined, main: MenuItemDef, menu: readonly MenuItemDef[]): MenuItemDef[] {
  if (s && cafeStyle(s) === 'garden' && gardenReady(s) && ['tea', 'pastry'].includes(main.category)) {
    const pairs = menu.filter((m) => m.category === (main.category === 'tea' ? 'pastry' : 'tea'));
    if (pairs.length) return pairs;
  }
  return menu.filter((m) => isDrink(m.category) !== isDrink(main.category));
}
export function styleComboChance(s: GameState | undefined, main: MenuItemDef, pairs: readonly MenuItemDef[]): number {
  if (s && cafeStyle(s) === 'bakery' && s.kitchen) return .5;
  if (s && cafeStyle(s) === 'garden' && gardenReady(s) && pairs.some((p) => teaPastryMeal([main.id, p.id]))) return .5;
  return COMBO_CHANCE;
}
export function styleSeatChance(s: GameState, meal: readonly ItemId[]): number {
  if (cafeStyle(s) === 'takeaway' && fastDrinkMeal(meal)) return 0;
  if (cafeStyle(s) === 'garden' && gardenReady(s) && meal.some((id) => category(id) === 'tea')) return .8;
  return .6;
}
export const styleStationMultiplier = (s?: GameState): number => s && cafeStyle(s) === 'bakery' && s.kitchen ? .9 : 1;

export function styleDwellExtra(s: GameState, meal: readonly ItemId[]): number {
  if (cafeStyle(s) === 'cats' && comfort(s) >= 5) return 4 * Math.min(3, activeStyleCats(s));
  if (cafeStyle(s) === 'garden' && gardenReady(s) && meal.some((id) => category(id) === 'tea')) return 6;
  return 0;
}
const communityReady = (s: GameState) => cafeStyle(s) === 'community' && comfort(s) >= 5;
export const styleArrivalMultiplier = (s: GameState): number => communityReady(s) ? .9 : 1;
export const styleServerMultiplier = (s: GameState): number => communityReady(s) ? 1.15 : 1;
export const styleTablePatienceExtra = (s: GameState): number => communityReady(s) ? 10 : 0;
