import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { installOfflineCanvas } from '../../scripts/cast-offline-canvas.mjs';
import { decodePng } from '../../scripts/pixel-conform.mjs';
import { batchCharactersReady, clearBatchCharacters, makeBatchCharacter, preloadBatchCharacters, validateCastManifest } from './cozy-cast-art';
import { fineSpriteArt } from './fine-sprite-art';
import { worldSpriteArt } from './world-art-grid';
import { preloadSeatingEnsemble, seatingFurniture, seatingGeometry, SEATING_LAYOUT } from './cozy-seating-art';
import { CUSTOMER_CAST } from '../game/customer-cast';

const base = 'public/art/generated/cozy-cast-v6/';
const manifest = () => JSON.parse(fs.readFileSync(base + 'manifest.json', 'utf8'));
const originals = new Map(['document', 'Image', 'HTMLImageElement', 'HTMLCanvasElement', 'ImageData'].map(name => [name, globalThis[name]]));
beforeAll(async () => {
  installOfflineCanvas();
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync('public/' + url.replace(/^\//, ''), 'utf8')) }));
  await Promise.all([preloadBatchCharacters(), preloadSeatingEnsemble()]);
});
afterAll(() => { clearBatchCharacters(); vi.unstubAllGlobals(); for (const [name, value] of originals) globalThis[name] = value; });
const pixels = frame => fineSpriteArt(frame).canvas.getContext('2d').getImageData(0, 0, frame.width * 2, frame.height * 2).data;

describe('whole-figure density-2 guest family', () => {
  it('keeps the full lowered edge of palms above the painted table in both seated directions', () => {
    // Samples are on the authored palms, below the old guessed wrist crop.
    const samples = [{ id: 0, x: 65, y: 57 }, { id: 7, x: 65, y: 56 }, { id: 19, x: 65, y: 60 }, { id: 27, x: 64, y: 57 }];
    const table = seatingFurniture('table'), tableArt = worldSpriteArt(table).canvas;
    for (const sample of samples) {
      const design = CUSTOMER_CAST[sample.id], frames = makeBatchCharacter(design.look, 'customer', design.id, () => {});
      for (const [index, frame] of [frames.sitRight, frames.sitLeft].entries()) {
        const body = fineSpriteArt(frame).canvas, geometry = seatingGeometry(frame);
        const x = index ? 79 - sample.x : sample.x;
        const expected = Array.from(body.getContext('2d').getImageData(x, sample.y, 1, 1).data);
        expect(expected[3]).toBe(255);
        const board = document.createElement('canvas'); board.width = 160; board.height = 120;
        const ctx = board.getContext('2d'), left = (index ? 130 : 30) - geometry.floor.x * 2, top = 94 - geometry.floor.y * 2;
        const probe = () => Array.from(ctx.getImageData(left + x, top + sample.y, 1, 1).data);
        ctx.drawImage(body, left, top);
        ctx.drawImage(tableArt, 80 - table.width, 94 - table.height * 2);
        expect(probe(), `guest ${design.id}: table actually covers this palm`).not.toEqual(expected);
        ctx.drawImage(fineSpriteArt(geometry.foreground).canvas, left, top);
        expect(probe(), `guest ${design.id}, mirrored ${index}: complete palm restored`).toEqual(expected);
        // The knees and shins still stay behind the tablecloth.
        const foreground = pixels(geometry.foreground);
        expect(foreground.some((value, offset) => offset % 4 === 3 && Math.floor(offset / 4 / 80) > 64 && value > 0)).toBe(false);
      }
    }
  });
  it('fits seated shoulders and hands to the real table without enlarging the head', () => {
    for (const design of CUSTOMER_CAST) {
      const sheet = manifest().characters[design.id];
      expect(sheet.seatedScale, `guest ${design.id}: same whole-figure scale`).toBeCloseTo(sheet.scale, 8);
      const contacts = new Map();
      const frames = makeBatchCharacter(design.look, 'customer', design.id, (frame, points) => contacts.set(frame, points));
      for (const frame of [frames.sitRight, frames.sitLeft]) {
        const contact = contacts.get(frame);
        const originY = SEATING_LAYOUT.floorY - contact.foot.y;
        const handY = originY + contact.carryContact.y;
        const shoulderY = originY + contact.head.y + contact.headHeight;
        expect(shoulderY, `guest ${design.id}: shoulders above the tabletop`).toBeLessThan(SEATING_LAYOUT.surfaceY);
        expect(Math.abs(handY - SEATING_LAYOUT.surfaceY), `guest ${design.id}: palm on the tabletop`).toBeLessThanOrEqual(3);
      }
    }
  });
  it('requires all 30 identities and 12 complete poses per identity', () => {
    const pack = manifest(); expect(() => validateCastManifest(pack)).not.toThrow();
    expect(pack.characters.map(c => c.id)).toEqual(CUSTOMER_CAST.map(c => c.id));
    const partial = manifest(); partial.characters[0].frames.pop(); expect(() => validateCastManifest(partial)).toThrow();
    const duplicate = manifest(); duplicate.characters[1].id = 0; expect(() => validateCastManifest(duplicate)).toThrow();
    const invalid = manifest(); invalid.characters[0].frames[0].hand[1] = NaN; expect(() => validateCastManifest(invalid)).toThrow();
    const legacy = manifest(); legacy.version = 5; expect(() => validateCastManifest(legacy)).toThrow();
  });
  it('preserves the authored complete figure without relocating or stretching its head', () => {
    for (const design of CUSTOMER_CAST) {
      const sheet = manifest().characters[design.id], source = decodePng(base + sheet.file);
      const frames = makeBatchCharacter(design.look, 'customer', design.id, () => {});
      const ordered = [...frames.down, ...frames.up, ...frames.right, frames.sitRight, ...frames.sitPetRight];
      for (const [index, frame] of ordered.entries()) {
        const original = new Uint8ClampedArray(80 * 88 * 4);
        for (let y = 0; y < 88; y++) original.set(source.pixels.subarray((y * source.width + index * 80) * 4, (y * source.width + (index + 1) * 80) * 4), y * 80 * 4);
        expect(Buffer.from(pixels(frame)).equals(Buffer.from(original)), `${design.id}/${index}: intact painting`).toBe(true);
      }
    }
  });
  it('has a broad connected collar instead of the blond profile’s exposed narrow neck', () => {
    const design = CUSTOMER_CAST[27], sheet = manifest().characters[27];
    const frames = makeBatchCharacter(design.look, 'customer', design.id, () => {});
    for (const [index, frame] of [...frames.right, frames.sitRight, ...frames.sitPetRight].entries()) {
      const meta = sheet.frames[index + 6], image = pixels(frame);
      for (let y = meta.neck[1] - 4; y <= meta.neck[1] + 7; y++) {
        let opaque = 0;
        for (let x = 0; x < 80; x++) if (image[(y * 80 + x) * 4 + 3]) opaque++;
        expect(opaque, `pose ${index + 6}, collar row ${y}`).toBeGreaterThanOrEqual(12);
      }
    }
  });
  it('keeps all 540 rendered poses on the native palette, with mirrored pixels and chair contacts', () => {
    expect(batchCharactersReady()).toBe(true);
    const allowed = new Set(JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.map(c => c.hex));
    for (const design of CUSTOMER_CAST) {
      const contacts = new Map(), frames = makeBatchCharacter(design.look, 'customer', design.id, (frame, points) => contacts.set(frame, points));
      const all = [...frames.down, ...frames.up, ...frames.right, ...frames.left, frames.sitRight, frames.sitLeft, ...frames.sitPetRight, ...frames.sitPetLeft];
      expect(all).toHaveLength(18);
      for (const frame of all) {
        const backing = fineSpriteArt(frame), data = pixels(frame);
        expect([frame.width, frame.height, backing.density]).toEqual([40, 44, 2]);
        expect(backing.canvas).toBe(worldSpriteArt(frame).canvas);
        expect(contacts.get(frame).legExtension).toBe(0);
        let ink = 0, partial = 0, offPalette = 0, edges = 0;
        for (let n = 0; n < data.length; n += 4) if (data[n + 3]) {
          ink++;
          if (data[n + 3] !== 255) partial++;
          if (!allowed.has('#' + Array.from(data.subarray(n, n + 3)).map(v => v.toString(16).padStart(2, '0')).join(''))) offPalette++;
          const x = n / 4 % 80, y = Math.floor(n / 4 / 80);
          if (x === 0 || x === 79 || y === 0 || y === 87) edges++;
        }
        expect(ink).toBeGreaterThan(800);
        expect({ partial, offPalette, edges }).toEqual({ partial: 0, offPalette: 0, edges: 0 });
      }
      expect(contacts.get(frames.stand).foot).toEqual({ x: 20, y: 42 });
      expect(contacts.get(frames.sitRight).seatContact).toEqual({ x: 18, y: 32 });
      expect(contacts.get(frames.sitLeft).seatContact).toEqual({ x: 22, y: 32 });
      const right = [...frames.right, frames.sitRight, ...frames.sitPetRight], left = [...frames.left, frames.sitLeft, ...frames.sitPetLeft];
      for (let i = 0; i < right.length; i++) {
        const a = pixels(right[i]), b = pixels(left[i]);
        let equal = true;
        for (let y = 0; y < 88; y++) for (let x = 0; x < 80; x++) for (let k = 0; k < 4; k++) if (a[(y * 80 + x) * 4 + k] !== b[(y * 80 + 79 - x) * 4 + k]) equal = false;
        expect(equal).toBe(true);
      }
      for (let i = 0; i < 2; i++) {
        const right = contacts.get(frames.sitPetRight[i]), left = contacts.get(frames.sitPetLeft[i]);
        expect(left.petContact.x).toBe(40 - right.petContact.x); expect(left.petContact.y).toBe(right.petContact.y);
      }
      const geometry = seatingGeometry(frames.sitRight);
      expect(geometry.embeddedChair).toBe(false);
      const foreground = pixels(geometry.foreground), body = pixels(frames.sitRight);
      let foregroundMatches = true;
      for (let n = 0; n < foreground.length; n += 4) if (foreground[n + 3]) for (let k = 0; k < 4; k++) if (foreground[n + k] !== body[n + k]) foregroundMatches = false;
      expect(foregroundMatches).toBe(true);
    }
  });
});
