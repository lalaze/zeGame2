"""Merge candidate metadata and verify existing lossless crops; does not edit images."""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT = Path('/workspace/scratch/30a3201ff9cd')
OUT = ROOT / 'cafe-decor-bulk-v1'
CAT = Path('/workspace/shared/zeGame2/docs/pixel-depth/BULK-ASSET-CATALOG.json')
MATERIALS = OUT / 'materials-manifest.json'
PROPS = ROOT / 'cafe-decor-props-v1/manifest.json'

def read(p):
    return json.loads(p.read_text())

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

catalog = read(CAT)['decor']
materials, props = read(MATERIALS), read(PROPS)
assets = materials['assets'] + props['assets']
aliases = materials['aliases']
slots = {x['id']: x['slot'] for x in catalog}
errors = []
records = []
for entry in assets + aliases:
    entry['slot'] = slots[entry['id']]
    entry['sourceCropConvention'] = '[left, top, right-exclusive, bottom-exclusive]'
    file, source = Path(entry['file']), Path(entry['source'])
    if not file.is_file() or not source.is_file():
        errors.append(f"Missing file/source: {entry['id']}:{entry['state']}")
        continue
    with Image.open(file) as f, Image.open(source) as s:
        image, original = f.convert('RGBA'), s.convert('RGBA')
        crop = original.crop(entry['source_crop'])
        equal = crop.size == image.size and crop.tobytes() == image.tobytes()
        if not equal:
            errors.append(f"RGBA crop mismatch: {entry['id']}:{entry['state']}")
        bbox = image.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        measured = dict(x=bbox[0], y=bbox[1], w=bbox[2]-bbox[0], h=bbox[3]-bbox[1])
        if 'bbox' in entry and entry['bbox'] != measured:
            errors.append(f"BBox mismatch: {entry['id']}:{entry['state']}")
        if list(image.size) != entry['size']:
            errors.append(f"Size mismatch: {entry['id']}:{entry['state']}")
        if 'fileSha256' in entry and entry['fileSha256'] != sha(file):
            errors.append(f"File hash mismatch: {entry['id']}:{entry['state']}")
        if 'sourceSha256' in entry and entry['sourceSha256'] != sha(source):
            errors.append(f"Source hash mismatch: {entry['id']}:{entry['state']}")
        entry.update(bbox=measured, bboxAlphaThreshold='>128', sourceSize=list(original.size),
                     nativeAspect=image.width/image.height, alphaExtrema=list(image.getchannel('A').getextrema()),
                     fileSha256=sha(file), sourceSha256=sha(source), losslessCropVerified=equal)
        if entry in aliases:
            entry['kind'] = 'counter-module'
            entry['anchor'] = dict(x=measured['x'], y=measured['y'], kind='module-origin')
            entry['notes'] = ['Existing oak cabinet art reuse candidate. Preserve native aspect; integration geometry remains unvalidated.']
        records.append(dict(id=entry['id'], state=entry['state'], file=str(file), rgbaCropExact=equal,
                            sourceSize=list(original.size), cropSize=list(image.size),
                            alphaExtrema=entry['alphaExtrema'], fileSha256=sha(file)))

expected = {x['id'] for x in catalog if x['needsBitmap']}
actual = {x['id'] for x in assets + aliases}
excluded = [dict(id=x['id'], slot=x['slot'], reason='Explicit none option; no bitmap required.')
            for x in catalog if not x['needsBitmap']]
missing, unexpected = sorted(expected-actual), sorted(actual-expected)
duplicate = [list(k) for k,v in Counter((x['id'],x['state']) for x in assets+aliases).items() if v>1]
if missing or unexpected or duplicate:
    errors.append(dict(missing=missing, unexpected=unexpected, duplicateIdStates=duplicate))
frozen = datetime.now(timezone.utc).isoformat()
manifest = dict(version=1, domain='decor', status='Frozen source candidates; runtime integration and aesthetic acceptance pending.',
    frozenSourceCandidates=True, frozenAt=frozen, generatedIdCount=len({x['id'] for x in assets}),
    generatedPngCount=len(assets), reusedIdCount=len({x['id'] for x in aliases}), reusedPngCount=len(aliases),
    coveredIdCount=len(actual), expectedBitmapIdCount=len(expected), missingIds=missing, unexpectedIds=unexpected,
    excludedNoBitmap=excluded, assets=assets, aliases=aliases,
    inputManifests=[dict(file=str(p),sha256=sha(p)) for p in (MATERIALS,PROPS)],
    catalog=dict(file=str(CAT),sha256=sha(CAT)),
    processing='Built-in imagegen for substantive art. Only lossless rectangular crops and unscaled repeat-proof packing; no recolor, redraw, alpha cleanup or resizing.',
    knownLimitations=[
      'Tiles are repeat candidates, not guaranteed mathematically seamless. Herringbone and marble especially need runtime seam/density review; source periods and native 2x2 proofs are provided.',
      'Use uniform fitting and deliberate material world scale. Nominal legacy motif dimensions are not instructions to squeeze full material crops.',
      'Counter tops/fronts are independent modules with native ratios different from legacy envelopes; geometry adaptation remains pending.',
      'Chandelier reaches source top and bottom; pendant cord reaches top. These are source-edge limitations, not crop-induced truncation.',
      'Blank neon_cafe frame is slimmer than nominal 3:1; dynamic text remains separate. Red/blue rugs have left/right fringe.',
      'Fine low-alpha fringe is preserved inside rectangles. Full immutable source retains alpha=1 outlier pixels outside some prop crops.',
      'All world/shop consistency, scale, z-order, animation/glow layers and runtime visual checks remain integration tasks.'
    ])
mp = OUT / 'renderer-manifest.json'
mp.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
audit = dict(frozenAt=frozen, manifest=str(mp), manifestSha256=sha(mp), structuralErrors=errors,
             generatedPngCount=len(assets), aliasPngCount=len(aliases), coveredIdCount=len(actual),
             expectedIdCount=len(expected), excludedNoBitmapCount=len(excluded), missingIds=missing,
             unexpectedIds=unexpected, duplicateIdStates=duplicate, checkedFiles=records,
             scope='File existence, source RGBA crop equality, measured bbox, dimensions, hashes, exact catalog coverage. Does not assert runtime aesthetic acceptance.')
(OUT/'audit-report.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False)+'\n')
allfiles = sorted({Path(x[k]) for x in assets+aliases for k in ('file','source')} | {mp,MATERIALS,PROPS})
(OUT/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p}\n' for p in allfiles))
print(json.dumps({k:v for k,v in audit.items() if k!='checkedFiles'},indent=2))
if errors:
    raise SystemExit(1)
