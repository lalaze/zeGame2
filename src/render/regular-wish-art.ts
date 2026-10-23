import type { MinaWishChoice } from '../game/regular-wishes';

/** A small hand-drawn street map, shared by the journal and the café counter. */
export function paintMinaMap(ctx: CanvasRenderingContext2D, x: number, y: number, choice: MinaWishChoice): void {
  const rect = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x + dx, y + dy, w, h);
  };
  ctx.save();
  rect(1, 1, 30, 18, '#563e30');
  rect(0, 0, 30, 18, '#a47146');
  rect(1, 1, 28, 16, '#f5e4bf');
  rect(1, 1, 28, 1, '#fff3d9');
  rect(3, 4, 24, 1, '#d6c69d');
  rect(3, 11, 24, 1, '#d6c69d');
  rect(8, 3, 1, 12, '#d6c69d');
  rect(22, 3, 1, 12, '#d6c69d');
  const ink = choice === 'quiet' ? '#597b73' : '#a55b49';
  rect(5, 6, 8, 1, ink); rect(12, 6, 1, 7, ink);
  rect(12, 12, 12, 1, ink); rect(23, 8, 1, 5, ink);
  // Station, café, school: three landmarks connected by her chosen route.
  rect(3, 4, 5, 4, '#695a4a'); rect(4, 5, 3, 1, '#eee4cf');
  rect(11, 10, 4, 4, '#c39b54'); rect(12, 11, 2, 2, '#fff3d9');
  rect(21, 5, 5, 4, ink); rect(22, 4, 3, 1, ink); rect(23, 6, 1, 2, '#fff3d9');
  rect(17, 3, 2, 2, '#81946a'); rect(18, 5, 1, 2, '#9c7954');
  rect(4, 13, 5, 1, ink); rect(4, 15, 3, 1, '#a58a63');
  // Two tiny brass pins fasten the paper to its frame.
  rect(1, 1, 1, 1, '#c6a261'); rect(28, 1, 1, 1, '#c6a261');
  ctx.restore();
}

/** A folded reservation card with an M and a pencil, legible at room scale. */
export function paintMinaReservation(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#78573d'; ctx.fillRect(0, 1, 15, 9);
  ctx.fillStyle = '#fff0d0'; ctx.fillRect(1, 0, 12, 8);
  ctx.fillStyle = '#597b73';
  for (const [x, y, w, h] of [[3, 2, 1, 4], [7, 2, 1, 4], [4, 3, 1, 1], [6, 3, 1, 1], [5, 4, 1, 1], [10, 2, 1, 4]]) ctx.fillRect(x, y, w, h);
}
