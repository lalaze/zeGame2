import Phaser from 'phaser';
import { viewportFrame } from '../viewport-frame';
import { SCENE_W, sceneHeight } from '../../game/layout';
import type { Sim } from '../../game/sim';
import type { GameState } from '../../game/state';
import type { CafeView } from '../cafe-view';
import { CafeScene, type CafeHooks } from './cafe-scene';

function supportsWebGL(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl');
  } catch {
    return false;
  }
}

/** How big the café is drawn: its drawing buffer, its size on the page, and art-pixel scale. */
export interface CafeSize {
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  /** Device pixels per art pixel in the drawing buffer. */
  backing: number;
  /** Whether the browser smooths the buffer down to its size on the page. */
  smooth: boolean;
}

/** The Phaser game that draws the café into the page's `<canvas>` and runs the loop. */
export class CafeGame {
  private game: Phaser.Game;
  private scene: CafeScene;
  private size: CafeSize | null = null;
  private booted = false;
  private viewport?: { width: number; height: number };
  /** Resolves once the scene is up and drawing. */
  readonly ready: Promise<void>;

  constructor(private canvas: HTMLCanvasElement, view: CafeView, sim: Sim, getState: () => GameState, hooks: CafeHooks) {
    let created!: () => void;
    let failed!: (error: Error) => void;
    this.ready = new Promise((resolve, reject) => { created = resolve; failed = reject; });
    this.scene = new CafeScene(view, sim, getState, hooks, () => {
      this.booted = true;
      this.apply();
      // Do not expose the café until its first frame has actually rendered.
      this.game.events.once(Phaser.Core.Events.POST_RENDER, created);
    }, failed);
    this.game = new Phaser.Game({
      // Phaser needs a definite renderer when given an existing canvas. v4 is built for
      // WebGL; its canvas renderer is only a fallback for browsers without it.
      type: supportsWebGL() ? Phaser.WEBGL : Phaser.CANVAS,
      canvas,
      width: SCENE_W,
      height: sceneHeight(),
      pixelArt: true,
      roundPixels: true,
      transparent: true,
      banner: false,
      audio: { noAudio: true },
      // Load images directly, avoiding the XHR -> Blob URL -> image decoding path.
      // A small queue limits simultaneous downloads and texture uploads on phones.
      loader: { imageLoadType: 'HTMLImageElement', maxParallelDownloads: 6 },
      // Keyboard shortcuts are handled by the page, which knows when a dialog is open.
      input: { keyboard: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE },
      scene: this.scene,
    });
  }

  destroy(): void {
    this.game.destroy(false);
  }

  resize(size: CafeSize, viewport?: { width: number; height: number }): void {
    this.size = size;
    this.viewport = viewport;
    if (this.booted) this.apply();
  }

  private apply(): void {
    const size = this.size;
    if (!size) return;
    const { canvas } = this;
    const frame = viewportFrame(size, this.viewport);
    this.scene.viewportFrame = frame;
    this.scene.backing = size.backing;
    if (canvas.width !== frame.width || canvas.height !== frame.height) this.game.scale.resize(frame.width, frame.height);
    canvas.style.width = `${frame.cssWidth}px`;
    canvas.style.height = `${frame.cssHeight}px`;
    canvas.style.position = 'absolute';
    canvas.style.left = `${frame.left}px`;
    canvas.style.top = `${frame.top}px`;
    if (canvas.parentElement) {
      canvas.parentElement.style.width = `${size.cssWidth}px`;
      canvas.parentElement.style.height = `${size.cssHeight}px`;
    }
    canvas.style.imageRendering = size.smooth ? 'auto' : 'pixelated';
    // Pointer positions are mapped through the canvas's size on the page.
    this.game.scale.refresh();
  }
}
