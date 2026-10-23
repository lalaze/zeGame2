import { curtainSource, TEXTILE_COLORS } from './textile-styles';
import { minaMapChoice } from '../game/regular-wishes';
import { paintMinaMap } from './regular-wish-art';
import { artRamp, mainTimber, mainCabinet, mainWall, mainFloor, mainCarpet, mainRug, mainSillPlant, mainSkyDisc, mainPickup, counterMaterial } from './main-room-surfaces';
import { getLocale, t } from '../i18n';
import { paintPixelSignText as paintSignText, pixelSignWidth } from './sign-lettering';
import { displayItemName } from '../ui/item-name';
import { formatTransactionMoney } from '../game/format';
import { mainKeyLight, paintWindowBounce } from './main-room-lighting';
import { cozyCafePart } from './cozy-cafe-art';
import { getGeneratedIngredientAdapter, getGeneratedMainEnvironmentAdapter } from './generated-main-art';
import { paintCozyService, paintCozyCakeDome } from './cozy-service-art';
// Canvas painters for the parts of a room that are baked into textures: the main
// café's back wall, floor, back bar and counter, the front wall along the bottom
// edge, and the props (tables, chairs, crates) that the Phaser scene places.
import { isDrink } from '../game/data';
import { itemPrice, menuItems } from '../game/economy';
import {
  BACK_BAR,
  BAR_AISLE,
  COUNTER,
  COUNTER_GATE,
  COUNTER_RETURN,
  DOOR_W,
  DOOR_X,
  FLOOR_Y,
  sceneHeight,
  floorY,
  queueSpot,
  PASS,
  PASTRY_CASE,
  SCENE_W,
  WINDOWS,
  baristaSpot,
  doorwayY,
  passageY,
} from '../game/layout';
import type { GameState } from '../game/state';
import { paintPassageFloor } from './passages';
import { glassReflection, leafySprig, timberBeam, treeLine, wallLantern } from './materials';
import { mix, ramp } from './color';
import { grain, paintRunner, paintRunnerJoin, wainscotColor } from './decor-art';
import { textWidth } from './font';
import { type Lighting, type Sun } from './lighting';
import { OUTLINE, itemIcon, pixelSprite } from './sprites';
import { paintPixelWindowVillage } from './pixel-window-village';
import { paintRain } from './weather-art';
import { pixelFloorDoorLight, projectFloorLayer } from './pixel-floor-projection';
import { MAIN_WALL_PLANE, MAIN_COUNTER_PLANE, mainPixelProjection, projectMainPlaneWorld } from './main-pixel-presentation';
import { paintPixelRoomShell } from './pixel-room-shell';
import { fineTableCanvas, fineChairCanvas } from './fine-dining-art';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import { paintFineBreadBasket, paintFineCakeDome, paintFineCupStack, paintFineStorageJar, FINE_COUNTER_PROP_BOUNDS } from './fine-counter-props-art';
import { paintFineTrailingPlant } from './fine-plant-art';
import { generatedMainRaster, paintGeneratedMain } from './generated-main-art';

const WOOD = { base: '#865332', hi: '#c98c4d', lo: '#67432b', dark: '#543425' };
type RoomLabel = [text: string, cx: number, y: number, width: number, height: number, color: string, scale?: number];
type WindowBounds = { x: number; y: number; w: number; h: number };

// Alpha-visible foot anchors from the selected, unchanged service PNG manifest.
// Each prop is fitted uniformly; its transparent padding never shifts its foot.
const SERVICE_FOOT_Y = {
  'service-machine': 425 / 433,
  'service-cupboard': 381 / 389,
  'service-cups': 286 / 294,
  'service-jars': 296 / 304,
} as const;

const ESPRESSO = [
  '..wwww..wwww..wwww............',
  '..wWWw..wWWw..wWWw............',
  '.XXXXXXXXXXXXXXCXXXXXXXXXXXXX.',
  '.CLLLLLLLLLLLLLLLLLLLLLLLLLLc.',
  '.Cccccccccccccccccccccccccccc.',
  '.CLBBBBBBBBBBBBBBBBBBBBBBBBBb.',
  '.CLBBBBBBBkkkkkkkkBBBBBBBBBBb.',
  '.CLBBBBBBkgWWWWWWgkBBBBBBBBBb.',
  '.CLBBBBBBkgWrrWWWgkBBBBBggBBb.',
  '.CLBBBBBBkgWWWrrWgkBBBBBrrBBb.',
  '.CLBBBBBBBkkkkkkkkBBBBBBBBBBb.',
  '.CLBBBBBBBBBBBBBBBBBBBBBBBBBb.',
  '.CLLLLLLLLLLLLLLLLLLLLLLLLLLb.',
  '.DDDDDDDDDDDDDDDDDDDDDDDDDDDD.',
  '.DnnCCCknnnnnnnnnnnnCCCknnnnD.',
  '.DnnCCckkkkkkkknnnnnCCckkkkkD.',
  '.DnnnccnnnnnnnnnnnnnnccnnnnnD.',
  '.DnnnCCnnnnnnnnnnnnnnCCnnnnnD.',
  '.DnnnWWnnnnnnnnnnnnnnWWnnnnnD.',
  '.DnnwwwwnnnnnnnnnnnnwwwwnnnnD.',
  '.DnnwWWwnnnnnnnnnnnnwWWwnnnnD.',
  '.DnnWWWWnnnnnnnnnnnnWWWWnnnnD.',
  '.XCCCCCCCCCCCCCCCCCCCCCCCCCCX.',
  '.cXcXcXcXcXcXcXcXcXcXcXcXcXcc.',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkk..',
];

const machineCache = new Map<string, HTMLCanvasElement>();
function espressoMachine(finish: string, density = 1): HTMLCanvasElement {
  const key = `${finish}:${density}`;
  let c = machineCache.get(key);
  if (!c) {
    const body = ramp(finish);
    const chrome = ramp('#c6c6af');
    c = pixelSprite(ESPRESSO, {
      B: body.base, b: body.lo, L: body.hi, D: body.dark,
      C: chrome.base, c: chrome.lo, X: chrome.hi,
      k: '#3a2a2a', n: '#4a3434', g: '#fdf6ec', r: '#d9384a', w: '#fdf6ec', W: '#dccdb9',
    }, 'sel', density);
    if (density > 1) {
      const ctx = c.getContext('2d')!;
      const metal = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color; ctx.fillRect(x * density, y * density, w * density, h * density);
      };
      // Fine authored hardware: folded steel lip, vent slots, cup rims and a gauge needle.
      metal(3, 4.5, 26, .5, '#f6f2d9');
      metal(3, 5, 26, .5, '#6f7a72');
      for (let x = 4; x < 29; x += 2) metal(x, 23.5, .5, 1.5, '#65736d');
      for (const x of [4, 12, 20]) {
        metal(x, 1.5, 3, .5, '#fff9e8');
        metal(x + .5, 2, 2, .5, '#a29d85');
      }
      metal(14, 8.5, .5, 2, '#a5503c');
      metal(14.5, 8, 1.5, .5, '#a5503c');
      metal(7, 16, .5, 3.5, '#edf1df');
      metal(22, 16, .5, 3.5, '#edf1df');
    }
    machineCache.set(key, c);
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

/** Fine countertop vine is rasterized once, then composited at its original footprint. */
const COUNTER_VINE = lazy(() => {
  const canvas = document.createElement('canvas'); canvas.width = 30; canvas.height = 68;
  const ctx = canvas.getContext('2d')!; ctx.scale(2, 2);
  paintFineTrailingPlant(ctx, 0, 0, 15, 34, 29);
  return canvas;
});

/** Burr grinder on the back bar, its hopper full of beans. */
const GRINDER = lazy(() => pixelSprite([
  '...MMMM...', '..gggggg..', '..gWbBbg..', '..gbBbbg..', '...gbbg...',
  '....cc....', '..MLLLLL..', '..LMmmMK..', '..LMggMK..', '..LMrrMK..',
  '..LMMMMK..', '...cC.k...', '...wW.w...', '.CCCCCCCC.', '.kkkkkkkk.',
], { g: '#acc9bd', W: '#f4e6c7', b: '#543425', B: '#986339', M: '#566352', L: '#a8b39a',
  m: '#788572', K: '#354331', k: '#39281f', r: '#bc6b43', c: '#aca788', C: '#e0d6b7', w: '#f4e6c7' }));

/** Layer cake on a turned brass stand, inside stepped domed glazing. */
const CAKE_DOME = lazy(() => pixelSprite([
  '.......kk.......', '......dkkd......', '....ddggggdd....', '...dWgggggggd...',
  '..dWggggrggggd..', '..dWggrcrggrgd..', '.dWggPPPPPPPggd.', '.dWggpcpcpcpggd.',
  '.dgggcccccccggd.', '.dgggpppppppggd.', '.dgggPPPPPPPggd.', '.ssssssssssssss.',
  '......SSSS......', '....SSSSSSSS....',
], { k: '#c8a15e', d: '#7baca2', g: '#d7e7d7', W: '#fff5df', r: '#b65b46',
  P: '#f3d8b1', p: '#c98967', c: '#fff0cf', s: '#e4c687', S: '#a88753' }));

// A bistro chair seen from the side, facing right: a ladder back, a cushion and splayed legs.
const CHAIR_ROWS = [
  '..wWW........', '.wWHwd.......', 'wWHwwd.......', 'wWwkwd.......', 'wWwwwd.......', 'wWHwwd.......',
  'wWkkwd.......', 'wWw.wd.......', 'wWw.wd.......', 'wWkkwd.......', 'wWwwwd.......', 'wWw.wd.......',
  'wWw.wd.......', 'wWw.wd.......', 'wWwwwd.......', 'wWcCCCCCCCCc.', 'wWccclcclcccc', 'wwkkkkkkkkkkk',
  'dWWwwwwwwwwwd', '.wd..d....dw.', '.wd..d....dw.', '.wdddddddddw.', '.w..d......w.', '.d.........d.',
];
const CHAIR_PALETTE = { w: '#865332', W: '#c98c4d', H: '#e0ab65', d: '#543425', c: '#627451', C: '#94a56d', l: '#b1bd7e', k: '#39281f' };

export const CHAIR_RIGHT = lazy(() => {
  const c = pixelSprite(CHAIR_ROWS, CHAIR_PALETTE);
  registerFineSpriteArt(c, fineChairCanvas('right'));
  return c;
});
export const CHAIR_LEFT = lazy(() => {
  const c = pixelSprite(CHAIR_ROWS.map((r) => [...r].reverse().join('')), CHAIR_PALETTE);
  registerFineSpriteArt(c, fineChairCanvas('left'));
  return c;
});

/** Gingham tablecloth colors: [lit top, drape, drape edge] x [white, stripe, crossing]. */
const GINGHAM = [
  ['#fff0cf', '#dc9980', '#b64c3d'],
  ['#e1c9a4', '#c57e64', '#973e32'],
  ['#c0a17c', '#a7604b', '#75372c'],
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
    GINGHAM[shade][(Math.floor((x - cx + 63) / 3) % 2) + (Math.floor(y / 3) % 2)];
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
  r(cx - 11, cy - RY + 1, 3, 1, '#fff6dd');
  // Stitched hem and tiny fabric folds on the hanging front, not a flat ellipse.
  for (let dx = -10; dx <= 10; dx += 4) {
    const dy = Math.round(Math.sqrt(1 - (dx / RX) ** 2) * RY);
    r(cx + dx, cy + dy + DROP - 1, 1, 1, '#f7dbae');
    r(cx + dx + 1, cy + dy + 2, 1, 2, '#8e493a');
  }
  r(cx - 4, foot - 2, 3, 1, '#9b805c');
  registerFineSpriteArt(c, fineTableCanvas());
  return c;
});

/**
 * A shaft of sunlight on the floor through an opening from x0 to x1 at y, slanting
 * by `lean` over `length` (negative to fall upward, from the front of the room).
 */
export function paintSunbeam(ctx: CanvasRenderingContext2D, sun: Sun, x0: number, x1: number, y: number, lean: number, length: number, detail?: { opacity: number; pixelSize: number }): void {
  if (sun.elevation <= 0 || sun.strength <= 0.02) return;
  ctx.save();
  ctx.fillStyle = sun.color;
  // Four panes, with the frame's shadow between them. Light disperses and
  // fades along its reach rather than ending in one hard rectangle.
  const width = x1 - x0;
  const reach = Math.max(1, Math.abs(length));
  const pixel = detail?.pixelSize === 0.5 ? 0.5 : 1;
  const snap = (v: number) => Math.round(v / pixel) * pixel;
  for (let step = 0; step < reach; step += pixel) {
    const p = step / reach;
    ctx.globalAlpha = Math.max(0, Math.min(1, detail?.opacity ?? 0.44)) * sun.strength * (1 - p * (detail ? 0.48 : 0.64));
    if (p > 0.43 && p < 0.48) continue;
    for (let pane = 0; pane < 2; pane++) {
      const start = x0 + pane * width / 2 + lean * p;
      ctx.fillRect(snap(start + 1), snap(y + Math.sign(length) * step), Math.max(pixel, snap(width / 2 - 3)), pixel);
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
  private wallpaper = 'wall_cream';
  curtain = 'curtain_classic';
  /** Rain on the window glass: the time it falls by, or null on a dry day. */
  rain: number | null = null;

  constructor(public ctx: CanvasRenderingContext2D, readonly density = 1, private readonly project = true) {}

  lightOpenings() { return WINDOWS.map(win => this.wallWindow(win)?.aperture ?? win); }

  private wallWindow(win: WindowBounds) {
    const cozy = this.density > 1 ? cozyCafePart('window') : undefined;
    if (cozy) {
      const w = win.w + 16, h = w * cozy.height / cozy.width;
      const x = win.x - 8, y = win.y + win.h + 1 - h * .84;
      return { source: curtainSource(cozy, this.curtain), sourceScale: 1, cropX: 0, cropY: 0, sourceWidth: cozy.width, sourceHeight: cozy.height,
        x, y, w, h, aperture: { x: x + w * .22, y: y + h * .12, w: w * .56, h: h * .73 } };
    }
    const source = this.density > 1 ? generatedMainRaster('wall-window') : null;
    if (!source || source.width <= 20 || source.height <= 20) return null;
    // Selected manifest: visible [10,10,623,504], aperture [125,87,386,296].
    // Anchor the actual sill plane (source y420) at the old y+h+1 surface so the
    // cat, botanical accent and OPEN sign keep their established attachments.
    const scale = (win.w + 16) / (source.width - 20);
    const x = win.x - 8, y = win.y + win.h + 1 - 410 * scale;
    return { source: curtainSource(source.source, this.curtain), sourceScale: source.sourceScale, cropX: 10, cropY: 10,
      sourceWidth: source.width - 20, sourceHeight: source.height - 20, x, y, w: win.w + 16, h: (source.height - 20) * scale,
      aperture: { x: x + 115 * scale, y: y + 77 * scale, w: 386 * scale, h: 296 * scale } };
  }

  private wallLamp(x: number, y: number): boolean {
    const source = this.density > 1 ? generatedMainRaster('wall-lamp') : null;
    if (!source || source.width <= 20 || source.height <= 20) return false;
    const sw = source.width - 20, sh = source.height - 20, height = 15, width = sw * height / sh;
    this.ctx.save(); this.ctx.imageSmoothingEnabled = false;
    const rs = source.sourceScale;
    this.ctx.drawImage(source.source, 10 * rs, 10 * rs, sw * rs, sh * rs, x + 4.5 - width / 2, y, width, height);
    this.ctx.restore(); return true;
  }

  private generatedMenuBoard(state: GameState, x: number, y: number, width: number, time: number): boolean {
    const source = this.density > 1 ? generatedMainRaster('wall-board') : null;
    if (!source || source.width <= 20 || source.height <= 20) return false;
    const sw = source.width - 20, sh = source.height - 20, scale = width / sw;
    const ctx = this.ctx;
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = false;
      // At width 100 the full frame is 49.123 high, ending above the y57 bar.
      // Its source-derived writing area remains clear of the carved frame.
      const rs = source.sourceScale;
      ctx.drawImage(source.source, 10 * rs, 10 * rs, sw * rs, sh * rs, x, y, width, sh * scale);
      ctx.beginPath(); ctx.rect(x + 51 * scale, y + 43 * scale, 697 * scale, 264 * scale); ctx.clip();
      this.paintChalkMenu(state, x + 51 * scale + 4, y + 43 * scale, 697 * scale - 8, time);
    } finally { ctx.restore(); }
    return true;
  }

  /** Keep short menus generous and longer menus legible, three named dishes per page. */
  private paintChalkMenu(state: GameState, x: number, y: number, width: number, time: number): void {
    const ctx = this.ctx, today = menuItems(state);
    const pages = Math.max(1, Math.ceil(today.length / 3));
    const page = Math.floor(Math.max(0, time) / 8) % pages;
    const chalk = '#f3e8ce', gold = '#edcb88', muted = '#9aae91';
    const headerWidth = width - (pages > 1 ? 23 : 0);
    this.sign(ctx, t('board.today'), x + headerWidth / 2, y, headerWidth - 3, 7, gold);
    if (pages > 1) this.sign(ctx, `${page + 1}/${pages}`, x + width - 10, y, 20, 7, muted);
    ctx.fillStyle = '#66816a'; ctx.fillRect(x + 2, y + 8.5, width - 4, .5);
    ctx.fillStyle = gold;
    for (const dx of [0, width - 1]) ctx.fillRect(x + dx, y + 8, 1, 1.5);

    const iconAt = (id: typeof today[number]['id'], left: number, top: number, size: number) => {
      const icon = itemIcon(id, false), scale = Math.min(size / icon.width, size / icon.height);
      const iw = icon.width * scale, ih = icon.height * scale;
      ctx.drawImage(fineSpriteArt(icon).canvas, left + (size - iw) / 2, top + (size - ih) / 2, iw, ih);
    };
    // A shop's own board shows the rounded price it charges, without the ledger's "≈".
    const priceOf = (item: typeof today[number]) => formatTransactionMoney(
      item.id.startsWith('sig:') ? item.basePrice : itemPrice(item, state.items[item.id])).replace(/^≈/, '');
    // Lettering keeps its size when a plane narrows the board, so each box is sized
    // for its projected interior: a box of `boxFor(w)` still holds `w` after projection
    // (the extra quarter unit absorbs floating-point loss in width * plane).
    const plane = this.labels ? this.labelPlane : 1;
    const boxFor = (textWidth: number) => (Math.ceil(textWidth) + 1.25) / plane;
    const pens = [1, 0.75, 0.5] as const;
    if (today.length === 0) {
      this.sign(ctx, t('board.empty'), x + width / 2, y + 18, width - 8, 7, muted);
    } else if (today.length === 1) {
      const item = today[0], textLeft = x + 29, textWidth = width - 31;
      const name = displayItemName(item.id, state), price = priceOf(item);
      const pen = pens.find((s) => boxFor(Math.max(pixelSignWidth(name, s), pixelSignWidth(price, s))) <= textWidth) ?? 0.5;
      iconAt(item.id, x + 6, y + 13, 17);
      this.sign(ctx, name, textLeft + textWidth / 2, y + 12, textWidth, 8, chalk, pen === 1 ? undefined : pen);
      this.sign(ctx, price, textLeft + textWidth / 2, y + 23, textWidth, 7, gold, pen === 1 ? undefined : pen);
    } else {
      // Names and prices are measured with the same pen the board paints with, so a
      // long late-game price ("$5500", "$13.9K") gets the room it needs instead of
      // becoming "$18…". A page whose widest row still cannot fit steps the pen down
      // a size, which keeps every name and price whole rather than elided.
      const iconWidth = 8, gap = 2, rowWidth = width - iconWidth - gap;
      const rows = today.slice(page * 3, page * 3 + 3).map((item) => ({ id: item.id, price: priceOf(item), name: displayItemName(item.id, state) }));
      const layout = (pen: number) => rows.map((row) => {
        const priceWidth = boxFor(pixelSignWidth(row.price, pen));
        return { ...row, priceWidth, nameWidth: Math.min(rowWidth - priceWidth, boxFor(pixelSignWidth(row.name, pen))), fits: priceWidth + boxFor(pixelSignWidth(row.name, pen)) <= rowWidth };
      });
      const scale = pens.find((pen) => layout(pen).every((row) => row.fits)) ?? 0.5;
      layout(scale).forEach((row, i) => {
        const rowY = y + 11 + i * 7.5;
        iconAt(row.id, x + 1, rowY, 6.5);
        this.sign(ctx, row.name, x + iconWidth + row.nameWidth / 2, rowY, row.nameWidth, 6.5, chalk, scale);
        this.sign(ctx, row.price, x + width - row.priceWidth / 2, rowY, row.priceWidth, 6.5, gold, scale);
      });
    }
  }

  // Service fixtures keep their selected artwork when the counter finish changes.
  private serviceBitmap(id: keyof typeof SERVICE_FOOT_Y, cx: number, foot: number, maxWidth: number, maxHeight: number): boolean {
    if (this.density <= 1) return false;
    const source = generatedMainRaster(id);
    if (!source) return false;
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
    const width = source.width * scale, height = source.height * scale;
    return paintGeneratedMain(this.ctx, id, cx - width / 2, foot - height * SERVICE_FOOT_Y[id], width, height);
  }

  private serviceBreadBasket(bx: number, foot: number, foreground = false): boolean {
    if (this.density <= 1) return false;
    const source = generatedMainRaster('service-basket');
    if (!source) return false;
    const scale = Math.min(22 / source.width, 15 / source.height);
    const width = source.width * scale, height = source.height * scale;
    const x = bx + 10 - width / 2, y = foot - height * 227 / 235;
    if (!foreground) return paintGeneratedMain(this.ctx, 'service-basket', x, y, width, height);

    // Renderer-only occlusion follows the selected 430×235 PNG's sloping rope
    // rim. A horizontal cut would hide bread above the actual middle/front lip.
    // The PNG is unchanged: only its original lower front face is redrawn over
    // the menu-driven icons. Rear wall and interior remain behind the food.
    const frontEdge = [[0,80],[80,94],[180,114],[280,134],[310,137],[420,65],[430,65],[430,235],[0,235]] as const;
    const ctx = this.ctx;
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = false;
      ctx.beginPath();
      frontEdge.forEach(([px,py],i) => {
        const dx = x + px / 430 * width, dy = y + py / 235 * height;
        if (i === 0) ctx.moveTo(dx,dy); else ctx.lineTo(dx,dy);
      });
      ctx.closePath();
      ctx.clip();
      const cropTop = source.height * 65 / 235;
      const rs = source.sourceScale;
      ctx.drawImage(source.source, 0, cropTop * rs, source.contentWidth, (source.height - cropTop) * rs,
        x, y + height * 65 / 235, width, height * (1 - 65 / 235));
    } finally {
      ctx.restore();
    }
    return true;
  }

  private planeCanvas: HTMLCanvasElement | null = null;
  private floorCanvas: HTMLCanvasElement | null = null;
  private projectedFloor: HTMLCanvasElement | null = null;
  private floorSignature = '';
  private labels: RoomLabel[] | null = null;
  /** Horizontal factor the current plane applies to label boxes, but not to their glyphs. */
  private labelPlane = 1;

  private sign(ctx: CanvasRenderingContext2D, ...label: RoomLabel): void {
    if (this.labels) this.labels.push(label);
    else paintSignText(ctx, ...label);
  }

  /** Upright architecture stays upright; raster scaling keeps the fine pixel edges crisp. */
  withPlane(footY: number, paint: () => void): void {
    if (this.density === 1 || !this.project) { paint(); return; }
    const source = this.planeCanvas ??= document.createElement('canvas');
    const H = sceneHeight();
    if (source.width !== SCENE_W * 2 || source.height !== H * 2) {
      source.width = SCENE_W * 2; source.height = H * 2;
    }
    const target = this.ctx, ctx = source.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, source.width, source.height);
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const a = projectMainPlaneWorld({ x: 0, y: footY }, footY);
    const b = projectMainPlaneWorld({ x: SCENE_W, y: footY }, footY);
    const labels: RoomLabel[] = [], previousLabels = this.labels, previousPlane = this.labelPlane;
    this.labels = labels; this.ctx = ctx; this.labelPlane = (b.x - a.x) / SCENE_W;
    try { paint(); } finally { this.ctx = target; this.labels = previousLabels; this.labelPlane = previousPlane; }
    target.save(); target.imageSmoothingEnabled = false;
    target.drawImage(source, Math.round(a.x * 2) / 2, 0, Math.round((b.x - a.x) * 2) / 2, H);
    target.restore();
    // Lettering is painted AFTER the horizontal plane resample. One-art-pixel
    // Chinese strokes must not be dropped by the room's 90% wall projection.
    for (const [text, cx, y, width, height, color, scale] of labels) {
      paintSignText(target, text, projectMainPlaneWorld({ x: cx, y: footY }, footY).x,
        y, width * (b.x - a.x) / SCENE_W, height, color, scale);
    }
  }


  /** Full generated image, aligned by measured opaque bounds; alpha is preserved. */
  private referenceMachine(left: number, foot: number): boolean {
    if (this.density <= 1) return false;
    const raster = generatedMainRaster('reference-machine');
    if (!raster) return false;
    const scale = Math.min(32 / raster.width, 26 / raster.height);
    return paintGeneratedMain(this.ctx, 'reference-machine',
      left, foot - raster.height * scale, raster.width * scale, raster.height * scale);
  }

  private r(x: number, y: number, w: number, h: number, color: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, Math.round(w * 2) / 2, Math.round(h * 2) / 2);
  }

  /** Warm wall returns and cabinet tops share the floor's upper-left key. */
  drawArchitecturalLight(light: Lighting): void {
    const key = mainKeyLight(light.sun);
    if (!key.strength) return;
    this.withPlane(MAIN_WALL_PLANE, () => {
      const ctx = this.ctx; ctx.save();
      ctx.beginPath(); ctx.rect(7, 8, SCENE_W - 14, 68); ctx.clip();
      for (const opening of this.lightOpenings()) {
        // Window/curtain and menu layers are painted afterwards; only exposed
        // plaster, timber and the window cabinet receive this wash.
        for (let y = 10; y < 76; y += .5) {
          const t = (y - 10) / 66;
          ctx.fillStyle = '#ffe1a0'; ctx.globalAlpha = key.strength * .19;
          ctx.fillRect(opening.x - 14 + t * 20, y, 9, .5);
          ctx.globalAlpha = key.strength * .08;
          ctx.fillRect(opening.x - 17 + t * 20, y, 3, .5);
        }
        ctx.fillStyle = '#ffe5ae'; ctx.globalAlpha = key.strength * .28;
        ctx.fillRect(opening.x - 2, 59, opening.w + 10, 2);
        ctx.globalAlpha = key.strength * .12;
        ctx.fillRect(opening.x + 7, 61, opening.w - 7, 9);
      }
      ctx.restore();
    });
  }

  /** Masked to the counter body; never fills transparent canvas around it. */
  drawCounterLight(light: Lighting): void {
    const key = mainKeyLight(light.sun);
    if (!key.strength) return;
    this.withPlane(MAIN_COUNTER_PLANE, () => {
      const ctx = this.ctx; ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#ffe3a6';
      ctx.globalAlpha = key.strength * .12;
      ctx.fillRect(COUNTER.x, COUNTER.top, COUNTER.w, 4);
      ctx.globalAlpha = key.strength * .055;
      ctx.fillRect(COUNTER.x, COUNTER.top + 4, COUNTER.w, COUNTER.front - COUNTER.top - 4);
      ctx.fillStyle = '#63422f'; ctx.globalAlpha = .09;
      ctx.fillRect(COUNTER.x, COUNTER.front, COUNTER.w, 2);
      ctx.restore();
    });
  }

  drawWall(wallpaper: string, t: number): void {
    this.wallpaper = wallpaper;
    this.withPlane(80, () => this.drawWallLogical(wallpaper, t));
  }

  private drawWallLogical(wallpaper: string, _t: number): void {
    mainWall(this.ctx, wallpaper);
    // Small permanent lanterns and trailing herbs are part of the architecture.
    if (!this.wallLamp(76,10)) wallLantern(this.ctx, 76, 10);
    if (!this.wallLamp(219,8)) wallLantern(this.ctx, 219, 8);
    for (const x of [10, 310]) {
      this.r(x - 3, 9, 6, 3, '#815638');
      leafySprig(this.ctx, x, 13, 4, x);
      leafySprig(this.ctx, x - 1, 18, 3, x + 2);
      this.r(x - 1, 21, 1, 3, '#627451');
    }
  }

  /** A window onto the street; `sign` hangs the OPEN (true) or CLOSED (false) sign in it. */
  drawWindow(win: { x: number; y: number; w: number; h: number }, light: Lighting, t: number, sign: boolean | null): void {
    this.withPlane(80, () => this.drawWindowLogical(win, light, t, sign));
  }

  private drawWindowLogical(win: { x: number; y: number; w: number; h: number }, light: Lighting, t: number, sign: boolean | null): void {
    const { x, y, w, h } = win;
    const night = light.dark > 0.6;
    const bands = light.sky;
    const frame = ramp('#9a6740');
    const generated = this.wallWindow(win);
    const ctx = this.ctx;
    if (!generated) {
      this.r(x - 4, y - 4, w + 8, h + 8, OUTLINE);
      this.r(x - 3, y - 3, w + 6, h + 6, frame.base);
      this.r(x - 3, y - 3, w + 6, 1, frame.hi);
    }
    {
      const { x, y, w, h } = generated?.aperture ?? win;
      bands.forEach((c, i) => this.r(x, y + (i * h) / 3, w, h / 3 + 1, c));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      if (night) {
        const stars = [[4, 4], [15, 9], [27, 3], [38, 11], [9, 16], [33, 20], [21, 14], [46, 6]];
        stars.forEach(([sx, sy], i) => {
          if ((Math.floor(t * 1.5) + i) % 4 !== 0) this.r(x + sx / 46 * w, y + sy / 38 * h, 1, 1, '#fff6c8');
        });
        mainSkyDisc(ctx, x + w - 8, y + 4, true);
      } else {
        // The sun crosses the window and sinks behind the hills.
        const { sun } = light;
        if (sun.elevation > 0) mainSkyDisc(ctx, x + 2 + sun.x * (w - 10), y + 3 + (1 - sun.elevation) * (h - 14), false);
        const generatedCloud = this.density > 1 && getGeneratedMainEnvironmentAdapter()?.readyIds.includes('cloud');
        for (const [offset, cy] of (generatedCloud ? [] : [[0, 7], [34, 15]])) {
          const cx = x - 16 + ((t * 2.5 + offset) % (w + 24));
          this.r(cx, y + cy, 14, 3, light.cloud);
          this.r(cx + 3, y + cy - 2, 8, 2, light.cloud);
          this.r(cx + 1, y + cy + 3, 12, 1, mix(light.cloud, light.sky[2], 0.5));
        }
      }
      // Hills and a tree line outside, falling into shadow at dusk.
      const land = (day: string, dark: string) => mix(day, dark, light.dark);
      if (this.density > 1) {
        if (!getGeneratedMainEnvironmentAdapter()?.paintWindowScenery(ctx, x, y, w, h, light.dark, t, false))
          paintPixelWindowVillage(ctx, x, y, w, h, light.dark);
        else if (light.dark > 0) {
          // The painted trees and roofs fall into blue silhouette below the night sky.
          const top = y + h * .3, fade = h * .2;
          for (let row = top; row < y + h; row += .5) {
            ctx.globalAlpha = light.dark * .62 * Math.min(1, (row - top) / fade);
            this.r(x, row, w, .5, '#16213a');
          }
          ctx.globalAlpha = 1;
        }
      }
      else {
        this.r(x, y + h - 10, w, 10, land('#7cbf5e', '#243d33'));
        this.r(x, y + h - 4, w, 4, land('#5ea24a', '#1b3029'));
        treeLine(ctx, x, y + h - 21, w, 17, light.dark);
      }
      if (this.rain !== null) paintRain(ctx, x, y, w, h, this.rain);
      glassReflection(ctx, x, y, w, h, 0.13);
      ctx.restore();
    }
    if (generated) {
      ctx.save(); ctx.imageSmoothingEnabled = false;
      const rs = generated.sourceScale;
      ctx.drawImage(generated.source, generated.cropX * rs, generated.cropY * rs, generated.sourceWidth * rs, generated.sourceHeight * rs,
        generated.x, generated.y, generated.w, generated.h);
      ctx.restore();
    } else {
      // Mullions and the sill.
      this.r(x + w / 2 - 1, y, 3, h, frame.base);
      this.r(x + w / 2 - 1, y, 1, h, frame.hi);
      this.r(x, y + h / 2 - 1, w, 3, frame.base);
      this.r(x, y + h / 2 - 1, w, 1, frame.hi);
      // Gathered gingham curtains: cream checks, dark fold valleys and a brass tie.
      for (const [cx, dir] of [[x - 6, 1], [x + w - 1, -1]] as const) {
        for (let yy = -5; yy < h; yy++) for (let xx = 0; xx < 7; xx++) {
          const check = (Math.floor((xx + 1) / 2) % 2) + (Math.floor((yy + 8) / 3) % 2);
          const fold = xx === (dir === 1 ? 0 : 6) || xx === 3;
          const tint = TEXTILE_COLORS[this.curtain];
          const base = tint ? '#' + tint.map(c => c.toString(16).padStart(2, '0')).join('') : '#a64c3e';
          const color = ['#f4dfb7', mix('#f4dfb7', base, .55), base][check];
          this.r(cx + xx, y + yy, 1, 1, fold ? mix(color, '#653628', 0.24) : color);
        }
        this.r(cx - 1, y - 6, 9, 1, '#543425');
        this.r(cx, y - 5, 7, 1, '#e5b568');
        this.r(cx, y + h - 9, 7, 2, '#b78b4f');
        this.r(cx, y + h - 9, 6, 1, '#edc682');
        this.r(cx + 2, y + h - 7, 1, 3, '#f2dca2');
        this.r(cx + 3, y + h - 5, 2, 1, '#ae6d3c');
      }
      this.r(x - 8, y + h + 1, w + 16, 4, frame.base);
      this.r(x - 8, y + h + 1, w + 16, 1, frame.hi);
      this.r(x - 8, y + h + 5, w + 16, 1, OUTLINE);
      grain(ctx, x - 6, y + h + 2, w + 12, 2, WOOD, 'h', x);
      this.r(x - 6, y + h + 5, 4, 2, WOOD.dark);
      this.r(x + w + 2, y + h + 5, 4, 2, WOOD.dark);
    }
    // Equipped sill plants are drawn separately at their established anchor.
    if (sign === null) return;
    // The OPEN / CLOSED sign hangs on two strings from the crossbar, below the neon.
    const word = getLocale() === 'zh' ? (sign ? '营业中' : '休息中') : (sign ? 'OPEN' : 'CLOSED');
    const sw = getLocale() === 'zh' ? 27 : textWidth(word) + 6;
    const sx = Math.round(x + (w - sw) / 2);
    const bar = y + h / 2 + 2;
    const sy = bar + 3;
    this.r(sx + 2, bar, 1, sy - bar, '#4a2e1e');
    this.r(sx + sw - 3, bar, 1, sy - bar, '#4a2e1e');
    mainTimber(ctx, sx, sy, sw, 10);
    this.r(sx + 1.5, sy + 1.5, sw - 3, 7, sign ? artRamp('cloth-7')[2] : artRamp('sage')[0]);
    this.r(sx + 2, sy + 2, sw - 4, .5, sign ? artRamp('floor')[4] : artRamp('sage')[2]);
    this.sign(this.ctx, word, sx + sw / 2, sy + 2, sw - 4, 6, sign ? artRamp('gingham')[0] : artRamp('cloth-7')[2]);
  }


  drawSill(id: string, cx: number, foot: number): void {
    this.withPlane(MAIN_WALL_PLANE, () => mainSillPlant(this.ctx, id, cx, foot));
  }

  drawMenuBoard(state: GameState, time = 0): void {
    this.withPlane(80, () => this.drawMenuBoardLogical(state, time));
  }

  private drawMenuBoardLogical(state: GameState, time: number): void {
    const x = 110;
    const y = 7;
    const w = 100;
    const h = 44;
    if (this.generatedMenuBoard(state,x,y,w,time)) return;
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
    this.r(x + 2, y + 2, w - 4, 1, '#c48c52');
    this.r(x + 2, y + 2, 1, h - 4, '#bf8750');
    this.r(x + w - 3, y + 2, 1, h - 4, '#543425');
    // Hand-drawn chalk sprigs bracket the real menu, leaving item slots clear.
    for (const side of [1, -1]) for (let leaf = 0; leaf < 5; leaf++) {
      const vx = side > 0 ? x + 7 : x + w - 8, vy = y + 14 + leaf * 4;
      this.r(vx, vy, 1, 4, '#68806a');
      this.r(vx + side, vy + 1, 2, 1, '#68806a');
      this.r(vx - side * 2, vy + 2, 2, 1, '#4c6854');
    }
    // Chalk dust and doodles.
    this.r(x + 8, y + h - 7, 14, 1, '#4f6e5c');
    this.r(x + w - 22, y + 7, 12, 1, '#4f6e5c');
    this.r(x + w - 14, y + h - 9, 6, 1, '#4f6e5c');
    this.paintChalkMenu(state, x + 10, y + 5, w - 20, time);
    // Chalk tray.
    this.r(x + 6, y + h, w - 12, 2, frame.lo);
    this.r(x + 14, y + h - 1, 5, 1, '#f5efe0');
  }


  /** The low cabinet behind the baristas with the café's odds and ends on top. */
  drawBackBar(state: GameState, counter: string): void {
    this.withPlane(80, () => this.drawBackBarLogical(state, counter));
  }

  private drawBackBarLogical(state: GameState, counter: string): void {
    const { x, w, top, front } = BACK_BAR;
    const bottom = FLOOR_Y;
    mainCabinet(this.ctx, counter, x, top, w, front - top, bottom - front, true);

    const sit = top + 4; // Items stand a little back from the front edge.
    const ctx = this.ctx;
    // Left of the menu board: the grinder and jars of beans and tea.
    if (!paintCozyService(ctx, 'cozy-grinder', x + 2, sit + 1, 12, 19)) {
      const grinder = GRINDER();
      ctx.drawImage(grinder, x + 2, sit - grinder.height + 1);
    }
    if (this.serviceBitmap('service-jars', x + 25.5, sit + 1, 21, 15)) {
      // Empty glass storage props are decorative; they imply no ingredient count.
    } else if (this.density > 1) {
      paintFineStorageJar(ctx, x + 15, sit + 1 - FINE_COUNTER_PROP_BOUNDS.storageJar.beans.h, 'beans');
      paintFineStorageJar(ctx, x + 26, sit + 1 - FINE_COUNTER_PROP_BOUNDS.storageJar.tea.h, 'tea');
    } else {
      this.jar(x + 15, sit, 11, '#6e3f24', '#9c6538');
      this.jar(x + 26, sit, 9, '#6f9a52', '#9fc47e');
    }
    // Under the board: cups on saucers, a milk pitcher, then the bread basket (a sack
    // of beans when there are no breads today) and a cake under a glass dome. The
    // pass stands beyond them.
    for (let i = 0; i < 3; i++) {
      const cx = 116 + i * 11;
      if (this.serviceBitmap('service-cups', cx + 5, sit + 1, 10, 13)) continue;
      if (this.density > 1) {
        paintFineCupStack(ctx, cx, sit + 1 - FINE_COUNTER_PROP_BOUNDS.cupStack.h, (i + 1) as 1 | 2 | 3);
        continue;
      }
      // A tapered porcelain bowl, open dark rim and an ear-shaped handle.
      this.r(cx, sit - 1, 9, 1, '#a89779');
      this.r(cx + 1, sit - 2, 7, 1, '#fff2d7');
      this.r(cx + 1, sit - 7, 6, 2, '#543425');
      this.r(cx + 1, sit - 7, 6, 1, '#f4e6c7');
      this.r(cx + 1, sit - 5, 6, 2, '#f4e6c7');
      this.r(cx + 2, sit - 3, 4, 1, '#d5c5a4');
      this.r(cx + 2, sit - 5, 1, 2, '#fff8e4');
      this.r(cx + 6, sit - 6, 3, 3, '#ad9d81');
      this.r(cx + 7, sit - 5, 1, 1, '#624731');
      this.r(cx + 6, sit - 6, 2, 1, '#fff0cf');
    }
    const pitcher = ramp('#c9d3d8');
    const jx = 151;
    if (!paintCozyService(ctx, 'cozy-milk-pitcher', jx - 1, sit + 1, 11, 10)) {
    this.r(jx, sit - 9, 8, 9, OUTLINE);
    this.r(jx + 1, sit - 8, 6, 8, pitcher.base);
    this.r(jx + 1, sit - 8, 1, 8, pitcher.hi);
    this.r(jx - 1, sit - 9, 2, 2, OUTLINE);
    this.r(jx + 8, sit - 7, 1, 4, OUTLINE);
    this.r(jx + 2, sit - 7, 1, 6, '#eef0d6');
    this.r(jx + 5, sit - 6, 2, 5, '#939b84');
    this.r(jx + 2, sit - 2, 4, 1, '#b7b9a0');
    }
    const dessert = menuItems(state).find(m => m.category === 'pastry' &&
      (state.phase === 'prep' ? state.bakePlan[m.id] ?? 0 : state.shelf[m.id] ?? 0) > 0);
    if (paintCozyCakeDome(ctx, 188, sit + 1, dessert ? itemIcon(dessert.id, false) : undefined)) {
      // The empty dome and the current menu's real cake stay separate layers.
    } else if (this.density > 1) paintFineCakeDome(ctx, 188, sit + 1 - FINE_COUNTER_PROP_BOUNDS.cakeDome.h);
    else {
      const dome = CAKE_DOME();
      ctx.drawImage(dome, 188, sit - dome.height + 1);
    }
    const breads = menuItems(state).filter((m) => m.category === 'bread').slice(0, 2);
    const bx = 164;
    if (breads.length > 0) {
      const generatedBasket = this.serviceBreadBasket(bx, sit + 1);
      breads.forEach((m, i) => {
        const icon = itemIcon(m.id);
        ctx.drawImage(fineSpriteArt(icon).canvas, bx + 1 + i * 9, sit - 6 - icon.height + 3, icon.width, icon.height);
      });
      if (generatedBasket) this.serviceBreadBasket(bx, sit + 1, true);
      else if (this.density > 1) paintFineBreadBasket(ctx, bx - 1, sit + 1 - FINE_COUNTER_PROP_BOUNDS.breadBasket.h, false);
      else {
        const wicker = ramp('#b58145');
        this.r(bx - 1, sit - 7, 22, 2, '#543425');
        this.r(bx, sit - 7, 20, 1, '#e3bb78');
        for (let row = 0; row < 5; row++) {
          const inset = row > 2 ? 1 : 0;
          this.r(bx + inset, sit - 5 + row, 20 - inset * 2, 1, row % 2 ? wicker.base : '#d0a05c');
          for (let column = 1 + row % 2; column < 19 - inset; column += 3) this.r(bx + column, sit - 5 + row, 1, 1, '#815a32');
        }
        this.r(bx + 2, sit, 16, 1, '#785030');
        for (const hx of [bx, bx + 17]) {
          this.r(hx, sit - 9, 3, 2, '#aa7d46');
          this.r(hx + 1, sit - 8, 1, 1, '#eed49b');
        }
      }
    } else if (getGeneratedIngredientAdapter()?.artwork('beans')) {
      const beans = getGeneratedIngredientAdapter()!.artwork('beans')!;
      ctx.drawImage(beans, bx, sit - 14, 20, 15);
    } else {
      const sack = ramp('#c9a873');
      this.r(bx + 1, sit - 13, 18, 14, OUTLINE);
      this.r(bx + 2, sit - 12, 16, 12, sack.base);
      this.r(bx + 2, sit - 12, 2, 12, sack.hi);
      this.r(bx + 15, sit - 11, 3, 11, sack.lo);
      this.r(bx + 4, sit - 14, 12, 3, OUTLINE);
      this.r(bx + 5, sit - 13, 10, 2, '#6e3f24');
      this.r(bx + 7, sit - 13, 2, 1, '#9c6538');
      this.r(bx + 6, sit - 8, 8, 5, '#e7d5a9');
      this.r(bx + 8, sit - 7, 4, 3, '#87633c');
      this.r(bx + 10, sit - 7, 1, 3, '#c6a367');
      this.r(bx + 3, sit - 9, 1, 6, '#b6935b');
      this.r(bx + 13, sit - 11, 2, 7, '#ad8650');
      for (let sy = sit - 11; sy < sit - 1; sy += 2) this.r(bx + 5, sy, 1, 1, '#e8d3a2');
    }
  }

  private jar(x: number, base: number, h: number, fill: string, fleck: string): void {
    const y = base - h;
    // Square storage jar with rounded shoulders, visible glass lip and cork lid.
    this.r(x + 1, y - 1, 6, 1, '#8da595');
    this.r(x, y, 8, h - 1, '#6e8375');
    this.r(x + 1, y, 6, h, '#cbd8bb');
    this.r(x + 1, y + 3, 6, h - 4, fill);
    for (let i = 0; i < 5; i++) this.r(x + 1 + ((i * 3) % 6), y + 4 + ((i * 2) % Math.max(1, h - 6)), 1, 1, fleck);
    this.r(x + 1, y + 1, 1, h - 3, '#f8f0d6');
    this.r(x + 6, y + 2, 1, h - 3, '#9daf95');
    this.r(x + 2, y + 4, 4, 4, '#f4e6c7');
    this.r(x + 3, y + 5, 2, 1, '#98764c');
    this.r(x + 3, y + 6, 1, 1, '#bc9361');
    this.r(x - 1, y - 3, 10, 2, '#91613b');
    this.r(x, y - 4, 8, 1, '#543425');
    this.r(x, y - 3, 8, 1, '#d0a261');
    for (const lx of [x + 1, x + 4, x + 7]) this.r(lx, y - 2, 1, 1, '#b5814a');
  }

  drawFloor(floor: string, rug: string, light: Lighting, H: number): void {
    if (this.density > 1 && this.project) {
      const doorLight = pixelFloorDoorLight(this.kitchenDoor);
      const signature = JSON.stringify([floor, rug, light, H, doorLight, !!generatedMainRaster('wall-window')]);
      const source = this.floorCanvas ??= document.createElement('canvas');
      const projected = this.projectedFloor ??= document.createElement('canvas');
      if (this.floorSignature !== signature) {
        this.floorSignature = signature;
        source.width = projected.width = SCENE_W * 2;
        source.height = projected.height = H * 2;
        const ctx = source.getContext('2d')!, out = projected.getContext('2d')!;
        ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
        const painter = new RoomPainter(ctx, 2, false); painter.kitchenDoor = doorLight;
        painter.drawFloor(floor, rug, light, H);
        out.setTransform(2, 0, 0, 2, 0, 0);
        projectFloorLayer(out, source, mainPixelProjection(H));
      }
      paintPixelRoomShell(this.ctx, H, mainPixelProjection(H), this.wallpaper);
      this.ctx.drawImage(projected, 0, 0, SCENE_W, H);
      return;
    }
    mainFloor(this.ctx, floor, H);
    // Shadow where the floor meets the wall.
    this.ctx.save();
    for (let i = 0; i < 3; i++) {
      this.ctx.globalAlpha = 0.18 - i * 0.05;
      this.r(0, FLOOR_Y + i, SCENE_W, 1, artRamp('walnut')[0]);
    }
    this.ctx.restore();
    // The quieter continuous stone floor lets the furniture define each dining bay.
    if (!cozyCafePart('table')) this.drawDiningBays();
    // The guest cross-aisle connects the entry and reading room.
    paintPassageFloor(this.ctx, 'main');
    // The rug lies in the open floor between the counter and the front door;
    // without one there's a plain runner leading in from the door.
    const newRunner = mainCarpet(this.ctx, H, rug === 'rug_none');
    if (rug === 'rug_none') { if (!newRunner) this.drawRunner(H); }
    else mainRug(this.ctx, rug, 133, floorY(150), 54, H - 20 - floorY(150));
    this.drawQueueMarks();
    if (!newRunner) this.drawDoormat(H);
    const ctx = this.ctx;
    // Golden pane footprints cross the tile joints and fade beyond the dining bays.
    for (const win of WINDOWS) {
      const opening = this.wallWindow(win)?.aperture ?? win;
      paintWindowBounce(ctx, opening.x, opening.w, FLOOR_Y, light.sun);
    }

    // Kitchen light spilling in through the door in the left wall while it's open.
    if (this.kitchenDoor > 0.05) {
      const y = doorwayY('main', 'left');
      ctx.save();
      ctx.globalAlpha = 0.18 * this.kitchenDoor;
      ctx.fillStyle = artRamp('floor')[4];
      ctx.beginPath();
      ctx.moveTo(0, y - 14);
      ctx.lineTo(0, y + 14);
      ctx.lineTo(26, y + 22);
      ctx.lineTo(26, y - 8);
      ctx.fill();
      ctx.restore();
    }
    this.drawBarMat();
    // The staff opening shares the room's floor; its short threshold is painted
    // with the doorway frame, rather than a separate arrow-marked path.
    // Shadow cast by the counter, and the room darkening toward its edges.
    ctx.save();
    for (let row = 0; row < 10; row++) {
      ctx.globalAlpha = (0.15 + light.sun.strength * 0.05) * (1 - row / 11);
      this.r(COUNTER.x + row * .5, COUNTER.bottom + row, COUNTER.w + COUNTER_GATE.w, 1, artRamp('walnut')[0]);
    }
    ctx.globalAlpha = 0.24;
    this.r(COUNTER.x, COUNTER.bottom, COUNTER.w + COUNTER_GATE.w, 1, artRamp('walnut')[0]);
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.11 - i * 0.025;
      this.r(0, H - 6 * (i + 1), SCENE_W, 6, artRamp('walnut')[0]);
      ctx.globalAlpha = 0.05;
      this.r(0, FLOOR_Y, 3 * (4 - i), H - FLOOR_Y, artRamp('walnut')[0]);
      this.r(SCENE_W - 3 * (4 - i), FLOOR_Y, 3 * (4 - i), H - FLOOR_Y, artRamp('walnut')[0]);
    }
    ctx.restore();
  }

  /** Shallow inlaid borders define two dining bays without granting paid rugs. */
  private drawDiningBays(): void {
    const top = floorY(151), bottom = floorY(230);
    const ctx = this.ctx;
    ctx.save();
    for (const x of [13, 193]) {
      // Fine inlaid borders, without darkening entire dining bays.
      ctx.globalAlpha = 0.04;
      this.r(x, top, 114, bottom - top, '#9b6747');
      ctx.globalAlpha = 0.35;
      this.r(x, top, 114, 1, '#a97954');
      this.r(x, bottom - 1, 114, 1, '#a97954');
      this.r(x, top, 1, bottom - top, '#a97954');
      this.r(x + 113, top, 1, bottom - top, '#a97954');
      ctx.globalAlpha = 0.45;
      for (const cx of [x + 3, x + 108]) for (const cy of [top + 3, bottom - 6]) {
        this.r(cx, cy, 3, 3, '#f2d6aa');
        this.r(cx + 1, cy + 1, 1, 1, '#9b6747');
      }
    }
    ctx.restore();
  }

  /** Small brass queue dots leave the shared cross-aisle and central exit clear. */
  private drawQueueMarks(): void {
    for (let i = 0; i < 6; i++) {
      const { x, y } = queueSpot(i);
      this.r(x - 2, y - 1, 5, 2, '#b79b70');
      this.r(x - 1, y - 1, 3, 1, '#ecd8ac');
    }
  }

  /** The former freestanding window cupboard has been removed from the room.
   * Keep the painter entry point for existing scene/preview callers. */
  drawServiceCupboards(_counter: string): void {}

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
    paintRunner(this.ctx, x, y, w, 8, 'h');
  }

  /** A woven runner from the front door up to the counter. */
  private drawRunner(H: number): void {
    const w = 30;
    const x = SCENE_W / 2 - w / 2;
    const y = passageY() - 7;
    const h = H - FRONT_WALL - 9 - y;
    // One T-shaped jute runner: no separate head fringe or exposed floor gap.
    paintRunner(this.ctx, x, y, w, h, 'v');
    paintRunnerJoin(this.ctx, x, y, w, 14);
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
      timberBeam(this.ctx, 0, y - 1, SCENE_W, FRONT_WALL + 1, false, garden ? '#627451' : wainscotColor(wallpaper));
      return;
    }
    for (const [x, w] of [[0, DOOR_X - 3], [DOOR_X + DOOR_W + 3, SCENE_W - DOOR_X - DOOR_W - 3]]) {
      this.r(x, y - 1, w, 1, OUTLINE);
      this.r(x, y, w, FRONT_WALL, wood.lo);
      this.r(x, y, w, 1, wood.hi);
      this.r(x, y + 1, w, 2, wood.base);
      timberBeam(this.ctx, x, y - 1, w, FRONT_WALL + 1, false, wainscotColor(wallpaper));
    }
    // The doorway: stone step outside, a threshold, and chunky frame posts.
    this.r(DOOR_X, y, DOOR_W, FRONT_WALL, '#a89a8c');
    this.r(DOOR_X, y, DOOR_W, 1, '#d6cabd');
    this.r(DOOR_X, y + 1, DOOR_W, 1, '#c4b7a9');
    for (let i = 4; i < DOOR_W; i += 8) this.r(DOOR_X + i, y + 2, 1, FRONT_WALL - 2, '#8f8174');
    if (this.density > 1) getGeneratedMainEnvironmentAdapter()?.paintThreshold(this.ctx, DOOR_X, y, DOOR_W, FRONT_WALL);
    for (const px of [DOOR_X - 4, DOOR_X + DOOR_W]) {
      this.r(px - 1, y - 8, 6, FRONT_WALL + 8, OUTLINE);
      this.r(px, y - 7, 4, FRONT_WALL + 7, wood.base);
      this.r(px, y - 7, 4, 1, wood.hi);
      this.r(px + 3, y - 6, 1, FRONT_WALL + 6, wood.lo);
    }
  }

  /** The counter and everything on it; `cups` are the drinks being made right now. */
  drawCounter(state: GameState, counter: string, t: number, cups: CounterCup[]): void {
    this.withPlane(127, () => this.drawCounterLogical(state, counter, t, cups));
  }

  private drawCounterLogical(state: GameState, counter: string, t: number, cups: CounterCup[]): void {
    const { x, w, top, front, bottom } = COUNTER;
    this.drawReturn(counter);
    mainCabinet(this.ctx, counter, x, top, w, front - top, bottom - front);

    // Espresso machine; its finish gets fancier with upgrades.
    const lvl = state.upgrades.machine;
    const finish = lvl >= 15 ? '#e7b84a' : lvl >= 10 ? '#c9814f' : lvl >= 5 ? '#d9574a' : '#9fb3bd';
    const brewing = cups.length > 0;
    const mx = MACHINE_X;
    const my = MACHINE_Y;
    if (!this.referenceMachine(mx - 2, my + 24) && !this.serviceBitmap('service-machine', mx + 13, my + 24, 30, 25)) {
      const chrome = ramp('#c9d3d8');
      // The selected bitmap already includes both steam wands; legacy art needs
      // its separate wand. Live brew streams and upgrade cues remain below.
      this.r(mx - 3, my + 9, 3, 1, OUTLINE);
      this.r(mx - 3, my + 10, 2, 9, OUTLINE);
      this.r(mx - 2, my + 10, 1, 8, chrome.base);
      const machine = espressoMachine(finish, this.density);
      this.ctx.drawImage(machine, mx - 2, my - 1, machine.width / this.density, machine.height / this.density);
    }
    const light = brewing && Math.floor(t * 4) % 2 ? '#7fe36a' : '#e2434b';
    this.r(mx + 24, my + 9, 2, 2, light);
    this.r(mx + 24, my + 9, 1, 1, '#fff5db');
    // Upgraded machines expose a second gauge, copper plumbing and a brass badge.
    if (lvl >= 5) {
      this.r(mx + 3, my + 6, 4, 4, '#39281f');
      this.r(mx + 4, my + 7, 2, 2, '#f4e6c7');
      this.r(mx + 5, my + 7, 1, 1, '#b65b41');
    }
    if (lvl >= 10) {
      this.r(mx + 1, my + 4, 1, 8, '#e4ad6a');
      this.r(mx + 26, my + 4, 1, 8, '#985934');
    }
    if (lvl >= 15) {
      this.r(mx + 10, my + 10, 7, 2, '#c8a15e');
      this.r(mx + 11, my + 10, 5, 1, '#f6d694');
    }
    if (brewing) for (const bx of [mx + 5, mx + 21]) {
      this.r(bx, my + 18, 1, 2, Math.floor(t * 8) % 2 ? '#925b2f' : '#c28f5a');
    }

    this.drawPastryCase(state);
    // A fitted terracotta herb pot trails over the unused left end of the bar.
    if (this.density > 1) {
      if (!paintGeneratedMain(this.ctx, 'vine', 60, 86, 19, 19 * 453 / 388)) this.ctx.drawImage(COUNTER_VINE(), 62, 84, 15, 34);
    }
    else {
      this.r(66, top - 5, 8, 5, '#543425');
      this.r(67, top - 4, 6, 4, '#ba7547');
      this.r(66, top - 5, 8, 1, '#e6aa68');
      this.r(67, top - 4, 1, 3, '#dd985b');
      leafySprig(this.ctx, 70, top - 8, 4, 5);
      for (let ly = top - 2; ly < front + 9; ly += 4) {
        this.r(65, ly, 1, 4, '#52683c');
        this.r(63, ly + 1, 3, 2, '#71854a');
        this.r(65, ly + 3, 3, 2, '#415833');
        this.r(63, ly + 1, 1, 1, '#b1bb69');
      }
    }
    this.drawGate(counter);
    this.drawPass(counter);
    // Distinct customer-facing order and pickup plaques.
    mainTimber(this.ctx, 108, 112, 31, 10);
    this.r(109, 113, 29, 8, artRamp('sage')[0]);
    this.r(109, 113, 29, .5, artRamp('sage')[2]);
    this.sign(this.ctx, getLocale() === 'zh' ? '点单' : 'ORDER', 123.5, 113, 27, 8, artRamp('cloth-7')[2]);
    const map = minaMapChoice(state);
    if (map) paintMinaMap(this.ctx, 181, 108, map);

    // Tip jar, in the gap between the first two baristas.
    const coins = Math.min(4, 1 + Math.floor(state.today.served / 15));
    const jx = baristaSpot(0).x + 11;
    this.r(jx, top - 4, 7, 1, '#758c79');
    this.r(jx - 1, top - 3, 9, 9, '#6e8471');
    this.r(jx, top - 3, 7, 10, '#c8d6b7');
    this.r(jx + 1, top - 2, 5, 7, '#e1e8ca');
    this.r(jx, top + 6 - coins, 7, coins, '#c8a15e');
    this.r(jx + 1, top + 6 - coins, 2, 1, '#f6d88f');
    this.r(jx, top - 2, 1, 7, '#fff4d7');
    this.r(jx + 2, top, 3, 3, '#f4e6c7');
    this.r(jx + 3, top + 1, 1, 1, '#a68145');
    this.r(jx - 1, top - 5, 9, 2, '#a77941');
    this.r(jx, top - 5, 7, 1, '#ddba78');

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
    // The lower return is a staff opening aligned with the kitchen door.
    const h = FLOOR_Y - top - 2;
    mainTimber(this.ctx, x - 1, top - 1, w + 2, h + 1, true);
    const mat = counterMaterial(counter);
    this.r(x + 1, top + 1, w - 2, h - 2, mat[Math.min(3, mat.length - 1)]);
    for (let yy = top + 2; yy < top + h - 3; yy += 9) this.r(x + 2, yy, .5, 6, mat.at(-1)!);
    this.r(x + w - 1, top, .5, h, artRamp('walnut')[0]);
  }

  /**
   * The pass: a pickup window standing on the counter's right end. Table orders
   * wait three across on a steel ledge and a heated shelf above, under two heat
   * lamps; each slot is marked so it's easy to see how much room is left. The bell
   * on its header and the plates are drawn live.
   */
  private drawPass(counter: string): void {
    mainPickup(this.ctx, counter);
    this.sign(this.ctx, getLocale() === 'zh' ? '取餐' : 'PICKUP', PASS.x + 19, PASS.top,
      28, 6, artRamp('cloth-7')[2]);
  }

  /** The hinged flap at the end of the counter: a lift-up top and a little swing door. */
  private drawGate(counter: string): void {
    const { top, front, bottom } = COUNTER;
    const { x, w } = COUNTER_GATE;
    const mat = counterMaterial(counter);
    const slab = { base: artRamp('oak')[3], hi: artRamp('oak')[5], lo: artRamp('oak')[2], dark: artRamp('walnut')[0] };
    const body = { base: mat[Math.min(2, mat.length-1)], hi: mat.at(-1)!, lo: mat[1], dark: mat[0] };
    // The flap: same top as the counter, with a seam and two brass hinges.
    this.r(x, top - 1, w, 1, artRamp('walnut')[0]);
    this.r(x, top, w, front - top, slab.base);
    this.r(x, top, w, 1, slab.lo);
    this.r(x, front - 3, w, 1, slab.hi);
    this.r(x, front - 1, w, 1, slab.dark);
    this.r(x, top, 1, front - top, slab.dark);
    for (const hy of [top + 2, front - 5]) this.r(x + 1, hy, 2, 2, artRamp('oak')[4]);
    // Below it, an opening and a half-height swing door.
    this.r(x, front, w, bottom - front, artRamp('walnut')[0]);
    const dy = front + 5;
    this.r(x + 1, dy, w - 2, bottom - dy - 1, body.dark);
    this.r(x + 2, dy + 1, w - 4, bottom - dy - 3, body.base);
    this.r(x + 2, dy + 1, w - 4, 1, body.hi);
    this.r(x + 4, dy + 4, w - 8, bottom - dy - 9, body.lo);
    this.r(x + w - 5, dy + 6, 2, 2, artRamp('oak')[5]);
    this.r(x + w, top - 1, 1, bottom - top + 1, artRamp('walnut')[0]);
  }

  /**
   * The glass case in the counter front. It shows today's breads and pastries:
   * the planned bake during prep, actual shelf stock while open or closing.
   */
  private drawPastryCase(state: GameState): void {
    const { top, front, bottom } = COUNTER;
    const { x, w } = PASTRY_CASE;
    const ctx = this.ctx;
    // Reuse the existing live-stock case painter with a pale oak frame. Its
    // cream interior matches the reference and keeps every food item dynamic.
    // Glass top over the case.
    this.r(x, top + 1, w, front - top - 4, '#b7bf94');
    this.r(x, top + 1, w, 1, '#efdfbe');
    for (const gx of [x + 7, x + w * .63]) for (let row = 0; row < front - top - 6; row += .5) this.r(gx + row * .65, top + 2 + row, 1, .5, '#efdfbe');
    this.r(x, front - 4, w, .5, artRamp('sage')[0]);
    this.r(x, top + 1, 1, front - top - 4, '#8ba477');
    this.r(x + w - 1, top + 1, 1, front - top - 4, '#8ba477');
    // The case itself: a lit cream interior with one shelf.
    const cy = front + 2;
    const ch = bottom - front - 6;
    const brass = { hi: artRamp('oak')[5], base: artRamp('oak')[3], lo: artRamp('walnut')[1] };
    this.r(x - 1, cy - 1, w + 2, ch + 2, OUTLINE);
    this.r(x, cy, w, ch, '#efdfbe');
    this.r(x, cy, w, 3, '#fee8ac');
    this.r(x, cy + ch - 4, w, 4, '#d6ac7b');
    const shelfY = cy + ch - 4;
    this.r(x, shelfY, w, 1, '#c0824f');

    const bakery = menuItems(state).filter((m) => !isDrink(m.category)).slice(0, 5);
    const slots = Math.max(3, bakery.length);
    const slot = w / slots;
    for (let i = 0; i < slots; i++) {
      const sx = Math.round(x + slot * i + slot / 2);
      // Doily plate.
      this.r(sx - 5, shelfY - 1, 11, 1, '#efdfbe');
      this.r(sx - 4, shelfY, 9, 1, '#e5d7ba');
      const m = bakery[i];
      if (!m) continue;
      const count = state.phase === 'prep' ? (state.bakePlan[m.id] ?? 0) : (state.shelf[m.id] ?? 0);
      if (count <= 0) continue;
      const icon = itemIcon(m.id);
      const ix = Math.round(sx - icon.width / 2);
      const iy = shelfY - icon.height + 1;
      if (count >= 8) ctx.drawImage(fineSpriteArt(icon).canvas, ix - 2, iy - 2, icon.width, icon.height);
      ctx.drawImage(fineSpriteArt(icon).canvas, ix, iy, icon.width, icon.height);
    }
    // Reflections on the glass, then the brass frame.
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (const gx of [x + 6, x + w / 2 + 4]) {
      for (let i = 0; i < ch - 2; i++) this.r(gx + i * 0.6, cy + 1 + i, 2, 1, '#efdfbe');
    }
    ctx.restore();
    this.r(x, cy, w, 1, brass.hi);
    this.r(x, cy + ch - 1, w, 1, brass.lo);
    this.r(x, cy, 1, ch, brass.base);
    this.r(x + w - 1, cy, 1, ch, brass.lo);
  }

  /** Unbuilt spots remain empty; the scene renders an opt-in furniture preview. */
  drawUnbuilt(_x: number, _y: number): void {}
}
