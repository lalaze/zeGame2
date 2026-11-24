#!/usr/bin/env python3
"""Build what the floors view draws for the time of day and the weather (src/render/floors/floors-sky.ts).

    uv run --with pillow --with numpy python scripts/art-gen/floor-sky-build.py

The takes (kits/sky/<piece>/take-N/sheet.png in the art library, prompts in prompts/sky/) are:
- clear, dusk, night, overcast: the day sky (kits/frame/sky) repainted without its clouds or in
  another light, house for house, so the game can cross-fade them. They are cut to the day sky's size; their top rows run out into one
  flat colour, which the game continues upward (`top` in sky.json).
- clouds: six clouds on magenta, 2 columns by 3 rows.
- bits: twelve small pieces on magenta, 4 columns by 3 rows, in the order of BITS: moon, sun, star,
  raindrop and splash, snowflakes, autumn leaves, balloons and a bird.

From the building's own pictures (build/frame) it also makes:
- glow-wall-*: the light in the windows of each front wall, from the wall's glass;
- shade-attic: where night falls on the top floor's picture: all of it on the roof and the chimney,
  less under the roof, where the terrace's lamps are.

Writes build/sky/*.webp, sprites.json (a Phaser atlas of the clouds and bits) and sky.json.
"""
import importlib.util
import json
import os
import sys

# Importing the furniture build below must not leave a __pycache__ in scripts/.
sys.dont_write_bytecode = True

import numpy as np
from PIL import Image, ImageFilter

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


# The furniture build's sheet cutter: emptiest-line seams between the cells.
spec = importlib.util.spec_from_file_location('furniture', os.path.join(os.path.dirname(__file__), 'floor-furniture-build.py'))
furniture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(furniture)

P = 'assets/generated/floor-sample-v1'
FRAME = f'{P}/build/frame'
OUT = f'{P}/build/sky'
# The take each piece uses.
TAKES = {}
SKIES = ('clear', 'dusk', 'night', 'overcast')
# Rows at the top of a sky that run out into its flat top colour.
TOP_FADE = 70
CLOUDS = 6
# The bits sheet in reading order, and the height each is drawn at in the building's pixels.
BITS = [('moon', 190), ('sun', 230), ('star', 56), ('drop', 84), ('splash', 44), ('flake-1', 44), ('flake-2', 26),
        ('leaf-1', 58), ('leaf-2', 44), ('balloon-1', 170), ('balloon-2', 170), ('bird', 70)]
# Clouds keep the size they were painted at, times this: the day sky's own clouds are about this big.
CLOUD_SCALE = 1.0
# The light in a window: its colour, and how far its halo spreads (pixels of the half-size picture).
WINDOW_LIGHT, HALO = (255, 214, 150), 14
# The top floor's picture: its roof line runs from the ridge to the eaves; night falls fully above
# ROOF_DEPTH below that line (tiles, barge boards, chimney) and UNDER_ROOF as much under the roof.
RIDGE, EAVE_Y, ROOF_DEPTH, ROOF_SOFT, UNDER_ROOF = (836, 10), 545, 118, 46, .42
PAD = 2


def take(piece):
    return source(f'{P}/kits/sky/{piece}/take-{TAKES.get(piece, 1)}/sheet.png')


def hexa(rgb):
    return '#%02x%02x%02x' % tuple(int(round(c)) for c in rgb)


def sky(piece, size):
    image = Image.open(take(piece)).convert('RGB').resize(size, Image.LANCZOS)
    a = np.asarray(image).astype(np.float32)
    top = a[:6].reshape(-1, 3).mean(axis=0)
    share = np.clip(np.arange(a.shape[0]) / TOP_FADE, 0, 1)[:, None, None]
    a = top + (a - top) * share
    Image.fromarray(a.astype(np.uint8), 'RGB').save(f'{OUT}/{piece}.webp', 'WEBP', quality=88, method=6)
    return {'image': f'sky/{piece}', 'top': hexa(top)}


def unmix(image):
    """RGBA from a painting on flat magenta: how much magenta shows in each pixel is taken back out
    of it, so soft pale edges (clouds, snow) keep their own colour instead of a pink rim."""
    a = image.astype(np.float32)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    back = np.median(border, axis=0)
    span = min(back[0], back[2]) - back[1]
    showing = np.clip((np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) / span, 0, 1)
    alpha = np.clip((1 - showing - .06) / .86, 0, 1)
    rgb = (a - (1 - alpha[..., None]) * back) / np.maximum(alpha[..., None], .05)
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)


def pieces(piece, cols, rows):
    cut = furniture.cells(unmix(np.asarray(Image.open(take(piece)).convert('RGB'))), cols, rows)
    if any(c is None for c in cut):
        raise SystemExit(f'{piece}: an empty cell')
    return [Image.fromarray(c, 'RGBA') for c in cut]


def atlas():
    """Clouds and bits packed in rows into one picture, with a Phaser atlas beside it."""
    sprites = []
    for i, image in enumerate(pieces('clouds', 2, 3)):
        size = (round(image.width * CLOUD_SCALE), round(image.height * CLOUD_SCALE))
        sprites.append((f'cloud-{i + 1}', image.resize(size, Image.LANCZOS)))
    for (name, height), image in zip(BITS, pieces('bits', 4, 3)):
        sprites.append((name, image.resize((max(1, round(image.width * height / image.height)), height), Image.LANCZOS)))
    width, x, y, row, frames = 1536, PAD, PAD, 0, {}
    places = []
    for name, image in sorted(sprites, key=lambda s: -s[1].height):
        if x + image.width + PAD > width:
            x, y, row = PAD, y + row + PAD, 0
        places.append((name, image, x, y))
        x, row = x + image.width + PAD, max(row, image.height)
    sheet = Image.new('RGBA', (width, y + row + PAD))
    for name, image, x, y in places:
        sheet.alpha_composite(image, (x, y))
        frames[name] = {'frame': {'x': x, 'y': y, 'w': image.width, 'h': image.height}, 'rotated': False, 'trimmed': False,
                        'spriteSourceSize': {'x': 0, 'y': 0, 'w': image.width, 'h': image.height}, 'sourceSize': {'w': image.width, 'h': image.height}}
    sheet.save(f'{OUT}/sprites.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
    names = [name for name, _ in sprites]
    with open(f'{OUT}/sprites.json', 'w') as f:
        json.dump({'frames': {name: frames[name] for name in names}, 'meta': {'image': 'sprites.webp', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1'}}, f, indent=1)
        f.write('\n')
    return {name: [frames[name]['frame']['w'], frames[name]['frame']['h']] for name in names}


def window_glow(wall):
    """The light in a front wall's windows, at half size: the wall's glass, with a soft halo round it."""
    alpha = np.asarray(Image.open(f'{FRAME}/{wall}.webp').convert('RGBA'))[..., 3]
    glass = ((alpha > 20) & (alpha < 200)).astype(np.uint8) * 255
    small = Image.fromarray(glass).resize((alpha.shape[1] // 2, alpha.shape[0] // 2), Image.BILINEAR)
    inner = np.asarray(small.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
    halo = np.asarray(small.filter(ImageFilter.GaussianBlur(HALO))).astype(np.float32) / 255
    light = np.clip(inner * .55 + halo * .5, 0, 1)
    rgba = np.dstack([np.full(light.shape + (3,), WINDOW_LIGHT, np.float32), light * 255]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/glow-{wall}.webp', 'WEBP', quality=80, alpha_quality=90, method=6)
    return {'image': f'sky/glow-{wall}', 'width': int(small.width), 'height': int(small.height), 'scale': 2,
            'glass': round(float((glass > 0).mean()), 4)}


def attic_shade():
    """Where night falls on the top floor's picture, at half size: white, as opaque as the night is deep there."""
    alpha = np.asarray(Image.open(f'{FRAME}/attic.webp').convert('RGBA'))[..., 3].astype(np.float32) / 255
    h, w = alpha.shape
    ys, xs = np.mgrid[0:h, 0:w]
    roof = RIDGE[1] + np.abs(xs - RIDGE[0]) * (EAVE_Y - RIDGE[1]) / RIDGE[0]
    outside = 1 - np.clip((ys - roof - ROOF_DEPTH) / ROOF_SOFT, 0, 1)
    depth = (UNDER_ROOF + (1 - UNDER_ROOF) * outside) * alpha
    small = Image.fromarray((depth * 255).astype(np.uint8)).resize((w // 2, h // 2), Image.BILINEAR)
    rgba = np.dstack([np.full((small.height, small.width, 3), 255, np.uint8), np.asarray(small)])
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/shade-attic.webp', 'WEBP', quality=80, alpha_quality=90, method=6)
    return {'image': 'sky/shade-attic', 'width': int(small.width), 'height': int(small.height), 'scale': 2}


def main():
    os.makedirs(OUT, exist_ok=True)
    frame = json.load(open(f'{FRAME}/frame.json'))
    size = (frame['sky']['width'], frame['sky']['height'])
    manifest = {
        'width': size[0], 'height': size[1],
        'skies': {'day': {'image': 'frame/sky', 'top': frame['sky']['top']}, **{piece: sky(piece, size) for piece in SKIES}},
        'sprites': atlas(),
        'windows': {wall: window_glow(wall) for wall in ('wall-attic', 'wall-seating', 'wall-ground')},
        'shade': {'attic': attic_shade()},
    }
    with open(f'{OUT}/sky.json', 'w') as f:
        json.dump(manifest, f, indent=1)
        f.write('\n')
    print(json.dumps(manifest))


if __name__ == '__main__':
    main()
