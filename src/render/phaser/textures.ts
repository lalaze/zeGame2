import type Phaser from 'phaser';

// All art is drawn in code into canvases (see render/sprites.ts); these helpers turn
// those canvases into Phaser textures. Sprite canvases are cached by their makers,
// so each one is uploaded once.

// A sprite may be shown by the game and an independent preview/game instance.
// Texture keys belong to a manager; a global canvas-only cache can return a key
// that was never uploaded in the second instance.
const keys = new WeakMap<Phaser.Textures.TextureManager, WeakMap<HTMLCanvasElement, string>>();
let next = 0;

/** The texture key for a sprite canvas, registering it with Phaser the first time. */
export function canvasKey(textures: Phaser.Textures.TextureManager, canvas: HTMLCanvasElement): string {
  let canvases = keys.get(textures);
  if (!canvases) {
    canvases = new WeakMap<HTMLCanvasElement, string>();
    keys.set(textures, canvases);
  }
  let key = canvases.get(canvas);
  if (!key || !textures.exists(key)) {
    key = `canvas-${next++}`;
    textures.addCanvas(key, canvas);
    canvases.set(canvas, key);
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
