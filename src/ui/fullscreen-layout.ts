import { WORLD_ART_DENSITY } from '../render/world-art-grid';

/** Share of the contain size the room may give up to show every art pixel exactly. */
export const CRISP_LETTERBOX = 0.1;

/**
 * Fit the original room in the entire viewport, independent of overlays.
 *
 * The room always renders a whole, even number of device pixels per room pixel, so
 * every art pixel (half a room pixel) covers the same whole number of device pixels.
 * When that scale is within CRISP_LETTERBOX of the contain size the room shows at
 * exactly that scale (the neighbouring-room previews fill the margin). Otherwise it
 * keeps the contain size and the browser smooths the small remaining step.
 */
export function fitFullscreenRoom(width: number, height: number, dpr: number, roomWidth = 320, roomHeight = 240) {
  const ratio = Math.max(0.01, Math.min(width / roomWidth, height / roomHeight));
  const pixelRatio = Math.max(1, dpr);
  const shown = ratio * pixelRatio;
  const crisp = Math.floor(shown / WORLD_ART_DENSITY) * WORLD_ART_DENSITY;
  if (crisp >= WORLD_ART_DENSITY && crisp >= shown * (1 - CRISP_LETTERBOX)) {
    return {
      width: roomWidth * crisp, height: roomHeight * crisp,
      cssWidth: roomWidth * crisp / pixelRatio, cssHeight: roomHeight * crisp / pixelRatio,
      backing: crisp, smooth: false,
    };
  }
  const backing = Math.max(WORLD_ART_DENSITY, Math.round(shown / WORLD_ART_DENSITY) * WORLD_ART_DENSITY);
  return {
    width: roomWidth * backing, height: roomHeight * backing,
    cssWidth: roomWidth * ratio, cssHeight: roomHeight * ratio,
    backing, smooth: backing !== shown,
  };
}
