import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createInitialState, type GameState } from '../game/state';
import type { GeneratedMainId } from './generated-main-art';

// Leave the generated registry and RoomPainter logic real. A labeled legacy
// icon makes the fallback observable without a browser or pixel rasterizer.
vi.mock('./sprites', () => ({
  OUTLINE: '#39281f',
  pixelSprite: () => ({ width: 18, height: 28 }),
  itemIcon: (id: string) => ({ width: 12, height: 12, itemId: id }),
}));
vi.mock('phaser', () => ({ default: { Scene: class {} } }));

type Asset = HTMLCanvasElement & { assetId: string };
const source = (assetId: string, width = 80, height = 40): Asset =>
  ({ assetId, width, height }) as Asset;

interface Draw {
  source: CanvasImageSource & { assetId?: string; itemId?: string };
  args: number[];
  smoothing: boolean;
  alpha: number;
}

function recordingContext(initialSmoothing = true) {
  const draws: Draw[] = [];
  const stack: { fillStyle: string; globalAlpha: number; imageSmoothingEnabled: boolean }[] = [];
  const context = {
    fillStyle: '#123456', globalAlpha: 0.63, imageSmoothingEnabled: initialSmoothing,
    save: vi.fn(function () {
      stack.push({ fillStyle: context.fillStyle, globalAlpha: context.globalAlpha,
        imageSmoothingEnabled: context.imageSmoothingEnabled });
    }),
    restore: vi.fn(function () { Object.assign(context, stack.pop()!); }),
    fillRect: vi.fn(),
    drawImage: vi.fn((image: Draw['source'], ...args: number[]) => {
      draws.push({ source: image, args, smoothing: context.imageSmoothingEnabled, alpha: context.globalAlpha });
    }),
  };
  return { context, ctx: context as unknown as CanvasRenderingContext2D, draws, stack };
}

let art: typeof import('./generated-main-art');
let RoomPainter: typeof import('./room-art').RoomPainter;
beforeEach(async () => {
  // Each case has a genuinely empty registry, including RoomPainter's import.
  vi.resetModules();
  art = await import('./generated-main-art');
  RoomPainter = (await import('./room-art')).RoomPainter;
});

function install(id: GeneratedMainId, width = 80, height = 40) {
  const image = source(id, width, height);
  art.installGeneratedMainAsset(id, image);
  return image;
}

function pastryState(phase: GameState['phase'], planned: number, remaining: number): GameState {
  const state = createInitialState(0);
  state.phase = phase;
  state.kitchen = true;
  state.onMenu = ['espresso', 'croissant', 'cake', 'roll'];
  for (const id of ['croissant', 'cake', 'roll'] as const) {
    state.items[id] = 1;
    state.bakePlan[id] = planned;
    state.shelf[id] = remaining;
  }
  return state;
}

function pastryPainter(density = 2) {
  const recorded = recordingContext();
  const painter = new RoomPainter(recorded.ctx, density) as unknown as { drawPastryCase(state: GameState): void };
  return { ...recorded, paint: (state: GameState) => painter.drawPastryCase(state) };
}

function food(draws: Draw[]): string[] {
  return draws.flatMap(draw => {
    if (draw.source.itemId) return [`legacy:${draw.source.itemId}`];
    return draw.source.assetId === 'croissant' || draw.source.assetId === 'cake' ? [`generated:${draw.source.assetId}`] : [];
  });
}

describe('generated main-room asset registry and painting', () => {
  it('references only existing runtime PNGs with positive dimensions', () => {
    const files = Object.values(art.GENERATED_MAIN_ASSETS);
    expect(new Set(files).size).toBe(files.length);
    for (const file of files) {
      expect(file).toMatch(/^(?:(?:main|staff|service|wall|menu)-v\d+|customer-0-v1|cat-siamese-v1)\/[a-zA-Z0-9-]+\.png$/);
      expect(file.split('/')).not.toContain('sources');
      const bytes = readFileSync(new URL(`../../public/art/generated/${file}`, import.meta.url));
      expect([...bytes.subarray(0, 8)], file).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(bytes.toString('ascii', 12, 16), file).toBe('IHDR');
      expect(bytes.readUInt32BE(16), file).toBeGreaterThan(0);
      expect(bytes.readUInt32BE(20), file).toBeGreaterThan(0);
    }
  });

  it('queues each runtime image under its own stable key and the configured base URL', async () => {
    const { CafeScene } = await import('./phaser/cafe-scene');
    const loadImage = vi.fn();
    const scene = Object.assign(Object.create(CafeScene.prototype), { load: { image: loadImage } });
    scene.preload();
    expect(loadImage.mock.calls).toEqual(Object.entries(art.GENERATED_MAIN_ASSETS)
      .map(([id, file]) => [art.generatedMainKey(id as GeneratedMainId), `${import.meta.env.BASE_URL}art/generated/${file}`]));
  });

  it('keeps the scene fallback available when registration or this manager texture is missing', async () => {
    const { CafeScene } = await import('./phaser/cafe-scene');
    const image = vi.fn();
    const exists = vi.fn(() => false);
    const scene = Object.assign(Object.create(CafeScene.prototype), { image, textures: { exists } });
    expect(scene.generatedPicture('table', 0, 0, 33, 27, 1)).toBeNull();
    install('table', 563, 462);
    expect(scene.generatedPicture('table', 0, 0, 33, 27, 1)).toBeNull();
    expect(exists).toHaveBeenCalledWith('generated-main:table');
    expect(image).not.toHaveBeenCalled();
  });

  it('keeps missing/invalid assets absent and retains a valid source through an invalid replacement', () => {
    expect(art.generatedMainSource('table')).toBeUndefined();
    for (const [width, height] of [[0, 10], [10, 0], [-1, 10], [10, -1], [NaN, 10]]) {
      art.installGeneratedMainAsset('table', source('invalid', width, height));
      expect(art.generatedMainSource('table')).toBeUndefined();
    }
    const first = install('table', 563, 462);
    expect(art.generatedMainSource('table')).toBe(first);
    art.installGeneratedMainAsset('table', source('empty', 0, 0));
    expect(art.generatedMainSource('table')).toBe(first);
    const replacement = install('table', 1126, 924);
    expect(art.generatedMainSource('table')).toBe(replacement);
    expect(art.generatedMainKey('table')).toBe('generated-main:table');
  });

  it('returns false without touching the context when an asset or target area is absent', () => {
    const recorded = recordingContext();
    expect(art.paintGeneratedMain(recorded.ctx, 'plant', 2, 3, 16, 23)).toBe(false);
    expect(art.paintGeneratedCabinetBand(recorded.ctx, 'cabinet-front', 2, 3, 90, 20)).toBe(false);
    install('plant'); install('cabinet-front');
    for (const [w, h] of [[0, 10], [10, 0], [-1, 10], [10, -1]]) {
      expect(art.paintGeneratedMain(recorded.ctx, 'plant', 2, 3, w, h)).toBe(false);
      expect(art.paintGeneratedCabinetBand(recorded.ctx, 'cabinet-front', 2, 3, w, h)).toBe(false);
    }
    expect(recorded.draws).toEqual([]);
    expect(recorded.context.save).not.toHaveBeenCalled();
    expect(recorded.context.restore).not.toHaveBeenCalled();
    expect(recorded.context).toMatchObject({ fillStyle: '#123456', globalAlpha: 0.63, imageSmoothingEnabled: true });
  });

  it.each([true, false])('samples the selected source without smoothing and restores context state (%s)', smoothing => {
    const image = install('plant', 432, 448);
    const recorded = recordingContext(smoothing);
    expect(art.paintGeneratedMain(recorded.ctx, 'plant', -3.5, 7.5, 22, 23)).toBe(true);
    expect(recorded.draws).toEqual([{ source: image, args: [-3.5, 7.5, 22, 23], smoothing: false, alpha: 0.63 }]);
    expect(recorded.context.save).toHaveBeenCalledTimes(1);
    expect(recorded.context.restore).toHaveBeenCalledTimes(1);
    expect(recorded.context).toMatchObject({ fillStyle: '#123456', globalAlpha: 0.63, imageSmoothingEnabled: smoothing });
    expect(recorded.stack).toEqual([]);
  });

  it.each(['cabinet-top', 'cabinet-front'] as const)('tiles %s at uniform scale and crops the final source segment', id => {
    const image = install(id, 8, 4);
    const recorded = recordingContext();
    expect(art.paintGeneratedCabinetBand(recorded.ctx, id, 2.25, -1.5, 31, 6)).toBe(true);
    expect(recorded.draws.map(draw => draw.args)).toEqual([
      [0, 0, 8, 4, 2.25, -1.5, 12, 6],
      [0, 0, 8, 4, 14.25, -1.5, 12, 6],
      [0, 0, 7 / 1.5, 4, 26.25, -1.5, 7, 6],
    ]);
    for (const draw of recorded.draws) {
      expect(draw.source).toBe(image);
      const [sx, sy, sw, sh, , , dw, dh] = draw.args;
      expect([sx, sy]).toEqual([0, 0]);
      expect(sw).toBeLessThanOrEqual(image.width);
      expect(sh).toBe(image.height);
      expect(dw / sw).toBeCloseTo(dh / sh, 12);
      expect(draw.smoothing).toBe(false);
      expect(draw.alpha).toBe(0.63);
    }
    const last = recorded.draws.at(-1)!.args;
    expect(last[4] + last[6]).toBe(2.25 + 31);
    expect(recorded.context).toMatchObject({ fillStyle: '#123456', globalAlpha: 0.63, imageSmoothingEnabled: true });
    expect(recorded.stack).toEqual([]);
  });

  it('does not emit an extra tile for exact multiples and never stretches a narrow remainder', () => {
    install('cabinet-front', 8, 4);
    for (const [width, expectedWidths] of [[24, [12, 12]], [5, [5]]] as const) {
      const recorded = recordingContext();
      expect(art.paintGeneratedCabinetBand(recorded.ctx, 'cabinet-front', 0, 0, width, 6)).toBe(true);
      expect(recorded.draws.map(draw => draw.args[6])).toEqual(expectedWidths);
      for (const { args } of recorded.draws) expect(args[2]).toBe(args[6] / 1.5);
    }
  });
});

describe('real density-2 pastry painter with generated empty display', () => {
  it.each(['prep', 'open', 'closing'] as const)('draws no food with zero %s stock despite installed food bitmaps', phase => {
    const display = install('display', 1941, 521);
    install('croissant'); install('cake');
    const state = pastryState(phase, 0, 0), before = JSON.stringify(state), recorded = pastryPainter();
    recorded.paint(state);
    expect(recorded.draws.filter(draw => draw.source === display)).toHaveLength(1);
    expect(food(recorded.draws)).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('uses only the preparation plan during prep, even when the live shelf disagrees', () => {
    install('display'); install('croissant'); install('cake');
    const recorded = pastryPainter();
    recorded.paint(pastryState('prep', 1, 0));
    expect(food(recorded.draws)).toEqual(['legacy:roll', 'generated:croissant', 'generated:cake']);
    recorded.draws.length = 0;
    recorded.paint(pastryState('prep', 0, 8));
    expect(food(recorded.draws)).toEqual([]);
  });

  it.each(['open', 'closing'] as const)('uses only live shelf stock during %s and clears sold-out food immediately', phase => {
    install('display'); install('croissant'); install('cake');
    const state = pastryState(phase, 0, 8), recorded = pastryPainter(), before = JSON.stringify(state);
    recorded.paint(state);
    expect(food(recorded.draws)).toEqual(['legacy:roll', 'legacy:roll', 'generated:croissant', 'generated:cake']);
    expect(JSON.stringify(state)).toBe(before);
    for (const id of ['croissant', 'cake', 'roll'] as const) { state.shelf[id] = 0; state.bakePlan[id] = 8; }
    recorded.draws.length = 0;
    recorded.paint(state);
    expect(food(recorded.draws)).toEqual([]);
  });

  it('follows menu, ownership and kitchen changes instead of keeping food baked into the display', () => {
    const display = install('display'); install('croissant'); install('cake');
    const state = pastryState('open', 8, 8), recorded = pastryPainter();
    recorded.paint(state);
    expect(food(recorded.draws)).toContain('generated:croissant');
    state.onMenu = ['espresso', 'roll'];
    recorded.draws.length = 0; recorded.paint(state);
    expect(food(recorded.draws)).toEqual(['legacy:roll', 'legacy:roll']);
    state.onMenu = ['espresso', 'croissant']; state.items.croissant = 0;
    recorded.draws.length = 0; recorded.paint(state);
    expect(food(recorded.draws)).toEqual([]);
    state.items.croissant = 1; state.kitchen = false;
    recorded.draws.length = 0; recorded.paint(state);
    expect(food(recorded.draws)).toEqual([]);
    expect(recorded.draws.filter(draw => draw.source === display)).toHaveLength(1);
  });

  it('falls back per missing food asset while retaining the generated empty display', () => {
    const display = install('display'); install('croissant');
    const recorded = pastryPainter();
    recorded.paint(pastryState('open', 0, 1));
    expect(recorded.draws.filter(draw => draw.source === display)).toHaveLength(1);
    expect(food(recorded.draws)).toEqual(['legacy:roll', 'generated:croissant', 'legacy:cake']);
  });

  it('uses the stock-aware legacy case if the display image is absent', () => {
    install('croissant'); install('cake');
    const recorded = pastryPainter();
    recorded.paint(pastryState('prep', 1, 0));
    expect(food(recorded.draws)).toEqual(['legacy:roll', 'legacy:croissant', 'legacy:cake']);
    expect(recorded.draws.every(draw => draw.source.assetId === undefined)).toBe(true);
    recorded.draws.length = 0;
    recorded.paint(pastryState('open', 8, 0));
    expect(food(recorded.draws)).toEqual([]);
  });

  it('leaves density-1 previews on their existing fallback even when bitmaps are registered', () => {
    install('display'); install('croissant'); install('cake');
    const recorded = pastryPainter(1);
    recorded.paint(pastryState('prep', 1, 0));
    expect(food(recorded.draws)).toEqual(['legacy:roll', 'legacy:croissant', 'legacy:cake']);
    expect(recorded.draws.every(draw => draw.source.assetId === undefined)).toBe(true);
  });
});


describe('shared generated owner adapter', () => {
  it('publishes exactly the ready adapter and clears stale scene ownership', async () => {
    const { getGeneratedStaffAdapter, setGeneratedStaffAdapter } = await import('./generated-main-art');
    const adapter = { ready: true, sourceScale: 0.1, resolve: vi.fn() };
    setGeneratedStaffAdapter(adapter);
    expect(getGeneratedStaffAdapter()).toBe(adapter);
    setGeneratedStaffAdapter(null);
    expect(getGeneratedStaffAdapter()).toBeNull();
  });
});

describe('generated Scene source lifetime', () => {
  it('clears prior successful images so a missing reload cannot reuse stale staff', async () => {
    const { clearGeneratedMainAssets, installGeneratedMainAsset, generatedMainSource, setGeneratedStaffAdapter, getGeneratedStaffAdapter } = await import('./generated-main-art');
    installGeneratedMainAsset('barista-down-stand', source('prior-staff'));
    setGeneratedStaffAdapter({ ready: true, sourceScale: 0.1, resolve: vi.fn() });
    expect(generatedMainSource('barista-down-stand')).toBeTruthy();
    clearGeneratedMainAssets();
    expect(generatedMainSource('barista-down-stand')).toBeUndefined();
    expect(getGeneratedStaffAdapter()).toBeNull();
  });
});
