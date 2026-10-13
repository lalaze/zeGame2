/** Tiny, separately composable service objects in the Warm Pixel A material language.
 * Native-size canvases keep hand/table anchors stable and are baked once by Phaser.
 */
import { drawText, textWidth } from './font';

type Ctx = CanvasRenderingContext2D;
const p = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Seven-pixel porcelain demitasse, with a real handle and a saucer. */
export function paintServiceCup(ctx: Ctx): void {
  p(ctx, 1, 0, 4, 5, '#543b2a');
  p(ctx, 2, 1, 2, 4, '#e0c99f');
  p(ctx, 1, 1, 1, 3, '#fff5dc');
  p(ctx, 2, 1, 2, 1, '#74472d');
  p(ctx, 2, 1, 1, 1, '#bd8549');
  p(ctx, 5, 1, 2, 3, '#c1ad89');
  p(ctx, 5, 1, 2, 1, '#fff5dc');
  p(ctx, 5, 2, 1, 1, '#543b2a');
  p(ctx, 0, 5, 6, 1, '#f7ead0');
  p(ctx, 1, 6, 5, 1, '#b79a73');
  p(ctx, 1, 5, 3, 1, '#fff7e6');
}

/** Dark polished serving tray, narrow brass rim and two integral handles. */
export function paintServiceTray(ctx: Ctx): void {
  p(ctx, 1, 0, 20, 3, '#39281f');
  p(ctx, 0, 0, 3, 1, '#c8a15e');
  p(ctx, 19, 0, 3, 1, '#c8a15e');
  p(ctx, 3, 0, 16, 1, '#ead5a8');
  p(ctx, 2, 1, 18, 1, '#865332');
  p(ctx, 4, 1, 6, 1, '#a97141');
  p(ctx, 2, 2, 18, 1, '#543425');
}

/** Glass bud bottle, two leaves, a five-petal flower and reflected light. */
export function paintTableVase(ctx: Ctx, bloom: string): void {
  p(ctx, 1, 7, 3, 6, '#476657');
  p(ctx, 0, 9, 5, 3, '#476657');
  p(ctx, 1, 8, 3, 4, '#b7d4b8');
  p(ctx, 1, 9, 1, 2, '#f4f3d8');
  p(ctx, 3, 9, 1, 3, '#8aa78c');
  p(ctx, 1, 12, 3, 1, '#d5dbb7');
  p(ctx, 2, 3, 1, 7, '#627451');
  p(ctx, 0, 5, 2, 1, '#9bb46b');
  p(ctx, 1, 6, 1, 1, '#627451');
  p(ctx, 3, 4, 2, 1, '#627451');
  p(ctx, 3, 3, 1, 1, '#9bb46b');
  p(ctx, 1, 0, 3, 3, bloom);
  p(ctx, 0, 1, 5, 1, bloom);
  p(ctx, 1, 0, 1, 1, '#fff5dc');
  p(ctx, 2, 1, 1, 1, '#c8a15e');
  p(ctx, 1, 13, 4, 1, '#b79a73');
}

/** Folded ivory stock in a wooden number holder, rather than a flat label. */
export function paintTableTent(ctx: Ctx, n: number): void {
  const text = String(n), w = textWidth(text) + 4;
  p(ctx, 1, 0, w - 2, 7, '#543425');
  p(ctx, 1, 1, w - 2, 5, '#f4e6c7');
  p(ctx, 1, 1, w - 3, 1, '#fff5dc');
  p(ctx, 0, 5, w, 2, '#865332');
  p(ctx, 0, 5, w, 1, '#c8a15e');
  drawText(ctx, text, 2, 1, '#627451');
}
