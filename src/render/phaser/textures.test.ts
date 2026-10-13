import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { canvasKey } from './textures';

function manager() {
  const uploaded = new Set<string>();
  const addCanvas = vi.fn((key: string) => uploaded.add(key));
  const textures = { addCanvas, exists: (key: string) => uploaded.has(key) } as unknown as Phaser.Textures.TextureManager;
  return { textures, addCanvas, uploaded };
}

describe('art texture lifecycle', () => {
  it('uploads a cached sprite only once across repeated animation frames', () => {
    const m = manager(), canvas = {} as HTMLCanvasElement;
    const key = canvasKey(m.textures, canvas);
    for (let i = 0; i < 1000; i++) expect(canvasKey(m.textures, canvas)).toBe(key);
    expect(m.addCanvas).toHaveBeenCalledTimes(1);
  });
  it('registers shared sprite canvases separately in independent game instances', () => {
    const a = manager(), b = manager(), canvas = {} as HTMLCanvasElement;
    const ka = canvasKey(a.textures, canvas), kb = canvasKey(b.textures, canvas);
    expect(a.uploaded.has(ka)).toBe(true);
    expect(b.uploaded.has(kb)).toBe(true);
    expect(a.addCanvas).toHaveBeenCalledTimes(1);
    expect(b.addCanvas).toHaveBeenCalledTimes(1);
  });
  it('recovers a removed texture without retaining a stale key', () => {
    const m = manager(), canvas = {} as HTMLCanvasElement;
    const key = canvasKey(m.textures, canvas);
    m.uploaded.delete(key);
    const next = canvasKey(m.textures, canvas);
    expect(next).not.toBe(key);
    expect(m.uploaded.has(next)).toBe(true);
    expect(m.addCanvas).toHaveBeenCalledTimes(2);
    expect(canvasKey(m.textures, canvas)).toBe(next);
  });
});
