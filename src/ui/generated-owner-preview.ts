import type { Look } from '../game/state';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { STANDING_CHARACTER_SCALE, preloadReferenceLook } from '../render/reference-character-art';
import { character } from '../render/sprites';
import { portraitArt } from './portrait-art';

export interface GeneratedOwnerPreview {
  readonly canvas: HTMLCanvasElement;
  update(look: Look): void;
  dispose(): void;
}
export interface GeneratedOwnerPreviewOptions {
  /** Retained for callers compiled against the former single-image preview. */
  readonly createImage?: () => HTMLImageElement;
}

/**
 * One owned canvas for onboarding, profile editing and opening confirmation.
 * Every look uses the same complete atlas family as the running café.
 * Tokens fence late shared loads after a new look, dismissal or disposal.
 */
export function createGeneratedOwnerPreview(initialLook: Look, cssScale: number, className = 'char-sprite',
  _options: GeneratedOwnerPreviewOptions = {}): GeneratedOwnerPreview {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.width = 18;
  canvas.height = 28;
  canvas.style.width = `${18 * cssScale}px`;
  canvas.style.height = `${28 * cssScale}px`;
  let generation = 0;
  let disposed = false;
  const update = (look: Look) => {
    if (disposed) return;
    const token = ++generation;
    const snapshot = { ...look };
    canvas.dataset.loading = 'true';
    delete canvas.dataset.loadError;
    // The floors view previews its painted owner (portrait-art.ts), as tall as the pixel one.
    const painted = portraitArt({ look: snapshot });
    if (painted) {
      void painted.then(figure => {
        if (disposed || token !== generation) return;
        canvas.width = figure.width;
        canvas.height = figure.height;
        canvas.style.height = `${28 * cssScale}px`;
        canvas.style.width = `${28 * cssScale * figure.width / figure.height}px`;
        canvas.getContext('2d')?.drawImage(figure, 0, 0);
        canvas.dataset.generatedOwner = 'true';
        canvas.dataset.portrait = 'painted';
        canvas.dataset.loading = 'false';
      }).catch(() => { if (!disposed && token === generation) sprite(snapshot, token); });
      return;
    }
    sprite(snapshot, token);
  };
  const sprite = (snapshot: Look, token: number) => {
    delete canvas.dataset.portrait;
    void preloadReferenceLook(snapshot).then(() => {
      if (disposed || token !== generation) return;
      const frame = character(snapshot, 'owner').stand;
      const art = fineSpriteArt(frame);
      canvas.width = art.canvas.width;
      canvas.height = art.canvas.height;
      canvas.style.width = `${frame.width * cssScale / STANDING_CHARACTER_SCALE}px`;
      canvas.style.height = `${frame.height * cssScale / STANDING_CHARACTER_SCALE}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art.canvas, 0, 0);
      }
      canvas.dataset.generatedOwner = 'true';
      canvas.dataset.loading = 'false';
    }).catch(() => {
      if (disposed || token !== generation) return;
      canvas.dataset.loading = 'false';
      canvas.dataset.loadError = 'true';
    });
  };
  update(initialLook);
  return { canvas, update, dispose() { if (!disposed) { disposed = true; generation++; } } };
}
