import './settlement.css';
import { demandReportHtml } from './customer-demand';
import { regularWishReportHtml } from './regular-wishes';
import { closingStory } from './cafe-life';
import { trialResultCard } from './trial-sales';
import { guestMemoryReport } from './guest-memories';
import { conditionDef, conditionOn, type ConditionId } from '../game/conditions';
import { demandEnabled } from '../game/customer-demand';
import { claimGoal } from '../game/goals';
import { partnerDefinition } from '../game/partners';
import { getLocale, t, type MessageKey } from '../i18n';
import { partnerText } from './partners';
import { htmlItemName } from './item-name';
import type { ItemId } from '../game/data';
import type { DayReport } from '../game/day';
import { businessElapsedMinutes, formatBusinessDuration } from '../game/business-clock';
import { formatAccountMoney, formatMoney, formatTransactionMoney } from '../game/format';
import { settlementAdvice, type SettlementAdvice, type SettlementReason, type SettlementTab } from '../game/settlement-advice';
import type { GameState } from '../game/state';
import * as sprites from '../render/sprites';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { iconArt } from './icon-art';
import { showPortrait } from './portrait-art';
import { ratingReportHtml } from './reputation';
import { conditionName } from './conditions';
import { claimChapterWithToast, milestoneName } from './milestones';
import { closeModal, showModal } from './modal';

const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const text = (key: string, params?: Record<string, string | number>) => t(key as MessageKey, params);
const itemName = (id: ItemId) => htmlItemName(id);
const itemImg = (id: ItemId) => iconArt(`item:${id}`) ?? sprites.toDataURL(sprites.itemArtwork(id), 1);
const row = (label: string, value: string) => `<dt>${label}</dt><dd>${value}</dd>`;
const list = (ids: ItemId[]) => ids.map(itemName).join(t('list.sep'));

const WEATHER_ICON: Record<ConditionId, string> = {
  fair: 'sun',
  rain: 'rain',
  hot: 'sun',
  crisp: 'leaf',
  market: 'bag',
  quiet: 'cloud',
};

const LOSS_FIELDS: readonly [MessageKey, 'missed' | 'queueLost' | 'tableLost' | 'extraLost' | 'doorLost'][] = [
  ['report.missed', 'missed'],
  ['report.queueLost', 'queueLost'],
  ['report.tableLost', 'tableLost'],
  ['report.extraLost', 'extraLost'],
  ['report.doorLost', 'doorLost'],
];

/** Up to 3 best-selling items from today's sales, preserving insertion order on ties. */
export function topSellers(report: DayReport): [ItemId, number][] {
  return (Object.entries(report.sales) as [ItemId, number | undefined][])
    .filter((entry): entry is [ItemId, number] => (entry[1] ?? 0) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}

/** Single largest non-zero loss reason among the five tracked loss counts, or null if all are 0. */
export function topLoss(report: DayReport): { key: MessageKey; count: number } | null {
  let best: { key: MessageKey; count: number } | null = null;
  for (const [key, field] of LOSS_FIELDS) {
    const count = report[field] ?? 0;
    if (count > (best?.count ?? 0)) best = { key, count };
  }
  return best;
}

function reasonText(reason: SettlementReason): string {
  return text(`report.reason.${reason.kind}`, {
    n: reason.count ?? 0, extra: reason.extra ?? 0, money: formatAccountMoney(reason.amount ?? 0),
  });
}

function actionText(advice: SettlementAdvice): string {
  const action = advice.action;
  const items = Object.entries(action.ingredients ?? {}).map(([id, n]) => `${text(`ing.${id}`)} ×${n}`).join(t('list.sep'));
  return text(action.kind === 'restock'
    ? (action.cost + 1e-6 >= advice.ingredientReserve ? 'report.action.restockFull' : 'report.action.restock')
    : `report.action.${action.kind}`, {
    item: action.item ? itemName(action.item) : '',
    items,
    n: action.amount ?? 0,
    money: formatAccountMoney(action.cost),
    reward: formatMoney(action.reward ?? 0),
    upgrade: action.upgrade ? text(`upgrade.${action.upgrade}.name`) : '',
    chapter: action.kind === 'claimChapter' && action.goal ? text(`milestone.chapter.${action.goal}`) : '',
  });
}

/** Receipt summary + tomorrow sticky note + full expandable business details. */
export function settlementHtml(report: DayReport, state: GameState): { body: string; recommendedTab: SettlementTab; advice: SettlementAdvice } {
  const advice = settlementAdvice(report, state);
  const totalBaked = Object.values(report.baked).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  const staleCount = Object.values(report.stale).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  // Stale leftovers of a dish that also sold out point to batch timing, not an oversized bake.
  const staleEntries = Object.entries(report.stale).filter(([, n]) => (n ?? 0) > 0);
  const staleGroups = ([
    ['report.staleItems', staleEntries.filter(([id]) => !(report.shortages[id as ItemId] ?? 0))],
    ['report.staleShort', staleEntries.filter(([id]) => (report.shortages[id as ItemId] ?? 0) > 0)],
  ] as const).filter(([, entries]) => entries.length);
  const best = report.bestSeller;
  const bestHtml = best
    ? `<p class="report-best"><img src="${itemImg(best)}" alt="" />${t('report.best', { item: htmlItemName(best, state), n: report.sales[best] ?? 0 })}</p>`
    : `<p>${t('report.none')}</p>`;
  const goal = advice.claimableGoal;
  const chapterId = !goal && advice.action.kind === 'claimChapter' ? advice.action.goal : undefined;
  // Profit loss drivers stay together even when several costs contributed.
  // Other secondary observations remain discoverable with the detailed ledger.
  const primaryReasons = report.profit < 0 ? advice.reasons : advice.reasons.slice(0, 1);
  const secondaryReasons = advice.reasons.filter((reason) => !primaryReasons.includes(reason));
  const todayCond = conditionDef(conditionOn(state, report.day));
  const loss = topLoss(report);
  const sellers = topSellers(report);
  const bestSellersHtml = sellers.length
    ? `<div class="settle-best">${sellers.map(([id, n], i) => `<div class="settle-best-item" data-best-item="${id}" title="${escape(htmlItemName(id, state))}"><img src="${itemImg(id)}" alt="" /><span class="settle-best-count"><span class="settle-rank r${i + 1}">${i + 1}</span>×${n}</span></div>`).join('')}</div>`
    : `<p class="settle-none">${escape(t('report.none'))}</p>`;
  const partners = report.partners ?? [];
  const partnerCardsHtml = partners.length
    ? `<hr class="settle-dash" /><div class="settle-pals${partners.length === 1 ? ' single' : ''}">${partners.map((p) => {
      const def = partnerDefinition(p.id);
      const jobs = text('report.partnerJobs', { n: p.jobs });
      const stories = p.unlocked ? ` · ${text('report.partnerNewStories', { n: p.unlocked })}` : '';
      return `<div class="settle-pal" data-partner-card="${p.id}">
        ${def ? `<span class="settle-av"><img data-partner-avatar="${p.id}" alt="" /></span>` : ''}
        <div class="settle-pal-copy"><b>${escape(def?.name[getLocale()] ?? '')}</b><small>${escape(jobs + stories)}</small></div>
      </div>`;
    }).join('')}</div>`
    : '';
  const wishHtml = regularWishReportHtml(state, report.day);
  const claimHtml = goal
    ? `<div class="settle-claim" data-settle-claim="goal"><span class="settle-claim-ic" data-floors-icon="trophy" aria-hidden="true"></span><b>${escape(text('report.claimGoalTitle', { goal: text(`goal.${goal.id}`) }))}</b><button type="button" class="settle-claim-btn" data-claim-action="goal">${escape(text('report.claimGoalBtn', { reward: formatTransactionMoney(goal.reward) }))}</button></div>`
    : chapterId
      ? `<div class="settle-claim" data-settle-claim="chapter"><span class="settle-claim-ic" data-floors-icon="trophy" aria-hidden="true"></span><b>${escape(text('report.claimChapterTitle', { chapter: text(`milestone.chapter.${chapterId}`) }))}</b><button type="button" class="settle-claim-btn" data-claim-action="chapter">${escape(text('report.claimChapterBtn'))}</button></div>`
      : '';

  const tomorrowCond = conditionDef(conditionOn(state, report.day + 1));
  const hasTomorrowWeather = tomorrowCond.id !== 'fair';
  const hasTomorrowDemand = demandEnabled({ day: report.day + 1 });
  const hasSticky = hasTomorrowWeather || hasTomorrowDemand;
  const stickyHtml = hasSticky
    ? `<aside class="settle-tmr condition-${tomorrowCond.id}"><b class="settle-tmr-head" data-floors-icon="${WEATHER_ICON[tomorrowCond.id]}">${escape(hasTomorrowWeather ? text('report.tomorrowWeather', { name: conditionName(tomorrowCond) }) : t('demand.tomorrow'))}</b>${hasTomorrowDemand ? `<p>${escape(text(`demand.hint.${tomorrowCond.id}`))}</p>` : ''}</aside>`
    : '';

  const partnersDetailsHtml = partners.length
    ? `<section class="report-partners"><h3>${partnerText('今日伙伴贡献', 'Today’s partner contributions')}</h3><ul>${partners.map((p) => `<li>${(partnerDefinition(p.id)?.name[getLocale()] ?? '')} · ${text('report.partnerJobs', { n: p.jobs })} · ${p.xp} XP${p.unlocked ? ` · ${text('report.partnerNewStories', { n: p.unlocked })}` : ''}</li>`).join('')}</ul></section>`
    : '';

  const body = `<article class="settle-rcpt">
      <span class="settle-tape" aria-hidden="true"></span>
      <header class="settle-rcpt-head">
        <h3>${escape(text('report.receiptTitle'))}</h3>
        <p class="settle-dt">${escape(formatBusinessDuration(report.duration))} · ${escape(conditionName(todayCond))}</p>
        <div class="settle-stamp${report.profit < 0 ? ' loss' : ''}"><span>${escape(text(report.profit < 0 ? 'report.stampLoss' : 'report.stampGood')).replace(/\n/g, '<br>')}</span><small>${escape(text('report.stampDay', { n: report.day }))}</small></div>
      </header>
      <hr class="settle-dash" />
      <section class="report-summary" aria-label="${escape(text('report.closedHeading', { n: report.day }))}">
        <div class="settle-profit report-profit${report.profit < 0 ? ' loss' : ''}"><small>${escape(text(report.profit < 0 ? 'report.lostToday' : 'report.earnedToday'))}</small><b class="big-money">${report.profit < 0 ? '−' : '+'}${formatAccountMoney(Math.abs(report.profit))}</b></div>
        <hr class="settle-dash" />
        <dl class="settle-lines report-primary">
          <div class="settle-ln"><dt>${escape(t('report.served'))}</dt><dd>${report.served.toLocaleString()}</dd></div>
          <div class="settle-ln"><dt>${escape(t('report.revenue'))}</dt><dd>${formatAccountMoney(report.revenue)}</dd></div>
          <div class="settle-ln"><dt>${escape(text('report.cost'))}</dt><dd>−${formatAccountMoney(advice.totalCost)}</dd></div>
          ${loss ? `<div class="settle-ln bad" data-top-loss="${loss.key}"><dt>${escape(t(loss.key))}</dt><dd>${loss.count.toLocaleString()}</dd></div>` : ''}
        </dl>
        ${report.day === 1 && report.ingredientCost > 0 ? `<p class="note report-starter">${t('report.starterNote')}</p>` : ''}
      </section>
      <hr class="settle-dash" />
      <section class="settle-best-sec">
        <h4 class="settle-sec-label">${escape(text('report.bestSellers'))}</h4>
        ${bestSellersHtml}
      </section>
      ${partnerCardsHtml}
      <div class="settle-extras"><div data-closing-story></div>${wishHtml}${report.trialSale ? '<div data-trial-report></div>' : ''}<div data-memory-report></div></div>
      ${claimHtml}
    </article>
    <div class="settle-below${hasSticky ? ' has-tmr' : ''}">
      ${stickyHtml}
      <details class="report-details settle-det">
        <summary class="settle-det-card"><span class="settle-det-top"><b>${escape(text('report.detailsTitle'))}</b><span class="settle-det-arrow" data-floors-icon="chevron" aria-hidden="true"></span></span><small>${escape(text('report.detailsSub'))}</small></summary>
        <div class="settle-det-body">
          <section class="report-guidance" aria-label="${escape(text('report.nextStep'))}">
            <p class="report-reason">${primaryReasons.map(reasonText).join(' ')}</p>
            ${goal ? `<p class="report-goal">${text('report.goalReady', { goal: text(`goal.${goal.id}`), reward: formatMoney(goal.reward) })}</p>` : ''}
            <p class="report-action"><b>${text('report.nextStep')}:</b> ${actionText(advice)}</p>
            <button type="button" class="pixel-btn small ghost settle-tab-btn" data-settle-tab="${advice.action.tab}">${escape(text(`tab.${advice.action.tab}`))}</button>
            ${advice.action.kind === 'restock' || advice.action.kind === 'upgrade' ? '' : `<p class="note report-stock-priority">${text('report.stockFirst')}</p>`}
            ${report.newMilestones?.length ? `<p class="report-milestones">${text('milestone.report', { items: report.newMilestones.map(milestoneName).join(t('list.sep')) })}</p>` : ''}
          </section>
          ${demandReportHtml(report)}
          ${partnersDetailsHtml}
          <dl class="stats">
            ${row(t('report.missed'), t('report.missedValue', { n: report.missed, sold: report.soldOut }))}
            ${row(t('report.queueLost'), report.queueLost.toLocaleString())}
            ${row(t('report.tableLost'), report.tableLost.toLocaleString())}
            ${row(t('report.extraLost'), report.extraLost.toLocaleString())}
            ${row(t('report.doorLost'), report.doorLost.toLocaleString())}
            ${row(t('report.duration'), formatBusinessDuration(report.duration))}
            ${row(t('report.ingredients'), '−' + formatAccountMoney(report.ingredientCost))}
            ${report.petCost > 0 ? row(t('pet.expense'), '−' + formatAccountMoney(report.petCost)) : ''}
            ${report.promotionCost > 0 ? row(t('promo.expense'), '−' + formatAccountMoney(report.promotionCost)) : ''}
            ${totalBaked ? row(t('report.baked'), totalBaked.toLocaleString()) + row(t('report.stale'), staleCount ? t('report.staleValue', { n: staleCount, money: formatMoney(report.staleCost) }) : '0') : ''}
          </dl>
          <p class="note">${text('report.costNote')}</p>
          <p class="note">${businessElapsedMinutes(report.duration) >= 1 ? t('report.perMinute', { money: formatAccountMoney(report.profit / businessElapsedMinutes(report.duration)) }) : t('report.shortSample')}</p>
          ${secondaryReasons.length ? `<p class="note">${secondaryReasons.map(reasonText).join(' ')}</p>` : ''}
          ${ratingReportHtml(report)}
          ${bestHtml}
          ${Object.keys(report.shortages).length ? `<p class="note">${t('report.shortages', { items: Object.entries(report.shortages).map(([id, n]) => `${htmlItemName(id as ItemId, state)} ×${n}`).join(t('list.sep')) })}</p>` : ''}
          ${report.shelfSoldOut.length ? `<p class="note">${t('report.shelfOut', { items: list(report.shelfSoldOut) })}</p>` : ''}
          ${staleGroups.map(([key, entries]) => `<p class="note">${t(key, { items: entries.map(([id, n]) => `${htmlItemName(id as ItemId, state)} ×${n}`).join(t('list.sep')) })}</p>`).join('')}
          ${report.outOfStock.length ? `<p class="note warn">${t('report.outOfStock', { items: list(report.outOfStock) })}</p>` : ''}
        </div>
      </details>
    </div>`;
  return { body, recommendedTab: advice.action.tab, advice };
}

export interface SettlementCallbacks {
  onNext: () => void;
  onTab: (tab: SettlementTab) => void;
  onClaim: (kind: 'goal' | 'milestone', id: string) => void;
  onTrialChange: () => void;
  onStorySave: () => void;
}

/** Opens the Direction A closing receipt dialog with wood plank header, direct claiming and golden next button. */
export function showSettlement(report: DayReport, state: GameState, callbacks: SettlementCallbacks): void {
  const { body, recommendedTab } = settlementHtml(report, state);
  const reportBody = document.createElement('div');
  reportBody.className = 'settle-scroll-inner';
  reportBody.innerHTML = body;

  for (const img of reportBody.querySelectorAll<HTMLImageElement>('img[data-partner-avatar]')) {
    const def = partnerDefinition(img.dataset.partnerAvatar ?? '');
    if (!def) continue;
    showPortrait(img, { look: def.look }, () => {
      if (typeof sprites.character !== 'function') return 'data:,';
      const art = fineSpriteArt(sprites.character(def.look, def.role, def.appearance).stand);
      return sprites.toDataURL(art.canvas, 3 / art.density);
    });
  }

  const storySlot = reportBody.querySelector('[data-closing-story]');
  const story = closingStory(state, report, callbacks.onStorySave);
  if (story && storySlot) storySlot.replaceWith(story);
  else storySlot?.remove();

  const trialSlot = reportBody.querySelector('[data-trial-report]');
  if (report.trialSale && trialSlot) {
    const trial = trialResultCard(state, callbacks.onTrialChange, report.trialSale);
    if (trial) trialSlot.replaceWith(trial);
    else trialSlot.remove();
  } else trialSlot?.remove();

  const memorySlot = reportBody.querySelector('[data-memory-report]');
  const memories = guestMemoryReport(state, report.day);
  if (memories && memorySlot) memorySlot.replaceWith(memories);
  else memorySlot?.remove();

  reportBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const claimBtn = target.closest<HTMLButtonElement>('button[data-claim-action]');
    if (claimBtn && !claimBtn.disabled) {
      const kind = claimBtn.dataset.claimAction;
      if (kind === 'goal') {
        const reward = claimGoal(state);
        if (reward > 0) {
          callbacks.onClaim('goal', String(reward));
          claimBtn.disabled = true;
          claimBtn.textContent = text('report.claimedGoalBtn', { reward: formatTransactionMoney(reward) });
          claimBtn.closest('.settle-claim')?.classList.add('claimed');
        }
      } else if (kind === 'chapter') {
        const reward = claimChapterWithToast(state);
        if (reward) {
          callbacks.onClaim('milestone', reward.chapter.id);
          claimBtn.disabled = true;
          claimBtn.textContent = text('report.claimedChapterBtn');
          claimBtn.closest('.settle-claim')?.classList.add('claimed');
        }
      }
      return;
    }
    const tabBtn = target.closest<HTMLButtonElement>('button[data-settle-tab]');
    if (tabBtn) {
      closeModal();
      callbacks.onTab(recommendedTab);
    }
  });

  const heading = text('report.closedHeading', { n: report.day });
  showModal({ title: heading, body: reportBody, buttons: [], onEscape: closeModal });
  const modal = reportBody.closest<HTMLElement>('.modal')!;
  modal.classList.add('settle-modal');
  modal.parentElement?.classList.add('settle-overlay');

  const titleEl = modal.querySelector<HTMLElement>('h2')!;
  const sign = document.createElement('header');
  sign.className = 'settle-sign';
  const leftRope = document.createElement('span');
  leftRope.className = 'settle-rope left';
  leftRope.setAttribute('aria-hidden', 'true');
  const rightRope = document.createElement('span');
  rightRope.className = 'settle-rope right';
  rightRope.setAttribute('aria-hidden', 'true');
  const plank = document.createElement('div');
  plank.className = 'a-plank settle-plank';
  const cafe = document.createElement('small');
  cafe.className = 'settle-cafe';
  cafe.textContent = state.profile?.cafeName || t('app.title');
  plank.append(cafe, titleEl);
  sign.append(leftRope, rightRope, plank);

  const footer = document.createElement('footer');
  footer.className = 'settle-footer';
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'settle-go-btn';
  nextBtn.dataset.floorsIcon = 'sun';
  nextBtn.dataset.settleNext = '';
  nextBtn.textContent = t('report.next');
  nextBtn.addEventListener('click', () => {
    closeModal();
    callbacks.onNext();
  });
  footer.append(nextBtn);

  const modalBody = modal.querySelector<HTMLElement>('.modal-body')!;
  modalBody.before(sign);
  modalBody.after(footer);
}
