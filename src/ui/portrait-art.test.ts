// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Look } from '../game/state';
import { portraitArt, portraitKey, portraitUrl, setPortraitArt, showPortrait, type PortraitArt } from './portrait-art';

const look: Look = { skin: 1, hair: 2, hairStyle: 3, shirt: 4, pants: 0 };
const figure = (url: string) => ({ toDataURL: () => url }) as unknown as HTMLCanvasElement;
const settled = () => new Promise(resolve => setTimeout(resolve, 0));

afterEach(() => setPortraitArt(null));

describe('portrait art', () => {
  it('shows the caller\'s own picture when nothing supplies portraits', () => {
    const image = document.createElement('img');
    showPortrait(image, { look }, () => 'data:sprite');
    expect(image.getAttribute('src')).toBe('data:sprite');
    expect(image.dataset.portrait).toBeUndefined();
    expect(portraitArt({ look })).toBeUndefined();
    expect(portraitUrl({ guest: 3 })).toBeUndefined();
  });

  it('shows the caller\'s own picture for someone the source has no portrait of', () => {
    setPortraitArt(subject => ('guest' in subject ? undefined : Promise.resolve(figure('data:painted'))));
    const image = document.createElement('img');
    showPortrait(image, { guest: 99 }, () => 'data:sprite');
    expect(image.getAttribute('src')).toBe('data:sprite');
    expect(image.dataset.portrait).toBeUndefined();
  });

  it('shows the painted portrait once it is drawn, without the sprite in between', async () => {
    const fallback = vi.fn(() => 'data:sprite');
    setPortraitArt(() => Promise.resolve(figure('data:painted')));
    const image = document.createElement('img');
    showPortrait(image, { look }, fallback);
    expect(image.getAttribute('src')).toMatch(/^data:image\/gif/);
    await settled();
    expect(image.getAttribute('src')).toBe('data:painted');
    expect(image.dataset.portrait).toBe('painted');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('has a drawn portrait ready at once the next time', async () => {
    const source = vi.fn<PortraitArt>(() => Promise.resolve(figure('data:painted')));
    setPortraitArt(source);
    expect(portraitUrl({ look })).toBeUndefined();
    await settled();
    expect(portraitUrl({ look })).toBe('data:painted');
    const image = document.createElement('img');
    showPortrait(image, { look: { ...look } }, () => 'data:sprite');
    expect(image.getAttribute('src')).toBe('data:painted');
    expect(image.dataset.portrait).toBe('painted');
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('falls back to the caller\'s picture when the portrait cannot be drawn', async () => {
    setPortraitArt(() => Promise.reject(new Error('no art')));
    const image = document.createElement('img');
    showPortrait(image, { guest: 4 }, () => 'data:sprite');
    await settled();
    expect(image.getAttribute('src')).toBe('data:sprite');
    expect(image.dataset.portrait).toBeUndefined();
    expect(portraitUrl({ guest: 4 })).toBeUndefined();
    await settled();
  });

  it('forgets drawn portraits when the source changes', async () => {
    setPortraitArt(() => Promise.resolve(figure('data:first')));
    await portraitArt({ guest: 1 });
    expect(portraitUrl({ guest: 1 })).toBe('data:first');
    setPortraitArt(null);
    expect(portraitUrl({ guest: 1 })).toBeUndefined();
  });

  it('tells subjects apart', () => {
    expect(portraitKey({ guest: 7 })).toBe('guest:7');
    expect(portraitKey({ look })).not.toBe(portraitKey({ look: { ...look, pants: 1 } }));
    expect(portraitKey({ look })).toBe(portraitKey({ look: { ...look } }));
  });
});

describe('floors portraits', () => {
  it('only restyles the floors view', () => {
    const rules = readFileSync('src/ui/floors-portraits.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...rules.matchAll(/([^{}]+){[^{}]*}/g)].map(match => match[1].trim());
    expect(selectors.length).toBeGreaterThan(0);
    for (const list of selectors) for (const selector of list.split(',')) expect(selector.trim()).toMatch(/^:root body\.floors-view\b/);
  });
});
