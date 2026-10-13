/** Local, explicitly opted-in browser diagnostics. Never reads the game clock. */
const WINDOW_FRAMES = 120;
const REFRESH_MS = 1000;
// A one-second suspension is not a useful interactive rendering sample.
const MAX_DELTA_MS = 1000;

interface FrameSample {
  deltaMs: number;
  cpuMs: number | null;
}

function optedIn(href: string): boolean {
  try {
    const url = new URL(href);
    return ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && url.searchParams.get('qa-metrics') === '1';
  } catch {
    return false;
  }
}

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

/**
 * Browser-viewport QA only; these numbers do not describe phone hardware.
 *
 * Normal URLs create no DOM, collect no samples, and start no timers/listeners.
 * The caller supplies observed frame deltas and update CPU duration. Check
 * `enabled` before taking performance timestamps. Use `willRefresh(deltaMs)`
 * before an expensive texture inventory, then pass its count/byte estimate to
 * `record` for that frame. Resource arguments on other frames are ignored.
 *
 * Memory is an estimated RGBA allocation from the caller, never measured GPU
 * memory. Only the latest 120 valid, visible frames remain in the sample window.
 */
export class PreviewMetrics {
  private output: HTMLOutputElement | null = null;
  private readonly frames: FrameSample[] = [];
  private elapsedMs = 0;

  constructor(private readonly canvas: HTMLCanvasElement, href: string) {
    if (!optedIn(href)) return;
    const doc = canvas.ownerDocument;
    const parent = doc.body ?? canvas.parentElement;
    if (!parent) return;
    const output = doc.createElement('output');
    output.setAttribute('aria-label', 'Rendering diagnostics');
    // Repainting a diagnostic once per second should not interrupt a reader.
    output.setAttribute('aria-live', 'off');
    output.style.cssText = [
      'position:fixed', 'right:8px', 'bottom:8px', 'z-index:2147483647',
      'display:block', 'box-sizing:border-box', 'max-width:calc(100vw - 16px)',
      'padding:6px 8px', 'border:1px solid #c6b38a', 'border-radius:3px',
      'background:rgba(34,31,25,.94)', 'color:#fff2d6',
      'font:11px/1.4 monospace', 'white-space:pre-wrap', 'pointer-events:none',
    ].join(';');
    this.output = output;
    this.reset();
    parent.appendChild(output);
  }

  /** False for ordinary pages and after destroy(). */
  get enabled(): boolean { return this.output !== null; }

  private accepts(deltaMs: number): boolean {
    return this.enabled && !this.canvas.ownerDocument.hidden
      && Number.isFinite(deltaMs) && deltaMs > 0 && deltaMs < MAX_DELTA_MS;
  }

  /** Non-mutating preview of whether the next record will repaint diagnostics. */
  willRefresh(deltaMs: number): boolean {
    return this.accepts(deltaMs) && this.elapsedMs + deltaMs >= REFRESH_MS;
  }

  record(deltaMs: number, cpuMs: number, textureCount?: number, estimatedBytes?: number): void {
    if (!this.accepts(deltaMs)) return;
    this.frames.push({ deltaMs, cpuMs: Number.isFinite(cpuMs) && cpuMs >= 0 ? cpuMs : null });
    if (this.frames.length > WINDOW_FRAMES) this.frames.shift();
    this.elapsedMs += deltaMs;
    if (this.elapsedMs < REFRESH_MS) return;
    this.elapsedMs -= REFRESH_MS;

    const deltas = this.frames.map(frame => frame.deltaMs);
    const cpu = this.frames.flatMap(frame => frame.cpuMs === null ? [] : [frame.cpuMs]);
    const fps = this.frames.length * 1000 / deltas.reduce((sum, delta) => sum + delta, 0);
    const averageCpu = cpu.length ? (cpu.reduce((sum, value) => sum + value, 0) / cpu.length).toFixed(2) : '—';
    const p95Cpu = cpu.length ? percentile95(cpu).toFixed(2) : '—';
    const count = textureCount !== undefined && Number.isFinite(textureCount) && textureCount >= 0
      ? String(Math.floor(textureCount)) : '—';
    const mib = estimatedBytes !== undefined && Number.isFinite(estimatedBytes) && estimatedBytes >= 0
      ? (estimatedBytes / (1024 * 1024)).toFixed(2) : '—';
    this.output!.textContent = [
      `Browser viewport QA · last ${this.frames.length} frames`,
      `avg FPS ${fps.toFixed(1)} · update CPU ${averageCpu} ms · CPU p95 ${p95Cpu} ms`,
      `frame p95 ${percentile95(deltas).toFixed(2)} ms · textures ${count}`,
      `estimated RGBA ${mib} MiB (not measured GPU memory)`,
    ].join('\n');
  }

  /** Clear samples and refresh timing without removing an enabled diagnostic. */
  reset(): void {
    this.frames.length = 0;
    this.elapsedMs = 0;
    if (this.output) this.output.textContent = 'Browser viewport QA · waiting for frame samples\nestimated RGBA is not measured GPU memory';
  }

  /** Remove the output and permanently stop this instance; safe to call twice. */
  destroy(): void {
    this.output?.remove();
    this.output = null;
    this.reset();
  }
}
