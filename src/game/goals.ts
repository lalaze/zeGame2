import { comfort, hasBoughtDecor } from './decor';
import { earn, unlockedItems } from './economy';
import type { GameState } from './state';

export interface GoalDef {
  /** Translation key suffix: goal.<id> */
  id: string;
  reward: number;
  /** [current, target]; the goal is done when current >= target. */
  progress: (s: GameState) => [number, number];
}

const daysDone = (s: GameState) => s.day - 1;

// A short guided path through the game's systems, in the order a new owner meets them.
export const GOALS: readonly GoalDef[] = [
  { id: 'firstDay', reward: 30, progress: (s) => [daysDone(s), 1] },
  { id: 'espresso5', reward: 40, progress: (s) => [s.items.espresso, 5] },
  { id: 'roll', reward: 60, progress: (s) => [s.items.roll, 1] },
  { id: 'latte', reward: 80, progress: (s) => [s.items.latte, 1] },
  { id: 'milk', reward: 60, progress: (s) => [Math.min(s.pantry.milk, 20), 20] },
  { id: 'sign', reward: 100, progress: (s) => [Math.max(s.upgrades.marketing, s.upgrades.machine), 1] },
  { id: 'decor', reward: 150, progress: (s) => [hasBoughtDecor(s) ? 1 : 0, 1] },
  { id: 'table', reward: 400, progress: (s) => [Math.max(s.upgrades.tables, Number(s.kitchen), s.regions.length), 1] },
  { id: 'barista', reward: 500, progress: (s) => [Math.max(s.upgrades.barista, s.upgrades.server, s.upgrades.cook), 1] },
  { id: 'days5', reward: 800, progress: (s) => [daysDone(s), 5] },
  { id: 'variety', reward: 1_000, progress: (s) => [unlockedItems(s).length, 6] },
  { id: 'comfort', reward: 1_000, progress: (s) => [comfort(s), 15] },
  { id: 'cappuccino', reward: 1_500, progress: (s) => [s.items.cappuccino, 1] },
  { id: 'served', reward: 3_000, progress: (s) => [s.served, 500] },
  { id: 'croissant', reward: 8_000, progress: (s) => [s.items.croissant, 1] },
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
