import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { installOfflineCanvas } from '../../scripts/cast-offline-canvas.mjs';
import { batchCharactersReady, clearBatchCharacters, makeBatchCharacter, preloadBatchCharacters, validateCastManifest } from './cozy-cast-art';
import { fineSpriteArt } from './fine-sprite-art';
import { worldSpriteArt } from './world-art-grid';
import { seatingGeometry } from './cozy-seating-art';
import { CUSTOMER_CAST } from '../game/customer-cast';

const manifest = () => JSON.parse(fs.readFileSync('public/art/generated/cozy-cast-v5/manifest.json', 'utf8'));
const originals = new Map(['document', 'Image', 'HTMLImageElement', 'HTMLCanvasElement', 'ImageData'].map(name => [name, globalThis[name]]));
beforeAll(async () => {
  installOfflineCanvas();
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync('public/' + url.replace(/^\//, ''), 'utf8')) }));
  await preloadBatchCharacters();
});
afterAll(() => { clearBatchCharacters(); vi.unstubAllGlobals(); for (const [name, value] of originals) globalThis[name] = value; });

describe('native density-2 guest family', () => {
  it('rejects partial and legacy manifests and preserves every outfit and hairstyle', () => {
    const pack = manifest(); expect(() => validateCastManifest(pack)).not.toThrow();
    expect(Object.keys(pack.families)).toHaveLength(12);
    for (const design of CUSTOMER_CAST) expect(pack.families[design.outfit]).toBeDefined();
    for (let style = 0; style < 8; style++) {
      expect(pack.heads.poses[style * 3].eyes).toHaveLength(2);
      expect(pack.heads.poses[style * 3 + 1].eyes).toHaveLength(0);
      expect(pack.heads.poses[style * 3 + 2].eyes).toHaveLength(1);
    }
    const partial = manifest(); partial.families.cardigan.poses.pop(); expect(() => validateCastManifest(partial)).toThrow();
    const legacy = manifest(); legacy.density = 3; expect(() => validateCastManifest(legacy)).toThrow();
  });
  it('publishes all 30 identities including guest 1 at native room size with no world resampling', () => {
    expect(batchCharactersReady()).toBe(true);
    for (const design of CUSTOMER_CAST) {
      const contacts = new Map(), frames = makeBatchCharacter(design.look, 'customer', design.id, (frame, points) => contacts.set(frame, points));
      expect(frames).not.toBeNull();
      const all = [...frames.down, ...frames.up, ...frames.left, ...frames.right, frames.sitRight, frames.sitLeft, ...frames.sitPetRight, ...frames.sitPetLeft];
      expect(all).toHaveLength(18);
      for (const frame of all) {
        const backing = fineSpriteArt(frame);
        expect(backing.density).toBe(2); expect(backing.canvas).toBe(worldSpriteArt(frame).canvas);
        expect([backing.canvas.width, backing.canvas.height]).toEqual([frame.width * 2, frame.height * 2]);
        expect(contacts.get(frame).legExtension).toBe(0);
        const pixels = backing.canvas.getContext('2d').getImageData(0, 0, backing.canvas.width, backing.canvas.height).data;
        expect(pixels.some((value, index) => index % 4 === 3 && value !== 0 && value !== 255)).toBe(false);
      }
      const standing = contacts.get(frames.stand);
      expect(standing.foot).toEqual({ x: 16, y: 42 });
      expect(standing.foot.y - standing.head.y).toBeGreaterThanOrEqual(37);
      expect(standing.foot.y - standing.head.y).toBeLessThanOrEqual(40);
      expect(standing.headHeight).toBeGreaterThanOrEqual(16);
      expect(contacts.get(frames.sitRight).seatContact).toEqual({ x: 13, y: 32 });
      expect(contacts.get(frames.sitLeft).seatContact).toEqual({ x: 19, y: 32 });
      for (let index = 0; index < 2; index++) {
        const right = contacts.get(frames.sitPetRight[index]), left = contacts.get(frames.sitPetLeft[index]);
        expect(left.petContact.x).toBe(32 - right.petContact.x); expect(left.petContact.y).toBe(right.petContact.y);
      }
      expect(seatingGeometry(frames.sitRight).foreground).toBeDefined();
      expect(seatingGeometry(frames.sitRight).embeddedChair).toBe(false);
    }
  });
  it('keeps runtime recolours on the master palette and glasses hollow around highlighted eyes', () => {
    const colors = new Set(JSON.parse(fs.readFileSync('docs/art-grid/palette.json', 'utf8')).colors.map(color => color.hex));
    const pack = manifest();
    for (const design of CUSTOMER_CAST) {
      const frames = makeBatchCharacter(design.look, 'customer', design.id, () => {}), backing = fineSpriteArt(frames.stand).canvas;
      const pixels = backing.getContext('2d').getImageData(0, 0, backing.width, backing.height).data;
      for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset + 3]) {
        const color = '#' + Array.from(pixels.subarray(offset, offset + 3)).map(channel => channel.toString(16).padStart(2, '0')).join('');
        expect(colors.has(color), color).toBe(true);
        expect(pixels[offset + 3]).toBe(255);
      }
      if (design.accessory !== 'glasses') continue;
      const head = pack.heads.poses[design.hairstyle * 3], body = pack.families[design.outfit].poses[0];
      for (const eye of head.eyes) {
        const column = body.neck[0] - head.neck[0] + eye[0], row = body.neck[1] - head.neck[1] + eye[1];
        expect(Array.from(pixels.subarray((row * backing.width + column) * 4, (row * backing.width + column) * 4 + 3))).toEqual([251, 242, 217]);
      }
    }
  });
});
