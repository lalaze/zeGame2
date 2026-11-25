// As much of Phaser as the floors view's scene asks of it, without a page or a screen: objects that remember where they
// are and which frame they show. Pictures and manifests come from the build the game ships.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Any = any;
const BUILD = join(process.cwd(), 'assets/generated/floor-sample-v1/build');
const read = (f: string) => JSON.parse(readFileSync(join(BUILD, f), 'utf8'));
/** Every file asked for by its address, as the page's server would answer. */
const file = (url: string) => url.replace(/^.*floor-sample-v1\/build\//, '');
interface Frame { name: string; width: number; height: number }
const sheets = read('sheets.json') as Record<string, { frameWidth: number; frameHeight: number; frames: number }>, staff = read('staff/staff.json');

/** A WebP's size, from its header. */
function size(path: string): [number, number] {
  const b = readFileSync(path), kind = b.toString('latin1', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}
const context: Any = new Proxy({}, { get: (_t, k) => (k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'createImageData' ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
  : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });
const canvas = (w = 0, h = 0): Any => ({ width: w, height: h, getContext: () => context });

class Texture {
  constructor(readonly key: string, public width: number, public height: number, private cells: Record<string, Frame> = {}) {}
  get(name: string | number = '__BASE'): Frame { return this.cells[String(name)] ?? { name: String(name), width: this.width, height: this.height }; }
  has(name: string): boolean { return name in this.cells; }
  getSourceImage(): Any { return canvas(this.width, this.height); }
  getContext(): Any { return context; }
  refresh(): void {}
  setSize(w: number, h: number): void { this.width = w; this.height = h; }
}
class Textures {
  private map = new Map<string, Texture>();
  constructor() { this.map.set('__DEFAULT', new Texture('__DEFAULT', 32, 32)); }
  exists = (key: string): boolean => this.map.has(key);
  get = (key: string): Texture => this.map.get(key) ?? this.map.get('__DEFAULT')!;
  getFrame = (key: string, name?: string): Any => { const f = this.get(key).get(name); return { ...f, cutWidth: f.width, cutHeight: f.height, cutX: 0, cutY: 0, source: { image: null } }; };
  put(key: string, w: number, h: number, cells?: Record<string, Frame>): Texture { const t = new Texture(key, w, h, cells); this.map.set(key, t); return t; }
  image(key: string, path: string): void { const [w, h] = size(path); this.put(key, w, h); }
  sheet(key: string, w: number, h: number, frames: number): void { this.put(key, w * frames, h, Object.fromEntries(Array.from({ length: frames }, (_, i) => [String(i), { name: String(i), width: w, height: h }]))); }
  atlas(key: string, data: Any): void { this.put(key, 1024, 1024, Object.fromEntries(Object.entries(data.frames as Record<string, Any>).map(([k, f]) => [k, { name: k, width: f.frame.w, height: f.frame.h }]))); }
  addCanvas = (key: string, c: Any): void => { this.put(key, c.width, c.height); };
  createCanvas = (key: string, w: number, h: number): Texture => this.put(key, w, h);
  addImage = (key: string, image: Any): void => { this.put(key, image.width, image.height); };
  addAtlas = (key: string, _image: Any, data: Any): void => this.atlas(key, data);
  addSpriteSheet = (key: string, c: Any, o: Any): void => this.sheet(key, o.frameWidth, o.frameHeight, Math.round(c.width / o.frameWidth));
  remove = (key: string): void => { this.map.delete(key); };
}

export class GameObject {
  x = 0; y = 0; alpha = 1; visible = true; depth = 0; scaleX = 1; scaleY = 1; rotation = 0; flipX = false; isCropped = false; gone = false; tint = 0xffffff; fillColor = 0xffffff;
  crop: number[] | null = null; originX = .5; originY = .5; text = ''; list: GameObject[] = [];
  texture: Texture; frame: Frame;
  anims: Any;
  constructor(protected scene: Any, x = 0, y = 0, key = '__DEFAULT', frame?: string | number) {
    this.x = x; this.y = y; this.texture = scene.textures.get(key); this.frame = this.texture.get(frame);
    const self = this;
    this.anims = { timeScale: 1, currentAnim: null, isPlaying: false, clock: 0, stop() { this.isPlaying = false; }, pause() { this.isPaused = true; }, resume() { this.isPaused = false; },
      step(dt: number) { if (!this.isPlaying || this.isPaused) return; this.clock += dt * this.timeScale; const a = this.currentAnim; self.setTexture(a.frames[Math.floor(this.clock * a.frameRate) % a.frames.length].key, a.frames[Math.floor(this.clock * a.frameRate) % a.frames.length].frame); } };
  }
  get width(): number { return this.text ? this.text.length * 20 : this.frame.width; }
  get height(): number { return this.text ? 40 : this.frame.height; }
  get displayWidth(): number { return this.width * Math.abs(this.scaleX); }
  get displayHeight(): number { return this.height * Math.abs(this.scaleY); }
  get scale(): number { return this.scaleX; }
  set scale(v: number) { this.scaleX = this.scaleY = v; }
  setOrigin(x: number, y = x): this { this.originX = x; this.originY = y; return this; }
  setDepth(d: number): this { this.depth = d; return this; }
  setAlpha(a: number): this { this.alpha = a; return this; }
  setVisible(v: boolean): this { this.visible = v; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setX(x: number): this { this.x = x; return this; }
  setY(y: number): this { this.y = y; return this; }
  setFlipX(v: boolean): this { this.flipX = v; return this; }
  setScale(x: number, y = x): this { this.scaleX = x; this.scaleY = y; return this; }
  setDisplaySize(w: number, h: number): this { this.scaleX = w / this.width; this.scaleY = h / this.height; return this; }
  setTexture(key: string, frame?: string | number): this { this.texture = this.scene.textures.get(key); this.frame = this.texture.get(frame); return this; }
  setFrame(frame: string | number): this { this.frame = this.texture.get(frame); return this; }
  setCrop(...c: number[]): this { this.crop = c.length ? c : null; this.isCropped = c.length > 0; return this; }
  setTint(t: number): this { this.tint = t; return this; }
  clearTint(): this { return this.setTint(0xffffff); }
  setFillStyle(c: number): this { this.fillColor = c; return this; }
  setBlendMode(): this { return this; }
  setAngle(a: number): this { this.rotation = a * Math.PI / 180; return this; }
  setRotation(a: number): this { this.rotation = a; return this; }
  setText(t: string): this { this.text = t; return this; }
  add(o: GameObject | GameObject[]): this { this.list.push(...[o].flat()); return this; }
  removeAll(): this { this.list = []; return this; }
  play(key: string): this { const a = this.scene.anims.get(key); Object.assign(this.anims, { currentAnim: a, isPlaying: true, isPaused: false, clock: 0 }); this.setTexture(a.frames[0].key, a.frames[0].frame); return this; }
  stop(): this { this.anims.isPlaying = false; return this; }
  destroy(): void { this.gone = true; this.scene.objects.delete(this); }
  getBounds(): Any { const x = this.x - this.originX * this.displayWidth, y = this.y - this.originY * this.displayHeight, w = this.displayWidth, h = this.displayHeight; return { contains: (px: number, py: number) => px >= x && px <= x + w && py >= y && py <= y + h }; }
  // Drawing that leaves nothing to compare.
  clear(): this { return this; } fillStyle(): this { return this; } lineStyle(): this { return this; } fillRoundedRect(): this { return this; } strokeRoundedRect(): this { return this; } fillEllipse(): this { return this; }
  strokeEllipse(): this { return this; } fillCircle(): this { return this; } strokeCircle(): this { return this; } lineBetween(): this { return this; } fillPoints(): this { return this; }
}
class Rectangle extends GameObject {}
const emitter = (): Any => ({ on() {}, once() {}, off() {} });

export class Scene {
  textures = new Textures(); objects = new Set<GameObject>(); game: Any = { canvas: { clientWidth: 412 }, events: emitter(), loop: { delta: 50 } };
  time: Any = { now: 0, delayedCall() {} }; scale: Any = { width: 824, height: 1830 }; events = emitter(); input = emitter();
  sys: Any = { textures: this.textures, settings: { active: true, status: 5 }, isActive: () => true, isPaused: () => false };
  tweens: Any = { add() {} }; private made = new Map<string, Any>(); private json = new Map<string, Any>(); private waiting: (() => void)[] = [];
  cache: Any = { json: { get: (k: string) => this.json.get(k) } };
  anims: Any = { create: (a: Any) => this.made.set(a.key, a), exists: (k: string) => this.made.has(k), get: (k: string) => this.made.get(k), remove: (k: string) => this.made.delete(k), generateFrameNumbers: (key: string, o: Any) => o.frames.map((frame: number) => ({ key, frame })) };
  cameras: Any = { main: { width: 824, height: 1830, zoom: 1, visible: true, centre: 0, setBackgroundColor() {}, setSize(w: number, h: number) { this.width = w; this.height = h; }, setZoom(z: number) { this.zoom = z; }, centerOn(_x: number, y: number) { this.centre = y; },
    get worldView() { const w = this.width / this.zoom, h = this.height / this.zoom; return { x: 836 - w / 2, y: this.centre - h / 2, width: w, height: h, bottom: this.centre + h / 2, centerX: 836, centerY: this.centre }; } } };
  private listeners: Record<string, ((...a: Any[]) => void)[]> = {};
  load: Any = {
    image: (key: string, url: string) => this.waiting.push(() => this.textures.image(key, join(BUILD, file(url)))),
    spritesheet: (key: string, url: string, o: Any) => this.waiting.push(() => this.textures.sheet(key, o.frameWidth, o.frameHeight, Math.round(size(join(BUILD, file(url)))[0] / o.frameWidth))),
    json: (key: string, url: string) => this.waiting.push(() => { const data = read(file(url)); this.json.set(key, data); for (const f of this.listeners[`filecomplete-json-${key}`] ?? []) f(key, 'json', data); }),
    atlas: (key: string, _image: string, url: string) => this.waiting.push(() => this.textures.atlas(key, read(file(url)))),
    on: (e: string, f: (...a: Any[]) => void) => { (this.listeners[e] ??= []).push(f); }, once: (e: string, f: (...a: Any[]) => void) => { (this.listeners[e] ??= []).push(f); }, off: (e: string) => { delete this.listeners[e]; },
    isLoading: () => false, start: () => { /* Files arrive before the next frame. */ },
  };
  /** Everything asked for since the last time is here now. */
  arrive(): void { for (let n = 0; n < 4 && this.waiting.length; n++) for (const f of this.waiting.splice(0)) f(); for (const f of this.listeners.filecomplete ?? []) f(); }
  private keep<T extends GameObject>(o: T): T { this.objects.add(o); return o; }
  add: Any = {
    image: (x: number, y: number, key: string, frame?: string) => this.keep(new GameObject(this, x, y, key, frame)), sprite: (x: number, y: number, key: string, frame?: number) => this.keep(new GameObject(this, x, y, key, frame)),
    tileSprite: (x: number, y: number, _w: number, _h: number, key: string) => this.keep(new GameObject(this, x, y, key)), rectangle: (x: number, y: number, _w: number, _h: number, c: number) => this.keep(Object.assign(new Rectangle(this, x, y), { fillColor: c })),
    graphics: () => this.keep(new GameObject(this)), container: (x: number, y: number, list: GameObject[] = []) => this.keep(Object.assign(new GameObject(this, x, y), { list })), text: (x: number, y: number, text: string) => this.keep(Object.assign(new GameObject(this, x, y), { text })),
  };
  /** One frame of every playing animation. */
  animate(dt: number): void { for (const o of this.objects) o.anims.step(dt); }
}

/** The bits of a page the floors files touch. */
export function installPage(): void {
  const g = globalThis as Any;
  g.window = { location: { search: '', href: 'http://café/' }, addEventListener() {}, devicePixelRatio: 1 };
  g.document = { hidden: false, createElement: (tag: string) => (tag === 'canvas' ? canvas() : { style: {}, append() {} }), querySelector: () => null, getElementById: () => null, baseURI: 'http://café/', body: { classList: { add() {} } } };
  g.localStorage = { getItem: () => null, setItem() {} };
  g.fetch = async (url: string) => { const path = join(BUILD, file(url)); return { ok: existsSync(path), json: async () => JSON.parse(readFileSync(path, 'utf8')) }; };
  g.Image = class { width = 0; height = 0; naturalWidth = 0; naturalHeight = 0; onload?: () => void; set src(url: string) { const path = join(BUILD, file(url)); if (existsSync(path)) { [this.width, this.height] = [this.naturalWidth, this.naturalHeight] = size(path); } queueMicrotask(() => this.onload?.()); } async decode() {} };
  void sheets; void staff;
}
export default {
  Scene, Math: { Linear: (a: number, b: number, t: number) => a + (b - a) * t, Clamp: (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)), Between: (a: number, b: number) => Math.floor((a + b) / 2), Vector2: class { constructor(public x: number, public y: number) {} } },
  GameObjects: { Rectangle, Image: GameObject, Sprite: GameObject, Graphics: GameObject, Text: GameObject }, Core: { Events: { POST_RENDER: 'postrender' } }, Scenes: { Events: { DESTROY: 'destroy' }, CREATING: 4 }, BlendModes: { MULTIPLY: 2, ADD: 1 }, Textures: {}, Scale: { NONE: 0 },
};
