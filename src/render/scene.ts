import { isDrink } from '../game/data';
import { isBakery, menuItems } from '../game/economy';
import { formatMoney } from '../game/format';
import {
  BACK_BAR,
  CAT_SPOT,
  COUNTER,
  COUNTER_GATE,
  DOOR_W,
  DOOR_X,
  FLOOR_Y,
  KITCHEN_DOOR,
  MAX_TABLES,
  PASTRY_CASE,
  SCENE_W,
  WINDOWS,
  areaOrigin,
  baristaSpot,
  doorPlantSpots,
  floorY,
  floorYMin,
  sceneHeight,
  seatSpot,
  tablePos,
} from '../game/layout';
import {
  CELL,
  COLS,
  FLOOR_ROWS,
  WALL_ROWS,
  WALL_TOP,
  canPlace,
  cellFree,
  furnitureDef,
  type FurnitureDef,
} from '../game/furniture';
import type { Customer, Sim, SimEvent } from '../game/sim';
import type { GameState } from '../game/state';
import { AREA_IDS, activeTableIndices, areaAtX, isAreaOpen, mainTableCount, regionOffset, type AreaId } from '../game/regions';
import { paintRegion } from './region-art';
import { paintPassageFloor, paintRoomBoundaries } from './passages';
import { RoomCamera } from './room-camera';
import { mix, ramp } from './color';
import {
  paintCeiling,
  paintCounter,
  paintFloor,
  paintNeon,
  paintRug,
  paintRunner,
  paintSill,
  paintWainscot,
  paintWall,
  counterColors,
  grain,
  wainscotColor,
  shadow,
} from './decor-art';
import { drawText, textWidth } from './font';
import { GHOST_BAD, GHOST_OK, floorFurnitureBounds, paintFloorFurniture, paintWallFurniture } from './furniture-art';
import { CHAR_H, OUTLINE, catFrames, pixelSprite, character, crownSprite, dropSprite, heartSprite, itemIcon, type Facing } from './sprites';

interface Particle {
  kind: 'steam' | 'sparkle' | 'heart';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

const FLOATER_LIFE = 1.4;
const MAX_FLOATERS = 14;
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
const MACHINE_X = COUNTER.x + 8;

/** Where a floor piece at (col, row) stands: its middle, and its feet at the front of its footprint. */
function floorAnchor(def: FurnitureDef, col: number, row: number): { cx: number; foot: number } {
  const area = areaAtX(col * CELL) ?? 'main';
  const o = areaOrigin(area);
  return { cx: o.x + (col + def.w / 2) * CELL - regionOffset(area), foot: o.y + floorY(FLOOR_Y + (row + def.h) * CELL) - 1 };
}

/** Grid cells as drawn on screen; floor rows stretch with the room. */
function cellRect(surface: 'floor' | 'wall', col: number, row: number, w: number, h: number) {
  const area = areaAtX(col * CELL) ?? 'main';
  const o = areaOrigin(area);
  const x = o.x + col * CELL - regionOffset(area);
  if (surface === 'wall') return { x, y: o.y + WALL_TOP + row * CELL, w: w * CELL, h: h * CELL };
  const top = floorY(FLOOR_Y + row * CELL);
  return { x, y: o.y + top, w: w * CELL, h: floorY(FLOOR_Y + (row + h) * CELL) - top };
}

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
const CHAIR_RIGHT = lazy(() => pixelSprite(CHAIR_ROWS, CHAIR_PALETTE));
const CHAIR_LEFT = lazy(() => pixelSprite(CHAIR_ROWS.map((r) => [...r].reverse().join('')), CHAIR_PALETTE));

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
const TABLE_CX = TABLE_RX + 2;
const TABLE_TOP_DY = 19;

/** A round bistro table under a gingham cloth, on an iron pedestal. */
const TABLE = lazy(() => {
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

/** A piece of furniture being placed or moved, and where it would go. */
export interface Ghost {
  id: string;
  col: number;
  row: number;
  /** The placed item being moved, which doesn't count as in its own way. */
  skip: number;
}

export class SceneRenderer {
  readonly buffer: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private catHappy = 0;
  private steamTimer = 0;
  /** How far the kitchen door has swung open, 0 to 1. */
  private kitchenDoor = 0;
  private camera = new RoomCamera();
  area: AreaId = 'main';
  overview = false;

  get viewX(): number { return this.camera.x; }
  get viewY(): number { return this.camera.y; }
  get viewWidth(): number { return SCENE_W / this.camera.zoom; }
  get viewHeight(): number { return sceneHeight() / this.camera.zoom; }
  get panning(): boolean { return this.camera.moving; }

  moveToArea(area: AreaId, immediate = false): void {
    this.area = area;
    this.overview = false;
    this.camera.moveTo(areaOrigin(area), immediate);
  }

  setOverview(show: boolean, immediate = false): void {
    this.overview = show;
    this.camera.moveTo(show ? { x: 0, y: -sceneHeight() } : areaOrigin(this.area), immediate, show ? 0.5 : 1);
  }

  constructor() {
    this.buffer = document.createElement('canvas');
    this.buffer.width = SCENE_W;
    this.buffer.height = sceneHeight();
    this.ctx = this.buffer.getContext('2d')!;
  }

  // ------------------------------------------------------------ effects

  addEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type !== 'sale') continue;
      // Stack pop-ups that would land on top of a fresh one.
      let y = e.y;
      while (this.floaters.some((f) => Math.abs(f.x - e.x) < 28 && Math.abs(f.y - y) < 8)) y -= 8;
      this.floaters.push({
        text: '+' + formatMoney(e.amount),
        x: e.x,
        y,
        life: FLOATER_LIFE,
        color: e.vip ? '#ff9fcb' : '#ffd95a',
      });
      if (e.vip) for (let i = 0; i < 8; i++) this.sparkle(e.x + (Math.random() - 0.5) * 24, e.y + Math.random() * 14);
    }
    if (this.floaters.length > MAX_FLOATERS) this.floaters.splice(0, this.floaters.length - MAX_FLOATERS);
  }

  sparkle(x: number, y: number): void {
    this.particles.push({ kind: 'sparkle', x, y, vx: (Math.random() - 0.5) * 30, vy: -14 - Math.random() * 20, life: 0.7, max: 0.7 });
  }

  private heart(x: number, y: number): void {
    this.particles.push({ kind: 'heart', x, y, vx: (Math.random() - 0.5) * 12, vy: -18, life: 1.3, max: 1.3 });
  }

  private steam(x: number, y: number): void {
    this.particles.push({ kind: 'steam', x, y, vx: (Math.random() - 0.5) * 4, vy: -10, life: 1.2, max: 1.2 });
  }

  /** Returns true if the tap landed on the cat. */
  hitCat(x: number, y: number): boolean {
    return this.area === 'main' && x >= CAT_SPOT.x - 10 && x <= CAT_SPOT.x + 10 && y >= CAT_SPOT.y - 16 && y <= CAT_SPOT.y + 2;
  }

  petCat(): void {
    this.catHappy = 2;
    for (let i = 0; i < 3; i++) this.heart(CAT_SPOT.x - 4 + i * 4, CAT_SPOT.y - 16 - i * 4);
  }

  update(dt: number, sim: Sim): void {
    this.camera.update(dt);
    this.catHappy = Math.max(0, this.catHappy - dt);
    // The kitchen door swings open while someone fetches a bread or pastry.
    const fetching = sim.baristas.some((b, i) => {
      const c = sim.isBrewing(i) && sim.customers.find((c) => c.id === b.customerId);
      return !!c && isBakery(c.order);
    });
    this.kitchenDoor += ((fetching ? 1 : 0) - this.kitchenDoor) * Math.min(1, dt * 10);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.y -= 16 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    this.steamTimer -= dt;
    if (this.steamTimer <= 0) {
      this.steamTimer = 0.3;
      if (sim.baristas.some((_, i) => sim.isBrewing(i))) this.steam(MACHINE_X + 8 + Math.random() * 14, 62);
      for (const c of sim.customers) {
        if (c.phase === 'sitting' && Math.random() < 0.25) {
          const table = tablePos(Math.floor(c.seat / 2));
          this.steam(table.x + (c.seat % 2 === 0 ? -7 : 7), table.y - 26);
        }
      }
    }
  }

  // ------------------------------------------------------------ drawing

  private r(x: number, y: number, w: number, h: number, color: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  draw(sim: Sim, state: GameState, t: number, now: Date): void {
    const ctx = this.ctx;
    const H = sceneHeight();
    if (this.buffer.height !== H) this.buffer.height = H;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SCENE_W, H);
    const decor = state.decor.equipped;
    const hour = now.getHours() + now.getMinutes() / 60;
    const night = hour >= 19 || hour < 6;
    const viewX = Math.round(this.viewX);
    const viewY = Math.round(this.viewY);
    const visibleAreas = AREA_IDS.filter((area) => {
      const o = areaOrigin(area);
      return o.x < viewX + this.viewWidth && o.x + SCENE_W > viewX && o.y < viewY + this.viewHeight && o.y + H > viewY;
    });
    ctx.save();
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-viewX, -viewY);

    for (const area of visibleAreas) {
      const offset = regionOffset(area);
      const origin = areaOrigin(area);
      ctx.save();
      ctx.translate(origin.x, origin.y);
      if (area === 'main') {
        this.drawWall(decor.wallpaper, t);
        const sill = WINDOWS[0];
        this.drawWindow(sill, hour, t, state.phase === 'open');
        this.drawKitchenDoor(state, t);
        paintSill(ctx, decor.sill, sill.x + sill.w - 8, sill.y + sill.h + 1);
        this.drawCat(t);
        // The neon sign glows in the left window, facing the street.
        paintNeon(ctx, decor.neon, sill.x + sill.w / 2, sill.y + 4, t);
        this.drawMenuBoard(state);
        state.decor.placed.forEach((p, i) => {
          const def = furnitureDef(p.id);
          if (def?.surface === 'wall' && p.col < COLS && i !== this.ghost?.skip) paintWallFurniture(ctx, p.id, p.col * CELL, WALL_TOP + p.row * CELL, t, now);
        });
        this.drawFloor(decor.floor, decor.rug, hour, H);
        this.drawBackBar(state, decor.counter);
        paintCeiling(ctx, decor.ceiling, SCENE_W, t);
        this.drawBaristas(sim, state, t);
        this.drawCounter(sim, state, decor.counter, t);
      } else {
        paintRegion(ctx, area, H, t, night, !isAreaOpen(state, area));
        state.decor.placed.forEach((p, i) => {
          const def = furnitureDef(p.id);
          if (def?.surface === 'wall' && p.col * CELL >= offset && p.col * CELL < offset + SCENE_W && i !== this.ghost?.skip) paintWallFurniture(ctx, p.id, p.col * CELL - offset, WALL_TOP + p.row * CELL, t, now);
        });
      }
      if (area !== 'main') paintPassageFloor(ctx, area);
      ctx.restore();
    }

    // Everything standing on the floor is sorted by feet position.
    const drawables: { y: number; draw: () => void }[] = [];
    for (const c of sim.customers) {
      if (c.phase !== 'sitting') drawables.push({ y: c.y, draw: () => this.drawCustomer(c) });
    }
    // Built tables, and crates on the spot the next expansion will open up.
    for (const i of activeTableIndices(state)) drawables.push({ y: tablePos(i).y, draw: () => this.drawTable(sim, i, t) });
    const built = mainTableCount(state);
    if (built < MAX_TABLES) drawables.push({ y: tablePos(built).y, draw: () => this.drawUnbuilt(built) });
    // Furniture the player placed, and the potted figs either side of the front door.
    state.decor.placed.forEach((p, i) => {
      const def = furnitureDef(p.id);
      if (def?.surface !== 'floor' || i === this.ghost?.skip) return;
      const { cx, foot } = floorAnchor(def, p.col, p.row);
      drawables.push({ y: foot, draw: () => paintFloorFurniture(ctx, p.id, cx, foot) });
    });
    for (const spot of doorPlantSpots()) drawables.push({ y: spot.y, draw: () => paintFloorFurniture(ctx, 'plant_fig', spot.x, spot.y) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    for (const area of visibleAreas) {
      ctx.save();
      const origin = areaOrigin(area);
      ctx.translate(origin.x, origin.y);
      this.drawFrontWall(area === 'main' ? decor.wallpaper : area === 'reading' ? 'wall_cream' : 'wall_mint', H, area === 'main' || area === 'greenhouse', area === 'terrace');
      paintRoomBoundaries(ctx, area, state);
      ctx.restore();
    }
    for (const c of sim.customers) this.drawCustomerOverlay(c, t);
    this.drawParticles();
    for (const f of this.floaters) {
      const w = textWidth(f.text);
      if (f.x < viewX || f.x >= viewX + this.viewWidth || f.y < viewY || f.y >= viewY + this.viewHeight) continue;
      const x = Math.min(viewX + this.viewWidth - w - 2, Math.max(viewX + 2, f.x - w / 2));
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      drawText(ctx, f.text, x, f.y, f.color, OUTLINE);
      ctx.globalAlpha = 1;
    }
    if (night) {
      // Evening: the room gets a little cozier and darker.
      ctx.save();
      ctx.globalAlpha = 0.1;
      this.r(viewX, viewY, this.viewWidth, this.viewHeight, '#1c1d4a');
      ctx.restore();
    }
    if (this.overview) {
      const o = areaOrigin(this.area);
      ctx.strokeStyle = '#f5ce7d';
      ctx.lineWidth = 3;
      for (const [x, y, dx, dy] of [[o.x + 7, o.y + 7, 1, 1], [o.x + SCENE_W - 7, o.y + 7, -1, 1], [o.x + 7, o.y + H - 7, 1, -1], [o.x + SCENE_W - 7, o.y + H - 7, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * 16, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * 16);
        ctx.stroke();
      }
    }
    if (this.ghost && !this.panning && !this.overview) this.drawGhost(state, this.ghost, t, now);
    ctx.restore();
  }

  // ------------------------------------------------------------ arranging furniture

  /** Set while the player is placing or moving a piece. */
  ghost: Ghost | null = null;

  /** The grid cell a piece would go in if dropped with its middle at (x, y). */
  cellAt(id: string, x: number, y: number): { col: number; row: number } {
    const def = furnitureDef(id)!;
    const o = areaOrigin(this.area);
    x = x - o.x + regionOffset(this.area);
    y -= o.y;
    const col = Math.round(x / CELL - def.w / 2);
    if (def.surface === 'wall') return { col, row: Math.round((y - WALL_TOP) / CELL - def.h / 2) };
    // On the floor the pointer marks the front edge, where the piece stands.
    const bottom = Math.floor((floorYMin(Math.max(FLOOR_Y, y)) - FLOOR_Y) / CELL);
    return { col, row: bottom - def.h + 1 };
  }

  /** Which placed piece is drawn at (x, y), front-most first; -1 if none. */
  furnitureAt(state: GameState, x: number, y: number): number {
    const hits = state.decor.placed
      .map((p, i) => ({ p, i, def: furnitureDef(p.id) }))
      .filter(({ p, def }) => {
        if (!def) return false;
        const b =
          def.surface === 'wall'
            ? cellRect('wall', p.col, p.row, def.w, def.h)
            : floorFurnitureBounds(p.id, floorAnchor(def, p.col, p.row).cx, floorAnchor(def, p.col, p.row).foot);
        return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
      })
      .sort((a, b) => (b.def!.surface === 'floor' ? b.p.row : -1) - (a.def!.surface === 'floor' ? a.p.row : -1));
    return hits[0]?.i ?? -1;
  }

  private drawGhost(state: GameState, ghost: Ghost, t: number, now: Date): void {
    const ctx = this.ctx;
    const def = furnitureDef(ghost.id);
    if (!def) return;
    const tables = mainTableCount(state);
    // Shade every cell it can't go on, so the free space stands out.
    ctx.save();
    ctx.globalAlpha = 0.3;
    const rows = def.surface === 'wall' ? WALL_ROWS : FLOOR_ROWS;
    for (let row = 0; row < rows; row++) {
      const start = regionOffset(this.area) / CELL;
      for (let col = start; col < start + COLS; col++) {
        if (cellFree(state, def.surface, col, row, tables, ghost.skip)) continue;
        const cell = cellRect(def.surface, col, row, 1, 1);
        this.r(cell.x, cell.y, cell.w, cell.h, '#2a1410');
      }
    }
    // The piece itself, then its footprint: green if it fits there, red if not.
    ctx.globalAlpha = 0.8;
    const box = cellRect(def.surface, ghost.col, ghost.row, def.w, def.h);
    if (def.surface === 'wall') paintWallFurniture(ctx, ghost.id, box.x, box.y, t, now);
    else {
      const { cx, foot } = floorAnchor(def, ghost.col, ghost.row);
      paintFloorFurniture(ctx, ghost.id, cx, foot);
    }
    const color = canPlace(state, ghost.id, ghost.col, ghost.row, tables, ghost.skip) ? GHOST_OK : GHOST_BAD;
    ctx.globalAlpha = 0.3 + Math.sin(t * 6) * 0.08;
    this.r(box.x, box.y, box.w, box.h, color);
    ctx.globalAlpha = 1;
    this.r(box.x, box.y, box.w, 1, color);
    this.r(box.x, box.y + box.h - 1, box.w, 1, color);
    this.r(box.x, box.y, 1, box.h, color);
    this.r(box.x + box.w - 1, box.y, 1, box.h, color);
    ctx.restore();
  }

  private drawWall(wallpaper: string, t: number): void {
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
  private drawWindow(win: { x: number; y: number; w: number; h: number }, hour: number, t: number, sign: boolean | null): void {
    const { x, y, w, h } = win;
    const night = hour >= 19 || hour < 6;
    const sunset = hour >= 17 && hour < 19;
    const dawn = hour >= 6 && hour < 8;
    const bands = night
      ? ['#1e2452', '#262d63', '#2f3874']
      : sunset
        ? ['#f08a5d', '#f6a96b', '#fbc98a']
        : dawn
          ? ['#f6b9a0', '#f9cfae', '#fbe2c3']
          : ['#79c1ea', '#97d0f0', '#b8e0f5'];
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
      this.r(x + 38, y + 5, 6, 6, sunset ? '#ffd27a' : '#fff6b0');
      for (const [offset, cy] of [[0, 7], [34, 15]]) {
        const cx = x - 16 + ((t * 2.5 + offset) % (w + 24));
        this.r(cx, y + cy, 14, 3, '#ffffff');
        this.r(cx + 3, y + cy - 2, 8, 2, '#ffffff');
        this.r(cx + 1, y + cy + 3, 12, 1, '#e3f1fa');
      }
    }
    // Hills and a tree line outside.
    this.r(x, y + h - 10, w, 10, night ? '#243d33' : '#7cbf5e');
    this.r(x, y + h - 4, w, 4, night ? '#1b3029' : '#5ea24a');
    for (let i = 0; i < w; i += 7) this.r(x + i, y + h - 14 + ((i * 3) % 5), 6, 5, night ? '#1f3a30' : '#4f9a48');
    ctx.restore();
    // Mullions and the sill.
    this.r(x + w / 2 - 1, y, 3, h, frame.base);
    this.r(x + w / 2 - 1, y, 1, h, frame.hi);
    this.r(x, y + h / 2 - 1, w, 3, frame.base);
    this.r(x, y + h / 2 - 1, w, 1, frame.hi);
    // Curtains.
    const curtain = ramp('#d9574a');
    for (const [cx, dir] of [[x - 6, 1], [x + w - 1, -1]] as const) {
      this.r(cx, y - 5, 7, h + 4, curtain.base);
      this.r(dir === 1 ? cx : cx + 5, y - 5, 2, h + 4, curtain.lo);
      this.r(cx + 3, y - 5, 1, h + 4, curtain.hi);
      this.r(cx - 1, y - 6, 9, 2, '#e7b84a');
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


  /**
   * The swinging door to the kitchen. The oven glows through its porthole while the
   * morning bake is fresh, and the door swings open whenever a bread or pastry is fetched.
   */
  private drawKitchenDoor(state: GameState, t: number): void {
    const { x, w, top } = KITCHEN_DOOR;
    const h = FLOOR_Y - top;
    const frame = ramp('#9a6740');
    // Preheating before opening; after the bake the oven cools to embers over the first half minute.
    const heat = state.phase === 'prep' ? 0.7 : Math.max(0.2, 1 - state.dayTime / 30);
    const flicker = Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
    const glow = mix('#5a3426', '#ffb04a', Math.max(0, Math.min(1, heat + flicker)));
    // Casing, with a little plaque of a loaf above it.
    this.r(x - 4, top - 4, w + 8, h + 4, OUTLINE);
    this.r(x - 3, top - 3, w + 6, h + 3, frame.base);
    this.r(x - 3, top - 3, w + 6, 1, frame.hi);
    this.r(x - 3, top - 3, 1, h + 3, frame.hi);
    const px = x + w / 2 - 7;
    this.r(px, top - 13, 14, 9, OUTLINE);
    this.r(px + 1, top - 12, 12, 7, '#f3e3c3');
    this.r(px + 3, top - 10, 8, 3, '#c98a45');
    this.r(px + 4, top - 11, 6, 1, '#c98a45');
    this.r(px + 4, top - 10, 6, 1, '#e3b36b');
    this.r(px + 5, top - 9, 1, 1, '#9a6234');
    this.r(px + 8, top - 9, 1, 1, '#9a6234');
    this.r(px + 4, top - 4, 1, 1, '#4a2e1e');
    this.r(px + 9, top - 4, 1, 1, '#4a2e1e');
    // The kitchen beyond: tiled wall, a shelf of loaves and the oven.
    this.r(x, top, w, h, '#e9e1cf');
    for (let ty = top + 3; ty < FLOOR_Y; ty += 5) this.r(x, ty, w, 1, '#d2c7b0');
    for (let ty = top; ty < FLOOR_Y; ty += 5) for (let tx = x + ((ty - top) % 10 ? 2 : 5); tx < x + w; tx += 6) this.r(tx, ty, 1, 3, '#d2c7b0');
    this.r(x + 2, top + 9, w - 4, 2, frame.lo);
    for (let i = 0; i < 3; i++) {
      this.r(x + 4 + i * 8, top + 5, 6, 4, '#c98a45');
      this.r(x + 5 + i * 8, top + 5, 4, 1, '#e3b36b');
    }
    const ox = x + 3;
    const oy = top + 18;
    this.r(ox, oy, w - 6, FLOOR_Y - oy, OUTLINE);
    this.r(ox + 1, oy + 1, w - 8, FLOOR_Y - oy - 1, '#4b4f57');
    this.r(ox + 1, oy + 1, w - 8, 1, '#6c727c');
    this.r(ox + 4, oy + 6, w - 14, 12, OUTLINE);
    this.r(ox + 5, oy + 7, w - 16, 10, glow);
    this.r(ox + 5, oy + 7, w - 16, 2, mix(glow, '#fff2c8', 0.4));
    this.r(ox + 4, oy + 3, w - 14, 1, '#9aa1aa');
    this.r(ox + 2, FLOOR_Y - 8, w - 10, 1, '#2f3237');
    // The warm light of the kitchen washes over everything in the doorway.
    this.ctx.save();
    this.ctx.globalAlpha = 0.12 + heat * 0.12;
    this.r(x, top, w, h, '#ffb04a');
    this.ctx.restore();
    // The door leaf, hinged on the left; swung open, it narrows to an edge.
    const leafW = Math.round(w - (w - 5) * this.kitchenDoor);
    const leaf = ramp('#b07a4a');
    this.r(x, top, leafW, h, OUTLINE);
    if (leafW < 3) return;
    this.r(x + 1, top + 1, leafW - 2, h - 1, leaf.base);
    this.r(x + 1, top + 1, leafW - 2, 1, leaf.hi);
    this.r(x + 1, top + 1, 1, h - 1, leaf.hi);
    this.r(x + leafW - 2, top + 1, 1, h - 1, leaf.lo);
    if (leafW < 10) return;
    // Lower panel, a brass push plate and a steel kick plate.
    this.r(x + 4, top + 28, leafW - 8, h - 38, leaf.lo);
    this.r(x + 5, top + 29, leafW - 10, h - 40, mix(leaf.base, leaf.lo, 0.4));
    this.r(x + leafW - 7, top + 20, 3, 6, '#e7b84a');
    this.r(x + 1, FLOOR_Y - 7, leafW - 2, 7, '#8d969e');
    this.r(x + 1, FLOOR_Y - 7, leafW - 2, 1, '#c3cbd1');
    // The porthole, squashed as the door turns.
    const pw = Math.max(2, Math.round((leafW - 10) * 0.6));
    const pcx = x + Math.round(leafW / 2);
    const pcy = top + 12;
    this.r(pcx - pw / 2 - 1, pcy - 6, pw + 2, 12, OUTLINE);
    this.r(pcx - pw / 2 - 2, pcy - 4, pw + 4, 8, OUTLINE);
    this.r(pcx - pw / 2, pcy - 5, pw, 10, '#9aa1aa');
    this.r(pcx - pw / 2 - 1, pcy - 3, pw + 2, 6, '#9aa1aa');
    this.r(pcx - pw / 2 + 1, pcy - 4, pw - 2, 8, glow);
    this.r(pcx - pw / 2, pcy - 2, pw, 4, glow);
    this.r(pcx - pw / 2 + 1, pcy - 3, 1, 2, '#fff2c8');
  }

  private drawMenuBoard(state: GameState): void {
    const x = 110;
    const y = 7;
    const w = 100;
    const h = 44;
    const frame = ramp('#9a6740');
    this.r(x - 1, y - 1, w + 2, h + 2, OUTLINE);
    this.r(x, y, w, h, frame.base);
    this.r(x, y, w, 1, frame.hi);
    this.r(x, y + h - 1, w, 1, frame.lo);
    this.r(x + 3, y + 3, w - 6, h - 6, '#2d4a3a');
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
  private drawBackBar(state: GameState, counter: string): void {
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
    this.jar(x + 18, sit, 11, '#6e3f24', '#9c6538');
    this.jar(x + 29, sit, 9, '#6f9a52', '#9fc47e');
    // Under the board, only low things: cups on saucers, a milk pitcher, plates.
    for (let i = 0; i < 5; i++) {
      const cx = 116 + i * 11;
      this.r(cx - 1, sit - 1, 10, 2, OUTLINE);
      this.r(cx, sit - 1, 8, 1, '#e9dcc8');
      this.r(cx + 1, sit - 6, 6, 5, OUTLINE);
      this.r(cx + 2, sit - 5, 4, 4, '#fdf6ec');
      this.r(cx + 2, sit - 5, 4, 1, '#dccdb9');
      this.r(cx + 7, sit - 5, 1, 2, OUTLINE);
    }
    const pitcher = ramp('#c9d3d8');
    this.r(173, sit - 9, 8, 9, OUTLINE);
    this.r(174, sit - 8, 6, 8, pitcher.base);
    this.r(174, sit - 8, 1, 8, pitcher.hi);
    this.r(172, sit - 9, 2, 2, OUTLINE);
    this.r(181, sit - 7, 1, 4, OUTLINE);
    for (let i = 0; i < 4; i++) {
      this.r(188, sit - 2 - i * 2, 16, 2, OUTLINE);
      this.r(189, sit - 2 - i * 2, 14, 1, i === 3 ? '#ffffff' : '#fdf6ec');
    }
    // Right of the board: a bread basket with today's breads (a sack of beans when
    // there are none) and a cake under a glass dome.
    const breads = menuItems(state).filter((m) => m.category === 'bread').slice(0, 2);
    const bx = 213;
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
    const dome = CAKE_DOME();
    ctx.drawImage(dome, x + w - dome.width - 1, sit - dome.height + 1);
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

  private drawFloor(floor: string, rug: string, hour: number, H: number): void {
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
    if (hour >= 7 && hour < 18) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#fff4c8';
      // Sunlight falling through both windows...
      for (const win of WINDOWS) {
        const lean = win.x < SCENE_W / 2 ? 18 : -18;
        ctx.beginPath();
        ctx.moveTo(win.x, FLOOR_Y);
        ctx.lineTo(win.x + win.w, FLOOR_Y);
        ctx.lineTo(win.x + win.w + lean, FLOOR_Y + 36);
        ctx.lineTo(win.x + lean, FLOOR_Y + 36);
        ctx.fill();
      }
      // ...and in through the open front door.
      ctx.beginPath();
      ctx.moveTo(DOOR_X, H);
      ctx.lineTo(DOOR_X + DOOR_W, H);
      ctx.lineTo(DOOR_X + DOOR_W + 8, H - 34);
      ctx.lineTo(DOOR_X - 8, H - 34);
      ctx.fill();
      ctx.restore();
    }
    // Kitchen light spilling out of the open door.
    if (this.kitchenDoor > 0.05) {
      const { x, w } = KITCHEN_DOOR;
      ctx.save();
      ctx.globalAlpha = 0.16 * this.kitchenDoor;
      ctx.fillStyle = '#ffcf8a';
      ctx.beginPath();
      ctx.moveTo(x, FLOOR_Y);
      ctx.lineTo(x + w, FLOOR_Y);
      ctx.lineTo(x + w + 6, FLOOR_Y + 14);
      ctx.lineTo(x - 6, FLOOR_Y + 14);
      ctx.fill();
      ctx.restore();
    }
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
  private drawFrontWall(wallpaper: string, H: number, doorway = true, garden = false): void {
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

  private drawBaristas(sim: Sim, state: GameState, t: number): void {
    sim.baristas.forEach((b, i) => {
      if (i >= 1 + state.upgrades.barista) return;
      const p = baristaSpot(i);
      const brewing = sim.isBrewing(i);
      const bob = brewing ? Math.floor(t * 6 + i) % 2 : Math.floor(t * 1.2 + i * 0.7) % 2;
      // The first spot behind the counter is always the owner.
      const frames = i === 0 && state.profile ? character(state.profile.look, 'owner') : character(b.look, 'barista');
      this.ctx.drawImage(frames.stand, p.x - 9, p.y - (CHAR_H - 1) + bob);
      if (brewing) {
        const progress = 1 - Math.max(0, b.remaining) / b.total;
        this.r(p.x - 10, 64, 20, 5, OUTLINE);
        this.r(p.x - 9, 65, 18, 3, '#5a3a2a');
        this.r(p.x - 9, 65, Math.max(1, Math.round(18 * progress)), 3, '#7fc45e');
        this.r(p.x - 9, 65, Math.max(1, Math.round(18 * progress)), 1, '#b6e59a');
      }
    });
  }

  private drawCounter(sim: Sim, state: GameState, counter: string, t: number): void {
    const { x, w, top, front, bottom } = COUNTER;
    paintCounter(this.ctx, counter, x, top, w, front - top, bottom - front);

    // Espresso machine; its finish gets fancier with upgrades.
    const lvl = state.upgrades.machine;
    const finish = lvl >= 15 ? '#e7b84a' : lvl >= 10 ? '#c9814f' : lvl >= 5 ? '#d9574a' : '#9fb3bd';
    const brewing = sim.baristas.some((_, i) => sim.isBrewing(i));
    const mx = MACHINE_X;
    const my = 71;
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

    // Tip jar, in the gap between the first two baristas.
    const coins = Math.min(4, 1 + Math.floor(state.today.served / 15));
    const jx = baristaSpot(0).x + 11;
    this.r(jx - 1, top - 4, 9, 11, OUTLINE);
    this.r(jx, top - 3, 7, 9, '#d6ecf2');
    this.r(jx, top + 6 - coins, 7, coins, '#f2c14e');
    this.r(jx + 1, top + 6 - coins, 2, 1, '#fff3a0');
    this.r(jx, top - 3, 1, 9, '#f6fbfc');
    this.r(jx - 1, top - 5, 9, 2, '#c97d34');

    // Register at the end of the counter, by the gate.
    const rx = x + w - 26;
    const ry = top - 13;
    const reg = ramp('#7d8c96');
    this.r(rx - 1, ry, 26, 19, OUTLINE);
    this.r(rx, ry + 7, 24, 11, reg.base);
    this.r(rx, ry + 7, 24, 1, reg.hi);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) this.r(rx + 3 + i * 4, ry + 10 + j * 3, 2, 1, '#e9eef0');
    this.r(rx + 16, ry + 9, 6, 7, reg.lo);
    this.r(rx + 4, ry + 1, 16, 6, '#2d4a3a');
    this.r(rx + 5, ry + 2, 6, 1, '#8fe38a');

    // Cups being made in front of each busy barista.
    sim.baristas.forEach((b, i) => {
      if (!sim.isBrewing(i)) return;
      const p = baristaSpot(i);
      const fill = 1 - Math.max(0, b.remaining) / b.total;
      this.r(p.x + 9, top - 1, 7, 7, OUTLINE);
      this.r(p.x + 10, top, 5, 5, '#fdf6ec');
      const level = Math.ceil(fill * 4);
      this.r(p.x + 10, top + 5 - level, 5, level, '#6e3f24');
      this.r(p.x + 15, top + 1, 1, 2, OUTLINE);
    });
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

  private facing(c: Customer): Facing {
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    }
    return c.phase === 'queue' || c.phase === 'ordering' ? 'up' : 'down';
  }

  private drawCustomer(c: Customer): void {
    const frames = character(c.look);
    const facing = this.facing(c);
    const walking = c.x !== c.tx || c.y !== c.ty;
    const step = Math.floor(c.stride / 5);
    let idx = 0;
    if (walking) idx = facing === 'left' || facing === 'right' ? step % 2 : [1, 0, 2, 0][step % 4];
    const sprite = frames[facing][idx];
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    shadow(this.ctx, x, y, 12);
    const bob = walking && idx !== 0 ? 1 : 0;
    this.ctx.drawImage(sprite, x - 9, y - (CHAR_H - 1) - bob);
    if (c.hasCup && facing !== 'up') {
      const cx = facing === 'left' ? x - 8 : x + 4;
      this.cup(cx, y - 10 - bob);
    }
  }

  private cup(x: number, y: number): void {
    this.r(x, y, 5, 5, OUTLINE);
    this.r(x + 1, y + 1, 3, 3, '#fdf6ec');
    this.r(x + 1, y + 1, 3, 1, '#c48a55');
  }

  private drawCustomerOverlay(c: Customer, t: number): void {
    const x = Math.round(c.x);
    let top = Math.round(c.y) - CHAR_H;
    if (c.phase === 'sitting') {
      const seat = seatSpot(Math.floor(c.seat / 2), (c.seat % 2) as 0 | 1);
      top = seat.y - CHAR_H - 5;
    }
    if (c.vip) this.ctx.drawImage(crownSprite(), x - 4, top - 5);
    if (c.phase === 'ordering') {
      const icons = [itemIcon(c.order), ...(c.extra ? [itemIcon(c.extra)] : [])];
      const bw = icons.length > 1 ? 34 : 20;
      const bh = 18;
      const bx = x - Math.floor(bw / 2);
      const by = top - bh - (c.vip ? 6 : 2);
      this.r(bx - 1, by, bw + 2, bh, OUTLINE);
      this.r(bx, by - 1, bw, bh + 2, OUTLINE);
      this.r(bx, by, bw, bh, '#fdf6ec');
      this.r(bx, by + bh - 2, bw, 2, '#e9dcc8');
      this.r(x - 2, by + bh + 1, 5, 1, OUTLINE);
      this.r(x - 1, by + bh, 3, 1, '#e9dcc8');
      this.r(x - 1, by + bh + 1, 3, 1, '#fdf6ec');
      this.r(x, by + bh + 2, 1, 1, OUTLINE);
      icons.forEach((icon, i) => {
        const slot = bw / icons.length;
        this.ctx.drawImage(icon, bx + Math.floor(slot * i + (slot - icon.width) / 2), by + Math.floor((bh - icon.height) / 2));
      });
    } else if (c.soldOut && c.moodTimer > 0) {
      // "Sorry, we're out": the order with a red cross over it.
      const icon = itemIcon(c.order);
      const bx = x - 10;
      const by = top - 20;
      this.r(bx - 1, by - 1, 22, 20, OUTLINE);
      this.r(bx, by, 20, 18, '#fdf6ec');
      this.ctx.globalAlpha = 0.5;
      this.ctx.drawImage(icon, bx + Math.floor((20 - icon.width) / 2), by + Math.floor((18 - icon.height) / 2));
      this.ctx.globalAlpha = 1;
      for (let i = 0; i < 12; i++) {
        this.r(bx + 4 + i, by + 3 + i, 2, 1, '#d9384a');
        this.r(bx + 15 - i, by + 3 + i, 2, 1, '#d9384a');
      }
    } else if (c.mood === 'happy') {
      const lift = Math.round((1.5 - c.moodTimer) * 5);
      this.ctx.drawImage(heartSprite(), x - 4, top - 10 - lift);
    } else if (c.mood === 'sad') {
      this.ctx.drawImage(dropSprite(), x + 5, top + 2);
    } else if (c.phase === 'queue' && c.patience < 12 && Math.floor(t * 2) % 2 === 0) {
      for (let i = 0; i < 3; i++) this.r(x - 4 + i * 4, top - 4, 2, 2, OUTLINE);
    }
  }

  /** A table spot the shop hasn't expanded into yet: crates and a barrier. */
  private drawUnbuilt(index: number): void {
    const { x, y } = tablePos(index);
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

  private drawTable(sim: Sim, index: number, t: number): void {
    const table = tablePos(index);
    shadow(this.ctx, table.x, table.y, 30, 0.2);
    const seated: (Customer | undefined)[] = [0, 1].map((side) => {
      const id = sim.seats[index * 2 + side];
      const c = id != null ? sim.customers.find((cc) => cc.id === id) : undefined;
      return c && c.phase === 'sitting' ? c : undefined;
    });
    // Chairs (backs on the outside) and anyone sitting in them.
    for (const side of [0, 1] as const) {
      const s = seatSpot(index, side);
      shadow(this.ctx, s.x, s.y, 14, 0.15);
      const chair = side === 0 ? CHAIR_RIGHT() : CHAIR_LEFT();
      this.ctx.drawImage(chair, side === 0 ? s.x - 9 : s.x - chair.width + 9, s.y - chair.height + 1);
      const c = seated[side];
      if (c) {
        const frames = character(c.look);
        const sprite = side === 0 ? frames.sitRight : frames.sitLeft;
        const bob = Math.floor(t * 1.1 + c.id) % 3 === 0 ? 1 : 0;
        this.ctx.drawImage(sprite, s.x - 9, s.y - (CHAR_H + 5) + bob);
      }
    }
    const top = TABLE();
    this.ctx.drawImage(top, table.x - TABLE_CX, table.y - top.height + 1);
    const cy = table.y - TABLE_TOP_DY;
    // A bud vase in the middle.
    const bloom = ['#ef5d7a', '#f2c14e', '#ffffff', '#9f78d2'][index % 4];
    this.r(table.x - 2, cy - 7, 4, 5, OUTLINE);
    this.r(table.x - 1, cy - 6, 2, 4, '#cfe6ea');
    this.r(table.x, cy - 10, 1, 4, '#4e8a4f');
    this.r(table.x - 1, cy - 12, 3, 2, bloom);
    this.r(table.x, cy - 13, 1, 1, bloom);
    this.r(table.x + 1, cy - 9, 1, 1, '#6fb26a');
    // Seated customers lean over the table: redraw their upper body on top.
    for (const side of [0, 1] as const) {
      const c = seated[side];
      if (!c) continue;
      const s = seatSpot(index, side);
      const frames = character(c.look);
      const sprite = side === 0 ? frames.sitRight : frames.sitLeft;
      const bob = Math.floor(t * 1.1 + c.id) % 3 === 0 ? 1 : 0;
      const rows = CHAR_H - 8;
      this.ctx.drawImage(sprite, 0, 0, sprite.width, rows, s.x - 9, s.y - (CHAR_H + 5) + bob, sprite.width, rows);
    }
    for (const side of [0, 1] as const) {
      if (seated[side]) this.cup(table.x + (side === 0 ? -9 : 4), cy - 5);
    }
  }

  private drawCat(t: number): void {
    const frames = catFrames();
    let sprite = Math.floor(t / 0.7) % 2 ? frames.swish : frames.idle;
    if (t % 4 < 0.15) sprite = frames.blink;
    if (this.catHappy > 0) sprite = frames.happy;
    this.ctx.drawImage(sprite, CAT_SPOT.x - 8, CAT_SPOT.y - sprite.height + 2);
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const a = p.life / p.max;
      ctx.globalAlpha = Math.min(1, a * 1.5);
      if (p.kind === 'steam') {
        const s = a > 0.6 ? 2 : 1;
        ctx.globalAlpha = Math.min(0.8, a);
        this.r(p.x + Math.sin(p.life * 6) * 1.5, p.y, s, s, '#ffffff');
      } else if (p.kind === 'sparkle') {
        const color = a > 0.5 ? '#fff6c8' : '#ffd95a';
        this.r(p.x, p.y - 2, 1, 5, color);
        this.r(p.x - 2, p.y, 5, 1, color);
        this.r(p.x, p.y, 1, 1, '#ffffff');
      } else {
        ctx.drawImage(heartSprite(), Math.round(p.x) - 4, Math.round(p.y) - 3);
      }
    }
    ctx.globalAlpha = 1;
  }
}
