// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Look } from '../game/state';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { preloadReferenceCharacters } from '../render/reference-character-art';
import { character } from '../render/sprites';
import { createGeneratedOwnerPreview } from './generated-owner-preview';
import { showOnboarding } from './onboarding';

vi.mock('../render/reference-character-art', () => ({ preloadReferenceCharacters: vi.fn() }));
vi.mock('../render/decor-art', () => ({ paintCounter: vi.fn(), paintFloor: vi.fn(), paintWainscot: vi.fn(), paintWall: vi.fn() }));
vi.mock('../render/sprites', async () => {
  const { registerFineSpriteArt } = await import('../render/fine-sprite-art');
  const cache = new Map();
  return {
    HAIRS: ['#594237', '#976546'], HEAD_ROWS: 16, SHIRTS: ['#bb6b58', '#799ba7'], SKINS: ['#f4cfad', '#dfaa7d'],
    character: vi.fn((look: Look) => {
      const key = JSON.stringify(look);
      if (!cache.has(key)) {
        const frame = document.createElement('canvas'); frame.width = 18; frame.height = 28;
        const fine = document.createElement('canvas'); fine.width = 54; fine.height = 84;
        registerFineSpriteArt(frame, fine, 3);
        cache.set(key, { stand: frame, down: [frame], up: [frame], left: [frame], right: [frame],
          sitLeft: frame, sitRight: frame, sitPetLeft: [frame, frame], sitPetRight: [frame, frame] });
      }
      return cache.get(key);
    }),
  };
});

const defaultLook: Look = { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 };
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let load: ReturnType<typeof deferred>;
const contexts = new WeakMap<HTMLCanvasElement, ReturnType<typeof context>>();
function context() { return { drawImage: vi.fn(), translate: vi.fn(), scale: vi.fn(), imageSmoothingEnabled: true }; }
const draws = (canvas: HTMLCanvasElement) => contexts.get(canvas)?.drawImage;
const drawCount = (canvas: HTMLCanvasElement) => draws(canvas)?.mock.calls.length ?? 0;
const next = () => document.querySelector<HTMLButtonElement>('[data-next]')!.click();
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks();
  load = deferred();
  vi.mocked(preloadReferenceCharacters).mockReturnValue(load.promise);
  vi.stubGlobal('Image', vi.fn(() => { throw new Error('Preview must use the shared atlas loader.'); }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let ctx = contexts.get(this);
    if (!ctx) { ctx = context(); contexts.set(this, ctx); }
    return ctx as unknown as CanvasRenderingContext2D;
  });
  document.body.innerHTML = '<button id="start">Start</button>';
});
afterEach(() => {
  if (document.querySelector('.onboard-overlay')) {
    showOnboarding({ mode: 'edit', onLocale: vi.fn(), onDone: vi.fn() });
    document.querySelector<HTMLButtonElement>('[data-back]')!.click();
  }
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('reference owner preview', () => {
  it('waits for the whole atlas family and reports a load error without painting legacy art', async () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    expect([preview.canvas.width, preview.canvas.height]).toEqual([18, 28]);
    expect([preview.canvas.style.width, preview.canvas.style.height]).toEqual(['90px', '140px']);
    expect(preview.canvas.dataset.loading).toBe('true');
    expect(character).not.toHaveBeenCalled();
    expect(drawCount(preview.canvas)).toBe(0);
    load.reject(new Error('atlas failed')); await flush();
    expect(preview.canvas.dataset.loading).toBe('false');
    expect(preview.canvas.dataset.loadError).toBe('true');
    expect(character).not.toHaveBeenCalled();
    expect(drawCount(preview.canvas)).toBe(0);
    expect(Image).not.toHaveBeenCalled();
    preview.dispose();
  });

  it('uses the shared fine standing frame at its logical size after decoding', async () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 6);
    load.resolve(); await flush();
    expect(character).toHaveBeenCalledExactlyOnceWith(defaultLook, 'owner');
    expect([preview.canvas.width, preview.canvas.height]).toEqual([54, 84]);
    expect([preview.canvas.style.width, preview.canvas.style.height]).toEqual(['108px', '168px']);
    expect(preview.canvas.dataset.generatedOwner).toBe('true');
    expect(preview.canvas.dataset.loading).toBe('false');
    expect(draws(preview.canvas)).toHaveBeenLastCalledWith(fineSpriteArt(character(defaultLook, 'owner').stand).canvas, 0, 0);
    expect(contexts.get(preview.canvas)!.imageSmoothingEnabled).toBe(false);
    expect(Image).not.toHaveBeenCalled();
    preview.dispose();
  });

  it.each(['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const)('keeps custom %s and snapshots it while loading', async key => {
    const look = { ...defaultLook, [key]: 1 }, snapshot = { ...look };
    const preview = createGeneratedOwnerPreview(look, 5);
    look[key] = 0;
    load.resolve(); await flush();
    expect(character).toHaveBeenCalledExactlyOnceWith(snapshot, 'owner');
    expect(preview.canvas.dataset.generatedOwner).toBe('true');
    expect(drawCount(preview.canvas)).toBe(1);
    preview.dispose();
  });

  it('uses an already decoded shared family without a preview-specific image request', async () => {
    vi.mocked(preloadReferenceCharacters).mockResolvedValue(undefined);
    const createImage = vi.fn();
    const preview = createGeneratedOwnerPreview(defaultLook, 5, 'char-sprite', { createImage });
    await flush();
    expect(preloadReferenceCharacters).toHaveBeenCalledOnce();
    expect(preview.canvas.dataset.generatedOwner).toBe('true');
    expect(createImage).not.toHaveBeenCalled();
    expect(Image).not.toHaveBeenCalled();
    preview.dispose();
  });

  it('ignores an old result after switching to a newer custom look', async () => {
    const newer = deferred(), custom = { ...defaultLook, shirt: 1 };
    vi.mocked(preloadReferenceCharacters).mockReturnValueOnce(load.promise).mockReturnValueOnce(newer.promise);
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    preview.update(custom);
    load.resolve(); await flush();
    expect(character).not.toHaveBeenCalled();
    expect(drawCount(preview.canvas)).toBe(0);
    newer.resolve(); await flush();
    expect(character).toHaveBeenCalledExactlyOnceWith(custom, 'owner');
    expect(drawCount(preview.canvas)).toBe(1);
    preview.dispose();
  });

  it('ignores stale requests even after returning to the same look', async () => {
    const newer = deferred();
    vi.mocked(preloadReferenceCharacters).mockReturnValueOnce(load.promise).mockReturnValue(newer.promise);
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    preview.update({ ...defaultLook, hair: 1 }); preview.update(defaultLook);
    load.resolve(); await flush();
    expect(character).not.toHaveBeenCalled();
    newer.resolve(); await flush();
    expect(character).toHaveBeenCalledExactlyOnceWith(defaultLook, 'owner');
    expect(drawCount(preview.canvas)).toBe(1);
    preview.dispose();
  });

  it('ignores an old rejection after a newer look has finished', async () => {
    const newer = deferred(), custom = { ...defaultLook, hair: 1 };
    vi.mocked(preloadReferenceCharacters).mockReturnValueOnce(load.promise).mockReturnValueOnce(newer.promise);
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    preview.update(custom); newer.resolve(); await flush();
    load.reject(new Error('stale failure')); await flush();
    expect(preview.canvas.dataset.loadError).toBeUndefined();
    expect(preview.canvas.dataset.generatedOwner).toBe('true');
    expect(drawCount(preview.canvas)).toBe(1);
    preview.dispose();
  });

  it('can retry after failure and clears the old error', async () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    load.reject(new Error('atlas failed')); await flush();
    const retry = deferred();
    vi.mocked(preloadReferenceCharacters).mockReturnValue(retry.promise);
    preview.update(defaultLook);
    expect(preview.canvas.dataset.loadError).toBeUndefined();
    expect(preview.canvas.dataset.loading).toBe('true');
    retry.resolve(); await flush();
    expect(preview.canvas.dataset.generatedOwner).toBe('true');
    expect(drawCount(preview.canvas)).toBe(1);
    preview.dispose();
  });

  it('cannot be resurrected by late results or updates after disposal', async () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    preview.dispose(); preview.dispose(); preview.update(defaultLook);
    load.resolve(); await flush();
    expect(preloadReferenceCharacters).toHaveBeenCalledOnce();
    expect(character).not.toHaveBeenCalled();
    expect(drawCount(preview.canvas)).toBe(0);
  });
});

describe('onboarding preview lifecycle', () => {
  const profile = () => ({ cafeName: 'Cafe', ownerName: 'Owner', look: { ...defaultLook } });
  it('updates the same edit preview without changing palettes or the original profile', async () => {
    const initial = profile(), onDone = vi.fn();
    showOnboarding({ mode: 'edit', initial, onLocale: vi.fn(), onDone }); next();
    const preview = document.querySelector<HTMLCanvasElement>('.char-preview canvas')!;
    document.querySelectorAll<HTMLButtonElement>('[data-key="shirt"] button')[1].click();
    expect(document.querySelector('.char-preview canvas')).toBe(preview);
    expect(document.querySelectorAll<HTMLButtonElement>('[data-key="shirt"] button')[0].style.background).toBe('#bb6b58');
    // Hairstyle swatches also call character; isolate the deferred owner paint.
    vi.mocked(character).mockClear();
    load.resolve(); await flush();
    expect(character).toHaveBeenCalledExactlyOnceWith({ ...defaultLook, shirt: 1 }, 'owner');
    expect(preview.dataset.generatedOwner).toBe('true');
    next();
    expect(onDone.mock.calls[0][0].profile.look.shirt).toBe(1);
    expect(initial.look.shirt).toBe(0);
  });

  it('uses the same fine standing frame on character and opening steps', async () => {
    showOnboarding({ mode: 'new', initial: profile(), onLocale: vi.fn(), onDone: vi.fn() });
    next(); next();
    const characterCanvas = document.querySelector<HTMLCanvasElement>('.char-preview canvas')!;
    load.resolve(); await flush();
    const first = draws(characterCanvas)!.mock.calls.at(-1)!;
    next(); next(); await flush();
    const openingCanvas = document.querySelector<HTMLCanvasElement>('.opening-owner canvas')!;
    expect(draws(openingCanvas)!.mock.calls.at(-1)).toEqual(first);
    expect(openingCanvas.style.width).toBe('108px');
    next();
    expect(document.querySelector('.onboard-overlay')).toBeNull();
  });

  it('does not paint a dismissed editing page when the atlas load finishes', async () => {
    showOnboarding({ mode: 'edit', initial: profile(), onLocale: vi.fn(), onDone: vi.fn() }); next();
    const preview = document.querySelector<HTMLCanvasElement>('.char-preview canvas')!;
    document.querySelector<HTMLButtonElement>('[data-back]')!.click();
    load.resolve(); await flush();
    expect(preview.isConnected).toBe(false);
    expect(drawCount(preview)).toBe(0);
  });
});

it('keeps the 5x owner and vertical breathing room inside the mobile preview frame', () => {
  const css = readFileSync('src/style.css', 'utf8');
  const rules = [...css.matchAll(/\.char-preview\s*\{([^}]+)\}/g)].map(match => match[1]);
  const minimums = rules.flatMap(rule => [...rule.matchAll(/min-height:\s*(\d+)px/g)].map(match => Number(match[1])));
  expect(minimums.length).toBeGreaterThan(0);
  expect(Math.min(...minimums)).toBeGreaterThanOrEqual(28 * 5 + 16);
});
