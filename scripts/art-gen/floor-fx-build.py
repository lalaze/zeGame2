#!/usr/bin/env python3
"""Build the small props and effects of the floors view from assets/generated/floor-sample-v1.

    uv run --with pillow --with numpy python scripts/art-gen/floor-fx-build.py [--inputs]

Reads the fx sheets (kits/fx/<sheet>/take-N/sheet.png, prompts in prompts/fx/): 4 by 2 separate
objects on transparency, in the order SHEETS names them, each scaled so its longer side is the
size given (pixels of the building, where a guest is about 190 tall). Writes

  build/fx/fx.webp, fx.json        every prop and effect in one atlas (Phaser's JSON hash)
  build/fx/items.webp, items.json  every menu picture of build/icons (item-*, sig-*) at ITEM
                                   pixels, for tables, trays, bubbles and the display case
  build/fx/case-empty.webp         the ground floor's cake display with bare shelves, cut from
                                   kits/fx/case-empty and fitted over the one on the plate (CASE)

--inputs writes kits/fx/case-empty/input.png, the display on magenta that its take repaints.
"""
import importlib.util
import json
import os
import sys

sys.dont_write_bytecode = True

import numpy as np
from PIL import Image, ImageFilter

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


# The furniture build's sheet cutter.
spec = importlib.util.spec_from_file_location('furniture', os.path.join(os.path.dirname(__file__), 'floor-furniture-build.py'))
furniture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(furniture)

P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/fx'
# sheet: (take, columns, rows, [(name, longer side in building pixels), ...] in reading order)
SHEETS = {
    'bubbles': (1, 4, 2, [('bubble', 156), ('thought', 176), ('bubble-wide', 250), ('heart', 72), ('rain', 92), ('bang', 96), ('cross', 96), ('hourglass', 92)]),
    'effects': (1, 4, 2, [('sparkle', 64), ('puff', 72), ('coin', 60), ('tip', 92), ('bell', 80), ('crown', 62), ('drop', 46), ('bread', 76)]),
    'cues': (1, 4, 2, [('cue-recommend', 92), ('cue-greet', 92), ('cue-cat', 92), ('cue-photo', 92), ('cue-delivery', 92), ('tent', 52), ('plate', 66), ('tray', 118)]),
    'tableware': (1, 4, 2, [('takeaway', 60), ('bag', 70), ('cup', 56), ('dough', 96), ('baked', 96), ('stand', 100), ('tray-cups', 112), ('jar', 70)]),
}
# Menu pictures are cut down once here, so the game never scales a 160 pixel icon to a table.
ITEM = 72
ITEM_COLUMNS = 10
PAD = 2
# The cake display on the ground floor's front fixtures (build/decor/1f/fixtures-front.webp, layer
# pixels): the box its take repaints, and inside it the glass the empty shelves are kept from.
CASE = {'box': (1066, 262, 1346, 522), 'scale': 4, 'take': 1}


def fit(image, side):
    scale = side / max(image.size)
    return image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)


def pack(pieces, width=1024):
    """Shelf-packs named images into one atlas; returns it and Phaser's JSON hash of the frames."""
    x = y = shelf = 0
    places = {}
    for name, image in pieces:
        if x + image.width + PAD > width:
            x, y, shelf = 0, y + shelf + PAD, 0
        places[name] = (x, y)
        x += image.width + PAD
        shelf = max(shelf, image.height)
    atlas = Image.new('RGBA', (width, y + shelf))
    frames = {}
    for name, image in pieces:
        atlas.alpha_composite(image, places[name])
        frames[name] = {'frame': {'x': places[name][0], 'y': places[name][1], 'w': image.width, 'h': image.height}}
    return atlas, {'frames': frames, 'meta': {'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}}


def save(atlas, frames, name):
    atlas.save(f'{OUT}/{name}.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
    frames['meta']['image'] = f'{name}.webp'
    with open(f'{OUT}/{name}.json', 'w') as f:
        json.dump(frames, f, indent=1)
        f.write('\n')


def fx():
    pieces = []
    for sheet_name, (take, cols, rows, names) in SHEETS.items():
        path = source(f'{P}/kits/fx/{sheet_name}/take-{take}/sheet.png')
        cut = furniture.cells(np.asarray(Image.open(path).convert('RGBA')), cols, rows)
        for (name, side), piece in zip(names, cut):
            if piece is None:
                raise SystemExit(f'{sheet_name}: no object for {name}')
            pieces.append((name, fit(Image.fromarray(piece, 'RGBA'), side)))
        print(sheet_name, 'take', take, len(names))
    atlas, frames = pack(pieces, 768)
    save(atlas, frames, 'fx')
    print(len(pieces), 'fx frames', atlas.size)


def items():
    with open(f'{P}/build/icons/icons.json') as f:
        keys = [key for key in json.load(f) if key.startswith(('item:', 'sig:'))]
    cell = ITEM + PAD
    atlas = Image.new('RGBA', (ITEM_COLUMNS * cell, -(-len(keys) // ITEM_COLUMNS) * cell))
    frames = {}
    for k, key in enumerate(keys):
        name = key.replace(':', '-')
        icon = Image.open(f'{P}/build/icons/{name}.webp').convert('RGBA')
        # Trim the icon's margin, so every picture stands on the bottom of its frame.
        icon = icon.crop(icon.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox())
        icon = fit(icon, ITEM)
        x, y = (k % ITEM_COLUMNS) * cell, (k // ITEM_COLUMNS) * cell
        atlas.alpha_composite(icon, (x, y))
        frames[name] = {'frame': {'x': x, 'y': y, 'w': icon.width, 'h': icon.height}}
    save(atlas, {'frames': frames, 'meta': {'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}}, 'items')
    print(len(keys), 'menu pictures', atlas.size)


def case_input():
    left, top, right, bottom = CASE['box']
    layer = Image.open(f'{P}/build/decor/1f/fixtures-front.webp').convert('RGBA').crop(CASE['box'])
    # Only the display: what else the layer holds inside the box (the counter's end) goes magenta too.
    alpha = np.asarray(layer.getchannel('A')) > 128
    card = Image.new('RGBA', layer.size, (255, 0, 255, 255))
    card.paste(layer, (0, 0), Image.fromarray((alpha * 255).astype(np.uint8)))
    path = os.path.join(LIBRARY, f'{P}/kits/fx/case-empty/input.png')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    card.convert('RGB').resize((layer.width * CASE['scale'], layer.height * CASE['scale']), Image.LANCZOS).save(path)
    print('wrote', path)


def case():
    """The repainted empty display, laid over the plate's: its glass and shelves, inside the frame."""
    path = source(f"{P}/kits/fx/case-empty/take-{CASE['take']}/case.png")
    if not os.path.exists(path):
        print('case-empty missing, skipped')
        return
    left, top, right, bottom = CASE['box']
    size = (right - left, bottom - top)
    plate = Image.open(f'{P}/build/decor/1f/fixtures-front.webp').convert('RGBA').crop(CASE['box'])
    take = Image.open(path).convert('RGB')
    paint = np.asarray(take).astype(np.float32)
    painted = (np.minimum(paint[..., 0], paint[..., 2]) - paint[..., 1]) < 90
    opaque = np.asarray(plate.getchannel('A')) > 128

    def base(mask):
        """Left, right and bottom of the wooden base: the lowest third, where only the display is."""
        low = mask[mask.shape[0] * 2 // 3:]
        cols, rows = np.where(low.sum(axis=0) > low.shape[0] * .3)[0], np.where(mask.sum(axis=1) > mask.shape[1] * .3)[0]
        return cols[0], cols[-1] + 1, rows[-1] + 1

    # Fit the repaint onto the plate's display by their bases: one scale, bottoms and sides together.
    (pl, pr, pb), (tl, tr, tb) = base(opaque), base(painted)
    scale = (pr - pl) / (tr - tl)
    small = take.resize((round(take.width * scale), round(take.height * scale)), Image.LANCZOS)
    fitted = plate.convert('RGB')
    fitted.paste(small, (round(pl - tl * scale), round(pb - tb * scale)))
    # Keep the repaint inside the glass, where it is paint and not its magenta ground, feathered.
    paint = np.asarray(fitted).astype(np.float32)
    painted = Image.fromarray((((np.minimum(paint[..., 0], paint[..., 2]) - paint[..., 1]) < 60) & opaque).astype(np.uint8) * 255)
    glass = Image.new('L', size, 0)
    glass.paste(255, CASE_GLASS)
    mask = np.minimum(np.asarray(painted.filter(ImageFilter.MinFilter(7))), np.asarray(glass))
    mask = np.asarray(Image.fromarray(mask).filter(ImageFilter.GaussianBlur(1.5)))
    out = fitted.convert('RGBA')
    out.putalpha(Image.fromarray(mask))
    out.save(f'{OUT}/case-empty.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
    print('case-empty', size, 'covers', round(float((mask > 128).mean()), 3))


# Inside the display's frame, in its box: the patch never touches the frame or the wooden base.
CASE_GLASS = (22, 22, 258, 196)


def main():
    os.makedirs(OUT, exist_ok=True)
    if '--inputs' in sys.argv:
        case_input()
        return
    fx()
    items()
    case()


if __name__ == '__main__':
    main()
