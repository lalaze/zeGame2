/** Complete authored extent plus the exporter's strictly trailing ceil padding. */
export interface GeneratedRasterMetadata {
  readonly originalSize: readonly number[];
  readonly size: readonly number[];
  readonly scale: number;
  readonly productionContentSize: readonly number[];
}
export interface GeneratedRasterGeometry {
  readonly source: CanvasImageSource;
  /** Layout, authored crops and contacts always use these original coordinates. */
  readonly width: number;
  readonly height: number;
  readonly sourceScale: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
}

/** Read intrinsic dimension pairs together; an undecoded/CSS-sized image cannot replace art. */
function dimensions(source: CanvasImageSource): readonly [number, number] {
  const value = source as unknown as { complete?: boolean; naturalWidth?: number; naturalHeight?: number;
    videoWidth?: number; videoHeight?: number; displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  if (value.complete === false) return [0, 0];
  if (value.naturalWidth !== undefined || value.naturalHeight !== undefined) return [value.naturalWidth ?? 0, value.naturalHeight ?? 0];
  if (value.videoWidth !== undefined || value.videoHeight !== undefined) return [value.videoWidth ?? 0, value.videoHeight ?? 0];
  if (value.displayWidth !== undefined || value.displayHeight !== undefined) return [value.displayWidth ?? 0, value.displayHeight ?? 0];
  return [value.width ?? 0, value.height ?? 0];
}

/**
 * Resolve only the exact production raster or the exact unchanged archived original.
 * The latter supports authoring comparison without weakening malformed-size fallback.
 * No source pixels are cropped, modified, read back, allocated or retained here.
 */
export function generatedRasterGeometry(source: CanvasImageSource, meta?: GeneratedRasterMetadata): GeneratedRasterGeometry | null {
  const [actualWidth, actualHeight] = dimensions(source);
  if (![actualWidth, actualHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  if (!meta) return { source, width: actualWidth, height: actualHeight, sourceScale: 1, contentWidth: actualWidth, contentHeight: actualHeight };
  const { originalSize, size, scale, productionContentSize: content } = meta;
  if (![originalSize, size, content].every(values => Array.isArray(values) && values.length === 2 && values.every(value => Number.isFinite(value) && value > 0)) ||
    ![...originalSize, ...size].every(Number.isInteger) || !Number.isFinite(scale) || scale <= 0 || scale > 1) return null;
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(content[axis] - originalSize[axis] * scale) > 1e-9 || content[axis] > size[axis] ||
      size[axis] - content[axis] >= 1 || Math.ceil(content[axis]) !== size[axis]) return null;
  }
  if (actualWidth === originalSize[0] && actualHeight === originalSize[1]) return {
    source, width: actualWidth, height: actualHeight, sourceScale: 1, contentWidth: actualWidth, contentHeight: actualHeight,
  };
  if (actualWidth !== size[0] || actualHeight !== size[1]) return null;
  return { source, width: originalSize[0], height: originalSize[1], sourceScale: scale, contentWidth: content[0], contentHeight: content[1] };
}
