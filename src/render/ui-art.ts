/** Warm Pixel A overlay art. Integer pixels only; no layout or simulation state. */
export const UI_ART = {
  ink: '#39281f', cream: '#f4e6c7', light: '#fff5dc', paperShade: '#c7b28b',
  timber: '#865332', timberLight: '#c98c4d', timberShade: '#543425',
  sage: '#627451', sageLight: '#9bb46b', sageShade: '#3d503a',
  brass: '#c8a15e', brassLight: '#f0ce85', brassShade: '#866344',
  warning: '#ab5543',
} as const;

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Soft stepped paper cloud. Bounds and ink inset match the existing placement. */
export function paintThoughtFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const r = (x: number, y: number, rw: number, rh: number, c: string) => rect(ctx, x, y, rw, rh, c);
  r(4, 0, w - 8, h, UI_ART.brassShade);
  r(0, 4, w, h - 8, UI_ART.brassShade);
  r(2, 2, w - 4, h - 4, UI_ART.brassShade);
  r(4, 1, w - 8, h - 2, UI_ART.cream);
  r(1, 4, w - 2, h - 8, UI_ART.cream);
  r(3, 3, w - 6, h - 6, UI_ART.cream);
  // Selective upper-left light, with a quiet two-step lower-right paper fold.
  r(5, 1, w - 10, 1, UI_ART.light);
  r(3, 3, 2, 1, UI_ART.light);
  r(1, 5, 1, h - 10, UI_ART.light);
  r(5, h - 3, w - 10, 2, UI_ART.paperShade);
  r(w - 3, 5, 2, h - 10, UI_ART.paperShade);
  r(w - 5, h - 5, 2, 2, UI_ART.paperShade);
}

/** Pointed service/order slip. Canvas is (bodyWidth + 2) × (bodyHeight + 4). */
export function paintOrderFrame(ctx: CanvasRenderingContext2D, bodyWidth: number, bodyHeight = 18): void {
  const w = bodyWidth, h = bodyHeight;
  const r = (x: number, y: number, rw: number, rh: number, c: string) => rect(ctx, x, y, rw, rh, c);
  r(1, 0, w, h + 2, UI_ART.ink);
  r(0, 1, w + 2, h, UI_ART.ink);
  r(1, 1, w, h, UI_ART.cream);
  r(2, 1, w - 2, 1, UI_ART.light);
  r(1, 2, 1, h - 3, UI_ART.light);
  r(2, h - 1, w - 1, 2, UI_ART.paperShade);
  r(w, 2, 1, h - 3, UI_ART.paperShade);
  const tail = Math.floor(w / 2) + 1;
  r(tail - 2, h + 2, 5, 1, UI_ART.ink);
  r(tail - 1, h + 1, 3, 1, UI_ART.paperShade);
  r(tail - 1, h + 2, 3, 1, UI_ART.cream);
  r(tail, h + 3, 1, 1, UI_ART.ink);
}

/** Sold-out slip keeps the same 22 × 20 footprint as the live order overlay. */
export function paintSoldOutFrame(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 1, 0, 20, 20, UI_ART.ink);
  rect(ctx, 0, 1, 22, 18, UI_ART.ink);
  rect(ctx, 1, 1, 20, 18, UI_ART.cream);
  rect(ctx, 2, 1, 18, 1, UI_ART.light);
  rect(ctx, 1, 2, 1, 16, UI_ART.light);
  rect(ctx, 2, 17, 19, 2, UI_ART.paperShade);
}

/** A stamped terracotta cross, with a dark lower edge, on a 20 × 18 canvas. */
export function paintSoldOutCross(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 12; i++) {
    rect(ctx, 4 + i, 4 + i, 2, 1, UI_ART.timberShade);
    rect(ctx, 15 - i, 4 + i, 2, 1, UI_ART.timberShade);
  }
  for (let i = 0; i < 12; i++) {
    rect(ctx, 4 + i, 3 + i, 2, 1, UI_ART.warning);
    rect(ctx, 15 - i, 3 + i, 2, 1, UI_ART.warning);
  }
}

/** Redrawn brass bell in its little pointed 17 × 15 service slip. */
export function paintCallBubble(ctx: CanvasRenderingContext2D): void {
  paintOrderFrame(ctx, 15, 10);
  rect(ctx, 7, 3, 3, 1, UI_ART.brassShade);
  rect(ctx, 8, 2, 1, 1, UI_ART.brassLight);
  rect(ctx, 6, 4, 5, 1, UI_ART.brassShade);
  rect(ctx, 5, 5, 7, 3, UI_ART.brass);
  rect(ctx, 6, 4, 2, 3, UI_ART.brassLight);
  rect(ctx, 10, 6, 2, 2, UI_ART.brassShade);
  rect(ctx, 4, 8, 9, 1, UI_ART.ink);
  rect(ctx, 5, 8, 7, 1, UI_ART.brassShade);
}

/** A sage acknowledgement mark, preserving the original 7 × 10 canvas. */
export function paintAckBubble(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 1, 0, 5, 9, UI_ART.ink);
  rect(ctx, 0, 1, 7, 7, UI_ART.ink);
  rect(ctx, 1, 1, 5, 7, UI_ART.cream);
  rect(ctx, 1, 1, 4, 1, UI_ART.light);
  rect(ctx, 4, 2, 2, 5, UI_ART.paperShade);
  rect(ctx, 3, 2, 1, 3, UI_ART.sageShade);
  rect(ctx, 3, 6, 1, 1, UI_ART.sageShade);
  rect(ctx, 3, 9, 1, 1, UI_ART.ink);
}
