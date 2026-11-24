// The café drawn as the cross-section building (assets/generated/art-direction-v1), driven by the
// game's Sim. Nothing here decides anything: each frame it runs the page's tick, reads who is
// doing what (queueing, ordering, at a table, brewing, carrying plates, baking), and walks each
// person to the matching spot of floors-layout.ts. The Sim's own floor plan is shorter than the
// stairs here, so people walk faster the further they have to go, to arrive about when the Sim does.
import Phaser from 'phaser';
import { formatMoney } from '../../game/format';
import { CELL, COLS, WALL_ROWS, WALL_TOP, canPlace, cellFree, footprint, furnitureDef } from '../../game/furniture';
import { FLOOR_Y, SCENE_W } from '../../game/layout';
import { activeTableIndices, mainTableCount } from '../../game/regions';
import { SERVER_SPEED, WALK_SPEED, type Customer, type Sim, type Walker } from '../../game/sim';
import type { GameState } from '../../game/state';
import type { CafeView } from '../cafe-view';
import type { CafeHooks } from '../phaser/cafe-scene';
import {
  BARISTAS, COUNTER_FRONT, DISPLAY, DOOR, FLOOR_ART, LIFT_HATCH, LIFT_TOP, OVEN_MOUTH, PASS, QUEUE, SERVER_HOMES, SERVICE, STEAM,
  FRAME, FURNITURE_SPOTS, TABLE_FRONT, WALK, WORLD_W, building, cookHome, gameWallRectToPlate, kitchenPlace, kitchenSpot, plateToGameWall,
  restFocus, route, spotCell, spotOf, stepsLength, tableSeats, walkPace, worldPoint,
  type Building, type FloorId, type FloorPoint, type FurnitureSpot, type KitchenPlace, type Point, type Spot, type Step,
} from './floors-layout';
import { makeTextures } from './textures';
import { outerWallShown, setOuterWall } from '../../ui/floors-ui';

export const FLOORS_ART = `${import.meta.env.BASE_URL}assets/generated/floor-sample-v1/build/`;
export interface SheetSize { frameWidth: number; frameHeight: number }
/**
 * Decor layers of the ground floor ('1f') and the seating floors ('2f'), from
 * scripts/art-gen/floor-decor-build.py: the fixed layers drawn behind and in front of people, and for
 * each decor slot the layer of each item. An item without a layer on a floor draws nothing there.
 */
export type DecorManifest = Partial<Record<DecorFloor, { back: string[]; front: string[]; slots: Record<string, Record<string, string>> }>>;
type DecorFloor = '1f' | '2f';
const DECOR_FLOORS: Partial<Record<FloorId, DecorFloor>> = { ground: '1f', 'floor-2': '2f', 'floor-3': '2f' };
/** Back to front: the room, then its surfaces, then what stands in it, then what hangs over it. */
const BACK_LAYERS = ['shell', 'wallpaper', 'floor', 'rug', 'shadow', 'fixtures', 'tablecloth', 'centerpiece', 'neon', 'sill', 'curtain', 'ceiling'];
const FRONT_LAYERS = ['counter', 'fixtures-front'];
/** Back layers stack from this depth up, a step apart; wall furniture hangs between the shadows and the fixtures. */
const LAYER_DEPTH = -2, LAYER_STEP = .05;
const WALL_FURNITURE_DEPTH = LAYER_DEPTH + LAYER_STEP * (BACK_LAYERS.indexOf('fixtures') - .4);
/** Sprite size and surface of each furniture piece (scripts/art-gen/floor-furniture-build.py). */
export type FurnitureManifest = Record<string, { width: number; height: number; surface: 'floor' | 'wall' }>;
const furnitureKey = (id: string) => `furniture/${id}.webp`;
interface PlacedSprite { sprite: Phaser.GameObjects.Image; index: number; at: Point }
/** Where a piece shows: a floor spot, or a box on the ground floor's back wall (plate pixels); `game` is a point of the game's grid inside it. */
interface PiecePlace { spot?: FurnitureSpot; box?: { x: number; y: number; w: number; h: number }; game: Point }
/** What the page's arrange mode is doing (main.ts `Arrange`). */
type ArrangeState = { mode?: string; id?: string } | null | undefined;
/** Cells of the sheets cut by scripts/art-gen/soft-frames.mjs. */
const SIDE = { walk: [0, 1, 2, 3], front: 4, happy: 5, side: 6, back: 7 } as const;
const MOVES = { down: [0, 1, 2, 3], up: [4, 5, 6, 7], sit: 8, hold: 9, sip: 10, laugh: 11 } as const;
const WORK = { task: [0, 1, 2, 3], carry: [4, 5, 6, 7] } as const;
/**
 * Each of the Sim's guests has a look of their own, `cast-NN` by appearance, loaded the first time
 * they come in. These four general looks load up front and stand in for a look still loading.
 */
export const GUEST_ART = ['guest-beret', 'guest-hoodie', 'guest-cardigan', 'guest-curls'] as const;
const castArt = (appearance: number) => `cast-${String(appearance).padStart(2, '0')}`;
/** How long a new guest waits unseen at the door for their own look before borrowing one. */
const LOOK_WAIT = 2;
export const SHEETS = ['owner', 'barista', ...GUEST_ART, ...GUEST_ART.map(key => `${key}-moves`),
  'cook-chef', 'cook-scarf', 'cook-chef-work', 'cook-scarf-work'];
const IMAGES = ['frame/attic', 'floor-2', 'floor-1', 'basement', 'counter-front', 'table-front',
  'frame/sky', 'frame/pillar', 'frame/beam', 'frame/street', 'frame/soil',
  'frame/awning', 'frame/door-left', 'frame/door-right', 'frame/step', 'frame/side-window',
  'frame/wall-attic', 'frame/wall-seating', 'frame/wall-ground'];
/**
 * The frame's colours where its pictures end (build/frame/frame.json): the sky above the sky
 * picture's top, the hedge under the street's bottom, the earth under the soil's.
 */
const FRAME_EDGES = { sky: 0x8dc3fc, street: 0x656c34, soil: 0x65362b } as const;
/** Pillars and beams stand in front of everyone; the page's arrange marks and bubbles stay above them. */
const FRAME_DEPTH = 50000;
/** Where the roof's slopes reach the sides, below the top floor's plate top (build/frame/frame.json `eave` less `plateTop`). */
const EAVE = 123;
/** The ground floor's open front: the awning tucks under the beam, this far below the floor's top, and is drawn this tall. */
const AWNING = { top: 18, height: 84 } as const;
/** Where the window that replaced the ground floor's side door sits on its plate (build/frame/frame.json). */
const SIDE_WINDOW = { x: 0, y: 40 } as const;
/** Each storey's front wall, shown when the player closes the building (build/frame/wall-*). */
const WALLS: Partial<Record<FloorId, string>> = { roof: 'frame/wall-attic', 'floor-3': 'frame/wall-seating', 'floor-2': 'frame/wall-seating', ground: 'frame/wall-ground' };
/** The front walls stand in front of everyone inside, under the pillars, beams and awning. */
const WALL_DEPTH = FRAME_DEPTH - 3;
/** How much faster than at a stroll their legs move at most, however fast the player runs the day. */
const LEGS = 3;
/** Seconds of play until the Sim has someone at the end of their way. */
function simSeconds(w: Walker, speed: number): number {
  let x = w.tx, y = w.ty, length = Math.hypot(w.tx - w.x, w.ty - w.y);
  for (const p of w.via) { length += Math.hypot(p.x - x, p.y - y); x = p.x; y = p.y; }
  return length / speed;
}
/** How far past its ends the building can be dragged, as a share of the screen. */
const OVERSCROLL = 1 / 3;

type Way = 'side' | 'down' | 'up';
interface Actor {
  sprite: Phaser.GameObjects.Sprite;
  art: string;
  at: FloorPoint;
  /** The walkway of the floor the actor is standing on, for the next route. */
  aisle: number;
  steps: Step[];
  /** What the steps lead to; a new goal plans a new route. */
  goal: string;
  cup?: Phaser.GameObjects.Image;
  clock: number;
  seen: boolean;
  /** How many times a stroll they are walking at now; their legs keep up. */
  rate: number;
  /** The guest's own look while it loads; `art` stands in meanwhile. */
  wants?: string;
}

export class FloorsScene extends Phaser.Scene {
  status = 'waiting for Phaser';
  private ready = false;
  private built: Building | null = null;
  private floorImages: Phaser.GameObjects.Image[] = [];
  /** The decor layers the building is drawn with, and those still loading. */
  private decorSignature = '';
  private loadingDecor = new Set<string>();
  /** Placed furniture on the ground floor, the free cells shown while arranging, and the piece in hand. */
  private placed: PlacedSprite[] = [];
  private placedSignature = '';
  private freeCells!: Phaser.GameObjects.Graphics;
  private freeSignature = '';
  private ghostMark!: Phaser.GameObjects.Graphics;
  private ghostSprite: Phaser.GameObjects.Image | null = null;
  private arranging = false;
  private earth!: Phaser.GameObjects.Rectangle;
  private sky!: Phaser.GameObjects.Image;
  private street!: Phaser.GameObjects.Image;
  private soilBand!: Phaser.GameObjects.Image;
  private soilBelow!: Phaser.GameObjects.Image;
  private frameParts: Phaser.GameObjects.GameObject[] = [];
  /** The front walls, and the open front's folded doors that they replace. */
  private walls: Phaser.GameObjects.Image[] = [];
  private openDoors: Phaser.GameObjects.Image[] = [];
  /** How far the walls have faded in, 0 (open) to 1 (closed). */
  private wallAlpha = 0;
  private counterFront!: Phaser.GameObjects.Image;
  private tableFront!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private customers = new Map<number, Actor>();
  private servers: Actor[] = [];
  private cooks: Actor[] = [];
  private baristas: Phaser.GameObjects.Sprite[] = [];
  private calling: boolean[] = [];
  private moods = new Map<number, string | null>();
  private rack: unknown = null;
  private steamTimer = 0;
  /** Guest looks with their sheets and walks ready, and those on their way. */
  private looks = new Set<string>(GUEST_ART);
  private loadingLooks = new Set<string>();
  /** World y at the middle of the screen. */
  private focusY = 0;
  /** Whether the player (or something they asked to see) has moved the camera from where it rests. */
  private moved = false;
  /** How many times faster than real time the day runs; people walk at its speed. */
  private tempo = 1;
  private dragY: number | null = null;
  /** Where a press started, in canvas pixels: a press that barely moves is a tap. */
  private pressAt: { x: number; y: number } | null = null;
  /** The cue over the moment waiting on the player. */
  private cue: Phaser.GameObjects.Image | null = null;

  constructor(private view: CafeView, private sim: Sim, private getState: () => GameState, private hooks: CafeHooks,
    private sheets: Record<string, SheetSize>, private onFirstFrame: () => void, private onFailed: (error: Error) => void,
    private decor: DecorManifest | null = null, private furniture: FurnitureManifest | null = null) {
    super('floors');
  }

  preload(): void {
    this.status = 'loading art';
    for (const key of IMAGES) this.load.image(key, `${FLOORS_ART}${key}.webp`);
    for (const key of SHEETS) this.load.spritesheet(key, `${FLOORS_ART}${key}.webp`, this.sheets[key]);
    // The decor the café has on now, for both decorated floors: the building may grow into the second.
    const equipped = this.getState().decor.equipped as Record<string, string>;
    const decor = (['1f', '2f'] as const).flatMap(kind => this.decorLayers(kind, equipped).map(l => l.key));
    for (const key of decor) this.load.image(key, `${FLOORS_ART}${key}`);
    const pieces = [...new Set(this.getState().decor.placed.map(p => p.id).filter(id => this.furniture?.[id]))].map(furnitureKey);
    for (const key of pieces) this.load.image(key, `${FLOORS_ART}${key}`);
    const total = IMAGES.length + SHEETS.length + decor.length + pieces.length;
    this.load.on('progress', (share: number) => this.hooks.loadingProgress?.(Math.round(share * total), total));
    this.load.on('loaderror', (file: { key: string }) => this.onFailed(new Error(`Could not load floors art ${file.key}`)));
  }

  create(): void {
    makeTextures(this);
    this.cameras.main.setBackgroundColor(FRAME_EDGES.sky);
    this.earth = this.add.rectangle(0, 0, WORLD_W, 4000, FRAME_EDGES.street).setOrigin(0, 0).setDepth(-3);
    this.sky = this.add.image(0, 0, 'frame/sky').setOrigin(0, 1).setDepth(-10);
    this.street = this.add.image(0, 0, 'frame/street').setOrigin(0, 0).setDepth(-3);
    // The street cut open over a basement: its paving and the top of the earth, then earth under the basement.
    this.soilBand = this.add.image(0, 0, 'frame/soil').setOrigin(0, 0).setDepth(-3).setCrop(0, 0, WORLD_W, FRAME.soilBand);
    this.soilBelow = this.add.image(0, 0, 'frame/soil').setOrigin(0, 0).setDepth(-3).setCrop(0, FRAME.soilBand, WORLD_W, FRAME.soilBelow);
    this.counterFront = this.add.image(0, 0, 'counter-front').setOrigin(0, 0);
    this.tableFront = this.add.image(0, 0, 'table-front').setOrigin(0, 0);
    this.freeCells = this.add.graphics().setDepth(99000);
    this.ghostMark = this.add.graphics().setDepth(99500);
    this.glow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(1);
    const rate = WALK / 30;
    for (const key of [...GUEST_ART, 'owner', 'barista', 'cook-chef', 'cook-scarf']) {
      this.anims.create({ key: `${key}-side`, frames: this.anims.generateFrameNumbers(key, { frames: [...SIDE.walk] }), frameRate: rate, repeat: -1 });
    }
    for (const key of GUEST_ART) this.guestWalks(key);
    // Guest looks loaded later must not move the page's startup progress.
    this.load.off('progress');
    this.load.on('filecomplete', () => {
      for (const look of this.loadingLooks) {
        if (!this.textures.exists(look) || !this.textures.exists(`${look}-moves`)) continue;
        this.anims.create({ key: `${look}-side`, frames: this.anims.generateFrameNumbers(look, { frames: [...SIDE.walk] }), frameRate: WALK / 30, repeat: -1 });
        this.guestWalks(look);
        this.loadingLooks.delete(look);
        this.looks.add(look);
      }
    });
    for (const key of ['cook-chef', 'cook-scarf']) {
      this.anims.create({ key: `${key}-carry`, frames: this.anims.generateFrameNumbers(`${key}-work`, { frames: [...WORK.carry] }), frameRate: rate, repeat: -1 });
    }
    this.anims.create({ key: 'cook-chef-oven', frames: this.anims.generateFrameNumbers('cook-chef-work', { frames: [0, 1, 1, 2] }), frameRate: 1.5, repeat: -1 });
    this.anims.create({ key: 'cook-scarf-knead', frames: this.anims.generateFrameNumbers('cook-scarf-work', { frames: [...WORK.task] }), frameRate: 4, repeat: -1 });

    // Drag (or scroll) the building up and down.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragY = p.y; this.pressAt = { x: p.x, y: p.y }; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragY === null || !p.isDown) return;
      this.focusY -= (p.y - this.dragY) / this.cameras.main.zoom;
      this.moved = true;
      this.dragY = p.y;
      this.frameCamera();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const press = this.pressAt;
      this.dragY = this.pressAt = null;
      if (press && Math.hypot(p.x - press.x, p.y - press.y) <= this.cssToCanvas(10)) {
        const at = this.cameras.main.getWorldPoint(p.x, p.y);
        this.tap(at.x, at.y);
      }
    });
    this.input.on('pointerupoutside', () => { this.dragY = this.pressAt = null; });
    this.input.on('wheel', (_p: unknown, _over: unknown, _dx: number, dy: number) => { this.focusY += dy / this.cameras.main.zoom; this.moved = true; this.frameCamera(); });

    this.ready = true;
    this.status = 'drawing';
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => { this.status = 'running'; this.onFirstFrame(); });
  }

  private guestWalks(key: string): void {
    const rate = WALK / 30;
    this.anims.create({ key: `${key}-down`, frames: this.anims.generateFrameNumbers(`${key}-moves`, { frames: [...MOVES.down] }), frameRate: rate, repeat: -1 });
    this.anims.create({ key: `${key}-up`, frames: this.anims.generateFrameNumbers(`${key}-moves`, { frames: [...MOVES.up] }), frameRate: rate, repeat: -1 });
  }

  /** Starts loading a guest's own look, if there is one and it isn't here yet. */
  private requestLook(look: string): boolean {
    if (this.looks.has(look)) return true;
    if (!this.sheets[look] || !this.sheets[`${look}-moves`]) return false;
    if (!this.loadingLooks.has(look)) {
      this.loadingLooks.add(look);
      for (const key of [look, `${look}-moves`]) this.load.spritesheet(key, `${FLOORS_ART}${key}.webp`, this.sheets[key]);
      if (!this.load.isLoading()) this.load.start();
    }
    return false;
  }

  /**
   * The building's frame (build/frame): the sky behind the roof, a pillar down each side from the
   * eaves to the street, a beam over each join between floors, and the street at the ground floor,
   * or with a basement the street cut open over it and the earth around it.
   */
  private layoutFrame(b: Building): void {
    for (const part of this.frameParts) part.destroy();
    const roof = b.offsets.roof ?? 0, eave = roof + EAVE;
    this.sky.setY(eave + 120);
    const span = b.street - eave;
    this.frameParts = [
      this.add.tileSprite(0, eave, FRAME.pillar, span, 'frame/pillar').setOrigin(0, 0).setDepth(FRAME_DEPTH),
      this.add.tileSprite(WORLD_W - FRAME.pillar, eave, FRAME.pillar, span, 'frame/pillar').setOrigin(0, 0).setFlipX(true).setDepth(FRAME_DEPTH),
      // A beam over each join above the street.
      ...b.floors.slice(1).filter(floor => floor !== 'basement').map(floor =>
        this.add.image(0, b.offsets[floor]!, 'frame/beam').setOrigin(0, .5).setDisplaySize(WORLD_W, FRAME.beam).setDepth(FRAME_DEPTH - 1)),
    ];
    // The ground floor's open front: awning, folded-back doors at its corners, the step guests come in by.
    const ground = b.offsets.ground ?? 0;
    this.frameParts.push(
      this.add.image(FRAME.pillar, ground + AWNING.top, 'frame/awning').setOrigin(0, 0)
        .setDisplaySize(WORLD_W - 2 * FRAME.pillar, AWNING.height).setDepth(FRAME_DEPTH - 2),
      ...(this.openDoors = [
        this.add.image(FRAME.pillar, b.street, 'frame/door-left').setOrigin(0, 1).setDepth(FRAME_DEPTH - 2),
        this.add.image(WORLD_W - FRAME.pillar, b.street, 'frame/door-right').setOrigin(1, 1).setDepth(FRAME_DEPTH - 2),
      ]),
      this.add.image(DOOR.x, b.street - 16, 'frame/step').setOrigin(.5, 0).setDepth(b.street - 1),
      // The old side door is a window now, drawn over the decor's wall and floor, under its tables.
      this.add.image(SIDE_WINDOW.x, worldPoint(b, { floor: 'ground', ...SIDE_WINDOW }).y, 'frame/side-window').setOrigin(0, 0)
        .setDepth(LAYER_DEPTH + LAYER_STEP * (BACK_LAYERS.indexOf('fixtures') + .5)),
    );
    // The front walls; underground, the basement is hidden in the earth.
    this.walls = b.floors.flatMap(floor => {
      const y = b.offsets[floor]!, key = WALLS[floor];
      if (key) return [this.add.image(0, y - (FLOOR_ART[floor].above ?? 0), key).setOrigin(0, 0).setDepth(WALL_DEPTH)];
      // The soil picture below its paving, stretched over the basement and the earth under it.
      const soil = this.textures.getFrame('frame/soil'), rows = soil.height - FRAME.soilBand;
      const stretch = (FLOOR_ART[floor].height + FRAME.soilBelow) / rows;
      return [this.add.image(0, y - FRAME.soilBand * stretch, 'frame/soil').setOrigin(0, 0).setScale(1, stretch)
        .setCrop(0, FRAME.soilBand, WORLD_W, rows).setDepth(WALL_DEPTH)];
    });
    this.frameParts.push(...this.walls);
    this.showWalls(0);
    const basement = b.offsets.basement;
    this.street.setY(b.street).setVisible(basement === undefined);
    this.soilBand.setY(b.street).setVisible(basement !== undefined);
    if (basement !== undefined) this.soilBelow.setY(basement + FLOOR_ART.basement.height - FRAME.soilBand);
    this.soilBelow.setVisible(basement !== undefined);
    this.earth.setY(b.height).setFillStyle(basement === undefined ? FRAME_EDGES.street : FRAME_EDGES.soil);
  }

  /**
   * Fades the front walls towards the player's choice: closed seen from the street, open while
   * arranging furniture. `dt` 0 just applies the current fade.
   */
  private showWalls(dt: number): void {
    const target = outerWallShown() && !this.arranging ? 1 : 0;
    this.wallAlpha = dt ? Phaser.Math.Linear(this.wallAlpha, target, Math.min(1, dt * 8)) : this.wallAlpha;
    if (Math.abs(this.wallAlpha - target) < .01) this.wallAlpha = target;
    for (const wall of this.walls) wall.setAlpha(this.wallAlpha).setVisible(this.wallAlpha > 0);
    for (const door of this.openDoors) door.setAlpha(1 - this.wallAlpha);
  }

  /** Someone out on the street, in front of the ground floor, stands in front of the building's front walls. */
  private depthAt(p: FloorPoint): number {
    const y = this.built ? worldPoint(this.built, p).y : p.y;
    return this.built && p.floor === 'ground' && y > this.built.street ? y + FRAME_DEPTH : y;
  }

  /** The canvas changed size: fit the building's width to it. */
  resized(): void {
    if (!this.ready) return;
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(this.scale.width / WORLD_W);
    this.frameCamera();
  }

  private frameCamera(): void {
    const b = this.built;
    if (!b) return;
    const cam = this.cameras.main, view = cam.height / cam.zoom, half = view / 2;
    const rest = restFocus(b, view);
    if (!this.moved) this.focusY = rest;
    // The building can be dragged a third of a screen up into the sky, and down to its bottom.
    const slack = view * OVERSCROLL;
    const low = Math.min(rest, half) - slack, high = Math.max(rest, b.height - half) + slack / 3;
    this.focusY = Phaser.Math.Clamp(this.focusY, low, high);
    cam.centerOn(WORLD_W / 2, this.focusY);
  }

  /** The layers a decorated floor draws with this decor on: texture key (its file under FLOORS_ART), and whether it stands in front of people. */
  private decorLayers(kind: DecorFloor, equipped: Record<string, string>): { key: string; front: boolean; order: number }[] {
    const entry = this.decor?.[kind];
    if (!entry) return [];
    const pick = (name: string, fixed: string[]) => fixed.find(path => path.endsWith(`/${name}.webp`)) ?? entry.slots[name]?.[equipped[name]];
    return [
      ...BACK_LAYERS.map((name, order) => ({ key: pick(name, entry.back), front: false, order })),
      ...FRONT_LAYERS.map((name, order) => ({ key: pick(name, entry.front), front: true, order })),
    ].filter((layer): layer is { key: string; front: boolean; order: number } => !!layer.key);
  }

  /** Starts loading decor layers not here yet; the building keeps its old look until they are. */
  private requestDecor(keys: string[]): void {
    let queued = false;
    for (const key of keys) {
      if (this.loadingDecor.has(key)) continue;
      this.loadingDecor.add(key);
      this.load.image(key, `${FLOORS_ART}${key}`);
      queued = true;
    }
    if (queued && !this.load.isLoading()) this.load.start();
  }

  /** Lays out the floors the café has, in its decor, keeping the ground floor where it was on screen. */
  private layoutBuilding(state: GameState): Building {
    const next = building(activeTableIndices(state).length, state.kitchen);
    const before = this.built;
    const equipped = state.decor.equipped as Record<string, string>;
    const layers = (floor: FloorId) => {
      const kind = DECOR_FLOORS[floor];
      return kind ? this.decorLayers(kind, equipped) : [];
    };
    const wanted = next.floors.flatMap(floor => layers(floor).map(l => l.key));
    const missing = wanted.filter(key => !this.textures.exists(key));
    if (missing.length) this.requestDecor(missing);
    const signature = next.floors.join() + '|' + wanted.join();
    const sameFloors = !!before && before.floors.join() === next.floors.join();
    if (before && sameFloors && (signature === this.decorSignature || missing.length)) return before;
    for (const image of this.floorImages) image.destroy();
    const counterDepth = worldPoint(next, COUNTER_FRONT).y;
    this.floorImages = next.floors.flatMap(floor => {
      const y = next.offsets[floor]!, decor = layers(floor).filter(l => this.textures.exists(l.key));
      if (!decor.length) return [this.add.image(0, y - (FLOOR_ART[floor].above ?? 0), FLOOR_ART[floor].image).setOrigin(0, 0).setDepth(LAYER_DEPTH)];
      return decor.map(l => this.add.image(0, y, l.key).setOrigin(0, 0)
        .setDepth(l.front ? counterDepth + l.order * .01 : LAYER_DEPTH + l.order * LAYER_STEP));
    });
    this.decorSignature = missing.length ? '' : signature;
    this.layoutFrame(next);
    const groundTop = worldPoint(next, { floor: 'ground', x: 0, y: 0 }).y;
    // Drawn with decor layers, the ground floor's counter is one of them.
    this.counterFront.setY(groundTop).setDepth(counterDepth).setVisible(!layers('ground').length);
    const kitchen = next.offsets.basement !== undefined;
    this.tableFront.setVisible(kitchen);
    if (kitchen) this.tableFront.setY(worldPoint(next, { floor: 'basement', x: 0, y: 0 }).y).setDepth(worldPoint(next, TABLE_FRONT).y);
    // A new branch starts small: the camera goes back to rest. A building that grows keeps the
    // ground floor where the player put it on screen.
    if (before && next.floors.length < before.floors.length) this.moved = false;
    else if (before && this.moved) this.focusY += (next.offsets.ground ?? 0) - (before.offsets.ground ?? 0);
    this.built = next;
    this.resized();
    return next;
  }

  update(_time: number, delta: number): void {
    if (!this.ready) return;
    const dt = Math.min(0.25, Math.max(0, delta / 1000));
    // The page's tick runs the game itself, so it keeps running while the café is hidden.
    this.hooks.tick(dt);
    this.cameras.main.visible = !this.view.renderSuspended;
    if (this.view.renderSuspended) { this.drainView(); return; }
    const state = this.getState();
    const b = this.layoutBuilding(state);
    this.showWalls(dt);
    const active = activeTableIndices(state);
    const step = this.view.paused ? 0 : dt;
    this.tempo = state.phase === 'prep' ? 1 : state.speed;
    this.syncCustomers(b, active, step);
    this.syncBaristas(b, step);
    this.syncServers(b, active, step);
    this.syncCooks(b, step);
    this.restock(b);
    this.syncFurniture(b, state);
    this.syncArrange(b, state);
    this.showMoment(b);
    this.drainView();
  }

  private cssToCanvas(css: number): number {
    return css * this.scale.width / Math.max(1, this.game.canvas.clientWidth);
  }

  // ------------------------------------------------------------ taps

  /** Matches a tap to what is under it: the waiting moment, a named partner, or the café itself. */
  private tap(x: number, y: number): void {
    if (this.hooks.interactionEnabled && !this.hooks.interactionEnabled()) return;
    if (this.arrangeTap(x, y)) return;
    const target = this.hooks.tapTarget;
    if (!target) return;
    // Touchable at 44 CSS pixels, like the room's own targets.
    const reach = this.cssToCanvas(22) / this.cameras.main.zoom;
    const moment = this.view.moment;
    // Behind the walls only the cue floating over them can be touched; people are reached once it opens.
    const walled = this.wallAlpha > .5 && !!this.built && y < this.built.street;
    const subject = moment?.customerId === undefined || walled ? undefined : this.customers.get(moment.customerId);
    if (moment && ((this.cue?.visible && Math.hypot(x - this.cue.x, y - (this.cue.y - this.cue.displayHeight / 2)) <= reach + this.cue.displayWidth / 2)
        || (subject && subject.sprite.getBounds().contains(x, y)))) {
      target({ kind: 'moment' });
      return;
    }
    const staff: [Phaser.GameObjects.Sprite, string | undefined][] = [
      ...this.sim.baristas.map((b, i) => [this.baristas[i], b.partnerId] as [Phaser.GameObjects.Sprite, string | undefined]),
      ...this.sim.servers.map((s, i) => [this.servers[i]?.sprite, s.partnerId] as [Phaser.GameObjects.Sprite, string | undefined]),
      ...this.sim.cooks.map((c, i) => [this.cooks[i]?.sprite, c.partnerId] as [Phaser.GameObjects.Sprite, string | undefined]),
    ];
    const partner = walled ? undefined : staff.filter(([sprite, id]) => id && sprite?.visible && sprite.getBounds().contains(x, y))
      .sort(([a], [b]) => b.y - a.y)[0];
    if (partner) { target({ kind: 'partner', id: partner[1]! }); return; }
    // With the walls up the café plays on behind its windows; a tap on the wall itself opens it.
    if (walled) { setOuterWall(false); return; }
    target({ kind: 'cafe' });
  }

  /** Bobs a cue over the moment's guest, or over the parcel at the door or the cats on the roof. */
  private showMoment(b: Building): void {
    const moment = this.view.moment;
    let at: { x: number; y: number } | null = null;
    if (moment?.customerId !== undefined) {
      const actor = this.customers.get(moment.customerId);
      if (actor && actor.sprite.alpha > .5) at = this.head(actor);
    } else if (moment?.kind === 'delivery') at = worldPoint(b, { floor: 'ground', x: DOOR.x + 30, y: DOOR.y - 250 });
    else if (moment) at = worldPoint(b, { floor: 'roof', x: 790, y: 560 });
    if (!at) { this.cue?.setVisible(false); return; }
    this.cue ??= this.add.image(0, 0, 'bubble-moment').setOrigin(.5, 1).setDepth(100002).setScale(1.5);
    this.cue.setVisible(true).setPosition(at.x, at.y - 14 * Math.abs(Math.sin(this.time.now / 260)));
  }

  // ------------------------------------------------------------ furniture

  /** Where a piece shows: at its spot (floor) or in its box on the ground floor's back wall, with a game point inside it. */
  private piecePlace(id: string, col: number, row: number, spot?: FurnitureSpot): PiecePlace | null {
    const def = furnitureDef(id);
    if (!def || col * CELL < 0 || (col + def.w) * CELL > SCENE_W) return null;
    if (def.surface === 'floor') {
      if (!spot) return null;
      return { spot, game: { x: (col + def.w / 2) * CELL, y: FLOOR_Y + (row + def.h) * CELL - 3 } };
    }
    const rect = footprint(def, col, row), box = gameWallRectToPlate(rect);
    return box ? { box, game: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } } : null;
  }

  /** Puts a furniture sprite at its place: standing on its spot, no wider than the spot allows, or fitted into its box on the wall. */
  private placeSprite(b: Building, sprite: Phaser.GameObjects.Image, id: string, place: PiecePlace): boolean {
    const size = this.furniture?.[id];
    if (!size) return false;
    if (place.spot) {
      if (b.offsets[place.spot.floor] === undefined) return false;
      const at = worldPoint(b, place.spot);
      sprite.setOrigin(.5, 1).setPosition(at.x, at.y).setScale(Math.min(1, place.spot.room / size.width)).setDepth(at.y);
    } else if (place.box) {
      if (b.offsets.ground === undefined) return false;
      const top = worldPoint(b, { floor: 'ground', x: place.box.x, y: place.box.y });
      const scale = Math.min(place.box.w / size.width, place.box.h / size.height);
      sprite.setOrigin(.5, .5).setPosition(top.x + place.box.w / 2, top.y + place.box.h / 2).setScale(scale).setDepth(WALL_FURNITURE_DEPTH);
    }
    return true;
  }

  /**
   * Draws the main café's placed furniture, loading pieces the first time they appear. A floor piece
   * placed off the spots (in the room view, or before this building) takes the nearest free spot.
   */
  private syncFurniture(b: Building, state: GameState): void {
    const taken = new Set<FurnitureSpot>();
    const pieces = this.furniture ? state.decor.placed.flatMap((p, index) => {
      const def = furnitureDef(p.id);
      if (!def || !this.furniture![p.id]) return [];
      return [{ p, index, def, spot: def.surface === 'floor' ? spotOf(p.col, p.row, def.w, def.h) : undefined }];
    }) : [];
    for (const piece of pieces) if (piece.spot) taken.add(piece.spot);
    for (const piece of pieces) {
      if (piece.def.surface !== 'floor' || piece.spot) continue;
      const centre = piece.p.col + piece.def.w / 2, front = piece.p.row + piece.def.h - 1;
      piece.spot = FURNITURE_SPOTS.filter(spot => !taken.has(spot))
        .sort((a, c) => Math.hypot(a.col - centre, a.row - front) - Math.hypot(c.col - centre, c.row - front))[0];
      if (piece.spot) taken.add(piece.spot);
    }
    const shown = pieces.flatMap(piece => {
      const place = this.piecePlace(piece.p.id, piece.p.col, piece.p.row, piece.spot);
      return place ? [{ ...piece, place }] : [];
    });
    const missing = shown.map(({ p }) => furnitureKey(p.id)).filter(key => !this.textures.exists(key));
    if (missing.length) this.requestDecor(missing);
    const signature = JSON.stringify(shown.map(({ p, index, spot }) => [p.id, p.col, p.row, index, spot?.col])) + `|${b.floors.join()}|${missing.length}`;
    if (signature !== this.placedSignature) {
      this.placedSignature = signature;
      for (const piece of this.placed) piece.sprite.destroy();
      this.placed = shown.filter(({ p }) => this.textures.exists(furnitureKey(p.id))).flatMap(({ p, index, place }) => {
        const sprite = this.add.image(0, 0, furnitureKey(p.id));
        if (this.placeSprite(b, sprite, p.id, place)) return [{ sprite, index, at: place.game }];
        sprite.destroy();
        return [];
      });
    }
    // The piece being moved shows as the ghost instead.
    const moving = this.arranging ? this.view.ghost?.skip ?? -1 : -1;
    for (const piece of this.placed) piece.sprite.setVisible(piece.index !== moving);
  }

  /** The spots a floor piece can go to now, on floors the building has. */
  private openSpots(b: Building, state: GameState, id: string, skip: number): FurnitureSpot[] {
    const def = furnitureDef(id);
    if (!def || def.surface !== 'floor') return [];
    const tables = mainTableCount(state);
    return FURNITURE_SPOTS.filter(spot => {
      if (b.offsets[spot.floor] === undefined) return false;
      const { col, row } = spotCell(spot, def.w, def.h);
      return canPlace(state, id, col, row, tables, skip) && this.sim.furnitureSpaceClear(id, col, row) && this.view.catSpaceClear(id, col, row);
    });
  }

  /** While arranging: the open spots (or free wall cells) for the piece in hand, and the piece where it would go, red where it can't. */
  private syncArrange(b: Building, state: GameState): void {
    const arrange = this.hooks.interactionState?.() as ArrangeState;
    const ground = b.offsets.ground !== undefined;
    if (!!arrange !== this.arranging) {
      this.arranging = !!arrange;
      // Arranging happens downstairs: bring the ground floor into view.
      if (arrange && ground) { this.moved = true; this.focusY = worldPoint(b, { floor: 'ground', x: 0, y: 500 }).y; this.frameCamera(); }
    }
    let ghost = arrange?.mode === 'place' ? this.view.ghost : null;
    const def = ghost ? furnitureDef(ghost.id) : undefined;
    const tables = mainTableCount(state);
    // A new floor piece starts at the first open spot, rather than wherever the room view would put it.
    if (ghost && def?.surface === 'floor' && !spotOf(ghost.col, ghost.row, def.w, def.h)) {
      const first = this.openSpots(b, state, ghost.id, ghost.skip)[0];
      const cell = first ? spotCell(first, def.w, def.h) : { col: -99, row: -99 };
      ghost = this.view.ghost = { ...ghost, ...cell };
    }
    const wallBox = (col: number, row: number, w = 1, h = 1) => {
      const box = gameWallRectToPlate({ x: col * CELL, y: WALL_TOP + row * CELL, w: w * CELL, h: h * CELL });
      if (!box || !ground) return null;
      const top = worldPoint(b, { floor: 'ground', x: box.x, y: box.y });
      return { x: top.x, y: top.y, w: box.w, h: box.h };
    };
    const freeSignature = def ? `${def.surface}|${ghost!.id}|${ghost!.skip}|${tables}|${JSON.stringify(state.decor.placed)}|${b.floors.join()}` : '';
    if (freeSignature !== this.freeSignature) {
      this.freeSignature = freeSignature;
      this.freeCells.clear();
      if (def?.surface === 'floor') {
        this.freeCells.fillStyle(0xfffaf0, .5).lineStyle(5, 0xfffaf0, .95);
        for (const spot of this.openSpots(b, state, ghost!.id, ghost!.skip)) {
          const at = worldPoint(b, spot);
          this.freeCells.fillEllipse(at.x, at.y - 6, Math.min(spot.room, 220), 56).strokeEllipse(at.x, at.y - 6, Math.min(spot.room, 220), 56);
        }
      } else if (def?.surface === 'wall') {
        this.freeCells.fillStyle(0xfffaf0, .28);
        for (let row = 0; row < WALL_ROWS; row++) for (let col = 0; col < COLS; col++) {
          if (!cellFree(state, 'wall', col, row, tables, ghost!.skip)) continue;
          const box = wallBox(col, row);
          if (box) this.freeCells.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
        }
      }
    }
    this.ghostMark.clear();
    const spot = def?.surface === 'floor' ? spotOf(ghost!.col, ghost!.row, def.w, def.h) : undefined;
    const place = def && ghost!.col > -50 ? this.piecePlace(ghost!.id, ghost!.col, ghost!.row, spot) : null;
    if (!place || !this.furniture?.[ghost!.id] || !this.textures.exists(furnitureKey(ghost!.id))) {
      if (def && this.furniture?.[ghost!.id]) this.requestDecor([furnitureKey(ghost!.id)]);
      this.ghostSprite?.setVisible(false);
      return;
    }
    const ok = canPlace(state, ghost!.id, ghost!.col, ghost!.row, tables, ghost!.skip)
      && this.sim.furnitureSpaceClear(ghost!.id, ghost!.col, ghost!.row) && this.view.catSpaceClear(ghost!.id, ghost!.col, ghost!.row);
    this.ghostMark.lineStyle(6, ok ? 0x4f8a4a : 0xb83a36, .95).fillStyle(ok ? 0x7fbf7a : 0xe0605a, .4);
    if (place.spot) {
      const at = worldPoint(b, place.spot);
      this.ghostMark.fillEllipse(at.x, at.y - 6, Math.min(place.spot.room, 220), 56).strokeEllipse(at.x, at.y - 6, Math.min(place.spot.room, 220), 56);
    } else if (place.box) {
      const box = wallBox(ghost!.col, ghost!.row, def!.w, def!.h);
      if (box) this.ghostMark.fillRect(box.x, box.y, box.w, box.h).strokeRect(box.x, box.y, box.w, box.h);
    }
    this.ghostSprite ??= this.add.image(0, 0, furnitureKey(ghost!.id));
    this.ghostSprite.setTexture(furnitureKey(ghost!.id)).setVisible(true).setAlpha(.85);
    if (!this.placeSprite(b, this.ghostSprite, ghost!.id, place)) { this.ghostSprite.setVisible(false); return; }
    this.ghostSprite.setDepth(99600);
    if (ok) this.ghostSprite.clearTint(); else this.ghostSprite.setTint(0xff9a90);
  }

  /** While arranging, a tap picks up the piece under it or puts the one in hand at the spot (or wall cell) under it, by the game's own rules. */
  private arrangeTap(x: number, y: number): boolean {
    const arrange = this.hooks.interactionState?.() as ArrangeState;
    if (!arrange) return false;
    const b = this.built;
    if (!b) return true;
    if (arrange.mode === 'browse') {
      const hit = this.placed.filter(piece => piece.sprite.visible && piece.sprite.getBounds().contains(x, y))
        .sort((a, c) => c.sprite.depth - a.sprite.depth)[0];
      if (hit) this.hooks.pointerDown(hit.at.x, hit.at.y);
      return true;
    }
    const def = arrange.id ? furnitureDef(arrange.id) : undefined;
    if (def?.surface === 'floor') {
      // The spot nearest the tap, within reach of it.
      const reach = this.cssToCanvas(30) / this.cameras.main.zoom;
      const near = FURNITURE_SPOTS.filter(spot => b.offsets[spot.floor] !== undefined).map(spot => {
        const at = worldPoint(b, spot);
        return { spot, d: Math.hypot((x - at.x) / Math.max(1, Math.min(spot.room, 220) / 2 + reach), (y - (at.y - 60)) / (140 + reach)) };
      }).filter(({ d }) => d <= 1).sort((a, c) => a.d - c.d)[0];
      if (near) {
        const cell = spotCell(near.spot, def.w, def.h);
        this.hooks.pointerDown((cell.col + def.w / 2) * CELL, FLOOR_Y + (cell.row + def.h) * CELL - 3);
      }
      return true;
    }
    if (b.offsets.ground === undefined) return true;
    const game = plateToGameWall({ x, y: y - b.offsets.ground + FLOOR_ART.ground.top });
    if (game) this.hooks.pointerDown(game.x, game.y);
    return true;
  }

  // ------------------------------------------------------------ people

  private makeActor(art: string, at: Spot, goal: string): Actor {
    const sprite = this.add.sprite(0, 0, art, SIDE.front).setOrigin(.5, 1);
    return { sprite, art, at: { floor: at.floor, x: at.x, y: at.y }, aisle: at.aisle, steps: [], goal, clock: Math.random() * 3, seen: true, rate: 1 };
  }

  /** Plans a walk to the goal's spot whenever the goal changes. */
  private aim(actor: Actor, goal: string, spot: Spot & { fadeOut?: boolean }): void {
    if (actor.goal === goal) return;
    actor.goal = goal;
    actor.steps = route(actor.at, actor.aisle, spot);
    actor.aisle = spot.aisle;
  }

  /** Walks along the steps, to arrive with the Sim in `seconds` of play; returns how the actor is heading, or null once there. */
  private walk(actor: Actor, dt: number, seconds: number): Way | null {
    actor.rate = walkPace(stepsLength(actor.at, actor.steps), seconds) * this.tempo;
    let left = WALK * actor.rate * dt, way: Way | null = null;
    while (actor.steps.length) {
      const next = actor.steps[0];
      if (next.jump) {
        actor.at = { floor: next.floor, x: next.x, y: next.y };
        actor.sprite.setAlpha(0);
        actor.steps.shift();
        continue;
      }
      const dx = next.x - actor.at.x, dy = next.y - actor.at.y, distance = Math.hypot(dx, dy);
      way = Math.abs(dx) >= Math.abs(dy) * .8 ? 'side' : dy > 0 ? 'down' : 'up';
      if (Math.abs(dx) > .5) actor.sprite.setFlipX(dx < 0);
      if (left <= 0) break;
      if (distance <= left) { actor.at = { floor: next.floor, x: next.x, y: next.y }; actor.steps.shift(); left -= distance; continue; }
      actor.at = { floor: actor.at.floor, x: actor.at.x + dx / distance * left, y: actor.at.y + dy / distance * left };
      left = 0;
    }
    // Fade out climbing into the floor above, or leaving through the door; fade in on arrival.
    const [first, second] = actor.steps;
    const distance = first ? Math.hypot(first.x - actor.at.x, first.y - actor.at.y) : 0;
    const alpha = second?.jump ? distance / 140 : first?.fadeOut && actor.steps.length === 1 ? distance / 120 : actor.sprite.alpha + dt * 3 * actor.rate;
    actor.sprite.setAlpha(Phaser.Math.Clamp(alpha, 0, 1));
    return way;
  }

  private play(actor: Actor, key: string, rate = 1): void {
    actor.sprite.anims.timeScale = Math.min(LEGS, rate);
    if (actor.sprite.anims.currentAnim?.key !== key || !actor.sprite.anims.isPlaying) actor.sprite.play(key);
  }

  /** Puts the sprite (and anything it carries) where the actor stands. */
  private place(b: Building, actor: Actor, carrying: boolean): void {
    const p = worldPoint(b, actor.at);
    actor.sprite.setPosition(p.x, p.y).setDepth(this.depthAt(actor.at));
    if (carrying && !actor.cup) actor.cup = this.add.image(0, 0, 'cup').setOrigin(.5, 1);
    if (!carrying && actor.cup) { actor.cup.destroy(); actor.cup = undefined; }
    actor.cup?.setPosition(p.x + (actor.sprite.flipX ? -30 : 30), p.y - 104).setDepth(this.depthAt(actor.at) + .01).setAlpha(actor.sprite.alpha);
  }

  private remove(actor: Actor): void {
    actor.sprite.destroy();
    actor.cup?.destroy();
  }

  private bubble(texture: string, at: { x: number; y: number }, ms = 1300): void {
    const image = this.add.image(at.x, at.y, texture).setOrigin(.5, 1).setDepth(100000).setScale(.2);
    this.tweens.add({ targets: image, scale: 1.35, duration: 240, ease: 'Back.Out' });
    this.time.delayedCall(ms, () => this.tweens.add({ targets: image, alpha: 0, duration: 200, onComplete: () => image.destroy() }));
  }

  private head(actor: Actor): { x: number; y: number } {
    return { x: actor.sprite.x, y: actor.sprite.y - actor.sprite.displayHeight - 4 };
  }

  // ------------------------------------------------------------ guests

  private customerGoal(c: Customer, active: readonly number[]): [string, Spot & { fadeOut?: boolean }] {
    switch (c.phase) {
      case 'queue': {
        const i = Math.max(0, this.sim.queue.indexOf(c.id));
        return [`queue-${i}`, QUEUE[Math.min(i, QUEUE.length - 1)]];
      }
      case 'toCounter':
      case 'ordering': {
        const i = Math.max(0, c.spot);
        return [`counter-${i}`, SERVICE[i % SERVICE.length]];
      }
      case 'toSeat':
      case 'waiting':
      case 'sitting':
        if (c.seat >= 0) return [`seat-${c.seat}`, tableSeats(Math.floor(c.seat / 2), active)[c.seat % 2]];
    }
    return ['door', { ...DOOR, fadeOut: true }];
  }

  private syncCustomers(b: Building, active: readonly number[], dt: number): void {
    const firstFrame = this.customers.size === 0 && !this.rack;
    for (const actor of this.customers.values()) actor.seen = false;
    for (const c of this.sim.customers) {
      let actor = this.customers.get(c.id);
      const [goal, spot] = this.customerGoal(c, active);
      if (!actor) {
        const appearance = c.appearanceId ?? c.id, own = castArt(appearance);
        const art = this.requestLook(own) ? own : GUEST_ART[appearance % GUEST_ART.length];
        // Guests already inside when the café is drawn start where they are; new ones come in at the door.
        actor = this.makeActor(art, firstFrame ? spot : DOOR, firstFrame ? goal : 'arriving');
        if (art !== own && this.sheets[own]) actor.wants = own;
        if (!firstFrame) actor.sprite.setAlpha(0);
        this.customers.set(c.id, actor);
      }
      if (actor.wants && this.looks.has(actor.wants)) { actor.art = actor.wants; actor.wants = undefined; actor.sprite.anims.stop(); }
      actor.seen = true;
      this.aim(actor, goal, spot);
      if (c.mood !== this.moods.get(c.id) && c.mood === 'sad') this.bubble('bubble-sad', this.head(actor));
      this.moods.set(c.id, c.mood);
      this.poseCustomer(b, actor, c, active, dt);
    }
    // Gone from the Sim: finish walking out of the door, then go.
    for (const [id, actor] of this.customers) {
      if (actor.seen) continue;
      this.aim(actor, 'door', { ...DOOR, fadeOut: true });
      const way = this.walk(actor, dt, 0);
      if (way) this.play(actor, `${actor.art}-${way}`, actor.rate);
      this.place(b, actor, !!actor.cup);
      if (!actor.steps.length) { this.remove(actor); this.customers.delete(id); this.moods.delete(id); }
    }
  }

  private poseCustomer(b: Building, actor: Actor, c: Customer, active: readonly number[], dt: number): void {
    // A newcomer waits unseen where they are for their own look, then borrows one; they catch up after.
    if (actor.wants && actor.clock < LOOK_WAIT && c.phase !== 'exiting') {
      actor.clock += dt * this.tempo;
      actor.sprite.setAlpha(0);
      this.place(b, actor, false);
      return;
    }
    const way = this.walk(actor, dt, simSeconds(c, WALK_SPEED));
    const takeaway = c.phase === 'exiting' && c.hasCup && !c.dineIn;
    if (way) {
      this.play(actor, `${actor.art}-${way}`, actor.rate);
    } else {
      actor.sprite.stop();
      actor.clock += dt;
      if (c.phase === 'waiting' || c.phase === 'sitting') {
        const seat = tableSeats(Math.floor(c.seat / 2), active)[c.seat % 2];
        const pose = c.phase === 'waiting' ? MOVES.sit : actor.clock % 1.7 < .8 ? MOVES.hold : actor.clock % 3.4 < 1.7 ? MOVES.sip : MOVES.laugh;
        actor.sprite.setTexture(`${actor.art}-moves`, pose).setFlipX(seat.faceLeft);
      } else if (c.phase === 'ordering' || c.phase === 'toCounter') {
        actor.sprite.setTexture(actor.art, SIDE.back).setFlipX(false);
      } else {
        actor.sprite.setTexture(actor.art, SIDE.side).setFlipX(false);
      }
    }
    this.place(b, actor, takeaway);
  }

  // ------------------------------------------------------------ staff

  private syncBaristas(b: Building, dt: number): void {
    const list = this.sim.baristas;
    while (this.baristas.length > list.length) this.baristas.pop()!.destroy();
    while (this.baristas.length < list.length) {
      const i = this.baristas.length;
      this.baristas.push(this.add.sprite(0, 0, i === 0 ? 'owner' : 'barista', SIDE.front).setOrigin(.5, 1));
    }
    let brewing = false;
    list.forEach((barista, i) => {
      const sprite = this.baristas[i], spot = BARISTAS[i % BARISTAS.length];
      const p = worldPoint(b, { ...spot, x: spot.x + Math.floor(i / BARISTAS.length) * 60 });
      const working = barista.customerId !== null && barista.total > 0 && barista.remaining > 0;
      brewing ||= working;
      sprite.setPosition(p.x, p.y).setDepth(p.y).setFrame(barista.calling > 0 ? SIDE.happy : working ? SIDE.side : SIDE.front);
      const calling = barista.calling > 0;
      if (calling && !this.calling[i]) this.bubble('bubble-coffee', { x: p.x, y: p.y - sprite.displayHeight - 4 }, 900);
      this.calling[i] = calling;
    });
    this.steamTimer -= dt;
    if (brewing && this.steamTimer <= 0) {
      this.steamTimer = .32;
      const at = worldPoint(b, STEAM);
      const puff = this.add.image(at.x + Phaser.Math.Between(-16, 16), at.y, 'puff').setDepth(at.y).setScale(.6).setAlpha(.85);
      this.tweens.add({ targets: puff, y: at.y - 70, scale: 1.5, alpha: 0, duration: 1300, onComplete: () => puff.destroy() });
    }
  }

  private syncServers(b: Building, active: readonly number[], dt: number): void {
    const list = this.sim.servers;
    while (this.servers.length > list.length) this.remove(this.servers.pop()!);
    list.forEach((server, i) => {
      const home = SERVER_HOMES[i % SERVER_HOMES.length];
      let actor = this.servers[i];
      if (!actor) { actor = this.makeActor('barista', home, 'home'); this.servers[i] = actor; }
      let goal = 'home', spot: Spot = home;
      if (server.phase === 'toPass') { goal = 'pass'; spot = PASS; }
      else if (server.phase === 'delivering' && server.plates.length) {
        const c = this.sim.customers.find(customer => customer.id === server.plates[0].customerId);
        if (c && c.seat >= 0) {
          const seat = tableSeats(Math.floor(c.seat / 2), active)[c.seat % 2];
          goal = `table-${c.seat}`;
          spot = { floor: seat.floor, x: seat.x, y: seat.aisle, aisle: seat.aisle };
        }
      }
      this.aim(actor, goal, spot);
      const way = this.walk(actor, dt, simSeconds(server, SERVER_SPEED));
      if (way) this.play(actor, 'barista-side', actor.rate);
      else { actor.sprite.stop(); actor.sprite.setTexture('barista', server.phase === 'idle' ? SIDE.front : SIDE.side); }
      this.place(b, actor, server.phase === 'delivering');
    });
  }

  private syncCooks(b: Building, dt: number): void {
    const list = this.sim.cooks;
    const kitchen = b.offsets.basement !== undefined;
    while (this.cooks.length > (kitchen ? list.length : 0)) this.remove(this.cooks.pop()!);
    let baking = false;
    if (kitchen) list.forEach((cook, i) => {
      const art = i % 2 === 0 ? 'cook-chef' : 'cook-scarf';
      let actor = this.cooks[i];
      if (!actor) { actor = this.makeActor(art, cookHome(i), 'home'); this.cooks[i] = actor; }
      const station = this.sim.cookStation(i);
      const place: KitchenPlace | null = station ? kitchenPlace(station.station) : null;
      this.aim(actor, place ? `station-${place}` : 'home', place ? kitchenSpot(place, i) : cookHome(i));
      const way = this.walk(actor, dt, simSeconds(cook, WALK_SPEED));
      if (way) this.play(actor, `${art}-${cook.batch ? 'carry' : 'side'}`, actor.rate);
      else if (station?.working && place === 'oven' && art === 'cook-chef') { this.play(actor, 'cook-chef-oven'); actor.sprite.setFlipX(false); }
      else if (station?.working && place === 'dough' && art === 'cook-scarf') { this.play(actor, 'cook-scarf-knead'); actor.sprite.setFlipX(false); }
      else { actor.sprite.stop(); actor.sprite.setTexture(art, station?.working ? SIDE.back : SIDE.front).setFlipX(false); }
      baking ||= !way && !!station?.working && place === 'oven';
      this.place(b, actor, false);
    });
    this.glow.setVisible(baking);
    if (baking) {
      const mouth = worldPoint(b, OVEN_MOUTH);
      this.glow.setPosition(mouth.x, mouth.y).setAlpha(.45 + .3 * Math.sin(this.time.now / 300));
    }
  }

  /** A batch out of the oven rides up the food lift and turns up in the cake display. */
  private restock(b: Building): void {
    const rack = this.sim.rack;
    if (rack === this.rack) return;
    const first = this.rack === null;
    this.rack = rack;
    if (first || !rack.length) return;
    const display = () => {
      const top = worldPoint(b, { floor: 'ground', x: 0, y: DISPLAY.top }).y, bottom = worldPoint(b, { floor: 'ground', x: 0, y: DISPLAY.bottom }).y;
      this.bubble('bubble-bread', { x: (DISPLAY.left + DISPLAY.right) / 2, y: top - 8 }, 1600);
      for (let k = 0; k < 9; k++) {
        const star = this.add.image(Phaser.Math.Between(DISPLAY.left, DISPLAY.right), Phaser.Math.Between(top + 30, bottom), 'sparkle')
          .setDepth(100000).setScale(0).setAngle(Phaser.Math.Between(0, 45));
        this.tweens.add({ targets: star, scale: { from: 0, to: 2.2 }, alpha: { from: 1, to: 0 }, delay: k * 140, duration: 900, ease: 'Sine.Out', onComplete: () => star.destroy() });
      }
    };
    if (b.offsets.basement === undefined) { display(); return; }
    const hatch = worldPoint(b, LIFT_HATCH), shaft = worldPoint(b, LIFT_TOP);
    const bread = this.add.image(hatch.x, hatch.y, 'bread').setDepth(2).setScale(1.2);
    this.tweens.add({ targets: bread, y: shaft.y, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Sine.In', onComplete: () => { bread.destroy(); display(); } });
  }

  // ------------------------------------------------------------ page effects

  /** Sales become coins over the guest; the room view's own particles are not drawn here. */
  private drainView(): void {
    this.view.effects.splice(0);
    this.view.assistanceLabels.splice(0).forEach((label, i) => {
      // Help brewing: the barista at work says so, with a puff of steam.
      const barista = this.baristas.filter((_, k) => this.sim.isBrewing(k))[i] ?? this.baristas[0];
      if (!barista) return;
      // Above the sale coins that pop over the guest at the counter.
      const text = this.add.text(barista.x, barista.y - barista.displayHeight - 130, label.text, {
        fontFamily: 'ui-rounded, "PingFang SC", system-ui, sans-serif', fontSize: '58px', fontStyle: 'bold',
        color: '#4f3b2f', stroke: '#fffaf0', strokeThickness: 14,
      }).setOrigin(.5, 1).setDepth(100001);
      this.tweens.add({ targets: text, y: text.y - 80, alpha: { from: 1, to: 0 }, delay: 400, duration: 900, onComplete: () => text.destroy() });
      this.steamTimer = 0;
    });
    for (const sale of this.view.sales.splice(0)) {
      const actor = sale.customerId === undefined ? undefined : this.customers.get(sale.customerId);
      const at = actor ? this.head(actor) : { x: SERVICE[0].x, y: this.counterFront.y + 300 };
      if (actor) this.bubble('bubble-heart', at, 900);
      const text = this.add.text(at.x, at.y - 130, `+${formatMoney(sale.amount)}`, {
        fontFamily: 'ui-rounded, "PingFang SC", system-ui, sans-serif', fontSize: '76px', fontStyle: 'bold',
        color: sale.vip ? '#b7791f' : '#8a5a1c', stroke: '#fffaf0', strokeThickness: 16,
      }).setOrigin(.5, 1).setDepth(100001);
      this.tweens.add({ targets: text, y: text.y - 70, alpha: { from: 1, to: 0 }, delay: 500, duration: 1000, onComplete: () => text.destroy() });
    }
  }
}
