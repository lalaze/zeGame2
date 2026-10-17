import { applyTheme } from '../game/decor';
import { createInitialState } from '../game/state';
import { WINDOWS } from '../game/layout';
import { RoomPainter, TABLE, CHAIR_LEFT, CHAIR_RIGHT } from './room-art';
import { lightingAt } from './lighting';
import { seatingFurniture } from './cozy-seating-art';
import { cozyCafeSprite } from './cozy-cafe-art';
import { extensionTable } from './extension-table-art';
import { worldSpriteArt } from './world-art-grid';
import { paintCenterpiece } from './table-centerpiece-art';

/** A miniature room built with the same surfaces, windows and furniture as play. */
export function starterThemePreview(themeId: string): HTMLCanvasElement {
  const state = createInitialState(0);
  applyTheme(state, themeId);
  const decor = state.decor.equipped;
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 440;
  canvas.className = 'theme-preview';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2); ctx.imageSmoothingEnabled = false;
  const painter = new RoomPainter(ctx, 2, false);
  painter.curtain = decor.curtain;
  painter.drawWall(decor.wallpaper, 0);
  for (const win of WINDOWS) painter.drawWindow(win, lightingAt(12), 0, null);
  painter.drawMenuBoard(state);
  painter.drawFloor(decor.floor, decor.rug, lightingAt(12), 240);
  painter.drawBackBar(state, decor.counter);
  painter.drawCounter(state, decor.counter, 0, []);
  const table = extensionTable(seatingFurniture('table') ?? cozyCafeSprite('table') ?? TABLE(), 'main', decor.tablecloth);
  const draw = (sprite: HTMLCanvasElement, x: number, foot: number) => {
    const art = worldSpriteArt(sprite);
    ctx.drawImage(art.canvas, x, foot - sprite.height, sprite.width, sprite.height);
  };
  for (const x of [69, 153, 237]) {
    draw(seatingFurniture('chair') ?? cozyCafeSprite('chair') ?? CHAIR_RIGHT(), x - 38, 201);
    draw(seatingFurniture('chair', true) ?? cozyCafeSprite('chair', true) ?? CHAIR_LEFT(), x + 6, 201);
    draw(table, x - table.width / 2, 200);
    ctx.save(); ctx.translate(x - 2.5, 170); ctx.scale(.5, .5);
    paintCenterpiece(ctx, decor.centerpiece); ctx.restore();
  }
  return canvas;
}
