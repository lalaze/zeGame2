#!/usr/bin/env python3
"""Cut the furniture sheets of assets/generated/floor-sample-v1 into one sprite per piece.

    uv run --with pillow --with numpy python scripts/art-gen/floor-furniture-build.py

Each sheet (kits/furniture/<sheet>/take-1/sheet.png) is 4 columns by 2 rows of separate objects
on transparency. Floor sheets start with a reference café chair: every piece of that sheet is scaled
so the chair is as tall as the ground floor's own chairs, which keeps all floor furniture to one
scale. Wall pieces keep their own size; the floors view fits each into its spot on the wall.

Writes build/furniture/<id>.webp and build/furniture/furniture.json (size and surface of each).
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter

# Takes live in the art library at the same paths (assets/ART-LIBRARY.md); a copy here wins, as
# with librarySource() in scripts/art-files.mjs.
LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/furniture'
# The ground floor's chairs, in plate pixels, are this tall.
CHAIR_HEIGHT = 223
SHEETS = {
    'floor-1': ['reference', 'plant_fern', 'plant_snake', 'aframe', 'plant_fig', 'lamp', 'coatrack', 'plant_monstera'],
    'floor-2': ['reference', 'bench', 'catbed', 'bookshelf', 'armchair', 'plant_lemon', 'gramophone', 'piano'],
    'floor-3': ['reference', 'plant_lavender', 'plant_succulent', 'vase_daisies', 'lantern', 'bean_display', 'sideboard', 'gingham_table'],
    'floor-4': ['reference', 'sofa', 'round_stool', 'display_cabinet', 'magazine_rack', 'coffee_cart', None, None],
    'wall-1': ['clock', 'chain_map', 'chain_plaque', 'mugrack', 'art_landscape', 'sconce', 'garland', 'shelf'],
    'wall-2': ['art_cat', 'art_bean', 'art_starry', 'poster_coffee', 'poster_bakery', 'wreath_season', 'hanging_ivy', 'wall_pennants'],
}
WALL_MAX = 300


def seams(profile, parts):
    """Cut positions: the emptiest line near each expected boundary."""
    edges = [0]
    for n in range(1, parts):
        lo, hi = round(len(profile) * (n - .3) / parts), round(len(profile) * (n + .3) / parts)
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


def cells(sheet, cols=4, rows=2):
    """The objects of a sheet of cols x rows separate objects, row by row (None for an empty cell)."""
    alpha = sheet[..., 3]
    # A pale veil around the objects (some sheets have one) is cut away: only near-opaque paint stays.
    veil = ((alpha > 20) & (alpha < 200)).sum() / max(1, (alpha >= 200).sum())
    if veil > .25:
        # The veil rises to about 200 next to the objects; the paint itself is nearly opaque.
        alpha = np.clip((alpha.astype(np.float32) - 215) / 30, 0, 1) * 255
        # It also leaves a pale rim on the outline: pull the edge in by two pixels.
        alpha = np.asarray(Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(.7))).astype(np.float32)
        sheet = sheet.copy()
        sheet[..., 3] = alpha.astype(np.uint8)
    solid = alpha > 128
    ys = seams(solid.sum(axis=1), rows)
    out = []
    for r in range(rows):
        band = solid[ys[r]:ys[r + 1]]
        xs = seams(band.sum(axis=0), cols)
        for c in range(cols):
            part = solid[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
            ink_rows, ink_cols = np.where(part.any(axis=1))[0], np.where(part.any(axis=0))[0]
            if not len(ink_rows):
                out.append(None)
                continue
            top, left = ys[r] + ink_rows[0], xs[c] + ink_cols[0]
            piece = sheet[top:ys[r] + ink_rows[-1] + 1, left:xs[c] + ink_cols[-1] + 1].copy()
            # Drop what belongs to a neighbour: keep pixels of this cell only.
            out.append(piece)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {}
    for name, ids in SHEETS.items():
        sheet = np.asarray(Image.open(source(f'{P}/kits/furniture/{name}/take-1/sheet.png')).convert('RGBA'))
        pieces = cells(sheet)
        scale = 1.0
        if ids[0] == 'reference':
            scale = CHAIR_HEIGHT / pieces[0].shape[0]
        for piece_id, piece in zip(ids, pieces):
            if piece_id in (None, 'reference') or piece is None:
                continue
            image = Image.fromarray(piece, 'RGBA')
            factor = scale if name.startswith('floor') else min(1, WALL_MAX / max(image.size))
            image = image.resize((max(1, round(image.width * factor)), max(1, round(image.height * factor))), Image.LANCZOS)
            image.save(f'{OUT}/{piece_id}.webp', 'WEBP', quality=90, method=6)
            index[piece_id] = {'width': image.width, 'height': image.height, 'surface': 'floor' if name.startswith('floor') else 'wall'}
        print(name, 'scale', round(scale, 3), [i for i in ids if i])
    with open(f'{OUT}/furniture.json', 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')
    print(len(index), 'pieces')


if __name__ == '__main__':
    main()
