import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';

import { SPEEDS, type ItemId } from './game/data';
import { formatOpenTime, openShop, type DayReport } from './game/day';
import { expectedCustomers, tipMultiplier } from './game/economy';
import { canPlace, evictBlocked, moveFurniture, placeFurniture, storeFurniture } from './game/furniture';
import { formatMoney } from './game/format';
import { MIN_SCENE_H, SCENE_W, areaAtPoint, areaOrigin, sceneHeight, setSceneHeight } from './game/layout';
import { adjacentArea, isAreaOpen, mainTableCount, regionOffset } from './game/regions';
import { CELL, COLS, FLOOR_ROWS, WALL_ROWS, furnitureDef } from './game/furniture';
import { acquireSaveSession, watchSavePage, type SaveSession } from './game/save-session';
import { applyTheme, comfort } from './game/decor';
import { createInitialState, type GameState } from './game/state';
import { LOCALES, LOCALE_KEY, detectLocale, getLocale, onLocaleChange, setLocale, t, type Locale } from './i18n';
import { CafeView } from './render/cafe-view';
import { CafeGame } from './render/phaser/game';
import { character, itemIcon, toDataURL } from './render/sprites';
import { closeModal, isModalOpen, showModal, toast } from './ui/modal';
import { showOnboarding, type OnboardingResult } from './ui/onboarding';
import { Panel, decorName, itemName, type ArrangeRequest } from './ui/panel';
import { OperationMonitor } from './game/operations';
import { ingredientName } from './ui/panel';
import { ratingReportHtml, updateReputationButton, showReputation } from './ui/reputation';
import { showPrepare } from './ui/prepare';
import { RegionsUI, areaName } from './ui/regions';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const HINT_KEY = 'tiny-bean-cafe/hint-done';
const PANEL_COLLAPSED_KEY = 'tiny-bean-cafe/panel-collapsed';
const AUTOSAVE_MS = 5000;
const SIM_STEP = 0.05;

let storedLocale: string | null = null;
try { storedLocale = localStorage.getItem(LOCALE_KEY); } catch { /* The startup notice handles unavailable storage. */ }
setLocale(detectLocale(storedLocale, navigator.languages ?? [navigator.language]));

// A waiting tab must not load or simulate a stale copy of the café.
const savePage = watchSavePage(window, () => window.location.reload());

function sessionNotice(message: string): void {
  let notice = document.getElementById('save-session-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'save-session-notice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'position:fixed;inset:0;z-index:100000;display:grid;place-content:center;padding:32px;background:#fff7e8;color:#493728;text-align:center;white-space:pre-line;font:20px sans-serif';
    document.body.append(notice);
  }
  notice.textContent = message;
}
const chinese = () => getLocale() === 'zh';
sessionNotice(chinese()
  ? '正在打开咖啡馆…\n如果另一个标签页已打开游戏，请先关闭它。本页会自动载入最新进度。'
  : 'Opening your café…\nIf the game is open in another tab, close that tab. This page will then load your latest progress.');
void Promise.resolve().then(() => acquireSaveSession(localStorage, navigator.locks, savePage.signal)).then((session) => {
  if (savePage.signal.aborted) { session.close(); return; }
  document.getElementById('save-session-notice')?.remove();
  try { startGame(session); } catch (error) { session.close(); throw error; }
}).catch(() => {
  if (savePage.signal.aborted) return;
  sessionNotice(chinese()
    ? '无法安全打开存档。请使用支持 Web Locks 的浏览器，通过 HTTPS 或 localhost 打开游戏，并允许本地存储。存档未被修改。'
    : 'Your save could not be opened safely. Use a browser with Web Locks over HTTPS or localhost, and allow local storage. Your save has not been changed.');
});

function startGame(session: SaveSession): void {
let state: GameState = session.state;
const sim = session.sim;
const scene = new CafeView();

function saveGame(): void {
  const result = session.save(state);
  if (result === 'conflict') sessionNotice(chinese()
    ? '存档已在别处更改。为保护进度，此标签页已暂停。请刷新以载入最新存档。'
    : 'Your save changed elsewhere. This tab is paused to protect your progress. Reload to load the latest save.');
  if (result === 'unavailable') sessionNotice(chinese()
    ? '无法保存进度。请检查浏览器的存储权限和可用空间；恢复后进度会自动保存。'
    : 'Progress could not be saved. Check browser storage permissions and free space; saving will retry automatically.');
  if (result === 'saved') document.getElementById('save-session-notice')?.remove();
}
// A released/stale session must not accept keyboard shortcuts or modal actions.
for (const type of ['click', 'pointerdown', 'keydown']) {
  window.addEventListener(type, (event) => {
    if (!session.active || document.getElementById('save-session-notice')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

// ------------------------------------------------------------ display

const canvas = $<HTMLCanvasElement>('scene');
const stage = $('stage');

const sign = $('stage-sign');
const stats = $('stage-stats');
// Space for the stats strip under the café and the café-name sign above it.
const STATS_SPACE = 44;
const SIGN_SPACE = 70;

function fitCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const style = getComputedStyle(stage);
  // Room inside the stage padding, minus the canvas's frame and drop shadow.
  const rect = {
    width: stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 8,
    height: stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 12 - 44,
  };
  // The stats strip only shows if the café could still be as wide as the stage under it.
  stats.hidden = rect.height - STATS_SPACE < MIN_SCENE_H * (rect.width / SCENE_W);
  const roomH = rect.height - (stats.hidden ? 0 : STATS_SPACE);
  // The café grows taller (more floor) to match the stage's shape. Height it can't
  // use goes to the sign, if there's enough for it.
  const previousHeight = sceneHeight();
  setSceneHeight((SCENE_W * roomH) / Math.max(1, rect.width));
  if (previousHeight !== sceneHeight()) {
    sim.resizeScene(previousHeight);
    scene.setOverview(scene.overview, true);
  }
  const spare = roomH - sceneHeight() * Math.min(rect.width / SCENE_W, roomH / sceneHeight());
  sign.hidden = spare < SIGN_SPACE;
  const availH = roomH - (sign.hidden ? 0 : SIGN_SPACE);
  const fit = Math.min((rect.width * dpr) / SCENE_W, (availH * dpr) / sceneHeight());
  // The café always fills the available room. Once each art pixel is 3+ device
  // pixels, a fractional nearest-neighbor scale looks even. Below that, rounding down
  // would waste up to half the space, so the art is upscaled to the next whole number
  // and the browser shrinks it smoothly, which keeps every pixel the same size.
  const shown = Math.max(0.1, fit);
  const backing = shown >= 3 ? shown : Math.ceil(shown);
  cafe.resize({
    width: Math.round(SCENE_W * backing),
    height: Math.round(sceneHeight() * backing),
    cssWidth: (SCENE_W * shown) / dpr,
    cssHeight: (sceneHeight() * shown) / dpr,
    backing,
    smooth: backing !== shown,
  });
}
new ResizeObserver(fitCanvas).observe(stage);

// ------------------------------------------------------------ UI

const coinsEl = $('coins');
const rateEl = $('rate');
const hint = $('hint');
const panelRoot = $('management-panel');
const panelToggle = $<HTMLButtonElement>('panel-toggle');
const layout = document.querySelector<HTMLElement>('.layout')!;
let panelCollapsed = localStorage.getItem(PANEL_COLLAPSED_KEY) === '1';

function updatePanelVisibility(): void {
  panelRoot.hidden = panelCollapsed;
  panelRoot.setAttribute('aria-label', t('panel.title'));
  layout.classList.toggle('panel-collapsed', panelCollapsed);
  panelToggle.textContent = t(panelCollapsed ? 'panel.expand' : 'panel.collapse');
  panelToggle.title = t(panelCollapsed ? 'panel.expandTitle' : 'panel.collapseTitle');
  panelToggle.setAttribute('aria-label', panelToggle.title);
  panelToggle.setAttribute('aria-expanded', String(!panelCollapsed));
}

function setPanelCollapsed(collapsed: boolean): void {
  panelCollapsed = collapsed;
  localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? '1' : '0');
  updatePanelVisibility();
}
panelToggle.addEventListener('click', () => setPanelCollapsed(!panelCollapsed));
updatePanelVisibility();

const panel = new Panel(
  panelRoot,
  $('list'),
  $('goal'),
  state,
  (kind, id) => {
    // A new table takes its spot (and the next one is reserved): clear any furniture in the way.
    if (kind === 'upgrade' && id === 'tables') {
      if (arrange) startArrange({ kind: 'arrange' });
      const moved = evictBlocked(state, mainTableCount(state));
      if (moved > 0) toast(t('toast.evicted', { n: moved }));
    }
    saveGame();
    const burst = kind === 'goal' ? 14 : 5;
    for (let i = 0; i < burst; i++) scene.sparkle(20 + Math.random() * 150, 30 + Math.random() * 40);
    if (kind === 'goal') toast(t('goal.claimed', { reward: formatMoney(Number(id)) }));
  },
  (request) => startArrange(request),
);

/** Opening a management task also reveals the panel if the player folded it away. */
function showPanelTab(tab: 'menu' | 'pantry' | 'upgrades'): void {
  setPanelCollapsed(false);
  panel.showTab(tab);
}

// ------------------------------------------------------------ arranging furniture

/**
 * Arranging: 'browse' waits for the player to pick up a placed piece; 'place' has a
 * piece following the pointer, either a new one from storage (moving = -1) or a
 * placed one being moved (its index).
 */
type Arrange = { mode: 'browse' } | { mode: 'place'; id: string; moving: number; fromBrowse: boolean };
let arrange: Arrange | null = null;
const arrangeBar = $('arrange-bar');
const arrangeText = $('arrange-text');
const arrangeStore = $<HTMLButtonElement>('arrange-store');
const arrangeDone = $<HTMLButtonElement>('arrange-done');
const sceneWrap = document.querySelector<HTMLElement>('.scene-wrap')!;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const regionsUI = new RegionsUI($('area-nav'), $('area-edges'), $('region-card'), () => state, (area) => {
  scene.moveToArea(area, reducedMotion.matches);
  sceneWrap.classList.toggle('has-front-passage', !!adjacentArea(area, 'down'));
  canvas.setAttribute('aria-label', areaName(area));
  if (arrange && !isAreaOpen(state, area)) {
    arrange = null;
    scene.ghost = null;
    showArrange();
  } else if (arrange?.mode === 'place') holdPiece(arrange.id, arrange.moving, arrange.fromBrowse);
  updateDayHud();
}, () => {
  saveGame();
  panel.refresh();
  toast(t('area.opened', { name: areaName(scene.area) }));
  const origin = areaOrigin(scene.area);
  for (let i = 0; i < 16; i++) scene.sparkle(origin.x + 40 + Math.random() * 240, origin.y + 70 + Math.random() * 60);
  updateDayHud();
}, (show) => {
  scene.setOverview(show, reducedMotion.matches);
  canvas.setAttribute('aria-label', show ? t('area.overviewHint') : areaName(scene.area));
});

function showArrange(): void {
  sceneWrap.classList.toggle('arranging', !!arrange);
  arrangeBar.hidden = !arrange;
  if (!arrange) return;
  const moving = arrange.mode === 'place' && arrange.moving >= 0;
  arrangeText.textContent =
    arrange.mode === 'browse' ? t('arrange.browse') : t('arrange.place', { name: decorName(arrange.id) });
  arrangeStore.hidden = !moving;
  arrangeStore.textContent = t('arrange.store');
  arrangeDone.textContent = arrange.mode === 'browse' ? t('arrange.done') : t('arrange.cancel');
}

/** Picks a piece up: the ghost starts where it is, or at the first free spot for a new one. */
function holdPiece(id: string, moving: number, fromBrowse: boolean): void {
  arrange = { mode: 'place', id, moving, fromBrowse };
  let at = moving >= 0 ? state.decor.placed[moving] : null;
  const start = regionOffset(scene.area) / CELL;
  if (at && (at.col < start || at.col >= start + COLS)) at = null;
  if (!at) {
    const tables = mainTableCount(state);
    const rows = furnitureDef(id)?.surface === 'wall' ? WALL_ROWS : FLOOR_ROWS;
    outer: for (let row = 0; row < rows; row++) {
      for (let col = start; col < start + COLS; col++) {
        if (canPlace(state, id, col, row, tables, moving)) {
          at = { id, col, row };
          break outer;
        }
      }
    }
  }
  scene.ghost = { id, col: at?.col ?? -99, row: at?.row ?? -99, skip: moving };
  showArrange();
}

function startArrange(request: ArrangeRequest): void {
  // Decorations go in the dining rooms, never the kitchen.
  if (!isAreaOpen(state, scene.area) || scene.area === 'kitchen') regionsUI.select('main');
  if (request.kind === 'place') holdPiece(request.id, -1, arrange?.mode === 'browse');
  else {
    arrange = { mode: 'browse' };
    scene.ghost = null;
    showArrange();
  }
}

/** Back to browsing if the player came from there, otherwise done arranging. */
function releasePiece(): void {
  const back = arrange?.mode === 'place' && arrange.fromBrowse;
  arrange = back ? { mode: 'browse' } : null;
  scene.ghost = null;
  saveGame();
  showArrange();
  panel.update();
}

function arrangeTap(x: number, y: number): void {
  if (!arrange) return;
  if (arrange.mode === 'browse') {
    const index = scene.furnitureAt(state, x, y);
    if (index >= 0) holdPiece(state.decor.placed[index].id, index, true);
    return;
  }
  const { col, row } = scene.cellAt(arrange.id, x, y);
  const tables = mainTableCount(state);
  const ok =
    arrange.moving >= 0
      ? moveFurniture(state, arrange.moving, col, row, tables)
      : placeFurniture(state, arrange.id, col, row, tables);
  if (!ok) {
    // Show where it was tapped, in red, so it's clear why.
    scene.ghost = { ...scene.ghost!, col, row };
    toast(t('arrange.blocked'));
    return;
  }
  for (let i = 0; i < 6; i++) scene.sparkle(x + (Math.random() - 0.5) * 16, y - Math.random() * 16);
  releasePiece();
}

arrangeStore.addEventListener('click', () => {
  if (arrange?.mode === 'place' && arrange.moving >= 0) storeFurniture(state, arrange.moving);
  releasePiece();
});
arrangeDone.addEventListener('click', () => {
  if (arrange?.mode === 'place') releasePiece();
  else {
    arrange = null;
    showArrange();
  }
});

/** The HUD shows the player's café name once it has one. */
function updateBrand(): void {
  const name = state.profile?.cafeName ?? t('app.title');
  $('hud-cafe-name').textContent = name;
  $('stage-sign-name').textContent = name;
}

let shownStats = '';
function updateStats(): void {
  if (stats.hidden) return;
  const tips = t('stats.tips', { n: Math.round((tipMultiplier(state) - 1) * 100) });
  const chips =
    state.phase !== 'prep'
      ? [
          t('stats.servedToday', { n: state.today.served.toLocaleString() }),
          t('stats.missed', { n: state.today.missed.toLocaleString() }),
          t('stats.today', { money: formatMoney(state.today.revenue) }),
          tips,
        ]
      : [
          t('stats.forecast', { n: expectedCustomers(state).toLocaleString() }),
          t('stats.comfort', { n: comfort(state) }),
          tips,
        ];
  const html = chips.map((c) => `<span>${c}</span>`).join('');
  if (html !== shownStats) stats.innerHTML = shownStats = html;
}

// ------------------------------------------------------------ the business day

const dayClock = $('day-clock');
const operationMonitor = new OperationMonitor();
const operationBtn = $<HTMLButtonElement>('operation-status');
const openBtn = $<HTMLButtonElement>('open-btn');
const closeBtn = $<HTMLButtonElement>('close-btn');
const speedBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];

function updateDayHud(): void {
  updateReputationButton(state);
  const open = state.phase !== 'prep';
  const closing = state.phase === 'closing';
  const time = closing ? t('day.closing') : open ? t('day.openFor', { time: formatOpenTime(state.dayTime) }) : t('day.closed');
  const text = `${t('day.label', { n: state.day })} · ${time}`;
  if (dayClock.textContent !== text) dayClock.textContent = text;
  $('day-speed').hidden = !open;
  closeBtn.hidden = !open;
  closeBtn.textContent = t(closing ? 'day.finishNow' : 'day.close');
  closeBtn.title = closing ? t('day.discard') : t('day.closeHelp');
  operationBtn.hidden = !open;
  const status = operationMonitor.update(state, sim);
  operationBtn.textContent = t(`ops.${status.kind}`);
  if (!open) operationMonitor.reset();
  $('day-hud').hidden = !isAreaOpen(state, scene.area);
  for (const b of speedBtns) b.classList.toggle('active', Number(b.dataset.speed) === state.speed);
  openBtn.hidden = open || !state.profile || scene.area !== 'main';
  const label = t('day.open', { n: state.day });
  if (openBtn.textContent !== label) openBtn.textContent = label;
  hint.hidden = !open || !!localStorage.getItem(HINT_KEY);
}

for (const b of speedBtns) {
  b.addEventListener('click', () => {
    state.speed = SPEEDS.find((v) => v === Number(b.dataset.speed)) ?? 1;
    updateDayHud();
  });
}

function startDay(): void {
  if (state.phase !== 'prep' || menuEmpty()) return;
  const baked = openShop(state);
  saveGame();
  toast(baked > 0 ? t('toast.openedBaked', { n: state.day, baked }) : t('toast.opened', { n: state.day }));
  for (let i = 0; i < 16; i++) scene.sparkle(280 + Math.random() * 30, 30 + Math.random() * 50);
  panel.refresh();
  updateDayHud();
}

const menuEmpty = () => !state.onMenu.some((id) => state.items[id] > 0);

/** The only way to open: prepare today's menu, then confirm. */
function prepareDay(): void {
  if (state.phase !== 'prep') return;
  showPrepare(state, startDay, () => {
    saveGame();
    panel.refresh();
  });
}
openBtn.addEventListener('click', prepareDay);

/** The player ends the day: the doors shut and the books are settled. */
function closeDay(): void {
  if (state.phase === 'open') {
    sim.beginClosing(state);
    saveGame(); updateDayHud();
  } else if (state.phase === 'closing') {
    showModal({ title: t('day.finishNow'), body: t('day.discard'), buttons: [
      { label: t('day.keepServing') },
      { label: t('day.finishNow'), danger: true, onClick: () => { const report = sim.closeShop(state); if (report) showReport(report); } },
    ] });
  }
}
closeBtn.addEventListener('click', closeDay);
$('reputation-btn').addEventListener('click', () => showReputation(state));
operationBtn.addEventListener('click', () => {
  const status = operationMonitor.current;
  const detail = t(`ops.${status.kind}.detail`);
  const extra = status.item ? `<p>${itemName(status.item)}${status.ingredients?.length ? ` · ${status.ingredients.map(ingredientName).join(t('list.sep'))}` : ''}${status.seconds !== undefined ? ` · ${t('ops.workRemaining', { n: status.seconds })}` : ''}</p>` : '';
  const pantry = status.kind === 'ingredients';
  showModal({ title: t(`ops.${status.kind}`), body: `<p>${detail}</p>${extra}`, buttons: [
    { label: t('settings.back'), primary: true },
    ...(status.kind === 'closing' || status.kind === 'steady' ? [] : [{ label: t(pantry ? 'tab.pantry' : 'tab.upgrades'), onClick: () => showPanelTab(pantry ? 'pantry' : 'upgrades') }]),
  ] });
});

function showReport(report: DayReport): void {
  $('toast').hidden = true;
  saveGame();
  panel.refresh();
  updateDayHud();
  const row = (label: string, value: string) => `<dt>${label}</dt><dd>${value}</dd>`;
  const reportTab = report.soldOut || report.extraLost || report.outOfStock.length ? 'pantry' : report.tableLost || report.queueLost || report.doorLost ? 'upgrades' : 'menu';
  const best = report.bestSeller;
  const bestHtml = best
    ? `<p class="report-best"><img src="${toDataURL(itemIcon(best), 3)}" alt="" />${t('report.best', {
        item: itemName(best),
        n: report.sales[best] ?? 0,
      })}</p>`
    : `<p>${t('report.none')}</p>`;
  const totalBaked = Object.values(report.baked).reduce((a, b) => a + (b ?? 0), 0);
  const staleCount = Object.values(report.stale).reduce((a, b) => a + (b ?? 0), 0);
  const list = (ids: ItemId[]) => ids.map((id) => itemName(id)).join(t('list.sep'));
  const bakeRows = totalBaked
    ? row(t('report.baked'), totalBaked.toLocaleString()) +
      row(t('report.stale'), staleCount ? t('report.staleValue', { n: staleCount, money: formatMoney(report.staleCost) }) : '0')
    : '';
  const staleNote = staleCount
    ? `<p class="note">${t('report.staleItems', {
        items: (Object.entries(report.stale) as [ItemId, number][]).map(([id, n]) => `${itemName(id)} ×${n}`).join(t('list.sep')),
      })}</p>`
    : '';
  const shelfNote = report.shelfSoldOut.length
    ? `<p class="note">${t('report.shelfOut', { items: list(report.shelfSoldOut) })}</p>`
    : '';
  const out = report.outOfStock.length
    ? `<p class="note warn">${t('report.outOfStock', { items: report.outOfStock.map((id: ItemId) => itemName(id)).join(t('list.sep')) })}</p>`
    : '';
  showModal({
    title: t('report.title', { n: report.day }),
    icon: ownerIcon(),
    body: `
      <dl class="stats">
        ${row(t('report.served'), report.served.toLocaleString())}
        ${row(t('report.missed'), t('report.missedValue', { n: report.missed, sold: report.soldOut }))}
        ${row(t('report.queueLost'), report.queueLost.toLocaleString())}
        ${row(t('report.tableLost'), report.tableLost.toLocaleString())}
        ${row(t('report.extraLost'), report.extraLost.toLocaleString())}
        ${row(t('report.doorLost'), report.doorLost.toLocaleString())}
        ${row(t('report.duration'), formatOpenTime(report.duration))}
        ${row(t('report.revenue'), formatMoney(report.revenue))}
        ${row(t('report.ingredients'), '−' + formatMoney(report.ingredientCost))}
        ${bakeRows}
      </dl>
      <div class="report-profit"><span>${t('report.profit')}</span><b class="big-money">${report.profit < 0 ? '−' : '+'}${formatMoney(Math.abs(report.profit))}</b></div>
      <p class="note">${report.duration >= 60 ? t('report.perMinute', { money: formatMoney(report.profit * 60 / report.duration) }) : t('report.shortSample')}</p>
      <p class="note">${t(report.soldOut || report.extraLost ? 'report.adviceStock' : report.tableLost ? 'report.adviceDelivery' : report.queueLost || report.doorLost ? 'report.adviceCounter' : staleCount ? 'report.adviceBake' : 'report.adviceGood')}</p>
      ${ratingReportHtml(report)}
      ${bestHtml}
      ${Object.keys(report.shortages).length ? `<p class="note">${t('report.shortages', { items: Object.entries(report.shortages).map(([id, n]) => `${itemName(id as ItemId)} ×${n}`).join(t('list.sep')) })}</p>` : ''}
      ${shelfNote}
      ${staleNote}
      ${out}`,
    buttons: [
      {
        label: t('report.next'),
        primary: true,
        onClick: prepareDay,
      },
      { label: t(`tab.${reportTab}`), onClick: () => showPanelTab(reportTab) },
    ],
  });
}


function applyStaticText(): void {
  document.documentElement.lang = LOCALES.find((l) => l.id === getLocale())!.htmlLang;
  updateBrand();
  document.title = t('app.title');
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as Parameters<typeof t>[0]);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle as Parameters<typeof t>[0]);
    el.setAttribute('aria-label', el.title);
  });
  updatePanelVisibility();
}
applyStaticText();
onLocaleChange(() => {
  applyStaticText();
  shownStats = '';
  panel.refresh();
});

const ownerIcon = () =>
  toDataURL(
    state.profile
      ? character(state.profile.look, 'owner').stand
      : character({ skin: 0, hair: 1, hairStyle: 1, shirt: 0, pants: 0 }, 'barista').stand,
    3,
  );

function rememberLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

function applyProfile(result: OnboardingResult): void {
  state.profile = result.profile;
  if (result.theme) applyTheme(state, result.theme);
  saveGame();
  updateBrand();
  panel.refresh();
}

function startOnboarding(then?: () => void): void {
  showOnboarding({
    mode: 'new',
    onLocale: rememberLocale,
    onDone: (result) => {
      applyProfile(result);
      for (let i = 0; i < 24; i++) scene.sparkle(10 + Math.random() * 172, 20 + Math.random() * 90);
      updateDayHud();
      toast(t('ob.opened', { cafe: result.profile.cafeName }));
      // Day 1 opens like every other day: from preparing the menu.
      prepareDay();
      then?.();
    },
  });
}

function editProfile(): void {
  showOnboarding({
    mode: 'edit',
    initial: state.profile,
    onLocale: rememberLocale,
    onDone: (result) => {
      applyProfile(result);
      openSettings();
    },
    onCancel: openSettings,
  });
}

function openSettings(): void {
  const languages = LOCALES.map(
    (l) => `<button class="chip${l.id === getLocale() ? ' active' : ''}" data-locale="${l.id}">${l.label}</button>`,
  ).join('');
  const profile = state.profile;
  showModal({
    title: t('settings.title'),
    body: `
      ${
        profile
          ? `<div class="profile-row"><img src="${ownerIcon()}" alt="" /><div><b class="profile-cafe"></b><div class="note profile-owner"></div></div>
             <button class="pixel-btn ghost small" data-edit-profile>${t('settings.edit')}</button></div>`
          : ''
      }
      <div class="lang-row"><span>${t('settings.language')}</span>${languages}</div>
      <dl class="stats">
        <dt>${t('settings.served')}</dt><dd>${state.served.toLocaleString()}</dd>
        <dt>${t('settings.earned')}</dt><dd>${formatMoney(state.totalEarned)}</dd>
        <dt>${t('settings.days')}</dt><dd>${state.day - 1}</dd>
      </dl>
      <p class="note">${t('settings.shortcuts')}</p>
      <p class="note">${t('settings.pause')}</p>
      <p class="note">${t('settings.saves')}</p>`,
    buttons: [
      { label: t('settings.back'), primary: true },
      {
        label: t('settings.reset'),
        danger: true,
        onClick: () =>
          showModal({
            title: t('reset.title'),
            body: t('reset.body'),
            buttons: [
              { label: t('reset.keep'), primary: true },
              { label: t('reset.confirm'), danger: true, onClick: resetGame },
            ],
          }),
      },
    ],
  });
  // Names are user text, so they go in via textContent rather than the HTML template.
  const cafeEl = document.querySelector('.profile-cafe');
  if (cafeEl && profile) {
    cafeEl.textContent = profile.cafeName;
    document.querySelector('.profile-owner')!.textContent = profile.ownerName || t('ob.char.defaultName');
  }
  document.querySelector('[data-edit-profile]')?.addEventListener('click', () => {
    closeModal();
    editProfile();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((b) =>
    b.addEventListener('click', () => {
      const locale = b.dataset.locale as Locale;
      rememberLocale(locale);
      setLocale(locale);
      openSettings();
    }),
  );
}
$('settings-btn').addEventListener('click', openSettings);

function resetGame(): void {
  state = createInitialState(Date.now());
  sim.customers = [];
  sim.baristas = [];
  sim.queue = [];
  sim.seats = [];
  sim.servers = [];
  sim.pass = [];
  panel.setState(state);
  regionsUI.select('main');
  updateBrand();
  saveGame();
  startOnboarding();
}

// ------------------------------------------------------------ input

function tapAt(x: number, y: number): void {
  if (scene.hitCat(x, y)) {
    scene.petCat();
    return;
  }
  if (state.phase === 'prep' || !sim.boost()) return;
  sim.baristas.forEach((_, i) => { if (sim.isBrewing(i) && !sim.isHolding(i)) { const p = sim.baristaPose(i); scene.sparkle(p.x, p.y - 15); } });
  if (!hint.hidden) {
    hint.hidden = true;
    localStorage.setItem(HINT_KEY, '1');
  }
}

/** A tap or click on the café, at (x, y) in scene pixels. */
function pointerDown(x: number, y: number): void {
  if (scene.panning) return;
  if (scene.overview) {
    const area = areaAtPoint(x, y);
    if (area) regionsUI.select(area);
    return;
  }
  if (arrange) arrangeTap(x, y);
  else tapAt(x, y);
}

/** With a mouse, the piece being placed follows the pointer. */
function pointerMove(x: number, y: number): void {
  if (scene.panning || scene.overview || arrange?.mode !== 'place') return;
  scene.ghost = { ...scene.ghost!, ...scene.cellAt(arrange.id, x, y) };
}

window.addEventListener('keydown', (e) => {
  // Letters typed into a name field are not shortcuts; Esc can close a dialog.
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  const onboarding = !!document.querySelector('.onboard-overlay');
  if (typing && e.key !== 'Escape') return;
  // Let navigation buttons keep their native keyboard activation.
  if (e.key === ' ' && e.target instanceof HTMLElement && e.target.closest('.area-arrow, .area-plan-toggle, #panel-toggle')) return;
  if (e.key === 'Escape' && isModalOpen()) {
    e.preventDefault();
    closeModal();
  } else if (e.key === ' ' && !isModalOpen() && !onboarding) {
    e.preventDefault();
    if (!e.repeat) tapAt(areaOrigin(scene.area).x + 110 + Math.random() * 100, areaOrigin(scene.area).y + 70);
  } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !isModalOpen() && !onboarding) {
    e.preventDefault();
    if (!e.repeat) regionsUI.move(({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const)[e.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown']);
  }
});

// ------------------------------------------------------------ saving

// Nothing runs while you're away: the shop pauses with the game and picks up where it
// left off. Save on the way out so nothing is lost.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveGame();
});
savePage.onClose(() => {
  try { saveGame(); } finally { session.close(); }
});
setInterval(() => saveGame(), AUTOSAVE_MS);

// ------------------------------------------------------------ loop

let uiTimer = 0;
let shownCoins = '';
let shownRate = '';

/** Runs once per frame, from the Phaser game loop, before the café is drawn. */
function frame(dt: number): void {
  // Paused while a dialog (like the day report) is up or the tab is hidden; sped up
  // when the player asks.
  const paused = !session.active || !!document.getElementById('save-session-notice') || isModalOpen() || document.hidden || !!document.querySelector('.onboard-overlay');
  const simDt = paused ? 0 : state.phase !== 'prep' ? dt * state.speed : dt;
  for (let remaining = simDt; remaining > 1e-6; remaining -= SIM_STEP) {
    scene.addEvents(sim.update(state, Math.min(SIM_STEP, remaining)));
  }

  if (!paused && state.phase === 'closing' && sim.finishedService) {
    const report = sim.closeShop(state);
    if (report) showReport(report);
  }

  scene.update(dt, sim);
  sceneWrap.classList.toggle('is-panning', scene.panning);
  sceneWrap.classList.toggle('is-overview', scene.overview);

  const coins = formatMoney(state.coins);
  if (coins !== shownCoins) coinsEl.textContent = shownCoins = coins;
  uiTimer -= dt;
  if (uiTimer <= 0) {
    uiTimer = 0.25;
    const rate =
      state.phase !== 'prep'
        ? t('hud.today', { money: formatMoney(state.today.revenue) })
        : t('hud.closed', { n: state.day });
    if (rate !== shownRate) rateEl.textContent = shownRate = rate;
    panel.update();
    regionsUI.update();
    updateStats();
    updateDayHud();
  }
}

const cafe = new CafeGame(canvas, scene, sim, () => state, { tick: frame, pointerDown, pointerMove });
fitCanvas();
panel.update();
regionsUI.select('main');
updateDayHud();
// Saves from before the opening flow existed go through it first.
if (!state.profile) startOnboarding();

// The page starts behind a loading spinner (see index.html). Lift it once the pixel
// fonts are in (or after 2s at most) and the café has drawn its first frame.
const atMost = (ms: number, wait: Promise<unknown>) => Promise.race([wait, new Promise((done) => setTimeout(done, ms))]);
Promise.all([atMost(4000, cafe.ready), atMost(2000, document.fonts.ready)]).then(() =>
  requestAnimationFrame(() => {
    document.body.classList.add('ready');
    setTimeout(() => $('loader').remove(), 300);
  }),
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

}
