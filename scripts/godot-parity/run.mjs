// Runs Godot headless and decides whether a run really passed.
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './bundle.mjs';

export const GODOT = process.env.GODOT_BIN || '/opt/homebrew/bin/godot';
export const PROJECT = join(ROOT, 'godot');
export function godot(args, project = PROJECT) {
  const r = spawnSync(GODOT, ['--headless', '--path', project, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { status: r.status, error: r.error, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
/** Runs a command beside others and collects what it printed. */
export const background = (command, args) => new Promise((done) => {
  const child = spawn(command, args, { cwd: ROOT }), out = { status: null, error: undefined, stdout: '', stderr: '' };
  child.stdout.on('data', (d) => { out.stdout += d; }); child.stderr.on('data', (d) => { out.stderr += d; });
  child.on('error', (error) => { out.error = error; done(out); });
  child.on('close', (status) => { out.status = status; done(out); });
});
/** Refreshes the list of class names; a new `class_name` is unknown until then. */
export function importProject(project = PROJECT) {
  const r = godot(['--import'], project), text = r.stdout + r.stderr;
  if (r.status !== 0 || /SCRIPT ERROR|Parse Error/i.test(text)) { console.error(text); throw new Error('Godot could not import the project'); }
}
/** Null when the run passed, else why not. A script error does not stop Godot, so the output decides. */
export function judge(r, label) {
  const text = `${r.stdout}\n${r.stderr}`;
  if (r.error) return `${label}: ${r.error.message}`;
  if (/SCRIPT ERROR|Parse Error/i.test(text)) return `${label}: script error`;
  if (text.includes('FAIL:')) return `${label}: differences found`;
  if (r.status !== 0) return `${label}: exited with ${r.status}`;
  const m = r.stdout.match(/^[A-Z_]+SUMMARY: .*\bpassed=(\d+) failed=(\d+)\b/m);
  if (!m) return `${label}: no summary, so it stopped early`;
  if (Number(m[1]) === 0 || Number(m[2]) !== 0) return `${label}: passed=${m[1]} failed=${m[2]}`;
  return null;
}
