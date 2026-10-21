// The day's weather, painted: rain running down window glass. The light itself
// (a grey sky, a stronger sun) comes from weatherLight in lighting.ts.

/**
 * A grey, overcast wash over the window (the painted scenery keeps its own sunny sky),
 * then thin pale streaks falling at a slight slant, on the half-pixel art grid.
 * Positions come from the streak index and the clock alone, so reduced motion simply
 * passes a fixed time.
 */
export function paintRain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number): void {
  const count = Math.max(4, Math.round((w * h) / 45));
  ctx.save();
  ctx.fillStyle = 'rgba(96, 108, 128, 0.5)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(236, 242, 250, 0.85)';
  for (let i = 0; i < count; i++) {
    const speed = 34 + ((i * 13) % 17);
    const sx = (i * 37.3) % w;
    const sy = ((i * 23.7 + t * speed) % (h + 6)) - 6;
    for (let k = 0; k < 4; k++) ctx.fillRect(x + sx - k * 0.25, y + sy + k, 0.5, 1);
  }
  ctx.restore();
}
