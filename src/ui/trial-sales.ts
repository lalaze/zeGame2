import { menuItems, prepTime, promoteTrialSale, readyServings, salePrice, servingCost, unlockedItems } from '../game/economy';
import { canTrialDrink, selectTrialSale, trialHeldForMina, trialSaleItem, TRIAL_SALE_LIMIT, type TrialSaleReport } from '../game/trial-sales';
import { MAX_SIGNATURE_MENU } from '../game/signature-drinks';
import type { GameState } from '../game/state';
import { formatAccountMoney } from '../game/format';
import { t } from '../i18n';
import { displayItemName } from './item-name';
import { isDrink } from '../game/data';

const text = <K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') => {
  const el = document.createElement(tag); el.textContent = value; el.className = className; return el;
};
const trialName = (s: GameState, report: TrialSaleReport) => report.name || displayItemName(report.item, s);

/** Results stay available after the settlement closes, including a removed recipe's name. */
export function trialResultCard(s: GameState, onChange: () => void, report = s.trialSales.last): HTMLElement | null {
  if (!report) return null;
  report = structuredClone(report);
  const root = document.createElement('section'); root.className = 'trial-result';
  const render = () => {
    const focus = root.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
    root.replaceChildren();
    const heading = text('h3', t('trial.result.title', { day: report.day, item: trialName(s, report) })); heading.tabIndex = -1;
    root.append(heading, text('p', t('trial.result.cups', { prepared: report.prepared, served: report.served, limit: TRIAL_SALE_LIMIT })));
    root.append(text('p', t('trial.result.money', {
      revenue: formatAccountMoney(report.revenue), cost: formatAccountMoney(report.ingredientCost), profit: formatAccountMoney(report.revenue - report.ingredientCost),
    })));
    if (report.prepared > report.served) root.append(text('p', t('trial.result.waste', { n: report.prepared - report.served }), 'note'));
    root.append(text('p', report.served ? t('trial.result.feedback', report.feedback) : t('trial.result.noFeedback')));
    if (report.served) root.append(text('p', t('trial.result.practice', { n: report.served, before: report.qualityBefore.toFixed(1), after: report.qualityAfter.toFixed(1) }), 'note'));
    root.append(text('p', t('trial.result.costNote'), 'note'));
    const current = s.phase === 'prep' && s.trialSales.last?.day === report.day && s.trialSales.last.item === report.item;
    const available = canTrialDrink(s, report.item);
    const onMenu = menuItems(s).some(item => item.id === report.item);
    const selected = trialSaleItem(s) === report.item;
    const customFull = report.item.startsWith('sig:') && s.signatureDrinks.recipes.filter(recipe => recipe.onMenu).length >= MAX_SIGNATURE_MENU;
    const actions = document.createElement('div'); actions.className = 'trial-actions';
    const action = (key: 'repeat' | 'promote', label: string, disabled: boolean, change: () => boolean) => {
      const button = text('button', label, 'pixel-btn small ghost'); button.type = 'button';
      button.dataset.trialAction = key; button.dataset.focus = `trial-${key}`; button.disabled = disabled;
      button.addEventListener('click', () => {
        if (!root.isConnected || !button.isConnected || !current || s.phase !== 'prep'
            || s.trialSales.last?.day !== report.day || s.trialSales.last.item !== report.item || !change()) return;
        onChange();
        if (root.isConnected) render();
      });
      return button;
    };
    actions.append(
      action('repeat', t(selected ? 'trial.repeatSelected' : 'trial.repeat'), !current || !available || selected, () => selectTrialSale(s, report.item)),
      action('promote', t(onMenu ? 'trial.promoted' : 'trial.promote'), !current || !available || customFull, () => promoteTrialSale(s)),
    );
    root.append(actions);
    if (customFull && available) root.append(text('p', t('trial.customFull', { n: MAX_SIGNATURE_MENU }), 'note'));
    else if (!available && !onMenu) root.append(text('p', t('trial.unavailable'), 'note'));
    if (focus) {
      const same = root.querySelector<HTMLButtonElement>(`[data-focus="${focus}"]`);
      (same && !same.disabled ? same : heading).focus({ preventScroll: true });
    }
  };
  render(); return root;
}

export function trialSaleCard(s: GameState, onChange: () => void): HTMLElement | null {
  const choices = unlockedItems(s).filter(item => canTrialDrink(s, item.id));
  if (!choices.length && !s.trialSales.last && !trialSaleItem(s)) return null;
  const root = document.createElement('section'); root.className = 'trial-sales';
  root.append(text('h3', t('trial.title')), text('p', t('trial.intro', { n: TRIAL_SALE_LIMIT }), 'note'));
  const label = text('label', t('trial.choose'));
  const select = document.createElement('select'); select.dataset.trialSelect = ''; select.dataset.focus = 'trial-select';
  select.setAttribute('aria-label', t('trial.choose')); select.disabled = s.phase !== 'prep';
  const option = (name: string, value: string) => {
    const el = text('option', name); el.value = value; return el;
  };
  select.append(option(t('trial.none'), ''));
  for (const item of choices) select.append(option(displayItemName(item.id, s), item.id));
  const selected = trialSaleItem(s); select.value = selected ?? '';
  label.append(select); root.append(label);
  if (!choices.length) root.append(text('p', t('trial.noChoices'), 'note'));
  if (selected) {
    if (!menuItems(s).some(item => isDrink(item.category))) root.append(text('p', t('trial.noDrinks'), 'note warn'));
    root.append(text('p', t('trial.preview', {
      price: formatAccountMoney(salePrice(s, selected)), cost: formatAccountMoney(servingCost(selected)), seconds: prepTime(s, selected).toFixed(1),
    }), 'note'));
    root.append(text('p', t('trial.stock', { n: Math.min(TRIAL_SALE_LIMIT, readyServings(s, selected)), limit: TRIAL_SALE_LIMIT }), 'note'));
    root.append(text('p', t('trial.stockNote', { n: TRIAL_SALE_LIMIT }), 'note'));
    if (trialHeldForMina(s)) root.append(text('p', t('trial.mina'), 'note trial-mina'));
  }
  select.addEventListener('change', () => {
    if (!root.isConnected || !select.isConnected) return;
    const item = choices.find(item => item.id === select.value)?.id ?? null;
    if (selectTrialSale(s, item)) onChange();
  });
  if (s.trialSales.last) {
    const details = document.createElement('details'); details.className = 'trial-history';
    const summary = text('summary', t('trial.last')); summary.dataset.focus = 'trial-history';
    details.append(summary, trialResultCard(s, onChange)!); root.append(details);
  }
  return root;
}
