#!/usr/bin/env python3
"""Ledger thumbnails for the floors view's decor options, cut from the floors' own decor layers.

    uv run --with pillow python scripts/art-gen/floor-thumbs-build.py

Each option is drawn into its floor (build/decor, layered as the floors view stacks them, with the
starting choice in every other slot) and cropped around that slot, so the Decor tab shows the
option where it sits in the café. A "none" option shows the same spot empty. Furniture needs no
thumbnails: the ledger shows build/furniture/<id>.webp itself.

Writes build/thumbs/<option id>.webp and build/thumbs/thumbs.json (the ids written).
"""
import json
import os

from PIL import Image

BUILD = 'assets/generated/floor-sample-v1/build'
OUT = f'{BUILD}/thumbs'
# Back to front, as BACK_LAYERS and FRONT_LAYERS in src/render/floors/floors-scene.ts.
BACK = ['shell', 'wallpaper', 'floor', 'rug', 'shadow', 'fixtures', 'tablecloth', 'centerpiece', 'neon', 'sill', 'curtain', 'ceiling']
FRONT = ['counter', 'fixtures-front']
# The new café's choices (createInitialState); the other slots show these.
START = {
    'wallpaper': 'wall_cream', 'floor': 'floor_planks', 'counter': 'counter_oak', 'tablecloth': 'tablecloth_classic',
    'centerpiece': 'centerpiece_flowers', 'curtain': 'curtain_classic',
}
# Which floor shows each slot, and the crop around it in plate pixels [left, top, right, bottom],
# all 3:2 like the ledger's picture frame.
CROPS = {
    'wallpaper': ('1f', (210, 20, 682, 335)),
    'floor': ('1f', (0, 590, 428, 875)),
    'rug': ('1f', (500, 290, 1160, 730)),
    'counter': ('1f', (440, 150, 1120, 603)),
    'tablecloth': ('1f', (400, 560, 745, 790)),
    'centerpiece': ('1f', (465, 575, 675, 715)),
    'ceiling': ('1f', (590, 0, 1090, 333)),
    'neon': ('1f', (720, 130, 960, 290)),
    'curtain': ('2f', (40, 60, 460, 340)),
    'sill': ('2f', (60, 320, 420, 560)),
}
LONG_SIDE = 240


def main():
    decor = json.load(open(f'{BUILD}/decor/decor.json'))
    game = open('src/game/decor.ts').read()
    os.makedirs(OUT, exist_ok=True)
    layers = {}

    def layer(path):
        if path not in layers:
            layers[path] = Image.open(f'{BUILD}/{path}').convert('RGBA')
        return layers[path]

    written = []
    for slot, (floor, box) in CROPS.items():
        entry = decor[floor]
        options = [i for i in entry['slots'][slot]] + [f'{slot}_none' if f"'{slot}_none'" in game else None]
        for option in filter(None, options):
            picked = {**START, slot: option}

            def pick(name):
                if name in ('shell', 'shadow', 'fixtures', 'fixtures-front'):
                    return f'decor/{floor}/{name}.webp'
                return entry['slots'].get(name, {}).get(picked.get(name))

            image = layer(pick('shell')).copy()
            for name in BACK[1:] + FRONT:
                path = pick(name)
                if path and os.path.exists(f'{BUILD}/{path}'):
                    image.alpha_composite(layer(path))
            thumb = image.crop(box)
            scale = LONG_SIDE / max(thumb.size)
            thumb = thumb.resize((round(thumb.width * scale), round(thumb.height * scale)), Image.LANCZOS)
            thumb.convert('RGB').save(f'{OUT}/{option}.webp', 'WEBP', quality=88, method=6)
            written.append(option)
    with open(f'{OUT}/thumbs.json', 'w') as f:
        json.dump(sorted(written), f, indent=1)
        f.write('\n')
    print(len(written), 'thumbnails')


if __name__ == '__main__':
    main()
