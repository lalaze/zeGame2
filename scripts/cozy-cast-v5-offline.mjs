import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rolldown } from 'rolldown';
import { encodePng } from './pixel-conform.mjs';
import { installOfflineCanvas, RasterCanvas } from './cast-offline-canvas.mjs';

installOfflineCanvas();
const nativeFetch = globalThis.fetch;
globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync('public/' + url.replace(/^\//, ''), 'utf8')) });
const entry = 'offline-cast-v5';
const bundle = await rolldown({ input: entry, plugins: [{ name: entry, resolveId: id => id === entry ? id : null, load: id => id === entry ? ['src/render/reference-character-art.ts', 'src/render/fine-sprite-art.ts', 'src/render/world-art-grid.ts', 'src/render/cozy-seating-art.ts', 'src/game/customer-cast.ts'].map(file => `export * from ${JSON.stringify(path.resolve(file))};`).join('\n') : null }] });
const { output } = await bundle.generate({ format: 'esm' }); await bundle.close();
const code = output.find(item => item.type === 'chunk').code.replaceAll('import.meta.env.BASE_URL', '"/"');
const art = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
await art.preloadReferenceCharacters();
const board = new RasterCanvas(); board.width = 1800; board.height = 1500;
const ctx = board.getContext('2d'); ctx.fillStyle = '#efe3c8'; ctx.fillRect(0, 0, board.width, board.height);
const look = { skin: 0, hair: 0, hairStyle: 1, shirt: 2, pants: 1 };
const rows = [], labels = [];
const roster = ['owner', 'barista', 'server', 'cook'].map(role => ({ role, look })).concat(art.CUSTOMER_CAST.map(design => ({ role: 'customer', look: design.look, design })));
const palette = new Set(JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.map(color => color.hex));
let nativeFrames = 0, offPalettePixels = 0;
for (const [index, entry] of roster.entries()) {
  const frames = art.resolveReferenceCharacter(entry.look, entry.role, entry.design?.id);
  const left = 8 + index % 10 * 172, top = 8 + Math.floor(index / 10) * 370;
  for (const [frame, dx, dy, scale] of [[frames.stand, left, top + 24, 2], [frames.sitRight, left + 45, top + 185, 2]]) {
    const seating = art.seatingGeometry(frame);
    if (seating?.embeddedChair === false) { const chair = art.worldSpriteArt(art.seatingFurniture('chair')); ctx.drawImage(chair.canvas, dx, dy, chair.canvas.width * scale, chair.canvas.height * scale); }
    const image = art.worldSpriteArt(frame); ctx.drawImage(image.canvas, dx, dy, image.canvas.width * scale, image.canvas.height * scale);
  }
  labels.push({ x: left + 2, y: top + 3, text: entry.design ? `${entry.design.id} ${entry.design.outfit}${entry.design.accessory === 'none' ? '' : ' +' + entry.design.accessory}` : entry.role });
  const contacts = art.referenceCharacterContacts(frames.stand);
  rows.push({ role: entry.role, id: entry.design?.id, standingHeight: contacts.foot.y - contacts.head.y, headHeight: contacts.headHeight, contacts, seat: art.referenceCharacterContacts(frames.sitRight) });
  if (entry.role !== 'customer') continue;
  const all = [...frames.down, ...frames.up, ...frames.left, ...frames.right, frames.sitRight, frames.sitLeft, ...frames.sitPetRight, ...frames.sitPetLeft];
  for (const frame of all) {
    const fine = art.fineSpriteArt(frame);
    if (fine.density !== 2 || fine.canvas !== art.worldSpriteArt(frame).canvas) throw Error('Guest is not natively density 2');
    const contact = art.referenceCharacterContacts(frame);
    if (contact.head.y < 0 || contact.foot.y > frame.height || contact.carryContact.x < 0 || contact.carryContact.x > frame.width) throw Error('Contact outside frame');
    nativeFrames++;
    const pixels = fine.canvas.pixels;
    for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset + 3]) {
      const hex = '#' + Array.from(pixels.subarray(offset, offset + 3)).map(channel => channel.toString(16).padStart(2, '0')).join('');
      if (!palette.has(hex)) offPalettePixels++;
    }
  }
}
const directory = 'artifacts/art-grid/round-4'; fs.mkdirSync(directory, { recursive: true });
encodePng(directory + '/cast-after-offline.png', { width: board.width, height: board.height, pixels: board.pixels });
fs.writeFileSync(directory + '/offline-labels.json', JSON.stringify(labels));
fs.writeFileSync(directory + '/offline-metrics.json', JSON.stringify({ nativeFrames, offPalettePixels, rows }, null, 2) + '\n');
execFileSync('/usr/bin/python3', ['-c', `from PIL import Image, ImageDraw, ImageFont
import json
filename='${directory}/cast-after-offline.png'
image=Image.open(filename)
draw=ImageDraw.Draw(image)
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',12)
for label in json.load(open('${directory}/offline-labels.json')):
    draw.text((label['x'],label['y']),label['text'],fill='#4a3728',font=font)
image.save(filename)
`]);
const seats = new RasterCanvas(); seats.width = 1920; seats.height = 1440;
const seatCtx = seats.getContext('2d'); seatCtx.fillStyle = '#efe3c8'; seatCtx.fillRect(0, 0, seats.width, seats.height);
for (const design of art.CUSTOMER_CAST) {
  const frames = art.resolveReferenceCharacter(design.look, 'customer', design.id), left = design.id % 5 * 384, top = Math.floor(design.id / 5) * 240;
  const poses = [frames.sitRight, frames.sitLeft];
  const draw = (frame, x, y) => { const image = art.worldSpriteArt(frame); seatCtx.drawImage(image.canvas, left + x * 4, top + y * 4, image.canvas.width * 2, image.canvas.height * 2); };
  const offsets = poses.map((frame, index) => { const geometry = art.seatingGeometry(frame); return { x: 48 + (index ? 25 : -25) - geometry.floor.x, y: 51 - geometry.floor.y }; });
  poses.forEach((frame, index) => { if (art.seatingGeometry(frame).embeddedChair === false) draw(art.seatingFurniture('chair', index === 1), offsets[index].x + (index ? -2 : 0), offsets[index].y); draw(frame, offsets[index].x, offsets[index].y); });
  const table = art.seatingFurniture('table'); draw(table, 48 - table.width / 2, 51 - table.height);
  poses.forEach((frame, index) => draw(art.seatingGeometry(frame).foreground, offsets[index].x, offsets[index].y));
}
encodePng(directory + '/seating-after-offline.png', { width: seats.width, height: seats.height, pixels: seats.pixels });
globalThis.fetch = nativeFetch;
console.log(JSON.stringify({ characters: rows.length, nativeFrames, offPalettePixels }));
