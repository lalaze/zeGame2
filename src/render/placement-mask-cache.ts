import type { Surface } from '../game/furniture';
import { sceneHeight } from '../game/layout';
import { mainTableCount, type AreaId } from '../game/regions';
import type { GameState } from '../game/state';

/**
 * Inputs to cellFree/fits plus the geometry used to paint its cells. Snapshot
 * values, not object identities: placing/moving/storing furniture and unlocking
 * rooms mutate the existing state. Keep placed order because skip is an index.
 * If cellFree starts reading another state field, include it here too.
 *
 * The held piece's position/id, actors, time and inventory do not affect this
 * single-cell mask. Its full footprint and live actor clearance are still
 * checked every frame separately.
 */
export function placementMaskKey(state: GameState, area: AreaId, surface: Surface, skip = -1): string {
  return JSON.stringify([
    area, surface, sceneHeight(), mainTableCount(state), state.regions, state.kitchen,
    state.decor.placed.map(({ id, col, row }) => [id, col, row]), skip,
  ]);
}
