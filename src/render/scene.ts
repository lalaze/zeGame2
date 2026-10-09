import { isDrink } from '../game/data';
import { menuItems, tableCount } from '../game/economy';
import { formatMoney } from '../game/format';
import {
  CAT_SPOT,
  COUNTER,
  DOOR,
  DOOR_SPOT,
  FLOOR_Y,
  SCENE_W,
  WINDOW,
  baristaSpot,
  backRowY,
  frontRowY,
  sceneHeight,
  seatSpot,
  tablePos,
} from '../game/layout';
import type { Customer, Sim, SimEvent } from '../game/sim';
import type { GameState } from '../game/state';
import { mix, ramp } from './color';
import {
  paintArt,
  paintCeiling,
  paintCounter,
  paintFloor,
  paintNeon,
  paintPlant,
  paintRug,
  paintSill,
  paintWainscot,
  paintWall,
  shadow,
} from './decor-art';
import { drawText, textWidth } from './font';
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
const MAX_TABLES = 4;
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

export class SceneRenderer {
  readonly buffer: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private catHappy = 0;
  private steamTimer = 0;

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
    return x >= CAT_SPOT.x - 10 && x <= CAT_SPOT.x + 10 && y >= CAT_SPOT.y - 16 && y <= CAT_SPOT.y + 2;
  }

  petCat(): void {
    this.catHappy = 2;
    for (let i = 0; i < 3; i++) this.heart(CAT_SPOT.x - 4 + i * 4, CAT_SPOT.y - 16 - i * 4);
  }

  update(dt: number, sim: Sim): void {
    this.catHappy = Math.max(0, this.catHappy - dt);
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
      if (sim.baristas.some((_, i) => sim.isBrewing(i))) this.steam(22 + Math.random() * 14, 64);
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

    this.drawWall(decor.wallpaper, t);
    this.drawWindow(hour, t);
    paintSill(ctx, decor.sill, WINDOW.x + WINDOW.w - 8, WINDOW.y + WINDOW.h + 1);
    this.drawCat(t);
    this.drawClock(now);
    this.drawMenuBoard(state);
    paintArt(ctx, decor.art, 150, 12, t);
    this.drawShelf(state);
    this.drawDoor(sim, night, state.phase === 'open');
    paintNeon(ctx, decor.neon, DOOR.x + DOOR.w / 2, 8, t);
    paintCeiling(ctx, decor.ceiling, SCENE_W, t);
    this.drawFloor(decor.floor, decor.rug, hour, H);
    this.drawBaristas(sim, state, t);
    this.drawCounter(sim, state, decor.counter, t);

    // Everything standing on the floor is sorted by feet position.
    const drawables: { y: number; draw: () => void }[] = [];
    for (const c of sim.customers) {
      if (c.phase !== 'sitting') drawables.push({ y: c.y, draw: () => this.drawCustomer(c) });
    }
    for (let i = 0; i < MAX_TABLES; i++) {
      const built = i < tableCount(state);
      drawables.push({ y: tablePos(i).y, draw: () => (built ? this.drawTable(sim, i, t) : this.drawUnbuilt(i)) });
    }
    drawables.push({ y: 92, draw: () => paintPlant(ctx, decor.plant, 270, 92) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    for (const c of sim.customers) this.drawCustomerOverlay(c, t);
    this.drawParticles();
    for (const f of this.floaters) {
      const w = textWidth(f.text);
      const x = Math.min(SCENE_W - w - 2, Math.max(2, f.x - w / 2));
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      drawText(ctx, f.text, x, f.y, f.color, OUTLINE);
      ctx.globalAlpha = 1;
    }
    if (night) {
      // Evening: the room gets a little cozier and darker.
      ctx.save();
      ctx.globalAlpha = 0.1;
      this.r(0, 0, SCENE_W, H, '#1c1d4a');
      ctx.restore();
    }
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

  private drawWindow(hour: number, t: number): void {
    const { x, y, w, h } = WINDOW;
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
  }

  private drawClock(now: Date): void {
    const cx = 24;
    const cy = 26;
    const ring = ramp('#9a6740');
    for (let dy = -10; dy <= 10; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, 100 - dy * dy)));
      this.r(cx - half, cy + dy, half * 2 + 1, 1, OUTLINE);
    }
    for (let dy = -9; dy <= 9; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, 81 - dy * dy)));
      this.r(cx - half, cy + dy, half * 2 + 1, 1, dy < -4 ? ring.hi : ring.base);
    }
    for (let dy = -7; dy <= 7; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, 49 - dy * dy)));
      this.r(cx - half, cy + dy, half * 2 + 1, 1, '#fbf3e4');
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.r(cx + Math.round(Math.sin(a) * 6), cy - Math.round(Math.cos(a) * 6), 1, 1, i % 3 === 0 ? '#6e4128' : '#c9a882');
    }
    const line = (angle: number, len: number, color: string) => {
      for (let i = 0; i <= len; i += 0.5) {
        this.r(cx + Math.round(Math.sin(angle) * i), cy - Math.round(Math.cos(angle) * i), 1, 1, color);
      }
    };
    const min = now.getMinutes() + now.getSeconds() / 60;
    const hr = (now.getHours() % 12) + min / 60;
    line((min / 60) * Math.PI * 2, 5, '#6e4128');
    line((hr / 12) * Math.PI * 2, 3.5, OUTLINE);
    this.r(cx, cy, 1, 1, '#d9574a');
  }

  private drawMenuBoard(state: GameState): void {
    const x = 46;
    const y = 8;
    const w = 92;
    const h = 46;
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
    bigText(this.ctx, 'MENU', x + w / 2, y + 5, '#f5efe0');
    // Today's menu, as many as fit.
    const today = menuItems(state);
    const rows = [today.slice(0, 5), today.slice(5, 10)];
    rows.forEach((row, ri) => {
      const total = row.length * 16 - 4;
      row.forEach((m, i) => {
        const icon = itemIcon(m.id, false);
        const ix = x + w / 2 - total / 2 + i * 16 + (12 - icon.width) / 2;
        const iy = y + 19 + ri * 13 + (12 - icon.height);
        this.ctx.drawImage(icon, Math.round(ix), iy);
      });
    });
    // Chalk tray.
    this.r(x + 6, y + h, w - 12, 2, frame.lo);
    this.r(x + 14, y + h - 1, 5, 1, '#f5efe0');
  }

  private drawShelf(state: GameState): void {
    const shelf = ramp('#9a6740');
    this.r(146, 48, 60, 3, shelf.base);
    this.r(146, 48, 60, 1, shelf.hi);
    this.r(146, 51, 60, 1, OUTLINE);
    this.r(150, 51, 2, 4, shelf.lo);
    this.r(200, 51, 2, 4, shelf.lo);
    // Today's breads and pastries on display; jars of beans if there are none.
    const bakery = menuItems(state).filter((m) => !isDrink(m.category)).slice(0, 3);
    bakery.forEach((m, i) => {
      const icon = itemIcon(m.id);
      this.ctx.drawImage(icon, 147 + i * 13 + Math.floor((14 - icon.width) / 2), 49 - icon.height);
    });
    for (const [jx, jh] of bakery.length > 0 ? [] : [[150, 10], [161, 12], [172, 9]]) {
      this.r(jx - 1, 48 - jh - 1, 10, jh + 1, OUTLINE);
      this.r(jx, 48 - jh, 8, jh, '#cfe6ee');
      this.r(jx, 48 - jh + 3, 8, jh - 3, '#6e3f24');
      for (let i = 0; i < 5; i++) this.r(jx + 1 + ((i * 3) % 6), 48 - jh + 4 + ((i * 2) % (jh - 4)), 1, 1, '#9c6538');
      this.r(jx + 1, 48 - jh, 1, jh, '#f6fbfc');
      this.r(jx - 1, 48 - jh - 3, 10, 2, '#c97d34');
    }
    // A stack of cups.
    for (let i = 0; i < 3; i++) {
      this.r(185, 44 - i * 4, 10, 4, OUTLINE);
      this.r(186, 45 - i * 4, 8, 2, '#fdf6ec');
      this.r(186, 46 - i * 4, 8, 1, '#dccdb9');
    }
  }

  private drawDoor(sim: Sim, night: boolean, open: boolean): void {
    const { x, y, w, h } = DOOR;
    const frame = ramp('#7a4e33');
    this.r(x - 4, y - 4, w + 8, h + 4, OUTLINE);
    this.r(x - 3, y - 3, w + 6, h + 3, frame.base);
    this.r(x - 3, y - 3, w + 6, 1, frame.hi);
    const door = ramp('#b07a4a');
    const ajar = sim.customers.some((c) => Math.hypot(c.x - DOOR_SPOT.x, c.y - DOOR_SPOT.y) < 12);
    if (ajar) {
      this.r(x, y, w, h, '#2a1a14');
      this.r(x, y + h - 10, w, 10, night ? '#2b3a4a' : '#9fc79a');
      this.r(x, y, 6, h, door.base);
      this.r(x, y, 1, h, door.hi);
      return;
    }
    this.r(x, y, w, h, door.base);
    this.r(x, y, w, 1, door.hi);
    // Glass at the top, panels below.
    this.r(x + 3, y + 3, w - 6, 16, OUTLINE);
    this.r(x + 4, y + 4, w - 8, 14, night ? '#2f3874' : '#a8d8f0');
    this.r(x + 5, y + 5, 3, 6, night ? '#3f4a8a' : '#e3f4fb');
    for (const py of [y + 23, y + 37]) {
      this.r(x + 3, py, w - 6, 11, door.lo);
      this.r(x + 4, py + 1, w - 8, 9, door.base);
      this.r(x + 4, py + 1, w - 8, 1, door.hi);
    }
    this.r(x + w - 6, y + 30, 3, 3, '#f2c14e');
    this.r(x + w - 6, y + 30, 1, 1, '#fff3a0');
    // Hanging OPEN / CLOSED sign.
    const word = open ? 'OPEN' : 'CLOSED';
    const sw = Math.max(w - 4, textWidth(word) + 4);
    const sx = Math.round(x + (w - sw) / 2);
    this.r(x + 7, y + 1, 1, 4, '#4a2e1e');
    this.r(x + w - 8, y + 1, 1, 4, '#4a2e1e');
    this.r(sx, y + 5, sw, 9, OUTLINE);
    this.r(sx + 1, y + 6, sw - 2, 7, open ? '#fdf6ec' : '#3f5f93');
    drawText(this.ctx, word, sx + Math.round((sw - textWidth(word)) / 2), y + 7, open ? '#d9384a' : '#fdf6ec');
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
    // The rug stretches to cover both rows of tables.
    const rugTop = backRowY() - 26;
    const rugH = frontRowY() + 8 - rugTop;
    if (rug === 'rug_round') paintRug(this.ctx, rug, 214, rugTop, 104, rugH);
    else if (rug !== 'rug_none') paintRug(this.ctx, rug, 218, rugTop, 98, rugH);
    // Sunlight from the window during the day.
    if (hour >= 7 && hour < 18) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#fff4c8';
      ctx.beginPath();
      ctx.moveTo(WINDOW.x, FLOOR_Y);
      ctx.lineTo(WINDOW.x + WINDOW.w, FLOOR_Y);
      ctx.lineTo(WINDOW.x + WINDOW.w - 26, FLOOR_Y + 40);
      ctx.lineTo(WINDOW.x - 26, FLOOR_Y + 40);
      ctx.fill();
      ctx.restore();
    }
    // Shadow cast by the counter.
    this.ctx.save();
    this.ctx.globalAlpha = 0.2;
    this.r(COUNTER.x, COUNTER.bottom, COUNTER.w, 3, '#2a1410');
    this.ctx.restore();
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
    const mx = 14;
    const my = 73;
    const chrome = ramp('#c9d3d8');
    // Steam wand.
    this.r(mx - 3, my + 9, 3, 1, OUTLINE);
    this.r(mx - 3, my + 10, 2, 9, OUTLINE);
    this.r(mx - 2, my + 10, 1, 8, chrome.base);
    this.ctx.drawImage(espressoMachine(finish), mx - 2, my - 1);
    const light = brewing && Math.floor(t * 4) % 2 ? '#7fe36a' : '#e2434b';
    this.r(mx + 24, my + 9, 2, 2, light);
    this.r(mx + 24, my + 9, 1, 1, '#ffffff');

    // Register.
    const rx = 178;
    const reg = ramp('#7d8c96');
    this.r(rx - 1, 77, 26, 19, OUTLINE);
    this.r(rx, 84, 24, 11, reg.base);
    this.r(rx, 84, 24, 1, reg.hi);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) this.r(rx + 3 + i * 4, 87 + j * 3, 2, 1, '#e9eef0');
    this.r(rx + 16, 86, 6, 7, reg.lo);
    this.r(rx + 4, 78, 16, 6, '#2d4a3a');
    this.r(rx + 5, 79, 6, 1, '#8fe38a');

    // Cups being made in front of each busy barista.
    sim.baristas.forEach((b, i) => {
      if (!sim.isBrewing(i)) return;
      const p = baristaSpot(i);
      const fill = 1 - Math.max(0, b.remaining) / b.total;
      this.r(p.x + 9, 89, 7, 7, OUTLINE);
      this.r(p.x + 10, 90, 5, 5, '#fdf6ec');
      const level = Math.ceil(fill * 4);
      this.r(p.x + 10, 94 - level + 1, 5, level, '#6e3f24');
      this.r(p.x + 15, 91, 1, 2, OUTLINE);
    });
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
    const wood = ramp('#b07a4a');
    const chairWood = ramp('#8a5a3c');
    shadow(this.ctx, table.x, table.y, 30, 0.2);
    const seated: (Customer | undefined)[] = [0, 1].map((side) => {
      const id = sim.seats[index * 2 + side];
      const c = id != null ? sim.customers.find((cc) => cc.id === id) : undefined;
      return c && c.phase === 'sitting' ? c : undefined;
    });
    // Chairs (backs on the outside) and anyone sitting in them.
    for (const side of [0, 1] as const) {
      const s = seatSpot(index, side);
      const outer = side === 0 ? s.x - 7 : s.x + 5;
      shadow(this.ctx, s.x, s.y, 14, 0.15);
      // Ladder-back chair: two posts with rails, then the seat.
      this.r(outer - 1, s.y - 26, 4, 26, OUTLINE);
      this.r(outer, s.y - 25, 2, 25, chairWood.base);
      this.r(side === 0 ? outer : outer + 1, s.y - 25, 1, 25, chairWood.hi);
      this.r(outer - 1, s.y - 27, 4, 2, chairWood.lo);
      this.r(outer, s.y - 27, 2, 1, chairWood.hi);
      this.r(s.x - 7, s.y - 11, 14, 5, OUTLINE);
      this.r(s.x - 6, s.y - 10, 12, 2, chairWood.hi);
      this.r(s.x - 6, s.y - 8, 12, 1, chairWood.lo);
      this.r(s.x - 6, s.y - 7, 2, 7, OUTLINE);
      this.r(s.x + 4, s.y - 7, 2, 7, OUTLINE);
      this.r(s.x - 6, s.y - 7, 1, 6, chairWood.lo);
      this.r(s.x + 4, s.y - 7, 1, 6, chairWood.lo);
      const c = seated[side];
      if (c) {
        const frames = character(c.look);
        const sprite = side === 0 ? frames.sitRight : frames.sitLeft;
        const bob = Math.floor(t * 1.1 + c.id) % 3 === 0 ? 1 : 0;
        this.ctx.drawImage(sprite, s.x - 9, s.y - (CHAR_H + 5) + bob);
      }
    }
    // Pedestal with a cross foot.
    this.r(table.x - 2, table.y - 14, 5, 13, OUTLINE);
    this.r(table.x - 1, table.y - 14, 3, 13, wood.lo);
    this.r(table.x - 1, table.y - 14, 1, 13, wood.base);
    this.r(table.x - 8, table.y - 4, 17, 4, OUTLINE);
    this.r(table.x - 7, table.y - 3, 15, 1, wood.base);
    this.r(table.x - 7, table.y - 2, 15, 1, wood.lo);
    // Round top in 3/4 view: a thick rim, then the boards on top.
    const cy = table.y - 19;
    const R = 13;
    const ellipse = (y: number, rx: number, ry: number, color: (dy: number) => string) => {
      for (let dy = -ry; dy <= ry; dy++) {
        const half = Math.round(Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) * rx);
        this.r(table.x - half, y + dy, half * 2 + 1, 1, color(dy));
      }
    };
    ellipse(cy - 1, R + 1, 6, () => OUTLINE);
    ellipse(cy + 2, R + 1, 6, () => OUTLINE);
    ellipse(cy + 2, R, 5, (dy) => (dy >= 3 ? wood.dark : wood.lo));
    ellipse(cy - 1, R, 5, (dy) => (dy <= -4 ? wood.hi : dy % 3 === 2 ? mix(wood.base, wood.lo, 0.5) : wood.base));
    this.r(table.x - 7, cy - 4, 5, 1, ramp(wood.hi).hi);
    this.r(table.x - 9, cy - 3, 2, 1, wood.hi);
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
