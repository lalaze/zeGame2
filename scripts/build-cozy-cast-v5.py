import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path('assets/generated/cozy-cast-v5')
OUT = Path('public/art/generated/cozy-cast-v5')
PALETTE = json.loads(Path('docs/art-grid/palette.json').read_text())['colors']
RAMPS = {}
for entry in PALETTE:
    RAMPS.setdefault(entry['ramp'], []).append(entry['hex'])


def rgb(value):
    return tuple(bytes.fromhex(value[1:]))


def canonical(image, head=False):
    result = image.copy()
    pixels = result.load()
    for row in range(result.height):
        for column in range(result.width):
            red, green, blue, alpha = pixels[column, row]
            if alpha < 128:
                pixels[column, row] = (0, 0, 0, 0)
                continue
            light = red * .299 + green * .587 + blue * .114
            ramp = None
            if head:
                if red > 160 and green > red * .60 and blue > red * .38:
                    ramp = 'skin-0'
                    shade = 0 if light < 170 else 1 if light < 224 else 2
                elif light < 48:
                    pixels[column, row] = (*rgb('#55301f'), 255)
                    continue
                else:
                    ramp = 'hair-option-0'
                    shade = 0 if light < 80 else 1 if light < 125 else 2
            elif blue > red * 1.06 and blue > green * 1.02:
                ramp = 'cloth-1'
                shade = 0 if light < 100 else 1 if light < 145 else 2
            elif blue > green * 1.13 and red > green * 1.10:
                ramp = 'pants-2'
                shade = 0 if light < 75 else 1 if light < 108 else 2
            elif red > 185 and red * .55 < green < red * .81 and blue > red * .32 and blue < red * .70:
                ramp = 'skin-0'
                shade = 0 if light < 170 else 1 if light < 224 else 2
            if ramp:
                pixels[column, row] = (*rgb(RAMPS[ramp][shade]), 255)
            else:
                candidates = RAMPS['porcelain'] if light > 155 else RAMPS['walnut'][1:4]
                value = min(candidates, key=lambda color: sum((channel - target) ** 2 for channel, target in zip((red, green, blue), rgb(color))))
                pixels[column, row] = (*rgb(value), 255)
    return result


def conform(image, name):
    source = ROOT / 'working' / ('compiled-' + name)
    image.save(source)
    subprocess.run(['node', 'scripts/pixel-conform.mjs', 'conform', str(source), '--out=' + str(OUT / name), '--width=' + str(image.width), '--height=' + str(image.height)], check=True)


def components(image, columns, count):
    mask = bytearray(1 if alpha >= 128 else 0 for alpha in image.getchannel('A').getdata())
    boxes = []
    for start in range(len(mask)):
        if not mask[start]:
            continue
        queue = [start]
        mask[start] = 0
        left = right = start % image.width
        top = bottom = start // image.width
        for index in queue:
            column, row = index % image.width, index // image.width
            left, right = min(left, column), max(right, column)
            top, bottom = min(top, row), max(bottom, row)
            neighbors = []
            if column: neighbors.append(index - 1)
            if column < image.width - 1: neighbors.append(index + 1)
            if row: neighbors.append(index - image.width)
            if row < image.height - 1: neighbors.append(index + image.width)
            for neighbor in neighbors:
                if mask[neighbor]:
                    mask[neighbor] = 0
                    queue.append(neighbor)
        if len(queue) > 500:
            boxes.append((len(queue), (left, top, right + 1, bottom + 1), queue))
    selected = sorted(boxes, key=lambda item: item[0], reverse=True)[:count]
    islands = {}
    for area, box, queue in selected:
        island = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]))
        for index in queue:
            column, row = index % image.width, index // image.width
            island.putpixel((column - box[0], row - box[1]), image.getpixel((column, row)))
        islands[box] = island
    boxes = [box for area, box, queue in selected]
    if len(boxes) != count:
        raise ValueError('Incomplete generated atlas components')
    boxes.sort(key=lambda box: (box[1] + box[3]) / 2)
    ordered = []
    for row in range(count // columns):
        ordered.extend(sorted(boxes[row * columns:(row + 1) * columns], key=lambda box: box[0]))
    return [islands[box] for box in ordered]


families = ['cardigan', 'stripe', 'overalls', 'scarf', 'jacket', 'vest', 'dress', 'hoodie', 'sailor', 'duffle', 'apron', 'sweater']
manifest = {'version': 5, 'density': 2, 'families': {}, 'heads': {}, 'materials': {key: RAMPS[key] for key in ['skin-0', 'hair-option-0', 'cloth-1', 'pants-2']}}
for sheet_index, sheet_name in enumerate(['bodies-a', 'bodies-b', 'bodies-c']):
    source = Image.open(ROOT / 'working' / (sheet_name + '.png')).convert('RGBA')
    boxes = components(source, 12, 48)
    for family_index in range(4):
        atlas = Image.new('RGBA', (64 * 12, 88))
        poses = []
        for pose_index in range(12):
            cell = boxes[family_index * 12 + pose_index]
            seated = pose_index >= 9
            body_height = 40 if seated else 42
            body_width = round(cell.width * body_height / cell.height)
            if seated:
                hip_cut = round(cell.height * .57)
                upper = cell.crop((0, 0, cell.width, hip_cut)).resize((body_width, 22), Image.Resampling.BOX)
                lower = cell.crop((0, hip_cut, cell.width, cell.height)).resize((body_width, 18), Image.Resampling.BOX)
                body = Image.new('RGBA', (body_width, body_height))
                body.alpha_composite(upper)
                body.alpha_composite(lower, (0, 22))
                if pose_index == 9:
                    arm_x = round(body_width * .55)
                    arm = body.crop((arm_x, 0, body_width, 21))
                    body.paste((0, 0, 0, 0), (arm_x, 0, body_width, 21))
                    body.alpha_composite(arm, (arm_x, -5))
                body = canonical(body)
            else:
                body = canonical(cell.resize((body_width, body_height), Image.Resampling.BOX))
            foot = [26, 82] if seated else [32, 84]
            body_left = 18 if seated else 32 - body_width // 2
            body_top = foot[1] - body_height
            atlas.alpha_composite(body, (pose_index * 64 + body_left, body_top))
            neck_x = body_left + round(body_width * (.30 if seated else .32 if pose_index >= 6 else .50))
            hand = [body_left + body_width - 3, 45 if pose_index == 9 else 57 if pose_index == 10 else 61] if seated else [body_left + body_width - 3, body_top + 22]
            poses.append({'box': [pose_index * 64, 0, (pose_index + 1) * 64, 88], 'neck': [neck_x, body_top + 2], 'foot': foot, 'hip': [26, 64] if seated else [32, 62], 'hand': hand})
        family = families[sheet_index * 4 + family_index]
        conform(atlas, family + '.png')
        manifest['families'][family] = {'file': family + '.png', 'poses': poses}

source = Image.open(ROOT / 'working/heads.png').convert('RGBA')
boxes = components(source, 3, 24)
atlas = Image.new('RGBA', (48 * 3, 48 * 8))
poses = []
for style in range(8):
    for direction in range(3):
        cell = boxes[style * 3 + direction]
        head_height = 44 if style in [2, 4, 6, 7] else 40
        head_width = min(42, round(cell.width * head_height / cell.height))
        head = canonical(cell.resize((head_width, head_height), Image.Resampling.BOX), True)
        head_left = 24 - head_width // 2
        head_top = 2
        draw = ImageDraw.Draw(head)
        dark = Image.new('RGBA', cell.size)
        dark_pixels = dark.load()
        for row in range(cell.height):
            for column in range(cell.width):
                red, green, blue, alpha = cell.getpixel((column, row))
                if alpha and red * .299 + green * .587 + blue * .114 < 38:
                    dark_pixels[column, row] = (0, 0, 0, 255)
        eye_boxes = []
        if direction != 1:
            mask = dark.getchannel('A')
            for row in range(round(cell.height * .45), round(cell.height * .85)):
                for column in range(round(cell.width * .20), round(cell.width * .90)):
                    if mask.getpixel((column, row)) != 255:
                        continue
                    ImageDraw.floodfill(mask, (column, row), 128)
                    region = mask.point(lambda value: 255 if value == 128 else 0).getbbox()
                    if region:
                        left, top, right, bottom = region
                        middle = (top + bottom) // 2
                        adjacent = [cell.getpixel((max(0, left - 3), middle)), cell.getpixel((min(cell.width - 1, right + 3), middle))]
                        skin_neighbors = all(red > 150 and green > 90 and blue > 60 for red, green, blue, alpha in adjacent)
                        if bottom - top > right - left and bottom - top < cell.height * .25 and skin_neighbors:
                            eye_boxes.append(region)
                    mask = mask.point(lambda value: 0 if value == 128 else value)
        eyes = []
        eye_boxes.sort(key=lambda box: (box[2] - box[0]) * (box[3] - box[1]), reverse=True)
        for left, top, right, bottom in sorted(eye_boxes[:2 if direction == 0 else 1]):
            eye_x = round((left + right) / 2 * head_width / cell.width) - 1
            eye_y = round(top * head_height / cell.height)
            draw.rectangle((eye_x - 1, eye_y - 1, eye_x + 3, eye_y + 5), fill=RAMPS['skin-0'][1])
            draw.rectangle((eye_x, eye_y, eye_x + 1, eye_y + 3), fill='#291711')
            draw.point((eye_x, eye_y), fill='#fbf2d9')
            eyes.append([head_left + eye_x, head_top + eye_y])
        if eyes:
            mouth_x = round(sum(eye[0] for eye in eyes) / len(eyes)) - head_left + 1
            mouth_y = max(eye[1] for eye in eyes) - head_top + 7
            if mouth_y < head_height - 1:
                draw.line((mouth_x, mouth_y, mouth_x + 1, mouth_y), fill='#87594b', width=1)
            for eye_x, eye_y in eyes:
                cheek_x, cheek_y = eye_x - head_left - 2, eye_y - head_top + 5
                if 0 <= cheek_x < head_width - 1 and cheek_y < head_height and head.getpixel((cheek_x, cheek_y))[3]:
                    draw.line((cheek_x, cheek_y, cheek_x + 1, cheek_y), fill='#d59c81', width=1)
        atlas.alpha_composite(head, (direction * 48 + head_left, style * 48 + head_top))
        skin_points = [(column, row) for row in range(head_height) for column in range(head_width) if head.getpixel((column, row))[:3] == rgb(RAMPS['skin-0'][1])]
        neck_y = head_top + (round(head_height * .80) if style in [2, 4, 6, 7] else head_height - 1)
        neck_x = head_left + (round(sum(column for column, row in skin_points) / len(skin_points)) if skin_points else head_width // 2)
        band_y = round(head_height * .28)
        band_pixels = [column for column in range(head_width) if head.getpixel((column, band_y))[3]]
        band = [head_left + min(band_pixels) + 2, head_top + band_y, max(band_pixels) - min(band_pixels) - 3]
        poses.append({'box': [direction * 48, style * 48, direction * 48 + 48, style * 48 + 48], 'neck': [neck_x, neck_y], 'eyes': eyes, 'top': head_top, 'band': band})
conform(atlas, 'heads.png')
manifest['heads'] = {'file': 'heads.png', 'poses': poses}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
files = list((ROOT / 'sources').glob('*.png')) + list(OUT.glob('*')) + list(ROOT.glob('*.md'))
files += [ROOT / 'generation.json']
files += [Path('scripts/build-cozy-cast-v5.py'), Path('docs/art-grid/palette.json'), Path('public/art/generated/cozy-team-v7/hair-0-short-v1.png'), Path('public/art/generated/cafe-style-sample-v1/sample.png')]
hashes = {str(file): hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted(files)}
(ROOT / 'hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')
