import { operationStatus } from '../game/operations';
import type { Sim } from '../game/sim';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { displayItemName } from './item-name';
import type { PantryTaskContext } from './panel';

/** A live explanation for the existing pantry. It never purchases or pauses. */
export function pantryTaskContext(state: GameState, sim: Sim, shortage: boolean): PantryTaskContext {
  if (state.phase === 'closing') return {
    title: t('flow.pantryTitle'), detail: t('flow.closingStock'), ingredients: [],
  };
  const current = operationStatus(state, sim);
  const missing = shortage && current.kind === 'ingredients' && current.item && current.ingredients?.length;
  if (missing) return {
    title: t('flow.shortageTitle'),
    detail: t('flow.shortageDetail', {
      item: displayItemName(current.item!, state),
      ingredients: current.ingredients!.map(id => t(`ing.${id}`)).join(t('list.sep')),
    }),
    ingredients: current.ingredients!,
  };
  return {
    title: t('flow.pantryTitle'), detail: t(shortage ? 'flow.shortageResolved' : 'flow.pantryDetail'), ingredients: [],
  };
}
