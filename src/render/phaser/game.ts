import Phaser from 'phaser';
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
  /** Resolves once the scene is up and drawing. */
  readonly ready: Promise<void>;

  constructor(private canvas: HTMLCanvasElement, view: CafeView, sim: Sim, getState: () => GameState, hooks: CafeHooks) {
    let created!: () => void;
    this.ready = new Promise((resolve) => (created = resolve));
    this.scene = new CafeScene(view, sim, getState, hooks, () => {
      this.booted = true;
      this.apply();
      created();
    });
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
      // Keyboard shortcuts are handled by the page, which knows when a dialog is open.
      input: { keyboard: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE },
      scene: this.scene,
    });
  }

  resize(size: CafeSize): void {
    this.size = size;
    if (this.booted) this.apply();
  }

  private apply(): void {
    const size = this.size;
    if (!size) return;
    const { canvas } = this;
    this.scene.backing = size.backing;
    if (canvas.width !== size.width || canvas.height !== size.height) this.game.scale.resize(size.width, size.height);
    canvas.style.width = `${size.cssWidth}px`;
    canvas.style.height = `${size.cssHeight}px`;
    canvas.style.imageRendering = size.smooth ? 'auto' : 'pixelated';
    // Pointer positions are mapped through the canvas's size on the page.
    this.game.scale.refresh();
  }
}
