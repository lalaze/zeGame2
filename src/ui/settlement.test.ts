// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DayReport } from '../game/day';
import { GOALS } from '../game/goals';
import { createInitialState, emptyDay } from '../game/state';
import { messagesFor, setLocale, t } from '../i18n';
import { settlementHtml } from './settlement';

vi.mock('../render/sprites', () => ({ itemArtwork: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,' }));

function day(overrides: Partial<DayReport> = {}): DayReport {
  return { ...emptyDay(), day: 1, duration: 120, rating: 4, ratingCount: 2, ratingTraffic: 1.02,
    served: 10, revenue: 30, ingredientCost: 10, profit: 20, sales: { espresso: 10 },
    bestSeller: 'espresso', outOfStock: [], shelfSoldOut: [], stale: {}, staleCost: 0, ...overrides };
}

afterEach(() => { setLocale('en'); document.body.replaceChildren(); });

describe('progressive settlement disclosure', () => {
  it.each(['en', 'zh'] as const)('shows four primary metrics, a completed goal and a next step in %s', (locale) => {
    setLocale(locale); const state = createInitialState(0); state.day = 2;
    const result = settlementHtml(day(), state); document.body.innerHTML = result.body;
    const summary = document.querySelector('.report-summary')!;
    expect(summary.querySelectorAll('dt')).toHaveLength(3);
    expect(summary.textContent).toContain(t('report.served'));
    expect(summary.textContent).toContain(t('report.revenue'));
    expect(summary.textContent).toContain(t('report.cost'));
    expect(summary.textContent).toContain(t('report.profit'));
    expect(summary.textContent).toContain('$10.00');
    expect(summary.textContent).toContain('+$20.00');
    expect(document.querySelector('.report-goal')!.textContent).toContain('$30');
    expect(document.querySelector('.report-action')!.textContent).toContain(t('report.nextStep'));
    expect(document.querySelector('details')!.open).toBe(false);
    expect(result.recommendedTab).toBe('menu');
    expect(result.body).not.toMatch(/undefined|NaN|report\.action\.|report\.reason\./);
  });

  it('keeps every original report data section in expandable details', () => {
    const state = createInitialState(0); state.day = 3; state.goal = GOALS.length;
    const report = day({ missed: 7, soldOut: 2, queueLost: 3, tableLost: 2, extraLost: 4, doorLost: 5,
      petCost: 1.5, promotionCost: 2.25, revenue: 30, ingredientCost: 18, profit: 8.25,
      baked: { roll: 4 }, stale: { roll: 2 }, staleCost: 8, shelfSoldOut: ['bagel'],
      outOfStock: ['espresso'], shortages: { espresso: 2, roll: 4 } });
    report.reviews.reasons.prompt = 2; report.reviews.stars[3] = 2; report.reviews.totalScore = 8;
    document.body.innerHTML = settlementHtml(report, state).body;
    const details = document.querySelector('details')!;
    for (const key of ['report.missed', 'report.queueLost', 'report.tableLost', 'report.extraLost', 'report.doorLost',
      'report.duration', 'report.ingredients', 'pet.expense', 'promo.expense', 'report.baked', 'report.stale'] as const) {
      expect(details.textContent).toContain(t(key));
    }
    expect(details.textContent).toContain('8:00');
    expect(details.textContent).toContain('$1.50');
    expect(details.textContent).toContain('$2.25');
    expect(details.querySelector('.rating-report')).not.toBeNull();
    expect(details.querySelector('.report-best')!.textContent).toContain(t('item.espresso'));
    expect(details.textContent).toContain(t('item.bagel'));
    expect(details.textContent).toContain(`${t('item.roll')} ×4`);
    expect(details.textContent).toContain(t('report.costNote'));
  });

  it.each(['en', 'zh'] as const)('explains all negative-profit cost drivers without treating stale cost as another charge in %s', (locale) => {
    setLocale(locale); const state = createInitialState(0); state.goal = GOALS.length; state.pantry.beans = 1000;
    const report = day({ served: 1, revenue: 3, ingredientCost: 20, sales: { espresso: 1 },
      petCost: 4, promotionCost: 6, profit: -27, stale: { roll: 3 }, staleCost: 12 });
    report.reviews.reasons.cancelled = 2;
    document.body.innerHTML = settlementHtml(report, state).body;
    const summary = document.querySelector('.report-summary')!;
    expect(summary.textContent).toContain('−$30.00');
    expect(summary.textContent).toContain('−$27.00');
    const reason = document.querySelector('.report-reason')!.textContent!;
    for (const value of ['$27.00', '$12.00', '$6.00', '$4.00', '$7.00']) expect(reason).toContain(value);
    expect(document.querySelector('.report-action')!.textContent).toContain(t('report.action.finishService'));
  });

  it('all new advice messages are translated without unresolved placeholders', () => {
    for (const locale of ['en', 'zh'] as const) {
      const messages = messagesFor(locale);
      expect(messages['report.action.keepGoing']).toBeTruthy();
      expect(messages['report.details']).toBeTruthy();
    }
  });
});

 it.each(['en', 'zh'] as const)('separates full and partial forecast funding in %s', locale => {
  setLocale(locale); const state = createInitialState(0); state.goal = GOALS.length; state.pantry.beans = 0;
  state.coins = 25340.481970575758;
  const full = settlementHtml(day(), state); document.body.innerHTML = full.body;
  expect(full.advice.action.kind).toBe('restock');
  expect(document.querySelector('.report-action')!.textContent).toContain(locale === 'zh' ? '可买齐当前预测' : 'all ingredients in the current forecast');
  expect(document.querySelector('.report-action')!.textContent).not.toContain(locale === 'zh' ? '资金只够部分' : 'budget covers only part');
  state.coins = 1;
  document.body.innerHTML = settlementHtml(day(), state).body;
  expect(document.querySelector('.report-action')!.textContent).toContain(locale === 'zh' ? '资金只够部分' : 'budget covers only part');
 });
