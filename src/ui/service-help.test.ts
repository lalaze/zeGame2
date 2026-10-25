// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { openShop } from '../game/day';
import { Sim } from '../game/sim';
import { setLocale, t } from '../i18n';
import { closeModal, isModalOpen } from './modal';
import { requestServiceHelp } from './service-help';

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '<button id="help">Help</button><div id="modal-root"></div><div id="toast" hidden></div>';
});
afterEach(() => { closeModal(); document.body.replaceChildren(); });

it('applies the sole brewing action without a dialog and retains the real shared cooldown', () => {
  const state = createInitialState(0);
  state.items.latte = 1; state.onMenu = ['latte']; state.pantry.beans = state.pantry.milk = 100;
  openShop(state);
  const sim = new Sim(() => 0.4);
  for (let i = 0; i < 2000 && !sim.isBrewing(0); i++) sim.update(state, 0.05);
  expect(sim.isBrewing(0)).toBe(true);
  const before = sim.baristas[0].remaining;
  const action = { title: t('flow.helpBrew'), detail: '', perform: () => sim.boost() };
  expect(requestServiceHelp([action], () => true)).toBe(true);
  expect(isModalOpen()).toBe(false);
  expect(sim.baristas[0].remaining).toBeLessThan(before);
  const helped = sim.baristas[0].remaining;
  expect(sim.helpReady).toBe(false);
  expect(requestServiceHelp([action], () => true)).toBe(false);
  expect(sim.baristas[0].remaining).toBe(helped);
});

it('keeps watching the room when there is no useful action', () => {
  expect(requestServiceHelp([], () => true)).toBe(false);
  expect(isModalOpen()).toBe(false);
  expect(document.getElementById('toast')!.textContent).toBe(t('flow.helpEmpty'));
});

it('only pauses for multiple options, closes before applying, and ignores stale double clicks', () => {
  const first = vi.fn(() => !isModalOpen()), second = vi.fn(() => true);
  requestServiceHelp([{ title: 'Brew', detail: 'At the counter', perform: first }, { title: 'Guest', detail: 'Waiting', perform: second }], () => !isModalOpen());
  expect(isModalOpen()).toBe(true);
  expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
  const button = document.querySelector<HTMLButtonElement>('.service-help-option')!;
  button.click(); button.click();
  expect(isModalOpen()).toBe(false);
  expect(first).toHaveBeenCalledOnce(); expect(second).not.toHaveBeenCalled();
});

it('rechecks session/interaction permission after the player selects an option', () => {
  let allowed = true;
  const perform = vi.fn(() => true);
  requestServiceHelp([{ title: 'One', detail: '', perform }, { title: 'Two', detail: '', perform }], () => allowed);
  allowed = false;
  document.querySelector<HTMLButtonElement>('.service-help-option')!.click();
  expect(perform).not.toHaveBeenCalled();
  expect(isModalOpen()).toBe(false);
});
