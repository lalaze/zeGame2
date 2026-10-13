import { menuMiniature, ingredientMiniature, upgradeMiniature, miniatureSource, menuMiniatureGrid, ingredientMiniatureGrid } from './menu-miniatures';
import { signatureDrinkCanvas, signatureDrinkIcon } from './signature-drink-art';
import { CUSTOMER_CAST, type CustomerDesign } from '../game/customer-cast';
import type { CatId } from '../game/pets';
import type { IngredientId, ItemId, StaticItemId, UpgradeId } from '../game/data';
import type { Look } from '../game/state';
import { edge, mix, ramp } from './color';
import { fineSpriteArt, mirrorFineSpriteArt, registerFineCharacterArt } from './fine-sprite-art';
import { getGeneratedFoodAdapter, getGeneratedIngredientAdapter, getGeneratedTablewareAdapter } from './generated-main-art';

/** Warm near-black used for outlines, like Stardew's, rather than pure black. */
export const OUTLINE = '#39281f';

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

const flippedCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function flipped(src: HTMLCanvasElement): HTMLCanvasElement {
  const cached = flippedCache.get(src);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  mirrorFineSpriteArt(src, c);
  flippedCache.set(src, c);
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
  '....SZZSSSSs....',
  '...SZZZSSSSss...',
  '...SZZSSSSSSs...',
  '...SSSSSSSSSs...',
  '..SSSSSSSSSSSs..',
  '..SSSESSSSESSs..',
  '..sSSESSSSESss..',
  '...SBSSZSSBSs...',
  '....SSSmSSSs....',
  '.....sSSSSs.....',
  '......SssS......',
  '.....TWSSWt.....',
  '....UTTWWTTt....',
  '...UUTTTTTTTt...',
  '...UTtTTTTtTt...',
  '...ZS.tTTt.Ss...',
  '...Ss.TTTT.ss...',
  '.....tTTTTt.....',
  '.....pPPPPp.....',
];
const BACK = FRONT.map((row, y) => y >= 8 && y <= 11 ? row.replace(/[EBmZ]/g, 'S') : y === 14 ? '.....TTTTTt.....' : y === 15 ? '....UTTTTTTt....' : row);
export const SIDE = [
  '................',
  '................',
  '......SSSSS.....',
  '.....SZZSSSs....',
  '....SZZSSSSSs...',
  '....SZZSSSSSs...',
  '....SSSSSSSSs...',
  '....SSSSSSSSs...',
  '....SSSSSSSESs..',
  '....SSSSSSSESSs.',
  '....sSSSSSBSSs..',
  '.....sSSSSSm....',
  '......sSSSs.....',
  '.......Sss......',
  '......TWSWt.....',
  '.....UTTWTTt....',
  '.....UTUTTTt....',
  '.....tTUUTTt....',
  '.....tTUTTTt....',
  '......TZSTTt....',
  '......tTTTt.....',
  '......pPPPp.....',
];
export const LEGS_FRONT = [[
  '.....PPpPPp.....',
  '.....PPpPPp.....',
  '.....KK.KKk.....',
  '....KWK.KWKk....',
],[
  '.....PPpPPp.....',
  '.....PPpKKk.....',
  '.....KK.KWKk....',
  '....KWK.........',
],[
  '.....PPpPPp.....',
  '.....KK.PPp.....',
  '....KWK.KKk.....',
  '........KWKk....',
]];
export const LEGS_SIDE = [[
  '.......PPp......',
  '.......PPp......',
  '.......KKk......',
  '......KKWKkk....',
],[
  '......PPpPPp....',
  '.....PPp..PPp...',
  '.....KK....KKk..',
  '....KWK....KWKk.',
],[
  '......pPPPPp....',
  '......KK.PPp....',
  '.....KWK..KK....',
  '..........KWKk..',
]];
const LEGS_SEATED = ['......PPPPPPPp..', '......ppppPPPKk.'];
const APRON_FRONT = [
  ...Array(14).fill(''),
  '.....q....q.....',
  '.....q.WW.q.....',
  '.....JRRRRr.....',
  '.....RYRRRr.....',
  '.....JRRRrr.....',
  '.....JWWWRr.....',
  '....RJRrRRRr....',
  '....rrrrrrrr....',
];
const APRON_SIDE = [
  ...Array(14).fill(''),
  '..........q.....',
  '..........q.....',
  '..........Jr....',
  '..........Rr....',
  '..........Jr....',
  '..........Wr....',
  '.........JRRr...',
  '.........rrrr...',
];
const APRON_BACK = [...Array(14).fill(''), '.....Q....Q.....', '......Q..Q......', '.......QQ.......', '......Q..Q......', '', '.....rrWWrr.....', '.......WW.......'];
type HairSet = { front: string[]; side: string[]; back: string[] };
// A collection of separately authored warm-pixel hair silhouettes.
export const HAIR: HairSet[] = [
  {
    front: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHh...',
  '..HLLHHHHHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHHHhhHHHHh..',
  '..HHHh..hhHHHh..',
  '..HH.......HHh..',
  '...h........Hh..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    side: [
  '................',
  '......HLLHh.....',
  '....HLLLHHHh....',
  '...HLLHHHHHHh...',
  '...HLHHHHHHHHh..',
  '...HHHHHhhHHHh..',
  '...HHHHHh..Hh...',
  '...HHHHh........',
  '...HHS..........',
  '....h...........',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    back: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHh...',
  '..HLLHHHHHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHHHhhHHHHh..',
  '..HHLHHhHHHHHh..',
  '..HHLHHhHHHHHh..',
  '..HHLHHhHHHHHh..',
  '..HHLHHhHHHHHh..',
  '...HHHhHHHHhh...',
  '....hhhhhhhh....',
  '................',
  '................',
  '................',
],
  },
  {
    front: [
  '......HLLHh.....',
  '.....HLhHHh.....',
  '...HLLhHHhhHh...',
  '..HLLHWYWHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHHHhhHHHHh..',
  '..HHHh..hhHHHh..',
  '..HH.......HHh..',
  '...h........Hh..',
  '..h.............',
  '............h...',
  '................',
  '................',
  '................',
  '................',
],
    side: [
  '..HLLHh.........',
  '.HLhHHhLLHh.....',
  '..hHHhhLHHHh....',
  '..WYWLHHHHHHh...',
  '...HLHHHHHHHHh..',
  '...HHHHHhhHHHh..',
  '...HHHHHh..Hh...',
  '...HHHHh........',
  '...HHS..........',
  '....h...........',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    back: [
  '......HLLHh.....',
  '.....HLhHHh.....',
  '...HLLhHHhhHh...',
  '..HLLHWYWHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHHHhhHHHHh..',
  '..HHLHHhHHHHHh..',
  '..HHLHHhHHHHHh..',
  '..HHLHHhHHHHHh..',
  '..HHLHHhHHHHHh..',
  '...HHHhHHHHhh...',
  '....hhhhhhhh....',
  '................',
  '................',
  '................',
],
  },
  {
    front: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHh...',
  '..HLLHHHHHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHHHhhHHHHh..',
  '..LHhh..hhHHhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '...hh......hh...',
],
    side: [
  '................',
  '......HLLHh.....',
  '....HLLLHHHh....',
  '...HLLHHHHHHh...',
  '...HLHHHHHHHHh..',
  '...HHHHHhhHHHh..',
  '..HLHHhHh..Hh...',
  '..HLHHhh........',
  '..HLHHh.........',
  '..HLHHh.........',
  '..HLHHh.........',
  '..HLHHh.........',
  '..HLHHh.........',
  '..HLHHh.........',
  '...hhhh.........',
],
    back: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHh...',
  '..HLLHHHHHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHHHhhHHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '...hhhhhhhhh....',
],
  },
  {
    front: [
  '................',
  '......AYAAa.....',
  '....AYAYAAAa....',
  '...AYAYAAAAAa...',
  '..AYAAAAAAAaa...',
  '..AAYAAAAAAAaa..',
  '..AYAYAYAYAYaa..',
  '..aaAaaaWWaaaa..',
  '...H........H...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    side: [
  '................',
  '.......AYAAa....',
  '.....AYAYAAAa...',
  '....AYAYAAAAAa..',
  '...AYAAAAAAAaa..',
  '...AAYAAAAAAAaa.',
  '...AYAYAYAYAYaa.',
  '...aaAaaaWWaaaa.',
  '...HH...........',
  '....h...........',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    back: [
  '................',
  '......AYAAa.....',
  '....AYAYAAAa....',
  '...AYAYAAAAAa...',
  '..AYAAAAAAAaa...',
  '..AAYAAAAAAAaa..',
  '..AYAYAYAYAYaa..',
  '..aaAaaaWWaaaa..',
  '...HHHHHHHHhH...',
  '.....hhhhhh.....',
  '................',
  '................',
  '................',
  '................',
  '................',
],
  },
];
const CUSTOMER_HAIR: HairSet[] = [
  ...HAIR,
  {
    front: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHHh..',
  '..HLLHHHHHHHhHh.',
  '..HLHHHHHHHHHHh.',
  '..HHHHHhhHHHHW..',
  '..HHHh..hhHHHHh.',
  '..HH.......HHLh.',
  '...h........HHh.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    side: [
  '................',
  '......HLLHh.....',
  '....HLLLHHHh....',
  '.LHhLLHHHHHHh...',
  '.LHhLHHHHHHHHh..',
  '.WYWHHHHhhHHHh..',
  '.LHhHHHHh..Hh...',
  '.LHhHHHh........',
  '.LHhHS..........',
  '.LHhh...........',
  '.LHh............',
  '.LHh............',
  '..hh............',
  '................',
  '................',
],
    back: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHh...',
  '..HLLHHHHHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHHWYWHHHHh..',
  '..HHLHHHLhHHHh..',
  '..HHLHHLHhHHHh..',
  '..HHLHHHLhHHHh..',
  '..HHLHHLHhHHHh..',
  '...HHHHHLhHhh...',
  '....hhHLHhhh....',
  '......HHLh......',
  '.......hh.......',
  '................',
],
  },
  {
    front: [
  '....HH..HH......',
  '...HLLHHLLHh....',
  '...HLLLHHHHHh...',
  '.HLHLHHHHHHHhh..',
  '..HLHHHHHHHHHHh.',
  '.HhHHHHhhHHHHh..',
  '..HHHh..hhHHHHh.',
  '..Lh.......HHh..',
  '...h........Hh..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    side: [
  '....HH..HH......',
  '...HLLHHLLHh....',
  '....HLLLHHHh....',
  '.HLHLLHHHHHHh...',
  '...HLHHHHHHHHHh.',
  '.HhHHHHHhhHHHh..',
  '...HHHHHh..HhHh.',
  '..LhHHHh........',
  '...HHS..........',
  '....h...........',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    back: [
  '....HH..HH......',
  '...HLLHHLLHh....',
  '...HLLLHHHHHh...',
  '.HLHLHHHHHHHhh..',
  '..HLHHHHHHHHHHh.',
  '.HhHHHHhhHHHHh..',
  '..HHLHHhHHHHHHh.',
  '..LhLHHhHHHHHh..',
  '.HhHLHHhHHHHHh..',
  '..HHLHHhHHHHHh..',
  '...HHHhHHHHhh...',
  '....hHHHhhhh....',
  '................',
  '................',
  '................',
],
  },
  {
    front: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHh...',
  '..HLLHHHHHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHLHHLHHHHh..',
  '..Lhhhhhhhhhhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '..LHh......Hhh..',
  '...hh......hh...',
  '................',
  '................',
  '................',
],
    side: [
  '................',
  '......HLLHh.....',
  '....HLLLHHHh....',
  '...HLLHHHHHHh...',
  '...HLHHHHHHHHh..',
  '...HHLHHLHHHHh..',
  '..Hhhhhhh..Hh...',
  '..HLHHhh........',
  '..HLHHh.........',
  '..HLHHh.........',
  '..HLHHh.........',
  '...hhhh.........',
  '................',
  '................',
  '................',
],
    back: [
  '................',
  '.....HLLHHh.....',
  '...HLLLHHHHHh...',
  '..HLLHHHHHHHhh..',
  '..HLHHHHHHHHHh..',
  '..HHHLHHLHHHHh..',
  '..HhhhhhhhhhHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '..HLHHhHHhHHHh..',
  '...hhhhhhhhh....',
  '................',
  '................',
  '................',
],
  },
  {
    front: [
  '................',
  '........LHh.....',
  '......HLLHh.....',
  '....HLLHHHHh....',
  '...HLHHHHHHHh...',
  '...HHHhhHHHHh...',
  '...HHh...Hhh....',
  '...h............',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    side: [
  '................',
  '........LHh.....',
  '......HLLHh.....',
  '....HLLHHHHh....',
  '...HLHHHHHHHh...',
  '...HHHhhHHHHh...',
  '...HHHHHhHhh....',
  '...hHHh.........',
  '.....HS.........',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
],
    back: [
  '................',
  '........LHh.....',
  '......HLLHh.....',
  '....HLLHHHHh....',
  '...HLHHHHHHHh...',
  '...HHHhhHHHHh...',
  '...HLHHHHHhh....',
  '...HLHHHHHhh....',
  '...HLHHHHHhh....',
  '...HLHHHHHhh....',
  '.....hhhhh......',
  '................',
  '................',
  '................',
  '................',
],
  },
];
// A small baker's toque. Its silhouette is shared across all three views.
const CAP = [
  '.....CC.CC......',
  '...CCCCCCCCCC...',
  '..CCWCCWCCWCCc..',
  '...CCCCCCCCcc...',
  '....CWCCWCcc....',
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
  /** Original seated anchor, with the reaching hand extending below the feet. */
  sitPetRight: readonly [HTMLCanvasElement, HTMLCanvasElement];
  sitPetLeft: readonly [HTMLCanvasElement, HTMLCanvasElement];
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
  const apron = ramp(role === 'owner' ? SHIRTS[look.shirt % SHIRTS.length] : role === 'server' ? '#536f78' : cook ? '#865332' : '#627451');
  const pants = ramp(PANTS[look.pants % PANTS.length]);
  const hat = ramp(SHIRTS[(look.shirt + 3) % SHIRTS.length]);
  const palette: Palette = {
    S: skin.base, s: skin.lo, Z: skin.hi, E: '#42332f',
    B: look.skin < 2 ? '#db9b83' : '#af7565', m: '#9c6253',
    T: shirt.base, t: shirt.lo, U: shirt.hi, V: shirt.dark,
    P: pants.base, p: pants.lo, K: '#865332', k: '#543425',
    H: hair.base, h: hair.lo, L: hair.hi,
    A: hat.base, a: hat.lo, Y: '#c8a15e', W: '#f4e6c7', w: '#c8b18c',
    R: apron.base, r: apron.lo, Q: apron.dark, J: apron.hi,
    C: '#f7eddb', c: '#c7bfae', q: design?.accent ?? '#d4ac78', g: '#86684e',
  };
  const hairStyle = design ? CUSTOMER_HAIR[design.hairstyle] : HAIR[cook && look.hairStyle % HAIR.length === 3 ? 0 : look.hairStyle % HAIR.length];
  const style = cook ? { front: layer(hairStyle.front, CAP), side: layer(hairStyle.side, CAP), back: layer(hairStyle.back, CAP) } : hairStyle;
  const build = (body: string[], view: 'front' | 'side' | 'back', legs: string[], step: number, petStep?: number) => {
    let rows = [...outfit(body, role, view, look, step, design), ...legs];
    if (design) rows = customerDetails(rows, design, view, false);
    rows = layer(rows, style[view]);
    if (design) rows = customerDetails(rows, design, view, true);
    if (petStep !== undefined) {
      // Keep the seated head, garment and shoes registered exactly as before.
      // A bent sleeve and forearm reach down in front of the chair, not across
      // the tabletop. Extra transparent rows leave the original anchor intact.
      const grid = [...rows, ...Array<string>(8).fill('................')].map(row => [...row]);
      grid[19][7] = 'T'; grid[19][8] = 'T';
      const put = (x: number, y: number, text: string) => [...text].forEach((ch, dx) => { grid[y][x + dx] = ch; });
      put(5, 17, 'UTt'); put(5, 18, 'UTt'); put(5, 19, 'Tt');
      put(5, 20, 'Tt'); put(5, 21, 'Tt'); put(5, 22, 'Ss');
      put(5, 23, 'Ss'); put(5, 24, 'Ss'); put(6, 25, 'Ss');
      put(6, 26, 'Ss'); put(7, 27, 'Ss'); put(7, 28, 'Ss');
      put(7 + petStep, 29, 'ZS'); put(7 + petStep, 30, 'Ss');
      rows = grid.map(row => row.join(''));
    }
    const original = pixelSprite(rows, palette, OUTLINE);
    registerFineCharacterArt(original, rows, palette, view, OUTLINE);
    return original;
  };
  const down = LEGS_FRONT.map((legs, step) => build(FRONT, 'front', legs, step));
  const up = LEGS_FRONT.map((legs, step) => build(BACK, 'back', legs, step));
  const right = LEGS_SIDE.map((legs, step) => build(SIDE, 'side', legs, step));
  const sitRight = build(SIDE, 'side', LEGS_SEATED, 0);
  const sitPetRight = [build(SIDE, 'side', LEGS_SEATED, 0, 0), build(SIDE, 'side', LEGS_SEATED, 0, 1)] as const;
  const sitPetLeft = [flipped(sitPetRight[0]), flipped(sitPetRight[1])] as const;
  const frames = { down, up, right, left: right.map(flipped), sitRight, sitLeft: flipped(sitRight), sitPetRight, sitPetLeft, stand: down[0] };
  charCache.set(key, frames);
  return frames;
}

// ---------------------------------------------------------------- items (12x12)

/** Stable source envelopes: asset dimensions are part of the room and UI API. */
const MENU_ENVELOPES: Record<StaticItemId, readonly [number, number]> = {
  espresso: [12, 12],
  latte: [12, 11],
  cappuccino: [12, 11],
  croissant: [12, 8],
  mocha: [12, 10],
  matcha: [12, 10],
  frappe: [12, 11],
  cake: [12, 10],
  pourover: [12, 10],
  americano: [12, 10],
  flatwhite: [12, 10],
  macchiato: [12, 10],
  coldbrew: [12, 10],
  affogato: [12, 10],
  blacktea: [12, 10],
  hotchoc: [12, 10],
  chai: [12, 10],
  smoothie: [12, 10],
  milktea: [12, 10],
  roll: [12, 9],
  bagel: [12, 8],
  baguette: [12, 11],
  pretzel: [12, 11],
  focaccia: [12, 9],
  ciabatta: [12, 9],
  sourdough: [12, 9],
  rye: [12, 8],
  shokupan: [12, 10],
  brioche: [12, 9],
  garlicbread: [12, 9],
  donut: [12, 8],
  scone: [12, 9],
  painchoc: [12, 9],
  cinnamon: [12, 9],
  muffin: [12, 9],
  melonpan: [12, 9],
  eggtart: [12, 9],
  cheesecake: [12, 10],
  macaron: [12, 12],
  cortado: [12, 10],
  vienna: [12, 10],
  dirty: [12, 10],
  creamcoffee: [12, 10],
  lemontea: [12, 10],
  fruittea: [12, 10],
  hojicha: [12, 10],
  matchafloat: [12, 10],
  cheesebun: [12, 9],
  raisinbread: [12, 9],
  chocobread: [12, 9],
  fruitbrioche: [12, 9],
  cookie: [12, 9],
  brownie: [12, 9],
  creampuff: [12, 10],
  swissroll: [12, 11],
};

export const ITEM_ART = Object.fromEntries(
  (Object.keys(MENU_ENVELOPES) as StaticItemId[]).map(id => {
    const [w, h] = MENU_ENVELOPES[id];
    return [id, miniatureSource(menuMiniatureGrid(id), w, h)];
  }),
) as Record<StaticItemId, { rows: string[]; palette: Palette }>;

const itemCache = new Map<string, HTMLCanvasElement>();

export function itemIcon(id: ItemId, outline = true): HTMLCanvasElement {
  if (id.startsWith('sig:')) return signatureDrinkIcon(id);
  const generated = getGeneratedFoodAdapter()?.icon(id, outline);
  if (generated) return generated;
  const key = `${id}.${outline}`;
  let c = itemCache.get(key);
  if (!c) {
    const art = ITEM_ART[id as StaticItemId];
    c = menuMiniature(id as StaticItemId, Math.max(...art.rows.map(row => row.length)), art.rows.length, outline);
    itemCache.set(key, c);
  }
  return c;
}

/** Three-times-density artwork for menus, reports and transparent PNG export. */
export function itemArtwork(id: ItemId): HTMLCanvasElement {
  if (id.startsWith('sig:')) return signatureDrinkCanvas(id, 3);
  const generated = getGeneratedFoodAdapter()?.artwork(id);
  if (generated) return generated;
  const key = `${id}.artwork`;
  let canvas = itemCache.get(key);
  if (!canvas) {
    const art = ITEM_ART[id as StaticItemId];
    canvas = menuMiniature(id as StaticItemId, Math.max(...art.rows.map(row => row.length)), art.rows.length, true, 3);
    itemCache.set(key, canvas);
  }
  return canvas;
}

// ---------------------------------------------------------------- ingredients (12x10)

const INGREDIENT_ENVELOPES: Record<IngredientId, readonly [number, number]> = {
  beans: [12, 10],
  milk: [12, 10],
  cocoa: [12, 10],
  matcha: [12, 10],
  fruit: [12, 10],
  flour: [12, 10],
  butter: [12, 9],
  eggs: [12, 9],
  sugar: [12, 8],
  tea: [12, 10],
  spice: [12, 10],
  cream: [12, 9],
};

const INGREDIENT_ART = Object.fromEntries(
  (Object.keys(INGREDIENT_ENVELOPES) as IngredientId[]).map(id => {
    const [w, h] = INGREDIENT_ENVELOPES[id];
    return [id, miniatureSource(ingredientMiniatureGrid(id), w, h)];
  }),
) as Record<IngredientId, { rows: string[]; palette: Palette }>;

const ingredientCache = new Map<IngredientId, HTMLCanvasElement>();
export function ingredientIcon(id: IngredientId): HTMLCanvasElement {
  const generated = getGeneratedIngredientAdapter()?.icon(id);
  if (generated) return generated;
  let c = ingredientCache.get(id);
  if (!c) {
    const art = INGREDIENT_ART[id];
    c = ingredientMiniature(id, Math.max(...art.rows.map(row => row.length)), art.rows.length);
    ingredientCache.set(id, c);
  }
  return c;
}

// ---------------------------------------------------------------- upgrades

const UPGRADE_ENVELOPES = { marketing: [12, 10], machine: [12, 9], tables: [12, 8] } as const;

const upgradeCache = new Map<UpgradeId, HTMLCanvasElement>();
export function upgradeIcon(id: UpgradeId): HTMLCanvasElement {
  const cached = upgradeCache.get(id); if (cached) return cached;
  if (id === 'barista' || id === 'server' || id === 'cook') {
    const full = character({ skin: id === 'server' ? 2 : id === 'cook' ? 1 : 0, hair: id === 'server' ? 0 : 1, hairStyle: 1, shirt: 0, pants: 0 }, id).stand;
    const c = document.createElement('canvas');
    c.width = full.width;
    c.height = HEAD_ROWS + 2;
    c.getContext('2d')!.drawImage(full, 0, 0);
    upgradeCache.set(id, c);
    return c;
  }
  const [width, height] = UPGRADE_ENVELOPES[id];
  const canvas = upgradeMiniature(id, width, height);
  upgradeCache.set(id, canvas);
  return canvas;
}

// ---------------------------------------------------------------- the café cat

const CAT_PALETTE: Palette = { o: '#d99954', O: '#f1bd78', d: '#9b633b', e: '#39281f', n: '#cc8373', W: '#f4e6c7', w: '#ccb99a', p: '#e7a495', l: '#ffdab0' };
const CAT_COATS: Record<CatId, Palette> = {
  ginger: CAT_PALETTE,
  tuxedo: { ...CAT_PALETTE, o: '#41434b', O: '#686977', d: '#252831', e: '#a9c982' },
  calico: { ...CAT_PALETTE, o: '#f5e9d5', O: '#efac66', d: '#554039' },
  tabby: { ...CAT_PALETTE, o: '#9e8870', O: '#c4ad8c', d: '#584635', W: '#d8c7a8', w: '#b7a081', e: '#2b492a' },
  black: { ...CAT_PALETTE, o: '#343641', O: '#585d6c', d: '#22232d', W: '#3f4350', w: '#292d38', e: '#c4d879' },
  white: { ...CAT_PALETTE, o: '#f5f2e7', O: '#ffffff', d: '#c4c8cb', W: '#ffffff', w: '#dbe0e2', e: '#477fa5' },
  british: { ...CAT_PALETTE, o: '#8595aa', O: '#aebaca', d: '#55647a', W: '#a0aec0', w: '#6b7d94', e: '#ecb866' },
  american: { ...CAT_PALETTE, o: '#b8bec4', O: '#e3e5e4', d: '#5c6671', W: '#f2eee6', w: '#b4b6b9', e: '#42634c' },
  siamese: { ...CAT_PALETTE, o: '#e4cfaa', O: '#f9e4bf', d: '#675047', W: '#f5e4ca', w: '#9e8470', e: '#68bde7' },
  ragdoll: { ...CAT_PALETTE, o: '#e6ded2', O: '#ffffff', d: '#918075', W: '#ffffff', w: '#c4b9ac', e: '#4a9acb' },
  persian: { ...CAT_PALETTE, o: '#efc9a1', O: '#ffe8c8', d: '#c59174', W: '#fff0d8', w: '#dfb58f', e: '#967237' },
  mainecoon: { ...CAT_PALETTE, o: '#867060', O: '#ac9279', d: '#493e39', W: '#ccb89b', w: '#aa927b', e: '#d6bc63' },
};
// Rounded cheeks, inner ears, two separate front paws and a curled haunch.
const CAT_BASE = [
  '.d......d.......',
  '.dp....pd.......',
  '.oOOooodo.......',
  'ooOdooodoo......',
  '.ooeoooeo.......',
  '.ooWWnWWo.......',
  '..oWWWWo........',
  '..OowWoo........',
  '.oOWWWWoo.......',
  'ooOWWWWWoo......',
  'ooWWoWWwodoo....',
  '.wWWowWWoddoo...',
];
const withTail = (rows: string[], tail: [number, number][]) =>
  rows.map((r, y) => [...r].map((ch, x) => (tail.some(([tx, ty]) => tx === x && ty === y) ? 'd' : ch)).join(''));

export interface CatFrames {
  idle: HTMLCanvasElement;
  swish: HTMLCanvasElement;
  blink: HTMLCanvasElement;
  happy: HTMLCanvasElement;
  /** A quiet two-step gait, registered to the same ground line as idle. */
  walk: readonly [HTMLCanvasElement, HTMLCanvasElement];
  sleep: HTMLCanvasElement;
  groom: readonly [HTMLCanvasElement, HTMLCanvasElement];
  stretch: HTMLCanvasElement;
  watch: HTMLCanvasElement;
  /** Taller chest, same ground anchor, for a seated guest's lowered hand. */
  lookUp: HTMLCanvasElement;
  nuzzle: readonly [HTMLCanvasElement, HTMLCanvasElement];
}

export const catFrames = (() => {
  const cache = new Map<CatId, CatFrames>();
  return (coat: CatId = 'ginger') => {
    const cached = cache.get(coat);
    if (cached) return cached;
    const palette = CAT_COATS[coat];
    const body = CAT_BASE.map((row, y) => [...row].map((ch, x) => {
      if (coat === 'calico' && ch === 'o' && ((x < 4 && y < 5) || (x > 6 && y > 7))) return 'O';
      if (coat === 'calico' && ch === 'o' && x > 6 && y < 5) return 'd';
      if (coat === 'tuxedo' && ch === 'o' && x === 5 && y < 4) return 'W';
      if (coat === 'ginger' && ch === 'o' && y === 7 && x > 5) return 'd';
      if (['tabby', 'american', 'mainecoon'].includes(coat) && ch === 'o' && ((y === 3 && x % 2 === 0) || (y >= 7 && x % 3 === 0))) return 'd';
      if (['siamese', 'ragdoll'].includes(coat) && ch === 'o' && y < 6) return 'd';
      return ch;
    }).join(''));
    if (['ragdoll', 'persian', 'mainecoon'].includes(coat)) {
      body[6] = 'ooOWWWWoo.......';
      body[7] = '.oOWWWWwOo......';
      body[8] = 'oOWWWWWWoo......';
      body[9] = 'oOWwWWWwOoo.....';
    }
    if (coat === 'british' || coat === 'persian') { body[3] = 'oOOooooooo......'; body[7] = '.oOoooooo.......'; }
    if (coat === 'persian') body[5] = '.oWWWnWWW.......';
    if (coat === 'siamese') { body[2] = '.dOooooOd.......'; body[6] = '..wWWWWw........'; }
    if (coat === 'mainecoon') { body[0] = 'dd......dd......'; body[1] = '.dd....dd.......'; }
    const idle = withTail(body, [[12, 10], [13, 9], [13, 8], [14, 7], [15, 7]]);
    const swish = withTail(body, [[12, 10], [13, 10], [14, 10], [15, 9], [15, 8]]);
    // Expressions replace only the eyes/mouth, preserving each coat's markings.
    const edit = (rows: readonly string[], changes: readonly [number, number, string][]) => {
      const grid = rows.map(row => [...row]);
      for (const [x, y, text] of changes) [...text].forEach((ch, dx) => { grid[y][x + dx] = ch; });
      return grid.map(row => row.join(''));
    };
    const blink = edit(idle, [[3, 4, 'd'], [7, 4, 'd']]);
    const happy = edit(blink, [[5, 5, 'n'], [5, 6, 'e']]);
    const watch = edit(idle, [[3, 4, 'oe'], [7, 4, 'oe']]);
    const groomA = edit(blink, [[2, 6, 'WW'], [2, 7, 'wW'], [3, 8, 'w']]);
    const groomB = edit(blink, [[2, 5, 'WW'], [2, 6, 'wW'], [3, 7, 'w'], [4, 5, 'n']]);

    // Low, four-footed silhouettes, with the original breed head transplanted
    // intact. These grids are built only on the first request for a coat.
    const quadruped = (torso: string[], headY: number, eyesClosed: boolean) => {
      const grid = torso.map((row, y) => [...row].map((ch, x) => {
        if (coat === 'calico' && ch === 'o' && x > 9) return 'O';
        if (['tabby', 'american', 'mainecoon'].includes(coat) && ch === 'o' && y < 10 && x % 3 === 0) return 'd';
        return ch;
      }));
      for (let y = 0; y < 7; y++) for (let x = 0; x < 10; x++) {
        const ch = body[y][x];
        if (ch !== '.' && y + headY < 12) grid[y + headY][x] = eyesClosed && ch === 'e' ? 'd' : ch;
      }
      return grid.map(row => row.join(''));
    };
    const blank = '................';
    const walking = quadruped([
      blank, blank, blank, blank, blank, blank,
      '.......oOOooo...', '.....ooOOooodd..', '...ooWWWWoooo.d.',
      '...oWWwwwwooo.d.', '...wo....ow..d..', '..WWW....WW.....',
    ], 2, false);
    const walkA = edit(walking, [[3, 10, 'wo....ow.'], [2, 11, 'WW.....WW...']]);
    const walkB = edit(walking, [[3, 10, '.wo..ow..'], [2, 11, '...WW.WW....']]);
    const sleep = quadruped([
      blank, blank, blank, blank, blank, blank,
      '.........OOoo...', '.......oOOoooo..', '......oOWWooooo.',
      '....oOOWWoooodo.', '..oWWWWoooooOdd.', '..wWWWdddddddd..',
    ], 4, true);
    const stretch = quadruped([
      blank, blank, blank, blank, blank, '..........OOo...',
      '........oOOoood.', '.......oOWWoo.d.', '......oOWWoo..d.',
      '.....oWWWWo...d.', '...oWWW..ow.....', '.wWWWW...WWW....',
    ], 3, true);
    // Raised interaction is a rising chest, not a lengthened neck. The head
    // stays high enough to meet the guest's hand; shoulders broaden directly
    // below the jaw, two forelegs descend separately, and a shaded side
    // haunch carries the weight. Last two paw rows keep their exact anchor.
    const chest = [
      '.oOWWWWoo.......',
      '.oOWWWWWOo......',
      'ooOWWWWWOoo.....',
      'oOWWwWWwoOoo....',
      'ooWWoWWwoOoo....',
      'ooWWoWWwoooo....',
      '.owWoWWwwoo.....',
    ].map((row, y) => [...row].map((ch, x) => {
      if (coat === 'calico' && ch === 'o' && x > 8) return 'O';
      if (['tabby', 'american', 'mainecoon'].includes(coat) && ch === 'o' && (x + y) % 3 === 0) return 'd';
      if (['siamese', 'ragdoll'].includes(coat) && ch === 'w' && y > 3) return 'd';
      return ch;
    }).join(''));
    const tallBody = [...body.slice(0, 7), ...chest, ...body.slice(10)];
    const raised = withTail(tallBody, [[12, 14], [13, 13], [13, 12], [14, 11]]);
    const lookUp = edit(raised, [[3, 4, 'o'], [7, 4, 'o'], [3, 3, 'e'], [7, 3, 'e'], [5, 5, 'W'], [5, 4, 'n']]);
    const nuzzleA = edit(raised, [[3, 4, 'd'], [7, 4, 'd'], [5, 6, 'e']]);
    const nuzzleB = nuzzleA.map((row, y) => y < 7 ? '.' + row.slice(0, -1) : row);
    const paint = (rows: string[]) => pixelSprite(rows, palette, OUTLINE);
    const frames: CatFrames = {
      idle: paint(idle), swish: paint(swish), blink: paint(blink), happy: paint(happy),
      walk: [paint(walkA), paint(walkB)], sleep: paint(sleep),
      groom: [paint(groomA), paint(groomB)], stretch: paint(stretch), watch: paint(watch),
      lookUp: paint(lookUp), nuzzle: [paint(nuzzleA), paint(nuzzleB)],
    };
    cache.set(coat, frames);
    return frames;
  };
})();

// ---------------------------------------------------------------- small effects

const lazySprite = (rows: string[], palette: Palette) => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= pixelSprite(rows, palette));
};

const legacyHeartSprite = lazySprite(['.rr.rr.', 'rRRrrrs', 'rRrrrss', '.rrrss.', '..rss..', '...s...'], {
  r: '#c96761', R: '#f4b29b', s: '#9d4f49',
});
const legacyDropSprite = lazySprite(['..b..', '.Bbb.', 'bBbbs', 'bbbss', '.sss.'], { b: '#81aeb4', B: '#deeee0', s: '#537982' });
const legacyCrownSprite = lazySprite(['Y..Y..Y', 'yY.Y.Yy', 'yYyyyyy', 'yRyByRy'], {
  y: '#c8a15e', Y: '#f0ce85', R: '#ba5d50', B: '#627451',
});

export const heartSprite = (): HTMLCanvasElement => getGeneratedTablewareAdapter()?.sprite('heart') ?? legacyHeartSprite();
export const dropSprite = (): HTMLCanvasElement => getGeneratedTablewareAdapter()?.sprite('drop') ?? legacyDropSprite();
export const crownSprite = (): HTMLCanvasElement => getGeneratedTablewareAdapter()?.sprite('crown') ?? legacyCrownSprite();

export function toDataURL(canvas: HTMLCanvasElement, scale: number): string {
  const c = document.createElement('canvas');
  c.width = canvas.width * scale;
  c.height = canvas.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fineSpriteArt(canvas)?.canvas ?? canvas, 0, 0, c.width, c.height);
  return c.toDataURL();
}
