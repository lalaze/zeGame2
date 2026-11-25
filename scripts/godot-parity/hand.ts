// Edge cases written by hand, for what typed random arguments rarely hit.
import type { GameState } from '../../src/game/state';
import type { Random } from './ops';
export interface HandCase { fn: string; args: unknown[]; setup?: { height?: number; kitchen?: number; locale?: 'zh' | 'en'; clock?: number } }
export function HAND(mod: string, states: GameState[], _r: Random): HandCase[] {
  // The two setters return nothing: what they change is read back with every case ("g").
  if (mod === 'layout') return [[0], [239.4], [240.5], [299.5], [360.4], [NaN], [-5]].map((args) => ({ fn: 'setSceneHeight', args }));
  if (mod === 'business-clock' || mod === 'format') return [];
  void states;
  return [];
}
