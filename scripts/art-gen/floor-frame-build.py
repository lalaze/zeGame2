#!/usr/bin/env python3
"""Build the frame the floors view draws around its floors: roof and attic, pillars, beams, street.

    uv run --with pillow --with numpy python scripts/art-gen/floor-frame-build.py

The takes (kits/frame/<piece>/take-1/sheet.png, prompts in prompts/frame/) are:
- attic: the top floor's plate (kits/angle-plate-roof) with magenta above it (kits/frame/attic/input.png),
  repainted with a pitched roof over it and the attic's gable wall where the sky was. It is aligned
  back onto the plate, and below the parapet the plate itself is kept, so every table, chair and
  door stays exactly where the floors view's seats and routes expect it.
- pillar, beam: on magenta, keyed out. The pillar is made to repeat top to bottom.
- awning, folding-doors, step: the ground floor's open front, where guests come in off the street.
- side-window: the ground floor's corner with its side door (kits/frame/side-window/input.png, the plate
  in its starting decor), repainted with an arched window, a window seat and a plant where the door
  was and magenta elsewhere. It covers every bit of the door that the decor layers leave showing.
- wall-attic, wall-seating, wall-ground: the front walls that close the storeys when the player shows
  them, each painted over its storey in its starting decor (kits/frame/wall-*/input.png), then repainted
  with their glass in magenta (kits/frame/glass-*, the wall takes as input); the build uses the glass
  takes, the glass becoming see-through.
- street (the pavement in front of the ground floor), soil (the earth around the basement), sky.

Writes build/frame/*.webp and build/frame/frame.json (sizes and where the roof's parts are).
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/frame'
W = 1672
# The top floor's plate rows the floors view draws (FLOOR_ART.roof in src/render/floors/floors-layout.ts).
ROOF_PLATE_ROWS = 905
# Magenta rows above the plate in the attic take's input.
ROOF_PAD = 560
# Below the parapet's top the plate is kept; the repaint fades out over these plate rows.
SEAM = (395, 435)
PILLAR_W = 76
# The open front: the awning spans between the pillars; the folded doors stand at the front corners.
AWNING_W = W - 2 * PILLAR_W
DOOR_W, DOOR_H = 104, 720
STEP_W = 320
# The outer walls' window glass: a faint warm tint over the café behind it.
GLASS_TINT, GLASS_ALPHA = (255, 226, 178), .2
FADE = 90


# The take each piece uses: the side window's first take let the old door show past its plant.
TAKES = {'side-window': 2}
# The side window's take covers this part of the ground floor's plate [left, top, width, height].
SIDE_WINDOW = (0, 40, 600, 760)


def take(piece):
    return source(f'{P}/kits/frame/{piece}/take-{TAKES.get(piece, 1)}/sheet.png')


def key(image):
    """RGBA from a magenta-keyed RGB array: magenta out, its spill pulled from the edges."""
    image = image.astype(np.float32)
    r, g, b = image[..., 0], image[..., 1], image[..., 2]
    alpha = 1 - np.clip((np.minimum(r, b) - g - 40) / 120, 0, 1)
    spill = np.clip(np.minimum(r, b) - g, 0, None) * (alpha < .98)
    rgb = image.copy()
    rgb[..., 0] -= spill * .6
    rgb[..., 2] -= spill * .6
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)


def edges(gray):
    """High-passed grey, for matching two paintings of the same scene."""
    soft = np.asarray(Image.fromarray(gray.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
    return gray - soft


def match(moving, fixed, scales):
    """Scale and shift of `moving` (grey) that best lines it up with `fixed` (grey, same size)."""
    k = 2
    small = lambda a: np.asarray(Image.fromarray(a.astype(np.uint8)).resize((a.shape[1] // k, a.shape[0] // k), Image.BILINEAR)).astype(np.float32)
    goal = edges(small(fixed))
    goal_f = np.fft.rfft2(goal)
    best = None
    for s in scales:
        h, w = moving.shape
        scaled = small(np.asarray(Image.fromarray(moving.astype(np.uint8)).resize((round(w * s), round(h * s)), Image.BILINEAR)).astype(np.float32))
        canvas = np.zeros_like(goal)
        hh, ww = min(canvas.shape[0], scaled.shape[0]), min(canvas.shape[1], scaled.shape[1])
        canvas[:hh, :ww] = edges(scaled)[:hh, :ww]
        corr = np.fft.irfft2(goal_f * np.conj(np.fft.rfft2(canvas)), s=goal.shape)
        dy, dx = np.unravel_index(np.argmax(corr), corr.shape)
        score = corr[dy, dx] / (np.sqrt((goal ** 2).sum() * (canvas ** 2).sum()) + 1e-6)
        if best is None or score > best[0]:
            dy = dy - goal.shape[0] if dy > goal.shape[0] // 2 else dy
            dx = dx - goal.shape[1] if dx > goal.shape[1] // 2 else dx
            best = (float(score), float(s), int(dx) * k, int(dy) * k)
    return best


def attic(report):
    plate = np.asarray(Image.open(source(f'{P}/kits/angle-plate-roof/take-1/plate.png')).convert('RGB'))[:ROOF_PLATE_ROWS]
    plate = np.asarray(Image.fromarray(plate).resize((W, ROOF_PLATE_ROWS), Image.LANCZOS))
    height = ROOF_PAD + ROOF_PLATE_ROWS
    paint = Image.open(take('attic')).convert('RGB').resize((W, height), Image.LANCZOS)
    # Line the repaint's floor up with the plate's (Codex shifts and rescales a little).
    floor_rows = slice(ROOF_PAD + 300, height)
    grey = lambda a: np.asarray(Image.fromarray(a).convert('L')).astype(np.float32)
    score, s, dx, dy = match(grey(np.asarray(paint)[floor_rows]), grey(plate[300:]), np.arange(.97, 1.031, .005))
    report['attic'] = {'score': round(score, 3), 'scale': round(s, 3), 'dx': dx, 'dy': dy}
    # Scale about the floor band's top-left, then shift: the same transform on the whole repaint.
    scaled = paint.resize((round(W * s), round(height * s)), Image.LANCZOS)
    top = ROOF_PAD + 300
    canvas = Image.new('RGB', (W, height), (255, 0, 255))
    canvas.paste(scaled, (dx, round(top + dy - top * s)))
    rgba = key(np.asarray(canvas))
    # Keep the plate below the parapet: fade from the repaint to the plate over SEAM.
    rows = np.arange(height) - ROOF_PAD
    share = np.clip((rows - SEAM[0]) / (SEAM[1] - SEAM[0]), 0, 1)[ROOF_PAD:, None, None]
    out = rgba.astype(np.float32)
    below = out[ROOF_PAD:]
    below[..., :3] = below[..., :3] * (1 - share) + plate.astype(np.float32) * share
    below[..., 3] = np.maximum(below[..., 3], 255 * share[..., 0])
    # Trim the empty magenta above the chimney.
    filled = np.where((out[..., 3] > 128).any(axis=1))[0]
    crop = max(0, filled[0] - 16)
    out = out[crop:]
    Image.fromarray(out.astype(np.uint8), 'RGBA').save(f'{OUT}/attic.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
    # Where the roof's slopes reach the sides: the pillars start there.
    alpha = out[..., 3] > 128
    eave = int(np.where(alpha[:, 6])[0][0]) if alpha[:, 6].any() else 0
    return {'width': W, 'height': int(out.shape[0]), 'plateTop': int(ROOF_PAD - crop), 'eave': eave}


def pillar():
    rgba = key(np.asarray(Image.open(take('pillar')).convert('RGB')))
    solid = rgba[..., 3] > 128
    cols = np.where(solid.mean(axis=0) > .5)[0]
    rgba = rgba[:, cols[0]:cols[-1] + 1]
    image = Image.fromarray(rgba, 'RGBA')
    image = image.resize((PILLAR_W, round(image.height * PILLAR_W / image.width)), Image.LANCZOS)
    a = np.asarray(image).astype(np.float32)
    # Repeat top to bottom: cross-fade the last rows into the first and drop them.
    t = np.linspace(0, 1, FADE)[:, None, None]
    a[:FADE] = a[:FADE] * t + a[-FADE:] * (1 - t)
    a = a[:-FADE]
    Image.fromarray(a.astype(np.uint8), 'RGBA').save(f'{OUT}/pillar.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
    return {'width': int(a.shape[1]), 'height': int(a.shape[0])}


def beam():
    rgba = key(np.asarray(Image.open(take('beam')).convert('RGB')))
    rows = np.where((rgba[..., 3] > 128).mean(axis=1) > .5)[0]
    rgba = rgba[rows[0]:rows[-1] + 1]
    image = Image.fromarray(rgba, 'RGBA')
    image = image.resize((W, round(image.height * W / image.width)), Image.LANCZOS)
    image.save(f'{OUT}/beam.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
    return {'width': W, 'height': image.height}


def cutout(rgba, width=None, height=None):
    """The keyed piece trimmed to what is painted, scaled to a width or a height (or squeezed to both)."""
    solid = rgba[..., 3] > 128
    rows, cols = np.where(solid.any(axis=1))[0], np.where(solid.any(axis=0))[0]
    image = Image.fromarray(rgba[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1], 'RGBA')
    w = width or round(image.width * height / image.height)
    h = height or round(image.height * width / image.width)
    return image.resize((w, h), Image.LANCZOS)


def save(image, name):
    image.save(f'{OUT}/{name}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
    return {'width': image.width, 'height': image.height}


def front():
    """The ground floor's open front: the awning under the beam, the folded doors at its corners, the step."""
    parts = {}
    parts['awning'] = save(cutout(key(np.asarray(Image.open(take('awning')).convert('RGB'))), width=AWNING_W), 'awning')
    doors = key(np.asarray(Image.open(take('folding-doors')).convert('RGB')))
    half = doors.shape[1] // 2
    parts['door-left'] = save(cutout(doors[:, :half], width=DOOR_W, height=DOOR_H), 'door-left')
    parts['door-right'] = save(cutout(doors[:, half:], width=DOOR_W, height=DOOR_H), 'door-right')
    parts['step'] = save(cutout(key(np.asarray(Image.open(take('step')).convert('RGB'))), width=STEP_W), 'step')
    return parts


def side_window():
    """The ground floor's side door turned into a window with a seat and a plant: only those are painted."""
    left, top, width, height = SIDE_WINDOW
    rgba = key(np.asarray(Image.open(take('side-window')).convert('RGB').resize((width, height), Image.LANCZOS)))
    # The take repeats a corner of the side wall's top at its left; only the window, seat and plant count.
    rgba[:, :120, 3] = 0
    rgba[:60, :, 3] = 0
    save(Image.fromarray(rgba, 'RGBA'), 'side-window')
    return {'x': left, 'y': top, 'width': width, 'height': height}


def walls(report):
    """The front walls that close each storey when the player shows them: the attic's gable under its
    roof, a seating floor's and the ground floor's shopfront. Their windows (and the shop's open door)
    are glass: the glass-* takes repaint each wall with its glass in magenta, which becomes a faint
    warm tint, so the café goes on behind them in plain sight."""
    parts = {}
    attic_picture = Image.open(f'{OUT}/attic.webp')
    for name, size in (('attic', attic_picture.size), ('seating', (W, 877)), ('ground', (W, 883))):
        paint = np.asarray(Image.open(take(f'glass-{name}')).convert('RGB').resize(size, Image.LANCZOS))
        rgba = key(paint).astype(np.float32)
        glass = 1 - rgba[..., 3] / 255
        rgba[..., :3] = rgba[..., :3] * (1 - glass[..., None]) + np.array(GLASS_TINT, np.float32) * glass[..., None]
        rgba[..., 3] = 255 * (1 - glass * (1 - GLASS_ALPHA))
        if name == 'attic':
            # Only the attic picture's outline: the roof and its gable, nothing of the white around them.
            rgba[..., 3] = np.minimum(rgba[..., 3], np.asarray(attic_picture)[..., 3])
        parts[f'wall-{name}'] = save(Image.fromarray(rgba.astype(np.uint8), 'RGBA'), f'wall-{name}')
    return parts


def plain(piece):
    image = Image.open(take(piece)).convert('RGB')
    image = image.resize((W, round(image.height * W / image.width)), Image.LANCZOS)
    image.save(f'{OUT}/{piece}.webp', 'WEBP', quality=88, method=6)
    top, bottom = np.asarray(image)[:8].reshape(-1, 3).mean(axis=0), np.asarray(image)[-8:].reshape(-1, 3).mean(axis=0)
    return {'width': W, 'height': image.height, 'top': '#%02x%02x%02x' % tuple(int(c) for c in top), 'bottom': '#%02x%02x%02x' % tuple(int(c) for c in bottom)}


def main():
    os.makedirs(OUT, exist_ok=True)
    report = {}
    frame = {'attic': attic(report), 'pillar': pillar(), 'beam': beam(), **front(), 'side-window': side_window()}
    frame.update(walls(report))
    for piece in ('street', 'soil', 'sky'):
        frame[piece] = plain(piece)
    with open(f'{OUT}/frame.json', 'w') as f:
        json.dump(frame, f, indent=1)
        f.write('\n')
    print(json.dumps(frame), report)


if __name__ == '__main__':
    main()
