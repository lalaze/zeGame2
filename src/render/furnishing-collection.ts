// Reference A collection: authored cabinetry, tailored cloth, carved frames and
// organic plants. Every piece keeps its original pixel bounds and is baked once.
import { mix } from './color';
import { cabinetPanel, glassReflection } from './materials';

const INK = '#39281f', WOOD = '#865332', EDGE = '#c98c4d', SHADE = '#543425';
const LEAF = '#627451', LEAF_HI = '#a5b177', CREAM = '#f4e6c7', BRASS = '#c8a15e';
type Rect = (x: number, y: number, w: number, h: number, color: string) => void;
type Paint = (r: Rect, ctx: CanvasRenderingContext2D) => void;
const art = (w: number, h: number, paint: Paint) => () => {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const r: Rect = (x, y, width, height, color) => {
    if (width <= 0 || height <= 0) return;
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  };
  paint(r, ctx); return canvas;
};

function leaf(r: Rect, x: number, y: number, w = 4): void {
  r(x + 1, y, w - 1, 1, LEAF_HI); r(x, y + 1, w, 2, LEAF); r(x + 1, y + 3, w - 2, 1, '#405137');
}
function pot(r: Rect, x: number, y: number, w: number, h: number): void {
  r(x, y, w, 2, INK); r(x + 1, y, w - 2, 1, '#e3b77d');
  r(x + 1, y + 2, w - 2, h - 2, INK); r(x + 2, y + 2, w - 4, h - 3, '#b36c43');
  r(x + 2, y + 2, 1, h - 4, '#dc9e65'); r(x + w - 3, y + 2, 1, h - 3, '#864b33');
}

const plant = (kind: 'lavender' | 'succulent' | 'daisies') => art(kind === 'succulent' ? 8 : 14, kind === 'succulent' ? 13 : 25, (r) => {
  if (kind === 'succulent') {
    // Rosette leaf tips surround a tiny central bud; terracotta is glazed at rim.
    r(3, 0, 2, 5, '#405137'); r(3, 1, 1, 4, LEAF_HI);
    r(0, 3, 3, 2, LEAF); r(0, 3, 2, 1, LEAF_HI); r(5, 2, 3, 3, LEAF); r(6, 2, 2, 1, LEAF_HI);
    r(1, 5, 6, 2, '#405137'); r(2, 4, 4, 3, '#889d67'); r(3, 4, 2, 1, '#ccd3a0');
    pot(r, 0, 7, 8, 6); r(2, 10, 3, 1, CREAM); return;
  }
  for (let i = 0; i < 3; i++) {
    const px = 2 + i * 4, y = 4 + i % 2 * 3;
    r(px, y, 1, 19 - y, LEAF); r(px - 1, y + 8, 2, 2, LEAF); r(px + 1, y + 10, 2, 1, LEAF_HI);
    if (kind === 'lavender') {
      r(px, y - 3, 1, 1, '#d2b5ba'); r(px - 1, y - 2, 3, 6, '#8b788a');
      r(px - 1, y - 2, 2, 1, '#d2b5ba'); r(px, y, 2, 1, '#b899ac'); r(px - 1, y + 2, 2, 1, '#d2b5ba');
      r(px - 1, y + 5, 2, 2, '#697b54');
    } else {
      r(px - 2, y, 5, 1, '#fff2d4'); r(px, y - 2, 1, 5, '#fff2d4');
      r(px - 1, y - 1, 3, 3, CREAM); r(px, y, 1, 1, '#c98c4d'); r(px + 1, y + 1, 1, 1, '#c8a15e');
    }
  }
  if (kind === 'lavender') { pot(r, 2, 18, 10, 7); r(5, 21, 4, 2, CREAM); r(6, 21, 1, 1, '#8b788a'); }
  else {
    // Narrow neck opens into a bulbous celadon vase with a cream painted band.
    r(5, 15, 4, 3, INK); r(4, 18, 6, 1, INK); r(3, 19, 8, 4, INK); r(4, 23, 6, 2, INK);
    r(6, 16, 2, 3, '#a5b592'); r(4, 19, 6, 4, '#92a582'); r(5, 23, 4, 1, '#697b54');
    r(4, 20, 1, 2, CREAM); r(5, 22, 5, 1, '#d9dbb6');
  }
});

function poster(kind: 'coffee' | 'bakery') {
  return art(22, 22, (r, ctx) => {
    cabinetPanel(ctx, 0, 0, 22, 22, WOOD);
    r(3, 3, 16, 16, '#e7d0a1'); r(4, 4, 14, 14, CREAM);
    r(5, 5, 12, 1, '#b99765'); r(6, 17, 10, 1, '#b99765');
    // Letterpress ornaments and individual botanical sprigs flank the print.
    r(5, 7, 1, 7, LEAF); r(4, 9, 1, 1, LEAF); r(6, 12, 1, 1, LEAF_HI);
    r(17, 7, 1, 7, LEAF); r(16, 10, 1, 1, LEAF_HI); r(18, 13, 1, 1, LEAF);
    if (kind === 'coffee') {
      r(7, 10, 7, 5, INK); r(8, 11, 5, 3, '#aa5944'); r(8, 11, 1, 2, '#d9a17c');
      r(14, 10, 2, 3, INK); r(14, 11, 1, 1, CREAM); r(7, 9, 7, 1, CREAM);
      r(8, 10, 5, 1, '#543425'); r(6, 15, 10, 1, WOOD); r(9, 7, 1, 1, EDGE); r(12, 6, 1, 2, EDGE);
    } else {
      r(6, 12, 3, 3, '#a66b39'); r(13, 12, 3, 3, '#a66b39');
      r(8, 10, 6, 5, '#d49d54'); r(9, 9, 4, 1, '#efc984'); r(9, 10, 4, 1, '#efc984');
      r(8, 12, 1, 2, '#f0ce8e'); r(11, 11, 1, 3, '#a66b39'); r(13, 12, 1, 2, '#f0ce8e');
      r(6, 15, 10, 1, '#b99765');
    }
    r(1, 1, 1, 1, BRASS); r(20, 20, 1, 1, BRASS);
  });
}

const pieces: Record<string, () => HTMLCanvasElement> = {
  plant_lavender: plant('lavender'), plant_succulent: plant('succulent'), vase_daisies: plant('daisies'),
  poster_coffee: poster('coffee'), poster_bakery: poster('bakery'),
  wreath_season: art(22, 22, (r) => {
    for (let i = 0; i < 12; i++) {
      const x = Math.round(9 + Math.cos(i * Math.PI / 6) * 7), y = Math.round(8 + Math.sin(i * Math.PI / 6) * 7);
      leaf(r, x, y, 4); if (i % 3 === 0) { r(x + 2, y + 1, 2, 2, '#aa5944'); r(x + 2, y + 1, 1, 1, '#e4aa79'); }
    }
    r(7, 16, 3, 3, '#aa5944'); r(12, 16, 3, 3, '#c98764'); r(10, 17, 2, 2, BRASS);
    r(8, 19, 2, 3, '#aa5944'); r(13, 19, 2, 3, '#aa5944'); r(8, 19, 1, 2, '#dfae81');
  }),
  hanging_ivy: art(14, 24, (r) => {
    r(6, 0, 2, 2, INK); r(4, 2, 1, 4, BRASS); r(9, 2, 1, 4, BRASS); r(3, 5, 1, 3, BRASS); r(10, 5, 1, 3, BRASS);
    r(2, 7, 10, 2, INK); r(3, 8, 8, 5, '#a77747'); r(3, 8, 8, 1, '#deb47a');
    for (let x = 4; x < 11; x += 2) r(x, 9, 1, 3, '#d2a46e');
    leaf(r, 2, 5, 5); leaf(r, 7, 5, 5);
    for (let i = 0; i < 3; i++) {
      const x = 1 + i * 5; r(x + 1, 10, 1, 11 - i % 2 * 3, LEAF);
      for (let y = 11; y < 21 - i % 2 * 3; y += 4) leaf(r, x, y, 3);
    }
  }),
  wall_pennants: art(32, 8, (r) => {
    r(0, 0, 32, 1, SHADE);
    const colors = ['#aa5944', '#627451', '#c8a15e', '#708d8e', '#b98470'];
    for (let i = 0; i < colors.length; i++) {
      const x = 2 + i * 6, c = colors[i];
      r(x, 1, 5, 3, c); r(x + 1, 4, 3, 2, c); r(x + 2, 6, 1, 1, c);
      r(x, 1, 5, 1, mix(c, CREAM, 0.4)); r(x + 2, 2, 1, 3, CREAM); r(x + 1, 3, 3, 1, CREAM);
      r(x + 4, 2, 1, 2, mix(c, SHADE, 0.3));
    }
  }),
  lantern: art(12, 24, (r, ctx) => {
    r(4, 0, 4, 1, INK); r(3, 1, 1, 3, INK); r(8, 1, 1, 3, INK); r(4, 1, 1, 1, BRASS);
    r(3, 4, 6, 1, INK); r(2, 5, 8, 2, BRASS); r(1, 7, 10, 13, INK);
    r(2, 8, 8, 11, '#c69850'); r(3, 8, 6, 10, '#e9c87f'); r(4, 9, 4, 8, '#fff0b8');
    r(5, 13, 2, 5, CREAM); r(5, 11, 1, 2, '#fff8dc'); r(6, 12, 1, 1, '#e5a84d');
    glassReflection(ctx, 2, 8, 8, 11, 0.15); r(2, 8, 1, 11, BRASS); r(9, 8, 1, 12, '#7c5937');
    r(5, 7, 1, 3, BRASS); r(5, 18, 1, 2, BRASS); r(0, 20, 12, 2, INK);
    r(1, 20, 10, 1, BRASS); r(2, 22, 8, 2, INK); r(3, 22, 6, 1, '#ad8147');
  }),
  bean_display: art(22, 24, (r) => {
    r(1, 17, 20, 5, INK); r(2, 18, 18, 3, WOOD); r(2, 18, 18, 1, EDGE); r(0, 16, 22, 2, INK); r(1, 16, 20, 1, EDGE);
    for (let i = 0; i < 3; i++) {
      const x = 1 + i * 7, y = 3 + i % 2 * 3;
      r(x + 1, y, 4, 2, SHADE); r(x, y + 2, 6, 13 - y, '#b5915d'); r(x + 1, y + 2, 1, 12 - y, '#e0bf86');
      r(x + 4, y + 3, 1, 11 - y, '#8e673e'); r(x + 1, y + 5, 4, 4, CREAM);
      r(x + 2, y + 6, 2, 2, '#6d4937'); r(x + 3, y + 6, 1, 1, '#bc9862');
    }
    r(4, 19, 14, 1, BRASS); r(3, 22, 3, 2, INK); r(16, 22, 3, 2, INK);
  }),
  sideboard: art(30, 26, (r, ctx) => {
    r(1, 5, 28, 18, INK); r(2, 6, 26, 16, WOOD); r(0, 4, 30, 3, INK); r(1, 4, 28, 1, '#e4b777'); r(1, 5, 28, 1, EDGE);
    for (const x of [3, 16]) cabinetPanel(ctx, x, 8, 11, 13, WOOD, true);
    r(3, 23, 3, 3, INK); r(24, 23, 3, 3, INK); r(3, 23, 1, 2, EDGE); r(24, 23, 1, 2, WOOD);
    r(5, 2, 8, 2, CREAM); r(6, 1, 6, 1, '#cbb791'); r(5, 3, 8, 1, '#b9a786');
    r(19, 1, 6, 3, '#a5b592'); r(20, 0, 4, 1, LEAF); r(19, 1, 1, 2, CREAM);
  }),
  sofa: art(32, 26, (r) => {
    // Three-dimensional rolled arms, separate piped cushions and a knit throw.
    r(4, 0, 24, 1, INK); r(2, 1, 28, 18, INK); r(3, 2, 26, 16, LEAF); r(4, 2, 24, 1, LEAF_HI);
    for (const x of [5, 16]) {
      r(x, 4, 10, 11, '#889a6d'); r(x + 1, 4, 8, 1, '#b6bf89'); r(x + 9, 5, 1, 9, '#405137');
      r(x + 4, 8, 1, 1, '#556743'); r(x, 15, 10, 4, '#a0aa79'); r(x, 18, 10, 1, '#405137');
    }
    r(2, 19, 28, 4, '#405137'); r(3, 20, 26, 1, '#889a6d');
    for (const x of [0, 27]) { r(x + 1, 8, 3, 1, INK); r(x, 9, 5, 13, INK); r(x + 1, 10, 3, 11, LEAF); r(x + 1, 10, 3, 2, LEAF_HI); }
    r(7, 8, 5, 6, CREAM); r(7, 8, 5, 1, '#fff1cf'); r(11, 9, 1, 4, '#bfa979');
    r(20, 8, 5, 6, '#aa5944'); r(21, 9, 3, 1, '#dd9e78');
    r(24, 13, 4, 9, CREAM); for (let y = 14; y < 22; y += 3) r(24, y, 4, 1, '#aa5944');
    r(4, 23, 3, 3, INK); r(25, 23, 3, 3, INK); r(4, 23, 1, 2, EDGE); r(25, 23, 1, 2, WOOD);
  }),
  round_stool: art(14, 18, (r) => {
    r(2, 6, 3, 12, INK); r(9, 6, 3, 12, INK); r(3, 7, 1, 10, EDGE); r(10, 7, 1, 10, WOOD);
    r(4, 12, 6, 2, INK); r(4, 12, 6, 1, EDGE); r(0, 2, 14, 5, INK); r(2, 0, 10, 7, INK);
    r(1, 2, 12, 3, '#b6814d'); r(3, 1, 8, 1, '#efc98d'); r(2, 5, 10, 1, '#795030');
    r(3, 3, 7, 1, '#d5a36a'); r(5, 2, 1, 3, '#996539'); r(9, 3, 2, 1, '#795030');
    r(3, 9, 2, 1, BRASS); r(9, 9, 2, 1, BRASS);
  }),
  display_cabinet: art(24, 36, (r, ctx) => {
    // Crown moulding over twin glazed doors and a separately framed lower apron.
    r(1, 2, 22, 31, INK); r(2, 3, 20, 29, WOOD); r(0, 0, 24, 3, INK); r(1, 0, 22, 1, EDGE); r(2, 1, 20, 1, '#b47b46');
    r(3, 4, 18, 23, '#8e9e7f'); r(4, 5, 16, 21, '#aeba98');
    for (let row = 0; row < 3; row++) {
      const y = 8 + row * 7;
      for (const x of [5, 14]) { r(x, y, 4, 3, CREAM); r(x + 4, y, 1, 2, '#bba87e'); r(x - 1, y + 3, 6, 1, '#fff1cf'); r(x, y, 4, 1, '#a48c64'); }
      r(3, y + 4, 18, 1, EDGE); r(3, y + 5, 18, 1, SHADE);
    }
    glassReflection(ctx, 3, 4, 18, 23, 0.2); r(11, 4, 2, 23, WOOD); r(11, 4, 1, 23, EDGE);
    r(9, 16, 1, 3, BRASS); r(14, 16, 1, 3, BRASS); r(2, 7, 2, 3, BRASS); r(20, 21, 2, 3, BRASS);
    r(3, 28, 18, 4, INK); r(4, 29, 16, 2, WOOD); r(4, 29, 16, 1, EDGE); r(3, 33, 3, 3, INK); r(18, 33, 3, 3, INK); r(3, 33, 1, 2, EDGE);
  }),
  magazine_rack: art(16, 24, (r) => {
    r(2, 3, 12, 18, INK); r(3, 4, 10, 16, SHADE);
    const colors = ['#92a582', '#c8a15e', '#aa5944'];
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 4, y = 1 + i % 2 * 2;
      r(x, y, 4, 13, colors[i]); r(x, y, 3, 1, CREAM); r(x + 1, y + 3, 2, 1, CREAM);
      r(x + 1, y + 6, 2, 3, '#e4d2aa'); r(x + 1, y + 10, 2, 1, SHADE);
    }
    r(0, 13, 16, 3, INK); r(1, 13, 14, 1, EDGE); r(1, 14, 14, 1, WOOD);
    r(1, 16, 14, 4, WOOD); for (let x = 3; x < 14; x += 3) r(x, 17, 1, 3, EDGE);
    r(2, 21, 2, 3, INK); r(12, 21, 2, 3, INK); r(2, 21, 1, 2, EDGE);
  }),
  coffee_cart: art(30, 28, (r) => {
    r(1, 9, 28, 3, INK); r(1, 9, 28, 1, '#e4b777'); r(2, 10, 26, 1, WOOD);
    for (const x of [3, 25]) { r(x, 12, 2, 12, INK); r(x, 12, 1, 11, BRASS); r(x - 1, 24, 4, 3, INK); r(x, 25, 2, 1, '#b7b991'); }
    r(0, 7, 2, 9, INK); r(0, 7, 5, 1, BRASS); r(3, 21, 24, 2, WOOD); r(3, 21, 24, 1, EDGE);
    // Mini espresso machine has a recessed brew group and two separate cups.
    r(6, 1, 11, 8, INK); r(7, 2, 9, 6, LEAF); r(7, 2, 9, 1, '#b4bc8d');
    r(8, 5, 7, 2, '#304535'); r(9, 5, 1, 1, BRASS); r(13, 5, 1, 1, BRASS);
    r(8, 7, 3, 2, CREAM); r(12, 7, 3, 2, CREAM); r(8, 0, 3, 1, CREAM); r(12, 0, 3, 1, CREAM);
    r(19, 5, 7, 4, CREAM); r(20, 4, 5, 1, '#b7a17a'); r(19, 7, 7, 1, '#cdb68d');
    for (const x of [8, 17]) { pot(r, x, 14, 6, 7); r(x + 2, 17, 2, 2, CREAM); }
    r(5, 12, 19, 3, INK); r(6, 13, 17, 1, WOOD); r(13, 13, 3, 1, BRASS);
  }),
};

const cache = new Map<string, HTMLCanvasElement>();
export function collectionSprite(id: string): HTMLCanvasElement | undefined {
  const make = pieces[id];
  if (!make) return undefined;
  let sprite = cache.get(id);
  if (!sprite) { sprite = make(); cache.set(id, sprite); }
  return sprite;
}
