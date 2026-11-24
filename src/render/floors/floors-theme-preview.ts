// A starter theme as the building will wear it: the ground floor's decor layers (build/decor), stacked
// as the scene stacks them and cropped to the room. Drawn once its pictures are in; blank paper until then.
import { STARTER_THEMES, applyTheme } from '../../game/decor';
import { createInitialState } from '../../game/state';
import { BACK_LAYERS, FRONT_LAYERS, type DecorManifest } from './floors-decor-layers';

/** The part of the ground floor's picture a preview shows, and its size. */
const CROP = { x: 262, y: 86, w: 1152, h: 792 } as const;
const SIZE = { w: 640, h: 440 } as const;
/** The window that replaced the side door (build/frame/side-window.webp), over the wall and floor. */
const SIDE_WINDOW = { file: 'frame/side-window.webp', y: 16 } as const;

/** The pictures a theme's preview is made of, back to front, with how far down each is drawn. */
export function themeLayers(themeId: string, decor: DecorManifest | null): { file: string; y: number }[] {
  const floor = decor?.['1f'];
  if (!floor || !STARTER_THEMES.some(theme => theme.id === themeId)) return [];
  const state = createInitialState(0);
  applyTheme(state, themeId);
  const equipped = state.decor.equipped as Record<string, string>;
  const pick = (name: string, fixed: string[]) => fixed.find(path => path.endsWith(`/${name}.webp`)) ?? floor.slots[name]?.[equipped[name]];
  return [...BACK_LAYERS.flatMap(name => {
    const file = pick(name, floor.back);
    return [...(file ? [{ file, y: 0 }] : []), ...(name === 'fixtures' ? [SIDE_WINDOW] : [])];
  }), ...FRONT_LAYERS.flatMap(name => {
    const file = pick(name, floor.front);
    return file ? [{ file, y: 0 }] : [];
  })];
}

/** Draws previews from the art under `base`; pictures are loaded once and shared by the themes. */
export function floorsThemePreview(base: string, decor: DecorManifest | null): ((themeId: string) => HTMLCanvasElement) | null {
  if (!STARTER_THEMES.every(theme => themeLayers(theme.id, decor).length)) return null;
  const images = new Map<string, Promise<HTMLImageElement>>();
  const load = (file: string) => {
    let image = images.get(file);
    if (!image) images.set(file, image = new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Could not load ${file}`));
      element.src = base + file;
    }));
    return image;
  };
  return themeId => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE.w;
    canvas.height = SIZE.h;
    canvas.className = 'theme-preview';
    canvas.dataset.painted = themeId;
    canvas.setAttribute('aria-hidden', 'true');
    const layers = themeLayers(themeId, decor);
    void Promise.all(layers.map(layer => load(layer.file))).then(loaded => {
      const c = canvas.getContext('2d');
      if (!c) return;
      c.imageSmoothingQuality = 'high';
      const scale = SIZE.w / CROP.w;
      loaded.forEach((image, i) => c.drawImage(image, -CROP.x * scale, (layers[i].y - CROP.y) * scale, image.naturalWidth * scale, image.naturalHeight * scale));
    }).catch(() => undefined);
    return canvas;
  };
}
