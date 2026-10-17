import type { AreaId } from '../game/regions';
import type { Lighting, Sun } from './lighting';
import { beam } from './lighting';
import { artRamp, artRect, mainTimber } from './main-room-surfaces';
import { paintContactShade } from './main-room-lighting';

type Ctx = CanvasRenderingContext2D;
const cream = artRamp('cloth-7'), oak = artRamp('oak'), walnut = artRamp('walnut');

export function extensionFloor(ctx: Ctx, area: AreaId, top: number, height: number): void {
  const floor = artRamp('floor');
  const colors = area === 'greenhouse' ? [floor[0], floor[0], artRamp('terracotta')[2], floor[2], floor[3]] : floor;
  const tileW = area === 'terrace' ? 40 : 24, tileH = area === 'terrace' ? 20 : 24;
  artRect(ctx, 0, top, 320, height - top, colors[1]);
  ctx.save(); ctx.beginPath(); ctx.rect(0, top, 320, height - top); ctx.clip();
  for (let row = 0, originY = top; originY < height; originY += tileH, row++) {
    for (let originX = row % 2 ? -tileW / 2 : 0; originX < 320; originX += tileW) {
      artRect(ctx, originX + .5, originY + .5, tileW - 1, tileH - 1, colors[3]);
      artRect(ctx, originX + 1, originY + 1, tileW - 2, .5, colors[4]);
      artRect(ctx, originX + 1, originY + 1, .5, tileH - 2, colors[4]);
      artRect(ctx, originX + 1, originY + tileH - 1.5, tileW - 2, .5, colors[2]);
      if ((row + Math.floor(originX / tileW)) % 4 === 0) {
        artRect(ctx, originX + 5, originY + tileH - 4, 7, .5, colors[2]);
        artRect(ctx, originX + 6, originY + tileH - 4.5, 4, .5, colors[4]);
      }
    }
  }
  ctx.restore();
}

export function extensionRunner(ctx: Ctx, area: AreaId, originX: number, originY: number, width: number, height: number, dir: 'h' | 'v'): void {
  const colors = artRamp(area === 'reading' ? 'gingham' : area === 'terrace' ? 'cloth-1' : 'sage');
  artRect(ctx, originX, originY, width, height, colors[0]);
  artRect(ctx, originX + .5, originY + .5, width - 1, height - 1, oak[2]);
  artRect(ctx, originX + 1, originY + 1, width - 2, height - 2, cream[1]);
  artRect(ctx, originX + 2, originY + 2, width - 4, height - 4, colors[1]);
  artRect(ctx, originX + 3, originY + 3, width - 6, height - 6, area === 'reading' ? cream[2] : colors[2]);
  const count = dir === 'h' ? width : height;
  for (let step = 9; step < count - 6; step += 20) {
    const cx = dir === 'h' ? originX + step : originX + width / 2;
    const cy = dir === 'h' ? originY + height / 2 : originY + step;
    artRect(ctx, cx - 1, cy - 2, 2, 1, colors[0]);
    artRect(ctx, cx - 2, cy - 1, 4, 2, colors[1]);
    artRect(ctx, cx - 1, cy + 1, 2, 1, colors[0]);
  }
}

export function readingDoor(ctx: Ctx, floor: number, light?: Lighting): void {
  artRect(ctx, 139, 12, 42, floor - 8, walnut[0]);
  artRect(ctx, 144, 18, 32, floor - 18, artRamp('sage')[0]);
  const sage = artRamp('sage'), tile = artRamp('floor');
  artRect(ctx, 146, 20, 28, floor - 20, sage[1]);
  artRect(ctx, 148, 21, 24, 32, light?.sky[1] ?? artRamp('sky')[1]);
  artRect(ctx, 159, 21, 1.5, 33, sage[0]);
  artRect(ctx, 148, 38, 24, 1, sage[1]);
  artRect(ctx, 146, 54, 28, floor - 54, tile[2]);
  for (let top = 56; top < floor - 2; top += 7) {
    artRect(ctx, 146, top, 28, .5, tile[0]);
    artRect(ctx, top % 2 ? 154 : 164, top, .5, 7, tile[0]);
  }
  for (const originX of [149, 169]) {
    artRect(ctx, originX - 2, 50, 5, 6, artRamp('terracotta')[0]);
    artRect(ctx, originX - 1.5, 50, 4, 5, artRamp('terracotta')[2]);
    artRect(ctx, originX, 41, .5, 9, sage[0]);
    for (let row = 0; row < 3; row++) {
      artRect(ctx, originX - 2, 42 + row * 2, 2.5, 1, sage[2]);
      artRect(ctx, originX + .5, 41 + row * 2, 2, 1, sage[3]);
    }
  }
  if (light && light.dark > 0) {
    ctx.save(); ctx.globalAlpha = light.dark * .4;
    artRect(ctx, 144, 18, 32, floor - 20, sage[0]); ctx.restore();
  }
  readingDoorFrame(ctx, floor);
}

export function readingDoorFrame(ctx: Ctx, floor: number): void {
  mainTimber(ctx, 139, 13, 5, floor - 9, true);
  mainTimber(ctx, 176, 13, 5, floor - 9, true);
  mainTimber(ctx, 137, 10, 46, 8);
  mainTimber(ctx, 144, floor - 2, 32, 3);
  artRect(ctx, 146, floor - 1.5, 28, .5, cream[2]);
}

export function readingFurnishing(ctx: Ctx, kind: 'armchair' | 'lamp', cx: number, foot: number): void {
  const draw = (originX: number, originY: number, width: number, height: number, color: string) => artRect(ctx, cx + originX, foot + originY, width, height, color);
  paintContactShade(ctx, cx, foot, kind === 'lamp' ? 10 : 24, .18);
  if (kind === 'lamp') {
    const brass = artRamp('brass');
    draw(-4, -1, 8, 1.5, walnut[0]); draw(-3.5, -1.5, 7, 1, brass[1]);
    draw(-2.5, -2, 5, .5, brass[3]); draw(1, -1, 2.5, .5, brass[0]);
    draw(-.5, -24, 1.5, 22, brass[0]); draw(-.5, -24, .5, 21.5, brass[3]);
    draw(0, -23, .5, 20.5, brass[2]);
    draw(-1, -33, 2, 1, brass[1]); draw(-1, -33, 1, .5, brass[3]);
    for (let row = 0; row < 16; row++) {
      const half = 2 + Math.floor(row / 4);
      draw(-half, -32 + row / 2, half * 2, .5, walnut[0]);
      draw(-half + .5, -32 + row / 2, half * 2 - 1, .5, cream[1]);
      draw(-half + .5, -32 + row / 2, half - .5, .5, cream[2]);
      draw(half - 1, -32 + row / 2, .5, .5, cream[0]);
    }
    draw(-5, -24, 10, .5, brass[0]); draw(-4.5, -24, 8.5, .5, brass[3]);
    draw(-4, -23.5, 8, .5, cream[1]);
    return;
  }
  const cloth = artRamp('gingham');
  for (const originX of [-10, 8]) {
    draw(originX, -4, 2, 5, walnut[0]);
    draw(originX + .5, -3, 1, 3.5, oak[2]);
    draw(originX + .5, -3, .5, 2, oak[3]);
  }
  for (let row = 0; row < 34; row++) {
    const inset = row < 2 ? 2 : row < 4 ? 1 : 0;
    const top = -26 + row / 2;
    draw(-9 + inset, top, 17 - inset * 2, .5, walnut[0]);
    if (row > 0 && row < 33) {
      draw(-8.5 + inset, top, 16 - inset * 2, .5, cloth[0]);
      draw(-8 + inset, top, 13 - inset * 2, .5, cloth[1]);
    }
  }
  draw(-6, -25, 10, .5, cloth[2]); draw(-7.5, -23.5, .5, 9, cloth[2]);
  draw(-6.5, -24, 11.5, .5, cloth[0]); draw(-6.5, -23.5, .5, 9, cloth[0]);
  draw(4.5, -23.5, .5, 10, cloth[0]); draw(-6, -14, 11, .5, cloth[0]);
  for (const originX of [-3.5, 1.5]) {
    draw(originX, -21, 1, .5, cloth[0]); draw(originX + .5, -20.5, .5, .5, cloth[2]);
  }
  draw(-6, -10, 12, 7, walnut[0]); draw(-5.5, -9.5, 11, 5.5, cloth[0]);
  draw(-5.5, -10, 10.5, 2.5, cloth[1]); draw(-5, -10, 9.5, .5, cloth[2]);
  draw(-5.5, -7.5, 10.5, .5, walnut[0]); draw(-5, -7, 9.5, .5, cloth[2]);
  for (const [originX, top] of [[-12, -15], [6, -14]] as const) {
    draw(originX + 1, top - 1, 4, .5, walnut[0]); draw(originX + .5, top - .5, 5, 1, walnut[0]);
    draw(originX, top + .5, 6, 10.5, walnut[0]);
    draw(originX + .5, top, 5, 10.5, cloth[0]); draw(originX + .5, top + .5, 3.5, 8.5, cloth[1]);
    draw(originX + 1, top, 3, .5, cloth[2]); draw(originX + .5, top + 1, .5, 5, cloth[2]);
    draw(originX + 4, top + 1, .5, 8.5, cloth[0]); draw(originX + .5, top + 9.5, 4, .5, walnut[0]);
  }
  draw(-8, -3.5, 16, 1, walnut[2]);
  draw(-8, -3.5, 15, .5, oak[3]);
}

export function extensionRunnerJunction(ctx: Ctx, area: AreaId, originY: number): void {
  const colors = artRamp(area === 'reading' ? 'gingham' : area === 'terrace' ? 'cloth-1' : 'sage');
  artRect(ctx, 145, originY - 7, 30, 14, area === 'reading' ? cream[2] : colors[2]);
  artRect(ctx, 159, originY - 2, 2, 1, colors[0]);
  artRect(ctx, 158, originY - 1, 4, 2, colors[1]);
  artRect(ctx, 159, originY + 1, 2, 1, colors[0]);
}

export function extensionLampPool(ctx: Ctx, radius: number, tint: string): void {
  ctx.save(); ctx.fillStyle = tint;
  for (let row = 0; row < radius * 2; row += .5) for (let col = 0; col < radius * 2; col += .5) {
    const distance = Math.hypot(col + .25 - radius, row + .25 - radius) / radius;
    if (distance >= 1) continue;
    ctx.globalAlpha = .28 * (1 - distance * distance) ** 3;
    ctx.fillRect(col, row, .5, .5);
  }
  ctx.restore();
}

export function extensionWindowPatch(ctx: Ctx, originX: number, width: number, floor: number, sun: Sun): void {
  if (sun.elevation <= 0 || sun.strength <= 0) return;
  const { lean, length } = beam(sun);
  ctx.save(); ctx.fillStyle = artRamp('wall')[4];
  for (let row = 0; row < length; row += .5) {
    const progress = row / length;
    if (progress > .36 && progress < .40) continue;
    ctx.globalAlpha = sun.strength * .38 * Math.min(1, (1 - progress) * 12);
    for (let pane = 0; pane < 2; pane++) {
      artRect(ctx, originX + progress * lean + pane * width / 2, floor + row, width / 2 - 2, .5, artRamp('wall')[4]);
    }
  }
  ctx.restore();
}
