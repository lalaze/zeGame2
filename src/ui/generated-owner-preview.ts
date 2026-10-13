import type { Look } from '../game/state';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { GENERATED_MAIN_ASSETS, generatedMainSource, getGeneratedStaffAdapter } from '../render/generated-main-art';
import { GENERATED_STAFF_DENSITY, GENERATED_STAFF_FOOT, GENERATED_STAFF_FRAME_IDS, generatedStaffEligible,
  type GeneratedStaffFrameMeta, type GeneratedStaffManifest } from '../render/generated-staff-art';
import manifestJson from '../render/generated-staff-manifest.json';
import { character } from '../render/sprites';

export interface GeneratedOwnerPreview {
  readonly canvas: HTMLCanvasElement;
  update(look: Look): void;
  dispose(): void;
}
export interface GeneratedOwnerPreviewOptions {
  /** Optional image factory for deterministic loading tests. */
  readonly createImage?: () => HTMLImageElement;
}

const STANDING_ID = 'barista-down-stand';
const W = 18, H = 28, D = GENERATED_STAFF_DENSITY;

/** Match the adapter's single, whole-set scale without loading eight unused poses. */
function standingGeometry(): { meta: GeneratedStaffFrameMeta; scale: number } | null {
  const manifest = manifestJson as GeneratedStaffManifest;
  if (manifest.identity !== 'barista-default' || manifest.frames.length !== GENERATED_STAFF_FRAME_IDS.length) return null;
  const ids = new Set<string>();
  let scale = Infinity;
  let standing: GeneratedStaffFrameMeta | undefined;
  for (const meta of manifest.frames) {
    const id = `barista-${meta.direction}-${meta.state}`;
    if (!GENERATED_STAFF_FRAME_IDS.some(expected => expected === id) || ids.has(id)) return null;
    ids.add(id);
    const { x, y, w, h } = meta.bbox;
    const { x: fx, y: fy } = meta.foot;
    if (![x, y, w, h, fx, fy].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 ||
      fx < x || fx > x + w || fy <= y || fy > y + h) return null;
    for (const [extent, room] of [[fx - x, 8], [x + w - fx, 8], [fy - y, 26], [y + h - fy, 1]]) {
      if (extent > 0) scale = Math.min(scale, room / extent);
    }
    if (id === STANDING_ID) standing = meta;
  }
  return standing && Number.isFinite(scale) && scale > 0 ? { meta: standing, scale } : null;
}

/**
 * One owned canvas for onboarding, profile editing and opening confirmation.
 * A running café's shared adapter wins. Before the game exists, load only its
 * selected standing bitmap. Keep the legacy frame throughout loading/errors.
 * Dispose when leaving the page; late image callbacks cannot change a new look.
 */
export function createGeneratedOwnerPreview(initialLook: Look, cssScale: number, className = 'char-sprite',
  options: GeneratedOwnerPreviewOptions = {}): GeneratedOwnerPreview {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  let pending: HTMLImageElement | null = null;
  let generation = 0;
  let disposed = false;
  const cancel = () => {
    if (!pending) return;
    pending.onload = null; pending.onerror = null;
    pending.removeAttribute('src');
    pending = null;
  };
  const size = (width: number, height: number, logicalWidth: number, logicalHeight: number, generated: boolean) => {
    canvas.width = width; canvas.height = height;
    canvas.style.width = `${logicalWidth * cssScale}px`;
    canvas.style.height = `${logicalHeight * cssScale}px`;
    canvas.dataset.generatedOwner = String(generated);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = false;
    return ctx;
  };
  const paintFrame = (frame: HTMLCanvasElement, generated: boolean) => {
    const source = generated ? fineSpriteArt(frame).canvas : frame;
    size(source.width, source.height, frame.width, frame.height, generated)?.drawImage(source, 0, 0);
  };
  const update = (look: Look) => {
    if (disposed) return;
    const token = ++generation;
    cancel();
    const snapshot = { ...look };
    const fallback = character(snapshot, 'owner');
    paintFrame(fallback.stand, false);
    if (!generatedStaffEligible({ role: 'owner', look: snapshot })) return;
    const adapter = getGeneratedStaffAdapter();
    if (adapter) {
      const result = adapter.resolve({ role: 'owner', look: snapshot }, fallback);
      if (result.generated) paintFrame(result.frames.stand, true);
      return; // An incomplete in-game set must also remain legacy in the UI.
    }
    const geometry = standingGeometry();
    const path = GENERATED_MAIN_ASSETS[STANDING_ID];
    if (!geometry || !path) return;
    const paintSource = (source: CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number }) => {
      if (disposed || token !== generation) return;
      const currentAdapter = getGeneratedStaffAdapter();
      if (currentAdapter) {
        const result = currentAdapter.resolve({ role: 'owner', look: snapshot }, fallback);
        paintFrame(result.frames.stand, result.generated);
        return;
      }
      const width = source.naturalWidth ?? source.width, height = source.naturalHeight ?? source.height;
      const { meta, scale } = geometry;
      const { x, y, w, h } = meta.bbox;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || x + w > width || y + h > height) return;
      try {
        size(W * D, H * D, W, H, true)?.drawImage(source, x, y, w, h,
          (GENERATED_STAFF_FOOT.x + (x - meta.foot.x) * scale) * D,
          (GENERATED_STAFF_FOOT.y + (y - meta.foot.y) * scale) * D, w * scale * D, h * scale * D);
      } catch {
        paintFrame(fallback.stand, false);
      }
    };
    const installed = generatedMainSource(STANDING_ID);
    if (installed) { paintSource(installed); return; }
    try {
      const image = options.createImage?.() ?? new Image();
      let settled = false;
      const finish = (loaded: boolean) => {
        if (settled) return;
        settled = true;
        image.onload = null; image.onerror = null;
        if (pending === image) pending = null;
        if (loaded) paintSource(image);
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      pending = image;
      image.src = `${import.meta.env.BASE_URL}art/generated/${path}`;
      if (image.complete && image.naturalWidth > 0) finish(true);
    } catch {
      cancel(); // Keep the already-painted fallback.
    }
  };
  update(initialLook);
  return { canvas, update, dispose() { if (!disposed) { disposed = true; generation++; cancel(); } } };
}
