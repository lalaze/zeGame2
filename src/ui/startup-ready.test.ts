import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForStartupReady } from './startup-ready';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('startup readiness', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a slow renderer behind the loader beyond four seconds', async () => {
    const renderer = deferred();
    const fonts = deferred();
    const ready = vi.fn();
    const startup = waitForStartupReady(renderer.promise, fonts.promise).then(ready);

    await vi.advanceTimersByTimeAsync(2000);
    expect(ready).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4001);
    expect(ready).not.toHaveBeenCalled();

    renderer.resolve();
    await startup;
    expect(ready).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let unresolved fonts hold a ready renderer past two seconds', async () => {
    const fonts = deferred();
    const ready = vi.fn();
    const startup = waitForStartupReady(Promise.resolve(), fonts.promise).then(ready);

    await vi.advanceTimersByTimeAsync(1999);
    expect(ready).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await startup;
    expect(ready).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still waits for the renderer when fonts are already available', async () => {
    const renderer = deferred();
    const ready = vi.fn();
    const startup = waitForStartupReady(renderer.promise, Promise.resolve()).then(ready);

    await vi.advanceTimersByTimeAsync(5000);
    expect(ready).not.toHaveBeenCalled();
    renderer.resolve();
    await startup;
    expect(ready).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('starts immediately when both are ready and cancels the font timer', async () => {
    await waitForStartupReady(Promise.resolve(), Promise.resolve());
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, 5000])('does not report ready after a renderer rejection at %i ms', async (delay) => {
    const renderer = deferred();
    const fonts = deferred();
    const ready = vi.fn();
    const failure = new Error('renderer failed');
    const startup = waitForStartupReady(renderer.promise, fonts.promise).then(ready);
    const rejected = expect(startup).rejects.toBe(failure);

    await vi.advanceTimersByTimeAsync(delay);
    renderer.reject(failure);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    fonts.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    expect(ready).not.toHaveBeenCalled();
  });

  it('preserves font rejection before the fallback deadline without reporting ready', async () => {
    const fonts = deferred();
    const ready = vi.fn();
    const failure = new Error('fonts failed');
    const startup = waitForStartupReady(Promise.resolve(), fonts.promise).then(ready);
    const rejected = expect(startup).rejects.toBe(failure);

    fonts.reject(failure);
    await rejected;
    expect(ready).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the font fallback if fonts reject only after their deadline', async () => {
    const renderer = deferred();
    const fonts = deferred();
    const ready = vi.fn();
    const startup = waitForStartupReady(renderer.promise, fonts.promise).then(ready);

    await vi.advanceTimersByTimeAsync(2000);
    fonts.reject(new Error('late font failure'));
    renderer.resolve();
    await startup;
    expect(ready).toHaveBeenCalledExactlyOnceWith(undefined);
  });
});
