import { DAY_SECONDS, type IngredientId } from '../game/data';
import { restock, restockPlan, hasServiceSupply } from '../game/economy';
import { formatTransactionMoney as money } from '../game/format';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { ingredientName } from './panel';
import { showModal } from './modal';

/** The decision happens before settlement, while the day's clock and ledger are retained. */
export function showSoldOut(state: GameState, resume: () => void, finish: () => void): void {
  const plan = restockPlan(state);
  const projected = { ...state, pantry: { ...state.pantry } };
  for (const [id, n] of Object.entries(plan.buy)) projected.pantry[id as IngredientId] += n!;
  const canResume = plan.cost > 0 && state.dayTime < DAY_SECONDS && hasServiceSupply(projected);
  const body = document.createElement('div');
  const add = (text: string) => { const p = document.createElement('p'); p.textContent = text; body.append(p); };
  const names = (items: typeof plan.buy) => Object.entries(items).map(([id, n]) => `${ingredientName(id as IngredientId)} ×${n}`).join(t('list.sep'));
  add(t('soldout.body'));
  add(t('pantry.plan', { items: names(plan.buy) || t('prep.noPurchase'), balance: money(plan.balance) }));
  if (plan.missingCost > 0) add(t('pantry.unmet', { items: names(plan.missing), price: money(plan.missingCost) }));
  if (!canResume) add(t('soldout.noBudget'));
  showModal({ title: t('soldout.title'), body, buttons: [
    { label: t('soldout.resume', { price: money(plan.cost) }), primary: true, disabled: !canResume, onClick: () => {
      if (restock(state)) resume();
    } },
    { label: t('soldout.finish'), onClick: finish },
  ] });
}
