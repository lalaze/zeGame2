/** Browser storage access can throw even when retrieving window.localStorage.
 * Keep reads distinguishable from a genuinely absent key; never turn an unreadable
 * durable save into a writable new save. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type StorageResult<T> = { ok: true; value: T } | { ok: false };

export class GuardedStorage {
  private preferences = new Map<string, string | null>();

  constructor(private source: () => KeyValueStorage) {}

  read(key: string): StorageResult<string | null> {
    try { return { ok: true, value: this.source().getItem(key) }; }
    catch { return { ok: false }; }
  }

  write(key: string, value: string): StorageResult<void> {
    try {
      this.source().setItem(key, value);
      return { ok: true, value: undefined };
    } catch { return { ok: false }; }
  }

  /** Preferences remain usable for this page even if storage is denied/full.
   * Save data must use read/write above, never these lossy convenience methods. */
  preference(key: string): string | null {
    if (this.preferences.has(key)) return this.preferences.get(key)!;
    const result = this.read(key);
    const value = result.ok ? result.value : null;
    this.preferences.set(key, value);
    return value;
  }

  setPreference(key: string, value: string): void {
    this.preferences.set(key, value);
    this.write(key, value);
  }
}
