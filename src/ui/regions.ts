import { uiIcon } from './pixel-icons';
import { KITCHEN_COST, kitchenBlock, unlockKitchen } from '../game/kitchen';
import { adjacentArea, isAreaOpen, isRegion, type AreaId, type Direction } from '../game/regions';
import { passageSpot, sceneHeight, kitchenHeight } from '../game/layout';
import { formatTransactionMoney as formatMoney } from '../game/format';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';

export const areaName = (id: AreaId) => t(`area.${id}.name` as MessageKey);

export class RegionsUI {
  private area: 'main' | 'kitchen' = 'main';
  private signature = '';
  /** In place: whether the kitchen's card is up over the café. */
  private offered = false;

  constructor(
    private edges: HTMLElement,
    private card: HTMLElement,
    private getState: () => GameState,
    private onSelect: (area: AreaId) => void,
    /** The main café's staff kitchen remains an interior upgrade. */
    private onUnlock: () => void,
    private onOverview: (show: boolean) => void,
    /** The building shows the kitchen under the café: it is never visited, only offered until it is built. */
    private inPlace = false,
  ) {
    edges.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-direction]');
      if (button) this.move(button.dataset.direction as Direction);
    });
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button[data-later]')) { this.offer(false); return; }
      if (this.shown !== 'kitchen' || !target.closest('button[data-expand]')) return;
      if (unlockKitchen(this.getState())) { this.offered = false; this.onUnlock(); this.update(); }
    });
  }

  /** The room whose card may be up: the one the player is in, or in place the kitchen on offer. */
  private get shown(): 'main' | 'kitchen' {
    return this.inPlace ? (this.offered ? 'kitchen' : 'main') : this.area;
  }

  private offer(show: boolean): void {
    this.offered = show && !isAreaOpen(this.getState(), 'kitchen');
    this.update();
  }

  /** The former panorama entry now opens the street property view. */
  toggleOverview(): void {
    this.onOverview(true);
  }

  move(direction: Direction): void {
    const next = adjacentArea(this.area, direction);
    if (next) this.select(next);
  }

  select(area: AreaId): void {
    if (isRegion(area)) { this.onOverview(true); return; }
    if (this.inPlace && area === 'kitchen') { this.offer(!this.offered); return; }
    this.offered = false;
    const focused = this.edges.contains(document.activeElement) ? document.activeElement as HTMLButtonElement : null;
    this.area = area;
    this.onSelect(area);
    this.update();
    if (focused?.hidden) this.edges.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus({ preventScroll: true });
  }

  update(): void {
    const state = this.getState();
    const shown = this.shown, block = shown === 'kitchen' ? kitchenBlock(state) : null;
    const signature = [shown, state.kitchen, kitchenHeight(), sceneHeight(), block, state.phase,
      areaName('main'), areaName('kitchen')].join('|');
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
      button.hidden = next === null || isRegion(next) || (!isAreaOpen(state, this.area) && !isAreaOpen(state, next))
        // In place there is nowhere to go, only a kitchen still to build.
        || (this.inPlace && isAreaOpen(state, next));
      if (!next || button.hidden) continue;
      button.classList.toggle('locked', !isAreaOpen(state, next));
      button.setAttribute('aria-label', this.inPlace ? t('area.kitchen.unlock') : t(`area.${isAreaOpen(state, next) ? 'go' : 'preview'}.${direction}` as MessageKey, { name: areaName(next) }));
      if (this.inPlace) button.setAttribute('aria-expanded', String(this.offered));
      const point = passageSpot(direction, this.area);
      if (this.area === 'kitchen') point.y += (sceneHeight() - kitchenHeight()) / 2;
      button.style.left = `${point.x / 320 * 100}%`;
      button.style.top = `${point.y / sceneHeight() * 100}%`;
      button.title = button.getAttribute('aria-label')!;
      button.querySelector('.area-destination')!.textContent = areaName(next);
    }
    this.card.hidden = isAreaOpen(state, shown);
    if (!this.card.hidden) this.showKitchenCard(block);
  }

  private showKitchenCard(block: string | null): void {
    const reason = block === 'open' ? t('area.closedOnly') : block === 'coins' ? t('area.saveUp') : t('area.kitchen.ready');
    this.card.innerHTML = `<div class="region-kicker">${t('area.kitchen.kicker')}</div>
      <h2>${areaName('kitchen')}</h2><p>${t(this.inPlace ? 'area.kitchen.below' : 'area.kitchen.desc')}</p>
      <div class="region-benefits"><span>${t('area.kitchen.cook')}</span><span>${t('area.kitchen.fresh')}</span></div>
      <button class="pixel-btn" data-expand ${block ? 'disabled' : ''}>${t('area.kitchen.unlock')} · ${formatMoney(KITCHEN_COST)}</button>
      ${this.inPlace ? `<button class="pixel-btn ghost" data-later>${t('prep.later')}</button>` : ''}
      <small class="region-reason">${reason}</small>`;
  }
}
