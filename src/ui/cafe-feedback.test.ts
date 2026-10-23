// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { openShop } from '../game/day';
import { restockPlan } from '../game/economy';
import { recordRegularGuestArrival, recordRegularGuestService } from '../game/regular-guests';
import { partnerContributions, recordPartnerWork, syncPartners } from '../game/partners';
import { finishDay } from '../game/day';
import { setLocale, t } from '../i18n';
import { CafeLife, closingStory } from './cafe-life';
import { showSoldOut } from './sold-out';
import { closeModal, isModalOpen } from './modal';

beforeEach(() => { setLocale('en'); document.body.innerHTML = '<div id="modal-root"></div>'; });
afterEach(() => { closeModal(); document.body.replaceChildren(); setLocale('en'); });

it.each(['en', 'zh'] as const)('shows the actual sold-out purchase and both outcomes in %s', locale => {
  setLocale(locale);
  const s = createInitialState(0); s.coins = 5; s.pantry.beans = 0; s.phase = 'closing';
  const plan = restockPlan(s), resume = vi.fn(), finish = vi.fn();
  showSoldOut(s, resume, finish);
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.modal-actions button')];
  expect(buttons[0].textContent).toContain(String(plan.cost));
  expect(document.body.textContent).toContain('20:00');
  buttons[0].click(); expect(s.coins).toBe(plan.balance); expect(resume).toHaveBeenCalledOnce(); expect(finish).not.toHaveBeenCalled();
});

it('disables resuming when no complete serving is affordable', () => {
  const s = createInitialState(0); s.coins = 0; s.pantry.beans = 0; s.phase = 'closing';
  const finish = vi.fn(); showSoldOut(s, vi.fn(), finish);
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.modal-actions button')];
  expect(buttons[0].disabled).toBe(true); buttons[1].click(); expect(finish).toHaveBeenCalledOnce();
});

it('offers an arrival story without pausing or marking it read until explicitly finished', () => {
  const s = createInitialState(0); openShop(s);
  const visit = recordRegularGuestArrival(s, 'mina')!; recordRegularGuestService(s, 'mina', visit);
  const save = vi.fn(), life = new CafeLife(save); document.body.append(life.element);
  life.update(s, [{ regularGuestId: 'mina', phase: 'waiting' }], true);
  expect(life.element.hidden).toBe(false); expect(isModalOpen()).toBe(false);
  expect(s.regularGuests.guests.mina!.readChapters).toEqual([]);
  life.element.querySelector('button')!.click(); expect(isModalOpen()).toBe(true);
  expect(s.regularGuests.guests.mina!.readChapters).toEqual([]);
  document.querySelector<HTMLButtonElement>('.modal-actions button')!.click();
  expect(s.regularGuests.guests.mina!.readChapters).toEqual([0]); expect(save).toHaveBeenCalledOnce();
  life.update(s, [{ regularGuestId: 'mina', phase: 'waiting' }], true); expect(life.element.hidden).toBe(true);
});

it('places a worked partner’s unread story in the evening report and preserves intentional reads', () => {
  const s = createInitialState(0); syncPartners(s); openShop(s);
  for (let i = 0; i < 5; i++) recordPartnerWork(s, 'yue');
  expect(partnerContributions(s)[0].jobs).toBe(5);
  const report = finishDay(s), save = vi.fn(), story = closingStory(s, report, save)!;
  document.body.append(story); expect(story.textContent).toContain(t('life.closing', { name: 'Yue' }));
  expect(s.partners.roster.yue.read).toEqual([]);
  story.querySelector('button')!.click(); expect(s.partners.roster.yue.read).toEqual([0]);
  expect(save).toHaveBeenCalledOnce(); expect(closingStory(s, report, save)).toBeNull();
});

it.each(['en', 'zh'] as const)('waits for a real unlocked story and keeps its text behind the read action in %s', locale => {
  setLocale(locale);
  const s = createInitialState(0); openShop(s);
  const visit = recordRegularGuestArrival(s, 'mina')!;
  const save = vi.fn(), life = new CafeLife(save); document.body.append(life.element);
  const visitors = [{ regularGuestId: 'mina', phase: 'waiting' }];
  life.update(s, visitors, true);
  expect(life.element.hidden).toBe(true);
  expect(s.regularGuests.guests.mina!.unlockedChapters).toEqual([]);
  recordRegularGuestService(s, 'mina', visit);
  life.update(s, visitors, true);
  expect(life.element.hidden).toBe(false);
  expect(life.element.textContent).toContain(t('regular.guest.mina.chapter1.title'));
  expect(life.element.textContent).not.toContain(t('regular.guest.mina.chapter1.text'));
  life.element.querySelector('button')!.click();
  expect(document.querySelector('.modal-body')!.textContent).toContain(t('regular.guest.mina.chapter1.text'));
  expect(document.querySelector('.modal-body')!.textContent).not.toBe(t('regular.guest.mina.personality'));
  closeModal();
  expect(s.regularGuests.guests.mina!.readChapters).toEqual([]);
  expect(save).not.toHaveBeenCalled();
});

it('skips an ineligible first visitor and preserves unread stories when postponed', () => {
  const s = createInitialState(0); openShop(s);
  recordRegularGuestArrival(s, 'mina');
  const visit = recordRegularGuestArrival(s, 'theo')!; recordRegularGuestService(s, 'theo', visit);
  const life = new CafeLife(vi.fn()); document.body.append(life.element);
  const visitors = [{ regularGuestId: 'mina', phase: 'waiting' }, { regularGuestId: 'theo', phase: 'sitting' }];
  life.update(s, visitors, true);
  expect(life.element.textContent).toContain(t('regular.guest.theo.name'));
  expect(life.element.textContent).not.toContain(t('regular.guest.mina.personality'));
  life.element.querySelectorAll('button')[1].click();
  life.update(s, visitors, true); expect(life.element.hidden).toBe(true);
  expect(s.regularGuests.guests.theo!.readChapters).toEqual([]);
  s.day++;
  life.update(s, visitors, true); expect(life.element.hidden).toBe(false);
});

it('offers a just-unlocked takeaway story while its guest walks out, but never reoffers a read chapter', () => {
  const s = createInitialState(0); openShop(s);
  const visit = recordRegularGuestArrival(s, 'mina')!; recordRegularGuestService(s, 'mina', visit);
  const save = vi.fn(), life = new CafeLife(save); document.body.append(life.element);
  const visitors = [{ regularGuestId: 'mina', phase: 'exiting' }];
  life.update(s, visitors, true);
  expect(life.element.hidden).toBe(false);
  life.element.querySelector('button')!.click();
  document.querySelector<HTMLButtonElement>('.modal-actions button')!.click();
  expect(save).toHaveBeenCalledOnce();
  const reopened = new CafeLife(save); document.body.append(reopened.element);
  reopened.update(s, visitors, true);
  expect(reopened.element.hidden).toBe(true);
  expect(isModalOpen()).toBe(false);
});
