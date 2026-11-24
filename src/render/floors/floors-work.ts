// How far along the people at work are, for the bars over their heads (floors-props.ts).
import { STATION_SECONDS } from '../../game/kitchen';
import { partnerStationTime } from '../../game/partners';
import type { Sim } from '../../game/sim';
import type { GameState } from '../../game/state';
import { styleStationMultiplier } from '../../game/styles';

const share = (left: number, total: number): number => Math.min(1, Math.max(0, 1 - left / total));

/** How much of a barista's order is made, from 0 to 1; null when they are not making one. */
export function brewShare(barista: Pick<Sim['baristas'][number], 'customerId' | 'remaining' | 'total'>): number | null {
  if (barista.customerId === null || barista.total <= 0 || barista.remaining <= 0) return null;
  return share(barista.remaining, barista.total);
}

/** How much of their time at this station cook `i` has put in, from 0 to 1; null when they are not at work at one. */
export function bakeShare(sim: Pick<Sim, 'cooks' | 'cookStation'>, state: GameState, i: number): number | null {
  const batch = sim.cooks[i]?.batch, at = sim.cookStation(i);
  if (!batch || !at?.working) return null;
  return share(batch.timer, STATION_SECONDS[at.station] * styleStationMultiplier(state) * partnerStationTime(state, sim.cooks[i].partnerId));
}
