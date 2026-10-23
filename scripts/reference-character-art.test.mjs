import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-contract checks only. These do not execute TypeScript, decode atlases,
// run the full app, or replace reference-character-qa.html browser verification.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// The five reference-characters-v1 atlases were replaced by the cozy cast (guests), cozy team
// (staff) and seating families; the reference module now loads and delegates to them.
test('reference art loads the cast, team and seating families lazily and delegates to them', () => {
  const source = read('src/render/reference-character-art.ts');
  for (const family of ['preloadSeatingEnsemble', 'preloadBatchCharacters', 'preloadCozyTeam', 'makeBatchCharacter', 'makeCozyTeam'])
    assert.ok(source.includes(family), family);
  assert.match(source, /export function preloadReferenceCharacters/);
  for (const file of ['src/render/cozy-cast-art.ts', 'src/render/cozy-team-art.ts']) assert.match(read(file), /registerFineSpriteArt/);
  assert.match(source, /export function referenceCharacterContacts/);
  assert.match(source, /export function referenceCharacterOffset/);
});

test('character entrypoint resolves reference art before legacy cache lookup', () => {
  const source = read('src/render/sprites.ts');
  const body = source.slice(source.indexOf('export function character('));
  const reference = body.indexOf('resolveReferenceCharacter(look, role, appearanceId)');
  const legacyCache = body.indexOf('charCache.get(');
  assert.ok(reference >= 0 && legacyCache > reference);
  assert.match(body.slice(reference, legacyCache), /if\s*\(reference\)\s*return reference/);
});

test('actual scene preloads references and uses matching seated and pet anchors', () => {
  const source = read('src/render/phaser/cafe-scene.ts');
  assert.match(source, /preloadReferenceCharacters\(/);
  assert.match(source, /referenceCharacterOffset\(sprite\)/);
  assert.match(source, /referenceCharacterContacts\(pose\.sprite\)/);
  assert.match(source, /referenceCharacterContacts\(sprite\)/);
  for (const boundary of [['private drawBaristas(', 'private callBubble('], ['private drawServer(', '// ------------------------------------------------------------ the kitchen'], ['private customerFrames(', '/** One pose/anchor']]) {
    const start=source.indexOf(boundary[0]),end=source.indexOf(boundary[1],start);
    assert.ok(start>=0&&end>start, boundary[0]);
    const body=source.slice(start,end);
    assert.match(body, /character\(/);
    assert.doesNotMatch(body, /generated(?:Staff|Servers|Customers)\?\.resolve/);
  }
});

test('custom owner preview and both asset export entrypoints preload reference art', () => {
  for (const path of ['src/ui/generated-owner-preview.ts','src/art-preview.ts','sprite-preview.html']) assert.match(read(path), /preloadReferenceCharacters\(/, path);
});

test('visual QA uses actual painters and isolated state with visible failure reporting', () => {
  const source=read('reference-character-qa.html');
  for (const marker of ['fineSpriteArt(frame)', 'createInitialState(0)', 'new CafeGame(', 'CUSTOMER_CAST.map', 'referenceCharacterContacts(frame)', 'document.body.dataset.ready', 'window.referenceCharacterQAResults']) assert.ok(source.includes(marker),marker);
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\s*\./);
  assert.doesNotMatch(source, /import\(['"][^'"]*(?:main|save-session|session-owner)\.ts['"]\)/);
});
