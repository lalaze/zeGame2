import { formatExactMoney, formatTransactionMoney } from '../game/format';
import { t } from '../i18n';
import { showModal } from './modal';

/** A real button opens this dialog, including when the purchase is disabled. */
export function showMoneyDetails(balance: number, price?: number): void {
  const body = document.createElement('div');
  body.className = 'money-detail-body';
  const lines = [t('money.balance', { money: formatTransactionMoney(balance) })];
  if (price !== undefined) {
    lines.unshift(t('money.price', { money: formatTransactionMoney(price) }));
    if (price > balance) lines.push(t('money.shortfall', { money: formatTransactionMoney(price - balance) }));
  }
  lines.push(t('money.precision'));
  for (const text of lines) {
    const line = document.createElement('p');
    line.textContent = text;
    body.append(line);
  }
  const details = document.createElement('details');
  details.className = 'money-exact-details';
  const summary = document.createElement('summary');
  summary.textContent = t('money.fullPrecision');
  details.append(summary);
  const exact = [t('money.balance', { money: formatExactMoney(balance) })];
  if (price !== undefined) {
    exact.unshift(t('money.price', { money: formatExactMoney(price) }));
    if (price > balance) exact.push(t('money.shortfall', { money: formatExactMoney(price - balance) }));
  }
  for (const text of exact) {
    const line = document.createElement('p'); line.textContent = text; details.append(line);
  }
  body.append(details);
  showModal({ title: t('money.title'), body, buttons: [{ label: t('settings.back') }] });
}
