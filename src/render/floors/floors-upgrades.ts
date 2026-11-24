// What upgrades change in the building: the espresso machine on the ground floor at levels 5, 10 and 15,
// and the basement kitchen, whose right half opens up as it is expanded and whose left half fills with the
// equipment the unlocked dishes call for (game/kitchen.ts). Both are put together on a canvas from
// build/upgrades (scripts/art-gen/floor-upgrades-build.py), drawn again only when something changes.
import type Phaser from 'phaser';
import { installedEquipment } from '../../game/kitchen';
import type { GameState } from '../../game/state';
import { FLOOR_ART } from './floors-layout';

/** The basement's table, which stands in front of whoever is behind it: where it is in the picture, and its outline. */
export const TABLE = 'upgrades/table';
export const TABLE_BOX = { x: 452, y: 498, w: 468, h: 214 } as const;
const TABLE_OUTLINE: readonly [number, number][] = [[466, 498], [453, 524], [453, 543], [467, 543], [467, 711], [911, 711], [911, 543], [919, 543], [919, 524], [908, 498]];
const BARE = 'upgrades/basement-bare', PIECES = 'upgrades/pieces', MANIFEST = 'upgrades/pieces.json';
interface Piece { x: number; y: number; w: number; h: number; at: [number, number] }
interface Manifest { kitchen: [number, number]; clear: [number, number, number, number]; pieces: Record<string, Piece> }

/** Machine levels with a look of their own, and the look at a level: 0 is the one in the fixtures layer. */
export const MACHINE_LEVELS = [5, 10, 15] as const;
export const machineTier = (level: number): number => MACHINE_LEVELS.filter(at => level >= at).length;

/** The pieces the kitchen is made of now, back to front. `expanded` is how often it has been (0 to 2). */
export function kitchenPieces(equipment: ReadonlySet<string>, expanded: number): string[] {
  const has = (id: string) => equipment.has(id);
  return [
    ...(expanded < 1 ? ['stage-1'] : expanded < 2 ? ['stage-2'] : []),
    // Against the back wall: the cabinets take the place of the peels and the two halves of the shelves.
    // (The peels are painted down to the bowl in front of them, so they go with it.)
    ...(has('convection') ? ['convection'] : has('sheeter') ? [] : ['peels']),
    has('proofer') ? 'proofer' : 'shelf-left',
    has('pastryFridge') ? 'pastryFridge' : 'shelf-right',
    // On the table, then on the floor.
    has('sheeter') ? 'sheeter' : 'bowl',
    has('standMixer') ? 'standMixer' : 'jars',
    ...(has('kettle') || has('fryer') ? ['kettle', 'fryer'].filter(has) : ['basket']),
    has('mixer') ? 'mixer' : 'pot',
  ];
}

export class FloorsUpgrades {
  private kitchen: { texture: Phaser.Textures.CanvasTexture; table: Phaser.Textures.CanvasTexture; signature: string } | null = null;
  /** There is one such layer, whatever the décor. */
  private fixtures: { texture: Phaser.Textures.CanvasTexture; tier: number } | null = null;
  private timer = 0;

  constructor(private scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene, base: string): void {
    for (const key of [BARE, PIECES]) scene.load.image(key, `${base}${key}.webp`);
    scene.load.json(MANIFEST, `${base}${MANIFEST}`);
  }

  private get manifest(): Manifest { return this.scene.cache.json.get(MANIFEST) as Manifest; }
  private picture(key: string): CanvasImageSource { return this.scene.textures.get(key).getSourceImage() as HTMLImageElement; }

  private put(c: CanvasRenderingContext2D, name: string): void {
    const piece = this.manifest.pieces[name];
    if (piece) c.drawImage(this.picture(PIECES), piece.x, piece.y, piece.w, piece.h, piece.at[0], piece.at[1], piece.w, piece.h);
  }

  /** Draws the basement's picture (FLOOR_ART.basement) and `TABLE` as the café's kitchen is now. */
  updateKitchen(state: GameState): void {
    const pieces = kitchenPieces(installedEquipment(state), state.upgrades.cook), signature = pieces.join();
    if (!this.kitchen) {
      const [width, height] = this.manifest.kitchen;
      const canvas = (key: string, w: number, h: number) => this.scene.textures.createCanvas(key, w, h)!;
      this.kitchen = { texture: canvas(FLOOR_ART.basement.image, width, height), table: canvas(TABLE, TABLE_BOX.w, TABLE_BOX.h), signature: '' };
      const t = this.kitchen.table.getContext();
      t.beginPath();
      for (const [x, y] of TABLE_OUTLINE) t.lineTo(x - TABLE_BOX.x, y - TABLE_BOX.y);
      t.clip();
    }
    if (signature === this.kitchen.signature) return;
    this.kitchen.signature = signature;
    const c = this.kitchen.texture.getContext();
    c.drawImage(this.picture(BARE), 0, 0);
    for (const name of pieces) this.put(c, name);
    this.kitchen.texture.refresh();
    this.kitchen.table.getContext().drawImage(this.kitchen.texture.getSourceImage() as HTMLCanvasElement, -TABLE_BOX.x, -TABLE_BOX.y);
    this.kitchen.table.refresh();
  }

  /** The ground floor's fixtures layer `key` with the machine of this level in it; the layer itself at the first. */
  fixturesTexture(key: string, level: number): string {
    const tier = machineTier(level), name = `${key}|machine`;
    if (!tier) return key;
    const source = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
    this.fixtures ??= { texture: this.scene.textures.createCanvas(name, source.width, source.height)!, tier: 0 };
    if (tier !== this.fixtures.tier) {
      this.fixtures.tier = tier;
      const c = this.fixtures.texture.getContext(), [x0, y0, x1, y1] = this.manifest.clear;
      c.clearRect(0, 0, source.width, source.height);
      c.drawImage(source, 0, 0);
      c.clearRect(x0, y0, x1 - x0, y1 - y0);
      this.put(c, `machine-${tier}`);
      this.fixtures.texture.refresh();
    }
    return name;
  }

  /** Keeps the kitchen up to date; what it holds changes rarely, so it looks twice a second. */
  update(dt: number, state: GameState): void {
    this.timer -= dt;
    if (this.timer > 0 || !state.kitchen) return;
    this.timer = .5;
    this.updateKitchen(state);
  }
}
