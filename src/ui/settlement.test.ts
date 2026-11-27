// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { businessElapsedMinutes } from '../game/business-clock';
import { conditionOn } from '../game/conditions';
import type { DayReport } from '../game/day';
import { formatMoney, formatTransactionMoney } from '../game/format';
import { GOALS, claimGoal } from '../game/goals';
import { CHAPTERS, claimChapter } from '../game/milestones';
import { createInitialState, emptyDay, type GameState } from '../game/state';
import { messagesFor, setLocale, t } from '../i18n';
import { closeModal, isModalOpen } from './modal';
import { settlementHtml, showSettlement, topLoss, topSellers } from './settlement';

vi.mock('../render/sprites', () => ({ itemArtwork: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,' }));

function day(overrides: Partial<DayReport> = {}): DayReport {
  return { ...emptyDay(), day: 1, duration: 120, rating: 4, ratingCount: 2, ratingTraffic: 1.02,
    served: 10, revenue: 30, ingredientCost: 10, profit: 20, sales: { espresso: 10 },
    bestSeller: 'espresso', outOfStock: [], shelfSoldOut: [], stale: {}, staleCost: 0, ...overrides };
}

function withReadyChapter(): GameState {
  const s = createInitialState(0);
  s.goal = GOALS.length;
  s.day = 12;
  s.milestones.done = CHAPTERS[0].milestones.map((m) => m.id);
  return s;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="modal-root"></div><div id="toast" hidden></div>';
});

afterEach(() => {
  closeModal();
  setLocale('en');
  document.body.replaceChildren();
});

describe('progressive settlement disclosure', () => {
  it.each(['en', 'zh'] as const)('shows receipt metrics, claim bar and collapsed details with next step in %s', (locale) => {
    setLocale(locale); const state = createInitialState(0); state.day = 2;
    const result = settlementHtml(day(), state); document.body.innerHTML = result.body;
    const summary = document.querySelector('.report-summary')!;
    expect(summary.querySelectorAll('dt')).toHaveLength(3);
    expect(summary.textContent).toContain(t('report.served'));
    expect(summary.textContent).toContain(t('report.revenue'));
    expect(summary.textContent).toContain(t('report.cost'));
    expect(summary.textContent).toContain(t('report.earnedToday'));
    expect(summary.textContent).toContain('$10.00');
    expect(summary.textContent).toContain('+$20.00');
    expect(document.querySelector('.settle-claim')!.textContent).toContain('$30');
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    expect(details.open).toBe(false);
    details.open = true;
    expect(details.querySelector('.report-goal')!.textContent).toContain('$30');
    expect(details.querySelector('.report-action')!.textContent).toContain(t('report.nextStep'));
    expect(details.querySelector('[data-settle-tab]')!.textContent).toBe(t('tab.menu'));
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
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    expect(details.open).toBe(false);
    details.open = true;
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
    expect(summary.textContent).toContain(t('report.lostToday'));
    expect(summary.textContent).toContain('−$30.00');
    expect(summary.textContent).toContain('−$27.00');
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    details.open = true;
    const reason = details.querySelector('.report-reason')!.textContent!;
    for (const value of ['$27.00', '$12.00', '$6.00', '$4.00', '$7.00']) expect(reason).toContain(value);
    expect(details.querySelector('.report-action')!.textContent).toContain(t('report.action.finishService'));
  });

  it.each(['en', 'zh'] as const)('explains on day 1 that the starter beans counted as a cost were free in %s', (locale) => {
    setLocale(locale); const state = createInitialState(0); state.day = 2;
    document.body.innerHTML = settlementHtml(day(), state).body;
    expect(document.querySelector('.report-starter')!.textContent).toBe(t('report.starterNote'));
    document.body.innerHTML = settlementHtml(day({ day: 2 }), state).body;
    expect(document.querySelector('.report-starter')).toBeNull();
  });

  it('shows profit per game minute in cents rather than rounding small amounts to $0', () => {
    const state = createInitialState(0); state.goal = GOALS.length;
    document.body.innerHTML = settlementHtml(day({ profit: 86, revenue: 123, ingredientCost: 37 }), state).body;
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    details.open = true;
    const perMinute = (86 / businessElapsedMinutes(120)).toFixed(2);
    expect(details.textContent).toContain(t('report.perMinute', { money: `$${perMinute}` }));
    expect(perMinute).not.toBe('0.00');
  });

  it.each(['en', 'zh'] as const)('separates stale leftovers of a dish that also sold out from an oversized bake in %s', (locale) => {
    setLocale(locale); const state = createInitialState(0); state.goal = GOALS.length; state.kitchen = true;
    document.body.innerHTML = settlementHtml(day({ shortages: { roll: 3 }, baked: { roll: 32, bagel: 10 }, stale: { roll: 5, bagel: 4 }, staleCost: 36 }), state).body;
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    details.open = true;
    const notes = [...details.querySelectorAll('.note')].map((note) => note.textContent ?? '');
    const short = notes.find((note) => note.includes(t('item.roll')) && note.includes('×5'))!;
    expect(short).toBe(t('report.staleShort', { items: `${t('item.roll')} ×5` }));
    expect(notes).toContain(t('report.staleItems', { items: `${t('item.bagel')} ×4` }));
  });

  it('all new advice and receipt messages are translated without unresolved placeholders', () => {
    for (const locale of ['en', 'zh'] as const) {
      const messages = messagesFor(locale);
      for (const key of [
        'report.action.keepGoing', 'report.details', 'report.closedHeading', 'report.receiptTitle',
        'report.stampGood', 'report.stampLoss', 'report.stampDay', 'report.earnedToday', 'report.lostToday',
        'report.bestSellers', 'report.claimGoalTitle', 'report.claimGoalBtn', 'report.claimedGoalBtn',
        'report.claimChapterTitle', 'report.claimChapterBtn', 'report.claimedChapterBtn',
        'report.tomorrowWeather', 'report.detailsTitle', 'report.detailsSub',
      ] as const) {
        expect(messages[key], `${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it.each(['en', 'zh'] as const)('separates full and partial forecast funding in %s', (locale) => {
    setLocale(locale); const state = createInitialState(0); state.goal = GOALS.length; state.pantry.beans = 0;
    state.coins = 25340.481970575758;
    const full = settlementHtml(day(), state); document.body.innerHTML = full.body;
    expect(full.advice.action.kind).toBe('restock');
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    details.open = true;
    expect(details.querySelector('.report-action')!.textContent).toContain(locale === 'zh' ? '可买齐当前预测' : 'all ingredients in the current forecast');
    expect(details.querySelector('.report-action')!.textContent).not.toContain(locale === 'zh' ? '资金只够部分' : 'budget covers only part');
    state.coins = 1;
    document.body.innerHTML = settlementHtml(day(), state).body;
    const details2 = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    details2.open = true;
    expect(details2.querySelector('.report-action')!.textContent).toContain(locale === 'zh' ? '资金只够部分' : 'budget covers only part');
  });
});

describe('Direction A Stage 5 receipt settlement', () => {
  it.each(['en', 'zh'] as const)('claims a completed goal directly on the receipt identically to the ledger in %s', (locale) => {
    setLocale(locale);
    const state = createInitialState(0);
    state.day = 2;
    const expected = structuredClone(state);
    const ledgerReward = claimGoal(expected);
    expect(ledgerReward).toBe(GOALS[0].reward);

    const onClaim = vi.fn();
    showSettlement(day(), state, {
      onNext: vi.fn(),
      onTab: vi.fn(),
      onClaim,
      onTrialChange: vi.fn(),
      onStorySave: vi.fn(),
    });
    const btn = document.querySelector<HTMLButtonElement>('[data-claim-action="goal"]')!;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe(t('report.claimGoalBtn', { reward: formatTransactionMoney(GOALS[0].reward) }));

    btn.click();
    expect(state.coins).toBe(expected.coins);
    expect(state.goal).toBe(expected.goal);
    expect(onClaim).toHaveBeenCalledWith('goal', String(ledgerReward));
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(t('report.claimedGoalBtn', { reward: formatTransactionMoney(ledgerReward) }));
    expect(isModalOpen()).toBe(true);
    // Repeated click does nothing.
    btn.click();
    expect(state.coins).toBe(expected.coins);
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it.each(['en', 'zh'] as const)('claims a completed chapter directly on the receipt identically to the ledger in %s', (locale) => {
    setLocale(locale);
    const state = withReadyChapter();
    const expected = structuredClone(state);
    const ledgerReward = claimChapter(expected);
    expect(ledgerReward).not.toBeNull();

    const onClaim = vi.fn();
    showSettlement(day({ day: 11 }), state, {
      onNext: vi.fn(),
      onTab: vi.fn(),
      onClaim,
      onTrialChange: vi.fn(),
      onStorySave: vi.fn(),
    });
    const claimBar = document.querySelector('[data-settle-claim="chapter"]')!;
    expect(claimBar.textContent).toContain(t('milestone.chapter.neighbourhood'));
    const btn = claimBar.querySelector<HTMLButtonElement>('[data-claim-action="chapter"]')!;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe(t('report.claimChapterBtn'));

    btn.click();
    expect(state.milestones.claimed).toEqual(expected.milestones.claimed);
    expect(state.decor.owned).toEqual(expected.decor.owned);
    expect(state.coins).toBe(expected.coins);
    expect(onClaim).toHaveBeenCalledWith('milestone', 'neighbourhood');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(t('report.claimedChapterBtn'));
    expect(isModalOpen()).toBe(true);
    expect(document.getElementById('toast')!.hidden).toBe(false);
  });

  it.each(['en', 'zh'] as const)('shows profit vs loss stamp wording and DAY N in %s', (locale) => {
    setLocale(locale);
    const state = createInitialState(0);
    state.goal = GOALS.length;

    document.body.innerHTML = settlementHtml(day({ day: 5, profit: 0 }), state).body;
    const goodStamp = document.querySelector('.settle-stamp')!;
    expect(goodStamp.textContent).toContain(t('report.stampGood').replace(/\n/g, ''));
    expect(goodStamp.textContent).toContain(t('report.stampDay', { n: 5 }));

    document.body.innerHTML = settlementHtml(day({ day: 5, profit: -12.5 }), state).body;
    const lossStamp = document.querySelector('.settle-stamp')!;
    expect(lossStamp.textContent).toContain(t('report.stampLoss').replace(/\n/g, ''));
    expect(lossStamp.textContent).toContain(t('report.stampDay', { n: 5 }));
  });

  it('orders top 3 best sellers by report.sales and falls back to report.none when empty', () => {
    const state = createInitialState(0);
    state.goal = GOALS.length;
    const report = day({ sales: { americano: 12, latte: 52, espresso: 40, croissant: 31 }, bestSeller: 'latte' });
    expect(topSellers(report)).toEqual([['latte', 52], ['espresso', 40], ['croissant', 31]]);
    document.body.innerHTML = settlementHtml(report, state).body;
    const items = [...document.querySelectorAll<HTMLElement>('.settle-best-item')];
    expect(items.map((el) => el.dataset.bestItem)).toEqual(['latte', 'espresso', 'croissant']);
    expect(items.map((el) => el.textContent)).toEqual(['1×52', '2×40', '3×31']);

    document.body.innerHTML = settlementHtml(day({ sales: {}, bestSeller: null, served: 0 }), state).body;
    expect(document.querySelectorAll('.settle-best-item')).toHaveLength(0);
    expect(document.querySelector('.settle-none')!.textContent).toBe(t('report.none'));
  });

  it('picks the single largest non-zero loss row and hides it when all 5 loss counts are zero', () => {
    const state = createInitialState(0);
    state.goal = GOALS.length;
    const none = day({ missed: 0, queueLost: 0, tableLost: 0, extraLost: 0, doorLost: 0 });
    expect(topLoss(none)).toBeNull();
    document.body.innerHTML = settlementHtml(none, state).body;
    expect(document.querySelector('[data-top-loss]')).toBeNull();

    const door = day({ missed: 5, queueLost: 2, tableLost: 1, extraLost: 3, doorLost: 12 });
    expect(topLoss(door)).toEqual({ key: 'report.doorLost', count: 12 });
    document.body.innerHTML = settlementHtml(door, state).body;
    const lossRow = document.querySelector<HTMLElement>('[data-top-loss]')!;
    expect(lossRow.dataset.topLoss).toBe('report.doorLost');
    expect(lossRow.textContent).toContain(t('report.doorLost'));
    expect(lossRow.textContent).toContain('12');
  });

  it.each(['en', 'zh'] as const)('shows tomorrow sticky note with weather, without weather, and hides it on day 1 in %s', (locale) => {
    setLocale(locale);
    const state = createInitialState(0);
    state.goal = GOALS.length;
    // Day 1 closing -> tomorrow is Day 2 (< FIRST_CONDITION_DAY, demandEnabled false): no sticky note.
    document.body.innerHTML = settlementHtml(day({ day: 1 }), state).body;
    expect(document.querySelector('.settle-tmr')).toBeNull();

    // Find a day whose tomorrow has non-fair weather, and a day whose tomorrow is fair (>= day 3).
    let rainDay = 2;
    while (conditionOn(state, rainDay + 1) === 'fair') rainDay++;
    let fairDay = 2;
    while (conditionOn(state, fairDay + 1) !== 'fair') fairDay++;

    const weatherCond = conditionOn(state, rainDay + 1);
    document.body.innerHTML = settlementHtml(day({ day: rainDay }), state).body;
    const withWeather = document.querySelector('.settle-tmr')!;
    expect(withWeather.textContent).toContain(t('report.tomorrowWeather', { name: t(`condition.${weatherCond}.name` as Parameters<typeof t>[0]) }));
    expect(withWeather.textContent).toContain(t(`demand.hint.${weatherCond}` as Parameters<typeof t>[0]));
    // Not duplicated inside Business Details.
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    details.open = true;
    expect(details.textContent).not.toContain(t(`demand.hint.${weatherCond}` as Parameters<typeof t>[0]));

    document.body.innerHTML = settlementHtml(day({ day: fairDay }), state).body;
    const withoutWeather = document.querySelector('.settle-tmr')!;
    expect(withoutWeather.textContent).toContain(t('demand.tomorrow'));
    expect(withoutWeather.textContent).toContain(t('demand.hint.fair'));
  });

  it('closes settlement and invokes onNext when Plan tomorrow is clicked, and opens recommended tab from details', () => {
    const state = createInitialState(0);
    state.day = 2;
    const onNext = vi.fn();
    const onTab = vi.fn();
    showSettlement(day(), state, {
      onNext,
      onTab,
      onClaim: vi.fn(),
      onTrialChange: vi.fn(),
      onStorySave: vi.fn(),
    });
    expect(isModalOpen()).toBe(true);
    expect(document.querySelector('.settle-plank')!.textContent).toContain(t('report.closedHeading', { n: 1 }));
    expect(document.querySelector('.settle-cafe')!.textContent).toBe(t('app.title'));
    document.querySelector<HTMLButtonElement>('[data-settle-next]')!.click();
    expect(isModalOpen()).toBe(false);
    expect(onNext).toHaveBeenCalledOnce();

    // Open again and click the recommended tab button inside Business Details.
    showSettlement(day(), state, {
      onNext: vi.fn(),
      onTab,
      onClaim: vi.fn(),
      onTrialChange: vi.fn(),
      onStorySave: vi.fn(),
    });
    const details = document.querySelector<HTMLDetailsElement>('details.report-details')!;
    details.open = true;
    details.querySelector<HTMLButtonElement>('[data-settle-tab]')!.click();
    expect(isModalOpen()).toBe(false);
    expect(onTab).toHaveBeenCalledWith('menu');
    // Confirm formatMoney is still consistent with toast usage.
    expect(formatMoney(30)).toBe('$30');
  });
});
