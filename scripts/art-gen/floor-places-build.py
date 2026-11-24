#!/usr/bin/env python3
"""Build the places a branch can stand in: what is seen behind the roof and through the windows.

    uv run --with pillow --with numpy python scripts/art-gen/floor-places-build.py

The old town is the building's own sky (build/frame/sky.webp and build/sky). For each other place of
src/game/locations.ts the takes (kits/places in the art library, prompts in prompts/places/) are:
- <place>/take-N: the backdrop on a sunny day (TAKES says which the user chose);
- <place>/{clear,dusk,night,overcast}/take-1: the same picture in the other lights, painted from it.
  They are moved back onto the day picture where Codex shifted them, so the game can cross-fade them.
- window-{1f,2f}/take-1: the rooms' two windows with their glass in magenta, which gives its shape.

Every sky's top runs out into the old town's top colour for that light (build/sky/sky.json), which the
game continues upward. Through the windows shows the place's picture from the branch map
(build/map/view-*.webp), or for the city its clock tower, from the backdrop.

Writes build/places/<place>/{day,clear,dusk,night,overcast,glass-1f,glass-2f}.webp and places.json.
"""
import json
import os

import numpy as np
from PIL import Image

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/places'
SIZE = (1672, 836)
# The backdrop the user chose for each place on 2026-11-24 (B, the second take, for all four).
TAKES = {'seaside': 2, 'forest': 2, 'city': 2, 'flowers': 2}
LIGHTS = ('clear', 'dusk', 'night', 'overcast')
# Rows at the top of a sky that run out into its top colour.
TOP_FADE = 120
# How far a light's picture may have been shifted from the day's.
REACH = 48
# The windows: where the take was cut from its layer (left, top, width, height).
WINDOWS = {'2f': (60, 0, 340, 680), '1f': (110, 60, 200, 420)}
# What shows through the glass: a picture, and where its landmark is across it (0 to 1); or a part of the backdrop.
VIEWS = {'seaside': ('map', .83), 'forest': ('map', .72), 'city': ('day', (0, 196, 176, 640)), 'flowers': ('map', .72)}


def take(path):
    return source(f'{P}/kits/places/{path}/sheet.png')


def picture(path):
    return np.asarray(Image.open(take(path)).convert('RGB').resize(SIZE, Image.LANCZOS)).astype(np.float32)


def edges(a):
    grey = a.mean(axis=2)
    return np.minimum(np.abs(np.diff(grey, axis=1))[:-1] + np.abs(np.diff(grey, axis=0))[:, :-1], 40)


def shift(day, other):
    """How far `other` has to move, (right, down), to lie on `day`: over the land, where the edges are."""
    a, b = (edges(p)[250:800] for p in (day, other))
    f, g = np.fft.fft2(a - a.mean()), np.fft.fft2(b - b.mean())
    cross = f * np.conj(g)
    peak = np.real(np.fft.ifft2(cross / (np.abs(cross) + 1e-6)))
    y, x = np.unravel_index(peak.argmax(), peak.shape)
    h, w = peak.shape
    dx, dy = (int(x) if x < w / 2 else int(x) - w), (int(y) if y < h / 2 else int(y) - h)
    if max(abs(dx), abs(dy)) > REACH:
        raise SystemExit(f'lights do not line up: {dx}, {dy}')
    return dx, dy


def moved(a, dx, dy):
    rows = np.clip(np.arange(a.shape[0]) - dy, 0, a.shape[0] - 1)
    cols = np.clip(np.arange(a.shape[1]) - dx, 0, a.shape[1] - 1)
    return a[rows][:, cols]


def save_sky(a, top, path):
    share = np.clip(np.arange(a.shape[0]) / TOP_FADE, 0, 1)[:, None, None]
    colour = np.array([int(top[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    Image.fromarray((colour + (a - colour) * share).astype(np.uint8), 'RGB').save(path, 'WEBP', quality=88, method=6)


def glass(kind):
    """The shape of a window's glass, from the magenta painted on it."""
    _, _, w, h = WINDOWS[kind]
    a = np.asarray(Image.open(take(f'window-{kind}/take-1')).convert('RGB').resize((w * 3, h * 3), Image.LANCZOS)).astype(np.float32)
    showing = np.clip((np.minimum(a[..., 0], a[..., 2]) - a[..., 1] - 60) / 120, 0, 1)
    return Image.fromarray((showing * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)


def view(place, day, size):
    kind, where = VIEWS[place]
    w, h = size
    image = Image.fromarray(day.astype(np.uint8)).crop(where) if kind == 'day' else Image.open(f'{P}/build/map/view-{place}.webp').convert('RGB')
    scale = max(w / image.width, h / image.height)
    image = image.resize((max(w, round(image.width * scale)), max(h, round(image.height * scale))), Image.LANCZOS)
    centre = .5 if kind == 'day' else where
    left = int(np.clip(image.width * centre - w / 2, 0, image.width - w))
    return image.crop((left, 0, left + w, h))


def main():
    skies = json.load(open(f'{P}/build/sky/sky.json'))['skies']
    tops = {'day': skies['day']['top'], **{light: skies[light]['top'] for light in LIGHTS}}
    shapes = {kind: glass(kind) for kind in WINDOWS}
    boxes = {kind: shape.point(lambda v: 255 if v > 40 else 0).getbbox() for kind, shape in shapes.items()}
    for place, number in TAKES.items():
        out = f'{OUT}/{place}'
        os.makedirs(out, exist_ok=True)
        day = picture(f'{place}/take-{number}')
        save_sky(day, tops['day'], f'{out}/day.webp')
        for light in LIGHTS:
            a = picture(f'{place}/{light}/take-1')
            dx, dy = shift(day, a)
            if dx or dy:
                print(f'{place} {light}: moved {dx}, {dy}')
            save_sky(moved(a, dx, dy), tops[light], f'{out}/{light}.webp')
        for kind, shape in shapes.items():
            box = boxes[kind]
            pane = Image.new('RGBA', shape.size)
            pane.paste(view(place, day, (box[2] - box[0], box[3] - box[1])), box[:2])
            pane.putalpha(shape)
            pane.crop(box).save(f'{out}/glass-{kind}.webp', 'WEBP', quality=90, method=6)
    windows = {kind: {'x': WINDOWS[kind][0] + box[0], 'y': WINDOWS[kind][1] + box[1], 'width': box[2] - box[0], 'height': box[3] - box[1]}
               for kind, box in boxes.items()}
    json.dump({'places': list(TAKES), 'lights': ['day', *LIGHTS], 'windows': windows}, open(f'{OUT}/places.json', 'w'), indent=1)
    print(windows)


main()
