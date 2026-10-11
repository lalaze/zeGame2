import { artArchive, type ArchiveFile } from './render/art-archive';
import { CUSTOMER_CAST } from './game/customer-cast';
import { CATS } from './game/pets';
import { INGREDIENTS, MENU, UPGRADES } from './game/data';
import { DECOR } from './game/decor';
import { FURNITURE } from './game/furniture';
import { installedEquipment } from './game/kitchen';
import { WINDOWS, sceneHeight, kitchenHeight, setKitchenLevel } from './game/layout';
import { createInitialState } from './game/state';
import { t, setLocale, type MessageKey } from './i18n';
import { decorIcon, paintCeiling } from './render/decor-art';
import { furnitureIcon } from './render/furniture-art';
import { paintKitchen } from './render/kitchen-art';
import { lightingAt } from './render/lighting';
import { roomDepth } from './render/materials';
import { paintRegion } from './render/region-art';
import { RoomPainter } from './render/room-art';
import { catFrames, character, ingredientIcon, itemArtwork, upgradeIcon, type Role } from './render/sprites';

setLocale('zh');
type Asset = { id: string; group: string; name: string; canvas: HTMLCanvasElement };
const assets: Asset[] = [];
const roomAssets: ArchiveFile[] = [];
const pngBytes = (canvas: HTMLCanvasElement) => Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), (c) => c.charCodeAt(0));
const add = (id: string, group: string, name: string, canvas: HTMLCanvasElement) => assets.push({ id, group, name, canvas });
for (const item of MENU) add(`food/${item.id}`, '餐点', t(`item.${item.id}` as MessageKey), itemArtwork(item.id));
for (const item of INGREDIENTS) add(`ingredient/${item.id}`, '食材', t(`ing.${item.id}` as MessageKey), ingredientIcon(item.id));
for (const item of UPGRADES) add(`upgrade/${item.id}`, '设备', t(`upgrade.${item.id}.name` as MessageKey), upgradeIcon(item.id));
for (const item of DECOR) add(`decor/${item.id}`, '装修', t(`decor.${item.id}` as MessageKey), decorIcon(item.id));
for (const item of FURNITURE) add(`furniture/${item.id}`, item.category === 'decoration' ? '装饰' : '家具', t(`decor.${item.id}` as MessageKey), furnitureIcon(item.id));
const roles: [Role, string][] = [['owner','店主'],['barista','咖啡师'],['server','服务员'],['cook','厨师'],['customer','顾客']];
roles.forEach(([role, name], i) => {
  const frames = character({ skin: i % 4, hair: i, hairStyle: i % 4, shirt: i, pants: i % 3 }, role);
  for (const direction of ['down', 'up', 'left', 'right'] as const) frames[direction].forEach((canvas, frame) => add(`character/${role}/${direction}-${frame}`, '人物', `${name} · ${direction} ${frame + 1}`, canvas));
  add(`character/${role}/sit-left`, '人物', `${name} · 坐姿左`, frames.sitLeft);
  add(`character/${role}/sit-right`, '人物', `${name} · 坐姿右`, frames.sitRight);
});
for (const design of CUSTOMER_CAST) {
  const frames = character(design.look, 'customer', design.id);
  for (const direction of ['down', 'up', 'left', 'right'] as const) frames[direction].forEach((canvas, frame) =>
    add(`customer/${design.id}/${direction}-${frame}`, '常客', `${design.name} · ${direction} ${frame + 1}`, canvas));
  add(`customer/${design.id}/sit-left`, '常客', `${design.name} · 坐姿左`, frames.sitLeft);
  add(`customer/${design.id}/sit-right`, '常客', `${design.name} · 坐姿右`, frames.sitRight);
}
for (const cat of CATS) Object.entries(catFrames(cat.id)).forEach(([frame, canvas]) => add(cat.id === 'ginger' ? `cat/${frame}` : `cat/${cat.id}/${frame}`, '人物', `${t(`pet.${cat.id}.name`)} · ${frame}`, canvas));

const sheet = document.createElement('canvas');
const cell = 128, columns = 10;
sheet.width = cell * columns; sheet.height = Math.ceil(assets.length / columns) * cell;
const ctx = sheet.getContext('2d')!; ctx.imageSmoothingEnabled = false;
const frames: Record<string, unknown> = {};
assets.forEach((asset, i) => {
  const scale = Math.max(1, Math.min(3, Math.floor((cell - 8) / Math.max(asset.canvas.width, asset.canvas.height))));
  const w = asset.canvas.width * scale, h = asset.canvas.height * scale;
  const x = i % columns * cell + Math.floor((cell - w) / 2), y = Math.floor(i / columns) * cell + Math.floor((cell - h) / 2);
  ctx.drawImage(asset.canvas, x, y, w, h);
  frames[asset.id] = { frame: { x, y, w, h }, sourceSize: { w: asset.canvas.width, h: asset.canvas.height }, scale };
});
const sheetLink = document.querySelector<HTMLAnchorElement>('#sheet')!;
sheetLink.href = sheet.toDataURL(); sheetLink.download = 'tiny-bean-art.png';
const manifest = document.querySelector<HTMLAnchorElement>('#manifest')!;
const manifestText = JSON.stringify({ image: 'tiny-bean-art.png', size: { w: sheet.width, h: sheet.height }, frames }, null, 2);
manifest.href = URL.createObjectURL(new Blob([manifestText], { type: 'application/json' }));
manifest.download = 'tiny-bean-art.json';

const gallery = document.querySelector('#gallery')!;
const count = document.querySelector('#count')!;
const buttons: HTMLButtonElement[] = [];
function render(group: string): void {
  const visible = group === '全部' ? assets : assets.filter((asset) => asset.group === group);
  gallery.replaceChildren(...visible.map((asset) => {
    const link = document.createElement('a'); link.className = 'asset'; link.download = asset.id.replaceAll('/', '-') + '.png'; link.href = asset.canvas.toDataURL();
    const art = document.createElement('div'); art.className = 'art';
    const img = document.createElement('img'); img.src = link.href; img.alt = asset.name;
    const scale = asset.group === '餐点' ? 2 : 3; img.width = asset.canvas.width * scale; img.height = asset.canvas.height * scale;
    art.append(img);
    const caption = document.createElement('div'); caption.className = 'caption';
    const name = document.createElement('b'); name.textContent = asset.name;
    const id = document.createElement('small'); id.textContent = `${asset.id} · ${asset.canvas.width} × ${asset.canvas.height}`;
    caption.append(name, id); link.append(art, caption); return link;
  }));
  count.textContent = `共 ${assets.length} 张素材 · 当前显示 ${visible.length} 张 · 55 道餐点`;
  buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.textContent === group)));
}
for (const group of ['全部', ...new Set(assets.map((asset) => asset.group))]) {
  const button = document.createElement('button'); button.textContent = group; button.onclick = () => render(group);
  buttons.push(button); document.querySelector('#filters')!.append(button);
}
render('全部');
document.querySelector<HTMLButtonElement>('#background')!.onclick = (event) => {
  const dark = document.body.classList.toggle('dark');
  (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(dark));
};

// Room backgrounds are separate from the transparent sprite atlas.
const state = createInitialState(0);
for (const item of MENU) state.items[item.id] = 1;
state.onMenu = MENU.slice(0, 8).map((item) => item.id);
state.kitchen = true;
setKitchenLevel(state.upgrades.cook);
const light = lightingAt(10);
for (const [id, name] of [['main', '主咖啡厅'], ['reading', '阅读室'], ['greenhouse', '玻璃花房'], ['terrace', '花园露台'], ['kitchen', '后厨']] as const) {
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = id === 'kitchen' ? kitchenHeight() : sceneHeight();
  const c = canvas.getContext('2d')!; c.imageSmoothingEnabled = false;
  if (id === 'main') {
    const p = new RoomPainter(c), decor = state.decor.equipped;
    p.drawWall(decor.wallpaper, 0);
    for (const win of WINDOWS) p.drawWindow(win, light, 0, null);
    p.drawMenuBoard(state); p.drawFloor(decor.floor, decor.rug, light, canvas.height);
    p.drawBackBar(state, decor.counter); p.drawServiceCupboards(decor.counter); p.drawCounter(state, decor.counter, 0, []);
    paintCeiling(c, decor.ceiling, 320, 0);
  } else if (id === 'kitchen') paintKitchen(c, canvas.height, 0, false, installedEquipment(state), new Set());
  else paintRegion(c, id, canvas.height, 0, light, false);
  roomDepth(c, 320, canvas.height, 80, id === 'terrace');
  roomAssets.push({ name: `room-${id}.png`, bytes: pngBytes(canvas) });
  const link = document.createElement('a'); link.href = canvas.toDataURL(); link.download = `room-${id}.png`;
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = name;
  figure.append(canvas, caption); link.append(figure); document.querySelector('#rooms')!.append(link);
}

// Generate from the very same current canvases as the gallery, never a stale
// bundled snapshot. Lazy creation avoids PNG serialization until requested.
const archive = document.querySelector<HTMLAnchorElement>('#archive')!;
archive.href = '#';
archive.download = 'tiny-bean-assets.zip';
let archiveUrl: string | undefined;
archive.addEventListener('click', () => {
  if (!archiveUrl) {
    const files: ArchiveFile[] = assets.map(asset => ({ name: `${asset.id}.png`, bytes: pngBytes(asset.canvas) }));
    files.push(...roomAssets, { name: 'tiny-bean-art.png', bytes: pngBytes(sheet) },
      { name: 'tiny-bean-art.json', bytes: new TextEncoder().encode(manifestText) });
    archiveUrl = URL.createObjectURL(new Blob([artArchive(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
  }
  archive.href = archiveUrl;
});
