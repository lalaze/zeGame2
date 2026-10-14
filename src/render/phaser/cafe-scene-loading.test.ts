import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { CafeScene } from './cafe-scene';
import { GENERATED_MAIN_ASSETS } from '../generated-main-art';

function harness() {
  const handlers = new Map<string, (...args: any[]) => void>();
  const progress = vi.fn(), fail = vi.fn(), create = vi.fn(), tick = vi.fn();
  const scene = Object.assign(Object.create(CafeScene.prototype), {
    hooks: { loadingProgress: progress, tick }, onLoadError: fail, createCafe: create,
    load: { image: vi.fn(), on: (event: string, fn: (...args: any[]) => void) => handlers.set(event, fn),
      once: (event: string, fn: (...args: any[]) => void) => handlers.set(event, fn) },
  });
  return { scene, handlers, progress, fail, create, tick };
}

describe('café image startup', () => {
  it('reports completed images and never initializes or ticks a failed scene', () => {
    const h = harness(), total = Object.keys(GENERATED_MAIN_ASSETS).length;
    h.scene.preload();
    expect(h.scene.load.image).toHaveBeenCalledTimes(total);
    expect(h.progress).toHaveBeenCalledWith(0, total);
    h.handlers.get('filecomplete')!();
    expect(h.progress).toHaveBeenLastCalledWith(1, total);
    h.handlers.get('loaderror')!({ key: 'generated-main:customer-12-up-stepA' });
    expect(h.fail.mock.calls[0][0].message).toContain('customer-12-up-stepA');
    h.handlers.get('filecomplete')!();
    expect(h.progress).toHaveBeenLastCalledWith(1, total);
    h.scene.create();
    h.scene.update(0, 16);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.tick).not.toHaveBeenCalled();
  });

  it('rejects scene initialization exceptions rather than leaving ready pending', () => {
    const h = harness(), failure = new Error('texture initialization failed');
    h.scene.preload();
    h.create.mockImplementation(() => { throw failure; });
    h.scene.create();
    expect(h.fail).toHaveBeenCalledExactlyOnceWith(failure);
    h.scene.update(0, 16);
    expect(h.tick).not.toHaveBeenCalled();
  });
});
