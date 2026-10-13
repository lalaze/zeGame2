/** Independent half-world-pixel props for the main café's rear worktop. */
type Ctx = CanvasRenderingContext2D;
export type FineStorageJarKind = 'beans' | 'tea' | 'sugar';
export type FineCupStackCount = 1 | 2 | 3;
type Mark = readonly [number, number, number, number, string];

/** Logical world bounds. Every helper uses its bounds' top-left as (x,y). */
export const FINE_COUNTER_PROP_BOUNDS = Object.freeze({
  breadBasket: { w: 22, h: 15 },
  storageJar: { beans: { w: 10, h: 15 }, tea: { w: 10, h: 13 }, sugar: { w: 10, h: 11 } },
  cakeDome: { w: 18, h: 16 },
  cupStack: { w: 10, h: 13 },
  saucerStack: { w: 10, h: 8 },
});

const P = {
  wickerDark: '#775035', wickerShade: '#9b673b', wicker: '#bd8b4d', wickerLight: '#dbad66', wickerGlint: '#f0ca86',
  crust: '#b8753b', bread: '#dfaa59', breadLight: '#f4ce80', breadCut: '#fff0b0', toast: '#96512e',
  glassDark: '#66847b', glassShade: '#93aca0', glass: '#c0d4bf', glassLight: '#deead3', glint: '#fff5de',
  lidDark: '#795437', lid: '#ab7a49', lidLight: '#d1a367', lidTop: '#e3bd82',
  paper: '#f4e5bf', paperShade: '#c9b591', ink: '#927451',
  porcelainEdge: '#998b70', porcelainShade: '#c2b897', porcelain: '#e8dfbe', porcelainLight: '#fff2d5', porcelainDark: '#7d7f69',
};
const cache = new Map<string, readonly Mark[]>();

/** Build fine native pixels once; the room can repaint without reparsing color. */
function artwork(key: string, width: number, height: number, paint: (r: (x: number, y: number, w: number, h: number, color: string) => void) => void): readonly Mark[] {
  const old = cache.get(key);
  if (old) return old;
  const pixels = Array<string>(width * height).fill('');
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    for (let yy = Math.max(0, y); yy < Math.min(height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx++) pixels[yy * width + xx] = color;
    }
  };
  paint(r);
  const marks: Mark[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width;) {
    const color = pixels[y * width + x];
    let end = x + 1;
    while (end < width && pixels[y * width + end] === color) end++;
    if (color) marks.push([x / 2, y / 2, (end - x) / 2, .5, color]);
    x = end;
  }
  cache.set(key, marks);
  return marks;
}

function draw(ctx: Ctx, x: number, y: number, marks: readonly Mark[]): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  for (const [dx, dy, w, h, color] of marks) {
    ctx.fillStyle = color;
    ctx.fillRect(x + dx, y + dy, w, h);
  }
}

/** 22×15. Pass false to keep separately drawn, menu-dependent bread icons. */
export function paintFineBreadBasket(ctx: Ctx, x = 0, y = 0, filled = true): void {
  draw(ctx, x, y, artwork(`basket:${filled}`, 44, 30, r => {
    // Small loop handles and the darker rear lip remain visible around bread.
    r(3, 10, 5, 2, P.wickerDark); r(2, 12, 2, 5, P.wickerDark);
    r(7, 12, 2, 4, P.wickerDark); r(3, 11, 4, 1, P.wickerGlint);
    r(35, 10, 5, 2, P.wickerDark); r(34, 12, 2, 5, P.wickerDark);
    r(39, 12, 2, 5, P.wickerDark); r(36, 11, 3, 1, P.wickerLight);
    r(2, 14, 40, 3, P.wickerDark); r(4, 14, 35, 1, P.wickerShade);
    if (filled) {
      // Two tilted, scored baguettes plus a small split roll, hand-stepped.
      for (let row = 0; row < 15; row++) {
        const bx = 7 + Math.floor(row / 4), by = 1 + row;
        const width = row === 0 || row === 14 ? 4 : 7;
        r(bx, by, width, 1, P.crust);
        if (row > 0 && row < 14) r(bx + 1, by, 4, 1, row < 8 ? P.breadLight : P.bread);
        if ([3, 7, 11].includes(row)) { r(bx + 1, by, 3, 1, P.breadCut); r(bx + 3, by + 1, 2, 1, P.toast); }
      }
      for (let row = 0; row < 14; row++) {
        const bx = 24 - Math.floor(row / 4), by = 2 + row;
        r(bx, by, row === 0 ? 4 : 6, 1, P.crust);
        if (row) r(bx + 1, by, 3, 1, P.bread);
        if ([3, 7, 11].includes(row)) r(bx + 1, by, 3, 1, P.breadCut);
      }
      r(29, 9, 6, 1, P.crust); r(27, 10, 10, 6, P.crust);
      r(28, 10, 7, 4, P.bread); r(29, 10, 5, 1, P.breadLight);
      r(30, 11, 1, 3, P.breadCut); r(31, 12, 2, 1, P.toast);
    }
    // Each crossing is a staggered half-pixel wicker strand, with diagonally
    // offset joins. The front tapers inward, keeping real gaps at both handles.
    for (let row = 17; row <= 27; row++) {
      const inset = Math.floor((row - 17) / 4);
      r(3 + inset, row, 38 - inset * 2, 1, row % 2 ? P.wickerShade : P.wicker);
      for (let column = 5 + (row % 4 < 2 ? 0 : 2); column < 39 - inset; column += 5) {
        r(column, row, 1, 1, row % 2 ? P.wickerGlint : P.wickerDark);
        if (row % 2) r(column + 1, row, 2, 1, P.wickerLight);
      }
    }
    r(1, 16, 42, 2, P.wickerDark); r(2, 16, 40, 1, P.wickerGlint);
    for (let column = 4; column < 40; column += 4) r(column, 17, 2, 1, P.wickerLight);
    r(6, 28, 32, 1, P.wickerDark); r(8, 29, 28, 1, '#80603c');
    r(5, 19, 1, 4, P.wickerGlint); r(38, 20, 1, 4, P.wickerDark);
  }));
}

/** Distinct beans, tea and sugar content, with different heights and labels. */
export function paintFineStorageJar(ctx: Ctx, x = 0, y = 0, kind: FineStorageJarKind = 'beans'): void {
  const height = FINE_COUNTER_PROP_BOUNDS.storageJar[kind].h * 2;
  const fills = {
    beans: { dark: '#664831', base: '#956c43', light: '#c1965c', label: '#8d6040' },
    tea: { dark: '#596846', base: '#899457', light: '#b3b66e', label: '#708151' },
    sugar: { dark: '#b4b79d', base: '#d5d6b8', light: '#f3eed0', label: '#998a62' },
  } as const;
  const f = fills[kind];
  draw(ctx, x, y, artwork(`jar:${kind}`, 20, height, r => {
    // Rounded shoulders and a very narrow glass wall around the contents.
    r(5, 6, 10, 2, P.glassDark); r(4, 8, 12, 1, P.glassDark);
    r(3, 9, 14, height - 12, P.glassDark);
    r(4, 9, 12, height - 11, P.glassShade);
    r(5, 9, 10, height - 12, P.glass);
    r(4, height - 3, 12, 1, P.glassDark);
    r(6, height - 2, 8, 1, P.glassLight);
    r(5, 12, 10, height - 15, f.dark);
    r(6, 13, 8, height - 16, f.base);
    for (let fy = 13; fy < height - 3; fy += 3) for (let fx = 6 + fy % 2; fx < 14; fx += 3) {
      if (kind === 'beans') { r(fx, fy, 2, 1, f.light); r(fx + 1, fy + 1, 1, 1, f.dark); }
      else if (kind === 'tea') { r(fx, fy, 1, 2, f.light); r(fx + 1, fy, 1, 1, f.dark); }
      else { r(fx, fy, 2, 2, f.light); r(fx, fy + 1, 1, 1, '#dfe0c6'); }
    }
    // Glass reflection follows the shoulder, then breaks beside the label.
    r(5, 8, 2, 1, P.glint); r(4, 10, 1, height - 15, P.glint);
    r(5, 10, 1, 3, P.glassLight); r(15, 11, 1, height - 15, '#abc4b0');
    r(5, height - 5, 1, 2, P.glassLight); r(7, height - 3, 6, 1, '#d6dfc1');
    const ly = height - 11;
    r(7, ly, 7, 7, P.paperShade); r(7, ly, 6, 6, P.paper);
    r(8, ly, 4, 1, '#fff1d0');
    if (kind === 'beans') { r(9, ly + 2, 3, 2, f.label); r(10, ly + 2, 1, 1, '#d1a571'); }
    if (kind === 'tea') { r(10, ly + 2, 1, 3, f.label); r(9, ly + 2, 3, 1, f.label); r(8, ly + 3, 2, 1, '#b1b774'); }
    if (kind === 'sugar') { r(9, ly + 2, 3, 3, f.label); r(9, ly + 2, 2, 2, '#ded9b7'); }
    // Cork and rim have separate upper, side and underside planes.
    r(3, 2, 14, 1, P.lidDark); r(2, 3, 16, 3, P.lidDark);
    r(4, 1, 12, 1, P.lid); r(4, 2, 11, 1, P.lidTop);
    r(3, 3, 13, 1, P.lidLight); r(3, 4, 13, 1, P.lid);
    r(5, 5, 10, 1, P.lidDark); r(6, 6, 8, 1, P.glassLight);
    for (const lx of [5, 9, 13]) r(lx, 4, 1, 1, P.lidLight);
  }));
}

/** 18×16. Open glass highlights surround a strawberry layer cake and footed plate. */
export function paintFineCakeDome(ctx: Ctx, x = 0, y = 0): void {
  draw(ctx, x, y, artwork('cake', 36, 32, r => {
    // The glass crown leaves true transparent space above the cake. A pair
    // of reflected window strips describes its curvature without a solid fill.
    r(16, 0, 4, 1, P.glassShade); r(15, 1, 6, 2, P.glassDark);
    r(16, 1, 3, 1, P.glint); r(17, 3, 2, 1, P.glassLight);
    r(13, 4, 10, 1, P.glassShade);
    for (const [left, yy, width, arc] of [[10, 5, 16, 4], [8, 6, 20, 3], [6, 7, 24, 3], [5, 8, 26, 2]]) {
      r(left, yy, arc, 1, P.glassShade); r(left + width - arc, yy, arc, 1, P.glassDark);
    }
    r(4, 9, 1, 3, P.glassShade); r(31, 9, 1, 3, P.glassDark);
    r(3, 12, 1, 11, P.glassDark); r(32, 12, 1, 11, P.glassDark);
    r(4, 13, 2, 9, P.glass); r(30, 13, 2, 9, P.glassShade);
    r(11, 6, 3, 1, P.glint); r(8, 7, 3, 1, P.glassLight);
    r(7, 8, 2, 2, P.glint); r(6, 10, 1, 4, P.glassLight);
    r(5, 14, 1, 5, P.glint); r(28, 8, 1, 2, P.glassLight);
    // Cake itself, seen through the canopy, with piped cream and berry seeds.
    r(10, 14, 17, 1, '#ddba89'); r(9, 15, 19, 8, '#c28b68');
    r(10, 15, 17, 2, '#fff0c9'); r(10, 17, 17, 2, '#d99174');
    r(10, 19, 17, 2, '#f8e7b8'); r(10, 21, 17, 2, '#e1ab7e');
    r(26, 16, 1, 6, '#ae785d'); r(11, 17, 1, 4, '#fff1c9');
    for (const cx of [11, 15, 20, 24]) { r(cx, 13, 2, 1, '#fff3d5'); r(cx - 1, 14, 4, 1, '#f9e6bd'); }
    for (const bx of [13, 20]) { r(bx, 11, 2, 1, '#72834b'); r(bx - 1, 12, 4, 2, '#b54f43'); r(bx, 14, 2, 1, '#923e38'); r(bx, 12, 1, 1, '#f4b177'); }
    // A highlight on the front lip crosses the cake without obscuring it.
    r(5, 22, 26, 1, P.glassShade); r(6, 22, 5, 1, P.glassLight);
    r(3, 23, 30, 2, '#8c9178'); r(2, 24, 32, 1, '#e7d4a4');
    r(4, 25, 28, 1, '#b8a172'); r(6, 24, 10, 1, '#fff0c8');
    // Reflective brass-and-silver foot, with the background visible either side.
    r(16, 26, 4, 4, '#8b8b70'); r(16, 26, 1, 3, '#eadbb1');
    r(14, 29, 8, 1, '#b5a57e'); r(12, 30, 12, 1, '#807e64');
    r(13, 30, 9, 1, '#dfc89a'); r(13, 31, 10, 1, '#a79269');
    r(14, 30, 3, 1, '#fff0ca');
  }));
}

/** 10×13; one to three nested porcelain cups always share the same bottom. */
export function paintFineCupStack(ctx: Ctx, x = 0, y = 0, count: FineCupStackCount = 2): void {
  draw(ctx, x, y, artwork(`cups:${count}`, 20, 26, r => {
    // A stepped saucer profile underneath the lower bowl.
    r(2, 23, 16, 1, P.porcelainEdge); r(1, 24, 18, 1, P.porcelain);
    r(3, 25, 14, 1, P.porcelainShade); r(3, 23, 11, 1, P.porcelainLight);
    for (let index = count - 1; index >= 0; index--) {
      const top = 14 - index * 6;
      // Ear-shaped handle, with a genuine transparent central opening.
      r(14, top + 2, 4, 1, P.porcelainEdge); r(17, top + 3, 2, 3, P.porcelainEdge);
      r(14, top + 6, 4, 1, P.porcelainEdge); r(15, top + 2, 2, 1, P.porcelainLight);
      r(18, top + 3, 1, 2, P.porcelainShade); r(15, top + 6, 2, 1, P.porcelain);
      r(3, top, 11, 1, P.porcelainEdge); r(2, top + 1, 13, 5, P.porcelainEdge);
      r(3, top + 6, 11, 1, P.porcelainShade); r(5, top + 7, 7, 1, P.porcelainEdge);
      r(3, top + 1, 11, 1, P.porcelainLight); r(4, top + 2, 9, 1, P.porcelainDark);
      r(3, top + 3, 11, 2, P.porcelain); r(4, top + 5, 9, 1, P.porcelainShade);
      r(4, top + 3, 2, 2, P.porcelainLight); r(12, top + 3, 1, 2, '#d0c8a7');
      r(5, top + 6, 6, 1, P.porcelain);
    }
  }));
}

/** 10×8; separately composable small stack of oval porcelain saucers. */
export function paintFineSaucerStack(ctx: Ctx, x = 0, y = 0): void {
  draw(ctx, x, y, artwork('saucers', 20, 16, r => {
    for (const top of [10, 6, 2]) {
      r(4, top, 12, 1, P.porcelainEdge); r(2, top + 1, 16, 1, P.porcelainEdge);
      r(1, top + 2, 18, 1, P.porcelainShade); r(2, top + 3, 16, 1, P.porcelainEdge);
      r(4, top + 4, 12, 1, P.porcelainShade);
      r(4, top + 1, 11, 1, P.porcelainLight); r(3, top + 2, 14, 1, P.porcelain);
      r(6, top + 2, 7, 1, '#c9c7a6'); r(4, top + 3, 9, 1, P.porcelainLight);
      r(3, top + 2, 2, 1, P.glint);
    }
    r(5, 15, 10, 1, P.porcelainEdge);
  }));
}
