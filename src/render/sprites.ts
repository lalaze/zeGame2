import type { IngredientId, ItemId, UpgradeId } from '../game/data';
import type { Look } from '../game/state';
import { edge, mix, ramp } from './color';

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
export function pixelSprite(rows: readonly string[], palette: Palette, outline: Outline = 'sel', density = 1): HTMLCanvasElement {
  const pad = outline ? 1 : 0;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = (w + pad * 2) * density;
  canvas.height = (h + pad * 2) * density;
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
        ctx.fillRect((x + pad) * density, (y + pad) * density, density, density);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (ch === '.') continue;
      const base = color(ch);
      // A consistent upper-left key light gives all silhouettes volume.
      const top = at(x, y - 1) === '.';
      const left = at(x - 1, y) === '.';
      const bottom = at(x, y + 1) === '.';
      const right = at(x + 1, y) === '.';
      const lit = top || left ? mix(base, '#fff1cf', 0.13) : bottom || right ? mix(base, '#493951', 0.16) : base;
      const dx = (x + pad) * density, dy = (y + pad) * density;
      ctx.fillStyle = lit;
      ctx.fillRect(dx, dy, density, density);
      if (density > 1) {
        // Subpixel strokes follow material boundaries, rather than adding a
        // bevel to every pixel. This creates finer art, not a blurred upscale.
        if (at(x, y - 1) !== ch) {
          ctx.fillStyle = mix(lit, '#fff5df', 0.24);
          ctx.fillRect(dx, dy, density, 1);
        }
        if (at(x + 1, y) !== ch) {
          ctx.fillStyle = mix(lit, '#453344', 0.16);
          ctx.fillRect(dx + density - 1, dy + 1, 1, density - 1);
        }
      }
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
// 16x26 sprites in Stardew proportions: a big round head (rows 0-13), a short
// torso with arms (14-21) and stubby legs (22-25). With the outline the canvas
// is 18x28 and the feet sit on its second-to-last row.
// S/s/Z skin, E eyes, e eye shine, B blush, m mouth, T/t/U/V shirt,
// P/p pants, K/k shoes, H/h/L hair, A/a/Y hat, W/w hat band, R/r/Q apron.

export const SKINS = ['#fcd9b8', '#eab48a', '#c88a58', '#8d5a3a'];
export const HAIRS = ['#5a3a2a', '#9a5f34', '#f0c868', '#d4603a', '#4a5a96', '#ec9cc0'];
export const SHIRTS = ['#d65a4a', '#5a92d4', '#78b45a', '#f2b33d', '#9f78d2', '#f08fb2', '#4cb4a6', '#efe6d2'];
export const PANTS = ['#3f4f80', '#6e4a32', '#46404f'];

/** Height of the head in a character canvas, for cropping portraits. */
export const HEAD_ROWS = 16;

export const FRONT = [
  '................',
  '................',
  '....SSSSSSSS....',
  '...SSSSSSSSSS...',
  '..SSSSSSSSSSSS..',
  '..SSSSSSSSSSSs..',
  '..SSSSSSSSSSSs..',
  '..SSSSSSSSSSSs..',
  '..SSSeSSSSeSSs..',
  '..SSSESSSSESSs..',
  '..SSBSSSSSSBSs..',
  '...SSSSmmSSSs...',
  '....sSSSSSSs....',
  '......ssss......',
  '....tTTVVTTt....',
  '...UTTTTTTTTt...',
  '..UTtTTTTTTtTt..',
  '..UTtTTTTTTtTt..',
  '..TTtTTTTTTtTt..',
  '..TttTTTTTTttt..',
  '..SZ.tTTTTt.Zs..',
  '....pPPPPPPp....',
];
const BACK = FRONT.map((row, y) => (y >= 8 && y <= 11 ? row.replace(/[EeBm]/g, 'S') : y === 14 ? '....tTTTTTTt....' : row));
export const SIDE = [
  '................',
  '................',
  '.....SSSSSSS....',
  '....SSSSSSSSS...',
  '...SSSSSSSSSSS..',
  '...SSSSSSSSSSS..',
  '...SSSSSSSSSSS..',
  '...SSSSSSSSSSSS.',
  '...SSSSSSSSESSS.',
  '...SSSSSSSSESSS.',
  '...sSSSSSSSSBSS.',
  '....sSSSSSSSSm..',
  '.....sSSSSSSs...',
  '.......sss......',
  '......tTTTVt....',
  '.....tTTTTTTt...',
  '.....tTUUTTTt...',
  '.....tTUUTTTt...',
  '.....tTUUTTTt...',
  '.....tTUUTTTt...',
  '......tZSTTt....',
  '......pPPPPp....',
];

export const LEGS_FRONT = [
  ['....PPp..PPp....', '....PPp..PPp....', '....KKk..KKk....', '...KKKk..KKKk...'],
  ['....PPp..PPp....', '....PPp..KKk....', '....KKk..KKKk...', '...KKKk.........'],
  ['....PPp..PPp....', '....KKk..PPp....', '...KKKk..KKk....', '.........KKKk...'],
];
export const LEGS_SIDE = [
  ['.......PPp......', '.......PPp......', '.......KKk......', '.......KKKKk....'],
  ['......PPp.PPp...', '.....PPp...PPp..', '.....KKk....KKk.', '....KKk.....KKKk'],
];
// Sitting sideways: thighs point forward and the table hides the rest.
const LEGS_SEATED = ['......PPPPPPPP..', '......pPPPPPPKk.'];

const APRON_FRONT = [
  ...Array(14).fill(''),
  '.....Q....Q.....',
  '.....Q....Q.....',
  '.....RRRRRR.....',
  '.....RRRRRr.....',
  '.....RJQJRr.....',
  '....RRRRRRRr....',
  '....RRRRRRRr....',
  '....rRRRRRRr....',
];
const APRON_SIDE = [
  ...Array(14).fill(''),
  '..........Q.....',
  '..........RQ....',
  '..........RRr...',
  '..........RRr...',
  '..........RRr...',
  '.........RRRr...',
  '.........RRRr...',
  '.........rRRr...',
];
const APRON_BACK = [...Array(14).fill(''), '', '', '', '', '', '....rQQQQQQr....'];

type HairSet = { front: string[]; side: string[]; back: string[] };

/** A cook's skull cap, worn over any hairstyle. */
const CAP = [
  '....cCCCCCCc....',
  '..cCCCCCCCCCCc..',
  '.cCCCCCCCCCCCCc.',
  '.cCCCCCCCCCCCCc.',
  '.cccccccccccccc.',
];

const SHORT_BACK = [
  '.....hHHHHh.....',
  '...hHHLLHHHHh...',
  '..hHHLLHHHHHHh..',
  '.hHHLLHHHHHHHHh.',
  '.HHHHHHHHHHHHHh.',
  '.HHHHHHHHHHHHHh.',
  '.HHHHHHHHHHHHHh.',
  '.HHHHHHHHHHHHHh.',
  '.hHHHHHHHHHHHhh.',
  '.hHHHHHHHHHHHhh.',
  '..hHHHHHHHHHhh..',
  '...hhHHHHHHhh...',
  '....hhhhhhhh....',
];

export const HAIR: HairSet[] = [
  // short, swept bangs
  {
    front: [
      '.....hHHHHh.....',
      '...hHHLLHHHHh...',
      '..hHHLLHHHHHHh..',
      '.hHHLLHHHHHHHHh.',
      '.HHHLHHHHHHHHHh.',
      '.HHHHHHHHhHHHHh.',
      '.HHHHHhHHhhHHHh.',
      '.HHh.hH.hh.hHHh.',
      '.Hh.........Hh..',
      '.h...........h..',
    ],
    side: [
      '......hHHHh.....',
      '....hHHLLHHh....',
      '...hHHLLHHHHH...',
      '..hHHLHHHHHHHH..',
      '..HHHHHHHHHHHHH.',
      '..HHHHHHHHHhHHH.',
      '..HHHHHHHhh.hH..',
      '..hHHHHHH.......',
      '..hHHHHh........',
      '...hHHh.........',
      '....hh..........',
    ],
    back: SHORT_BACK,
  },
  // bun
  {
    front: [
      '......hLLh......',
      '.....hHLHHh.....',
      '....hHHHHHHh....',
      '..hHHLLHHHHHhh..',
      '.hHHLHHHHHHHHHh.',
      '.HHHHHHHHHHHHHh.',
      '.HHHHHhhHHHHHHh.',
      '.HHh.......hHHh.',
      '.Hh.........Hh..',
      '..h..........h..',
    ],
    side: [
      '................',
      '......hHHHh.....',
      '.hh.hHHLLHHh....',
      'hLHhHHLLHHHHH...',
      'hHHhHLHHHHHHHH..',
      '.hhHHHHHHHHHHHH.',
      '..HHHHHHHHHhHHH.',
      '..HHHHHHHhh.....',
      '..hHHHHHH.......',
      '..hHHHHh........',
      '...hhhh.........',
    ],
    back: ['......hLLh......', '.....hHLHHh.....', ...SHORT_BACK.slice(1)],
  },
  // long
  {
    front: [
      '.....hHHHHh.....',
      '...hHHLLHHHHh...',
      '..hHHLLHHHHHHh..',
      '.hHHLLHHHHHHHHh.',
      '.HHHLHHHHHHHHHh.',
      '.HHHHHHHHHHHHHh.',
      '.HHHHhHHHHhHHHh.',
      '.HHH........HHh.',
      '.HHh........hHh.',
      '.HHh........hHh.',
      '.HHh........hHh.',
      '.HHH........HHh.',
      '.HHh........hHh.',
      '.HHh........hHh.',
      '.hHh........hhh.',
      '..hh........hh..',
    ],
    side: [
      '......hHHHh.....',
      '....hHHLLHHh....',
      '...hHHLLHHHHH...',
      '..hHHLHHHHHHHH..',
      '..HHHHHHHHHHHHH.',
      '..HHHHHHHHHhHHH.',
      '..HHHHHHHhh.hH..',
      '..HHHHHHH.......',
      '..HHHHHHH.......',
      '..HHHHHH........',
      '..HHHHHH........',
      '..hHHHHH........',
      '..hHHHHh........',
      '..hHHHHh........',
      '...hHHh.........',
      '...hhh..........',
    ],
    back: [
      ...SHORT_BACK.slice(0, 10),
      '.HHHHHHHHHHHHHh.',
      '.HHHHHHHHHHHHHh.',
      '.HHHHHHHHHHHHhh.',
      '.hHHHHHHHHHHHhh.',
      '..hHHHHHHHHHhh..',
      '...hhhhhhhhhh...',
    ],
  },
  // beanie
  {
    front: [
      '.......Y........',
      '.....aAYAAa.....',
      '...aAAYAAAAAa...',
      '..aAYAAAAAAAAa..',
      '.aAAAAAAAAAAAAa.',
      '.WWwWWwWWwWWwWW.',
      '.wwwwwwwwwwwwww.',
      '.HHh.hH.hh.hHHh.',
      '.Hh.........Hh..',
    ],
    side: [
      '........Y.......',
      '.....aAAYAa.....',
      '....aAAYAAAAa...',
      '...aAYAAAAAAAa..',
      '..aAAAAAAAAAAAa.',
      '..WWwWWwWWwWWwW.',
      '..wwwwwwwwwwwww.',
      '..hHHHHHH.hH....',
      '..hHHHHh........',
      '...hHHh.........',
      '....hh..........',
    ],
    back: [
      '.......Y........',
      '.....aAYAAa.....',
      '...aAAYAAAAAa...',
      '..aAYAAAAAAAAa..',
      '.aAAAAAAAAAAAAa.',
      '.WWwWWwWWwWWwWW.',
      '.wwwwwwwwwwwwww.',
      '.HHHHHHHHHHHHHh.',
      '.hHHHHHHHHHHHhh.',
      '.hHHHHHHHHHHHhh.',
      '..hHHHHHHHHHhh..',
      '...hhHHHHHHhh...',
      '....hhhhhhhh....',
    ],
  },
];

export type Role = 'customer' | 'barista' | 'owner' | 'server' | 'cook';
export type Facing = 'down' | 'up' | 'left' | 'right';

export interface CharacterFrames {
  /** [stand, stepA, stepB] for each direction. */
  down: HTMLCanvasElement[];
  up: HTMLCanvasElement[];
  left: HTMLCanvasElement[];
  right: HTMLCanvasElement[];
  /** Seated, facing left or right. */
  sitLeft: HTMLCanvasElement;
  sitRight: HTMLCanvasElement;
  /** Front-facing idle frame (for portraits and the shop counter). */
  stand: HTMLCanvasElement;
}

/** Character canvases are this tall; feet rest on row CHAR_H - 2. */
export const CHAR_H = FRONT.length + LEGS_FRONT[0].length + 2;

const charCache = new Map<string, CharacterFrames>();

/**
 * Staff wear an apron: green for hired baristas, navy for servers, the outfit color
 * for the owner. Cooks wear a white jacket, a slate apron and a skull cap.
 */
export function character(look: Look, role: Role = 'customer'): CharacterFrames {
  const key = `${look.skin}.${look.hair}.${look.hairStyle}.${look.shirt}.${look.pants}.${role}`;
  let frames = charCache.get(key);
  if (frames) return frames;

  const skin = ramp(SKINS[look.skin % SKINS.length]);
  const hair = ramp(HAIRS[look.hair % HAIRS.length]);
  const staff = role !== 'customer';
  const cook = role === 'cook';
  const shirt = ramp(cook ? '#fbfaf5' : staff ? '#f2ead8' : SHIRTS[look.shirt % SHIRTS.length]);
  const apron = ramp(role === 'owner' ? SHIRTS[look.shirt % SHIRTS.length] : role === 'server' ? '#3d4b6b' : cook ? '#5e7385' : '#4f8a5b');
  const pants = ramp(PANTS[look.pants % PANTS.length]);
  const hat = ramp(SHIRTS[(look.shirt + 3) % SHIRTS.length]);
  const palette: Palette = {
    S: skin.base, s: skin.lo, Z: skin.hi, E: '#2b1d2e', e: '#fff8ed', B: '#f09a86', m: '#a4503f',
    T: shirt.base, t: shirt.lo, U: shirt.hi, V: ramp(shirt.lo).lo,
    P: pants.base, p: pants.lo, K: '#6a4430', k: '#452a1e',
    H: hair.base, h: hair.lo, L: hair.hi,
    A: hat.base, a: hat.lo, Y: hat.hi, W: '#f2ead8', w: '#cdbfa8',
    R: apron.base, r: apron.lo, Q: apron.dark, J: '#e9c68e',
    C: '#fbfaf5', c: '#d9d6cc',
  };
  const hairStyle = HAIR[look.hairStyle % HAIR.length];
  const style = cook ? { front: layer(hairStyle.front, CAP), side: layer(hairStyle.side, CAP), back: layer(hairStyle.back, CAP) } : hairStyle;
  const dress = (rows: string[], apronRows: string[]) => (staff ? layer(rows, apronRows) : rows);

  const build = (body: string[], hairRows: string[], legs: string[]) =>
    pixelSprite(layer([...body, ...legs], hairRows), palette);
  const down = LEGS_FRONT.map((legs) => build(dress(FRONT, APRON_FRONT), style.front, legs));
  const up = LEGS_FRONT.map((legs) => build(dress(BACK, APRON_BACK), style.back, legs));
  const side = dress(SIDE, APRON_SIDE);
  const right = [LEGS_SIDE[0], LEGS_SIDE[1], LEGS_SIDE[0]].map((legs) => build(side, style.side, legs));
  const sitRight = build(side, style.side, LEGS_SEATED);
  frames = { down, up, right, left: right.map(flipped), sitRight, sitLeft: flipped(sitRight), stand: down[0] };
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
  cortado: {
    rows: [
      '............',
      '............',
      '..gGGGGGg...',
      '..gcccccg...',
      '..gCCCCCppp.',
      '..gmmmmmg.p.',
      '..gmmmmmgpp.',
      '...ggggg....',
      '..ddddddd...',
      '...DDDDD....',
    ],
    palette: { g: '#a9d5dc', G: '#eefbff', c: '#563022', C: '#bd8554', m: '#eacaa4', p: '#94bac2', d: '#f3e6d3', D: '#c4b096' },
  },
  vienna: {
    rows: [
      '.....w......',
      '....wWw.....',
      '...wWWww....',
      '..wwWkWww...',
      '..gkkkkkg...',
      '..gcccccgpp.',
      '..gcccccg.p.',
      '..gCCCCCgpp.',
      '...ggggg....',
      '..ddddddd...',
    ],
    palette: { w: '#f8e9d2', W: '#fffaf0', k: '#976342', g: '#b1d7df', c: '#532d22', C: '#865035', p: '#91b9c5', d: '#e8d5bb' },
  },
  dirty: {
    rows: [
      '............',
      '..gGGGGGGg..',
      '..gccCCccg..',
      '..gccCcccg..',
      '..gmcCmmmg..',
      '..gmmCmmmg..',
      '..gmmmmmmg..',
      '..gMmmmmMg..',
      '...gggggg...',
      '............',
    ],
    palette: { g: '#a6cbd3', G: '#eafaff', c: '#4b2d26', C: '#986440', m: '#fff0d9', M: '#e0ceb3' },
  },
  creamcoffee: {
    rows: [
      '.....s......',
      '....www.....',
      '..gwWswWwg..',
      '..gwwwwwwg..',
      '..gccccccg..',
      '..gccccccg..',
      '..gCccccCg..',
      '..gCCCCCCg..',
      '...gggggg...',
      '............',
    ],
    palette: { s: '#c3e3e8', w: '#f5e9d5', W: '#ffffff', g: '#89b9c6', c: '#56392c', C: '#966744' },
  },
  lemontea: {
    rows: [
      '........p...',
      '..yy...p....',
      '.yYyy.p.....',
      '..yggpGGg...',
      '...gaiaag...',
      '...gaaIag...',
      '...gaiaag...',
      '...gAAAAg...',
      '....gggg....',
      '............',
    ],
    palette: { p: '#f1d579', y: '#efbd35', Y: '#fff3a5', g: '#aacfd4', G: '#f0fcff', a: '#ce893b', A: '#a9652c', i: '#e7f6e9', I: '#cbe4dd' },
  },
  fruittea: {
    rows: [
      '........p...',
      '.......p....',
      '..gGGGpGGg..',
      '..giAAAiAg..',
      '..gArAyyAg..',
      '..gArrAyAg..',
      '..gAAoAAAg..',
      '..gAooArAg..',
      '...gggggg...',
      '............',
    ],
    palette: { p: '#6ca677', g: '#a7d8dc', G: '#f3ffff', i: '#e5f8ef', A: '#efb36b', r: '#dd5e6d', y: '#fce78a', o: '#e88837' },
  },
  hojicha: {
    rows: [
      '....s..s....',
      '...s..s.....',
      '............',
      '..ttttttt...',
      '..tffxffttt.',
      '..tTTTTTt.t.',
      '..tTTTTTttt.',
      '..ttttttt...',
      '...ttttt....',
      '..ddddddd...',
    ],
    palette: { s: '#e9dfce', t: '#867653', T: '#ae9e72', f: '#ead4ad', x: '#846044', d: '#cfc2a5' },
  },
  matchafloat: {
    rows: [
      '.....www....',
      '....wWWww...',
      '...wWWWWww..',
      '..gwwwwwwg..',
      '..gMMfMMMg..',
      '..gMMfMMMg..',
      '..gMMMMMMg..',
      '..gmmmmmmg..',
      '...gggggg...',
      '............',
    ],
    palette: { w: '#f4e2c5', W: '#fff7e3', g: '#a4cfd3', M: '#89af55', m: '#5e813b', f: '#e9ecc9' },
  },
  cheesebun: {
    rows: [
      '............',
      '....cccc....',
      '..ccYYYYcc..',
      '.cCYYyyYYCc.',
      '.cYyYYYYyCc.',
      'cCYYYhYYYYCc',
      'cCCYYYYYYCco',
      '.ocCCCCCCoo.',
      '..oooooooo..',
    ],
    palette: { c: '#b96d2f', C: '#db9747', Y: '#f5cb65', y: '#fff0a0', h: '#edac43', o: '#88461f' },
  },
  raisinbread: {
    rows: [
      '............',
      '...cccccc...',
      '..cChyhhyc..',
      '.cChrhhhrCc.',
      '.cChhhhrhCc.',
      '.cCrhhhhhCc.',
      '.cChhrhhhCo.',
      '..cooooooo..',
      '............',
    ],
    palette: { c: '#a46632', C: '#ce9651', h: '#efd09a', y: '#ffe1ad', r: '#66413e', o: '#784925' },
  },
  chocobread: {
    rows: [
      '............',
      '..cccccccc..',
      '.cCmmCmmCCc.',
      '.cCmmCmmCCc.',
      '.cCmmCmmCCc.',
      '.cCCCCCCCCc.',
      '.cMMMMMMMMo.',
      '..oooooooo..',
      '............',
    ],
    palette: { c: '#683e2d', C: '#a26e46', m: '#f0c88d', M: '#865735', o: '#4d2d25' },
  },
  fruitbrioche: {
    rows: [
      '....cc......',
      '...cYYcc....',
      '..ccYrYYc...',
      '.cYYcYYcc...',
      '..cYYccYYc..',
      '.cYrcYYcYc..',
      '..ccYrcYcc..',
      '...cYYcc....',
      '....oo......',
    ],
    palette: { c: '#bd7833', Y: '#f1c16b', r: '#b35446', o: '#895025' },
  },
  cookie: {
    rows: [
      '............',
      '...cccccc...',
      '..cYYkYYCc..',
      '.cYkYYYYYCc.',
      '.cYYYYkYYCc.',
      '.cYYkYYYkCc.',
      '..cYYYYYCo..',
      '...oooooo...',
      '............',
    ],
    palette: { c: '#bd813f', Y: '#e7bc79', C: '#d19a50', k: '#56372c', o: '#925d30' },
  },
  brownie: {
    rows: [
      '............',
      '....cccccc..',
      '..ccKhKKhKc.',
      '.cKKKKhKKKc.',
      '.cKhKKKKhKc.',
      '.cbbbbbbbbc.',
      '.cBbbBbbBbc.',
      '.cbbbbbbbbo.',
      '..oooooooo..',
    ],
    palette: { c: '#69402f', K: '#8d553b', h: '#c48b5b', b: '#563126', B: '#7a4a34', o: '#3d261f' },
  },
  creampuff: {
    rows: [
      '............',
      '....yyyy....',
      '..yyYhhYyy..',
      '.yYYhYYYyyc.',
      '.yYYYYYYycc.',
      '..wwWwwWww..',
      '.cwwwwwwwwc.',
      '.cYYYYYYYCc.',
      '..cooooooc..',
      '............',
    ],
    palette: { y: '#d69c52', Y: '#efbf78', h: '#ffdda0', c: '#ae713a', w: '#f9eed7', W: '#ffffff', C: '#dba15a', o: '#946033' },
  },
  swissroll: {
    rows: [
      '.....l......',
      '....rrr.....',
      '...rRrr.....',
      '..yyyyyyy...',
      '.ywwwwwwwy..',
      'ywyyrryywwy.',
      'ywywwwwywwy.',
      'ywywrrwywwy.',
      'ywwyyyywwwy.',
      '.yyyyyyyyy..',
      '..oooooooo..',
    ],
    palette: { l: '#65944b', r: '#dd5568', R: '#ff9b9f', y: '#e9bc7e', w: '#fff1db', o: '#b7864e' },
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

/** Three-times-density artwork for menus, reports and transparent PNG export. */
export function itemArtwork(id: ItemId): HTMLCanvasElement {
  const key = `${id}.artwork`;
  let canvas = itemCache.get(key);
  if (!canvas) {
    const art = ITEM_ART[id];
    canvas = pixelSprite(art.rows, art.palette, 'sel', 3);
    itemCache.set(key, canvas);
  }
  return canvas;
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
