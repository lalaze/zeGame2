import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import archive from '../../assets/generated/original-main-static-v1/manifest.json';
import catalog from '../../assets/generated/runtime-catalog-v1/catalog.json';
import runtime from '../../assets/generated/runtime-catalog-v1/runtime.json';
import { generatedRasterGeometry, type GeneratedRasterMetadata } from './generated-raster-geometry';
import { clearGeneratedMainAssets, GENERATED_MAIN_ASSETS, generatedMainRaster, installGeneratedMainAsset,
  paintGeneratedMain, removeGeneratedMainSource, type GeneratedMainId } from './generated-main-art';
import { createGeneratedFoodArt, GENERATED_FOOD_ENVELOPES, type GeneratedFoodId } from './generated-food-art';
import { fineSpriteArt } from './fine-sprite-art';
import { RoomPainter } from './room-art';
import { lightingAt } from './lighting';
import { createInitialState, type GameState } from '../game/state';
import { WINDOWS } from '../game/layout';

type StaticId = keyof typeof runtime.mainStaticMetadata;
const ids = Object.keys(runtime.mainStaticMetadata) as StaticId[];
const foods = ['espresso', 'latte', 'eggtart', 'croissant', 'cake'] as const;
const retained = { 'cabinet-top': 'main-v1/cabinet-top.png', 'cabinet-front': 'main-v1/cabinet-front.png',
  plant: 'main-v1/plant.png', table: 'main-v2/table-no-vase.png', 'chair-right': 'main-v2/chair-facing-right.png',
  'chair-left': 'main-v2/chair-facing-left.png', vase: 'main-v2/flower-vase.png' } as const;
const fileBytes = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
// Archive comparisons exercise the frozen v1 export, independently of whichever
// generation the live registry currently selects. Current overrides are tested below.
const fileFor = (id: StaticId, packed: boolean) => packed ? `public/art/generated/${runtime.assets[id]}` : archive.images.find(row => row.key === id)!.file;
const size = (file: string) => { const png = fileBytes(file); return [png.readUInt32BE(16), png.readUInt32BE(20)] as const; };
type Source = HTMLCanvasElement & { assetId?: string };
const fakeSource = (id: string, width: number, height: number) => ({ assetId: id, width, height }) as Source;
const metadata = runtime.mainStaticMetadata as Readonly<Record<StaticId, GeneratedRasterMetadata>>;

type Draw = { source: Source; args: number[]; smoothing: boolean };
class RecordingCanvas {
  width = 0; height = 0; draws: Draw[] = []; geometry: unknown[][] = [];
  stack: { fillStyle: string; globalAlpha: number; imageSmoothingEnabled: boolean; globalCompositeOperation: string }[] = [];
  context = {
    canvas: this, fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: true, globalCompositeOperation: 'source-over',
    save: () => { const c = this.context; this.stack.push({ fillStyle: c.fillStyle, globalAlpha: c.globalAlpha, imageSmoothingEnabled: c.imageSmoothingEnabled, globalCompositeOperation: c.globalCompositeOperation }); },
    restore: () => Object.assign(this.context, this.stack.pop()),
    drawImage: (source: Source, ...args: number[]) => this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled }),
    fillRect: (...args: number[]) => this.geometry.push(['fill', ...args, this.context.fillStyle, this.context.globalAlpha]),
    beginPath: () => this.geometry.push(['begin']), closePath: () => this.geometry.push(['close']), clip: () => this.geometry.push(['clip']),
    rect: (...args: number[]) => this.geometry.push(['rect', ...args]), moveTo: (...args: number[]) => this.geometry.push(['move', ...args]),
    lineTo: (...args: number[]) => this.geometry.push(['line', ...args]), arc: (...args: number[]) => this.geometry.push(['arc', ...args]),
    fill: () => this.geometry.push(['path-fill', this.context.fillStyle]), strokeRect: (...args: number[]) => this.geometry.push(['strokeRect', ...args]),
    translate: (...args: number[]) => this.geometry.push(['translate', ...args]), scale: (...args: number[]) => this.geometry.push(['scale', ...args]),
    setTransform: (...args: number[]) => this.geometry.push(['transform', ...args]), clearRect() {}, setLineDash() {},
  };
  getContext() { return this.context; }
}
const makeCanvas = () => new RecordingCanvas() as unknown as HTMLCanvasElement;
const recorded = (canvas: HTMLCanvasElement) => canvas as unknown as RecordingCanvas;
const destination = (draw: Draw) => draw.args.slice(draw.args.length === 8 ? 4 : 0);
function install(packed: boolean) {
  clearGeneratedMainAssets();
  for (const id of ids) installGeneratedMainAsset(id, fakeSource(id, ...size(fileFor(id, packed))));
  for (const [id, file] of Object.entries(retained)) installGeneratedMainAsset(id as GeneratedMainId, fakeSource(id, ...size(`public/art/generated/${file}`)));
}
function state(phase: GameState['phase'] = 'prep', planned = 8, remaining = 1) {
  const value = createInitialState(0); value.kitchen = true; value.phase = phase;
  value.onMenu = ['espresso', 'latte', 'eggtart', 'croissant', 'cake', 'roll'];
  for (const id of value.onMenu) { value.items[id as GeneratedFoodId] = 1; value.bakePlan[id] = planned; value.shelf[id] = remaining; }
  value.upgrades.machine = 15; return value;
}
function paintRoom(painter: RoomPainter, value: GameState, hour = 12, counter = 'counter_oak') {
  const light = lightingAt(hour);
  painter.drawWall('wall_cream', 7);
  for (const win of WINDOWS) painter.drawWindow(win, light, 7, value.phase === 'open');
  painter.drawMenuBoard(value);
  painter.drawBackBar(value, counter);
  painter.drawServiceCupboards(counter);
  painter.drawCounter(value, counter, 7, [{ x: 92, fill: 0.7 }]);
}
function roomRecord(packed: boolean, value: GameState, hour = 12, counter = 'counter_oak') {
  install(packed); vi.stubGlobal('document', { createElement: makeCanvas });
  const result = new RecordingCanvas();
  paintRoom(new RoomPainter(result.context as unknown as CanvasRenderingContext2D, 2, false), value, hour, counter);
  return result;
}
afterEach(() => { clearGeneratedMainAssets(); vi.unstubAllGlobals(); });

describe('main static archive and exact production geometry', () => {
  it('keeps sixteen immutable originals, exact hashes, unique exports and all seven excluded originals', () => {
    expect(archive.images).toHaveLength(16); expect(ids).toHaveLength(16);
    expect(new Set(archive.images.map(row => row.key)).size).toBe(16);
    for (const entry of archive.images) {
      const original = fileBytes(entry.file), row = catalog.images.find(image => image.key === entry.key)!;
      expect(original.length).toBe(entry.bytes); expect(hash(original)).toBe(entry.sha256);
      expect(row.source).toBe(entry.file); expect(row.sourceSha256).toBe(entry.sha256);
      expect(hash(fileBytes(row.file))).toBe(row.sha256);
      expect(`public/art/generated/${runtime.assets[entry.key as StaticId]}`).toBe(row.file);
      expect(row.file).not.toBe(entry.previousPublicFile);
    }
    for (const [id, path] of Object.entries(retained)) {
      expect(runtime.assets).not.toHaveProperty(id);
      expect(catalog.assets).not.toHaveProperty(id);
      expect(size(`public/art/generated/${path}`).every(axis => axis > 0)).toBe(true);
    }
    expect(catalog.images.filter(row => row.key.startsWith('signature-'))).toHaveLength(14);
    expect(runtime.customerManifests).toHaveLength(30); expect(runtime.catManifests).toHaveLength(12);
  });

  it.each(ids)('maps %s from its exact whole original extent, excluding only added trailing padding', id => {
    const meta = metadata[id], before = fakeSource(id, ...size(fileFor(id, false))), after = fakeSource(id, ...size(fileFor(id, true)));
    const a = generatedRasterGeometry(before, meta)!, b = generatedRasterGeometry(after, meta)!;
    expect([a.width, a.height]).toEqual(meta.originalSize); expect(a.sourceScale).toBe(1);
    expect([b.width, b.height]).toEqual(meta.originalSize); expect(b.sourceScale).toBe(meta.scale);
    expect([b.contentWidth, b.contentHeight]).toEqual(meta.originalSize.map(value => value * meta.scale));
    expect(meta.size).toEqual(meta.productionContentSize.map(Math.ceil));
    expect(meta.size[0] - b.contentWidth).toBeLessThan(1); expect(meta.size[1] - b.contentHeight).toBeLessThan(1);
    expect(generatedRasterGeometry(fakeSource(id, after.width + 1, after.height), meta)).toBeNull();
    installGeneratedMainAsset(id, after); expect(generatedMainRaster(id)?.width).toBe(before.width);
    removeGeneratedMainSource(id); expect(generatedMainRaster(id)).toBeNull();
  });

  it('retains jars content near width 96 inside its 97px canvas rather than stretching the added column', () => {
    const id = 'service-jars', meta = metadata[id]; expect(meta.size[0]).toBe(97);
    expect(meta.productionContentSize[0]).toBeCloseTo(96, 12);
    install(true); const out = new RecordingCanvas();
    expect(paintGeneratedMain(out.context as unknown as CanvasRenderingContext2D, id, 2, 3, 17, 15)).toBe(true);
    expect(out.draws[0].args.slice(0, 4)).toEqual([0, 0, ...meta.productionContentSize]);
  });

  it.each(['size', 'scale', 'originalSize', 'productionContentSize'] as const)('rejects corrupted %s instead of hiding it in a permissive fit', field => {
    const base = metadata['wall-window'], source = fakeSource('bad', ...size(fileFor('wall-window', true)));
    for (const value of [NaN, -1, null, [0, 0], [1, 2, 3]]) {
      expect(generatedRasterGeometry(source, { ...base, [field]: value } as unknown as GeneratedRasterMetadata)).toBeNull();
    }
    expect(generatedRasterGeometry(source, { ...base, productionContentSize: [base.size[0] - 1, base.size[1]] })).toBeNull();
  });
});

describe('current cozy replacements remain compatible with authored geometry', () => {
  const redraws = ['vine', 'display', ...foods, 'service-pickup', 'service-machine',
    'service-cups', 'service-jars', 'service-basket', 'wall-board', 'wall-lamp'] as const;

  it.each(redraws)('selects redrawn %s pixels while preserving its coordinate and destination contract', id => {
    const expected = `${(foods as readonly string[]).includes(id) ? 'cozy-menu-v2' : 'cozy-world-v2'}/${id}.png`;
    expect(GENERATED_MAIN_ASSETS[id]).toBe(expected);
    const file = `public/art/generated/${expected}`, dimensions = size(file), meta = metadata[id];
    expect(hash(fileBytes(file))).not.toBe(hash(fileBytes(fileFor(id, true))));
    // New art uses the same authored canvas, so old attachment coordinates and
    // crop rectangles remain valid without pretending it is the archived pack.
    expect(dimensions).toEqual(meta.originalSize);
    const source = fakeSource(id, ...dimensions), geometry = generatedRasterGeometry(source, meta);
    expect(geometry).not.toBeNull();
    expect([geometry!.width, geometry!.height]).toEqual(meta.originalSize);
    expect(geometry!.sourceScale).toBe(1);
    expect([geometry!.contentWidth, geometry!.contentHeight]).toEqual(dimensions);
    installGeneratedMainAsset(id, source);
    expect(generatedMainRaster(id)).toEqual(geometry);
    const output = new RecordingCanvas();
    expect(paintGeneratedMain(output.context as unknown as CanvasRenderingContext2D, id, 7, 11, 29, 23)).toBe(true);
    expect(output.draws).toHaveLength(1);
    expect(output.draws[0].source).toBe(source);
    expect(destination(output.draws[0])).toEqual([7, 11, 29, 23]);
    expect(output.draws[0].smoothing).toBe(false);
    expect(generatedRasterGeometry(fakeSource(id, dimensions[0] + 1, dimensions[1]), meta)).toBeNull();
  });

  it.each(foods)('publishes current %s art in the existing world and menu envelopes', id => {
    const dimensions = size(`public/art/generated/${GENERATED_MAIN_ASSETS[id]}`);
    const source = fakeSource(id, ...dimensions);
    const art = createGeneratedFoodArt({ [id]: source }, { createCanvas: makeCanvas, rasterMetadata: metadata });
    expect(art.readyIds).toEqual([id]);
    const icon = art.icon(id, false)!, artwork = art.artwork(id)!;
    expect([icon.width, icon.height]).toEqual(GENERATED_FOOD_ENVELOPES[id]);
    expect(recorded(fineSpriteArt(icon).canvas).draws[0].source).toBe(source);
    expect(recorded(fineSpriteArt(icon).canvas).draws[0].args.slice(0, 4)).toEqual([0, 0, ...dimensions]);
    const archived = createGeneratedFoodArt({ [id]: fakeSource(id, ...size(fileFor(id, true))) },
      { createCanvas: makeCanvas, rasterMetadata: metadata });
    expect([artwork.width, artwork.height]).toEqual([archived.artwork(id)!.width, archived.artwork(id)!.height]);
  });
});

describe('unchanged main-room static placements, live overlays and fallback', () => {
  it.each(['prep', 'open', 'closing'] as const)('keeps every source crop, world destination, overlay and state unchanged in %s', phase => {
    const value = state(phase), snapshot = JSON.stringify(value), before = roomRecord(false, value), after = roomRecord(true, value);
    const a = before.draws.filter(draw => ids.includes(draw.source.assetId as StaticId));
    const b = after.draws.filter(draw => ids.includes(draw.source.assetId as StaticId));
    expect(b.map(draw => draw.source.assetId)).toEqual(a.map(draw => draw.source.assetId));
    expect(new Set(b.map(draw => draw.source.assetId))).toEqual(new Set(['wall-lamp', 'wall-window', 'wall-board', 'service-jars', 'service-cups', 'service-basket', 'service-pickup', 'service-cupboard', 'service-machine', 'display', 'croissant', 'cake', 'vine']));
    for (let i = 0; i < a.length; i++) {
      const scale = metadata[b[i].source.assetId as StaticId].scale, old = a[i], next = b[i];
      const crop = old.args.length === 8 ? old.args.slice(0, 4) : [0, 0, old.source.width, old.source.height];
      expect(next.args).toHaveLength(8); expect(next.smoothing).toBe(false);
      for (let j = 0; j < 4; j++) { expect(next.args[j]).toBeCloseTo(crop[j] * scale, 11); expect(destination(next)[j]).toBeCloseTo(destination(old)[j], 11); }
      // This covers the largest room use: all selected packed pixels still downsample into its 2x backing.
      expect(destination(next)[2] * 2 / next.args[2]).toBeLessThanOrEqual(1);
      expect(destination(next)[3] * 2 / next.args[3]).toBeLessThanOrEqual(1);
    }
    expect(after.geometry).toEqual(before.geometry); expect(JSON.stringify(value)).toBe(snapshot);
  });

  it.each([0, 12, 23])('preserves exact window aperture and sill, writing area and night/day geometry at hour %i', hour => {
    const value = state('open'), before = roomRecord(false, value, hour), after = roomRecord(true, value, hour);
    expect(after.geometry).toEqual(before.geometry);
    const windows = after.draws.filter(draw => draw.source.assetId === 'wall-window'); expect(windows).toHaveLength(2);
    for (const draw of windows) {
      const [x, y, w, h] = destination(draw); expect(w).toBe(62); expect(h).toBeCloseTo(494 * 62 / 613, 12);
      expect(y + 410 * 62 / 613).toBeCloseTo(51, 12);
      const expected = [x + 115 * 62 / 613, y + 77 * 62 / 613, 386 * 62 / 613, 296 * 62 / 613];
      expect(after.geometry.some(mark => mark[0] === 'rect' && expected.every((value, i) => Math.abs(Number(mark[i + 1]) - value) < 1e-10))).toBe(true);
    }
  });

  it.each(['counter_oak', 'counter_walnut', 'counter_marble', 'counter_pink', 'counter_gold'])('keeps service fixtures and upgrade effects unchanged with %s', counter => {
    const value = state('open'), before = roomRecord(false, value, 12, counter), after = roomRecord(true, value, 12, counter);
    expect(after.geometry).toEqual(before.geometry);
    expect(after.draws.filter(draw => draw.source.assetId === 'service-machine')).toHaveLength(1);
  });

  it('uses current plan/live stock and keeps the empty case independent of menu changes', () => {
    install(true); vi.stubGlobal('document', { createElement: makeCanvas });
    const c = new RecordingCanvas(), painter = new RoomPainter(c.context as unknown as CanvasRenderingContext2D, 2, false) as unknown as { drawPastryCase(value: GameState): void };
    const value = state('prep', 1, 0);
    const shown = () => c.draws.filter(draw => ['croissant', 'cake'].includes(draw.source.assetId ?? '')).map(draw => draw.source.assetId);
    painter.drawPastryCase(value); expect(shown()).toEqual(['croissant', 'cake']);
    c.draws.length = 0; value.phase = 'open'; painter.drawPastryCase(value); expect(shown()).toEqual([]);
    value.shelf.cake = 1; c.draws.length = 0; painter.drawPastryCase(value); expect(shown()).toEqual(['cake']);
    value.onMenu = ['espresso']; c.draws.length = 0; painter.drawPastryCase(value); expect(shown()).toEqual([]);
    expect(c.draws.filter(draw => draw.source.assetId === 'display')).toHaveLength(1);
  });

  it.each(ids)('falls back for missing or wrong-sized %s without accepting an incorrect crop', id => {
    install(true); removeGeneratedMainSource(id); const out = new RecordingCanvas();
    expect(paintGeneratedMain(out.context as unknown as CanvasRenderingContext2D, id, 0, 0, 12, 12)).toBe(false);
    installGeneratedMainAsset(id, fakeSource(id, 17, 19));
    expect(generatedMainRaster(id)).toBeNull();
    expect(paintGeneratedMain(out.context as unknown as CanvasRenderingContext2D, id, 0, 0, 12, 12)).toBe(false);
    expect(out.draws).toHaveLength(0);
  });
});

describe('five packed food identities preserve their exact UI and world envelopes', () => {
  it.each(foods)('keeps %s full-content geometry at both 4x world and 3x UI resolution', id => {
    const original = fakeSource(id, ...size(fileFor(id, false))), packed = fakeSource(id, ...size(fileFor(id, true)));
    const old = createGeneratedFoodArt({ [id]: original }, { createCanvas: makeCanvas });
    const next = createGeneratedFoodArt({ [id]: packed }, { createCanvas: makeCanvas, rasterMetadata: metadata });
    expect(next.readyIds).toEqual([id]); const a = old.icon(id, false)!, b = next.icon(id, false)!;
    expect([b.width, b.height]).toEqual(GENERATED_FOOD_ENVELOPES[id]);
    const x = recorded(fineSpriteArt(a).canvas).draws[0], y = recorded(fineSpriteArt(b).canvas).draws[0];
    expect(y.args.slice(0, 4)).toEqual([0, 0, ...metadata[id].productionContentSize]);
    expect(y.args.slice(4)).toEqual(x.args.slice(4));
    expect([next.artwork(id)!.width, next.artwork(id)!.height]).toEqual([old.artwork(id)!.width, old.artwork(id)!.height]);
    expect(createGeneratedFoodArt({ [id]: fakeSource(id, 17, 19) }, { createCanvas: makeCanvas, rasterMetadata: metadata }).ready).toBe(false);
  });
});

type NativeCanvas = { createCanvas(width: number, height: number): HTMLCanvasElement & { toBuffer(type: string): Buffer }; loadImage(bytes: Buffer): Promise<HTMLImageElement> };
let native: NativeCanvas | undefined;
try { native = createRequire(import.meta.url)('@napi-rs/canvas') as NativeCanvas; } catch { /* Optional authoring dependency. */ }
describe.skipIf(!native)('native PNG integrity and comparison evidence', () => {
  it('reproduces all sixteen full PNGs from unchanged originals with the exact nearest transform', async () => {
    for (const id of ids) {
      const meta = metadata[id], source = await native!.loadImage(fileBytes(fileFor(id, false))), result = await native!.loadImage(fileBytes(fileFor(id, true)));
      const expected = native!.createCanvas(...meta.size as [number, number]), actual = native!.createCanvas(...meta.size as [number, number]);
      const a = expected.getContext('2d')!, b = actual.getContext('2d')!; a.imageSmoothingEnabled = false;
      a.drawImage(source, 0, 0, ...meta.productionContentSize as [number, number]); b.drawImage(result, 0, 0);
      const pa = a.getImageData(0, 0, expected.width, expected.height).data, pb = b.getImageData(0, 0, actual.width, actual.height).data;
      expect(Buffer.from(pa).equals(Buffer.from(pb)), id).toBe(true);
    }
  });

  it('retains all four transparent window interiors without masks or flattening', async () => {
    const image = await native!.loadImage(fileBytes(fileFor('wall-window', true))), c = native!.createCanvas(image.width, image.height), ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, c.width, c.height).data, scale = metadata['wall-window'].scale;
    for (const [x, y, w, h] of [[165, 111, 120, 95], [345, 111, 125, 95], [155, 266, 130, 105], [345, 266, 135, 105]]) {
      let max = 0;
      for (let py = Math.ceil(y * scale); py < Math.floor((y + h) * scale); py++) for (let px = Math.ceil(x * scale); px < Math.floor((x + w) * scale); px++) max = Math.max(max, pixels[(py * c.width + px) * 4 + 3]);
      expect(max).toBeLessThanOrEqual(1);
    }
  });

});
