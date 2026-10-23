import { demandReportHtml, tomorrowDemandHtml } from './customer-demand';
import { partnerDefinition } from '../game/partners';
import { getLocale } from '../i18n';
import { partnerText } from './partners';
import { htmlItemName } from './item-name';
import type { ItemId } from '../game/data';
import type { DayReport } from '../game/day';
import { businessElapsedMinutes, formatBusinessDuration } from '../game/business-clock';
import { formatAccountMoney, formatMoney } from '../game/format';
import { settlementAdvice, type SettlementAdvice, type SettlementReason, type SettlementTab } from '../game/settlement-advice';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';
import { itemArtwork, toDataURL } from '../render/sprites';
import { ratingReportHtml } from './reputation';
import { tomorrowConditionHtml } from './conditions';
import { milestoneName } from './milestones';

const text = (key: string, params?: Record<string, string | number>) => t(key as MessageKey, params);
const itemName = (id: ItemId) => htmlItemName(id);
const row = (label: string, value: string) => `<dt>${label}</dt><dd>${value}</dd>`;
const list = (ids: ItemId[]) => ids.map(itemName).join(t('list.sep'));

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

/** Compact summary first; the full original ledger is still one disclosure away. */
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
    ? `<p class="report-best"><img src="${toDataURL(itemArtwork(best), 1)}" alt="" />${t('report.best', { item: htmlItemName(best, state), n: report.sales[best] ?? 0 })}</p>`
    : `<p>${t('report.none')}</p>`;
  const goal = advice.claimableGoal;
  // Profit loss drivers stay together even when several costs contributed.
  // Other secondary observations remain discoverable with the detailed ledger.
  const primaryReasons = report.profit < 0 ? advice.reasons : advice.reasons.slice(0, 1);
  const secondaryReasons = advice.reasons.filter((reason) => !primaryReasons.includes(reason));
  const body = `<section class="report-summary" aria-label="${t('report.title', { n: report.day })}">
      <dl class="stats report-primary">
        ${row(t('report.served'), report.served.toLocaleString())}
        ${row(t('report.revenue'), formatAccountMoney(report.revenue))}
        ${row(text('report.cost'), '−' + formatAccountMoney(advice.totalCost))}
      </dl>
      <div class="report-profit${report.profit < 0 ? ' loss' : ''}"><span>${t('report.profit')}</span><b class="big-money">${report.profit < 0 ? '−' : '+'}${formatAccountMoney(Math.abs(report.profit))}</b></div>
      ${report.day === 1 && report.ingredientCost > 0 ? `<p class="note report-starter">${t('report.starterNote')}</p>` : ''}
    </section>
    <section class="report-guidance" aria-label="${text('report.nextStep')}">
      <p class="report-reason">${primaryReasons.map(reasonText).join(' ')}</p>
      ${goal ? `<p class="report-goal">${text('report.goalReady', { goal: text(`goal.${goal.id}`), reward: formatMoney(goal.reward) })}</p>` : ''}
      <p class="report-action"><b>${text('report.nextStep')}:</b> ${actionText(advice)}</p>
      ${advice.action.kind === 'restock' || advice.action.kind === 'upgrade' ? '' : `<p class="note report-stock-priority">${text('report.stockFirst')}</p>`}
      ${report.newMilestones?.length ? `<p class="report-milestones">${text('milestone.report', { items: report.newMilestones.map(milestoneName).join(t('list.sep')) })}</p>` : ''}
      ${tomorrowConditionHtml(state, report.day)}
      ${tomorrowDemandHtml(state, report.day)}
    </section>
    ${demandReportHtml(report)}
    ${report.partners?.length ? '<section class="report-partners"><h3>'+partnerText('今日伙伴贡献','Today’s partner contributions')+'</h3><ul>'+report.partners.map(p=>'<li>'+(partnerDefinition(p.id)?.name[getLocale()] ?? '')+' · '+text('report.partnerJobs',{n:p.jobs})+' · '+p.xp+' XP'+(p.unlocked?' · '+text('report.partnerNewStories',{n:p.unlocked}):'')+'</li>').join('')+'</ul></section>' : ''}
    <details class="report-details">
      <summary>${text('report.details')}</summary>
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
    </details>`;
  return { body, recommendedTab: advice.action.tab, advice };
}
