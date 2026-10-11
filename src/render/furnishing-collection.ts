// Additional shop pieces: the same cached art is used in the room and thumbnail.
import { mix } from './color';
import { glassReflection } from './materials';

const INK = '#40322f', WOOD = '#926b4c', EDGE = '#d7b185';
const LEAF = '#577e60', LEAF_HI = '#9bb77a', CREAM = '#fff0cb';
type Paint = (r: (x: number, y: number, w: number, h: number, color: string) => void, ctx: CanvasRenderingContext2D) => void;
const art = (w: number, h: number, paint: Paint) => () => {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const r = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, width, height);
  };
  paint(r, ctx); return canvas;
};

const plant = (kind: 'lavender' | 'succulent' | 'daisies') => art(kind === 'succulent' ? 8 : 14, kind === 'succulent' ? 13 : 25, (r) => {
  const small = kind === 'succulent', x = small ? 1 : 3, y = small ? 8 : 17, w = small ? 6 : 8;
  const pot = kind === 'daisies' ? '#7eaaa8' : '#bb8063';
  r(x, y, w, small ? 4 : 7, INK); r(x + 1, y + 1, w - 2, small ? 3 : 6, pot);
  r(x, y, w, 2, mix(pot, CREAM, 0.35)); r(x + 1, y + 2, 1, small ? 1 : 4, CREAM);
  if (small) {
    r(3, 2, 2, 6, LEAF); r(0, 4, 3, 2, LEAF_HI); r(5, 3, 3, 3, LEAF);
    r(2, 5, 4, 3, '#80a67a'); r(3, 3, 1, 3, '#bbcc91');
  } else for (let i = 0; i < 3; i++) {
    const px = 3 + i * 4, top = 4 + i % 2 * 3;
    r(px, top, 1, 14 - top, LEAF); r(px - 2, top + 6, 2, 1, LEAF_HI); r(px + 1, top + 8, 2, 1, LEAF);
    if (kind === 'lavender') {
      r(px - 1, top, 3, 6, '#887393'); r(px, top - 1, 1, 6, '#c2a2c5'); r(px - 1, top + 2, 1, 1, '#e1c7da');
    } else {
      r(px - 2, top, 5, 1, '#fff8de'); r(px, top - 2, 1, 5, '#fff8de');
      r(px - 1, top - 1, 3, 3, '#f7eccf'); r(px, top, 1, 1, '#d7a756');
    }
  }
});

function poster(kind: 'coffee' | 'bakery') {
  return art(22, 22, (r) => {
    r(0, 0, 22, 22, INK); r(1, 1, 20, 20, WOOD); r(1, 1, 20, 1, EDGE);
    r(3, 3, 16, 16, kind === 'coffee' ? '#ead7ae' : '#eac8b1');
    r(5, 5, 12, 1, '#b89770'); r(6, 17, 10, 1, '#a88665');
    if (kind === 'coffee') {
      r(6, 9, 9, 6, '#597567'); r(7, 10, 7, 3, CREAM); r(8, 10, 5, 1, '#79503c');
      r(15, 10, 2, 3, '#597567'); r(5, 15, 12, 1, '#79503c');
      r(8, 7, 1, 1, '#a17f60'); r(11, 6, 1, 2, '#a17f60');
    } else {
      r(5, 11, 3, 4, '#996643'); r(14, 11, 3, 4, '#996643');
      r(7, 9, 8, 5, '#d89c58'); r(9, 8, 4, 5, '#edc987');
      r(8, 10, 1, 3, '#a57349'); r(13, 10, 1, 3, '#a57349'); r(5, 16, 12, 1, CREAM);
    }
  });
}

const pieces: Record<string, () => HTMLCanvasElement> = {
  plant_lavender: plant('lavender'),
  plant_succulent: plant('succulent'),
  vase_daisies: plant('daisies'),
  poster_coffee: poster('coffee'),
  poster_bakery: poster('bakery'),
  wreath_season: art(22, 22, (r) => {
    for (let i = 0; i < 12; i++) {
      const x = Math.round(9 + Math.cos(i * Math.PI / 6) * 7), y = Math.round(9 + Math.sin(i * Math.PI / 6) * 7);
      r(x, y, 4, 3, i % 2 ? LEAF : '#74916b'); r(x, y, 2, 1, LEAF_HI);
      if (i % 3 === 0) r(x + 2, y + 1, 1, 1, '#db8b70');
    }
    r(7, 16, 3, 3, '#b55e60'); r(12, 16, 3, 3, '#d18478'); r(10, 17, 2, 2, '#ebba8d');
    r(8, 19, 2, 3, '#b55e60'); r(13, 19, 2, 3, '#b55e60');
  }),
  hanging_ivy: art(14, 24, (r) => {
    r(6, 0, 2, 2, INK); r(3, 2, 1, 5, '#bda789'); r(10, 2, 1, 5, '#bda789');
    r(2, 6, 10, 2, EDGE); r(3, 8, 8, 5, '#aa8061'); r(4, 9, 1, 3, '#d0ab81');
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 5; r(x, 8, 1, 11 + i % 2 * 4, LEAF);
      for (let y = 10; y < 19 + i % 2 * 4; y += 4) { r(x - 1, y, 3, 2, LEAF); r(x, y, 2, 1, LEAF_HI); }
    }
  }),
  wall_pennants: art(32, 8, (r) => {
    r(0, 0, 32, 1, WOOD);
    ['#b77264', '#77937b', '#d8b970', '#819dab', '#b995ac'].forEach((color, i) => {
      r(2 + i * 6, 1, 5, 3, color); r(3 + i * 6, 4, 3, 2, color); r(4 + i * 6, 6, 1, 1, color);
      r(2 + i * 6, 1, 4, 1, mix(color, CREAM, 0.3));
    });
  }),
  lantern: art(12, 24, (r, ctx) => {
    r(4, 0, 4, 1, INK); r(3, 1, 1, 4, INK); r(8, 1, 1, 4, INK);
    r(2, 5, 8, 2, INK); r(1, 7, 10, 14, '#685c48'); r(2, 8, 8, 11, '#d9ad69');
    r(3, 9, 6, 9, '#f4d592'); r(5, 10, 2, 5, '#fff8d1');
    r(2, 8, 1, 12, EDGE); r(9, 8, 1, 12, INK); r(5, 7, 1, 12, '#a27e50');
    glassReflection(ctx, 2, 8, 8, 11, 0.15); r(0, 21, 12, 2, INK); r(1, 21, 10, 1, EDGE);
  }),
  bean_display: art(22, 24, (r) => {
    r(1, 18, 20, 4, INK); r(2, 18, 18, 3, WOOD); r(0, 17, 22, 2, EDGE);
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 7, y = 5 + i % 2 * 3;
      r(x, y, 5, 12 - i % 2 * 3, '#a68059'); r(x + 1, y + 1, 3, 10 - i % 2 * 3, '#d3b582');
      r(x, y, 5, 1, EDGE); r(x + 1, y + 4, 3, 3, CREAM); r(x + 2, y + 5, 1, 1, '#6d4937');
    }
  }),
  sideboard: art(30, 26, (r) => {
    r(1, 5, 28, 18, INK); r(2, 6, 26, 16, WOOD); r(0, 4, 30, 3, EDGE);
    for (const x of [4, 16]) { r(x, 9, 10, 11, '#624b3c'); r(x + 1, 10, 8, 9, '#a47c59'); r(x + 6, 13, 1, 2, '#e2bf7c'); }
    r(3, 23, 3, 3, INK); r(24, 23, 3, 3, INK);
    r(5, 1, 6, 3, '#ece2cb'); r(6, 0, 4, 1, '#77948b'); r(21, 1, 4, 3, '#a5ba90');
  }),
  sofa: art(32, 26, (r) => {
    r(2, 0, 28, 20, INK); r(3, 1, 26, 18, '#728b77'); r(4, 2, 24, 2, '#a2b19a');
    for (const x of [5, 16]) { r(x, 6, 10, 10, '#8da58b'); r(x, 6, 10, 1, '#b2bf9e'); r(x + 1, 15, 8, 1, '#5f7a6a'); }
    r(2, 16, 28, 7, '#566e5e'); r(3, 17, 26, 2, '#9bad8f');
    for (const x of [0, 27]) { r(x, 9, 5, 13, INK); r(x + 1, 10, 3, 11, '#829a80'); r(x + 1, 10, 3, 1, '#c1cba7'); }
    r(7, 8, 5, 6, '#e3c9a0'); r(20, 8, 5, 6, '#bc8271'); r(4, 23, 3, 3, WOOD); r(25, 23, 3, 3, WOOD);
  }),
  round_stool: art(14, 18, (r) => {
    r(2, 6, 2, 12, INK); r(10, 6, 2, 12, INK); r(3, 7, 1, 10, WOOD); r(10, 7, 1, 10, WOOD);
    r(3, 12, 8, 2, WOOD); r(0, 2, 14, 5, INK); r(2, 0, 10, 7, INK);
    r(1, 2, 12, 3, '#c9926d'); r(3, 1, 8, 1, '#efd0a1'); r(2, 5, 10, 1, '#a67455');
  }),
  display_cabinet: art(24, 36, (r, ctx) => {
    r(0, 0, 24, 33, INK); r(1, 1, 22, 31, WOOD); r(2, 3, 20, 24, '#abc4b9');
    for (let row = 0; row < 3; row++) {
      const y = 7 + row * 8;
      for (const x of [5, 14]) { r(x, y, 4, 3, CREAM); r(x + 4, y, 1, 2, '#e7d4b3'); r(x - 1, y + 3, 6, 1, '#f6e6c8'); }
      r(2, y + 4, 20, 2, WOOD); r(2, y + 4, 20, 1, EDGE);
    }
    glassReflection(ctx, 2, 3, 20, 23); r(11, 3, 2, 24, WOOD); r(9, 16, 1, 2, '#f0ce8f');
    r(1, 1, 22, 1, EDGE); r(3, 33, 3, 3, INK); r(18, 33, 3, 3, INK);
  }),
  magazine_rack: art(16, 24, (r) => {
    r(1, 3, 14, 18, INK); r(2, 4, 12, 16, WOOD);
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 4, y = 2 + i % 2 * 2;
      r(x, y, 4, 12, ['#94aaa1', '#d3ab78', '#bd8276'][i]); r(x + 1, y + 2, 2, 1, CREAM); r(x + 1, y + 5, 2, 4, '#fff2d6');
    }
    r(0, 13, 16, 3, EDGE); r(1, 16, 14, 4, WOOD); r(2, 21, 2, 3, INK); r(12, 21, 2, 3, INK);
  }),
  coffee_cart: art(30, 28, (r) => {
    r(1, 9, 28, 3, INK); r(1, 9, 28, 1, EDGE);
    for (const x of [3, 25]) { r(x, 12, 2, 12, '#7a735e'); r(x, 12, 1, 11, EDGE); r(x - 1, 24, 4, 3, INK); r(x, 25, 2, 1, '#a2a9a0'); }
    r(3, 20, 24, 3, WOOD); r(3, 20, 24, 1, EDGE);
    r(6, 1, 10, 8, INK); r(7, 2, 8, 6, '#7f9990'); r(7, 2, 8, 1, '#c2d0bc');
    r(8, 5, 6, 2, '#3f5350'); r(10, 7, 2, 2, CREAM); r(20, 5, 6, 4, CREAM); r(21, 5, 4, 1, '#ae8964');
    for (const x of [8, 16]) { r(x, 15, 5, 5, '#cbaa72'); r(x + 1, 16, 3, 2, CREAM); }
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
