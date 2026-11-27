// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATS } from '../game/pets';
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
  it('starts with all breeds collapsed and shares explicit filter and expand choices with its owner', () => {
    const state = createInitialState(0);
    state.pets = [{ id: 'ginger', careSeconds: 180, autoRefill: true }];
    const before = serialize(state);
    const browsing = createPetBrowsingState(state);
    expect(browsing).toEqual({ group: 'all', expanded: {} });
    new PetPanel(document.querySelector('#pets')!, state, vi.fn(), {}, browsing);
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    button('[data-pet-group="longhair"]').click();
    const details = document.querySelector<HTMLDetailsElement>('[data-pet="persian"] .card-details')!;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    expect(browsing).toEqual({ group: 'longhair', expanded: { persian: true } });
    // Tapping an adopted cat's summary paw resets incompatible group filter and expands that cat.
    button('[data-jump-cat="ginger"]').click();
    expect(browsing.group).toBe('all');
    expect(browsing.expanded.ginger).toBe(true);
    expect(serialize(state)).toBe(before);
  });

  it('repairs stale group values without leaving the cat grid blank', () => {
    const state = createInitialState(0);
    const browsing = { group: 'removed-group', expanded: {} } as unknown as PetBrowsingState;
    new PetPanel(document.querySelector('#pets')!, state, vi.fn(), {}, browsing);
    expect(browsing).toEqual({ group: 'all', expanded: {} });
    expect(button('[data-pet-group="all"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[data-pet]:not([hidden])')).toHaveLength(CATS.length);
  });

  it('filters visible cards by breed group and restores expanded state on ordinary updates', () => {
    const state = createInitialState(0);
    const browsing: PetBrowsingState = { group: 'shorthair', expanded: { american: true } };
    const panel = new PetPanel(document.querySelector('#pets')!, state, vi.fn(), {}, browsing);
    expect(button('[data-pet-group="shorthair"]').getAttribute('aria-pressed')).toBe('true');
    const visible = [...document.querySelectorAll<HTMLElement>('[data-pet]:not([hidden])')].map((el) => el.dataset.pet);
    expect(visible).toEqual(CATS.filter((c) => c.group === 'shorthair').map((c) => c.id));
    expect(document.querySelector<HTMLDetailsElement>('[data-pet="american"] .card-details')!.open).toBe(true);
    browsing.group = 'removed-group' as PetBrowsingState['group'];
    panel.update();
    expect(browsing.group).toBe('all');
    expect(document.querySelectorAll('[data-pet]:not([hidden])')).toHaveLength(CATS.length);
  });
});
