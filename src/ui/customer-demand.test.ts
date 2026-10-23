// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showPrepare } from './prepare';
import { closeModal } from './modal';
import { prepDemandHtml, demandReportHtml, tomorrowDemandHtml } from './customer-demand';
import { createInitialState, emptyDay } from '../game/state';
import { finishDay } from '../game/day';
import { menuItems } from '../game/economy';
import { conditionOn } from '../game/conditions';
import { GUEST_KINDS } from '../game/customer-demand';
import { messagesFor, setLocale, t } from '../i18n';

vi.mock('../render/sprites', () => ({ itemArtwork: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,' }));
beforeEach(() => { document.body.innerHTML = '<div id="modal-root"></div>'; });
afterEach(() => { closeModal(); document.body.replaceChildren(); setLocale('en'); });

function cafe() {
  const state = createInitialState(0);
  state.day = 3;
  state.coins = 1000;
  state.items.latte = 1;
  while (conditionOn(state, state.day) !== 'rain') state.day++;
  return state;
}

describe('customer demand in preparation and settlement', () => {
  it.each(['en', 'zh'] as const)('shows one compact weather/audience card and updates it when the menu changes in %s', locale => {
    setLocale(locale);
    const state = cafe();
    showPrepare(state, vi.fn(), vi.fn());
    expect(document.querySelectorAll('.prep-condition')).toHaveLength(1);
    expect(document.querySelector('.prep-demand')!.textContent).toContain(t('condition.rain.name'));
    const before = document.querySelector('.demand-match')!.textContent;
    expect(before).toContain(t('demand.kind.commuter'));
    expect(before).not.toContain(t('demand.kind.leisure'));
    const details = document.querySelector<HTMLDetailsElement>('.demand-details')!;
    expect(details.open).toBe(false);
    details.open = true;
    const latte = document.querySelector<HTMLInputElement>('[data-dish="latte"]')!;
    latte.checked = true; latte.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('.demand-match')!.textContent).toContain(t('demand.kind.leisure'));
    expect(document.querySelector<HTMLDetailsElement>('.demand-details')!.open).toBe(true);
    expect(document.querySelectorAll('.demand-group')).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(/undefined|NaN|demand\.[a-z]/);
  });

  it('keeps the first two days simple and explains an empty menu without fictional visitors', () => {
    const state = cafe();
    for (const day of [1, 2]) expect(prepDemandHtml({ ...state, day }, menuItems(state))).toBe('');
    document.body.innerHTML = prepDemandHtml(state, []);
    expect(document.body.textContent).toContain(t('demand.empty'));
    expect(document.querySelectorAll('.demand-group')).toHaveLength(0);
    expect(tomorrowDemandHtml(state, 1)).toBe('');
    expect(tomorrowDemandHtml(state, 2)).toContain(t('demand.tomorrow'));
  });

  it.each(['en', 'zh'] as const)('reports only observed visits and delivered pairings in %s', locale => {
    setLocale(locale);
    const state = cafe();
    state.today = emptyDay();
    Object.assign(state.today.guests.leisure, { arrived: 8, served: 4, paired: 2, stockLost: 1, waitLost: 1, cancelled: 1, dismissed: 1, revenue: 52 });
    const report = finishDay(state);
    document.body.innerHTML = demandReportHtml(report);
    expect(document.querySelectorAll('.demand-group')).toHaveLength(1);
    expect(document.body.textContent).toContain(t('demand.results', { arrived: 8, served: 4, paired: 2, money: '$52.00' }));
    expect(document.body.textContent).toContain(t('demand.losses', { stock: 1, wait: 1 }));
    expect(document.body.textContent).toContain(t('demand.closed', { cancelled: 1, dismissed: 1 }));
    expect(document.body.textContent).toContain(t('demand.observedOnly'));
    expect(document.body.textContent).not.toMatch(/undefined|NaN|\{\w+\}/);
  });

  it('provides the same complete demand vocabulary in both languages', () => {
    const en = messagesFor('en'), zh = messagesFor('zh');
    const keys = Object.keys(en).filter(key => key.startsWith('demand.'));
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) expect(zh).toHaveProperty([key]);
    for (const kind of GUEST_KINDS) expect(en).toHaveProperty([`demand.kind.${kind}`]);
  });
});
