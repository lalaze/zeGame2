// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATS, CARE_SECONDS, type CatId } from '../game/pets';
import { createInitialState, serialize } from '../game/state';
import { setLocale } from '../i18n';
import { registerFineSpriteArt } from '../render/fine-sprite-art';
import { generatedCatFrameIds } from '../render/generated-cat-art';
import { getGeneratedCatAdapter } from '../render/generated-main-art';
import { catFrames, toDataURL, type CatFrames } from '../render/sprites';
import { PetPanel } from './pets';

vi.mock('../render/generated-main-art', () => ({ getGeneratedCatAdapter: vi.fn(() => null) }));
vi.mock('../render/sprites', () => {
  const cache = new Map<CatId, CatFrames>();
  return {
    catFrames: vi.fn((breed: CatId) => {
      if (!cache.has(breed)) {
        const idle = document.createElement('canvas');
        idle.width = 18; idle.height = 14; idle.dataset.art = `legacy-${breed}`;
        cache.set(breed, { idle, swish: idle, blink: idle, happy: idle, walk: [idle, idle], sleep: idle,
          groom: [idle, idle], stretch: idle, watch: idle, lookUp: idle, nuzzle: [idle, idle] });
      }
      return cache.get(breed)!;
    }),
    toDataURL: vi.fn((canvas: HTMLCanvasElement, scale: number) =>
      `data:image/png;${canvas.dataset.art};${canvas.width * scale}x${canvas.height * scale};base64,`),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGeneratedCatAdapter).mockReturnValue(null);
  setLocale('en');
  document.body.innerHTML = '<div id="pets"></div>';
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

function generatedIdle(label = 'generated-siamese', density = 4) {
  const idle = document.createElement('canvas'); idle.width = 24; idle.height = 18;
  idle.dataset.art = `${label}-logical`;
  const backing = document.createElement('canvas'); backing.width = 24 * density; backing.height = 18 * density;
  backing.dataset.art = label;
  registerFineSpriteArt(idle, backing, density);
  return { idle, backing };
}
function adapterFor(idle: HTMLCanvasElement, ready = true) {
  return {
    ready, scales: null, readyBreeds: ['siamese' as CatId], sourceFrameIds: generatedCatFrameIds('siamese'),
    scalesByBreed: {}, errors: [],
    resolve: vi.fn((breed: CatId, fallback: CatFrames) => breed === 'siamese'
      ? { frames: { ...fallback, idle }, generated: true }
      : { frames: fallback, generated: false }),
    drawOffset: () => ({ x: 0, y: 0 }), contactPoints: () => null,
  };
}
const portraits = (breed: CatId) => [
  document.querySelector<HTMLImageElement>(`[data-choose-cat="${breed}"] img`)!,
  document.querySelector<HTMLImageElement>(`[data-pet="${breed}"] img`)!,
];
const urls = (breed: CatId) => portraits(breed).map(img => img.src);
const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;

describe('shared generated cat portraits', () => {
  it('retains twelve distinct legacy portraits and encodes each only once across both views and repeated updates', () => {
    const state = createInitialState(0), before = serialize(state), onChange = vi.fn();
    const panel = new PetPanel(document.querySelector('#pets')!, state, onChange);
    for (const cat of CATS) {
      expect(urls(cat.id)).toEqual(Array(2).fill(`data:image/png;legacy-${cat.id};72x56;base64,`));
      expect(toDataURL).toHaveBeenCalledWith(catFrames(cat.id).idle, 4);
    }
    expect(new Set(CATS.map(cat => urls(cat.id)[0])).size).toBe(12);
    for (let i = 0; i < 100; i++) panel.update();
    button('[data-pet-view="owned"]').click(); button('[data-pet-view="catalog"]').click();
    expect(toDataURL).toHaveBeenCalledTimes(12);
    expect(serialize(state)).toBe(before); expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the ready Siamese 4× backing once in both views without remapping the other eleven breeds', () => {
    const { idle, backing } = generatedIdle(), adapter = adapterFor(idle);
    vi.mocked(getGeneratedCatAdapter).mockReturnValue(adapter);
    const state = createInitialState(0); state.pets = [{ id: 'siamese', careSeconds: 180, autoRefill: false }];
    const before = serialize(state);
    const panel = new PetPanel(document.querySelector('#pets')!, state, vi.fn());
    expect(urls('siamese')).toEqual(Array(2).fill('data:image/png;generated-siamese;96x72;base64,'));
    expect(toDataURL).toHaveBeenCalledWith(backing, 1);
    expect(toDataURL).not.toHaveBeenCalledWith(idle, 4);
    expect(toDataURL).not.toHaveBeenCalledWith(catFrames('siamese').idle, 4);
    for (const cat of CATS.filter(cat => cat.id !== 'siamese')) {
      expect(urls(cat.id)).toEqual(Array(2).fill(`data:image/png;legacy-${cat.id};72x56;base64,`));
      expect(adapter.resolve).toHaveBeenCalledWith(cat.id, catFrames(cat.id));
    }
    button('[data-pet-view="owned"]').click();
    expect(document.querySelector<HTMLElement>('[data-pet="siamese"]')!.hidden).toBe(false);
    for (let i = 0; i < 100; i++) panel.update();
    expect(toDataURL).toHaveBeenCalledTimes(12); expect(serialize(state)).toBe(before);
  });

  it('refreshes an early-opened panel through loading, ready, cleared and failed sets while reusing cached URLs', () => {
    const { idle } = generatedIdle(), adapter = adapterFor(idle, false);
    const state = createInitialState(0), before = serialize(state);
    const panel = new PetPanel(document.querySelector('#pets')!, state, vi.fn());
    const legacyUrls = urls('siamese');
    vi.mocked(getGeneratedCatAdapter).mockReturnValue(adapter); panel.update();
    expect(adapter.resolve).not.toHaveBeenCalled(); expect(urls('siamese')).toEqual(legacyUrls);
    adapter.ready = true; panel.update();
    const generatedUrls = urls('siamese');
    expect(generatedUrls).not.toEqual(legacyUrls); expect(generatedUrls[0]).toBe(generatedUrls[1]);
    expect(toDataURL).toHaveBeenCalledTimes(13);
    vi.mocked(getGeneratedCatAdapter).mockReturnValue(null); panel.update();
    expect(urls('siamese')).toEqual(legacyUrls);
    adapter.ready = false; vi.mocked(getGeneratedCatAdapter).mockReturnValue(adapter); panel.update();
    expect(urls('siamese')).toEqual(legacyUrls);
    adapter.ready = true; panel.update();
    expect(urls('siamese')).toEqual(generatedUrls);
    for (let i = 0; i < 100; i++) panel.update();
    expect(toDataURL).toHaveBeenCalledTimes(13); expect(serialize(state)).toBe(before);
  });

  it('invalidates only the changed backing after a reload, including replacement under the same logical frame', () => {
    const first = generatedIdle('first'), adapter = adapterFor(first.idle);
    vi.mocked(getGeneratedCatAdapter).mockReturnValue(adapter);
    const panel = new PetPanel(document.querySelector('#pets')!, createInitialState(0), vi.fn());
    const replacement = generatedIdle('replacement');
    registerFineSpriteArt(first.idle, replacement.backing, 4);
    panel.update();
    expect(urls('siamese')).toEqual(Array(2).fill('data:image/png;replacement;96x72;base64,'));
    expect(toDataURL).toHaveBeenCalledTimes(13);
    const reloaded = generatedIdle('reloaded');
    vi.mocked(getGeneratedCatAdapter).mockReturnValue(adapterFor(reloaded.idle)); panel.update();
    expect(urls('siamese')).toEqual(Array(2).fill('data:image/png;reloaded;96x72;base64,'));
    panel.update(); expect(toDataURL).toHaveBeenCalledTimes(14);
  });

  it('keeps adoption and care controls working after the generated portrait arrives', () => {
    const state = createInitialState(0); state.coins = 10000;
    const onChange = vi.fn(), panel = new PetPanel(document.querySelector('#pets')!, state, onChange);
    vi.mocked(getGeneratedCatAdapter).mockReturnValue(adapterFor(generatedIdle().idle)); panel.update();
    const cat = CATS.find(cat => cat.id === 'siamese')!, coins = state.coins;
    button('[data-pet="siamese"] [data-adopt]').click(); panel.update();
    expect(state.pets).toHaveLength(1); expect(state.pets[0].id).toBe('siamese');
    expect(state.coins).toBe(coins - cat.adoption);
    const seconds = state.pets[0].careSeconds;
    button('[data-pet="siamese"] [data-refill]').click(); panel.update();
    expect(state.pets[0].careSeconds).toBe(seconds + CARE_SECONDS);
    expect(state.coins).toBe(coins - cat.adoption - cat.careCost);
    expect(onChange.mock.calls).toEqual([['siamese'], ['siamese']]);
    expect(urls('siamese')).toEqual(Array(2).fill('data:image/png;generated-siamese;96x72;base64,'));
    expect(toDataURL).toHaveBeenCalledTimes(13);
  });
});
