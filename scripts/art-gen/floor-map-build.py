#!/usr/bin/env python3
"""Build the painted branch map, views, shop interiors and chain pictures of the floors view.

    uv run --with pillow --with numpy python scripts/art-gen/floor-map-build.py [--refs]

From the takes in kits/map/<sheet>/take-N/sheet.png of assets/generated/floor-sample-v1 (prompts in
prompts/map/):

- `map`: the region's map, cropped to the 8:5 of the drawn one (src/render/branch-map-art.ts), whose
  pins are laid over it.
- `views`: the view from the windows of the four places a branch can open, 2 by 2 on white
  (the old town's is the town behind the café's roof, build/frame/sky.webp).
- `regions`: the inside of the five street businesses, 3 by 2 on white.
- `places`: the little café of each place and the map pin; `perks`: the six chain perks. Sheets of
  separate objects on transparency.

Writes build/map/*.webp and build/map/map.json. With --refs it only writes the reference pictures the
takes are painted against (refs/map/ in the art library); the drawn map and views among them are saved
from the running game, not by this script.
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


spec = importlib.util.spec_from_file_location('furniture', os.path.join(os.path.dirname(__file__), 'floor-furniture-build.py'))
furniture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(furniture)

P = 'assets/generated/floor-sample-v1'
BUILD = f'{P}/build'
OUT = f'{BUILD}/map'
KITS = f'{P}/kits/map'
REFS = os.path.join(LIBRARY, P, 'refs/map')
# sheet: take
TAKES = {'map': 1, 'views': 1, 'regions': 1, 'places': 1, 'perks': 1}
# The drawn map is 160 by 100 and the preview of a place 92 by 76 (src/ui/branch-map.ts).
MAP_SIZE = (1280, 800)
VIEW_SIZE = (736, 608)
REGION_SIZE = (480, 360)
VIEWS = ['seaside', 'forest', 'city', 'flowers']
REGIONS = ['reading', 'greenhouse', 'terrace', 'workshop', 'observatory']
PLACES = ['town', 'seaside', 'forest', 'city', 'flowers', 'pin']
PERKS = ['till', 'cats', 'kitchen', 'builders', 'catering', 'manager']
# The part of the town behind the café's roof (build/frame/sky.webp) shown as the old town's view:
# left, top and right as shares of the picture; it reaches the bottom.
TOWN = (.42, .34, 1)
ICON = 192
# Square side as a share of the largest object's side on its sheet.
MARGIN = 1.06


def take(sheet):
    return source(f'{KITS}/{sheet}/take-{TAKES[sheet]}/sheet.png')


def save(image, name, quality=90):
    image.save(f'{OUT}/{name}.webp', 'WEBP', quality=quality, alpha_quality=100, method=6)


def cover(image, size):
    """The middle of the image at this size's proportions, scaled to it."""
    width, height = size
    scale = max(width / image.width, height / image.height)
    crop_w, crop_h = width / scale, height / scale
    left, top = (image.width - crop_w) / 2, (image.height - crop_h) / 2
    return image.crop((round(left), round(top), round(left + crop_w), round(top + crop_h))).resize(size, Image.LANCZOS)


def spans(white, parts):
    """Up to `parts` painted stretches along one axis, between the white bands: [(start, end), ...]."""
    painted = white < .9
    runs, start = [], None
    for i, on in enumerate(list(painted) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            runs.append((start, i))
            start = None
    # A picture is a good part of the sheet; anything thinner is a stray mark in a band.
    runs = [run for run in runs if run[1] - run[0] > len(painted) / (parts * 3)]
    return sorted(sorted(runs, key=lambda r: r[0] - r[1])[:parts])


def pictures(sheet, cols, rows):
    """The pictures of a sheet of cols x rows paintings separated by white bands, row by row."""
    image = Image.open(take(sheet)).convert('RGB')
    white = np.asarray(image).min(axis=2) > 232
    out = []
    for top, bottom in spans(white.mean(axis=1), rows):
        for left, right in spans(white[top:bottom].mean(axis=0), cols):
            # A few pixels in from the band, where its edge is soft.
            out.append(image.crop((left + 5, top + 5, right - 5, bottom - 5)))
    return out


def clean(pixels):
    """The sheet without the faint veil and the stray specks Codex leaves around its objects."""
    pixels = pixels.copy()
    pixels[pixels[..., 3] < 40] = 0
    # A speck has no solid core: keep only what lies within 20 pixels of paint at least 7 pixels thick.
    mask = Image.fromarray(((pixels[..., 3] > 0) * 255).astype(np.uint8))
    near = np.asarray(mask.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(41))) > 0
    pixels[~near] = 0
    return pixels


def icons(sheet, names, index_key, prefix, index):
    if not os.path.exists(take(sheet)):
        print(sheet, 'missing, skipped')
        return
    pixels = clean(np.asarray(Image.open(take(sheet)).convert('RGBA')))
    pieces = furniture.cells(pixels, 3, 2)
    side = round(max(max(p.shape[:2]) for p in pieces if p is not None) * MARGIN)
    for name, piece in zip(names, pieces):
        if piece is None:
            raise SystemExit(f'{sheet}: no object for {name}')
        image = Image.fromarray(piece, 'RGBA')
        if name == 'pin':
            image = image.resize((round(image.width * 96 / image.height), 96), Image.LANCZOS)
            save(image, 'pin')
            index['pin'] = {'width': image.width, 'height': image.height}
            continue
        square = Image.new('RGBA', (side, side))
        # Buildings stand on the bottom of their square; objects sit in its middle.
        y = side - image.height - round(side * (MARGIN - 1) / 2) if prefix == 'place' else (side - image.height) // 2
        square.alpha_composite(image, ((side - image.width) // 2, y))
        save(square.resize((ICON, ICON), Image.LANCZOS), f'{prefix}-{name}')
        index[index_key].append(name)
    print(sheet, 'take', TAKES[sheet], names)


def refs():
    """The painted town and the old place and perk pictures, as the takes' references."""
    os.makedirs(REFS, exist_ok=True)
    Image.open(f'{BUILD}/frame/sky.webp').convert('RGB').save(f'{REFS}/town-sky.png')
    pixel = 'assets/art-masters/art/generated/cozy-idle-v1'
    for name, ids in [('pixel-places', [f'shop-{p}' for p in PLACES[:5]]), ('pixel-perks', [f'perk-{p}' for p in PERKS])]:
        images = [Image.open(f'{pixel}/{i}.png').convert('RGBA') for i in ids]
        images = [i.resize((i.width * 3, i.height * 3), Image.NEAREST) for i in images]
        cell_w, cell_h = max(i.width for i in images) + 60, max(i.height for i in images) + 60
        sheet = Image.new('RGBA', (cell_w * 3, cell_h * 2), (244, 238, 226, 255))
        for k, image in enumerate(images):
            sheet.alpha_composite(image, ((k % 3) * cell_w + (cell_w - image.width) // 2, (k // 3) * cell_h + (cell_h - image.height) // 2))
        sheet.save(f'{REFS}/{name}.png')
    # The four drawn views (saved from the game as pixel-view-<place>.png), 2 by 2 on white.
    drawn = [f'{REFS}/pixel-view-{name}.png' for name in VIEWS]
    if all(os.path.exists(path) for path in drawn):
        views = [Image.open(path).convert('RGB') for path in drawn]
        width, height, gap = views[0].width, views[0].height, 40
        sheet = Image.new('RGB', (2 * width + 3 * gap, 2 * height + 3 * gap), 'white')
        for i, view in enumerate(views):
            sheet.paste(view, (gap + (i % 2) * (width + gap), gap + (i // 2) * (height + gap)))
        sheet.save(f'{REFS}/pixel-views.png')
    print('references in', REFS)


def main():
    if '--refs' in sys.argv:
        return refs()
    os.makedirs(OUT, exist_ok=True)
    index = {'views': [], 'regions': [], 'places': [], 'perks': []}
    if os.path.exists(take('map')):
        save(cover(Image.open(take('map')).convert('RGB'), MAP_SIZE), 'map', 88)
        index['map'] = {'width': MAP_SIZE[0], 'height': MAP_SIZE[1]}
        print('map take', TAKES['map'])
    # The old town's view is the town the café stands in.
    town = Image.open(f'{BUILD}/frame/sky.webp').convert('RGB')
    town = town.crop((round(town.width * TOWN[0]), round(town.height * TOWN[1]), round(town.width * TOWN[2]), town.height))
    save(cover(town, VIEW_SIZE), 'view-town', 88)
    index['views'].append('town')
    for sheet, names, size, prefix, grid in [('views', VIEWS, VIEW_SIZE, 'view', (2, 2)), ('regions', REGIONS, REGION_SIZE, 'region', (3, 2))]:
        if not os.path.exists(take(sheet)):
            print(sheet, 'missing, skipped')
            continue
        found = pictures(sheet, *grid)
        if len(found) < len(names):
            raise SystemExit(f'{sheet}: {len(found)} pictures between the white bands, {len(names)} expected')
        for name, picture in zip(names, found):
            save(cover(picture, size), f'{prefix}-{name}', 88)
            index[sheet].append(name)
        print(sheet, 'take', TAKES[sheet], names)
    icons('places', PLACES, 'places', 'place', index)
    icons('perks', PERKS, 'perks', 'perk', index)
    with open(f'{OUT}/map.json', 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')
    print(len(os.listdir(OUT)) - 1, 'pictures in', OUT)


if __name__ == '__main__':
    main()
