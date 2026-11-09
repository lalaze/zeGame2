import './streets.css';
import './street-pixel.css';
import { streetIcon } from './street-icons';
import { BUSINESSES, STREETS, STREET_PLOTS, businessDef, buyStreetPlot, collectStreetShop, collectStreetShops, fitOutBlock, fitOutPrice, fitOutSeconds, fitOutStreetPlot, ownedPlotCount, plotPrice, plotPurchaseBlock, setStreetSchedule, streetDef, streetLotId, streetLotIds, streetProduction, streetUnlocked, streetUpgradePrice, streetYieldMultiplier, upgradeStreetShop, type PlotId } from '../game/streets';
import { PROJECT_MODES, projectCapacity, projectCycleSeconds, projectDef, type ProjectMode } from '../game/room-projects';
import { cafeLocation, type LocationId } from '../game/locations';
import type { AreaId, RegionId } from '../game/regions';
import type { GameState } from '../game/state';
import { formatDuration, formatTransactionMoney as money } from '../game/format';
import { streetSceneryArt, streetShopArt, streetSpriteUrl, styleStreetShop } from '../render/street-art';
import { t, type MessageKey } from '../i18n';
import { closeModal, showModal, toast } from './modal';
import { showRoomProjects } from './room-projects';

export const streetName = (id: LocationId) => t(`street.${id}.name` as MessageKey);
export const businessName = (id: RegionId) => t(`street.business.${id}` as MessageKey);
let live: { body: HTMLElement; update: () => void } | null = null;
export function updateStreetMap(): void {
  if (!live?.body.isConnected) { live = null; return; }
  live.update();
}
export function streetEntryLabel(s: GameState, now: number): string {
  const ready = streetLotIds(s).filter(id => streetProduction(s, id, now).batches > 0).length;
  return t(ready ? 'street.entryReady' : 'street.entry', { n: ready });
}

/** The street is the expansion screen. Interior navigation stays inside the café. */
export function showStreetMap(s: GameState, changed: () => void, visit?: (area: AreaId) => void): void {
  let street = s.streets.selected, selected: PlotId = '01', business: RegionId = 'reading';
  let detailOpen = false;
  let actionReadyAt = 0, guardTimer = 0;
  let pending: { kind: 'land' | 'fitout'; street: LocationId; plot: PlotId; business: RegionId } | null = null;
  const body = document.createElement('div'); body.className = 'street-view';
  body.innerHTML = `<header class="street-toolbar"><button class="chip" data-street-home>${streetIcon('left')}<span>${t('street.back')}</span></button><strong data-street-wallet></strong><button class="chip" data-street-research>${streetIcon('book')}<span>${t('street.blueprints')}</span></button></header>
    <nav class="street-choices" aria-label="${t('street.choose')}"></nav>
    <div class="street-summary"><div><strong data-street-name></strong><p data-street-description></p></div><button class="chip" data-street-collect-all></button></div>
    <div class="street-layout"><div class="street-panorama" role="region" tabindex="0" aria-label="${t('street.panorama')}" aria-describedby="street-walk-hint"><div class="street-scenery">
      <div class="street-skyline" aria-hidden="true">${streetSceneryArt()}</div><div class="street-storefronts"></div><div class="street-pavement" aria-hidden="true"></div><div class="street-road" aria-hidden="true"></div>
      </div></div>
      <div class="street-walk-controls"><button class="chip" data-street-prev aria-label="${t('street.walkLeft')}">${streetIcon('left')}</button><p id="street-walk-hint">${t('street.mapNote')}<small data-street-guidance></small></p><button class="chip" data-street-next aria-label="${t('street.walkRight')}">${streetIcon('right')}</button></div>
      <section id="street-detail-panel" class="street-detail" aria-labelledby="street-detail-title" hidden><button class="street-detail-close chip" data-street-detail-close aria-label="${t('street.closeDetail')}">${streetIcon('close')}</button><p class="street-eyebrow" data-street-address></p><h3 id="street-detail-title"></h3><p class="street-detail-status" data-street-status></p>
      <div class="street-detail-operations"><div data-street-choose-business><label for="street-business">${t('street.businessLabel')}</label><div class="street-select-wrap"><select id="street-business"></select><span class="street-select-arrow" aria-hidden="true">${streetIcon('down')}</span></div><p class="note" data-street-business-description></p></div>
      <p class="street-price-breakdown" data-street-prices></p><p class="street-income" data-street-income></p><progress max="1" value="0" aria-label="${t('projects.progress')}"></progress>
      <div class="street-schedules" role="group" aria-label="${t('projects.schedule')}"></div><p class="note" data-street-schedule-note>${t('projects.restartHint')}</p>
      <div class="street-actions"><button class="pixel-btn" data-street-buy></button><button class="pixel-btn" data-street-fitout></button><button class="pixel-btn" data-street-collect></button><button class="pixel-btn ghost" data-street-upgrade></button></div>
      <p class="street-reason note" id="street-action-reason" role="status"></p></div>
      <div class="street-confirm" data-street-confirm hidden role="group" aria-labelledby="street-confirm-title"><h4 id="street-confirm-title">${t('street.confirmTitle')}</h4><p data-street-confirm-quote></p><p class="note">${t('street.confirmHint')}</p><div class="street-actions"><button class="pixel-btn ghost" data-street-confirm-cancel>${t('street.cancelPayment')}</button><button class="pixel-btn" data-street-confirm-accept></button></div></div></section></div>`;
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => body.querySelector<T>(selector)!;
  const select = get<HTMLSelectElement>('#street-business');
  for (const def of BUSINESSES) { const option = document.createElement('option'); option.value = def.id; option.textContent = businessName(def.id); select.append(option); }
  const buttons = new Map<LocationId, HTMLButtonElement>();
  for (const def of STREETS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'street-choice'; button.dataset.street = def.id;
    button.innerHTML = `<i class="street-route-marker" aria-hidden="true">${streetIcon('flag')}${streetIcon('lock')}</i><span></span><small></small>`;
    button.querySelector('span')!.textContent = streetName(def.id);
    button.addEventListener('click', () => {
      closeDetail(false); street = def.id; selected = '01'; s.streets.selected = street; rebuildStreet(); changed(); update();
    });
    get('.street-choices').append(button); buttons.set(def.id, button);
  }
  const shops = new Map<PlotId, { button: HTMLButtonElement; art: HTMLElement; label: HTMLElement; state: HTMLElement; signature: string }>();
  const goHome = () => { closeModal(); visit?.('main'); };
  get('[data-street-home]').addEventListener('click', goHome);
  const panorama = get('.street-panorama'), detail = get('.street-detail');
  const actionReady = () => performance.now() >= actionReadyAt;
  // Every new surface gets a fresh guard, independent of pointer click count.
  // A second explicit confirmation is required before either expenditure.
  function guardActions(): void {
    actionReadyAt = performance.now() + 600;
    clearTimeout(guardTimer);
    guardTimer = window.setTimeout(() => { if (body.isConnected) update(); }, 610);
  }
  function clearConfirmation(): void {
    pending = null; get('[data-street-confirm]').hidden = true;
    get('.street-detail-operations').hidden = false;
  }
  function cancelPayment(): void {
    clearConfirmation(); guardActions(); update();
    get('[data-street-detail-close]').focus({ preventScroll: true });
  }
  function closeDetail(restore = true): void {
    clearConfirmation(); clearTimeout(guardTimer);
    detailOpen = false; detail.hidden = true;
    if (restore) shops.get(selected)?.button.focus({ preventScroll: true });
    update();
  }
  get('[data-street-detail-close]').addEventListener('click', () => closeDetail());
  body.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (pending) cancelPayment(); else if (detailOpen) closeDetail(); else goHome();
    }
    if (detailOpen && event.key === 'Tab' && detail.contains(document.activeElement)) {
      const items = [...detail.querySelectorAll<HTMLElement>('button, select')].filter(el => !el.closest('[hidden]') && !el.matches(':disabled'));
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length - 1) {
        event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus();
      }
    }
    if (event.repeat && ['Enter', ' '].includes(event.key) && (event.target as HTMLElement).closest('.street-detail button')) {
      event.preventDefault(); event.stopPropagation();
    }
    const storefront = (event.target as HTMLElement).closest<HTMLButtonElement>('.street-shop');
    if (storefront && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const neighbors = [...get('.street-storefronts').querySelectorAll<HTMLButtonElement>('.street-shop')];
      const index = neighbors.indexOf(storefront);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? neighbors.length - 1 : Math.max(0, Math.min(neighbors.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
      neighbors[next].focus({ preventScroll: true });
      neighbors[next].scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'instant' });
    }
    if (event.target === panorama && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      panorama.scrollLeft = event.key === 'Home' ? 0 : event.key === 'End' ? panorama.scrollWidth : panorama.scrollLeft + (event.key === 'ArrowLeft' ? -280 : 280);
    }
  });
  let drag: { x: number; scroll: number; pointer: number } | null = null, dragged = false;
  panorama.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, scroll: panorama.scrollLeft, pointer: event.pointerId }; dragged = false;
  });
  panorama.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const delta = event.clientX - drag.x;
    if (Math.abs(delta) > 8) {
      dragged = true; panorama.classList.add('is-dragging');
      panorama.setPointerCapture?.(event.pointerId);
    }
    if (dragged) { event.preventDefault(); panorama.scrollLeft = drag.scroll - delta; }
  });
  const endDrag = () => { drag = null; panorama.classList.remove('is-dragging'); };
  panorama.addEventListener('pointerup', endDrag);
  panorama.addEventListener('pointercancel', () => { endDrag(); dragged = false; });
  panorama.addEventListener('click', event => {
    if (dragged && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); dragged = false; return; }
    if (detailOpen && !(event.target as HTMLElement).closest('.street-shop')) { closeDetail(false); panorama.focus({ preventScroll: true }); }
  }, true);
  for (const [selector, direction] of [['[data-street-prev]', -1], ['[data-street-next]', 1]] as const) get(selector).addEventListener('click', () => {
    panorama.scrollBy({ left: direction * Math.max(280, panorama.clientWidth * .7), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  function rebuildStreet(): void {
    const palette = streetDef(street); body.dataset.sceneStreet = street;
    get('.street-scenery').style.width = `calc(${street === cafeLocation(s) ? 6 : 5} * var(--plot-pitch) + 36px)`;
    for (const key of ['wall', 'trim', 'roof', 'accent', 'sky', 'paving'] as const) body.style.setProperty(`--street-${key}`, palette[key]);
    const strip = get('.street-storefronts'); strip.replaceChildren(); shops.clear();
    if (street === cafeLocation(s)) {
      const home = document.createElement('button'); home.className = 'street-shop street-home'; home.type = 'button';
      home.innerHTML = `<span class="street-shop-art">${streetShopArt(street, 'cafe', 'open')}</span><span class="street-shop-sign">${t('street.home')}</span><span class="street-shop-caption"><strong>${t('street.home')}</strong><small>${t('street.visitHome')}</small></span>`;
      styleStreetShop(home, street, 'cafe');
      home.addEventListener('click', goHome); strip.append(home);
    }
    for (const plot of STREET_PLOTS) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'street-shop'; button.dataset.plot = plot.id;
      button.innerHTML = '<span class="street-shop-art"></span><span class="street-shop-sign"></span><span class="street-shop-caption"><strong></strong><small></small></span>';
      button.style.setProperty('--guest', `url("${streetSpriteUrl('guest-2')}")`);
      button.addEventListener('click', () => {
        clearConfirmation(); selected = plot.id; detailOpen = true; detail.hidden = false; guardActions(); update();
        get('[data-street-detail-close]').focus({ preventScroll: true });
      });
      strip.append(button);
      shops.set(plot.id, { button, art: button.querySelector('.street-shop-art')!, label: button.querySelector('.street-shop-caption strong')!, state: button.querySelector('small')!, signature: '' });
    }
    get('.street-panorama').scrollLeft = 0;
  }
  const finish = () => { changed(); update(); };
  const notifyReward = (r: { coins: number; inspiration: number }) => toast(t('projects.collected', { money: money(r.coins), n: r.inspiration }));
  select.addEventListener('change', () => { clearConfirmation(); business = select.value as RegionId; update(); });
  for (const mode of Object.keys(PROJECT_MODES) as ProjectMode[]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'chip'; button.dataset.streetMode = mode;
    button.addEventListener('click', () => { if (setStreetSchedule(s, streetLotId(street, selected), mode, Date.now())) finish(); });
    get('.street-schedules').append(button);
  }
  function requestPayment(kind: 'land' | 'fitout'): void {
    if (!detailOpen || !actionReady() || pending) return;
    if (kind === 'land' ? plotPurchaseBlock(s, street, selected) : fitOutBlock(s, streetLotId(street, selected), business)) return;
    pending = { kind, street, plot: selected, business };
    get('.street-detail-operations').hidden = true; get('[data-street-confirm]').hidden = false;
    const price = kind === 'land' ? plotPrice(street, selected) : fitOutPrice(business);
    get('[data-street-confirm-quote]').textContent = t(kind === 'land' ? 'street.confirmLand' : 'street.confirmFitout', { street: streetName(street), plot: selected, business: businessName(business), money: money(price), time: formatDuration(fitOutSeconds(s, business)) });
    get('[data-street-confirm-accept]').textContent = t('street.confirmPay', { money: money(price) });
    guardActions(); update(); get('[data-street-confirm-cancel]').focus({ preventScroll: true });
  }
  get('[data-street-buy]').addEventListener('click', () => requestPayment('land'));
  get('[data-street-fitout]').addEventListener('click', () => requestPayment('fitout'));
  get('[data-street-confirm-cancel]').addEventListener('click', cancelPayment);
  get('[data-street-confirm-accept]').addEventListener('click', () => {
    if (!pending || !detailOpen || !actionReady() || pending.street !== street || pending.plot !== selected || pending.business !== business) return;
    const kind = pending.kind;
    const success = kind === 'land' ? buyStreetPlot(s, street, selected, Date.now()) : fitOutStreetPlot(s, streetLotId(street, selected), business, Date.now());
    clearConfirmation(); guardActions();
    if (success) {
      toast(kind === 'land' ? t('street.bought', { name: streetName(street), n: selected }) : t('street.fitting', { name: businessName(business) }));
      finish();
      (kind === 'land' ? select : get('[data-street-detail-close]')).focus({ preventScroll: true });
    } else update();
  });
  get<HTMLButtonElement>('[data-street-collect]').addEventListener('click', () => { const r = collectStreetShop(s, streetLotId(street, selected), Date.now()); if (r.batches) { notifyReward(r); finish(); } });
  get<HTMLButtonElement>('[data-street-collect-all]').addEventListener('click', () => { notifyReward(collectStreetShops(s, Date.now())); finish(); });
  get<HTMLButtonElement>('[data-street-upgrade]').addEventListener('click', () => { if (upgradeStreetShop(s, streetLotId(street, selected), Date.now())) finish(); });
  get<HTMLButtonElement>('[data-street-research]').addEventListener('click', () => showRoomProjects(s, changed, undefined, () => showStreetMap(s, changed, visit)));
  for (const b of body.querySelectorAll('.street-actions button')) b.setAttribute('aria-describedby', 'street-action-reason');

  function update(): void {
    const now = Date.now(), count = ownedPlotCount(s), id = streetLotId(street, selected), lot = s.streets.lots[id];
    const building = !!lot?.business && lot.readyAt > now, running = !!lot?.business && !building;
    const output = streetProduction(s, id, now), price = plotPrice(street, selected);
    for (const [key, button] of buttons) {
      button.setAttribute('aria-pressed', String(key === street));
      button.dataset.locked = String(!streetUnlocked(s, key));
      button.querySelector('small')!.textContent = streetUnlocked(s, key) ? t('street.available') : t('street.unlockAt', { n: streetDef(key).required });
    }
    get('[data-street-name]').textContent = streetName(street);
    get('[data-street-description]').textContent = t(`street.${street}.bonus` as MessageKey);
    get('[data-street-wallet]').textContent = t('street.wallet', { money: money(s.coins), n: s.roomProjects.inspiration });
    get('[data-street-guidance]').textContent = streetUnlocked(s, street) ? t('street.ownedCount', { n: STREET_PLOTS.filter(p => s.streets.lots[streetLotId(street, p.id)]).length }) : t('street.locked', { n: Math.max(0, streetDef(street).required - count) });
    for (const [plot, refs] of shops) {
      const entry = s.streets.lots[streetLotId(street, plot)];
      const status = !entry ? 'sale' : !entry.business ? 'vacant' : entry.readyAt > now ? 'building' : 'open';
      const sig = `${street}:${entry?.business}:${status}`;
      if (sig !== refs.signature) { refs.signature = sig; refs.art.innerHTML = streetShopArt(street, entry?.business ?? null, status, plot); styleStreetShop(refs.button, street, entry?.business ?? null, plot); }
      const name = entry?.business ? businessName(entry.business) : t('street.empty');
      const locked = !streetUnlocked(s, street);
      refs.button.dataset.status = locked && !entry ? 'locked' : status;
      refs.button.classList.toggle('street-shop-open', status === 'open');
      refs.button.querySelector('.street-shop-sign')!.textContent = entry?.business ? name : t(status === 'sale' ? locked ? 'street.lockedSign' : 'street.forSale' : 'street.vacant');
      refs.label.textContent = t('street.plot', { n: plot });
      const ready = streetProduction(s, streetLotId(street, plot), now).batches > 0;
      refs.state.textContent = ready ? t('street.ready') : status === 'sale' ? `${t('street.land')} ${money(plotPrice(street, plot))}` : t(`street.status.${status}`);
      refs.button.setAttribute('aria-pressed', String(detailOpen && selected === plot));
      refs.button.setAttribute('aria-label', `${streetName(street)} · ${t('street.plot', { n: plot })} · ${name} · ${refs.state.textContent}`);
      refs.button.classList.toggle('street-shop-ready', ready);
      refs.button.dataset.visitors = status === 'open' ? 'true' : 'false';
      if (!refs.button.querySelector('.street-shop-visitor')) refs.button.insertAdjacentHTML('beforeend', '<span class="street-shop-visitor" aria-hidden="true"><i></i></span>');
      refs.button.setAttribute('aria-expanded', String(detailOpen && selected === plot));
      refs.button.setAttribute('aria-controls', 'street-detail-panel');
    }
    get('[data-street-address]').textContent = `${streetName(street)} / ${t('street.plot', { n: selected })}`;
    get('#street-detail-title').textContent = lot?.business ? `${businessName(lot.business)} · Lv.${lot.level}` : t(lot ? 'street.vacantTitle' : 'street.saleTitle');
    get('[data-street-status]').textContent = building ? t('street.renovating', { time: formatDuration(Math.ceil((lot!.readyAt - now) / 1000)) })
      : running ? output.full ? t('projects.full', { n: output.capacity }) : t('projects.running', { n: output.batches, cap: output.capacity, time: formatDuration(Math.ceil(output.left)) })
        : t(lot ? 'street.chooseUse' : 'street.purchaseHint');
    get('[data-street-choose-business]').hidden = !!lot?.business;
    if (document.activeElement !== select) select.value = business;
    for (const option of select.options) {
      const def = businessDef(option.value as RegionId), unlocked = Math.max(0, count - (lot ? 1 : 0)) >= def.required;
      option.disabled = !unlocked;
      const label = `${businessName(def.id)} · ${money(fitOutPrice(def.id))}${unlocked ? '' : ` · ${t('street.businessUnlock', { n: def.required + 1 })}`}`;
      if (option.textContent !== label) option.textContent = label;
    }
    get('[data-street-prices]').hidden = !!lot?.business;
    get('[data-street-prices]').textContent = t(lot ? 'street.fitoutQuote' : 'street.priceBreakdown', { land: money(price), fitout: money(fitOutPrice(business)), total: money(price + fitOutPrice(business)) });
    get('[data-street-business-description]').textContent = t(`street.business.${business}.desc` as MessageKey);
    const mode = lot?.mode ?? 'short', def = projectDef(businessDef(lot?.business ?? business).project), level = lot?.level || 1;
    get('[data-street-income]').textContent = t('projects.yield', { money: money(Math.round(def.coins * PROJECT_MODES[mode].yield * level * streetYieldMultiplier(street, lot?.business ?? business))), n: def.inspiration * PROJECT_MODES[mode].yield * level, time: formatDuration(projectCycleSeconds(s, mode)), storage: formatDuration(projectCycleSeconds(s, mode) * projectCapacity(s, mode)) });
    const progress = get<HTMLProgressElement>('progress'); progress.hidden = !running; progress.value = output.progress;
    get('.street-schedules').hidden = !running; get('[data-street-schedule-note]').hidden = !running;
    for (const b of body.querySelectorAll<HTMLButtonElement>('[data-street-mode]')) {
      const value = b.dataset.streetMode as ProjectMode; b.setAttribute('aria-pressed', String(mode === value));
      b.textContent = t(`projects.mode.${value}`, { time: formatDuration(projectCycleSeconds(s, value)) });
    }
    const buy = get<HTMLButtonElement>('[data-street-buy]'), fitout = get<HTMLButtonElement>('[data-street-fitout]'), collect = get<HTMLButtonElement>('[data-street-collect]'), upgrade = get<HTMLButtonElement>('[data-street-upgrade]');
    const block = plotPurchaseBlock(s, street, selected), fitBlock = fitOutBlock(s, id, business), cost = streetUpgradePrice(s, id);
    buy.hidden = !!lot; buy.disabled = block !== null || !actionReady(); buy.textContent = t('street.buy', { money: money(price) });
    fitout.hidden = !lot || !!lot.business; fitout.disabled = fitBlock !== null || !actionReady();
    fitout.textContent = t('street.fitout', { money: money(fitOutPrice(business)), time: formatDuration(fitOutSeconds(s, business)) });
    get<HTMLButtonElement>('[data-street-confirm-accept]').disabled = !pending || !actionReady();
    collect.hidden = !running; collect.disabled = !output.batches; collect.textContent = t('projects.collect', { money: money(output.coins), n: output.inspiration });
    upgrade.hidden = !running; upgrade.disabled = !cost || s.coins < cost.coins || s.roomProjects.inspiration < cost.inspiration;
    upgrade.textContent = cost ? t('projects.upgrade', { money: money(cost.coins), n: cost.inspiration }) : t('projects.max');
    const reason = !lot ? block === 'street' ? t('street.locked', { n: streetDef(street).required - count }) : block === 'day' ? t('projects.dayLocked') : block === 'coins' ? t('projects.needCoins', { money: money(price - s.coins) }) : t('street.totalCost', { money: money(price + fitOutPrice(business)) })
      : !lot.business ? fitBlock === 'coins' ? t('projects.needCoins', { money: money(fitOutPrice(business) - s.coins) }) : fitBlock === 'business' ? t('street.businessUnlock', { n: businessDef(business).required + 1 }) : t('street.autoStaff')
        : running && cost && s.coins < cost.coins ? t('projects.needCoins', { money: money(cost.coins - s.coins) })
          : running && cost && s.roomProjects.inspiration < cost.inspiration ? t('projects.needInspiration', { n: cost.inspiration - s.roomProjects.inspiration }) : t('street.autoStaff');
    if (get('.street-reason').textContent !== reason) get('.street-reason').textContent = reason;
    const total = streetLotIds(s).reduce((sum, key) => sum + streetProduction(s, key, now).coins, 0);
    const all = get<HTMLButtonElement>('[data-street-collect-all]'); all.disabled = total === 0; all.textContent = t('street.collectAll', { money: money(total) });
  }
  rebuildStreet(); update();
  showModal({ title: t('street.title'), body, focusableBody: true, onEscape: () => { if (pending) cancelPayment(); else if (detailOpen) closeDetail(); else goHome(); }, buttons: [{ label: t('street.back'), onClick: () => visit?.('main') }] });
  body.closest('.modal')?.classList.add('street-modal');
  body.closest('.modal-overlay')?.classList.add('street-overlay');
  panorama.focus();
  live = { body, update };
}
