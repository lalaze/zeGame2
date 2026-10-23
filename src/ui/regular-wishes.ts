import { menuItems, readyServings } from '../game/economy';
import { chooseMinaWish, displayMinaMap, isMinaWishDrink, minaWish, minaWishAvailable, setMinaWishPaused } from '../game/regular-wishes';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { paintMinaMap } from '../render/regular-wish-art';
import { displayItemName } from './item-name';
import { trialSaleItem, trialSaleRemaining } from '../game/trial-sales';
import { isDrink } from '../game/data';

const text = <K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') => {
  const el = document.createElement(tag); el.textContent = value; el.className = className; return el;
};

/** The same optional wish lives in preparation and Mina's existing journal card. */
export function regularWishCard(state: GameState, onChange: () => void, compact = false): HTMLElement | null {
  if (!minaWishAvailable(state)) return null;
  const root = document.createElement('section');
  root.className = 'regular-wish'; root.dataset.regularWish = 'mina';
  const render = () => {
    const focused = root.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
    const expanded = root.querySelector<HTMLDetailsElement>('.wish-plan')?.open;
    root.replaceChildren();
    const wish = minaWish(state);
    root.append(text('h3', t(wish?.completedDay ? 'wish.mina.map.title' : 'wish.mina.title')));
    const action = (label: string, key: string, change: () => boolean, disabled = false) => {
      const b = text('button', label, 'pixel-btn small ghost'); b.type = 'button';
      b.dataset.focus = `wish-${key}`; b.dataset.wishAction = key; b.disabled = disabled;
      b.addEventListener('click', () => {
        if (!root.isConnected || !b.isConnected || !change()) return;
        if (key === 'quiet' || key === 'milky') {
          const plan = root.querySelector<HTMLDetailsElement>('.wish-plan');
          if (plan) { plan.open = false; plan.querySelector('summary')?.focus(); }
        }
        onChange();
        if (root.isConnected) render();
      });
      return b;
    };
    if (wish?.completedDay) {
      if (compact) {
        root.append(text('p', t('wish.mina.map.short'), 'note'));
        return;
      }
      const art = document.createElement('canvas'); art.width = 124; art.height = 76;
      art.className = 'wish-map'; art.setAttribute('role', 'img'); art.setAttribute('aria-label', t('wish.mina.map.alt'));
      const ctx = art.getContext('2d');
      if (ctx) { ctx.scale(4, 4); paintMinaMap(ctx, 0, 0, wish.choice); }
      root.append(art, text('p', t(`wish.mina.memory.${wish.choice}`)), text('p', t('wish.mina.map.date', { day: wish.completedDay }), 'note'));
      root.append(action(t(wish.displayed ? 'wish.mina.map.hide' : 'wish.mina.map.show'), 'map', () => displayMinaMap(state, !wish.displayed)));
      root.append(text('p', t(wish.displayed ? 'wish.mina.map.hanging' : 'wish.mina.map.stored'), 'note'));
    } else if (wish?.rehearsedDay) {
      if (!compact) root.append(text('p', t(`wish.mina.rehearsed.${wish.choice}`)));
      root.append(text('p', t('wish.mina.return'), 'note'));
    } else {
      if (!wish) root.append(text('p', t(compact ? 'wish.mina.askShort' : 'wish.mina.ask')));
      else {
        root.append(text('p', t(wish.paused ? 'wish.mina.paused' : compact ? `wish.mina.planShort.${wish.choice}` : `wish.mina.plan.${wish.choice}`)));
        if (!wish.paused && wish.choice === 'milky') {
          const drink = menuItems(state).find(item => isMinaWishDrink(item.id) && readyServings(state, item.id) >= 1);
          const trial = trialSaleItem(state);
          const trialReady = trial && isMinaWishDrink(trial) && trialSaleRemaining(state) > 0 && readyServings(state, trial) >= 1
            && menuItems(state).some(item => isDrink(item.category));
          root.append(text('p', trialReady ? t('trial.minaReady', { drink: displayItemName(trial, state) })
            : drink ? t('wish.mina.milky.ready', { drink: displayItemName(drink.id, state) }) : t('wish.mina.milky.missing'), 'note'));
        }
      }
      const plan = document.createElement('details'); plan.className = 'wish-plan';
      plan.open = expanded ?? false;
      const summary = text('summary', t(wish ? 'wish.mina.change' : 'wish.mina.arrange'));
      summary.dataset.focus = 'wish-plan';
      plan.append(summary);
      for (const choice of ['quiet', 'milky'] as const) {
        const option = document.createElement('div'); option.className = 'wish-option';
        const b = action(t(`wish.mina.choice.${choice}`), choice, () => chooseMinaWish(state, choice), state.phase !== 'prep');
        b.setAttribute('aria-pressed', String(wish?.choice === choice && !wish.paused));
        option.append(b, text('p', t(`wish.mina.plan.${choice}`), 'note'));
        plan.append(option);
      }
      root.append(plan);
      if (wish) root.append(action(t(wish.paused ? 'wish.mina.resume' : 'wish.mina.pause'), 'pause', () => setMinaWishPaused(state, !wish.paused), state.phase !== 'prep'));
      root.append(text('p', t(state.phase !== 'prep' ? 'wish.mina.closedOnly' : compact ? 'wish.mina.optionalShort' : 'wish.mina.optional'), 'note'));
    }
    if (focused) root.querySelector<HTMLElement>(`[data-focus="${focused}"]`)?.focus({ preventScroll: true });
  };
  render();
  return root;
}

/** A factual daily recap; missed opportunities have no deadline or penalty. */
export function regularWishReportHtml(state: GameState, day: number): string {
  const wish = minaWish(state);
  if (!wish || wish.paused) return '';
  const map = wish.completedDay === day;
  const practiced = wish.rehearsedDay === day;
  if (!map && !practiced && wish.rehearsedDay !== null) return '';
  const body = map ? t(`wish.mina.memory.${wish.choice}`) : practiced ? t(`wish.mina.rehearsed.${wish.choice}`) : t('wish.mina.retry');
  const next = map ? t(wish.displayed ? 'wish.mina.map.hanging' : 'wish.mina.map.stored') : practiced ? t('wish.mina.return') : t('wish.mina.optional');
  return `<section class="report-wish"><h3>${t(map ? 'wish.mina.map.title' : 'wish.mina.title')}</h3><p>${body}</p><p class="note">${next}</p></section>`;
}
