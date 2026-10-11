import { Sim } from './sim';
import { GuardedStorage, type KeyValueStorage } from './storage';
import { SAVE_KEY, deserialize, serialize, type GameState } from './state';

export const SAVE_LOCK = `${SAVE_KEY}/writer`;
export type SaveResult = 'saved' | 'inactive' | 'conflict' | 'unavailable' | 'temporary';

/** One live simulation owns the save until the page closes. Never warm up on a
 * cloned state: cooks and orders in Sim would retain unpaid work from the clone. */
export class SaveSession {
  readonly state: GameState;
  readonly sim = new Sim();
  active = true;
  private expected: string | null;

  readonly mode: 'persistent' | 'temporary';

  private readonly storage: GuardedStorage | null;

  constructor(storage: KeyValueStorage | GuardedStorage | null, now: number, private release: () => void) {
    this.storage = storage === null || storage instanceof GuardedStorage ? storage : new GuardedStorage(() => storage);
    this.mode = this.storage ? 'persistent' : 'temporary';
    const result = this.storage?.read(SAVE_KEY);
    if (result && !result.ok) throw new Error('Save storage is unavailable');
    this.expected = result?.ok ? result.value : null;
    this.state = deserialize(this.expected, now);
    let runtime: unknown;
    try { runtime = JSON.parse(this.expected ?? '{}').runtime; } catch { /* invalid save uses defaults */ }
    if (!this.sim.restore(runtime, this.state)) this.state.inProduction = {};
  }

  save(state: GameState): SaveResult {
    if (!this.active) return 'inactive';
    // Temporary sessions never upgrade themselves, even if access later recovers.
    // Reacquire a lock and reload the actual durable save on a fresh page instead.
    if (!this.storage) return 'temporary';
    try {
      // Also reject an external edit (or an older app version that lacks the lock).
      // The Web Lock, not this comparison alone, makes cooperating writes exclusive.
      const current = this.storage.read(SAVE_KEY);
      if (!current.ok) return 'unavailable';
      if (current.value !== this.expected) {
        this.close();
        return 'conflict';
      }
      const payload = { ...state, runtime: state.phase === 'prep' ? undefined : this.sim.snapshot(state) };
      const raw = serialize(payload);
      if (!this.storage.write(SAVE_KEY, raw).ok) return 'unavailable';
      this.expected = raw;
      return 'saved';
    } catch {
      return 'unavailable';
    }
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    this.release();
  }
}

/** Queue behind any other open game tab, then read its final save only after it
 * releases ownership. Browser-managed locks also release after a crash/closure. */
export async function acquireSaveSession(
  storage: KeyValueStorage | GuardedStorage,
  locks: Pick<LockManager, 'request'> | undefined,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<SaveSession> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const temporary = () => new SaveSession(null, now(), () => {});
  if (!locks) return temporary();
  const guarded = storage instanceof GuardedStorage ? storage : new GuardedStorage(() => storage);
  try {
    return await new Promise<SaveSession>((resolve, reject) => {
      void locks.request(SAVE_LOCK, { mode: 'exclusive', signal }, async () => {
        let release!: () => void;
        const closed = new Promise<void>((done) => { release = done; });
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const session = new SaveSession(guarded, now(), release);
        resolve(session);
        await closed;
      }).catch(reject);
    });
  } catch (error) {
    if (signal.aborted) throw error;
    // No readable save or no usable lock: keep the old save entirely untouched.
    return temporary();
  }
}

/** Cancel queued acquisition on navigation, save/release an acquired session,
 * and never reuse a BFCache-restored simulation after its lock was released. */
export function watchSavePage(page: EventTarget, reload: () => void) {
  const abort = new AbortController();
  const closing: (() => void)[] = [];
  page.addEventListener('pagehide', () => {
    abort.abort();
    for (const close of closing.splice(0)) close();
  });
  page.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) reload();
  });
  return {
    signal: abort.signal,
    onClose(close: () => void): void {
      if (abort.signal.aborted) close();
      else closing.push(close);
    },
  };
}
