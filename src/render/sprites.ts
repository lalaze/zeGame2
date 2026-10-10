import { CUSTOMER_CAST, type CustomerDesign } from '../game/customer-cast';
import type { IngredientId, ItemId, UpgradeId } from '../game/data';
import type { Look } from '../game/state';
import { edge, ramp } from './color';

/** Warm near-black used for outlines, like Stardew's, rather than pure black. */
export const OUTLINE = '#2e1c16';

export type Palette = Record<string, string>;

/**
 * How a sprite's border is drawn: a fixed color, 'sel' for Stardew-style
 * selective outlines (each edge pixel is a deep shade of the fill it touches),
 * or false for none.
 */
export type Outline = string | 'sel' | false;

/**
 * Builds a canvas from a character grid. '.' is transparent; every other
 * character is looked up in the palette. With an outline, a 1px border is
 * traced around the shape.
 */
export function pixelSprite(rows: readonly string[], palette: Palette, outline: Outline = 'sel'): HTMLCanvasElement {
  const pad = outline ? 1 : 0;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext('2d')!;
  const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? (rows[y][x] ?? '.') : '.');
  const color = (ch: string) => palette[ch] ?? '#ff00ff';

  if (outline) {
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (at(x, y) !== '.') continue;
        // Prefer the pixel below/beside so outlines follow the body, not the hair.
        const n = [at(x, y + 1), at(x - 1, y), at(x + 1, y), at(x, y - 1)].find((ch) => ch !== '.');
        if (!n) continue;
        ctx.fillStyle = outline === 'sel' ? edge(color(n)) : outline;
        ctx.fillRect(x + pad, y + pad, 1, 1);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (ch === '.') continue;
      ctx.fillStyle = color(ch);
      ctx.fillRect(x + pad, y + pad, 1, 1);
    }
  }
  return canvas;
}

function flipped(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Overlays the non-'.' cells of `top` onto `base`. */
function layer(base: readonly string[], top: readonly string[]): string[] {
  return base.map((row, y) => {
    const over = top[y];
    if (!over) return row;
    return [...row].map((ch, x) => (over[x] && over[x] !== '.' ? over[x] : ch)).join('');
  });
}

// ---------------------------------------------------------------- characters
// A hand-pixelled 16×26 cast, framed at 18×28 by the selective outline.
// Rounded cheeks, open negative space around the arms, and restrained clusters
// stay legible at the café's native scale. All old Look indexes remain valid.
export const SKINS = ['#f4cfad', '#dfaa7d', '#b67c55', '#80533f'];
export const HAIRS = ['#594237', '#976546', '#dfb96f', '#b9674e', '#626782', '#cc8c9f'];
export const SHIRTS = ['#bb6b58', '#799ba7', '#8ba477', '#d3a453', '#9b87af', '#cf929e', '#69a295', '#e5d7ba'];
export const PANTS = ['#53637b', '#85664f', '#585464'];
export const HEAD_ROWS = 16;

export const FRONT = [
  '................',
  '................',
  '.....SSSSSS.....',
  '....SSSSSSSS....',
  '...SSSSSSSSSS...',
  '...SSSSSSSSSS...',
  '...SSSSSSSSSS...',
  '...SSSSSSSSSS...',
  '..SSSESSSSESSs..',
  '..sSSESSSSESss..',
  '...SBSSSSSBSs...',
  '....SSmmSSSs....',
  '....sSSSSSSs....',
  '......SSss......',
  '.....TWWWWt.....',
  '....UTTWWTTt....',
  '...UTTTTTTTTt...',
  '...UTtTTTTtTt...',
  '...STtTTTTtTs...',
  '...SsTTTTTTss...',
  '.....TTTTTt.....',
  '.....pPPPPp.....',
];
const BACK = FRONT.map((row, y) => y >= 8 && y <= 11 ? row.replace(/[EBm]/g, 'S') :
  y === 14 ? '.....TTTTTt.....' : y === 15 ? '....UTTTTTTt....' : row);
export const SIDE = [
  '................',
  '................',
  '......SSSSS.....',
  '.....SSSSSSS....',
  '....SSSSSSSSS...',
  '....SSSSSSSSS...',
  '....SSSSSSSSS...',
  '....SSSSSSSSS...',
  '....SSSSSSSESs..',
  '....SSSSSSSESs..',
  '....sSSSSSBSS...',
  '.....sSSSSSm....',
  '......sSSSs.....',
  '.......Sss......',
  '......TTWWt.....',
  '.....UTTTWTt....',
  '.....tTUUTTt....',
  '.....tTUTTTt....',
  '.....tTUTTTt....',
  '......TZSTTt....',
  '......TTTTt.....',
  '......pPPPp.....',
];
export const LEGS_FRONT = [
  ['.....PPpPPp.....', '.....PPpPPp.....', '.....KK.KKk.....', '....kWK.kWKk....'],
  ['.....PPpPPp.....', '.....PPpKKk.....', '.....KK.kWKk....', '....kWK.........'],
  ['.....PPpPPp.....', '.....KK.PPp.....', '....kWK.KKk.....', '........kWKk....'],
];
export const LEGS_SIDE = [
  ['.......PPp......', '.......PPp......', '.......KKk......', '.......kWWKk....'],
  ['......PPpPPp....', '.....PPp..PPp...', '.....KK....KKk..', '....kWK....kWKk.'],
  ['......pPPPPp....', '......KK.PPp....', '......kK..KK....', '..........kWKk..'],
];
const LEGS_SEATED = ['......PPPPPPPp..', '......ppppPPPKk.'];
const APRON_FRONT = [
  ...Array(14).fill(''),
  '.....Q....Q.....',
  '.....Q.WW.Q.....',
  '.....RRRRRr.....',
  '.....RYRRRr.....',
  '.....RRRRRr.....',
  '.....RWWWRr.....',
  '.....RRRRRr.....',
  '.....rrrrrr.....',
];
const APRON_SIDE = [
  ...Array(14).fill(''),
  '..........Q.....',
  '..........Q.....',
  '..........Rr....',
  '..........Rr....',
  '..........Rr....',
  '..........Wr....',
  '.........RRr....',
  '.........rrr....',
];
const APRON_BACK = [...Array(14).fill(''), '.....Q....Q.....', '......Q..Q......', '.......QQ.......', '......Q..Q......', '', '.....rrWWrr.....', '.......WW.......'];
type HairSet = { front: string[]; side: string[]; back: string[] };
const SHORT_BACK = [
  '................',
  '......HHHh......',
  '....HLLHHHHh....',
  '...HLLHHHHHHh...',
  '...HLHHHHHHHh...',
  '..HHHHHHHHHHHh..',
  '..HHHHHHHHHHHh..',
  '..HHHHHHHHHHHh..',
  '...HHHHHHHHHh...',
  '...hHHHHHHHhh...',
  '....hHHHHHhh....',
  '.....hhhhhh.....',
];
export const HAIR: HairSet[] = [
  { // soft side-part; a clean forehead instead of a solid block of fringe
    front: [
      '................',
      '......HHHh......',
      '....HLLHHHHh....',
      '...HLLHHHHHHh...',
      '...HLHHHHHHHh...',
      '..HHHHHHhhHHHh..',
      '..HHHHh...hHHh..',
      '...HH.......Hh..',
      '...h........h...',
    ],
    side: [
      '................',
      '.......HHh......',
      '.....HLLHHHh....',
      '....HLLHHHHHh...',
      '...HHLHHHHHHHh..',
      '...HHHHHHHHHh...',
      '...HHHHHhh.Hh...',
      '...HHHHh........',
      '...HHHS.........',
      '....hh..........',
    ],
    back: SHORT_BACK,
  },
  { // loosely tied bun, with a ribbon and curled face-framing wisps
    front: [
      '......HLLh......',
      '.....HLLHHh.....',
      '.....hHHHHh.....',
      '....HHWWHHHh....',
      '...HLLHHHHHHh...',
      '...HHHHHHHHHh...',
      '...HHh..hhHHh...',
      '...H.......Hh...',
      '...h........h...',
      '...h............',
    ],
    side: [
      '................',
      '..HLLh..........',
      '.HLLHHhHHHh.....',
      '.hHHHHHLLHHHh...',
      '..hhWWHLHHHHHh..',
      '...HHHHHHHHHh...',
      '...HHHHHhh.Hh...',
      '...HHHHh........',
      '....HHS.........',
      '.....h..........',
    ],
    back: [
      '......HLLh......',
      '.....HLLHHh.....',
      '.....hHHHHh.....',
      '....HHWWHHHh....',
      ...SHORT_BACK.slice(4, 10),
      '.....hHHHHh.....',
      '......hhhh......',
    ],
  },
  { // rounded shoulder-length waves; space around the face remains open
    front: [
      '................',
      '.....HHHHHh.....',
      '....HLLHHHHh....',
      '...HLLHHHHHHh...',
      '..HHLHHHHHHHHh..',
      '..HHHHhhHHHHHh..',
      '..HHH....hHHHh..',
      '..HHh.....hHHh..',
      '..HH.......HHh..',
      '..Hh.......hHh..',
      '..HH.......HHh..',
      '..HH.......HHh..',
      '..HHh.....hHHh..',
      '...Hh.....hHh...',
      '...hh......hh...',
    ],
    side: [
      '................',
      '......HHHHh.....',
      '....HLLHHHHh....',
      '...HLLHHHHHHh...',
      '..HHLHHHHHHHHh..',
      '..HHHHHHHHHHh...',
      '..HHHHHHhh.Hh...',
      '..HHHHHH........',
      '..HHHHS.........',
      '..HHHHh.........',
      '..HHHHh.........',
      '..HHHHh.........',
      '..hHHHh.........',
      '...hHHh.........',
      '....hh..........',
    ],
    back: [...SHORT_BACK.slice(0, 9),
      '..HHHHHHHHHHHh..',
      '..HHHHHHHHHHHh..',
      '..HHHHHHHHHHHh..',
      '..hHHHHHHHHHhh..',
      '...hHHHHHHHhh...',
      '....hhhhh.hh....',
    ],
  },
  { // slouchy knit hat, continuous folded cuff, a tiny cream label
    front: [
      '................',
      '......AAAa......',
      '....AAYAAAaa....',
      '...AAYAAAAAAa...',
      '..AAYAAAAAAAaa..',
      '..AAAAAAAAAAaa..',
      '..YYYYAAAWWAAa..',
      '..aaaaaaaaaaaa..',
      '...H........H...',
    ],
    side: [
      '................',
      '.......AAa......',
      '.....AAYAAAa....',
      '....AAYAAAAAa...',
      '...AAYAAAAAAAa..',
      '...AAAAAAAAAAa..',
      '...YYYAAAAWWAa..',
      '...aaaaaaaaaaa..',
      '...HHHS.........',
      '....hh..........',
    ],
    back: [
      '................',
      '......AAAa......',
      '....AAYAAAaa....',
      '...AAYAAAAAAa...',
      '..AAYAAAAAAAaa..',
      '..AAAAAAAAAAaa..',
      '..YYYYAAAAAAAa..',
      '..aaaaaaaaaaaa..',
      ...SHORT_BACK.slice(8),
    ],
  },
];
// Four additional silhouettes belong to the visiting cast, not the profile picker.
const CUSTOMER_HAIR: HairSet[] = [
  ...HAIR,
  { // high ponytail, ribbon and swept temple
    front: HAIR[1].front.map((r, y) => y < 3 ? HAIR[0].front[y] : r),
    side: [
      '................', '......HHHH......', '....HLLHHHHh....',
      '..HHLLHHHHHHh...', '.HhHHHHHHHHHHh..', '.HhHHHHHHHHHh...',
      '.HhHHHHHhh.Hh...', '.HhHHHHh........', '.Hh.HHS.........',
      '.HH..h..........', '.HHh............', '..Hh............',
      '..Hh............', '..hh............',
    ],
    back: [
      ...SHORT_BACK.slice(0, 5), '...HHHWWWHHHh...', '...HHHHHHHHHh...',
      '....HHHHHHHh....', '.....HHHHHh.....', '.....HHHHHh.....',
      '.....HHHHHh.....', '......HHHh......', '......HHHh......',
      '.......hh.......',
    ],
  },
  { // clustered curls, round rather than long and straight
    front: [
      '................', '....HH..HHh.....', '...HLLHHLLHHh...',
      '..HLLHHHHHHHHh..', '..HHHHHHHHHHHh..', '.HHHhHHhHHhHHHh.',
      '..HHh.HHh..HHh..', '..HH.......HHh..', '..Hh........Hh..',
      '...h........h...',
    ],
    side: [
      '................', '.....HH.HHh.....', '...HLLHHLLHHh...',
      '..HLLHHHHHHHHh..', '..HHHHHHHHHHHh..', '.HHHHHHHHHHHHHh.',
      '..HHHHHhh..HHh..', '..HHHHHh........', '...HHHS.........',
      '..HHhh..........', '...hh...........',
    ],
    back: [
      '................', '....HH..HHh.....', '...HLLHHLLHHh...',
      '..HLLHHHHHHHHh..', '..HHHHHHHHHHHh..', '.HHHHHHHHHHHHHh.',
      '..HHHHHHHHHHHh..', '.HHHHHHHHHHHHHh.', '..HHHHHHHHHHHh..',
      '...hHHHHHHHhh...', '....hhHHHhhh....', '......hhh.......',
    ],
  },
  { // chin-length bob with a neat straight fringe
    front: [
      '................', '.....HHHHHh.....', '....HLLHHHHh....',
      '...HLLHHHHHHh...', '..HHLHHHHHHHHh..', '..HHHHHHHHHHHh..',
      '..HHhhhhhhhhHh..', '..HH.......HHh..', '..HH.......HHh..',
      '..HH.......HHh..', '..HH.......HHh..', '..hHh.....hHhh..',
      '...hh.....hhh...',
    ],
    side: [
      ...HAIR[2].side.slice(0, 9), '..HHHHh.........', '..HHHHh.........',
      '..hHHHh.........', '...hhhh.........',
    ],
    back: [...SHORT_BACK.slice(0, 9), '..HHHHHHHHHHHh..', '..HHHHHHHHHHHh..', '..hHHHHHHHHHhh..', '...hhhhhhhhhh...'],
  },
  { // cropped pixie with a small asymmetric quiff
    front: [
      '................', '.......HHh......', '.....HLLHHh.....',
      '....HLLHHHHh....', '...HHHHHHHHHh...', '...HHHhh..HHh...',
      '...HH......Hh...', '...h........h...',
    ],
    side: [
      '................', '........HH......', '......HLLHh.....',
      '.....HLLHHHH....', '....HHHHHHHHh...', '...HHHHHHHHHh...',
      '...HHHHHhh......', '....HHHh........', '.....HS.........',
    ],
    back: ['................', '.......HHh......', ...SHORT_BACK.slice(2, 10), '.....hhhhhh.....'],
  },
];
// A small baker's toque. Its silhouette is shared across all three views.
const CAP = [
  '.....CCCCCC.....',
  '...CCCCCCCCCC...',
  '...CCWCCCCWCc...',
  '....CCCCCCCc....',
  '....cccccccc....',
];
export type Role = 'customer' | 'barista' | 'owner' | 'server' | 'cook';
export type Facing = 'down' | 'up' | 'left' | 'right';
export interface CharacterFrames {
  /** [stand, stepA, stepB] for each direction. */
  down: HTMLCanvasElement[];
  up: HTMLCanvasElement[];
  left: HTMLCanvasElement[];
  right: HTMLCanvasElement[];
  sitLeft: HTMLCanvasElement;
  sitRight: HTMLCanvasElement;
  stand: HTMLCanvasElement;
}
export const CHAR_H = 28;
const charCache = new Map<string, CharacterFrames>();

/** Immutable source grids become pose-specific garments before hair is added. */
function outfit(body: string[], role: Role, view: 'front' | 'side' | 'back', look: Look, step: number, design?: CustomerDesign): string[] {
  let rows = body.slice();
  const garment = design ? ['cardigan', 'stripe', 'overalls', 'scarf'].indexOf(design.outfit) : look.shirt % 4;
  if (role !== 'customer') rows = layer(rows, view === 'front' ? APRON_FRONT : view === 'side' ? APRON_SIDE : APRON_BACK);
  else if (view === 'front') {
    // Four everyday silhouettes from the existing shirt choice: cardigan,
    // striped sweater, overalls, and a light neck scarf. No new save fields.
    const detail = Array<string>(22).fill('');
    const style = garment;
    if (style === 0) {
      detail[16] = '.......WW.......';
      detail[17] = '.......Wt.......';
      detail[18] = '.......WW.......';
      detail[19] = '.......Wt.......';
    } else if (style === 1) {
      detail[17] = '......WWWW......';
      detail[19] = '.....WWWWWW.....';
    } else if (style === 2) {
      detail[15] = '.....P....P.....';
      detail[16] = '.....PPPPPP.....';
      detail[17] = '.....PWWPPp.....';
      detail[18] = '.....PPPPPp.....';
      detail[19] = '.....PPPPPp.....';
      detail[20] = '.....PPPPPp.....';
    } else if (style === 3) {
      detail[14] = '.....WWWWW......';
      detail[15] = '......wWW.......';
      detail[16] = '........W.......';
      detail[17] = '........w.......';
    }
    rows = layer(rows, detail);
  } else if (role === 'customer') {
    const detail = Array<string>(22).fill('');
    if (view === 'side') {
      if (garment === 1) {
        detail[17] = '.........WW.....';
        detail[19] = '.........WW.....';
      } else if (garment === 2) {
        detail[15] = '..........P.....';
        detail[16] = '..........Pp....';
        detail[17] = '..........Pp....';
        detail[18] = '..........Pp....';
        detail[19] = '..........Pp....';
        detail[20] = '......PPPPp.....';
      } else if (garment === 3) {
        detail[14] = '......WWWWW.....';
        detail[15] = '..........W.....';
        detail[16] = '..........w.....';
      }
    } else {
      if (garment === 1) {
        detail[17] = '......WWWW......';
        detail[19] = '.....WWWWWW.....';
      } else if (garment === 2) {
        detail[15] = '.....P....P.....';
        detail[16] = '.....P....P.....';
        detail[17] = '.....PPPPPP.....';
        detail[18] = '.....PPPPPp.....';
        detail[19] = '.....PPPPPp.....';
        detail[20] = '.....PPPPPp.....';
      } else if (garment === 3) {
        detail[14] = '.....WWWWWW.....';
        detail[15] = '......wwww......';
      }
    }
    rows = layer(rows, detail);
  }
  if (role === 'cook' && view === 'front') {
    rows[15] = '....UTQWWQTt....';
  }
  if (role === 'server' && view === 'front') rows[15] = '....UTQYQTTt....';
  // Opposing arms lift by one pixel, not a whole rigid torso. Feet keep their
  // old baseline so counter occlusion, seats, trays and hit targets stay put.
  if (step && view !== 'side') {
    const left = step === 1 ? 3 : 12;
    const cells = rows.map(r => [...r]);
    cells[18][left] = 'S';
    cells[19][left] = '.';
    rows = cells.map(r => r.join(''));
  } else if (step && view === 'side') {
    rows[18] = step === 1 ? '.....tTZSTTt....' : '.....tTUTTTt....';
    rows[19] = step === 1 ? '......TTTTTt....' : '.......ZSTTt....';
  }
  return rows;
}

/** Draw customer-only garments in registered pixel coordinates. */
function customerDetails(rows: string[], design: CustomerDesign, view: 'front' | 'side' | 'back', accessories: boolean): string[] {
  const grid = rows.map(r => [...r]);
  const put = (x: number, y: number, text: string) => {
    if (!grid[y]) return;
    [...text].forEach((ch, dx) => { if (x + dx < 16 && ch !== '.') grid[y][x + dx] = ch; });
  };
  const front = view === 'front';
  const side = view === 'side';
  if (!accessories) {
    switch (design.outfit) {
      case 'jacket':
        if (front) {
          put(5, 14, 'WTTTTW'); put(5, 15, 'TWTTWt'); put(7, 16, 'WW');
          put(7, 17, 'WQ'); put(7, 18, 'WW'); put(5, 19, 'ww..ww');
          put(7, 19, 'WQ'); put(7, 20, 'WW');
        } else if (side) { put(10, 14, 'W'); put(10, 15, 'W'); put(9, 20, 'ww'); }
        else put(5, 20, 'wwwwww');
        break;
      case 'vest':
        if (front) {
          put(5, 15, 'qWTTWq'); put(5, 16, 'qqWWqq'); put(5, 17, 'qqYqqq');
          put(5, 18, 'qqqqqq'); put(5, 19, 'qqYqqq'); put(5, 20, 'qq..qq');
        } else if (side) for (let y = 16; y <= 20; y++) put(9, y, 'qq');
        else for (let y = 15; y <= 20; y++) put(5, y, 'qqqqqq');
        break;
      case 'dress':
        if (front) { put(5, 19, 'wwwwww'); put(7, 16, 'YY'); }
        else if (side) put(9, 19, 'ww');
        else put(5, 19, 'wwwwww');
        put(side ? 5 : 4, 20, side ? 'TTTTTTt' : 'TTTTTTTt');
        put(side ? 5 : 4, 21, side ? 'TTTTTTt' : 'TTTTTTTt');
        put(4, 22, 'TTtTTtTTt'); put(4, 23, 'wwwwwwwww');
        break;
      case 'hoodie':
        if (front) {
          put(4, 14, 'tWWTTWWt'); put(5, 15, 'TWTTWt'); put(6, 16, 'w..w');
          put(6, 17, 'Y..Y'); put(6, 19, 'tttt'); put(6, 20, 'UUUt');
        } else if (side) { put(5, 14, 'tW'); put(5, 15, 'tW'); put(10, 16, 'w'); }
        else { put(5, 14, 'WWWWWW'); put(5, 15, 'wWWWWw'); put(6, 16, 'wwww'); }
        break;
      case 'sailor':
        if (front) {
          put(5, 14, 'WWTTWW'); put(5, 15, 'tWWWWt'); put(7, 16, 'qq');
          put(7, 17, 'YY'); put(7, 18, 'qY');
        } else if (side) { put(6, 14, 'WWWWW'); put(6, 15, 'w'); put(10, 15, 'W'); }
        else { put(5, 14, 'WWWWWW'); put(5, 15, 'WTTTTW'); put(5, 16, 'WWWWWW'); }
        break;
      case 'duffle':
        if (front) {
          put(5, 14, 'wWTTWw');
          for (let y = 16; y <= 20; y += 2) put(6, y, 'wYYw');
          put(4, 21, 'TTTTTTTt');
        } else if (side) { put(10, 14, 'W'); put(10, 17, 'Y'); put(10, 19, 'Y'); }
        else put(5, 20, 'wwwwww');
        break;
    }
  } else {
    switch (design.accessory) {
      case 'glasses':
        if (front) { put(4, 8, 'ggg..ggg'); put(4, 9, 'gEggggEg'); put(4, 10, 'ggg..ggg'); }
        else if (side) { put(9, 8, 'gggg'); put(10, 9, 'gEg'); put(10, 10, 'ggg'); }
        break;
      case 'bow':
        if (front) { put(11, 4, 'q.q'); put(11, 5, 'qqq'); put(11, 6, 'q.q'); }
        else if (side) { put(3, 5, 'qq'); put(2, 6, 'qYq'); }
        else { put(6, 6, 'q..q'); put(6, 7, 'qYYq'); }
        break;
      case 'headband':
        if (side) { put(7, 3, 'q'); put(6, 4, 'q'); put(5, 5, 'q'); }
        else { put(4, 4, 'qqqqqqqq'); put(3, 5, 'q'); put(12, 5, 'q'); }
        break;
      case 'satchel':
        if (front || view === 'back') {
          for (let y = 15; y <= 20; y++) put(4 + y - 15, y, 'q');
          put(10, 19, 'qqq'); put(10, 20, 'qYq'); put(10, 21, 'qqq'); put(10, 22, 'www');
        } else {
          for (let y = 15; y <= 19; y++) put(7, y, 'q');
          put(5, 19, 'qqq'); put(5, 20, 'qYq'); put(5, 21, 'qqq'); put(5, 22, 'www');
        }
        break;
    }
  }
  return grid.map(r => r.join(''));
}

export function character(look: Look, role: Role = 'customer', appearanceId?: number): CharacterFrames {
  const design = role === 'customer' && Number.isInteger(appearanceId) ? CUSTOMER_CAST[appearanceId!] : undefined;
  const key = `${look.skin}.${look.hair}.${look.hairStyle}.${look.shirt}.${look.pants}.${role}.${design?.id ?? 'base'}`;
  const cached = charCache.get(key);
  if (cached) return cached;
  const skin = ramp(SKINS[look.skin % SKINS.length]);
  const hair = ramp(HAIRS[look.hair % HAIRS.length]);
  const staff = role !== 'customer';
  const cook = role === 'cook';
  const shirt = ramp(cook ? '#f0e7d3' : staff ? '#eee0c2' : SHIRTS[look.shirt % SHIRTS.length]);
  const apron = ramp(role === 'owner' ? SHIRTS[look.shirt % SHIRTS.length] : role === 'server' ? '#61758a' : cook ? '#78878b' : '#749078');
  const pants = ramp(PANTS[look.pants % PANTS.length]);
  const hat = ramp(SHIRTS[(look.shirt + 3) % SHIRTS.length]);
  const palette: Palette = {
    S: skin.base, s: skin.lo, Z: skin.hi, E: '#42332f',
    B: look.skin < 2 ? '#db9b83' : '#af7565', m: '#9c6253',
    T: shirt.base, t: shirt.lo, U: shirt.hi, V: shirt.dark,
    P: pants.base, p: pants.lo, K: '#795d4b', k: '#554536',
    H: hair.base, h: hair.lo, L: hair.hi,
    A: hat.base, a: hat.lo, Y: '#e8c783', W: '#eee1bd', w: '#c5b397',
    R: apron.base, r: apron.lo, Q: apron.dark,
    C: '#f7eddb', c: '#c7bfae', q: design?.accent ?? '#d4ac78', g: '#86684e',
  };
  const hairStyle = design ? CUSTOMER_HAIR[design.hairstyle] : HAIR[cook && look.hairStyle % HAIR.length === 3 ? 0 : look.hairStyle % HAIR.length];
  const style = cook ? { front: layer(hairStyle.front, CAP), side: layer(hairStyle.side, CAP), back: layer(hairStyle.back, CAP) } : hairStyle;
  const build = (body: string[], view: 'front' | 'side' | 'back', legs: string[], step: number) => {
    let rows = [...outfit(body, role, view, look, step, design), ...legs];
    if (design) rows = customerDetails(rows, design, view, false);
    rows = layer(rows, style[view]);
    if (design) rows = customerDetails(rows, design, view, true);
    return pixelSprite(rows, palette);
  };
  const down = LEGS_FRONT.map((legs, step) => build(FRONT, 'front', legs, step));
  const up = LEGS_FRONT.map((legs, step) => build(BACK, 'back', legs, step));
  const right = LEGS_SIDE.map((legs, step) => build(SIDE, 'side', legs, step));
  const sitRight = build(SIDE, 'side', LEGS_SEATED, 0);
  const frames = { down, up, right, left: right.map(flipped), sitRight, sitLeft: flipped(sitRight), stand: down[0] };
  charCache.set(key, frames);
  return frames;
}

// ---------------------------------------------------------------- items (12x12)

const CUP = { w: '#fdf6ec', W: '#dccdb9', d: '#efe2cf', D: '#c4b096', s: '#ece6de' };

export const ITEM_ART: Record<ItemId, { rows: string[]; palette: Palette }> = {
  espresso: {
    rows: [
      '....s..s....',
      '...s..s.....',
      '....s..s....',
      '............',
      '..wwwwwww...',
      '..wCCCCCwww.',
      '..wcccccw.w.',
      '..wwwwwwwww.',
      '..WwwwwwW...',
      '...WWWWW....',
      '.dddddddddD.',
      '..DDDDDDDD..',
    ],
    palette: { ...CUP, C: '#c48a55', c: '#5e3420' },
  },
  latte: {
    rows: [
      '...gGGGGg...',
      '...gffffg...',
      '...gffffg...',
      '...gmmmmg...',
      '...gmmmmg...',
      '...gMMMMg...',
      '...gMMMMg...',
      '...gccccg...',
      '...gccccg...',
      '...gccccg...',
      '....gggg....',
    ],
    palette: { g: '#cfe6ee', G: '#f6fbfc', f: '#fff5e6', m: '#e2b98e', M: '#c48a55', c: '#6e3f24' },
  },
  cappuccino: {
    rows: [
      '....s.s.....',
      '...s.s......',
      '............',
      '.rrrrrrrrr..',
      '.rffffffffrr',
      '.rffhfhfffr.',
      '.rfffhffffrr',
      '.Rrrrrrrrrr.',
      '..RRrrrrRR..',
      'ddddddddddD.',
      '.DDDDDDDDD..',
    ],
    palette: { ...CUP, r: '#e0685a', R: '#b24a40', f: '#f6dfc2', h: '#b07a4a' },
  },
  croissant: {
    rows: [
      '............',
      '....yyyy....',
      '..yYyyyyYy..',
      '.yYyOyyOyYy.',
      'yYyyOyyOyyYy',
      'yYyOyyyyOyYy',
      'YyO......OyY',
      'YY........YY',
    ],
    palette: { y: '#f2bb62', Y: '#c97d34', O: '#e39a45' },
  },
  mocha: {
    rows: [
      '....wwww....',
      '...wwwWww...',
      '..wwkwwkww..',
      '..BBBBBBBB..',
      '..BbbbbbbBBB',
      '..BbbbbbbB.B',
      '..BbbbbbbBBB',
      '..BBBBBBBB..',
      '...BBBBBB...',
      '.dddddddddd.',
    ],
    palette: { ...CUP, k: '#6e3f24', B: '#8d5a3c', b: '#a86f4c' },
  },
  matcha: {
    rows: [
      '...gGGGGg...',
      '...gffffg...',
      '...gffffg...',
      '...gmmmmg...',
      '...gmmmmg...',
      '...gMMMMg...',
      '...gMMMMg...',
      '...gMMMMg...',
      '...gMMMMg...',
      '....gggg....',
    ],
    palette: { g: '#cfe6ee', G: '#f6fbfc', f: '#e6f2c8', m: '#a9cf7a', M: '#6f9e45' },
  },
  frappe: {
    rows: [
      '.......p....',
      '......p.....',
      '....wwpww...',
      '...wwwwwww..',
      '..wwwwWwwww.',
      '...gccccg...',
      '...gCCCCg...',
      '...gccccg...',
      '...gCCCCg...',
      '...gccccg...',
      '....gggg....',
    ],
    palette: { p: '#ef6f9c', w: '#fdf6ec', W: '#e9c48c', g: '#cfe6ee', c: '#e7b06a', C: '#c47a3a' },
  },
  cake: {
    rows: [
      '.....rR.....',
      '....rrrR....',
      '.....gG.....',
      '..wwwwwwww..',
      '.wwwwwwwwwW.',
      '.yyyyyyyyyY.',
      '.ppppppppppP',
      '.yyyyyyyyyY.',
      '.wwwwwwwwwW.',
      'dddddddddddD',
    ],
    palette: { ...CUP, r: '#e2434b', R: '#a52a36', g: '#6fb26a', G: '#4e8a4f', y: '#f6d58e', Y: '#d9ad5c', p: '#f49ac1', P: '#d26b98' },
  },
  pourover: {
    rows: [
      '.tttttttttt.',
      '..tTTTTTTt..',
      '...tTTTTt...',
      '....tttt....',
      '.....cc.....',
      '..gggggggg..',
      '..gccccccg..',
      '..gCCCCCCg..',
      '..gccccccg..',
      '...gggggg...',
    ],
    palette: { t: '#d9714f', T: '#f09572', c: '#6e3f24', C: '#8b5532', g: '#cfe6ee' },
  },
  americano: {
    rows: [
      '...s...s....',
      '....s...s...',
      '...s...s....',
      '.wwwwwwww...',
      '.wkkkkkkwww.',
      '.wwwwwwwwW.w',
      '.wwwwwwwwW.w',
      '.wwwwwwwwWww',
      '.wwwwwwwwW..',
      '..WWWWWWW...',
    ],
    palette: { ...CUP, k: '#3a2016' },
  },
  flatwhite: {
    rows: [
      '............',
      '...wwwwww...',
      '..wmmffmmw..',
      '..wmfffffmww',
      '..wmmffmmw.w',
      '..wwmmmmwwww',
      '...wwwwww...',
      '....WWWW....',
      '.dddddddddd.',
      '..DDDDDDDD..',
    ],
    palette: { ...CUP, m: '#c48a55', f: '#f6e6cc' },
  },
  macchiato: {
    rows: [
      '....y.y.....',
      '...gyyyyg...',
      '...gffffg...',
      '...gffffg...',
      '...gMMMMg...',
      '...gMmMMg...',
      '...gmmmmg...',
      '...gmmmmg...',
      '...gmmmmg...',
      '....gggg....',
    ],
    palette: { g: '#cfe6ee', G: '#f6fbfc', y: '#e0a040', f: '#fdf6ec', M: '#7a4a2a', m: '#f3e6d0' },
  },
  coldbrew: {
    rows: [
      '.......p....',
      '......p.....',
      '...gGGpGgg..',
      '...gkIkkkg..',
      '...gkkkIkg..',
      '...gIkkkkg..',
      '...gkkIkkg..',
      '...gkkkkkg..',
      '...gkkkkkg..',
      '....ggggg...',
    ],
    palette: { g: '#cfe6ee', G: '#f6fbfc', k: '#4a2a1a', I: '#e8f4f8', p: '#4fb3a8' },
  },
  affogato: {
    rows: [
      '....hhhh....',
      '...hhHhhh...',
      '..hhhhhhhh..',
      '..gkhhhhkg..',
      '..gkkhhkkg..',
      '..gkkkkkkg..',
      '...gkkkkg...',
      '....gggg....',
      '.....gg.....',
      '....gggg....',
    ],
    palette: { g: '#cfe6ee', G: '#f6fbfc', h: '#fbf0d6', H: '#ffffff', k: '#5e3420' },
  },
  blacktea: {
    rows: [
      '.....s......',
      '....s.......',
      '.....s......',
      '..wwwwwwww..',
      '..wttttttwww',
      '..wwwwwwww.w',
      '.ywwwwwwwwww',
      '.y.wwwwwww..',
      '.dddddddddd.',
      '..DDDDDDDD..',
    ],
    palette: { ...CUP, t: '#b5532c', y: '#f2c14e' },
  },
  hotchoc: {
    rows: [
      '....hhh.....',
      '...hkHhh....',
      '..hhhhkhh...',
      '.rrrrrrrrr..',
      '.rRrrrrrrrrr',
      '.rRrrrrrrr.r',
      '.rRrrrrrrr.r',
      '.rRrrrrrrrrr',
      '.rrrrrrrrr..',
      '..rrrrrrr...',
    ],
    palette: { h: '#fdf6ec', H: '#ffffff', k: '#6e3f24', r: '#d65a4a', R: '#f08a7a' },
  },
  chai: {
    rows: [
      '........n...',
      '.......nN...',
      '..tttttnNt..',
      '..tfxffnft..',
      '..tffxfffttt',
      '..tTtttttt.t',
      '..tTtttttt.t',
      '..tTttttttt.',
      '..tttttttt..',
      '...tttttt...',
    ],
    palette: { t: '#4cb4a6', T: '#8fdccf', f: '#f3dcc0', x: '#a0602c', n: '#8a4a20', N: '#c47a3a' },
  },
  smoothie: {
    rows: [
      '........p...',
      '.......p....',
      '..rR..p.....',
      '.rrrgGpGGg..',
      '..r.gPPPPg..',
      '....gPPPPg..',
      '....gPpPPg..',
      '....gPPPPg..',
      '....gPPPPg..',
      '.....gggg...',
    ],
    palette: { g: '#cfe6ee', G: '#f6fbfc', p: '#ef6f9c', P: '#f49ac1', r: '#e2434b', R: '#ff8a8a' },
  },
  milktea: {
    rows: [
      '............',
      '..gGGGGGGg..',
      '..gffffffg..',
      '..gqqqqqqggg',
      '..gqqqqqqg.g',
      '..gqqqqqqg.g',
      '..gqqqqqqggg',
      '..gqqqqqqg..',
      '...gggggg...',
      '..dddddddd..',
    ],
    palette: { g: '#cfe6ee', G: '#f6fbfc', f: '#fdf6ec', q: '#d9a877', d: '#efe2cf' },
  },
  roll: {
    rows: [
      '............',
      '....cccc....',
      '..ccCyyCcc..',
      '.cCyhhyyCcc.',
      '.cCyhyyyCcc.',
      'cCCyyyyCCCcc',
      'cCCCCCCCCcco',
      '.occcccccoo.',
      '..oooooooo..',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0' },
  },
  bagel: {
    rows: [
      '...cccccc...',
      '..cCyfyCCc..',
      '.cCyCCCyfCc.',
      '.cCc....cCc.',
      '.cCo....cCc.',
      '.cfCcccCCCo.',
      '..cCfCCfCo..',
      '...oooooo...',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0' },
  },
  baguette: {
    rows: [
      '.........cc.',
      '........cCyc',
      '.......cCyCc',
      '......cCoCco',
      '.....cCyCco.',
      '....cCoCco..',
      '...cCyCco...',
      '..cCoCco....',
      '.cCyCco.....',
      'cCCCco......',
      'occco.......',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0' },
  },
  pretzel: {
    rows: [
      '.ccc....ccc.',
      'cfyCc..cCyfc',
      'cC..cCCc..Cc',
      'cC...cc...Cc',
      'cC..cCCc..Cc',
      '.cCcC..CcCc.',
      '.cC......Cc.',
      'cC........Cc',
      'cC........Cc',
      '.cCCCCCCCCc.',
      '..cccccccc..',
    ],
    palette: { c: '#9a5226', C: '#c9793a', y: '#e8a060', f: '#ffffff' },
  },
  focaccia: {
    rows: [
      '............',
      '............',
      '.yyyyyyyyyy.',
      'yhyoyhyoyhyc',
      'yyyyGyyyyGyc',
      'yoyhyyoyhyyc',
      'yyGyyyyGyyyc',
      'cccccccccccc',
      '.oooooooooo.',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0', G: '#6fa255' },
  },
  ciabatta: {
    rows: [
      '............',
      '............',
      '...ffcffc...',
      '.cCfCCfCCc..',
      'cCCCfCCCCfc.',
      'cCfCCCfCCCcc',
      'cCCCCCCCCCco',
      '.cccccccccoo',
      '..ooooooooo.',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0' },
  },
  sourdough: {
    rows: [
      '....cccc....',
      '..cfCCfCcc..',
      '.cCfhhyCfCc.',
      '.cfCyhoyCCc.',
      'cCCCyooCCfCc',
      'cfCCCCoCCCCc',
      'cCCfCCCCfCCo',
      '.cCCCCCCCCo.',
      '..oooooooo..',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0' },
  },
  rye: {
    rows: [
      '............',
      '...rrrrrr...',
      '.rrRxRRxRrr.',
      'rRRRRxRRRRxr',
      'rRxRRRRxRRRr',
      'rRRRxRRRRxRr',
      '.rrRRRRRRrro',
      '..oooooooo..',
    ],
    palette: { r: '#6b3f26', R: '#8a5636', x: '#d8c08a', o: '#3e2618' },
  },
  shokupan: {
    rows: [
      '.cccc..cccc.',
      'cCyyCccCyyCc',
      'cyhhyCCyhhyc',
      'cyyyyyyyyyyc',
      'chhhhhhhhhhc',
      'chhhhhhhhhhc',
      'chhhhhhhhhhc',
      'chhhhhhhhhhc',
      'cCCCCCCCCCCc',
      '.oooooooooo.',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#e8a85a', h: '#fbe8c4' },
  },
  brioche: {
    rows: [
      '.....oo.....',
      '....oyyo....',
      '....oyho....',
      '..oooyyooo..',
      '.oyyyooyyyo.',
      'oyhyyyyyyyyo',
      'oyyyyyyyyyyo',
      '.oCyCyCyCyo.',
      '..oCoCoCoo..',
    ],
    palette: { o: '#8a4a1c', y: '#e09a3a', h: '#f7c46a', C: '#b8682c' },
  },
  garlicbread: {
    rows: [
      '............',
      '.cccccccccc.',
      'cCyyyyyyyyCc',
      'cyYYGYYYGYyc',
      'cyYGYYYYYYyc',
      'cyYYYYGYYYyc',
      'cyYYYGYYGYyc',
      'cCyyyyyyyyCc',
      '.oooooooooo.',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0', Y: '#f6d45e', G: '#6fa255' },
  },
  donut: {
    rows: [
      '...cccccc...',
      '..cppppppc..',
      '.cpPpxpppPc.',
      '.cpp....pbc.',
      '.cpx....ppc.',
      '.cppppbpppc.',
      '..cCppppCc..',
      '...oooooo...',
    ],
    palette: { o: '#7a3f1c', c: '#c47a3a', C: '#e0a050', p: '#f49ac1', P: '#ffc6dc', x: '#fff3a0', b: '#7fc4e8' },
  },
  scone: {
    rows: [
      '............',
      '.....cc.....',
      '....cyyc....',
      '...cyhyyc...',
      '..cyyyxyyc..',
      '.cyxyyyyyyc.',
      'cCCCCCCCCCCc',
      'cCCCCCCCCCCo',
      '.oooooooooo.',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0', x: '#6b3a3a' },
  },
  painchoc: {
    rows: [
      '............',
      '..cccccccc..',
      '.cyyhyyhyyc.',
      '.cCCCCCCCCc.',
      '.kyyyyyyyyk.',
      '.cCCCCCCCCc.',
      '.kyyyyyyyyk.',
      '.cCCCCCCCCo.',
      '..oooooooo..',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0', k: '#4a2a1a' },
  },
  cinnamon: {
    rows: [
      '...cccccc...',
      '..cCwwyyCc..',
      '.cCyCCCCwyc.',
      '.cyCyyyyCyc.',
      '.cyCyCCyCwc.',
      '.cwCyyCCyCc.',
      '.cyCCCCyCyc.',
      '..cCyywwCc..',
      '...oooooo...',
    ],
    palette: { o: '#7a3f1c', c: '#b8682c', C: '#d98f45', y: '#f0b866', h: '#fbe0a8', f: '#fdf4e0', w: '#fdf6ec' },
  },
  muffin: {
    rows: [
      '...ffffff...',
      '..fyyByyyf..',
      '.fyByyyByyf.',
      '.fyyyByyyyf.',
      '..pPpPpPpP..',
      '..PpPpPpPp..',
      '..pPpPpPpP..',
      '...PpPpPpP..',
      '...pppppp...',
    ],
    palette: { f: '#c47a3a', y: '#e8b060', B: '#4a5a96', p: '#5a92d4', P: '#8fb8e8' },
  },
  melonpan: {
    rows: [
      '....cccc....',
      '..cyhyyhyc..',
      '.cyhyyhyyhc.',
      '.chyyhyyhyc.',
      'cyyhyyhyyhyc',
      'chyyhyyhyyyc',
      'cyyhyyhyyhyo',
      '.oCCCCCCCCo.',
      '..oooooooo..',
    ],
    palette: { o: '#7a3f1c', c: '#c48a3a', C: '#d9a84a', y: '#f6dc8a', h: '#d9a84a' },
  },
  eggtart: {
    rows: [
      '............',
      '............',
      '..cccccccc..',
      '.cYYYYYYYYc.',
      'cCYyYYoYYYCc',
      'cCYYYYYYyYCc',
      'cCYoYYYYYYCc',
      '.cCCCCCCCCo.',
      '..oooooooo..',
    ],
    palette: { o: '#a8622c', c: '#b8682c', C: '#d98f45', Y: '#f6d45e', y: '#fff0a0' },
  },
  cheesecake: {
    rows: [
      '..........b.',
      '........bbb.',
      '......bbhhb.',
      '....bbhhhhb.',
      '..bbhhhhhhb.',
      'bbhhhhhhhhb.',
      'hhhhhhhhhhh.',
      'hhhhhhhhhhh.',
      'ccccccccccc.',
      'ooooooooooo.',
    ],
    palette: { b: '#d9a05a', h: '#fbeec6', c: '#b8682c', o: '#8a4a20' },
  },
  macaron: {
    rows: [
      '...pppppp...',
      '..pPPPPPPp..',
      '..wwwwwwww..',
      '..pppppppp..',
      '...gggggg...',
      '..gGGGGGGg..',
      '..wwwwwwww..',
      '..gggggggg..',
      '...yyyyyy...',
      '..yYYYYYYy..',
      '..wwwwwwww..',
      '..yyyyyyyy..',
    ],
    palette: { p: '#ef8fb4', P: '#ffc6dc', g: '#9fd47e', G: '#cdeeb4', y: '#f2d14e', Y: '#fff0a0', w: '#fdf6ec' },
  },
};

const itemCache = new Map<string, HTMLCanvasElement>();

export function itemIcon(id: ItemId, outline = true): HTMLCanvasElement {
  const key = `${id}.${outline}`;
  let c = itemCache.get(key);
  if (!c) {
    const art = ITEM_ART[id];
    c = pixelSprite(art.rows, art.palette, outline ? 'sel' : false);
    itemCache.set(key, c);
  }
  return c;
}

// ---------------------------------------------------------------- ingredients (12x10)

const INGREDIENT_ART: Record<IngredientId, { rows: string[]; palette: Palette }> = {
  beans: {
    rows: [
      '....tt......',
      '...tTTt.....',
      '..sSSSSSs...',
      '.sSSSSSSSs..',
      '.SSSSbbSSs..',
      '.SSSbBBbSs..',
      '.SSSbBbbSs..',
      '.SSSSbbSSs..',
      '.SSSSSSSSs..',
      '..sssssss...',
    ],
    palette: { s: '#a8814f', S: '#c9a06a', t: '#7a5634', T: '#9c7044', b: '#5e3420', B: '#8b5532' },
  },
  milk: {
    rows: [
      '....wW......',
      '...wwWW.....',
      '..wwwWWW....',
      '..WWWWWW....',
      '..wbbbbW....',
      '..wbBBbW....',
      '..wbbbbW....',
      '..wwwwwW....',
      '..wwwwwW....',
      '..WWWWWW....',
    ],
    palette: { w: '#fdf6ec', W: '#dccdb9', b: '#5a92d4', B: '#cfe6f6' },
  },
  cocoa: {
    rows: [
      '..kkkkkkk...',
      '..KKKKKKK...',
      '..ccccccc...',
      '..cCCCCCc...',
      '..cCwwwCc...',
      '..cCwCwCc...',
      '..cCwwwCc...',
      '..cCCCCCc...',
      '..ccccccc...',
      '..kkkkkkk...',
    ],
    palette: { k: '#8b5532', K: '#c48a55', c: '#6e3f24', C: '#a86f4c', w: '#f6dfc2' },
  },
  matcha: {
    rows: [
      '..kkkkkkk...',
      '..KKKKKKK...',
      '..ggggggg...',
      '..gGGGGGg...',
      '..gGwwwGg...',
      '..gGwgwGg...',
      '..gGwwwGg...',
      '..gGGGGGg...',
      '..ggggggg...',
      '..kkkkkkk...',
    ],
    palette: { k: '#3f6f3a', K: '#6f9e45', g: '#4e8a4f', G: '#7fbf5e', w: '#e6f2c8' },
  },
  fruit: {
    rows: [
      '....g..g....',
      '...gGggGg...',
      '..rRrgrRr...',
      '.rRrrrrRrr..',
      '.rrryrrryr..',
      '.rrrrrrrrr..',
      '..ryrrrrr...',
      '..rrrryr....',
      '...rrrr.....',
      '....rr......',
    ],
    palette: { r: '#e2434b', R: '#ff8a8a', y: '#f6d58e', g: '#4e8a4f', G: '#7fbf5e' },
  },
  flour: {
    rows: [
      '....tt......',
      '...tTTt.....',
      '..fFFFFFf...',
      '.fFFFFFFFf..',
      '.FFFwwwFFf..',
      '.FFwwwwwFf..',
      '.FFFwwwFFf..',
      '.FFFFFFFFf..',
      '.FFFFFFFFf..',
      '..fffffff...',
    ],
    palette: { t: '#a8814f', T: '#c9a06a', f: '#d9c3a0', F: '#f4e8d2', w: '#f2c14e' },
  },
  butter: {
    rows: [
      '............',
      '............',
      '...yyyyyyy..',
      '..yYYYYYYy..',
      '.yYYYYYYyy..',
      '.wwwwwwwwyy.',
      '.wbbbbbbwy..',
      '.wwwwwwwwy..',
      '.wwwwwwww...',
    ],
    palette: { y: '#f2c14e', Y: '#fff0a0', w: '#fdf6ec', b: '#5a92d4' },
  },
  eggs: {
    rows: [
      '............',
      '..ee........',
      '.eEEe..ee...',
      'eEEEee.eEEe.',
      'eEEEEeeEEEEe',
      'eEEEEeeEEEEe',
      'eEEEe.eEEEEe',
      '.eee...eEEe.',
      '........ee..',
    ],
    palette: { e: '#e8cfa8', E: '#fbf0dc' },
  },
  sugar: {
    rows: [
      '............',
      '....wwww....',
      '....wWWw....',
      '....wWWw....',
      '.wwwwwwwww..',
      '.wWWwwWWWw..',
      '.wWWwwWWWw..',
      '.wwwwwwwww..',
    ],
    palette: { w: '#e6e0d6', W: '#ffffff' },
  },
  tea: {
    rows: [
      '..kkkkkkk...',
      '..KKKKKKK...',
      '..rrrrrrr...',
      '..rRRRRRr...',
      '..rRgGgRr...',
      '..rRGgGRr...',
      '..rRRgRRr...',
      '..rRRRRRr...',
      '..rrrrrrr...',
      '..kkkkkkk...',
    ],
    palette: { k: '#8a6a2a', K: '#d9b04a', r: '#b5432c', R: '#d65a4a', g: '#4e8a4f', G: '#7fbf5e' },
  },
  spice: {
    rows: [
      '............',
      '..nN........',
      '..nNnN......',
      '...nNnN.....',
      '....nNnN....',
      '.....nNnN...',
      '......nNnN..',
      '.......nNn..',
      '..ss........',
      '.sSSs.......',
    ],
    palette: { n: '#8a4a20', N: '#c47a3a', s: '#6b3f26', S: '#a0602c' },
  },
  cream: {
    rows: [
      '............',
      '........yy..',
      '......yyYy..',
      '....yyYYYy..',
      '..yyYYYYYy..',
      'yyYYYYYYYy..',
      'YYoYYYYoYY..',
      'YYYYYoYYYY..',
      'YYYYYYYYYY..',
    ],
    palette: { y: '#e8b84a', Y: '#f6d45e', o: '#d9a038' },
  },
};

const ingredientCache = new Map<IngredientId, HTMLCanvasElement>();
export function ingredientIcon(id: IngredientId): HTMLCanvasElement {
  let c = ingredientCache.get(id);
  if (!c) {
    c = pixelSprite(INGREDIENT_ART[id].rows, INGREDIENT_ART[id].palette);
    ingredientCache.set(id, c);
  }
  return c;
}

// ---------------------------------------------------------------- upgrades

const UPGRADE_ART: Record<Exclude<UpgradeId, 'barista' | 'server' | 'cook'>, { rows: string[]; palette: Palette }> = {
  marketing: {
    rows: [
      '.kkkkkkkkkk.',
      '.kGGGGGGGGk.',
      '.kGwwwGGGGk.',
      '.kGGGGwwGGk.',
      '.kGwwGGGGGk.',
      '.kGGGGGGGGk.',
      '.kkkkkkkkkk.',
      '..K......K..',
      '.K........K.',
      'K..........K',
    ],
    palette: { k: '#a46d41', K: '#7f5232', G: '#2f4f3a', w: '#f4ece0' },
  },
  machine: {
    rows: [
      'LLLLLLLLLLLL',
      'LmmmmmmmmmmL',
      'LLLLLLLLLLLL',
      'LllllllllllL',
      'Ll.kk..kk.lL',
      'Ll..k...k.lL',
      'Ll.ww.....lL',
      'Ll.ww...r.lL',
      'LLLLLLLLLLLL',
    ],
    palette: { L: '#8796a0', l: '#b6c3cb', m: '#e2e9ec', k: '#3a3f44', w: '#fdf6ec', r: '#e2434b' },
  },
  tables: {
    rows: [
      '...ww.......',
      '.kkkkkkkkkk.',
      'kKKKKKKKKKKk',
      '.kkkkkkkkkk.',
      '.....KK.....',
      '.....KK.....',
      '.....KK.....',
      '...KKKKKK...',
    ],
    palette: { k: '#c28a52', K: '#7f5232', w: '#fdf6ec' },
  },
};

export function upgradeIcon(id: UpgradeId): HTMLCanvasElement {
  if (id === 'barista' || id === 'server' || id === 'cook') {
    const full = character({ skin: id === 'server' ? 2 : id === 'cook' ? 1 : 0, hair: id === 'server' ? 0 : 1, hairStyle: 1, shirt: 0, pants: 0 }, id).stand;
    const c = document.createElement('canvas');
    c.width = full.width;
    c.height = HEAD_ROWS + 2;
    c.getContext('2d')!.drawImage(full, 0, 0);
    return c;
  }
  const art = UPGRADE_ART[id];
  return pixelSprite(art.rows, art.palette);
}

// ---------------------------------------------------------------- the café cat

const CAT_PALETTE: Palette = { o: '#ef9f4c', O: '#f8c27e', d: '#c06a2c', e: '#2a1a1f', n: '#f08f8f', W: '#fdf1e0', w: '#e9d6bd' };
const CAT_BASE = [
  '.d......d.......',
  '.dd....dd.......',
  '.dOoooooo.......',
  '.oOdooodo.......',
  '.ooeoooeo.......',
  '.oooWnWoo.......',
  '..oWWWWo........',
  '..oooooo........',
  '.ooWWWWoo.......',
  'ooWWWWWWoo......',
  'oowwWWwwoooo....',
  '.oooooooooooo...',
];
const withTail = (rows: string[], tail: [number, number][]) =>
  rows.map((r, y) => [...r].map((ch, x) => (tail.some(([tx, ty]) => tx === x && ty === y) ? 'd' : ch)).join(''));

export const catFrames = (() => {
  let frames: Record<'idle' | 'swish' | 'blink' | 'happy', HTMLCanvasElement> | null = null;
  return () => {
    if (frames) return frames;
    const idle = withTail(CAT_BASE, [[12, 10], [13, 9], [13, 8], [14, 7]]);
    const swish = withTail(CAT_BASE, [[12, 10], [13, 10], [14, 10], [15, 9]]);
    const blink = idle.map((r, y) => (y === 4 ? '.oodoooddo......' : r));
    const happy = idle.map((r, y) => (y === 5 ? '.oooenWeo.......' : r));
    frames = {
      idle: pixelSprite(idle, CAT_PALETTE),
      swish: pixelSprite(swish, CAT_PALETTE),
      blink: pixelSprite(blink, CAT_PALETTE),
      happy: pixelSprite(happy, CAT_PALETTE),
    };
    return frames;
  };
})();

// ---------------------------------------------------------------- small effects

const lazySprite = (rows: string[], palette: Palette) => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= pixelSprite(rows, palette));
};

export const heartSprite = lazySprite(['.rr.rr.', 'rRrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], {
  r: '#ef5d7a',
  R: '#ffb3c1',
});
export const dropSprite = lazySprite(['..b..', '.bbb.', 'bBbbb', 'bbbbb', '.bbb.'], { b: '#6fa8e8', B: '#d7ecff' });
export const crownSprite = lazySprite(['y..y..y', 'yy.y.yy', 'yyyyyyy', 'yRyByRy'], {
  y: '#f2c14e',
  R: '#e2434b',
  B: '#5b93d1',
});

export function toDataURL(canvas: HTMLCanvasElement, scale: number): string {
  const c = document.createElement('canvas');
  c.width = canvas.width * scale;
  c.height = canvas.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL();
}
