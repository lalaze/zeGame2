import { readyServings, setOnMenu } from '../game/economy';
import type { GameState } from '../game/state';
import { formatNumber } from '../game/format';
import { t } from '../i18n';
import { itemArtwork, toDataURL } from '../render/sprites';
import { closeModal, showModal } from './modal';

type Step = 'stock' | 'menu' | 'open';
export interface FirstOpeningOptions {
  step: 'stock' | 'menu';
  confirmStock(): void;
  advanced(): void;
}

/** The first opening is an explicit, resumable preparation flow, never a purchase. */
export function showFirstOpening(state: GameState, onStart: () => void, onChange: () => void, options: FirstOpeningOptions): void {
  let step: Step = options.step;
  const available = () => state.phase === 'prep' && state.day === 1;
  const ready = () => state.items.espresso > 0 && readyServings(state, 'espresso') > 0;
  const selected = () => state.onMenu.includes('espresso');
  const render = () => {
    if (!available()) return;
    const count = readyServings(state, 'espresso');
    const body = document.createElement('div');
    body.className = 'first-opening'; body.dataset.openingStep = step;
    body.innerHTML = `<ol class="opening-steps" aria-label="${t('opening.progress')}">${(['stock', 'menu', 'open'] as const).map((id, i) =>
      `<li${id === step ? ' aria-current="step"' : ''}><span>${i + 1}</span>${t(`opening.${id}.label`)}</li>`).join('')}</ol>
      <h3>${t(`opening.${step}.title`)}</h3><p>${t(`opening.${step}.body`)}</p>
      ${step === 'stock' ? `<div class="opening-stock"><b>${formatNumber(state.pantry.beans)}</b><span>${t('opening.beans')}</span></div><p class="opening-note">${t('opening.stockCount', { n: formatNumber(count) })}</p>` : ''}
      ${step === 'menu' ? `<label class="opening-menu"><input type="checkbox" data-opening-menu ${selected() ? 'checked' : ''} /><img src="${toDataURL(itemArtwork('espresso'), 1)}" alt="" /><span><b>${t('item.espresso')}</b><small>${t('opening.recipe')}</small></span></label>${!selected() ? `<p class="opening-warning" role="status">${t('opening.selectHint')}</p>` : ''}` : ''}
      ${step === 'open' ? `<ul class="opening-ready"><li>${t('opening.menuReady')}</li><li>${t('opening.stockReady', { n: formatNumber(count) })}</li><li>${t('opening.teamReady')}</li></ul><p class="opening-note">${t('opening.afterOpen')}</p>` : ''}
      ${!ready() ? `<p class="opening-warning" role="status">${t('opening.noStock')}</p>` : ''}
      <button class="chip opening-advanced" data-opening-advanced>${t('opening.advanced')}</button>`;
    body.querySelector<HTMLInputElement>('[data-opening-menu]')?.addEventListener('change', event => {
      if (!body.isConnected || !available()) return;
      const checked = (event.target as HTMLInputElement).checked;
      setOnMenu(state, 'espresso', checked); onChange(); render();
      document.querySelector<HTMLInputElement>('[data-opening-menu]')?.focus();
    });
    body.querySelector('[data-opening-advanced]')!.addEventListener('click', () => {
      if (!body.isConnected || !available()) return;
      closeModal(); options.advanced();
    });
    showModal({ title: t('opening.title'), body, buttons: [
      { label: t(`opening.${step}.next`), primary: true, disabled: !ready() || (step !== 'stock' && !selected()), onClick: () => {
        if (!available()) return;
        if (!ready()) { step = 'stock'; render(); return; }
        if (step === 'stock') { options.confirmStock(); step = 'menu'; render(); }
        else if (!selected()) { step = 'menu'; render(); }
        else if (step === 'menu') { step = 'open'; render(); }
        else onStart();
      } },
      ...(step === 'stock' ? [] : [{ label: t('ob.back'), onClick: () => { step = step === 'open' ? 'menu' : 'stock'; render(); } }]),
      { label: t('opening.later') },
    ] });
    const dialog = body.closest<HTMLElement>('[role="dialog"]')!;
    dialog.classList.add('first-opening-modal');
    dialog.querySelector('.modal-actions .pixel-btn')?.setAttribute('data-opening-next', '');
    (body.querySelector<HTMLElement>('[data-opening-menu]') ?? dialog.querySelector<HTMLElement>('[data-opening-next]:not(:disabled)'))?.focus();
  };
  render();
}
