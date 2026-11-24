#!/usr/bin/env python3
"""Build the recolourable café staff of assets/generated/floor-sample-v1 for the floors view.

    uv run --with pillow --with numpy --with scipy python scripts/art-gen/floor-staff-build.py [--only=1,12] [--review=<dir>]

One sheet per hairstyle (kits/staff/NN-name/take-N/sheet.png, prompts in prompts/staff/), in the
layout of the other character sheets (4x2: side walk x4, front, happy, side, back). They are
painted in key colours: hair violet, apron green, trousers blue, skin light peach, shirt white.
The game repaints those parts for each saved look (src/render/floors/floors-looks.ts), so for
every hairstyle this writes

- build/staff/<name>.webp: the strip of 8 equal frames (cut by soft-frames.mjs like every other
  character, 250 px tall), with the white shirt tinted cream;
- build/staff/<name>-mask.webp: twice as tall. Top half: how much of each pixel is hair (red),
  apron (green) and trousers (blue). Bottom half: how much is skin (red);
- build/staff/fronts.webp and fronts-mask.webp: every hairstyle's front pose in one picture, so a
  portrait or the look picker needs one download instead of 32;
- build/staff/staff.json: the hairstyles in save order (TEAM_HAIRSTYLES in
  src/render/cozy-team-art.ts) with each strip's frame size and the key colour each part was
  painted in, which the repaint measures shading against.

A pixel's part is read from its hue (soft at the borders, so painted edges do not fringe), kept
only near pixels that are surely that part and inside the band of the body where the part can be.

The two cooks keep their own sheets and work poses (kits/cook-*/take-1/{sheet,work}.png). Their
skin and hair follow their look too: kits/staff/cook-*/take-N/{sheet,work}.png repaint those sheets
with violet hair (prompts/staff/cook-common.txt), and this writes build/staff/cook-*.webp and
cook-*-work.webp with masks like the others, listed under `cooks` in staff.json. Their skin is
natural, like the bread and dough they carry, so skin is found shape by shape: every patch of warm
light colour closed in by outlines is skin if its colour matches the face's.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True

import numpy as np
from PIL import Image
from scipy import ndimage

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/staff'
# The PNG strips the WebP are made from stay in the art library, like the other characters'.
WORK = os.path.join(LIBRARY, OUT)
HEIGHT = 250
# Hairstyles in save order: must match TEAM_HAIRSTYLES (src/render/floors/floors-looks.test.ts checks).
STYLES = ['short', 'bun', 'long', 'bob', 'pony', 'sidepart', 'braids', 'waves',
          'crop', 'curls', 'undercut', 'slick', 'beard', 'buzz', 'pixie', 'buns', 'afro', 'bangs', 'twintails', 'curtain',
          'fauxhawk', 'manbun', 'shaggy', 'centerpart', 'mustache', 'locs', 'halfup', 'sidebraid', 'braidcrown', 'curlybob', 'asymbob', 'ringlets']
# The take each hairstyle is built from, where it is not take 1.
TAKES = {}
PARTS = ['hair', 'apron', 'pants', 'skin']
# The shirt is painted white so it cannot be taken for skin; it ships in the café's cream.
CREAM = np.array([1.0, .955, .875])
LUMA = np.array([.299, .587, .114])
FRONT = 4
# The cooks' sheets: walk and standing poses, and the work poses cut at the same scale.
COOKS = ['cook-chef', 'cook-scarf']
COOK_TAKES = {}


def kit(index):
    return f'{P}/kits/staff/{index:02d}-{STYLES[index]}/take-{TAKES.get(index, 1)}/sheet.png'


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def hsv(rgb):
    """Hue in degrees, saturation and value of float RGB (0..1)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = rgb.max(-1)
    c = v - rgb.min(-1)
    safe = np.where(c > 0, c, 1)
    h = np.where(v == r, (g - b) / safe % 6, np.where(v == g, (b - r) / safe + 2, (r - g) / safe + 4)) * 60
    return np.where(c > 0, h, 0), np.where(v > 0, c / np.where(v > 0, v, 1), 0), v


def hue_gap(h, centre):
    return np.abs((h - centre + 180) % 360 - 180)


def median_hue(h, pick, fallback):
    if pick.sum() < 50:
        return fallback
    angles = np.deg2rad(h[pick])
    return float(np.rad2deg(np.arctan2(np.sin(angles).mean(), np.cos(angles).mean())) % 360)


def near(core, radius):
    """Soft reach around a sure core: 1 inside and next to it, fading to 0 `radius` pixels out."""
    distance = ndimage.distance_transform_edt(~core)
    return 1 - smooth(distance, radius * .5, radius)


def big(mask, least):
    labels, count = ndimage.label(mask)
    if not count:
        return mask
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    return np.isin(labels, 1 + np.flatnonzero(sizes >= least))


def arc(h, start, end, width=30):
    """1 for hues from `start` to `end` degrees going up round the circle, fading in and out over `width` degrees after each."""
    d, span = (h - start) % 360, (end - start) % 360
    return smooth(d, 0, width) * (1 - smooth(d, span, span + width))


def classify(frame):
    """Memberships (hair, apron, pants, skin, shirt), each 0..1, for one RGBA frame, and each part's sure core."""
    rgb = frame[..., :3].astype(np.float64) / 255
    solid = frame[..., 3] > 40
    h, s, v = hsv(rgb)
    rows = np.flatnonzero(solid.any(1))
    top, bottom = rows[0], rows[-1] + 1
    # 0 at the top of the head, 1 at the soles.
    body = ((np.arange(frame.shape[0]) - top) / max(1, bottom - top))[:, None] * np.ones((1, frame.shape[1]))
    vivid = solid & (s > .22) & (v > .3)
    cool = vivid & (h > 185) & (h < 335)
    hair_hue = median_hue(h, cool & (body < .4), 270)
    pants_hue = median_hue(h, cool & (body > .68), 220)
    # The hue circle is shared out between the warm colours (skin), green (apron) and the cool
    # colours (trousers and hair), cross-fading where they meet, so every tinted pixel belongs somewhere.
    warm, green, cold = arc(h, 318, 58), arc(h, 58, 163), arc(h, 163, 318)
    # Violet or blue: by hue either side of the middle between them, and by where on the body it is.
    split = (hair_hue + pants_hue) / 2
    violet = np.where(body < .5, 1, np.where(body > .74, 0, smooth(h, split - 8, split + 8)))
    tinted = smooth(s, .035, .09) * smooth(v, .1, .2)
    hair = cold * violet * tinted * (1 - smooth(body, .68, .76))
    pants = cold * (1 - violet) * tinted * smooth(body, .5, .58)
    apron = green * tinted
    skin = warm * smooth(s, .09, .17) * smooth(v, .62, .76) * (1 - smooth(body, .78, .84))
    shirt = (1 - smooth(s, .1, .2)) * smooth(v, .55, .7)
    sure = {
        'hair': big(solid & (hair > .9) & (s > .22), 6), 'apron': big(solid & (apron > .9) & (s > .22), 20),
        'pants': big(solid & (pants > .9) & (s > .22), 20),
        'skin': big(solid & (skin > .9) & (s > .15) & (v > .82), 30), 'shirt': big(solid & (shirt > .9) & (v > .8), 30),
    }
    parts = {'hair': hair, 'apron': apron, 'pants': pants, 'skin': skin, 'shirt': shirt}
    for name in parts:
        parts[name] = parts[name] * near(sure[name], 5) * solid
    # No pixel is more than one whole part.
    total = sum(parts[name] for name in PARTS)
    over = np.maximum(1, total)
    for name in PARTS:
        parts[name] = parts[name] / over
    parts['shirt'] = parts['shirt'] * (1 - np.minimum(1, total))
    # Key colour the repaint would leave behind: clearly violet, green or blue, and not claimed.
    left = int((solid & (s > .2) & (v > .35) & (h > 75) & (h < 315) & (np.minimum(1, total) < .6)).sum())
    return parts, sure, left


def classify_cook(strip):
    """Hair and skin memberships for a whole cook strip, and their sure cores."""
    rgb = strip[..., :3].astype(np.float64) / 255
    solid = strip[..., 3] > 40
    h, s, v = hsv(rgb)
    warm, cold = arc(h, 318, 58), arc(h, 163, 318)
    hair = cold * smooth(s, .035, .09) * smooth(v, .1, .2)
    sure_hair = big(solid & (hair > .9) & (s > .22), 6)
    # Patches of warm light colour, each closed in by its outline: face, hands, but also dough, bread, cloth.
    patches, count = ndimage.label((strip[..., 3] > 200) & (warm > .9) & (v > .72) & (s > .07))
    index = range(1, count + 1)
    size = ndimage.sum(np.ones_like(h), patches, index)
    hue = ndimage.median(np.where(h > 180, h - 360, h), patches, index)
    sat, val = ndimage.median(s, patches, index), ndimage.median(v, patches, index)
    # The faces are the big, light peach patches (the pastry cook's pink headscarf is redder); skin is whatever matches their colour.
    faces = (size >= 1200) & (sat > .24) & (sat < .42) & (val > .9) & (hue > 19) & (hue < 28)
    if not faces.any():
        raise SystemExit('no face found on a cook strip')
    face_hue, face_sat = np.median(hue[faces]), np.median(sat[faces])
    is_skin = (size >= 30) & (np.abs(hue - face_hue) <= 2.5) & (np.abs(sat - face_sat) <= .06) & (val > .9)
    sure_skin = np.isin(patches, 1 + np.flatnonzero(is_skin))
    other = (patches > 0) & ~sure_skin
    skin = warm * smooth(s, .09, .17) * smooth(v, .62, .76) * near(sure_skin, 4) * ~other
    hair = hair * near(sure_hair, 5) * solid
    skin = skin * solid * (1 - hair)
    left = int((solid & (s > .2) & (v > .35) & (h > 200) & (h < 315) & (hair < .6)).sum())
    return {'hair': hair, 'skin': skin}, {'hair': sure_hair, 'skin': sure_skin}, left


def build_cook(name):
    """One cook's sheet and work strips; returns their manifest entries, or None without the takes."""
    take = COOK_TAKES.get(name, 1)
    entries, scale = {}, None
    for kind, key in (('sheet', name), ('work', f'{name}-work')):
        sheet = source(f'{P}/kits/staff/{name}/take-{take}/{kind}.png')
        if not os.path.exists(sheet):
            return None
        os.makedirs(WORK, exist_ok=True)
        cut = os.path.join(WORK, key)
        size = [f'--height={HEIGHT}'] if scale is None else [f'--scale={scale}']
        subprocess.run(['node', 'scripts/art-gen/soft-frames.mjs', sheet, f'--out={cut}', *size], check=True, stdout=subprocess.DEVNULL)
        meta = json.load(open(f'{cut}.json'))
        scale = scale or meta['scale']
        fw, fh, frames = meta['frameWidth'], meta['frameHeight'], meta['frames']
        strip = np.asarray(Image.open(f'{cut}.png').convert('RGBA'))
        parts, sure, left = classify_cook(strip)
        rgb = strip[..., :3].astype(np.float64)
        colours = {part: key_colour(rgb, parts[part], sure[part]) for part in ('hair', 'skin')}
        if not all(colours.values()):
            raise SystemExit(f'{key}: no hair or skin found; is the hair painted violet?')
        mask = np.zeros((fh * 2, fw * frames, 3), np.uint8)
        mask[:fh, :, 0] = np.round(parts['hair'] * 255)
        mask[fh:, :, 0] = np.round(parts['skin'] * 255)
        os.makedirs(OUT, exist_ok=True)
        Image.fromarray(strip, 'RGBA').save(f'{OUT}/{key}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
        Image.fromarray(mask, 'RGB').save(f'{OUT}/{key}-mask.webp', 'WEBP', quality=90, method=6)
        Image.fromarray(mask, 'RGB').save(f'{cut}-mask.png')
        print(f'{key}: {frames} frames of {fw}x{fh}, key {colours}, {left} key-coloured pixels left unpainted')
        entries[key] = {'frameWidth': fw, 'frameHeight': fh, 'frames': frames, 'key': colours, 'take': take}
    return entries


def key_colour(rgb, membership, sure):
    """The colour a part was painted in: the median of its surely-painted, unshaded pixels."""
    pick = sure & (membership > .95)
    if pick.sum() < 20:
        return None
    return [int(round(c)) for c in np.median(rgb[pick], axis=0)]


def build_style(index):
    name = STYLES[index]
    sheet = source(kit(index))
    if not os.path.exists(sheet):
        return None
    os.makedirs(WORK, exist_ok=True)
    cut = os.path.join(WORK, name)
    subprocess.run(['node', 'scripts/art-gen/soft-frames.mjs', sheet, f'--out={cut}', f'--height={HEIGHT}'], check=True, stdout=subprocess.DEVNULL)
    meta = json.load(open(f'{cut}.json'))
    fw, fh, frames = meta['frameWidth'], meta['frameHeight'], meta['frames']
    strip = np.asarray(Image.open(f'{cut}.png').convert('RGBA')).copy()
    mask = np.zeros((fh * 2, fw * frames, 3), np.uint8)
    keys = {name: [] for name in PARTS}
    leftover = 0
    for i in range(frames):
        frame = strip[:, i * fw:(i + 1) * fw]
        parts, sure, left = classify(frame)
        leftover += left
        rgb = frame[..., :3].astype(np.float64)
        for part in PARTS:
            colour = key_colour(rgb, parts[part], sure[part])
            if colour:
                keys[part].append(colour)
        # The white shirt becomes cream at the lightness it was painted, whatever cast its shading had.
        cream = (rgb @ LUMA)[..., None] * CREAM / (CREAM @ LUMA)
        tinted = rgb + (cream - rgb) * parts['shirt'][..., None]
        strip[:, i * fw:(i + 1) * fw, :3] = np.clip(np.round(tinted), 0, 255).astype(np.uint8)
        for channel, part in enumerate(['hair', 'apron', 'pants']):
            mask[:fh, i * fw:(i + 1) * fw, channel] = np.round(parts[part] * 255)
        mask[fh:, i * fw:(i + 1) * fw, 0] = np.round(parts['skin'] * 255)
    missing = [part for part in PARTS if not keys[part]]
    if missing:
        raise SystemExit(f'{name}: no {", ".join(missing)} found; is the sheet painted in the key colours?')
    key = {part: [int(round(c)) for c in np.median(np.array(keys[part]), axis=0)] for part in PARTS}
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(strip, 'RGBA').save(f'{cut}-cream.png')
    Image.fromarray(strip, 'RGBA').save(f'{OUT}/{name}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
    Image.fromarray(mask, 'RGB').save(f'{OUT}/{name}-mask.webp', 'WEBP', quality=90, method=6)
    Image.fromarray(mask, 'RGB').save(f'{cut}-mask.png')
    print(f'{index:02d} {name}: {frames} frames of {fw}x{fh}, key {key}, {leftover} key-coloured pixels left unpainted')
    return {'frameWidth': fw, 'frameHeight': fh, 'frames': frames, 'key': key, 'take': TAKES.get(index, 1)}, strip, mask


def main():
    only = next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--only=')), None)
    wanted = [int(n) for n in only.split(',')] if only else range(len(STYLES))
    manifest_path = f'{OUT}/staff.json'
    before = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    styles, cooks = before.get('styles', {}), before.get('cooks', {})
    for name in ([] if only else COOKS):
        built = build_cook(name)
        if built:
            cooks.update(built)
        else:
            print(f'{name}: no keyed takes, skipped')
    for index in wanted:
        built = build_style(index)
        if not built:
            print(f'{index:02d} {STYLES[index]}: no sheet, skipped')
            continue
        styles[STYLES[index]] = built[0]
    # Every built hairstyle's front pose, side by side in save order, with its mask under the same layout.
    names = [name for name in STYLES if name in styles]
    cell_w = max(styles[name]['frameWidth'] for name in names)
    cell_h = max(styles[name]['frameHeight'] for name in names)
    cols = 8
    rows = -(-len(names) // cols)
    fronts = np.zeros((rows * cell_h, cols * cell_w, 4), np.uint8)
    fronts_mask = np.zeros((rows * cell_h * 2, cols * cell_w, 3), np.uint8)
    for n, name in enumerate(names):
        entry = styles[name]
        fw, fh = entry['frameWidth'], entry['frameHeight']
        strip = np.asarray(Image.open(os.path.join(WORK, f'{name}-cream.png')).convert('RGBA'))
        mask = np.asarray(Image.open(os.path.join(WORK, f'{name}-mask.png')).convert('RGB'))
        # Standing on the cell's bottom edge, centred.
        x = (n % cols) * cell_w + (cell_w - fw) // 2
        y = (n // cols) * cell_h + cell_h - fh
        fronts[y:y + fh, x:x + fw] = strip[:, FRONT * fw:(FRONT + 1) * fw]
        fronts_mask[y:y + fh, x:x + fw] = mask[:fh, FRONT * fw:(FRONT + 1) * fw]
        fronts_mask[rows * cell_h + y:rows * cell_h + y + fh, x:x + fw] = mask[fh:, FRONT * fw:(FRONT + 1) * fw]
        entry['front'] = n
    Image.fromarray(fronts, 'RGBA').save(f'{OUT}/fronts.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
    Image.fromarray(fronts_mask, 'RGB').save(f'{OUT}/fronts-mask.webp', 'WEBP', quality=90, method=6)
    manifest = {
        'order': STYLES,
        'fronts': {'cellWidth': cell_w, 'cellHeight': cell_h, 'cols': cols, 'rows': rows},
        'styles': {name: styles[name] for name in names},
        'cooks': cooks,
    }
    with open(manifest_path, 'w') as f:
        f.write(json.dumps(manifest, indent=1).replace('[\n    ', '[').replace(',\n    ', ', ').replace('\n   ]', ']') + '\n')
    print(f'{len(names)} of {len(STYLES)} hairstyles in {OUT}')


if __name__ == '__main__':
    main()
