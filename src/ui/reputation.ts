import type { DayReport } from '../game/day';
import { REVIEW_REASONS, reputationScore, reputationTraffic, reviewAverage, reviewCount, type ReviewSummary } from '../game/reputation';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { showModal } from './modal';

export function trafficPercent(multiplier: number): string {
  const percent = Math.round((multiplier - 1) * 100);
  return percent > 0 ? `+${percent}` : percent < 0 ? `−${Math.abs(percent)}` : '±0';
}

export function updateReputationButton(state: GameState): void {
  const score = state.reputation.recent.length ? t('rating.score', { score: reputationScore(state.reputation).toFixed(2) }) : t('rating.new');
  const traffic = t('rating.traffic', { pct: trafficPercent(reputationTraffic(state.reputation)) });
  const button = document.getElementById('reputation-btn')!;
  document.getElementById('reputation-score')!.textContent = score;
  document.getElementById('reputation-traffic')!.textContent = traffic;
  button.setAttribute('aria-label', `${score} · ${traffic} · ${t('rating.open')}`);
  button.title = t('rating.open');
}

function summaryHtml(summary: ReviewSummary): string {
  const average = reviewAverage(summary);
  if (average === null) return `<p class="note">${t('rating.noReviews')}</p>`;
  const reasons = REVIEW_REASONS.filter((r) => summary.reasons[r]).map((r) =>
    `<li><span>${t(`rating.reason.${r}`)}</span><b>×${summary.reasons[r]}</b></li>`,
  ).join('');
  return `<p>${t('rating.summary', { n: reviewCount(summary), score: average.toFixed(2) })}</p>
    <ul class="review-reasons" aria-label="${t('rating.reasons')}">${reasons}</ul>`;
}

export function ratingReportHtml(report: DayReport): string {
  return `<section class="rating-report"><h3>${t('rating.today')}</h3>${summaryHtml(report.reviews)}
    <p class="rating-result">${report.ratingCount ? t('rating.score', { score: report.rating.toFixed(2) }) : t('rating.new')} · ${t('rating.traffic', { pct: trafficPercent(report.ratingTraffic) })}</p></section>`;
}

export function showReputation(state: GameState): void {
  const recent = state.reputation.recent;
  const score = recent.length ? t('rating.score', { score: reputationScore(state.reputation).toFixed(2) }) : t('rating.new');
  const latest = recent.slice(-5).reverse().map((review) => `<li class="guest-review">
    <div><b>${t('rating.review', { day: review.day, stars: review.stars.toFixed(1) })}</b><span class="review-stars" aria-hidden="true">★★★★★<span style="width:${review.stars / 5 * 100}%">★★★★★</span></span></div>
    <p>${t(`rating.reason.${review.reason}`)}</p>
    ${review.taste !== undefined && review.items?.length ? `<p class="note review-dishes">${t('rating.mealTaste', { items: review.items.map((id) => t(`item.${id}`)).join(t('list.sep')), score: review.taste.toFixed(1) })}</p>` : ''}</li>`).join('');
  showModal({
    title: t('rating.title'),
    body: `<div class="rating-overview"><strong>${score}</strong><span>${t('rating.traffic', { pct: trafficPercent(reputationTraffic(state.reputation)) })}</span></div>
      <p class="note">${t('rating.scope', { n: recent.length })}</p>
      <p class="note">${t('rating.effect')}</p>
      <h3>${t('rating.recent')}</h3>
      ${latest ? `<ul class="guest-reviews">${latest}</ul>` : `<p>${t('rating.empty')}</p>`}
      <details class="rating-rules"><summary>${t('rating.how')}</summary>
        <p class="note">${t('rating.rules')}</p><p class="note">${t('rating.smoothing')}</p><p class="note">${t('rating.fairness')}</p>
      </details>`,
    buttons: [{ label: t('settings.back'), primary: true }],
  });
}
