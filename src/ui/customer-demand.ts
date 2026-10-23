import { conditionName, conditionEffects } from './conditions';
import { demandEnabled, demandPlan, guestAffinity, GUEST_KINDS, type GuestKind } from '../game/customer-demand';
import { conditionOn, todayCondition } from '../game/conditions';
import type { MenuItemDef } from '../game/data';
import type { DayReport } from '../game/day';
import type { GameState } from '../game/state';
import { formatAccountMoney } from '../game/format';
import { t, type MessageKey } from '../i18n';

const text = (key: string, params?: Record<string, number | string>) => t(key as MessageKey, params);
const name = (kind: GuestKind) => text(`demand.kind.${kind}`);
const suitability = (coverage: number) => text(coverage >= .8 ? 'demand.good' : coverage >= .5 ? 'demand.some' : 'demand.limited');

export function prepDemandHtml(state: GameState, items: readonly MenuItemDef[]): string {
  if (!demandEnabled(state)) return '';
  const plan = demandPlan(state, items);
  const condition = todayCondition(state);
  const suited = plan.guests.filter(guest => guest.coverage >= .8).map(guest => name(guest.kind));
  return `<section class="prep-demand prep-condition condition-${condition.id}" aria-label="${t('demand.title')}">
    <b>${condition.id === 'fair' ? t('demand.title') : `${conditionName(condition)} · ${t('demand.title')}`}</b><p>${text(`demand.hint.${condition.id}`)}</p>
    <p class="note demand-match">${!items.length ? t('demand.empty') : suited.length ? t('demand.suited', { groups: suited.join(t('list.sep')) }) : t('demand.limitedMenu')}</p>
    <details class="demand-details"><summary data-focus="demand-details">${t('demand.details')}</summary>
      <p class="note">${t('demand.explain')}</p>
      ${plan.guests.map(guest => `<div class="demand-group"><b>${name(guest.kind)}</b><span>${suitability(guest.coverage)} · ${t('demand.share', { pct: Math.round(guest.share * 100) })}</span><p class="note">${text(`demand.wants.${guest.kind}`)}</p></div>`).join('')}
      ${conditionEffects(condition).length ? `<ul class="note">${conditionEffects(condition).map(effect => `<li>${effect}</li>`).join('')}</ul>` : ''}
      <p class="note">${t('demand.forecastNote')}</p>
    </details>
  </section>`;
}

export function dishDemandHtml(state: GameState, item: MenuItemDef): string {
  if (!demandEnabled(state)) return '';
  const kinds = GUEST_KINDS.filter(kind => guestAffinity(kind, item) >= .8);
  return kinds.length ? `<small class="demand-dish">${t('demand.dish', { groups: kinds.map(name).join(t('list.sep')) })}</small>` : '';
}

export function tomorrowDemandHtml(state: GameState, day: number): string {
  if (!demandEnabled({ day: day + 1 })) return '';
  return `<p class="report-demand-tomorrow"><b>${t('demand.tomorrow')}</b> ${text(`demand.hint.${conditionOn(state, day + 1)}`)}</p>`;
}

/** Observations only. Unattributed legacy visits and full-door turnaways stay in the general ledger. */
export function demandReportHtml(report: DayReport): string {
  const groups = GUEST_KINDS.filter(kind => report.guests[kind].arrived > 0);
  if (!groups.length) return '';
  const best = [...groups].sort((a, b) => report.guests[b].served - report.guests[a].served)[0];
  return `<section class="report-demand" aria-label="${t('demand.report')}">
    <b>${t('demand.report')}</b>
    <p>${report.guests[best].served ? t('demand.reportBest', { group: name(best), n: report.guests[best].served }) : t('demand.noService')}</p>
    <details><summary>${t('demand.reportDetails')}</summary>
      ${groups.map(kind => {
        const stats = report.guests[kind];
        return `<div class="demand-group"><b>${name(kind)}</b>
          <p>${t('demand.results', { arrived: stats.arrived, served: stats.served, paired: stats.paired, money: formatAccountMoney(stats.revenue) })}</p>
          ${stats.stockLost || stats.waitLost ? `<p class="note">${t('demand.losses', { stock: stats.stockLost, wait: stats.waitLost })}</p>` : ''}
          ${stats.cancelled || stats.dismissed ? `<p class="note">${t('demand.closed', { cancelled: stats.cancelled, dismissed: stats.dismissed })}</p>` : ''}
        </div>`;
      }).join('')}
      <p class="note">${t('demand.observedOnly')}</p>
    </details>
  </section>`;
}
