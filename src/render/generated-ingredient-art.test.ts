import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { INGREDIENTS, type IngredientId } from '../game/data';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedFoodArt } from './generated-food-art';
import { createGeneratedIngredientArt, GENERATED_INGREDIENT_DENSITY, GENERATED_INGREDIENT_UI_DENSITY,
  GENERATED_INGREDIENT_ENVELOPES, GENERATED_INGREDIENT_IDS, type GeneratedIngredientSources } from './generated-ingredient-art';
import { ingredientIcon } from './sprites';

type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean; operation: string };
class RecordingCanvas {
  width = 0; height = 0;
  draws: Draw[] = [];
  fills: { color: string; operation: string; args: number[] }[] = [];
  context = {
    imageSmoothingEnabled: true, globalCompositeOperation: 'source-over', fillStyle: '',
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
  const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/menu/ingredient-manifest.json', 'utf8'));
  const sources: GeneratedIngredientSources = Object.fromEntries(
    manifest.assets.map((asset: { ingredientId: IngredientId; size: [number, number] }) => [asset.ingredientId, source(...asset.size)]));
  const createCanvas = vi.fn(() => new RecordingCanvas() as unknown as HTMLCanvasElement);
  const create = (input: GeneratedIngredientSources = sources) => createGeneratedIngredientArt(input, { createCanvas });
  return { sources, createCanvas, create };
}
afterEach(() => vi.unstubAllGlobals());

describe('generated ingredient bitmap adapter', () => {
  it('covers the exact twelve pantry identities and preserves their existing outlined envelopes', () => {
    const catalog = JSON.parse(readFileSync('docs/pixel-depth/BULK-ASSET-CATALOG.json', 'utf8'));
    const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/menu/ingredient-manifest.json', 'utf8'));
    expect(GENERATED_INGREDIENT_IDS).toEqual(INGREDIENTS.map(item => item.id));
    expect(GENERATED_INGREDIENT_IDS).toHaveLength(12);
    expect(manifest.assets.map((asset: { ingredientId: string }) => asset.ingredientId).sort())
      .toEqual([...GENERATED_INGREDIENT_IDS].sort());
    const { create, createCanvas } = fixture(), adapter = create();
    vi.stubGlobal('document', { createElement: createCanvas });
    for (const row of catalog.ingredients) {
      const id = row.id as IngredientId, [w, h] = GENERATED_INGREDIENT_ENVELOPES[id];
      const old = ingredientIcon(id), icon = adapter.icon(id)!;
      expect([icon.width, icon.height]).toEqual(row.logical);
      expect([icon.width, icon.height]).toEqual([old.width, old.height]);
      expect([w + 2, h + 2]).toEqual(row.logical);
    }
    for (const asset of manifest.assets) {
      const bytes = readFileSync(`assets/generated/bulk-candidates/menu/${asset.file}`);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(asset.size);
    }
  });

  it('fits each whole source at native aspect in its own bare envelope at 4× world and 3× UI density', () => {
    const { create, sources } = fixture(), adapter = create();
    expect(adapter.ready).toBe(true); expect(adapter.readyIds).toEqual(GENERATED_INGREDIENT_IDS);
    for (const id of GENERATED_INGREDIENT_IDS) {
      const [w, h] = GENERATED_INGREDIENT_ENVELOPES[id], size = sources[id] as HTMLCanvasElement;
      const bare = adapter.icon(id, false)!, icon = adapter.icon(id)!, art = adapter.artwork(id)!;
      expect([bare.width, bare.height]).toEqual([w, h]);
      expect([icon.width, icon.height]).toEqual([w + 2, h + 2]);
      expect([art.width, art.height]).toEqual([(w + 2) * 3, (h + 2) * 3]);
      expect(fineSpriteArt(bare).density).toBe(GENERATED_INGREDIENT_DENSITY);
      expect(fineSpriteArt(icon).density).toBe(GENERATED_INGREDIENT_DENSITY);
      const backing = fineSpriteArt(bare).canvas;
      expect([backing.width, backing.height]).toEqual([w * 4, h * 4]);
      const uiBody = recorded(art).draws.at(-1)!.source as HTMLCanvasElement;
      expect([uiBody.width, uiBody.height]).toEqual([w * GENERATED_INGREDIENT_UI_DENSITY, h * GENERATED_INGREDIENT_UI_DENSITY]);
      for (const canvas of [backing, uiBody]) {
        const draw = recorded(canvas).draws[0], [, , sw, sh, x, y, dw, dh] = draw.args;
        expect(draw.source).toBe(sources[id]);
        expect(draw.args.slice(0, 4)).toEqual([0, 0, size.width, size.height]);
        expect(dw / sw).toBeCloseTo(dh / sh, 12);
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(x + dw).toBeLessThanOrEqual(canvas.width + 1e-10);
        expect(y + dh).toBeLessThanOrEqual(canvas.height + 1e-10);
        expect(x * 2 + dw).toBeCloseTo(canvas.width, 12);
        expect(y * 2 + dh).toBeCloseTo(canvas.height, 12);
        expect(draw.smoothing).toBe(false);
        expect(recorded(canvas).fills).toEqual([]);
      }
    }
  });

  it('preserves source alpha and colors, adding a one-physical-pixel contour behind the original', () => {
    const adapter = fixture().create();
    const bare = fineSpriteArt(adapter.icon('beans', false)!).canvas;
    const icon = recorded(fineSpriteArt(adapter.icon('beans')!).canvas);
    expect(icon.draws).toHaveLength(5);
    expect(icon.draws.slice(0, 4).map(draw => draw.args)).toEqual([[3, 4], [5, 4], [4, 3], [4, 5]]);
    expect(icon.fills).toEqual([{ color: '#39281f', operation: 'source-in', args: [0, 0, 56, 48] }]);
    expect(icon.draws.at(-1)).toMatchObject({ source: bare, args: [4, 4], operation: 'source-over' });
    expect(icon.draws.every(draw => draw.source === bare && !draw.smoothing)).toBe(true);
  });

  it('has independent food and pantry matcha identities despite their shared source-record key', () => {
    const { createCanvas, create } = fixture(), pantry = create();
    const drink = createGeneratedFoodArt({ matcha: source(100, 200) }, { createCanvas });
    expect(pantry.icon('matcha')).not.toBe(drink.icon('matcha'));
    expect(pantry.artwork('matcha')).not.toBe(drink.artwork('matcha'));
    const pantryDraw = recorded(fineSpriteArt(pantry.icon('matcha', false)!).canvas).draws[0];
    const drinkDraw = recorded(fineSpriteArt(drink.icon('matcha', false)!).canvas).draws[0];
    expect(pantryDraw.source).not.toBe(drinkDraw.source);
  });

  it('bounds baking at 72 canvases and makes all lookups allocation-free with stable independent outputs', () => {
    const { create, createCanvas } = fixture(), adapter = create();
    expect(createCanvas).toHaveBeenCalledTimes(12 * 6);
    const outputs = GENERATED_INGREDIENT_IDS.flatMap(id => [adapter.icon(id)!, adapter.icon(id, false)!, adapter.artwork(id)!]);
    expect(new Set(outputs).size).toBe(12 * 3);
    for (let n = 0; n < 100; n++) for (const [i, id] of GENERATED_INGREDIENT_IDS.entries()) {
      expect(adapter.icon(id)).toBe(outputs[i * 3]);
      expect(adapter.icon(id, false)).toBe(outputs[i * 3 + 1]);
      expect(adapter.artwork(id)).toBe(outputs[i * 3 + 2]);
    }
    expect(createCanvas).toHaveBeenCalledTimes(12 * 6);
    expect(Object.isFrozen(adapter)).toBe(true); expect(Object.isFrozen(adapter.readyIds)).toBe(true);
  });

  it('ignores unknown identities without adding caches or substituting a valid pantry item', () => {
    const { create, createCanvas, sources } = fixture();
    const adapter = create({ ...sources, unknown: source() } as GeneratedIngredientSources);
    for (const id of ['unknown', 'espresso', '__proto__', 'constructor', 'sig:coffee:beans=1']) {
      expect(adapter.icon(id as IngredientId)).toBeUndefined(); expect(adapter.artwork(id as IngredientId)).toBeUndefined();
    }
    expect(adapter.readyIds).toEqual(GENERATED_INGREDIENT_IDS);
    expect(createCanvas).toHaveBeenCalledTimes(12 * 6);
  });

  it('keeps incomplete and invalid native images as legacy without allocating a blank replacement', () => {
    const { create, createCanvas } = fixture();
    for (const input of [source(0, 80), source(80, 0), source(-1, 80), source(NaN, 80), source(80, Infinity),
      { width: 100, height: 80, naturalWidth: 0, naturalHeight: 0 },
      { width: 100, height: 80, naturalWidth: 100 },
      { width: 100, height: 80, naturalWidth: 100, naturalHeight: 80, complete: false },
      { width: 100, height: 80, videoWidth: 100 },
      { width: 100, height: 80, displayHeight: 80 }]) {
      const adapter = create({ beans: input as CanvasImageSource });
      expect(adapter.ready).toBe(false); expect(adapter.readyIds).toEqual([]);
      expect(adapter.icon('beans')).toBeUndefined(); expect(adapter.artwork('beans')).toBeUndefined();
    }
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it.each([
    { width: 9, height: 90, complete: true, naturalWidth: 800, naturalHeight: 200 },
    { width: 9, height: 90, videoWidth: 800, videoHeight: 200 },
    { width: 9, height: 90, displayWidth: 800, displayHeight: 200 },
  ])('uses native dimensions instead of CSS display dimensions: %j', input => {
    const adapter = fixture().create({ sugar: input as unknown as CanvasImageSource });
    const backing = fineSpriteArt(adapter.icon('sugar', false)!).canvas;
    expect(recorded(backing).draws[0].args).toEqual([0, 0, 800, 200, 0, 10, 48, 12]);
    const uiBody = recorded(adapter.artwork('sugar')!).draws.at(-1)!.source as HTMLCanvasElement;
    expect(recorded(uiBody).draws[0].args).toEqual([0, 0, 800, 200, 0, 7.5, 36, 9]);
  });

  it.each([1, 2, 3, 4, 5, 6])('publishes no partial identity when allocation %i fails, keeping unrelated items ready', failAt => {
    const { sources, createCanvas } = fixture();
    let count = 0;
    const adapter = createGeneratedIngredientArt({ beans: sources.beans, milk: sources.milk }, { createCanvas: () => {
      if (++count === failAt) throw new Error('allocation failed');
      return createCanvas();
    } });
    expect(adapter.readyIds).toEqual(['milk']);
    expect(adapter.icon('beans', false)).toBeUndefined();
    expect(adapter.icon('beans')).toBeUndefined(); expect(adapter.artwork('beans')).toBeUndefined();
    expect(adapter.artwork('milk')).toBeDefined();
  });

  it('falls back for missing canvas contexts or failed draws and recovers on a fresh load', () => {
    const { sources, create, createCanvas } = fixture();
    const noContext = createGeneratedIngredientArt(sources, {
      createCanvas: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    });
    expect(noContext.ready).toBe(false);
    const partial = createGeneratedIngredientArt(sources, { createCanvas: () => {
      const canvas = createCanvas(), mock = recorded(canvas), draw = mock.context.drawImage;
      mock.context.drawImage = (image, ...args) => {
        if (image === sources.beans) throw new Error('decode/draw failed');
        draw(image, ...args);
      };
      return canvas;
    } });
    expect(partial.readyIds).toEqual(GENERATED_INGREDIENT_IDS.filter(id => id !== 'beans'));
    expect(partial.icon('beans')).toBeUndefined(); expect(partial.artwork('beans')).toBeUndefined();
    expect(create().readyIds).toEqual(GENERATED_INGREDIENT_IDS);
  });

  it('does not share output canvases or stale identities across full, partial and empty reloads', () => {
    const { create, sources } = fixture();
    const first = create(), second = create({ ...sources, beans: source(50, 120) });
    const partial = create({ sugar: sources.sugar }), empty = create({});
    expect(partial.readyIds).toEqual(['sugar']); expect(empty.ready).toBe(false);
    for (const id of GENERATED_INGREDIENT_IDS) {
      expect(second.icon(id)).not.toBe(first.icon(id)); expect(second.artwork(id)).not.toBe(first.artwork(id));
      expect(first.icon(id)).toBeDefined(); expect(first.artwork(id)).toBeDefined();
      if (id !== 'sugar') {
        expect(partial.icon(id)).toBeUndefined(); expect(partial.artwork(id)).toBeUndefined();
      }
      expect(empty.icon(id)).toBeUndefined(); expect(empty.artwork(id)).toBeUndefined();
    }
  });
});
