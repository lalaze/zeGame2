#!/usr/bin/env python3
"""Turn the decor takes of assets/generated/floor-sample-v1 into layers the floors view stacks.

    uv run --with pillow --with numpy --with scipy python scripts/art-gen/floor-decor-build.py

Every decorated floor (1f is the ground floor, 2f the seating floors) is drawn as layers over its
empty room (kits/decor-<floor>/shell), each the size of the floor as the page stacks it:

  wallpaper, floor   repaints of the empty room, cut out with the wall and floor masks that all
                     variants of their kind agree on, so any wall goes with any floor
  fixtures           what never changes (machines, shelves, tables and chairs), keyed out of a
                     magenta repaint of the finished plate and aligned back onto it; on the ground
                     floor split into what stands behind the staff and what stands in front
  shadow             contact shadows of the fixtures, on the floor only
  counter            magenta-keyed repaints of the counter alone, aligned onto the first
  curtain            the curtains keyed out once, recoloured for each curtain
  ceiling, rug,      a take that adds one thing to the empty room or the plate; the layer is what
  neon, sill         changed
  tablecloth         drawn here, a soft mat on each table top
  centerpiece        cut from a sheet of three small objects and stood on each table

Writes build/decor/<floor>/<layer>.webp and build/decor/decor.json, which says for each floor the
layers drawn behind people, in front of them, and for each decor slot the layer of each item.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

# Takes live in the art library at the same paths (assets/ART-LIBRARY.md); a copy here wins, as
# with librarySource() in scripts/art-files.mjs.
LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


P = 'assets/generated/floor-sample-v1'
KITS = f'{P}/kits'
OUT = f'{P}/build/decor'
W, H = 1672, 941
FLOORS = {
    '1f': {'plate': f'{KITS}/angle-plate-1f/take-1/plate.png', 'top': 24, 'height': 883},
    '2f': {'plate': f'{KITS}/angle-plate-2f/take-1/plate.png', 'top': 24, 'height': 877},
}
WALLS = ['wall_cream', 'wall_mint', 'wall_rose', 'wall_dots', 'wall_brick', 'wall_walnut', 'wall_stars']
FLOORINGS = ['floor_checker', 'floor_planks', 'floor_mint', 'floor_terrazzo', 'floor_herringbone', 'floor_marble']
COUNTERS = ['counter_oak', 'counter_sage', 'counter_blush', 'counter_walnut', 'counter_marble', 'counter_pink', 'counter_gold']
CURTAINS = {'curtain_classic': None, 'curtain_sage': (159, 181, 154), 'curtain_rose': (217, 163, 160),
            'curtain_blue': (143, 169, 196), 'curtain_linen': (239, 227, 204)}
# The neon cup's tubes, the two nails it hangs from (the middle of each, and its radius), how far down and
# to each side their chains reach, and the colour of its glow.
CUP_TUBES, CUP_NAILS, CUP_CHAIN, CUP_GLOW = (792, 202, 884, 296), [(804.5, 192.5, 6), (857, 192.5, 6)], (241, 3), (255, 186, 72)
TABLECLOTHS = {'tablecloth_classic': ((232, 217, 188), 'weave'), 'tablecloth_mint': ((200, 228, 207), 'gingham'),
               'tablecloth_rose': ((240, 200, 198), 'gingham'), 'tablecloth_blue': ((188, 208, 228), 'stripe'),
               'tablecloth_lavender': ((216, 203, 232), 'dots'), 'tablecloth_linen': ((246, 238, 220), 'lace')}
# Table tops (centre, half width, half depth) and the ground floor's things in front of the staff, in plate pixels.
TABLES = {'1f': [(570, 718, 91, 43), (1125, 718, 88, 43)],
          '2f': [(536, 476, 78, 34), (1110, 476, 78, 34), (823, 687, 88, 38)]}
# How thick the rims of the ground floor's tables are, and how far the open floor under them reaches each side.
RIM, UNDER = 13, [(-62, 62), (-62, 40)]
FRONT_RECTS = [(1074, 300, 1339, 538), (572, 284, 680, 360), (925, 322, 990, 377)]
COUNTER_RECT = (455, 340, 1100, 528)
WINDOW_RECT = (40, 40, 380, 600)
# What the fixture takes dropped and the plate still has: the low back counter the grinder stands on.
BACK_COUNTER = (925, 288, 1100, 362)
# What the second floor's fixture take kept that belongs to the curtain and sill slots.
SILL_AND_ROD = [(70, 40, 310, 300), (90, 300, 310, 600)]
# The ground floor's back wall where the player hangs wall furniture (the game's two free stretches
# of wall, see WALL_ZONES in src/render/floors/floors-layout.ts): its fixed wall decor comes down.
WALL_ZONES = [(516, 40, 770, 156), (494, 156, 770, 282), (755, 70, 905, 190)]
# The front corners' potted plants come out too: those corners are furniture spots (FLOOR_SPOTS there); so does
# the mat inside the side door, where the window seat is now.
CORNER_PLANTS = [(50, 537, 255, 860), (200, 535, 345, 650), (1465, 630, 1615, 875)]
# Where the things added to a room are, by slot or item, and how large a part of one has to be, as a share of its
# largest: the rest of what a take changed is drift (a table leg, the bricks by the stairs).
ADDED = {'ceiling': ((60, 0, 1305, 370), .5), 'ceiling_lights': ((60, 0, 1305, 150), .01), 'neon': ((758, 150, 928, 324), 0),
         'sill': ((110, 350, 330, 630), .5), 'rug': ((430, 500, 1240, 700), .5)}
LINE = np.array([122, 90, 68], np.float32)


def take(floor, name, number=1):
    return source(f'{KITS}/decor-{floor}/{name}/take-{number}/plate.png')


def load(path, mode='RGB'):
    image = Image.open(path).convert(mode)
    if image.size != (W, H):
        image = image.resize((W, H), Image.LANCZOS)
    return np.asarray(image).astype(np.float32)


def blur(mask, radius):
    image = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(image).astype(np.float32) / 255


def grow(mask, size):
    image = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(size))
    return np.asarray(image) > 127


def shrink(mask, size):
    image = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(size))
    return np.asarray(image) > 127


def changed(image, base, threshold=38, radius=6, keep=.45):
    return blur(np.abs(image - base).sum(axis=2) > threshold, radius) > keep


def rect_mask(rects):
    mask = np.zeros((H, W), bool)
    for left, top, right, bottom in rects:
        mask[top:bottom, left:right] = True
    return mask


def key(path, soft=200):
    """RGBA of a magenta-keyed take: magenta out, its spill pulled from edges, stray outlines dropped. `soft` is how
    pink a pixel may be and still show a little."""
    image = load(path)
    r, g, b = image[..., 0], image[..., 1], image[..., 2]
    alpha = 1 - np.clip((np.minimum(r, b) - g) / soft, 0, 1)
    if soft < 200:
        alpha = blur(alpha, .6)
    opaque = alpha > .5
    near = grow(grow(shrink(opaque, 9), 9), 9)
    # Thin parts inside a frame (a chair's spindles) belong to it.
    near |= nd.binary_fill_holes(near & opaque)
    alpha = np.where(near, alpha, 0)
    spill = np.clip(np.minimum(r, b) - g, 0, None) * (alpha < .98)
    rgb = image.copy()
    rgb[..., 0] -= spill * .6
    rgb[..., 2] -= spill * .6
    return np.clip(rgb, 0, 255), alpha


def align(rgb, alpha, target):
    """Scale and shift the layer so its shape best covers the target mask (FFT correlation per scale)."""
    k = 4
    small = lambda a: np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W // k, H // k), Image.BILINEAR)).astype(np.float32) / 255
    goal = small(target.astype(np.float32))
    goal_f = np.fft.rfft2(goal)
    goal_norm = np.sqrt((goal ** 2).sum())
    best = None
    source = Image.fromarray((alpha * 255).astype(np.uint8))
    for sx in np.arange(.93, 1.081, .01):
        for sy in np.arange(.93, 1.101, .01):
            scaled = np.asarray(source.resize((int(W * sx) // k, int(H * sy) // k), Image.BILINEAR)).astype(np.float32) / 255
            canvas = np.zeros_like(goal)
            h, w = min(canvas.shape[0], scaled.shape[0]), min(canvas.shape[1], scaled.shape[1])
            canvas[:h, :w] = scaled[:h, :w]
            corr = np.fft.irfft2(goal_f * np.conj(np.fft.rfft2(canvas)), s=goal.shape)
            dy, dx = np.unravel_index(np.argmax(corr), corr.shape)
            score = corr[dy, dx] / (goal_norm * np.sqrt((canvas ** 2).sum()) + 1e-6)
            if best is None or score > best[0]:
                dy = dy - goal.shape[0] if dy > goal.shape[0] // 2 else dy
                dx = dx - goal.shape[1] if dx > goal.shape[1] // 2 else dx
                best = (score, sx, sy, int(dx) * k, int(dy) * k)
    score, sx, sy, dx, dy = best
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    layer = Image.fromarray(rgba, 'RGBA').resize((int(W * sx), int(H * sy)), Image.LANCZOS)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(layer, (dx, dy))
    out = np.asarray(out).astype(np.float32)
    return out[..., :3], out[..., 3] / 255, (round(float(score), 3), round(float(sx), 3), round(float(sy), 3), dx, dy)


def write(floor, name, rgb, alpha, report):
    info = FLOORS[floor]
    rgba = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    rgba = rgba[info['top']:info['top'] + info['height']]
    if rgba[..., 3].max() == 0:
        raise SystemExit(f'{floor}/{name}: empty layer')
    os.makedirs(f'{OUT}/{floor}', exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/{floor}/{name}.webp', 'WEBP', quality=90, method=6)
    report.append(f'{floor}/{name}')
    return f'decor/{floor}/{name}.webp'


def added(image, base, threshold=50):
    """The thing a take added: what changed against its base, with a soft edge."""
    mask = changed(image, base, threshold, 2, .5)
    mask = grow(mask, 3)
    drift = np.abs(image - base).sum(axis=2)[~grow(mask, 31)].mean()
    return blur(mask, 1), float(drift)


def parts(mask, slot, name):
    """The mask of a thing added to a room, without what a take changed elsewhere."""
    box, least = ADDED.get(name, ADDED[slot])
    mask = mask * rect_mask([box])
    labels, n = nd.label(nd.binary_dilation(mask > .05, iterations=2))
    sizes = nd.sum(mask > .05, labels, range(1, n + 1)) if n else []
    return mask * np.isin(labels, [i + 1 for i, size in enumerate(sizes) if size >= least * max(sizes)])


def lit_cup(image, base):
    """
    The neon cup is as pale as the wall it glows on, so its parts are told apart by how they differ from
    it: its tubes are greener and bluer, its nails and chains darker. The glow is painted again, from the tubes.
    """
    difference = image - base
    tubes = np.clip((difference[..., 1:].max(axis=2) - 8) / 34, 0, 1) * rect_mask([CUP_TUBES])
    yy, xx = np.mgrid[0:H, 0:W]
    chains = np.zeros((H, W))
    for x, y, radius in CUP_NAILS:
        chains = np.maximum(chains, np.clip(radius + .5 - np.hypot(xx - x, yy - y), 0, 1))
        links = np.clip(CUP_CHAIN[1] + .5 - np.abs(xx - x), 0, 1) * (yy > y) * (yy < CUP_CHAIN[0])
        chains = np.maximum(chains, links * np.clip((-difference.sum(axis=2) - 90) / 90, 0, 1))
    glow = np.clip(blur(tubes, 4) * .75 + blur(tubes, 12) * .7, 0, .6)
    rgb, alpha = np.zeros_like(image), np.zeros(image.shape[:2], np.float32)
    for colour, share in ((np.broadcast_to(np.array(CUP_GLOW, np.float32), image.shape), glow), (image, chains), (image, tubes)):
        out = share + alpha * (1 - share)
        rgb = np.where(out[..., None] > 0, (colour * share[..., None] + rgb * (alpha * (1 - share))[..., None]) / np.maximum(out, 1e-4)[..., None], rgb)
        alpha = out
    return rgb, alpha


def tablecloth(floor, colour, pattern):
    """Soft mats on each table top, drawn at four times the size and scaled down."""
    s = 4
    canvas = Image.new('RGBA', (W * s, H * s), (0, 0, 0, 0))
    base = np.array(colour, np.float32)
    dark = tuple(int(v) for v in base * .78)
    light = tuple(int(min(255, v * 1.06 + 8)) for v in base)
    for cx, cy, rx, ry in TABLES[floor]:
        rx, ry = rx * .86, ry * .84
        size = (int(rx * 2 * s) + 8 * s, int(ry * 2 * s) + 8 * s)
        left, top = round(cx * s - size[0] / 2), round(cy * s - size[1] / 2)
        x0, y0 = size[0] / 2, size[1] / 2
        box = lambda f: [x0 - rx * f * s, y0 - ry * f * s, x0 + rx * f * s, y0 + ry * f * s]
        mat = Image.new('RGBA', size, (*colour, 255))

        def over(paint):
            """Draws on a layer of its own, so what is see-through shows the mat beneath it."""
            layer = Image.new('RGBA', size, (0, 0, 0, 0))
            paint(ImageDraw.Draw(layer))
            mat.alpha_composite(layer)

        def lines(xs, ys, colour, across=0, along=0):
            for x in xs:
                over(lambda d: d.line([(x0 + x * s, 0), (x0 + x * s, size[1])], fill=colour, width=round(across * s)))
            for y in ys:
                over(lambda d: d.line([(0, y0 + y * s), (size[0], y0 + y * s)], fill=colour, width=round(along * s)))

        if pattern == 'gingham':
            lines([k * rx / 5 for k in range(-5, 6)], [k * ry / 3.4 for k in range(-3, 4)], (*dark, 105), rx / 10, ry / 6.8)
        elif pattern == 'stripe':
            lines([k * rx / 6 for k in range(-6, 7, 2)], [], (250, 246, 236, 190), rx / 6)
        elif pattern == 'dots':
            for i in range(-5, 6):
                for j in range(-2, 3):
                    x, y = x0 + (i * rx / 5.5 + (j % 2) * rx / 11) * s, y0 + j * ry / 2.6 * s
                    over(lambda d: d.ellipse([x - 2.6 * s, y - 1.6 * s, x + 2.6 * s, y + 1.6 * s], fill=(250, 246, 236, 225)))
        elif pattern == 'weave':
            lines([k * rx / 12 for k in range(-12, 13)], [k * ry / 8 for k in range(-8, 9)], (*dark, 46), 2, 1.4)
        elif pattern == 'lace':
            over(lambda d: d.ellipse(box(.8), outline=(*dark, 150), width=round(1.6 * s)))
            for k in range(36):
                a = k / 36 * 2 * np.pi
                x, y = x0 + np.cos(a) * rx * .9 * s, y0 + np.sin(a) * ry * .9 * s
                over(lambda d: d.ellipse([x - 3 * s, y - 1.8 * s, x + 3 * s, y + 1.8 * s], outline=(*dark, 170), width=s))
        # A lighter far half reads as the mat lying on a lit table.
        over(lambda d: d.chord(box(1), 180, 360, fill=(*light, 60)))
        over(lambda d: d.ellipse(box(1), outline=(*(int(v) for v in LINE), 255), width=round(2.4 * s)))
        # Keep only the mat: the patterns run past its edge.
        shape = Image.new('L', size, 0)
        ImageDraw.Draw(shape).ellipse(box(1), fill=255)
        mat.putalpha(shape)
        canvas.alpha_composite(mat, (left, top))
    out = np.asarray(canvas.resize((W, H), Image.LANCZOS)).astype(np.float32)
    return out[..., :3], out[..., 3] / 255


def centerpieces():
    """The three objects of the centerpiece sheet, left to right, as RGBA arrays."""
    sheet = np.asarray(Image.open(take('1f', 'centerpieces')).convert('RGBA')).astype(np.float32)
    solid = sheet[..., 3] > 128
    columns = solid.any(axis=0)
    runs, x = [], 0
    while x < len(columns):
        if not columns[x]:
            x += 1
            continue
        start = x
        while x < len(columns) and columns[x]:
            x += 1
        if x - start > 20:
            runs.append((start, x))
    runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:3]
    sprites = []
    for start, end in sorted(runs):
        rows = np.where(solid[:, start:end].any(axis=1))[0]
        sprites.append(sheet[rows[0]:rows[-1] + 1, start:end])
    return sprites


def main():
    report, manifest = [], {}
    shells = {floor: load(take(floor, 'shell')) for floor in FLOORS}
    plates = {floor: load(source(FLOORS[floor]['plate'])) for floor in FLOORS}
    drift_warnings = []
    for floor in FLOORS:
        shell, plate = shells[floor], plates[floor]
        entry = manifest[floor] = {'height': FLOORS[floor]['height'], 'back': [], 'front': [], 'slots': {}}
        slots = entry['slots']
        # Walls and floors: masks from every variant of their kind.
        walls = {n: load(take(floor, n)) for n in WALLS if os.path.exists(take(floor, n))}
        floorings = {n: load(take(floor, n)) for n in FLOORINGS if os.path.exists(take(floor, n))}
        wall_mask = np.zeros((H, W), bool)
        floor_mask = np.zeros((H, W), bool)
        for image in walls.values():
            wall_mask |= changed(image, shell)
        for image in floorings.values():
            floor_mask |= changed(image, shell)
        wall_mask &= ~floor_mask
        floorings.setdefault('floor_checker', shell)
        entry['back'].append(write(floor, 'shell', shell, np.ones((H, W)), report))
        slots['wallpaper'] = {n: write(floor, n, image, blur(wall_mask, 1.5), report) for n, image in walls.items()}
        slots['floor'] = {n: write(floor, n, image, blur(floor_mask, 1.5), report) for n, image in floorings.items()}
        # Fixtures, keyed and aligned onto what the plate has beyond the empty room.
        rgb, alpha = key(take(floor, 'fixtures'), 70)
        rgb, alpha, fit = align(rgb, alpha, changed(plate, shell, 60, 3, .5))
        report.append(f'{floor}/fixtures align {fit}')
        if floor == '1f':
            # The take painted out the table tops with the vases: take them from the plate repainted without
            # vases, and the back counter from the plate.
            counter = rect_mask([BACK_COUNTER]) & changed(plate, shell, 40, 1, .5)
            yy, xx = np.mgrid[0:H, 0:W]
            tops = np.zeros((H, W), bool)
            for cx, cy, rx, ry in TABLES[floor]:
                for down in range(RIM):
                    tops |= ((xx - cx) / (rx + 1)) ** 2 + ((yy - cy - down) / (ry + 1)) ** 2 <= 1
            rgb = np.where(counter[..., None], plate, np.where(grow(tops, 3)[..., None], load(take(floor, 'tables')), rgb))
            # The take's own rims show a little below them, between the table's foot and the chairs.
            for (cx, cy, rx, ry), (left, right) in zip(TABLES[floor], UNDER):
                below = (yy > cy) & (np.abs(xx - cx) > 13) & (xx > cx + left) & (xx < cx + right)
                alpha = np.where(grow(tops, 17) & ~tops & below, 0, alpha)
            alpha = np.maximum(alpha, blur(counter | tops, 1))
            alpha = alpha * ~rect_mask(WALL_ZONES + CORNER_PLANTS)
        else:
            alpha = alpha * ~rect_mask(SILL_AND_ROD + CORNER_PLANTS)
        shadow = np.zeros((H, W))
        shadow[10:, 6:] = alpha[:-10, :-6]
        shadow = blur(shadow, 9) * blur(floor_mask, 3) * (1 - alpha) * .42
        slots['rug'] = {}
        if floor == '1f':
            # Take 2 of each rug is without the vases on the tables, like the plate it is compared with.
            for n in ['rug_red', 'rug_blue', 'rug_round']:
                if os.path.exists(take(floor, n, 2)):
                    image = load(take(floor, n, 2))
                    mask, drift = added(image, load(take(floor, 'tables')))
                    drift_warnings.append((f'{floor}/{n}', drift))
                    # Where its border is as pale as the floor it shows no change: close those gaps.
                    whole = parts(mask, 'rug', n) > .5
                    whole = nd.binary_fill_holes(nd.binary_closing(whole, iterations=9))
                    slots['rug'][n] = write(floor, n, image, blur(whole, 1) * (1 - alpha), report)
        entry['back'].append(write(floor, 'shadow', np.zeros((H, W, 3)) + [60, 38, 28], shadow, report))
        front = rect_mask(FRONT_RECTS) if floor == '1f' else np.zeros((H, W), bool)
        entry['back'].append(write(floor, 'fixtures', rgb, alpha * ~front, report))
        if front.any():
            entry['front'].append(write(floor, 'fixtures-front', rgb, alpha * front, report))
        # Table mats and centerpieces.
        slots['tablecloth'] = {}
        for n, (colour, pattern) in TABLECLOTHS.items():
            mat_rgb, mat_alpha = tablecloth(floor, colour, pattern)
            slots['tablecloth'][n] = write(floor, n, mat_rgb, mat_alpha, report)
        slots['centerpiece'] = {}
        if os.path.exists(take('1f', 'centerpieces')):
            sprites = centerpieces()
            scale = 86 / sprites[0].shape[0]
            for n, sprite in zip(['centerpiece_flowers', 'centerpiece_succulent', 'centerpiece_candle'], sprites):
                image = Image.fromarray(sprite.astype(np.uint8), 'RGBA')
                image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
                canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
                for cx, cy, rx, ry in TABLES[floor]:
                    canvas.alpha_composite(image, (round(cx - image.width / 2), round(cy + 2 - image.height)))
                layer = np.asarray(canvas).astype(np.float32)
                slots['centerpiece'][n] = write(floor, n, layer[..., :3], layer[..., 3] / 255, report)
        # Things added to the room.
        for slot, names, base_name in [('ceiling', ['ceiling_lights', 'ceiling_vines', 'ceiling_pendants', 'ceiling_chandelier'], 'shell'),
                                       ('neon', ['neon_cafe', 'neon_heart', 'neon_cup'], 'plate'),
                                       ('sill', ['sill_cactus', 'sill_tulips', 'sill_bonsai'], 'shell')]:
            slots[slot] = {}
            owner = '1f' if slot == 'ceiling' else floor
            base = shells[owner] if base_name == 'shell' else plates[owner]
            for n in names:
                if not os.path.exists(take(owner, n)):
                    continue
                image = load(take(owner, n))
                mask, drift = added(image, base, 60 if slot == 'neon' else 50)
                if n == 'neon_cup':
                    image, mask = lit_cup(image, base)
                drift_warnings.append((f'{owner}/{n}', drift))
                if slot == 'neon':
                    mask = mask * (1 - alpha)
                slots[slot][n] = write(floor, n, image, parts(mask, slot, n), report)
        # Counter and curtains.
        slots['counter'] = {}
        if floor == '1f':
            first = None
            for n in COUNTERS:
                if not os.path.exists(take(floor, n)):
                    continue
                c_rgb, c_alpha = key(take(floor, n))
                c_alpha = c_alpha * rect_mask([(COUNTER_RECT[0] - 60, COUNTER_RECT[1] - 60, COUNTER_RECT[2] + 60, COUNTER_RECT[3] + 40)])
                target = first if first is not None else changed(plate, shell, 60, 3, .5) & rect_mask([COUNTER_RECT])
                c_rgb, c_alpha, fit = align(c_rgb, c_alpha, target)
                report.append(f'{floor}/{n} align {fit}')
                if first is None:
                    first = c_alpha > .5
                # What stands on the counter is drawn over it (fixtures-front), so the counter stays whole.
                slots['counter'][n] = write(floor, n, c_rgb, c_alpha, report)
            entry['counterDepth'] = 525
        slots['curtain'] = {}
        if floor == '2f' and os.path.exists(take(floor, 'curtain')):
            c_rgb, c_alpha = key(take(floor, 'curtain'))
            c_rgb, c_alpha, fit = align(c_rgb, c_alpha, changed(plate, shell, 60, 3, .5) & rect_mask([WINDOW_RECT]))
            report.append(f'{floor}/curtain align {fit}')
            luma = c_rgb.mean(axis=2, keepdims=True)
            body = (c_alpha > .5) & (luma[..., 0] > 70)
            mean = luma[body].mean() if body.any() else 160
            for n, colour in CURTAINS.items():
                tinted = c_rgb if colour is None else np.where(luma > 70, np.array(colour, np.float32) * (luma / mean), c_rgb)
                slots['curtain'][n] = write(floor, n, tinted, c_alpha, report)
    os.makedirs(OUT, exist_ok=True)
    with open(f'{OUT}/decor.json', 'w') as f:
        json.dump(manifest, f, indent=1)
        f.write('\n')
    print('\n'.join(report))
    for name, drift in drift_warnings:
        if drift > 12:
            print(f'WARNING {name}: the rest of the picture moved (mean change {drift:.1f}); check its layer')


if __name__ == '__main__':
    sys.exit(main())
