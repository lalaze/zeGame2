// The painted props and effects of the floors view (assets/generated/floor-sample-v1/build/fx,
// scripts/art-gen/floor-fx-build.py): bubbles, hearts, coins, steam, tableware, and every menu
// picture at table size. They load beside the scene's own art, so a missing file never stops the
// building: until they are here (or if they never come) the drawn shapes of textures.ts stand in.
// Phaser is only named for its types here, so the tests can read the frame lists without a canvas.
import type Phaser from 'phaser';
import { MENU, isDrink, type ItemId } from '../../game/data';
import { signatureDefinition } from '../../game/signature-drinks';

/** Texture keys of the two atlases and of the ground floor's emptied cake display. */
export const FX = 'fx', FX_ITEMS = 'fx-items', FX_CASE = 'fx-case';

/** The frames of build/fx/fx.json the floors view draws (floors-fx.test.ts checks they exist). */
export const FX_FRAMES = [
  'bubble', 'thought', 'bubble-wide', 'heart', 'rain', 'bang', 'cross', 'hourglass',
  'sparkle', 'puff', 'coin', 'tip', 'bell', 'crown', 'drop', 'bread',
  'cue-recommend', 'cue-greet', 'cue-cat', 'cue-photo', 'cue-delivery', 'tent', 'tray',
  'takeaway', 'bag', 'cup', 'tray-cups', 'jar-0', 'jar-1', 'jar-2', 'order-office', 'order-tea', 'order-banquet',
  'spill', 'parcel', 'reserved', 'map-quiet', 'map-milky',
] as const;
export type FxFrame = typeof FX_FRAMES[number];

/** A signature drink is pictured by its base (build/icons/sig-<base>.webp). */
export const SIGNATURE_BASE_ART = ['coffee', 'tea', 'milk', 'fruit'] as const;

/** The frame of build/fx/items.json that pictures a menu item. */
export function itemFrame(id: ItemId | string): string {
  if (!id.startsWith('sig:')) return `item-${id}`;
  return `sig-${signatureDefinition(id)?.base ?? id.split(':')[1] ?? 'coffee'}`;
}

/** Drinks served cold: no steam rises from them. */
const COLD = new Set<string>(['coldbrew', 'dirty', 'frappe', 'smoothie', 'lemontea', 'affogato', 'matchafloat']);
const CATEGORY = new Map<string, boolean>(MENU.map(m => [m.id, isDrink(m.category)]));
/** Whether a menu item is a drink (signature drinks all are) rather than a bread or a pastry. */
export const isDrinkItem = (id: string): boolean => id.startsWith('sig:') || (CATEGORY.get(id) ?? false);
export const isHotDrink = (id: string): boolean =>
  id.startsWith('sig:') ? signatureDefinition(id)?.base !== 'fruit' : isDrinkItem(id) && !COLD.has(id);

interface AtlasData { frames: Record<string, unknown>; meta: { image: string } }

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

/**
 * Loads the atlases next to Phaser's own loader (whose errors stop the building) and repaints the
 * drawn stand-ins of textures.ts from them. Resolves false if they are missing or the scene has gone.
 */
export async function loadFx(scene: Phaser.Scene, base: string): Promise<boolean> {
  const atlas = async (file: string, key: string) => {
    const response = await fetch(`${base}fx/${file}.json`);
    if (!response.ok) throw new Error(`No ${file}.json`);
    const data = await response.json() as AtlasData;
    return { key, data, image: await loadImage(`${base}fx/${data.meta.image}`) };
  };
  try {
    const loaded = await Promise.all([atlas('fx', FX), atlas('items', FX_ITEMS)]);
    if (!scene.sys?.textures || !scene.sys.settings.active) return false;
    for (const { key, data, image } of loaded) if (!scene.textures.exists(key)) scene.textures.addAtlas(key, image, data);
    if (FX_FRAMES.some(frame => !scene.textures.get(FX).has(frame))) return false;
    repaintTextures(scene);
    // The emptied display is optional: without it the plate's own cakes stay in the case.
    void loadImage(`${base}fx/case-empty.webp`).then(image => {
      if (scene.sys?.textures && !scene.textures.exists(FX_CASE)) scene.textures.addImage(FX_CASE, image);
    }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

type Put = (frame: FxFrame, x: number, y: number, size: number) => void;

/** Draws into a canvas texture: `put` centres an fx frame on a point, fitted to a square of `size`. */
function paint(scene: Phaser.Scene, key: string, width: number, height: number, draw: (put: Put) => void): void {
  let texture = scene.textures.exists(key) ? scene.textures.get(key) as Phaser.Textures.CanvasTexture : null;
  if (texture && typeof texture.getContext !== 'function') return;
  texture ??= scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  if (texture.width !== width || texture.height !== height) texture.setSize(width, height);
  const c = texture.getContext();
  c.clearRect(0, 0, width, height);
  c.imageSmoothingQuality = 'high';
  draw((frame, x, y, size) => {
    const f = scene.textures.getFrame(FX, frame);
    const scale = size / Math.max(f.cutWidth, f.cutHeight), w = f.cutWidth * scale, h = f.cutHeight * scale;
    c.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, x - w / 2, y - h / 2, w, h);
  });
  texture.refresh();
}

/** The size of a painted bubble texture, and where the picture inside it is centred. */
const BUBBLE = { width: 116, height: 124, x: 58, y: 52, picture: 66 } as const;
export const CUE_KINDS = ['recommend', 'greet', 'cat', 'photo', 'delivery'] as const;
export const cueTexture = (kind: string): string => `cue-${kind}`;

/**
 * Repaints the textures textures.ts drew (the scene keeps using their keys) with the painted art,
 * and adds a cue bubble for each kind of moment.
 */
function repaintTextures(scene: Phaser.Scene): void {
  const bubble = (key: string, inside: FxFrame, size: number = BUBBLE.picture) => paint(scene, key, BUBBLE.width, BUBBLE.height, put => {
    put('bubble', BUBBLE.width / 2, BUBBLE.height / 2, BUBBLE.height);
    put(inside, BUBBLE.x, BUBBLE.y, size);
  });
  paint(scene, 'cup', 44, 40, put => put('cup', 22, 20, 40));
  paint(scene, 'bread', 56, 40, put => put('bread', 28, 20, 54));
  paint(scene, 'sparkle', 40, 40, put => put('sparkle', 20, 20, 38));
  paint(scene, 'puff', 40, 40, put => put('puff', 20, 20, 38));
  // A barista's "order up" rings the bell; a sale leaves a heart.
  bubble('bubble-coffee', 'bell');
  bubble('bubble-heart', 'heart', 58);
  bubble('bubble-bread', 'bread');
  bubble('bubble-sad', 'rain');
  bubble('bubble-moment', 'bang', 62);
  for (const kind of CUE_KINDS) bubble(cueTexture(kind), `cue-${kind}`, 72);
}
