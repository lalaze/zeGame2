/// <reference types="node" />
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openShop } from './day';
import { bakeForForecast, restock } from './economy';
import { formatMoney, formatTransactionMoney } from './format';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from './layout';
import { adoptCat } from './pets';
import { bookPromotion } from './promotion';
import { Sim } from './sim';
import { createInitialState, serialize } from './state';
import { t } from '../i18n';

const mainSource = readFileSync('src/main.ts', 'utf8');
const sceneSource = readFileSync('src/render/phaser/cafe-scene.ts', 'utf8');
const frameStart = mainSource.indexOf('let uiTimer = 0;');
const frameEnd = mainSource.indexOf('\nconst cafe = new CafeGame', frameStart);
if (frameStart < 0 || frameEnd < 0) throw new Error('Main frame boundaries changed; update the source-execution test harness.');
const frameSource = mainSource.slice(frameStart, frameEnd).replace('function frame(dt: number): void {', 'function frame(dt) {');
const simStep = Number(mainSource.match(/const SIM_STEP = ([\d.]+);/)?.[1]);
if (!Number.isFinite(simStep)) throw new Error('Main simulation step was not found.');
const sceneTick = sceneSource.match(/update\(time: number, delta: number\): void \{\s*([\s\S]*?this\.hooks\.tick\(dt\);)/)?.[1];
const visibilityCallback = mainSource.match(/document\.addEventListener\('visibilitychange', (\(\) => \{[\s\S]*?\n\})\);/)?.[1];
if (!sceneTick || !visibilityCallback) throw new Error('Renderer or visibility handler changed; update the source-execution test harness.');

/** Execute the real production frame and renderer timing prefix, not a copied
 * pause implementation. Rendering/UI collaborators are stubbed; Sim is real.
 * This is a source-contract regression, not native-browser visibility evidence. */
function liveFrame(withCare = true) {
  const state = createInitialState(0);
  state.coins = 1e6;
  state.profile = { cafeName: 'Timing café', ownerName: 'Test', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
  if (withCare) {
    state.kitchen = true; state.upgrades.cook = 1; state.items.roll = 1; state.onMenu.push('roll');
    expect(adoptCat(state, 'ginger')).toBe(true);
    expect(bookPromotion(state, 'noteLocal')).toBe(true);
  }
  bakeForForecast(state); restock(state); openShop(state);
  let seed = 1592594996;
  const sim = new Sim(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; });
  const session = { active: true };
  const drawer = { paused: false };
  let modal = false;
  const scene = { area: 'main', tablePreview: false, paused: false, panning: false, overview: false, addEvents: vi.fn(), update: vi.fn(), livingCats: { update: vi.fn() } };
  const showReport = vi.fn(() => { modal = true; });
  const dependencies = {
    document, state, sim, session, scene, drawer, startupComplete: true,
    panelCollapsed: true, panelRoot: document.createElement('aside'),
    detachedTablePreview: false, previewExit: document.createElement('button'), stage: document.createElement('section'),
    SIM_STEP: simStep, isModalOpen: () => modal, showReport,
    sceneWrap: document.createElement('div'), arrangeFocus: { update: vi.fn() }, arrange: null,
    drawerBalance: document.createElement('button'), coinsEl: document.createElement('button'), rateEl: document.createElement('div'),
    formatMoney, formatTransactionMoney, t, panel: { update: vi.fn(), tablePreviewRequested: false, clearTablePreview: vi.fn() }, regionsUI: { update: vi.fn() },
    updateStats: vi.fn(), updateDayHud: vi.fn(),
  };
  const frame = new Function(...Object.keys(dependencies), `${frameSource}\nreturn frame;`)(...Object.values(dependencies)) as (dt: number) => void;
  const tick = new Function('delta', `${sceneTick}\nreturn dt;`) as (this: { initialized: boolean; loadingFailed: boolean; hooks: { tick: typeof frame } }, delta: number) => number;
  const rawFrame = (milliseconds: number) => tick.call({ initialized: true, loadingFailed: false, hooks: { tick: frame } }, milliseconds);
  return { state, sim, session, scene, drawer, showReport, rawFrame, setModal: (open: boolean) => { modal = open; } };
}

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  setSceneHeight(MIN_SCENE_H); setKitchenLevel(0);
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); setSceneHeight(MIN_SCENE_H); setKitchenLevel(0); });

describe('actual main-frame background and modal timing contract', () => {
  it.each(['hidden tab', 'modal', 'inactive save session', 'save notice', 'onboarding', 'mobile drawer'] as const)('does not advance any real simulation or care while blocked by %s', blocker => {
    const run = liveFrame();
    for (let frame = 0; frame < 80; frame++) run.rawFrame(250);
    if (blocker === 'hidden tab') vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    if (blocker === 'modal') run.setModal(true);
    if (blocker === 'mobile drawer') run.drawer.paused = true;
    if (blocker === 'inactive save session') run.session.active = false;
    if (blocker === 'save notice') document.body.innerHTML = '<div id="save-session-notice"></div>';
    if (blocker === 'onboarding') document.body.innerHTML = '<div class="onboard-overlay"></div>';
    const before = serialize(run.state);
    const runtime = run.sim.snapshot(run.state);
    const update = vi.spyOn(run.sim, 'update');
    run.scene.livingCats.update.mockClear();
    // Even a renderer reporting a minute-long wall gap cannot advance a hidden
    // or dialog-paused business, ingredients, cooking, pet care or promotion.
    for (let frame = 0; frame < 8; frame++) run.rawFrame(60_000);
    expect(update).not.toHaveBeenCalled();
    expect(serialize(run.state)).toBe(before);
    expect(run.sim.snapshot(run.state)).toEqual(runtime);
    expect(run.scene.paused).toBe(true);
    expect(run.scene.livingCats.update.mock.calls.every(call => call[1] === 0)).toBe(true);
    expect(run.showReport).not.toHaveBeenCalled();
  });

  it.each([1, 2, 4] as const)('resumes at %sx without applying the away-time gap', speed => {
    const run = liveFrame(); run.state.speed = speed;
    run.rawFrame(100);
    const before = run.state.dayTime;
    const care = run.state.pets[0].careSeconds;
    const promotion = run.state.promotion!.remaining;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    run.rawFrame(60_000); run.rawFrame(60_000);
    expect(run.state.dayTime).toBe(before);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const dt = run.rawFrame(60_000);
    expect(dt).toBe(0.25); // Production CafeScene clamp, evaluated above.
    expect(run.state.dayTime - before).toBeCloseTo(0.25 * speed, 8);
    expect(care - run.state.pets[0].careSeconds).toBeCloseTo(0.25 * speed, 8);
    expect(promotion - run.state.promotion!.remaining).toBeCloseTo(0.25 * speed, 8);
    expect(run.scene.paused).toBe(false);
    expect(run.scene.livingCats.update.mock.calls.at(-1)?.[1]).toBe(0.25);
  });


  it.each([1, 2, 4] as const)('mobile drawer resumes at %sx and preserves an overlapping modal pause', speed => {
    const run = liveFrame(); run.state.speed = speed;
    run.rawFrame(100);
    run.drawer.paused = true;
    const before = serialize(run.state);
    run.rawFrame(60_000);
    expect(serialize(run.state)).toBe(before);
    expect(run.scene.paused).toBe(true);
    run.setModal(true);
    run.drawer.paused = false;
    run.rawFrame(60_000);
    expect(serialize(run.state)).toBe(before);
    expect(run.scene.paused).toBe(true);
    expect(run.state.speed).toBe(speed);
    run.setModal(false);
    const time = run.state.dayTime;
    const care = run.state.pets[0].careSeconds;
    const promotion = run.state.promotion!.remaining;
    expect(run.rawFrame(60_000)).toBe(0.25);
    expect(run.state.dayTime - time).toBeCloseTo(0.25 * speed, 8);
    expect(care - run.state.pets[0].careSeconds).toBeCloseTo(0.25 * speed, 8);
    expect(promotion - run.state.promotion!.remaining).toBeCloseTo(0.25 * speed, 8);
    expect(run.state.speed).toBe(speed);
    expect(run.scene.paused).toBe(false);
  });

  it('does not settle a finished service while hidden and pauses cat motion as settlement opens', () => {
    const run = liveFrame(false);
    run.sim.beginClosing(run.state);
    expect(run.sim.finishedService).toBe(true);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    run.rawFrame(60_000);
    expect(run.state.phase).toBe('closing'); expect(run.showReport).not.toHaveBeenCalled();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    run.rawFrame(16);
    expect(run.state.phase).toBe('prep'); expect(run.showReport).toHaveBeenCalledOnce();
    expect(run.scene.paused).toBe(true);
    expect(run.scene.livingCats.update.mock.calls.at(-1)?.[1]).toBe(0);
  });

  it('saves on the real visibility handler only when hidden, without advancing the café', () => {
    const run = liveFrame(); run.rawFrame(100);
    const before = serialize(run.state);
    const saved: string[] = [];
    const register = new Function('document', 'saveGame', `const handler = ${visibilityCallback}; document.addEventListener('visibilitychange', handler); return () => document.removeEventListener('visibilitychange', handler);`) as (doc: Document, save: () => void) => () => void;
    const dispose = register(document, () => saved.push(serialize(run.state)));
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(saved).toHaveLength(0);
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(saved).toEqual([before]); expect(serialize(run.state)).toBe(before);
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(saved).toEqual([before]);
    } finally { dispose(); }
  });
});
