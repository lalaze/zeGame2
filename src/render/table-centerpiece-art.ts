import { paintTableVase } from './service-props-art';

/** Shared 10 × 14 footprint for the scene and catalog, anchored at bottom centre. */
export function paintCenterpiece(ctx: CanvasRenderingContext2D, id: string): void {
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  };
  if (id === 'centerpiece_none') return;
  if (id === 'centerpiece_succulent') {
    r(2, 9, 6, 4, '#9b6347'); r(3, 10, 4, 3, '#cf9368');
    r(1, 8, 8, 2, '#e6b786'); r(2, 8, 6, 1, '#695041');
    r(4, 3, 2, 6, '#527653'); r(1, 5, 3, 2, '#75965f');
    r(2, 7, 3, 2, '#9cb87b'); r(6, 5, 3, 2, '#8eac70');
    r(5, 7, 3, 2, '#527653'); r(4, 3, 1, 3, '#b7cc8f');
  } else if (id === 'centerpiece_candle') {
    r(1, 12, 8, 1, '#90653e'); r(2, 11, 6, 1, '#e4bb76');
    r(3, 5, 4, 6, '#d8b56c'); r(3, 5, 3, 5, '#fae7af');
    r(3, 5, 4, 1, '#fff4d4'); r(4, 4, 1, 2, '#684631');
    r(4, 1, 2, 3, '#e99944'); r(4, 2, 1, 2, '#fff3b0');
  } else {
    ctx.save(); ctx.translate(2, 0); paintTableVase(ctx, '#ef5d7a'); ctx.restore();
  }
}
