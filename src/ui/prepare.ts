import { promotionPlan } from '../game/promotion';
import { petTraffic } from '../game/pets';
import { BAKE_STEP, type ItemId } from '../game/data';
import { checkOpen } from '../game/day';
import { bakeForForecast, dayDemand, expectedCustomers, isBakery, menuItems, readyServings, restock, restockQuote, setBakePlan, setOnMenu, suggestedBake, unlockedItems } from '../game/economy';
import { reputationTraffic } from '../game/reputation';
import { trafficPercent } from './reputation';
import { kitchenLoad } from '../game/kitchen';
import { formatMoney, formatNumber } from '../game/format';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { tasteLabel } from './taste';
import { itemArtwork, toDataURL } from '../render/sprites';
import { showModal } from './modal';
import { ingredientName, itemName } from './panel';

export function showPrepare(state: GameState, onStart: () => void, onChange: () => void): void {
  const body = document.createElement('div');
  body.className = 'prep';
  let receipt = '';
  const render = () => {
    const focus = document.activeElement?.getAttribute('data-focus');
    const demand = dayDemand(state);
    const onMenu = new Set(menuItems(state).map((m) => m.id));
    const check = checkOpen(state);
    const low = new Set<ItemId>(!check.ok && check.reason === 'lowStock' ? check.items : []);
    const rows = unlockedItems(state).map((m) => {
      const on = onMenu.has(m.id);
      const ready = readyServings(state, m.id);
      const bake = isBakery(m.id) ? `<div class="bake">
        <button class="chip bake-btn" data-focus="minus-${m.id}" data-bake="${m.id}:-1" aria-label="${itemName(m.id)} −${BAKE_STEP}" ${on ? '' : 'disabled'}>−${BAKE_STEP}</button>
        <input class="bake-input" data-focus="amount-${m.id}" data-amount="${m.id}" type="number" min="0" max="9999" step="1" value="${state.bakePlan[m.id] ?? 0}" aria-label="${itemName(m.id)} · ${t('bake.label')}" ${on ? '' : 'disabled'} />
        <button class="chip bake-btn" data-focus="plus-${m.id}" data-bake="${m.id}:1" aria-label="${itemName(m.id)} +${BAKE_STEP}" ${on ? '' : 'disabled'}>+${BAKE_STEP}</button>
        <small>${t('bake.suggested', { n: suggestedBake(state, m.id) })}</small>
      </div>` : '';
      const note = on ? isBakery(m.id) ? t('bake.forecast', { n: Math.ceil(demand.get(m.id) ?? 0) }) : t('prep.ready', { n: formatNumber(ready) }) : t('menu.off');
      return `<div class="prep-row${on ? '' : ' off'}${on && low.has(m.id) ? ' low' : ''}">
        <label class="prep-select"><input type="checkbox" data-focus="dish-${m.id}" data-dish="${m.id}" ${on ? 'checked' : ''} />
        <img src="${toDataURL(itemArtwork(m.id), 1)}" alt="" /><span class="prep-name"><b>${itemName(m.id)}</b><small>${note}</small><small>${tasteLabel(state, m.id)}</small></span></label>${bake}</div>`;
    }).join('');
    const quote = restockQuote(state);
    const full = quote.cost <= 0;
    const missing = Object.entries(quote.buy).map(([id, n]) => `${ingredientName(id as keyof GameState['pantry'])} ×${n}`).join(t('list.sep'));
    body.innerHTML = `<p>${t('prep.intro')}</p>
      <p class="note">${t('pantry.forecast', { n: formatNumber(expectedCustomers(state)) })}</p>
      <p class="note">${t('rating.prep', { pct: trafficPercent(reputationTraffic(state.reputation)) })}</p>
      ${state.promotion ? `<p class="note">${t(state.promotion.paused ? 'promo.prepPaused' : 'promo.prep', { pct: Math.round(promotionPlan(state.promotion.id)!.boost * 100), seconds: Math.ceil(state.promotion.remaining) })}</p>` : ''}
      ${state.pets.length ? `<p class="note">${t('pet.forecast', { pct: Math.round((petTraffic(state) - 1) * 100) })}</p>` : ''}
      ${state.kitchen ? `<p class="note">${t('prep.kitchen')}</p>` : ''}
      ${kitchenLoad(state) > 1 ? `<p class="note warn">${t('prep.capacity')}</p>` : ''}
      <div class="prep-list">${rows}</div>
      <button class="pixel-btn small ghost" data-focus="forecast" data-forecast ${[...onMenu].some(isBakery) ? '' : 'disabled'}>${t('bake.all')}</button>
      ${low.size ? `<p class="note warn">${t('prep.low')} ${[...low].map(itemName).join(t('list.sep'))}</p>` : ''}
      ${missing ? `<p class="note">${t('prep.missing', { items: missing })}</p>` : ''}
      ${quote.cost > state.coins ? `<p class="note warn">${t('prep.partial', { money: formatMoney(state.coins) })}</p>` : ''}
      <button class="pixel-btn small ghost" data-focus="restock" data-restock ${full || state.coins <= 0 ? 'disabled' : ''}>${full ? t('pantry.full') : t('pantry.restock', { price: formatMoney(quote.cost) })}</button>
      <p class="note" role="status">${receipt}</p>`;
    const start = document.querySelector<HTMLButtonElement>('.modal-actions [data-start]');
    if (start) start.disabled = onMenu.size === 0;
    if (focus) body.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus();
  };
  body.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.dish) setOnMenu(state, input.dataset.dish as ItemId, input.checked);
    else if (input.dataset.amount) setBakePlan(state, input.dataset.amount as ItemId, Number(input.value));
    else return;
    receipt = ''; onChange(); render();
  });
  body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const step = target.closest<HTMLButtonElement>('button[data-bake]');
    if (step) {
      const [id, dir] = step.dataset.bake!.split(':') as [ItemId, string];
      setBakePlan(state, id, (state.bakePlan[id] ?? 0) + Number(dir) * BAKE_STEP);
      receipt = '';
    } else if (target.closest('button[data-forecast]')) { bakeForForecast(state); receipt = ''; }
    else if (target.closest('button[data-restock]')) {
      const before = { ...state.pantry };
      restock(state);
      const bought = Object.entries(state.pantry).filter(([id, n]) => n > before[id as keyof typeof before]).map(([id, n]) => `${ingredientName(id as keyof typeof before)} ×${n - before[id as keyof typeof before]}`).join(t('list.sep'));
      receipt = bought ? t('prep.bought', { items: bought }) : t('prep.noPurchase');
    } else return;
    onChange(); render();
  });
  showModal({ title: t('prep.title', { n: state.day }), body, buttons: [
    { label: t('prep.start'), primary: true, onClick: onStart }, { label: t('prep.later') },
  ] });
  document.querySelector<HTMLButtonElement>('.modal-actions .pixel-btn')?.setAttribute('data-start', '');
  render();
}
