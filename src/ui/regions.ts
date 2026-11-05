import { uiIcon } from './pixel-icons';
import { KITCHEN_COST, kitchenBlock, unlockKitchen } from '../game/kitchen';
import { AREA_IDS, REGIONS, adjacentArea, buildSeconds, constructionLeft, isAreaOpen, isRegion, regionBlock, regionDef, startConstruction, type AreaId, type Direction, type RegionId } from '../game/regions';
import { passageSpot, sceneHeight, kitchenHeight } from '../game/layout';
import { formatDuration, formatTransactionMoney as formatMoney } from '../game/format';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';

export const areaName = (id: AreaId) => t(`area.${id}.name` as MessageKey);

export class RegionsUI {
  private area: AreaId = 'main';
  private signature = '';
  private overview = false;

  constructor(
    private edges: HTMLElement,
    private card: HTMLElement,
    private getState: () => GameState,
    private onSelect: (area: AreaId) => void,
    /** The kitchen opened at once, or a room was paid for and is being built (or booked). */
    private onUnlock: (result: { kind: 'opened' } | { kind: 'building'; id: RegionId; booked: boolean }) => void,
    private onOverview: (show: boolean) => void,
  ) {
    edges.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-direction]');
      if (button) this.move(button.dataset.direction as Direction);
    });
    card.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button[data-expand]') || this.area === 'main') return;
      const state = this.getState(), area = this.area;
      if (isRegion(area)) {
        const booked = state.construction.length > 0;
        if (!startConstruction(state, area, Date.now())) return;
        this.onUnlock({ kind: 'building', id: area, booked });
      } else if (unlockKitchen(state)) this.onUnlock({ kind: 'opened' });
      else return;
      this.update();
    });
  }

  /** Toggle the building view from the panorama control. */
  toggleOverview(): void {
    this.overview = !this.overview;
    this.onOverview(this.overview);
    this.update();
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
    // Build countdowns refresh once a minute.
    const left = isRegion(this.area) && block === 'building' ? Math.ceil(constructionLeft(state, Date.now(), this.area) / 60) : 0;
    const signature = [this.area, this.overview, state.regions.join(','), state.kitchen, kitchenHeight(), sceneHeight(), block, left, state.phase === 'prep', state.construction.map((c) => c.id).join(','), ...AREA_IDS.map(areaName)].join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.edges.setAttribute('aria-label', t('area.nav'));
    // Stable controls preserve focus while money and room status update.
    if (!this.edges.children.length) {
      for (const direction of ['left', 'right', 'up', 'down'] as const) {
        const button = document.createElement('button');
        button.className = `area-arrow area-${direction}`;
        button.dataset.direction = String(direction);
        button.setAttribute('aria-controls', 'scene-area');
        button.innerHTML = `<span class="area-arrow-sign">${uiIcon('arrow')}</span><span class="area-destination"></span>`;
        this.edges.append(button);
      }
    }
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
    const time = formatDuration(buildSeconds(state, this.area));
    const ahead = state.construction.findIndex((c) => c.id === this.area);
    const reason = block === 'building'
      ? left > 0 ? ahead > 0 ? t('area.booked', { name: areaName(state.construction[ahead - 1].id), time: formatDuration(left * 60) }) : t('area.building', { time: formatDuration(left * 60) }) : t('area.builtWaiting')
      : block === 'previous' ? t('area.previous', { name: areaName(previous.id) })
      : block === 'busy' ? t('area.busy', { name: areaName(previous.id) })
      : block === 'open' ? t('area.closedOnly') : block === 'coins' ? t('area.saveUp') : t('area.ready');
    const label = block === 'building' ? ahead > 0 ? t('area.bookedShort') : t('area.building', { time: formatDuration(Math.max(60, left * 60)) })
      : t(state.construction.length ? 'area.book' : 'area.build', { time, money: formatMoney(def.cost) });
    this.card.innerHTML = `<div class="region-kicker">${t('area.future', { n: AREA_IDS.indexOf(this.area) })}</div>
      <h2>${areaName(this.area)}</h2><p>${t(`area.${this.area}.desc` as MessageKey)}</p>
      <div class="region-benefits"><span>${t('area.addTables', { n: def.tables })}</span><span>${t('area.demand', { n: Math.round(def.demand * 100) })}</span><span>${t('area.buildTime', { time })}</span></div>
      <p class="note">${t('area.serviceDistance')}</p>
      <button class="pixel-btn" data-expand ${block ? 'disabled' : ''}>${label}</button>
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
