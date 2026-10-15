import type { Look } from '../game/state';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { STANDING_CHARACTER_SCALE, preloadReferenceCharacters } from '../render/reference-character-art';
import { character } from '../render/sprites';

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
    void preloadReferenceCharacters().then(() => {
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
