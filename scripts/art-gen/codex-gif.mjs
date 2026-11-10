#!/usr/bin/env node
// Ask Codex for one looping animated GIF of a character action and file it in the repo.
//
//   node scripts/art-gen/codex-gif.mjs --out=<dir/name.gif> --prompt=<a.txt>[,<b.txt>...] --ref=<png> [--ref=<png>...]
//        [--frames=6] [--cell=256] [--timeout=1500]
//
// Codex paints every frame in ONE image-generation call (that is what keeps the character
// identical from frame to frame) and assembles the GIF itself. It works in a throwaway
// directory outside the repo, so it cannot touch project files; only the finished GIF is
// copied here. A .json next to it records prompt, references and thread id.
// Turn the GIF into game frames with scripts/art-gen/gif-frames.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const many = name => args.filter(a => a.startsWith(`--${name}=`)).map(a => a.slice(name.length + 3));
const one = (name, fallback) => many(name).at(-1) ?? fallback;
const out = one('out'), prompts = many('prompt').flatMap(v => v.split(',')), refs = many('ref');
const frames = Number(one('frames', 6)), cell = Number(one('cell', 256)), timeout = Number(one('timeout', 1500)) * 1000;
if (!out || !prompts.length) { console.error('Usage: codex-gif.mjs --out=<gif> --prompt=<txt>[,<txt>] [--ref=<png>...] [--frames=6]'); process.exit(2); }
for (const file of [...prompts, ...refs]) if (!fs.existsSync(file)) { console.error(`Missing ${file}`); process.exit(2); }

const brief = prompts.map(file => fs.readFileSync(file, 'utf8').trim()).join('\n\n');
const instruction = `Deliver exactly one file, out.gif, in the current directory: a looping animated GIF.

HOW TO PRODUCE IT
1. Call your built-in image generation tool ONCE, with transparent background, passing the ${refs.length} attached reference image(s), to paint all ${frames} frames side by side in a single sheet. One call keeps the character identical in every frame. Use the art brief below without rewriting its content.
2. Split the sheet with code into ${frames} frames of ${cell}x${cell} pixels. Keep the character at the same scale in every frame, with the lowest foot on the same baseline and the body centred horizontally (the character moves in place). Use nearest-neighbour only: no smoothing, no interpolation, no recolouring, no added outline, shadow or glow.
3. Assemble out.gif: ${frames} frames in order, 120 ms per frame, infinite loop, transparent background, every frame fully redrawn (dispose previous).
Work only inside the current directory. Finish with the word DONE and one sentence on anything that deviates from this.

=== ART BRIEF ===
${brief}`;

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'art-gen-gif-'));
const started = Date.now();
const child = spawn('codex', ['exec', '--json', '-s', 'workspace-write', '--skip-git-repo-check', '-C', scratch,
  ...refs.flatMap(file => ['-i', path.resolve(file)]), '-'], { stdio: ['pipe', 'pipe', 'inherit'] });
child.stdin.end(instruction);
let stdout = '';
child.stdout.on('data', chunk => { stdout += chunk; });
const timer = setTimeout(() => { console.error('Timed out'); child.kill('SIGTERM'); }, timeout);
child.on('close', code => {
  clearTimeout(timer);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out.replace(/\.gif$/, '.codex.jsonl'), stdout);
  const made = path.join(scratch, 'out.gif');
  if (!fs.existsSync(made)) { console.error(`codex exited ${code}; no out.gif in ${scratch}`); process.exit(1); }
  fs.copyFileSync(made, out);
  const thread = stdout.match(/"thread_id"\s*:\s*"([0-9a-f-]{36})"/)?.[1] ?? null;
  const sheets = thread && fs.existsSync(path.join(os.homedir(), '.codex', 'generated_images', thread))
    ? fs.readdirSync(path.join(os.homedir(), '.codex', 'generated_images', thread)).map(f => path.join(os.homedir(), '.codex', 'generated_images', thread, f)) : [];
  const said = [...stdout.matchAll(/"type":"agent_message","text":"((?:[^"\\]|\\.)*)"/g)].at(-1)?.[1] ?? '';
  fs.writeFileSync(out.replace(/\.gif$/, '.json'), JSON.stringify({
    tool: 'codex exec: built-in image generation, frames assembled by Codex', thread, frames, cell, prompts, references: refs,
    generatedSheets: sheets, codexSaid: said.replace(/\\n/g, ' ').slice(0, 400),
    sha256: createHash('sha256').update(fs.readFileSync(out)).digest('hex'), seconds: Math.round((Date.now() - started) / 1000),
  }, null, 2) + '\n');
  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(`${out}  thread=${thread}  ${Math.round((Date.now() - started) / 1000)}s`);
});
