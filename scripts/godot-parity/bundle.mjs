// Bundles the real `src/game/*` modules with the parity generator into one Node module, so the
// generator runs the shipped TypeScript and Node's own coverage can tell which branches it reached.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build, parseSync } from 'vite';

export const ROOT = resolve(import.meta.dirname, '../..');
export const PARITY_DIR = join(ROOT, 'godot/.parity');
const GAME = join(ROOT, 'src/game');

export const gameModules = () =>
  readdirSync(GAME, { recursive: true }).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => f.slice(0, -3)).sort();

/** Parameter names, type texts and optionality of every exported function. */
export async function writeSignatures(out = join(PARITY_DIR, 'signatures.json')) {
  const all = {};
  for (const mod of gameModules()) {
    const src = readFileSync(join(GAME, `${mod}.ts`), 'utf8');
    const { program } = await parseSync(`${mod}.ts`, src, { lang: 'ts' });
    const fns = {};
    const param = (p) => {
      const target = p.type === 'AssignmentPattern' ? p.left : p;
      const type = target.typeAnnotation ? src.slice(target.typeAnnotation.typeAnnotation.start, target.typeAnnotation.typeAnnotation.end) : '';
      return { name: target.name ?? '?', type: type.replace(/\s+/g, ' '), optional: p.type === 'AssignmentPattern' || !!target.optional };
    };
    for (const node of program.body) {
      const d = node.type === 'ExportNamedDeclaration' ? node.declaration : null;
      if (d?.type === 'FunctionDeclaration') fns[d.id.name] = d.params.map(param);
      if (d?.type === 'VariableDeclaration') {
        for (const v of d.declarations) if (v.init?.type === 'ArrowFunctionExpression') fns[v.id.name] = v.init.params.map(param);
      }
    }
    all[mod] = fns;
  }
  mkdirSync(PARITY_DIR, { recursive: true });
  writeFileSync(out, JSON.stringify(all));
  return all;
}

/** Builds `scripts/godot-parity/<entry>.ts` (or one written to `godot/.parity`) to `godot/.parity/bundle/<entry>.mjs`. */
export async function bundle(entry, from = join(ROOT, 'scripts/godot-parity')) {
  await build({
    root: ROOT, configFile: false, logLevel: 'error', publicDir: false,
    build: {
      ssr: join(from, `${entry}.ts`), outDir: join(PARITY_DIR, 'bundle'), emptyOutDir: false,
      minify: false, sourcemap: true, target: 'node22',
      rollupOptions: { output: { entryFileNames: `${entry}.mjs`, format: 'es' } },
    },
  });
  return join(PARITY_DIR, 'bundle', `${entry}.mjs`);
}
