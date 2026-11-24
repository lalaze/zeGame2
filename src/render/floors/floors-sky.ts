// The time of day and the weather in the cross-section building: the painted skies cross-fading
// with the game's clock, night falling on the street and the roof while the rooms stay warm under
// their lamps, lit windows on the front walls, stars and a moon, drifting clouds, and rain, snow or
// leaves falling outside. What shows when is decided in floors-sky-light.ts; the pictures come from
// scripts/art-gen/floor-sky-build.py (assets/generated/floor-sample-v1/build/sky).
//
// floors-scene.ts calls `FloorsSky.preload` while loading, makes one FloorsSky beside its sky
// picture, hands it the building's frame whenever that is laid out, and calls `update` every frame.
import Phaser from 'phaser';
import { todayCondition } from '../../game/conditions';
import { cafeLocation } from '../../game/locations';
import type { GameState } from '../../game/state';
import { previewLightDate } from '../preview-light';
import { FLOOR_ART, FRAME, WORLD_W, worldPoint, type Building } from './floors-layout';
import { FLOOR_WINDOWS, PLACE_DISC, PLACE_WINDOWS, paintedPlace, placeGlass, placePictures, placeSky, type PaintedPlace, type PlaceWindow } from './floors-places';
import {
  ROOM_WINDOWS, SKY_NAMES, STREET_LAMP, WALL_LAMPS, floorLamps, previewSky, skyHour, skyLook,
  type Fall, type Lamp, type SkyLook, type SkyName, type SkyTops, type SkyWeather,
} from './floors-sky-light';

const ART = `${import.meta.env.BASE_URL}assets/generated/floor-sample-v1/build/`;
const MANIFEST = 'sky/sky.json', SPRITES = 'sky/sprites', LAMP = 'sky/lamp';
/** The painted skies beside the day sky, which the scene loads itself (`frame/sky`). */
export const SKY_PICTURES: Record<Exclude<SkyName, 'day'>, string> = { clear: 'sky/clear', dusk: 'sky/dusk', night: 'sky/night', overcast: 'sky/overcast' };
/** The light in each front wall's windows, by the wall's picture, and night on the top floor's picture. */
export const WINDOW_GLOWS: Record<string, string> = {
  'frame/wall-attic': 'sky/glow-wall-attic', 'frame/wall-seating': 'sky/glow-wall-seating', 'frame/wall-ground': 'sky/glow-wall-ground',
};
export const ATTIC_SHADE = 'sky/shade-attic';
export const SKY_IMAGES = [...Object.values(SKY_PICTURES), ...Object.values(WINDOW_GLOWS), ATTIC_SHADE];
/** The sky pictures' top-edge colours (build/sky/sky.json), used until the manifest is read. */
export const SKY_TOPS: SkyTops = { day: '#8dc3fc', clear: '#9bcdfd', dusk: '#817db6', night: '#253271', overcast: '#6d7e98' };
/** Frame pictures that stand outside and darken with the night; anything else handed over is left alone. */
const OUTSIDE = new Set(['frame/pillar', 'frame/beam', 'frame/awning', 'frame/door-left', 'frame/door-right', 'frame/step',
  'frame/street', 'frame/soil', ...Object.keys(WINDOW_GLOWS)]);
/** The clouds in the order they join the sky: a wisp first, the big one only under a full sky. */
const CLOUDS = ['cloud-6', 'cloud-3', 'cloud-2', 'cloud-4', 'cloud-5', 'cloud-1'] as const;
/** Each cloud's height in the sky picture (rows from its top; the last two drift above it). */
const CLOUD_ROWS = [110, 300, 30, 220, -130, -290];
/** Where the moon and the sun hang: in the corner of sky over the roof's left slope, under the page's top bar. */
const DISC = { x: 205, row: 330, scale: .8 } as const;
const STARS = 26;
/** Behind the building: in front of the sky pictures, behind the roof. */
const SKY_DEPTH = -10, BEHIND_DEPTH = -9.5;
/** Over everyone in the rooms and under the pillars, beams and front walls (FRAME_DEPTH in floors-scene.ts is 50000). */
const SHADE_DEPTH = 40000, GLOW_DEPTH = 40001;
/** In front of the building and the people on the street, under the bubbles and cues. */
const FRONT_DEPTH = 60000;
/** Between a room's fixtures (which hold its windows) and what stands in front of them (floors-scene.ts BACK_LAYERS). */
const GLASS_DEPTH = -2 + .05 * 5.6;
/**
 * What a place shows through a window: on a seating floor over the room and under its fixtures, on the
 * ground floor over the side window; both under the glass's night.
 */
const VIEW_DEPTH: Record<PlaceWindow, number> = { '2f': -2 + .05 * 4.5, '1f': -2 + .05 * 5.55 };
/** The side window's layer starts this far below the ground floor's plate top (SIDE_WINDOW in floors-scene.ts). */
const SIDE_WINDOW_Y = 16;
/** How bright a lamp's glow is at full strength, and the glow in the walls' windows. */
const GLOW = .5, WINDOW_GLOW = .5;
/** The roof's outline on the top floor's picture, ridge to eaves (as in floor-sky-build.py): rain splashes along it. */
const ROOF = { ridgeX: 836, ridgeY: 10, eaveY: 545 } as const;

interface Tintable { setTint(colour: number): unknown }
interface Piece { image: Phaser.GameObjects.Image; front: boolean; vx: number; vy: number; spin: number; sway: number; phase: number; alpha: number }
interface Glow { image: Phaser.GameObjects.Image; power: number; wall?: Phaser.GameObjects.Image }

const FALLS: Record<Fall, { frames: string[]; speed: [number, number]; wind: number; scale: [number, number]; sway: number; spin: number; alpha: number }> = {
  rain: { frames: ['drop'], speed: [2300, 3100], wind: -.21, scale: [.75, 1.15], sway: 0, spin: 0, alpha: .75 },
  snow: { frames: ['flake-1', 'flake-2', 'flake-2'], speed: [170, 320], wind: -.12, scale: [.6, 1.1], sway: 60, spin: .6, alpha: .95 },
  leaves: { frames: ['leaf-1', 'leaf-2'], speed: [230, 380], wind: -.9, scale: [.8, 1.15], sway: 120, spin: 2.2, alpha: 1 },
};

const multiply = (a: number, b: number) =>
  [16, 8, 0].reduce((out, shift) => out | (Math.round(((a >> shift) & 255) * ((b >> shift) & 255) / 255) << shift), 0);

/** A stable number in [0, 1) for a slot, so stars and clouds stay where they are between visits. */
const scatter = (i: number, salt: number) => { const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v); };

export class FloorsSky {
  /** A fixed hour or weather to show instead of the game's (dev server only). */
  preview: { hour?: number; weather?: SkyWeather } = {};
  /** What is showing now, for browser checks. */
  look: SkyLook | null = null;
  private tops: SkyTops;
  private skies: Record<Exclude<SkyName, 'day'>, Phaser.GameObjects.Image>;
  private stars: Phaser.GameObjects.Image[] = [];
  private moon: Phaser.GameObjects.Image;
  private sun: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private balloons: Phaser.GameObjects.Image[] = [];
  private bird: Phaser.GameObjects.Image;
  private pieces: Piece[] = [];
  private falling: string = '';
  private splashTimer = 0;
  private clock = 0;
  // What belongs to the building as it is laid out now.
  private built: Phaser.GameObjects.GameObject[] = [];
  private outside: Tintable[] = [];
  private walls: Phaser.GameObjects.Image[] = [];
  private earth: { shape: Phaser.GameObjects.Rectangle; colour: number } | null = null;
  private rooms: Phaser.GameObjects.Rectangle[] = [];
  private atticShade: Phaser.GameObjects.Image | null = null;
  private glass: Phaser.GameObjects.Graphics | null = null;
  private glassShapes: [number, number][][] = [];
  private glassColour = -1;
  private lamps: Glow[] = [];
  private windowGlows: { image: Phaser.GameObjects.Image; wall: Phaser.GameObjects.Image }[] = [];
  private lampSignature = '';
  /** The place whose pictures are showing; null is the old town, the building's own sky. */
  private place: PaintedPlace | null = null;
  private loadingPlaces = new Set<PaintedPlace>();
  private views: { image: Phaser.GameObjects.Image; window: PlaceWindow }[] = [];

  /** Queues the sky's pictures with the scene's own, and those of the place the café is in. */
  static preload(scene: Phaser.Scene, state: GameState): void {
    const place = paintedPlace(cafeLocation(state));
    if (place) for (const key of placePictures(place)) scene.load.image(key, `${ART}${key}.webp`);
    scene.load.json(MANIFEST, `${ART}sky/sky.json`);
    for (const key of SKY_IMAGES) scene.load.image(key, `${ART}${key}.webp`);
    scene.load.atlas(SPRITES, `${ART}sky/sprites.webp`, `${ART}sky/sprites.json`);
  }

  /** `daySky` is the scene's sky picture: the others lie over it and follow it. */
  constructor(private scene: Phaser.Scene, private daySky: Phaser.GameObjects.Image) {
    const manifest = scene.cache.json.get(MANIFEST) as { skies?: Partial<Record<SkyName, { top?: string }>> } | undefined;
    this.tops = Object.fromEntries(SKY_NAMES.map(name => [name, manifest?.skies?.[name]?.top ?? SKY_TOPS[name]])) as SkyTops;
    if (!scene.textures.exists(LAMP)) {
      // A lamp's light: a soft white disc, tinted warm (or pink for neon) where it is used.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const c = canvas.getContext('2d')!, g = c.createRadialGradient(128, 128, 4, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.22, 'rgba(255,255,255,.5)');
      g.addColorStop(.55, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      scene.textures.addCanvas(LAMP, canvas);
    }
    const over = (key: string, step: number) => scene.add.image(0, 0, key).setOrigin(0, 1).setDepth(SKY_DEPTH + step * .01).setAlpha(0);
    this.skies = { clear: over(SKY_PICTURES.clear, 0.5), dusk: over(SKY_PICTURES.dusk, 1), night: over(SKY_PICTURES.night, 2), overcast: over(SKY_PICTURES.overcast, 3) };
    for (let i = 0; i < STARS; i++) {
      this.stars.push(scene.add.image(0, 0, SPRITES, 'star').setDepth(SKY_DEPTH + .04).setScale(.3 + .5 * scatter(i, 3)).setAlpha(0));
    }
    this.moon = scene.add.image(0, 0, SPRITES, 'moon').setDepth(SKY_DEPTH + .05).setScale(DISC.scale).setAlpha(0);
    this.sun = scene.add.image(0, 0, SPRITES, 'sun').setDepth(SKY_DEPTH + .05).setScale(DISC.scale).setAlpha(0);
    CLOUDS.forEach((frame, i) => {
      const cloud = scene.add.image(0, 0, SPRITES, frame).setDepth(SKY_DEPTH + .06 + i * .001).setAlpha(0);
      // Spread along the sky to start with, each at its own height.
      cloud.x = scatter(i, 1) * (WORLD_W + 600) - 300;
      this.clouds.push(cloud);
    });
    this.balloons = ['balloon-1', 'balloon-2'].map(frame => scene.add.image(0, 0, SPRITES, frame).setDepth(BEHIND_DEPTH - .1).setVisible(false));
    this.bird = scene.add.image(-200, 0, SPRITES, 'bird').setDepth(BEHIND_DEPTH - .1).setVisible(false);
    if (import.meta.env.DEV) {
      this.preview = previewSky(window.location.search);
      (window as unknown as { floorsSky?: FloorsSky }).floorsSky = this;
    }
  }

  /**
   * The building was laid out: `parts` are the scene's frame pictures (street, earth, pillars, beams,
   * awning, doors, step, front walls). Those that stand outside darken with the night from now on.
   */
  layout(b: Building, parts: readonly Phaser.GameObjects.GameObject[]): void {
    for (const object of this.built) object.destroy();
    this.built = [];
    this.outside = [];
    this.walls = [];
    this.earth = null;
    for (const part of parts) {
      const key = (part as Phaser.GameObjects.Image).texture?.key;
      if (key && OUTSIDE.has(key)) {
        this.outside.push(part as unknown as Tintable);
        if (WINDOW_GLOWS[key]) this.walls.push(part as Phaser.GameObjects.Image);
      } else if (part instanceof Phaser.GameObjects.Rectangle) this.earth = { shape: part, colour: part.fillColor };
    }
    const keep = <T extends Phaser.GameObjects.GameObject>(object: T): T => { this.built.push(object); return object; };
    const { scene } = this;
    // Night in the rooms: a wash over each floor, and over the top floor's picture by its own shape.
    this.rooms = [];
    this.atticShade = null;
    for (const floor of b.floors) {
      const y = b.offsets[floor]!;
      if (floor === 'roof') {
        this.atticShade = keep(scene.add.image(0, y - (FLOOR_ART.roof.above ?? 0), ATTIC_SHADE).setOrigin(0, 0).setScale(2)
          .setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(SHADE_DEPTH));
      } else {
        this.rooms.push(keep(scene.add.rectangle(0, y, WORLD_W, FLOOR_ART[floor].height, 0xffffff).setOrigin(0, 0)
          .setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(SHADE_DEPTH).setVisible(false)));
      }
    }
    // The glass of the rooms' own windows.
    this.glass = keep(scene.add.graphics().setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(GLASS_DEPTH));
    this.glassShapes = b.floors.flatMap(floor => {
      const shape = ROOM_WINDOWS[floor];
      return shape ? [shape.map(([x, y]) => { const p = worldPoint(b, { floor, x, y }); return [p.x, p.y] as [number, number]; })] : [];
    });
    this.glassColour = -1;
    // What the place shows through those windows.
    this.views = b.floors.flatMap(floor => {
      const window = FLOOR_WINDOWS[floor];
      if (!window) return [];
      const at = PLACE_WINDOWS[window], y = b.offsets[floor]! + at.y + (window === '1f' ? SIDE_WINDOW_Y : 0);
      return [{ window, image: keep(scene.add.image(at.x, y, this.place ? placeGlass(this.place, window) : '__DEFAULT').setOrigin(0, 0)
        .setDepth(VIEW_DEPTH[window]).setVisible(!!this.place)) }];
    });
    // The light in the front walls' windows.
    this.windowGlows = this.walls.map(wall => ({
      wall,
      image: keep(scene.add.image(wall.x, wall.y, WINDOW_GLOWS[wall.texture.key]).setOrigin(0, 0).setScale(2)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(wall.depth + .5).setAlpha(0)),
    }));
    this.lampSignature = '';
    this.splashTimer = 0;
  }

  /** The lamps of the floors the building has, with the decor that is on: made again when either changes. */
  private layLamps(b: Building, equipped: Partial<Record<string, string>>): void {
    const signature = `${b.floors.join()}|${b.street}|${equipped.ceiling}|${equipped.neon}`;
    if (signature === this.lampSignature) return;
    this.lampSignature = signature;
    for (const { image } of this.lamps) image.destroy();
    const glow = (at: { x: number; y: number }, lamp: Lamp, depth: number): Glow => ({
      power: lamp.power ?? 1,
      image: this.scene.add.image(at.x, at.y, LAMP).setDisplaySize(lamp.reach * 2, lamp.reach * 2).setTint(lamp.colour ?? 0xffc98a)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(0),
    });
    this.lamps = b.floors.flatMap(floor => floorLamps(floor, equipped).map(lamp => glow(worldPoint(b, { floor, x: lamp.x, y: lamp.y }), lamp, GLOW_DEPTH)));
    // The street lamp stands on the street's picture, which a basement's cut-open street replaces.
    if (b.offsets.basement === undefined) this.lamps.push(...STREET_LAMP.map(lamp => glow({ x: lamp.x, y: b.street + lamp.y }, lamp, SHADE_DEPTH - 1)));
    // The lamps painted on the front walls shine when the walls are up.
    for (const wall of this.walls) {
      this.lamps.push(...(WALL_LAMPS[wall.texture.key] ?? []).map(lamp => ({ ...glow({ x: wall.x + lamp.x, y: wall.y + lamp.y }, lamp, wall.depth + .6), wall })));
    }
  }

  /** Shows a place behind the roof and through the windows, once its pictures are here. */
  private standIn(place: PaintedPlace | null): void {
    if (place === this.place) return;
    const { scene } = this;
    if (place) {
      const missing = placePictures(place).filter(key => !scene.textures.exists(key));
      if (missing.length) {
        if (this.loadingPlaces.has(place)) return;
        this.loadingPlaces.add(place);
        for (const key of missing) scene.load.image(key, `${ART}${key}.webp`);
        if (!scene.load.isLoading()) scene.load.start();
        return;
      }
    }
    this.place = place;
    this.daySky.setTexture(place ? placeSky(place, 'day') : 'frame/sky');
    for (const light of Object.keys(SKY_PICTURES) as (keyof typeof SKY_PICTURES)[]) this.skies[light].setTexture(place ? placeSky(place, light) : SKY_PICTURES[light]);
    for (const { image, window } of this.views) {
      if (place) image.setTexture(placeGlass(place, window));
      image.setVisible(!!place);
    }
  }

  /** Shows the hour and the weather of the game's day, in the place the café is in. */
  update(dt: number, state: GameState, b: Building): void {
    this.standIn(paintedPlace(cafeLocation(state)));
    this.clock += dt;
    const date = previewLightDate(new Date(2000, 0, 1, 0, Math.round(skyHour(state) * 60)), window.location.href);
    const hour = this.preview.hour ?? date.getHours() + date.getMinutes() / 60;
    const weather = this.preview.weather ?? todayCondition(state).id;
    const look = this.look = skyLook(hour, weather, this.tops);
    const { scene, daySky } = this;
    const skyTop = daySky.y - daySky.displayHeight;

    // The skies: dusk and night over the day sky, the overcast sky over them all.
    const { times } = look;
    const show = (image: Phaser.GameObjects.Image, alpha: number) => image.setPosition(daySky.x, daySky.y).setAlpha(alpha).setVisible(alpha > .004);
    show(this.skies.clear, look.clear && times.day > 0 ? 1 : 0);
    show(this.skies.dusk, look.cover >= 1 || times.night >= 1 ? 0 : times.dusk / (1 - times.night));
    show(this.skies.night, look.cover >= 1 ? 0 : times.night);
    show(this.skies.overcast, look.cover).setTint(look.coverTint);
    scene.cameras.main.setBackgroundColor(look.top);

    // Night outside, and a warm dimness in the rooms.
    for (const part of this.outside) part.setTint(look.outside);
    this.earth?.shape.setFillStyle(multiply(this.earth.colour, look.outside));
    this.atticShade?.setTint(look.outside).setVisible(look.outside !== 0xffffff);
    for (const room of this.rooms) room.setFillStyle(look.room).setVisible(look.room !== 0xffffff);
    if (this.glass && look.glass !== this.glassColour) {
      this.glassColour = look.glass;
      this.glass.clear();
      if (look.glass !== 0xffffff) {
        this.glass.fillStyle(look.glass, 1);
        for (const shape of this.glassShapes) this.glass.fillPoints(shape.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
      }
    }

    // Lamps, and the windows of the front walls.
    this.layLamps(b, state.decor.equipped as Partial<Record<string, string>>);
    for (const lamp of this.lamps) {
      const alpha = look.lamps * lamp.power * GLOW * (lamp.wall ? (lamp.wall.visible ? lamp.wall.alpha : 0) : 1);
      lamp.image.setAlpha(alpha).setVisible(alpha > .005);
    }
    for (const { image, wall } of this.windowGlows) {
      const alpha = look.lamps * wall.alpha * WINDOW_GLOW;
      image.setPosition(wall.x, wall.y).setAlpha(alpha).setVisible(wall.visible && alpha > .01);
    }
    const wallAlpha = this.walls.reduce((most, wall) => Math.max(most, wall.visible ? wall.alpha : 0), 0);

    // Stars, the moon and the sun.
    this.stars.forEach((star, i) => {
      const twinkle = .6 + .4 * Math.sin(this.clock * (.7 + 1.6 * scatter(i, 5)) + i * 2.4);
      star.setPosition(20 + scatter(i, 1) * (WORLD_W - 40), skyTop - 640 + scatter(i, 2) * 1000)
        .setAlpha(look.stars * twinkle).setVisible(look.stars > .01);
    });
    const disc = this.place ? PLACE_DISC : DISC, discY = skyTop + disc.row;
    this.moon.setPosition(disc.x, discY).setAlpha(look.moon).setVisible(look.moon > .01);
    this.sun.setPosition(disc.x, discY).setAlpha(look.sun).setVisible(look.sun > .01)
      .setRotation(this.clock * .05).setScale(DISC.scale * (1 + .03 * Math.sin(this.clock * 1.3)));

    // Clouds drift to the right and come round again.
    this.clouds.forEach((cloud, i) => {
      const target = i < look.clouds ? look.cloudAlpha : 0;
      cloud.alpha += (target - cloud.alpha) * Math.min(1, dt * 2);
      cloud.x += look.drift * (.8 + .4 * scatter(i, 7)) * dt;
      const half = cloud.displayWidth / 2;
      if (cloud.x - half > WORLD_W + 80) cloud.x = -half - 80;
      cloud.setY(skyTop + CLOUD_ROWS[i]).setTint(look.cloudTint).setVisible(cloud.alpha > .01);
    });

    this.fall(dt, look, b, wallAlpha);
    this.extras(dt, look, skyTop);
  }

  /** Rain, snow or leaves: behind the building against the sky, and in front of the street (and of the front walls when they are up). */
  private fall(dt: number, look: SkyLook, b: Building, wallAlpha: number): void {
    const { scene } = this;
    const kind = look.fall, signature = `${kind}|${look.pieces}`;
    if (signature !== this.falling) {
      this.falling = signature;
      for (const piece of this.pieces) piece.image.destroy();
      this.pieces = [];
      if (kind) {
        const spec = FALLS[kind], pick = (range: [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
        for (let i = 0; i < look.pieces * 2; i++) {
          const front = i % 2 === 1, vy = pick(spec.speed, Math.random());
          const image = scene.add.image(Math.random() * (WORLD_W + 400) - 200, Math.random() * 4000, SPRITES, spec.frames[i % spec.frames.length])
            .setScale(pick(spec.scale, Math.random()) * (front ? 1 : .8)).setDepth(front ? FRONT_DEPTH : BEHIND_DEPTH);
          this.pieces.push({ image, front, vy, vx: vy * spec.wind, spin: (Math.random() - .5) * 2 * spec.spin, sway: spec.sway, phase: Math.random() * 6.28, alpha: spec.alpha * (front ? 1 : .8) });
        }
      }
    }
    if (!kind) return;
    const view = scene.cameras.main.worldView, margin = 120;
    const top = view.y - margin, span = view.height + margin * 2, width = WORLD_W + 400;
    // Outdoors in front of the building: the street's paving; under a basement's cut-open street only its band of paving.
    const ground = b.street + (b.offsets.basement === undefined ? FRAME.street : FRAME.soilBand - 30);
    // With the building cut open, what falls in front of it all falls over the street.
    const open = wallAlpha < .02, streetTop = b.street - 140, streetSpan = ground - streetTop + 60;
    for (const piece of this.pieces) {
      const { image } = piece;
      image.x += (piece.vx + Math.sin(this.clock * 1.7 + piece.phase) * piece.sway) * dt;
      image.y += piece.vy * dt;
      image.rotation += piece.spin * dt;
      image.x = ((((image.x + 200) % width) + width) % width) - 200;
      if (piece.front && open) image.y = ((((image.y - streetTop) % streetSpan) + streetSpan) % streetSpan) + streetTop;
      else image.y = ((((image.y - top) % span) + span) % span) + top;
      const outdoors = !piece.front ? 1 : image.y > ground ? 0 : image.y >= b.street - 6 ? 1 : wallAlpha;
      image.setAlpha(piece.alpha * outdoors).setVisible(outdoors > .01);
    }
    if (kind !== 'rain') return;
    // Drops splash on the paving, and along the roof.
    this.splashTimer -= dt;
    const roofTop = (b.offsets.roof ?? 0) - (FLOOR_ART.roof.above ?? 0);
    for (let n = 0; this.splashTimer <= 0; n++) {
      this.splashTimer += .05;
      let x = Phaser.Math.Between(20, WORLD_W - 20), y = Phaser.Math.Between(b.street + 34, ground - (b.offsets.basement === undefined ? 190 : 12)), depth = -2.5;
      if (n % 2) {
        const t = Math.random(), side = Math.random() < .5 ? -1 : 1;
        x = ROOF.ridgeX + side * t * ROOF.ridgeX;
        y = roofTop + ROOF.ridgeY + t * (ROOF.eaveY - ROOF.ridgeY) + 6;
        depth = FRONT_DEPTH;
      }
      if (y < view.y || y > view.bottom) continue;
      const splash = scene.add.image(x, y, SPRITES, 'splash').setOrigin(.5, 1).setDepth(depth).setScale(.35).setAlpha(.9);
      scene.tweens.add({ targets: splash, scale: .9, alpha: 0, duration: 420, ease: 'Sine.Out', onComplete: () => splash.destroy() });
    }
  }

  /** A market day's balloons rising from the town, a quiet day's bird gliding past. */
  private extras(dt: number, look: SkyLook, skyTop: number): void {
    this.balloons.forEach((balloon, i) => {
      balloon.setVisible(look.balloons);
      if (!look.balloons) return;
      // Each rises from behind the roof into the sky above, then starts again.
      const climb = ((this.clock * 34 + i * 900) % 1800);
      balloon.setPosition((i ? WORLD_W - 190 : 150) + Math.sin(this.clock * .5 + i * 2) * 36, skyTop + 760 - climb).setRotation(Math.sin(this.clock * .9 + i) * .07);
    });
    this.bird.setVisible(look.bird);
    if (look.bird) {
      this.bird.x += 120 * dt;
      if (this.bird.x > WORLD_W + 2200) this.bird.x = -200;
      this.bird.setY(skyTop + 215 + Math.sin(this.clock * 1.4) * 26).setRotation(Math.cos(this.clock * 1.4) * .08);
    }
  }
}
