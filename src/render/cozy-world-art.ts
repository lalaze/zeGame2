import { generatedMainSource, type GeneratedMainId } from './generated-main-art';
import type { CozyKitchenId } from './cozy-world-assets';
import { paintContactShade } from './main-room-lighting';

const KITCHEN_INDICATORS: Partial<Record<CozyKitchenId, readonly [number, number]>> = {
  cooler: [.27, .16], mixer: [.83, .24], standMixer: [.83, .24], proofer: [.39, .155],
  kettle: [.52, .76], deckOven: [.79, .2], convection: [.79, .32], fryer: [.5, .12],
};

function containedSource(id: GeneratedMainId, x: number, foot: number, w: number, h: number) {
  const source = generatedMainSource(id);
  if (!source || ![source.width, source.height, w, h].every(n => Number.isFinite(n) && n > 0) ||
    ![x, foot].every(Number.isFinite)) return null;
  const scale = Math.min(w / source.width, h / source.height);
  const width = source.width * scale, height = source.height * scale;
  return { source, left: x + (w - width) / 2, top: foot - height, width, height };
}

/** Contain a generated cutout inside its existing footprint, bottom aligned. */
export function paintCozyWorld(ctx: CanvasRenderingContext2D, id: GeneratedMainId,
  x: number, foot: number, w: number, h: number): boolean {
  const fit = containedSource(id, x, foot, w, h);
  if (!fit) return false;
  const { source, left, top, width, height } = fit;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, left, top, width, height);
  ctx.restore(); return true;
}

export function paintCozyKitchen(ctx: CanvasRenderingContext2D, id: CozyKitchenId,
  x: number, foot: number, w: number, h: number, active = false, t = 0): boolean {
  const fit = containedSource(`cozy-kitchen-${id}`, x, foot, w, h);
  if (!fit) return false;
  const { source, left, top, width, height } = fit;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (!['hood', 'sheeter', 'standMixer'].includes(id)) paintContactShade(ctx, left + width / 2, foot, width * .9, .18);
  ctx.drawImage(source, left, top, width, height);
  if (!active) { ctx.restore(); return true; }

  // These are live activity layers, registered to the fitted artwork rather
  // than its larger layout envelope. Small appliances must not vent at h's top.
  const time = Number.isFinite(t) ? t : 0, phase = Math.floor(time * 8), pulse = .5 + Math.sin(time * 6) * .5;
  const rect = (u: number, v: number, rw: number, rh: number, color: string, alpha = 1) => {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
    ctx.fillRect(left + u * width, top + v * height, rw * width, rh * height); ctx.restore();
  };
  const steam = (u: number, v: number, spread = .2, alpha = .5) => {
    const travel = Math.min(9, height * .28);
    ctx.save(); ctx.fillStyle = '#fff0ce';
    for (let i = 0; i < 3; i++) {
      const progress = ((time * .8 + i / 3) % 1 + 1) % 1;
      ctx.globalAlpha = alpha * (1 - progress);
      const sway = Math.sin(time * 3 + i * 2) * .6;
      ctx.fillRect(left + width * (u + (i - 1) * spread / 2) + sway,
        top + height * v - progress * travel, .8 + progress * .5, 1.2 + progress);
    }
    ctx.restore();
  };
  const heatWindow = (u: number, v: number, rw: number, rh: number) => {
    rect(u, v, rw, rh, '#ef9d48', .15 + pulse * .13);
    rect(u + .03, v + rh * .76, rw - .06, rh * .12, '#ffc96c', .35 + pulse * .2);
  };

  switch (id) {
    case 'cooler':
      // Open cavity, stored bottles and a narrow swung door made from the
      // generated door pixels. The closed state remains the original bitmap.
      rect(.14, .25, .55, .64, '#263b2d');
      for (const shelf of [.43, .65, .83]) {
        rect(.17, shelf, .43, .018, '#c5c9a6');
        rect(.22, shelf - .12, .065, .11, '#e7e2c3');
        rect(.32, shelf - .095, .08, .075, '#a8ba87');
        rect(.47, shelf - .1, .07, .09, '#f4e5bb');
      }
      ctx.drawImage(source, source.width * .12, source.height * .23, source.width * .59, source.height * .68,
        left + width * .65, top + height * .23, width * .14, height * .68);
      rect(.16, .26, .025, .61, '#ffe4a0', .45);
      break;
    case 'dryStore': {
      // A brief highlight follows the shelf being accessed by the cook.
      const column = ((phase % 4) + 4) % 4;
      rect(.13 + column * .16, .19, .14, .21, '#ffe3a2', .2 + pulse * .18);
      rect(.15 + column * .16, .42, .1, .014, '#fff2cf');
      break;
    }
    case 'mixer':
    case 'standMixer': {
      const turn = time * 8, cx = left + width * .33, cy = top + height * .34;
      ctx.strokeStyle = '#f3dbac'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(cx, top + height * .27);
      ctx.lineTo(cx + Math.sin(turn) * width * .08, cy);
      ctx.lineTo(cx + Math.sin(turn + .9) * width * .09, cy + height * .025); ctx.stroke();
      for (let i = 0; i < 3; i++) rect(.31 + Math.cos(turn + i * 2.1) * .13,
        .36 + Math.sin(turn + i * 2.1) * .025, .04, .014, '#ead5aa');
      break;
    }
    case 'proofer':
      heatWindow(.22, .25, .43, .57);
      for (const shelf of [.345, .49, .635, .775]) for (const u of [.27, .45]) {
        rect(u, shelf - .034 - pulse * .005, .13, .035 + pulse * .005, '#e8ce97');
        rect(u + .025, shelf - .045 - pulse * .005, .08, .016, '#fae8bb');
      }
      ctx.save(); ctx.beginPath(); ctx.rect(left + width * .21, top + height * .24, width * .45, height * .58); ctx.clip();
      steam(.44, .7, .25, .35); ctx.restore();
      steam(.43, .17, .12, .3);
      break;
    case 'kettle':
      for (let i = 0; i < 4; i++) rect(.27 + i * .12, .07 + (((phase + i) % 3 + 3) % 3) * .012,
        .03, .015, '#fff1cc', .8);
      rect(.22, .54, .53, .018, '#ffbd59', .3 + pulse * .3);
      steam(.48, .07, .28);
      break;
    case 'deckOven':
      for (const v of [.29, .66]) {
        heatWindow(.14, v, .5, .13);
        for (const u of [.22, .42]) rect(u, v + .07, .13, .035, '#e4b26a', .7);
      }
      steam(.45, .06, .22, .25);
      break;
    case 'convection': {
      heatWindow(.14, .29, .39, .46);
      const cx = left + width * .38, cy = top + height * .47, radius = Math.min(width, height) * .105;
      ctx.strokeStyle = '#d4ba83'; ctx.lineWidth = .65; ctx.globalAlpha *= .8;
      for (let i = 0; i < 4; i++) {
        const angle = time * 9 + i * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * radius * .25, cy + Math.sin(angle) * radius * .25);
        ctx.lineTo(cx + Math.cos(angle + .3) * radius, cy + Math.sin(angle + .3) * radius); ctx.stroke();
      }
      rect(.365, .455, .03, .03, '#f5d797');
      steam(.4, .06, .15, .22);
      break;
    }
    case 'fryer':
      for (let i = 0; i < 5; i++) rect(.25 + i * .07, .29 + (((phase + i) % 3 + 3) % 3) * .025,
        .025, .014, '#ffe1a0', .8);
      steam(.42, .28, .25);
      break;
  }
  const lamp = KITCHEN_INDICATORS[id];
  if (lamp) rect(lamp[0], lamp[1], .045, .025, '#e8ef9f', .8 + pulse * .2);
  ctx.restore();
  return true;
}
