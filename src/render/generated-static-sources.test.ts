import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedDecorArt, GENERATED_DECOR_CATALOG, GENERATED_DECOR_SOURCE_IDS, generatedDecorKey,
  type GeneratedDecorSourceId } from './generated-decor-art';
import { createGeneratedFoodArt, GENERATED_FOOD_IDS } from './generated-food-art';
import { createGeneratedFurnitureArt, GENERATED_FURNITURE_CATALOG, GENERATED_FURNITURE_IDS, generatedFurnitureKey,
  type GeneratedFurnitureId } from './generated-furniture-art';
import { createGeneratedIngredientArt, GENERATED_INGREDIENT_IDS, type GeneratedIngredientId } from './generated-ingredient-art';
import { clearGeneratedMainAssets, GENERATED_MAIN_ASSETS, generatedMainKey, generatedMainSource,
  getGeneratedDecorAdapter, getGeneratedFoodAdapter, getGeneratedFurnitureAdapter, getGeneratedIngredientAdapter,
  installGeneratedMainAsset, removeGeneratedMainSource, setGeneratedDecorAdapter, setGeneratedFoodAdapter,
  setGeneratedFurnitureAdapter, setGeneratedIngredientAdapter, type GeneratedMainId } from './generated-main-art';
import { releaseGeneratedStaticSources } from './generated-static-sources';

// Copy a representative pixel instead of retaining drawImage's source. Poisoned
// original images then expose accidental source dependencies after cleanup.
class Bitmap {
  pixels: number[];
  failDraw = false;
  draws = 0;
  constructor(public width = 0, public height = 0, marker = 0) { this.pixels = [marker, 31, 53, 255]; }
  context = {
    imageSmoothingEnabled: true,
    save() {}, restore() {}, scale() {}, translate() {}, fillRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    drawImage: (source: Bitmap) => {
      if (source.failDraw) throw new Error('source draw failed');
      this.pixels = [...source.pixels]; this.draws++;
    },
  };
  getContext() { return this.context; }
}
const asCanvas = (bitmap: Bitmap) => bitmap as unknown as HTMLCanvasElement;
const bitmap = (canvas: HTMLCanvasElement) => canvas as unknown as Bitmap;
const createCanvas = () => asCanvas(new Bitmap());
const ingredientKey = (id: GeneratedIngredientId): GeneratedMainId => `ingredient-${id}`;
const staticIds: GeneratedMainId[] = [...GENERATED_INGREDIENT_IDS.map(ingredientKey),
  ...GENERATED_FURNITURE_IDS.map(generatedFurnitureKey), ...GENERATED_DECOR_SOURCE_IDS.map(generatedDecorKey)];
const bakedKeys = ['canvas-live-ingredient', 'canvas-live-furniture', 'canvas-live-decor', 'canvas-live-food'];

beforeEach(() => clearGeneratedMainAssets());
afterEach(() => clearGeneratedMainAssets());

function fixture(options: { missing?: readonly GeneratedMainId[]; failed?: readonly GeneratedMainId[]; publish?: boolean } = {}) {
  let marker = 0;
  const originals = new Map<GeneratedMainId, Bitmap>();
  const source = (id: GeneratedMainId, w: number, h: number) => {
    const image = new Bitmap(w, h, ++marker);
    image.failDraw = options.failed?.includes(id) ?? false;
    originals.set(id, image); installGeneratedMainAsset(id, asCanvas(image));
    return asCanvas(image);
  };
  for (const id of Object.keys(GENERATED_MAIN_ASSETS) as GeneratedMainId[]) source(id, 2, 2);
  const ingredientSources: Partial<Record<GeneratedIngredientId, CanvasImageSource>> = {};
  for (const id of GENERATED_INGREDIENT_IDS) {
    const image = source(ingredientKey(id), 64, 48);
    if (!options.missing?.includes(ingredientKey(id))) ingredientSources[id] = image;
  }
  const furnitureSources: Partial<Record<GeneratedFurnitureId, CanvasImageSource>> = {};
  for (const id of GENERATED_FURNITURE_IDS) {
    const [w, h] = GENERATED_FURNITURE_CATALOG[id].size, image = source(generatedFurnitureKey(id), w, h);
    if (!options.missing?.includes(generatedFurnitureKey(id))) furnitureSources[id] = image;
  }
  const decorSources: Partial<Record<GeneratedDecorSourceId, CanvasImageSource>> = {};
  for (const id of GENERATED_DECOR_SOURCE_IDS) {
    const [w, h] = GENERATED_DECOR_CATALOG[id].size, image = source(generatedDecorKey(id), w, h);
    if (!options.missing?.includes(generatedDecorKey(id))) decorSources[id] = image;
  }
  const ingredient = createGeneratedIngredientArt(ingredientSources, { createCanvas });
  const furniture = createGeneratedFurnitureArt(furnitureSources, { createCanvas });
  const decor = createGeneratedDecorArt(decorSources, { createCanvas });
  const food = createGeneratedFoodArt({ matcha: generatedMainSource('matcha'), latte: generatedMainSource('latte') }, { createCanvas });
  if (options.publish !== false) {
    setGeneratedIngredientAdapter(ingredient); setGeneratedFurnitureAdapter(furniture);
    setGeneratedDecorAdapter(decor); setGeneratedFoodAdapter(food);
  }
  const keys = new Set([...Object.keys(GENERATED_MAIN_ASSETS).map(id => generatedMainKey(id as GeneratedMainId)), ...bakedKeys]);
  const textures = { exists: (key: string) => keys.has(key), remove: vi.fn((key: string) => { keys.delete(key); }) };
  return { ingredient, furniture, decor, food, originals, keys, textures };
}

describe('release baked static catalog sources', () => {
  it('releases exactly 87 ready catalog sources without invalidating their published adapters', () => {
    const f = fixture();
    expect(staticIds).toHaveLength(87);
    expect(releaseGeneratedStaticSources(f.textures)).toBe(staticIds.length);
    expect(f.textures.remove.mock.calls.map(([key]) => key)).toEqual(staticIds.map(generatedMainKey));
    for (const id of staticIds) {
      expect(generatedMainSource(id)).toBeUndefined(); expect(f.keys.has(generatedMainKey(id))).toBe(false);
    }
    expect(getGeneratedIngredientAdapter()).toBe(f.ingredient);
    expect(getGeneratedFurnitureAdapter()).toBe(f.furniture); expect(getGeneratedDecorAdapter()).toBe(f.decor);
    expect(releaseGeneratedStaticSources(f.textures)).toBe(0);
    expect(f.textures.remove).toHaveBeenCalledTimes(staticIds.length);
  });

  it('preserves every food, original prop, service, wall, actor and baked canvas key', () => {
    const f = fixture(), untouched = (Object.keys(GENERATED_MAIN_ASSETS) as GeneratedMainId[]).filter(id => !staticIds.includes(id));
    const sources = new Map(untouched.map(id => [id, generatedMainSource(id)]));
    expect(f.food.ready).toBe(true);
    releaseGeneratedStaticSources(f.textures);
    for (const id of untouched) {
      expect(generatedMainSource(id)).toBe(sources.get(id)); expect(f.keys.has(generatedMainKey(id))).toBe(true);
    }
    for (const id of GENERATED_FOOD_IDS) expect(generatedMainSource(id)).toBeDefined();
    for (const key of bakedKeys) expect(f.keys.has(key)).toBe(true);
    expect(generatedMainSource('ingredient-matcha')).toBeUndefined();
    expect(generatedMainSource('matcha')).toBeDefined(); expect(getGeneratedFoodAdapter()).toBe(f.food);
    // These prefixed aliases may be released while their original shared props remain live.
    for (const id of ['wall-lamp', 'vase', 'vine', 'cabinet-top', 'cabinet-front'] as const) expect(generatedMainSource(id)).toBeDefined();
  });

  it('keeps missing and failed identities for fallback, including both halves of an incomplete counter', () => {
    const kept: GeneratedMainId[] = ['ingredient-beans', 'furniture-clock', 'decor-counter_oak-top', 'decor-counter_oak-front',
      'ingredient-milk', 'furniture-bench', 'decor-rug_red-default'];
    const f = fixture({ missing: ['ingredient-beans', 'furniture-clock', 'decor-counter_oak-front'],
      failed: ['ingredient-milk', 'furniture-bench', 'decor-rug_red-default'] });
    expect(f.ingredient.ready).toBe(true); expect(f.furniture.ready).toBe(true); expect(f.decor.ready).toBe(true);
    expect(f.decor.readyIds).not.toContain('counter_oak');
    expect(releaseGeneratedStaticSources(f.textures)).toBe(staticIds.length - kept.length);
    for (const id of staticIds) {
      expect(!!generatedMainSource(id)).toBe(kept.includes(id));
      expect(f.keys.has(generatedMainKey(id))).toBe(kept.includes(id));
    }
    expect(f.ingredient.icon('beans')).toBeUndefined(); expect(f.ingredient.icon('milk')).toBeUndefined();
    expect(f.furniture.sprite('clock')).toBeUndefined(); expect(f.furniture.sprite('bench')).toBeUndefined();
    expect(f.decor.icon('counter_oak')).toBeUndefined(); expect(f.decor.sprite('rug_red')).toBeUndefined();
  });

  it('does nothing before publication or for empty shared adapters', () => {
    const f = fixture({ publish: false });
    expect(releaseGeneratedStaticSources(f.textures)).toBe(0);
    setGeneratedIngredientAdapter(createGeneratedIngredientArt({}, { createCanvas }));
    setGeneratedFurnitureAdapter(createGeneratedFurnitureArt({}, { createCanvas }));
    setGeneratedDecorAdapter(createGeneratedDecorArt({}, { createCanvas }));
    expect(releaseGeneratedStaticSources(f.textures)).toBe(0);
    expect(f.textures.remove).not.toHaveBeenCalled();
    for (const id of staticIds) expect(generatedMainSource(id)).toBeDefined();
  });

  it('counts registry-only and texture-only sources once, skipping sources absent from both caches', () => {
    const f = fixture();
    f.keys.delete(generatedMainKey('ingredient-beans'));
    removeGeneratedMainSource('ingredient-milk');
    f.keys.delete(generatedMainKey('ingredient-flour')); removeGeneratedMainSource('ingredient-flour');
    expect(releaseGeneratedStaticSources(f.textures)).toBe(staticIds.length - 1);
    expect(f.textures.remove).toHaveBeenCalledTimes(staticIds.length - 2);
    expect(generatedMainSource('ingredient-beans')).toBeUndefined();
    expect(f.keys.has(generatedMainKey('ingredient-milk'))).toBe(false);
    expect(releaseGeneratedStaticSources(f.textures)).toBe(0);
  });

  it('retains the failing source in the registry and resumes safely after earlier successful removals', () => {
    const f = fixture(), failed = staticIds[2], original = generatedMainSource(failed);
    f.textures.remove.mockImplementationOnce(key => { f.keys.delete(key); })
      .mockImplementationOnce(key => { f.keys.delete(key); })
      .mockImplementationOnce(() => { throw new Error('texture destruction failed'); });
    expect(() => releaseGeneratedStaticSources(f.textures)).toThrow('texture destruction failed');
    expect(generatedMainSource(staticIds[0])).toBeUndefined(); expect(generatedMainSource(staticIds[1])).toBeUndefined();
    expect(generatedMainSource(failed)).toBe(original); expect(f.keys.has(generatedMainKey(failed))).toBe(true);
    expect(releaseGeneratedStaticSources(f.textures)).toBe(staticIds.length - 2);
    expect(releaseGeneratedStaticSources(f.textures)).toBe(0);
  });

  it('finishes registry cleanup on retry if a destruction failure already removed its texture key', () => {
    const f = fixture(), first = staticIds[0], original = generatedMainSource(first);
    f.textures.remove.mockImplementationOnce(key => { f.keys.delete(key); throw new Error('late destruction failure'); });
    expect(() => releaseGeneratedStaticSources(f.textures)).toThrow('late destruction failure');
    expect(generatedMainSource(first)).toBe(original); expect(f.keys.has(generatedMainKey(first))).toBe(false);
    expect(releaseGeneratedStaticSources(f.textures)).toBe(staticIds.length);
    expect(f.textures.remove).toHaveBeenCalledTimes(staticIds.length);
  });

  it('uses only the current shared adapters after clear/reload, leaving older ready adapters irrelevant', () => {
    const old = fixture();
    clearGeneratedMainAssets();
    const current = fixture({ missing: ['ingredient-beans', 'furniture-clock', 'decor-counter_oak-front'] });
    expect(old.ingredient.readyIds).toContain('beans'); expect(old.furniture.readyIds).toContain('clock');
    expect(old.decor.readyIds).toContain('counter_oak');
    expect(releaseGeneratedStaticSources(current.textures)).toBe(staticIds.length - 4);
    for (const id of ['ingredient-beans', 'furniture-clock', 'decor-counter_oak-top', 'decor-counter_oak-front'] as const)
      expect(generatedMainSource(id)).toBe(asCanvas(current.originals.get(id)!));
    expect(old.textures.remove).not.toHaveBeenCalled();
  });

  it('does not drop replacement sources or continue a superseded adapter snapshot during destruction', () => {
    const first = fixture();
    let next: ReturnType<typeof fixture> | undefined;
    first.textures.remove.mockImplementationOnce(key => {
      first.keys.delete(key); clearGeneratedMainAssets(); next = fixture();
    });
    expect(releaseGeneratedStaticSources(first.textures)).toBe(1);
    expect(first.textures.remove).toHaveBeenCalledTimes(1);
    expect(next).toBeDefined(); expect(next!.textures.remove).not.toHaveBeenCalled();
    for (const id of staticIds) expect(generatedMainSource(id)).toBe(asCanvas(next!.originals.get(id)!));
    expect(releaseGeneratedStaticSources(next!.textures)).toBe(staticIds.length);
  });

  it('keeps all baked lookups and world painters usable after source storage becomes unreadable', () => {
    const f = fixture();
    const outputs = [
      ...GENERATED_INGREDIENT_IDS.flatMap(id => [f.ingredient.icon(id)!, f.ingredient.icon(id, false)!, f.ingredient.artwork(id)!]),
      ...GENERATED_FURNITURE_IDS.flatMap(id => [f.furniture.sprite(id)!, f.furniture.icon(id)!]),
      ...f.decor.readyIds.flatMap(id => [f.decor.icon(id)!, ...(f.decor.sprite(id) ? [f.decor.sprite(id)!] : [])]),
    ];
    const samples = outputs.map(canvas => ({ canvas, pixels: [...bitmap(canvas).pixels], fine: [...bitmap(fineSpriteArt(canvas).canvas).pixels] }));
    expect(releaseGeneratedStaticSources(f.textures)).toBe(staticIds.length);
    for (const id of staticIds) for (const property of ['width', 'height', 'pixels'])
      Object.defineProperty(f.originals.get(id)!, property, { get() { throw new Error('released source was read'); } });
    for (const { canvas, pixels, fine } of samples) {
      expect(bitmap(canvas).pixels).toEqual(pixels); expect(bitmap(fineSpriteArt(canvas).canvas).pixels).toEqual(fine);
    }
    for (const id of GENERATED_INGREDIENT_IDS) {
      expect(f.ingredient.icon(id)).toBeDefined(); expect(f.ingredient.artwork(id)).toBeDefined();
    }
    const target = new Bitmap(), ctx = target.context as unknown as CanvasRenderingContext2D;
    for (const id of GENERATED_FURNITURE_IDS) {
      expect(f.furniture.icon(id)).toBeDefined(); expect(f.furniture.overlay(id)).toBeDefined();
      if (GENERATED_FURNITURE_CATALOG[id].surface === 'wall')
        expect(f.furniture.paintWall(ctx, id, 5, 7, new Date(2000, 0, 1, 11, 30))).toBe(true);
      else {
        expect(f.furniture.floorBounds(id, 30, 40)).toBeDefined(); expect(f.furniture.paintFloor(ctx, id, 30, 40)).toBe(true);
      }
    }
    for (const id of f.decor.readyIds) {
      const sourceId = GENERATED_DECOR_SOURCE_IDS.find(key => GENERATED_DECOR_CATALOG[key].id === id)!;
      const kind = GENERATED_DECOR_CATALOG[sourceId].kind;
      expect(f.decor.icon(id)).toBeDefined();
      if (kind === 'counter') expect(f.decor.paintCounter(ctx, id, 0, 0, 50, 6, 15)).toBe(true);
      else if (kind === 'tile') expect(f.decor.paintTile(ctx, id, 0, 0, 32, 24)).toBe(true);
      else {
        expect(f.decor.anchor(id)).toBeDefined(); expect(f.decor.paintSprite(ctx, id, 30, 40)).toBe(true);
        expect(f.decor.paintFitted(ctx, id, 0, 0, 32, 24)).toBe(true);
      }
    }
    expect(target.draws).toBeGreaterThan(0);
    expect(releaseGeneratedStaticSources(f.textures)).toBe(0);
  });
});

describe('main structural and tableware source release', () => {
  it('releases only successfully published structural/tableware candidates', async () => {
    const art = await import('./generated-main-art');
    const ready = ['environment-main-horizontal-beam', 'tableware-heart'] as const;
    const failed = ['environment-main-corner-post', 'tableware-drop'] as const;
    for (const id of [...ready, ...failed]) art.installGeneratedMainAsset(id, asCanvas(new Bitmap(16,16)));
    art.setGeneratedMainEnvironmentAdapter({ready:true,readyIds:['main-horizontal-beam']} as unknown as
      import('./generated-main-environment-art').GeneratedMainEnvironmentAdapter);
    art.setGeneratedTablewareAdapter({ready:true,readyIds:['heart']} as unknown as
      import('./generated-tableware-art').GeneratedTablewareAdapter);
    const keys = new Set([...ready,...failed].map(art.generatedMainKey));
    const textures = {exists:(key:string)=>keys.has(key),remove:vi.fn((key:string)=>keys.delete(key))};
    expect(releaseGeneratedStaticSources(textures)).toBe(2);
    for(const id of ready)expect(art.generatedMainSource(id)).toBeUndefined();
    for(const id of failed)expect(art.generatedMainSource(id)).toBeDefined();
    expect(releaseGeneratedStaticSources(textures)).toBe(0);
    art.clearGeneratedMainAssets();
    expect(art.getGeneratedMainEnvironmentAdapter()).toBeNull();
    expect(art.getGeneratedTablewareAdapter()).toBeNull();
  });
});
