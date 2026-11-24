#!/usr/bin/env python3
"""Build the painted street of the floors view from assets/generated/floor-sample-v1.

    uv run --with pillow --with numpy python scripts/art-gen/floor-street-build.py [--refs]

The street screen (src/ui/streets.ts) keeps its layout: every painted picture is fitted into the box
the pixel piece of public/art/street-art-v2 or public/art/street-scene occupies, standing on the same
baseline, so only the pictures change (src/render/floors/floors-street.ts fills the hook of
src/render/street-art.ts). Sizes below are in the units of public/art/street-art-v2/anchors.json
(twice the pixel art's pixels: one CSS pixel on a phone); pictures are written RES pixels per unit.

- The player's café is assembled from the building's own front walls (build/frame), one picture per
  number of seating floors: cafe-0, cafe-1, cafe-2.
- Storefronts: kits/street/shops-N/take-T/sheet.png, two buildings on transparency each
  (prompts/street/shop-common.txt + shops-N.txt).
- Scenery, construction pieces and badges: kits/street/{props,sky,badges}/take-T/sheet.png, sheets of
  separate objects (prompts/street/*.txt).
- Hills and paving: kits/street/{hills,ground}/take-T/sheet.png, strips mirrored into tiles that repeat
  without a seam.
- Walkers: the side walk (frames 0 to 3) of four painted guests, build/cast-NN.webp.

Writes build/street/*.webp and build/street/street.json. With --refs it only writes the reference
pictures the takes are painted against (refs/street/ in the art library).
"""
import importlib.util
import json
import os
import sys

sys.dont_write_bytecode = True

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


# The furniture build's sheet cutter: emptiest-line seams between the objects of a sheet.
spec = importlib.util.spec_from_file_location('furniture', os.path.join(os.path.dirname(__file__), 'floor-furniture-build.py'))
furniture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(furniture)

P = 'assets/generated/floor-sample-v1'
BUILD = f'{P}/build'
OUT = f'{BUILD}/street'
KITS = f'{P}/kits/street'
REFS = os.path.join(LIBRARY, P, 'refs/street')
PIXEL = 'assets/art-masters/art/street-art-v2'
# Output pixels per unit: a phone shows one unit as one CSS pixel at three device pixels.
RES = 3

# ---------------------------------------------------------------- the player's café
# The building as floors-scene.ts stacks it with its outer walls on (FLOOR_ART, FRAME, EAVE, AWNING).
WORLD_W = 1672
ATTIC = {'above': 427, 'height': 905, 'eave': 550}
SEATING_H, GROUND_H = 877, 883
# The first row of a floor's picture on its plate, which the pieces that replaced parts of it are placed on.
PLATE_TOP = 24
PILLAR_W, BEAM_H = 76, 70
AWNING = {'top': 18, 'height': 84}
# The café's box on the street: as tall as the pixel café with no seating floor; taller cafés rise
# above it, at most CAFE_MAX units (the sky over the street on a phone).
CAFE_H, CAFE_MAX = 292, 432
# Where the game writes "Your café" (the plain band above the awning) and where the door stands, as
# shares of the ground floor's wall.
CAFE_SIGN_Y, CAFE_DOOR_X = 0.075, 0.5


def frame(name):
    return Image.open(f'{BUILD}/frame/{name}.webp').convert('RGBA')


def room(floor, pieces):
    """A floor as the game shows it: its plate with the pieces that took the place of parts of it (frame.json)."""
    picture = Image.open(f'{BUILD}/{floor}.webp').convert('RGBA')
    with open(f'{BUILD}/frame/frame.json') as f:
        places = json.load(f)
    for name in pieces:
        picture.alpha_composite(frame(name), (places[name]['x'], places[name]['y'] - PLATE_TOP))
    return picture


def cafe(seating):
    """The café seen from the street with `seating` floors between the attic and the ground floor."""
    height = ATTIC['above'] + ATTIC['height'] + seating * SEATING_H + GROUND_H
    picture = Image.new('RGBA', (WORLD_W, height))
    # Each room shows through its wall's windows, as in the building with its walls on.
    picture.alpha_composite(frame('attic'), (0, 0))
    picture.alpha_composite(frame('wall-attic'), (0, 0))
    joins, y = [], ATTIC['above'] + ATTIC['height']
    for _ in range(seating):
        joins.append(y)
        picture.alpha_composite(room('floor-2', ['stairs-hall', 'stairs-rail']), (0, y))
        picture.alpha_composite(frame('wall-seating'), (0, y))
        y += SEATING_H
    joins.append(y)
    ground = y
    picture.alpha_composite(room('floor-1', ['side-window']), (0, ground))
    picture.alpha_composite(frame('wall-ground'), (0, ground))
    awning = frame('awning').resize((WORLD_W - 2 * PILLAR_W, AWNING['height']), Image.LANCZOS)
    picture.alpha_composite(awning, (PILLAR_W, ground + AWNING['top']))
    beam = frame('beam').resize((WORLD_W, BEAM_H), Image.LANCZOS)
    for join in joins:
        picture.alpha_composite(beam, (0, join - BEAM_H // 2))
    pillar = frame('pillar')
    flipped = pillar.transpose(Image.FLIP_LEFT_RIGHT)
    for top in range(ATTIC['eave'], height, pillar.height):
        part = min(pillar.height, height - top)
        picture.alpha_composite(pillar.crop((0, 0, PILLAR_W, part)), (0, top))
        picture.alpha_composite(flipped.crop((0, 0, PILLAR_W, part)), (WORLD_W - PILLAR_W, top))
    return picture, ground


def cafes(index):
    base = CAFE_H / (ATTIC['above'] + ATTIC['height'] + GROUND_H)
    for seating in range(3):
        picture, ground = cafe(seating)
        scale = min(base, CAFE_MAX / picture.height)
        width, height = round(picture.width * scale), round(picture.height * scale)
        picture.resize((width * RES, height * RES), Image.LANCZOS).save(f'{OUT}/cafe-{seating}.webp', 'WEBP', quality=90, method=6)
        index['shops'][f'cafe-{seating}'] = {
            'width': width, 'height': height,
            'signY': round((ground + GROUND_H * CAFE_SIGN_Y) * scale), 'doorX': round(width * CAFE_DOOR_X),
        }
    print('cafe', [index['shops'][f'cafe-{n}'] for n in range(3)])


# ---------------------------------------------------------------- references for the takes
def upscaled(name, factor=6):
    image = Image.open(f'{PIXEL}/{name}.png').convert('RGBA')
    return image.resize((image.width * factor, image.height * factor), Image.NEAREST)


def side_by_side(images, gap=60, pad=40, background=(244, 238, 226, 255)):
    width = sum(i.width for i in images) + gap * (len(images) - 1) + 2 * pad
    height = max(i.height for i in images) + 2 * pad
    sheet = Image.new('RGBA', (width, height), background)
    x = pad
    for image in images:
        sheet.alpha_composite(image, (x, height - pad - image.height))
        x += image.width + gap
    return sheet


SHOP_SHEETS = {
    'shops-1': ['bookshop', 'plant-shop'],
    'shops-2': ['florist', 'pottery'],
    'shops-3': ['tea-shop', 'vacant-brick'],
    'shops-4': ['vacant-blue', None],
}


def refs():
    os.makedirs(REFS, exist_ok=True)
    picture, _ = cafe(0)
    scale = 900 / picture.height
    front = picture.resize((round(picture.width * scale), 900), Image.LANCZOS)
    side_by_side([front]).save(f'{REFS}/cafe-front.png')
    for sheet, names in SHOP_SHEETS.items():
        side_by_side([upscaled(n) for n in names if n]).save(f'{REFS}/pixel-{sheet}.png')
    side_by_side([upscaled(n, 8) for n in ['lamp', 'bench', 'depth-tree', 'depth-hedge']]).save(f'{REFS}/pixel-props.png')
    side_by_side([upscaled(n, 6) for n in ['cloud', 'depth-cloud-small', 'depth-town', 'depth-hamlet']], background=(163, 211, 250, 255)).save(f'{REFS}/pixel-sky.png')
    print('references in', REFS)


# ---------------------------------------------------------------- sheets of separate things
def take(sheet, number):
    return source(f'{KITS}/{sheet}/take-{number}/sheet.png')


def clean(pixels):
    """The sheet without the faint veil and the stray specks Codex leaves around its objects."""
    pixels = pixels.copy()
    pixels[pixels[..., 3] < 40] = 0
    # A speck has no solid core: keep only what lies within 20 pixels of paint at least 7 pixels thick.
    mask = Image.fromarray(((pixels[..., 3] > 0) * 255).astype(np.uint8))
    near = np.asarray(mask.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(41))) > 0
    pixels[~near] = 0
    return pixels


def objects(sheet, number, cols, rows):
    """The objects of a sheet, row by row, with the faint specks Codex leaves around them removed."""
    pixels = clean(np.asarray(Image.open(take(sheet, number)).convert('RGBA')))
    return [None if piece is None else Image.fromarray(piece, 'RGBA') for piece in furniture.cells(pixels, cols, rows)]


def fitted(image, box, grow=False):
    """The image scaled to fit the box (in units), standing on the middle of its bottom edge."""
    width, height = box
    scale = min(width * RES / image.width, height * RES / image.height)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    if grow:
        return image
    out = Image.new('RGBA', (round(width * RES), round(height * RES)))
    out.alpha_composite(image, ((out.width - image.width) // 2, out.height - image.height))
    return out


def save(image, name, quality=90):
    image.save(f'{OUT}/{name}.webp', 'WEBP', quality=quality, alpha_quality=100, method=6)


def units(image):
    return {'width': round(image.width / RES), 'height': round(image.height / RES)}


# ---------------------------------------------------------------- storefronts
# sheet: (take, the two buildings left to right). `scaffold` is the builders' scaffold, not a shop.
SHOPS = {
    'shops-1': (1, ['bookshop', 'plant-shop']),
    'shops-2': (1, ['florist', 'pottery']),
    'shops-3': (1, ['tea-shop', 'vacant-brick']),
    'shops-4': (1, ['vacant-blue', 'scaffold']),
}
# Where the game writes the shop's name (the middle of the signboard) and where guests walk in (the
# middle of the door), as shares of the painted building's own height and width, read off each take.
SIGN_DOOR = {
    'bookshop': (0.48, 0.81), 'plant-shop': (0.335, 0.5), 'florist': (0.467, 0.48), 'pottery': (0.47, 0.79),
    'tea-shop': (0.473, 0.81), 'vacant-brick': (0.458, 0.495), 'vacant-blue': (0.445, 0.22),
}


def shops(index):
    with open('public/art/street-art-v2/anchors.json') as f:
        boxes = json.load(f)
    for sheet, (number, names) in SHOPS.items():
        if not os.path.exists(take(sheet, number)):
            print(sheet, 'missing, skipped')
            continue
        for name, piece in zip(names, objects(sheet, number, 2, 1)):
            if piece is None:
                raise SystemExit(f'{sheet}: no building for {name}')
            if name == 'scaffold':
                # It stands in front of any shop: as tall as the lowest one, so it never tops a roof.
                image = fitted(piece, (236, 236), grow=True)
                save(image, 'scaffold')
                index['scenery']['scaffold'] = units(image)
                continue
            box = boxes[name]
            image = fitted(piece, (box['width'], box['height']))
            save(image, name)
            # The painted building inside its box.
            scale = min(box['width'] / piece.width, box['height'] / piece.height)
            width, height = piece.width * scale, piece.height * scale
            sign, door = SIGN_DOOR[name]
            index['shops'][name] = {
                'width': box['width'], 'height': box['height'],
                'signY': round(box['height'] - height + height * sign),
                'doorX': round((box['width'] - width) / 2 + width * door),
            }
        print(sheet, 'take', number, names)


# ---------------------------------------------------------------- scenery, construction, badges
# What stands in a fixed box of the street's CSS keeps that box; the rest keeps its own shape at the
# pixel piece's width or height (units).
PROPS = (1, 4, 2, ['lamp', 'bench', 'depth-tree', 'depth-hedge', 'ladder', 'barrier', 'hoarding', 'mound'])
SKY = (1, 2, 2, ['cloud', 'depth-cloud-small', 'depth-town', 'depth-hamlet'])
BADGES = (1, 4, 2, ['sign', 'ready', 'lock', 'flag', 'fitout', 'coin', 'key', 'blueprint'])
BOXED = {'bench': (48, 28)}
TALL = {'lamp': 150, 'depth-tree': 184, 'ladder': 190, 'barrier': 76, 'hoarding': 92}
WIDE = {'depth-hedge': 108, 'cloud': 238, 'depth-cloud-small': 116, 'depth-town': 130, 'depth-hamlet': 116, 'sign': 120}
# The meadow mound a far village stands on (the pixel depth-field): its box, and how much of it is the dome.
MOUND = (328, 296)
BADGE = 40


def scenery(index, meadow):
    for sheet, (number, cols, rows, names) in {'props': PROPS, 'sky': SKY, 'badges': BADGES}.items():
        if not os.path.exists(take(sheet, number)):
            print(sheet, 'missing, skipped')
            continue
        for name, piece in zip(names, objects(sheet, number, cols, rows)):
            if piece is None:
                raise SystemExit(f'{sheet}: no object for {name}')
            if name == 'mound':
                image = mound(piece, meadow)
            elif name in BOXED:
                image = fitted(piece, BOXED[name])
            elif name in TALL:
                image = fitted(piece, (10000, TALL[name]), grow=True)
            elif name in WIDE:
                image = fitted(piece, (WIDE[name], 10000), grow=True)
            else:
                image = fitted(piece, (BADGE, BADGE))
            save(image, name)
            index['scenery' if sheet != 'badges' else 'badges'][name] = units(image)
        print(sheet, 'take', number, names)


def tinted(image, colour):
    """The image with its colours moved so that its average becomes `colour`, keeping its shading."""
    pixels = np.asarray(image).astype(np.float32)
    solid = pixels[..., 3] > 200
    shift = np.array(colour, np.float32) - pixels[solid][:, :3].mean(axis=0)
    pixels[..., :3] = np.clip(pixels[..., :3] + shift, 0, 255)
    return Image.fromarray(pixels.astype(np.uint8), 'RGBA')


def mound(piece, meadow):
    """The mound across the top of its box, in the hills' meadow colour, with meadow below it down to the street."""
    width, height = round(MOUND[0] * RES / 2), round(MOUND[1] * RES / 2)
    # The dome down to where its sides stand upright, so the meadow below continues them.
    foot = round(piece.height * .8)
    solid = np.where(np.asarray(piece)[foot, :, 3] > 200)[0]
    dome = piece.crop((int(solid[0]) + 3, 0, int(solid[-1]) - 2, foot))
    dome = dome.resize((width, round(dome.height * width / dome.width)), Image.LANCZOS)
    if meadow is not None:
        dome = tinted(dome, meadow)
    out = Image.new('RGBA', (width, height))
    out.alpha_composite(dome, (0, 0))
    rows = np.asarray(dome)[-4:]
    colour = tuple(int(c) for c in rows[rows[..., 3] > 200][:, :3].mean(axis=0))
    out.paste(Image.new('RGBA', (width, height - dome.height), colour + (255,)), (0, dome.height))
    return out


# ---------------------------------------------------------------- hills and paving
HILLS = 1
GROUND = 1
# The pixel strip of hills is this many units tall; the painted one is drawn as tall.
HILLS_HEIGHT = 240
# One painting of the paving covers this many units; its kerb starts this far down the take.
GROUND_SPAN = 512
GROUND_TOP = .034


def mirrored(image):
    """The image followed by its mirror image: a tile that repeats without a seam."""
    tile = Image.new(image.mode, (image.width * 2, image.height))
    tile.paste(image, (0, 0))
    tile.paste(image.transpose(Image.FLIP_LEFT_RIGHT), (image.width, 0))
    return tile


def hex_colour(rgb):
    return '#%02x%02x%02x' % tuple(int(round(c)) for c in rgb[:3])


def hills(index):
    if not os.path.exists(take('hills', HILLS)):
        print('hills missing, skipped')
        return None
    pixels = clean(np.asarray(Image.open(take('hills', HILLS)).convert('RGBA')))
    # From just above the highest hilltop to the bottom edge, drawn as tall as the pixel strip.
    rows = np.where((pixels[..., 3] > 128).mean(axis=1) > .01)[0]
    strip = Image.fromarray(pixels[max(0, int(rows[0]) - 4):], 'RGBA')
    span = round(strip.width * HILLS_HEIGHT / strip.height)
    meadow = np.asarray(strip)[-3:, :, :3].reshape(-1, 3).mean(axis=0)
    save(mirrored(strip), 'hills', 88)
    index['hills'] = {'span': span * 2, 'height': HILLS_HEIGHT, 'meadow': hex_colour(meadow)}
    print('hills take', HILLS, index['hills'])
    return meadow


def ground(index):
    if not os.path.exists(take('ground', GROUND)):
        print('ground missing, skipped')
        return
    painting = Image.open(take('ground', GROUND)).convert('RGB')
    # From the top of the kerb down, a little paler: the street lies under signs and people.
    painting = painting.crop((0, round(painting.height * GROUND_TOP), painting.width, painting.height))
    painting = ImageEnhance.Color(painting).enhance(.82)
    painting = Image.blend(painting, Image.new('RGB', painting.size, (246, 232, 214)), .12)
    scale = GROUND_SPAN * 2 / painting.width
    painting = painting.resize((round(painting.width * scale), round(painting.height * scale)), Image.LANCZOS)
    edge = np.asarray(painting)[-4:].reshape(-1, 3).mean(axis=0)
    save(mirrored(painting), 'ground', 86)
    index['ground'] = {'span': GROUND_SPAN, 'height': round(painting.height / 2), 'edge': hex_colour(edge)}
    print('ground take', GROUND, index['ground'])


# ---------------------------------------------------------------- walkers
# The painted guests who stroll along the street: their side walk, frames 0 to 3 of build/cast-NN.
WALKERS = ['cast-03', 'cast-11', 'cast-20', 'cast-27']
# Each frame's cell in units; the figures are drawn at twice that.
WALKER = (80, 100)


def walkers(index):
    with open(f'{BUILD}/sheets.json') as f:
        sizes = json.load(f)
    cell = (WALKER[0] * 2, WALKER[1] * 2)
    for n, key in enumerate(WALKERS):
        size = sizes[key]
        strip = Image.open(f'{BUILD}/{key}.webp').convert('RGBA')
        frames = [strip.crop((i * size['frameWidth'], 0, (i + 1) * size['frameWidth'], size['frameHeight'])) for i in range(4)]
        boxes = [frame.getbbox() for frame in frames]
        bottom = max(box[3] for box in boxes)
        tall = bottom - min(box[1] for box in boxes)
        wide = max(max(frame.width / 2 - box[0], box[2] - frame.width / 2) for frame, box in zip(frames, boxes)) * 2
        scale = min(1, (cell[1] - 4) / tall, cell[0] / wide)
        out = Image.new('RGBA', (cell[0] * 4, cell[1]))
        for i, frame in enumerate(frames):
            small = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.LANCZOS)
            out.alpha_composite(small, (i * cell[0] + (cell[0] - small.width) // 2, cell[1] - round(bottom * scale)))
        save(out, f'guest-{n}')
    index['walkers'] = {'count': len(WALKERS), 'width': WALKER[0], 'height': WALKER[1], 'frames': 4, 'from': WALKERS}
    print('walkers', WALKERS)


def main():
    if '--refs' in sys.argv:
        return refs()
    os.makedirs(OUT, exist_ok=True)
    index = {'res': RES, 'shops': {}, 'scenery': {}, 'badges': {}}
    cafes(index)
    shops(index)
    meadow = hills(index)
    scenery(index, meadow)
    ground(index)
    walkers(index)
    with open(f'{OUT}/street.json', 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')
    print(len(os.listdir(OUT)) - 1, 'pictures in', OUT)


if __name__ == '__main__':
    main()
