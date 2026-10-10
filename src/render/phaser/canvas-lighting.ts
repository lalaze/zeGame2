/**
 * Phaser snapshots its Canvas blend table before its asynchronous image probe can
 * finish. Check multiply synchronously before using an opaque room-wide grade.
 * Return false on unsupported/restricted canvases so callers omit the grade.
 */
export function prepareCanvasMultiply(
  blendModes: string[],
  multiplyMode: number,
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): boolean {
  try {
    const canvas = createCanvas();
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 1, 1);
    ctx.globalCompositeOperation = 'multiply';
    if (ctx.globalCompositeOperation !== 'multiply') return false;
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (r !== 255 || g !== 0 || b !== 0 || a !== 255) return false;
    blendModes[multiplyMode] = 'multiply';
    return true;
  } catch {
    // Pixel reads can be restricted. A missing grade is safer than a solid room.
    return false;
  }
}
