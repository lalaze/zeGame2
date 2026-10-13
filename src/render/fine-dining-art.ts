/**
 * Independently authored 2× dining furniture. These transparent canvases keep
 * the old sprite's world dimensions and anchors; no legacy rows are enlarged.
 * Every painted cell is one native backing pixel, never an antialiased path.
 */
type Facing = 'left' | 'right';
type PixelGrid = ReturnType<typeof grid>;

const WOOD = {
  ink: '#443026', deep: '#60402d', shade: '#805033', base: '#a36c40',
  light: '#c88c50', edge: '#e1b06d', worn: '#f0c987', peg: '#785333',
};
const GREEN = {
  outline: '#384c32', shadow: '#475b36', side: '#607243', base: '#7d9154',
  light: '#9daf68', edge: '#c0cd86', stitch: '#d2d79b', fold: '#6d8049',
};
// White cloth, red yarn over white, and crossing red yarn. The perspective,
// light and hanging folds choose a small pre-authored ramp, not a blur.
const CLOTH = {
  sun: ['#fff1cf', '#e5a28a', '#c76851'],
  top: ['#f9e5bd', '#d88d72', '#b55240'],
  front: ['#e7cba2', '#c97b60', '#a94b3b'],
  fold: ['#ceb18b', '#ad6851', '#8e4134'],
  edge: ['#b89570', '#965540', '#793c30'],
} as const;

function grid(width: number, height: number) {
  const pixels = Array<string>(width * height).fill('');
  const put = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    pixels[y * width + x] = color;
  };
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, color);
  };
  const canvas = (mirror = false): HTMLCanvasElement => {
    const result = document.createElement('canvas');
    result.width = width; result.height = height;
    const ctx = result.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // Runs reduce native draw calls without changing a single authored pixel.
    for (let y = 0; y < height; y++) for (let x = 0; x < width;) {
      const color = pixels[y * width + x];
      let end = x + 1;
      while (end < width && pixels[y * width + end] === color) end++;
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(mirror ? width - end : x, y, end - x, 1);
      }
      x = end;
    }
    return result;
  };
  return { put, rect, canvas };
}

let table: HTMLCanvasElement | undefined;
const chairs: Partial<Record<Facing, HTMLCanvasElement>> = {};

/** 66×54 backing; logical center x=16, top center y=7, foot y=26. */
export function fineTableCanvas(): HTMLCanvasElement {
  if (table) return table;
  const art = grid(66, 54);
  const { rect: r, put } = art;
  const cx = 32;

  // Compact pedestal remains entirely in the original foot envelope, behind
  // the cloth. It cannot extend under either seated guest's outer legs.
  r(29, 36, 8, 13, '#3f342b');
  r(30, 38, 5, 10, '#685442');
  r(30, 39, 1, 7, '#a48d67');
  r(33, 40, 2, 7, '#4e4538');
  r(28, 45, 10, 3, '#3e332b');
  r(29, 45, 7, 1, '#897251');
  r(21, 47, 23, 2, WOOD.ink);
  r(19, 49, 27, 4, WOOD.ink);
  r(18, 51, 29, 3, WOOD.ink);
  r(21, 48, 22, 1, WOOD.light);
  r(20, 49, 24, 2, WOOD.base);
  r(20, 51, 25, 1, WOOD.shade);
  r(22, 52, 22, 1, WOOD.deep);
  r(23, 49, 19, 1, WOOD.edge);
  r(26, 48, 4, 1, '#d8ae75');
  r(36, 49, 6, 1, '#b98753');
  put(43, 50, WOOD.light);

  // Hand-stepped oval contour, centered on physical (32,14). Asymmetric end
  // rows keep the cloth softly hand-draped rather than a perfect vector oval.
  const spans: readonly (readonly [number, number])[] = [
    [25, 39], [20, 44], [16, 48], [13, 51], [10, 54], [8, 56],
    [7, 57], [6, 58], [5, 59], [4, 60], [4, 60], [3, 61],
    [3, 61], [3, 61], [4, 60], [4, 60], [5, 59], [6, 58],
    [7, 57], [9, 55], [11, 53], [14, 50], [18, 46], [23, 41],
    [28, 36],
  ];
  const front = Array<number>(66).fill(-1);
  spans.forEach(([left, right], row) => {
    for (let x = left; x <= right; x++) front[x] = row + 2;
  });

  // The front edge hangs lower between folds. Pattern columns wrap subtly
  // around the round sides; the dark hem stays a narrow native-pixel seam.
  const folds = [8, 18, 30, 43, 55];
  for (let x = 3; x <= 61; x++) {
    const edge = front[x];
    const foldDistance = Math.min(...folds.map(fold => Math.abs(x - fold)));
    const drop = 11 + (foldDistance > 3 ? 2 : foldDistance > 1 ? 1 : 0);
    const hem = edge + drop;
    for (let y = edge; y <= hem; y++) {
      const wrappedX = x + (x < 14 ? 1 : x > 51 ? -1 : 0) + (foldDistance === 0 ? 1 : 0);
      const stripe = (Math.floor((wrappedX + 1) / 6) % 2) + (Math.floor((y + 1) / 5) % 2);
      const ramp = y === hem ? CLOTH.edge
        : x < 8 || x > 56 || foldDistance === 0 ? CLOTH.fold
        : foldDistance === 1 || y > hem - 2 ? CLOTH.fold : CLOTH.front;
      put(x, y, ramp[stripe]);
      if (y === hem) put(x, y + 1, '#774837');
      if (y === hem - 1 && x % 4 === 0) put(x, y, stripe === 0 ? '#f2d6aa' : '#c38967');
    }
    // A tiny dark fold slit follows the hanging fabric, not a straight black
    // vertical grid. Highlighted neighbor yarn gives it actual thickness.
    if (foldDistance === 0) {
      put(x, edge + 4, '#945640');
      put(x, edge + 5, '#945640');
      put(x + 1, edge + 6, '#ba8060');
    }
  }

  // Back and side outlines are one native pixel, much finer than upscaling
  // the old logical-pixel rim. The top's red yarn stays warm and desaturated.
  spans.forEach(([left, right], row) => {
    const y = row + 2;
    for (let x = left - 1; x <= right + 1; x++) put(x, y, '#88513a');
    if (row === 0) r(left, y - 1, right - left + 1, 1, '#ae7852');
  });
  spans.forEach(([left, right], row) => {
    const y = row + 2;
    for (let x = left; x <= right; x++) {
      const band = Math.floor((y + 1) / 4) % 2;
      const stripe = Math.floor((x + 1) / 6) % 2 + band;
      const ramp = row < 8 ? CLOTH.sun : CLOTH.top;
      let color: string = ramp[stripe];
      if (row > 16 && (x === left || x === right)) color = CLOTH.front[stripe];
      // Sparse single-pixel weave joins stop the checks feeling printed flat.
      if (stripe === 0 && y % 7 === 0 && x % 11 === 0) color = '#f1d7ad';
      put(x, y, color);
    }
  });
  // Fine rolled edge: same weave darkens where the cloth turns downward.
  for (let x = 4; x < 61; x++) {
    const y = front[x] + 1;
    const stripe = Math.floor((x + 1) / 6) % 2 + Math.floor((y + 1) / 5) % 2;
    put(x, y, CLOTH.fold[stripe]);
  }
  r(23, 2, 9, 1, '#fff4d5');
  r(16, 4, 3, 1, '#fff2d0');
  put(13, 5, '#ffeccc');
  put(cx + 19, 7, '#efb195');

  table = art.canvas();
  return table;
}

function paintChair(art: PixelGrid): void {
  const { rect: r, put } = art;

  // Rear pair first: the open space beneath the seat remains transparent.
  r(10, 37, 4, 10, WOOD.ink);
  r(10, 39, 2, 7, WOOD.shade);
  r(9, 46, 4, 3, WOOD.ink);
  r(10, 46, 1, 2, WOOD.base);
  r(20, 37, 3, 10, WOOD.ink);
  r(21, 39, 1, 7, WOOD.shade);

  // The slender bent back has a shallow arched crest, two side posts and two
  // ladder rails. Its three real gaps show the room through the chair.
  r(6, 2, 5, 1, WOOD.ink);
  r(4, 3, 8, 1, WOOD.ink);
  r(3, 4, 10, 3, WOOD.ink);
  r(2, 7, 4, 9, WOOD.ink);
  r(3, 13, 4, 24, WOOD.ink);
  r(10, 6, 4, 30, WOOD.ink);
  r(5, 4, 6, 1, WOOD.edge);
  r(4, 5, 8, 1, WOOD.light);
  r(4, 6, 6, 1, WOOD.base);
  r(3, 7, 2, 7, WOOD.base);
  r(3, 8, 1, 4, WOOD.edge);
  r(4, 13, 2, 23, WOOD.base);
  r(4, 14, 1, 17, WOOD.light);
  r(5, 30, 1, 5, WOOD.shade);
  r(11, 7, 2, 28, WOOD.base);
  r(11, 8, 1, 20, WOOD.light);
  r(12, 9, 1, 23, WOOD.shade);
  for (const y of [13, 23]) {
    r(5, y, 7, 4, WOOD.ink);
    r(5, y, 6, 1, WOOD.edge);
    r(6, y + 1, 5, 1, WOOD.base);
    r(6, y + 2, 5, 1, WOOD.shade);
    put(5, y + 1, WOOD.peg);
    put(11, y + 1, WOOD.worn);
  }
  // Short interrupted grain follows the timber instead of covering the gaps.
  r(4, 18, 1, 3, '#b97f47');
  r(11, 18, 1, 3, '#c79258');
  put(5, 29, WOOD.edge);
  put(11, 30, WOOD.worn);

  // Splayed near legs have separate lit and shadow planes and tiny joints.
  r(4, 37, 4, 9, WOOD.ink);
  r(3, 45, 4, 6, WOOD.ink);
  r(2, 49, 4, 3, WOOD.ink);
  r(5, 39, 2, 6, WOOD.base);
  r(4, 45, 2, 5, WOOD.base);
  r(4, 46, 1, 3, WOOD.edge);
  r(3, 50, 2, 1, WOOD.shade);
  r(23, 37, 4, 8, WOOD.ink);
  r(24, 44, 4, 7, WOOD.ink);
  r(25, 49, 4, 3, WOOD.ink);
  r(24, 39, 2, 5, WOOD.base);
  r(25, 44, 2, 5, WOOD.shade);
  r(25, 44, 1, 4, WOOD.light);
  r(26, 49, 1, 2, WOOD.base);
  // A lower stretcher meets both legs, with a dark underside and inset tenons.
  r(6, 44, 19, 3, WOOD.ink);
  r(7, 44, 16, 1, WOOD.light);
  r(7, 45, 17, 1, WOOD.base);
  put(8, 45, WOOD.peg);
  put(22, 45, WOOD.peg);

  // Oak seat apron beneath a rounded, visibly stuffed green cushion.
  r(5, 36, 23, 4, WOOD.ink);
  r(6, 39, 20, 2, WOOD.ink);
  r(6, 38, 20, 1, WOOD.light);
  r(7, 39, 18, 1, WOOD.base);
  r(8, 40, 16, 1, WOOD.shade);
  put(6, 39, WOOD.worn);
  put(25, 39, WOOD.edge);
  r(8, 30, 15, 1, GREEN.outline);
  r(6, 31, 20, 1, GREEN.outline);
  r(5, 32, 22, 3, GREEN.outline);
  r(6, 35, 22, 2, GREEN.outline);
  r(8, 37, 18, 1, GREEN.outline);
  r(8, 31, 15, 1, GREEN.edge);
  r(7, 32, 18, 1, GREEN.light);
  r(6, 33, 20, 1, GREEN.base);
  r(7, 34, 19, 1, GREEN.base);
  r(7, 35, 20, 1, GREEN.side);
  r(9, 36, 17, 1, GREEN.shadow);
  r(9, 32, 9, 1, GREEN.edge);
  r(8, 33, 12, 1, GREEN.light);
  r(21, 33, 3, 1, GREEN.fold);
  put(24, 34, GREEN.side);
  put(7, 34, GREEN.edge);
  // Offset stitches read at 2× as cloth, not a decorative dotted outer border.
  for (const x of [10, 14, 18, 22]) put(x, 35, GREEN.light);
  put(10, 32, GREEN.stitch);
  put(13, 32, GREEN.stitch);
}

/** 30×52 backing for the legacy 15×26 side chair; exact mirrored siblings. */
export function fineChairCanvas(facing: Facing): HTMLCanvasElement {
  const cached = chairs[facing];
  if (cached) return cached;
  const art = grid(30, 52);
  paintChair(art);
  const result = art.canvas(facing === 'left');
  chairs[facing] = result;
  return result;
}
