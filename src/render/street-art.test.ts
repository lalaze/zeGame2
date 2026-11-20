// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { streetShopAsset, streetShopArt, styleStreetShop, streetSceneryArt } from './street-art';
import anchors from '../../public/art/street-art-v2/anchors.json';
import { imageSize } from '../../scripts/art-files.mjs';
describe('approved storefront geometry', () => {
  it('maps all six businesses and both vacant façades without legacy overlays', () => {
    const expected = { cafe:'cafe', reading:'bookshop', greenhouse:'plant-shop', terrace:'florist', workshop:'pottery', observatory:'tea-shop' } as const;
    for (const business of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(streetShopAsset('town', business)).toBe(expected[business]);
      expect(streetShopArt('city', business, 'open')).not.toMatch(/street-window|street-shutter|shop-city|\/tea\.png/);
    }
    expect(streetShopAsset('town', null, '01')).toBe('vacant-brick');
    expect(streetShopAsset('town', null, '02')).toBe('vacant-blue');
    expect(streetShopArt('town',null,'sale','02')).toContain(streetShopAsset('town',null,'02'));
    expect(streetShopArt('town',null,'vacant','02')).toContain(streetShopAsset('town',null,'02'));
  });
  it('preserves every raster aspect ratio and has an authored sign/door anchor', () => {
    for (const [key, a] of Object.entries(anchors)) {
      const [width, height]=imageSize(readFileSync(`${process.cwd()}/public/art/street-art-v2/${key}.webp`));
      expect(a.width).toBe(width*2); expect(a.height).toBe(height*2);
      expect(a.signY).toBeGreaterThan(0); expect(a.signY).toBeLessThan(a.height);
      expect(a.doorX).toBeGreaterThan(0); expect(a.doorX).toBeLessThan(a.width);
    }
    expect(anchors['plant-shop'].height).toBeLessThan(anchors.bookshop.height);
    const button=document.createElement('button');styleStreetShop(button,'town','greenhouse');
    expect(button.dataset.storefront).toBe('plant-shop');expect(button.style.getPropertyValue('--shop-height')).toBe('118px');
  });
  it('separates scenery from storefronts and preserves static pedestrians in reduced motion', () => {
    const html=streetSceneryArt();expect(html).not.toMatch(/street-tree-line|shop-|village\.png/);
    expect(html.match(/class="street-walker /g)).toHaveLength(6);
    const css=readFileSync(`${process.cwd()}/src/ui/streets.css`,'utf8');
    expect(css).toContain('.street-shop-open .street-shop-visitor { display: none; }');
    expect(css).toContain('street-art-v2/paving.webp');expect(css).toContain('street-art-v2/curb.webp');
  });
});
