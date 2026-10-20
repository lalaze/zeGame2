import { describe, expect, it } from 'vitest';
import { isCloudLike, isSkyBlue, nightSkyMask, paintNightSky } from './night-backdrop';

/** A strip of pixels, left to right. */
const strip = (...colors: [number, number, number][]) => new Uint8ClampedArray(colors.flatMap(c => [...c, 255]));

describe('night backdrop', () => {
  it('finds painted sky but leaves violets, foliage and wood alone', () => {
    expect(isSkyBlue(120, 190, 240)).toBe(true);
    expect(isSkyBlue(150, 100, 200)).toBe(false); // violet petals
    expect(isSkyBlue(110, 170, 80)).toBe(false); // leaves
    expect(isSkyBlue(150, 100, 60)).toBe(false); // timber
    expect(isCloudLike(250, 252, 255)).toBe(true);
    expect(isCloudLike(252, 251, 235)).toBe(true); // warm white cloud highlight
    expect(isCloudLike(245, 244, 235)).toBe(true); // warm cloud shade
    expect(isCloudLike(250, 220, 150)).toBe(false); // golden lamplight
  });

  it('only counts clouds that join the sky, so stray white flowers stay painted', () => {
    const sky: [number, number, number] = [120, 190, 240], cloud: [number, number, number] = [252, 251, 235], leaf: [number, number, number] = [60, 110, 50];
    const mask = nightSkyMask(strip(sky, cloud, cloud, leaf, cloud), 5, 1);
    expect([...mask]).toEqual([1, 2, 2, 0, 0]);
  });

  it('paints masked sky as dark, cool night and clears everything else', () => {
    const data = strip([120, 190, 240], [240, 246, 255], [60, 110, 50]);
    paintNightSky(data, 3, 1, Uint8Array.from([1, 2, 0]));
    const [sky, cloud, leaf] = [0, 1, 2].map(i => [...data.slice(i * 4, i * 4 + 4)]);
    expect(sky[2]).toBeGreaterThan(sky[0]);
    expect(sky[0] + sky[1] + sky[2]).toBeLessThan(200);
    expect(cloud[0] + cloud[1] + cloud[2]).toBeLessThan(300);
    expect(sky[3]).toBe(255);
    expect(leaf[3]).toBe(0);
  });
});
