import { trafficAt } from '../game/traffic';
import type { GameState } from '../game/state';
import { t } from '../i18n';

/** Descriptive service rhythm, never an urgency alarm or a customer guarantee. */
export function trafficHud(state: Pick<GameState, 'phase' | 'dayTime'>): { label: string; nextLabel: string; description: string; story: string } | null {
  if (state.phase !== 'open') return null;
  const traffic = trafficAt(state.dayTime);
  return {
    label: t(`flow.traffic.${traffic.phase}`),
    nextLabel: t(`flow.traffic.${traffic.nextPhase}`),
    story: t(`flow.traffic.story.${traffic.phase}`),
    description: t('flow.traffic.next', {
      phase: t(`flow.traffic.${traffic.nextPhase}`),
      seconds: Math.ceil(traffic.secondsToNextPhase),
    }),
  };
}
