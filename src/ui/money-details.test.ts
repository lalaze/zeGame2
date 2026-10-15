// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale, t } from '../i18n';
import { closeModal } from './modal';
import { showMoneyDetails } from './money-details';

beforeEach(() => { document.body.innerHTML = '<button id="opener">Amounts</button><div id="modal-root"></div>'; setLocale('en'); });
afterEach(() => { closeModal(); document.body.replaceChildren(); setLocale('en'); });

describe('accessible exact money details', () => {
  it.each(['en', 'zh'] as const)('exposes actual cost, balance and shortage in %s', (locale) => {
    setLocale(locale);
    const opener = document.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    opener.onclick = () => showMoneyDetails(10.03, 10.0352);
    opener.click();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain('$10.0352');
    expect(dialog.textContent).toContain('$10.03');
    expect(dialog.textContent).toContain('$' + String(10.0352 - 10.03));
    expect(dialog.textContent).toContain(t('money.precision'));
    expect(dialog.querySelector('details')!.open).toBe(false);
    expect(dialog.querySelector('.money-detail-body > p')!.textContent).toContain('≈$10.04');
    expect(dialog.contains(document.activeElement)).toBe(true);
    // This unit checks programmatic close; the actual keyboard route is browser QA.
    closeModal();
    expect(document.activeElement).toBe(opener);
  });

  it('supports a balance-only dialog without inventing a price or shortfall', () => {
    showMoneyDetails(57.04);
    const text = document.querySelector('[role="dialog"]')!.textContent;
    expect(text).toContain('Balance: $57.04');
    expect(text).not.toContain('Price:');
    expect(text).not.toContain('Shortfall:');
  });
});
