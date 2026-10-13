import { uiIcon } from './pixel-icons';
import { arrivalRate, baseArrivalRate, menuItems, serviceCapacity, servingsLeft } from '../game/economy';
import { formatAccountMoney, formatDuration, formatTransactionMoney as formatMoney } from '../game/format';
import { PROMOTION_PLANS, bookPromotion, promotionPlan, togglePromotion } from '../game/promotion';
import type { GameState } from '../game/state';
import { t } from '../i18n';

export class PromotionPanel {
  private summary: HTMLElement;
  private active: HTMLElement;
  private activeName: HTMLElement;
  private activeStatus: HTMLElement;
  private progress: HTMLProgressElement;
  private pause: HTMLButtonElement;
  private pressure: HTMLElement;
  private rows;

  constructor(root: HTMLElement, private state: GameState, onChange: () => void) {
    const intro = document.createElement('section'); intro.className = 'promo-intro';
    intro.innerHTML = `<h3>${t('promo.title')}</h3><p class="note">${t('promo.intro')}</p><p class="promo-summary"></p>
      <p class="promo-pressure note"></p><p class="note warn">${t('promo.risk')}</p>
      <details class="note"><summary>${t('promo.rulesTitle')}</summary><p>${t('promo.rules')}</p></details>`;
    root.append(intro);
    this.summary = intro.querySelector('.promo-summary')!;
    this.pressure = intro.querySelector('.promo-pressure')!;
    this.active = document.createElement('section'); this.active.className = 'promo-active';
    this.active.innerHTML = `<h3></h3><p role="status"></p><progress max="1" value="0" aria-label="${t('promo.remaining')}"></progress><button class="pixel-btn small ghost" data-promo-pause></button>`;
    this.activeName = this.active.querySelector('h3')!;
    this.activeStatus = this.active.querySelector('p')!;
    this.progress = this.active.querySelector('progress')!;
    this.pause = this.active.querySelector('button')!;
    this.pause.addEventListener('click', () => { if (togglePromotion(state)) onChange(); });
    root.append(this.active);
    this.rows = PROMOTION_PLANS.map((plan, index) => {
      if (index === 0 || PROMOTION_PLANS[index - 1].platform !== plan.platform) {
        const header = document.createElement('header'); header.className = `promo-platform ${plan.platform}`;
        header.innerHTML = `<span aria-hidden="true">${uiIcon(plan.platform === 'flash' ? 'film' : 'spark')}</span><div><h3>${t(`promo.platform.${plan.platform}`)}</h3><p class="note">${t(`promo.platform.${plan.platform}.desc`)}</p></div>`;
        root.append(header);
      }
      const card = document.createElement('section'); card.className = 'promo-card'; card.dataset.promo = plan.id;
      card.innerHTML = `<h4>${t(`promo.${plan.id}`)}</h4><p class="promo-offer">${t('promo.offer', { pct: Math.round(plan.boost * 100), minutes: plan.seconds / 60 })}</p>
        <p class="promo-estimate note"></p><p class="promo-plan-risk note"></p><p class="promo-unavailable note"></p>
        <button class="pixel-btn small" data-book-promo="${plan.id}">${t('promo.book', { cost: formatMoney(plan.cost) })}</button>`;
      const btn = card.querySelector('button')!;
      btn.addEventListener('click', () => {
        if (bookPromotion(state, plan.id)) {
          onChange();
          this.active.scrollIntoView({ block: 'nearest' });
        }
      });
      root.append(card);
      return { plan, btn, estimate: card.querySelector<HTMLElement>('.promo-estimate')!, risk: card.querySelector<HTMLElement>('.promo-plan-risk')!, unavailable: card.querySelector<HTMLElement>('.promo-unavailable')! };
    });
    this.update();
  }

  update(): void {
    const s = this.state;
    const campaign = s.promotion;
    const base = baseArrivalRate(s) * 60;
    const capacity = serviceCapacity(s) * 60;
    const menu = menuItems(s);
    const emptyStock = menu.some((item) => servingsLeft(s, item.id) < 1);
    this.summary.textContent = t('promo.summary', { cost: formatAccountMoney(s.today.promotionCost) });
    this.pressure.textContent = t('promo.pressure', { arrivals: (arrivalRate(s) * 60).toFixed(1), capacity: capacity.toFixed(1) });
    this.active.hidden = !campaign;
    if (campaign) {
      const plan = promotionPlan(campaign.id)!;
      this.activeName.textContent = `${t(`promo.platform.${plan.platform}`)} · ${t(`promo.${plan.id}`)}`;
      const status = campaign.paused ? t('promo.paused') : s.phase === 'open' ? t('promo.running') : t('promo.waiting');
      this.activeStatus.textContent = t('promo.active', { status, time: formatDuration(Math.ceil(campaign.remaining)), pct: Math.round(plan.boost * 100) });
      this.progress.value = campaign.remaining / plan.seconds;
      this.pause.textContent = t(campaign.paused ? 'promo.resume' : 'promo.pause');
    }
    for (const row of this.rows) {
      const boosted = base * (1 + row.plan.boost);
      row.estimate.textContent = t('promo.estimate', { before: base.toFixed(1), after: boosted.toFixed(1) });
      const risk = !menu.length ? 'noMenu' : emptyStock ? 'stock' : boosted > capacity ? 'overload' : boosted > capacity * 0.85 ? 'busy' : 'headroom';
      row.risk.textContent = t(`promo.${risk}`);
      row.risk.classList.toggle('warn', risk !== 'headroom');
      row.btn.disabled = !!campaign || s.phase === 'closing' || !menu.length || s.coins < row.plan.cost;
      row.unavailable.textContent = campaign ? t('promo.oneAtATime') : s.phase === 'closing' ? t('promo.closing') : s.coins < row.plan.cost ? t('promo.insufficient') : '';
      row.unavailable.hidden = !row.unavailable.textContent;
    }
  }
}
