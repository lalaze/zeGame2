// The café's cats in the cross-section building: every adopted cat walks its floor, takes the
// stairs, sits, washes and naps at the places of floors-cat-places.ts that suit it, and can be
// petted; the gifts cats leave wait on the window seat and the terrace wall. With no cat adopted
// the game's visiting cat sits on the terrace wall, as it sits on the pixel café's windowsill.
//
// Nothing here changes the game: care, petting, gifts and the cat moment stay with the game's own
// logic (game/pets.ts, game/living-cats.ts through CafeView, game/cat-gifts.ts, game/moments.ts).
// This draws them, turns taps into the page's tap targets, and pops the coins they pay.
// Art: assets/generated/floor-sample-v1/build/cats (scripts/art-gen/floor-cats-build.py).
import Phaser from 'phaser';
import type { GiftKind } from '../../game/cat-gifts';
import { formatMoney } from '../../game/format';
import { furnitureDef } from '../../game/furniture';
import { petActive, petPreferences, type CatId, type CatPersonality, type PetPreferences } from '../../game/pets';
import type { GameState } from '../../game/state';
import { t } from '../../i18n';
import { setCatSource } from '../../ui/cat-art';
import type { LivingCatView } from '../../ui/living-cats';
import type { CafeView } from '../cafe-view';
import type { CafeTapTarget } from '../phaser/cafe-scene';
import {
  GIFT_PLACES, catNode, catPlaces, catRoute, choosePlace, choosePlan, floorArea, planSeconds, placeRank,
  type CatPlace, type CatPlan, type CatStep, type CatsManifest,
} from './floors-cat-places';
import { IN_WELL_DEPTH } from './floors-decor-layers';
import { FX } from './floors-fx';
import { inWell, wellSink, worldPoint, type Building, type FloorPoint, type Point } from './floors-layout';

/** Where each pose is in a breed's strip (CAT_FRAMES). */
const FRAME = { walk: [0, 1, 2, 3], sit: 4, happy: 5, sleep: 6, groom: 7 } as const;
/** The cat that visits a café without cats (the pixel café draws the same one on its sill). */
const VISITOR: CatId = 'ginger';
const MANIFEST = 'cats/cats.json';
const sheetKey = (breed: string) => `cats/${breed}`;
const giftKey = (kind: string) => `cats/gift-${kind}`;
/** Plate pixels a second: a playful cat trots, a quiet one ambles. */
const SPEED: Record<CatPersonality, number> = { playful: 190, quiet: 120, affectionate: 150 };
/** How far before its paws the cup a cat knocked over lies. */
const SPILL_REACH = 62;
/** How wide a waiting gift is drawn. */
const GIFT_SIZE = 72;
/** Just over the terrace's plate, under everything that stands on it. */
const PATCH_DEPTH = -1.95;
const TEXT = { fontFamily: 'ui-rounded, "PingFang SC", system-ui, sans-serif', fontStyle: 'bold', color: '#4f3b2f', stroke: '#fffaf0' } as const;

/** What the scene lends the cats: the camera, eased towards a height of the building. */
export interface CatsHost { focusOn(worldY: number, dt: number): void }

interface Cat {
  /** The resident's id; null for the visiting cat. */
  id: CatId | null;
  breed: CatId;
  sprite: Phaser.GameObjects.Sprite | null;
  at: FloorPoint;
  /** The path node it left the paths at, or last passed. */
  node: string;
  /** Where it is, or is going. */
  place: CatPlace;
  steps: CatStep[];
  hop: { from: FloorPoint; to: FloorPoint; t: number; seconds: number } | null;
  plan: CatPlan;
  /** Seconds until it chooses what to do next. */
  timer: number;
  clock: number;
  /** The game's affection for it last frame: a rise is a petting. */
  affection: number;
  happy: boolean;
  alpha: number;
  facingLeft: boolean;
  snooze: number;
}

interface Gift { id: number; kind: GiftKind; sprite: Phaser.GameObjects.Image; at: Point; twinkle: number }

export class FloorsCats {
  private manifest: CatsManifest | null = null;
  private cats = new Map<CatId, Cat>();
  private visitor: Cat | null = null;
  private gifts = new Map<number, Gift>();
  /** The cup the cat of the moment knocked over. */
  private spill: { spot: object; at: FloorPoint; over: number; image: Phaser.GameObjects.Image } | null = null;
  private patches: Phaser.GameObjects.Image[] = [];
  private requested = new Set<string>();
  private places: CatPlace[] = [];
  private placesKey = '';
  private tag: Phaser.GameObjects.Text | null = null;
  /** The cat the building is following for the pet panel's "find cat". */
  private following: CatId | null = null;
  private happyVisitor = 0;
  private cued = false;

  constructor(private scene: Phaser.Scene, private view: CafeView, private base: string, private host: CatsHost) {}

  // ------------------------------------------------------------ art

  /** Queues the manifest, then the sheets of the cats the café has now, the gifts and the terrace's patches. */
  preload(state: GameState): void {
    const { load } = this.scene;
    load.json(MANIFEST, `${this.base}${MANIFEST}`);
    load.once(`filecomplete-json-${MANIFEST}`, (_key: string, _type: string, data: CatsManifest) => {
      this.manifest = data;
      for (const breed of state.pets.length ? state.pets.map(pet => pet.id) : [VISITOR]) this.request(breed);
      for (const kind of data.gifts) load.image(giftKey(kind), `${this.base}cats/gift-${kind}.webp`);
      for (const patch of data.roof ?? []) load.image(`cats/${patch.file}`, `${this.base}cats/${patch.file}`);
    });
  }

  create(): void {
    const heart = document.createElement('canvas');
    heart.width = heart.height = 44;
    const c = heart.getContext('2d')!;
    c.fillStyle = '#ee9aa6'; c.strokeStyle = '#7a5a44'; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(22, 39); c.bezierCurveTo(-6, 20, 6, -2, 22, 13); c.bezierCurveTo(38, -2, 50, 20, 22, 39); c.fill(); c.stroke();
    this.scene.textures.addCanvas('cat-heart', heart);
    // Dragging the building lets go of a cat it was following.
    this.scene.input.on('pointerdown', () => { this.following = null; });
    setCatSource({
      portrait: id => (this.manifest?.cats[id] ? `${this.base}cats/${id}-face.webp` : undefined),
      view: id => this.viewOf(id),
      locate: id => this.locate(id),
    });
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, () => setCatSource(null));
  }

  /** Starts loading a breed's sheet; true once it is here, with its walk. */
  private request(breed: string): boolean {
    const key = sheetKey(breed), size = this.manifest?.cats[breed], { load, textures, anims } = this.scene;
    if (!size) return false;
    if (textures.exists(key)) {
      if (!anims.exists(`${key}-walk`)) anims.create({ key: `${key}-walk`, frames: anims.generateFrameNumbers(key, { frames: [...FRAME.walk] }), frameRate: 8, repeat: -1 });
      return true;
    }
    if (!this.requested.has(key)) {
      this.requested.add(key);
      load.spritesheet(key, `${this.base}cats/${breed}.webp`, { frameWidth: size.frameWidth, frameHeight: size.frameHeight });
      if (this.scene.sys.settings.status >= Phaser.Scenes.CREATING && !load.isLoading()) load.start();
    }
    return false;
  }

  // ------------------------------------------------------------ each frame

  /** `dt` is the café's time (0 while paused); effects and the camera run on the frame's own time. */
  update(b: Building, dt: number, state: GameState): void {
    if (!this.manifest) return;
    this.layoutPatches(b);
    this.syncPlaces(b, state);
    this.syncResidents(b, dt, state);
    this.syncVisitor(b, dt, state);
    this.syncGifts(b);
    this.syncMoment();
    this.syncSpill(b);
    this.showSelection(b);
    for (const tip of this.view.tips.splice(0)) this.coins(tip.x, tip.y, tip.amount);
  }

  private layoutPatches(b: Building): void {
    const roof = this.manifest?.roof ?? [];
    if (!this.patches.length && roof.every(patch => this.scene.textures.exists(`cats/${patch.file}`))) {
      this.patches = roof.map(patch => this.scene.add.image(0, 0, `cats/${patch.file}`).setOrigin(0, 0).setDepth(PATCH_DEPTH));
    }
    this.patches.forEach((image, i) => {
      const at = worldPoint(b, { floor: 'roof', x: roof[i].x, y: roof[i].y });
      image.setPosition(at.x, at.y);
    });
  }

  /** The places open to cats follow the building and the furniture the player has out. */
  private syncPlaces(b: Building, state: GameState): void {
    const pieces = new Map<string, string>();
    for (const piece of state.decor.placed) if (piece.spot && furnitureDef(piece.id)?.surface === 'floor') pieces.set(piece.spot, piece.id);
    const key = `${b.floors.join()}|${[...pieces].join()}`;
    if (key === this.placesKey) return;
    this.placesKey = key;
    this.places = catPlaces(b.floors, pieces);
    // A cat whose place has gone thinks again.
    for (const cat of this.cats.values()) if (!this.places.some(place => place.id === cat.place.id)) cat.timer = 0;
  }

  private free(self?: Cat): CatPlace[] {
    const taken = new Set([...this.cats.values(), ...(this.visitor ? [this.visitor] : [])].filter(cat => cat !== self).map(cat => cat.place.id));
    return this.places.filter(place => !taken.has(place.id));
  }

  private makeCat(id: CatId | null, breed: CatId, place: CatPlace, plan: CatPlan): Cat {
    return {
      id, breed, sprite: null, at: { floor: place.floor, x: place.x, y: place.y }, node: place.from, place, steps: [], hop: null,
      plan, timer: 2 + this.cats.size * 2, clock: Math.random() * 3, affection: 0, happy: false, alpha: 1, facingLeft: Math.random() < .5, snooze: 0,
    };
  }

  private syncResidents(b: Building, dt: number, state: GameState): void {
    for (const [id, cat] of this.cats) {
      if (state.pets.some(pet => pet.id === id)) continue;
      cat.sprite?.destroy();
      this.cats.delete(id);
    }
    for (const pet of state.pets) {
      const prefs = petPreferences(pet), resting = !petActive(pet);
      let cat = this.cats.get(pet.id);
      if (!cat) {
        // A new resident starts at the free place that suits it best (a nap place when out of supplies).
        const home = this.free().filter(place => !resting || place.naps)
          .sort((p, q) => placeRank(q, prefs, b.floors) - placeRank(p, prefs, b.floors))[0];
        if (!home) continue;
        cat = this.makeCat(pet.id, pet.id, home, resting ? 'nap' : 'watch');
        this.cats.set(pet.id, cat);
      }
      const logic = this.view.livingCats.actors.get(pet.id), affection = logic?.affection ?? 0;
      if (affection > cat.affection + .25) this.petted(cat);
      cat.affection = affection;
      cat.happy = affection > 0;
      this.live(b, cat, dt, prefs, resting);
      this.draw(b, cat, dt, resting);
    }
  }

  /** Walks a cat on, or lets it choose what to do next once its time at a plan is up. */
  private live(b: Building, cat: Cat, dt: number, prefs: PetPreferences, resting: boolean): void {
    if (dt <= 0) return;
    cat.clock += dt;
    const moving = cat.steps.length > 0 || !!cat.hop;
    // A petted cat stops to enjoy it, unless it is in mid-jump or on the stairs.
    if (moving && !(cat.happy && !cat.hop && cat.alpha >= 1)) { this.walk(cat, dt, SPEED[prefs.personality]); return; }
    if (moving || cat.happy) return;
    // It stays by the cup it knocked over.
    if (this.culprit() === cat) return;
    // Out of supplies a cat sleeps where it can, until it is cared for again.
    if (resting && cat.plan === 'nap' && cat.place.naps) return;
    cat.timer -= dt;
    if (cat.timer > 0 && !(resting && cat.plan !== 'nap')) return;
    const plan = resting ? 'nap' : choosePlan(prefs.personality, Math.random());
    cat.plan = plan;
    cat.timer = planSeconds(plan, prefs.personality, Math.random());
    if (plan === 'groom' || (plan === 'nap' && cat.place.naps && this.places.includes(cat.place))) return;
    const goal = choosePlace(plan, prefs, this.free(cat), b.floors, cat.place.id, Math.random);
    if (goal) this.send(cat, goal, b);
  }

  /** Plans the walk to a place: down from a raised place to the path first. */
  private send(cat: Cat, goal: CatPlace, b: Building): void {
    const node = catNode(cat.node), steps: CatStep[] = [];
    if (Math.hypot(node.x - cat.at.x, node.y - cat.at.y) >= 1) steps.push({ ...node, hop: cat.place.hop });
    cat.steps = [...steps, ...catRoute(cat.node, goal, b.floors)];
    cat.place = goal;
    cat.node = goal.from;
  }

  private walk(cat: Cat, dt: number, speed: number): void {
    if (cat.hop) {
      const hop = cat.hop;
      hop.t = Math.min(1, hop.t + dt / hop.seconds);
      cat.at = { floor: hop.to.floor, x: Phaser.Math.Linear(hop.from.x, hop.to.x, hop.t), y: Phaser.Math.Linear(hop.from.y, hop.to.y, hop.t) };
      if (hop.t >= 1) { cat.at = { ...hop.to }; cat.hop = null; }
      return;
    }
    let left = speed * dt;
    while (cat.steps.length) {
      const next = cat.steps[0];
      if (next.jump) { cat.at = { floor: next.floor, x: next.x, y: next.y }; cat.alpha = 0; cat.steps.shift(); continue; }
      const dx = next.x - cat.at.x, dy = next.y - cat.at.y, distance = Math.hypot(dx, dy);
      if (Math.abs(dx) > .5) cat.facingLeft = dx < 0;
      if (next.hop) {
        cat.hop = { from: { ...cat.at }, to: { floor: next.floor, x: next.x, y: next.y }, t: 0, seconds: Phaser.Math.Clamp(distance / 420, .32, .7) };
        cat.steps.shift();
        break;
      }
      if (left <= 0) break;
      if (distance <= left) { cat.at = { floor: next.floor, x: next.x, y: next.y }; cat.steps.shift(); left -= distance; continue; }
      cat.at = { floor: cat.at.floor, x: cat.at.x + dx / distance * left, y: cat.at.y + dy / distance * left };
      left = 0;
    }
    // Fade out climbing into the floor above (or going down to the one below); fade in on arrival.
    const [first, second] = cat.steps;
    const distance = first ? Math.hypot(first.x - cat.at.x, first.y - cat.at.y) : 0;
    cat.alpha = Phaser.Math.Clamp(second?.jump ? distance / 140 : cat.alpha + dt * 3, 0, 1);
  }

  /** Puts the cat's sprite where it is, in the pose of what it is doing. */
  private draw(b: Building, cat: Cat, dt: number, resting: boolean): void {
    if (!this.request(cat.breed)) return;
    const key = sheetKey(cat.breed);
    cat.sprite ??= this.scene.add.sprite(0, 0, key, FRAME.sit).setOrigin(.5, 1);
    const sprite = cat.sprite, at = worldPoint(b, cat.at);
    const moving = cat.steps.length > 0 || !!cat.hop;
    // The jump's arc, and a little squash of breath in a sleeping cat.
    const lift = cat.hop ? Math.sin(Math.PI * cat.hop.t) * (36 + Math.hypot(cat.hop.to.x - cat.hop.from.x, cat.hop.to.y - cat.hop.from.y) * .18) : 0;
    const culprit = this.culprit() === cat;
    const asleep = !moving && !cat.happy && !culprit && (resting || cat.plan === 'nap');
    let breathe = 1;
    if (cat.hop) { sprite.anims.stop(); sprite.setFrame(cat.hop.t < .5 ? FRAME.walk[0] : FRAME.walk[2]).setFlipX(cat.facingLeft); }
    else if (moving && !cat.happy) {
      if (dt > 0 && (sprite.anims.currentAnim?.key !== `${key}-walk` || !sprite.anims.isPlaying)) sprite.play(`${key}-walk`);
      if (dt <= 0) sprite.anims.pause(); else sprite.anims.resume();
      sprite.setFlipX(cat.facingLeft);
    } else {
      sprite.anims.stop();
      const frame = cat.happy ? FRAME.happy : asleep ? FRAME.sleep : cat.plan === 'groom' && !culprit ? FRAME.groom : FRAME.sit;
      sprite.setFrame(frame).setFlipX(cat.facingLeft);
      if (asleep) breathe = 1 + .025 * Math.sin(cat.clock * 2.2);
      else if (frame === FRAME.groom) breathe = 1 + .02 * Math.sin(cat.clock * 9);
      else if (cat.happy) breathe = 1 + .03 * Math.sin(cat.clock * 12);
    }
    // On a bed a cat is drawn over the bed, which stands a little lower.
    // On the steps in a stairwell: its front edge hides what is below it.
    const sunk = wellSink(cat.at);
    if (sunk) sprite.setCrop(0, 0, sprite.width, Math.max(0, sprite.height - sunk));
    else if (sprite.isCropped) sprite.setCrop();
    sprite.setPosition(at.x, at.y - lift).setScale(1, breathe).setAlpha(cat.alpha).setDepth(inWell(cat.at) ? IN_WELL_DEPTH : at.y + (cat.place.kind === 'bed' ? 24 : 0) + .5);
    if (asleep && dt > 0 && cat.alpha >= 1) {
      cat.snooze -= dt;
      if (cat.snooze <= 0) { cat.snooze = 1.9; this.float('z', at.x + 26, at.y - sprite.displayHeight * .8, 30, sprite.depth + .1); }
    }
  }

  // ------------------------------------------------------------ the visiting cat

  /** Without residents the visiting cat sits on the terrace wall; petting it is the game's own (CafeView.petCat). */
  private syncVisitor(b: Building, dt: number, state: GameState): void {
    if (state.pets.length) {
      this.visitor?.sprite?.destroy();
      this.visitor = null;
      return;
    }
    const wall = this.places.find(place => place.id === 'roof/wall');
    if (!wall) return;
    this.visitor ??= this.makeCat(null, VISITOR, wall, 'watch');
    const cat = this.visitor;
    if (this.view.catHappy > this.happyVisitor + .25) this.petted(cat);
    this.happyVisitor = this.view.catHappy;
    cat.happy = this.view.catHappy > 0;
    cat.facingLeft = false;
    cat.clock += dt;
    // Now and then it washes a paw.
    cat.plan = cat.clock % 16 > 12 ? 'groom' : 'watch';
    this.draw(b, cat, dt, false);
  }

  // ------------------------------------------------------------ petting, taps, the moment

  private head(cat: Cat): Point | null {
    const sprite = cat.sprite;
    return sprite && sprite.alpha > .5 ? { x: sprite.x, y: sprite.y - sprite.displayHeight - 4 } : null;
  }

  /** Hearts over a cat that has just been petted. */
  private petted(cat: Cat): void {
    const at = this.head(cat);
    if (!at) return;
    for (let i = 0; i < 3; i++) {
      const heart = this.scene.add.image(at.x - 30 + i * 30, at.y + 10, 'cat-heart').setDepth(100000).setScale(0);
      this.scene.tweens.add({ targets: heart, y: at.y - 60 - (i % 2) * 26, scale: { from: 0, to: 1.25 }, delay: i * 110, duration: 420, ease: 'Back.Out' });
      this.scene.tweens.add({ targets: heart, alpha: 0, delay: 700 + i * 110, duration: 380, onComplete: () => heart.destroy() });
    }
  }

  private float(text: string, x: number, y: number, size: number, depth: number): void {
    const label = this.scene.add.text(x, y, text, { ...TEXT, fontSize: `${size}px`, strokeThickness: 8 }).setOrigin(.5, 1).setDepth(depth);
    this.scene.tweens.add({ targets: label, x: x + 22, y: y - 54, alpha: { from: 1, to: 0 }, scale: { from: .8, to: 1.3 }, duration: 1700, onComplete: () => label.destroy() });
  }

  /** Coins a gift or the cat's moment paid, over where it was. */
  private coins(x: number, y: number, amount: number): void {
    const label = this.scene.add.text(x, y, `+${formatMoney(amount)}`, { ...TEXT, fontSize: '70px', color: '#8a5a1c', strokeThickness: 16 }).setOrigin(.5, 1).setDepth(100001);
    this.scene.tweens.add({ targets: label, y: y - 80, alpha: { from: 1, to: 0 }, delay: 500, duration: 1000, onComplete: () => label.destroy() });
    for (let i = 0; i < 5; i++) {
      const star = this.scene.add.image(x + Phaser.Math.Between(-60, 60), y + Phaser.Math.Between(-70, 10), 'sparkle').setDepth(100000).setScale(0);
      this.scene.tweens.add({ targets: star, scale: { from: 0, to: 1.6 }, alpha: { from: 1, to: 0 }, delay: i * 90, duration: 700, onComplete: () => star.destroy() });
    }
  }

  /**
   * What a tap lands on: a waiting gift, the name over a marked cat, or a cat (the nearest, each at
   * least `reach` around). A resident is the page's to mark and pet; a cat without an id is the visiting one.
   */
  tap(x: number, y: number, reach: number): CafeTapTarget | null {
    this.following = null;
    for (const gift of this.gifts.values()) {
      if (Math.hypot(x - gift.at.x, y - (gift.at.y - GIFT_SIZE / 2)) <= reach + GIFT_SIZE / 2) return { kind: 'gift', id: gift.id };
    }
    // The name floating over a marked cat opens its card.
    if (this.tag?.visible && this.view.selectedCat && this.tag.getBounds().contains(x, y)) return { kind: 'cat', id: this.view.selectedCat, card: true };
    const hits = [...this.cats.values(), ...(this.visitor ? [this.visitor] : [])].flatMap(cat => {
      const sprite = cat.sprite;
      if (!sprite || sprite.alpha <= .5) return [];
      const centre = { x: sprite.x, y: sprite.y - sprite.displayHeight * .45 };
      const near = Math.abs(x - centre.x) <= Math.max(reach, sprite.displayWidth * .4) && Math.abs(y - centre.y) <= Math.max(reach, sprite.displayHeight * .55);
      return near ? [{ cat, distance: Math.hypot(x - centre.x, y - centre.y) }] : [];
    }).sort((a, b) => a.distance - b.distance);
    return hits.length ? { kind: 'cat', id: hits[0].cat.id ?? undefined } : null;
  }

  /** The cat that made the mess, or the visiting cat. */
  private culprit(): Cat | null {
    const moment = this.view.moment;
    if (moment?.kind !== 'cat') return null;
    return this.cats.get(moment.spot?.catId as CatId) ?? this.visitor ?? [...this.cats.values()][0] ?? null;
  }

  /** Where the cat moment's cue floats: over that cat. */
  momentPoint(): Point | null {
    const cat = this.culprit();
    return cat ? this.head(cat) : null;
  }

  /** The cup it knocked over lies before its paws until it is tidied up (or the moment passes). */
  private syncSpill(b: Building): void {
    const cat = this.culprit(), spot = this.view.moment?.spot ?? null;
    if (this.spill && (!cat || this.spill.spot !== spot)) {
      const gone = this.spill.image;
      this.scene.tweens.add({ targets: gone, alpha: 0, duration: 260, onComplete: () => gone.destroy() });
      this.spill = null;
    }
    if (!cat || !spot || !this.scene.textures.exists(FX) || !cat.sprite) return;
    if (!this.spill && !cat.hop && cat.sprite.alpha > .5) {
      const at = { ...cat.at, x: cat.at.x + (cat.facingLeft ? -1 : 1) * SPILL_REACH, y: cat.at.y + 4 };
      this.spill = { spot, at, over: cat.sprite.depth - worldPoint(b, cat.at).y, image: this.scene.add.image(0, 0, FX, 'spill').setOrigin(.5, 1).setFlipX(cat.facingLeft) };
    }
    if (!this.spill || b.offsets[this.spill.at.floor] === undefined) return;
    const at = worldPoint(b, this.spill.at);
    this.spill.image.setPosition(at.x, at.y).setDepth(at.y + this.spill.over + .3);
  }

  /** Tells the page where the cat moment is, so the coins it pays pop there (CafeView.tipAtMoment). */
  private syncMoment(): void {
    const at = this.momentPoint();
    if (at) this.view.momentTarget = { x: at.x, y: at.y - 30, w: 0, h: 0 };
    else if (this.cued) this.view.momentTarget = null;
    this.cued = !!at;
  }

  // ------------------------------------------------------------ the pet panel

  private viewOf(id: CatId): LivingCatView | undefined {
    const cat = this.cats.get(id);
    if (!cat) return undefined;
    const moving = cat.steps.length > 0 || !!cat.hop;
    return {
      area: floorArea(cat.at.floor),
      behavior: moving ? 'patrol' : cat.plan === 'nap' ? 'sleep' : cat.plan === 'groom' ? 'groom' : 'watch',
      affection: cat.affection,
      targetKind: cat.place.kind === 'window' ? 'window' : cat.place.kind,
    };
  }

  /** The pet panel's "find cat": the building scrolls to the cat and stays with it while it is marked. */
  private locate(id: CatId): boolean {
    if (!this.cats.has(id)) return false;
    this.following = id;
    return true;
  }

  /** The selected cat's name floats over it; a cat being found also keeps the building on it. */
  private showSelection(b: Building): void {
    const id = this.view.selectedCat, cat = id && this.view.catSelectionSeconds > 0 ? this.cats.get(id) : undefined;
    if (!cat) this.following = null;
    const at = cat && this.head(cat);
    if (!cat || !at) { this.tag?.setVisible(false); return; }
    this.tag ??= this.scene.add.text(0, 0, '', { ...TEXT, fontSize: '54px', strokeThickness: 14 }).setOrigin(.5, 1).setDepth(100001);
    // The chevron says the name can be tapped, for the cat's card.
    const name = `${t(`pet.${cat.breed}.name`).split(' · ')[0]} ›`;
    if (this.tag.text !== name) this.tag.setText(name);
    this.tag.setVisible(true).setPosition(at.x, at.y - 6 - 6 * Math.abs(Math.sin(this.scene.time.now / 300)));
    if (this.following === cat.id) this.host.focusOn(worldPoint(b, cat.at).y - 120, this.scene.game.loop.delta / 1000);
  }

  // ------------------------------------------------------------ gifts

  /** Shows the gifts waiting (CafeView.gifts) at their places and tells the page where, for the coins. */
  private syncGifts(b: Building): void {
    const waiting = this.view.gifts;
    for (const [id, gift] of this.gifts) {
      if (waiting.some(g => g.id === id)) continue;
      this.scene.tweens.add({ targets: gift.sprite, scale: gift.sprite.scale * 1.5, alpha: 0, duration: 220, onComplete: () => gift.sprite.destroy() });
      this.gifts.delete(id);
    }
    for (const g of waiting) {
      const place = GIFT_PLACES[g.spot % GIFT_PLACES.length], at = worldPoint(b, place);
      let gift = this.gifts.get(g.id);
      if (!gift) {
        if (!this.scene.textures.exists(giftKey(g.kind))) continue;
        const sprite = this.scene.add.image(at.x, at.y, giftKey(g.kind)).setOrigin(.5, 1);
        sprite.setScale(GIFT_SIZE / sprite.width);
        gift = { id: g.id, kind: g.kind, sprite, at, twinkle: Math.random() * 2 };
        this.gifts.set(g.id, gift);
      }
      gift.at = at;
      const now = this.scene.time.now / 1000;
      gift.sprite.setPosition(at.x, at.y - 5 * Math.abs(Math.sin(now * 2.4 + g.id))).setDepth(at.y + .4);
      // A twinkle now and then, so a gift is noticed.
      if (now > gift.twinkle) {
        gift.twinkle = now + 1.8 + Math.random();
        const star = this.scene.add.image(at.x + Phaser.Math.Between(-24, 24), at.y - GIFT_SIZE + Phaser.Math.Between(-6, 22), 'sparkle').setDepth(at.y + .6).setScale(0);
        this.scene.tweens.add({ targets: star, scale: { from: 0, to: 1.1 }, alpha: { from: 1, to: 0 }, angle: 45, duration: 800, onComplete: () => star.destroy() });
      }
    }
    this.view.giftTargets = [...this.gifts.values()].map(gift => ({ id: gift.id, x: gift.at.x, y: gift.at.y - GIFT_SIZE - 10, w: 0, h: 0 }));
  }
}
