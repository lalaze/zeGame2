// Preparing today's menu: the step that opens the shop. The player picks the dishes
// to sell and how much of each bread and pastry to bake this morning, can stock up
// on ingredients, and only then starts business.
import { BAKE_STEP, type ItemId } from '../game/data';
import { checkOpen } from '../game/day';
import {
  dayDemand,
  expectedCustomers,
  isBakery,
  menuItems,
  readyServings,
  restock,
  restockQuote,
  setBakePlan,
  setOnMenu,
  unlockedItems,
} from '../game/economy';
import { formatMoney, formatNumber } from '../game/format';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { itemIcon, toDataURL } from '../render/sprites';
import { showModal } from './modal';
import { itemName } from './panel';

/**
 * Opens the "prepare today's menu" dialog. `onStart` opens the shop once the player
 * confirms; `onChange` lets the page refresh whatever shows the menu or the pantry.
 */
export function showPrepare(state: GameState, onStart: () => void, onChange: () => void): void {
  const body = document.createElement('div');
  body.className = 'prep';

  const render = () => {
    const demand = dayDemand(state);
    const onMenu = new Set(menuItems(state).map((m) => m.id));
    const check = checkOpen(state);
    const low = new Set<ItemId>(!check.ok && check.reason === 'lowStock' ? check.items : []);
    const rows = unlockedItems(state)
      .map((m) => {
        const on = onMenu.has(m.id);
        const ready = readyServings(state, m.id);
        const bake = isBakery(m.id)
          ? `<span class="bake">
              <button class="chip bake-btn" data-bake="${m.id}:-1" aria-label="−${BAKE_STEP}" ${on ? '' : 'disabled'}>−</button>
              <span class="bake-n">${state.bakePlan[m.id] ?? 0}</span>
              <button class="chip bake-btn" data-bake="${m.id}:1" aria-label="+${BAKE_STEP}" ${on ? '' : 'disabled'}>+</button>
            </span>`
          : '';
        const note = on
          ? isBakery(m.id)
            ? t('bake.forecast', { n: Math.round(demand.get(m.id) ?? 0) })
            : t('prep.ready', { n: formatNumber(ready) })
          : t('menu.off');
        return `<label class="prep-row${on ? '' : ' off'}${on && low.has(m.id) ? ' low' : ''}">
            <input type="checkbox" data-dish="${m.id}" ${on ? 'checked' : ''} />
            <img src="${toDataURL(itemIcon(m.id), 3)}" alt="" />
            <span class="prep-name"><b>${itemName(m.id)}</b><small>${note}</small></span>
            ${bake}
          </label>`;
      })
      .join('');
    const quote = restockQuote(state);
    const full = quote.cost <= 0;
    body.innerHTML = `
      <p>${t('prep.intro')}</p>
      <div class="prep-list">${rows}</div>
      <p class="note">${t('pantry.forecast', { n: formatNumber(expectedCustomers(state)) })} · ${t('prep.count', { n: onMenu.size })}</p>
      ${low.size ? `<p class="note warn">${t('prep.low')}</p>` : ''}
      <button class="pixel-btn small ghost" data-restock ${full || state.coins <= 0 ? 'disabled' : ''}>
        ${full ? t('pantry.full') : t('pantry.restock', { price: formatMoney(quote.cost) })}
      </button>`;
    const start = document.querySelector<HTMLButtonElement>('.modal-actions [data-start]');
    if (start) start.disabled = onMenu.size === 0;
  };

  body.addEventListener('change', (e) => {
    const box = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-dish]');
    if (!box) return;
    setOnMenu(state, box.dataset.dish as ItemId, box.checked);
    onChange();
    render();
  });
  body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const step = target.closest<HTMLButtonElement>('button[data-bake]');
    if (step) {
      e.preventDefault();
      const [id, dir] = step.dataset.bake!.split(':') as [ItemId, string];
      setBakePlan(state, id, (state.bakePlan[id] ?? 0) + Number(dir) * BAKE_STEP);
      onChange();
      render();
    } else if (target.closest('button[data-restock]')) {
      if (restock(state)) onChange();
      render();
    }
  });

  showModal({
    title: t('prep.title', { n: state.day }),
    body,
    buttons: [
      { label: t('prep.start'), primary: true, onClick: onStart },
      { label: t('prep.later') },
    ],
  });
  document.querySelector<HTMLButtonElement>('.modal-actions .pixel-btn')?.setAttribute('data-start', '');
  render();
}
