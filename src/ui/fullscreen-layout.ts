/** Contain the original room in the entire viewport, independent of overlays. */
export function fitFullscreenRoom(width: number, height: number, dpr: number, roomWidth = 320, roomHeight = 240) {
  const ratio = Math.max(0.01, Math.min(width / roomWidth, height / roomHeight));
  const shown = ratio * Math.max(1, dpr);
  const backing = shown >= 3 ? shown : Math.ceil(shown);
  return {
    width: Math.round(roomWidth * backing), height: Math.round(roomHeight * backing),
    cssWidth: roomWidth * ratio, cssHeight: roomHeight * ratio,
    backing, smooth: backing !== shown,
  };
}
