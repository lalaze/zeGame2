import { remapTextile } from '../textile-styles';
import { centerpieceSprite } from '../table-centerpiece-art';
import { loadSignFonts, signFontRevision } from '../sign-lettering';
import { insideRoomFrame } from '../viewport-frame';
import { mainKeyLight, mainShadowState, paintContactShade, paintCastShade, mainSurfaceLight, mainLitSprite } from '../main-room-lighting';
import { COZY_DECOR_CATALOG } from '../cozy-materials';
import { preloadCozyCats, createCozyCatArt } from '../cozy-cat-assets';
import cozyEnvironmentMetadata from '../cozy-environment-metadata.json';
import { COZY_FURNITURE_CATALOG } from '../cozy-furniture-assets';
import { SEATING_LAYOUT, seatingFurniture, seatingGeometry } from '../cozy-seating-art';
import { cozySeatedGeometry } from '../cozy-character-art';
import { cozyCafeSprite } from '../cozy-cafe-art';
import { createGeneratedSignatureArt, setGeneratedSignatureAdapter, GENERATED_SIGNATURE_IDS, generatedSignatureKey } from '../generated-signature-art';
import { releaseGeneratedStaticSources } from '../generated-static-sources';
import { createGeneratedServerArt, GENERATED_SERVER_FRAME_IDS, type GeneratedServerAdapter, type GeneratedServerManifest } from '../generated-server-art';
import { setGeneratedServerAdapter } from '../generated-main-art';
import { createGeneratedMainEnvironmentArt, GENERATED_MAIN_ENVIRONMENT_IDS, generatedMainEnvironmentKey } from '../generated-main-environment-art';
import { createGeneratedTablewareArt, GENERATED_TABLEWARE_IDS, generatedTablewareKey } from '../generated-tableware-art';
import { setGeneratedMainEnvironmentAdapter, setGeneratedTablewareAdapter, getGeneratedTablewareAdapter } from '../generated-main-art';
import runtimeCatalog from '../../../assets/generated/runtime-catalog-v1/runtime.json';
import { createGeneratedFurnitureArt, GENERATED_FURNITURE_IDS, generatedFurnitureKey } from '../generated-furniture-art';
import { createGeneratedDecorArt, GENERATED_DECOR_SOURCE_IDS } from '../generated-decor-art';
import { createGeneratedIngredientArt, GENERATED_INGREDIENT_IDS } from '../generated-ingredient-art';
import { UI_ART, paintThoughtFrame, paintOrderFrame, paintSoldOutFrame, paintSoldOutCross, paintCallBubble, paintAckBubble } from '../ui-art';
import { paintServiceCup, paintServiceTray, paintTableTent } from '../service-props-art';
import { styleStationMultiplier } from '../../game/styles';
import { petActive } from '../../game/pets';
import type { LivingCatActor } from '../../game/living-cats';
import { residentCatFlipX } from '../living-cat-pose';
import Phaser from 'phaser';
import { getLocale, t as translate } from '../../i18n';
import { thoughtCandidates } from '../thoughts';
import { thoughtTextRaster, thoughtTextWidth, wrapThoughtText } from '../thought-text';
import { extensionTable, remapTablecloth } from '../extension-table-art';
import { extensionLampPool } from '../extension-surfaces';
import { ThoughtBubbles, placeThought, thoughtBubbleWidth, type ThoughtRect } from '../thought-bubbles';
import { menuItems } from '../../game/economy';
import { formatMoney } from '../../game/format';
import { COLS, FLOOR_ROWS, WALL_ROWS, WALL_TOP, CELL, canPlace, cellFree, furnitureDef } from '../../game/furniture';
import { BENCH, BINS, DISH_PIT, PASTRY_FRIDGE, RACK, cookHome, installedEquipment, stationSpot, STATION_SECONDS, type Station } from '../../game/kitchen';
import { CAT_SPOTS, MAX_TABLES, PASS, PASS_BELL, PASS_SLOT_W, passSlot, SCENE_W, WINDOWS, areaOrigin, areaBounds, kitchenFloorY, doorwayY, baristaSpot, doorPlantSpots, floorY, sceneHeight, seatApproach, seatSpot, tableArea, tablePos } from '../../game/layout';
import { AREA_IDS, activeTableIndices, areaAtX, isAreaOpen, mainTableCount, regionOffset, type AreaId } from '../../game/regions';
import { seated, type Cook, type Customer, type Server, type Sim, type SimEvent, type Walker } from '../../game/sim';
import type { GameState } from '../../game/state';
import { cellRect, floorAnchor, type CafeView, type Ghost } from '../cafe-view';
import { paintCeiling, paintNeon, shadow } from '../decor-art';
import { drawText, textWidth } from '../font';
import { GHOST_BAD, GHOST_OK, floorFurnitureBounds, paintFloorFurniture, paintWallFurniture } from '../furniture-art';
import { paintPassageFloor, paintRoomBoundaries } from '../passages';
import { lightingAt, roomAmbient, type Lighting } from '../lighting';
import { previewLightDate } from '../preview-light';
import { BENCH_RISE, BINS_RISE, DISH_PIT_RISE, FRIDGE_RISE, RACK_RISE, paintBench, paintBins, paintDishPit, paintKitchen, paintPastryFridge, paintRack } from '../kitchen-art';
import { paintRegion } from '../region-art';
import { CHAIR_LEFT, CHAIR_RIGHT, RoomPainter, TABLE, TABLE_CX, TABLE_TOP_DY, type CounterCup } from '../room-art';
import { CHAR_H, OUTLINE, catFrames, character, crownSprite, dropSprite, heartSprite, itemIcon, pixelSprite, type CharacterFrames, type Facing } from '../sprites';
import { PIXEL_FONT, PIXEL_FONT_HALO, PIXEL_FONT_VIP, addPixelFonts } from './pixel-font';
import { baked, canvasKey } from './textures';
import { type FineSpriteArt } from '../fine-sprite-art';
import { WORLD_ART_DENSITY, gridSafeContext, resampleImage, worldCrop, worldSpriteArt } from '../world-art-grid';
import { PreviewMetrics } from '../preview-metrics';
import { paintFinePottedPlant } from '../fine-plant-art';
import { GENERATED_MAIN_ASSETS, clearGeneratedMainAssets, generatedMainKey, generatedMainSource, installGeneratedMainAsset, setGeneratedStaffAdapter, setGeneratedCustomerAdapter, setGeneratedCatAdapter, setGeneratedFoodAdapter, setGeneratedIngredientAdapter, setGeneratedFurnitureAdapter, setGeneratedDecorAdapter, getGeneratedFurnitureAdapter, type GeneratedMainId } from '../generated-main-art';
import { createGeneratedStaffArt, GENERATED_STAFF_FRAME_IDS, type GeneratedStaffAdapter, type GeneratedStaffManifest } from '../generated-staff-art';
import { releaseGeneratedCharacterSources } from '../generated-character-sources';
import { createGeneratedCatArt, GENERATED_CAT_FRAME_IDS, type GeneratedCatAdapter, type GeneratedCatManifest } from '../generated-cat-art';
import { createGeneratedFoodArt, GENERATED_FOOD_IDS } from '../generated-food-art';
import { createGeneratedCustomerArt, GENERATED_CUSTOMER_FRAME_IDS, type GeneratedCustomerAdapter, type GeneratedCustomerManifest } from '../generated-customer-art';
import { dustMotes, roomDepth } from '../materials';
import { prepareCanvasMultiply } from './canvas-lighting';
import { bindCanvasTaps, type CanvasTaps } from './canvas-taps';
import { MAIN_COUNTER_PLANE, MAIN_WALL_PLANE, unprojectMainWorld, projectMainCellOutline, projectMainAttachment, projectMainPlaneWorld, projectMainWorld } from '../main-pixel-presentation';
import type { PixelPoint } from '../pixel-projection';
import { placementMaskKey } from '../placement-mask-cache';
import { STANDING_CHARACTER_SCALE, STANDING_LEG_EXTENSION, preloadReferenceCharacters, referenceCharacterContacts, referenceCharacterOffset } from '../reference-character-art';

/** Called every frame before the scene is drawn: runs the simulation and the page around it. */
export interface CafeHooks {
  tick(dt: number): void;
  /** A completed tap or click; never the initial pointer press. */
  pointerDown(x: number, y: number): void;
  /** The mouse moved over the café (touch doesn't hover). */
  pointerMove(x: number, y: number): void;
  /** Changes when the page enters, changes or leaves its furniture interaction. */
  interactionState?(): unknown;
  /** Live page guard; pause state alone may be one animation frame behind. */
  interactionEnabled?(): boolean;
  /** Decoded images ready for texture installation, not just downloaded bytes. */
  loadingProgress?(loaded: number, total: number): void;
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
  const add = (x: number, y: number, radius: number, strength = 1, tint = LAMP, anchor?: PixelPoint, plane = MAIN_WALL_PLANE) => {
    const point = area !== 'main' ? { x, y } : anchor ? projectMainAttachment({ x, y }, anchor) : projectMainPlaneWorld({ x, y }, plane);
    lamps.push({ ...point, radius, color: tint, strength });
  };
  if (area === 'main') {
    // Existing permanent wall lanterns must illuminate their actual positions.
    add(80.5, 21, 26, .55); add(223.5, 19, 26, .55);
    const ceiling = state.decor.equipped.ceiling;
    if (ceiling === 'ceiling_pendants') for (const x of [36, 132, 188, 284]) add(x, 13, 26);
    if (ceiling === 'ceiling_chandelier') add(SCENE_W / 2, 9, 46);
    if (ceiling === 'ceiling_lights') for (let x = 8; x < SCENE_W; x += 32) add(x, 11, 14, 0.8);
    // Kitchen light through the door in the left wall, and the heat lamps over the pass.
    if (state.kitchen) add(6, doorwayY('main', 'left'), 20, 0.6, '#ffa64a', { x: 6, y: doorwayY('main', 'left') });
    for (const dx of [9, PASS.w - 10]) add(PASS.x + dx, PASS.top + 12, 14, 0.6, '#ffb060', undefined, MAIN_COUNTER_PLANE);
  } else if (area === 'kitchen') {
    // Tube lights, the strip under the hood, and the deck oven's glow.
    for (const x of [74, 218]) add(x, 12, 44, 0.8, '#fbf6e4');
    for (const x of [182, 236, 290]) add(x, 30, 16, 0.7);
    add(218, 56, 26, 0.6, '#ffa64a');
  } else if (area === 'reading') {
    add(100, floorY(98) - 27, 30);
  } else if (area === 'terrace') {
    for (let x = 22; x < SCENE_W; x += 34) add(x, 19 + Math.round(Math.sin((x / SCENE_W) * Math.PI) * 12), 14, 0.9);
  }
  for (const piece of state.decor.placed) {
    const def = furnitureDef(piece.id);
    if (!def || (piece.id !== 'lamp' && piece.id !== 'sconce' && piece.id !== 'lantern') || areaAtX(piece.col * CELL) !== area) continue;
    const o = areaOrigin(area);
    if (def.surface === 'wall') {
      const cell = cellRect('wall', piece.col, piece.row, def.w, def.h);
      add(cell.x - o.x + cell.w / 2, cell.y - o.y + 4, 22);
    } else {
      const { cx, foot } = floorAnchor(def, piece.col, piece.row);
      const bounds = floorFurnitureBounds(piece.id, cx, foot), wick = getGeneratedFurnitureAdapter()?.overlay(piece.id)?.points.wick;
      add(wick ? bounds.x - o.x + wick.x : cx - o.x, bounds.y - o.y + (wick?.y ?? 4), 30, 1, LAMP, { x: cx - o.x, y: foot - o.y });
    }
  }
  return lamps;
}

/** Main-room lanterns use a smooth falloff sampled on the art grid, baked once. */
function paintGlow(ctx: CanvasRenderingContext2D, radius: number, tint: string, smooth = false): void {
  const STEPS = 5, pixel = smooth ? .5 : 1;
  ctx.fillStyle = smooth ? '#f6cb8c' : tint;
  for (let y = 0; y < radius * 2; y += pixel) {
    for (let x = 0; x < radius * 2; x += pixel) {
      const d = Math.hypot(x + pixel / 2 - radius, y + pixel / 2 - radius) / radius;
      if (d >= 1) continue;
      ctx.globalAlpha = smooth ? .28 * (1 - d * d) ** 3 : (0.36 * Math.ceil((1 - d) ** 1.6 * STEPS)) / STEPS;
      ctx.fillRect(x, y, pixel, pixel);
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
  /** Authored pixels per world unit. Main-room detail is drawn on a half-unit grid. */
  density: number;
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
  viewportFrame = { x: 0, y: 0, roomWidth: SCENE_W, roomHeight: sceneHeight() };
  private layers = new Map<string, Layer>();
  private metrics: PreviewMetrics | null = null;
  private generatedStaff: GeneratedStaffAdapter | null = null;
  private generatedServers: GeneratedServerAdapter | null = null;
  private generatedCustomers: GeneratedCustomerAdapter | null = null;
  private generatedCats: GeneratedCatAdapter | null = null;
  /** Visual attachment only; weak actor keys cannot survive a companion reset. */
  private generatedPetOffsets = new WeakMap<LivingCatActor, PixelPoint>();
  private images!: Pool<Phaser.GameObjects.Image>;
  private rects!: Pool<Phaser.GameObjects.Rectangle>;
  private emitters!: Record<'sparkle' | 'steam' | 'heart', Phaser.GameObjects.Particles.ParticleEmitter>;
  private floaters: Floater[] = [];
  private thoughts = new ThoughtBubbles();
  private thoughtFontsReady = false;
  private bell: HTMLCanvasElement | null = null;
  /** When the bell on the pass last rang, in seconds of game time. */
  private bellRang = -1;
  private canGrade = false;
  private grades = new Map<AreaId, Phaser.GameObjects.Rectangle>();
  private glows!: Pool<Phaser.GameObjects.Image>;
  private overviewFrame!: Phaser.GameObjects.Graphics;
  private ghostCells!: Phaser.GameObjects.Graphics;
  /** Retain blocked-cell geometry until its inputs (or Graphics instance) change. */
  private ghostMaskCache: { key: string; cells: Phaser.GameObjects.Graphics } | null = null;
  private ghostPiece!: Phaser.GameObjects.Image;
  private ghostBox!: Phaser.GameObjects.Graphics;
  private motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  private tapInput?: CanvasTaps;

  constructor(
    private view: CafeView,
    private sim: Sim,
    private getState: () => GameState,
    private hooks: CafeHooks,
    private onCreate: () => void,
    private onLoadError: (error: Error) => void = () => {},
  ) {
    super('cafe');
  }

  private loadingFailed = false;
  private initialized = false;
  private loadGeneration = 0;
  private referenceCharactersReady: Promise<void> | null = null;

  preload(): void {
    clearGeneratedMainAssets();
    this.loadingFailed = false;
    this.initialized = false;
    const generation = this.loadGeneration = (this.loadGeneration ?? 0) + 1;
    const cancelLoading = () => {
      this.loadGeneration++;
      this.initialized = false;
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cancelLoading);
      this.events.off(Phaser.Scenes.Events.DESTROY, cancelLoading);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cancelLoading);
    this.events.once(Phaser.Scenes.Events.DESTROY, cancelLoading);
    let loaded = 0;
    // The new cast is five decoded atlases, published together as one family.
    const mainAssets = Object.entries(GENERATED_MAIN_ASSETS).filter(([id]) => !/^(?:barista|server|mina|customer)-/.test(id));
    const total = mainAssets.length + 5;
    this.hooks.loadingProgress?.(loaded, total);
    this.referenceCharactersReady = Promise.all([preloadReferenceCharacters(), preloadCozyCats(), loadSignFonts()]).then(() => {
      if (generation !== this.loadGeneration || this.loadingFailed) return;
      loaded += 5;
      this.hooks.loadingProgress?.(loaded, total);
    }, error => {
      if (generation !== this.loadGeneration || this.loadingFailed) return;
      this.loadingFailed = true;
      this.onLoadError(error instanceof Error ? error : new Error(String(error)));
    });
    this.load.on('filecomplete', () => {
      if (!this.loadingFailed) this.hooks.loadingProgress?.(++loaded, total);
    });
    this.load.once('loaderror', (file: { key: string }) => {
      this.loadingFailed = true;
      this.onLoadError(new Error(`Image failed to load: ${file.key}`));
    });
    for (const [id, file] of mainAssets) {
      this.load.image(generatedMainKey(id as GeneratedMainId), `${import.meta.env.BASE_URL}art/generated/${file}`);
    }
  }

  create(): void {
    if (this.loadingFailed) return;
    const generation = this.loadGeneration;
    // Phaser does not await async create methods. Keep its update loop gated
    // until all human art has decoded and the scene is fully initialized.
    void (this.referenceCharactersReady ?? Promise.all([preloadReferenceCharacters(), preloadCozyCats(), loadSignFonts()])).then(() => {
      if (generation !== this.loadGeneration || this.loadingFailed) return;
      this.createCafe();
      this.initialized = true;
    }).catch(error => {
      if (generation !== this.loadGeneration || this.loadingFailed) return;
      this.loadingFailed = true;
      this.onLoadError(error instanceof Error ? error : new Error(String(error)));
    });
  }

  private createCafe(): void {
    for (const id of Object.keys(GENERATED_MAIN_ASSETS) as GeneratedMainId[]) {
      const key = generatedMainKey(id);
      if (this.textures.exists(key)) installGeneratedMainAsset(id, this.textures.get(key).getSourceImage() as HTMLImageElement);
    }
    this.generatedStaff = createGeneratedStaffArt(runtimeCatalog.staffManifest as GeneratedStaffManifest,
      Object.fromEntries(GENERATED_STAFF_FRAME_IDS.map(id => [id, generatedMainSource(id)])));
    setGeneratedStaffAdapter(this.generatedStaff);
    this.generatedServers = createGeneratedServerArt(runtimeCatalog.serverManifest as GeneratedServerManifest,
      Object.fromEntries(GENERATED_SERVER_FRAME_IDS.map(id => [id, generatedMainSource(id)])));
    setGeneratedServerAdapter(this.generatedServers);
    this.generatedCustomers = createGeneratedCustomerArt(runtimeCatalog.customerManifests as GeneratedCustomerManifest[],
      Object.fromEntries(GENERATED_CUSTOMER_FRAME_IDS.map(id => [id, generatedMainSource(id)])));
    setGeneratedCustomerAdapter(this.generatedCustomers);
    this.generatedCats = createCozyCatArt() ?? createGeneratedCatArt(runtimeCatalog.catManifests as GeneratedCatManifest[],
      Object.fromEntries(GENERATED_CAT_FRAME_IDS.map(id => [id, generatedMainSource(id)])));
    setGeneratedCatAdapter(this.generatedCats);
    setGeneratedSignatureAdapter(createGeneratedSignatureArt(
      Object.fromEntries(GENERATED_SIGNATURE_IDS.map(id => [id, generatedMainSource(generatedSignatureKey(id))]))));
    setGeneratedFoodAdapter(createGeneratedFoodArt(
      Object.fromEntries(GENERATED_FOOD_IDS.map(id => [id, generatedMainSource(id)])),
      { rasterMetadata: runtimeCatalog.mainStaticMetadata }));
    setGeneratedIngredientAdapter(createGeneratedIngredientArt(
      Object.fromEntries(GENERATED_INGREDIENT_IDS.map(id => [id, generatedMainSource(`ingredient-${id}`)]))));
    setGeneratedFurnitureAdapter(createGeneratedFurnitureArt(
      Object.fromEntries(GENERATED_FURNITURE_IDS.map(id => [id, generatedMainSource(generatedFurnitureKey(id))])), { catalog: COZY_FURNITURE_CATALOG }));
    setGeneratedDecorAdapter(createGeneratedDecorArt(
      Object.fromEntries(GENERATED_DECOR_SOURCE_IDS.map(id => [id, generatedMainSource(`decor-${id}` as GeneratedMainId)])), { catalog: COZY_DECOR_CATALOG }));
    setGeneratedMainEnvironmentAdapter(createGeneratedMainEnvironmentArt(
      Object.fromEntries(GENERATED_MAIN_ENVIRONMENT_IDS.map(id => [id, generatedMainSource(generatedMainEnvironmentKey(id))])), { catalog: cozyEnvironmentMetadata }));
    setGeneratedTablewareAdapter(createGeneratedTablewareArt(
      Object.fromEntries(GENERATED_TABLEWARE_IDS.map(id => [id, generatedMainSource(generatedTablewareKey(id))]))));
    // Published pose canvases own their pixels; full-resolution character sources
    // are no longer needed by either scene sprites or shared avatar previews.
    // Cleanup failure must never block an otherwise ready operating renderer.
    for (const pack of [
      { kind: 'staff' as const, adapter: this.generatedStaff },
      { kind: 'server' as const, adapter: this.generatedServers },
      { kind: 'customer' as const, adapter: this.generatedCustomers },
      { kind: 'cat' as const, adapter: this.generatedCats },
    ]) {
      try { releaseGeneratedCharacterSources(pack, this.textures); }
      catch (error) { console.warn('Generated character source cleanup was deferred.', error); }
    }
    try { releaseGeneratedStaticSources(this.textures); }
    catch (error) { console.warn('Generated static source cleanup was deferred.', error); }
    this.metrics = new PreviewMetrics(this.game.canvas, window.location.href);
    addPixelFonts(this);
    // Canvas text does not trigger CSS font loading on its own. Load both scripts
    // even for returning English players who never opened the language dialog.
    Promise.all([document.fonts.load('12px "Pixel ZH"'), document.fonts.load('12px "Pixelify Sans"')])
      .then(() => { this.thoughtFontsReady = true; })
      .catch(() => { this.thoughtFontsReady = true; });
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
        lifespan: 1600,
        speedX: { min: -3, max: 3 },
        speedY: { min: -13, max: -8 },
        alpha: { onEmit: () => 0.45, onUpdate: (_p, _k, t) => 0.45 * (1 - t) },
        // Puffs start as 2x2 and thin out to a single pixel.
        scale: { onEmit: () => 2, onUpdate: (_p, _k, t) => (t < 0.4 ? 2 : 1) },
      }),
      heart: emitter(canvasKey(this.textures, worldSpriteArt(heartSprite()).canvas), {
        lifespan: 1300,
        scale: 1 / worldSpriteArt(heartSprite()).density,
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

    this.tapInput = bindCanvasTaps(this.game.canvas, {
      enabled: () => !this.view.panning && !this.view.paused && this.hooks.interactionEnabled?.() !== false,
      context: () => [this.view.area, this.view.overview, this.view.viewX, this.view.viewY, this.view.zoom,
        this.view.ghost?.id, this.view.ghost?.skip, this.getState(), this.getState().phase, this.hooks.interactionState?.()],
      tap: (screenX, screenY) => {
        if (!insideRoomFrame(screenX, screenY, this.viewportFrame)) return;
        const { x, y } = camera.getWorldPoint(screenX, screenY);
        this.view.withPresentedPointer({ x, y }, logical => this.hooks.pointerDown(logical.x, logical.y));
      },
      hover: (screenX, screenY) => {
        if (!insideRoomFrame(screenX, screenY, this.viewportFrame)) return;
        const { x, y } = camera.getWorldPoint(screenX, screenY);
        this.view.withPresentedPointer({ x, y }, logical => this.hooks.pointerMove(logical.x, logical.y));
      },
    });
    const clearInput = () => {
      this.metrics?.destroy();
      this.metrics = null;
      this.tapInput?.destroy();
      this.tapInput = undefined;
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, clearInput);
      this.events.off(Phaser.Scenes.Events.DESTROY, clearInput);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, clearInput);
    this.events.once(Phaser.Scenes.Events.DESTROY, clearInput);
    this.onCreate();
  }

  update(time: number, delta: number): void {
    if (this.loadingFailed || !this.initialized) return;
    const measuredAt = this.metrics?.enabled ? performance.now() : 0;
    const dt = Math.min(0.25, Math.max(0, delta / 1000));
    this.hooks.tick(dt);
    this.tapInput?.refresh();

    const view = this.view;
    const state = this.getState();
    const t = time / 1000;
    // The light (and the wall clock) follow the player's own local time, to the minute.
    const real = previewLightDate(new Date(), window.location.href);
    const now = new Date(2000, 0, 1, real.getHours(), real.getMinutes());
    const light = lightingAt(real.getHours() + real.getMinutes() / 60);
    this.currentLight = light;
    const viewX = Math.round(view.viewX);
    const viewY = Math.round(view.viewY);

    const camera = this.cameras.main;
    camera.setZoom(this.backing * view.zoom);
    const zoom = this.backing * view.zoom;
    const left = viewX - this.viewportFrame.x / zoom;
    const top = viewY - this.viewportFrame.y / zoom;
    camera.setScroll(left, top);

    this.images.begin();
    this.rects.begin();
    this.glows.begin();
    for (const area of AREA_IDS) {
      const o = areaBounds(area);
      const visible = o.x < left + camera.width / zoom && o.x + o.w > left && o.y < top + camera.height / zoom && o.y + o.h > top;
      this.drawRoom(area, visible, state, t, now, light);
      this.drawLight(area, visible, state, light);
    }
    this.glows.end();
    this.drawFloorStanding(state, t);
    this.sim.customers.forEach((c, i) => this.drawCustomerOverlay(c, t, DEPTH.overlay + i * 0.001));
    this.drawThoughts(state, dt);
    this.images.end();
    this.rects.end();

    this.spawnEffects();
    this.drawOverviewFrame();
    this.drawGhost(state, view.ghost && !view.panning && !view.overview ? view.ghost : null, t, now);
    if (this.metrics?.enabled) {
      let count: number | undefined, bytes: number | undefined;
      if (this.metrics.willRefresh(delta)) {
        const keys = this.textures.getTextureKeys();
        count = keys.length; bytes = 0;
        for (const key of keys) for (const source of this.textures.get(key).source) bytes += source.width * source.height * 4;
      }
      this.metrics.record(delta, performance.now() - measuredAt, count, bytes);
    }
  }

  // ------------------------------------------------------------ helpers

  private customerPoint(customer: Customer): PixelPoint {
    return seated(customer)
      ? projectMainAttachment(customer, tablePos(Math.floor(customer.seat / 2)))
      : projectMainWorld(customer);
  }

  private furnitureAlpha = 1;
  private currentLight = lightingAt(12);
  private mainOpenings: readonly { x: number; w: number }[] = WINDOWS;

  private litImage(source: HTMLCanvasElement | string, x: number, y: number, depth: number, anchor: PixelPoint) {
    if (!this.currentLight) return this.image(source, x, y, depth);
    const inside = anchor.x > 0 && anchor.x < SCENE_W && anchor.y >= 80 && anchor.y < sceneHeight();
    const p = unprojectMainWorld(anchor);
    const strength = mainKeyLight(this.currentLight.sun).strength;
    const exposure = inside ? strength * .18 + mainSurfaceLight(p.x, p.y, this.currentLight, this.mainOpenings) * .82 : 0;
    return this.image(typeof source === 'string' ? source : mainLitSprite(source, exposure), x, y, depth);
  }

  /** Sprites always draw from their world-grid artwork, whatever density they were authored at. */
  private image(canvasOrKey: HTMLCanvasElement | FineSpriteArt | string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const art = typeof canvasOrKey === 'string' ? null : 'density' in canvasOrKey ? canvasOrKey : worldSpriteArt(canvasOrKey);
    const key = art ? canvasKey(this.textures, art.canvas) : canvasOrKey as string;
    const image = this.images.next();
    image.setTexture(key).setScale(1 / (art?.density ?? 1)).setPosition(Math.round(x * 2) / 2, Math.round(y * 2) / 2).setDepth(depth).setAlpha(this.furnitureAlpha).setFlipX(false);
    if (image.isCropped) image.setCrop();
    return image;
  }

  private generatedPicture(id: GeneratedMainId, x: number, y: number, width: number, height: number, depth: number, area: AreaId = 'main', style = 'tablecloth_classic'): Phaser.GameObjects.Image | null {
    const key = generatedMainKey(id);
    if (!generatedMainSource(id) || !this.textures.exists(key)) return null;
    // Resample the painting once to the exact art pixels it covers, instead of scaling it per frame.
    const w = Math.max(1, Math.round(width * WORLD_ART_DENSITY)), h = Math.max(1, Math.round(height * WORLD_ART_DENSITY));
    const gridKey = `${key}@${w}x${h}${area === 'main' ? '' : ':' + area}${style === 'tablecloth_classic' ? '' : ':' + style}`;
    if (!this.textures.exists(gridKey)) {
      const frame = this.textures.getFrame(key);
      const resampled = resampleImage(frame.source.image as HTMLImageElement, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, w, h);
      if (area === 'main' && style === 'tablecloth_classic') this.textures.addCanvas(gridKey, resampled);
      else {
        const variant = document.createElement('canvas'); variant.width = w; variant.height = h;
        const ctx = variant.getContext('2d')!; ctx.drawImage(resampled, 0, 0);
        const pixels = ctx.getImageData(0, 0, w, h);
        if (style === 'tablecloth_classic') remapTablecloth(pixels.data, w, h, area);
        else remapTextile(pixels.data, w, h, style, true);
        ctx.putImageData(pixels, 0, 0);
        this.textures.addCanvas(gridKey, variant);
      }
    }
    return this.image(gridKey, x, y, depth).setScale(1 / WORLD_ART_DENSITY);
  }

  private rect(x: number, y: number, w: number, h: number, fill: string, depth: number): void {
    if (w <= 0 || h <= 0) return;
    this.rects.next().setPosition(Math.round(x), Math.round(y)).setSize(Math.round(w), Math.round(h)).setFillStyle(color(fill)).setDepth(depth);
  }

  /** Main-room cast/contact passes sit below ALL floor actors, including the
   * neighbour whose foot happens to sort earlier. Other rooms retain their art. */
  private shadow(cx: number, y: number, w: number, depth: number, alpha = 0.22, cast = true): void {
    const half = Math.round(w / 2);
    if (this.currentLight && cx > 0 && cx < SCENE_W && y >= 80 && y < sceneHeight()) {
      const s = mainShadowState(this.currentLight);
      if (cast && s.strength > 0) {
        const key = baked(this.textures, `main-cast-${w}-${s.reach}-${s.strength}`, w + 32, 40,
          ctx => paintCastShade(ctx, half + 2, 7, w, s.reach, s.strength));
        this.image(key, cx - half - 2, y - 7, DEPTH.floor - .5);
      }
      const key = baked(this.textures, `main-contact-${w}-${alpha}`, w + 4, 14,
        ctx => paintContactShade(ctx, half + 2, 7, w, alpha));
      this.image(key, cx - half - 2, y - 7, DEPTH.floor - .4);
      return;
    }
    if (cx >= 0 && cx <= SCENE_W && y >= 0 && y <= sceneHeight()) {
      const key = baked(this.textures, `shadow-${w}-${alpha}`, half * 2, 4, ctx => shadow(ctx, half, 2, w, alpha));
      this.image(key, cx - half, y - 2, depth);
      return;
    }
    const key = baked(this.textures, `extension-contact-${w}-${alpha}`, (w + 4) * 2, 14 * 2, ctx => {
      ctx.scale(2, 2); paintContactShade(ctx, half + 2, 7, w, alpha);
    });
    this.image(key, cx - half - 2, y - 7, depth).setScale(1 / WORLD_ART_DENSITY);
  }

  private layer(name: string, depth: number): Layer {
    let layer = this.layers.get(name);
    if (!layer) {
      const density = WORLD_ART_DENSITY;
      const texture = this.textures.createCanvas(name, SCENE_W * density, sceneHeight() * density)!;
      const image = this.add.image(0, 0, name).setOrigin(0, 0).setDepth(depth).setScale(1 / density);
      layer = { texture, image, painter: new RoomPainter(gridSafeContext(texture.context), density), shown: '', density };
      this.layers.set(name, layer);
    }
    return layer;
  }

  /** Repaints a layer if `signature` (everything it depends on) has changed. */
  private paint(layer: Layer, x: number, y: number, signature: string, paint: (painter: RoomPainter) => void, height = sceneHeight()): void {
    layer.image.setPosition(x, y).setVisible(true);
    if (layer.shown === signature) return;
    layer.shown = signature;
    const { texture } = layer;
    const H = height;
    if (texture.height !== H * layer.density) {
      texture.setSize(SCENE_W * layer.density, H * layer.density);
      layer.image.setSizeToFrame();
      layer.image.setScale(1 / layer.density);
    }
    const ctx = texture.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, texture.width, texture.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(layer.density, 0, 0, layer.density, 0, 0);
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
    const H = areaBounds(area).h;
    const decor = state.decor.equipped;
    const tick = Math.floor(t * ROOM_FPS);
    const skip = this.view.ghost?.skip ?? -1;
    const placed = state.decor.placed.map((p, i) => (i === skip ? '' : `${p.id}@${p.col},${p.row}`)).join(';');
    const back = this.layer(`room-${area}`, DEPTH.room);
    const front = this.layer(`room-${area}-front`, DEPTH.frontWall);
    if (!visible) {
      back.image.setPosition(o.x, o.y).setVisible(false);
      front.image.setPosition(o.x, o.y).setVisible(false);
      if (area === 'main') this.layers.get('room-main-counter')?.image.setVisible(false);
      return;
    }
    if (area === 'main') {
      const backSig = [tick, H, getLocale(), signFontRevision(), state.profile?.cafeName, Object.values(decor).join(','), menuItems(state).map((m) => m.id).join(','), state.phase, placed, now.getTime(), this.view.kitchenDoor.toFixed(2)].join('|');
      this.paint(back, o.x, o.y, backSig, (p) => {
        p.kitchenDoor = this.view.kitchenDoor;
        p.curtain = decor.curtain;
        const ctx = p.ctx;
        p.drawWall(decor.wallpaper, t);
        this.mainOpenings = p.lightOpenings();
        p.drawArchitecturalLight(light);
        const sill = WINDOWS[0];
        p.drawWindow(sill, light, t, state.phase === 'open');
        for (const win of WINDOWS.slice(1)) p.drawWindow(win, light, t, null);
        p.drawSill(decor.sill, sill.x + sill.w - 8, sill.y + sill.h + 1);
        // The neon sign glows in the left window, facing the street.
        p.withPlane(MAIN_WALL_PLANE, () => paintNeon(p.ctx, decor.neon, sill.x + sill.w / 2, sill.y + 4, t, state.profile?.cafeName, true));
        p.drawMenuBoard(state);
        state.decor.placed.forEach((piece, i) => {
          const def = furnitureDef(piece.id);
          if (def?.surface === 'wall' && piece.col < COLS && i !== skip) p.withPlane(MAIN_WALL_PLANE, () => paintWallFurniture(p.ctx, piece.id, piece.col * CELL, WALL_TOP + piece.row * CELL, t, now));
        });
        p.drawFloor(decor.floor, decor.rug, light, H);
        p.drawBackBar(state, decor.counter);
        p.drawServiceCupboards(decor.counter);
        p.withPlane(MAIN_WALL_PLANE, () => paintCeiling(p.ctx, decor.ceiling, SCENE_W, t));
        roomDepth(ctx, SCENE_W, H, 80);
        p.withPlane(MAIN_WALL_PLANE, () => { for (const win of WINDOWS) dustMotes(p.ctx, win.x, win.y + win.h, win.w, 44, this.motionPreference.matches ? 0 : t, light.sun.strength); });
      });
      this.drawCat(state, t, o);
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
        H, getLocale(), signFontRevision(),
        decor.counter,
        state.upgrades.machine,
        now.getTime(),
        cups.map((c) => `${c.x}:${Math.ceil(c.fill * 4)}`).join(','),
        cups.length > 0 && Math.floor(t * 4) % 2,
        menuItems(state).map((m) => m.id).join(','),
        JSON.stringify(shelf),
        Math.min(4, 1 + Math.floor(state.today.served / 15)),
      ].join('|');
      this.paint(counter, o.x, o.y, counterSig, (p) => { p.drawCounter(state, decor.counter, t, cups); p.drawCounterLight(light); });
    } else if (area === 'kitchen') {
      const locked = !isAreaOpen(state, area);
      const installed = installedEquipment(state);
      const active = this.activeStations();
      this.paint(back, o.x, o.y, [tick, H, locked, signFontRevision(), [...installed].join(','), [...active].join(',')].join('|'), (p) => {
        paintKitchen(p.ctx, H, t, locked, installed, active);
        roomDepth(p.ctx, SCENE_W, H, 80);
      }, H);
    } else {
      const offset = regionOffset(area);
      const locked = !isAreaOpen(state, area);
      this.paint(back, o.x, o.y, [tick, H, placed, now.getTime(), locked, signFontRevision()].join('|'), (p) => {
        const ctx = p.ctx;
        paintRegion(ctx, area, H, t, light, locked);
        state.decor.placed.forEach((piece, i) => {
          const def = furnitureDef(piece.id);
          const x = piece.col * CELL;
          if (def?.surface === 'wall' && x >= offset && x < offset + SCENE_W && i !== skip) paintWallFurniture(ctx, piece.id, x - offset, WALL_TOP + piece.row * CELL, t, now, locked);
        });
        paintPassageFloor(ctx, area, locked);
        roomDepth(ctx, SCENE_W, H, 80, area === 'terrace');
      });
    }

    const wallpaper = area === 'main' ? decor.wallpaper : area === 'reading' ? 'wall_cream' : area === 'kitchen' ? 'wall_dots' : 'wall_mint';
    const door = Math.round(this.view.kitchenDoor * 4) / 4;
    this.paint(front, o.x, o.y, [H, wallpaper, state.regions.join(','), state.kitchen, door].join('|'), (p) => {
      p.drawFrontWall(wallpaper, H, area === 'main' || area === 'greenhouse', area === 'terrace');
      paintRoomBoundaries(p.ctx, area, state, door);
    }, H);
  }

  /**
   * The time of day over a room: its color grade, and warm pools around each light
   * that come up as it gets dark. Locked rooms stay unlit.
   */
  private drawLight(area: AreaId, visible: boolean, state: GameState, light: Lighting): void {
    const o = areaOrigin(area);
    const ambient = roomAmbient(light, area, !isAreaOpen(state, area));
    this.grades.get(area)!.setVisible(visible && this.canGrade && ambient !== '#ffffff').setPosition(o.x, o.y).setSize(SCENE_W, areaBounds(area).h).setFillStyle(color(ambient));
    if (!visible || light.lamps < 0.01 || !isAreaOpen(state, area)) return;
    for (const lamp of lampsIn(area, state)) {
      const density = area === 'main' ? 1 : WORLD_ART_DENSITY;
      const key = baked(this.textures, `glow-soft-${lamp.radius}-${lamp.color}${area === 'main' ? '' : '-extension'}`, lamp.radius * 2 * density, lamp.radius * 2 * density, ctx => {
        if (area === 'main') paintGlow(ctx, lamp.radius, lamp.color, true);
        else { ctx.scale(density, density); extensionLampPool(ctx, lamp.radius, lamp.color); }
      });
      this.glows.next().setTexture(key).setScale(1 / density).setPosition(o.x + lamp.x, o.y + lamp.y).setAlpha(light.lamps * lamp.strength);
    }
  }

  private drawCat(state: GameState, t: number, o: { x: number; y: number }): void {
    if (state.pets.length) return;
    // Keep the original visiting cat until a resident is adopted.
    const cats = state.pets.length ? state.pets : [{ id: 'ginger' as const, careSeconds: 1, autoRefill: false }];
    cats.forEach((cat, i) => {
      const spot = projectMainPlaneWorld(CAT_SPOTS[i], MAIN_WALL_PLANE);
      const frames = this.residentFrames(cat.id);
      const time = t + i * 0.8;
      let sprite = Math.floor(time / 0.7) % 2 ? frames.swish : frames.idle;
      if (!petActive(cat) || time % 4 < 0.15) sprite = frames.blink;
      if (this.view.catHappy > 0 && this.view.catSpot.x === CAT_SPOTS[i].x) sprite = frames.happy;
      const offset = this.generatedCats?.drawOffset(sprite);
      this.image(sprite, o.x + spot.x - 8 + (offset?.x ?? 0), o.y + spot.y - sprite.height + 2 + (offset?.y ?? 0), DEPTH.cat);
    });
  }

  private drawBaristas(state: GameState, t: number, o: { x: number; y: number }): void {
    this.sim.baristas.forEach((b, i) => {
      if (i >= 1 + state.upgrades.barista) return;
      const pose = this.sim.baristaPose(i);
      const x = projectMainWorld({ x: o.x + pose.x, y: o.y + pose.y }).x;
      const brewing = this.sim.isBrewing(i);
      // The first spot behind the counter is always the owner.
      const role = i === 0 && state.profile ? 'owner' : 'barista';
      const look = role === 'owner' ? state.profile!.look : b.look;
      const frames = character(look, role);
      const dir = frames[pose.facing];
      let sprite = dir[0];
      let bob = 0;
      if (pose.walking) sprite = dir[1 + (Math.floor(t * 8) % 2)];
      else if (pose.working) bob = Math.floor(t * 6 + i) % 2;
      else if (!brewing) bob = Math.floor(t * 1.2 + i * 0.7) % 2;
      // Nearer the counter draws in front, but everyone in the bar stays behind it.
      const depth = DEPTH.baristas + pose.y * 0.01 + i * 0.001;
      const contact = referenceCharacterContacts(sprite);
      const foot = contact?.foot;
      const originY = o.y + pose.y - (foot?.y ?? CHAR_H - 1);
      const top = originY + (referenceCharacterContacts(sprite)?.head?.y ?? 0);
      this.litImage(sprite, x - (foot?.x ?? 9), originY + bob, depth, { x, y: o.y + pose.y });
      // Carrying the order forward from the back bar.
      if (brewing && pose.facing === 'down' && pose.walking) {
        const hand = contact?.carryContact;
        this.cup(hand ? x - (foot?.x ?? 9) + hand.x - 3 : x - 3, hand ? originY + hand.y + bob - 4 : o.y + pose.y - 10 * STANDING_CHARACTER_SCALE - (contact?.legExtension ?? 0), depth + 0.0005);
      }
      if (brewing) {
        const progress = 1 - Math.max(0, b.remaining) / b.total;
        const w = Math.max(1, Math.round(18 * progress));
        const y = top - 5;
        this.rect(x - 10, y, 20, 5, OUTLINE, depth + 0.001);
        this.rect(x - 9, y + 1, 18, 3, '#5a3a2a', depth + 0.002);
        this.rect(x - 9, y + 1, w, 3, UI_ART.sage, depth + 0.003);
        this.rect(x - 9, y + 1, w, 1, UI_ART.sageLight, depth + 0.004);
      }
      // "Order up!": calling a server over to the pass.
      if (b.calling > 0) this.image(this.callBubble(), x - 8, top - 25, DEPTH.overlay);
    });
  }

  /** A speech bubble with the service bell in it. */
  private callBubble(): string {
    return baked(this.textures, 'bubble-bell', 17, 15, paintCallBubble);
  }

  /** The brass service bell on the pass. */
  private bellSprite(): HTMLCanvasElement {
    return (this.bell ??= pixelSprite(['..Y..', '..k..', '.YYy.', 'yYydd', 'yyyyy', 'ddddd'], { k: UI_ART.brassShade, y: UI_ART.brass, Y: UI_ART.brassLight, d: '#866344' }));
  }

  /** Plates waiting on the pass, and its bell, which jiggles when rung. */
  private drawPass(t: number, o: { x: number; y: number }): void {
    this.sim.pass.forEach((plate, i) => {
      const slot = projectMainPlaneWorld(passSlot(i), MAIN_COUNTER_PLANE);
      const depth = DEPTH.counter + 0.5 + i * 0.01;
      const tableware = getGeneratedTablewareAdapter();
      const generatedDish = tableware?.sprite('shallow-plate');
      const dish = generatedDish ?? baked(this.textures, 'pass-plate', PASS_SLOT_W, 2, (ctx) => {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(0, 1, PASS_SLOT_W, 1);
        ctx.fillStyle = '#fdf6ec';
        ctx.fillRect(1, 0, PASS_SLOT_W - 2, 1);
      });
      // Unoutlined icons, like the menu board's, so three fit side by side.
      const icon = itemIcon(plate.items[0], false);
      const supportY = generatedDish ? tableware?.support('shallow-plate')?.y ?? 1 : 1;
      this.image(icon, o.x + slot.x + Math.floor((PASS_SLOT_W - icon.width) / 2), o.y + slot.y - 3 + supportY - icon.height, depth);
      this.image(dish, o.x + slot.x, o.y + slot.y - 3, depth + 0.001);
    });
    const ringing = t - this.bellRang < 0.6;
    const shake = ringing ? (Math.floor(t * 20) % 2 ? 1 : -1) : 0;
    const bell = this.bellSprite();
    this.image(bell, o.x + projectMainPlaneWorld(PASS_BELL, MAIN_COUNTER_PLANE).x - 3 + shake, o.y + PASS_BELL.y - bell.height + 1, DEPTH.counter + 0.6);
  }

  // ------------------------------------------------------------ the floor

  /** Customers, tables, crates and furniture, each sorted by where its feet are. */
  private drawFloorStanding(state: GameState, t: number): void {
    this.drawResidents(state);
    const skip = this.view.ghost?.skip ?? -1;
    for (const c of this.sim.customers) if (!seated(c)) this.drawCustomer(c, DEPTH.floor + c.y);
    for (const server of this.sim.servers) this.drawServer(server, DEPTH.floor + server.y);
    this.sim.cooks.forEach((cook, i) => this.drawCook(cook, i, cook.x >= 0 && cook.y <= 100 ? DEPTH.baristas + cook.y * 0.01 + 0.01 : DEPTH.floor + cook.y));
    this.drawKitchenFloor(state);
    for (const i of activeTableIndices(state)) this.drawTable(i, t, DEPTH.floor + tablePos(i).y + 0.1);
    // Empty floor during ordinary play. A deliberate upgrade preview borrows
    // the exact furniture renderer, without reserving seats or changing state.
    const built = mainTableCount(state);
    if (this.view.tablePreview && state.phase === 'prep' && built < MAX_TABLES &&
        !this.view.paused && !this.view.overview && !this.view.ghost && !this.view.panning) {
      this.furnitureAlpha = 0.38;
      try { this.drawTable(built, t, DEPTH.floor + tablePos(built).y + 0.1, true); }
      finally { this.furnitureAlpha = 1; }
    }
    // Furniture the player placed, and the potted figs either side of the front door.
    state.decor.placed.forEach((p, i) => {
      const def = furnitureDef(p.id);
      if (def?.surface !== 'floor' || i === skip) return;
      const { cx, foot } = floorAnchor(def, p.col, p.row);
      this.floorPiece(p.id, cx, foot, DEPTH.floor + foot + 0.3);
    });
    for (const [index, spot] of doorPlantSpots().entries()) {
      const painted = projectMainWorld(spot);
      this.shadow(painted.x, painted.y, 13, DEPTH.floor + spot.y + 0.39);
      if (this.generatedPicture('plant', painted.x - 11, painted.y - 22, 22, 22 * 448 / 432, DEPTH.floor + spot.y + 0.4)) continue;
      const key = baked(this.textures, `main-entrance-plant-fine-${index}`, 32, 46, (ctx) => {
        ctx.scale(2, 2); paintFinePottedPlant(ctx, 0, 0, 16, 23, 17 + index);
      });
      this.image(key, painted.x - 8, painted.y - 22, DEPTH.floor + spot.y + 0.4).setScale(0.5);
    }
  }

  private residentFrames(id: LivingCatActor['id']) {
    const fallback = catFrames(id);
    return this.generatedCats?.resolve(id, fallback).frames ?? fallback;
  }

  /** Residents share the existing feet-based floor depth and cached breed art. */
  private drawResidents(state: GameState): void {
    this.view.clearPresentedResidentCatPoints();
    let index = 0;
    for (const cat of this.view.livingCats.actors.values()) {
      const frames = this.residentFrames(cat.id);
      const quiet = this.motionPreference.matches;
      const walking = cat.route.length > 0;
      let sprite = frames.idle;
      if (walking) sprite = frames.walk[quiet ? 0 : Math.floor(cat.stride / 5) % 2];
      else if (cat.interaction?.phase === 'nuzzle') sprite = quiet ? frames.lookUp : frames.nuzzle[Math.floor(cat.interaction.elapsed / 0.65) % 2];
      else if (cat.interaction?.phase === 'response') sprite = frames.lookUp;
      else if (cat.affection > 0) sprite = frames.happy;
      else if (cat.behavior === 'sleep') sprite = frames.sleep;
      else if (cat.behavior === 'groom') sprite = frames.groom[quiet ? 0 : Math.floor(cat.elapsed / 0.7) % 2];
      else if (cat.behavior === 'stretch') sprite = frames.stretch;
      else if (cat.behavior === 'watch') sprite = frames.watch;
      const painted = this.residentPaintPoint(cat, state);
      this.view.setPresentedResidentCatPoint(cat.id, painted);
      const depth = DEPTH.floor + cat.y + 0.005;
      this.shadow(painted.x, painted.y, 10, depth);
      const spriteOffset = this.generatedCats?.drawOffset(sprite) ?? { x: 0, y: 0 };
      this.image(sprite, painted.x - 9 + spriteOffset.x, painted.y - sprite.height + 2 + spriteOffset.y, depth + 0.001).setFlipX(residentCatFlipX(walking, cat.facing));
      const selected = this.view.selectedCat === cat.id && this.view.catSelectionSeconds > 0;
      // A tiny numbered tag matches the owned list; never covers the cat's face.
      const label = String(++index);
      const key = baked(this.textures, `resident-tag-${label}-${selected}`, 7, 7, ctx => {
        ctx.fillStyle = selected ? '#f8d68a' : '#fff4d9'; ctx.fillRect(0, 0, 7, 7);
        drawText(ctx, label, 1, 1, '#5a4031');
      });
      if (!this.view.overview) this.image(key, painted.x + 7, painted.y - 17, DEPTH.overlay + 0.5);
      if (selected) {
        this.rect(painted.x - 11, painted.y + 2, 22, 1, '#f8d68a', depth + 0.003);
      }
      // A real visual-only pair owns this response; proximity alone never pets.
      if (!this.view.overview && cat.interaction?.phase === 'response' && state.pets.some(p => p.id === cat.id && petActive(p))) {
        const guest = this.sim.customers.find(c => c.id === cat.interaction!.guestId && seated(c));
        if (guest) this.image(heartSprite(), this.customerPoint(guest).x + 8, guest.y - CHAR_H - 8, DEPTH.overlay);
      }
    }
  }

  /** Bring the raised cat's forehead to the authored hand without moving its route. */
  private residentPaintPoint(cat: LivingCatActor, state: GameState): PixelPoint {
    const painted = projectMainWorld(cat), interaction = cat.interaction;
    if (!interaction) {
      // Cancellation resets actor.elapsed. Let its retreat start where the cat
      // was painted rather than snapping back when the guest leaves early.
      const offset = this.generatedPetOffsets.get(cat);
      const fade = Math.max(0, 1 - cat.elapsed / 0.5);
      if (!offset || fade === 0) { this.generatedPetOffsets.delete(cat); return painted; }
      return { x: painted.x + offset.x * fade, y: painted.y + offset.y * fade };
    }
    if (interaction.phase === 'leave') {
      const offset = this.generatedPetOffsets.get(cat);
      const fade = Math.max(0, 1 - interaction.elapsed / 0.5);
      return offset ? { x: painted.x + offset.x * fade, y: painted.y + offset.y * fade } : painted;
    }
    if (!state.pets.some(p => p.id === cat.id && petActive(p))) return painted;
    const guest = this.sim.customers.find(c => c.id === interaction.guestId && seated(c));
    if (!guest) return painted;
    const index = Math.floor(guest.seat / 2), side = (guest.seat % 2) as 0 | 1;
    // During approach/nuzzle, anticipate Pet A. The response itself chooses the
    // same A/B/reduced-motion frame as the seated renderer below.
    const pose = this.seatedCustomerPose(index, side, guest, 0, cat);
    const contact = referenceCharacterContacts(pose.sprite)?.petContact;
    if (!contact) return painted; // Unpaired or unavailable hand contacts stay put.
    const raised = this.residentFrames(cat.id).lookUp;
    // CAT_BASE's forehead is (6,3), including pixelSprite's one-pixel border.
    // Upright cats face the seat: the right chair mirrors that same crown point.
    const raisedOffset = this.generatedCats?.drawOffset(raised) ?? { x: 0, y: 0 };
    const generatedContact = this.generatedCats?.contactPoints(raised, residentCatFlipX(false, cat.facing));
    const headX = generatedContact?.headContact.x ?? (side === 0 ? 6 : raised.width - 6);
    const headY = generatedContact?.headContact.y ?? 3;
    const approach = seatApproach(index, side), anchor = projectMainWorld(approach);
    const offset = {
      x: Math.round(pose.x * 2) / 2 + contact.x + 9 - raisedOffset.x - headX - anchor.x,
      y: Math.round(pose.y * 2) / 2 + contact.y + raised.height - 2 - raisedOffset.y - headY - anchor.y,
    };
    const near = Math.max(0, Math.min(1, 1 - Math.hypot(cat.x - approach.x, cat.y - approach.y) / 24));
    const blend = interaction.phase === 'approach' ? near * near * (3 - 2 * near) : 1;
    const applied = { x: offset.x * blend, y: offset.y * blend };
    this.generatedPetOffsets.set(cat, applied);
    return { x: painted.x + applied.x, y: painted.y + applied.y };
  }

  /**
   * A floor piece baked with its shadow and glow, and where the texture's top-left
   * goes relative to the piece's center and feet.
   */
  private floorTexture(id: string, extension = false): { key: string; dx: number; dy: number; density: number } {
    const b = floorFurnitureBounds(id, 0, 0);
    // An odd-width sprite sits half a pixel left of center, as when painted directly.
    const half = Math.floor(b.w / 2);
    const density = getGeneratedFurnitureAdapter()?.sprite(id) ? WORLD_ART_DENSITY : 1;
    const key = baked(this.textures, `floor-${id}-${density}x${extension ? '-extension' : ''}`, (b.w + PAD * 2) * density, (b.h + PAD * 2) * density, (raw) => {
      const ctx = gridSafeContext(raw);
      if (density > 1) ctx.scale(density, density);
      ctx.imageSmoothingEnabled = false;
      paintFloorFurniture(ctx, id, PAD + half, PAD + b.h - 1, !extension);
    });
    return { key, dx: -PAD - half, dy: -PAD - b.h + 1, density };
  }

  private floorPiece(id: string, cx: number, foot: number, depth: number): void {
    const { key, dx, dy, density = 1 } = this.floorTexture(id, cx < 0 || cx > SCENE_W || foot < 0);
    const painted = projectMainWorld({ x: cx, y: foot });
    this.image(key, painted.x + dx, painted.y + dy, depth).setScale(1 / density);
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
    if (walking) idx = [1, 0, 2, 0][step % 4];
    const painted = projectMainWorld(w);
    const x = Math.round(painted.x * 2) / 2;
    const y = Math.round(painted.y);
    this.shadow(x, y, 12, depth);
    const bob = walking && idx !== 0 ? 1 : 0;
    const frame=frames[facing][idx],foot=referenceCharacterContacts(frame)?.foot;
    this.litImage(frame, x - (foot?.x??9), y - (foot?.y??CHAR_H-1) - bob, depth + 0.001, { x, y });
    const carryContact=referenceCharacterContacts(frame)?.carryContact;
    return { x, y, bob, facing, carryX: carryContact && foot ? x - foot.x + carryContact.x : undefined, carryY: carryContact && foot ? y - foot.y + carryContact.y - bob : undefined, legExtension: referenceCharacterContacts(frame)?.legExtension ?? 0, scale: foot ? STANDING_CHARACTER_SCALE : 1, height: foot ? foot.y - (referenceCharacterContacts(frame)?.head?.y ?? 0) : CHAR_H - 1 };
  }

  /** A server, carrying a tray of orders at shoulder height, with a "!" when they answer the bell. */
  private drawServer(server: Server, depth: number): void {
    const frames = character(server.look, 'server');
    const { x, y, bob, scale, height, legExtension, carryY } = this.drawWalker(server, frames, 'down', depth);
    if (server.plates.length > 0 && server.phase !== 'toPass') {
      const tableware = getGeneratedTablewareAdapter();
      const generatedTray = tableware?.sprite('shallow-tray');
      const tray = generatedTray ?? baked(this.textures, 'tray', 22, 3, paintServiceTray);
      const traySupportY = generatedTray ? tableware?.support('shallow-tray')?.y ?? 0 : 0;
      const ty = carryY ?? y - 10 * scale - legExtension - bob;
      const n = server.plates.length;
      server.plates.forEach((plate, i) => {
        const icon = itemIcon(plate.items[0], false);
        const cx = x + Math.round((i - (n - 1) / 2) * 7);
        const scale = Math.min(1, 8 / Math.max(icon.width, icon.height));
        this.image(worldSpriteArt(icon, icon.width * scale, icon.height * scale), cx - icon.width * scale / 2, ty + traySupportY - icon.height * scale, depth + 0.002 + i * 0.0001);
      });
      this.image(tray, x - 11, ty, depth + 0.003);
    }
    if (server.ack > 0) {
      const ack = baked(this.textures, 'bubble-ack', 7, 10, paintAckBubble);
      this.image(ack, x - 3, y - height - 11, DEPTH.overlay);
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
      const key = baked(this.textures, `kitchen-${name}`, (w + 20) * WORLD_ART_DENSITY, (rise + 1) * WORLD_ART_DENSITY, raw => {
        const ctx = gridSafeContext(raw);
        ctx.scale(WORLD_ART_DENSITY, WORLD_ART_DENSITY); ctx.imageSmoothingEnabled = false; paint(ctx);
      });
      this.image(key, o.x + x - 10, o.y + foot - rise, DEPTH.floor + o.y + foot).setDisplaySize(w + 20, rise + 1);
    };
    const benchFoot = kitchenFloorY(BENCH.front);
    const tools = `${installed.has('sheeter')}-${installed.has('standMixer')}`;
    piece(`bench-${tools}`, BENCH.x, benchFoot, BENCH.w, BENCH_RISE, (ctx) =>
      paintBench(ctx, 10 + BENCH.w / 2, BENCH_RISE, installed.has('sheeter'), installed.has('standMixer')));
    const rack = this.sim.rack;
    piece(`rack-${rack.join(',')}`, RACK.x, kitchenFloorY(RACK.foot), RACK.w, RACK_RISE, (ctx) => paintRack(ctx, 10, RACK_RISE, rack));
    piece('bins', BINS.x, kitchenFloorY(BINS.foot), BINS.w, BINS_RISE, (ctx) => paintBins(ctx, 10, BINS_RISE));
    piece('dishpit', DISH_PIT.x, kitchenFloorY(DISH_PIT.foot), DISH_PIT.w + 10, DISH_PIT_RISE, (ctx) => paintDishPit(ctx, 10, DISH_PIT_RISE));
    if (installed.has('pastryFridge')) {
      const cakes = (['cheesecake', 'cake', 'eggtart'] as const).filter((id) => state.items[id] > 0);
      piece(`fridge-${cakes.join(',')}`, PASTRY_FRIDGE.x, kitchenFloorY(PASTRY_FRIDGE.foot), PASTRY_FRIDGE.w, FRIDGE_RISE, (ctx) =>
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
    const { x, y, bob, facing, scale, height, carryY } = this.drawWalker(cook, character(cook.look, 'cook'), standing, depth);
    const batch = cook.batch;
    if (!batch || !at) return;
    if (at.working) {
      const total = STATION_SECONDS[at.station] * styleStationMultiplier(this.getState());
      const w = Math.max(1, Math.round(18 * (1 - Math.max(0, batch.timer) / total)));
      // The same bar the baristas show while brewing.
      const by = y - height - 6;
      this.rect(x - 10, by, 20, 5, OUTLINE, DEPTH.overlay);
      this.rect(x - 9, by + 1, 18, 3, '#5a3a2a', DEPTH.overlay + 0.001);
      this.rect(x - 9, by + 1, w, 3, UI_ART.sage, DEPTH.overlay + 0.002);
      this.rect(x - 9, by + 1, w, 1, UI_ART.sageLight, DEPTH.overlay + 0.003);
      return;
    }
    if (facing === 'up') return;
    // Out of the oven once a hot station is behind them.
    const baked = batch.steps.slice(0, batch.step).some((s) => s === 'deckOven' || s === 'convection' || s === 'fryer');
    const tray = baked ? itemIcon(batch.item, false) : null;
    const ty = carryY ?? y - 17 * scale - (scale > 1 ? STANDING_LEG_EXTENSION : 0) - bob;
    this.rect(x - 7, ty, 14, 2, OUTLINE, depth + 0.003);
    this.rect(x - 6, ty, 12, 1, '#d7a35a', depth + 0.004);
    if (tray) this.image(tray, x - Math.floor(tray.width / 2), ty - tray.height + 1, depth + 0.002);
    else {
      this.rect(x - 5, ty - 3, 10, 3, OUTLINE, depth + 0.002);
      this.rect(x - 4, ty - 2, 8, 2, '#f1e3c4', depth + 0.0025);
    }
  }

  private cup(x: number, y: number, depth: number): void {
    const generated = getGeneratedTablewareAdapter()?.sprite('empty-cup-saucer');
    if (generated) { this.image(generated, x, y, depth); return; }
    const key = baked(this.textures, 'cup', 7, 7, paintServiceCup);
    this.image(key, x, y, depth);
  }

  private customerFrames(c: Customer): CharacterFrames {
    return character(c.look, 'customer', c.appearanceId);
  }

  /** One pose/anchor calculation shared by the sitter and its generated hand contact. */
  private seatedCustomerPose(index: number, side: 0 | 1, c: Customer, t: number, pairing?: LivingCatActor | null) {
    const logicalTable = tablePos(index), table = projectMainWorld(logicalTable);
    const logicalSeat = seatSpot(index, side);
    const frames = this.customerFrames(c);
    const pair = pairing === undefined
      ? [...this.view.livingCats.actors.values()].find(cat => cat.interaction?.guestId === c.id && cat.interaction.phase === 'response')
      : pairing;
    const still = this.motionPreference.matches || this.view.paused;
    const petFrame = pair?.interaction?.phase === 'response' && !still ? Math.floor(pair.interaction.elapsed / 0.65) % 2 : 0;
    const sprite = pair ? (side === 0 ? frames.sitPetRight : frames.sitPetLeft)[petFrame] : side === 0 ? frames.sitRight : frames.sitLeft;
    const bob = pair || still ? 0 : Math.floor(t * 1.1 + c.id) % 3 === 0 ? 1 : 0;
    const offset = referenceCharacterOffset(sprite);
    const ensemble = seatingGeometry(sprite);
    if(ensemble)return {sprite,pair,x:table.x+(side===0?-SEATING_LAYOUT.seatX:SEATING_LAYOUT.seatX)-ensemble.floor.x,
      y:table.y+SEATING_LAYOUT.floorY-ensemble.floor.y};
    // Existing cast keeps its character art but shares the new chair's cushion.
    if(seatingFurniture('table')){
      const hip=referenceCharacterContacts(sprite)?.seatContact;
      if(hip)return {sprite,pair,x:table.x+(side===0?-SEATING_LAYOUT.seatX:SEATING_LAYOUT.seatX)-hip.x,
        y:table.y-13-hip.y};
    }
    const cozy = cozySeatedGeometry(sprite);
    if(cozy) return {sprite,pair,x:logicalSeat.x + table.x-logicalTable.x+(side===0?-4:4)-cozy.hip.x,
      y:logicalSeat.y-10-cozy.hip.y};
    return { sprite, pair, x: logicalSeat.x + table.x - logicalTable.x - 9 + offset.x,
      y: logicalSeat.y - (CHAR_H + 5) + bob + offset.y };
  }

  private drawCustomer(c: Customer, depth: number): void {
    const standing = c.phase === 'queue' || c.phase === 'ordering' ? 'up' : 'down';
    const { x, y, bob, facing, scale, carryX, carryY } = this.drawWalker(c, this.customerFrames(c), standing, depth);
    if (c.hasCup && facing !== 'up') this.cup(carryX ?? (facing === 'left' ? x - 8 * scale : x + 4 * scale), carryY ?? y - 10 * scale - (scale > 1 ? STANDING_LEG_EXTENSION : 0) - bob, depth + 0.002);
  }

  /** A round table with its two chairs, anyone sitting at it, and their drinks. */
  private drawTable(index: number, t: number, depth: number, preview = false): void {
    const logicalTable = tablePos(index);
    const table = projectMainWorld(logicalTable);
    const tableShift = table.x - logicalTable.x;
    let d = depth;
    const next = () => (d += 0.001);
    const decor = this.getState?.().decor.equipped;
    const cloth = decor?.tablecloth ?? 'tablecloth_classic';
    const centerpiece = decor?.centerpiece ?? 'centerpiece_flowers';
    const ensembleTable = seatingFurniture('table');
    const area = tableArea(index);
    const baseTable = ensembleTable ?? (index < MAX_TABLES ? cozyCafeSprite('table') : undefined);
    const cozyTable = baseTable ? extensionTable(baseTable, area, cloth) : undefined;
    this.shadow(table.x + (cozyTable ? 2 : 0), table.y + 1, cozyTable ? cozyTable.width - 2 : 30, next(), cozyTable ? 0.25 : 0.2);
    if (cozyTable) this.shadow(table.x, table.y, 17, next(), 0.34, false);
    const diners = ([0, 1] as const).map((side) => {
      const id = preview ? undefined : this.sim.seats[index * 2 + side];
      const c = id != null ? this.sim.customers.find((cc) => cc.id === id) : undefined;
      return c && seated(c) ? c : undefined;
    });
    const sitter = (side: 0 | 1, c: Customer) => this.seatedCustomerPose(index, side, c, t);
    // Chairs (backs on the outside) and anyone sitting in them.
    for (const side of [0, 1] as const) {
      const logicalSeat = seatSpot(index, side);
      const s = ensembleTable ? {x:table.x+(side===0?-SEATING_LAYOUT.seatX:SEATING_LAYOUT.seatX),y:table.y+SEATING_LAYOUT.floorY} : { ...logicalSeat, x: logicalSeat.x + tableShift };
      this.shadow(s.x + 1, s.y + 1, cozyTable ? 18 : 14, next(), cozyTable ? 0.23 : 0.15);
      const chair = side === 0 ? CHAIR_RIGHT() : CHAIR_LEFT();
      const chairDepth = next();
      const c = diners[side];
      const pose = c ? sitter(side,c) : undefined;
      const seating = pose && seatingGeometry(pose.sprite);
      const embeddedChair = seating && seating.embeddedChair !== false;
      const ensembleChair = ensembleTable ? seatingFurniture('chair',side===1) : undefined;
      const cozyChair = cozyTable ? cozyCafeSprite('chair', side === 1) : undefined;
      if(!embeddedChair){
        if(ensembleChair)this.litImage(ensembleChair,s.x-(side===0?13:21),s.y-41,chairDepth, table);
        else if (cozyChair) this.litImage(cozyChair, side === 0 ? s.x - 12 : s.x - 8, s.y - cozyChair.height + 1, chairDepth, table);
        else if (!this.generatedPicture(side === 0 ? 'chair-right' : 'chair-left', side === 0 ? s.x - 10 : s.x - 8, s.y - 25, 18, 25, chairDepth)) {
          this.litImage(chair, side === 0 ? s.x - 9 : s.x - chair.width + 9, s.y - chair.height + 1, chairDepth, table);
        }
      }
      if(pose)this.litImage(pose.sprite,pose.x,pose.y,next(), table);
    }
    const top = extensionTable(TABLE(), area, cloth);
    const tableDepth = next();
    if (cozyTable) this.litImage(cozyTable, table.x - cozyTable.width / 2, table.y - cozyTable.height + 1 + (ensembleTable ? SEATING_LAYOUT.tableFloorY : 0), tableDepth, table);
    else if (!this.generatedPicture('table', table.x - 16.5, table.y - TABLE_TOP_DY - 5.4, 33, 33 * 462 / 563, tableDepth, area, cloth)) {
      this.litImage(top, table.x - TABLE_CX, table.y - top.height + 1, tableDepth, table);
    }
    const cy = table.y + (ensembleTable ? SEATING_LAYOUT.surfaceY : -TABLE_TOP_DY);
    const vaseDepth = next();
    const ornament=centerpieceSprite(centerpiece);
    if(ornament)this.litImage(ornament,table.x-ornament.width/2,cy-ornament.height,vaseDepth,table);
    // Seated customers lean over the table: their upper body goes on top again.
    for (const side of [0, 1] as const) {
      const c = diners[side];
      if (!c) continue;
      const { sprite, x, y, pair } = sitter(side, c);
      const ensemble=seatingGeometry(sprite);
      if(ensemble)this.litImage(ensemble.foreground,x,y,next(), table);
      else {
        const crop = worldCrop(sprite, 0, 0, sprite.width, cozySeatedGeometry(sprite)?.upperBody ?? CHAR_H - 8);
        this.litImage(sprite, x, y, next(), table).setCrop(crop.x, crop.y, crop.width, crop.height);
      }
      const contact = pair && this.getState().pets.some(p => p.id === pair.id && petActive(p)) &&
        referenceCharacterContacts(sprite)?.petContact;
      if (contact) {
        // The authored reaching hand is below the ordinary upper-body crop.
        // Redraw only its outer wrist/palm over the matched cat, never the torso,
        // lap or legs over the tablecloth. Crop remains in physical pixels.
        const left = Math.max(0, Math.floor(contact.x - 3));
        const top = Math.max(ensemble ? 0 : CHAR_H - 8, Math.floor(contact.y - 3));
        const hand = worldCrop(sprite, left, top, Math.ceil(contact.x + 2) - left, Math.ceil(contact.y + 2) - top);
        this.litImage(sprite, x, y, DEPTH.floor + pair.y + 0.008, table).setCrop(hand.x, hand.y, hand.width, hand.height);
      }
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
    return baked(this.textures, `tent-${n}`, w, 7, ctx => paintTableTent(ctx, n));
  }

  // ------------------------------------------------------------ above the room

  /** Quiet, static thought clouds: no extra motion even with reduced-motion enabled. */
  private drawThoughts(state: GameState, dt: number): void {
    const view = this.view;
    const bounds = areaBounds(view.area);
    const inRoom = (p: { x: number; y: number }) => p.x >= bounds.x && p.x < bounds.x + bounds.w && p.y >= bounds.y && p.y < bounds.y + bounds.h;
    let candidates = thoughtCandidates(this.sim, state).filter(inRoom);
    // Share the existing two-cloud/collision budget. A short response may remain
    // silent when the guest already spoke recently or there is no clear space.
    for (const cat of view.livingCats.actors.values()) {
      if (cat.interaction?.phase !== 'response') continue;
      const guest = this.sim.customers.find(c => c.id === cat.interaction!.guestId && seated(c));
      if (!guest || !inRoom(guest)) continue;
      const id = `customer:${guest.id}`;
      candidates = candidates.filter(c => c.id !== id);
      candidates.push({ id, key: 'pet.living.thought.response', x: guest.x, y: guest.y - CHAR_H - 5,
        priority: 8, context: `cat-response:${cat.id}` });
    }
    candidates = candidates.map(candidate => {
      const customer = candidate.id.startsWith('customer:') ? this.sim.customers.find(c => `customer:${c.id}` === candidate.id) : undefined;
      const foot = customer ?? { x: candidate.x, y: candidate.y + CHAR_H };
      const painted = customer ? this.customerPoint(customer) : projectMainWorld(foot);
      return { ...candidate, x: candidate.x + painted.x - foot.x,
        y: customer ? this.customerHeadTop(customer) : candidate.y - CHAR_H * (STANDING_CHARACTER_SCALE - 1) };
    });
    const enabled = !view.paused && !view.panning && !view.overview && !view.ghost && state.phase === 'open' && !document.hidden;
    const selected = this.thoughts.update(dt, `${view.area}:${getLocale()}:${bounds.h}`, enabled, candidates);
    if (!selected.length || !this.thoughtFontsReady) return;
    // Real head bounds and real task indicators are separate blockers. Generic
    // head padding used to sever the trail and lift thoughts away from their owner.
    const occupied: ThoughtRect[] = [];
    for (const c of this.sim.customers.filter(inRoom)) {
      const presented = this.customerPoint(c);
      const top = this.customerHeadTop(c);
      occupied.push({ x: presented.x - 9, y: top, w: 18, h: 18 });
      if (c.phase === 'ordering' || (c.soldOut && c.moodTimer > 0))
        occupied.push({ x: presented.x - 19, y: top - (c.vip ? 27 : 22), w: 38, h: c.vip ? 27 : 22 });
      if (c.vip) occupied.push({ x: presented.x - 5, y: top - 6, w: 10, h: 6 });
      if (c.mood === 'happy') occupied.push({ x: presented.x - 5, y: top - 19, w: 10, h: 17 });
      if ((c.phase === 'queue' && c.patience < 12) || (c.phase === 'waiting' && c.timer < 15))
        occupied.push({ x: presented.x - 5, y: top - 5, w: 12, h: 3 });
    }
    this.sim.baristas.forEach((b, i) => {
      const pose = this.sim.baristaPose(i);
      const p = { ...pose, ...projectMainWorld(pose) };
      const top = p.y - CHAR_H * STANDING_CHARACTER_SCALE;
      occupied.push({ x: p.x - 9, y: top, w: 18, h: 18 });
      if (this.sim.isBrewing(i)) occupied.push({ x: p.x - 10, y: top - 5, w: 20, h: 6 });
      if (b.calling > 0) occupied.push({ x: p.x - 9, y: top - 26, w: 18, h: 26 });
    });
    this.sim.servers.forEach(logical => {
      const p = { ...logical, ...projectMainWorld(logical) };
      occupied.push({ x: p.x - 9, y: p.y - CHAR_H * STANDING_CHARACTER_SCALE, w: 18, h: 18 });
      if (p.ack > 0) occupied.push({ x: p.x - 4, y: p.y - CHAR_H * STANDING_CHARACTER_SCALE - 12, w: 8, h: 12 });
    });
    this.sim.cooks.forEach((logical, i) => {
      const p = { ...logical, ...projectMainWorld(logical) };
      occupied.push({ x: p.x - 9, y: p.y - CHAR_H * STANDING_CHARACTER_SCALE, w: 18, h: 18 });
      if (this.sim.cookStation(i)?.working) occupied.push({ x: p.x - 10, y: p.y - CHAR_H * STANDING_CHARACTER_SCALE - 6, w: 20, h: 5 });
    });
    // Keep every cloud away from the small paired gesture, not just human heads.
    // Otherwise a neighboring guest's thought can cover the entire cat and hand.
    for (const cat of view.livingCats.actors.values()) {
      if (!cat.interaction || !inRoom(cat)) continue;
      const catBounds = { x: cat.x - 11, y: cat.y - 20, w: 22, h: 24 };
      occupied.push({ ...catBounds, ...projectMainAttachment(catBounds, cat) });
      const guest = this.sim.customers.find(c => c.id === cat.interaction!.guestId && seated(c));
      if (guest) occupied.push({ x: this.customerPoint(guest).x - 10, y: guest.y - 14, w: 20, h: 30 });
    }
    for (const f of this.floaters) occupied.push({ x: f.x - 24, y: f.pos.y - 10, w: 48, h: 20 });
    for (const c of selected) {
      const text = translate(c.key);
      const key = `thought-pixel-${signFontRevision()}-${getLocale()}-${c.key}`;
      if (!this.textures.exists(key)) {
        const lines = wrapThoughtText(text, getLocale() === 'zh');
        const w = thoughtBubbleWidth(Math.max(...lines.map(thoughtTextWidth)));
        const lettering = thoughtTextRaster(lines, '', w);
        const h = lettering.height;
        baked(this.textures, key, w * 2, h * 2, ctx => {
          ctx.scale(2, 2);
          paintThoughtFrame(ctx, w, h);
          // Center the painted ink itself, not the font's invisible ascent/descent.
          ctx.drawImage(lettering.canvas, 0, lettering.sourceY, w * 2, lettering.inkHeight, 0, lettering.textY, w, lettering.inkHeight / 2);
        });
      }
      const texture = this.textures.get(key).getSourceImage();
      const placement = placeThought(c, texture.width / 2, texture.height / 2, bounds, occupied);
      if (!placement) continue;
      occupied.push(placement, ...placement.dots);
      this.image(key, placement.x, placement.y, DEPTH.overlay + 10).setScale(1 / WORLD_ART_DENSITY);
      // The planner validated the complete chain. Never omit individual dots.
      for (const dot of placement.dots) {
        this.rect(dot.x, dot.y, dot.w, dot.h, UI_ART.brassShade, DEPTH.overlay + 10);
        if (dot.w > 2) this.rect(dot.x + 1, dot.y + 1, dot.w - 2, dot.h - 2, UI_ART.cream, DEPTH.overlay + 10.001);
      }
    }
  }

  private customerHeadTop(c: Customer): number {
    if (seated(c)) {
      const pose = this.seatedCustomerPose(Math.floor(c.seat / 2), (c.seat % 2) as 0 | 1, c, 0);
      return pose.y + (referenceCharacterContacts(pose.sprite)?.head?.y ?? 2);
    }
    const frame = this.customerFrames(c).stand;
    const contact = referenceCharacterContacts(frame);
    return Math.round(c.y) - (contact?.foot.y ?? CHAR_H) + (contact?.head?.y ?? 0);
  }

  private drawCustomerOverlay(c: Customer, t: number, depth: number): void {
    const x = Math.round(this.customerPoint(c).x * 2) / 2;
    const top = this.customerHeadTop(c);
    if (c.vip) this.image(crownSprite(), x - 4, top - 5, depth);
    if (c.phase === 'ordering') {
      const icons = [itemIcon(c.order), ...(c.extra ? [itemIcon(c.extra)] : [])];
      const bw = icons.length > 1 ? 34 : 20;
      const bh = 18;
      const bx = x - Math.floor(bw / 2);
      const by = top - bh - (c.vip ? 6 : 2);
      const bubble = baked(this.textures, `bubble-${bw}`, bw + 2, bh + 4, ctx => paintOrderFrame(ctx, bw, bh));
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
      const frame = baked(this.textures, 'bubble-out', 22, 20, paintSoldOutFrame);
      const cross = baked(this.textures, 'bubble-cross', 20, 18, paintSoldOutCross);
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
      if (e.kind === 'heart' && this.motionPreference.matches) continue;
      const point = this.view.effectPoint(e);
      if (e.kind !== 'bell') this.emitters[e.kind].emitParticleAt(point.x, point.y, 1);
      else {
        // Ding: the bell jiggles and throws off a few sparkles.
        this.bellRang = this.time.now / 1000;
        for (let i = 0; i < 3; i++) this.emitters.sparkle.emitParticleAt(point.x - 2 + Math.random() * 4, point.y - 6, 1);
      }
    }
    for (const sale of this.view.sales.splice(0)) this.addFloater(sale);
  }

  /** "+$12" rising from a sale and fading out. */
  private addFloater(e: Extract<SimEvent, { type: 'sale' }>): void {
    // Sale events are emitted 52 logical pixels above their customer feet.
    const customer = this.sim.customers.find(c => c.x === e.x && c.y === e.y + 52 && seated(c));
    const anchor = customer ? tablePos(Math.floor(customer.seat / 2)) : { x: e.x, y: e.y + 52 };
    const presented = projectMainAttachment(e, anchor);
    // Stack pop-ups that would land on top of a fresh one.
    let y = presented.y;
    while (this.floaters.some((f) => Math.abs(f.x - presented.x) < 28 && Math.abs(f.pos.y - y) < 8)) y -= 8;
    const text = '+' + formatMoney(e.amount);
    const w = textWidth(text);
    const view = this.view;
    const x = Math.min(view.viewX + view.viewWidth - w - 2, Math.max(view.viewX + 2, presented.x - w / 2));
    const object = this.add
      .container(Math.round(x), y, [
        this.add.bitmapText(0, 0, PIXEL_FONT_HALO, text),
        this.add.bitmapText(0, 0, e.vip ? PIXEL_FONT_VIP : PIXEL_FONT, text),
      ])
      .setDepth(DEPTH.floaters);
    const floater: Floater = { x: presented.x, pos: { y }, object };
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
    if (e.vip) for (let i = 0; i < 8; i++) this.view.sparkle(e.x + (Math.random() - 0.5) * 24, e.y + Math.random() * 14, anchor);
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
    const o = areaBounds(this.view.area);
    const H = o.h;
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
    const cells = this.ghostCells;
    const box = this.ghostBox.clear();
    const def = ghost && furnitureDef(ghost.id);
    this.ghostPiece.setVisible(!!def);
    if (!ghost || !def) {
      cells.clear();
      this.ghostMaskCache = null;
      return;
    }
    const polygon = (rect: { x: number; y: number; w: number; h: number }) =>
      projectMainCellOutline(rect, def.surface, this.view.area).map(point => new Phaser.Math.Vector2(point.x, point.y));
    const tables = mainTableCount(state);
    const maskKey = placementMaskKey(state, this.view.area, def.surface, ghost.skip);
    if (this.ghostMaskCache?.key !== maskKey || this.ghostMaskCache.cells !== cells) {
      cells.clear().fillStyle(color('#2a1410'), 0.3);
      const rows = def.surface === 'wall' ? WALL_ROWS : FLOOR_ROWS;
      const start = regionOffset(this.view.area) / CELL;
      for (let row = 0; row < rows; row++) {
        for (let col = start; col < start + COLS; col++) {
          if (cellFree(state, def.surface, col, row, tables, ghost.skip)) continue;
          const cell = cellRect(def.surface, col, row, 1, 1);
          cells.fillPoints(polygon(cell), true);
        }
      }
      this.ghostMaskCache = { key: maskKey, cells };
    }
    const rect = cellRect(def.surface, ghost.col, ghost.row, def.w, def.h);
    if (def.surface === 'wall') {
      // Wall pieces are repainted while held so a clock keeps time.
      const density = getGeneratedFurnitureAdapter()?.sprite(ghost.id) ? WORLD_ART_DENSITY : 1;
      const key = `ghost-wall-${ghost.id}-${density}x`;
      const w = def.w * CELL + PAD * 2;
      const h = def.h * CELL + PAD * 2;
      const texture = (this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, w * density, h * density)) as Phaser.Textures.CanvasTexture;
      texture.context.clearRect(0, 0, w * density, h * density);
      if (density > 1) { texture.context.save(); texture.context.scale(density, density); }
      paintWallFurniture(gridSafeContext(texture.context), ghost.id, PAD, PAD, t, now);
      if (density > 1) texture.context.restore();
      texture.refresh();
      const left = this.view.area === 'main' ? projectMainPlaneWorld(rect, MAIN_WALL_PLANE) : rect;
      const right = this.view.area === 'main' ? projectMainPlaneWorld({ x: rect.x + rect.w, y: rect.y }, MAIN_WALL_PLANE) : { x: rect.x + rect.w, y: rect.y };
      const scaleX = (right.x - left.x) / rect.w;
      this.ghostPiece.setTexture(key).setScale(scaleX / density, 1 / density).setPosition(left.x - PAD * scaleX, left.y - PAD);
    } else {
      const { cx, foot } = floorAnchor(def, ghost.col, ghost.row);
      const { key, dx, dy, density = 1 } = this.floorTexture(ghost.id);
      const painted = projectMainWorld({ x: cx, y: foot });
      this.ghostPiece.setTexture(key).setScale(1 / density).setPosition(painted.x + dx, painted.y + dy);
    }
    const fill = color(canPlace(state, ghost.id, ghost.col, ghost.row, tables, ghost.skip) && this.sim.furnitureSpaceClear(ghost.id, ghost.col, ghost.row) && this.view.catSpaceClear(ghost.id, ghost.col, ghost.row) ? GHOST_OK : GHOST_BAD);
    box.fillStyle(fill, 0.3 + Math.sin(t * 6) * 0.08);
    const outline = polygon(rect);
    box.fillPoints(outline, true);
    box.lineStyle(1, fill, 1);
    box.strokePoints(outline, true);
  }
}
