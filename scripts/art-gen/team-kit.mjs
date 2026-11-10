#!/usr/bin/env node
// Turn one generated staff sheet into poses the game's staff pipeline can label reliably.
//
//   node scripts/art-gen/team-kit.mjs <kit dir> [--role=staff|chef] [--out=<preview.png>]
//
// The staff are recoloured at runtime (src/render/team-pixel-art.ts): each source pixel is
// labelled skin, hair, apron, trousers or "other" by colour tests, then drawn in the saved
// look's ramps. Generated colours wander around those tests' limits, which leaves unlabelled
// specks that keep their chestnut or sage when the player picks another colour. So every
// painted pixel is snapped here to a short list of source colours chosen well inside the
// limits, and the result is run through the real labelling to measure what still leaks.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng, oklab } from '../pixel-conform.mjs';
import { MATERIAL, hexRgb, paintTeamPose, segmentTeamPose, shadeRamp, voteTeamPose } from '../../src/render/team-pixel-art.ts';
import { blank, blit, scaled, sheetFigures } from './lib.mjs';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/**
 * Source colours by family. Each is inside the pipeline's test for its material with room to
 * spare. Shoes and apron buttons share the hair browns on purpose: the pipeline tells them apart
 * by position, and near-identical families would only make the snapping flicker between them.
 */
const BODY = {
  // Blush is a skin tone the pipeline itself turns into cheeks: redder and darker than the base.
  skin: ['#FAC498', '#E4A078', '#EE9676'], brown: ['#C47848', '#9C5836', '#703A26'],
  cream: ['#F0E0C0', '#FCF2DA', '#D6C09C', '#CCAE88'],
  // Near black on purpose. Inside the face the pipeline takes a dark mark for an eye only if it
  // is this dark; a merely dark-brown one is painted as facial hair, in the hair colour.
  outline: ['#1E1210'], glint: ['#FFFFFF'],
};
const CHAIR = { chair: ['#E8A038', '#C87C24'], cushion: ['#3A7062', '#28544A'] };
export const SOURCE_COLOURS = {
  staff: { ...BODY, apron: ['#60764C', '#7C9262', '#465A3A'] },
  // The chef's terracotta apron sits among the hair browns; position separates them in the pipeline
  // too. Under the hat the pipeline reads a brown with red above 150 and little contrast as hat
  // shading, so the chef's mid hair brown stays at 150.
  chef: { ...BODY, brown: ['#C47848', '#965434', '#703A26'], apron: ['#B65C3C', '#CE704A', '#8C422C'], trousers: ['#786450', '#5C4C3C'] },
};
export const COLS = 7, WALK_ROWS = 3, SEATED = 3;

/** Snap a figure's opaque pixels to the given source colours; returns each pixel's family index. */
function canonicalise(figure, families) {
  const names = Object.keys(families), entries = names.flatMap((name, family) => families[name].map(colour => ({ family, name, rgb: hex(colour), lab: oklab(...hex(colour)) })));
  // The white eye glint exists only on the face. Lower down a bright shirt highlight would snap
  // to it and mottle the cloth.
  const zone = y => y / figure.height < .5 ? 1 : 0;
  const allowed = (entry, where) => entry.name === 'glint' ? where : true;
  const cache = new Map(), family = new Uint8Array(figure.width * figure.height).fill(255), picked = new Uint8Array(figure.width * figure.height).fill(255);
  for (let n = 0; n < family.length; n++) {
    const i = n * 4; if (figure.pixels[i + 3] < 128) { figure.pixels.fill(0, i, i + 4); continue; }
    const where = zone(Math.floor(n / figure.width)), key = (figure.pixels[i] << 16 | figure.pixels[i + 1] << 8 | figure.pixels[i + 2]) * 2 + where;
    let best = cache.get(key);
    if (best === undefined) {
      const lab = oklab(figure.pixels[i], figure.pixels[i + 1], figure.pixels[i + 2]); let distance = Infinity;
      entries.forEach((entry, index) => { if (!allowed(entry, where)) return; const d = entry.lab.reduce((sum, v, k) => sum + (v - lab[k]) ** 2, 0); if (d < distance) { distance = d; best = index; } });
      cache.set(key, best);
    }
    picked[n] = best;
  }
  const { width, height } = figure, at = (x, y) => x < 0 || y < 0 || x >= width || y >= height ? 255 : picked[y * width + x];
  // The generator's big pixels are about three source pixels wide. A lone pixel that disagrees
  // with its neighbours is noise from the snap, not a painted detail: give it the majority colour.
  for (let pass = 0; pass < 2; pass++) {
    const next = picked.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const own = picked[y * width + x]; if (own === 255) continue;
      const votes = new Map(); let same = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const v = at(x + dx, y + dy); if (v === 255) continue; votes.set(v, (votes.get(v) ?? 0) + 1); if (v === own) same++; }
      if (same > 1) continue;
      let winner = own, most = 2;
      for (const [v, count] of votes) if (count > most) { most = count; winner = v; }
      next[y * width + x] = winner;
    }
    picked.set(next);
  }
  // The pipeline accepts an ear, a hand or a strip of forehead as skin only if the patch holds
  // some full-brightness skin. A patch painted entirely in the shadow tone gets the base tone.
  const skinBase = entries.findIndex(entry => entry.name === 'skin'), isSkin = v => v !== 255 && entries[v].name === 'skin', seen = new Uint8Array(picked.length);
  for (let n = 0; n < picked.length; n++) {
    if (seen[n] || !isSkin(picked[n])) continue;
    const island = [n]; seen[n] = 1; let lit = false;
    for (let k = 0; k < island.length; k++) {
      const p = island[k], x = p % width, y = (p - x) / width; if (picked[p] === skinBase) lit = true;
      for (const v of [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y ? p - width : -1, y < height - 1 ? p + width : -1]) if (v >= 0 && !seen[v] && isSkin(picked[v])) { seen[v] = 1; island.push(v); }
    }
    if (!lit) for (const p of island) picked[p] = skinBase;
  }
  const first = name => entries.findIndex(entry => entry.name === name), nameOf = v => v === 255 ? '' : entries[v].name;
  /** 4-connected patches of pixels passing `test`, each with the names of the pixels around it. */
  const patches = test => {
    const done = new Uint8Array(picked.length), found = [];
    for (let n = 0; n < picked.length; n++) {
      if (done[n] || !test(picked[n], n)) continue;
      const island = [n], around = new Map(); done[n] = 1;
      for (let k = 0; k < island.length; k++) {
        const p = island[k], x = p % width, y = (p - x) / width;
        for (const v of [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y ? p - width : -1, y < height - 1 ? p + width : -1]) {
          if (v < 0) continue;
          if (test(picked[v], v)) { if (!done[v]) { done[v] = 1; island.push(v); } } else around.set(nameOf(picked[v]), (around.get(nameOf(picked[v])) ?? 0) + 1);
        }
      }
      const edge = [...around.values()].reduce((a, b) => a + b, 0), rows = island.map(p => Math.floor(p / width));
      found.push({ island, share: name => (around.get(name) ?? 0) / Math.max(1, edge), top: Math.min(...rows), bottom: Math.max(...rows) });
    }
    return found;
  };
  // A peach highlight painted inside the hair is not an ear: surrounded by hair, it would be
  // refused as skin and keep an orange tint under every hair colour. Make it a hair highlight.
  for (const patch of patches(isSkin)) if (patch.island.length < picked.length * .004 && patch.share('brown') > .6) for (const p of patch.island) picked[p] = first('brown');
  // An eyebrow is a small brown stroke on the skin. Only the darkest hair brown is dark enough
  // for the pipeline to read it as facial hair; a lighter one is taken for a mouth and stays red.
  const browns = entries.map((entry, index) => entry.name === 'brown' ? index : -1).filter(index => index >= 0), isBrown = v => browns.includes(v);
  for (const patch of patches(isBrown)) if (patch.island.length < picked.length * .01 && patch.share('skin') > .7) for (const p of patch.island) picked[p] = browns.at(-1);
  for (let n = 0; n < picked.length; n++) if (picked[n] !== 255) { figure.pixels.set(entries[picked[n]].rgb, n * 4); figure.pixels[n * 4 + 3] = 255; family[n] = entries[picked[n]].family; }
  return { names, family };
}

/**
 * What the pipeline fails to label, as shares: brown above the neck that is not hair (it would
 * stay chestnut under another hair colour), skin that is not skin, apron that is not cloth.
 */
function leaks(figure, names, family, options) {
  const { width, height } = figure, seg = segmentTeamPose({ data: figure.pixels, width, height, anchors: figure.anchors ?? {} }, options);
  const index = name => names.indexOf(name), brown = index('brown'), skin = index('skin'), apron = index('apron');
  const neckY = figure.anchors?.neck?.y ?? height * (options.sit ? .44 : options.role === 'cook' ? .48 : .46);
  // Ink next to a material is absorbed into it and features are face details: neither is a leak.
  const labelled = m => m === MATERIAL.ink || m === MATERIAL.feature;
  const count = { hair: 0, hairLost: 0, skin: 0, skinLost: 0, apron: 0, apronLost: 0 };
  for (let n = 0; n < family.length; n++) {
    const f = family[n], m = seg.material[n], y = Math.floor(n / width); if (f === 255) continue;
    if (m === MATERIAL.hair) count.hair++;
    // Chair wood and the chef's apron are brown too, so only the head counts.
    else if (f === brown && y < neckY - height * .04 && !labelled(m) && !(options.role === 'cook' && y < height * .22)) count.hairLost++;
    if (f === skin) { count.skin++; if (m !== MATERIAL.skin && !labelled(m)) count.skinLost++; }
    if (f === apron && options.role !== 'cook') { count.apron++; if (m !== MATERIAL.cloth && !labelled(m)) count.apronLost++; }
  }
  const share = (part, whole) => whole ? +(part / whole).toFixed(3) : 0;
  return { hairLost: share(count.hairLost, count.hair + count.hairLost), skinLost: share(count.skinLost, count.skin), apronLost: share(count.apronLost, count.apron), seg };
}

/** Seated anchors as shares of the pose's bounds, by pose, as the shipped sheets have always used. */
const SEAT_ANCHORS = [{ hip: [.4, .74], neck: [.55, .44], hand: [.7, .64] }, { hip: [.4, .74], neck: [.55, .44], hand: [.9, .7] }, { hip: [.4, .74], neck: [.55, .44], hand: [.78, .77] }];
export function seatAnchors(pose, width, height) {
  const a = SEAT_ANCHORS[pose], at = ([x, y]) => ({ x: +(width * x).toFixed(2), y: +(height * y).toFixed(2) });
  return { floor: { x: +(width * .4).toFixed(2), y: height - Math.max(1, Math.round(height * .01)) }, hip: at(a.hip), neck: at(a.neck), hand: at(a.hand) };
}

/** { walk: [3 rows][7 figures], seated: [3 figures], report } with source colours snapped. */
export function teamKit(kit, role = 'staff') {
  let figures;
  try { figures = sheetFigures(decodePng(path.join(kit, 'sheet.png')), [COLS, COLS, COLS, SEATED]); } catch (error) { throw Error(`${kit}: ${error.message}`); }
  const families = SOURCE_COLOURS[role], pipelineRole = role === 'chef' ? 'cook' : 'barista', report = { kit, role, poses: [], warnings: [] };
  const LIMITS = { hairLost: [.04, 'of the head\'s brown is not labelled hair'], skinLost: [.12, 'of the skin is not labelled skin'], apronLost: [.08, 'of the apron is not labelled cloth'] };
  figures.forEach((row, r) => row.forEach((figure, c) => {
    const sit = r === 3;
    if (sit) figure.anchors = seatAnchors(c, figure.width, figure.height);
    const { names, family } = canonicalise(figure, sit ? { ...families, ...CHAIR } : families);
    const { seg, ...leak } = leaks(figure, names, family, { role: pipelineRole, sit, back: r === 1 });
    report.poses.push({ row: r, column: c, size: [figure.width, figure.height], ...leak });
    for (const [key, [limit, text]] of Object.entries(LIMITS)) if (leak[key] > limit) report.warnings.push(`${['front', 'back', 'right', 'seated'][r]} ${c}: ${(leak[key] * 100).toFixed(0)}% ${text}`);
  }));
  const heights = figures.slice(0, 3).flat().map(f => f.height), tall = Math.max(...heights);
  heights.forEach((h, n) => { if (h < tall * .9) report.warnings.push(`${['front', 'back', 'right'][Math.floor(n / COLS)]} ${n % COLS}: ${h}px tall against ${tall}px`); });
  return { walk: figures.slice(0, 3), seated: figures[3], report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2), [kit] = args.filter(a => !a.startsWith('--'));
  const opt = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!kit) { console.error('Usage: team-kit.mjs <kit dir> [--role=staff|chef] [--out=<preview.png>]'); process.exit(2); }
  const { walk, seated, report } = teamKit(kit, opt('role') ?? 'staff');
  if (opt('out')) {
    // Three views of every pose: the snapped source, then the figure as the game paints it in
    // the default look and in one that changes every recoloured material.
    const role = (opt('role') ?? 'staff') === 'chef' ? 'cook' : 'barista', D = 2, W = 32 * D, H = 44 * D, ZOOM = 2;
    const ramp = colour => shadeRamp(hexRgb(colour));
    const looks = [{ skin: ramp('#f4cfad'), hair: ramp('#976546'), cloth: ramp('#8ba477'), pants: ramp('#85664f') }, { skin: ramp('#80533f'), hair: ramp('#cc8c9f'), cloth: ramp('#799ba7'), pants: ramp('#53637b') }];
    const all = [...walk, seated], standing = walk.flat(), cw = Math.max(...all.flat().map(f => f.width)) + 8, ch = Math.max(...all.flat().map(f => f.height)) + 8;
    const scale = Math.min(40 / Math.max(...standing.map(f => f.height)), 28 / Math.max(...standing.map(f => f.width)));
    const seatScale = Math.min(37 / Math.max(...seated.map(f => f.height)), 31 / Math.max(...seated.map(f => f.width)));
    const PW = (W + 12) * ZOOM, sheet = blank(cw * COLS + PW * COLS * 2, ch * 4);
    for (let n = 0; n < sheet.pixels.length; n += 4) sheet.pixels.set([233, 217, 184, 255], n);
    all.forEach((row, r) => row.forEach((f, c) => {
      const sit = r === 3, pose = { data: f.pixels, width: f.width, height: f.height, anchors: f.anchors ?? {} }, seg = segmentTeamPose(pose, { role, sit, back: r === 1 });
      blit(sheet, f, 0, 0, f.width, f.height, c * cw + 4, r * ch + ch - 4 - f.height);
      const k = sit ? seatScale : scale, floor = f.anchors?.floor ?? { x: f.width / 2, y: f.height };
      const dx = sit ? 13 - floor.x * k : 16 - f.width * k / 2, dy = sit ? 41 - floor.y * k : 42 - f.height * k;
      const grid = voteTeamPose(seg, { x: dx * D, y: dy * D, scale: k * D }, W + 12, H);
      looks.forEach((colours, look) => {
        const art = scaled({ width: grid.width, height: grid.height, pixels: paintTeamPose(grid, colours) }, ZOOM);
        blit(sheet, art, 0, 0, art.width, art.height, COLS * cw + (look * COLS + c) * PW, r * ch + Math.max(0, ch - art.height));
      });
    }));
    encodePng(opt('out'), sheet);
  }
  const worst = key => Math.max(...report.poses.map(p => p[key]));
  console.log(`${kit}: worst pose — head brown not hair ${(worst('hairLost') * 100).toFixed(1)}%, skin not skin ${(worst('skinLost') * 100).toFixed(1)}%, apron not cloth ${(worst('apronLost') * 100).toFixed(1)}%; ${report.warnings.length} warning(s)${report.warnings.length ? `\n  ${report.warnings.slice(0, 6).join('\n  ')}${report.warnings.length > 6 ? '\n  …' : ''}` : ''}`);
}
