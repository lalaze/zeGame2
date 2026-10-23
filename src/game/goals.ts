import { comfort, hasBoughtDecor } from './decor';
import { MENU, isDrink } from './data';
import { earn, menuItems, readyServings, unlockedItems } from './economy';
import type { GameState } from './state';
import { styleStages } from './styles';

export interface GoalDef {
  /** Translation key suffix: goal.<id> */
  id: string;
  reward: number;
  /** [current, target]; the goal is done when current >= target. */
  progress: (s: GameState) => [number, number];
}

const daysDone = (s: GameState) => s.day - 1;
const bestRecipeLevel = (s: GameState) => Math.max(...MENU.map(item => s.items[item.id]));
const completedStyleStages = (s: GameState, count: number) => s.cafeStyle.focus
  ? styleStages(s, s.cafeStyle.focus).slice(0, count).filter(stage => stage.done).length : 0;
const drinkSupply = (s: GameState) => Math.max(0, ...menuItems(s).filter(item => isDrink(item.category)).map(item => readyServings(s, item.id)));

// A short guided path through the game's systems, in the order a new owner meets them.
// Slot order, ids and rewards are save-compatible. General alternatives let a
// specialist follow their own menu without resetting or repeating claimed goals.
export const GOALS: readonly GoalDef[] = [
  { id: 'firstDay', reward: 30, progress: (s) => [daysDone(s), 1] },
  { id: 'espresso5', reward: 40, progress: (s) => [bestRecipeLevel(s), 2] },
  // A second drink comes before baking: food needs the $800 kitchen, which the capacity goal covers.
  { id: 'americano', reward: 60, progress: (s) => [unlockedItems(s).length, 2] },
  { id: 'latte', reward: 80, progress: (s) => [Math.max(unlockedItems(s).length, bestRecipeLevel(s)), 3] },
  { id: 'milk', reward: 60, progress: (s) => [Math.min(20, Math.max(s.pantry.milk, drinkSupply(s))), 20] },
  { id: 'sign', reward: 100, progress: (s) => [Math.max(s.upgrades.marketing, s.upgrades.machine), 1] },
  { id: 'decor', reward: 150, progress: (s) => [hasBoughtDecor(s) ? 1 : 0, 1] },
  { id: 'table', reward: 400, progress: (s) => [Math.max(s.upgrades.tables, Number(s.kitchen), s.regions.length), 1] },
  { id: 'barista', reward: 500, progress: (s) => [Math.max(s.upgrades.barista, s.upgrades.server, s.upgrades.cook), 1] },
  { id: 'days5', reward: 800, progress: (s) => [daysDone(s), 5] },
  { id: 'variety', reward: 1_000, progress: (s) => [Math.max(unlockedItems(s).length, completedStyleStages(s, 1) * 6), 6] },
  { id: 'comfort', reward: 1_000, progress: (s) => [comfort(s), 15] },
  { id: 'cappuccino', reward: 1_500, progress: (s) => [Math.max(Number(s.items.cappuccino > 0) * 5, bestRecipeLevel(s)), 5] },
  { id: 'served', reward: 3_000, progress: (s) => [s.served, 500] },
  { id: 'croissant', reward: 8_000, progress: (s) => [Math.max(Number(s.items.croissant > 0) * 2, completedStyleStages(s, 2)), 2] },
];

export const currentGoal = (s: GameState): GoalDef | null => GOALS[s.goal] ?? null;

export function goalDone(s: GameState): boolean {
  const g = currentGoal(s);
  if (!g) return false;
  const [cur, target] = g.progress(s);
  return cur >= target;
}

export function claimGoal(s: GameState): number {
  const g = currentGoal(s);
  if (!g || !goalDone(s)) return 0;
  earn(s, g.reward);
  s.goal++;
  return g.reward;
}
