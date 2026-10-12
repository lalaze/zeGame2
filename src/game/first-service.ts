import { menuItems, readyServings } from './economy';
import type { GameState } from './state';

export type FirstServiceStep = 'stock' | 'prepare' | 'observe' | 'close' | 'closing' | 'reopen' | 'complete';
/** No migration: established cafés only see guidance when they explicitly request help. */
export function isFirstCafe(state: GameState): boolean {
  return !state.profile && state.day === 1 && state.served === 0 && state.totalEarned === 0
    && !state.kitchen && state.regions.length === 0 && state.pets.length === 0
    && Object.entries(state.items).every(([id, level]) => level === (id === 'espresso' ? 1 : 0));
}
export function firstServiceStep(state: GameState, checkedStock: boolean): FirstServiceStep {
  if (state.phase === 'closing') return 'closing';
  if (state.day > 1) return state.phase === 'open' ? 'complete' : 'reopen';
  if (state.phase === 'prep') return checkedStock ? 'prepare' : 'stock';
  const soldOut = menuItems(state).some((item) => readyServings(state, item.id) < 1);
  return state.dayTime >= 45 || state.today.served >= 5 || soldOut ? 'close' : 'observe';
}
