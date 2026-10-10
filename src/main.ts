import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';

import { CLOSING_GRACE, DAY_SECONDS, SPEEDS, type ItemId } from './game/data';
import { checkOpen, clockHours, formatClock, isClosingTime, openShop, type DayReport } from './game/day';
import {
  awayCapSeconds,
  awayEarnings,
  awayEfficiency,
  earn,
  expectedCustomers,
  readyServings,
  tipMultiplier,
} from './game/economy';
import { canPlace, evictBlocked, moveFurniture, placeFurniture, storeFurniture } from './game/furniture';
import { formatDuration, formatMoney } from './game/format';
import { MIN_SCENE_H, SCENE_W, areaAtPoint, areaOrigin, sceneHeight, setSceneHeight } from './game/layout';
import { adjacentArea, isAreaOpen, mainTableCount, regionOffset } from './game/regions';
import { CELL, COLS, FLOOR_ROWS, WALL_ROWS, furnitureDef } from './game/furniture';
import { Sim, type SimEvent } from './game/sim';
import { applyTheme, comfort } from './game/decor';
import { SAVE_KEY, createInitialState, loadState, saveState, type GameState } from './game/state';
import { LOCALES, LOCALE_KEY, detectLocale, getLocale, onLocaleChange, setLocale, t, type Locale } from './i18n';
import { CafeView } from './render/cafe-view';
import { CafeGame } from './render/phaser/game';
import { character, itemIcon, toDataURL } from './render/sprites';
import { closeModal, isModalOpen, showModal, toast } from './ui/modal';
import { showOnboarding, type OnboardingResult } from './ui/onboarding';
import { Panel, decorName, itemName, type ArrangeRequest } from './ui/panel';
import { RegionsUI, areaName } from './ui/regions';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const HINT_KEY = 'tiny-bean-cafe/hint-done';
const PANEL_COLLAPSED_KEY = 'tiny-bean-cafe/panel-collapsed';
const AUTOSAVE_MS = 5000;
const SIM_STEP = 0.05;

setLocale(detectLocale(localStorage.getItem(LOCALE_KEY), navigator.languages ?? [navigator.language]));

let state: GameState = loadState(localStorage, Date.now());
// Measured before the loop starts, since the loop keeps lastSeen current.
const closedSeconds = (Date.now() - state.lastSeen) / 1000;
const sim = new Sim();
const scene = new CafeView();

// Resuming a day in progress: let the shop fill up a little before the first frame,
// without paying for it.
if (state.phase === 'open' && !isClosingTime(state)) {
  const scratch = structuredClone(state);
  for (let t = 0; t < 12; t += SIM_STEP) sim.update(scratch, SIM_STEP);
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
    height: stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 12,
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
    saveState(localStorage, state);
    const burst = kind === 'goal' ? 14 : 5;
    for (let i = 0; i < burst; i++) scene.sparkle(20 + Math.random() * 150, 30 + Math.random() * 40);
    if (kind === 'goal') toast(t('goal.claimed', { reward: formatMoney(Number(id)) }));
  },
  (request) => startArrange(request),
);

/** Opening a management task also reveals the panel if the player folded it away. */
function showPanelTab(tab: 'menu' | 'pantry'): void {
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
  saveState(localStorage, state);
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
  if (!isAreaOpen(state, scene.area)) regionsUI.select('main');
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
  saveState(localStorage, state);
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
    state.phase === 'open'
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
const openBtn = $<HTMLButtonElement>('open-btn');
const speedBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];

function updateDayHud(): void {
  const open = state.phase === 'open';
  const time = open ? (isClosingTime(state) ? t('day.closing') : formatClock(clockHours(state))) : t('day.closed');
  const text = `${t('day.label', { n: state.day })} · ${time}`;
  if (dayClock.textContent !== text) dayClock.textContent = text;
  $('day-speed').hidden = !open;
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
  const baked = openShop(state);
  saveState(localStorage, state);
  toast(baked > 0 ? t('toast.openedBaked', { n: state.day, baked }) : t('toast.opened', { n: state.day }));
  for (let i = 0; i < 16; i++) scene.sparkle(280 + Math.random() * 30, 30 + Math.random() * 50);
  panel.refresh();
  updateDayHud();
}

function tryOpen(): void {
  const check = checkOpen(state);
  if (check.ok) return startDay();
  if (check.reason === 'emptyMenu') {
    showModal({
      title: t('open.emptyTitle'),
      body: `<p>${t('open.emptyBody')}</p>`,
      buttons: [{ label: t('settings.back'), primary: true, onClick: () => showPanelTab('menu') }],
    });
    return;
  }
  showModal({
    title: t('open.soldOutTitle'),
    body: `<p>${t('open.soldOutBody', {
      items: check.items.map((id) => `${itemName(id)} (${readyServings(state, id)})`).join(t('list.sep')),
    })}</p>`,
    buttons: [
      { label: t('open.toPantry'), primary: true, onClick: () => showPanelTab('pantry') },
      { label: t('open.anyway'), onClick: startDay },
    ],
  });
}
openBtn.addEventListener('click', tryOpen);

/** Shown once the player dismisses the next day report (e.g. the Shift Manager's earnings). */
let afterReport: (() => void) | null = null;

function showReport(report: DayReport): void {
  saveState(localStorage, state);
  panel.refresh();
  updateDayHud();
  const row = (label: string, value: string) => `<dt>${label}</dt><dd>${value}</dd>`;
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
        ${row(t('report.revenue'), formatMoney(report.revenue))}
        ${row(t('report.ingredients'), '−' + formatMoney(report.ingredientCost))}
        ${bakeRows}
      </dl>
      <div class="report-profit"><span>${t('report.profit')}</span><b class="big-money">${report.profit < 0 ? '−' : '+'}${formatMoney(Math.abs(report.profit))}</b></div>
      ${bestHtml}
      ${shelfNote}
      ${staleNote}
      ${out}`,
    buttons: [
      {
        label: t('report.next'),
        primary: true,
        onClick: () => {
          showPanelTab(report.outOfStock.length ? 'pantry' : 'menu');
          const next = afterReport;
          afterReport = null;
          next?.();
        },
      },
    ],
  });
}

let closingAnnounced = false;
/** Feeds simulation events to the scene and reacts to the day closing. */
function handleEvents(events: SimEvent[], show = true): void {
  if (show) scene.addEvents(events);
  for (const e of events) if (e.type === 'dayEnd') showReport(e.report);
  if (isClosingTime(state) && !closingAnnounced) {
    closingAnnounced = true;
    if (show) toast(t('toast.closed'));
  } else if (!isClosingTime(state)) closingAnnounced = false;
}

/**
 * Runs the shop for up to `seconds` of game time in one go (e.g. while the tab was
 * hidden or the browser was closed). Stops when the day ends; returns the time run.
 */
function fastForward(seconds: number): number {
  const left = DAY_SECONDS + CLOSING_GRACE + 1 - state.dayTime;
  const run = Math.min(seconds, left);
  let t = 0;
  for (; t < run && state.phase === 'open'; t += SIM_STEP) handleEvents(sim.update(state, SIM_STEP), false);
  return t;
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
  saveState(localStorage, state);
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
      // "Open the café!" really opens it: day 1 starts right away.
      if (state.phase === 'prep' && checkOpen(state).ok) openShop(state);
      updateDayHud();
      toast(t('ob.opened', { cafe: result.profile.cafeName }));
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
      <p class="note">${t('settings.away', {
        pct: Math.round(awayEfficiency(state) * 100),
        hours: awayCapSeconds(state) / 3600,
      })}</p>
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
  localStorage.removeItem(SAVE_KEY);
  state = createInitialState(Date.now());
  sim.customers = [];
  sim.baristas = [];
  sim.queue = [];
  sim.seats = [];
  panel.setState(state);
  regionsUI.select('main');
  updateBrand();
  saveState(localStorage, state);
  startOnboarding();
}

// ------------------------------------------------------------ input

function tapAt(x: number, y: number): void {
  if (scene.hitCat(x, y)) {
    scene.petCat();
    return;
  }
  if (state.phase !== 'open') return;
  sim.boost();
  for (let i = 0; i < 3; i++) scene.sparkle(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6);
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

// ------------------------------------------------------------ away time

/**
 * Coming back from a fully closed game. If the shop was open, the day kept going:
 * it's played out for real (ingredients, sales, the report). Any time left after
 * that goes to the Shift Manager.
 */
function collectClosedTime(elapsed: number): void {
  state.lastSeen = Date.now();
  let away = elapsed;
  if (state.phase === 'open' && elapsed >= 2) {
    const before = state.totalEarned;
    away = Math.max(0, elapsed - fastForward(elapsed * state.speed) / state.speed);
    saveState(localStorage, state);
    const earned = state.totalEarned - before;
    // Still mid-day: just say what came in. Otherwise the day report is already up.
    if (state.phase === 'open') {
      if (earned > 0) toast(t('toast.busy', { money: formatMoney(earned) }));
      return;
    }
  }
  if (isModalOpen()) afterReport = () => showAwayEarnings(away);
  else showAwayEarnings(away);
}

/** The Shift Manager's earnings for time away while the shop was closed. */
function showAwayEarnings(elapsed: number): void {
  const report = awayEarnings(state, elapsed);
  if (report.earned <= 0 || elapsed < 60) return;
  earn(state, report.earned);
  saveState(localStorage, state);
  const capped = report.seconds > report.countedSeconds;
  showModal({
    title: state.profile?.ownerName ? t('away.titleNamed', { name: state.profile.ownerName }) : t('away.title'),
    icon: ownerIcon(),
    body: `
      <p>${t('away.body', { time: formatDuration(report.seconds) })}</p>
      <p class="big-money">${formatMoney(report.earned)}</p>
      <p class="note">${t('away.rate', { pct: Math.round(awayEfficiency(state) * 100) })}${
        capped ? t('away.capped', { time: formatDuration(report.countedSeconds) }) : ''
      }<br />${t('away.tip')}</p>`,
    buttons: [{ label: t('away.collect'), primary: true }],
  });
}

/** The tab was only hidden (you were working): the day kept running at full speed. */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    state.lastSeen = hiddenAt;
    saveState(localStorage, state);
    return;
  }
  if (!hiddenAt) return;
  const seconds = (Date.now() - hiddenAt) / 1000;
  hiddenAt = 0;
  if (seconds < 2 || state.phase !== 'open') return;
  const before = state.totalEarned;
  fastForward(seconds * state.speed);
  const earned = state.totalEarned - before;
  if (seconds > 10 && earned > 0 && state.phase === 'open') toast(t('toast.busy', { money: formatMoney(earned) }));
});
window.addEventListener('pagehide', () => {
  state.lastSeen = Date.now();
  saveState(localStorage, state);
});
setInterval(() => saveState(localStorage, state), AUTOSAVE_MS);

// ------------------------------------------------------------ loop

let uiTimer = 0;
let shownCoins = '';
let shownRate = '';

/** Runs once per frame, from the Phaser game loop, before the café is drawn. */
function frame(dt: number): void {
  // Paused while a dialog (like the day report) is up; sped up when the player asks.
  const simDt = isModalOpen() || document.querySelector('.onboard-overlay') ? 0 : state.phase === 'open' ? dt * state.speed : dt;
  for (let remaining = simDt; remaining > 1e-6; remaining -= SIM_STEP) {
    handleEvents(sim.update(state, Math.min(SIM_STEP, remaining)));
  }
  if (!document.hidden) state.lastSeen = Date.now();

  scene.update(dt, sim);
  sceneWrap.classList.toggle('is-panning', scene.panning);
  sceneWrap.classList.toggle('is-overview', scene.overview);

  const coins = formatMoney(state.coins);
  if (coins !== shownCoins) coinsEl.textContent = shownCoins = coins;
  uiTimer -= dt;
  if (uiTimer <= 0) {
    uiTimer = 0.25;
    const rate =
      state.phase === 'open'
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
// Saves from before the opening flow existed go through it first, then collect.
if (state.profile) collectClosedTime(closedSeconds);
else startOnboarding(() => collectClosedTime(closedSeconds));

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
