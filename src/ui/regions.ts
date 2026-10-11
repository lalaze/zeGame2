import { KITCHEN_COST, kitchenBlock, unlockKitchen } from '../game/kitchen';
import { AREA_IDS, REGIONS, adjacentArea, isAreaOpen, isRegion, regionBlock, regionDef, unlockRegion, type AreaId, type Direction } from '../game/regions';
import { passageSpot, sceneHeight, kitchenHeight } from '../game/layout';
import { formatMoney } from '../game/format';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';

export const areaName = (id: AreaId) => t(`area.${id}.name` as MessageKey);

export class RegionsUI {
  private area: AreaId = 'main';
  private signature = '';
  private overview = false;

  constructor(
    private nav: HTMLElement,
    private edges: HTMLElement,
    private card: HTMLElement,
    private getState: () => GameState,
    private onSelect: (area: AreaId) => void,
    private onUnlock: () => void,
    private onOverview: (show: boolean) => void,
  ) {
    nav.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.area-plan-toggle')) return;
      this.overview = !this.overview;
      this.onOverview(this.overview);
      this.update();
    });
    edges.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-direction]');
      if (button) this.move(button.dataset.direction as Direction);
    });
    card.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button[data-expand]') || this.area === 'main') return;
      const state = this.getState();
      if (isRegion(this.area) ? unlockRegion(state, this.area) : unlockKitchen(state)) {
        this.onUnlock();
        this.update();
      }
    });
  }

  move(direction: Direction): void {
    const next = adjacentArea(this.area, direction);
    if (next) this.select(next);
  }

  select(area: AreaId): void {
    const focused = this.edges.contains(document.activeElement) ? document.activeElement as HTMLButtonElement : null;
    this.area = area;
    this.overview = false;
    this.onSelect(area);
    this.update();
    if (focused?.hidden) this.edges.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus({ preventScroll: true });
  }

  update(): void {
    const state = this.getState();
    const block = isRegion(this.area) ? regionBlock(state, this.area) : this.area === 'kitchen' ? kitchenBlock(state) : null;
    const signature = [this.area, this.overview, state.regions.join(','), state.kitchen, kitchenHeight(), sceneHeight(), block, ...AREA_IDS.map(areaName)].join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.edges.setAttribute('aria-label', t('area.nav'));
    // Stable controls preserve focus while money and room status update.
    if (!this.nav.children.length) {
      this.nav.innerHTML = '<button class="area-plan-toggle" aria-controls="scene-area"><svg viewBox="0 0 16 14" aria-hidden="true"><path d="M0 2h2V1h3V0h2v1h3v1h2V1h2V0h2v12h-2v1h-3v1H9v-1H6v-1H4v1H2v1H0z" fill="currentColor"/><path d="M2 3h3v7H4v1H2zm5 0h2v1h2v7H9v-1H7zm6-1h1v9h-1v1h-1V3h1z" fill="#f9e4bf"/></svg><span class="area-map-label"></span></button>';
      for (const direction of ['left', 'right', 'up', 'down'] as const) {
        const button = document.createElement('button');
        button.className = `area-arrow area-${direction}`;
        button.dataset.direction = String(direction);
        button.setAttribute('aria-controls', 'scene-area');
        button.innerHTML = '<span class="area-arrow-sign"><svg viewBox="0 0 7 11" aria-hidden="true"><path d="M0 0h2v2h2v2h2v3H4v2H2v2H0V8h2V6h2V5H2V3H0z" fill="currentColor"/></svg></span><span class="area-destination"></span>';
        this.edges.append(button);
      }
    }
    const toggle = this.nav.querySelector<HTMLButtonElement>('.area-plan-toggle')!;
    toggle.setAttribute('aria-pressed', String(this.overview));
    toggle.setAttribute('aria-label', t('area.viewAll'));
    toggle.title = t(this.overview ? 'area.returnRoom' : 'area.viewAll');
    toggle.querySelector('.area-map-label')!.textContent = t('area.viewAll');
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      const button = this.edges.querySelector<HTMLButtonElement>(`[data-direction="${direction}"]`)!;
      const next = adjacentArea(this.area, direction);
      // From a room that isn't open yet, the only way is back to an open one.
      button.hidden = next === null || (!isAreaOpen(state, this.area) && !isAreaOpen(state, next));
      if (!next || button.hidden) continue;
      button.classList.toggle('locked', !isAreaOpen(state, next));
      button.setAttribute('aria-label', t(`area.${isAreaOpen(state, next) ? 'go' : 'preview'}.${direction}` as MessageKey, { name: areaName(next) }));
      const point = passageSpot(direction, this.area);
      if (this.area === 'kitchen') point.y += (sceneHeight() - kitchenHeight()) / 2;
      button.style.left = `${point.x / 320 * 100}%`;
      button.style.top = `${point.y / sceneHeight() * 100}%`;
      button.title = button.getAttribute('aria-label')!;
      button.querySelector('.area-destination')!.textContent = areaName(next);
    }
    this.card.hidden = isAreaOpen(state, this.area);
    if (this.area === 'main' || this.card.hidden) return;
    if (!isRegion(this.area)) {
      this.showKitchenCard(block);
      return;
    }
    const def = regionDef(this.area);
    const previous = REGIONS[REGIONS.indexOf(def) - 1];
    const reason = block === 'previous' ? t('area.previous', { name: areaName(previous.id) })
      : block === 'open' ? t('area.closedOnly') : block === 'coins' ? t('area.saveUp') : t('area.ready');
    this.card.innerHTML = `<div class="region-kicker">${t('area.future', { n: AREA_IDS.indexOf(this.area) })}</div>
      <h2>${areaName(this.area)}</h2><p>${t(`area.${this.area}.desc` as MessageKey)}</p>
      <div class="region-benefits"><span>${t('area.addTables', { n: def.tables })}</span><span>${t('area.demand', { n: Math.round(def.demand * 100) })}</span></div>
      <p class="note">${t('area.serviceDistance')}</p>
      <button class="pixel-btn" data-expand ${block ? 'disabled' : ''}>${t('area.unlock')} · ${formatMoney(def.cost)}</button>
      <small class="region-reason">${reason}</small>`;
  }

  private showKitchenCard(block: string | null): void {
    const reason = block === 'open' ? t('area.closedOnly') : block === 'coins' ? t('area.saveUp') : t('area.kitchen.ready');
    this.card.innerHTML = `<div class="region-kicker">${t('area.kitchen.kicker')}</div>
      <h2>${areaName('kitchen')}</h2><p>${t('area.kitchen.desc')}</p>
      <div class="region-benefits"><span>${t('area.kitchen.cook')}</span><span>${t('area.kitchen.fresh')}</span></div>
      <button class="pixel-btn" data-expand ${block ? 'disabled' : ''}>${t('area.kitchen.unlock')} · ${formatMoney(KITCHEN_COST)}</button>
      <small class="region-reason">${reason}</small>`;
  }
}
