// The Phaser game for the floors view: the same surface as render/phaser/game.ts (CafeGame), so
// the page can draw the café as the cross-section building instead of the pixel room. It fills
// the stage at the screen's resolution; the building is as wide as the stage and scrolls up and down.
import Phaser from 'phaser';
import type { Sim } from '../../game/sim';
import type { GameState } from '../../game/state';
import type { CafeView } from '../cafe-view';
import type { CafeHooks } from '../phaser/cafe-scene';
import type { CafeSize } from '../phaser/game';
import { installFloorsUi } from '../../ui/floors-ui';
import { setIconArt } from '../../ui/icon-art';
import { floorsIconArt } from './floors-icons';
import { FLOORS_ART, FloorsScene, SHEETS, type DecorManifest, type FurnitureManifest, type SheetSize } from './floors-scene';

function supportsWebGL(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
}

export class FloorsGame {
  private game: Phaser.Game | null = null;
  private scene: FloorsScene | null = null;
  private cssSize: { width: number; height: number } | null = null;
  /** Resolves once the building has drawn its first frame. */
  readonly ready: Promise<void>;
  get startupStatus(): string { return this.scene?.status ?? 'loading sheet sizes'; }

  constructor(private canvas: HTMLCanvasElement, view: CafeView, sim: Sim, getState: () => GameState, hooks: CafeHooks) {
    // The page around the building takes the floors view's paper look.
    installFloorsUi(canvas.ownerDocument.body);
    let created!: () => void, failed!: (error: Error) => void;
    this.ready = new Promise((resolve, reject) => { created = resolve; failed = reject; });
    void this.start(view, sim, getState, hooks, created, failed).catch(failed);
  }

  private async start(view: CafeView, sim: Sim, getState: () => GameState, hooks: CafeHooks, created: () => void, failed: (error: Error) => void): Promise<void> {
    // Frame sizes of every character strip (scripts/art-gen/floor-sample-sheets.mjs).
    const response = await fetch(`${FLOORS_ART}sheets.json`);
    if (!response.ok) throw new Error('Could not load the floors sheet index');
    const sizes = await response.json() as Record<string, SheetSize>;
    const missing = SHEETS.filter(key => !sizes[key]);
    if (missing.length) throw new Error(`Floors sheets missing: ${missing.join(', ')}`);
    // The decor layers are optional: without them the floors are drawn as single pictures.
    const decor = await fetch(`${FLOORS_ART}decor/decor.json`).then(r => (r.ok ? r.json() as Promise<DecorManifest> : null)).catch(() => null);
    const furniture = await fetch(`${FLOORS_ART}furniture/furniture.json`).then(r => (r.ok ? r.json() as Promise<FurnitureManifest> : null)).catch(() => null);
    // The ledger shows the floors' own pictures: menu, pantry and upgrade icons, furniture and decor.
    const list = (path: string) => fetch(`${FLOORS_ART}${path}`).then(r => (r.ok ? r.json() as Promise<string[]> : [])).catch(() => []);
    const [thumbs, icons] = await Promise.all([list('thumbs/thumbs.json'), list('icons/icons.json')]);
    setIconArt(floorsIconArt(FLOORS_ART, furniture, thumbs, icons));
    this.scene = new FloorsScene(view, sim, getState, hooks, sizes, () => { this.apply(); created(); }, failed, decor, furniture);
    // Browser checks read the building's camera and actors from here.
    if (import.meta.env.DEV) (window as unknown as { floorsScene?: FloorsScene }).floorsScene = this.scene;
    const { width, height } = this.backing();
    this.game = new Phaser.Game({
      type: supportsWebGL() ? Phaser.WEBGL : Phaser.CANVAS,
      canvas: this.canvas,
      width, height,
      antialias: true,
      pixelArt: false,
      banner: false,
      audio: { noAudio: true },
      loader: { imageLoadType: 'HTMLImageElement', maxParallelDownloads: 6 },
      input: { keyboard: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE },
      scene: this.scene,
    });
    this.apply();
  }

  /** Drawing-buffer size: the stage at the screen's resolution, at most twice its CSS pixels. */
  private backing(): { width: number; height: number } {
    const size = this.cssSize ?? { width: this.canvas.clientWidth || 390, height: this.canvas.clientHeight || 700 };
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    return { width: Math.max(1, Math.round(size.width * ratio)), height: Math.max(1, Math.round(size.height * ratio)) };
  }

  resize(size: CafeSize, viewport?: { width: number; height: number }): void {
    this.cssSize = viewport ?? { width: size.cssWidth, height: size.cssHeight };
    this.apply();
  }

  private apply(): void {
    const { canvas } = this, size = this.cssSize;
    if (!size) return;
    Object.assign(canvas.style, { position: 'absolute', left: '0px', top: '0px', width: `${size.width}px`, height: `${size.height}px`, imageRendering: 'auto', touchAction: 'none' });
    if (canvas.parentElement) Object.assign(canvas.parentElement.style, { width: `${size.width}px`, height: `${size.height}px` });
    if (!this.game) return;
    const { width, height } = this.backing();
    if (canvas.width !== width || canvas.height !== height) this.game.scale.resize(width, height);
    this.game.scale.refresh();
    this.scene?.resized();
  }

  destroy(): void {
    this.game?.destroy(false);
  }
}
