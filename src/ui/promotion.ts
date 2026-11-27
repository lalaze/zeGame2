import { uiIcon } from './pixel-icons';
import { arrivalCap, arrivalRate, baseArrivalRate, baseTrafficDemand, isTrafficCapped, menuItems, serviceCapacity, servingsLeft } from '../game/economy';
import { formatAccountMoney, formatDuration, formatTransactionMoney as formatMoney } from '../game/format';
import { SECONDS_PER_BUSINESS_HOUR, businessSeconds } from '../game/business-clock';
import { DAY_SECONDS } from '../game/data';
import { PROMOTION_PLANS, bookPromotion, promotionPlan, togglePromotion } from '../game/promotion';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { iconArt } from './icon-art';

/** A platform's mark: the painted picture where the view has one, or the pixel sign. */
function platformArt(platform: 'flash' | 'orange'): string {
  const art = iconArt(`promo:${platform}`);
  return art ? `<img class="promo-art" src="${art}" alt="" width="28" height="28" />` : uiIcon(platform === 'flash' ? 'film' : 'spark');
}

export class PromotionPanel {
  private summary: HTMLElement;
  private pressure: HTMLElement;
  private cappedBadge: HTMLElement;
  private active: HTMLElement;
  private activeName: HTMLElement;
  private activeStatus: HTMLElement;
  private progress: HTMLProgressElement;
  private pause: HTMLButtonElement;
  private rows;

  constructor(root: HTMLElement, private state: GameState, onChange: () => void) {
    // Compact top summary card (blue-tinted): today's cost, pressure, conditional traffic-capped badge.
    const sum = document.createElement('section');
    sum.className = 'promo-sum';
    sum.innerHTML = `<p class="promo-summary"></p><p class="promo-pressure note"></p><span class="promo-capped-badge" hidden></span>`;
    root.append(sum);
    this.summary = sum.querySelector('.promo-summary')!;
    this.pressure = sum.querySelector('.promo-pressure')!;
    this.cappedBadge = sum.querySelector('.promo-capped-badge')!;

    // Active campaign card right below the summary.
    this.active = document.createElement('section');
    this.active.className = 'promo-active';
    this.active.innerHTML = `<h3></h3><p role="status"></p><progress max="1" value="0" aria-label="${t('promo.remaining')}"></progress><button class="pixel-btn small ghost" data-promo-pause></button>`;
    this.activeName = this.active.querySelector('h3')!;
    this.activeStatus = this.active.querySelector('p')!;
    this.progress = this.active.querySelector('progress')!;
    this.pause = this.active.querySelector('button')!;
    this.pause.addEventListener('click', () => { if (togglePromotion(state)) onChange(); });
    root.append(this.active);

    // Rules & risk disclosure fold (holds former title, intro, red risk notice, and rules).
    const help = document.createElement('details');
    help.className = 'pantry-help promo-help';
    help.innerHTML = `<summary>${t('promo.rulesTitle')}</summary><div class="note"><h4>${t('promo.title')}</h4><p>${t('promo.intro')}</p><p class="warn">${t('promo.risk')}</p><p>${t('promo.rules')}</p></div>`;
    root.append(help);

    this.rows = PROMOTION_PLANS.map((plan, index) => {
      if (index === 0 || PROMOTION_PLANS[index - 1].platform !== plan.platform) {
        const header = document.createElement('header');
        header.className = `promo-platform ${plan.platform}`;
        header.innerHTML = `<span class="promo-platform-icon" aria-hidden="true">${platformArt(plan.platform)}</span><div class="promo-platform-text"><h3>${t(`promo.platform.${plan.platform}`)}</h3><p class="note">${t(`promo.platform.${plan.platform}.desc`)}</p></div>`;
        root.append(header);
      }
      const card = document.createElement('section');
      card.className = 'promo-card';
      card.dataset.promo = plan.id;
      card.innerHTML = `<div class="promo-top">
          <div class="promo-info">
            <h4>${t(`promo.${plan.id}`)}</h4>
            <p class="promo-offer">${t('promo.offer', { pct: Math.round(plan.boost * 100), hours: plan.seconds / SECONDS_PER_BUSINESS_HOUR })}</p>
            <p class="promo-estimate note"></p>
          </div>
          <button class="pixel-btn small ubtn promo-book" data-book-promo="${plan.id}">
            <span class="label">${t('promo.bookShort')}</span>
            <span class="ubtn-price"><span class="btn-coin" aria-hidden="true"></span><span class="cost">${formatMoney(plan.cost)}</span></span>
          </button>
        </div>
        <div class="promo-foot">
          <p class="promo-plan-risk note"></p>
          <p class="promo-unavailable note"></p>
        </div>`;
      const btn = card.querySelector('button')!;
      btn.addEventListener('click', () => {
        if (bookPromotion(state, plan.id)) {
          onChange();
          this.active.scrollIntoView({ block: 'nearest' });
        }
      });
      root.append(card);
      return {
        plan, btn,
        estimate: card.querySelector<HTMLElement>('.promo-estimate')!,
        risk: card.querySelector<HTMLElement>('.promo-plan-risk')!,
        unavailable: card.querySelector<HTMLElement>('.promo-unavailable')!,
      };
    });
    this.update();
  }

  update(): void {
    const s = this.state;
    const campaign = s.promotion;
    // Rates are guests per business day, the same unit as the opening forecast.
    const base = baseArrivalRate(s) * DAY_SECONDS;
    const baseDemand = baseTrafficDemand(s);
    const cap = arrivalCap(s);
    const capped = isTrafficCapped(s);
    const capacity = serviceCapacity(s) * DAY_SECONDS;
    const menu = menuItems(s);
    const baseCapped = menu.length > 0 && baseDemand >= cap;
    const emptyStock = menu.some((item) => servingsLeft(s, item.id) < 1);
    this.summary.textContent = t('promo.summary', { cost: formatAccountMoney(s.today.promotionCost) });
    this.pressure.textContent = t(capped ? 'promo.pressureCapped' : 'promo.pressure', { arrivals: Math.round(arrivalRate(s) * DAY_SECONDS), capacity: Math.round(capacity) });
    this.cappedBadge.textContent = capped ? t('promo.cappedBadge') : '';
    this.cappedBadge.hidden = !capped;
    this.active.hidden = !campaign;
    if (campaign) {
      const plan = promotionPlan(campaign.id)!;
      this.activeName.textContent = `${t(`promo.platform.${plan.platform}`)} · ${t(`promo.${plan.id}`)}`;
      const status = campaign.paused ? t('promo.paused') : s.phase === 'open' ? t('promo.running') : t('promo.waiting');
      this.activeStatus.textContent = t('promo.active', { status, time: formatDuration(Math.ceil(businessSeconds(campaign.remaining))), pct: Math.round(plan.boost * 100) });
      this.progress.value = campaign.remaining / plan.seconds;
      this.pause.textContent = t(campaign.paused ? 'promo.resume' : 'promo.pause');
    }
    for (const row of this.rows) {
      const boosted = Math.min(baseDemand * (1 + row.plan.boost), cap) * DAY_SECONDS;
      row.estimate.textContent = t('promo.estimate', { before: Math.round(base), after: Math.round(boosted) });
      const risk = !menu.length ? 'noMenu' : emptyStock ? 'stock' : baseCapped ? 'capped' : boosted > capacity ? 'overload' : boosted > capacity * 0.85 ? 'busy' : 'headroom';
      row.risk.textContent = t(`promo.${risk}`);
      row.risk.classList.toggle('warn', risk !== 'headroom');
      row.btn.disabled = !!campaign || s.phase === 'closing' || !menu.length || s.coins < row.plan.cost;
      row.unavailable.textContent = campaign ? t('promo.oneAtATime') : s.phase === 'closing' ? t('promo.closing') : s.coins < row.plan.cost ? t('promo.insufficient') : '';
      row.unavailable.hidden = !row.unavailable.textContent;
    }
  }
}
