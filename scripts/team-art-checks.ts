// Browser-only regression checks. Run from team-art-fixture.html?verify=1.
import { preloadReferenceCharacters, referenceCharacterContacts, resolveReferenceCharacter } from '../src/render/reference-character-art';
import { fineSpriteArt } from '../src/render/fine-sprite-art';
import { worldSpriteArt } from '../src/render/world-art-grid';
import { seatingGeometry } from '../src/render/cozy-seating-art';
import palette from '../docs/art-grid/palette.json';

export async function checkTeamArt() {
  await preloadReferenceCharacters();
  const allowed = new Set(palette.colors.map(c => c.hex));
  const failures: string[] = [];
  let frames = 0;
  const check = (pass: boolean, label: string) => { if (!pass) failures.push(label); };
  const pixels = (frame: HTMLCanvasElement) => {
    const art = fineSpriteArt(frame);
    return art.canvas.getContext('2d')!.getImageData(0, 0, art.canvas.width, art.canvas.height).data;
  };
  const verify = (frame: HTMLCanvasElement, label: string) => {
    frames++;
    const art = fineSpriteArt(frame), data = pixels(frame);
    check(art.density === 2 && art.canvas.width === frame.width * 2 && art.canvas.height === frame.height * 2, label + ' native grid');
    check(worldSpriteArt(frame) === art, label + ' no second resample');
    let binary = true, onPalette = true, count = 0;
    for (let n = 0; n < data.length; n += 4) {
      if (!data[n + 3]) continue;
      count++;
      binary &&= data[n + 3] === 255;
      onPalette &&= allowed.has('#' + [...data.slice(n, n + 3)].map(v => v.toString(16).padStart(2, '0')).join(''));
    }
    check(count > 0, label + ' nonempty'); check(binary, label + ' opaque pixels'); check(onPalette, label + ' palette');
  };
  const mirror = (left: HTMLCanvasElement, right: HTMLCanvasElement, label: string) => {
    const a = pixels(left), b = pixels(right), w = left.width * 2, h = left.height * 2;
    let same = true;
    for (let y = 0; y < h && same; y++) for (let x = 0; x < w && same; x++)
      for (let k = 0; k < 4; k++) if (a[(y * w + x) * 4 + k] !== b[(y * w + w - 1 - x) * 4 + k]) { same = false; break; }
    check(same, label + ' exact mirror');
  };
  const start = performance.now();
  for (const role of ['owner', 'barista', 'server', 'cook'] as const) for (let style = 0; style < 8; style++) {
    const look = { skin: style % 4, hair: style % 6, hairStyle: style, shirt: style, pants: style % 3 };
    const f = resolveReferenceCharacter(look, role)!;
    const label = `${role}/${style}`;
    check(!!f, label + ' resolved'); if (!f) continue;
    check(resolveReferenceCharacter(look, role) === f, label + ' cached');
    for (const direction of ['down', 'up', 'right', 'left'] as const) f[direction].forEach((frame, i) => {
      verify(frame, `${label}/${direction}/${i}`);
      const c = referenceCharacterContacts(frame)!;
      check(c.foot.x === 16 && c.foot.y === 42 && !!c.carryContact && Number.isFinite(c.carryContact.x + c.carryContact.y), label + ' standing contacts');
    });
    for (let i = 0; i < 3; i++) mirror(f.left[i], f.right[i], label + '/walk/' + i);
    const seats = [f.sitRight, f.sitLeft, ...f.sitPetRight, ...f.sitPetLeft];
    seats.forEach((frame, i) => {
      verify(frame, `${label}/seat/${i}`);
      const c = referenceCharacterContacts(frame)!, g = seatingGeometry(frame)!;
      check(!!g && !!c.seatContact && c.seatContact.x === g.hip.x && c.seatContact.y === g.hip.y, label + ' seat anchor');
      check(c.foot.x === g.floor.x && c.foot.y === g.floor.y, label + ' floor anchor');
      if (i >= 2) check(!!c.petContact && c.petContact.x === g.petContact?.x && c.petContact.y === g.petContact?.y, label + ' pet anchor');
      verify(g.foreground, `${label}/foreground/${i}`);
    });
    mirror(f.sitLeft, f.sitRight, label + '/seat');
    for (let i = 0; i < 2; i++) mirror(f.sitPetLeft[i], f.sitPetRight[i], label + '/pet/' + i);
  }
  return { looks: 32, frames, milliseconds: Math.round(performance.now() - start), failures };
}
