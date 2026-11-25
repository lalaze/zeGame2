// godot/data/rules.json is exactly what the TypeScript rules export today. Does not need Godot.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { rulesData } from './godot-parity/rules';

it('godot/data/rules.json has not drifted from the TypeScript rules', () => {
  const text = readFileSync(join(resolve(import.meta.dirname, '..'), 'godot/data/rules.json'), 'utf8');
  expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(rulesData())));
  expect(text).toBe(`${JSON.stringify(rulesData(), null, 1)}\n`);
});
