// Which parts of the rules ran, from V8's own block coverage of the bundle this is part of.
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { SourceMap } from 'node:module';

export const bundleText = readFileSync(new URL(import.meta.url), 'utf8');
const session = new Session();
/** Must be on before the rules first run: functions compiled earlier would only report whether they were called. */
export function startCoverage(): void {
  session.connect();
  session.post('Profiler.enable');
  session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
}
/** Counting slows long runs down several times. */
export function stopCoverage(): void {
  session.post('Profiler.stopPreciseCoverage');
  session.post('Profiler.disable');
}
/** Which characters of the bundle ran since the last call. */
export function reached(): Uint8Array {
  const map = new Uint8Array(bundleText.length);
  session.post('Profiler.takePreciseCoverage', (_e, { result }) => {
    for (const fn of result.find((x) => x.url === import.meta.url)?.functions ?? []) for (const range of fn.ranges) map.fill(range.count ? 1 : 0, range.startOffset, range.endOffset);
  });
  return map;
}
/** The same, with every stretch of rules code that did not run, named after its place in the source: module and line, or in a generated file the function. */
export function stretches(sources = /src\/game\/([\w-]+)\.ts/, generated = false): { branches: { key: string; at: number }[]; map: Uint8Array } {
  const branches: { key: string; at: number }[] = [], map = new Uint8Array(bundleText.length);
  session.post('Profiler.takePreciseCoverage', (_e, { result }) => {
    const file = import.meta.url, script = result.find((x) => x.url === file)!, text = bundleText, source = new SourceMap(JSON.parse(readFileSync(`${file.replace('file://', '')}.map`, 'utf8')));
    const starts = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    const place = (offset: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= offset) lo = m; else hi = m - 1; } return source.findEntry(lo, offset - starts[lo]) as { originalSource?: string; originalLine?: number }; };
    const inFunction = (at: number) => script.functions.filter((f) => f.functionName && f.ranges[0].startOffset <= at && at < f.ranges[0].endOffset).reduce((a, b) => (a && a.ranges[0].startOffset > b.ranges[0].startOffset ? a : b), undefined as typeof script.functions[0] | undefined);
    /** The function, and which time the same text appears in it. */
    const within = (at: number, raw: string) => { const fn = inFunction(at), before = text.slice(fn?.ranges[0].startOffset ?? 0, at), n = raw.length < 40 ? before.split(raw).length : 1; return `${fn?.functionName ?? ''}${n > 1 ? ` ${n}` : ''}`; };
    for (const fn of script.functions) for (const range of fn.ranges) {
      map.fill(range.count ? 1 : 0, range.startOffset, range.endOffset);
      if (range.count) continue;
      const raw = text.slice(range.startOffset, range.endOffset), snippet = raw.replace(/\s+/g, ' ').trim(), at = range.startOffset + raw.search(/\S/);
      if (!snippet || /^[)}\];,]*$/.test(snippet)) continue;
      const from = place(at), mod = from.originalSource?.match(sources)?.[1];
      if (mod) branches.push({ key: `${mod}:${generated ? within(at, raw.trim()) : (from.originalLine ?? 0) + 1}: ${snippet.slice(0, 90)}`, at });
    }
  });
  return { branches, map };
}
