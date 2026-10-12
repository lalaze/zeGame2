import { styleStationMultiplier } from './styles';
import { isBakery, menuItems, recipe, servingsLeft } from './economy';
import { batchSteps, STATION_SECONDS } from './kitchen';
import type { IngredientId, ItemId } from './data';
import type { Sim } from './sim';
import type { GameState } from './state';

export type OperationKind = 'closing' | 'ingredients' | 'delivery' | 'baking' | 'shelf' | 'counter' | 'quiet' | 'steady';
export interface OperationStatus { kind: OperationKind; item?: ItemId; ingredients?: IngredientId[]; seconds?: number; }

export function operationStatus(state: GameState, sim: Sim): OperationStatus {
  if (state.phase === 'closing') return { kind: 'closing' };
  const items = menuItems(state);
  const unavailable = items.find((m) => servingsLeft(state, m.id) < 1 && (!isBakery(m.id) || !(state.shelf[m.id] ?? 0)) && !(state.inProduction[m.id] ?? 0));
  if (unavailable) return { kind: 'ingredients', item: unavailable.id, ingredients: recipe(unavailable.id).filter(([id, n]) => state.pantry[id] < n).map(([id]) => id) };
  if (sim.baristas.some((_, i) => sim.isHolding(i)) || sim.pass.length >= 3) return { kind: 'delivery' };
  const empty = items.find((m) => isBakery(m.id) && !(state.shelf[m.id] ?? 0));
  if (empty) {
    const cook = sim.cooks.find((c) => c.batch?.item === empty.id);
    if (cook?.batch) {
      // Remaining station work is a lower bound: movement also takes time.
      const work = Math.max(0, cook.batch.timer) + batchSteps(empty.id).slice(cook.batch.step + 1).reduce((n, s) => n + STATION_SECONDS[s] * styleStationMultiplier(state), 0);
      return { kind: 'baking', item: empty.id, seconds: Math.ceil(work) };
    }
    return { kind: 'shelf', item: empty.id };
  }
  if (sim.queue.length >= 3 && sim.baristas.every((_, i) => sim.isBrewing(i))) return { kind: 'counter' };
  if (state.dayTime >= 20 && !sim.queue.length && sim.baristas.every((b) => b.customerId === null) && !sim.pass.length && sim.servers.every((s) => !s.plates.length)) return { kind: 'quiet' };
  return { kind: 'steady' };
}

/** Keep brief transients from flickering the advice. Measured in simulation time. */
export class OperationMonitor {
  private candidate = '';
  private since = 0;
  current: OperationStatus = { kind: 'steady' };
  update(state: GameState, sim: Sim): OperationStatus {
    const next = operationStatus(state, sim);
    const key = `${next.kind}:${next.item ?? ''}`;
    if (key !== this.candidate || state.dayTime < this.since) { this.candidate = key; this.since = state.dayTime; }
    if (next.kind === 'closing' || state.dayTime - this.since >= 3) this.current = next;
    return this.current;
  }
  reset(): void { this.candidate = ''; this.since = 0; this.current = { kind: 'steady' }; }
}
