// The kitchen's pixel art. The room (walls, floor and everything against the back
// wall) is baked into one layer; the pieces standing out on the floor are painted
// separately so cooks can walk in front of and behind them. Coordinates are local
// to the kitchen. Equipment the menu doesn't call for yet shows as a marked-out
// space with its hookups capped, so the plan of the room reads from day one.
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
import { FLOOR_Y, SCENE_W, floorY } from '../game/layout';
import { brushedMetal } from './materials';
import { mix, ramp } from './color';
import { drawText, textWidth } from './font';
import { OUTLINE, itemIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;

const STEEL = ramp('#b9c4cb');
const DARK_STEEL = ramp('#6f7880');
const TILE = '#eef0ea';
const GROUT = '#d2d8d2';
const NON_SLIP = ramp('#b9b2a6');
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
  const r = painter(ctx);
  for (let i = 0; i < w; i += 4) {
    r(x + i, y, 2, 1, '#9aa39c');
    r(x + i, y + h - 1, 2, 1, '#9aa39c');
  }
  for (let i = 0; i < h; i += 4) {
    r(x, y + i, 1, 2, '#9aa39c');
    r(x + w - 1, y + i, 1, 2, '#9aa39c');
  }
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
  drawText(ctx, word, x + 3, y + 1, '#fdf6ec');
}

// ---------------------------------------------------------------- the room

/**
 * The kitchen's walls, floor and the equipment against the back wall. `active`
 * stations have a cook at them: the ovens glow, the mixer turns, the oil bubbles.
 */
export function paintKitchen(ctx: Ctx, H: number, t: number, locked: boolean, installed: ReadonlySet<Equipment>, active: ReadonlySet<Station>): void {
  const r = painter(ctx);
  // White subway tile to the ceiling, with a steel skirting.
  r(0, 0, SCENE_W, FLOOR_Y, TILE);
  for (let y = 8; y < FLOOR_Y; y += 5) {
    r(0, y, SCENE_W, 1, GROUT);
    for (let x = (y / 5) % 2 ? 0 : 5; x < SCENE_W; x += 10) r(x, y + 1, 1, 4, GROUT);
  }
  r(0, 0, SCENE_W, 6, '#5d666e');
  r(0, 1, SCENE_W, 1, '#7c8790');
  r(0, 5, SCENE_W, 1, OUTLINE);
  r(0, FLOOR_Y - 4, SCENE_W, 4, DARK_STEEL.base);
  r(0, FLOOR_Y - 4, SCENE_W, 1, DARK_STEEL.hi);

  // Square non-slip tiles, grey and gritty, easy to mop.
  const top = FLOOR_Y;
  r(0, top, SCENE_W, H - top, NON_SLIP.base);
  for (let y = top; y < H; y += 12) {
    for (let x = 0; x < SCENE_W; x += 12) {
      if (((x + y - top) / 12) % 2) r(x, y, 12, 12, mix(NON_SLIP.base, NON_SLIP.lo, 0.18));
      r(x + 1, y + 1, 10, 1, mix(NON_SLIP.base, NON_SLIP.hi, 0.5));
      for (let k = 0; k < 3; k++) r(x + 2 + ((x + k * 5 + y) % 8), y + 3 + ((k * 7 + x) % 7), 1, 1, NON_SLIP.lo);
    }
    r(0, y, SCENE_W, 1, mix(NON_SLIP.lo, NON_SLIP.dark, 0.4));
  }
  for (let x = 0; x < SCENE_W; x += 12) r(x, top, 1, H - top, mix(NON_SLIP.lo, NON_SLIP.dark, 0.4));
  ctx.save();
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.18 - i * 0.05;
    r(0, FLOOR_Y + i, SCENE_W, 1, '#2a1410');
  }
  ctx.restore();
  // A drain in the middle of the floor, and rubber mats where the cooks stand all day.
  const drain = { x: 150, y: floorY(152) };
  r(drain.x - 6, drain.y - 3, 12, 6, OUTLINE);
  r(drain.x - 5, drain.y - 2, 10, 4, DARK_STEEL.base);
  for (let i = -4; i < 5; i += 2) r(drain.x + i, drain.y - 2, 1, 4, OUTLINE);
  for (const [x, w] of [[104, 54], [190, 118]] as const) mat(ctx, x, FLOOR_Y + 7, w, 10);

  // Tube lights.
  for (const x of [52, 196]) {
    r(x - 1, 6, 1, 3, OUTLINE);
    r(x + 41, 6, 1, 3, OUTLINE);
    r(x - 2, 9, 46, 4, OUTLINE);
    r(x - 1, 10, 44, 2, '#fbfbf2');
  }

  // Zone plaques: storage, prep, and the hot line under the hood.
  plaque(ctx, 'STORE', 62, 8, '#3f6f93');
  plaque(ctx, 'PREP', 120, 16, '#4f8a5b');

  const has = (e: Equipment) => installed.has(e);
  const at = (e: Equipment) => WALL_EQUIPMENT[e]!;
  cooler(ctx, at('cooler'));
  dryStore(ctx, at('dryStore'));
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
  fit('proofer', (s) => proofer(ctx, s), 58);
  hood(ctx);
  fit('kettle', (s) => kettle(ctx, s, t, active.has('kettle')), 38);
  fit('deckOven', (s) => deckOven(ctx, s, t, active.has('deckOven')), 54);
  fit('convection', (s) => convection(ctx, s, t, active.has('convection')), 48);
  fit('fryer', (s) => fryer(ctx, s, t, active.has('fryer')), 28);

  // Order tickets clipped to a rail by the door, so the cooks see what's running low.
  r(250, 30, 58, 2, OUTLINE);
  r(250, 30, 58, 1, STEEL.hi);
  for (const tx of [256, 271, 290]) {
    r(tx, 31, 8, 9, OUTLINE);
    r(tx + 1, 31, 6, 8, '#fdf6ec');
    for (let ly = 33; ly < 39; ly += 2) r(tx + 2, ly, 4, 1, '#9aa1aa');
  }

  if (locked) {
    // Still being fitted out: the floor plan is chalked on the floor, under dust sheets.
    ctx.save();
    ctx.globalAlpha = 0.25;
    r(0, 0, SCENE_W, H, '#584b38');
    ctx.restore();
    reserved(ctx, BENCH.x, floorY(BENCH.front) - BENCH.depth, BENCH.w, BENCH.depth);
    reserved(ctx, RACK.x, floorY(RACK.foot) - 8, RACK.w, 8);
    reserved(ctx, DISH_PIT.x, floorY(DISH_PIT.foot) - 10, DISH_PIT.w, 10);
  }
}

/** An anti-fatigue mat, black rubber with drainage holes. */
function mat(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const r = painter(ctx);
  r(x, y, w, h, '#3d3a3a');
  r(x, y, w, 1, '#5a5555');
  for (let hy = y + 2; hy < y + h - 1; hy += 3) {
    for (let hx = x + 1 + ((hy - y) % 2 ? 2 : 0); hx < x + w - 1; hx += 4) r(hx, hy, 2, 1, '#2a2727');
  }
}

/** The walk-in cold room's heavy door, with its thermometer and a frosted window. */
function cooler(ctx: Ctx, { x, w }: { x: number; w: number }): void {
  const r = painter(ctx);
  const top = 18;
  steelBox(ctx, x, top, w, BASE - top);
  r(x + 3, top + 3, w - 6, BASE - top - 6, STEEL.lo);
  r(x + 4, top + 4, w - 8, BASE - top - 8, STEEL.base);
  for (let y = top + 8; y < BASE - 6; y += 6) r(x + 5, y, w - 10, 1, mix(STEEL.base, STEEL.lo, 0.5));
  // Frosted window, a snowflake decal, the thermometer and the latch.
  r(x + 9, top + 8, w - 18, 12, OUTLINE);
  r(x + 10, top + 9, w - 20, 10, '#cfe6ee');
  r(x + 10, top + 9, w - 20, 2, '#f1fafc');
  const sx = x + w / 2;
  r(sx - 3, top + 26, 7, 1, '#5aa0c8');
  r(sx, top + 23, 1, 7, '#5aa0c8');
  r(sx - 2, top + 24, 1, 1, '#5aa0c8');
  r(sx + 2, top + 28, 1, 1, '#5aa0c8');
  r(sx + 2, top + 24, 1, 1, '#5aa0c8');
  r(sx - 2, top + 28, 1, 1, '#5aa0c8');
  r(x + 3, top - 6, 14, 6, OUTLINE);
  r(x + 4, top - 5, 12, 4, '#1d2a22');
  drawText(ctx, '3C', x + 5, top - 5, '#8fe38a');
  r(x + w - 8, top + 30, 5, 12, OUTLINE);
  r(x + w - 7, top + 31, 3, 10, DARK_STEEL.hi);
  r(x + w - 7, top + 31, 1, 10, '#f4f6f6');
}

/** Wire shelving: flour sacks on the floor, tubs of sugar, jars and boxes above. */
function dryStore(ctx: Ctx, { x, w }: { x: number; w: number }): void {
  const r = painter(ctx);
  const top = 28;
  for (const px of [x, x + w - 2]) {
    r(px - 1, top - 1, 4, BASE - top + 1, OUTLINE);
    r(px, top, 2, BASE - top, STEEL.base);
  }
  const shelves = [top + 2, top + 18, top + 34, BASE - 6];
  for (const y of shelves) {
    r(x, y, w, 2, OUTLINE);
    r(x + 1, y, w - 2, 1, STEEL.hi);
  }
  // Top: boxes.
  for (const [bx, bw, c] of [[x + 3, 12, '#c9a873'], [x + 16, 10, '#b98f5e'], [x + 27, 7, '#d6b98a']] as const) {
    r(bx, top - 8, bw, 10, OUTLINE);
    r(bx + 1, top - 7, bw - 2, 8, c);
    r(bx + 1, top - 7, bw - 2, 1, mix(c, '#ffffff', 0.3));
  }
  // Second: tubs of sugar and flour with labels.
  for (let i = 0; i < 3; i++) {
    const bx = x + 3 + i * 11;
    r(bx, top + 7, 9, 11, OUTLINE);
    r(bx + 1, top + 8, 7, 9, '#f4f1ea');
    r(bx + 1, top + 8, 7, 2, ['#d9574a', '#5a92d4', '#e7b84a'][i]);
  }
  // Third: jars of spice, cocoa and vanilla.
  for (let i = 0; i < 5; i++) {
    const bx = x + 3 + i * 6;
    r(bx, top + 26, 5, 8, OUTLINE);
    r(bx + 1, top + 27, 3, 6, '#d6ecf2');
    r(bx + 1, top + 29, 3, 4, ['#9c6538', '#6e3f24', '#c98f4e', '#6f9a52', '#d9a441'][i]);
    r(bx, top + 25, 5, 2, '#c97d34');
  }
  // Floor: sacks of flour.
  for (let i = 0; i < 2; i++) {
    const bx = x + 2 + i * 16;
    r(bx, BASE - 19, 15, 14, OUTLINE);
    r(bx + 1, BASE - 18, 13, 12, '#ece0c4');
    r(bx + 1, BASE - 18, 3, 12, '#f8f0dc');
    r(bx + 4, BASE - 14, 7, 4, '#c98f4e');
    r(bx + 3, BASE - 20, 9, 2, OUTLINE);
  }
}

/** The hand-wash sink, with soap and paper towels: the first stop from storage to prep. */
function handSink(ctx: Ctx, { x, w }: { x: number; w: number }): void {
  const r = painter(ctx);
  steelBox(ctx, x, 56, w, 7);
  r(x + 2, 57, w - 4, 3, DARK_STEEL.lo);
  r(x + w / 2 - 1, 50, 2, 7, OUTLINE);
  r(x + w / 2 - 1, 50, 5, 2, OUTLINE);
  r(x + w / 2, 51, 3, 1, STEEL.hi);
  r(x + w / 2 - 2, 63, 4, 14, OUTLINE);
  r(x + w / 2 - 1, 63, 2, 14, STEEL.lo);
  // Soap and the towel dispenser.
  r(x + 1, 38, 5, 9, OUTLINE);
  r(x + 2, 39, 3, 7, '#8fd0e8');
  r(x + 8, 34, 8, 12, OUTLINE);
  r(x + 9, 35, 6, 10, '#f4f1ea');
  r(x + 10, 45, 4, 3, '#f4f1ea');
}

/** A spiral dough mixer: the hook turns in its bowl while a cook is mixing. */
function mixer(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  const r = painter(ctx);
  steelBox(ctx, x + 1, 66, w - 2, BASE - 66, ramp('#e2e4de'));
  r(x + 4, BASE - 4, w - 8, 3, '#55606b');
  // Column and head.
  steelBox(ctx, x + w - 8, 46, 6, 20, ramp('#e2e4de'));
  steelBox(ctx, x + 3, 46, w - 6, 8, ramp('#e2e4de'));
  r(x + 6, 48, 4, 2, on ? '#7fe36a' : '#e2434b');
  // Bowl of dough, and the hook.
  r(x + 3, 56, w - 12, 10, OUTLINE);
  r(x + 4, 57, w - 14, 8, STEEL.base);
  r(x + 4, 57, w - 14, 2, '#f1e3c4');
  r(x + 5, 59, w - 16, 3, '#e8d2a6');
  const hx = x + 8 + (on ? Math.floor(t * 8) % 3 : 1) * 2;
  r(hx, 54, 2, 6, OUTLINE);
  r(hx + 1, 59, 2, 1, OUTLINE);
}

/** The proofing cabinet: warm and steamy, with dough rising on its trays. */
function proofer(ctx: Ctx, { x, w }: { x: number; w: number }): void {
  const r = painter(ctx);
  const top = 26;
  steelBox(ctx, x, top, w, BASE - top);
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
  r(x + w - 4, top + 20, 2, 10, DARK_STEEL.dark);
}

/** The extraction hood over the hot line, with its filters and lights. */
function hood(ctx: Ctx): void {
  const r = painter(ctx);
  const { x, w } = HOOD;
  r(x - 1, 10, w + 2, 17, OUTLINE);
  r(x, 11, w, 15, STEEL.base);
  r(x, 11, w, 1, STEEL.hi);
  r(x, 24, w, 2, STEEL.lo);
  for (let fx = x + 4; fx < x + w - 10; fx += 12) {
    r(fx, 14, 10, 8, DARK_STEEL.base);
    for (let i = 0; i < 10; i += 2) r(fx + i, 14, 1, 8, DARK_STEEL.lo);
  }
  // Duct up through the ceiling, and the strip of light underneath.
  r(x + w / 2 - 10, 5, 20, 6, OUTLINE);
  r(x + w / 2 - 9, 5, 18, 5, STEEL.lo);
  r(x + 2, 26, w - 4, 1, '#ffe9b0');
  plaque(ctx, 'BAKE', x + w / 2, 15, '#b5453a');
}

/** A two-burner range with the big pot for boiling bagels and pretzels. */
function kettle(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
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
  r(x + 1, 47, 3, 2, OUTLINE);
  r(x + w - 4, 47, 3, 2, OUTLINE);
  r(x + 4, 45, w - 8, 2, on ? '#c9e6ee' : '#a9c4cc');
  if (on) for (let i = 0; i < 3; i++) if ((Math.floor(t * 6) + i) % 2) r(x + 7 + i * 5, 45, 2, 1, '#ffffff');
  // Flame under it.
  r(x + 6, 62, w - 12, 1, on ? '#ff8a3a' : '#6c4a3a');
}

/** The deck oven: two stone decks, their windows glowing with loaves while a cook bakes. */
function deckOven(ctx: Ctx, { x, w }: { x: number; w: number }, t: number, on: boolean): void {
  const r = painter(ctx);
  const top = 32;
  steelBox(ctx, x, top, w, BASE - 8 - top);
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
    r(x + 6, dy + 14, w - 22, 2, STEEL.hi);
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
  const r = painter(ctx);
  const top = 36;
  steelBox(ctx, x, top, w, 26);
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
  r(x + w - 7, top + 11, 3, 3, STEEL.base);
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
  r(x + w / 2 - 3, 73, 6, 2, OUTLINE);
}

// ---------------------------------------------------------------- the floor

/**
 * The prep bench, painted with its front edge on `foot` and its middle at `cx`:
 * a steel worktop with a marble slab for pastry, the dough sheeter on its left end
 * and the stand mixer on its right when the menu needs them, and shelves of bowls
 * and trays below. Returns nothing; the bench is BENCH.w wide.
 */
export function paintBench(ctx: Ctx, cx: number, foot: number, sheeter: boolean, standMixer: boolean): void {
  const r = painter(ctx);
  const { w, height, depth } = BENCH;
  const x = Math.round(cx - w / 2);
  const front = foot - height;
  const top = front - depth;
  r(x - 1, top - 1, w + 2, foot - top + 1, OUTLINE);
  r(x, top, w, depth, STEEL.base);
  r(x, top, w, 1, STEEL.lo);
  r(x, front - 2, w, 1, STEEL.hi);
  r(x, front - 1, w, 1, STEEL.lo);
  // Marble slab in the middle, dusted with flour, a ball of dough and a rolling pin.
  const sx = x + 28;
  r(sx, top + 2, 40, depth - 5, '#eeeae2');
  for (let i = 0; i < 40; i += 7) r(sx + i, top + 3 + (i % 3), 3, 1, '#d6d0c4');
  r(sx + 8, top + 3, 9, 4, '#e8d2a6');
  r(sx + 9, top + 3, 7, 1, '#f4e6c4');
  r(sx + 22, top + 5, 14, 2, OUTLINE);
  r(sx + 23, top + 5, 12, 1, '#c98f4e');
  // A scale.
  r(x + 72, top + 2, 8, 5, OUTLINE);
  r(x + 73, top + 3, 6, 3, '#e2e4de');
  r(x + 74, top + 4, 3, 1, '#1d2a22');
  // Front: open shelves of mixing bowls and sheet pans.
  r(x, front, w, height, STEEL.lo);
  r(x + 2, front + 2, w - 4, height - 4, DARK_STEEL.lo);
  r(x + 2, front + 7, w - 4, 1, STEEL.base);
  for (let i = 0; i < 6; i++) {
    const bx = x + 6 + i * 16;
    r(bx, front + 3, 10, 4, STEEL.base);
    r(bx + 1, front + 3, 8, 1, STEEL.hi);
  }
  for (let i = 0; i < w - 8; i += 3) r(x + 4 + i, front + 9, 2, 2, STEEL.base);
  r(x, foot - 1, w, 1, OUTLINE);
  for (const lx of [x + 1, x + w - 3]) r(lx, front, 2, height, STEEL.base);

  if (sheeter) {
    // A dough sheeter: two belts either side of the rollers, a sheet of laminated dough on it.
    const lx = SHEETER_X - BENCH.x + x;
    r(lx - 1, top - 4, 22, 7, OUTLINE);
    r(lx, top - 3, 20, 5, '#5b6470');
    r(lx + 1, top - 3, 8, 1, '#f1e3c4');
    r(lx + 1, top - 2, 8, 1, '#e8d2a6');
    r(lx + 8, top - 8, 5, 6, OUTLINE);
    r(lx + 9, top - 7, 3, 4, '#e2e4de');
    r(lx + 10, top - 6, 1, 1, '#d9384a');
  }
  if (standMixer) {
    // A stand mixer with its bowl of batter, and a piping bag beside it.
    const mx = STAND_MIXER_X - BENCH.x + x;
    r(mx - 1, top - 14, 14, 16, OUTLINE);
    r(mx, top - 13, 12, 4, '#e26a7a');
    r(mx + 8, top - 13, 4, 14, '#e26a7a');
    r(mx, top - 13, 12, 1, '#f39aa6');
    r(mx + 1, top - 8, 7, 7, OUTLINE);
    r(mx + 2, top - 7, 5, 5, STEEL.base);
    r(mx + 2, top - 7, 5, 1, '#fdf2e0');
    r(mx - 1, top, 14, 2, '#b84a5a');
    r(mx + 15, top - 4, 3, 6, OUTLINE);
    r(mx + 16, top - 3, 1, 4, '#f4f1ea');
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
  const r = painter(ctx);
  const top = foot - BINS_RISE;
  for (const [i, label, lid] of [[0, 'F', '#5a92d4'], [1, 'S', '#d9574a']] as const) {
    const bx = x + i * (BINS.w / 2);
    const w = BINS.w / 2 - 2;
    r(bx - 1, top + 3, w + 2, BINS_RISE - 3, OUTLINE);
    r(bx, top + 4, w, BINS_RISE - 6, '#f4f1ea');
    r(bx, top + 4, 2, BINS_RISE - 6, '#ffffff');
    r(bx + w - 2, top + 4, 2, BINS_RISE - 6, '#d9d6cc');
    r(bx - 1, top, w + 2, 5, OUTLINE);
    r(bx, top + 1, w, 3, lid);
    r(bx, top + 1, w, 1, mix(lid, '#ffffff', 0.35));
    drawText(ctx, label, bx + w / 2 - 2, top + 8, '#7a6a58');
    for (const cx of [bx + 1, bx + w - 3]) r(cx, foot - 2, 3, 2, OUTLINE);
  }
}

/** The speed rack by the door, its trays holding the latest batches to cool. */
export function paintRack(ctx: Ctx, x: number, foot: number, items: readonly ItemId[]): void {
  const r = painter(ctx);
  const { w } = RACK;
  const top = foot - RACK_RISE;
  for (const px of [x, x + w - 2]) {
    r(px - 1, top - 1, 4, RACK_RISE + 1, OUTLINE);
    r(px, top, 2, RACK_RISE - 2, STEEL.base);
    r(px, top, 1, RACK_RISE - 2, STEEL.hi);
  }
  for (let i = 0; i < 4; i++) {
    const y = top + 6 + i * 10;
    r(x + 1, y, w - 2, 2, OUTLINE);
    r(x + 2, y, w - 4, 1, '#d7a35a');
    const item = items[i];
    if (!item) continue;
    const icon = itemIcon(item, false);
    for (let k = 0; k < 2; k++) ctx.drawImage(icon, x + 3 + k * 8, y - icon.height + 1, Math.min(icon.width, 8), icon.height);
  }
  // Casters.
  for (const px of [x, x + w - 3]) r(px, foot - 2, 3, 2, OUTLINE);
}

/** The glass-fronted pastry fridge where cakes set, with a few on its shelves. */
export function paintPastryFridge(ctx: Ctx, x: number, foot: number, items: readonly ItemId[]): void {
  const r = painter(ctx);
  const { w } = PASTRY_FRIDGE;
  const top = foot - FRIDGE_RISE;
  steelBox(ctx, x, top, w, FRIDGE_RISE - 1, ramp('#e2e4de'));
  r(x + 2, top + 5, w - 4, FRIDGE_RISE - 12, OUTLINE);
  r(x + 3, top + 6, w - 6, FRIDGE_RISE - 14, '#dff1f5');
  for (const y of [top + 16, top + 26]) r(x + 3, y, w - 6, 1, STEEL.lo);
  items.slice(0, 2).forEach((item, i) => {
    const icon = itemIcon(item, false);
    ctx.drawImage(icon, x + w / 2 - icon.width / 2, top + 16 + i * 10 - icon.height);
  });
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 10; i++) r(x + 5 + i * 0.6, top + 8 + i, 2, 1, '#ffffff');
  ctx.restore();
  r(x + 2, top + 1, 10, 3, '#1d2a22');
  r(x + 3, top + 2, 4, 1, '#8fe38a');
  r(x + w - 5, top + 12, 2, 10, DARK_STEEL.dark);
}

/** The dish pit by the door: a three-bay sink with a sprayer, and a rack of clean plates. */
export function paintDishPit(ctx: Ctx, x: number, foot: number): void {
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
    r(bx + 1, top + 3, 10, 2, '#9fc7d6');
  }
  // Sprayer arm and faucet.
  r(x + 18, top - 14, 2, 14, OUTLINE);
  r(x + 18, top - 14, 8, 2, OUTLINE);
  r(x + 24, top - 12, 3, 4, OUTLINE);
  r(x + 25, top - 11, 1, 2, STEEL.hi);
  // Drying rack with plates on end.
  const rx = x + 45;
  r(rx - 1, top - 9, 18, 11, OUTLINE);
  r(rx, top - 8, 16, 9, STEEL.lo);
  for (let i = 0; i < 5; i++) {
    r(rx + 1 + i * 3, top - 10, 2, 9, '#fdf6ec');
    r(rx + 1 + i * 3, top - 10, 2, 1, '#dccdb9');
  }
  r(x, front, w, foot - front, STEEL.lo);
  r(x + 2, front + 2, w - 4, foot - front - 4, STEEL.base);
  r(x + w / 3, front + 2, 1, foot - front - 4, OUTLINE);
  r(x + (w * 2) / 3, front + 2, 1, foot - front - 4, OUTLINE);
  // A bin for scraps at the end.
  r(x + w - 2, foot - 16, 10, 16, OUTLINE);
  r(x + w - 1, foot - 15, 8, 14, '#4f8a5b');
  r(x + w - 1, foot - 15, 8, 2, '#6fae7a');
}
