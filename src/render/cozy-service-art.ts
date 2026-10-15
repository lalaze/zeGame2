import { generatedMainSource } from './generated-main-art';
import { COZY_SERVICE_GUIDES } from './cozy-service-assets';
import { fineSpriteArt } from './fine-sprite-art';
import { drawText, textWidth } from './font';

type Id = keyof typeof COZY_SERVICE_GUIDES;
function geometry(id: Id, x: number, foot: number, w: number, h: number) {
  const source = generatedMainSource(id); if (!source) return undefined;
  const guide = COZY_SERVICE_GUIDES[id], [bx, , bw, bh] = guide.artBounds;
  const scale = Math.min(w / bw, h / bh);
  return { source, scale, x: x + (w - bw * scale) / 2 - bx * scale, y: foot - guide.foot[1] * scale };
}
export function paintCozyService(ctx: CanvasRenderingContext2D, id: Id, x: number, foot: number, w: number, h: number): boolean {
  const g = geometry(id, x, foot, w, h); if (!g) return false;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(g.source, g.x, g.y, g.source.width * g.scale, g.source.height * g.scale);
  ctx.restore(); return true;
}
export function paintCozyCakeDome(ctx: CanvasRenderingContext2D, x: number, foot: number, cake?: HTMLCanvasElement): boolean {
  const g = geometry('cozy-cake-dome', x, foot, 22, 21); if (!g) return false;
  const guide = COZY_SERVICE_GUIDES['cozy-cake-dome'];
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(g.source, g.x, g.y, g.source.width * g.scale, g.source.height * g.scale);
  if (cake) {
    const [cx, cy] = guide.cakeFoot, scale = Math.min(10 / cake.width, 8 / cake.height);
    ctx.drawImage(fineSpriteArt(cake).canvas, g.x + cx * g.scale - cake.width * scale / 2,
      g.y + cy * g.scale - cake.height * scale, cake.width * scale, cake.height * scale);
    ctx.drawImage(g.source, 0, 0, g.source.width, guide.glassOverlayBottom,
      g.x, g.y, g.source.width * g.scale, guide.glassOverlayBottom * g.scale);
  }
  ctx.restore(); return true;
}
export function paintCozyTableTent(ctx: CanvasRenderingContext2D, n: number): boolean {
  const word = String(n), w = Math.max(7, textWidth(word) + 4);
  const g = geometry('cozy-table-tent', 0, 7, w, 7); if (!g) return false;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(g.source, g.x, g.y, g.source.width * g.scale, g.source.height * g.scale);
  // Keep the live number legible at its established seven-pixel footprint.
  const width = textWidth(word), scale = Math.min(1, (w - 3) / width);
  ctx.translate((w - width * scale) / 2, 1); ctx.scale(scale, 1);
  drawText(ctx, word, 0, 0, '#563b29'); ctx.restore(); return true;
}
