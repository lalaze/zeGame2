import { Sim } from './sim';
import { SAVE_KEY, deserialize, serialize, type GameState } from './state';

export const SAVE_LOCK = `${SAVE_KEY}/writer`;
export type SaveResult = 'saved' | 'inactive' | 'conflict' | 'unavailable';
type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** One live simulation owns the save until the page closes. Never warm up on a
 * cloned state: cooks and orders in Sim would retain unpaid work from the clone. */
export class SaveSession {
  readonly state: GameState;
  readonly sim = new Sim();
  active = true;
  private expected: string | null;

  constructor(private storage: SaveStorage, now: number, private release: () => void) {
    this.expected = storage.getItem(SAVE_KEY);
    this.state = deserialize(this.expected, now);
    let runtime: unknown;
    try { runtime = JSON.parse(this.expected ?? '{}').runtime; } catch { /* invalid save uses defaults */ }
    if (!this.sim.restore(runtime, this.state)) this.state.inProduction = {};
  }

  save(state: GameState): SaveResult {
    if (!this.active) return 'inactive';
    try {
      // Also reject an external edit (or an older app version that lacks the lock).
      // The Web Lock, not this comparison alone, makes cooperating writes exclusive.
      if (this.storage.getItem(SAVE_KEY) !== this.expected) {
        this.close();
        return 'conflict';
      }
      const payload = { ...state, runtime: state.phase === 'prep' ? undefined : this.sim.snapshot(state) };
      const raw = serialize(payload);
      this.storage.setItem(SAVE_KEY, raw);
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
export function acquireSaveSession(
  storage: SaveStorage,
  locks: Pick<LockManager, 'request'> | undefined,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<SaveSession> {
  if (!locks) return Promise.reject(new Error('Exclusive save locks are unavailable'));
  return new Promise((resolve, reject) => {
    void locks.request(SAVE_LOCK, { mode: 'exclusive', signal }, async () => {
      let release!: () => void;
      const closed = new Promise<void>((done) => { release = done; });
      const session = new SaveSession(storage, now(), release);
      resolve(session);
      await closed;
    }).catch(reject);
  });
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
