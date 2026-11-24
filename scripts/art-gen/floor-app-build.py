#!/usr/bin/env python3
"""Build the app's face in the cross-section style: its icon and the loading screen's picture.

    uv run --with pillow --with numpy python scripts/art-gen/floor-app-build.py

The takes (kits/app/<piece>/take-N in the art library, prompts in prompts/app/) are:
- icon-a to icon-i: candidate icons, each a full square with its subject in the middle. The user
  turned down the first three (a the cup under the awning, b the café cut open, c the shop window at
  dusk); the second round is d the owner with a cup, e the ginger cat in a cup, f cat latte art from
  above, g a coffee-bean mascot, h the café as a toy house, i a cup with a roof. ICON names the one
  in use: d, which the user picked "for now" on 2026-11-24 (not a final choice).
- loading: the café from the street in the morning, fading out into paper.

Writes build/app/: the icon as the installed app needs it (rounded for `any`, full square for
`maskable` and for iOS, a small one for the browser tab), `loading.webp` with its edges faded to
nothing so it sits on any paper, `manifest.webmanifest` ready to replace public/manifest.webmanifest,
and app.json (what is here). Nothing under public/ changes: see the pack's README for the switch.
With --review it also writes the candidates' contact sheet to the library's review/sky folder.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/app'
CANDIDATES = ('icon-a', 'icon-b', 'icon-c', 'icon-d', 'icon-e', 'icon-f', 'icon-g', 'icon-h', 'icon-i')
# The candidate in use until the user chooses, and the take of each piece.
ICON = 'icon-d'
TAKES = {}
# Corner radius of the rounded icon, as a share of its side.
ROUND = .22
LOADING_SIZE = 720
# The loading picture fades to nothing between these shares of the way from its middle to its edge.
FADE = (.78, .98)
# The paper journal's colours (src/ui/floors-ui.css): the page and its ink.
PAPER, INK = '#fbf3e4', '#4f3b2f'


def take(piece, name):
    return source(f'{P}/kits/app/{piece}/take-{TAKES.get(piece, 1)}/{name}.png')


def rounded(image, size):
    """The icon at a size, with rounded corners cut out of it (drawn large, then scaled, for a smooth edge)."""
    big = image.resize((size * 4, size * 4), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', big.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big.width - 1, big.height - 1), radius=round(big.width * ROUND), fill=255)
    big.putalpha(mask)
    return big.resize((size, size), Image.LANCZOS)


def icons():
    art = Image.open(take(ICON, 'icon')).convert('RGB')
    files = {}
    for size in (192, 512):
        rounded(art, size).save(f'{OUT}/icon-{size}.png', optimize=True)
        art.resize((size, size), Image.LANCZOS).save(f'{OUT}/icon-maskable-{size}.png', optimize=True)
        files[f'icon-{size}.png'] = files[f'icon-maskable-{size}.png'] = size
    art.resize((180, 180), Image.LANCZOS).save(f'{OUT}/apple-touch-icon.png', optimize=True)
    rounded(art, 64).save(f'{OUT}/favicon.png', optimize=True)
    files.update({'apple-touch-icon.png': 180, 'favicon.png': 64})
    return files


def loading():
    art = Image.open(take('loading', 'picture')).convert('RGB').resize((LOADING_SIZE, LOADING_SIZE), Image.LANCZOS)
    ys, xs = np.mgrid[0:LOADING_SIZE, 0:LOADING_SIZE]
    half = (LOADING_SIZE - 1) / 2
    # A rounded square's distance from the middle: 0 there, 1 on the edge.
    reach = (np.abs((xs - half) / half) ** 4 + np.abs((ys - half) / half) ** 4) ** .25
    alpha = 1 - np.clip((reach - FADE[0]) / (FADE[1] - FADE[0]), 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)
    rgba = np.dstack([np.asarray(art), (alpha * 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/loading.webp', 'WEBP', quality=90, alpha_quality=95, method=6)
    return {'loading.webp': LOADING_SIZE}


def manifest():
    """The installed app's manifest with the new face: the current one's fields, with these icons and paper colours."""
    current = json.load(open('public/manifest.webmanifest'))
    current.update({
        'description': 'A cozy café you can run on your coffee break: a little building, floor by floor.',
        'background_color': PAPER, 'theme_color': PAPER,
        'icons': [
            {'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
            {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
            {'src': 'icon-maskable-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'maskable'},
            {'src': 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ],
    })
    with open(f'{OUT}/manifest.webmanifest', 'w') as f:
        json.dump(current, f, indent=2, ensure_ascii=False)
        f.write('\n')


def review():
    """The candidates painted so far as a phone shows them: rounded and in a circle, down to 48 pixels."""
    sizes, pad, label = (256, 128, 96, 64, 48), 28, 34
    row = sum(sizes) + pad * (len(sizes) + 1)
    painted = [piece for piece in CANDIDATES if os.path.exists(take(piece, 'icon'))]
    sheet = Image.new('RGB', (row, (2 * 256 + pad * 3 + label) * len(painted)), PAPER)
    draw = ImageDraw.Draw(sheet)
    for n, piece in enumerate(painted):
        art = Image.open(take(piece, 'icon')).convert('RGB')
        top = n * (2 * 256 + pad * 3 + label)
        draw.text((pad, top + 8), f"{piece}{'  (in build/app until the user chooses)' if piece == ICON else ''}", fill=INK)
        x = pad
        for size in sizes:
            sheet.paste(rounded(art, size), (x, top + label + pad + (256 - size)), rounded(art, size))
            circle = art.resize((size * 4, size * 4), Image.LANCZOS).convert('RGBA')
            mask = Image.new('L', circle.size, 0)
            ImageDraw.Draw(mask).ellipse((0, 0, circle.width - 1, circle.height - 1), fill=255)
            circle.putalpha(mask)
            circle = circle.resize((size, size), Image.LANCZOS)
            sheet.paste(circle, (x, top + label + pad * 2 + 256 + (256 - size)), circle)
            x += size + pad
    out = os.path.join(LIBRARY, P, 'review/sky')
    os.makedirs(out, exist_ok=True)
    sheet.save(f'{out}/icon-candidates.png')
    print('review', f'{out}/icon-candidates.png')


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {**icons(), **loading()}
    manifest()
    with open(f'{OUT}/app.json', 'w') as f:
        json.dump({'icon': ICON, 'candidates': list(CANDIDATES), 'chosen': False, 'paper': PAPER, 'files': files}, f, indent=1)
        f.write('\n')
    print(ICON, files)
    if '--review' in sys.argv:
        review()


if __name__ == '__main__':
    main()
