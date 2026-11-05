import { describe, expect, it } from 'vitest';
import palette from '../../docs/art-grid/palette.json';
import { FEATURE, MATERIAL, hexRgb, paintTeamPose, segmentTeamPose, shadeRamp, voteTeamPose, type PoseSegmentation } from './team-pixel-art';

const colours = { skin: shadeRamp(hexRgb('#80533f')), hair: shadeRamp(hexRgb('#cc8c9f')),
  cloth: shadeRamp(hexRgb('#8ba477')), pants: shadeRamp(hexRgb('#53637b')) };
const solid = (size: number): PoseSegmentation => ({ width: size, height: size,
  material: new Uint8Array(size * size).fill(MATERIAL.cloth), tone: new Uint8Array(size * size).fill(1) });

describe('team art on the world pixel grid', () => {
  it('votes coverage with transparent padding and one-pixel ink contour', () => {
    const grid = voteTeamPose(solid(12), { x: 2, y: 2, scale: .5 }, 10, 10);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const expected = x < 2 || y < 2 || x >= 8 || y >= 8 ? MATERIAL.clear
        : x === 2 || y === 2 || x === 7 || y === 7 ? MATERIAL.ink : MATERIAL.cloth;
      expect(grid.material[y * 10 + x]).toBe(expected);
    }
  });
  it('preserves an eye across reduction without blending its colour into skin', () => {
    const source = solid(12); source.material.fill(MATERIAL.skin);
    for (let y = 4; y < 6; y++) for (let x = 4; x < 6; x++) {
      source.material[y * 12 + x] = MATERIAL.feature; source.tone[y * 12 + x] = FEATURE.eye;
    }
    const grid = voteTeamPose(source, { x: 0, y: 0, scale: .5 }, 6, 6);
    expect(grid.material[2 * 6 + 2]).toBe(MATERIAL.feature);
    expect([...paintTeamPose(grid, colours).slice((2 * 6 + 2) * 4, (2 * 6 + 2) * 4 + 4)]).toEqual([32, 17, 12, 255]);
  });
  it('recolours a cached grid without changing its silhouette or material labels', () => {
    const grid = voteTeamPose(solid(12), { x: 0, y: 0, scale: .5 }, 6, 6);
    const before = grid.material.slice(), first = paintTeamPose(grid, colours);
    const second = paintTeamPose(grid, { ...colours, cloth: shadeRamp(hexRgb('#cf929e')) });
    expect(grid.material).toEqual(before);
    expect(second).not.toEqual(first);
    expect(second.filter((_, n) => n % 4 === 3)).toEqual(first.filter((_, n) => n % 4 === 3));
  });
  it('keeps transparent source pixels clear regardless of their hidden RGB', () => {
    const data = new Uint8ClampedArray(10 * 10 * 4).fill(255);
    for (let n = 3; n < data.length; n += 4) data[n] = 0;
    const seg = segmentTeamPose({ width: 10, height: 10, data, anchors: {} }, { role: 'owner', sit: false, back: false });
    expect([...seg.material].every(m => m === MATERIAL.clear)).toBe(true);
  });
  it('treats a moustache or brow the face encloses as hair, and only near-black as an eye', () => {
    const width = 60, height = 100, data = new Uint8ClampedArray(width * height * 4);
    const fill = (x0: number, y0: number, x1: number, y1: number, [r, g, b]: number[]) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([r, g, b, 255], (y * width + x) * 4);
    };
    fill(12, 15, 48, 44, [245, 205, 170]); // face
    fill(20, 22, 26, 30, [20, 10, 8]); // eye
    fill(22, 36, 38, 40, [100, 58, 40]); // moustache
    const seg = segmentTeamPose({ width, height, data, anchors: {} }, { role: 'owner', sit: false, back: false });
    const at = (x: number, y: number) => seg.material[y * width + x];
    expect(at(30, 37)).toBe(MATERIAL.hair);
    expect(at(23, 26)).toBe(MATERIAL.feature);
    expect(seg.tone[26 * width + 23]).toBe(FEATURE.eye);
  });
  it('paints ramps and facial details using only master-palette colours and binary alpha', () => {
    const material: number[] = [MATERIAL.clear], tone = [0];
    for (const m of [MATERIAL.skin, MATERIAL.hair, MATERIAL.cloth, MATERIAL.pants])
      for (let t = 0; t < 5; t++) { material.push(m); tone.push(t); }
    for (const t of Object.values(FEATURE)) { material.push(MATERIAL.feature); tone.push(t); }
    const pixels = paintTeamPose({ width: material.length, height: 1, material: new Uint8Array(material), tone: new Uint8Array(tone) }, colours);
    const allowed = new Set(palette.colors.map(c => c.hex.toLowerCase()));
    for (let n = 0; n < pixels.length; n += 4) {
      expect([0, 255]).toContain(pixels[n + 3]);
      if (pixels[n + 3]) expect(allowed.has('#' + [...pixels.slice(n, n + 3)].map(v => v.toString(16).padStart(2, '0')).join(''))).toBe(true);
    }
  });
});
