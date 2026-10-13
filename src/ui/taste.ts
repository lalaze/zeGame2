import { displayItemName } from './item-name';
import { researchBlock, researchSignature, signatureCost, tasteScore, tasteTier, SKILLED_SERVINGS, SIGNATURE_SERVINGS } from '../game/taste';
import type { ItemId } from '../game/data';
import type { GameState } from '../game/state';
import { formatTransactionMoney as formatMoney } from '../game/format';
import { t } from '../i18n';
import { showModal, toast } from './modal';

export function tasteLabel(state: GameState, id: ItemId): string {
  return t('taste.label', { score: tasteScore(state, id).toFixed(1), tier: t(`taste.tier.${tasteTier(state, id)}`) });
}

export function tasteProgressLabel(state: GameState, id: ItemId): string {
  const tier = tasteTier(state, id);
  const sold = state.taste.served[id] ?? 0;
  if (tier === 'signature') return t('taste.mastered');
  if (sold >= SIGNATURE_SERVINGS) return t('taste.ready');
  return t(tier === 'standard' ? 'taste.progressSkilled' : 'taste.progressSignature', {
    n: sold, target: tier === 'standard' ? SKILLED_SERVINGS : SIGNATURE_SERVINGS,
  });
}

export function showTaste(state: GameState, id: ItemId, onResearch: () => void): void {
  const block = researchBlock(state, id);
  const name = displayItemName(id, state);
  showModal({
    title: t('taste.title', { item: name }),
    body: `<div class="taste-overview"><strong>${tasteLabel(state, id)}</strong><p>${tasteProgressLabel(state, id)}</p></div>
      <p>${t('taste.sold', { n: state.taste.served[id] ?? 0 })}</p>
      <ul class="taste-levels"><li>${t('taste.standard')}</li><li>${t('taste.skilled')}</li><li>${t('taste.signature')}</li></ul>
      <p class="note">${t('taste.rules')}</p>
      <p class="note">${t('taste.costRule')}</p>
      ${block ? `<p class="note" role="status">${t(`taste.block.${block}`)}</p>` : ''}`,
    buttons: [
      { label: t('settings.back') },
      { label: block === 'owned' ? t('taste.mastered') : t('taste.research', { price: formatMoney(signatureCost(id)) }), primary: true, disabled: block !== null,
        onClick: () => {
          if (!researchSignature(state, id)) return;
          onResearch();
          toast(t('taste.researched', { item: name }));
        },
      },
    ],
  });
}
