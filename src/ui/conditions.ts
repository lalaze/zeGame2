import { conditionDef, conditionOn, dishMood, todayCondition, type ConditionDef, type ConditionTaste } from '../game/conditions';
import type { ItemId } from '../game/data';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const tasteName = (taste: ConditionTaste) =>
  t((taste === 'iced' || taste === 'bakery' ? `condition.taste.${taste}` : `moment.flavor.${taste}`) as MessageKey);
const pct = (multiplier: number) => Math.round(Math.abs(multiplier - 1) * 100);

export const conditionName = (condition: ConditionDef) => t(`condition.${condition.id}.name` as MessageKey);

/** Every effect of a day, in the player's words, straight from its numbers. */
export function conditionEffects(condition: ConditionDef): string[] {
  const lines: string[] = [];
  if (condition.favored.length) lines.push(t('condition.popular', { items: condition.favored.map(tasteName).join(t('list.sep')) }));
  if (condition.less.length) lines.push(t('condition.lessPopular', { items: condition.less.map(tasteName).join(t('list.sep')) }));
  if (condition.traffic !== 1) lines.push(t(condition.traffic > 1 ? 'condition.traffic.more' : 'condition.traffic.fewer', { pct: pct(condition.traffic) }));
  if (condition.matchBonus > 0) lines.push(t('condition.match', { pct: Math.round(condition.matchBonus * 100) }));
  if (condition.patience > 0) lines.push(t('condition.patience', { n: condition.patience }));
  if (condition.seating !== 1) lines.push(t(condition.seating > 1 ? 'condition.seating.more' : 'condition.seating.fewer'));
  return lines;
}

/** The day's card at the top of the menu preparation. Nothing on a fair day. */
export function prepConditionHtml(state: GameState, menu: readonly { id: ItemId }[]): string {
  const condition = todayCondition(state);
  if (condition.id === 'fair') return '';
  const matched = condition.matchBonus > 0 && menu.some(({ id }) => dishMood(state, id) === 'favored');
  const status = condition.matchBonus > 0
    ? `<p class="note condition-match${matched ? ' on' : ''}">${escape(t(matched ? 'condition.match.yes' : 'condition.match.no', { pct: Math.round(condition.matchBonus * 100) }))}</p>`
    : '';
  return `<section class="prep-condition condition-${condition.id}" aria-label="${escape(t('condition.today', { name: conditionName(condition) }))}">
    <b>${escape(t('condition.today', { name: conditionName(condition) }))}</b>
    <p>${escape(t(`condition.${condition.id}.intro` as MessageKey))}</p>
    ${condition.favored.length ? `<p>${escape(t('condition.popular', { items: condition.favored.map(tasteName).join(t('list.sep')) }))}</p>` : ''}
    <details><summary>${escape(t('prep.details'))}</summary><ul>${conditionEffects(condition).map((line) => `<li>${escape(line)}</li>`).join('')}</ul>${status}</details>
  </section>`;
}

/** A dish row's note: whether today calls for it. */
export function dishConditionHtml(state: GameState, id: ItemId): string {
  const mood = dishMood(state, id);
  return mood ? `<small class="condition-tag ${mood}">${escape(t(`condition.dish.${mood}` as MessageKey))}</small>` : '';
}

/** Tomorrow, for the day's report: its name and what it calls for. Nothing if fair. */
export function tomorrowConditionHtml(state: GameState, day: number): string {
  const condition = conditionDef(conditionOn(state, day + 1));
  if (condition.id === 'fair') return '';
  return `<p class="report-tomorrow"><b>${escape(t('condition.tomorrow', { name: conditionName(condition) }))}</b> ${escape(conditionEffects(condition).slice(0, 2).join(' '))}</p>`;
}

/** Short label for the day clock. Empty on a fair day. */
export function conditionHud(state: GameState): string {
  const condition = todayCondition(state);
  return condition.id === 'fair' ? '' : conditionName(condition);
}
