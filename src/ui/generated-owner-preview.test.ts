// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Look } from '../game/state';
import { GENERATED_MAIN_ASSETS, generatedMainSource, getGeneratedStaffAdapter } from '../render/generated-main-art';
import { createGeneratedStaffArt, GENERATED_STAFF_FRAME_IDS, type GeneratedStaffManifest, type GeneratedStaffSources } from '../render/generated-staff-art';
import runtimeCatalog from '../../assets/generated/runtime-catalog-v1/runtime.json';
import { fineSpriteArt, registerFineSpriteArt } from '../render/fine-sprite-art';
import { character } from '../render/sprites';
import { createGeneratedOwnerPreview } from './generated-owner-preview';
import { showOnboarding } from './onboarding';

vi.mock('../render/generated-main-art', () => ({
  GENERATED_MAIN_ASSETS: { 'barista-down-stand': 'catalog-v1/staff-owner/barista-down-stand.png' },
  getGeneratedStaffAdapter: vi.fn(() => null), generatedMainSource: vi.fn(() => undefined),
}));
vi.mock('../render/decor-art', () => ({ paintCounter: vi.fn(), paintFloor: vi.fn(), paintWainscot: vi.fn(), paintWall: vi.fn() }));
vi.mock('../render/sprites', () => {
  const cache = new Map();
  return {
    HAIRS: ['#594237', '#976546'], HEAD_ROWS: 16, SHIRTS: ['#bb6b58', '#799ba7'], SKINS: ['#f4cfad', '#dfaa7d'],
    character: (look: Look) => {
      const key = JSON.stringify(look);
      if (!cache.has(key)) {
        const frame = document.createElement('canvas'); frame.width = 18; frame.height = 28;
        cache.set(key, { stand: frame, down: [frame], up: [frame], left: [frame], right: [frame],
          sitLeft: frame, sitRight: frame, sitPetLeft: [frame, frame], sitPetRight: [frame, frame] });
      }
      return cache.get(key);
    },
  };
});

const defaultLook: Look = { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 };
const manifest = runtimeCatalog.staffManifest as GeneratedStaffManifest;
const standing = manifest.frames.find(frame => frame.direction === 'down' && frame.state === 'stand')!;
class TestImage {
  src = '';
  width = standing.bbox.x + standing.bbox.w + 12;
  height = standing.bbox.y + standing.bbox.h + 12;
  naturalWidth = 0;
  naturalHeight = 0;
  complete = false;
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  removeAttribute = vi.fn(() => { this.src = ''; });
  load() {
    this.naturalWidth = this.width; this.naturalHeight = this.height; this.complete = true;
    this.onload?.(new Event('load'));
  }
  error() { this.onerror?.(new Event('error')); }
}
const images: TestImage[] = [];
const contexts = new WeakMap<HTMLCanvasElement, ReturnType<typeof context>>();
function context() { return { drawImage: vi.fn(), translate: vi.fn(), scale: vi.fn(), imageSmoothingEnabled: true }; }
const draws = (canvas: HTMLCanvasElement) => contexts.get(canvas)!.drawImage;
const next = () => document.querySelector<HTMLButtonElement>('[data-next]')!.click();

beforeEach(() => {
  images.length = 0;
  vi.clearAllMocks();
  vi.mocked(getGeneratedStaffAdapter).mockReturnValue(null);
  vi.mocked(generatedMainSource).mockReturnValue(undefined);
  vi.stubGlobal('Image', class extends TestImage { constructor() { super(); images.push(this); } });
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

describe('generated default owner preview', () => {
  it('keeps the exact legacy standing frame during loading and after an error', () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    expect(draws(preview.canvas)).toHaveBeenLastCalledWith(character(defaultLook, 'owner').stand, 0, 0);
    expect([preview.canvas.width, preview.canvas.height]).toEqual([18, 28]);
    expect([preview.canvas.style.width, preview.canvas.style.height]).toEqual(['90px', '140px']);
    expect(preview.canvas.dataset.generatedOwner).toBe('false');
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe(`${import.meta.env.BASE_URL}art/generated/${GENERATED_MAIN_ASSETS['barista-down-stand']}`);
    images[0].error();
    expect(draws(preview.canvas)).toHaveBeenCalledTimes(1);
    expect(images[0].onload).toBeNull(); expect(images[0].onerror).toBeNull();
    preview.dispose();
  });

  it('uses the actual manifest crop and exactly the adapter scale/foot without distorting aspect', () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 6);
    const image = images[0]; image.load();
    expect([preview.canvas.width, preview.canvas.height]).toEqual([72, 112]);
    expect([preview.canvas.style.width, preview.canvas.style.height]).toEqual(['108px', '168px']);
    expect(preview.canvas.dataset.generatedOwner).toBe('true');
    const sources: GeneratedStaffSources = Object.fromEntries(manifest.frames.map(frame => [
      `barista-${frame.direction}-${frame.state}`,
      { width: frame.bbox.x + frame.bbox.w + 12, height: frame.bbox.y + frame.bbox.h + 12 } as HTMLCanvasElement,
    ]));
    const adapter = createGeneratedStaffArt(manifest, sources);
    expect(adapter.ready).toBe(true);
    const generated = adapter.resolve({ role: 'owner', look: defaultLook }, character(defaultLook, 'owner'));
    const adapterDraw = draws(fineSpriteArt(generated.frames.stand).canvas).mock.calls[0];
    const uiDraw = draws(preview.canvas).mock.calls.at(-1)!;
    expect(uiDraw[0]).toBe(image);
    expect(uiDraw.slice(1)).toEqual(adapterDraw.slice(1));
    expect(contexts.get(preview.canvas)!.imageSmoothingEnabled).toBe(false);
    expect(GENERATED_STAFF_FRAME_IDS).toHaveLength(9);
    preview.dispose();
  });

  it('prefers the shared renderer adapter without requesting another image', () => {
    const logical = document.createElement('canvas'); logical.width = 18; logical.height = 28;
    const fine = document.createElement('canvas'); fine.width = 72; fine.height = 112;
    registerFineSpriteArt(logical, fine, 4);
    const resolve = vi.fn((_identity, old) => ({ generated: true, frames: { ...old, stand: logical } }));
    vi.mocked(getGeneratedStaffAdapter).mockReturnValue({ ready: true, sourceScale: 0.06, resolve });
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    expect(resolve).toHaveBeenCalledWith({ role: 'owner', look: defaultLook }, character(defaultLook, 'owner'));
    expect(draws(preview.canvas)).toHaveBeenLastCalledWith(fine, 0, 0);
    expect(images).toHaveLength(0);
    preview.dispose();
  });

  it('keeps a failed whole runtime set legacy instead of showing an isolated generated pose', () => {
    vi.mocked(getGeneratedStaffAdapter).mockReturnValue({ ready: false, sourceScale: null,
      resolve: (_identity, frames) => ({ generated: false, frames }) });
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    expect(preview.canvas.dataset.generatedOwner).toBe('false');
    expect(images).toHaveLength(0);
    preview.dispose();
  });

  it('uses an already installed standing source without another request', () => {
    const installed = new TestImage(); installed.load();
    vi.mocked(generatedMainSource).mockReturnValue(installed as unknown as HTMLImageElement);
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    expect(images).toHaveLength(0);
    expect(draws(preview.canvas).mock.calls.at(-1)![0]).toBe(installed);
    preview.dispose();
  });

  it.each(['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const)('does not load or remap a custom %s', key => {
    const look = { ...defaultLook, [key]: 1 };
    const preview = createGeneratedOwnerPreview(look, 5);
    expect(images).toHaveLength(0);
    expect(getGeneratedStaffAdapter).not.toHaveBeenCalled();
    expect(draws(preview.canvas)).toHaveBeenLastCalledWith(character(look, 'owner').stand, 0, 0);
    expect(look[key]).toBe(1);
    preview.dispose();
  });

  it('ignores an old load after switching to a newer custom look', () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    const oldImage = images[0], staleLoad = oldImage.onload!;
    const custom = { ...defaultLook, shirt: 1 };
    preview.update(custom);
    oldImage.naturalWidth = oldImage.width; oldImage.naturalHeight = oldImage.height;
    staleLoad(new Event('load'));
    expect(oldImage.removeAttribute).toHaveBeenCalledWith('src');
    expect(draws(preview.canvas)).toHaveBeenCalledTimes(2);
    expect(draws(preview.canvas)).toHaveBeenLastCalledWith(character(custom, 'owner').stand, 0, 0);
    expect(preview.canvas.dataset.generatedOwner).toBe('false');
    preview.dispose();
  });

  it('ignores a stale request even after returning to the same default look', () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    const oldImage = images[0], staleLoad = oldImage.onload!;
    preview.update({ ...defaultLook, hair: 1 }); preview.update(defaultLook);
    oldImage.naturalWidth = oldImage.width; oldImage.naturalHeight = oldImage.height;
    staleLoad(new Event('load'));
    expect(preview.canvas.dataset.generatedOwner).toBe('false');
    images[1].load();
    expect(draws(preview.canvas).mock.calls.at(-1)![0]).toBe(images[1]);
    preview.dispose();
  });

  it('uses a newly available shared adapter when a standalone request finishes', () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    vi.mocked(getGeneratedStaffAdapter).mockReturnValue({ ready: false, sourceScale: null,
      resolve: (_identity, frames) => ({ generated: false, frames }) });
    images[0].load();
    expect(preview.canvas.dataset.generatedOwner).toBe('false');
    expect(draws(preview.canvas)).toHaveBeenLastCalledWith(character(defaultLook, 'owner').stand, 0, 0);
    preview.dispose();
  });

  it('releases callbacks on dispose and cannot be resurrected by late results or updates', () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    const image = images[0], staleLoad = image.onload!;
    preview.dispose(); preview.dispose();
    image.naturalWidth = image.width; image.naturalHeight = image.height;
    staleLoad(new Event('load')); preview.update(defaultLook);
    expect(image.onload).toBeNull(); expect(image.onerror).toBeNull();
    expect(image.removeAttribute).toHaveBeenCalledTimes(1);
    expect(draws(preview.canvas)).toHaveBeenCalledTimes(1);
    expect(images).toHaveLength(1);
  });

  it('retains fallback on invalid dimensions or a loader construction failure', () => {
    const preview = createGeneratedOwnerPreview(defaultLook, 5);
    images[0].width = 1; images[0].height = 1; images[0].load();
    expect(preview.canvas.dataset.generatedOwner).toBe('false');
    expect(draws(preview.canvas)).toHaveBeenCalledTimes(1);
    preview.dispose();
    const failed = createGeneratedOwnerPreview(defaultLook, 5, 'char-sprite', { createImage: () => { throw new Error('load failed'); } });
    expect(failed.canvas.dataset.generatedOwner).toBe('false');
    expect(draws(failed.canvas)).toHaveBeenCalledTimes(1);
    failed.dispose();
  });
});

describe('onboarding preview lifecycle', () => {
  const profile = () => ({ cafeName: 'Cafe', ownerName: 'Owner', look: { ...defaultLook } });
  it('updates the edit preview without changing palettes and cancels its pending image on leaving', () => {
    const initial = profile(), onDone = vi.fn();
    showOnboarding({ mode: 'edit', initial, onLocale: vi.fn(), onDone }); next();
    expect(images).toHaveLength(1);
    const preview = document.querySelector<HTMLCanvasElement>('.char-preview canvas')!;
    document.querySelectorAll<HTMLButtonElement>('[data-key="shirt"] button')[1].click();
    expect(document.querySelector('.char-preview canvas')).toBe(preview);
    expect(preview.dataset.generatedOwner).toBe('false');
    expect(images[0].onload).toBeNull();
    expect(document.querySelectorAll<HTMLButtonElement>('[data-key="shirt"] button')[0].style.background).toBe('#bb6b58');
    next();
    expect(onDone.mock.calls[0][0].profile.look.shirt).toBe(1);
    expect(initial.look.shirt).toBe(0);
  });

  it('uses the same standing geometry on character and opening steps and disposes replaced previews', () => {
    showOnboarding({ mode: 'new', initial: profile(), onLocale: vi.fn(), onDone: vi.fn() });
    next(); next();
    const characterCanvas = document.querySelector<HTMLCanvasElement>('.char-preview canvas')!;
    images[0].load();
    const first = draws(characterCanvas).mock.calls.at(-1)!;
    next(); next();
    const openingCanvas = document.querySelector<HTMLCanvasElement>('.opening-owner canvas')!;
    expect(images).toHaveLength(2);
    const staleLoad = images[1].onload!;
    images[1].load();
    expect(draws(openingCanvas).mock.calls.at(-1)!.slice(1)).toEqual(first.slice(1));
    expect(openingCanvas.style.width).toBe('108px');
    next();
    const count = draws(openingCanvas).mock.calls.length;
    staleLoad(new Event('load'));
    expect(draws(openingCanvas)).toHaveBeenCalledTimes(count);
    expect(document.querySelector('.onboard-overlay')).toBeNull();
  });
});


it('keeps the 5x owner and vertical breathing room inside the mobile preview frame', () => {
  const css = readFileSync('src/style.css', 'utf8');
  const rules = [...css.matchAll(/\.char-preview\s*\{([^}]+)\}/g)].map(match => match[1]);
  const minimums = rules.flatMap(rule => [...rule.matchAll(/min-height:\s*(\d+)px/g)].map(match => Number(match[1])));
  expect(minimums.length).toBeGreaterThan(0);
  expect(Math.min(...minimums)).toBeGreaterThanOrEqual(28 * 5 + 16);
});
