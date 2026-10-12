// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATS, type CatId } from '../game/pets';
import { createInitialState, serialize } from '../game/state';
import { setLocale } from '../i18n';
import { PetPanel, createPetBrowsingState, type PetBrowsingState } from './pets';

vi.mock('../render/sprites', () => ({
  catFrames: () => ({ idle: document.createElement('canvas') }),
  toDataURL: () => 'data:image/png;base64,',
}));

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '<div id="pets"></div>';
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;

describe('transient pet browsing state', () => {
  it('starts with the first unowned cat and shares all explicit choices with its owner', () => {
    const state = createInitialState(0);
    state.pets = [{ id: 'ginger', careSeconds: 180, autoRefill: true }];
    const before = serialize(state);
    const browsing = createPetBrowsingState(state);
    expect(browsing).toEqual({ mode: 'catalog', group: 'all', selected: 'tuxedo' });
    new PetPanel(document.querySelector('#pets')!, state, vi.fn(), {}, browsing);
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    button('[data-pet-group="longhair"]').click();
    button('[data-choose-cat="persian"]').click();
    button('[data-pet-view="owned"]').click();
    expect(browsing).toEqual({ mode: 'owned', group: 'longhair', selected: 'persian' });
    expect(serialize(state)).toBe(before);
  });

  it('falls back to a visible cat when a remembered ID no longer exists', () => {
    const state = createInitialState(0);
    const before = serialize(state);
    const browsing: PetBrowsingState = { mode: 'catalog', group: 'longhair', selected: 'retired-cat' as CatId };
    new PetPanel(document.querySelector('#pets')!, state, vi.fn(), {}, browsing);
    expect(browsing).toEqual({ mode: 'catalog', group: 'longhair', selected: 'ragdoll' });
    expect(button('[data-choose-cat="ragdoll"]').getAttribute('aria-pressed')).toBe('true');
    expect(button('[data-choose-cat="ragdoll"]').hidden).toBe(false);
    expect([...document.querySelectorAll<HTMLElement>('[data-pet]:not([hidden])')].map((card) => card.dataset.pet)).toEqual(['ragdoll']);
    expect(serialize(state)).toBe(before);
  });

  it('repairs stale view and group values without leaving the catalog blank', () => {
    const state = createInitialState(0);
    const browsing = { mode: 'removed-view', group: 'removed-group', selected: 'removed-cat' } as unknown as PetBrowsingState;
    new PetPanel(document.querySelector('#pets')!, state, vi.fn(), {}, browsing);
    expect(browsing).toEqual({ mode: 'catalog', group: 'all', selected: CATS[0].id });
    expect(button('[data-pet-view="catalog"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[data-choose-cat]:not([hidden])')).toHaveLength(CATS.length);
    expect(document.querySelectorAll('[data-pet]:not([hidden])')).toHaveLength(1);
  });

  it('revalidates a stale selection on an ordinary update and preserves owned mode', () => {
    const state = createInitialState(0);
    const browsing: PetBrowsingState = { mode: 'owned', group: 'shorthair', selected: 'american' };
    const panel = new PetPanel(document.querySelector('#pets')!, state, vi.fn(), {}, browsing);
    browsing.selected = 'retired-cat' as CatId;
    panel.update();
    expect(browsing).toEqual({ mode: 'owned', group: 'shorthair', selected: 'british' });
    expect(button('[data-pet-view="owned"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[data-pet]:not([hidden])')).toHaveLength(0);
    button('[data-pet-view="catalog"]').click();
    expect(document.querySelector<HTMLElement>('[data-pet="british"]')!.hidden).toBe(false);
  });
});
