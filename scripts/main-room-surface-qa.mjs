// Software swatch of the native painters only. This deliberately does not claim
// to validate Phaser compositing, projection, text, live props or time-of-day.
// node scripts/main-room-surface-qa.mjs
import { rolldown } from 'rolldown';
import { encodePng } from './pixel-conform.mjs';
const bundle = await rolldown({ input: 'src/render/main-room-surfaces.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const code = output.find(part => part.type === 'chunk').code;
const art = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const width = 640, height = 480, pixels = new Uint8ClampedArray(width * height * 4);
const ctx = {
  fillStyle: '#efdfbe',
  fillRect(x, y, w, h) {
    const rgb = [1, 3, 5].map(i => parseInt(this.fillStyle.slice(i, i + 2), 16));
    for (let row = Math.max(0, Math.round(y * 2)); row < Math.min(height, Math.round((y + h) * 2)); row++)
      for (let col = Math.max(0, Math.round(x * 2)); col < Math.min(width, Math.round((x + w) * 2)); col++)
        pixels.set([...rgb, 255], (row * width + col) * 4);
  },
};
ctx.fillRect(0, 0, 320, 240);
art.mainWall(ctx, 'wall_cream');
art.mainFloor(ctx, 'floor_checker', 240);
art.mainCabinet(ctx, 'counter_oak', 64, 96, 168, 12, 19, true);
art.mainCarpet(ctx, 240, true);
art.mainSillPlant(ctx, 'sill_bonsai', 38, 57);
art.mainSkyDisc(ctx, 27, 25, false);
art.mainSkyDisc(ctx, 40, 25, true);
encodePng('artifacts/art-grid/main-redraw-surfaces.png', { width, height, pixels });
