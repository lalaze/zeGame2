"""Read-only source/crop integrity evidence. This does not validate game rendering."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('manifests', nargs='+')
parser.add_argument('--output', required=True)
args = parser.parse_args()
reports = []
for input_path in args.manifests:
    manifest_path = Path(input_path).resolve()
    data = json.loads(manifest_path.read_text())
    rows = data.get('frames', data.get('assets', []))
    report = {'manifest': str(manifest_path), 'count': len(rows), 'assets': [], 'errors': []}
    seen = {}
    for row in rows:
        identity = row.get('itemId', row.get('ingredientId', row.get('id', '')))
        pose = '-'.join(str(row[k]) for k in ('direction', 'state') if row.get(k))
        ident = '/'.join(part for part in (str(identity), pose) if part) or 'unknown'
        result = {'id': ident}
        try:
            path = Path(row['file'])
            if not path.is_absolute():
                path = manifest_path.parent / path
            source = Path(row['source'])
            if not source.is_absolute():
                source = manifest_path.parent / source
            box = row.get('source_crop', row.get('sourceCrop'))
            assert isinstance(box, list) and len(box) == 4, 'Missing explicit source crop'
            assert all(isinstance(v, int) for v in box), 'Crop must use integer pixel coordinates'
            with Image.open(path) as source_crop, Image.open(source) as source_image:
                image = source_crop.convert('RGBA')
                original = source_image.convert('RGBA')
                assert 0 <= box[0] < box[2] <= original.width and 0 <= box[1] < box[3] <= original.height, 'Crop extends outside source'
                assert list(image.size) == row['size'], 'Declared image size differs'
                expected = original.crop(box)
                assert image.size == expected.size and image.tobytes() == expected.tobytes(), 'Crop RGBA differs from original source rectangle'
                alpha = image.getchannel('A')
                bbox = alpha.point(lambda n: 255 if n > 128 else 0).getbbox()
                assert bbox, 'No visible silhouette above alpha128'
                expected_bbox = {'x': bbox[0], 'y': bbox[1], 'w': bbox[2]-bbox[0], 'h': bbox[3]-bbox[1]}
                assert row.get('bbox', row.get('bboxAlpha128')) == expected_bbox, 'Declared opaque QA bounding box differs'
                digest = hashlib.sha256(image.tobytes()).hexdigest()
                if digest in seen:
                    report['errors'].append(f'{ident}: exact repeated RGBA from {seen[digest]} (review animation identity)')
                seen[digest] = ident
                result.update(size=list(image.size), alpha_extrema=alpha.getextrema(), rgba_sha256=digest,
                              file_sha256=hashlib.sha256(path.read_bytes()).hexdigest(), exact_source_crop=True)
        except Exception as error:
            result['error'] = str(error)
            report['errors'].append(f'{ident}: {error}')
        report['assets'].append(result)
    reports.append(report)
result = {'scope': 'File existence, dimensions, alpha bounds, exact source RGBA crop, duplicate pixel evidence only; no runtime or aesthetic pass',
          'manifests': reports, 'total_assets': sum(r['count'] for r in reports), 'errors': sum(len(r['errors']) for r in reports)}
Path(args.output).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'manifests': len(reports), 'assets': result['total_assets'], 'errors': result['errors']}))
raise SystemExit(1 if result['errors'] else 0)
