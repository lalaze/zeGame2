import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { installOfflineCanvas } from '../../scripts/cast-offline-canvas.mjs';
import { decodePng } from '../../scripts/pixel-conform.mjs';
import { batchCharactersReady, clearBatchCharacters, makeBatchCharacter, preloadBatchCharacters, validateCastManifest } from './cozy-cast-art';
import { fineSpriteArt } from './fine-sprite-art';
import { worldSpriteArt } from './world-art-grid';
import { clearSeatingEnsemble, preloadSeatingEnsemble, seatingFurniture, seatingGeometry, SEATING_LAYOUT } from './cozy-seating-art';
import { CUSTOMER_CAST } from '../game/customer-cast';
import diningTable from './dining-table-manifest.json';
import { extensionTable } from './extension-table-art';
import { diningDecorationPreview } from './dining-decoration-art';
import { decorIcon } from './decor-art';
import { centerpieceSprite } from './table-centerpiece-art';

const base = 'public/art/generated/cozy-cast-v8/';
const manifest = () => JSON.parse(fs.readFileSync(base + 'manifest.json', 'utf8'));
const diningBase = 'public/art/generated/cozy-dining-v4/';
const diningManifest = () => JSON.parse(fs.readFileSync(diningBase + 'manifest.json', 'utf8'));
function palmEdge(frame, meta) {
  const data=pixels(frame);let right=0;
  for(let y=meta.neck[1]+3;y<meta.hip[1]-2;y++)for(let x=meta.neck[0];x<80;x++)if(data[(y*80+x)*4+3])right=Math.max(right,x);
  const x=right-2,rows=[];
  for(let y=meta.neck[1]+3;y<meta.hip[1]-2;y++)if(data[(y*80+x)*4+3])rows.push(y);
  return {x,y:Math.max(...rows)};
}
const originals = new Map(['document', 'Image', 'HTMLImageElement', 'HTMLCanvasElement', 'ImageData'].map(name => [name, globalThis[name]]));
beforeAll(async () => {
  installOfflineCanvas();
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync('public/' + url.replace(/^\//, ''), 'utf8')) }));
  await Promise.all([preloadBatchCharacters(), preloadSeatingEnsemble()]);
});
afterAll(() => { clearBatchCharacters(); vi.unstubAllGlobals(); for (const [name, value] of originals) globalThis[name] = value; });
const pixels = frame => fineSpriteArt(frame).canvas.getContext('2d').getImageData(0, 0, frame.width * 2, frame.height * 2).data;

describe('whole-figure density-2 guest family', () => {
  it('shows the actual dining combination in both mat and centerpiece catalog tiles', () => {
    expect(decorIcon('tablecloth_rose','tablecloth_blue','centerpiece_candle')).toBe(diningDecorationPreview('tablecloth_rose','centerpiece_candle'));
    expect(decorIcon('centerpiece_succulent','tablecloth_blue','centerpiece_candle')).toBe(diningDecorationPreview('tablecloth_blue','centerpiece_succulent'));
    expect(decorIcon('centerpiece_none','tablecloth_blue')).toBe(diningDecorationPreview('tablecloth_blue','centerpiece_none'));
    const source=seatingFurniture('table');
    expect(extensionTable(source,'reading','tablecloth_classic')).toBe(source);
    expect(extensionTable(source,'greenhouse','tablecloth_classic')).toBe(source);
  });
  it('anchors every ornament on the same tabletop with a compact native-grid footprint', () => {
    expect(centerpieceSprite('centerpiece_none')).toBeUndefined();
    for(const id of ['centerpiece_flowers','centerpiece_succulent','centerpiece_candle']){
      const f=centerpieceSprite(id),a=worldSpriteArt(f).canvas;
      expect([f.width,f.height,a.width,a.height]).toEqual([5,7,10,14]);
      const data=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
      expect(data.slice(13*10*4).some((v,i)=>i%4===3&&v>0)).toBe(true);
    }
  });
  it('keeps the round table crop proportional instead of flattening its top and pedestal', async () => {
    clearSeatingEnsemble();await preloadSeatingEnsemble();
    const context = document.createElement('canvas').getContext('2d');
    const draw = vi.spyOn(Object.getPrototypeOf(context), 'drawImage');
    try {
      const table = seatingFurniture('table');
      const crop = draw.mock.calls.find(args => args.length === 9 && args[1] === diningTable.bounds[0] && args[2] === diningTable.bounds[1]);
      expect(crop).toBeDefined();
      const [, , , width, height, x, y, paintedWidth, paintedHeight] = crop;
      expect(paintedWidth / width).toBeCloseTo(paintedHeight / height, 12);
      expect(x).toBeGreaterThanOrEqual(3); expect(y).toBeGreaterThanOrEqual(3);
      expect(x + paintedWidth).toBeLessThanOrEqual(table.width * 3 - 3);
      expect(y + paintedHeight).toBeCloseTo(table.height * 3 - 3, 10);
    } finally { draw.mockRestore(); }
  });
  it('places the painted palm edge on the visible tabletop and preserves it in the foreground', () => {
    const [l,t,r,b]=diningTable.bounds;
    const scale=Math.min((SEATING_LAYOUT.tableWidth-2)/(r-l),(SEATING_LAYOUT.tableHeight-2)/(b-t));
    const {center,radius}=diningTable.topPlane;
    const cx=(center[0]-(l+r)/2)*scale,cy=SEATING_LAYOUT.tableFloorY+(center[1]-b)*scale;
    for(const design of CUSTOMER_CAST){
      const meta=diningManifest().characters[design.id].frames[0];
      const frames=makeBatchCharacter(design.look,'customer',design.id,()=>{}),sample=palmEdge(frames.sitRight,meta);
      for(const [side,frame]of [frames.sitRight,frames.sitLeft].entries()){
        const geometry=seatingGeometry(frame),x=side?79-sample.x:sample.x;
        const px=(side?SEATING_LAYOUT.seatX:-SEATING_LAYOUT.seatX)+(x+.5)/2-geometry.floor.x;
        const py=SEATING_LAYOUT.floorY+(sample.y+.5)/2-geometry.floor.y;
        expect(((px-cx)/(radius[0]*scale))**2+((py-cy)/(radius[1]*scale))**2,design.id+'/'+side+': painted palm on top').toBeLessThan(1);
        const n=(sample.y*80+x)*4;
        expect(Array.from(pixels(geometry.foreground).subarray(n,n+4))).toEqual(Array.from(pixels(frame).subarray(n,n+4)));
        expect(pixels(frame)[n+3]).toBe(255);
      }
    }
  });
  it('uses 108 complete person-and-chair paintings with one ground baseline', () => {
    const pack=diningManifest();expect(pack.characters.map(c=>c.id)).toEqual(CUSTOMER_CAST.map(c=>c.id));
    expect(pack.embeddedChair).toBe(true);
    for(const design of CUSTOMER_CAST){
      const frames=makeBatchCharacter(design.look,'customer',design.id,()=>{});
      for(const frame of [frames.sitRight,frames.sitLeft,...frames.sitPetRight,...frames.sitPetLeft]){
        const geometry=seatingGeometry(frame);expect(geometry.embeddedChair).toBe(true);
        expect(geometry.floor.y).toBe(42);
        const data=pixels(frame);let floor=0;
        for(let n=3;n<data.length;n+=4)if(data[n])floor=Math.max(floor,Math.floor(n/4/80));
        expect(floor).toBe(83);
      }
      expect(pack.characters[design.id].frames).toHaveLength(3);
    }
  });
  it('anchors each petting contact on an opaque painted hand pixel', () => {
    for(const design of CUSTOMER_CAST){
      const contacts=new Map(),frames=makeBatchCharacter(design.look,'customer',design.id,(f,p)=>contacts.set(f,p));
      for(const frame of [...frames.sitPetRight,...frames.sitPetLeft]){
        const p=contacts.get(frame).petContact;
        const x=p.x*2+(frame===frames.sitPetLeft[0]||frame===frames.sitPetLeft[1]?-1:0),y=p.y*2;
        expect(pixels(frame)[(y*80+x)*4+3],`guest ${design.id}: painted petting hand`).toBe(255);
      }
    }
  });
  it('recolours the new linen inset while keeping the wooden support intact', () => {
    const table=seatingFurniture('table'),variant=extensionTable(table,'main','tablecloth_mint');
    const read=f=>{const a=worldSpriteArt(f).canvas;return a.getContext('2d').getImageData(0,0,a.width,a.height).data;};
    const before=read(table),after=read(variant);let changed=0;
    for(let n=0;n<before.length;n+=4){
      expect(after[n+3]).toBe(before[n+3]);
      if(n/4>=table.width*2*table.height)expect(Array.from(after.subarray(n,n+4))).toEqual(Array.from(before.subarray(n,n+4)));
      if(before[n]!==after[n]||before[n+1]!==after[n+1]||before[n+2]!==after[n+2])changed++;
    }
    expect(changed).toBeGreaterThan(30);
  });
  it('requires all 36 identities and 12 complete poses per identity', () => {
    const pack = manifest(); expect(() => validateCastManifest(pack)).not.toThrow();
    expect(pack.characters.map(c => c.id)).toEqual(CUSTOMER_CAST.map(c => c.id));
    const partial = manifest(); partial.characters[0].frames.pop(); expect(() => validateCastManifest(partial)).toThrow();
    const duplicate = manifest(); duplicate.characters[1].id = 0; expect(() => validateCastManifest(duplicate)).toThrow();
    const invalid = manifest(); invalid.characters[0].frames[0].hand[1] = NaN; expect(() => validateCastManifest(invalid)).toThrow();
    const legacy = manifest(); legacy.version = 6; expect(() => validateCastManifest(legacy)).toThrow();
  });
  it('preserves the authored complete figure without relocating or stretching its head', () => {
    for (const design of CUSTOMER_CAST) {
      const sheet = manifest().characters[design.id], walking = decodePng(base + sheet.file);
      const dining = decodePng(diningBase + diningManifest().characters[design.id].file);
      const frames = makeBatchCharacter(design.look, 'customer', design.id, () => {});
      const ordered = [...frames.down, ...frames.up, ...frames.right, frames.sitRight, ...frames.sitPetRight];
      for (const [index, frame] of ordered.entries()) {
        const source=index<9?walking:dining,sourceIndex=index<9?index:index-9;
        const original = new Uint8ClampedArray(80 * 88 * 4);
        for (let y = 0; y < 88; y++) original.set(source.pixels.subarray((y * source.width + sourceIndex * 80) * 4, (y * source.width + (sourceIndex + 1) * 80) * 4), y * 80 * 4);
        expect(Buffer.from(pixels(frame)).equals(Buffer.from(original)), `${design.id}/${index}: intact painting`).toBe(true);
      }
    }
  });
  it('has a broad connected collar instead of the blond profile’s exposed narrow neck', () => {
    const design = CUSTOMER_CAST[27], sheet = manifest().characters[27];
    const frames = makeBatchCharacter(design.look, 'customer', design.id, () => {});
    for (const [index, frame] of [...frames.right, frames.sitRight, ...frames.sitPetRight].entries()) {
      const meta = index<3?sheet.frames[index+6]:diningManifest().characters[27].frames[index-3], image = pixels(frame);
      for (let y = meta.neck[1] - 4; y <= meta.neck[1] + 7; y++) {
        let opaque = 0;
        for (let x = 0; x < 80; x++) if (image[(y * 80 + x) * 4 + 3]) opaque++;
        expect(opaque, `pose ${index + 6}, collar row ${y}`).toBeGreaterThanOrEqual(12);
      }
    }
  });
  it('keeps all 648 rendered poses on the native palette, with mirrored pixels and chair contacts', () => {
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
      expect(geometry.embeddedChair).toBe(true);
      const foreground = pixels(geometry.foreground), body = pixels(frames.sitRight);
      let foregroundMatches = true;
      for (let n = 0; n < foreground.length; n += 4) if (foreground[n + 3]) for (let k = 0; k < 4; k++) if (foreground[n + k] !== body[n + k]) foregroundMatches = false;
      expect(foregroundMatches).toBe(true);
    }
  });
});
