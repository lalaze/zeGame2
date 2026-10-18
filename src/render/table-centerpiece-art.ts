import { registerFineSpriteArt } from './fine-sprite-art';

const sprites=new Map<string,HTMLCanvasElement>();
/** All dining ornaments share a 5 × 7 room-pixel envelope and bottom contact. */
export function centerpieceSprite(id:string):HTMLCanvasElement|undefined {
  if(id==='centerpiece_none')return;
  const old=sprites.get(id);if(old)return old;
  const art=document.createElement('canvas');art.width=10;art.height=14;
  paintCenterpiece(art.getContext('2d')!,id);
  const frame=document.createElement('canvas');frame.width=5;frame.height=7;
  frame.getContext('2d')!.drawImage(art,0,0,5,7);registerFineSpriteArt(frame,art,2);
  sprites.set(id,frame);return frame;
}

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
    r(3, 13, 4, 1, '#79513b');
  } else if (id === 'centerpiece_candle') {
    r(1, 12, 8, 1, '#90653e'); r(2, 11, 6, 1, '#e4bb76');
    r(3, 5, 4, 6, '#d8b56c'); r(3, 5, 3, 5, '#fae7af');
    r(3, 5, 4, 1, '#fff4d4'); r(4, 4, 1, 2, '#684631');
    r(4, 1, 2, 3, '#e99944'); r(4, 2, 1, 2, '#fff3b0');
    r(2, 13, 6, 1, '#79513b');
  } else {
    r(4, 5, 1, 5, '#527653'); r(2, 7, 3, 1, '#75965f'); r(5, 6, 3, 1, '#75965f');
    r(3, 1, 4, 1, '#df9ca7'); r(2, 2, 6, 2, '#cb788d'); r(3, 4, 4, 1, '#a75d73');
    r(4, 2, 2, 2, '#fff0ca'); r(3, 1, 1, 1, '#f2bfbb');
    r(3, 9, 4, 4, '#476657'); r(2, 10, 6, 2, '#476657');
    r(3, 10, 4, 3, '#a8c3ad'); r(3, 10, 1, 2, '#edf0d7');
    r(6, 10, 1, 3, '#75967d'); r(3, 13, 4, 1, '#79513b');
  }
}
