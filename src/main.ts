import { showFirstOpening } from './ui/first-opening';
import { RoomViewport } from './ui/room-viewport';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';

import { PlayFlow } from './ui/play-flow';
import { pantryTaskContext } from './ui/play-flow-context';
import { trafficHud } from './ui/traffic-status';
import { showLivingCat } from './ui/living-cats';
import type { CatId } from './game/pets';
import { SPEEDS } from './game/data';
import { formatOpenTime, openShop, type DayReport } from './game/day';
import { expectedCustomers, menuItems, tipMultiplier, unlockedItems } from './game/economy';
import { canPlace, evictBlocked, moveFurniture, placeFurniture, storeFurniture } from './game/furniture';
import { formatMoney, formatTransactionMoney } from './game/format';
import { MIN_SCENE_H, SCENE_W, areaAtPoint, areaOrigin, sceneHeight, setSceneHeight } from './game/layout';
import { adjacentArea, isAreaOpen, mainTableCount, regionOffset } from './game/regions';
import { CELL, COLS, FLOOR_ROWS, WALL_ROWS, furnitureDef } from './game/furniture';
import { acquireSaveSession, watchSavePage, type SaveSession } from './game/save-session';
import { applyTheme, comfort } from './game/decor';
import { GuardedStorage } from './game/storage';
import { isComposingKey, usesNativeKeyboard } from './ui/keyboard';
import { consumeFurnitureMovesOnLoad, createInitialState, type GameState } from './game/state';
import { LOCALES, LOCALE_KEY, detectLocale, getLocale, onLocaleChange, setLocale, t, type Locale } from './i18n';
import { CafeView } from './render/cafe-view';
import { CafeGame } from './render/phaser/game';
import { character, toDataURL } from './render/sprites';
import { fineSpriteArt } from './render/fine-sprite-art';
import { showMoneyDetails } from './ui/money-details';
import { closeModal, isModalOpen, showModal, toast } from './ui/modal';
import { showOnboarding, type OnboardingResult } from './ui/onboarding';
import { Panel, decorName, itemName, type ArrangeRequest } from './ui/panel';
import { OperationMonitor, operationStatus } from './game/operations';
import { ingredientName } from './ui/panel';
import { updateReputationButton, showReputation } from './ui/reputation';
import { showPartners, updatePartnersButton } from './ui/partners';
import { showRegularGuests, updateRegularGuestsButton } from './ui/regular-guests';
import { showPrepare } from './ui/prepare';
import { showCafeStyles, updateCafeStyleButton } from './ui/cafe-styles';
import { RegionsUI, areaName } from './ui/regions';
import { FirstServiceGuide } from './ui/first-service';
import { cafeInteractionEnabled } from './ui/cafe-interaction';
import { FullscreenDrawer } from './ui/fullscreen-drawer';
import { ManagementShortcuts } from './ui/management-shortcuts';
import { fitFullscreenRoom } from './ui/fullscreen-layout';
import { ArrangeFocus } from './ui/arrange-focus';
import { trackVisualViewport } from './ui/viewport';
import { waitForStartupReady } from './ui/startup-ready';
import { startupLoading } from './ui/startup-loading';

// Static imports succeeded; the game now owns startup/error feedback.
window.dispatchEvent(new Event('cafe:bootstrap-ready'));
trackVisualViewport();
import { settlementHtml } from './ui/settlement';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const HINT_KEY = 'tiny-bean-cafe/hint-done';
const AUTOSAVE_MS = 5000;
const SIM_STEP = 0.05;

const storage = new GuardedStorage(() => window.localStorage);
const storedLocale = storage.preference(LOCALE_KEY);
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
void Promise.resolve().then(() => acquireSaveSession(storage, navigator.locks, savePage.signal)).then((session) => {
  if (savePage.signal.aborted) { session.close(); return; }
  document.getElementById('save-session-notice')?.remove();
  const loading = startupLoading($('loader'), chinese(), () => window.location.reload());
  try { startGame(session, loading); } catch (error) {
    session.close();
    loading.fail(error);
  }
}).catch(() => {
  if (savePage.signal.aborted) return;
  sessionNotice(chinese()
    ? '无法安全打开存档。请使用支持 Web Locks 的浏览器，通过 HTTPS 或 localhost 打开游戏，并允许本地存储。存档未被修改。'
    : 'Your save could not be opened safely. Use a browser with Web Locks over HTTPS or localhost, and allow local storage. Your save has not been changed.');
});

function startGame(session: SaveSession, loading: ReturnType<typeof startupLoading>): void {
let startupComplete = false;
let state: GameState = session.state;
const sim = session.sim;
const scene = new CafeView();

function updateTemporaryNotice(): void {
  if (session.mode !== 'temporary') return;
  let notice = document.getElementById('temporary-save-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'temporary-save-notice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'position:relative;flex-shrink:0;z-index:10001;padding:8px 16px;background:#fff0c2;color:#493728;text-align:center;font:14px sans-serif';
    $('app').prepend(notice);
    // Keep the honest temporary-session warning above floating controls,
    // without shrinking or moving the room beneath them.
    const measureNotice = () => document.body.style.setProperty('--notice-height', `${notice!.getBoundingClientRect().height}px`);
    new ResizeObserver(measureNotice).observe(notice);
    queueMicrotask(measureNotice);
  }
  notice.textContent = t('save.temporary');
}
updateTemporaryNotice();

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
    // The loading overlay owns its retry control, even after a failed session closes.
    if (event.target instanceof Node && $('loader')?.contains(event.target)) return;
    if (!startupComplete || !session.active || document.getElementById('save-session-notice')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

// ------------------------------------------------------------ display

const canvas = $<HTMLCanvasElement>('scene');
const stage = $('stage');
let roomViewport: RoomViewport | undefined;

const sign = $('stage-sign');
const stats = $('stage-stats');
// Overlays never participate in room sizing. The original floor plan is unchanged.
function fitCanvas(): void {
  roomViewport?.reset();
  stats.hidden = sign.hidden = true;
  const previousHeight = sceneHeight();
  setSceneHeight(MIN_SCENE_H);
  if (previousHeight !== sceneHeight()) {
    sim.resizeScene(previousHeight);
    scene.setOverview(scene.overview, true);
  }
  cafe.resize(fitFullscreenRoom(stage.clientWidth, stage.clientHeight, window.devicePixelRatio || 1, SCENE_W, sceneHeight()), { width: stage.clientWidth, height: stage.clientHeight });
}
new ResizeObserver(fitCanvas).observe(stage);

// ------------------------------------------------------------ UI

const coinsEl = $('coins');
coinsEl.addEventListener('click', () => showMoneyDetails(state.coins));
const drawerBalance = $('drawer-balance');
drawerBalance.addEventListener('click', () => showMoneyDetails(state.coins));
const rateEl = $('rate');
const hint = $('hint');
const panelRoot = $('management-panel');
const panelToggle = $<HTMLButtonElement>('panel-toggle');
const layout = document.querySelector<HTMLElement>('.layout')!;
let panelCollapsed = true;
const drawer = new FullscreenDrawer(panelRoot, panelToggle, $<HTMLButtonElement>('drawer-close'), $('drawer-backdrop'), () => setPanelCollapsed(true));
const edgeTools = $('edge-tools');
// Desktop folds the six shortcuts into Manage; phones open the drawer directly.
const shortcuts = new ManagementShortcuts(edgeTools, panelToggle, updateDrawerLabels);
let detachedTablePreview = false;
const previewExit = document.createElement('button');
previewExit.className = 'pixel-btn table-preview-exit';
previewExit.hidden = true;
stage.append(previewExit);
previewExit.addEventListener('click', () => {
  detachedTablePreview = false;
  panel.clearTablePreview();
  showPanelTab('upgrades');
});
function updateDrawerLabels(): void {
  roomViewport?.refreshLabels();
  previewExit.textContent = chinese() ? '返回升级' : 'Back to upgrades';
  $('drawer-title').textContent = t('panel.title');
  $('drawer-close').setAttribute('aria-label', chinese() ? '关闭管理' : 'Close management');
  $('drawer-pause').textContent = chinese() ? '已暂停 · 关闭后继续' : 'Paused · close to resume';
  panelToggle.textContent = chinese() ? '管理' : 'Manage';
  const folded = panelCollapsed && shortcuts.available;
  panelToggle.title = t(!panelCollapsed ? 'panel.collapseTitle' : !folded ? 'panel.expandTitle'
    : shortcuts.expanded ? 'panel.hideShortcuts' : 'panel.showShortcuts');
  panelToggle.setAttribute('aria-label', panelToggle.title);
  panelToggle.setAttribute('aria-controls', folded ? 'edge-tools' : 'management-panel');
  panelToggle.setAttribute('aria-expanded', String(!panelCollapsed || shortcuts.expanded));
  edgeTools.setAttribute('aria-label', t('panel.title'));
  for (const button of edgeTools.querySelectorAll<HTMLButtonElement>('[data-management-tab]')) {
    const tab = button.dataset.managementTab as 'menu' | 'pantry' | 'upgrades' | 'decor' | 'pets' | 'promotion';
    button.querySelector('span:last-child')!.textContent = t(`tab.${tab}`);
    button.setAttribute('aria-expanded', String(!panelCollapsed && panelRoot.querySelector(`[data-tab="${tab}"]`)?.classList.contains('active')));
  }
}

function updatePanelVisibility(restoreFocus = true): void {
  panelRoot.setAttribute('aria-label', t('panel.title'));
  layout.classList.toggle('panel-collapsed', panelCollapsed);
  if (!panelCollapsed) shortcuts.setOpen(false);
  drawer.setOpen(!panelCollapsed, restoreFocus);
  updateDrawerLabels();
}
function setPanelCollapsed(collapsed: boolean, restoreFocus = true): void {
  playFlow.cancelPantry();
  if (!panelCollapsed && collapsed) panel.captureBrowsingContext();
  panelCollapsed = collapsed;
  updatePanelVisibility(restoreFocus);
}
panelToggle.addEventListener('click', () => {
  if (panelCollapsed && shortcuts.available) shortcuts.setOpen(!shortcuts.expanded);
  else setPanelCollapsed(!panelCollapsed);
});
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
  {
    getActor: (id) => scene.livingCats.actors.get(id),
    locate: (id) => locateResident(id),
    interact: (id) => greetResident(id),
  },
  () => {
    regionsUI.select('main');
    if (drawer.media.matches) {
      detachedTablePreview = true;
      setPanelCollapsed(true, false);
      previewExit.hidden = false;
      previewExit.focus({ preventScroll: true });
    }
  },
);

/** Opening a management task also reveals the panel if the player folded it away. */
function showPanelTab(tab: 'menu' | 'pantry' | 'upgrades' | 'decor' | 'pets' | 'promotion'): void {
  setPanelCollapsed(false);
  panel.showTab(tab);
  updateDrawerLabels();
}
edgeTools.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-management-tab]');
  if (!button) return;
  // Fold the shortcuts first, so closing the drawer returns focus to Manage.
  shortcuts.setOpen(false, true);
  showPanelTab(button.dataset.managementTab as 'menu' | 'pantry' | 'upgrades' | 'decor' | 'pets' | 'promotion');
});
panel.onNavigate(() => queueMicrotask(updateDrawerLabels));

// Intro preferences never write or migrate the café save itself.
let introMode = false;
function revealAllTools(): void {
  introMode = false;
  panel.setIntroMode(false);
  $('app').classList.remove('guided-focus');
}
const guide = new FirstServiceGuide(() => state, storage, {
  prepare: () => prepareDay(),
  close: () => closeDay(),
  status: () => operationBtn.click(),
  allTools: revealAllTools,
});
layout.before(guide.element);
// Wrapped receipts reserve their actual height above the persistent view controls.
const toastElement = $('toast');
new ResizeObserver(() => {
  const height = toastElement.getBoundingClientRect().height;
  document.body.style.setProperty('--toast-clearance', `${height > 0 ? height + 12 : 0}px`);
}).observe(toastElement);
function updateGuide(): void {
  guide.update();
  if (introMode !== guide.simplify) {
    introMode = guide.simplify;
    panel.setIntroMode(introMode);
    $('app').classList.toggle('guided-focus', introMode);
  }
  $('app').classList.toggle('has-guide', !guide.element.hidden);
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
const arrangeFocus = new ArrangeFocus(panelRoot, arrangeDone);
const sceneWrap = document.querySelector<HTMLElement>('.scene-wrap')!;
stage.append($('day-hud'), $('cafe-style-btn'), $('open-btn'), arrangeBar);
let arrangementHadDrawer = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const regionsUI = new RegionsUI($('area-edges'), $('region-card'), () => state, (area) => {
  roomViewport?.reset();
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
  roomViewport?.reset();
  scene.setOverview(show, reducedMotion.matches);
  canvas.setAttribute('aria-label', show ? t('area.overviewHint') : areaName(scene.area));
});

function showArrange(): void {
  if (arrange && !panelCollapsed) {
    arrangementHadDrawer = true;
    setPanelCollapsed(true, false);
  } else if (!arrange && arrangementHadDrawer) {
    arrangementHadDrawer = false;
    setPanelCollapsed(false, false);
  }
  document.body.classList.toggle('arranging-cafe', !!arrange);
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
        if (canPlace(state, id, col, row, tables, moving) && sim.furnitureSpaceClear(id, col, row) && scene.catSpaceClear(id, col, row)) {
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
  playFlow.cancelPantry();
  shortcuts.setOpen(false);
  if (!arrange) arrangeFocus.capture();
  // Decorations go in the dining rooms, never the kitchen.
  if (!isAreaOpen(state, scene.area) || scene.area === 'kitchen') regionsUI.select('main');
  else if (scene.overview) regionsUI.select(scene.area);
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
  const ok = sim.furnitureSpaceClear(arrange.id, col, row) && scene.catSpaceClear(arrange.id, col, row) && (
    arrange.moving >= 0
      ? moveFurniture(state, arrange.moving, col, row, tables)
      : placeFurniture(state, arrange.id, col, row, tables));
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
const dayClockBase = document.createElement('span');
const dayClockTraffic = document.createElement('span');
dayClockTraffic.className = 'traffic-inline';
dayClock.replaceChildren(dayClockBase, dayClockTraffic);
const operationMonitor = new OperationMonitor();
const operationBtn = $<HTMLButtonElement>('operation-status');
const openBtn = $<HTMLButtonElement>('open-btn');
const closeBtn = $<HTMLButtonElement>('close-btn');
const speedBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];

const playFlow = new PlayFlow({
  panel,
  state: () => state,
  canInteract: () => cafeInteractionEnabled(session.active, isModalOpen() || drawer.paused) && !arrange && !scene.panning && !scene.overview,
  help: helpBrew,
  isPanelCollapsed: () => panelCollapsed,
  setPanelCollapsed: (collapsed) => {
    if (!panelCollapsed && collapsed) panel.captureBrowsingContext();
    panelCollapsed = collapsed; updatePanelVisibility();
  },
  labels: () => ({
    title: t('flow.title'), help: t('flow.help'), helpHint: t('flow.helpHint'),
    pantry: t('flow.pantry'), back: t('flow.back'),
    returnTo: (tab) => tab ? t('flow.return', { tab: t(`tab.${tab}`) }) : t('flow.returnCafe'),
  }),
  pantryContext: (shortage) => pantryTaskContext(state, sim, shortage),
});
const trafficSummary = document.createElement('span');
trafficSummary.className = 'traffic-summary';
playFlow.element.prepend(trafficSummary);
$('app').append(playFlow.element);


function updateDayHud(): void {
  updateReputationButton(state);
  updateRegularGuestsButton(state);
  updatePartnersButton(state);
  updateCafeStyleButton(state);
  const open = state.phase !== 'prep';
  const closing = state.phase === 'closing';
  const time = closing ? t('day.closing') : open ? t('day.openFor', { time: formatOpenTime(state.dayTime) }) : t('day.closed');
  const traffic = trafficHud(state);
  const baseText = `${t('day.label', { n: state.day })} · ${time}`;
  const rhythmText = traffic ? `${traffic.label} → ${traffic.nextLabel}` : '';
  const text = `${baseText}${rhythmText ? ` · ${rhythmText}` : ''}`;
  if (dayClockBase.textContent !== baseText) dayClockBase.textContent = baseText;
  if (dayClockTraffic.textContent !== rhythmText) dayClockTraffic.textContent = rhythmText;
  if (trafficSummary.textContent !== rhythmText) trafficSummary.textContent = rhythmText;
  trafficSummary.hidden = dayClockTraffic.hidden = !traffic;
  dayClock.title = traffic?.description ?? '';
  dayClock.setAttribute('aria-label', traffic ? `${text}. ${traffic.description}` : text);
  $('day-speed').hidden = !open;
  closeBtn.hidden = !open;
  closeBtn.textContent = t(closing ? 'day.finishNow' : 'day.close');
  closeBtn.title = closing ? t('day.discard') : t('day.closeHelp');
  operationBtn.hidden = !open;
  const status = operationMonitor.update(state, sim);
  operationBtn.textContent = t(status.kind === 'ingredients' ? 'flow.shortageTitle' : `ops.${status.kind}`);
  if (!open) operationMonitor.reset();
  $('day-hud').hidden = !isAreaOpen(state, scene.area);
  for (const b of speedBtns) b.classList.toggle('active', Number(b.dataset.speed) === state.speed);
  openBtn.hidden = open || !state.profile || scene.area !== 'main';
  const label = t('day.open', { n: state.day });
  if (openBtn.textContent !== label) openBtn.textContent = label;
  hint.hidden = !open || guide.simplify || !!storage.preference(HINT_KEY);
  updateGuide();
  playFlow.update();
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

const menuEmpty = () => menuItems(state).length === 0;

/** The only way to open: prepare today's menu, then confirm. */
function prepareDay(): void {
  if (state.phase !== 'prep') return;
  const changed = () => { saveGame(); panel.refresh(); };
  const standard = () => showPrepare(state, startDay, changed);
  const step = guide.openingStep;
  if (step && !state.kitchen && unlockedItems(state).every(item => item.id === 'espresso')) {
    setPanelCollapsed(true, false);
    showFirstOpening(state, startDay, changed, { step, confirmStock: () => guide.confirmStock(), advanced: standard });
  } else standard();
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
$('partners-btn').addEventListener('click', () => showPartners(state, sim, saveGame));
$('regular-guests-btn').addEventListener('click', () => showRegularGuests(state, saveGame));
$('cafe-style-btn').addEventListener('click', () => showCafeStyles(state, () => { saveGame(); panel.refresh(); updateDayHud(); }));
operationBtn.addEventListener('click', () => {
  if (!cafeInteractionEnabled(session.active, isModalOpen() || drawer.paused)) return;
  const status = state.phase === 'closing' ? operationStatus(state, sim) : operationMonitor.current;
  if (status.kind === 'ingredients') { playFlow.openPantry(true, operationBtn); return; }
  const detail = t(`ops.${status.kind}.detail`);
  const traffic = trafficHud(state);
  const rhythm = traffic ? `<p class="traffic-explanation">${traffic.description} ${t('flow.traffic.about')}</p>` : '';
  const extra = status.item ? `<p>${itemName(status.item, state)}${status.ingredients?.length ? ` · ${status.ingredients.map(ingredientName).join(t('list.sep'))}` : ''}${status.seconds !== undefined ? ` · ${t('ops.workRemaining', { n: status.seconds })}` : ''}</p>` : '';
  showModal({ title: t(`ops.${status.kind}`), body: `<p>${detail}</p>${extra}${rhythm}`, buttons: [
    { label: t('settings.back'), primary: true },
    ...(status.kind === 'closing' || status.kind === 'steady' ? [] : [{ label: t('tab.upgrades'), onClick: () => showPanelTab('upgrades') }]),
  ] });
});

function showReport(report: DayReport): void {
  playFlow.returnToPrevious(false);
  $('toast').hidden = true;
  saveGame();
  panel.refresh();
  updateDayHud();
  const { body, recommendedTab, advice } = settlementHtml(report, state);
  showModal({
    title: t('report.title', { n: report.day }), icon: ownerIcon(), body,
    buttons: [
      { label: t('report.next'), primary: true, onClick: prepareDay },
      { label: advice.claimableGoal ? t('guide.viewReward') : t(`tab.${recommendedTab}`), onClick: () => {
        showPanelTab(recommendedTab);
        if (advice.claimableGoal) $('goal').querySelector<HTMLButtonElement>('[data-claim]')?.focus();
      } },
    ],
  });
}


function applyStaticText(): void {
  document.documentElement.lang = LOCALES.find((l) => l.id === getLocale())!.htmlLang;
  updateBrand();
  canvas.setAttribute('aria-label', scene.overview ? t('area.overviewHint') : areaName(scene.area));
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
  updateDrawerLabels();
  updateTemporaryNotice();
  shownStats = '';
  panel.refresh();
});

const ownerIcon = () => {
  if (!state.profile) return toDataURL(character({ skin: 0, hair: 1, hairStyle: 1, shirt: 0, pants: 0 }, 'barista').stand, 3);
  const frames = character(state.profile.look, 'owner');
  const art = fineSpriteArt(frames.stand);
  return toDataURL(art.canvas, 3 / art.density);
};

function rememberLocale(locale: Locale): void {
  storage.setPreference(LOCALE_KEY, locale);
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
      // Continue directly into preparation; only the final confirmation opens the shop.
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
      <button class="pixel-btn ghost small" data-guide-replay>${t('guide.replay')}</button>
      <div class="lang-row"><span>${t('settings.language')}</span>${languages}</div>
      <dl class="stats">
        <dt>${t('settings.served')}</dt><dd>${state.served.toLocaleString()}</dd>
        <dt>${t('settings.earned')}</dt><dd>${formatMoney(state.totalEarned)}</dd>
        <dt>${t('settings.days')}</dt><dd>${state.day - 1}</dd>
      </dl>
      <p class="note">${t('settings.shortcuts')}</p>
      <p class="note">${t('settings.pause')}</p>
      <p class="note">${t(session.mode === 'temporary' ? 'save.temporary' : 'settings.saves')}</p>`,
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
  document.querySelector('[data-guide-replay]')?.addEventListener('click', () => guide.showHelp());
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
  playFlow.cancelPantry();
  state = createInitialState(Date.now());
  guide.reset();
  sim.reset();
  scene.livingCats.reset();
  scene.selectedCat = null;
  operationMonitor.reset();
  panel.setState(state);
  regionsUI.select('main');
  updateBrand();
  saveGame();
  startOnboarding();
}

// ------------------------------------------------------------ input

function locateResident(id: CatId): void {
  scene.livingCats.update(state, 0, sim);
  const actor = scene.livingCats.actors.get(id);
  if (!actor) return;
  regionsUI.select(actor.area);
  scene.selectResidentCat(id);
  toast(t('pet.living.located', { name: t(`pet.${id}.name`) }));
}

function greetResident(id: CatId): void {
  if (!scene.petResidentCat(id)) {
    toast(t('pet.living.needsCare'));
    return;
  }
  toast(t('pet.living.greeted', { name: t(`pet.${id}.name`) }));
}

function tapAt(x: number, y: number): void {
  // Keep scene residents touchable at 44 CSS pixels even in a compact café.
  const catHitRadius = Math.max(12, 22 * SCENE_W / Math.max(1, $('scene-area').getBoundingClientRect().width));
  const residentId = scene.hitResidentCat(x, y, catHitRadius);
  if (residentId) {
    const pet = state.pets.find(p => p.id === residentId)!;
    scene.selectResidentCat(residentId);
    showLivingCat(pet, scene.livingCats.actors.get(residentId), () => greetResident(residentId), () => locateResident(residentId));
    return;
  }
  if (!state.pets.length && scene.hitCat(x, y, Math.max(1, state.pets.length))) {
    scene.petCat();
    return;
  }
  helpBrew();
}

/** The button and scene share one optional, persisted service-help cooldown. */
function helpBrew(): boolean {
  if (!cafeInteractionEnabled(session.active, isModalOpen() || drawer.paused) || arrange || scene.panning || scene.overview || state.phase === 'prep' || !sim.boost()) return false;
  sim.baristas.forEach((_, i) => { if (sim.isBrewing(i) && !sim.isHolding(i)) { const p = sim.baristaPose(i); scene.sparkle(p.x, p.y - 15); } });
  if (!hint.hidden) {
    hint.hidden = true;
    storage.setPreference(HINT_KEY, '1');
  }
  return true;
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
  else {
    const actors = [
      ...sim.baristas.map((b, i) => ({ ...sim.baristaPose(i), partnerId: b.partnerId })),
      ...sim.servers, ...sim.cooks,
    ];
    const partner = actors.filter(a => a.partnerId && Math.abs(x - a.x) <= 13 && y <= a.y && y >= a.y - 44)
      .sort((a,b) => b.y-a.y)[0];
    if (partner?.partnerId && cafeInteractionEnabled(session.active, isModalOpen() || drawer.paused)) {
      showPartners(state, sim, saveGame, partner.partnerId); return;
    }
    tapAt(x, y);
  }
}

/** With a mouse, the piece being placed follows the pointer. */
function pointerMove(x: number, y: number): void {
  if (scene.panning || scene.overview || arrange?.mode !== 'place') return;
  scene.ghost = { ...scene.ghost!, ...scene.cellAt(arrange.id, x, y) };
}

window.addEventListener('keydown', (e) => {
  if (!startupComplete || e.defaultPrevented || isComposingKey(e)) return;
  if (!isModalOpen() && !document.querySelector('.onboard-overlay') &&
      !(e.key === 'Escape' && panel.tablePreviewRequested) && drawer.handleKey(e)) return;
  // Preserve native activation and editing; Esc can still close a dialog.
  if (isComposingKey(e)) return;
  const onboarding = !!document.querySelector('.onboard-overlay');
  if (usesNativeKeyboard(e.target) && e.key !== 'Escape') return;
  if (e.key === 'Escape' && panel.tablePreviewRequested && !isModalOpen()) {
    panel.clearTablePreview();
    if (detachedTablePreview) {
      detachedTablePreview = false;
      showPanelTab('upgrades');
    }
    e.preventDefault();
  } else if (e.key === 'Escape' && isModalOpen()) {
    e.preventDefault();
    closeModal();
  } else if (e.key === 'Escape' && shortcuts.handleEscape(e)) {
    return;
  } else if (e.key === 'Escape' && playFlow.handleEscape(e)) {
    return;
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
const autosaveTimer = setInterval(() => { if (startupComplete) saveGame(); }, AUTOSAVE_MS);

// ------------------------------------------------------------ loop

let uiTimer = 0;
let shownCoins = '';
let shownRate = '';

/** Runs once per frame, from the Phaser game loop, before the café is drawn. */
function frame(dt: number): void {
  // Paused while a dialog (like the day report) is up or the tab is hidden; sped up
  // when the player asks.
  const paused = drawer.paused || !startupComplete || !session.active || !!document.getElementById('save-session-notice') || isModalOpen() || document.hidden || !!document.querySelector('.onboard-overlay');
  scene.paused = paused;
  const simDt = paused ? 0 : state.phase !== 'prep' ? dt * state.speed : dt;
  for (let remaining = simDt; remaining > 1e-6; remaining -= SIM_STEP) {
    scene.addEvents(sim.update(state, Math.min(SIM_STEP, remaining)));
  }

  if (!paused && state.phase === 'closing' && sim.finishedService) {
    const report = sim.closeShop(state);
    if (report) showReport(report);
  }

  // Settlement can open a dialog in this frame; hide thoughts immediately.
  scene.paused = paused || isModalOpen();
  if (((panelCollapsed || panelRoot.hidden) && !detachedTablePreview) || scene.paused || !!arrange ||
      scene.area !== 'main' || scene.overview || state.phase !== 'prep') panel.clearTablePreview();
  if (!panel.tablePreviewRequested) detachedTablePreview = false;
  previewExit.hidden = !detachedTablePreview;
  scene.tablePreview = panel.tablePreviewRequested;
  scene.livingCats.update(state, scene.paused ? 0 : dt, sim);
  scene.update(dt, sim);
  sceneWrap.classList.toggle('is-panning', scene.panning);
  sceneWrap.classList.toggle('is-overview', scene.overview);
  stage.classList.toggle('is-panning', scene.panning);
  stage.classList.toggle('is-overview', scene.overview);
  arrangeFocus.update(!!arrange, !scene.panning && !scene.overview && !scene.paused);

  const coins = formatTransactionMoney(state.coins);
  coinsEl.setAttribute('aria-label', t('money.balanceDetails', { money: coins }));
  drawerBalance.setAttribute('aria-label', t('money.balanceDetails', { money: coins }));
  drawerBalance.textContent = t('money.balance', { money: coins });
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

const cafe = new CafeGame(canvas, scene, sim, () => state, {
  tick: (dt) => { roomViewport?.refresh(); frame(dt); }, pointerDown, pointerMove, interactionState: () => arrange,
  interactionEnabled: () => startupComplete && cafeInteractionEnabled(session.active, isModalOpen() || drawer.paused),
  loadingProgress: (loaded, total) => loading.progress(loaded, total),
});
roomViewport = new RoomViewport(canvas, stage,
  () => startupComplete && !scene.panning && cafeInteractionEnabled(session.active, isModalOpen() || drawer.paused),
  () => [scene.area, scene.overview, arrange?.mode, arrange?.mode === 'place' ? arrange.id : '', state.phase].join(':'),
  { isActive: () => scene.overview, toggle: () => regionsUI.toggleOverview() });
fitCanvas();
panel.update();
regionsUI.select('main');
updateDayHud();
// Onboarding must wait until the renderer and its generated portraits are ready.

// The inline resource progress stays visible until the pixel
// fonts are in (or after 2s at most) and the café has drawn its first frame.
waitForStartupReady(cafe.ready, document.fonts.ready).then(() =>
  new Promise<void>((resolve, reject) => requestAnimationFrame(() => {
    try {
    startupComplete = true;
    // Replace any staff thumbnails prepared before the character atlases loaded.
    panel.refresh();
    loading.complete();
    document.body.classList.add('ready');
    if (!state.profile) startOnboarding();
    const movedFurniture = consumeFurnitureMovesOnLoad(state);
    if (movedFurniture > 0) {
      saveGame();
      toast(t('toast.furnitureMovedOnLoad', { n: movedFurniture }));
    }
    setTimeout(() => $('loader').remove(), 300);
    resolve();
    } catch (error) { reject(error); }
  })),
).catch((error: unknown) => {
  startupComplete = false;
  document.body.classList.remove('ready');
  clearInterval(autosaveTimer);
  session.close();
  loading.fail(error);
  roomViewport?.destroy();
  cafe.destroy();
});
}
