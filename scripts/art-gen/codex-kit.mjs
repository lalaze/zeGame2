#!/usr/bin/env node
// Ask Codex for one character's whole action kit as animated GIFs, all cut from ONE generated
// sheet so every action shares the same colours and proportions.
//
//   node scripts/art-gen/codex-kit.mjs --out=<dir> --prompt=<a.txt>[,<b.txt>...] --ref=<png> [--ref=<png>...]
//        [--rows=walk-front,walk-back,walk-right,seated] [--cols=7] [--cell=256] [--timeout=1800]
//
// The brief must describe a sheet with one row per name in --rows and --cols figures per row.
// Codex paints the sheet in a single image-generation call, then cuts each row into a GIF.
// It works in a throwaway directory outside the repo. Copied into <dir>: <row>.gif for each
// row, sheet.png (the untouched generated sheet), kit.json (prompt, references, thread).
// Turn the GIFs into game frames with scripts/art-gen/kit-frames.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const many = name => args.filter(a => a.startsWith(`--${name}=`)).map(a => a.slice(name.length + 3));
const one = (name, fallback) => many(name).at(-1) ?? fallback;
const out = one('out'), prompts = many('prompt').flatMap(v => v.split(',')), refs = many('ref');
const rows = one('rows', 'walk-front,walk-back,walk-right,seated').split(','), cols = Number(one('cols', 7));
const cell = Number(one('cell', 256)), timeout = Number(one('timeout', 1800)) * 1000;
if (!out || !prompts.length) { console.error('Usage: codex-kit.mjs --out=<dir> --prompt=<txt>[,<txt>] [--ref=<png>...]'); process.exit(2); }
for (const file of [...prompts, ...refs]) if (!fs.existsSync(file)) { console.error(`Missing ${file}`); process.exit(2); }

const brief = prompts.map(file => fs.readFileSync(file, 'utf8').trim()).join('\n\n');
const instruction = `Deliver these files in the current directory: ${rows.map(r => `${r}.gif`).join(', ')}, and sheet.png.

HOW TO PRODUCE THEM
1. Call your built-in image generation tool exactly ONCE, with transparent background, passing the ${refs.length} attached reference image(s) and the art brief below without rewriting its content. It paints one sheet of ${rows.length} rows by ${cols} columns. Do not call the image tool again and do not repaint, retouch or recolour anything afterwards.
2. Save the untouched generated image as sheet.png.
3. With code, isolate the ${rows.length * cols} figures (each is a separate connected shape; use the transparent gutters, not an assumed equal grid) and cut each row into ${cols} frames of ${cell}x${cell} pixels on a transparent canvas. NEVER resize: every frame keeps the sheet's own pixels at the sheet's own scale, so all rows stay at one common scale. Drop stray specks that are not part of a figure.
4. Align the frames within each row: the lowest pixel of the figure on the same baseline, 16 pixels above the bottom edge. Horizontally, keep the HEAD still: put the centre of the top 40% of each figure on the same x in every frame of the row. For the row "${rows.at(-1)}" align on the chair instead: the chair keeps exactly the same position in every frame.
5. Write one looping GIF per row, named ${rows.map(r => `${r}.gif`).join(', ')} from the top row down: ${cols} frames in sheet order left to right, 120 ms per frame, infinite loop, transparent background, every frame fully redrawn (dispose previous), no dithering.
Work only inside the current directory. Finish with the word DONE and one sentence on anything that deviates from this.

=== ART BRIEF ===
${brief}`;

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'art-gen-kit-'));
const started = Date.now();
const child = spawn('codex', ['exec', '--json', '-s', 'workspace-write', '--skip-git-repo-check', '-C', scratch,
  ...refs.flatMap(file => ['-i', path.resolve(file)]), '-'], { stdio: ['pipe', 'pipe', 'inherit'] });
child.stdin.end(instruction);
let stdout = '';
child.stdout.on('data', chunk => { stdout += chunk; });
const timer = setTimeout(() => { console.error('Timed out'); child.kill('SIGTERM'); }, timeout);
child.on('close', code => {
  clearTimeout(timer);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'codex.jsonl'), stdout);
  const thread = stdout.match(/"thread_id"\s*:\s*"([0-9a-f-]{36})"/)?.[1] ?? null;
  const store = thread && path.join(os.homedir(), '.codex', 'generated_images', thread);
  const sheets = store && fs.existsSync(store) ? fs.readdirSync(store).filter(f => f.endsWith('.png')).map(f => path.join(store, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs) : [];
  // The generator's own file is the source of truth for the sheet; Codex's copy is the fallback.
  const sheet = sheets[0] ?? (fs.existsSync(path.join(scratch, 'sheet.png')) ? path.join(scratch, 'sheet.png') : null);
  if (sheet) fs.copyFileSync(sheet, path.join(out, 'sheet.png'));
  const missing = [];
  for (const row of rows) {
    const made = path.join(scratch, `${row}.gif`);
    if (fs.existsSync(made)) fs.copyFileSync(made, path.join(out, `${row}.gif`)); else missing.push(row);
  }
  const said = [...stdout.matchAll(/"type":"agent_message","text":"((?:[^"\\]|\\.)*)"/g)].at(-1)?.[1] ?? '';
  const sha = file => fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
  fs.writeFileSync(path.join(out, 'kit.json'), JSON.stringify({
    tool: 'codex exec: one built-in image generation, rows cut into GIFs by Codex', thread, rows, cols, cell, prompts, references: refs,
    generatedSheets: sheets, imageCalls: sheets.length, missing, codexSaid: said.replace(/\\n/g, ' ').slice(0, 500),
    sha256: Object.fromEntries(['sheet.png', ...rows.map(r => `${r}.gif`)].map(f => [f, sha(path.join(out, f))])),
    seconds: Math.round((Date.now() - started) / 1000),
  }, null, 2) + '\n');
  fs.rmSync(scratch, { recursive: true, force: true });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (missing.length || !sheet) { console.error(`${out}: codex exited ${code}; missing ${[...missing, ...(sheet ? [] : ['sheet.png'])].join(', ')} (${seconds}s)`); process.exit(1); }
  console.log(`${out}  thread=${thread}  ${seconds}s  ${sheets.length} image call(s)`);
});
