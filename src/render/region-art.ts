import { FLOOR_Y, SCENE_W, floorY } from '../game/layout';
import type { RegionId } from '../game/regions';
import { paintFloor, paintWall } from './decor-art';
import { passageRunner } from './passages';
import { drawText, textWidth } from './font';
import { cabinetPanel, glassReflection, leafySprig, timberBeam, treeLine, wallLantern, WARM_MATERIAL } from './materials';
import { mix } from './color';
import { paintFloorFurniture } from './furniture-art';
import { beam, type Lighting } from './lighting';
import { paintSunbeam } from './room-art';
import { generatedMainSource } from './generated-main-art';
import { extensionFloor, extensionRunner, extensionWindowPatch, readingDoor, readingFurnishing } from './extension-surfaces';
import { paintWindowBounce } from './main-room-lighting';

type Ctx = CanvasRenderingContext2D;
const ink = WARM_MATERIAL.ink;
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** The background library shelves have individually bound books and recessed bays. */
function libraryShelf(ctx: Ctx, x: number): void {
  const r = (dx: number, y: number, w: number, h: number, c: string) => rect(ctx, x + dx, y, w, h, c);
  r(-3, 14, 71, 64, ink);
  r(0, 17, 65, 58, '#865332');
  for (let row = 0; row < 3; row++) {
    const y = 23 + row * 17;
    r(3, y - 2, 59, 15, '#543425');
    r(3, y - 1, 59, 2, '#39281f');
    for (let i = 0; i < 11; i++) {
      const colors = ['#687958', '#b4694a', '#d6b774', '#5d7479', '#977574'];
      const by = y + i % 3, bh = 11 - i % 3;
      const base = colors[(i + row * 2) % colors.length];
      r(3 + i * 5, by, 4, bh, base);
      r(3 + i * 5, by, 1, bh, mix(base, '#f4e6c7', 0.4));
      r(6 + i * 5, by + 1, 1, bh - 1, mix(base, ink, 0.35));
      r(4 + i * 5, by + 2, 2, 1, '#e6c784');
      r(4 + i * 5, y + 9, 2, 1, '#c6a66a');
      if ((i + row) % 3 === 0) r(4 + i * 5, by + 4, 1, 3, '#ead7b1');
    }
    timberBeam(ctx, x, y + 12, 65, 4);
  }
  for (const px of [-2, 64]) timberBeam(ctx, x + px, 15, 4, 63, true);
  timberBeam(ctx, x - 4, 13, 73, 6);
  r(1, 20, 2, 3, '#c8a15e'); r(61, 20, 2, 3, '#c8a15e');
}

function gardenBox(ctx: Ctx, x: number, y: number, width: number, flowers: boolean): void {
  rect(ctx, x, y, width, 9, '#543425');
  rect(ctx, x + 1, y + 2, width - 2, 6, '#9b6844');
  rect(ctx, x - 1, y, width + 2, 2, '#d2a063');
  for (let i = 4; i < width - 2; i += 7) rect(ctx, x + i, y + 2, 1, 6, '#74492f');
  for (let i = 4; i < width - 1; i += 8) {
    leafySprig(ctx, x + i, y - 3 - i % 3, 3, i);
    if (flowers) {
      rect(ctx, x + i - 1, y - 7, 3, 1, i % 2 ? '#d89476' : '#f4e6c7');
      rect(ctx, x + i, y - 8, 1, 3, i % 2 ? '#d89476' : '#f4e6c7');
      rect(ctx, x + i, y - 7, 1, 1, '#d4ad54');
    }
  }
}

/** Each extension has authored architecture, while all routing geometry stays local. */
export function paintRegion(ctx: Ctx, id: RegionId, height: number, t: number, light: Lighting, locked: boolean): void {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, x, y, w, h, color);
  const reading = id === 'reading', terrace = id === 'terrace';
  paintWall(ctx, reading ? 'wall_cream' : 'wall_mint', 0, 0, SCENE_W, FLOOR_Y, t);
  if (!locked && !reading) extensionFloor(ctx, id, FLOOR_Y, height);
  else paintFloor(ctx, terrace ? 'floor_terrazzo' : reading ? 'floor_herringbone' : 'floor_mint', 0, FLOOR_Y, SCENE_W, height - FLOOR_Y);
  const furnishing = (kind: 'armchair' | 'lamp', x: number, foot: number) => {
    if (locked) paintFloorFurniture(ctx, kind, x, foot);
  };
  const sky = (painted: string) => mix(painted, light.sky[1], 0.55);

  const backdrop = generatedMainSource(`cozy-region-${id}`);
  if (backdrop) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(backdrop, 0, 0, SCENE_W, FLOOR_Y);
    if (light.dark > 0) {
      ctx.globalAlpha = light.dark * .48; ctx.fillStyle = '#283837';
      ctx.fillRect(0, 0, SCENE_W, FLOOR_Y);
    }
    ctx.restore();
    if (reading) {
      furnishing('armchair', 115, floorY(102));
      furnishing('armchair', 206, floorY(102));
      furnishing('lamp', 100, floorY(98));
    } else {
      for (const x of [30, 290]) paintFloorFurniture(ctx, terrace ? 'plant_lemon' : 'plant_monstera', x, floorY(96));
      paintFloorFurniture(ctx, 'bench', 160, floorY(100));
      for (const x of [108, 212]) paintFloorFurniture(ctx, 'plant_fern', x, floorY(98));
    }
  } else if (reading) {
    timberBeam(ctx, 0, 0, SCENE_W, 8);
    for (const x of [0, 314]) timberBeam(ctx, x, 0, 6, 80, true);
    for (const x of [18, 234]) libraryShelf(ctx, x);
    // A deep, casement bay with cream glazing putty and checked ochre drapes.
    r(109, 20, 102, 49, ink);
    r(110, 21, 100, 47, '#a17243');
    r(113, 24, 94, 41, sky('#a1c5c5'));
    treeLine(ctx, 113, 36, 94, 29, light.dark);
    glassReflection(ctx, 113, 24, 94, 41, 0.16);
    r(157, 23, 5, 43, '#6f492e'); r(158, 24, 2, 41, '#e2c18b');
    r(112, 43, 96, 4, '#6f492e'); r(113, 43, 94, 1, '#e2c18b');
    timberBeam(ctx, 106, 67, 108, 6);
    for (const x of [104, 208]) {
      for (let dy = 0; dy < 34; dy++) for (let dx = 0; dx < 8; dx++) {
        const check = (Math.floor(dx / 2) + Math.floor(dy / 3)) % 2;
        r(x + dx, 25 + dy, 1, 1, check ? '#a47947' : '#e0bf83');
      }
      r(x, 51, 8, 2, '#f1d692');
      r(x + 2, 53, 1, 4, '#c8a15e');
    }
    gardenBox(ctx, 118, 64, 18, false);
    r(181, 62, 14, 2, '#7e5b45'); r(182, 60, 12, 2, '#d2ad78');
    r(183, 58, 11, 2, '#6d7c5b');
    for (const x of [90, 219]) wallLantern(ctx, x, 31);
    furnishing('armchair', 115, floorY(102));
    furnishing('armchair', 206, floorY(102));
    furnishing('lamp', 100, floorY(98));
  } else {
    r(0, 0, SCENE_W, 80, sky('#b7d7d2'));
    for (const [x, y, w] of [[41, 13, 36], [199, 8, 44]]) {
      r(x, y, w, 4, light.cloud); r(x + 7, y - 3, w - 18, 3, light.cloud);
      r(x + 2, y + 4, w - 5, 2, mix(light.cloud, light.sky[2], 0.4));
    }
    treeLine(ctx, 0, 28, SCENE_W, 52, light.dark);
    if (terrace) {
      // Terracotta coping stones, staggered masonry and a pegged oak pergola.
      r(0, 62, SCENE_W, 18, '#b49b78');
      for (let row = 0; row < 3; row++) for (let x = -11 + row % 2 * 11; x < SCENE_W; x += 23) {
        r(x, 63 + row * 6, 22, 5, (x + row) % 3 ? '#c4ad87' : '#b7a07d');
        r(x + 1, 63 + row * 6, 20, 1, '#e2cca3');
        r(x + 21, 64 + row * 6, 1, 4, '#90795e');
        r(x + 4, 66 + row * 6, 3, 1, '#d3b98e');
      }
      timberBeam(ctx, 0, 59, SCENE_W, 5, false, '#9b6947');
      for (const x of [9, 305]) {
        timberBeam(ctx, x, 0, 6, 89, true);
        for (let i = 0; i < 13; i++) r(x < 100 ? x + 6 + i : x - i - 1, 7 + i, 1, 6, '#765032');
      }
      timberBeam(ctx, 0, 0, SCENE_W, 7);
      for (let x = 34; x < 310; x += 48) {
        r(x, 4, 4, 9, '#543425'); r(x, 4, 1, 9, '#c98c4d');
      }
      for (let x = 6; x < SCENE_W; x += 2) r(x, 13 + Math.round(Math.sin(x / SCENE_W * Math.PI) * 10), 2, 1, ink);
      for (let x = 22; x < SCENE_W; x += 34) {
        const y = 14 + Math.round(Math.sin(x / SCENE_W * Math.PI) * 10);
        r(x, y, 1, 4, ink); r(x - 2, y + 4, 5, 6, '#9c7448');
        r(x - 1, y + 5, 3, 4, '#f4cc77'); r(x - 1, y + 5, 1, 3, '#fff3c4');
      }
      for (const x of [39, 251]) gardenBox(ctx, x, 68, 31, true);
      for (const x of [14, 307]) for (const y of [13, 26, 39, 48]) leafySprig(ctx, x, y, 4, x + y);
      // Sparse, subtle stone-edge chips, never a second grid over the tile joints.
      for (let y = 96; y < height - 18; y += 48) for (const x of [26, 82, 226, 278]) {
        r(x, y, 5, 1, '#d9c7a4');
        r(x + 1, y + 1, 3, 1, '#f1e5c9');
        r(x + 12, y + 16, 2, 1, '#d9c7a4');
      }
    } else {
      // Timber footwall, steel ribbed glass canopy and planted potting shelves.
      for (let gx = 4; gx < SCENE_W; gx += 53) glassReflection(ctx, gx, 3, 49, 71, 0.15);
      for (let x = 0; x < SCENE_W; x += 53) {
        r(x, 0, 5, 80, '#384a39'); r(x + 1, 0, 2, 80, '#8b9a70');
        r(x + 3, 1, 1, 78, '#bac59a');
        for (const y of [28, 73]) { r(x, y, 5, 5, '#536447'); r(x + 1, y + 1, 1, 1, '#dfd5a2'); }
      }
      r(0, 28, SCENE_W, 4, '#4d654c'); r(0, 28, SCENE_W, 1, '#b7c295');
      // Diagonal roof glazing reads as real trusses in perspective.
      for (let x = 20; x < SCENE_W; x += 53) for (let y = 0; y < 28; y++) {
        r(x + Math.round(y * 0.55), y, 2, 1, '#677c59');
        r(x + Math.round(y * 0.55) - 1, y, 1, 1, '#afba8e');
      }
      for (let i = 0; i < 8; i++) {
        const x = 14 + i * 40, y = 18 + i % 3 * 3;
        r(x, 1, 1, y - 5, '#745534');
        for (const dx of [-3, 3]) for (let sy = y - 5; sy < y; sy++) r(x + Math.round(dx * (sy - y + 6) / 6), sy, 1, 1, '#b39b66');
        gardenBox(ctx, x - 5, y + 2, 11, false);
      }
      for (const x of [7, 218]) {
        cabinetPanel(ctx, x, 65, 94, 15, '#7c5735');
        timberBeam(ctx, x - 1, 62, 96, 4);
        for (let i = 0; i < 4; i++) gardenBox(ctx, x + 5 + i * 21, 55, 12, i % 2 === 0);
      }
      timberBeam(ctx, 0, 77, SCENE_W, 4, false, '#627451');
    }
    for (const x of [30, 290]) paintFloorFurniture(ctx, terrace ? 'plant_lemon' : 'plant_monstera', x, floorY(96));
    paintFloorFurniture(ctx, 'bench', 160, floorY(100));
    for (const x of [108, 212]) paintFloorFurniture(ctx, 'plant_fern', x, floorY(98));
  }

  if (reading && !locked) readingDoor(ctx, FLOOR_Y, light);
  const word = reading ? 'BOOK NOOK' : terrace ? 'GARDEN PATIO' : 'GLASSHOUSE';
  // The reading room's sign hangs right of its rear doorway, clear of the café-name plate.
  const width = textWidth(word) + 14, signX = reading ? SCENE_W - 70 : 160;
  timberBeam(ctx, signX - width / 2 - 1, 7, width + 2, 13, false, reading ? '#865332' : '#627451');
  r(signX - width / 2 + 3, 10, width - 6, 7, reading ? '#67432b' : '#42553d');
  drawText(ctx, word, signX - textWidth(word) / 2, 11, '#f4e6c7');

  // The existing narrow service aisle is unchanged; only its woven artwork differs.
  if (locked) passageRunner(ctx, 145, floorY(110), 30, height - floorY(110) - 8, 'v', reading ? '#d7b385' : '#cdbd96', true);
  else extensionRunner(ctx, id, 145, floorY(110), 30, height - floorY(110) - 8, 'v');
  const { lean, length } = beam(light.sun);
  if (locked) {
    if (reading) paintSunbeam(ctx, light.sun, 113, 207, FLOOR_Y, lean, length);
    else if (!terrace) for (const x of [20, 128, 236]) paintSunbeam(ctx, light.sun, x, x + 34, FLOOR_Y, lean, length + 24);
  } else if (reading) {
    for (const x of [113, 183]) paintWindowBounce(ctx, x, 24, FLOOR_Y, light.sun);
  } else for (const x of [20, 128, 236]) extensionWindowPatch(ctx, x, 34, FLOOR_Y, light.sun);

  if (reading && !locked) {
    readingFurnishing(ctx, 'armchair', 115, floorY(102));
    readingFurnishing(ctx, 'armchair', 206, floorY(102));
    readingFurnishing(ctx, 'lamp', 100, floorY(98));
  }

  if (locked) {
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#b39f79';
    for (const x of [64, 256]) for (const y of [floorY(112), floorY(180)]) ctx.strokeRect(x - 22, y - 26, 44, 28);
    ctx.restore();
    for (const [x, y] of [[26, height - 20], [272, height - 26]]) {
      cabinetPanel(ctx, x, y - 18, 20, 18, '#ad8455');
      r(x + 3, y - 18, 3, 18, '#775438'); r(x + 14, y - 18, 3, 18, '#775438');
      r(x + 7, y - 13, 6, 5, '#ecdbb2'); r(x + 8, y - 12, 4, 1, '#a78c64');
      for (let d = 0; d < 13; d++) r(x + 3 + d, y - 16 + d, 2, 1, '#d0aa74');
    }
    ctx.save(); ctx.globalAlpha = 0.15; r(0, 0, SCENE_W, height, '#584b38'); ctx.restore();
  }
}
