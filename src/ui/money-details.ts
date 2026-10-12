import { formatExactMoney } from '../game/format';
import { t } from '../i18n';
import { showModal } from './modal';

/** A real button opens this dialog, including when the purchase is disabled. */
export function showMoneyDetails(balance: number, price?: number): void {
  const body = document.createElement('div');
  body.className = 'money-detail-body';
  const lines = [t('money.balance', { money: formatExactMoney(balance) })];
  if (price !== undefined) {
    lines.unshift(t('money.price', { money: formatExactMoney(price) }));
    if (price > balance) lines.push(t('money.shortfall', { money: formatExactMoney(price - balance) }));
  }
  lines.push(t('money.precision'));
  for (const text of lines) {
    const line = document.createElement('p');
    line.textContent = text;
    body.append(line);
  }
  showModal({ title: t('money.title'), body, buttons: [{ label: t('settings.back') }] });
}
