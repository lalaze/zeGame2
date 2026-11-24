#!/usr/bin/env python3
"""Cut the cat sheets of assets/generated/floor-sample-v1 into what the floors view draws.

    uv run --with pillow --with numpy --with scipy python scripts/art-gen/floor-cats-build.py

The takes (kits/cats/<name>/take-N/sheet.png, in the art library; prompts in prompts/cats/) are:
- one sheet per breed of the game's cats (CATS in src/game/pets.ts): 4 columns by 2 rows on
  transparency, a 4-frame walk to the right, then sitting, sitting happy, asleep and washing
  (prompts/cats/common.txt followed by the breed's own description);
- gifts: 3 by 2, the things cats leave on the sill (GIFT_KINDS in src/game/cat-gifts.ts);
- roof-clear: the middle of the roof terrace repainted without the two cats painted into its plate
  (kits/cats/roof-clear/input.png is that part of build/frame/attic.webp, see ROOF_CROP).

Writes, under build/cats:
- <breed>.webp: one row of 8 equal frames, every figure at one scale so the sitting cat is about
  SIT_HEIGHT pixels tall (knee-high to the people of build/sheets.json), standing on the bottom
  edge and centred on its head and back;
- <breed>-face.webp: the sitting cat on a FACE-pixel square, for the pet panel;
- gift-<kind>.webp: each gift on a GIFT-pixel square;
- roof-clear-<n>.webp: the patches that paint the terrace's two cats away, feathered at their edges;
- cats.json: the frame order, each breed's frame size, the gift kinds and where the patches go.
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# Takes live in the art library at the same paths (assets/ART-LIBRARY.md); a copy here wins, as
# with librarySource() in scripts/art-files.mjs.
LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/cats'
REVIEW = os.path.join(LIBRARY, P, 'review/cats')
# The cells of a breed's sheet, in reading order.
FRAMES = ['walk0', 'walk1', 'walk2', 'walk3', 'sit', 'happy', 'sleep', 'groom']
# breed: (take, size). Size 1 is a house cat; the sitting pose is SIT_HEIGHT * size pixels tall.
CATS = {
    'ginger': (1, 1.0), 'tuxedo': (1, 1.0), 'calico': (1, 1.0), 'tabby': (1, 1.0), 'black': (1, 1.0), 'white': (1, 1.0),
    'british': (1, 1.04), 'american': (1, 1.0), 'siamese': (1, 1.0), 'ragdoll': (1, 1.08), 'persian': (1, 1.04), 'mainecoon': (1, 1.14),
}
SIT_HEIGHT = 96
FACE = 192
GIFTS = (1, ['leaf', 'yarn', 'feather', 'ribbon', 'acorn', 'coin'])
GIFT = 128
# Square side as a share of the object's longer side: a little room all round.
MARGIN = 1.1
# The part of build/frame/attic.webp the roof-clear take repaints [left, top, right, bottom], and the
# rows of that picture above the terrace's plate (FLOOR_ART.roof.above in floors-layout.ts).
ROOF_CROP = (410, 670, 1160, 1170)
ROOF_ABOVE = 427
ROOF_TAKE = 1
# Where the two painted cats are in that crop: the one on the wall, the one on the cushion.
ROOF_CATS = [(186, 10, 344, 156), (254, 316, 510, 498)]
# The patches fade in over this many pixels, and the repaint may sit this far off the plate.
FEATHER, DRIFT = 16, 8


def clean(sheet):
    """The sheet with only its figures: stray specks go, and so does any haze away from the paint."""
    alpha = sheet[..., 3]
    labels, count = ndimage.label(alpha > 40, structure=np.ones((3, 3)))
    if not count:
        return sheet
    areas = ndimage.sum(np.ones_like(alpha), labels, range(1, count + 1))
    # A figure is far larger than a speck: keep what is at least a fiftieth of the biggest.
    keep = np.isin(labels, 1 + np.where(areas >= areas.max() / 50)[0])
    near = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    out = sheet.copy()
    out[..., 3] = np.where(near, alpha, 0)
    return out


def seams(profile, parts):
    """Cut positions: the middle of the widest empty run near each expected boundary."""
    edges = [0]
    for n in range(1, parts):
        lo, hi = round(len(profile) * (n - .35) / parts), round(len(profile) * (n + .35) / parts)
        window = profile[lo:hi]
        low = window.min()
        runs, start = [], None
        for i, v in enumerate(window):
            if v == low and start is None:
                start = i
            if v != low and start is not None:
                runs.append((start, i))
                start = None
        if start is not None:
            runs.append((start, len(window)))
        a, b = max(runs, key=lambda r: r[1] - r[0])
        edges.append(lo + (a + b) // 2)
    return edges + [len(profile)]


def cells(sheet, cols, rows):
    """The trimmed figures of a cleaned sheet of cols x rows, row by row."""
    solid = sheet[..., 3] > 128
    ys = seams(solid.sum(axis=1), rows)
    out = []
    for r in range(rows):
        band = solid[ys[r]:ys[r + 1]]
        xs = seams(band.sum(axis=0), cols)
        for c in range(cols):
            part = sheet[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
            ink = part[..., 3] > 0
            ink_rows, ink_cols = np.where(ink.any(axis=1))[0], np.where(ink.any(axis=0))[0]
            if not len(ink_rows):
                raise SystemExit(f'empty cell {r},{c}')
            out.append(Image.fromarray(part[ink_rows[0]:ink_rows[-1] + 1, ink_cols[0]:ink_cols[-1] + 1].copy(), 'RGBA'))
    return out


def anchor(image):
    """Where the figure is centred: the middle of its head and back (the paint of its upper 60%)."""
    alpha = np.asarray(image)[..., 3][:max(1, round(image.height * .6))] > 128
    xs = np.where(alpha.any(axis=0))[0]
    return alpha.sum(axis=0).dot(np.arange(image.width)) / max(1, alpha.sum()) if len(xs) else image.width / 2


def square(image, side):
    """The image centred on a transparent square, scaled to `side` pixels."""
    room = round(max(image.size) * MARGIN)
    canvas = Image.new('RGBA', (room, room))
    canvas.alpha_composite(image, ((room - image.width) // 2, (room - image.height) // 2))
    return canvas.resize((side, side), Image.LANCZOS)


def save(image, path):
    image.save(path, 'WEBP', quality=92, alpha_quality=100, method=6)


def build_cat(breed, take, size):
    sheet = clean(np.asarray(Image.open(source(f'{P}/kits/cats/{breed}/take-{take}/sheet.png')).convert('RGBA')))
    figures = cells(sheet, 4, 2)
    sit = figures[FRAMES.index('sit')]
    scale = SIT_HEIGHT * size / sit.height
    scaled = [f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS) for f in figures]
    # The walk shares one centre (the legs swing under a still body); so do the poses that swap in place.
    centres = [anchor(f) for f in scaled]
    half = int(np.ceil(max(max(c, f.width - c) for c, f in zip(centres, scaled)))) + 2
    width, height = 2 * half, max(f.height for f in scaled) + 2
    strip = Image.new('RGBA', (width * len(scaled), height))
    for i, (figure, centre) in enumerate(zip(scaled, centres)):
        strip.alpha_composite(figure, (i * width + round(half - centre), height - figure.height))
    save(strip, f'{OUT}/{breed}.webp')
    save(square(sit, FACE), f'{OUT}/{breed}-face.webp')
    return {'frameWidth': width, 'frameHeight': height, 'take': take}, strip


def roof_patches():
    """The repainted terrace where its two cats were, each moved to match the plate around it."""
    folder = f'{P}/kits/cats/roof-clear'
    if not os.path.exists(source(f'{folder}/take-{ROOF_TAKE}/sheet.png')):
        print('roof-clear missing, skipped')
        return []
    plate = Image.open(source(f'{folder}/input.png')).convert('RGB')
    take = Image.open(source(f'{folder}/take-{ROOF_TAKE}/sheet.png')).convert('RGB').resize(plate.size, Image.LANCZOS)
    a, b = np.asarray(plate).astype(np.float32), np.asarray(take).astype(np.float32)
    patches = []
    for n, (x0, y0, x1, y1) in enumerate(ROOF_CATS):
        w, h = x1 - x0, y1 - y0
        # How far in from the patch's edge each pixel is: 0 on the edge, 1 from FEATHER pixels in.
        yy, xx = np.mgrid[0:h, 0:w]
        inset = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)).astype(np.float32)
        ring = inset < FEATHER
        best = None
        for dy in range(-DRIFT, DRIFT + 1):
            for dx in range(-DRIFT, DRIFT + 1):
                if x0 + dx < 0 or y0 + dy < 0 or x1 + dx > take.width or y1 + dy > take.height:
                    continue
                error = np.abs(b[y0 + dy:y1 + dy, x0 + dx:x1 + dx] - a[y0:y1, x0:x1])[ring].mean()
                if best is None or error < best[0]:
                    best = (error, dx, dy)
        error, dx, dy = best
        alpha = np.clip(inset / FEATHER, 0, 1)
        alpha = alpha * alpha * (3 - 2 * alpha)
        patch = np.dstack([b[y0 + dy:y1 + dy, x0 + dx:x1 + dx], alpha * 255]).astype(np.uint8)
        name = f'roof-clear-{n}.webp'
        save(Image.fromarray(patch, 'RGBA'), f'{OUT}/{name}')
        patches.append({'file': name, 'x': ROOF_CROP[0] + x0, 'y': ROOF_CROP[1] + y0 - ROOF_ABOVE})
        print(name, 'moved', (dx, dy), 'edge error', round(float(error), 1))
    return patches


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(REVIEW, exist_ok=True)
    index = {'frames': FRAMES, 'sitHeight': SIT_HEIGHT, 'cats': {}, 'gifts': []}
    strips = []
    for breed, (take, size) in CATS.items():
        if not os.path.exists(source(f'{P}/kits/cats/{breed}/take-{take}/sheet.png')):
            print(breed, 'missing, skipped')
            continue
        index['cats'][breed], strip = build_cat(breed, take, size)
        strips.append(strip)
        print(breed, 'take', take, index['cats'][breed])
    take, kinds = GIFTS
    gifts = source(f'{P}/kits/cats/gifts/take-{take}/sheet.png')
    icons = []
    if os.path.exists(gifts):
        for kind, piece in zip(kinds, cells(clean(np.asarray(Image.open(gifts).convert('RGBA'))), 3, 2)):
            icon = square(piece, GIFT)
            save(icon, f'{OUT}/gift-{kind}.webp')
            icons.append(icon)
            index['gifts'].append(kind)
        print('gifts take', take, index['gifts'])
    index['roof'] = roof_patches()
    with open(f'{OUT}/cats.json', 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')
    # A contact sheet of everything built, on the café's cream, for review (art library).
    if strips:
        sheet = Image.new('RGBA', (max(s.width for s in strips) + 20, sum(s.height + 12 for s in strips) + GIFT + 30), (247, 238, 222, 255))
        y = 10
        for strip in strips:
            sheet.alpha_composite(strip, (10, y))
            y += strip.height + 12
        for i, icon in enumerate(icons):
            sheet.alpha_composite(icon, (10 + i * (GIFT + 10), y))
        sheet.convert('RGB').save(f'{REVIEW}/contact.png')
    print(len(index['cats']), 'cats,', len(index['gifts']), 'gifts')


if __name__ == '__main__':
    main()
