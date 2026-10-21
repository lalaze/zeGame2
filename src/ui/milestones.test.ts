// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DayReport } from '../game/day';
import { formatNumber } from '../game/format';
import { GOALS } from '../game/goals';
import { CHAPTERS, recordDay } from '../game/milestones';
import { emptyReviews } from '../game/reputation';
import { createInitialState, emptyDay, type GameState } from '../game/state';
import en from '../locales/en.json';
import { setLocale } from '../i18n';
import { closeModal } from './modal';
import { milestoneCard, showMilestoneBook } from './milestones';
import { Panel } from './panel';
import { settlementHtml } from './settlement';

vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'),
  itemArtwork: () => document.createElement('canvas'),
  upgradeIcon: () => document.createElement('canvas'),
  catFrames: () => ({ idle: document.createElement('canvas') }),
  toDataURL: () => 'data:image/png;base64,',
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));

function graduate(): GameState {
  const s = createInitialState(0);
  s.goal = GOALS.length;
  return s;
}
const finish = (s: GameState, n: number) => { for (const c of CHAPTERS.slice(0, n)) for (const m of c.milestones) if (!s.milestones.done.includes(m.id)) s.milestones.done.push(m.id); };
function panelFor(state: GameState, onPurchase = vi.fn()) {
  const tabs = ['menu', 'pantry', 'upgrades', 'decor', 'pets', 'promotion'];
  document.body.innerHTML = `<button id="guide">Guide action</button><section id="panel">
    <nav role="tablist">${tabs.map((tab) => `<button role="tab" data-tab="${tab}">${tab}</button>`).join('')}</nav>
    <div class="panel-scroll"><div class="buy-amount"><button data-amount="1" class="active">1</button><button data-amount="10">10</button><button data-amount="max">Max</button></div>
    <div class="pantry-amount" hidden><button data-pantry-amount="10" class="active">10</button><button data-pantry-amount="50">50</button></div>
    <div class="menu-filter"><button data-cat="all" class="active">All</button><button data-cat="coffee">Coffee</button></div>
    <div id="list"></div><div id="goal"></div></div>
  </section><div id="modal-root"></div><div id="toast" hidden></div>`;
  const panel = new Panel(document.querySelector('#panel')!, document.querySelector('#list')!, document.querySelector('#goal')!, state, onPurchase, vi.fn());
  panel.showTab('menu');
  return { panel, goal: document.querySelector<HTMLElement>('#goal')! };
}

afterEach(() => { closeModal(); setLocale('en'); document.body.replaceChildren(); });

describe('milestone card and book', () => {
  it('shows the open chapter’s closest milestone after the guided goals', () => {
    const s = graduate();
    s.served = 900;
    const card = milestoneCard(s);
    expect(card.done).toBe(false);
    expect(card.html).toContain(en['milestone.chapter.neighbourhood']);
    // 900 of 1,000 guests is closer than any other chapter 1 milestone.
    expect(card.html).toContain(en['milestone.served1000']);
    expect(card.html).toContain(`900 / ${formatNumber(1000)}`);
    expect(card.html).toContain('data-milestone-book');
  });

  it('keeps the guided goal card until the guided goals are done', () => {
    const s = createInitialState(0);
    const { goal } = panelFor(s);
    expect(goal.textContent).not.toContain(en['milestone.chapter.neighbourhood']);
    expect(goal.querySelector('[data-claim-chapter]')).toBeNull();
  });

  it('claims a finished chapter from the goal card', () => {
    const s = graduate();
    finish(s, 1);
    const onPurchase = vi.fn();
    const { goal } = panelFor(s, onPurchase);
    expect(goal.classList.contains('done')).toBe(true);
    const claim = goal.querySelector<HTMLButtonElement>('[data-claim-chapter]')!;
    expect(claim.textContent).toContain(en['decor.ceiling_vines']);
    claim.click();
    expect(onPurchase).toHaveBeenCalledWith('milestone', 'neighbourhood');
    expect(s.milestones.claimed).toEqual(['neighbourhood']);
    expect(s.decor.equipped.ceiling).toBe('ceiling_vines');
    expect(document.querySelector('#toast')!.textContent).toContain(en['milestone.chapter.neighbourhood']);
    // The card moves on to chapter 2.
    expect(goal.textContent).toContain(en['milestone.chapter.favourite']);
  });

  it('lists opened chapters, names the next one and hides the rest', () => {
    const s = graduate();
    finish(s, 1);
    recordDay(s, { day: 1, served: 120, missed: 0, sales: {}, reviews: emptyReviews() });
    const { goal } = panelFor(s);
    goal.querySelector<HTMLButtonElement>('[data-milestone-book]')!.click();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain(en['milestone.book.title']);
    expect(dialog.textContent).toContain(en['milestone.served1000']);
    expect(dialog.textContent).toContain(en['milestone.busyDay150']);
    expect(dialog.textContent).toContain('120 / 150');
    expect(dialog.textContent).toContain(en['milestone.chapter.town']);
    expect(dialog.textContent).not.toContain(en['milestone.served3000']);
    expect(dialog.textContent).not.toContain(en['milestone.chapter.institution']);
  });

  it('explains when the milestones begin', () => {
    document.body.innerHTML = '<div id="modal-root"></div>';
    showMilestoneBook(createInitialState(0));
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(en['milestone.book.notStarted'].replace('{n}', String(GOALS.length)));
  });

  it('reports milestones reached and points to a ready chapter reward', () => {
    const s = graduate();
    finish(s, 1);
    s.day = 12;
    const report: DayReport = { ...emptyDay(), day: 11, duration: 180, rating: 4, ratingCount: 50, ratingTraffic: 1,
      served: 100, revenue: 300, ingredientCost: 100, profit: 200, sales: { espresso: 100 }, bestSeller: 'espresso',
      outOfStock: [], shelfSoldOut: [], stale: {}, staleCost: 0, newMilestones: ['smoothDay60'] };
    const html = settlementHtml(report, s);
    expect(html.body).toContain(en['milestone.smoothDay60']);
    expect(html.advice.action.kind).toBe('claimChapter');
    expect(html.body).toContain(en['milestone.chapter.neighbourhood']);
  });
});
