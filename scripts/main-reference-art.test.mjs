import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { transformWithOxc } from 'vite';

const source = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const files = ['src/render/room-art.ts', 'src/render/generated-main-art.ts', 'src/render/pixel-room-shell.ts'];
test('main-scene changed modules transform through the installed Vite compiler', async () => {
  for (const path of files) {
    const out = await transformWithOxc(source(path), path);
    assert.ok(out.code.length > 0, path);
  }
});
test('generated machine bytes retain the delivered PNG and alpha', () => {
  const bytes=fs.readFileSync(new URL('../public/art/generated/reference-main-v1/espresso.png', import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'cc5159fa5fd6c78cead19886440ee173affb594341739680ed6aadca52497ac5');
  assert.equal(bytes.readUInt32BE(16),1430); assert.equal(bytes.readUInt32BE(20),1100);
  assert.equal(bytes[25],6, 'RGBA image');
  assert.match(source('src/render/generated-main-art.ts'), /'reference-machine': 'reference-main-v1\/espresso.png'/);
});
test('reference treatment retains stock-driven food and shared floor projection', () => {
  const room=source('src/render/room-art.ts');
  assert.match(room,/state.phase === 'prep' \? \(state.bakePlan\[m.id\] \?\? 0\) : \(state.shelf\[m.id\] \?\? 0\)/);
  assert.match(room,/projectFloorLayer\(out, source, mainPixelProjection\(H\)\)/);
  // Every floor finish, checker included, shares one material painter before that projection.
  assert.match(room,/mainFloor\(this\.ctx, floor, H\)/);
  assert.match(room,/this.referenceMachine\(mx - 2, my \+ 24\)/);
  assert.doesNotMatch(room,/paintGeneratedCabinetBand/);
});
