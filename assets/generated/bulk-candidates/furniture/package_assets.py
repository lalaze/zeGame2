"""Only lossless source copying, rectangular cropping, measurement and packing."""
from PIL import Image, ImageChops
from pathlib import Path
import json, shutil, hashlib

ROOT = Path(__file__).parent
catalog = json.loads(Path('/workspace/shared/zeGame2/docs/pixel-depth/BULK-ASSET-CATALOG.json').read_text())
definitions = {a['id']: a for a in catalog['furniture']}
assets = []
for batch in sorted(ROOT.glob('batch-*.json')):
    specs = json.loads(batch.read_text())
    batch_assets = []
    crops = []
    for spec in specs:
        id = spec['id']
        original = Path(spec['sourcePath'])
        source = ROOT / 'sources' / (id + '-source.png')
        shutil.copy2(original, source)
        im = Image.open(source).convert('RGBA')
        alpha = im.getchannel('A')
        bbox = alpha.point(lambda a: 255 if a > 128 else 0).getbbox()
        assert bbox and alpha.getextrema()[0] == 0, id
        x0, y0, x1, y1 = bbox
        box = [max(0, x0 - 10), max(0, y0 - 10), min(im.width, x1 + 10), min(im.height, y1 + 10)]
        crop = im.crop(box)
        dest = ROOT / (id + '.png')
        crop.save(dest)
        assert ImageChops.difference(Image.open(dest), im.crop(box)).getbbox() is None
        bw, bh = x1 - x0, y1 - y0
        bx, by = x0 - box[0], y0 - box[1]
        target = definitions[id]['logicalSprite']
        fit = min(target[0] / bw, target[1] / bh)
        rec = {
            'id': id, 'file': str(dest), 'source': str(source), 'sourceSize': list(im.size),
            'sourceCrop': box, 'size': list(crop.size),
            'bbox': {'x': bx, 'y': by, 'w': bw, 'h': bh}, 'bboxAlphaThreshold': '>128',
            'surface': spec['surface'], 'logicalEnvelope': target,
            'footprintCells': definitions[id]['footprintCells'],
            'anchor': {'x': bx + bw / 2, 'y': by + bh - 1, 'kind': 'foot-bottom-center' if spec['surface'] == 'floor' else 'wall-bottom-center'},
            'center': {'x': bx + bw / 2, 'y': by + bh / 2},
            'aspectPreservingFit': {'visibleWidth': round(bw * fit, 3), 'visibleHeight': round(bh * fit, 3)},
            'alphaExtrema': list(crop.getchannel('A').getextrema()),
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'cropSha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
            'losslessCropVerified': True,
            'edgeAlphaMax': max(crop.getchannel('A').crop((0, 0, crop.width, 1)).getextrema()[1], crop.getchannel('A').crop((0, crop.height-1, crop.width, crop.height)).getextrema()[1], crop.getchannel('A').crop((0,0,1,crop.height)).getextrema()[1], crop.getchannel('A').crop((crop.width-1,0,crop.width,crop.height)).getextrema()[1]),
        }
        if id in ['lamp', 'lantern']: rec['dynamicOverlay'] = 'Keep runtime glow separate; sprite has opaque lit glass/fabric only.'
        if id == 'art_starry': rec['dynamicOverlay'] = 'Static night painting base; preserve runtime twinkle as a separate optional overlay.'
        if id == 'aframe': rec['dynamicOverlay'] = 'Blank board; draw any real gameplay writing separately.'
        if abs((bw / bh) / (target[0] / target[1]) - 1) > .15: rec['fitNote'] = 'Generated silhouette ratio differs from old logical envelope; uniform fit and pad. Do not stretch.'
        batch_assets.append(rec); crops.append(crop)
    columns = 4
    rows = (len(crops) + columns - 1) // columns
    gap = 48
    cw = [max([im.width for i, im in enumerate(crops) if i % columns == col] or [0]) for col in range(columns)]
    rh = [max(im.height for im in crops[row*columns:(row+1)*columns]) for row in range(rows)]
    sheet = Image.new('RGBA', (sum(cw)+gap*(columns+1), sum(rh)+gap*(rows+1)), (0,0,0,0))
    for i, (rec, crop) in enumerate(zip(batch_assets, crops)):
        col, row = i % columns, i // columns
        x = gap + sum(cw[:col]) + gap*col + (cw[col]-crop.width)//2
        y = gap + sum(rh[:row]) + gap*row + (rh[row]-crop.height)//2
        sheet.paste(crop, (x,y))
        rec['sheet'] = 'sheet-' + batch.stem + '.png'
        rec['sheetRect'] = {'x':x,'y':y,'w':crop.width,'h':crop.height}
    sheet.save(ROOT / ('sheet-' + batch.stem + '.png'))
    assets.extend(batch_assets)
manifest = {
    'version':1, 'status':'Asset generation only; no integration, repository writes or in-game verification.',
    'generation':'Built-in imagegen, one call per distinct asset; full prompts in PROMPTS.json.',
    'processing':'Original source copy, alpha >128 bbox measurement, rectangular crop with 10px margin, lossless unscaled sheet packing. No repaint, masking, color alteration or alpha cleanup.',
    'assets':assets,
    'limitations':['Generated silhouette ratios vary; fit uniformly into original logical envelopes.', 'Some very faint generated alpha noise remains beyond the >128 silhouette; sources preserve all of it and crops preserve every pixel in their crop.', 'Fine detail simplifies at old tiny logical resolutions; in-game readability and visual scale must be verified later.']
}
(ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps({'count':len(assets),'ids':[a['id'] for a in assets], 'ratioCautions':[a['id'] for a in assets if 'fitNote' in a], 'edgeAlphaMax':max([a['edgeAlphaMax'] for a in assets] or [0])}, indent=2))
