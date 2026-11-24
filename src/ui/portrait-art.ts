// Pictures of people the page shows outside the café: partners, guests in the journal, the owner in
// the opening flow. The pixel view draws them from its sprites. The floors view (?floors) supplies
// its painted characters here, so the page matches the building; without a source, or for someone
// the source has no picture of, the caller's own sprite is shown.
import type { Look } from '../game/state';

/** Someone on the café's side, by look, or a guest by cast appearance (CUSTOMER_CAST). */
export type PortraitSubject = { look: Look } | { guest: number };
/** Paints the subject's front pose, the whole figure on a canvas of its own; undefined if it has none. */
export type PortraitArt = (subject: PortraitSubject) => Promise<HTMLCanvasElement> | undefined;

/** How many finished portraits are kept as picture addresses. */
const KEPT = 240;
let source: PortraitArt | null = null;
let urls = new Map<string, string>();

export function setPortraitArt(art: PortraitArt | null): void {
  source = art;
  urls = new Map();
}

export function portraitKey(subject: PortraitSubject): string {
  if ('guest' in subject) return `guest:${subject.guest}`;
  const { skin, hair, hairStyle, shirt, pants } = subject.look;
  return `look:${hairStyle}.${skin}.${hair}.${shirt}.${pants}`;
}

function remember(key: string, url: string): void {
  urls.delete(key);
  urls.set(key, url);
  for (const old of urls.keys()) {
    if (urls.size <= KEPT) break;
    urls.delete(old);
  }
}

/** The painted figure, if a source has one. Rejects if it cannot be drawn. */
export function portraitArt(subject: PortraitSubject): Promise<HTMLCanvasElement> | undefined {
  const current = source, painted = current?.(subject);
  if (!painted) return undefined;
  const key = portraitKey(subject);
  return painted.then(canvas => {
    if (source === current && !urls.has(key)) remember(key, canvas.toDataURL('image/png'));
    return canvas;
  });
}

/** The painted portrait's address if it is already drawn, and otherwise starts drawing it for next time. */
export function portraitUrl(subject: PortraitSubject): string | undefined {
  const key = portraitKey(subject), url = urls.get(key);
  if (url) { remember(key, url); return url; }
  portraitArt(subject)?.catch(() => {});
  return undefined;
}

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

/**
 * Shows the subject in `image`: the painted portrait when a source has one (the image stays empty
 * for the moment it takes to draw), otherwise the picture `fallback` makes. A painted image is
 * marked `data-portrait="painted"` so the page can drop its pixel-art scaling.
 */
export function showPortrait(image: HTMLImageElement, subject: PortraitSubject, fallback: () => string): void {
  const ready = portraitUrl(subject);
  if (ready) { image.dataset.portrait = 'painted'; image.src = ready; return; }
  const painted = portraitArt(subject);
  if (!painted) { image.src = fallback(); return; }
  image.dataset.portrait = 'painted';
  image.src = BLANK;
  const key = portraitKey(subject);
  painted.then(canvas => { image.src = urls.get(key) ?? canvas.toDataURL('image/png'); })
    .catch(() => { delete image.dataset.portrait; image.src = fallback(); });
}
