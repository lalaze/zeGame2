import './prepare-polish.css';
import { prepDemandHtml, dishDemandHtml } from './customer-demand';
import { regularWishCard } from './regular-wishes';
import { trialSaleCard } from './trial-sales';
import { showSignatureDrinks } from './signature-drinks';
import { canEmergencyRestock, emergencyRestock } from '../game/recovery';
import { promotionPlan } from '../game/promotion';
import { forecastPetTraffic } from '../game/pets';
import { BAKE_STEP, type IngredientId, type ItemId } from '../game/data';
import { checkOpen } from '../game/day';
import { averageDishPrice, canPrepareItem, bakeForForecast, dayDemand, expectedCustomers, isBakery, menuItems, readyServings, recipe, restock, restockQuote, restockPlan, setBakePlan, setOnMenu, suggestedBake, unlockedItems } from '../game/economy';
import { reputationTraffic } from '../game/reputation';
import { trafficPercent } from './reputation';
import { kitchenLoad } from '../game/kitchen';
import { formatTransactionMoney as formatMoney, formatNumber } from '../game/format';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { tasteLabel } from './taste';
import { itemArtwork, toDataURL } from '../render/sprites';
import { showModal } from './modal';
import { cafeStyleName, prepStyleSummary, showCafeStyles } from './cafe-styles';
import { ingredientName, itemName } from './panel';
import { dishConditionHtml } from './conditions';

export function showPrepare(state: GameState, onStart: () => void, onChange: () => void): void {
  const body = document.createElement('div');
  body.className = 'prep';
  // Outside the scrolling menu: the stock decision stays beside opening day.
  const stockFooter = document.createElement('section');
  stockFooter.className = 'prep-stock-footer';
  const scope = () => body.closest<HTMLElement>('.modal');
  let receipt = '';
  let delayedRender: number | null = null;
  let needsRender = false;
  const heldPointers = new Set<number>();
  const scheduleRender = () => {
    needsRender = true;
    if (delayedRender !== null) cancelAnimationFrame(delayedRender);
    delayedRender = null;
    if (heldPointers.size) return;
    delayedRender = requestAnimationFrame(() => {
      delayedRender = null;
      if (needsRender && body.isConnected) render();
    });
  };
  const releasePointer = (event: PointerEvent | Event) => {
    if (event.type === 'blur') heldPointers.clear();
    else heldPointers.delete((event as PointerEvent).pointerId);
    if (heldPointers.size) return;
    window.removeEventListener('pointerup', releasePointer, true);
    window.removeEventListener('pointercancel', releasePointer, true);
    window.removeEventListener('blur', releasePointer);
    if (needsRender) scheduleRender();
  };
  const holdPointer = (event: PointerEvent) => {
    heldPointers.add(event.pointerId);
    window.addEventListener('pointerup', releasePointer, true);
    window.addEventListener('pointercancel', releasePointer, true);
    window.addEventListener('blur', releasePointer);
    if (needsRender) scheduleRender();
  };
  body.addEventListener('pointerdown', holdPointer);
  stockFooter.addEventListener('pointerdown', holdPointer);
  const render = () => {
    needsRender = false;
    if (delayedRender !== null) { cancelAnimationFrame(delayedRender); delayedRender = null; }
    const scroller = body.closest<HTMLElement>('.modal-body');
    const scrollTop = scroller?.scrollTop ?? 0;
    const focus = document.activeElement?.getAttribute('data-focus');
    const detailsOpen = body.querySelector<HTMLDetailsElement>('.prep-details')?.open ?? false;
    const demandOpen = body.querySelector<HTMLDetailsElement>('.demand-details')?.open ?? false;
    const wishOpen = body.querySelector<HTMLDetailsElement>('.wish-plan')?.open;
    const optionalStyleOpen = body.querySelector<HTMLDetailsElement>('.prep-optional-style')?.open ?? false;
    const optionalWishOpen = body.querySelector<HTMLDetailsElement>('.prep-optional-wish')?.open ?? false;
    const trialHistoryOpen = body.querySelector<HTMLDetailsElement>('.trial-history')?.open ?? false;
    const demand = dayDemand(state);
    const onMenu = new Set(menuItems(state).map((m) => m.id));
    const available = unlockedItems(state);
    const sharedIngredients = new Map<IngredientId, number>();
    for (const item of menuItems(state).filter(item => !isBakery(item.id))) {
      for (const [ingredient] of recipe(item.id)) sharedIngredients.set(ingredient, (sharedIngredients.get(ingredient) ?? 0) + 1);
    }
    const shared = [...sharedIngredients].filter(([, count]) => count > 1)
      .map(([id]) => `${ingredientName(id)} ×${formatNumber(state.pantry[id])}`).join(t('list.sep'));
    const hasBakery = available.some((m) => canPrepareItem(state, m.id) && isBakery(m.id));
    const check = checkOpen(state);
    const low = new Set<ItemId>(!check.ok && check.reason === 'lowStock' ? check.items : []);
    const rows = available.map((m) => {
      const eligible = canPrepareItem(state, m.id);
      const on = onMenu.has(m.id);
      const ready = readyServings(state, m.id);
      const bake = eligible && isBakery(m.id) ? `<div class="bake">
        <button class="chip bake-btn" data-focus="minus-${m.id}" data-bake="${m.id}:-1" aria-label="${itemName(m.id, state)} −${BAKE_STEP}" ${on ? '' : 'disabled'}>−${BAKE_STEP}</button>
        <input class="bake-input" data-focus="amount-${m.id}" data-amount="${m.id}" type="number" min="0" max="9999" step="1" value="${state.bakePlan[m.id] ?? 0}" aria-label="${itemName(m.id, state)} · ${t('bake.label')}" ${on ? '' : 'disabled'} />
        <button class="chip bake-btn" data-focus="plus-${m.id}" data-bake="${m.id}:1" aria-label="${itemName(m.id, state)} +${BAKE_STEP}" ${on ? '' : 'disabled'}>+${BAKE_STEP}</button>
        <small>${t('bake.suggested', { n: suggestedBake(state, m.id) })}</small>
      </div>` : '';
      const note = !eligible ? t('menu.requiresKitchen') : on ? isBakery(m.id) ? t('bake.forecast', { n: Math.ceil(demand.get(m.id) ?? 0) }) : t('prep.onlyDrinkStock', { n: formatNumber(ready) }) : t('menu.off');
      const ingredients = eligible && !isBakery(m.id) ? `<small class="prep-recipe">${t('prep.drinkIngredients', {
        items: recipe(m.id).map(([id, n]) => `${ingredientName(id)} ×${n}`).join(t('list.sep')),
      })}</small>` : '';
      return `<div class="prep-row${on ? '' : ' off'}${on && low.has(m.id) ? ' low' : ''}">
        <label class="prep-select"><input type="checkbox" data-focus="dish-${m.id}" data-dish="${m.id}" ${on ? 'checked' : ''} ${eligible ? '' : 'disabled'} />
        <img src="${toDataURL(itemArtwork(m.id), 1)}" alt="" /><span class="prep-name"><b>${itemName(m.id, state)}</b><small>${note}</small>${ingredients}<small>${tasteLabel(state, m.id)}</small>${eligible ? dishConditionHtml(state, m.id) + dishDemandHtml(state, m) : ''}</span></label>${bake}</div>`;
    }).join('');
    const quote = restockQuote(state);
    const plan = restockPlan(state);
    const shopping = Object.entries(plan.buy).map(([id, n]) => `${ingredientName(id as keyof GameState['pantry'])} ×${n}`).join(t('list.sep'));
    const full = quote.cost <= 0;
    const missing = Object.entries(quote.buy).map(([id, n]) => `${ingredientName(id as keyof GameState['pantry'])} ×${n}`).join(t('list.sep'));
    const starterStock = state.day === 1 && state.totalEarned === 0 && full
      && onMenu.size === 1 && onMenu.has('espresso') && readyServings(state, 'espresso') > 0;
    body.innerHTML = `<p class="prep-menu-hint">${t('prep.menuHint')}</p>
      ${starterStock ? `<p class="note prep-starter">${t('prep.starterStock', { n: formatNumber(readyServings(state, 'espresso')) })}</p>` : ''}
      ${hasBakery ? `<p class="note prep-bakery-hint">${t('prep.bakeryHint')}</p>` : ''}
      ${shared ? `<p class="note prep-shared-stock">${t('prep.sharedStock', { items: shared })}</p>` : ''}
      ${prepDemandHtml(state, menuItems(state))}
      <div class="prep-list">${rows}</div>
      ${onMenu.size > 1 ? `<p class="note prep-average">${t('prep.average', { price: formatMoney(averageDishPrice(state)) })}</p>` : ''}
      ${onMenu.size === 0 ? `<p class="note warn prep-empty-menu" id="prep-empty-menu">${t('prep.emptyMenu')}</p>` : ''}
      ${hasBakery ? `<button class="pixel-btn small ghost" data-focus="forecast" data-forecast ${[...onMenu].some(isBakery) ? '' : 'disabled'}>${t('bake.all')}</button>` : ''}
      ${kitchenLoad(state) > 1 ? `<p class="note warn">${t('prep.capacity')}</p>` : ''}
      ${low.size ? `<p class="note warn">${t('prep.low')} ${[...low].map((id) => itemName(id, state)).join(t('list.sep'))} ${t('prep.lowNext')}</p>` : ''}
      ${missing ? `<p class="note">${t('prep.missing', { items: missing })}</p>` : ''}
      ${!full ? `<p class="note restock-preview">${t('pantry.plan', { items: shopping || t('prep.noPurchase'), balance: formatMoney(plan.balance) })}</p>${plan.missingCost > 0 ? `<p class="note warn">${t('pantry.unmet', { items: Object.entries(plan.missing).map(([id, n]) => `${ingredientName(id as keyof GameState['pantry'])} ×${n}`).join(t('list.sep')), price: formatMoney(plan.missingCost) })}</p>` : ''}` : ''}
      ${canEmergencyRestock(state) ? `<p class="note warn">${t('prep.emergencyHint')}</p><button class="pixel-btn small" data-focus="emergency" data-emergency-restock>${t('prep.emergency')}</button>` : ''}
      <p class="note" role="status">${receipt}</p>
      <button class="pixel-btn small ghost signature-entry" data-signature-research>${t('signature.entry')}</button>
      <div class="prep-optional"></div>
      <details class="prep-details" ${detailsOpen ? 'open' : ''}>
        <summary data-focus="forecast-details">${t('prep.details')}</summary>
        <p class="note">${t('pantry.forecast', { n: formatNumber(expectedCustomers(state)) })}</p>
        <p class="note">${t('prep.forecastHint')}</p>
        <p class="note">${t('prep.sharedIngredients')}</p>
        <p class="note">${t('rating.prep', { pct: trafficPercent(reputationTraffic(state.reputation)) })}</p>
        ${state.promotion ? `<p class="note">${t(state.promotion.paused ? 'promo.prepPaused' : 'promo.prep', { pct: Math.round(promotionPlan(state.promotion.id)!.boost * 100), seconds: Math.ceil(state.promotion.remaining) })}</p>` : ''}
        ${state.pets.length ? `<p class="note">${t('pet.forecast', { pct: Math.round((forecastPetTraffic(state) - 1) * 100) })}</p>` : ''}
        ${hasBakery ? `<p class="note">${t('prep.kitchen')}</p>` : ''}
      </details>`;
    const demandDetails = body.querySelector<HTMLDetailsElement>('.demand-details');
    if (demandDetails) demandDetails.open = demandOpen;
    const optional = body.querySelector<HTMLElement>('.prep-optional')!;
    const fold = (className: string, label: string, content: HTMLElement, expanded: boolean) => {
      const details = document.createElement('details'); details.className = `prep-disclosure ${className}`; details.open = expanded;
      const summary = document.createElement('summary'); summary.textContent = label; summary.dataset.focus = className;
      details.append(summary, content); optional.append(details);
    };
    fold('prep-optional-style', t('style.prep.current', { name: cafeStyleName(state.cafeStyle.focus) }),
      prepStyleSummary(state, () => showCafeStyles(state, onChange, () => showPrepare(state, onStart, onChange))), optionalStyleOpen);
    const wish = regularWishCard(state, () => { onChange(); render(); }, true);
    if (wish) fold('prep-optional-wish', wish.querySelector('h3')?.textContent ?? t('wish.mina.title'), wish, optionalWishOpen);
    const wishPlan = wish?.querySelector<HTMLDetailsElement>('.wish-plan');
    if (wishPlan && wishOpen !== undefined) wishPlan.open = wishOpen;
    const trial = trialSaleCard(state, () => { onChange(); render(); });
    if (trial) body.querySelector('.prep-list')?.after(trial);
    const trialHistory = trial?.querySelector<HTMLDetailsElement>('.trial-history');
    if (trialHistory) trialHistory.open = trialHistoryOpen;
    const missingParts = Object.entries(quote.buy).map(([id, n]) => `${ingredientName(id as IngredientId)} ×${n}`);
    const firstMissing = missingParts.slice(0, 2).join(t('list.sep'));
    const compactMissing = missingParts.length > 2 ? t('prep.stockMore', { items: firstMissing, n: missingParts.length - 2 }) : firstMissing;
    const stockSummary = onMenu.size === 0 ? t('prep.emptyMenu') : full ? '' : t('prep.stockMissingShort', { items: compactMissing });
    stockFooter.innerHTML = `${stockSummary ? `<p class="prep-stock-summary${!full ? ' warn' : ''}">${stockSummary}</p>` : ''}
      ${onMenu.size ? `<button type="button" class="pixel-btn small${full ? ' ghost' : ''}" data-focus="restock" data-restock ${full || plan.cost <= 0 ? 'disabled' : ''}
        aria-label="${full ? t('pantry.full') : t(plan.missingCost > 0 ? 'pantry.budgetRestock' : 'pantry.restock', { price: formatMoney(plan.cost) })}">
        ${full ? t('prep.stockReadyShort') : t(plan.missingCost > 0 ? 'prep.budgetAction' : 'prep.restockAction', { price: formatMoney(plan.cost) })}</button>` : ''}`;
    stockFooter.classList.toggle('stock-ready', full && onMenu.size > 0);
    const start = scope()?.querySelector<HTMLButtonElement>('.modal-actions [data-start]');
    if (start) {
      start.disabled = onMenu.size === 0;
      if (start.disabled) start.setAttribute('aria-describedby', 'prep-empty-menu');
      else start.removeAttribute('aria-describedby');
    }
    if (focus) {
      const same = scope()?.querySelector<HTMLElement>(`[data-focus="${focus}"]`);
      const next = same && !same.matches(':disabled') ? same
        : body.querySelector<HTMLElement>('[data-focus="dish-espresso"]:not(:disabled), [data-dish]:not(:disabled)');
      next?.focus({ preventScroll: true });
    }
    if (scroller) scroller.scrollTop = scrollTop;
  };
  body.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.dish) setOnMenu(state, input.dataset.dish as ItemId, input.checked);
    else if (input.dataset.amount) setBakePlan(state, input.dataset.amount as ItemId, Number(input.value));
    else return;
    receipt = ''; onChange();
    // A number field emits change while it is blurring. Replacing it during that
    // event interrupts native Tab/click focus navigation. Commit now, redraw after
    // the browser has focused the next control, and preserve that control/scroll.
    if (input.dataset.amount && document.activeElement !== input) {
      // A held pointer must keep its original target until pointerup/click.
      // Release schedules a frame; the normal click can render and cancel it first.
      scheduleRender();
    } else render();
  });
  const handleAction = (e: Event) => {
    if (!body.isConnected || state.phase !== 'prep') return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-signature-research]')) { showSignatureDrinks(state, onChange, () => showPrepare(state, onStart, onChange)); return; }
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
    } else if (target.closest('button[data-emergency-restock]')) {
      receipt = emergencyRestock(state) ? t('prep.emergencyReceived') : t('prep.emergencyUnavailable');
    } else return;
    onChange(); render();
  };
  body.addEventListener('click', handleAction);
  stockFooter.addEventListener('click', handleAction);
  showModal({ title: t('prep.title', { n: state.day }), body, buttons: [
    { label: t('prep.start'), primary: true, disabled: menuItems(state).length === 0, onClick: onStart }, { label: t('prep.later') },
  ] });
  const modal = scope()!;
  modal.classList.add('prep-modal');
  const actions = modal.querySelector<HTMLElement>('.modal-actions')!;
  actions.before(stockFooter);
  actions.querySelector<HTMLButtonElement>('.pixel-btn')?.setAttribute('data-start', '');
  render();
}
