import { describe, expect, it } from 'vitest';
import { PreviewMetrics } from './preview-metrics';

class MockOutput {
  attributes = new Map<string, string>();
  style = { cssText: '' };
  textContent = '';
  parent: MockParent | null = null;
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }
}

class MockParent {
  children: MockOutput[] = [];
  appendChild(output: MockOutput) { this.children.push(output); output.parent = this; }
}

function mockCanvas() {
  const body = new MockParent();
  const created: string[] = [];
  const document = {
    body, hidden: false,
    createElement(tag: string) { created.push(tag); return new MockOutput(); },
  };
  const canvas = { ownerDocument: document, parentElement: body } as unknown as HTMLCanvasElement;
  return { canvas, body, document, created };
}

function enabled() {
  const dom = mockCanvas();
  const metrics = new PreviewMetrics(dom.canvas, 'http://localhost:5313/?qa-metrics=1');
  return { ...dom, metrics, output: dom.body.children[0] };
}

describe('opt-in localhost rendering diagnostics', () => {
  it('does not touch DOM or count on ordinary, remote, or invalid URLs', () => {
    const canvas = { get ownerDocument() { throw new Error('disabled metrics touched DOM'); } } as unknown as HTMLCanvasElement;
    for (const href of [
      'http://localhost/', 'http://localhost/?qa-metrics=0', 'http://localhost/?qa-metrics=true',
      'http://localhost/?qa-metrics=01', 'http://localhost/?qa-metrics=', 'invalid',
      'https://example.com/?qa-metrics=1', 'https://localhost.example.com/?qa-metrics=1',
      'http://127.0.0.2/?qa-metrics=1', 'file:///preview.html?qa-metrics=1',
    ]) {
      const metrics = new PreviewMetrics(canvas, href);
      expect(metrics.enabled).toBe(false);
      for (let frame = 0; frame < 130; frame++) {
        expect(metrics.willRefresh(20)).toBe(false);
        metrics.record(20, 2, 30, 1024);
      }
      metrics.reset();
      metrics.destroy();
    }
  });

  it('creates one visible, labeled output only for each supported opted-in loopback host', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      const { canvas, body, created } = mockCanvas();
      const metrics = new PreviewMetrics(canvas, `http://${host}:5313/?qa-metrics=1`);
      expect(metrics.enabled).toBe(true);
      expect(created).toEqual(['output']);
      expect(body.children).toHaveLength(1);
      expect(body.children[0].attributes.get('aria-label')).toBe('Rendering diagnostics');
      expect(body.children[0].style.cssText).toContain('display:block');
      expect(body.children[0].style.cssText).toContain('max-width:calc(100vw - 16px)');
      expect(body.children[0].textContent).toContain('Browser viewport QA');
    }
  });

  it('refreshes after roughly a second and reports FPS, update CPU, p95, textures and estimated MiB', () => {
    const { metrics, output } = enabled();
    const waiting = output.textContent;
    for (let frame = 0; frame < 49; frame++) {
      expect(metrics.willRefresh(20)).toBe(false);
      metrics.record(20, 2, 999, 0);
    }
    expect(output.textContent).toBe(waiting);
    expect(metrics.willRefresh(20)).toBe(true);
    expect(metrics.willRefresh(20)).toBe(true); // checking does not collect a frame
    metrics.record(20, 2, 31, 8 * 1024 * 1024);
    expect(output.textContent).toContain('last 50 frames');
    expect(output.textContent).toContain('avg FPS 50.0');
    expect(output.textContent).toContain('update CPU 2.00 ms');
    expect(output.textContent).toContain('CPU p95 2.00 ms');
    expect(output.textContent).toContain('frame p95 20.00 ms');
    expect(output.textContent).toContain('textures 31');
    expect(output.textContent).toContain('estimated RGBA 8.00 MiB (not measured GPU memory)');
    expect(metrics.willRefresh(20)).toBe(false);
  });

  it('limits both averages and percentiles to the latest 120 valid frames', () => {
    const { metrics, output } = enabled();
    for (let frame = 0; frame < 200; frame++) metrics.record(10, 50, 1, 1024);
    for (let frame = 0; frame < 200; frame++) metrics.record(5, 1, 2, 2048);
    expect(output.textContent).toContain('last 120 frames');
    expect(output.textContent).toContain('avg FPS 200.0');
    expect(output.textContent).toContain('update CPU 1.00 ms');
    expect(output.textContent).toContain('CPU p95 1.00 ms');
    expect(output.textContent).toContain('frame p95 5.00 ms');
  });

  it('uses nearest-rank p95 rather than an average or maximum', () => {
    const { metrics, output } = enabled();
    for (let frame = 0; frame < 20; frame++) metrics.record(50, frame === 19 ? 100 : frame >= 17 ? 7 : 1, 0, 0);
    expect(output.textContent).toContain('update CPU 6.55 ms');
    expect(output.textContent).toContain('CPU p95 7.00 ms');
  });

  it('excludes invalid deltas, suspended-tab gaps and hidden-document samples', () => {
    const { metrics, output, document } = enabled();
    for (const delta of [-1, 0, NaN, Infinity, -Infinity, 1000, 30_000]) {
      expect(metrics.willRefresh(delta)).toBe(false);
      metrics.record(delta, 999, 999, 999);
    }
    document.hidden = true;
    for (let frame = 0; frame < 100; frame++) metrics.record(20, 999, 999, 999);
    expect(metrics.willRefresh(20)).toBe(false);
    document.hidden = false;
    for (let frame = 0; frame < 50; frame++) metrics.record(20, 2, 1, 0);
    expect(output.textContent).toContain('last 50 frames');
    expect(output.textContent).toContain('avg FPS 50.0');
    expect(output.textContent).toContain('update CPU 2.00 ms');
  });

  it('does not fabricate CPU or resource measurements from invalid numbers', () => {
    const { metrics, output } = enabled();
    for (let frame = 0; frame < 50; frame++) metrics.record(20, NaN, Infinity, -1);
    expect(output.textContent).toContain('avg FPS 50.0');
    expect(output.textContent).toContain('update CPU — ms');
    expect(output.textContent).toContain('CPU p95 — ms');
    expect(output.textContent).toContain('textures —');
    expect(output.textContent).toContain('estimated RGBA — MiB');
  });

  it('reset clears the window and refresh cadence; destroy removes DOM and stays disabled', () => {
    const { metrics, output, body, created } = enabled();
    for (let frame = 0; frame < 49; frame++) metrics.record(20, 100, 1, 0);
    metrics.reset();
    expect(metrics.enabled).toBe(true);
    expect(output.textContent).toContain('waiting for frame samples');
    expect(metrics.willRefresh(20)).toBe(false);
    for (let frame = 0; frame < 50; frame++) metrics.record(20, 3, 1, 0);
    expect(output.textContent).toContain('last 50 frames');
    expect(output.textContent).toContain('update CPU 3.00 ms');
    metrics.destroy();
    metrics.destroy();
    expect(body.children).toHaveLength(0);
    expect(metrics.enabled).toBe(false);
    metrics.reset();
    for (let frame = 0; frame < 50; frame++) metrics.record(20, 3, 1, 0);
    expect(metrics.willRefresh(20)).toBe(false);
    expect(created).toEqual(['output']);
    expect(body.children).toHaveLength(0);
  });
});
