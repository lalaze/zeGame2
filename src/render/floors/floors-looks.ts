// The café's own people in the floors view: owner, baristas and servers wear the look the game gave
// them (hairstyle, skin, hair colour, apron, trousers). Each hairstyle is one painted strip in key
// colours (assets/generated/floor-sample-v1/build/staff, scripts/art-gen/floor-staff-build.py);
// staff-paint.ts repaints it for a look. This file loads the strips, keeps one painted picture per
// look, and hands the scene its textures.
import type Phaser from 'phaser';
import type { Look } from '../../game/state';
import { HAIRS, PANTS, SHIRTS, SKINS } from '../sprites';
import { hexRgb, paintStaff, type Rgb, type StaffColours } from './staff-paint';

export const STAFF_ART = `${import.meta.env.BASE_URL}assets/generated/floor-sample-v1/build/staff/`;
/** Cells of a staff strip, the same as every other character's (floors-scene.ts `SIDE`). */
export const STAFF_FRAMES = { walk: [0, 1, 2, 3], front: 4, happy: 5, side: 6, back: 7 } as const;

export interface StaffStyle {
  frameWidth: number; frameHeight: number; frames: number;
  /** The colours the parts were painted in. */
  key: Record<keyof StaffColours, number[]>;
  /** Its cell in the picture of front poses. */
  front: number;
}
/** build/staff/staff.json. */
export interface StaffManifest {
  /** Hairstyle names in save order (TEAM_HAIRSTYLES). */
  order: string[];
  fronts: { cellWidth: number; cellHeight: number; cols: number; rows: number };
  styles: Record<string, StaffStyle>;
  /** The cooks' own strips (`cook-chef`, `cook-chef-work`, ...): only their hair and skin are repainted. */
  cooks?: Record<string, CookStrip>;
}
export interface CookStrip { frameWidth: number; frameHeight: number; frames: number; key: { hair: number[]; skin: number[] } }
/** The two cooks of the kitchen, by the name of their sheet. */
export type CookKind = 'cook-chef' | 'cook-scarf';

/** A cook's look shows in skin and hair colour; their hat, scarf and clothes are their own. */
export function cookId(look: Look): string {
  return `${mod(look.skin, SKINS.length)}.${mod(look.hair, HAIRS.length)}`;
}

const mod = (n: number, length: number) => ((Math.trunc(n) % length) + length) % length;

/** The look with every choice inside its range, as the pixel view reads it. */
export function normalLook(look: Look, styles: number): Look {
  return { skin: mod(look.skin, SKINS.length), hair: mod(look.hair, HAIRS.length), hairStyle: mod(look.hairStyle, styles),
    shirt: mod(look.shirt, SHIRTS.length), pants: mod(look.pants, PANTS.length) };
}

/** One name per distinct look: looks that paint the same picture share it. */
export function lookId(look: Look, styles = 32): string {
  const l = normalLook(look, styles);
  return `${l.hairStyle}.${l.skin}.${l.hair}.${l.shirt}.${l.pants}`;
}

/** The game's own colours for a look. What the game calls the shirt is the apron everyone wears. */
export function lookColours(look: Look): StaffColours {
  return {
    skin: hexRgb(SKINS[mod(look.skin, SKINS.length)]), hair: hexRgb(HAIRS[mod(look.hair, HAIRS.length)]),
    apron: hexRgb(SHIRTS[mod(look.shirt, SHIRTS.length)]), pants: hexRgb(PANTS[mod(look.pants, PANTS.length)]),
  };
}

/** The hairstyle a look wears, if it has been painted. */
export function lookStyle(manifest: StaffManifest, look: Look): { name: string; style: StaffStyle } | undefined {
  const name = manifest.order[mod(look.hairStyle, manifest.order.length)], style = manifest.styles[name];
  return style ? { name, style } : undefined;
}

/** Keeps the newest `limit` entries; reading one makes it new again. */
export class Recent<T> {
  private entries = new Map<string, T>();
  constructor(private limit: number, private dropped?: (key: string, value: T) => void) {}
  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) { this.entries.delete(key); this.entries.set(key, value); }
    return value;
  }
  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    for (const [old, gone] of this.entries) {
      if (this.entries.size <= this.limit) break;
      this.entries.delete(old);
      this.dropped?.(old, gone);
    }
  }
  delete(key: string): void { this.entries.delete(key); }
  get size(): number { return this.entries.size; }
}

interface Pixels { data: Uint8ClampedArray; width: number; height: number }
export interface PaintedStrip { canvas: HTMLCanvasElement; frameWidth: number; frameHeight: number; frames: number }

async function readPixels(url: string): Promise<Pixels> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
}

function toCanvas(data: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const image = canvas.getContext('2d')!.createImageData(width, height);
  image.data.set(data);
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas;
}

/** A block of an RGBA picture, as its own pixels. */
function cut(source: Pixels, x: number, y: number, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * source.width + x) * 4;
    out.set(source.data.subarray(from, from + width * 4), row * width * 4);
  }
  return out;
}

const keyColours = (style: StaffStyle): StaffColours => style.key as unknown as Record<keyof StaffColours, Rgb>;

/** Loads staff art and paints it for looks. A failed download is tried again the next time it is asked for. */
export class StaffLooks {
  private manifestLoad: Promise<StaffManifest> | null = null;
  private sources = new Map<string, Promise<{ strip: Pixels; mask: Pixels }>>();
  private strips = new Map<string, Promise<PaintedStrip>>();
  private fronts = new Recent<Promise<HTMLCanvasElement>>(160);

  constructor(private base = STAFF_ART) {}

  manifest(): Promise<StaffManifest> {
    this.manifestLoad ??= fetch(`${this.base}staff.json`).then(response => {
      if (!response.ok) throw new Error('Could not load the staff looks');
      return response.json() as Promise<StaffManifest>;
    }).catch(error => { this.manifestLoad = null; throw error; });
    return this.manifestLoad;
  }

  private source(name: string): Promise<{ strip: Pixels; mask: Pixels }> {
    let load = this.sources.get(name);
    if (!load) {
      load = Promise.all([readPixels(`${this.base}${name}.webp`), readPixels(`${this.base}${name}-mask.webp`)])
        .then(([strip, mask]) => {
          if (mask.width !== strip.width || mask.height !== strip.height * 2) throw new Error(`Staff mask ${name} does not fit its strip`);
          return { strip, mask };
        });
      load.catch(() => { if (this.sources.get(name) === load) this.sources.delete(name); });
      this.sources.set(name, load);
    }
    return load;
  }

  /** The whole strip (walk and standing poses) in this look's colours. Rejects if its hairstyle has no art. */
  strip(look: Look): Promise<PaintedStrip> {
    const id = lookId(look);
    let painted = this.strips.get(id);
    if (!painted) {
      painted = this.manifest().then(async manifest => {
        const found = lookStyle(manifest, look);
        if (!found) throw new Error(`No staff art for hairstyle ${look.hairStyle}`);
        const { strip, mask } = await this.source(found.name);
        const pixels = paintStaff(strip.data, mask.data, strip.width, strip.height, keyColours(found.style), lookColours(look));
        return { canvas: toCanvas(pixels, strip.width, strip.height), frameWidth: found.style.frameWidth, frameHeight: found.style.frameHeight, frames: found.style.frames };
      });
      painted.catch(() => { if (this.strips.get(id) === painted) this.strips.delete(id); });
      this.strips.set(id, painted);
    }
    return painted;
  }

  /** A cook's strip (`cook-chef`, `cook-chef-work`, ...) with this look's skin and hair. Rejects if it has no art. */
  cookStrip(name: string, look: Look): Promise<PaintedStrip> {
    const id = `${name}/${cookId(look)}`;
    let painted = this.strips.get(id);
    if (!painted) {
      painted = this.manifest().then(async manifest => {
        const entry = manifest.cooks?.[name];
        if (!entry) throw new Error(`No staff art for ${name}`);
        const { strip, mask } = await this.source(name);
        // The mask claims nothing for apron and trousers, so their colours are never used.
        const unused: Rgb = [128, 128, 128], colours = lookColours(look);
        const pixels = paintStaff(strip.data, mask.data, strip.width, strip.height,
          { hair: entry.key.hair as unknown as Rgb, skin: entry.key.skin as unknown as Rgb, apron: unused, pants: unused }, { ...colours, apron: unused, pants: unused });
        return { canvas: toCanvas(pixels, strip.width, strip.height), frameWidth: entry.frameWidth, frameHeight: entry.frameHeight, frames: entry.frames };
      });
      painted.catch(() => { if (this.strips.get(id) === painted) this.strips.delete(id); });
      this.strips.set(id, painted);
    }
    return painted;
  }

  /** Forgets a painted strip nobody shows any more. */
  release(look: Look): void { this.strips.delete(lookId(look)); }

  /** Just the front pose in this look's colours, from the one picture that holds every hairstyle's. */
  front(look: Look): Promise<HTMLCanvasElement> {
    const id = lookId(look);
    let painted = this.fronts.get(id);
    if (!painted) {
      painted = this.manifest().then(async manifest => {
        const found = lookStyle(manifest, look);
        if (!found) throw new Error(`No staff art for hairstyle ${look.hairStyle}`);
        const { strip, mask } = await this.source('fronts');
        const { cellWidth, cellHeight, cols, rows } = manifest.fronts, { frameWidth, frameHeight, front } = found.style;
        const x = (front % cols) * cellWidth + Math.floor((cellWidth - frameWidth) / 2), y = Math.floor(front / cols) * cellHeight + cellHeight - frameHeight;
        const cell = cut(strip, x, y, frameWidth, frameHeight), part = new Uint8ClampedArray(frameWidth * frameHeight * 8);
        part.set(cut(mask, x, y, frameWidth, frameHeight));
        part.set(cut(mask, x, rows * cellHeight + y, frameWidth, frameHeight), frameWidth * frameHeight * 4);
        return toCanvas(paintStaff(cell, part, frameWidth, frameHeight, keyColours(found.style), lookColours(look)), frameWidth, frameHeight);
      });
      painted.catch(() => { if (this.fronts.get(id) === painted) this.fronts.delete(id); });
      this.fronts.set(id, painted);
    }
    return painted;
  }
}

let shared: StaffLooks | null = null;
/** The one loader the scene and the page's portraits share. */
export function staffLooks(): StaffLooks {
  return shared ??= new StaffLooks();
}

/** How many painted looks the scene keeps as textures before dropping ones nobody wears. */
const TEXTURE_LIMIT = 24;

/**
 * A scene's textures for staff looks. `texture(look)` answers every frame: the look's own texture
 * once painted, `null` while it is on its way (the scene hides that person for those few frames),
 * and the stand-in if the look has no art.
 */
export class StaffTextures {
  private state = new Map<string, 'loading' | 'ready' | 'missing'>();
  private used = new Map<string, number>();

  constructor(private scene: Phaser.Scene, private walkRate: number, private looks = staffLooks()) {}

  static key(look: Look): string { return `staff/${lookId(look)}`; }

  texture(look: Look, standIn: string): string | null {
    const key = StaffTextures.key(look), state = this.state.get(key);
    this.used.set(key, this.scene.time.now);
    if (state === 'ready') return key;
    if (state === 'missing') return standIn;
    if (!state) {
      this.state.set(key, 'loading');
      this.looks.strip(look).then(strip => {
        if (!this.scene.sys.isActive() && !this.scene.sys.isPaused()) return;
        this.forget(key);
        if (!this.scene.textures.exists(key)) {
          this.scene.textures.addSpriteSheet(key, strip.canvas as unknown as HTMLImageElement, { frameWidth: strip.frameWidth, frameHeight: strip.frameHeight });
        }
        if (!this.scene.anims.exists(`${key}-side`)) {
          this.scene.anims.create({ key: `${key}-side`, frames: this.scene.anims.generateFrameNumbers(key, { frames: [...STAFF_FRAMES.walk] }), frameRate: this.walkRate, repeat: -1 });
        }
        // The texture holds the pixels now.
        this.looks.release(look);
        this.state.set(key, 'ready');
      }).catch(() => { this.state.set(key, 'missing'); });
    }
    return null;
  }

  /**
   * A cook in their look: the name their textures and animations start with (`<name>` and
   * `<name>-work`; `<name>-side`, `-carry`, and `-oven` or `-knead`, as the scene names the
   * unpainted cooks'), `null` while painting, and `kind` itself if the cook has no art to repaint.
   */
  cook(look: Look, kind: CookKind): string | null {
    const key = `staff/${kind}/${cookId(look)}`, state = this.state.get(key);
    if (state === 'ready') return key;
    if (state === 'missing') return kind;
    if (!state) {
      this.state.set(key, 'loading');
      Promise.all([this.looks.cookStrip(kind, look), this.looks.cookStrip(`${kind}-work`, look)]).then(([sheet, work]) => {
        if (!this.scene.sys.isActive() && !this.scene.sys.isPaused()) return;
        const { textures, anims } = this.scene, add = (name: string, strip: PaintedStrip) => {
          if (!textures.exists(name)) textures.addSpriteSheet(name, strip.canvas as unknown as HTMLImageElement, { frameWidth: strip.frameWidth, frameHeight: strip.frameHeight });
        };
        add(key, sheet); add(`${key}-work`, work);
        const frames = (name: string, list: number[]) => anims.generateFrameNumbers(name, { frames: list });
        if (!anims.exists(`${key}-side`)) {
          anims.create({ key: `${key}-side`, frames: frames(key, [...STAFF_FRAMES.walk]), frameRate: this.walkRate, repeat: -1 });
          anims.create({ key: `${key}-carry`, frames: frames(`${key}-work`, [4, 5, 6, 7]), frameRate: this.walkRate, repeat: -1 });
          if (kind === 'cook-chef') anims.create({ key: `${key}-oven`, frames: frames(`${key}-work`, [0, 1, 1, 2]), frameRate: 1.5, repeat: -1 });
          else anims.create({ key: `${key}-knead`, frames: frames(`${key}-work`, [0, 1, 2, 3]), frameRate: 4, repeat: -1 });
        }
        this.state.set(key, 'ready');
      }).catch(() => { this.state.set(key, 'missing'); });
    }
    return null;
  }

  /** Drops the textures of looks nobody has asked for in a while, once there are many. */
  private forget(keep: string): void {
    const ready = [...this.state].filter(([key, state]) => state === 'ready' && !key.startsWith('staff/cook-')).map(([key]) => key);
    if (ready.length < TEXTURE_LIMIT) return;
    const now = this.scene.time.now;
    for (const key of ready) {
      if (key === keep || now - (this.used.get(key) ?? 0) < 10_000) continue;
      this.scene.anims.remove(`${key}-side`);
      this.scene.textures.remove(key);
      this.state.delete(key);
      this.used.delete(key);
    }
  }
}
