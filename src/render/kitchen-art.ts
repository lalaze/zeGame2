// The kitchen's pixel art. The room (walls, floor and everything against the back
// wall) is baked into one layer; the pieces standing out on the floor are painted
// separately so cooks can walk in front of and behind them. Coordinates are local
// to the kitchen. Equipment the menu doesn't call for yet shows as a marked-out
// space with its hookups capped after the kitchen is built. Before purchase the
// room is an unfitted shell, not a working kitchen hidden under a tint.
import { paintCozyKitchen } from './cozy-world-art';
import { generatedMainSource } from './generated-main-art';
import { extensionFloor } from './extension-surfaces';
import { artRamp, artRect } from './main-room-surfaces';
import { paintPixelSignText } from './sign-lettering';
import type { ItemId } from '../game/data';
import {
  BENCH,
  BINS,
  DISH_PIT,
  HOOD,
  PASTRY_FRIDGE,
  RACK,
  SHEETER_X,
  STAND_MIXER_X,
  WALL_EQUIPMENT,
  type Equipment,
  type Station,
} from '../game/kitchen';
import { FLOOR_Y, SCENE_W, kitchenFloorY } from '../game/layout';
import { brushedMetal, cabinetPanel, glassReflection, timberBeam } from './materials';
import { mix } from './color';
import { drawText, textWidth } from './font';
import { itemIcon } from './sprites';
import { fineSpriteArt } from './fine-sprite-art';
const OUTLINE = '#39281f';

type Ctx = CanvasRenderingContext2D;

const STEEL = { base: '#b4b8a5', hi: '#f4e6c7', lo: '#818575', dark: '#515a49' };
const ENAMEL = { base: '#d7cfaa', hi: '#fff1cf', lo: '#aaa380', dark: '#696b54' };
const SAGE = '#627451', CREAM = '#f4e6c7', BRASS = '#c8a15e';
const DARK_STEEL = { base: '#69745f', hi: '#a6af8a', lo: '#495542', dark: '#303a2e' };
const TILE = '#f4e6c7';
const GROUT = '#cbb992';
const GLOW = '#ffb04a';
/** Where everything against the back wall stands. */
const BASE = 84;

function painter(ctx: Ctx) {
  return (x: number, y: number, w: number, h: number, color: string) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
}

/** A box of brushed steel with an outline, a bright top edge and a shaded right side. */
function steelBox(ctx: Ctx, x: number, y: number, w: number, h: number, metal = STEEL): void {
  const r = painter(ctx);
  r(x - 1, y - 1, w + 2, h + 2, OUTLINE);
  r(x, y, w, h, metal.base);
  brushedMetal(ctx, x, y, w, h, metal.base);
  r(x, y, w, 1, metal.hi);
  r(x, y, 1, h, metal.hi);
  r(x + w - 1, y + 1, 1, h - 1, metal.lo);
  r(x, y + h - 1, w, 1, metal.lo);
}

/** A dashed outline marking where a piece will go once the menu needs it. */
function reserved(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const floor = Math.max(FLOOR_Y + 2, y + h - 3), tape = artRamp('wall');
  artRect(ctx, x + 1, floor, w - 2, 5, artRamp('floor')[0]);
  for (const edge of [x + 1, x + w - 2]) artRect(ctx, edge, floor, 1, 5, tape[3]);
  for (const edge of [floor, floor + 4]) artRect(ctx, x + 1, edge, w - 2, 1, tape[3]);
  artRect(ctx, x + 2, floor, Math.max(1, w - 5), .5, tape[4]);
  for (const edge of [x + 1, x + w - 4]) artRect(ctx, edge, floor + 3, 3, .5, tape[1]);
}

/** A capped pipe and a power socket on the wall: ready for a piece to be fitted. */
function hookup(ctx: Ctx, cx: number): void {
  const r = painter(ctx);
  r(cx - 4, 64, 3, 6, OUTLINE);
  r(cx - 3, 64, 1, 5, STEEL.base);
  r(cx - 5, 63, 5, 2, DARK_STEEL.base);
  r(cx + 2, 64, 5, 5, OUTLINE);
  r(cx + 3, 65, 3, 3, '#f4f1ea');
  r(cx + 4, 66, 1, 1, OUTLINE);
}

/** A small enamel plaque naming a zone of the kitchen. */
function plaque(ctx: Ctx, word: string, cx: number, y: number, color: string): void {
  const r = painter(ctx);
  const w = textWidth(word) + 6;
  const x = Math.round(cx - w / 2);
  r(x - 1, y - 1, w + 2, 9, OUTLINE);
  r(x, y, w, 7, color);
  r(x, y, w, 1, mix(color, '#ffffff', 0.35));
  paintPixelSignText(ctx, word, cx, y + .5, w - 3, 6, artRamp('cloth-7')[2]);
}

// ---------------------------------------------------------------- the room

/**
 * The kitchen's walls, floor and the equipment against the back wall. `active`
 * stations have a cook at them: the ovens glow, the mixer turns, the oil bubbles.
 */
export function paintKitchen(ctx: Ctx, H: number, t: number, locked: boolean, installed: ReadonlySet<Equipment>, active: ReadonlySet<Station>): void {
  const r = painter(ctx);
  if (locked) {
    // The unpurchased wing is a real boarded alcove, never fitted equipment.
    r(0, 0, SCENE_W, FLOOR_Y, '#d8c39a');
    r(0, FLOOR_Y, SCENE_W, H - FLOOR_Y, '#b99b70');
    timberBeam(ctx, 0, 0, SCENE_W, 7); timberBeam(ctx, 0, 7, 6, FLOOR_Y - 7, true);
    timberBeam(ctx, SCENE_W - 6, 7, 6, FLOOR_Y - 7, true);
    r(6, FLOOR_Y - 4, SCENE_W - 12, 4, '#865332');
    for (let y = FLOOR_Y + 1; y < H; y += 16) {
      r(0, y, SCENE_W, 1, '#896f4f'); r(0, y + 1, SCENE_W, 1, '#d1b68b');
      for (let x = 24 + ((y - FLOOR_Y) % 3) * 16; x < SCENE_W; x += 64) r(x, y + 2, 1, 14, '#a08660');
    }
    r(110, 25, 100, 32, OUTLINE); r(112, 27, 96, 28, '#865332'); r(114, 29, 92, 24, CREAM);
    r(117, 31, 1, 1, BRASS); r(202, 31, 1, 1, BRASS);
    drawText(ctx, 'FUTURE KITCHEN', (SCENE_W - textWidth('FUTURE KITCHEN')) / 2, 33, '#543425');
    drawText(ctx, 'CLOSED', (SCENE_W - textWidth('CLOSED')) / 2, 44, '#9b563b');
    // Bundled lengths of carpentry timber and a tied canvas dust cover.
    r(28, H - 18, 53, 3, '#8e7350');
    for (let i = 0; i < 3; i++) {
      r(30 + i % 2 * 2, H - 30 + i * 4, 48, 4, '#865332');
      r(31 + i % 2 * 2, H - 30 + i * 4, 46, 1, '#c98c4d');
    }
    r(41, H - 30, 2, 12, '#c7b68f'); r(64, H - 30, 2, 12, '#c7b68f');
    r(234, H - 38, 34, 24, '#bdab87'); r(238, H - 42, 25, 5, '#d8c9a7');
    r(235, H - 36, 2, 22, '#e4d7b7'); r(250, H - 39, 2, 24, '#a1906e');
    return;
  }
  // Cream glazed subway ceramics, timber cornice and an olive tile dado.
  r(0, 0, SCENE_W, FLOOR_Y, TILE);
  for (let y = 8, row = 0; y < FLOOR_Y - 5; y += 8, row++) {
    r(0, y, SCENE_W, 1, GROUT);
    for (let x = row % 2 ? -8 : 0; x < SCENE_W; x += 16) {
      r(Math.max(0, x + 1), y + 1, Math.min(14, SCENE_W - x - 1), 1, '#fff2d8');
      if (x >= 0) r(x, y + 1, 1, 7, GROUT);
      if ((x + row * 3) % 7 === 0) r(Math.max(0, x + 3), y + 5, 4, 1, '#e8d7b6');
    }
  }
  const wallTile = generatedMainSource('cozy-kitchen-wall');
  if (wallTile) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < FLOOR_Y - 5; y += 32) for (let x = 0; x < SCENE_W; x += 32) {
      const h = Math.min(32, FLOOR_Y - 5 - y);
      ctx.drawImage(wallTile, 0, 0, wallTile.width, wallTile.height * h / 32, x, y, 32, h);
    }
    ctx.restore();
  }
  timberBeam(ctx, 0, 0, SCENE_W, 6);
  r(0, FLOOR_Y - 5, SCENE_W, 5, SAGE); r(0, FLOOR_Y - 5, SCENE_W, 1, '#9da57c');
  r(0, FLOOR_Y - 1, SCENE_W, 1, OUTLINE);

  extensionFloor(ctx, 'kitchen', FLOOR_Y, H);
  r(0, FLOOR_Y, SCENE_W, 2, '#a88b61');
  const drainY = kitchenFloorY(152);
  r(143, drainY - 4, 14, 8, OUTLINE); r(144, drainY - 3, 12, 6, BRASS);
  for (let i = 0; i < 5; i++) r(145 + i * 2, drainY - 2, 1, 4, '#665942');
  for (const [x, w] of [[104, 54], [190, 118]] as const) mat(ctx, x, FLOOR_Y + 7, w, 10);

  // Enamel task lights on brass suspension rods, not flat fluorescent bars.
  for (const x of [52, 113]) {
    r(x, 6, 1, 5, OUTLINE); r(x - 5, 11, 11, 2, OUTLINE);
    r(x - 6, 13, 13, 3, OUTLINE); r(x - 5, 13, 11, 2, SAGE);
    r(x - 4, 13, 7, 1, '#a6af8a'); r(x - 4, 16, 9, 1, '#fff1c6');
  }

  // Zone plaques: storage, prep, and the hot line under the hood.
  plaque(ctx, 'STORE', 62, 8, '#627451');
  plaque(ctx, 'PREP', 120, 16, '#865332');

  const has = (e: Equipment) => installed.has(e);
  const at = (e: Equipment) => WALL_EQUIPMENT[e]!;
  cooler(ctx, at('cooler'), active.has('cooler'));
  dryStore(ctx, at('dryStore'), active.has('dryStore'));
  handSink(ctx, at('handSink'));
  const fit = (e: Equipment, draw: (spot: { x: number; w: number }) => void, height: number) => {
    const spot = at(e);
    if (has(e)) draw(spot);
    else {
      reserved(ctx, spot.x, BASE - height, spot.w, height);
      hookup(ctx, spot.x + spot.w / 2);
    }
  };
  fit('mixer', (s) => mixer(ctx, s, t, active.has('mixer')), 38);
  fit('proofer', (s) => proofer(ctx, s, t, active.has('proofer')), 58);
  hood(ctx);
  fit('kettle', (s) => kettle(ctx, s, t, active.has('kettle')), 38);
  fit('deckOven', (s) => deckOven(ctx, s, t, active.has('deckOven')), 54);
  fit('convection', (s) => convection(ctx, s, t, active.has('convection')), 48);
  fit('fryer', (s) => fryer(ctx, s, t, active.has('fryer')), 28);

  // Order tickets clipped to a rail by the door, so the cooks see what's running low.
  r(250, 30, 58, 2, OUTLINE);
  r(250, 30, 58, 1, BRASS);
  for (const tx of [256, 271, 290]) {
    r(tx, 31, 8, 9, OUTLINE);
    r(tx + 1, 31, 6, 8, CREAM);
    r(tx + 3, 30, 2, 2, BRASS);
    r(tx + 5, 37, 2, 2, '#d4bf96');
    for (let ly = 33; ly < 39; ly += 2) r(tx + 2, ly, 4, 1, '#9aa1aa');
  }

}

/** An anti-fatigue mat, black rubber with drainage holes. */
function mat(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const rubber = artRamp('sage');
  artRect(ctx, x, y, w, h, rubber[0]);
  artRect(ctx, x + .5, y + .5, w - 1, h - 1, rubber[1]);
  artRect(ctx, x + 1, y + .5, w - 2, .5, rubber[2]);
  for (let hy = y + 2; hy < y + h - 1; hy += 2) for (let hx = x + 2; hx < x + w - 2; hx += 3) {
    artRect(ctx, hx, hy, 1.5, .5, rubber[0]);
    artRect(ctx, hx, hy + .5, 1.5, .5, rubber[2]);
  }
}

/** The walk-in cold room's heavy door, with its thermometer and a frosted window. */
function cooler(ctx: Ctx, { x, w }: { x: number; w: number }, on: boolean): void {
  if (paintCozyKitchen(ctx, 'cooler', x, BASE, w, 66, on)) return;
  const r = painter(ctx), top = 18;
  steelBox(ctx, x, top, w, BASE - top, ENAMEL);
  // Rounded enamel door sits in a visibly deep olive seal.
  r(x + 2, top + 2, w - 4, BASE - top - 5, OUTLINE);
  r(x + 3, top + 3, w - 6, BASE - top - 7, SAGE);
  r(x + 4, top + 4, w - 8, BASE - top - 9, '#a8af86');
  r(x + 4, top + 4, 2, BASE - top - 10, '#d6dab2');
  r(x + w - 7, top + 5, 2, BASE - top - 11, '#78825d');
  r(x + 8, top + 9, w - 16, 15, OUTLINE); r(x + 9, top + 10, w - 18, 13, '#9caf9e');
  r(x + 10, top + 11, w - 20, 10, '#c4d4b9');
  glassReflection(ctx, x + 9, top + 10, w - 18, 13, 0.4);
  for (const y of [top + 8, top + 45]) { r(x + 1, y, 4, 6, OUTLINE); r(x + 1, y, 3, 2, BRASS); }
  r(x + w - 8, top + 30, 5, 13, OUTLINE); r(x + w - 7, top + 31, 2, 10, BRASS);
  r(x + w - 7, top + 31, 1, 9, CREAM); r(x + 11, top + 30, 9, 8, CREAM);
  // Tiny snowflake stamped on the door plaque.
  r(x + 13, top + 34, 5, 1, SAGE); r(x + 15, top + 32, 1, 5, SAGE);
  r(x + 13, top + 32, 1, 1, SAGE); r(x + 17, top + 36, 1, 1, SAGE);
  r(x + 5, BASE - 10, 19, 1, '#d6dab2'); r(x + 7, BASE - 9, 4, 1, '#7b8560');
  r(x + 3, top - 6, 14, 6, OUTLINE); r(x + 4, top - 5, 12, 4, '#304535');
  drawText(ctx, '3C', x + 5, top - 5, '#e0ddb0');
  if (on) {
    // A cook pulls the door ajar; the gap reveals actual cold-room shelves.
    r(x + 5, top + 5, 5, BASE - top - 11, '#304535');
    for (let y = top + 18; y < BASE - 8; y += 12) { r(x + 5, y, 5, 1, CREAM); r(x + 6, y - 4, 3, 4, '#c8a15e'); }
    r(x + 10, top + 5, 1, BASE - top - 11, CREAM);
  }
}

/** Wire shelving: flour sacks on the floor, tubs of sugar, jars and boxes above. */
function dryStore(ctx: Ctx, { x, w }: { x: number; w: number }, on: boolean): void {
  if (paintCozyKitchen(ctx, 'dryStore', x, BASE, w, 64, on)) return;
  const r = painter(ctx), top = 28;
  // Timber pantry with open, shadowed shelves and pegged uprights.
  r(x + 2, top, w - 4, BASE - top - 2, '#543425');
  for (const px of [x, x + w - 3]) { r(px, top - 2, 3, BASE - top + 2, OUTLINE); r(px, top - 1, 1, BASE - top, '#c98c4d'); }
  for (const y of [top + 2, top + 18, top + 34, BASE - 3]) {
    r(x, y, w, 3, OUTLINE); r(x + 1, y, w - 2, 1, '#c98c4d'); r(x + 1, y + 1, w - 2, 1, '#865332');
  }
  // Stitched bags with folded paper tops, taped boxes and hand-lettered labels.
  for (let i = 0; i < 3; i++) {
    const bx = x + 3 + i * 10;
    r(bx + 1, top - 8 + i % 2, 7, 2, '#865332'); r(bx, top - 6 + i % 2, 9, 8 - i % 2, '#c4a170');
    r(bx + 1, top - 5 + i % 2, 2, 6 - i % 2, '#e6c38e'); r(bx + 3, top - 3, 4, 3, CREAM);
    r(bx + 4, top - 2, 2, 1, '#865332');
  }
  for (let i = 0; i < 3; i++) {
    const bx = x + 4 + i * 10;
    r(bx, top + 7, 8, 11, OUTLINE); r(bx + 1, top + 8, 6, 9, CREAM);
    r(bx, top + 6, 8, 2, i % 2 ? '#aa5944' : SAGE); r(bx + 1, top + 6, 5, 1, '#d4be84');
    r(bx + 2, top + 12, 4, 3, '#bba576'); r(bx + 3, top + 13, 2, 1, '#543425');
  }
  for (let i = 0; i < 5; i++) {
    const bx = x + 4 + i * 6;
    r(bx, top + 26, 5, 8, OUTLINE); r(bx + 1, top + 27, 3, 6, '#b7c3a4');
    r(bx + 1, top + 30, 3, 3, i % 2 ? '#6d472f' : '#ad7d42');
    r(bx, top + 25, 5, 2, BRASS); r(bx + 1, top + 28, 1, 4, CREAM);
  }
  for (let i = 0; i < 2; i++) {
    const bx = x + 3 + i * 16;
    r(bx + 2, BASE - 19, 9, 2, OUTLINE); r(bx, BASE - 17, 14, 14, OUTLINE);
    r(bx + 1, BASE - 16, 12, 12, '#dcc89e'); r(bx + 2, BASE - 16, 2, 10, '#f4e6c7');
    r(bx + 10, BASE - 15, 2, 10, '#b39a6c'); r(bx + 4, BASE - 12, 6, 4, '#a77740');
    r(bx + 5, BASE - 11, 4, 1, CREAM);
  }
  if (on) { r(x + 4, top + 6, 8, 2, '#543425'); r(x + 5, top + 7, 6, 1, '#e1cc97'); r(x + 12, top + 11, 3, 2, BRASS); }
}

/** The hand-wash sink, with soap and paper towels: the first stop from storage to prep. */
function handSink(ctx: Ctx, { x, w }: { x: number; w: number }): void {
  if (paintCozyKitchen(ctx, 'handSink', x, BASE, w, 24)) return;
  const r = painter(ctx);
  // Thick ceramic basin with a scooped well and aged brass gooseneck.
  r(x, 55, w, 9, OUTLINE); r(x + 1, 55, w - 2, 2, '#fff3d9');
  r(x + 2, 57, w - 4, 4, '#798f79'); r(x + 3, 58, w - 6, 2, '#b7c3a4');
  r(x + 1, 61, w - 2, 2, CREAM); r(x + 3, 63, w - 6, 2, '#b7ad88');
  r(x + 7, 48, 2, 7, OUTLINE); r(x + 7, 48, 5, 2, OUTLINE); r(x + 8, 49, 3, 1, BRASS);
  r(x + 7, 65, 3, 9, OUTLINE); r(x + 8, 65, 1, 7, BRASS); r(x + 8, 72, 5, 2, OUTLINE);
  r(x + 1, 41, 5, 8, OUTLINE); r(x + 2, 42, 3, 6, '#a5b592'); r(x + 3, 38, 1, 4, BRASS); r(x + 2, 38, 4, 1, BRASS);
  r(x + 8, 34, 8, 12, OUTLINE); r(x + 9, 35, 6, 9, '#d9cfac');
  r(x + 10, 43, 4, 6, CREAM); r(x + 13, 44, 1, 5, '#c0ad87');
}

/** A spiral dough mixer: the hook turns in its bowl while a cook is mixing. */
function mixer(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  if (paintCozyKitchen(ctx, 'mixer', x, BASE, w, 38, on, t)) return;
  const r = painter(ctx);
  steelBox(ctx, x + 1, 66, w - 2, BASE - 66, ENAMEL);
  r(x + 4, BASE - 4, w - 8, 3, '#55606b');
  // Column and head.
  steelBox(ctx, x + w - 8, 46, 6, 20, ENAMEL);
  steelBox(ctx, x + 3, 46, w - 6, 8, ENAMEL);
  r(x + 4, 45, w - 9, 1, BRASS); r(x + 4, 47, 4, 1, CREAM);
  r(x + 6, 48, 4, 2, on ? '#b3ce75' : '#aa5944');
  r(x + w - 6, 57, 2, 5, BRASS); r(x + w - 5, 62, 3, 1, OUTLINE);
  r(x + 3, 70, w - 6, 7, SAGE); r(x + 4, 71, w - 8, 1, '#a6af8a');
  for (let i = 0; i < 4; i++) r(x + 5 + i * 3, 74, 1, 2, '#3f5437');
  // Bowl of dough, and the hook.
  r(x + 3, 56, w - 12, 10, OUTLINE);
  r(x + 4, 57, w - 14, 8, STEEL.base);
  r(x + 4, 57, w - 14, 2, '#f1e3c4');
  r(x + 5, 59, w - 16, 3, '#e8d2a6');
  const hx = x + 8 + (on ? Math.floor(t * 8) % 3 : 1) * 2;
  r(hx, 54, 2, 6, OUTLINE);
  r(hx + 1, 59, 2, 1, OUTLINE);
  r(x + 4, 65, w - 14, 1, '#68725a'); r(x + 5, 60, 1, 4, CREAM);
  r(x + 7, 82, 5, 1, '#878c71');
  if (on) { r(hx - 2, 58, 2, 1, CREAM); r(hx + 2, 60, 2, 1, '#bca170'); }
}

/** The proofing cabinet: warm and steamy, with dough rising on its trays. */
function proofer(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  if (paintCozyKitchen(ctx, 'proofer', x, BASE, w, 58, on, t)) return;
  const r = painter(ctx);
  const top = 26;
  steelBox(ctx, x, top, w, BASE - top, ENAMEL);
  r(x + 2, top + 7, w - 4, BASE - top - 13, OUTLINE);
  r(x + 3, top + 8, w - 6, BASE - top - 15, '#ffe6b0');
  for (let y = top + 14; y < BASE - 8; y += 11) {
    r(x + 3, y, w - 6, 1, STEEL.lo);
    for (let i = 0; i < 3; i++) {
      r(x + 4 + i * 6, y - 3, 5, 3, '#f3dfb6');
      r(x + 5 + i * 6, y - 4, 3, 1, '#f8ecd0');
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.35;
  r(x + 3, top + 8, w - 6, 6, '#ffffff');
  ctx.restore();
  r(x + 3, top + 2, 10, 4, '#1d2a22');
  r(x + 4, top + 3, 2, 2, '#ffb04a');
  r(x + 7, top + 3, 4, 2, '#8fe38a');
  r(x + w - 4, top + 20, 2, 10, BRASS);
  r(x + w - 4, top + 20, 1, 9, CREAM);
  for (const y of [top + 9, BASE - 12]) { r(x, y, 3, 4, '#865332'); r(x, y, 3, 1, BRASS); }
  glassReflection(ctx, x + 3, top + 8, w - 6, BASE - top - 15, 0.14);
  r(x + 5, BASE - 5, w - 10, 1, SAGE);
  if (on) {
    for (let i = 0; i < 3; i++) { const sx = x + 5 + i * 5; const sy = top + 10 + (Math.floor(t * 3) + i) % 4; r(sx, sy, 1, 3, CREAM); r(sx + 1, sy - 1, 1, 1, CREAM); }
    r(x + 4, top + 3, 2, 2, '#f7c46d');
  }
}

/** The extraction hood over the hot line, with its filters and lights. */
function hood(ctx: Ctx): void {
  if (paintCozyKitchen(ctx, 'hood', HOOD.x, 27, HOOD.w, 24)) return;
  const r = painter(ctx), { x, w } = HOOD;
  // Folded copper canopy widens downwards; seams lead into the filter cavity.
  r(x + 5, 10, w - 10, 3, OUTLINE); r(x + 6, 10, w - 12, 1, '#e0b678');
  for (let y = 13; y < 22; y++) {
    const inset = Math.max(0, 4 - Math.floor((y - 13) / 2));
    r(x + inset, y, w - inset * 2, 1, OUTLINE);
    r(x + inset + 1, y, w - inset * 2 - 2, 1, y < 17 ? '#bb8350' : '#926039');
  }
  for (let sx = x + 19; sx < x + w - 6; sx += 25) r(sx, 12, 1, 9, '#75482d');
  r(x - 1, 22, w + 2, 5, OUTLINE); r(x, 22, w, 1, BRASS); r(x + 1, 24, w - 2, 2, '#48503e');
  for (let fx = x + 4; fx < x + w - 6; fx += 5) r(fx, 24, 2, 2, '#a3ab84');
  r(x + w / 2 - 10, 5, 20, 5, OUTLINE); r(x + w / 2 - 9, 5, 18, 4, '#a87746');
  r(x + w / 2 - 8, 5, 2, 4, '#d6aa6f');
  r(x + 8, 26, 28, 1, '#ffebbb'); r(x + w - 36, 26, 28, 1, '#ffebbb');
  plaque(ctx, 'BAKE', x + w / 2, 15, '#627451');
}

/** A two-burner range with the big pot for boiling bagels and pretzels. */
function kettle(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  if (paintCozyKitchen(ctx, 'kettle', x, BASE, w, 38, on, t)) return;
  const r = painter(ctx);
  steelBox(ctx, x, 62, w, BASE - 62);
  r(x + 3, 68, w - 6, 10, OUTLINE);
  r(x + 4, 69, w - 8, 8, DARK_STEEL.base);
  r(x + 4, 69, w - 8, 1, DARK_STEEL.hi);
  for (let i = 0; i < 3; i++) r(x + 5 + i * 7, 64, 3, 2, OUTLINE);
  // The pot.
  r(x + 3, 44, w - 6, 18, OUTLINE);
  r(x + 4, 45, w - 8, 16, STEEL.base);
  r(x + 4, 45, 2, 16, STEEL.hi);
  r(x + 6, 46, 1, 14, '#d8d6b4'); r(x + w - 7, 48, 2, 12, '#77826c');
  r(x + 6, 59, w - 12, 2, BRASS); r(x + 7, 54, 4, 1, '#d8d6b4');
  r(x + 1, 47, 3, 2, OUTLINE);
  r(x + w - 4, 47, 3, 2, OUTLINE);
  r(x + 4, 45, w - 8, 2, on ? '#c9e6ee' : '#a9c4cc');
  if (on) for (let i = 0; i < 3; i++) if ((Math.floor(t * 6) + i) % 2) r(x + 7 + i * 5, 45, 2, 1, '#ffffff');
  // Flame under it.
  r(x + 6, 62, w - 12, 1, on ? '#ffac54' : '#6c4a3a');
  r(x + 5, 70, w - 10, 6, SAGE); r(x + 8, 72, 8, 1, BRASS);
  if (on) for (let i = 0; i < 3; i++) { const sy = 39 + (Math.floor(t * 4) + i) % 3; r(x + 6 + i * 6, sy, 1, 3, CREAM); r(x + 7 + i * 6, sy - 1, 1, 1, '#d7d6b6'); }
}

/** The deck oven: two stone decks, their windows glowing with loaves while a cook bakes. */
function deckOven(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  if (paintCozyKitchen(ctx, 'deckOven', x, BASE, w, 54, on, t)) return;
  const r = painter(ctx);
  const top = 32;
  steelBox(ctx, x, top, w, BASE - 8 - top, ENAMEL);
  r(x + 1, top, w - 2, 2, SAGE); r(x + 2, top, w - 4, 1, '#a6af8a');
  const flicker = Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
  const glow = mix('#5a3426', GLOW, on ? 0.85 + flicker : 0.25);
  for (const dy of [top + 4, top + 24]) {
    // Door, window and handle; the control panel on the right.
    r(x + 3, dy, w - 16, 18, OUTLINE);
    r(x + 4, dy + 1, w - 18, 16, DARK_STEEL.base);
    r(x + 7, dy + 4, w - 24, 8, OUTLINE);
    r(x + 8, dy + 5, w - 26, 6, glow);
    if (on) for (let i = 0; i < 3; i++) {
      r(x + 10 + i * 10, dy + 8, 7, 3, '#c98a45');
      r(x + 11 + i * 10, dy + 8, 5, 1, '#e3b36b');
    }
    r(x + 6, dy + 14, w - 22, 2, BRASS); r(x + 7, dy + 14, w - 24, 1, CREAM);
    r(x + 5, dy + 2, 2, 3, BRASS); r(x + 5, dy + 10, 2, 3, BRASS);
    r(x + 8, dy + 11, w - 26, 1, '#b58b54');
    if (!on) { r(x + 10, dy + 8, 7, 2, '#8f683f'); r(x + 22, dy + 8, 8, 2, '#8f683f'); }
    glassReflection(ctx, x + 8, dy + 5, w - 26, 6, 0.15);
    r(x + w - 11, dy + 1, 8, 16, '#3a3f45');
    r(x + w - 9, dy + 3, 4, 2, on ? '#ff6b3a' : '#7a3a2a');
    r(x + w - 9, dy + 8, 4, 4, STEEL.base);
    r(x + w - 8, dy + 9, 2, 1, OUTLINE);
  }
  // Legs on a stand.
  for (const lx of [x + 2, x + w - 5]) {
    r(lx - 1, BASE - 9, 5, 9, OUTLINE);
    r(lx, BASE - 8, 3, 8, STEEL.lo);
  }
  r(x + 4, BASE - 6, w - 8, 2, OUTLINE);
  r(x + 4, BASE - 6, w - 8, 1, STEEL.base);
}

/** A convection oven on a stand, its fan turning behind the glass while it bakes. */
function convection(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  if (paintCozyKitchen(ctx, 'convection', x, BASE, w, 48, on, t)) return;
  const r = painter(ctx);
  const top = 36;
  steelBox(ctx, x, top, w, 26, ENAMEL);
  r(x, top, w, 2, SAGE); r(x + 1, top, w - 2, 1, '#a6af8a');
  r(x + 3, top + 3, w - 12, 20, OUTLINE);
  const glow = mix('#3a2a26', '#ffcf7a', on ? 0.8 : 0.2);
  r(x + 4, top + 4, w - 14, 18, glow);
  for (const y of [top + 9, top + 15]) r(x + 4, y, w - 14, 1, DARK_STEEL.base);
  if (on) {
    r(x + 6, top + 6, 5, 3, '#e3b36b');
    r(x + 12, top + 12, 5, 3, '#e3b36b');
  }
  // The fan behind the glass.
  const fx = x + w / 2 - 4;
  const blade = on ? Math.floor(t * 10) % 2 : 0;
  r(fx - 2, top + 11 - blade, 1, 3 + blade * 2, mix(glow, OUTLINE, 0.5));
  r(fx - 3 + blade, top + 12, 3 - blade * 2 + 2, 1, mix(glow, OUTLINE, 0.5));
  r(x + w - 8, top + 3, 5, 20, '#3a3f45');
  r(x + w - 7, top + 5, 3, 3, on ? '#8fe38a' : '#4a5a4a');
  r(x + w - 7, top + 11, 3, 3, BRASS); r(x + w - 6, top + 11, 1, 2, CREAM);
  r(x + 2, top + 5, 2, 4, BRASS); r(x + 2, top + 16, 2, 4, BRASS);
  r(x + w - 12, top + 9, 2, 9, BRASS); r(x + w - 12, top + 9, 1, 8, CREAM);
  glassReflection(ctx, x + 4, top + 4, w - 14, 18, 0.12);
  // The stand, with sheet pans on its shelf.
  for (const lx of [x + 1, x + w - 4]) {
    r(lx - 1, top + 26, 4, BASE - top - 26, OUTLINE);
    r(lx, top + 26, 2, BASE - top - 26, STEEL.lo);
  }
  for (const y of [top + 34, BASE - 4]) {
    r(x + 2, y, w - 4, 2, OUTLINE);
    r(x + 3, y, w - 6, 1, STEEL.hi);
  }
}

/** The fryer for donuts, its oil shimmering and bubbling while a batch cooks. */
function fryer(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  if (paintCozyKitchen(ctx, 'fryer', x, BASE, w, 28, on, t)) return;
  const r = painter(ctx);
  steelBox(ctx, x, 58, w, BASE - 58);
  r(x + 2, 59, w - 4, 6, OUTLINE);
  r(x + 3, 60, w - 6, 4, on ? '#e8b64a' : '#c99a3e');
  if (on) for (let i = 0; i < 4; i++) if ((Math.floor(t * 8) + i * 3) % 4 === 0) r(x + 4 + i * 5, 60 + (i % 2), 2, 1, '#fff2c8');
  // Baskets hanging on the back rail.
  r(x + 1, 50, w - 2, 2, OUTLINE);
  for (const bx of [x + 3, x + w / 2 + 1]) {
    r(bx, 52, 9, 6, OUTLINE);
    for (let i = 1; i < 9; i += 2) r(bx + i, 53, 1, 4, STEEL.base);
  }
  r(x + 4, 70, w - 8, 8, STEEL.lo);
  r(x + w / 2 - 3, 73, 6, 2, BRASS);
  r(x + 5, 70, w - 10, 1, CREAM); r(x + 4, 78, w - 8, 2, SAGE);
  r(x + 5, 50, 2, 3, BRASS); r(x + w - 8, 50, 2, 3, BRASS);
  // Woven basket grids, dark doughnut holes and caramel edges read at 1x.
  for (const bx of [x + 3, x + w / 2 + 1]) { r(bx + 1, 54, 7, 1, CREAM); r(bx + 1, 56, 7, 1, '#7d876d'); }
  if (on) for (const bx of [x + 5, x + 15]) { r(bx, 60, 5, 3, '#d39847'); r(bx + 1, 60, 3, 1, '#f5cd7b'); r(bx + 2, 61, 1, 1, '#926239'); }
}

// ---------------------------------------------------------------- the floor

/**
 * The prep bench, painted with its front edge on `foot` and its middle at `cx`:
 * a steel worktop with a marble slab for pastry, the dough sheeter on its left end
 * and the stand mixer on its right when the menu needs them, and shelves of bowls
 * and trays below. Returns nothing; the bench is BENCH.w wide.
 */
export function paintBench(ctx: Ctx, cx: number, foot: number, sheeter: boolean, standMixer: boolean): void {
  const r = painter(ctx), { w, height, depth } = BENCH;
  const x = Math.round(cx - w / 2), front = foot - height, top = front - depth;
  if (paintCozyKitchen(ctx, 'bench', x, foot, w, height + depth)) {
    const source = generatedMainSource('cozy-kitchen-bench')!;
    const scale = Math.min(w / source.width, (height + depth) / source.height);
    const left = x + (w - source.width * scale) / 2, surface = foot - source.height * scale + 3;
    if (sheeter) paintCozyKitchen(ctx, 'sheeter', left + 3, surface, 24, 14);
    if (standMixer) paintCozyKitchen(ctx, 'standMixer', left + source.width * scale - 20, surface, 14, 18);
    return;
  }
  // Thick maple butcher block sits on a framed pantry island with open storage.
  r(x - 1, top - 1, w + 2, depth + 2, OUTLINE);
  r(x, top, w, depth, '#c99459'); r(x, top, w, 1, '#efd19b');
  for (let px = x + 4; px < x + w; px += 10) { r(px, top + 1, 1, depth - 2, '#ab713e'); r(px + 1, top + 1, 1, depth - 3, '#dca96b'); }
  r(x, front - 2, w, 2, '#865332'); r(x, front - 2, w, 1, '#e2b57b');
  r(x, front, w, height, OUTLINE); r(x + 1, front + 1, w - 2, height - 2, '#865332');
  cabinetPanel(ctx, x + 2, front + 2, 22, height - 3, '#865332', true);
  cabinetPanel(ctx, x + 80, front + 2, 22, height - 3, '#865332', true);
  r(x + 27, front + 2, 50, height - 4, '#543425'); r(x + 27, front + 7, 50, 1, '#c98c4d');
  for (let i = 0; i < 4; i++) {
    const bx = x + 29 + i * 12;
    r(bx, front + 3, 10, 2, CREAM); r(bx + 1, front + 5, 8, 2, '#a9b398');
    r(bx + 2, front + 6, 6, 1, '#69745f'); r(bx + 1, front + 3, 7, 1, '#fff1cf');
    r(bx, front + 9, 10, 2, '#a78e63'); r(bx + 1, front + 9, 8, 1, '#dac295');
  }
  r(x + 1, foot - 2, w - 2, 1, '#543425'); r(x + 3, foot - 1, 3, 1, OUTLINE); r(x + w - 6, foot - 1, 3, 1, OUTLINE);
  // Inset marble pastry slab: diagonal mineral veins, a scored dough ball,
  // turned rolling-pin handles, bench scraper and deliberately scattered flour.
  const sx = x + 28;
  r(sx - 1, top + 1, 42, depth - 3, '#7b735b'); r(sx, top + 2, 40, depth - 5, '#e9dfc5');
  for (let i = 0; i < 5; i++) { r(sx + i * 7, top + 3 + i % 3, 4, 1, '#b8b9a1'); r(sx + i * 7 + 3, top + 4 + i % 3, 2, 1, '#ccd0b4'); }
  r(sx + 8, top + 4, 10, 4, '#c7a06a'); r(sx + 9, top + 3, 8, 3, '#ebcfa0'); r(sx + 10, top + 3, 5, 1, '#fff0ce');
  r(sx + 11, top + 4, 1, 2, '#ae8756'); r(sx + 14, top + 4, 1, 2, '#ae8756');
  r(sx + 21, top + 5, 16, 2, OUTLINE); r(sx + 24, top + 4, 10, 4, '#bc854c'); r(sx + 24, top + 4, 10, 1, '#f0ca8e');
  r(sx + 2, top + 5, 3, 3, STEEL.base); r(sx + 2, top + 5, 3, 1, '#865332');
  r(sx + 6, top + 7, 1, 1, CREAM); r(sx + 19, top + 3, 1, 1, CREAM); r(sx + 18, top + 8, 2, 1, CREAM);
  // Analog scale with a raised pan and dial.
  r(x + 71, top + 2, 10, 6, OUTLINE); r(x + 72, top + 3, 8, 4, SAGE);
  r(x + 73, top + 1, 6, 2, STEEL.hi); r(x + 74, top + 4, 4, 2, CREAM); r(x + 76, top + 4, 1, 1, OUTLINE);
  if (sheeter) {
    const lx = SHEETER_X - BENCH.x + x;
    r(lx - 1, top - 4, 22, 7, OUTLINE); r(lx, top - 3, 20, 5, SAGE);
    r(lx + 1, top - 3, 18, 1, '#a6af8a'); r(lx + 1, top - 1, 18, 1, '#3f5437');
    r(lx + 1, top - 3, 8, 2, '#e8d2a6'); r(lx + 1, top - 3, 8, 1, CREAM);
    r(lx + 8, top - 8, 5, 7, OUTLINE); r(lx + 9, top - 7, 3, 5, ENAMEL.base);
    r(lx + 9, top - 7, 2, 1, CREAM); r(lx + 10, top - 5, 1, 1, '#aa5944');
    r(lx + 14, top - 5, 3, 3, BRASS); r(lx + 15, top - 4, 3, 1, OUTLINE);
    r(lx + 1, top + 2, 3, 1, OUTLINE); r(lx + 17, top + 2, 3, 1, OUTLINE);
  }
  if (standMixer) {
    const mx = STAND_MIXER_X - BENCH.x + x;
    // Open negative space under the rounded motor head and curved column.
    r(mx + 2, top - 14, 8, 1, OUTLINE); r(mx, top - 13, 12, 5, OUTLINE);
    r(mx + 1, top - 13, 10, 3, '#aa5944'); r(mx + 2, top - 13, 8, 1, '#dd9e78');
    r(mx + 9, top - 8, 3, 8, OUTLINE); r(mx + 9, top - 8, 2, 8, '#aa5944');
    r(mx + 4, top - 9, 1, 3, BRASS); r(mx + 1, top - 7, 7, 6, OUTLINE);
    r(mx + 2, top - 6, 5, 4, STEEL.base); r(mx + 2, top - 6, 5, 1, CREAM);
    r(mx + 2, top - 5, 1, 3, '#e6e4c8'); r(mx - 1, top, 14, 2, OUTLINE); r(mx, top, 12, 1, '#aa5944');
    r(mx + 8, top - 11, 2, 1, BRASS); r(mx + 15, top - 4, 3, 5, CREAM); r(mx + 16, top + 1, 1, 1, BRASS);
  }
}

/** Height above its feet that a floor piece reaches, for sizing its texture. */
export const BENCH_RISE = BENCH.height + BENCH.depth + 16;
export const RACK_RISE = 46;
export const FRIDGE_RISE = 38;
export const DISH_PIT_RISE = 38;
export const BINS_RISE = 20;

/** Rolling ingredient bins at the storage end, lids labelled for flour and sugar. */
export function paintBins(ctx: Ctx, x: number, foot: number): void {
  if (paintCozyKitchen(ctx, 'bins', x, foot, BINS.w, BINS_RISE)) return;
  const r = painter(ctx);
  const top = foot - BINS_RISE;
  for (const [i, label, lid] of [[0, 'F', '#627451'], [1, 'S', '#aa5944']] as const) {
    const bx = x + i * (BINS.w / 2);
    const w = BINS.w / 2 - 2;
    r(bx - 1, top + 3, w + 2, BINS_RISE - 3, OUTLINE);
    r(bx, top + 4, w, BINS_RISE - 6, '#f4f1ea');
    r(bx, top + 4, 2, BINS_RISE - 6, '#ffffff');
    r(bx + w - 2, top + 4, 2, BINS_RISE - 6, '#d9d6cc');
    r(bx - 1, top, w + 2, 5, OUTLINE);
    r(bx, top + 1, w, 3, lid);
    r(bx, top + 1, w, 1, mix(lid, '#ffffff', 0.35));
    r(bx + 4, top + 7, w - 8, 9, '#b49c73'); r(bx + 5, top + 8, w - 10, 7, CREAM);
    drawText(ctx, label, bx + w / 2 - 2, top + 8, '#543425');
    r(bx + 4, top + 2, w - 8, 1, BRASS); r(bx + w - 4, top + 7, 2, 4, '#c6b58d');
    r(bx + 3, foot - 4, 5, 1, '#d3c19c');
    for (const cx of [bx + 1, bx + w - 3]) r(cx, foot - 2, 3, 2, OUTLINE);
  }
}

/** The speed rack by the door, its trays holding the latest batches to cool. */
export function paintRack(ctx: Ctx, x: number, foot: number, items: readonly ItemId[]): void {
  if (paintCozyKitchen(ctx, 'rack', x, foot, RACK.w, RACK_RISE)) {
    const source = generatedMainSource('cozy-kitchen-rack')!;
    const scale = Math.min(RACK.w / source.width, RACK_RISE / source.height);
    const h = source.height * scale, top = foot - h;
    for (let i = 0; i < Math.min(items.length, 4); i++) {
      const icon = itemIcon(items[i], false), width = 8, height = icon.height * width / icon.width;
      for (let k = 0; k < 2; k++) ctx.drawImage(fineSpriteArt(icon).canvas, x + 3 + k * 8, top + h * (.135 + i * .225) - height, width, height);
    }
    return;
  }
  const r = painter(ctx);
  const { w } = RACK;
  const top = foot - RACK_RISE;
  for (const px of [x, x + w - 2]) {
    r(px - 1, top, 4, RACK_RISE, OUTLINE);
    r(px, top, 2, RACK_RISE - 2, STEEL.base);
    r(px, top, 1, RACK_RISE - 2, STEEL.hi);
  }
  for (let i = 0; i < 4; i++) {
    const y = top + 6 + i * 10;
    r(x + 1, y, w - 2, 2, OUTLINE);
    r(x + 2, y, w - 4, 1, '#c8a15e');
    r(x + 2, y + 1, w - 4, 1, '#9e7747'); r(x + 2, y - 1, 1, 1, CREAM);
    r(x + w - 3, y - 1, 1, 1, CREAM); r(x + 1, y + 2, w - 2, 1, '#69745f');
    const item = items[i];
    if (!item) continue;
    const icon = itemIcon(item, false);
    const art = fineSpriteArt(icon), width = Math.min(icon.width, 8);
    // Generated food keeps its source aspect in this narrow rack slot.
    const height = art.density > 1 ? icon.height * width / icon.width : icon.height;
    for (let k = 0; k < 2; k++) ctx.drawImage(art.canvas, x + 3 + k * 8, y - height + 1, width, height);
  }
  // Braced top rail, locking casters and a folded check cloth on one handle.
  r(x, top, w, 2, OUTLINE); r(x + 1, top, w - 2, 1, BRASS);
  r(x + 2, top + 1, 4, 4, CREAM); r(x + 3, top + 1, 1, 4, '#aa5944');
  for (const px of [x, x + w - 3]) { r(px, foot - 2, 3, 2, OUTLINE); r(px + 1, foot - 2, 1, 1, BRASS); }
}

/** The glass-fronted pastry fridge where cakes set, with a few on its shelves. */
export function paintPastryFridge(ctx: Ctx, x: number, foot: number, items: readonly ItemId[]): void {
  if (paintCozyKitchen(ctx, 'pastryFridge', x, foot, PASTRY_FRIDGE.w, FRIDGE_RISE)) {
    for (let i = 0; i < Math.min(items.length, 2); i++) {
      const icon = itemIcon(items[i], false);
      ctx.drawImage(fineSpriteArt(icon).canvas, x + PASTRY_FRIDGE.w / 2 - icon.width / 2,
        foot - FRIDGE_RISE + 16 + i * 10 - icon.height, icon.width, icon.height);
    }
    return;
  }
  const r = painter(ctx);
  const { w } = PASTRY_FRIDGE;
  const top = foot - FRIDGE_RISE;
  steelBox(ctx, x, top, w, FRIDGE_RISE - 1, ENAMEL);
  r(x + 2, top + 5, w - 4, FRIDGE_RISE - 12, OUTLINE);
  r(x + 3, top + 6, w - 6, FRIDGE_RISE - 14, '#dff1f5');
  for (const y of [top + 16, top + 26]) r(x + 3, y, w - 6, 1, STEEL.lo);
  for (let i = 0; i < Math.min(items.length, 2); i++) {
    const icon = itemIcon(items[i], false);
    ctx.drawImage(fineSpriteArt(icon).canvas, x + w / 2 - icon.width / 2, top + 16 + i * 10 - icon.height, icon.width, icon.height);
  }
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 10; i++) r(x + 5 + i * 0.6, top + 8 + i, 2, 1, '#ffffff');
  ctx.restore();
  r(x + 2, top + 1, 10, 3, '#1d2a22');
  r(x + 3, top + 2, 4, 1, '#8fe38a');
  r(x + w - 5, top + 12, 2, 10, BRASS); r(x + w - 5, top + 12, 1, 9, CREAM);
  r(x, top + 7, 3, 4, BRASS); r(x, top + 24, 3, 4, BRASS);
  r(x + 2, top + FRIDGE_RISE - 6, w - 4, 3, SAGE);
  for (let vx = x + 4; vx < x + w - 3; vx += 3) r(vx, top + FRIDGE_RISE - 5, 1, 2, OUTLINE);
  r(x + 3, top + 7, 1, FRIDGE_RISE - 15, CREAM);
}

/** The dish pit by the door: a three-bay sink with a sprayer, and a rack of clean plates. */
export function paintDishPit(ctx: Ctx, x: number, foot: number): void {
  if (paintCozyKitchen(ctx, 'dishPit', x, foot, DISH_PIT.w, DISH_PIT_RISE)) return;
  const r = painter(ctx);
  const { w } = DISH_PIT;
  const front = foot - 14;
  const top = front - 10;
  r(x - 1, top - 1, w + 2, foot - top + 1, OUTLINE);
  r(x, top, w, 10, STEEL.base);
  r(x, top, w, 1, STEEL.hi);
  for (let i = 0; i < 3; i++) {
    const bx = x + 3 + i * 14;
    r(bx, top + 2, 12, 6, DARK_STEEL.lo);
    r(bx + 1, top + 3, 10, 2, '#aabb9d');
    r(bx + 2, top + 3, 7, 1, '#e4e8c7'); r(bx + 5, top + 6, 2, 1, '#3f5437');
  }
  // Sprayer arm and faucet.
  r(x + 18, top - 14, 2, 14, OUTLINE);
  r(x + 18, top - 14, 8, 2, OUTLINE);
  r(x + 24, top - 12, 3, 4, OUTLINE);
  r(x + 25, top - 11, 1, 2, STEEL.hi);
  r(x + 18, top - 13, 1, 12, BRASS); r(x + 20, top - 14, 5, 1, BRASS);
  for (let sy = top - 11; sy < top - 2; sy += 3) r(x + 17, sy, 4, 1, '#c8a15e');
  // Drying rack with plates on end.
  const rx = x + 45;
  r(rx - 1, top - 9, 18, 11, OUTLINE);
  r(rx, top - 8, 16, 9, STEEL.lo);
  for (let i = 0; i < 5; i++) {
    r(rx + 1 + i * 3, top - 10, 2, 9, '#fdf6ec');
    r(rx + 1 + i * 3, top - 10, 2, 1, '#dccdb9');
  }
  r(x, front, w, foot - front, OUTLINE);
  for (let i = 0; i < 3; i++) cabinetPanel(ctx, x + 1 + i * 21, front + 1, 20, 12, SAGE, true);
  // A striped tea towel hangs from the rail and a brush waits by the basin.
  r(x + 5, front - 1, 12, 2, BRASS); r(x + 7, front, 7, 10, CREAM);
  for (let ty = front + 2; ty < front + 10; ty += 3) r(x + 7, ty, 7, 1, '#aa5944');
  r(x + 8, front + 10, 1, 1, CREAM); r(x + 12, front + 10, 1, 1, CREAM);
  r(x + 5, top - 2, 6, 2, '#865332'); r(x + 5, top, 6, 1, '#c8a15e');
  // A bin for scraps at the end.
  r(x + w - 2, foot - 16, 10, 16, OUTLINE);
  r(x + w - 1, foot - 15, 8, 14, SAGE);
  r(x + w - 1, foot - 15, 8, 2, '#a6af8a');
}
