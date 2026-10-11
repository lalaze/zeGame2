import { FLOOR_Y, SCENE_W, floorY } from '../game/layout';
import type { RegionId } from '../game/regions';
import { paintFloor, paintWall } from './decor-art';
import { drawText, textWidth } from './font';
import { glassReflection, treeLine } from './materials';
import { mix } from './color';
import { paintFloorFurniture } from './furniture-art';
import { beam, type Lighting } from './lighting';
import { paintSunbeam } from './room-art';

/** Each extension has its own architecture; coordinates are local to that room. */
export function paintRegion(ctx: CanvasRenderingContext2D, id: RegionId, height: number, t: number, light: Lighting, locked: boolean): void {
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const ink = '#493127';
  const green = '#57715b';
  const reading = id === 'reading';
  const terrace = id === 'terrace';
  paintWall(ctx, reading ? 'wall_cream' : 'wall_mint', 0, 0, SCENE_W, FLOOR_Y, t);
  paintFloor(ctx, terrace ? 'floor_terrazzo' : reading ? 'floor_herringbone' : 'floor_mint', 0, FLOOR_Y, SCENE_W, height - FLOOR_Y);
  const sky = (painted: string) => mix(painted, light.sky[1], 0.55);

  if (reading) {
    r(0, 0, 320, 6, '#6a3d2c');
    for (const x of [18, 234]) {
      r(x - 3, 14, 71, 64, ink);
      r(x, 17, 65, 58, '#8b5940');
      for (let row = 0; row < 3; row++) {
        const y = 23 + row * 17;
        for (let i = 0; i < 11; i++) {
          const colors = ['#728b70', '#bd6c54', '#e3be79', '#62798c', '#a8839a'];
          r(x + 3 + i * 5, y + i % 3, 4, 11 - i % 3, colors[(i + row * 2) % colors.length]);
          r(x + 4 + i * 5, y + 3 + i % 3, 2, 1, '#f4dcb0');
          r(x + 3 + i * 5, y + 1 + i % 3, 1, 10 - i % 3, '#ffffff22');
          r(x + 3 + i * 5, y + 9, 3, 1, '#332d352e');
        }
        r(x, y + 12, 65, 3, '#d39a62');
      }
    }
    r(109, 20, 102, 49, ink);
    r(113, 24, 94, 41, sky('#a1b6bd'));
    treeLine(ctx, 113, 35, 94, 30, light.dark);
    glassReflection(ctx, 113, 24, 94, 41, 0.16);
    r(158, 24, 4, 41, '#d6b088');
    r(113, 44, 94, 3, '#d6b088');
    r(106, 69, 108, 4, '#6a3d2c');
    for (const x of [105, 207]) {
      r(x, 31, 8, 20, '#c38469');
      r(x + 2, 31, 1, 20, '#e8b28a');
    }
    paintFloorFurniture(ctx, 'armchair', 115, floorY(102));
    paintFloorFurniture(ctx, 'armchair', 206, floorY(102));
    paintFloorFurniture(ctx, 'lamp', 100, floorY(98));
  } else {
    r(0, 0, 320, 80, sky('#b7d7d2'));
    treeLine(ctx, 0, 28, SCENE_W, 52, light.dark);
    if (terrace) {
      // Open sky, a low garden wall and hanging bulbs.
      r(0, 62, 320, 18, '#b8a084');
      for (let y = 64; y < 80; y += 7) {
        r(0, y, 320, 1, '#ddc3a1');
        for (let x = (y % 2) * 8; x < 320; x += 22) r(x, y, 1, 6, '#957d68');
      }
      for (let x = 6; x < 320; x += 2) r(x, 10 + Math.round(Math.sin(x / 320 * Math.PI) * 12), 2, 1, ink);
      for (let x = 22; x < 320; x += 34) {
        const y = 11 + Math.round(Math.sin(x / 320 * Math.PI) * 12);
        r(x, y, 1, 5, ink);
        r(x - 2, y + 5, 5, 6, '#9c7448');
        r(x - 1, y + 5, 3, 4, '#ffe0a0');
      }
      for (const x of [43, 255]) {
        r(x, 66, 23, 8, '#966b55'); r(x - 1, 65, 25, 2, '#c89971');
        for (let i = 0; i < 5; i++) {
          r(x + 2 + i * 4, 61, 1, 4, '#577958');
          r(x + 1 + i * 4, 59 + i % 2, 3, 2, i % 2 ? '#e8c178' : '#cd8791');
          r(x + 2 + i * 4, 59 + i % 2, 1, 1, '#fff0bc');
        }
      }
      for (const x of [12, 308]) {
        r(x - 3, 0, 6, 90, ink);
        r(x - 1, 0, 2, 90, '#a98a60');
      }
    } else {
      // Glass roof and tall mullions, with soft reflected light.
      for (let gx = 4; gx < 320; gx += 53) glassReflection(ctx, gx, 3, 49, 71, 0.15);
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - light.dark * 0.7);
      for (const x of [20, 128, 236]) {
        r(x, 8, 25, 68, '#ffffff');
        r(x + 29, 8, 5, 68, '#ffffff');
      }
      ctx.restore();
      for (let x = 0; x < 320; x += 53) {
        r(x, 0, 4, 80, green);
        r(x + 1, 0, 1, 80, '#a7b99b');
      }
      r(0, 28, 320, 4, green);
      r(0, 75, 320, 5, green);
      for (let i = 0; i < 8; i++) {
        const x = 12 + i * 40;
        r(x, 0, 1, 13 + i % 3 * 3, '#547452');
        r(x - 5, 12 + i % 3 * 3, 11, 5, '#748b54');
        for (let leaf = 0; leaf < 3; leaf++) {
          r(x - 7 + leaf * 5, 12 + i % 3 * 3 + leaf % 2, 4, 2, '#a5bb77');
          r(x - 6 + leaf * 5, 15 + i % 3 * 3 + leaf % 2, 2, 3, '#4f785c');
        }
        r(x - 4, 17 + i % 3 * 3, 9, 5, '#ab7850');
        r(x - 2, 22 + i % 3 * 3, 5, 1, '#674c39');
      }
    }
    for (const x of [30, 290]) paintFloorFurniture(ctx, terrace ? 'plant_lemon' : 'plant_monstera', x, floorY(96));
    paintFloorFurniture(ctx, 'bench', 160, floorY(100));
    for (const x of [108, 212]) paintFloorFurniture(ctx, 'plant_fern', x, floorY(98));
  }

  const word = reading ? 'BOOK NOOK' : terrace ? 'GARDEN PATIO' : 'GLASSHOUSE';
  const width = textWidth(word) + 14;
  const signX = reading ? 70 : 160;
  r(signX - width / 2 - 1, 7, width + 2, 13, ink);
  r(signX - width / 2, 8, width, 11, reading ? '#80513b' : green);
  drawText(ctx, word, signX - textWidth(word) / 2, 11, '#ffe6b5');

  // A narrow central aisle joins the entrance to the back of each room.
  r(145, floorY(110), 30, height - floorY(110) - 8, reading ? '#d4b086' : '#cabfa2');
  r(146, floorY(110) + 1, 28, height - floorY(110) - 10, reading ? '#e2c49a' : '#e0d5b6');
  for (let y = floorY(112); y < height - 10; y += 10) {
    r(148, y, 1, 4, '#bba37f');
    r(171, y, 1, 4, '#bba37f');
  }

  // Sun through the reading room's window, and down through the glasshouse roof.
  const { lean, length } = beam(light.sun);
  if (reading) paintSunbeam(ctx, light.sun, 113, 207, FLOOR_Y, lean, length);
  else if (!terrace) for (const x of [20, 128, 236]) paintSunbeam(ctx, light.sun, x, x + 34, FLOOR_Y, lean, length + 24);

  if (locked) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#b39f79';
    for (const x of [64, 256]) for (const y of [floorY(112), floorY(180)]) ctx.strokeRect(x - 22, y - 26, 44, 28);
    ctx.restore();
    for (const [x, y] of [[26, height - 20], [272, height - 26]]) {
      r(x, y - 18, 20, 18, ink);
      r(x + 1, y - 17, 18, 16, '#ad8455');
      r(x + 3, y - 16, 2, 14, '#d9af70');
      r(x + 14, y - 16, 2, 14, '#795a39');
      r(x + 1, y - 10, 18, 2, '#795a39');
    }
    ctx.save();
    ctx.globalAlpha = 0.15;
    r(0, 0, 320, height, '#584b38');
    ctx.restore();
  }
}
