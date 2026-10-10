import type Phaser from 'phaser';

// All art is drawn in code into canvases (see render/sprites.ts); these helpers turn
// those canvases into Phaser textures. Sprite canvases are cached by their makers,
// so each one is uploaded once.

const keys = new WeakMap<HTMLCanvasElement, string>();
let next = 0;

/** The texture key for a sprite canvas, registering it with Phaser the first time. */
export function canvasKey(textures: Phaser.Textures.TextureManager, canvas: HTMLCanvasElement): string {
  let key = keys.get(canvas);
  if (!key) {
    key = `canvas-${next++}`;
    textures.addCanvas(key, canvas);
    keys.set(canvas, key);
  }
  return key;
}

/** A texture painted once into a fresh canvas, under a key that names what it shows. */
export function baked(
  textures: Phaser.Textures.TextureManager,
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): string {
  if (textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  paint(canvas.getContext('2d')!);
  textures.addCanvas(key, canvas);
  return key;
}
