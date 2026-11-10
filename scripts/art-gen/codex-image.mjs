#!/usr/bin/env node
// Ask Codex's built-in image generator for one image and file the result in the repo.
//
//   node scripts/art-gen/codex-image.mjs --out=<dir/name.png> --prompt=<a.txt>[,<b.txt>...] --ref=<png> [--ref=<png>...]
//        [--resume=<thread id>] [--timeout=1500]
//
// Prompt files are concatenated in order. References are attached in order, so the prompt
// can call them "image 1", "image 2". Codex only paints: it runs in a read-only sandbox and
// the generated file is copied here from ~/.codex/generated_images/<thread>/.
// Next to the PNG a .json records the prompt, references, thread id and original path, so a
// candidate can be revised later with --resume=<thread id> and a short "keep X, change Y" prompt.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const many = name => args.filter(a => a.startsWith(`--${name}=`)).map(a => a.slice(name.length + 3));
const one = (name, fallback) => many(name).at(-1) ?? fallback;
const out = one('out'), prompts = many('prompt').flatMap(v => v.split(',')), refs = many('ref');
const resume = one('resume'), timeout = Number(one('timeout', 1500)) * 1000;
if (!out || !prompts.length) { console.error('Usage: codex-image.mjs --out=<png> --prompt=<txt>[,<txt>] [--ref=<png>...] [--resume=<thread>]'); process.exit(2); }
for (const file of [...prompts, ...refs]) if (!fs.existsSync(file)) { console.error(`Missing ${file}`); process.exit(2); }

const brief = prompts.map(file => fs.readFileSync(file, 'utf8').trim()).join('\n\n');
const instruction = [
  'You are used here only as an image generator. Call your built-in image generation tool exactly once,',
  resume ? 'editing the image you generated earlier in this thread according to the change request below.'
    : `passing the ${refs.length} attached reference image(s) and the art brief below without rewriting it.`,
  'Do not run shell commands, do not read or change any file, do not post-process the image.',
  'When the image exists, answer with the single word DONE.',
  '', resume ? '=== CHANGE REQUEST ===' : '=== ART BRIEF ===', brief,
].join('\n');

const command = ['exec', ...(resume ? ['resume', resume] : []), '--json', '-s', 'read-only', ...refs.flatMap(file => ['-i', path.resolve(file)]), '-'];
const log = out.replace(/\.png$/, '.codex.jsonl');
fs.mkdirSync(path.dirname(out), { recursive: true });
const started = Date.now();
const child = spawn('codex', command, { stdio: ['pipe', 'pipe', 'inherit'] });
child.stdin.end(instruction);
let stdout = '';
child.stdout.on('data', chunk => { stdout += chunk; });
const timer = setTimeout(() => { console.error('Timed out'); child.kill('SIGTERM'); }, timeout);
child.on('close', code => {
  clearTimeout(timer);
  fs.writeFileSync(log, stdout);
  const thread = resume ?? stdout.match(/"thread_id"\s*:\s*"([0-9a-f-]{36})"/)?.[1];
  if (!thread) { console.error(`codex exited ${code}; no thread id in ${log}`); process.exit(1); }
  const dir = path.join(os.homedir(), '.codex', 'generated_images', thread);
  const made = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => path.join(dir, f))
    .filter(f => fs.statSync(f).mtimeMs >= started - 1000).sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs) : [];
  if (!made.length) { console.error(`codex exited ${code}; no new image in ${dir} (see ${log})`); process.exit(1); }
  const original = made.at(-1);
  fs.copyFileSync(original, out);
  fs.writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify({
    tool: 'codex exec built-in image generation', thread, resumed: Boolean(resume), prompts, references: refs, original,
    extraImagesThisRun: made.slice(0, -1), sha256: createHash('sha256').update(fs.readFileSync(out)).digest('hex'),
    seconds: Math.round((Date.now() - started) / 1000),
  }, null, 2) + '\n');
  console.log(`${out}  thread=${thread}  ${Math.round((Date.now() - started) / 1000)}s  (${made.length} image(s) this run)`);
});
