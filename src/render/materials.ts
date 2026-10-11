// Shared finishes for the café's hand-painted pixel materials. All marks stay
// on the art grid; deterministic patterns remain still when a room repaints.
import { mix } from './color';

type Ctx = CanvasRenderingContext2D;

/** Layered tree crowns beyond the windows, painted in stable pixel clusters. */
export function treeLine(ctx: Ctx, x: number, y: number, w: number, h: number, darkness: number): void {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const distant = mix('#9daf91', '#303b4e', darkness * 0.85);
  const leaf = mix('#6f956f', '#243d38', darkness * 0.85);
  const lit = mix('#a9ba80', '#3a4b45', darkness * 0.85);
  const shade = mix('#4c755f', '#202f35', darkness * 0.85);
  for (let layer = 0; layer < 2; layer++) {
    for (let i = -1; i * 19 < w + 19; i++) {
      const cx = x + i * 19 + layer * 9;
      const cy = y + h * (layer ? 0.73 : 0.46) + Math.sin(i * 3.7) * h * 0.16;
      const radius = Math.max(5, h * (layer ? 0.36 : 0.43));
      ctx.fillStyle = layer ? shade : distant;
      ctx.fillRect(Math.round(cx - 1), Math.round(cy), 2, Math.ceil(h));
      for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
        const width = Math.floor(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
        ctx.fillStyle = layer ? dy < -radius * 0.35 ? lit : dy < radius * 0.3 ? leaf : shade : distant;
        ctx.fillRect(Math.round(cx - width), Math.round(cy + dy), width * 2, 1);
      }
      if (layer) {
        ctx.fillStyle = lit;
        for (let dot = 0; dot < 4; dot++) ctx.fillRect(Math.round(cx - radius * 0.6 + dot * 3), Math.round(cy - radius * 0.2 + dot % 2 * 2), 2, 1);
      }
    }
  }
  ctx.restore();
}

export function brushedMetal(ctx: Ctx, x: number, y: number, w: number, h: number, base: string): void {
  if (w < 4 || h < 4) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
  for (let dy = 1; dy < h - 1; dy++) {
    ctx.fillStyle = mix(base, dy % 3 === 0 ? '#526578' : '#f5f5e9', dy % 3 === 0 ? 0.09 : 0.08);
    ctx.fillRect(x + 1, y + dy, w - 2, 1);
  }
  ctx.fillStyle = '#f5ffff'; ctx.globalAlpha = 0.28;
  ctx.fillRect(x + Math.floor(w * 0.22), y + 1, 2, h - 2);
  ctx.fillRect(x + Math.floor(w * 0.22) + 3, y + 1, 1, h - 2);
  ctx.restore();
}

export function glassReflection(ctx: Ctx, x: number, y: number, w: number, h: number, alpha = 0.18): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#f7ffff'; ctx.globalAlpha = alpha;
  // Stepped, diagonal reflections retain crisp edges at every pixel zoom.
  for (let dy = 0; dy < h; dy++) {
    const dx = Math.floor(w * 0.25 + dy * 0.55);
    ctx.fillRect(x + dx, y + dy, 3, 1);
    ctx.fillRect(x + dx + 5, y + dy, 1, 1);
  }
  ctx.restore();
}

export function roomDepth(ctx: Ctx, width: number, height: number, floor: number, outdoors = false): void {
  ctx.save();
  // Contact shade under the wall and along cutaway edges, without a dark
  // full-screen vignette that could hide guests or furniture.
  ctx.fillStyle = '#302b3d';
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = (outdoors ? 0.045 : 0.075) * (1 - i / 7);
    ctx.fillRect(i, floor, 1, height - floor);
    ctx.fillRect(width - i - 1, floor, 1, height - floor);
    ctx.fillRect(0, floor + i, width, 1);
  }
  ctx.restore();
}

export function dustMotes(ctx: Ctx, x: number, y: number, w: number, h: number, time: number, strength: number): void {
  if (strength < 0.1) return;
  ctx.save(); ctx.fillStyle = '#fff5d6';
  for (let i = 0; i < 7; i++) {
    const phase = time * 0.15 + i * 2.4;
    ctx.globalAlpha = strength * (0.16 + 0.2 * (0.5 + Math.sin(phase) * 0.5));
    const px = x + ((i * 17 + Math.sin(phase) * 3 + w) % w);
    const py = y + ((i * 13 - time * 1.3) % h + h) % h;
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
  }
  ctx.restore();
}
