// Portraits the page shows in the floors view (src/ui/portrait-art.ts): staff and the owner in
// their look, painted like the people in the building, and guests from their own painted sheets.
import type { PortraitArt } from '../../ui/portrait-art';
import { STAFF_FRAMES, staffLooks, type StaffLooks } from './floors-looks';
import '../../ui/floors-portraits.css';

interface SheetSize { frameWidth: number; frameHeight: number }
/** A guest's sheet by cast appearance, as the scene names it. */
export const castSheet = (appearance: number) => `cast-${String(appearance).padStart(2, '0')}`;

/** The front pose cut from a character strip (`base` is the build folder, sizes from its sheets.json). */
async function frontOf(base: string, key: string, size: SheetSize): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = `${base}${key}.webp`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size.frameWidth; canvas.height = size.frameHeight;
  canvas.getContext('2d')!.drawImage(image, -STAFF_FRAMES.front * size.frameWidth, 0);
  return canvas;
}

/**
 * `base` is the floors build folder. Staff come from the staff looks; a guest from `cast-NN.webp`
 * if sheets.json lists it. Anyone else has no painted portrait and keeps the caller's sprite.
 */
export function floorsPortraitArt(base: string, looks: StaffLooks = staffLooks()): PortraitArt {
  let sizes: Promise<Record<string, SheetSize>> | null = null;
  const guests = new Map<number, Promise<HTMLCanvasElement>>();
  const sheets = () => sizes ??= fetch(`${base}sheets.json`).then(response => {
    if (!response.ok) throw new Error('Could not load the floors sheet index');
    return response.json() as Promise<Record<string, SheetSize>>;
  }).catch(error => { sizes = null; throw error; });
  return subject => {
    if ('look' in subject) return looks.front(subject.look);
    const id = subject.guest;
    if (!Number.isInteger(id) || id < 0) return undefined;
    let painted = guests.get(id);
    if (!painted) {
      painted = sheets().then(index => {
        const key = castSheet(id), size = index[key];
        if (!size) throw new Error(`No floors sheet for guest ${id}`);
        return frontOf(base, key, size);
      });
      painted.catch(() => { if (guests.get(id) === painted) guests.delete(id); });
      guests.set(id, painted);
    }
    return painted;
  };
}
