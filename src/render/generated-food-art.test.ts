import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { MENU, type ItemId } from '../game/data';
import { COUNTER, PASTRY_CASE } from '../game/layout';
import { createInitialState } from '../game/state';
import { paintPastryFridge, paintRack } from './kitchen-art';
import { RoomPainter } from './room-art';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedFoodArt, GENERATED_FOOD_DENSITY, GENERATED_FOOD_ENVELOPES, GENERATED_FOOD_IDS,
  type GeneratedFoodId, type GeneratedFoodSources } from './generated-food-art';
import { clearGeneratedMainAssets, getGeneratedFoodAdapter, setGeneratedFoodAdapter } from './generated-main-art';
import { ITEM_ART, itemArtwork, itemIcon } from './sprites';

type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean; operation: string };
class RecordingCanvas {
  width = 0; height = 0;
  draws: Draw[] = [];
  fills: { color: string; operation: string; args: number[] }[] = [];
  context = {
    imageSmoothingEnabled: true, globalCompositeOperation: 'source-over', fillStyle: '',
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    drawImage: (source: CanvasImageSource, ...args: number[]) => {
      this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled, operation: this.context.globalCompositeOperation });
    },
    fillRect: (...args: number[]) => {
      this.fills.push({ color: this.context.fillStyle, operation: this.context.globalCompositeOperation, args });
    },
  };
  getContext() { return this.context; }
}
const recorded = (canvas: HTMLCanvasElement) => canvas as unknown as RecordingCanvas;
const source = (width = 100, height = 80) => ({ width, height }) as HTMLCanvasElement;
function fixture() {
  const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/menu/manifest.json', 'utf8'));
  const sizes: Record<string, readonly [number, number]> = Object.fromEntries(
    manifest.assets.map((asset: { itemId: string; size: [number, number] }) => [asset.itemId, asset.size]));
  Object.assign(sizes, { espresso: [531, 459], latte: [682, 540], eggtart: [613, 473], croissant: [437, 293], cake: [336, 327] });
  const sources = Object.fromEntries(GENERATED_FOOD_IDS.map(id => [id, source(...sizes[id])])) as Record<GeneratedFoodId, CanvasImageSource>;
  const canvases: RecordingCanvas[] = [];
  const createCanvas = vi.fn(() => { const canvas = new RecordingCanvas(); canvases.push(canvas); return canvas as unknown as HTMLCanvasElement; });
  const create = (input: GeneratedFoodSources = sources) => createGeneratedFoodArt(input, { createCanvas });
  return { sources, canvases, createCanvas, create };
}
afterEach(() => { clearGeneratedMainAssets(); vi.unstubAllGlobals(); });

/** Decode only these archived 8-bit RGBA PNGs, independently of canvas mocks. */
function pngAlpha(path: string) {
  const bytes = readFileSync(path), width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  expect([bytes[24], bytes[25], bytes[28]]).toEqual([8, 6, 0]);
  const chunks: Buffer[] = [];
  for (let i = 8; i < bytes.length;) {
    const n = bytes.readUInt32BE(i), type = bytes.toString('ascii', i + 4, i + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(i + 8, i + 8 + n));
    i += n + 12;
  }
  const packed = inflateSync(Buffer.concat(chunks)), stride = width * 4, pixels = new Uint8Array(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0;
      const c = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const predictors = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)];
      pixels[i] = (packed[y * (stride + 1) + 1 + x] + predictors[filter]) & 255;
    }
  }
  const bounds = (threshold: number) => {
    let left = width, top = height, right = 0, bottom = 0, count = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] > threshold) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); count++;
    }
    return { box: [left, top, right, bottom], count };
  };
  return { width, height, bounds, cornerAlpha: [pixels[3], pixels[stride - 1], pixels[(height - 1) * stride + 3], pixels[pixels.length - 1]] };
}

describe('generated food bitmap adapter', () => {
  it('fits every whole PNG isotropically inside the exact old logical envelope with 4× backing', () => {
    const { create, sources } = fixture(), adapter = create();
    expect(adapter.ready).toBe(true);
    expect(adapter.readyIds).toEqual(GENERATED_FOOD_IDS);
    for (const id of GENERATED_FOOD_IDS) {
      const [w, h] = GENERATED_FOOD_ENVELOPES[id];
      expect([Math.max(...ITEM_ART[id].rows.map(row => row.length)), ITEM_ART[id].rows.length]).toEqual([w, h]);
      const bare = adapter.icon(id, false)!, icon = adapter.icon(id)!, artwork = adapter.artwork(id)!;
      expect([bare.width, bare.height]).toEqual([w, h]);
      expect([icon.width, icon.height]).toEqual([w + 2, h + 2]);
      expect([artwork.width, artwork.height]).toEqual([(w + 2) * 3, (h + 2) * 3]);
      expect(fineSpriteArt(bare).density).toBe(GENERATED_FOOD_DENSITY);
      expect(fineSpriteArt(icon).density).toBe(GENERATED_FOOD_DENSITY);
      const backing = fineSpriteArt(bare).canvas;
      expect([backing.width, backing.height]).toEqual([w * 4, h * 4]);
      const draw = recorded(backing).draws[0], size = sources[id] as HTMLCanvasElement;
      expect(draw.source).toBe(sources[id]);
      expect(draw.args.slice(0, 4)).toEqual([0, 0, size.width, size.height]);
      const [, , sw, sh, x, y, dw, dh] = draw.args;
      expect(dw / sw).toBeCloseTo(dh / sh, 12);
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + dw).toBeLessThanOrEqual(backing.width + 1e-10);
      expect(y + dh).toBeLessThanOrEqual(backing.height + 1e-10);
      expect(x * 2 + dw).toBeCloseTo(backing.width, 12);
      expect(y * 2 + dh).toBeCloseTo(backing.height, 12);
      expect(draw.smoothing).toBe(false);
      // UI artwork samples the same genuine bitmap, never the coarse logical icon.
      const uiBody = recorded(artwork).draws.at(-1)!.source as HTMLCanvasElement;
      expect(recorded(uiBody).draws[0].source).toBe(sources[id]);
      expect(recorded(uiBody).draws[0].args.slice(0, 4)).toEqual([0, 0, size.width, size.height]);
    }
  });

  it('preserves authored alpha/contours and adds only an optional warm alpha-mask outline', () => {
    const adapter = fixture().create();
    const bare = fineSpriteArt(adapter.icon('espresso', false)!).canvas;
    const icon = fineSpriteArt(adapter.icon('espresso')!).canvas;
    expect(recorded(bare).fills).toEqual([]);
    const outlined = recorded(icon);
    expect(outlined.draws.slice(0, 4).map(draw => draw.args)).toEqual([[3, 4], [5, 4], [4, 3], [4, 5]]);
    expect(outlined.draws.every(draw => draw.source === bare && !draw.smoothing)).toBe(true);
    expect(outlined.fills).toEqual([{ color: '#39281f', operation: 'source-in', args: [0, 0, 56, 56] }]);
    expect(outlined.draws.at(-1)).toMatchObject({ source: bare, args: [4, 4], operation: 'source-over' });
    // The source is painted intact after the mask. No alpha-threshold reads,
    // background rectangle, erasing or per-axis distortion can enter this path.
    expect(outlined.draws).toHaveLength(5);
  });

  it('publishes each item atomically, allowing missing items to retain their legacy identity', () => {
    const { sources, create } = fixture();
    delete (sources as Partial<typeof sources>).latte;
    const adapter = create();
    expect(adapter.readyIds).toEqual(GENERATED_FOOD_IDS.filter(id => id !== 'latte'));
    expect(adapter.icon('latte')).toBeUndefined(); expect(adapter.artwork('latte')).toBeUndefined();
    for (const id of adapter.readyIds) expect(adapter.icon(id)).toBeDefined();
    const empty = create({});
    expect(empty.ready).toBe(false); expect(empty.readyIds).toEqual([]);
  });

  it('covers the exact static catalog and source manifests, without adding runtime crops or signature identities', () => {
    const catalog = JSON.parse(readFileSync('docs/pixel-depth/BULK-ASSET-CATALOG.json', 'utf8'));
    const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/menu/manifest.json', 'utf8'));
    expect(GENERATED_FOOD_IDS).toHaveLength(55);
    expect(GENERATED_FOOD_IDS).toEqual(MENU.map(item => item.id));
    expect(GENERATED_FOOD_ENVELOPES).toEqual(Object.fromEntries(
      catalog.menu.map((item: { id: string; logicalBare: number[] }) => [item.id, item.logicalBare])));
    const originals = ['espresso', 'latte', 'eggtart', 'croissant', 'cake'];
    expect([...manifest.assets.map((asset: { itemId: string }) => asset.itemId), ...originals].sort())
      .toEqual([...GENERATED_FOOD_IDS].sort());
    for (const asset of manifest.assets) {
      expect(asset.logicalBare).toEqual(GENERATED_FOOD_ENVELOPES[asset.itemId as GeneratedFoodId]);
      const bytes = readFileSync(`assets/generated/bulk-candidates/menu/${asset.file}`);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(asset.size);
    }
  });

  it('never allocates or substitutes sources for unknown IDs or signature recipes', () => {
    const { create, createCanvas, sources } = fixture();
    const extra = { ...sources, unknown: source(), 'sig:coffee:beans=1': source() };
    const adapter = create(extra), count = createCanvas.mock.calls.length;
    for (const id of ['unknown', '__proto__', 'constructor', 'sig:coffee:beans=1']) {
      expect(adapter.icon(id as ItemId)).toBeUndefined(); expect(adapter.artwork(id as ItemId)).toBeUndefined();
    }
    expect(adapter.readyIds).toEqual(GENERATED_FOOD_IDS);
    expect(createCanvas).toHaveBeenCalledTimes(count);
  });

  it('bounds allocation to six canvases per identity and returns stable independent bare, outlined and UI cache entries', () => {
    const { create, createCanvas } = fixture(), adapter = create();
    expect(createCanvas).toHaveBeenCalledTimes(55 * 6);
    const outputs = GENERATED_FOOD_IDS.flatMap(id => [adapter.icon(id)!, adapter.icon(id, false)!, adapter.artwork(id)!]);
    expect(new Set(outputs).size).toBe(55 * 3);
    for (let i = 0; i < 100; i++) for (const id of GENERATED_FOOD_IDS) {
      expect(adapter.icon(id)).toBe(outputs[GENERATED_FOOD_IDS.indexOf(id) * 3]);
      expect(adapter.icon(id, false)).toBe(outputs[GENERATED_FOOD_IDS.indexOf(id) * 3 + 1]);
      expect(adapter.artwork(id)).toBe(outputs[GENERATED_FOOD_IDS.indexOf(id) * 3 + 2]);
    }
    expect(createCanvas).toHaveBeenCalledTimes(55 * 6);
  });

  it('rejects unloaded or invalid image dimensions without allocating a blank replacement', () => {
    const { create, createCanvas } = fixture();
    for (const invalid of [source(0, 20), source(20, -1), source(NaN, 20), source(Infinity, 20),
      { width: 100, height: 80, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement,
      { width: 100, height: 80, complete: false, naturalWidth: 100, naturalHeight: 80 } as HTMLImageElement,
      { width: 100, height: 80, naturalWidth: 100 } as HTMLImageElement,
      { width: 100, height: 80, videoWidth: 100 } as HTMLVideoElement,
      { width: 100, height: 80, displayHeight: 80 } as unknown as VideoFrame]) {
      expect(create({ espresso: invalid }).ready).toBe(false);
    }
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('falls back after drawing/allocation failure and can recover on a fresh load', () => {
    const { sources, createCanvas, create } = fixture();
    expect(createGeneratedFoodArt(sources, { createCanvas: () => { throw new Error('unavailable'); } }).ready).toBe(false);
    const allocation = vi.fn(() => {
      if (allocation.mock.calls.length === 4) throw new Error('partial espresso bake failed');
      return createCanvas();
    });
    const partial = createGeneratedFoodArt(sources, { createCanvas: allocation });
    expect(partial.icon('espresso')).toBeUndefined(); expect(partial.artwork('espresso')).toBeUndefined();
    expect(partial.readyIds).toEqual(GENERATED_FOOD_IDS.filter(id => id !== 'espresso'));
    expect(create().readyIds).toEqual(GENERATED_FOOD_IDS);
  });

  it.each([
    { width: 9, height: 90, complete: true, naturalWidth: 800, naturalHeight: 200 },
    { width: 9, height: 90, videoWidth: 800, videoHeight: 200 },
    { width: 9, height: 90, displayWidth: 800, displayHeight: 200 },
  ])('uses the native dimension pair rather than display attributes: %j', input => {
    const { create } = fixture(), original = input as unknown as CanvasImageSource;
    const adapter = create({ baguette: original });
    const backing = fineSpriteArt(adapter.icon('baguette', false)!).canvas;
    const world = recorded(backing).draws[0];
    expect(world.args.slice(0, 4)).toEqual([0, 0, 800, 200]);
    expect(world.args.slice(4)).toEqual([0, 16, 48, 12]);
    const uiBody = recorded(adapter.artwork('baguette')!).draws.at(-1)!.source as HTMLCanvasElement;
    const ui = recorded(uiBody).draws[0];
    expect(ui.args.slice(0, 4)).toEqual([0, 0, 800, 200]);
    expect(ui.args[6] / 800).toBe(ui.args[7] / 200);
  });

  it.each([1, 2, 3, 4, 5, 6])('publishes nothing for an identity whose canvas %i fails', failAt => {
    const { sources, createCanvas } = fixture();
    let count = 0;
    const adapter = createGeneratedFoodArt({ espresso: sources.espresso, latte: sources.latte }, { createCanvas: () => {
      if (++count === failAt) throw new Error('allocation failed');
      return createCanvas();
    } });
    expect(adapter.readyIds).toEqual(['latte']);
    expect(adapter.icon('espresso', false)).toBeUndefined();
    expect(adapter.icon('espresso')).toBeUndefined(); expect(adapter.artwork('espresso')).toBeUndefined();
    expect(adapter.artwork('latte')).toBeDefined();
  });

  it('falls back independently for a null context and a failed source draw', () => {
    const { sources, createCanvas } = fixture();
    const noContext = createGeneratedFoodArt({ espresso: sources.espresso }, {
      createCanvas: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    });
    expect(noContext.ready).toBe(false);
    const adapter = createGeneratedFoodArt({ espresso: sources.espresso, latte: sources.latte }, { createCanvas: () => {
      const canvas = createCanvas(), mock = recorded(canvas), draw = mock.context.drawImage;
      mock.context.drawImage = (image, ...args) => {
        if (image === sources.espresso) throw new Error('decode/draw failed');
        draw(image, ...args);
      };
      return canvas;
    } });
    expect(adapter.readyIds).toEqual(['latte']);
    expect(adapter.icon('espresso')).toBeUndefined(); expect(adapter.artwork('espresso')).toBeUndefined();
  });

  it('keeps all 55 identities independent across fresh, partial and empty reloads', () => {
    const { create, sources } = fixture(), first = create(), partial = create({ macaron: sources.macaron }), empty = create({});
    expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.readyIds)).toBe(true);
    expect(partial.readyIds).toEqual(['macaron']); expect(empty.readyIds).toEqual([]);
    for (const id of GENERATED_FOOD_IDS) {
      expect(first.icon(id)).toBeDefined(); expect(first.artwork(id)).toBeDefined();
      if (id === 'macaron') {
        expect(partial.icon(id)).not.toBe(first.icon(id)); expect(partial.artwork(id)).not.toBe(first.artwork(id));
      } else {
        expect(partial.icon(id)).toBeUndefined(); expect(partial.artwork(id)).toBeUndefined();
      }
      expect(empty.icon(id)).toBeUndefined(); expect(empty.artwork(id)).toBeUndefined();
    }
  });

  it('refreshes legacy cache hits on install, clears on reload and never reuses a prior generated adapter', () => {
    const { createCanvas, create, sources } = fixture();
    vi.stubGlobal('document', { createElement: createCanvas });
    const oldIcon = itemIcon('espresso'), oldBare = itemIcon('espresso', false), oldArt = itemArtwork('espresso');
    const untouched = itemIcon('blacktea'), untouchedArt = itemArtwork('blacktea');
    const first = create({ ...sources, blacktea: undefined }); setGeneratedFoodAdapter(first);
    expect(itemIcon('espresso')).toBe(first.icon('espresso'));
    expect(itemIcon('espresso', false)).toBe(first.icon('espresso', false));
    expect(itemArtwork('espresso')).toBe(first.artwork('espresso'));
    expect(itemIcon('blacktea')).toBe(untouched); expect(itemArtwork('blacktea')).toBe(untouchedArt);
    clearGeneratedMainAssets();
    expect(getGeneratedFoodAdapter()).toBeNull();
    expect(itemIcon('espresso')).toBe(oldIcon); expect(itemIcon('espresso', false)).toBe(oldBare); expect(itemArtwork('espresso')).toBe(oldArt);
    const second = create({ ...sources, espresso: source(40, 80) }); setGeneratedFoodAdapter(second);
    expect(itemIcon('espresso')).toBe(second.icon('espresso'));
    expect(itemIcon('espresso')).not.toBe(first.icon('espresso'));
    expect(itemArtwork('espresso')).not.toBe(first.artwork('espresso'));
    // A later failed load must not retain the earlier successful identity.
    clearGeneratedMainAssets(); setGeneratedFoodAdapter(create({}));
    expect(itemIcon('espresso')).toBe(oldIcon); expect(itemArtwork('espresso')).toBe(oldArt);
  });

  it('uses the generated backing in the kitchen fridge/rack without enlarging or squeezing its logical footprint', () => {
    const adapter = fixture().create(); setGeneratedFoodAdapter(adapter);
    const icon = adapter.icon('eggtart', false)!, backing = fineSpriteArt(icon).canvas;
    const rack = new RecordingCanvas();
    paintRack(rack.context as unknown as CanvasRenderingContext2D, 20, 100, ['eggtart']);
    expect(rack.draws).toHaveLength(2);
    for (const draw of rack.draws) {
      expect(draw.source).toBe(backing);
      expect(draw.args.slice(2)).toEqual([8, 6]);
      expect(draw.args[2] / icon.width).toBe(draw.args[3] / icon.height);
    }
    const fridge = new RecordingCanvas();
    paintPastryFridge(fridge.context as unknown as CanvasRenderingContext2D, 20, 100, ['eggtart']);
    expect(fridge.draws).toHaveLength(1);
    expect(fridge.draws[0].source).toBe(backing);
    expect(fridge.draws[0].args.slice(2)).toEqual([icon.width, icon.height]);
  });

  // The case is painted by hand with each pastry's menu icon (b1d6305); the generated food adapter supplies them.
  it('bottom-centers generated display-case pastries at native aspect inside the case', () => {
    const state = createInitialState(0); state.kitchen = true; state.phase = 'prep';
    state.onMenu = ['croissant', 'cake'];
    for (const id of ['croissant', 'cake'] as const) { state.items[id] = 1; state.bakePlan[id] = 1; }
    const adapter = fixture().create(); setGeneratedFoodAdapter(adapter);
    const icons = { croissant: adapter.icon('croissant', true)!, cake: adapter.icon('cake', true)! };
    const canvas = new RecordingCanvas();
    const painter = new RoomPainter(canvas.context as unknown as CanvasRenderingContext2D, 2) as unknown as {
      drawPastryCase(input: typeof state): void;
    };
    painter.drawPastryCase(state);
    const bottoms: number[] = [];
    for (const [id, icon] of Object.entries(icons)) {
      const food = canvas.draws.filter(draw => draw.source === fineSpriteArt(icon).canvas);
      expect(food, id).toHaveLength(1);
      const [, y, w, h] = food[0].args;
      expect([w, h]).toEqual([icon.width, icon.height]);
      expect(w / icon.width).toBeCloseTo(h / icon.height, 12);
      // Outlined icons fit the narrowest slot of a full five-dish case and its interior height.
      expect(w).toBeLessThanOrEqual(PASTRY_CASE.w / 5); expect(h).toBeLessThanOrEqual(COUNTER.bottom - COUNTER.front - 6);
      bottoms.push(y + h);
    }
    expect(bottoms[0]).toBe(bottoms[1]);
  });

  it('retains real faint-alpha fringes beyond the source manifest threshold without an opaque background', () => {
    const expected = { espresso: [7, 1, 525, 452], latte: [2, 4, 675, 533], eggtart: [6, 6, 606, 471] };
    for (const id of ['espresso', 'latte', 'eggtart'] as const) {
      const alpha = pngAlpha(`assets/generated/original-main-static-v1/menu-v1/${id}.png`);
      expect(alpha.bounds(0).box).toEqual(expected[id]);
      expect(alpha.bounds(0).count).toBeGreaterThan(alpha.bounds(128).count);
      expect(alpha.bounds(0).box).not.toEqual(alpha.bounds(128).box);
      expect(alpha.bounds(0).count).toBeLessThan(alpha.width * alpha.height * 0.85);
      expect(alpha.cornerAlpha).toEqual([0, 0, 0, 0]);
    }
    for (const name of ['croissant', 'strawberry-cake']) {
      const alpha = pngAlpha(`assets/generated/original-main-static-v1/main-v2/${name}.png`);
      expect(alpha.bounds(0).count).toBeGreaterThan(0);
      expect(alpha.bounds(0).count).toBeLessThan(alpha.width * alpha.height);
      expect(alpha.cornerAlpha).toEqual([0, 0, 0, 0]);
    }
  });

  it('preserves lossless archived crops and the full original source/manifest', () => {
    for (const id of ['espresso', 'latte', 'eggtart']) {
      const runtime = readFileSync(`assets/generated/original-main-static-v1/menu-v1/${id}.png`);
      const archive = readFileSync(`assets/generated/menu-v1/${id}.png`);
      const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
      expect(hash(runtime)).toBe(hash(archive));
      expect(runtime.subarray(1, 4).toString()).toBe('PNG');
      expect(runtime[25]).toBe(6); // RGBA, including all low-alpha edge pixels.
    }
    expect(readFileSync('assets/generated/menu-v1/menu-three-source.png').length).toBeGreaterThan(1000);
    const manifest = JSON.parse(readFileSync('assets/generated/menu-v1/manifest.json', 'utf8'));
    expect(manifest.assets.map((asset: { itemId: string }) => asset.itemId)).toEqual(['espresso', 'latte', 'eggtart']);
  });
});
