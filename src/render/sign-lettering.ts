/** Native Unicode lettering, measured rather than horizontally stretched. */
export function fitSignLabel(text: string, maxWidth: number, measure: (text: string) => number): string {
  const units = [...text.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 20);
  const full = units.join('');
  if (measure(full) <= maxWidth) return full;
  while (units.length && measure(units.join('') + '…') > maxWidth) units.pop();
  return units.length ? units.join('') + '…' : '';
}
export function paintSignText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number,
  width: number, height: number, color: string): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - width / 2, y, width, height); ctx.clip();
  ctx.font = Math.max(5, height - 1) + 'px "Pixel ZH", "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  const label = fitSignLabel(text, width - 2, value => ctx.measureText(value).width);
  ctx.fillText(label, cx, y + height / 2);
  ctx.restore();
}
