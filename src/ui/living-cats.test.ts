// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { petTraffic, type Pet } from '../game/pets';
import { messagesFor, setLocale, t } from '../i18n';
import { PetPanel } from './pets';
import { closeModal, isModalOpen } from './modal';
import { livingCatActivity, showLivingCat, type LivingCatView } from './living-cats';

vi.mock('../render/sprites', () => ({
  catFrames: () => ({ idle: document.createElement('canvas') }),
  toDataURL: () => 'data:image/png;base64,',
}));

const pet: Pet = { id: 'ginger', careSeconds: 180, autoRefill: false };
const actor: LivingCatView = { area: 'main', behavior: 'sleep', affection: 0 };

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '<div id="pets"></div><div id="modal-root"></div>';
});
afterEach(() => { closeModal(); setLocale('en'); document.body.replaceChildren(); });

describe('living cat cards', () => {
  it('shows unique preferences and current activity with touch-sized cosmetic actions', () => {
    const state = createInitialState(0);
    state.pets = [{ ...pet }, { id: 'tuxedo', careSeconds: 90, autoRefill: false }];
    const locate = vi.fn();
    const interact = vi.fn();
    const onChange = vi.fn();
    new PetPanel(document.getElementById('pets')!, state, onChange, { getActor: () => actor, locate, interact });
    document.querySelector<HTMLButtonElement>('[data-pet-view="owned"]')!.click();
    const card = document.querySelector<HTMLElement>('[data-pet="ginger"]')!;
    const other = document.querySelector<HTMLElement>('[data-pet="tuxedo"]')!;
    expect(card.hidden).toBe(false);
    expect(card.querySelector('h3')!.textContent).toBe(`1. ${t('pet.ginger.name')}`);
    expect(other.querySelector('h3')!.textContent).toBe(`2. ${t('pet.tuxedo.name')}`);
    expect(card.textContent).toContain('Playful');
    expect(card.textContent).toContain('Exploring');
    expect(card.textContent).toContain('Napping');
    expect(other.textContent).toContain('Quiet');
    expect(other.textContent).toContain('Reading nook');
    const before = JSON.stringify(state);
    const traffic = petTraffic(state);
    for (const selector of ['[data-locate-cat="ginger"]', '[data-pet-cat="ginger"]']) {
      const button = document.querySelector<HTMLButtonElement>(selector)!;
      expect(button.style.minHeight).toBe('44px');
      expect(button.style.minWidth).toBe('44px');
      expect(button.disabled).toBe(false);
      button.click();
    }
    expect(locate).toHaveBeenCalledWith('ginger');
    expect(interact).toHaveBeenCalledWith('ginger');
    expect(onChange).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
    expect(petTraffic(state)).toBe(traffic);
  });

  it('updates live state and handles missing actors without broken actions', () => {
    const state = createInitialState(0); state.pets = [{ ...pet }];
    let current: LivingCatView | undefined;
    const panel = new PetPanel(document.getElementById('pets')!, state, vi.fn(), { getActor: () => current, interact: vi.fn(), locate: vi.fn() });
    const button = document.querySelector<HTMLButtonElement>('[data-pet-cat="ginger"]')!;
    expect(button.disabled).toBe(true);
    expect(document.querySelector('[data-pet="ginger"] .pet-living-activity')!.textContent).toContain('Settling');
    current = { area: 'reading', behavior: 'groom', affection: 1 };
    panel.update();
    expect(button.disabled).toBe(false);
    expect(document.querySelector('[data-pet="ginger"] .pet-living-activity')!.textContent).toBe('Reading nook · Grooming · Purring happily');
  });

  it('hides living controls on unowned catalog entries and preserves adoption/care controls', () => {
    const state = createInitialState(0); state.coins = 10000;
    const onChange = vi.fn();
    const panel = new PetPanel(document.getElementById('pets')!, state, onChange);
    const card = document.querySelector<HTMLElement>('[data-pet="ginger"]')!;
    expect(card.querySelector<HTMLElement>('.pet-living')!.hidden).toBe(true);
    card.querySelector<HTMLButtonElement>('[data-adopt]')!.click();
    expect(state.pets).toHaveLength(1);
    expect(onChange).toHaveBeenCalledWith('ginger');
    panel.update();
    expect(card.querySelector<HTMLElement>('.pet-living')!.hidden).toBe(false);
    expect(card.querySelector<HTMLButtonElement>('[data-refill]')!.hidden).toBe(false);
    expect(card.querySelector<HTMLInputElement>('input')!.parentElement!.hidden).toBe(false);
  });
});

describe('living cat dialog', () => {
  it('shows care and preference details and invokes one pet action without changing the economy', () => {
    const onPet = vi.fn();
    const before = JSON.stringify(pet);
    showLivingCat(pet, actor, onPet);
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(t('pet.ginger.name'));
    expect(dialog.textContent).toContain('Playful');
    expect(dialog.textContent).toContain('Napping');
    expect(dialog.textContent).toContain('Supplies are stocked');
    const button = [...dialog.querySelectorAll('button')].find(b => b.textContent === t('pet.living.pet'))!;
    button.click(); button.click();
    expect(onPet).toHaveBeenCalledTimes(1);
    expect(isModalOpen()).toBe(false);
    expect(JSON.stringify(pet)).toBe(before);
  });

  it('lets cats rest without petting and supports optional locate', () => {
    const onPet = vi.fn(); const onLocate = vi.fn();
    showLivingCat({ ...pet, careSeconds: 0 }, actor, onPet, onLocate);
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Supplies need refilling');
    const petButton = [...document.querySelectorAll<HTMLButtonElement>('.modal-actions button')].find(b => b.textContent === t('pet.living.pet'))!;
    expect(petButton.disabled).toBe(true);
    petButton.click();
    expect(onPet).not.toHaveBeenCalled();
    [...document.querySelectorAll<HTMLButtonElement>('.modal-actions button')].find(b => b.textContent === t('pet.living.letRest'))!.click();
    expect(onPet).not.toHaveBeenCalled(); expect(onLocate).not.toHaveBeenCalled();
    showLivingCat(pet, actor, onPet, onLocate);
    [...document.querySelectorAll<HTMLButtonElement>('.modal-actions button')].find(b => b.textContent === t('pet.living.locate'))!.click();
    expect(onLocate).toHaveBeenCalledTimes(1);
  });

  it('has matching Chinese and English labels and no unresolved placeholders', () => {
    const keys = (locale: 'en' | 'zh') => Object.keys(messagesFor(locale)).filter(k => k.startsWith('pet.living.')).sort();
    expect(keys('en')).toEqual(keys('zh'));
    setLocale('zh');
    showLivingCat(pet, actor, vi.fn());
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('活泼');
    expect(document.querySelector('[role="dialog"]')!.textContent).not.toMatch(/\{\w+\}|undefined|pet\.living\./);
    for (const behavior of ['patrol', 'sleep', 'groom', 'stretch', 'watch'] as const) expect(livingCatActivity({ ...actor, behavior })).not.toMatch(/undefined|pet\.living\./);
  });
});


describe('cat and guest interaction labels', () => {
  const labels = [
    ['approach', 'Walking over to a guest', '走向客人'],
    ['nuzzle', 'Nuzzling gently', '轻轻蹭蹭'],
    ['response', 'Enjoying a gentle pet', '享受抚摸'],
    ['leave', 'Saying goodbye to a guest', '告别客人'],
  ] as const;

  it.each(labels)('prioritizes %s over ordinary cat behavior in both languages', (phase, english, chinese) => {
    const interacting: LivingCatView = {
      ...actor, behavior: 'watch', targetKind: 'window', affection: 1,
      interaction: { guestId: 42, phase, elapsed: 0.4 },
    };
    const before = JSON.stringify(interacting);
    expect(livingCatActivity(interacting)).toBe(`Main café · ${english} · Purring happily`);
    setLocale('zh');
    expect(livingCatActivity(interacting)).toBe(`${t('pet.living.area.main')} · ${chinese} · ${t('pet.living.happy')}`);
    expect(JSON.stringify(interacting)).toBe(before);
    expect(t(`pet.living.thought.${phase}`)).toBeTruthy();
    expect(t(`pet.living.thought.${phase}`)).not.toMatch(/undefined|pet\.living\.|\{\w+\}/);
  });

  it('shows the interaction in cards and dialogs, then resumes ordinary status', () => {
    const state = createInitialState(0); state.pets = [{ ...pet }];
    const interacting: LivingCatView = { ...actor, interaction: { guestId: 7, phase: 'nuzzle', elapsed: 1 } };
    const panel = new PetPanel(document.getElementById('pets')!, state, vi.fn(), { getActor: () => interacting });
    expect(document.querySelector('[data-pet="ginger"] .pet-living-activity')!.textContent).toBe('Main café · Nuzzling gently');
    showLivingCat(pet, interacting, vi.fn());
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Nuzzling gently');
    delete interacting.interaction;
    panel.update();
    expect(document.querySelector('[data-pet="ginger"] .pet-living-activity')!.textContent).toBe('Main café · Napping');
  });
});
