import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import archive from '../../assets/generated/original-main-static-v1/manifest.json';
import catalog from '../../assets/generated/runtime-catalog-v1/catalog.json';
import runtime from '../../assets/generated/runtime-catalog-v1/runtime.json';
import { clearGeneratedMainAssets, GENERATED_MAIN_ASSETS, installGeneratedMainAsset, setGeneratedFoodAdapter, type GeneratedMainId } from './generated-main-art';
import { createGeneratedFoodArt, type GeneratedFoodId } from './generated-food-art';
import { RoomPainter } from './room-art';
import { lightingAt } from './lighting';
import { projectFloorLayer } from './pixel-floor-projection';
import { paintPixelRoomShell } from './pixel-room-shell';
import { mainPixelProjection } from './main-pixel-presentation';
import { createInitialState, type GameState } from '../game/state';
import { WINDOWS } from '../game/layout';
const ids = Object.keys(runtime.mainStaticMetadata) as (keyof typeof runtime.mainStaticMetadata)[];
const foods = ['espresso', 'latte', 'eggtart', 'croissant', 'cake'] as const;
const retained = { 'cabinet-top': 'main-v1/cabinet-top.png', 'cabinet-front': 'main-v1/cabinet-front.png', plant: 'main-v1/plant.png', table: 'main-v2/table-no-vase.png', 'chair-right': 'main-v2/chair-facing-right.png', 'chair-left': 'main-v2/chair-facing-left.png', vase: 'main-v2/flower-vase.png' } as const;
const metadata = runtime.mainStaticMetadata;
const fileBytes = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url));
const fileFor = (id: keyof typeof metadata, packed: boolean) => packed ? `public/art/generated/${GENERATED_MAIN_ASSETS[id]}` : archive.images.find(row => row.key === id)!.file;
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
type NativeCanvas = { createCanvas(width: number, height: number): HTMLCanvasElement & { toBuffer(type: string): Buffer }; loadImage(bytes: Buffer): Promise<HTMLImageElement> };
let native: NativeCanvas | undefined;
try { native = createRequire(import.meta.url)('@napi-rs/canvas') as NativeCanvas; } catch { /* Optional authoring dependency. */ }
describe.skipIf(!native)('isolated native main static evidence', () => {
  it('renders real original and packed RoomPainter PNGs with identical live state', async () => {
    const originals: Record<string, HTMLImageElement> = {}, packed: Record<string, HTMLImageElement> = {};
    for (const id of ids) { originals[id] = await native!.loadImage(fileBytes(fileFor(id, false))); packed[id] = await native!.loadImage(fileBytes(fileFor(id, true))); }
    for (const [id, file] of Object.entries(retained)) originals[id] = packed[id] = await native!.loadImage(fileBytes(`public/art/generated/${file}`));
    const render = async (sources: Record<string, HTMLImageElement>) => {
      clearGeneratedMainAssets(); vi.stubGlobal('document', { createElement: () => native!.createCanvas(1, 1) });
      for (const [id, source] of Object.entries(sources)) installGeneratedMainAsset(id as GeneratedMainId, source);
      setGeneratedFoodAdapter(createGeneratedFoodArt(Object.fromEntries(foods.map(id => [id, sources[id]])), { createCanvas: () => native!.createCanvas(1, 1), rasterMetadata: metadata }));
      const canvas = native!.createCanvas(640, 480), ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#e2ccad'; ctx.fillRect(0, 0, 640, 480); ctx.scale(2, 2); ctx.imageSmoothingEnabled = false;
      const painter = new RoomPainter(ctx, 2, true), value = state('open', 8, 8);
      // Native Canvas-to-Canvas scan strips caused a process kill in this backend.
      // An identical immutable decoded Image avoids that native-only issue, using
      // the exact production floor painter, projection and room-shell geometry.
      const floor = native!.createCanvas(640, 480), fc = floor.getContext('2d')!; fc.scale(2, 2);
      new RoomPainter(fc, 2, false).drawFloor('floor_checker', 'rug_none', lightingAt(12), 240);
      const floorImage = await native!.loadImage(floor.toBuffer('image/png'));
      const decoded = native!.createCanvas(640, 480), dc = decoded.getContext('2d')!; dc.drawImage(floorImage, 0, 0);
      expect(Buffer.from(dc.getImageData(0, 0, 640, 480).data).equals(Buffer.from(fc.getImageData(0, 0, 640, 480).data))).toBe(true);
      const strips = (source: HTMLCanvasElement) => {
        const draws: number[][] = [];
        projectFloorLayer({ save() {}, restore() {}, drawImage: (_source: unknown, ...args: number[]) => draws.push(args) } as unknown as CanvasRenderingContext2D, source, mainPixelProjection(240));
        return draws;
      };
      const canvasStrips = strips(floor), imageStrips = strips(floorImage as unknown as HTMLCanvasElement);
      expect(imageStrips).toEqual(canvasStrips); expect(imageStrips).toHaveLength(2880);
      paintPixelRoomShell(ctx, 240, mainPixelProjection(240));
      projectFloorLayer(ctx, floorImage as unknown as HTMLCanvasElement, mainPixelProjection(240));
      paintRoom(painter, value); return canvas;
    };
    const before = await render(originals), after = await render(packed);
    clearGeneratedMainAssets(); vi.unstubAllGlobals();
    expect(before.width).toBe(after.width); expect(before.height).toBe(after.height);
    if (process.env.MAIN_STATIC_EVIDENCE === '1') {
      const directory = 'docs/pixel-depth/main-static-pack-v1'; mkdirSync(directory, { recursive: true });
      writeFileSync(`${directory}/before.png`, before.toBuffer('image/png')); writeFileSync(`${directory}/after.png`, after.toBuffer('image/png'));
      const both = native!.createCanvas(1280, 512), ctx = both.getContext('2d')!; ctx.fillStyle = '#302b25'; ctx.fillRect(0, 0, 1280, 512);
      ctx.fillStyle = '#fff8e8'; ctx.font = '18px sans-serif'; ctx.fillText('Original sources — native RoomPainter QA', 12, 23); ctx.fillText('Packed sources — same state and geometry', 652, 23);
      ctx.drawImage(before, 0, 32); ctx.drawImage(after, 640, 32); writeFileSync(`${directory}/comparison.png`, both.toBuffer('image/png'));
      writeFileSync(`${directory}/bytes.json`, JSON.stringify({ note: 'Native Canvas comparison, not browser or phone QA. Production floor pixels are decoded to an immutable Image before unchanged scan-strip projection to avoid native Canvas snapshot retention.', images: archive.images.map(row => ({ id: row.key, originalBytes: row.bytes, ...catalog.images.find(image => image.key === row.key) })) }, null, 2) + '\n');
    }
  });
});
