// Canvas painters for the parts of a room that are baked into textures: the main
// café's back wall, floor, back bar and counter, the front wall along the bottom
// edge, and the props (tables, chairs, crates) that the Phaser scene places.
import { isDrink } from '../game/data';
import { menuItems } from '../game/economy';
import {
  BACK_BAR,
  BAR_AISLE,
  COUNTER,
  COUNTER_GATE,
  COUNTER_RETURN,
  DOOR_W,
  DOOR_X,
  FLOOR_Y,
  PASS,
  PASS_COLUMNS,
  PASS_SLOT_W,
  PASTRY_CASE,
  SCENE_W,
  WINDOWS,
  baristaSpot,
  passageY,
} from '../game/layout';
import type { GameState } from '../game/state';
import { paintPassageFloor } from './passages';
import { glassReflection, treeLine } from './materials';
import { mix, ramp } from './color';
import { counterColors, grain, paintCounter, paintFloor, paintRug, paintRunner, paintWainscot, paintWall, shadow, wainscotColor } from './decor-art';
import { drawText, textWidth } from './font';
import { beam, type Lighting, type Sun } from './lighting';
import { OUTLINE, itemIcon, pixelSprite } from './sprites';

const WOOD = ramp('#8a5a3c');

/** Draws `text` with the bitmap font at 2x for signs and headings. */
function bigText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string, outline?: string): void {
  const tmp = document.createElement('canvas');
  tmp.width = textWidth(text) + 2;
  tmp.height = 7;
  drawText(tmp.getContext('2d')!, text, 1, 1, color, outline);
  ctx.drawImage(tmp, Math.round(cx - tmp.width), y, tmp.width * 2, tmp.height * 2);
}

const ESPRESSO = [
  '..wwww..wwww..wwww............',
  '..wWWw..wWWw..wWWw............',
  '.XXXXXXXXXXXXXXXXXXXXXXXXXXXX.',
  '.CCCCCCCCCCCCCCCCCCCCCCCCCCCc.',
  '.cccccccccccccccccccccccccccc.',
  '.LLLLLLLLLLLLLLLLLLLLLLLLLLLb.',
  '.LBBBBBBBBBBBBBBBBBBBBBBBBBBb.',
  '.LBBBBBBBBBBkkkkkkBBBBBBBBBBb.',
  '.LBBBBBBBBBkggggggkBBBBBBBBBb.',
  '.LBBBBBBBBBkgggrggkBBBBBBBBBb.',
  '.LBBBBBBBBBkggrgggkBBBBBBBBBb.',
  '.LBBBBBBBBBBkkkkkkBBBBBBBBBBb.',
  '.LBBBBBBBBBBBBBBBBBBBBBBBBBBb.',
  '.bbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
  '.DDDDDDDDDDDDDDDDDDDDDDDDDDDD.',
  '.DDDCCCCDDDDDDDDDDDDDCCCCDDDD.',
  '.nkkkCCknnnnnnnnnnnnkkkCCknnn.',
  '.nnnnccnnnnnnnnnnnnnnnnccnnnn.',
  '.nnnnnnnnnnnnnnnnnnnnnnnnnnnn.',
  '.nnnwwwwnnnnnnnnnnnnnwwwwnnnn.',
  '.nnnwWWwnnnnnnnnnnnnnwWWwnnnn.',
  '.nnnWWWWnnnnnnnnnnnnnWWWWnnnn.',
  '.XXXXXXXXXXXXXXXXXXXXXXXXXXXX.',
  '.ccXcXcXcXcXcXcXcXcXcXcXcXccc.',
  '..cccccccccccccccccccccccccc..',
];
const machineCache = new Map<string, HTMLCanvasElement>();
function espressoMachine(finish: string): HTMLCanvasElement {
  let c = machineCache.get(finish);
  if (!c) {
    const body = ramp(finish);
    const chrome = ramp('#c9d3d8');
    c = pixelSprite(ESPRESSO, {
      B: body.base, b: body.lo, L: body.hi, D: body.dark,
      C: chrome.base, c: chrome.lo, X: chrome.hi,
      k: '#3a2a2a', n: '#4a3434', g: '#fdf6ec', r: '#d9384a', w: '#fdf6ec', W: '#dccdb9',
    });
    machineCache.set(finish, c);
  }
  return c;
}

/** How much of the front wall's top shows along the bottom edge. */
const FRONT_WALL = 7;

/** Where the espresso machine stands, at the left end of the counter. */
export const MACHINE_X = COUNTER_RETURN.x + COUNTER_RETURN.w + 8;
export const MACHINE_Y = COUNTER.top - 17;

const lazy = (make: () => HTMLCanvasElement) => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= make());
};

/** Burr grinder on the back bar, its hopper full of beans. */
const GRINDER = lazy(() =>
  pixelSprite(
    [
      '..gggggg..', '..gbBbbg..', '..gbbBbg..', '..gbbbbg..', '...gbbg...', '....mm....',
      '..MMMMMM..', '..MmmmmK..', '..MmrrmK..', '..MmmmmK..', '..MKKKKK..', '...k..k...',
      '..........', '.MMMMMMMM.', '.KKKKKKKK.',
    ],
    { g: '#d6ecf2', b: '#6e3f24', B: '#9c6538', M: '#5d6672', m: '#7c8794', K: '#3f4650', k: '#2a2a30', r: '#d9574a' },
  ),
);

/** A layer cake under a glass dome. */
const CAKE_DOME = lazy(() =>
  pixelSprite(
    [
      '.......kk.......', '......dkkd......', '....ddggggdd....', '...dWgggggggd...', '..dWgggggggggd..',
      '..dWggrgrggrgd..', '.dWggPPPPPPPggd.', '.dWggpppppppggd.', '.dgggcccccccggd.', '.dgggPPPPPPPggd.',
      '.dgggpppppppggd.', '.ssssssssssssss.', '......SSSS......', '....SSSSSSSS....',
    ],
    {
      k: '#c9d3d8', d: '#9fc3cf', g: '#e4f3f6', W: '#ffffff', r: '#e2434b',
      P: '#f6b3c4', p: '#ef8fa8', c: '#fdf6ec', s: '#e8edf0', S: '#b9c4cb',
    },
  ),
);

// A bistro chair seen from the side, facing right: a ladder back, a cushion and splayed legs.
const CHAIR_ROWS = [
  '.wWw.........', 'wWWwd........', 'wWwwd........', 'wWddd........', 'wWwwd........', 'wWwwd........',
  'wWddd........', 'wWwwd........', 'wWwwd........', 'wWddd........', 'wW.wd........', 'wW.wd........',
  'wW.wd........', 'wW.wd........', 'wW.wd........', 'wWcCCCCCCCCc.', 'wWccccccccccc', 'wwkkkkkkkkkkk',
  'dWwwwwwwwwwwd', '.wd..d....dw.', '.wd..d....dw.', '.wdddddddddw.', '.w..d......w.', '.d.........d.',
];
const CHAIR_PALETTE = { w: '#8a5a3c', W: '#b07a4a', d: '#5f3a25', c: '#7fae8a', C: '#a6cfae', k: '#5d8a6a' };
export const CHAIR_RIGHT = lazy(() => pixelSprite(CHAIR_ROWS, CHAIR_PALETTE));
export const CHAIR_LEFT = lazy(() => pixelSprite(CHAIR_ROWS.map((r) => [...r].reverse().join('')), CHAIR_PALETTE));

/** Gingham tablecloth colors: [lit top, drape, drape edge] x [white, stripe, crossing]. */
const GINGHAM = [
  ['#fbf3e6', '#ef9c8f', '#d9675d'],
  ['#e0cbb6', '#cf776d', '#b14c46'],
  ['#c9b29d', '#b25f5a', '#93403d'],
];
const TABLE_RX = 14;
const TABLE_RY = 6;
const TABLE_DROP = 6;
/** The table sprite's center column, and how far the middle of the top sits above the feet. */
export const TABLE_CX = TABLE_RX + 2;
export const TABLE_TOP_DY = 19;

/** A round bistro table under a gingham cloth, on an iron pedestal. */
export const TABLE = lazy(() => {
  const RX = TABLE_RX;
  const RY = TABLE_RY;
  const DROP = TABLE_DROP;
  const c = document.createElement('canvas');
  c.width = TABLE_CX * 2 + 1;
  c.height = TABLE_TOP_DY + RY + 2;
  const ctx = c.getContext('2d')!;
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const cx = TABLE_CX;
  const foot = c.height - 1;
  const cy = foot - TABLE_TOP_DY;
  const hem = cy + RY + DROP;
  // Pedestal and a round foot peeking out under the cloth.
  const iron = ramp('#4a3a36');
  r(cx - 2, hem, 5, foot - hem - 1, OUTLINE);
  r(cx - 1, hem, 3, foot - hem - 1, iron.base);
  r(cx - 1, hem, 1, foot - hem - 1, iron.hi);
  r(cx - 7, foot - 2, 15, 3, OUTLINE);
  r(cx - 6, foot - 2, 13, 1, iron.hi);
  r(cx - 6, foot - 1, 13, 1, iron.base);
  const half = (dy: number) => Math.round(Math.sqrt(Math.max(0, 1 - (dy / RY) ** 2)) * RX);
  const check = (x: number, y: number, shade: number) =>
    GINGHAM[shade][(Math.floor((x - cx + 64) / 2) % 2) + (Math.floor(y / 2) % 2)];
  // Outline: the top ellipse, the sides and the hem.
  for (let dy = -RY - 1; dy <= RY + 1; dy++) {
    const h = Math.round(Math.sqrt(Math.max(0, 1 - (dy / (RY + 1)) ** 2)) * (RX + 1));
    r(cx - h, cy + dy, h * 2 + 1, 1, OUTLINE);
  }
  r(cx - RX - 1, cy, RX * 2 + 3, DROP + 1, OUTLINE);
  for (let dy = 0; dy <= RY; dy++) {
    const h = half(dy) + 1;
    r(cx - h, cy + dy + DROP + 1, h * 2 + 1, 1, OUTLINE);
  }
  // The drape: the front half of the ellipse pushed down, in shade, darker at the sides.
  for (let dy = 0; dy <= RY; dy++) {
    const h = half(dy);
    for (let y = cy + dy; y <= cy + dy + DROP; y++) {
      for (let x = cx - h; x <= cx + h; x++) r(x, y, 1, 1, check(x, y, Math.abs(x - cx) > RX - 4 ? 2 : 1));
    }
  }
  // Scalloped hem.
  for (let x = cx - RX; x <= cx + RX; x++) {
    const dy = Math.round(Math.sqrt(Math.max(0, 1 - ((x - cx) / RX) ** 2)) * RY);
    if ((x - cx + 64) % 3 === 0) r(x, cy + dy + DROP, 1, 1, OUTLINE);
  }
  // The flat top, lit from above, with a soft sheen.
  for (let dy = -RY; dy <= RY; dy++) {
    const h = half(dy);
    for (let x = cx - h; x <= cx + h; x++) r(x, cy + dy, 1, 1, check(x, cy + dy, 0));
  }
  // A crease where the cloth folds over the edge.
  for (let x = cx - RX + 1; x <= cx + RX - 1; x++) {
    const dy = Math.round(Math.sqrt(Math.max(0, 1 - ((x - cx) / RX) ** 2)) * RY);
    r(x, cy + dy + 1, 1, 1, check(x, cy + dy + 1, 2));
  }
  r(cx - 8, cy - RY, 6, 1, '#ffffff');
  r(cx - 11, cy - RY + 1, 3, 1, '#ffffff');
  return c;
});

/**
 * A shaft of sunlight on the floor through an opening from x0 to x1 at y, slanting
 * by `lean` over `length` (negative to fall upward, from the front of the room).
 */
export function paintSunbeam(ctx: CanvasRenderingContext2D, sun: Sun, x0: number, x1: number, y: number, lean: number, length: number): void {
  if (sun.elevation <= 0 || sun.strength <= 0.02) return;
  ctx.save();
  ctx.fillStyle = sun.color;
  // Four panes, with the frame's shadow between them. Light disperses and
  // fades along its reach rather than ending in one hard rectangle.
  const width = x1 - x0;
  const reach = Math.max(1, Math.abs(length));
  for (let step = 0; step < reach; step++) {
    const p = step / reach;
    ctx.globalAlpha = 0.22 * sun.strength * (1 - p * 0.85);
    for (let pane = 0; pane < 2; pane++) {
      const start = x0 + pane * width / 2 + lean * p;
      ctx.fillRect(Math.round(start + 1), Math.round(y + Math.sign(length) * step), Math.max(1, Math.round(width / 2 - 3)), 1);
    }
  }
  ctx.restore();
}

/** A brewing barista's cup on the counter: where it stands and how full it is. */
export interface CounterCup {
  x: number;
  fill: number;
}

/** Paints a room's baked layers into a canvas whose top-left is the room's top-left. */
export class RoomPainter {
  /** How far the kitchen door has swung open, 0 to 1. */
  kitchenDoor = 0;

  constructor(readonly ctx: CanvasRenderingContext2D) {}

  private r(x: number, y: number, w: number, h: number, color: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  drawWall(wallpaper: string, t: number): void {
    paintWall(this.ctx, wallpaper, 0, 6, SCENE_W, 54, t);
    // Ceiling beam.
    this.r(0, 0, SCENE_W, 6, WOOD.lo);
    this.r(0, 1, SCENE_W, 1, WOOD.base);
    this.r(0, 4, SCENE_W, 1, WOOD.base);
    this.r(0, 5, SCENE_W, 1, OUTLINE);
    paintWainscot(this.ctx, wallpaper, 0, 61, SCENE_W, 15);
    // Baseboard.
    this.r(0, 76, SCENE_W, 4, WOOD.dark);
    this.r(0, 76, SCENE_W, 1, WOOD.base);
  }

  /** A window onto the street; `sign` hangs the OPEN (true) or CLOSED (false) sign in it. */
  drawWindow(win: { x: number; y: number; w: number; h: number }, light: Lighting, t: number, sign: boolean | null): void {
    const { x, y, w, h } = win;
    const night = light.dark > 0.6;
    const bands = light.sky;
    const frame = ramp('#9a6740');
    this.r(x - 4, y - 4, w + 8, h + 8, OUTLINE);
    this.r(x - 3, y - 3, w + 6, h + 6, frame.base);
    this.r(x - 3, y - 3, w + 6, 1, frame.hi);
    bands.forEach((c, i) => this.r(x, y + (i * h) / 3, w, h / 3 + 1, c));
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (night) {
      const stars = [[4, 4], [15, 9], [27, 3], [38, 11], [9, 16], [33, 20], [21, 14], [46, 6]];
      stars.forEach(([sx, sy], i) => {
        if ((Math.floor(t * 1.5) + i) % 4 !== 0) this.r(x + sx, y + sy, 1, 1, '#fff6c8');
      });
      this.r(x + 38, y + 4, 6, 6, '#f6eec2');
      this.r(x + 40, y + 4, 5, 5, bands[0]);
    } else {
      // The sun crosses the window and sinks behind the hills.
      const { sun } = light;
      if (sun.elevation > 0) this.r(x + 2 + sun.x * (w - 10), y + 3 + (1 - sun.elevation) * (h - 14), 6, 6, sun.disc);
      for (const [offset, cy] of [[0, 7], [34, 15]]) {
        const cx = x - 16 + ((t * 2.5 + offset) % (w + 24));
        this.r(cx, y + cy, 14, 3, light.cloud);
        this.r(cx + 3, y + cy - 2, 8, 2, light.cloud);
        this.r(cx + 1, y + cy + 3, 12, 1, mix(light.cloud, light.sky[2], 0.5));
      }
    }
    // Hills and a tree line outside, falling into shadow at dusk.
    const land = (day: string, dark: string) => mix(day, dark, light.dark);
    this.r(x, y + h - 10, w, 10, land('#7cbf5e', '#243d33'));
    this.r(x, y + h - 4, w, 4, land('#5ea24a', '#1b3029'));
    treeLine(ctx, x, y + h - 21, w, 17, light.dark);
    glassReflection(ctx, x, y, w, h, 0.13);
    ctx.restore();
    // Mullions and the sill.
    this.r(x + w / 2 - 1, y, 3, h, frame.base);
    this.r(x + w / 2 - 1, y, 1, h, frame.hi);
    this.r(x, y + h / 2 - 1, w, 3, frame.base);
    this.r(x, y + h / 2 - 1, w, 1, frame.hi);
    // Curtains.
    const curtain = ramp('#b96555');
    for (const [cx, dir] of [[x - 6, 1], [x + w - 1, -1]] as const) {
      this.r(cx, y - 5, 7, h + 4, curtain.base);
      this.r(dir === 1 ? cx : cx + 5, y - 5, 2, h + 4, curtain.lo);
      this.r(cx + 3, y - 5, 1, h + 4, curtain.hi);
      this.r(cx - 1, y - 6, 9, 2, '#e7b84a');
      this.r(cx, y + h - 9, 7, 2, '#d9b77a');
      this.r(cx + 2, y + h - 7, 1, 3, '#f2dca2');
    }
    this.r(x - 8, y + h + 1, w + 16, 4, frame.base);
    this.r(x - 8, y + h + 1, w + 16, 1, frame.hi);
    this.r(x - 8, y + h + 5, w + 16, 1, OUTLINE);
    if (sign === null) return;
    // The OPEN / CLOSED sign hangs on two strings from the crossbar, below the neon.
    const word = sign ? 'OPEN' : 'CLOSED';
    const sw = textWidth(word) + 6;
    const sx = Math.round(x + (w - sw) / 2);
    const bar = y + h / 2 + 2;
    const sy = bar + 3;
    this.r(sx + 2, bar, 1, sy - bar, '#4a2e1e');
    this.r(sx + sw - 3, bar, 1, sy - bar, '#4a2e1e');
    this.r(sx, sy, sw, 9, OUTLINE);
    this.r(sx + 1, sy + 1, sw - 2, 7, sign ? '#fdf6ec' : '#3f5f93');
    drawText(this.ctx, word, sx + 3, sy + 2, sign ? '#d9384a' : '#fdf6ec');
  }


  drawMenuBoard(state: GameState): void {
    const x = 110;
    const y = 7;
    const w = 100;
    const h = 44;
    const frame = ramp('#9a6740');
    this.r(x - 1, y - 1, w + 2, h + 2, OUTLINE);
    this.r(x, y, w, h, frame.base);
    this.r(x, y, w, 1, frame.hi);
    this.r(x, y + h - 1, w, 1, frame.lo);
    this.r(x + 3, y + 3, w - 6, h - 6, '#28463e');
    this.r(x + 5, y + 5, w - 10, 1, '#567365');
    for (let i = 0; i < 4; i++) {
      this.r(x + 7 + i * 23, y + h - 5, 10, 1, '#36564b');
    }
    // Brass corner pins and a double moulded frame.
    for (const dx of [1, w - 2]) for (const dy of [1, h - 2]) this.r(x + dx, y + dy, 1, 1, '#f1cf8c');
    this.r(x + 3, y + 3, w - 6, 1, '#1f3529');
    // Chalk dust and doodles.
    this.r(x + 8, y + h - 7, 14, 1, '#4f6e5c');
    this.r(x + w - 22, y + 7, 12, 1, '#4f6e5c');
    this.r(x + w - 14, y + h - 9, 6, 1, '#4f6e5c');
    bigText(this.ctx, 'MENU', x + w / 2, y + 4, '#f5efe0');
    // Today's menu, as many as fit.
    const today = menuItems(state);
    const rows = [today.slice(0, 5), today.slice(5, 10)];
    rows.forEach((row, ri) => {
      const total = row.length * 16 - 4;
      row.forEach((m, i) => {
        const icon = itemIcon(m.id, false);
        const ix = x + w / 2 - total / 2 + i * 16 + (12 - icon.width) / 2;
        const iy = y + 18 + ri * 12 + (12 - icon.height);
        this.ctx.drawImage(icon, Math.round(ix), iy);
      });
    });
    // Chalk tray.
    this.r(x + 6, y + h, w - 12, 2, frame.lo);
    this.r(x + 14, y + h - 1, 5, 1, '#f5efe0');
  }


  /** The low cabinet behind the baristas with the café's odds and ends on top. */
  drawBackBar(state: GameState, counter: string): void {
    const { x, w, top, front } = BACK_BAR;
    const colors = counterColors(counter);
    const body = ramp(colors.front);
    const slab = ramp(colors.top);
    const bottom = FLOOR_Y;
    // Worktop and cupboard doors.
    this.r(x, top - 1, w + 1, 1, OUTLINE);
    this.r(x, top, w, front - top, slab.base);
    this.r(x, top, w, 1, slab.lo);
    this.r(x, front - 2, w, 1, slab.hi);
    this.r(x, front - 1, w, 1, colors.trim ?? slab.dark);
    this.r(x - 1, top - 1, 1, bottom - top + 1, OUTLINE);
    this.r(x + w, top - 1, 1, bottom - top + 1, OUTLINE);
    this.r(x, front, w, bottom - front, body.lo);
    for (let dx = x + 3; dx + 22 <= x + w - 2; dx += 25) {
      this.r(dx, front + 2, 22, bottom - front - 5, body.dark);
      this.r(dx + 1, front + 3, 20, bottom - front - 7, body.base);
      this.r(dx + 1, front + 3, 20, 1, body.hi);
      this.r(dx + 3, front + 5, 16, bottom - front - 11, mix(body.base, body.lo, 0.5));
      this.r(dx + (dx % 2 ? 2 : 18), front + 8, 2, 2, colors.trim ?? '#e7b84a');
    }
    this.r(x, bottom - 2, w, 2, body.dark);

    const sit = top + 4; // Items stand a little back from the front edge.
    const ctx = this.ctx;
    // Left of the menu board: the grinder and jars of beans and tea.
    const grinder = GRINDER();
    ctx.drawImage(grinder, x + 2, sit - grinder.height + 1);
    this.jar(x + 15, sit, 11, '#6e3f24', '#9c6538');
    this.jar(x + 26, sit, 9, '#6f9a52', '#9fc47e');
    // Under the board: cups on saucers, a milk pitcher, then the bread basket (a sack
    // of beans when there are no breads today) and a cake under a glass dome. The
    // pass stands beyond them.
    for (let i = 0; i < 3; i++) {
      const cx = 116 + i * 11;
      this.r(cx - 1, sit - 1, 10, 2, OUTLINE);
      this.r(cx, sit - 1, 8, 1, '#e9dcc8');
      this.r(cx + 1, sit - 6, 6, 5, OUTLINE);
      this.r(cx + 2, sit - 5, 4, 4, '#fdf6ec');
      this.r(cx + 2, sit - 5, 4, 1, '#dccdb9');
      this.r(cx + 7, sit - 5, 1, 2, OUTLINE);
    }
    const pitcher = ramp('#c9d3d8');
    const jx = 151;
    this.r(jx, sit - 9, 8, 9, OUTLINE);
    this.r(jx + 1, sit - 8, 6, 8, pitcher.base);
    this.r(jx + 1, sit - 8, 1, 8, pitcher.hi);
    this.r(jx - 1, sit - 9, 2, 2, OUTLINE);
    this.r(jx + 8, sit - 7, 1, 4, OUTLINE);
    const dome = CAKE_DOME();
    ctx.drawImage(dome, 188, sit - dome.height + 1);
    const breads = menuItems(state).filter((m) => m.category === 'bread').slice(0, 2);
    const bx = 164;
    if (breads.length > 0) {
      breads.forEach((m, i) => {
        const icon = itemIcon(m.id);
        ctx.drawImage(icon, bx + 1 + i * 9, sit - 6 - icon.height + 3);
      });
      const wicker = ramp('#c98f4e');
      this.r(bx - 1, sit - 7, 22, 8, OUTLINE);
      this.r(bx, sit - 6, 20, 6, wicker.base);
      for (let i = 0; i < 20; i += 2) this.r(bx + i, sit - 6 + (i % 4 ? 0 : 1), 1, 5, wicker.lo);
      this.r(bx, sit - 6, 20, 1, wicker.hi);
    } else {
      const sack = ramp('#c9a873');
      this.r(bx + 1, sit - 13, 18, 14, OUTLINE);
      this.r(bx + 2, sit - 12, 16, 12, sack.base);
      this.r(bx + 2, sit - 12, 2, 12, sack.hi);
      this.r(bx + 15, sit - 11, 3, 11, sack.lo);
      this.r(bx + 4, sit - 14, 12, 3, OUTLINE);
      this.r(bx + 5, sit - 13, 10, 2, '#6e3f24');
      this.r(bx + 7, sit - 13, 2, 1, '#9c6538');
      this.r(bx + 7, sit - 7, 6, 3, sack.lo);
    }
  }

  private jar(x: number, base: number, h: number, fill: string, fleck: string): void {
    const y = base - h;
    this.r(x - 1, y - 1, 10, h + 1, OUTLINE);
    this.r(x, y, 8, h, '#d6ecf2');
    this.r(x, y + 3, 8, h - 3, fill);
    for (let i = 0; i < 5; i++) this.r(x + 1 + ((i * 3) % 6), y + 4 + ((i * 2) % Math.max(1, h - 5)), 1, 1, fleck);
    this.r(x + 1, y, 1, h, '#f6fbfc');
    this.r(x - 1, y - 3, 10, 2, '#c97d34');
    this.r(x - 1, y - 3, 10, 1, '#e8a95a');
  }

  drawFloor(floor: string, rug: string, light: Lighting, H: number): void {
    paintFloor(this.ctx, floor, 0, FLOOR_Y, SCENE_W, H - FLOOR_Y);
    // Shadow where the floor meets the wall.
    this.ctx.save();
    for (let i = 0; i < 3; i++) {
      this.ctx.globalAlpha = 0.18 - i * 0.05;
      this.r(0, FLOOR_Y + i, SCENE_W, 1, '#2a1410');
    }
    this.ctx.restore();
    // The path to the next room runs under the rug rather than across it.
    paintPassageFloor(this.ctx, 'main');
    // The rug lies in the open floor between the counter and the front door;
    // without one there's a plain runner leading in from the door.
    if (rug === 'rug_none') this.drawRunner(H);
    else paintRug(this.ctx, rug, 110, COUNTER.bottom + 6, 100, H - 18 - COUNTER.bottom);
    this.drawDoormat(H);
    const ctx = this.ctx;
    // Sunlight falling through the window, and in through the open front door.
    const { lean, length } = beam(light.sun);
    for (const win of WINDOWS) paintSunbeam(ctx, light.sun, win.x, win.x + win.w, FLOOR_Y, lean, length);
    paintSunbeam(ctx, light.sun, DOOR_X, DOOR_X + DOOR_W, H, Math.round(lean / 3), -Math.round(length * 0.9));
    // Kitchen light spilling in through the door in the left wall while it's open.
    if (this.kitchenDoor > 0.05) {
      const y = passageY();
      ctx.save();
      ctx.globalAlpha = 0.18 * this.kitchenDoor;
      ctx.fillStyle = '#ffcf8a';
      ctx.beginPath();
      ctx.moveTo(0, y - 14);
      ctx.lineTo(0, y + 14);
      ctx.lineTo(26, y + 22);
      ctx.lineTo(26, y - 8);
      ctx.fill();
      ctx.restore();
    }
    this.drawBarMat();
    // Shadow cast by the counter, and the room darkening toward its edges.
    ctx.save();
    ctx.globalAlpha = 0.2;
    this.r(COUNTER.x, COUNTER.bottom, COUNTER.w + COUNTER_GATE.w, 3, '#2a1410');
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.11 - i * 0.025;
      this.r(0, H - 6 * (i + 1), SCENE_W, 6, '#2a1410');
      ctx.globalAlpha = 0.05;
      this.r(0, FLOOR_Y, 3 * (4 - i), H - FLOOR_Y, '#2a1410');
      this.r(SCENE_W - 3 * (4 - i), FLOOR_Y, 3 * (4 - i), H - FLOOR_Y, '#2a1410');
    }
    ctx.restore();
  }

  /** The rubber mat the baristas stand on inside the bar, between the back bar and the counter. */
  private drawBarMat(): void {
    const { x, w, top, bottom } = BAR_AISLE;
    const y = top + 2;
    const h = bottom - y;
    this.r(x, y, w, h, '#4a403b');
    this.r(x, y, w, 1, '#655852');
    // Drainage holes in a staggered grid.
    for (let hy = y + 2; hy < y + h; hy += 3) {
      for (let hx = x + 1 + (((hy - y) / 3) % 2 ? 2 : 0); hx < x + w - 1; hx += 4) this.r(hx, hy, 2, 1, '#382f2b');
    }
  }

  /** Welcome mat just inside the front door. */
  private drawDoormat(H: number): void {
    const x = DOOR_X + 2;
    const y = H - FRONT_WALL - 9;
    const w = DOOR_W - 4;
    const mat = ramp('#c98f4e');
    this.r(x, y, w, 8, mat.lo);
    this.r(x + 1, y, w - 2, 7, mat.base);
    for (let i = 2; i < w - 2; i += 2) this.r(x + i, y + 2 + ((i / 2) % 2), 1, 3, mix(mat.base, mat.lo, 0.6));
    this.r(x + 3, y + 1, w - 6, 1, '#b5453a');
    this.r(x + 3, y + 5, w - 6, 1, '#b5453a');
  }

  /** A woven runner from the front door up to the counter. */
  private drawRunner(H: number): void {
    const w = 52;
    const x = SCENE_W / 2 - w / 2;
    const y = COUNTER.bottom + 6;
    const h = H - FRONT_WALL - 9 - y;
    // Jute, close to the floor's tone so it marks the aisle without shouting.
    paintRunner(this.ctx, x, y, w, h, 'v');
    // Finished head end: a trim across the top and a fringe.
    const field = ramp('#d6b382');
    this.r(x, y, w, 1, field.lo);
    this.r(x + 3, y + 3, w - 6, 1, '#9a6a45');
    for (let fx = x + 2; fx < x + w - 2; fx += 3) this.r(fx, y - 2, 1, 2, field.hi);
  }

  /**
   * The top of the front wall along the bottom edge, with the doorway in the middle,
   * so the room reads as a box seen from above.
   */
  drawFrontWall(wallpaper: string, H: number, doorway = true, garden = false): void {
    const wood = ramp(wainscotColor(wallpaper));
    const y = H - FRONT_WALL;
    if (!doorway) {
      this.r(0, y - 1, SCENE_W, FRONT_WALL + 1, OUTLINE);
      this.r(1, y, SCENE_W - 2, FRONT_WALL, garden ? '#7a8b61' : wood.base);
      this.r(1, y, SCENE_W - 2, 1, garden ? '#b8c28b' : wood.hi);
      return;
    }
    for (const [x, w] of [[0, DOOR_X - 3], [DOOR_X + DOOR_W + 3, SCENE_W - DOOR_X - DOOR_W - 3]]) {
      this.r(x, y - 1, w, 1, OUTLINE);
      this.r(x, y, w, FRONT_WALL, wood.lo);
      this.r(x, y, w, 1, wood.hi);
      this.r(x, y + 1, w, 2, wood.base);
      grain(this.ctx, x, y + 1, w, 2, wood, 'h', 5);
    }
    // The doorway: stone step outside, a threshold, and chunky frame posts.
    this.r(DOOR_X, y, DOOR_W, FRONT_WALL, '#a89a8c');
    this.r(DOOR_X, y, DOOR_W, 1, '#d6cabd');
    this.r(DOOR_X, y + 1, DOOR_W, 1, '#c4b7a9');
    for (let i = 4; i < DOOR_W; i += 8) this.r(DOOR_X + i, y + 2, 1, FRONT_WALL - 2, '#8f8174');
    for (const px of [DOOR_X - 4, DOOR_X + DOOR_W]) {
      this.r(px - 1, y - 8, 6, FRONT_WALL + 8, OUTLINE);
      this.r(px, y - 7, 4, FRONT_WALL + 7, wood.base);
      this.r(px, y - 7, 4, 1, wood.hi);
      this.r(px + 3, y - 6, 1, FRONT_WALL + 6, wood.lo);
    }
  }

  /** The counter and everything on it; `cups` are the drinks being made right now. */
  drawCounter(state: GameState, counter: string, t: number, cups: CounterCup[]): void {
    const { x, w, top, front, bottom } = COUNTER;
    this.drawReturn(counter);
    paintCounter(this.ctx, counter, x, top, w, front - top, bottom - front);

    // Espresso machine; its finish gets fancier with upgrades.
    const lvl = state.upgrades.machine;
    const finish = lvl >= 15 ? '#e7b84a' : lvl >= 10 ? '#c9814f' : lvl >= 5 ? '#d9574a' : '#9fb3bd';
    const brewing = cups.length > 0;
    const mx = MACHINE_X;
    const my = MACHINE_Y;
    const chrome = ramp('#c9d3d8');
    // Steam wand.
    this.r(mx - 3, my + 9, 3, 1, OUTLINE);
    this.r(mx - 3, my + 10, 2, 9, OUTLINE);
    this.r(mx - 2, my + 10, 1, 8, chrome.base);
    this.ctx.drawImage(espressoMachine(finish), mx - 2, my - 1);
    const light = brewing && Math.floor(t * 4) % 2 ? '#7fe36a' : '#e2434b';
    this.r(mx + 24, my + 9, 2, 2, light);
    this.r(mx + 24, my + 9, 1, 1, '#ffffff');

    this.drawPastryCase(state);
    this.drawGate(counter);
    this.drawPass(counter);

    // Tip jar, in the gap between the first two baristas.
    const coins = Math.min(4, 1 + Math.floor(state.today.served / 15));
    const jx = baristaSpot(0).x + 11;
    this.r(jx - 1, top - 4, 9, 11, OUTLINE);
    this.r(jx, top - 3, 7, 9, '#d6ecf2');
    this.r(jx, top + 6 - coins, 7, coins, '#f2c14e');
    this.r(jx + 1, top + 6 - coins, 2, 1, '#fff3a0');
    this.r(jx, top - 3, 1, 9, '#f6fbfc');
    this.r(jx - 1, top - 5, 9, 2, '#c97d34');

    // A card reader lying flat on the counter, low enough not to hide the first barista.
    const px = MACHINE_X + 32;
    this.r(px - 1, top - 4, 11, 5, OUTLINE);
    this.r(px, top - 3, 9, 3, '#55606b');
    this.r(px + 1, top - 3, 4, 1, '#2d4a3a');
    this.r(px + 2, top - 3, 2, 1, '#8fe38a');
    this.r(px + 6, top - 2, 2, 1, '#9aa4ad');

    // Orders brought forward from the back bar, waiting in front of their barista.
    for (const { x: cx, fill } of cups) {
      this.r(cx + 9, top - 1, 7, 7, OUTLINE);
      this.r(cx + 10, top, 5, 5, '#fdf6ec');
      const level = Math.ceil(fill * 4);
      this.r(cx + 10, top + 5 - level, 5, level, '#6e3f24');
      this.r(cx + 15, top + 1, 1, 2, OUTLINE);
    }
  }

  /**
   * The short arm of counter at the bar's left end, running back to the wall so
   * the bar is closed off from the dining room. Only its worktop shows from above.
   */
  private drawReturn(counter: string): void {
    const { x, w } = COUNTER_RETURN;
    const top = BACK_BAR.top;
    const h = COUNTER.top - top + 2;
    const colors = counterColors(counter);
    const slab = ramp(colors.top);
    this.r(x - 1, top - 1, w + 2, h + 1, OUTLINE);
    this.r(x, top, w, h, slab.base);
    this.r(x, top, 1, h, slab.lo);
    this.r(x + w - 2, top, 1, h, slab.hi);
    this.r(x + w - 1, top, 1, h, colors.trim ?? slab.dark);
  }

  /**
   * The pass: a pickup window standing on the counter's right end. Table orders
   * wait three across on a steel ledge and a heated shelf above, under two heat
   * lamps; each slot is marked so it's easy to see how much room is left. The bell
   * on its header and the plates are drawn live.
   */
  private drawPass(counter: string): void {
    const { x, w, top } = PASS;
    const base = COUNTER.top;
    const shelf = top + 21;
    const wood = ramp(counterColors(counter).front);
    const steel = ramp('#b9c4cb');
    const inner = x + 2;
    const innerW = PASS_COLUMNS * PASS_SLOT_W;
    // A warm wash from the heat lamps over both shelves.
    this.ctx.save();
    this.ctx.globalAlpha = 0.16;
    this.r(inner, top + 8, innerW, base - top - 8, '#ffb060');
    this.ctx.restore();
    // Slot marks: a pale tick at each slot's edge, on the ledge and the shelf.
    for (const y of [shelf - 1, base - 2]) {
      for (let i = 1; i < PASS_COLUMNS; i++) this.r(inner + i * PASS_SLOT_W, y - 2, 1, 3, steel.lo);
    }
    // The heated shelf, and the steel ledge over the gate.
    this.r(inner - 1, shelf, innerW + 2, 3, OUTLINE);
    this.r(inner, shelf, innerW, 1, steel.hi);
    this.r(inner, shelf + 1, innerW, 1, steel.base);
    this.r(x - 1, base - 2, w + 2, 3, OUTLINE);
    this.r(x, base - 2, w, 1, steel.hi);
    this.r(x, base - 1, w, 1, steel.base);
    // Posts either side.
    for (const px of [x, x + w - 2]) {
      this.r(px - 1, top + 6, 4, base - top - 7, OUTLINE);
      this.r(px, top + 6, 2, base - top - 7, wood.base);
      this.r(px, top + 6, 1, base - top - 7, wood.hi);
    }
    // The header, signed PASS, with two heat lamps under it.
    this.r(x - 2, top - 1, w + 4, 8, OUTLINE);
    this.r(x - 1, top, w + 2, 6, wood.lo);
    this.r(x - 1, top, w + 2, 1, wood.hi);
    drawText(this.ctx, 'PASS', x + 6, top + 1, '#f5e6c4');
    for (const lx of [inner + 4, inner + innerW - 11]) {
      this.r(lx, top + 7, 7, 2, '#7a5a2a');
      this.r(lx + 1, top + 7, 5, 1, '#a67c3a');
      this.r(lx + 1, top + 9, 5, 1, '#ffd27a');
    }
  }

  /** The hinged flap at the end of the counter: a lift-up top and a little swing door. */
  private drawGate(counter: string): void {
    const { top, front, bottom } = COUNTER;
    const { x, w } = COUNTER_GATE;
    const colors = counterColors(counter);
    const slab = ramp(colors.top);
    const body = ramp(colors.front);
    // The flap: same top as the counter, with a seam and two brass hinges.
    this.r(x, top - 1, w, 1, OUTLINE);
    this.r(x, top, w, front - top, slab.base);
    this.r(x, top, w, 1, slab.lo);
    this.r(x, front - 3, w, 1, slab.hi);
    this.r(x, front - 1, w, 1, colors.trim ?? slab.dark);
    this.r(x, top, 1, front - top, slab.dark);
    for (const hy of [top + 2, front - 5]) this.r(x + 1, hy, 2, 2, '#d9a441');
    // Below it, an opening and a half-height swing door.
    this.r(x, front, w, bottom - front, '#3a2418');
    const dy = front + 5;
    this.r(x + 1, dy, w - 2, bottom - dy - 1, body.dark);
    this.r(x + 2, dy + 1, w - 4, bottom - dy - 3, body.base);
    this.r(x + 2, dy + 1, w - 4, 1, body.hi);
    this.r(x + 4, dy + 4, w - 8, bottom - dy - 9, body.lo);
    this.r(x + w - 5, dy + 6, 2, 2, colors.trim ?? '#e7b84a');
    this.r(x + w, top - 1, 1, bottom - top + 1, OUTLINE);
  }

  /**
   * The glass case in the counter front. It shows today's breads and pastries:
   * what's left on the shelf while open, the planned bake while closed.
   */
  private drawPastryCase(state: GameState): void {
    const { top, front, bottom } = COUNTER;
    const { x, w } = PASTRY_CASE;
    const ctx = this.ctx;
    // Glass top over the case.
    this.r(x, top + 1, w, front - top - 4, '#cfe6ea');
    this.r(x, top + 1, w, 1, '#eef8fa');
    for (let i = 0; i < w - 6; i += 9) this.r(x + 3 + i, top + 3, 4, 1, '#ffffff');
    this.r(x, top + 1, 1, front - top - 4, '#9fc3cf');
    this.r(x + w - 1, top + 1, 1, front - top - 4, '#9fc3cf');
    // The case itself: a lit cream interior with one shelf.
    const cy = front + 2;
    const ch = bottom - front - 6;
    const brass = ramp('#d9a441');
    this.r(x - 1, cy - 1, w + 2, ch + 2, OUTLINE);
    this.r(x, cy, w, ch, '#f6e6c6');
    this.r(x, cy, w, 3, '#fff4d8');
    this.r(x, cy + ch - 4, w, 4, '#e8cfa4');
    const shelfY = cy + ch - 4;
    this.r(x, shelfY, w, 1, '#c9a873');

    const bakery = menuItems(state).filter((m) => !isDrink(m.category)).slice(0, 5);
    const slots = Math.max(3, bakery.length);
    const slot = w / slots;
    for (let i = 0; i < slots; i++) {
      const sx = Math.round(x + slot * i + slot / 2);
      // Doily plate.
      this.r(sx - 5, shelfY - 1, 11, 1, '#ffffff');
      this.r(sx - 4, shelfY, 9, 1, '#e9dcc8');
      const m = bakery[i];
      if (!m) continue;
      const count = state.phase === 'open' ? (state.shelf[m.id] ?? 0) : (state.bakePlan[m.id] ?? 0);
      if (count <= 0) continue;
      const icon = itemIcon(m.id);
      const ix = Math.round(sx - icon.width / 2);
      const iy = shelfY - icon.height + 1;
      if (count >= 8) ctx.drawImage(icon, ix - 2, iy - 2);
      ctx.drawImage(icon, ix, iy);
    }
    // Reflections on the glass, then the brass frame.
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (const gx of [x + 6, x + w / 2 + 4]) {
      for (let i = 0; i < ch - 2; i++) this.r(gx + i * 0.6, cy + 1 + i, 2, 1, '#ffffff');
    }
    ctx.restore();
    this.r(x, cy, w, 1, brass.hi);
    this.r(x, cy + ch - 1, w, 1, brass.lo);
    this.r(x, cy, 1, ch, brass.base);
    this.r(x + w - 1, cy, 1, ch, brass.lo);
  }

  /** A table spot the shop hasn't expanded into yet: crates and a barrier, standing at (x, y). */
  drawUnbuilt(x: number, y: number): void {
    const crate = ramp('#a8763f');
    shadow(this.ctx, x, y, 34, 0.18);
    const box = (bx: number, by: number, w: number, h: number) => {
      this.r(bx - 1, by - 1, w + 2, h + 2, OUTLINE);
      this.r(bx, by, w, h, crate.base);
      this.r(bx, by, w, 1, crate.hi);
      this.r(bx, by + h - 1, w, 1, crate.lo);
      this.r(bx, by + Math.floor(h / 2), w, 1, crate.lo);
      this.r(bx + 1, by + 1, 1, h - 2, crate.lo);
      this.r(bx + w - 2, by + 1, 1, h - 2, crate.lo);
    };
    box(x - 15, y - 12, 14, 11);
    box(x + 1, y - 9, 11, 8);
    box(x - 11, y - 21, 11, 8);
    // Striped barrier on two legs.
    const bx = x - 4;
    const by = y - 16;
    this.r(bx + 2, by + 3, 2, 12, OUTLINE);
    this.r(bx + 18, by + 3, 2, 12, OUTLINE);
    this.r(bx - 1, by - 1, 24, 5, OUTLINE);
    for (let i = 0; i < 22; i++) this.r(bx + i, by, 1, 3, Math.floor((i + 1) / 3) % 2 ? '#f2b33d' : '#fdf6ec');
  }
}
