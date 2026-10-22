import { describe, expect, it } from 'vitest';
import { COOK_BATCHES } from './data';
/** A first-stage kitchen. */
const COOK_BATCH = COOK_BATCHES[0];
import { openShop } from './day';
import { recipe, servingCost } from './economy';
import { acquireSaveSession, watchSavePage, SAVE_LOCK } from './save-session';
import { GuardedStorage } from './storage';
import { SAVE_KEY, createInitialState, serialize } from './state';

function memoryStorage(raw: string | null = null) {
  const entries = new Map<string, string>(raw === null ? [] : [[SAVE_KEY, raw]]);
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
}

/** Models Web Locks' exclusive queue and cancellation; unlike a localStorage
 * compare/write loop, the browser never lets two lock callbacks overlap. */
function exclusiveLocks(): Pick<LockManager, 'request'> {
  let tail = Promise.resolve();
  return {
    request: ((name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => {
      expect(name).toBe(SAVE_LOCK);
      expect(options.mode).toBe('exclusive');
      const request = tail.then(async () => {
        if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return callback({ name, mode: 'exclusive' });
      });
      tail = request.then(() => undefined, () => undefined);
      return request;
    }) as LockManager['request'],
  };
}
const signal = () => new AbortController().signal;

describe('exclusive save sessions', () => {
  it('loads the newest save only after the first tab saves and closes', async () => {
    const storage = memoryStorage(serialize(createInitialState(10)));
    const locks = exclusiveLocks();
    const first = await acquireSaveSession(storage, locks, signal());
    let secondStarted = false;
    const waiting = acquireSaveSession(storage, locks, signal()).then((session) => {
      secondStarted = true;
      return session;
    });
    await Promise.resolve();
    expect(secondStarted).toBe(false);
    first.state.coins = 1234;
    first.state.day = 7;
    first.state.pantry.beans = 17;
    expect(first.save(first.state)).toBe('saved'); // final pagehide save
    first.close();
    const second = await waiting;
    expect(second.state.coins).toBe(1234);
    expect(second.state.day).toBe(7);
    expect(second.state.pantry.beans).toBe(17);
    second.state.coins = 1500;
    second.save(second.state);
    const latest = storage.getItem(SAVE_KEY);
    // A late timer/pagehide or BFCache-restored first tab cannot write again.
    first.state.coins = 0;
    expect(first.save(first.state)).toBe('inactive');
    first.close();
    expect(storage.getItem(SAVE_KEY)).toBe(latest);
    second.close();
  });

  it('saves before releasing on pagehide and reloads a BFCache-restored page', async () => {
    const page = new EventTarget();
    let reloads = 0;
    const lifetime = watchSavePage(page, () => { reloads++; });
    const storage = memoryStorage();
    const locks = exclusiveLocks();
    const session = await acquireSaveSession(storage, locks, lifetime.signal);
    lifetime.onClose(() => {
      session.save(session.state);
      session.close();
    });
    const next = acquireSaveSession(storage, locks, signal());
    session.state.coins = 777;
    page.dispatchEvent(new Event('pagehide'));
    expect(lifetime.signal.aborted).toBe(true);
    expect(session.active).toBe(false);
    const replacement = await next;
    expect(replacement.state.coins).toBe(777);
    page.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    expect(reloads).toBe(0);
    page.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(reloads).toBe(1);
    expect(session.save(session.state)).toBe('inactive');
    replacement.close();
  });

  it('skips a queued tab that closes, allowing the next tab to acquire', async () => {
    const storage = memoryStorage();
    const locks = exclusiveLocks();
    const first = await acquireSaveSession(storage, locks, signal());
    const abort = new AbortController();
    const canceled = acquireSaveSession(storage, locks, abort.signal);
    const rejected = expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
    const next = acquireSaveSession(storage, locks, signal());
    abort.abort();
    first.save(first.state);
    first.close();
    await rejected;
    const third = await next;
    expect(third.active).toBe(true);
    third.close();
  });

  it('rejects an externally changed save without overwriting it, and releases the lock', async () => {
    const storage = memoryStorage();
    const locks = exclusiveLocks();
    const stale = await acquireSaveSession(storage, locks, signal());
    const newer = createInitialState(2);
    newer.coins = 900;
    const latest = serialize(newer);
    storage.setItem(SAVE_KEY, latest);
    expect(stale.save(stale.state)).toBe('conflict');
    expect(stale.active).toBe(false);
    expect(stale.save(stale.state)).toBe('inactive');
    expect(storage.getItem(SAVE_KEY)).toBe(latest);
    const next = await acquireSaveSession(storage, locks, signal());
    expect(next.state.coins).toBe(900);
    next.close();
  });

  it('treats a reset as a protected save, not an unguarded delete', async () => {
    const storage = memoryStorage(serialize({ ...createInitialState(1), coins: 500 }));
    const locks = exclusiveLocks();
    const first = await acquireSaveSession(storage, locks, signal());
    const waiting = acquireSaveSession(storage, locks, signal());
    expect(first.save(createInitialState(2))).toBe('saved');
    first.close();
    const next = await waiting;
    expect(next.state.coins).toBe(0);
    expect(next.state.createdAt).toBe(2);
    next.close();
  });

  it('preserves an existing save when Web Locks are unavailable', async () => {
    const raw = serialize({ ...createInitialState(1), coins: 500 });
    const storage = memoryStorage(raw);
    const temporary = await acquireSaveSession(storage, undefined, signal());
    expect(temporary.mode).toBe('temporary');
    expect(temporary.state.coins).toBe(0);
    temporary.state.coins = 99;
    expect(temporary.save(temporary.state)).toBe('temporary');
    expect(temporary.save(createInitialState(2))).toBe('temporary');
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
    temporary.close();
    expect(temporary.save(temporary.state)).toBe('inactive');
  });

  it('starts temporary play when acquiring storage throws and never writes after recovery', async () => {
    const raw = serialize({ ...createInitialState(1), coins: 500 });
    const durable = memoryStorage(raw);
    let denied = true;
    const guarded = new GuardedStorage(() => {
      if (denied) throw new DOMException('Blocked', 'SecurityError');
      return durable;
    });
    const locks = exclusiveLocks();
    const temporary = await acquireSaveSession(guarded, locks, signal());
    expect(temporary.mode).toBe('temporary');
    temporary.state.coins = 321;
    denied = false;
    expect(temporary.save(temporary.state)).toBe('temporary');
    expect(durable.getItem(SAVE_KEY)).toBe(raw);
    // Failed acquisition releases its Web Lock; a fresh page can load safely.
    const restored = await acquireSaveSession(guarded, locks, signal());
    expect(restored.mode).toBe('persistent');
    expect(restored.state.coins).toBe(500);
    restored.close();
    temporary.close();
  });

  it('handles getItem and lock API failures without writing an unreadable old save', async () => {
    let writes = 0;
    const unreadable = {
      getItem: () => { throw new DOMException('Denied', 'SecurityError'); },
      setItem: () => { writes++; },
    };
    const session = await acquireSaveSession(unreadable, exclusiveLocks(), signal());
    expect(session.mode).toBe('temporary');
    expect(session.save(session.state)).toBe('temporary');
    expect(writes).toBe(0);
    session.close();
    for (const request of [
      () => { throw new Error('Locks denied'); },
      () => Promise.reject(new Error('Locks denied')),
    ]) {
      const deniedLocks = { request: request as LockManager['request'] };
      const fallback = await acquireSaveSession(unreadable, deniedLocks, signal());
      expect(fallback.mode).toBe('temporary');
      fallback.close();
    }
  });

  it('does not start temporary play after pagehide aborts acquisition', async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(acquireSaveSession(memoryStorage(), undefined, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('checks for conflicts after a persistent read failure recovers', async () => {
    const storage = memoryStorage();
    let fail = false;
    const guarded = new GuardedStorage(() => ({
      getItem: (key) => {
        if (fail) throw new DOMException('Denied', 'SecurityError');
        return storage.getItem(key);
      },
      setItem: storage.setItem,
    }));
    const session = await acquireSaveSession(guarded, exclusiveLocks(), signal());
    fail = true;
    expect(session.save(session.state)).toBe('unavailable');
    const newer = serialize({ ...createInitialState(2), coins: 777 });
    storage.setItem(SAVE_KEY, newer);
    fail = false;
    expect(session.save(session.state)).toBe('conflict');
    expect(storage.getItem(SAVE_KEY)).toBe(newer);
  });

  it('can retry a storage failure without changing the expected save or losing ownership', async () => {
    const storage = memoryStorage();
    let fail = true;
    const flaky = {
      getItem: storage.getItem,
      setItem: (key: string, value: string) => {
        if (fail) throw new Error('Quota exceeded');
        storage.setItem(key, value);
      },
    };
    const session = await acquireSaveSession(flaky, exclusiveLocks(), signal());
    session.state.coins = 55;
    expect(session.save(session.state)).toBe('unavailable');
    expect(session.active).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    fail = false;
    expect(session.save(session.state)).toBe('saved');
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).coins).toBe(55);
    session.close();
  });
});

describe('resuming an open café', () => {
  it('does not warm up economic work, and pays for every batch after resume', async () => {
    const state = createInitialState(0);
    state.kitchen = true;
    state.items.roll = 1;
    state.onMenu = ['roll'];
    state.bakePlan = { roll: 0 };
    state.pantry.flour = 100;
    state.pantry.butter = 100;
    openShop(state);
    state.dayTime = 123;
    const storage = memoryStorage(serialize(state));
    const session = await acquireSaveSession(storage, exclusiveLocks(), signal());
    expect(session.state.pantry).toEqual(state.pantry);
    expect(session.state.today).toEqual(state.today);
    expect(session.state.dayTime).toBe(123);
    expect(session.sim.cooks).toEqual([]);
    expect(session.sim.customers).toEqual([]);
    expect(session.sim.pass).toEqual([]);

    session.sim.update(session.state, 0.05);
    expect(session.sim.cooks[0].batch?.n).toBe(COOK_BATCH);
    for (const [ingredient, n] of recipe('roll')) {
      expect(session.state.pantry[ingredient]).toBe(state.pantry[ingredient] - n * COOK_BATCH);
    }
    expect(session.state.today.ingredientCost - state.today.ingredientCost).toBeCloseTo(servingCost('roll') * COOK_BATCH);
    // Stop new batches; the paid batch may finish, with no scratch-state batch added.
    session.state.onMenu = [];
    for (let i = 0; i < 6000; i++) session.sim.update(session.state, 0.05);
    expect(session.state.today.baked.roll).toBe(COOK_BATCH);
    expect(session.state.today.ingredientCost - state.today.ingredientCost).toBeCloseTo(servingCost('roll') * COOK_BATCH);
    session.close();
  });

  it('cannot produce a batch after resume with an empty pantry', async () => {
    const state = createInitialState(0);
    state.phase = 'open';
    state.kitchen = true;
    state.items.roll = 1;
    state.onMenu = ['roll'];
    const session = await acquireSaveSession(memoryStorage(serialize(state)), exclusiveLocks(), signal());
    for (let i = 0; i < 1000; i++) session.sim.update(session.state, 0.05);
    expect(session.state.today.baked.roll ?? 0).toBe(0);
    expect(session.state.shelf.roll ?? 0).toBe(0);
    expect(session.state.today.ingredientCost).toBe(0);
    session.close();
  });
});
