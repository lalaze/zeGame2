import Phaser from 'phaser';
import { menuItems } from '../../game/economy';
import { formatMoney } from '../../game/format';
import { COLS, FLOOR_ROWS, WALL_ROWS, WALL_TOP, CELL, canPlace, cellFree, furnitureDef } from '../../game/furniture';
import { BENCH, BINS, DISH_PIT, PASTRY_FRIDGE, RACK, cookHome, installedEquipment, stationSpot, STATION_SECONDS, type Station } from '../../game/kitchen';
import { CAT_SPOT, MAX_TABLES, PASS, PASS_BELL, PASS_SLOT_W, passSlot, SCENE_W, WINDOWS, areaOrigin, baristaSpot, doorPlantSpots, floorY, passageY, sceneHeight, seatSpot, tablePos } from '../../game/layout';
import { AREA_IDS, activeTableIndices, areaAtX, isAreaOpen, mainTableCount, regionOffset, type AreaId } from '../../game/regions';
import { seated, type Cook, type Customer, type Server, type Sim, type SimEvent, type Walker } from '../../game/sim';
import type { GameState } from '../../game/state';
import { cellRect, floorAnchor, type CafeView, type Ghost } from '../cafe-view';
import { paintCeiling, paintNeon, paintSill, shadow } from '../decor-art';
import { drawText, textWidth } from '../font';
import { GHOST_BAD, GHOST_OK, floorFurnitureBounds, paintFloorFurniture, paintWallFurniture } from '../furniture-art';
import { paintPassageFloor, paintRoomBoundaries } from '../passages';
import { lightingAt, roomAmbient, type Lighting } from '../lighting';
import { BENCH_RISE, BINS_RISE, DISH_PIT_RISE, FRIDGE_RISE, RACK_RISE, paintBench, paintBins, paintDishPit, paintKitchen, paintPastryFridge, paintRack } from '../kitchen-art';
import { paintRegion } from '../region-art';
import { CHAIR_LEFT, CHAIR_RIGHT, RoomPainter, TABLE, TABLE_CX, TABLE_TOP_DY, type CounterCup } from '../room-art';
import { CHAR_H, OUTLINE, catFrames, character, crownSprite, dropSprite, heartSprite, itemIcon, pixelSprite, type CharacterFrames, type Facing } from '../sprites';
import { PIXEL_FONT, PIXEL_FONT_HALO, addPixelFonts } from './pixel-font';
import { baked, canvasKey } from './textures';
import { prepareCanvasMultiply } from './canvas-lighting';

/** Called every frame before the scene is drawn: runs the simulation and the page around it. */
export interface CafeHooks {
  tick(dt: number): void;
  pointerDown(x: number, y: number): void;
  /** The mouse moved over the café (touch doesn't hover). */
  pointerMove(x: number, y: number): void;
}

// Back to front. Everything standing on the floor sorts by where its feet are.
const DEPTH = {
  room: 0,
  cat: 10,
  baristas: 20,
  counter: 30,
  floor: 1000,
  frontWall: 100000,
  /** The time-of-day color grade over each room, and lamp light on top of it. */
  grade: 100000.5,
  glow: 100000.6,
  overlay: 100001,
  particles: 100002,
  floaters: 100003,
  overview: 100005,
  ghost: 100006,
};

/** How often the baked rooms repaint their ambient animation (clouds, neon, lights). */
const ROOM_FPS = 12;
const FLOATER_LIFE = 1.4;
const MAX_FLOATERS = 14;
/** Room around a baked furniture sprite for its shadow and glow. */
const PAD = 20;

const color = (hex: string) => parseInt(hex.slice(1, 7), 16);

const LAMP = '#ffcf7a';

/** A light in a room, in that room's coordinates. */
interface Lamp {
  x: number;
  y: number;
  radius: number;
  color: string;
  strength: number;
}

/** Every light in a room: its ceiling fixtures and built-in lamps, and lamps the player placed. */
function lampsIn(area: AreaId, state: GameState): Lamp[] {
  const lamps: Lamp[] = [];
  const add = (x: number, y: number, radius: number, strength = 1, tint = LAMP) => lamps.push({ x, y, radius, color: tint, strength });
  if (area === 'main') {
    const ceiling = state.decor.equipped.ceiling;
    if (ceiling === 'ceiling_pendants') for (const x of [36, 132, 188, 284]) add(x, 13, 26);
    if (ceiling === 'ceiling_chandelier') add(SCENE_W / 2, 9, 46);
    if (ceiling === 'ceiling_lights') for (let x = 8; x < SCENE_W; x += 32) add(x, 11, 14, 0.8);
    // Kitchen light through the door in the left wall, and the heat lamps over the pass.
    if (state.kitchen) add(6, passageY(), 20, 0.6, '#ffa64a');
    for (const dx of [9, PASS.w - 10]) add(PASS.x + dx, PASS.top + 12, 14, 0.6, '#ffb060');
  } else if (area === 'kitchen') {
    // Tube lights, the strip under the hood, and the deck oven's glow.
    for (const x of [74, 218]) add(x, 12, 44, 0.8, '#fbf6e4');
    for (const x of [182, 236, 290]) add(x, 30, 16, 0.7);
    add(218, 56, 26, 0.6, '#ffa64a');
  } else if (area === 'reading') {
    add(100, floorFurnitureBounds('lamp', 100, floorY(98)).y + 4, 30);
  } else if (area === 'terrace') {
    for (let x = 22; x < SCENE_W; x += 34) add(x, 19 + Math.round(Math.sin((x / SCENE_W) * Math.PI) * 12), 14, 0.9);
  }
  for (const piece of state.decor.placed) {
    const def = furnitureDef(piece.id);
    if (!def || (piece.id !== 'lamp' && piece.id !== 'sconce') || areaAtX(piece.col * CELL) !== area) continue;
    const o = areaOrigin(area);
    if (def.surface === 'wall') {
      const cell = cellRect('wall', piece.col, piece.row, def.w, def.h);
      add(cell.x - o.x + cell.w / 2, cell.y - o.y + 4, 22);
    } else {
      const { cx, foot } = floorAnchor(def, piece.col, piece.row);
      add(cx - o.x, floorFurnitureBounds(piece.id, cx, foot).y - o.y + 4, 30);
    }
  }
  return lamps;
}

/** A pool of lamplight fading out in a few flat steps, so it stays pixel art. */
function paintGlow(ctx: CanvasRenderingContext2D, radius: number, tint: string): void {
  const STEPS = 5;
  ctx.fillStyle = tint;
  for (let y = 0; y < radius * 2; y++) {
    for (let x = 0; x < radius * 2; x++) {
      const d = Math.hypot(x + 0.5 - radius, y + 0.5 - radius) / radius;
      if (d >= 1) continue;
      ctx.globalAlpha = (0.36 * Math.ceil((1 - d) ** 1.6 * STEPS)) / STEPS;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Game objects handed out afresh each frame; ones not used this frame are hidden. */
class Pool<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible> {
  private items: T[] = [];
  private used = 0;

  constructor(private make: () => T) {}

  begin(): void {
    this.used = 0;
  }

  next(): T {
    let item = this.items[this.used];
    if (!item) this.items.push((item = this.make()));
    this.used++;
    item.setVisible(true);
    return item;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].setVisible(false);
  }
}

/** A canvas texture shown as an image, repainted when what it shows changes. */
interface Layer {
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  painter: RoomPainter;
  shown: string;
}

interface Floater {
  /** Where the sale happened, for stacking pop-ups that would overlap. */
  x: number;
  pos: { y: number };
  object: Phaser.GameObjects.Container;
}

export class CafeScene extends Phaser.Scene {
  /** Device pixels per art pixel; the camera zooms by this on top of the view's own zoom. */
  backing = 1;
  private layers = new Map<string, Layer>();
  private images!: Pool<Phaser.GameObjects.Image>;
  private rects!: Pool<Phaser.GameObjects.Rectangle>;
  private emitters!: Record<'sparkle' | 'steam' | 'heart', Phaser.GameObjects.Particles.ParticleEmitter>;
  private floaters: Floater[] = [];
  private bell: HTMLCanvasElement | null = null;
  /** When the bell on the pass last rang, in seconds of game time. */
  private bellRang = -1;
  private canGrade = false;
  private grades = new Map<AreaId, Phaser.GameObjects.Rectangle>();
  private glows!: Pool<Phaser.GameObjects.Image>;
  private overviewFrame!: Phaser.GameObjects.Graphics;
  private ghostCells!: Phaser.GameObjects.Graphics;
  private ghostPiece!: Phaser.GameObjects.Image;
  private ghostBox!: Phaser.GameObjects.Graphics;

  constructor(
    private view: CafeView,
    private sim: Sim,
    private getState: () => GameState,
    private hooks: CafeHooks,
    private onCreate: () => void,
  ) {
    super('cafe');
  }

  create(): void {
    addPixelFonts(this);
    const camera = this.cameras.main;
    camera.setOrigin(0, 0);
    camera.setRoundPixels(true);

    this.images = new Pool(() => this.add.image(0, 0, '__WHITE').setOrigin(0, 0));
    this.rects = new Pool(() => this.add.rectangle(0, 0, 1, 1, 0xffffff).setOrigin(0, 0));

    const fade = (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, (1 - t) * 1.5);
    const sparkle = baked(this.textures, 'fx-sparkle', 5, 5, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 0, 1, 5);
      ctx.fillRect(0, 2, 5, 1);
    });
    const dot = baked(this.textures, 'fx-dot', 1, 1, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1, 1);
    });
    const emitter = (key: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, key, { emitting: false, ...config }).setDepth(DEPTH.particles);
    this.emitters = {
      sparkle: emitter(sparkle, {
        lifespan: 700,
        speedX: { min: -15, max: 15 },
        speedY: { min: -34, max: -14 },
        alpha: { onEmit: () => 1, onUpdate: fade },
        tint: { onEmit: () => 0xfff6c8, onUpdate: (_p, _k, t) => (t < 0.5 ? 0xfff6c8 : 0xffd95a) },
      }),
      steam: emitter(dot, {
        lifespan: 1200,
        speedX: { min: -2, max: 2 },
        speedY: -10,
        alpha: { onEmit: () => 0.8, onUpdate: (_p, _k, t) => Math.min(0.8, 1 - t) },
        // Puffs start as 2x2 and thin out to a single pixel.
        scale: { onEmit: () => 2, onUpdate: (_p, _k, t) => (t < 0.4 ? 2 : 1) },
      }),
      heart: emitter(canvasKey(this.textures, heartSprite()), {
        lifespan: 1300,
        speedX: { min: -6, max: 6 },
        speedY: -18,
        alpha: { onEmit: () => 1, onUpdate: fade },
      }),
    };

    const renderer = this.game.renderer;
    this.canGrade = renderer.type !== Phaser.CANVAS || prepareCanvasMultiply(
      (renderer as Phaser.Renderer.Canvas.CanvasRenderer).blendModes,
      Phaser.BlendModes.MULTIPLY,
    );
    for (const area of AREA_IDS) {
      const grade = this.add.rectangle(0, 0, SCENE_W, 1, 0xffffff).setOrigin(0, 0).setDepth(DEPTH.grade);
      this.grades.set(area, grade.setBlendMode(Phaser.BlendModes.MULTIPLY));
    }
    this.glows = new Pool(() => this.add.image(0, 0, '__WHITE').setDepth(DEPTH.glow).setBlendMode(Phaser.BlendModes.ADD));
    this.overviewFrame = this.add.graphics().setDepth(DEPTH.overview);
    this.ghostCells = this.add.graphics().setDepth(DEPTH.ghost);
    this.ghostPiece = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setDepth(DEPTH.ghost + 0.1).setAlpha(0.8);
    this.ghostBox = this.add.graphics().setDepth(DEPTH.ghost + 0.2);

    const world = (p: Phaser.Input.Pointer) => camera.getWorldPoint(p.x, p.y);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const { x, y } = world(p);
      this.hooks.pointerDown(x, y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      const { x, y } = world(p);
      this.hooks.pointerMove(x, y);
    });
    this.onCreate();
  }

  update(time: number, delta: number): void {
    const dt = Math.min(0.25, Math.max(0, delta / 1000));
    this.hooks.tick(dt);

    const view = this.view;
    const state = this.getState();
    const t = time / 1000;
    // The light (and the wall clock) follow the player's own local time, to the minute.
    const real = new Date();
    const now = new Date(2000, 0, 1, real.getHours(), real.getMinutes());
    const light = lightingAt(real.getHours() + real.getMinutes() / 60);
    const viewX = Math.round(view.viewX);
    const viewY = Math.round(view.viewY);

    const camera = this.cameras.main;
    camera.setZoom(this.backing * view.zoom);
    camera.setScroll(viewX, viewY);

    this.images.begin();
    this.rects.begin();
    this.glows.begin();
    const H = sceneHeight();
    for (const area of AREA_IDS) {
      const o = areaOrigin(area);
      const visible = o.x < viewX + view.viewWidth && o.x + SCENE_W > viewX && o.y < viewY + view.viewHeight && o.y + H > viewY;
      this.drawRoom(area, visible, state, t, now, light);
      this.drawLight(area, visible, state, light);
    }
    this.glows.end();
    this.drawFloorStanding(state, t);
    this.sim.customers.forEach((c, i) => this.drawCustomerOverlay(c, t, DEPTH.overlay + i * 0.001));
    this.images.end();
    this.rects.end();

    this.spawnEffects();
    this.drawOverviewFrame();
    this.drawGhost(state, view.ghost && !view.panning && !view.overview ? view.ghost : null, t, now);
  }

  // ------------------------------------------------------------ helpers

  private image(canvasOrKey: HTMLCanvasElement | string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const key = typeof canvasOrKey === 'string' ? canvasOrKey : canvasKey(this.textures, canvasOrKey);
    const image = this.images.next();
    image.setTexture(key).setPosition(Math.round(x), Math.round(y)).setDepth(depth).setAlpha(1);
    if (image.isCropped) image.setCrop();
    return image;
  }

  private rect(x: number, y: number, w: number, h: number, fill: string, depth: number): void {
    if (w <= 0 || h <= 0) return;
    this.rects.next().setPosition(Math.round(x), Math.round(y)).setSize(Math.round(w), Math.round(h)).setFillStyle(color(fill)).setDepth(depth);
  }

  /** A soft oval floor shadow centered at (cx, y), as decor-art's `shadow` paints it. */
  private shadow(cx: number, y: number, w: number, depth: number, alpha = 0.22): void {
    const half = Math.round(w / 2);
    const key = baked(this.textures, `shadow-${w}-${alpha}`, half * 2, 4, (ctx) => shadow(ctx, half, 2, w, alpha));
    this.image(key, cx - half, y - 2, depth);
  }

  private layer(name: string, depth: number): Layer {
    let layer = this.layers.get(name);
    if (!layer) {
      const texture = this.textures.createCanvas(name, SCENE_W, sceneHeight())!;
      const image = this.add.image(0, 0, name).setOrigin(0, 0).setDepth(depth);
      layer = { texture, image, painter: new RoomPainter(texture.context), shown: '' };
      this.layers.set(name, layer);
    }
    return layer;
  }

  /** Repaints a layer if `signature` (everything it depends on) has changed. */
  private paint(layer: Layer, x: number, y: number, signature: string, paint: (painter: RoomPainter) => void): void {
    layer.image.setPosition(x, y).setVisible(true);
    if (layer.shown === signature) return;
    layer.shown = signature;
    const { texture } = layer;
    const H = sceneHeight();
    if (texture.height !== H) {
      texture.setSize(SCENE_W, H);
      layer.image.setSizeToFrame();
    }
    const ctx = texture.context;
    ctx.clearRect(0, 0, texture.width, texture.height);
    ctx.imageSmoothingEnabled = false;
    paint(layer.painter);
    texture.refresh();
  }

  // ------------------------------------------------------------ rooms

  /**
   * A room is baked into canvas layers: the back (walls, floor, back bar), the counter
   * in the main café, and the front wall along the bottom edge. Rooms out of view
   * keep their last picture rather than repainting.
   */
  private drawRoom(area: AreaId, visible: boolean, state: GameState, t: number, now: Date, light: Lighting): void {
    const o = areaOrigin(area);
    const H = sceneHeight();
    const decor = state.decor.equipped;
    const tick = Math.floor(t * ROOM_FPS);
    const skip = this.view.ghost?.skip ?? -1;
    const placed = state.decor.placed.map((p, i) => (i === skip ? '' : `${p.id}@${p.col},${p.row}`)).join(';');
    const back = this.layer(`room-${area}`, DEPTH.room);
    const front = this.layer(`room-${area}-front`, DEPTH.frontWall);
    if (!visible) {
      back.image.setPosition(o.x, o.y);
      front.image.setPosition(o.x, o.y);
      return;
    }
    if (area === 'main') {
      const backSig = [tick, H, Object.values(decor).join(','), menuItems(state).map((m) => m.id).join(','), state.phase, placed, now.getTime(), this.view.kitchenDoor.toFixed(2)].join('|');
      this.paint(back, o.x, o.y, backSig, (p) => {
        p.kitchenDoor = this.view.kitchenDoor;
        const ctx = p.ctx;
        p.drawWall(decor.wallpaper, t);
        const sill = WINDOWS[0];
        p.drawWindow(sill, light, t, state.phase === 'open');
        for (const win of WINDOWS.slice(1)) p.drawWindow(win, light, t, null);
        paintSill(ctx, decor.sill, sill.x + sill.w - 8, sill.y + sill.h + 1);
        // The neon sign glows in the left window, facing the street.
        paintNeon(ctx, decor.neon, sill.x + sill.w / 2, sill.y + 4, t);
        p.drawMenuBoard(state);
        state.decor.placed.forEach((piece, i) => {
          const def = furnitureDef(piece.id);
          if (def?.surface === 'wall' && piece.col < COLS && i !== skip) paintWallFurniture(ctx, piece.id, piece.col * CELL, WALL_TOP + piece.row * CELL, t, now);
        });
        p.drawFloor(decor.floor, decor.rug, light, H);
        p.drawBackBar(state, decor.counter);
        paintCeiling(ctx, decor.ceiling, SCENE_W, t);
      });
      this.drawCat(t, o);
      this.drawBaristas(state, t, o);
      this.drawPass(t, o);
      const cups: CounterCup[] = [];
      // A finished table order the barista is holding until the pass has room.
      this.sim.baristas.forEach((_, i) => {
        if (this.sim.isHolding(i)) cups.push({ x: baristaSpot(i).x, fill: 1 });
      });
      const counter = this.layer('room-main-counter', DEPTH.counter);
      const shelf = state.phase !== 'prep' ? state.shelf : state.bakePlan;
      const counterSig = [
        decor.counter,
        state.upgrades.machine,
        cups.map((c) => `${c.x}:${Math.ceil(c.fill * 4)}`).join(','),
        cups.length > 0 && Math.floor(t * 4) % 2,
        menuItems(state).map((m) => m.id).join(','),
        JSON.stringify(shelf),
        Math.min(4, 1 + Math.floor(state.today.served / 15)),
      ].join('|');
      this.paint(counter, o.x, o.y, counterSig, (p) => p.drawCounter(state, decor.counter, t, cups));
    } else if (area === 'kitchen') {
      const locked = !isAreaOpen(state, area);
      const installed = installedEquipment(state);
      const active = this.activeStations();
      this.paint(back, o.x, o.y, [tick, H, locked, [...installed].join(','), [...active].join(',')].join('|'), (p) => {
        paintKitchen(p.ctx, H, t, locked, installed, active);
      });
    } else {
      const offset = regionOffset(area);
      const locked = !isAreaOpen(state, area);
      this.paint(back, o.x, o.y, [tick, H, placed, now.getTime(), locked].join('|'), (p) => {
        const ctx = p.ctx;
        paintRegion(ctx, area, H, t, light, locked);
        state.decor.placed.forEach((piece, i) => {
          const def = furnitureDef(piece.id);
          const x = piece.col * CELL;
          if (def?.surface === 'wall' && x >= offset && x < offset + SCENE_W && i !== skip) paintWallFurniture(ctx, piece.id, x - offset, WALL_TOP + piece.row * CELL, t, now);
        });
        paintPassageFloor(ctx, area);
      });
    }

    const wallpaper = area === 'main' ? decor.wallpaper : area === 'reading' ? 'wall_cream' : area === 'kitchen' ? 'wall_dots' : 'wall_mint';
    const door = Math.round(this.view.kitchenDoor * 4) / 4;
    this.paint(front, o.x, o.y, [H, wallpaper, state.regions.join(','), state.kitchen, door].join('|'), (p) => {
      p.drawFrontWall(wallpaper, H, area === 'main' || area === 'greenhouse', area === 'terrace');
      paintRoomBoundaries(p.ctx, area, state, door);
    });
  }

  /**
   * The time of day over a room: its color grade, and warm pools around each light
   * that come up as it gets dark. Locked rooms stay unlit.
   */
  private drawLight(area: AreaId, visible: boolean, state: GameState, light: Lighting): void {
    const o = areaOrigin(area);
    const ambient = roomAmbient(light, area);
    this.grades.get(area)!.setVisible(this.canGrade && ambient !== '#ffffff').setPosition(o.x, o.y).setSize(SCENE_W, sceneHeight()).setFillStyle(color(ambient));
    if (!visible || light.lamps < 0.01 || !isAreaOpen(state, area)) return;
    for (const lamp of lampsIn(area, state)) {
      const key = baked(this.textures, `glow-${lamp.radius}-${lamp.color}`, lamp.radius * 2, lamp.radius * 2, (ctx) => paintGlow(ctx, lamp.radius, lamp.color));
      this.glows.next().setTexture(key).setPosition(o.x + lamp.x, o.y + lamp.y).setAlpha(light.lamps * lamp.strength);
    }
  }

  private drawCat(t: number, o: { x: number; y: number }): void {
    const frames = catFrames();
    let sprite = Math.floor(t / 0.7) % 2 ? frames.swish : frames.idle;
    if (t % 4 < 0.15) sprite = frames.blink;
    if (this.view.catHappy > 0) sprite = frames.happy;
    this.image(sprite, o.x + CAT_SPOT.x - 8, o.y + CAT_SPOT.y - sprite.height + 2, DEPTH.cat);
  }

  private drawBaristas(state: GameState, t: number, o: { x: number; y: number }): void {
    this.sim.baristas.forEach((b, i) => {
      if (i >= 1 + state.upgrades.barista) return;
      const pose = this.sim.baristaPose(i);
      const x = o.x + pose.x;
      const brewing = this.sim.isBrewing(i);
      // The first spot behind the counter is always the owner.
      const frames = i === 0 && state.profile ? character(state.profile.look, 'owner') : character(b.look, 'barista');
      const dir = frames[pose.facing];
      let sprite = dir[0];
      let bob = 0;
      if (pose.walking) sprite = dir[1 + (Math.floor(t * 8) % 2)];
      else if (pose.working) bob = Math.floor(t * 6 + i) % 2;
      else if (!brewing) bob = Math.floor(t * 1.2 + i * 0.7) % 2;
      // Nearer the counter draws in front, but everyone in the bar stays behind it.
      const depth = DEPTH.baristas + pose.y * 0.01 + i * 0.001;
      const top = o.y + pose.y - (CHAR_H - 1);
      this.image(sprite, x - 9, top + bob, depth);
      // Carrying the order forward from the back bar.
      if (brewing && pose.facing === 'down' && pose.walking) this.cup(x - 3, o.y + pose.y - 10, depth + 0.0005);
      if (brewing) {
        const progress = 1 - Math.max(0, b.remaining) / b.total;
        const w = Math.max(1, Math.round(18 * progress));
        const y = top - 5;
        this.rect(x - 10, y, 20, 5, OUTLINE, depth + 0.001);
        this.rect(x - 9, y + 1, 18, 3, '#5a3a2a', depth + 0.002);
        this.rect(x - 9, y + 1, w, 3, '#7fc45e', depth + 0.003);
        this.rect(x - 9, y + 1, w, 1, '#b6e59a', depth + 0.004);
      }
      // "Order up!": calling a server over to the pass.
      if (b.calling > 0) this.image(this.callBubble(), x - 8, top - 25, DEPTH.overlay);
    });
  }

  /** A speech bubble with the service bell in it. */
  private callBubble(): string {
    return baked(this.textures, 'bubble-bell', 17, 15, (ctx) => {
      const r = (x: number, y: number, w: number, h: number, fill: string) => {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
      };
      r(1, 0, 15, 12, OUTLINE);
      r(0, 1, 17, 10, OUTLINE);
      r(1, 1, 15, 10, '#fdf6ec');
      r(7, 12, 3, 1, OUTLINE);
      r(8, 13, 1, 1, OUTLINE);
      r(8, 11, 1, 1, '#fdf6ec');
      ctx.drawImage(this.bellSprite(), 5, 2);
    });
  }

  /** The brass service bell on the pass. */
  private bellSprite(): HTMLCanvasElement {
    return (this.bell ??= pixelSprite(['..k..', '.yYy.', 'yYyyy', 'yyyyy', 'ddddd'], { k: '#7a5a2a', y: '#e7b84a', Y: '#fff3a0', d: '#9a6a2a' }));
  }

  /** Plates waiting on the pass, and its bell, which jiggles when rung. */
  private drawPass(t: number, o: { x: number; y: number }): void {
    this.sim.pass.forEach((plate, i) => {
      const slot = passSlot(i);
      const depth = DEPTH.counter + 0.5 + i * 0.01;
      const dish = baked(this.textures, 'pass-plate', PASS_SLOT_W, 2, (ctx) => {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(0, 1, PASS_SLOT_W, 1);
        ctx.fillStyle = '#fdf6ec';
        ctx.fillRect(1, 0, PASS_SLOT_W - 2, 1);
      });
      // Unoutlined icons, like the menu board's, so three fit side by side.
      const icon = itemIcon(plate.items[0], false);
      this.image(icon, o.x + slot.x + Math.floor((PASS_SLOT_W - icon.width) / 2), o.y + slot.y - 2 - icon.height, depth);
      this.image(dish, o.x + slot.x, o.y + slot.y - 3, depth + 0.001);
    });
    const ringing = t - this.bellRang < 0.6;
    const shake = ringing ? (Math.floor(t * 20) % 2 ? 1 : -1) : 0;
    const bell = this.bellSprite();
    this.image(bell, o.x + PASS_BELL.x - 3 + shake, o.y + PASS_BELL.y - bell.height + 1, DEPTH.counter + 0.6);
  }

  // ------------------------------------------------------------ the floor

  /** Customers, tables, crates and furniture, each sorted by where its feet are. */
  private drawFloorStanding(state: GameState, t: number): void {
    const skip = this.view.ghost?.skip ?? -1;
    for (const c of this.sim.customers) if (!seated(c)) this.drawCustomer(c, DEPTH.floor + c.y);
    for (const server of this.sim.servers) this.drawServer(server, DEPTH.floor + server.y);
    this.sim.cooks.forEach((cook, i) => this.drawCook(cook, i, DEPTH.floor + cook.y));
    this.drawKitchenFloor(state);
    for (const i of activeTableIndices(state)) this.drawTable(i, t, DEPTH.floor + tablePos(i).y + 0.1);
    // Crates on the spot the next expansion will open up.
    const built = mainTableCount(state);
    if (built < MAX_TABLES) {
      const { x, y } = tablePos(built);
      const key = baked(this.textures, 'crates', 44, 32, (ctx) => new RoomPainter(ctx).drawUnbuilt(20, 28));
      this.image(key, x - 20, y - 28, DEPTH.floor + y + 0.2);
    }
    // Furniture the player placed, and the potted figs either side of the front door.
    state.decor.placed.forEach((p, i) => {
      const def = furnitureDef(p.id);
      if (def?.surface !== 'floor' || i === skip) return;
      const { cx, foot } = floorAnchor(def, p.col, p.row);
      this.floorPiece(p.id, cx, foot, DEPTH.floor + foot + 0.3);
    });
    for (const spot of doorPlantSpots()) this.floorPiece('plant_fig', spot.x, spot.y, DEPTH.floor + spot.y + 0.4);
  }

  /**
   * A floor piece baked with its shadow and glow, and where the texture's top-left
   * goes relative to the piece's center and feet.
   */
  private floorTexture(id: string): { key: string; dx: number; dy: number } {
    const b = floorFurnitureBounds(id, 0, 0);
    // An odd-width sprite sits half a pixel left of center, as when painted directly.
    const half = Math.floor(b.w / 2);
    const key = baked(this.textures, `floor-${id}`, b.w + PAD * 2, b.h + PAD * 2, (ctx) => paintFloorFurniture(ctx, id, PAD + half, PAD + b.h - 1));
    return { key, dx: -PAD - half, dy: -PAD - b.h + 1 };
  }

  private floorPiece(id: string, cx: number, foot: number, depth: number): void {
    const { key, dx, dy } = this.floorTexture(id);
    this.image(key, cx + dx, foot + dy, depth);
  }

  /** Which way someone faces: where they're walking, or `standing` when still. */
  private facing(w: Walker, standing: Facing): Facing {
    const dx = w.tx - w.x;
    const dy = w.ty - w.y;
    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    }
    return standing;
  }

  /** Someone on their feet, with their shadow; returns where their feet are and how they're turned. */
  private drawWalker(w: Walker, frames: CharacterFrames, standing: Facing, depth: number) {
    const facing = this.facing(w, standing);
    const walking = w.x !== w.tx || w.y !== w.ty;
    const step = Math.floor(w.stride / 5);
    let idx = 0;
    if (walking) idx = facing === 'left' || facing === 'right' ? step % 2 : [1, 0, 2, 0][step % 4];
    const x = Math.round(w.x);
    const y = Math.round(w.y);
    this.shadow(x, y, 12, depth);
    const bob = walking && idx !== 0 ? 1 : 0;
    this.image(frames[facing][idx], x - 9, y - (CHAR_H - 1) - bob, depth + 0.001);
    return { x, y, bob, facing };
  }

  /** A server, carrying a tray of orders at shoulder height, with a "!" when they answer the bell. */
  private drawServer(server: Server, depth: number): void {
    const { x, y, bob } = this.drawWalker(server, character(server.look, 'server'), 'down', depth);
    if (server.plates.length > 0 && server.phase !== 'toPass') {
      const tray = baked(this.textures, 'tray', 22, 3, (ctx) => {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(0, 0, 22, 3);
        ctx.fillStyle = '#d6dde2';
        ctx.fillRect(1, 1, 20, 1);
      });
      const ty = y - 17 - bob;
      const n = server.plates.length;
      server.plates.forEach((plate, i) => {
        const icon = itemIcon(plate.items[0], false);
        const cx = x + Math.round((i - (n - 1) / 2) * 7);
        this.image(icon, cx - Math.floor(icon.width / 2), ty - icon.height, depth + 0.002 + i * 0.0001);
      });
      this.image(tray, x - 11, ty, depth + 0.003);
    }
    if (server.ack > 0) {
      const ack = baked(this.textures, 'bubble-ack', 7, 10, (ctx) => {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(0, 0, 7, 9);
        ctx.fillStyle = '#fdf6ec';
        ctx.fillRect(1, 1, 5, 7);
        ctx.fillStyle = '#d9384a';
        ctx.fillRect(3, 2, 1, 3);
        ctx.fillRect(3, 6, 1, 1);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(3, 9, 1, 1);
      });
      this.image(ack, x - 3, y - CHAR_H - 11, DEPTH.overlay);
    }
  }

  // ------------------------------------------------------------ the kitchen

  /** Stations with a cook working at them right now. */
  private activeStations(): Set<Station> {
    const active = new Set<Station>();
    this.sim.cooks.forEach((_, i) => {
      const at = this.sim.cookStation(i);
      if (at?.working) active.add(at.station);
    });
    return active;
  }

  /** The pieces standing out on the kitchen floor, sorted with the cooks by their feet. */
  private drawKitchenFloor(state: GameState): void {
    // Until it's built, the kitchen is only chalked out on the floor.
    if (!state.kitchen) return;
    const o = areaOrigin('kitchen');
    const installed = installedEquipment(state);
    const piece = (name: string, x: number, foot: number, w: number, rise: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
      const key = baked(this.textures, `kitchen-${name}`, w + 20, rise + 1, paint);
      this.image(key, o.x + x - 10, o.y + foot - rise, DEPTH.floor + o.y + foot);
    };
    const benchFoot = floorY(BENCH.front);
    const tools = `${installed.has('sheeter')}-${installed.has('standMixer')}`;
    piece(`bench-${tools}`, BENCH.x, benchFoot, BENCH.w, BENCH_RISE, (ctx) =>
      paintBench(ctx, 10 + BENCH.w / 2, BENCH_RISE, installed.has('sheeter'), installed.has('standMixer')));
    const rack = this.sim.rack;
    piece(`rack-${rack.join(',')}`, RACK.x, floorY(RACK.foot), RACK.w, RACK_RISE, (ctx) => paintRack(ctx, 10, RACK_RISE, rack));
    piece('bins', BINS.x, floorY(BINS.foot), BINS.w, BINS_RISE, (ctx) => paintBins(ctx, 10, BINS_RISE));
    piece('dishpit', DISH_PIT.x, floorY(DISH_PIT.foot), DISH_PIT.w + 10, DISH_PIT_RISE, (ctx) => paintDishPit(ctx, 10, DISH_PIT_RISE));
    if (installed.has('pastryFridge')) {
      const cakes = (['cheesecake', 'cake', 'eggtart'] as const).filter((id) => state.items[id] > 0);
      piece(`fridge-${cakes.join(',')}`, PASTRY_FRIDGE.x, floorY(PASTRY_FRIDGE.foot), PASTRY_FRIDGE.w, FRIDGE_RISE, (ctx) =>
        paintPastryFridge(ctx, 10, FRIDGE_RISE, cakes));
    }
  }

  /**
   * A cook: at their station, facing it, with a bar showing how long it has left
   * there; carrying the batch between stations, dough before the oven and the
   * finished bake after it.
   */
  private drawCook(cook: Cook, i: number, depth: number): void {
    const at = this.sim.cookStation(i);
    const standing = at ? stationSpot(at.station).facing : cookHome(i).facing;
    const { x, y, bob, facing } = this.drawWalker(cook, character(cook.look, 'cook'), standing, depth);
    const batch = cook.batch;
    if (!batch || !at) return;
    if (at.working) {
      const total = STATION_SECONDS[at.station];
      const w = Math.max(1, Math.round(18 * (1 - Math.max(0, batch.timer) / total)));
      // The same bar the baristas show while brewing.
      const by = y - CHAR_H - 6;
      this.rect(x - 10, by, 20, 5, OUTLINE, DEPTH.overlay);
      this.rect(x - 9, by + 1, 18, 3, '#5a3a2a', DEPTH.overlay + 0.001);
      this.rect(x - 9, by + 1, w, 3, '#7fc45e', DEPTH.overlay + 0.002);
      this.rect(x - 9, by + 1, w, 1, '#b6e59a', DEPTH.overlay + 0.003);
      return;
    }
    if (facing === 'up') return;
    // Out of the oven once a hot station is behind them.
    const baked = batch.steps.slice(0, batch.step).some((s) => s === 'deckOven' || s === 'convection' || s === 'fryer');
    const tray = baked ? itemIcon(batch.item, false) : null;
    const ty = y - 17 - bob;
    this.rect(x - 7, ty, 14, 2, OUTLINE, depth + 0.003);
    this.rect(x - 6, ty, 12, 1, '#d7a35a', depth + 0.004);
    if (tray) this.image(tray, x - Math.floor(tray.width / 2), ty - tray.height + 1, depth + 0.002);
    else {
      this.rect(x - 5, ty - 3, 10, 3, OUTLINE, depth + 0.002);
      this.rect(x - 4, ty - 2, 8, 2, '#f1e3c4', depth + 0.0025);
    }
  }

  private cup(x: number, y: number, depth: number): void {
    const key = baked(this.textures, 'cup', 5, 5, (ctx) => {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, 5, 5);
      ctx.fillStyle = '#fdf6ec';
      ctx.fillRect(1, 1, 3, 3);
      ctx.fillStyle = '#c48a55';
      ctx.fillRect(1, 1, 3, 1);
    });
    this.image(key, x, y, depth);
  }

  private drawCustomer(c: Customer, depth: number): void {
    const standing = c.phase === 'queue' || c.phase === 'ordering' ? 'up' : 'down';
    const { x, y, bob, facing } = this.drawWalker(c, character(c.look), standing, depth);
    if (c.hasCup && facing !== 'up') this.cup(facing === 'left' ? x - 8 : x + 4, y - 10 - bob, depth + 0.002);
  }

  /** A round table with its two chairs, anyone sitting at it, and their drinks. */
  private drawTable(index: number, t: number, depth: number): void {
    const table = tablePos(index);
    let d = depth;
    const next = () => (d += 0.001);
    this.shadow(table.x, table.y, 30, next(), 0.2);
    const diners = ([0, 1] as const).map((side) => {
      const id = this.sim.seats[index * 2 + side];
      const c = id != null ? this.sim.customers.find((cc) => cc.id === id) : undefined;
      return c && seated(c) ? c : undefined;
    });
    const sitter = (side: 0 | 1, c: Customer) => {
      const s = seatSpot(index, side);
      const frames = character(c.look);
      const bob = Math.floor(t * 1.1 + c.id) % 3 === 0 ? 1 : 0;
      return { sprite: side === 0 ? frames.sitRight : frames.sitLeft, x: s.x - 9, y: s.y - (CHAR_H + 5) + bob };
    };
    // Chairs (backs on the outside) and anyone sitting in them.
    for (const side of [0, 1] as const) {
      const s = seatSpot(index, side);
      this.shadow(s.x, s.y, 14, next(), 0.15);
      const chair = side === 0 ? CHAIR_RIGHT() : CHAIR_LEFT();
      this.image(chair, side === 0 ? s.x - 9 : s.x - chair.width + 9, s.y - chair.height + 1, next());
      const c = diners[side];
      if (c) {
        const { sprite, x, y } = sitter(side, c);
        this.image(sprite, x, y, next());
      }
    }
    const top = TABLE();
    this.image(top, table.x - TABLE_CX, table.y - top.height + 1, next());
    const cy = table.y - TABLE_TOP_DY;
    // A bud vase in the middle.
    const bloom = ['#ef5d7a', '#f2c14e', '#ffffff', '#9f78d2'][index % 4];
    const vase = baked(this.textures, `vase-${bloom}`, 5, 14, (ctx) => {
      const r = (x: number, y: number, w: number, h: number, fill: string) => {
        ctx.fillStyle = fill;
        ctx.fillRect(x + 2, y + 13, w, h);
      };
      r(-2, -7, 4, 5, OUTLINE);
      r(-1, -6, 2, 4, '#cfe6ea');
      r(0, -10, 1, 4, '#4e8a4f');
      r(-1, -12, 3, 2, bloom);
      r(0, -13, 1, 1, bloom);
      r(1, -9, 1, 1, '#6fb26a');
    });
    this.image(vase, table.x - 2, cy - 13, next());
    // Seated customers lean over the table: their upper body goes on top again.
    for (const side of [0, 1] as const) {
      const c = diners[side];
      if (!c) continue;
      const { sprite, x, y } = sitter(side, c);
      this.image(sprite, x, y, next()).setCrop(0, 0, sprite.width, CHAR_H - 8);
    }
    // Their order once it's arrived; until then, the table number for the server to find.
    for (const side of [0, 1] as const) {
      const c = diners[side];
      if (c?.phase === 'sitting') this.cup(table.x + (side === 0 ? -9 : 4), cy - 5, next());
      else if (c) this.image(this.tableTent(index + 1), table.x + (side === 0 ? -11 : 3), cy - 7, next());
    }
  }

  /** A little folded card with the table's number on it. */
  private tableTent(n: number): string {
    const text = String(n);
    const w = textWidth(text) + 4;
    return baked(this.textures, `tent-${n}`, w, 7, (ctx) => {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, w, 7);
      ctx.fillStyle = '#fdf6ec';
      ctx.fillRect(1, 1, w - 2, 5);
      drawText(ctx, text, 2, 1, '#3f5f93');
    });
  }

  // ------------------------------------------------------------ above the room

  private drawCustomerOverlay(c: Customer, t: number, depth: number): void {
    const x = Math.round(c.x);
    let top = Math.round(c.y) - CHAR_H;
    if (seated(c)) top = seatSpot(Math.floor(c.seat / 2), (c.seat % 2) as 0 | 1).y - CHAR_H - 5;
    if (c.vip) this.image(crownSprite(), x - 4, top - 5, depth);
    if (c.phase === 'ordering') {
      const icons = [itemIcon(c.order), ...(c.extra ? [itemIcon(c.extra)] : [])];
      const bw = icons.length > 1 ? 34 : 20;
      const bh = 18;
      const bx = x - Math.floor(bw / 2);
      const by = top - bh - (c.vip ? 6 : 2);
      const bubble = baked(this.textures, `bubble-${bw}`, bw + 2, bh + 4, (ctx) => {
        const r = (rx: number, ry: number, w: number, h: number, fill: string) => {
          ctx.fillStyle = fill;
          ctx.fillRect(rx + 1, ry + 1, w, h);
        };
        const tail = Math.floor(bw / 2);
        r(-1, 0, bw + 2, bh, OUTLINE);
        r(0, -1, bw, bh + 2, OUTLINE);
        r(0, 0, bw, bh, '#fdf6ec');
        r(0, bh - 2, bw, 2, '#e9dcc8');
        r(tail - 2, bh + 1, 5, 1, OUTLINE);
        r(tail - 1, bh, 3, 1, '#e9dcc8');
        r(tail - 1, bh + 1, 3, 1, '#fdf6ec');
        r(tail, bh + 2, 1, 1, OUTLINE);
      });
      this.image(bubble, bx - 1, by - 1, depth + 0.0001);
      icons.forEach((icon, i) => {
        const slot = bw / icons.length;
        this.image(icon, bx + Math.floor(slot * i + (slot - icon.width) / 2), by + Math.floor((bh - icon.height) / 2), depth + 0.0002);
      });
    } else if (c.soldOut && c.moodTimer > 0) {
      // "Sorry, we're out": the order with a red cross over it.
      const icon = itemIcon(c.order);
      const bx = x - 10;
      const by = top - 20;
      const frame = baked(this.textures, 'bubble-out', 22, 20, (ctx) => {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(0, 0, 22, 20);
        ctx.fillStyle = '#fdf6ec';
        ctx.fillRect(1, 1, 20, 18);
      });
      const cross = baked(this.textures, 'bubble-cross', 20, 18, (ctx) => {
        ctx.fillStyle = '#d9384a';
        for (let i = 0; i < 12; i++) {
          ctx.fillRect(4 + i, 3 + i, 2, 1);
          ctx.fillRect(15 - i, 3 + i, 2, 1);
        }
      });
      this.image(frame, bx - 1, by - 1, depth + 0.0001);
      this.image(icon, bx + Math.floor((20 - icon.width) / 2), by + Math.floor((18 - icon.height) / 2), depth + 0.0002).setAlpha(0.5);
      this.image(cross, bx, by, depth + 0.0003);
    } else if (c.mood === 'happy') {
      const lift = Math.round((1.5 - c.moodTimer) * 5);
      this.image(heartSprite(), x - 4, top - 10 - lift, depth + 0.0001);
    } else if (c.mood === 'sad') {
      this.image(dropSprite(), x + 5, top + 2, depth + 0.0001);
    } else if (((c.phase === 'queue' && c.patience < 12) || (c.phase === 'waiting' && c.timer < 15)) && Math.floor(t * 2) % 2 === 0) {
      for (let i = 0; i < 3; i++) this.rect(x - 4 + i * 4, top - 4, 2, 2, OUTLINE, depth + 0.0001);
    }
  }

  private spawnEffects(): void {
    for (const e of this.view.effects.splice(0)) {
      if (e.kind !== 'bell') this.emitters[e.kind].emitParticleAt(e.x, e.y, 1);
      else {
        // Ding: the bell jiggles and throws off a few sparkles.
        this.bellRang = this.time.now / 1000;
        for (let i = 0; i < 3; i++) this.emitters.sparkle.emitParticleAt(e.x - 2 + Math.random() * 4, e.y - 6, 1);
      }
    }
    for (const sale of this.view.sales.splice(0)) this.addFloater(sale);
  }

  /** "+$12" rising from a sale and fading out. */
  private addFloater(e: Extract<SimEvent, { type: 'sale' }>): void {
    // Stack pop-ups that would land on top of a fresh one.
    let y = e.y;
    while (this.floaters.some((f) => Math.abs(f.x - e.x) < 28 && Math.abs(f.pos.y - y) < 8)) y -= 8;
    const text = '+' + formatMoney(e.amount);
    const w = textWidth(text);
    const view = this.view;
    const x = Math.min(view.viewX + view.viewWidth - w - 2, Math.max(view.viewX + 2, e.x - w / 2));
    const object = this.add
      .container(Math.round(x), y, [
        this.add.bitmapText(0, 0, PIXEL_FONT_HALO, text).setTint(color(OUTLINE)),
        this.add.bitmapText(0, 0, PIXEL_FONT, text).setTint(color(e.vip ? '#ff9fcb' : '#ffd95a')),
      ])
      .setDepth(DEPTH.floaters);
    const floater: Floater = { x: e.x, pos: { y }, object };
    this.floaters.push(floater);
    this.tweens.add({
      targets: floater.pos,
      y: y - 16 * FLOATER_LIFE,
      duration: FLOATER_LIFE * 1000,
      onUpdate: () => object.setY(Math.round(floater.pos.y)),
      onComplete: () => this.removeFloater(floater),
    });
    this.tweens.add({ targets: object, alpha: 0, delay: (FLOATER_LIFE - 0.4) * 1000, duration: 400 });
    if (this.floaters.length > MAX_FLOATERS) this.removeFloater(this.floaters[0]);
    if (e.vip) for (let i = 0; i < 8; i++) this.view.sparkle(e.x + (Math.random() - 0.5) * 24, e.y + Math.random() * 14);
  }

  private removeFloater(floater: Floater): void {
    const i = this.floaters.indexOf(floater);
    if (i < 0) return;
    this.floaters.splice(i, 1);
    this.tweens.killTweensOf([floater.pos, floater.object]);
    floater.object.destroy();
  }

  /** Corner brackets around the chosen room on the floor plan. */
  private drawOverviewFrame(): void {
    const g = this.overviewFrame.clear();
    if (!this.view.overview) return;
    const o = areaOrigin(this.view.area);
    const H = sceneHeight();
    g.lineStyle(3, color('#f5ce7d'));
    for (const [x, y, dx, dy] of [[o.x + 7, o.y + 7, 1, 1], [o.x + SCENE_W - 7, o.y + 7, -1, 1], [o.x + 7, o.y + H - 7, 1, -1], [o.x + SCENE_W - 7, o.y + H - 7, -1, -1]]) {
      g.beginPath();
      g.moveTo(x + dx * 16, y);
      g.lineTo(x, y);
      g.lineTo(x, y + dy * 16);
      g.strokePath();
    }
  }

  /** The piece being placed: free cells stand out, and its footprint shows green if it fits, red if not. */
  private drawGhost(state: GameState, ghost: Ghost | null, t: number, now: Date): void {
    const cells = this.ghostCells.clear();
    const box = this.ghostBox.clear();
    const def = ghost && furnitureDef(ghost.id);
    this.ghostPiece.setVisible(!!def);
    if (!ghost || !def) return;
    const tables = mainTableCount(state);
    cells.fillStyle(color('#2a1410'), 0.3);
    const rows = def.surface === 'wall' ? WALL_ROWS : FLOOR_ROWS;
    const start = regionOffset(this.view.area) / CELL;
    for (let row = 0; row < rows; row++) {
      for (let col = start; col < start + COLS; col++) {
        if (cellFree(state, def.surface, col, row, tables, ghost.skip)) continue;
        const cell = cellRect(def.surface, col, row, 1, 1);
        cells.fillRect(cell.x, cell.y, cell.w, cell.h);
      }
    }
    const rect = cellRect(def.surface, ghost.col, ghost.row, def.w, def.h);
    if (def.surface === 'wall') {
      // Wall pieces are repainted while held so a clock keeps time.
      const key = `ghost-wall-${ghost.id}`;
      const w = def.w * CELL + PAD * 2;
      const h = def.h * CELL + PAD * 2;
      const texture = (this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, w, h)) as Phaser.Textures.CanvasTexture;
      texture.context.clearRect(0, 0, w, h);
      paintWallFurniture(texture.context, ghost.id, PAD, PAD, t, now);
      texture.refresh();
      this.ghostPiece.setTexture(key).setPosition(rect.x - PAD, rect.y - PAD);
    } else {
      const { cx, foot } = floorAnchor(def, ghost.col, ghost.row);
      const { key, dx, dy } = this.floorTexture(ghost.id);
      this.ghostPiece.setTexture(key).setPosition(cx + dx, foot + dy);
    }
    const fill = color(canPlace(state, ghost.id, ghost.col, ghost.row, tables, ghost.skip) ? GHOST_OK : GHOST_BAD);
    box.fillStyle(fill, 0.3 + Math.sin(t * 6) * 0.08);
    box.fillRect(rect.x, rect.y, rect.w, rect.h);
    box.fillStyle(fill, 1);
    box.fillRect(rect.x, rect.y, rect.w, 1);
    box.fillRect(rect.x, rect.y + rect.h - 1, rect.w, 1);
    box.fillRect(rect.x, rect.y, 1, rect.h);
    box.fillRect(rect.x + rect.w - 1, rect.y, 1, rect.h);
  }
}
