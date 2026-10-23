import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';
const read = path => readFileSync(path, 'utf8');
test('coherent atlas is a production asset and all four isolated parts are decoded', () => {
  assert.match(read('src/render/generated-main-art.ts'), /'cozy-cafe-atlas': 'cozy-cafe-v1\/furniture-atlas.png'/);
  const source = read('src/render/cozy-cafe-art.ts');
  assert.match(source, /\['table', 'chair', 'cabinet', 'window'\]/);
  assert.match(source, /current !== source/);
  assert.match(source, /getImageData/);
  assert.match(source, /registerFineSpriteArt/);
});
test('new scenery keeps dynamic window apertures and live cabinet items', () => {
  const source = read('src/render/room-art.ts');
  assert.match(source, /cozyCafePart\('window'\)/);
  assert.match(source, /generated\?\.aperture/);
  // The back-bar and window cabinets share the main-room material painter.
  assert.match(source, /mainCabinet\(this\.ctx, counter/);
  assert.match(source, /this.drawPastryCase\(state\)/);
  // Main-room window light became a floor bounce that keeps the tile texture (672dec9).
  assert.match(source, /paintWindowBounce\(ctx, opening\.x, opening\.w, FLOOR_Y, light\.sun\)/);
});
test('main furniture replacement retains seat-based depth, customer poses and fallback', () => {
  const source = read('src/render/phaser/cafe-scene.ts');
  assert.match(source, /index < MAX_TABLES \? cozyCafeSprite/);
  assert.match(source, /seatSpot\(index, side\)/);
  assert.match(source, /this.seatedCustomerPose\(index, side, c, t\)/);
  // Furniture is drawn through the lamplit image path.
  assert.match(source, /if \(cozyTable\) this\.litImage\(cozyTable/);
  assert.match(source, /else if \(!this.generatedPicture\('table'/);
  assert.match(source, /setCrop\(crop.x, crop.y, crop.width, crop.height\)/);
});
