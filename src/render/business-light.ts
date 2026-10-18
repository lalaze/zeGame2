import type { GameState } from '../game/state';
import { businessClockMinutes } from '../game/business-clock';

/** Windows and wall clocks use the same 08:00–20:00 clock as the HUD. */
export function businessLightDate(state: Pick<GameState, 'phase' | 'dayTime'>): Date {
  const minutes = businessClockMinutes(state.phase === 'prep' ? 0 : state.dayTime);
  return new Date(2000, 0, 1, 0, minutes);
}
