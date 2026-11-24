#!/usr/bin/env python3
"""Build what upgrades change in the building: the espresso machine and the basement kitchen.

    uv run --with pillow --with numpy --with scipy python scripts/art-gen/floor-upgrades-build.py

The takes are in kits/upgrades (art library), prompts in prompts/upgrades/:
- machine/a-take-1: the machine at levels 5, 10 and 15, side by side on magenta (the user chose set A on
  2026-11-24). Each replaces the machine painted into the ground floor's fixtures (CLEAR).
- angle-plate-basement/take-2 (rows PLATE): the basement as it was drawn at first.
- kitchen/bare-take-1: the same without the things equipment takes the place of.
- kitchen/equipment-take-1: the basement fully fitted out; cabinets-take-1: the same without the two
  machines on its table, so the cabinets behind them are whole.
- kitchen/key-things-take-1, key-machines-take-1: what stands on the table, before and after, on magenta.
- kitchen/stage-1-take-1, stage-2-take-1: the basement before it is fully expanded; only the part right of
  the bell is used.
The kitchens are all repaints of one picture and lie on it to the pixel, so most pieces are cut out by where two
of them differ.

Writes build/upgrades/basement-bare.webp, pieces.webp (every piece, packed) and pieces.json (where each
is in it and where it goes: kitchen pieces on the basement's picture, machines on the fixtures layer).
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/upgrades'
# The machine in the fixtures layer (left, top, right, bottom) and where the new ones stand: their middle and foot, and their width.
CLEAR, MACHINE, MACHINE_WIDTH = (1086, 131, 1293, 277), (1191, 284), 190
# The rows of the basement's plate that are its picture, between the middles of its slabs.
PLATE = (30, 941)
# The part of the basement the stages change, and how softly its edges run out.
STAGE, STAGE_SOFT = (1124, 24, 1604, 774), 5
# Piece: the picture it is in, the one without it, and the box it is in.
CUTS = {
    'peels': ('base', 'bare', (462, 190, 552, 474)),
    'shelf-left': ('base', 'bare', (528, 108, 735, 356)),
    'shelf-right': ('base', 'bare', (735, 108, 872, 356)),
    'basket': ('base', 'bare', (220, 436, 366, 650)),
    'pot': ('base', 'bare', (50, 530, 200, 766)),
    'convection': ('cabinets', 'bare', (462, 160, 608, 490)),
    'proofer': ('cabinets', 'bare', (606, 120, 735, 452)),
    'pastryFridge': ('cabinets', 'bare', (732, 120, 872, 452)),
    'kettle': ('equipment', 'bare', (226, 400, 329, 664)),
    'fryer': ('equipment', 'bare', (329, 440, 448, 668)),
    'mixer': ('equipment', 'bare', (54, 520, 228, 774)),
}
# Right of x the peels go on behind the bowl's handle from row y, over `rows` rows (the rest of the bowl hides
# the remainder); a leaf of the trailing plant is in their box too.
PEELS_BOWL, LEAF = {'x': 506, 'right': 548, 'y': 402, 'rows': 23}, (524, 292)
# The far edge of the table, its left end, and how that end slants: cabinets stand behind it.
TABLE, SLANT = (493, 440), 40 / 84
# Pieces on magenta: the picture, and the box each is in.
KEYED = {
    'bowl': ('key-things', (470, 340, 640, 530)),
    'jars': ('key-things', (740, 340, 880, 480)),
    'sheeter': ('key-machines', (470, 400, 680, 545)),
    'standMixer': ('key-machines', (760, 330, 930, 510)),
}
PAD = 3


def key(image):
    a = np.asarray(image.convert('RGB')).astype(np.float32)
    showing = np.clip((np.minimum(a[..., 0], a[..., 2]) - a[..., 1] - 40) / 120, 0, 1)
    spill = np.clip(np.minimum(a[..., 0], a[..., 2]) - a[..., 1], 0, None) * (showing > .02)
    a[..., 0] -= spill * .6
    a[..., 2] -= spill * .6
    # Outlines are brown, not purple.
    rim = nd.binary_dilation(showing > .3, iterations=3)
    a[..., 2] = np.where(rim, np.minimum(a[..., 2], a[..., 1]), a[..., 2])
    a[..., 0] = np.where(rim, np.minimum(a[..., 0], a[..., 1] + 60), a[..., 0])
    return Image.fromarray(np.dstack([np.clip(a, 0, 255), (1 - showing) * 255]).astype(np.uint8), 'RGBA')


def trimmed(image, at=(0, 0)):
    box = image.split()[3].point(lambda v: 255 if v > 12 else 0).getbbox()
    return image.crop(box), (at[0] + box[0], at[1] + box[1])


def difference(front, back, box, threshold=20):
    """Where `front` shows something `back` does not, inside the box: filled, without specks, softly edged."""
    f, b = (np.asarray(i).astype(np.float32) for i in (front, back))
    x0, y0, x1, y1 = box
    inside = np.zeros(f.shape[:2], bool)
    inside[y0:y1, x0:x1] = True
    mask = (np.abs(nd.gaussian_filter(f, (1, 1, 0)) - nd.gaussian_filter(b, (1, 1, 0))).max(axis=2) > threshold) & inside
    mask = nd.binary_opening(nd.binary_fill_holes(nd.binary_closing(mask, iterations=3) & inside), iterations=2)
    labels, n = nd.label(mask)
    sizes = nd.sum(mask, labels, range(1, n + 1)) if n else []
    keep = [i + 1 for i, size in enumerate(sizes) if size > 250 and size > .02 * max(sizes)]
    return nd.gaussian_filter(nd.binary_dilation(np.isin(labels, keep)).astype(np.float32), 1)


def edges(a):
    g = np.asarray(a.convert('L')).astype(np.float32)
    return np.minimum(np.abs(np.diff(g, axis=1))[:-1] + np.abs(np.diff(g, axis=0))[:, :-1], 40)


def aligned(image, base):
    """The picture moved back onto the basement's where Codex shifted it by a pixel, over the floor in front."""
    rows = slice(690, 880)
    a, b = edges(base)[rows], edges(image)[rows]
    cross = np.fft.fft2(a - a.mean()) * np.conj(np.fft.fft2(b - b.mean()))
    peak = np.real(np.fft.ifft2(cross / (np.abs(cross) + 1e-6)))
    y, x = np.unravel_index(peak.argmax(), peak.shape)
    dy, dx = (int(v) if v < n / 2 else int(v) - n for v, n in zip((y, x), peak.shape))
    if max(abs(dx), abs(dy)) > 3:
        raise SystemExit(f'does not line up: {dx}, {dy}')
    moved = np.roll(np.asarray(image), (dy, dx), axis=(0, 1))
    return Image.fromarray(moved)


def machines():
    sheet = key(Image.open(source(f'{P}/kits/upgrades/machine/a-take-1/sheet.png')))
    solid = (np.asarray(sheet)[..., 3] > 60).any(axis=0)
    starts = [x for x in range(1, len(solid)) if solid[x] and not solid[x - 1]]
    runs = [(x, next((e for e in range(x, len(solid)) if not solid[e]), len(solid))) for x in starts]
    runs = [run for run in runs if run[1] - run[0] > 200]
    if len(runs) != 3:
        raise SystemExit(f'expected three machines, found {len(runs)}')
    for tier, (x0, x1) in enumerate(runs, 1):
        image, _ = trimmed(sheet.crop((x0, 0, x1, sheet.height)))
        image = image.resize((MACHINE_WIDTH, round(image.height * MACHINE_WIDTH / image.width)), Image.LANCZOS)
        yield f'machine-{tier}', image, (MACHINE[0] - MACHINE_WIDTH // 2, MACHINE[1] - image.height)


def kitchen():
    plate = Image.open(source(f'{P}/kits/angle-plate-basement/take-2/plate.png')).convert('RGB')
    base = plate.crop((0, PLATE[0], plate.width, PLATE[1]))
    take = lambda name: aligned(Image.open(source(f'{P}/kits/upgrades/kitchen/{name}-take-1/sheet.png')).convert('RGB').resize(base.size, Image.LANCZOS), base)
    pictures = {'base': base, **{name: take(name) for name in ('bare', 'equipment', 'cabinets', 'stage-1', 'stage-2')}}
    keyed = {name: key(Image.open(source(f'{P}/kits/upgrades/kitchen/{name}-take-1/sheet.png')).convert('RGB').resize(base.size, Image.LANCZOS)) for name in ('key-things', 'key-machines')}
    pieces = []
    for name, (front, back, box) in CUTS.items():
        alpha, picture = difference(pictures[front], pictures[back], box), np.asarray(pictures[front]).copy()
        if name == 'peels':
            x, right, y = PEELS_BOWL['x'], PEELS_BOWL['right'], PEELS_BOWL['y']
            for layer in (alpha, picture):
                layer[y:y + PEELS_BOWL['rows'], x:right] = layer[y - PEELS_BOWL['rows']:y, x:right][::-1]
            alpha[y + PEELS_BOWL['rows']:, x:] = 0
            alpha[:, right:] = 0
            alpha[:LEAF[1], LEAF[0]:] = 0
        if front == 'cabinets':
            rows, columns = np.mgrid[:base.height, :base.width]
            alpha[(rows >= TABLE[1]) & (columns > TABLE[0] - 1 - SLANT * (rows - TABLE[1]))] = 0
        image = Image.fromarray(np.dstack([picture, (alpha * 255).astype(np.uint8)]), 'RGBA')
        pieces.append((name, *trimmed(image)))
    for name, (picture, box) in KEYED.items():
        pieces.append((name, *trimmed(keyed[picture].crop(box), box[:2])))
    x0, y0, x1, y1 = STAGE
    inside = np.zeros((base.height, base.width), np.float32)
    inside[y0:y1, x0:x1] = 1
    soft = nd.gaussian_filter(inside, STAGE_SOFT)
    for stage in ('stage-1', 'stage-2'):
        image = Image.fromarray(np.dstack([np.asarray(pictures[stage]), (soft * 255).astype(np.uint8)]), 'RGBA')
        pieces.append((stage, *trimmed(image)))
    # The bare basement is the basement itself but where things were taken away.
    gone = np.zeros_like(inside)
    for name, (front, _, box) in CUTS.items():
        if front == 'base':
            gone[box[1]:box[3], box[0]:box[2]] = 1
    gone[345:500, 470:880] = 1
    share = nd.gaussian_filter(nd.binary_dilation(gone > 0, iterations=6).astype(np.float32), 4)[..., None]
    bare = np.asarray(base).astype(np.float32) * (1 - share) + np.asarray(pictures['bare']).astype(np.float32) * share
    return Image.fromarray(bare.astype(np.uint8), 'RGB'), pieces


def main():
    os.makedirs(OUT, exist_ok=True)
    bare, pieces = kitchen()
    bare.save(f'{OUT}/basement-bare.webp', 'WEBP', quality=90, method=6)
    pieces += list(machines())
    width, x, y, row, index = 1536, PAD, PAD, 0, {}
    placed = []
    for name, image, at in sorted(pieces, key=lambda p: -p[1].height):
        if x + image.width + PAD > width:
            x, y, row = PAD, y + row + PAD, 0
        placed.append((image, x, y))
        index[name] = {'x': x, 'y': y, 'w': image.width, 'h': image.height, 'at': [int(at[0]), int(at[1])]}
        x, row = x + image.width + PAD, max(row, image.height)
    sheet = Image.new('RGBA', (width, y + row + PAD))
    for image, x, y in placed:
        sheet.paste(image, (x, y))
    sheet.save(f'{OUT}/pieces.webp', 'WEBP', quality=90, method=6)
    with open(f'{OUT}/pieces.json', 'w') as f:
        json.dump({'kitchen': list(bare.size), 'clear': list(CLEAR), 'pieces': dict(sorted(index.items()))}, f, indent=1)
        f.write('\n')
    print(sheet.size, {name: p['at'] for name, p in index.items()})


main()
