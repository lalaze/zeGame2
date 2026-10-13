#!/usr/bin/env python3
"""Losslessly crop the user-selected main-room art. No recoloring or masking.

Only PNG crop/save and byte-identical source copies are performed. All RGBA
samples, including nearly transparent colored fringes, remain unchanged.
Run with --verify-only to check every output pixel and source-copy byte again.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path('/workspace/scratch/30a3201ff9cd/cafe-assets-v1')
DEFAULT_OUTPUT = ROOT / 'public/art/generated/main-v1'
DEFAULT_ARCHIVE = ROOT / 'assets/generated/main-v1'
SOURCES = {
    'furniture': 'tiny-bean-furniture-sample-v1.png',
    'characters-plants': 'tiny-bean-characters-plants-sample-v1.png',
}
# Rectangles use x, y, width, height; the right/bottom edges are exclusive.
# Anchor source points are advisory, manually identified visible contact points.
ASSETS = [
    ('cabinet-full', 'furniture', (24, 72, 808, 360), (416, 422),
     'Front floor-contact center; preserve source aspect ratio. Archive/reference full cabinet.'),
    ('cabinet-top', 'furniture', (110, 96, 580, 60), (400, 126),
     'Center of an interior wood-plane tile. Excludes the slab silhouette, diagonal side and black front edge; existing counter geometry supplies its exterior frame.'),
    ('cabinet-front', 'furniture', (312, 226, 190, 138), (407, 361),
     'Bottom center of the complete central carved panel. Repeat/crop modules horizontally; do not stretch the complete cabinet.'),
    ('plant', 'characters-plants', (288, 560, 432, 448), (500, 997),
     'Terracotta pot floor-contact center; scale uniformly and retain existing gameplay foot position.'),
    ('vine', 'characters-plants', (852, 571, 388, 453), (1144, 774),
     'Pot bottom/contact point, NOT the trailing-vine tip. Align this point with the counter or shelf; scale uniformly.'),
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_stats(image: Image.Image) -> dict:
    alpha = image.getchannel('A')
    hist = alpha.histogram()
    total = image.width * image.height
    bounds = {}
    for threshold in (0, 31, 127, 223):
        box = alpha.point(lambda value: 255 if value > threshold else 0).getbbox()
        bounds[f'greaterThan{threshold}'] = list(box) if box else None
    return {
        'pixelCount': total,
        'minimum': alpha.getextrema()[0],
        'maximum': alpha.getextrema()[1],
        'alpha0': hist[0],
        'alpha1to31': sum(hist[1:32]),
        'alpha32to63': sum(hist[32:64]),
        'alpha64to127': sum(hist[64:128]),
        'alpha128to223': sum(hist[128:224]),
        'alpha224to254': sum(hist[224:255]),
        'alpha255': hist[255],
        'nonzeroFraction': round((total - hist[0]) / total, 8),
        'localBoundsExclusive': bounds,
    }


def source_box(rect: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x, y, width, height = rect
    return x, y, x + width, y + height


def verify(output: Path, manifest: dict, originals: Path | None = None, archive: Path | None = None) -> dict:
    archive = archive or ROOT / manifest['storageRoots']['archive']
    source_images = {}
    for source_id, entry in manifest['sources'].items():
        copied = archive / entry['file']
        assert sha256(copied) == entry['sha256'], f'Source SHA mismatch: {copied}'
        if originals is not None:
            assert copied.read_bytes() == (originals / entry['originalFilename']).read_bytes(), f'Source copy differs: {copied}'
        image = Image.open(copied)
        image.load()
        assert image.mode == entry['mode'] == 'RGBA'
        source_images[source_id] = image

    compared = 0
    for entry in manifest['assets']:
        path = (archive if entry['storage'] == 'archive' else output) / entry['file']
        result = Image.open(path)
        result.load()
        rect = entry['sourceRect']
        expected = source_images[entry['source']].crop(source_box((rect['x'], rect['y'], rect['width'], rect['height'])))
        assert result.mode == expected.mode == 'RGBA'
        assert result.size == expected.size
        # This is a full byte-for-byte comparison of every R, G, B and A sample,
        # including RGB values underneath alpha zero. No visual tolerance.
        assert result.tobytes() == expected.tobytes(), f'Pixel mismatch: {entry["file"]}'
        assert sha256(path) == entry['sha256']
        assert hashlib.sha256(result.tobytes()).hexdigest() == entry['rgbaPixelsSha256']
        assert alpha_stats(result) == entry['alpha']
        compared += result.width * result.height
    return {'passed': True, 'assetCount': len(manifest['assets']), 'rgbaPixelsCompared': compared, 'sourceCopiesByteIdentical': True}


def archive_legacy_files(output: Path, archive: Path) -> None:
    """Move earlier public originals/reference PNG out of service-worker scope."""
    (archive / 'sources').mkdir(parents=True, exist_ok=True)
    moves = [(output / 'cabinet-full.png', archive / 'cabinet-full.png')]
    moves += [(output / 'sources' / name, archive / 'sources' / name) for name in SOURCES.values()]
    for old, new in moves:
        if not old.exists():
            continue
        if new.exists() and old.read_bytes() != new.read_bytes():
            raise RuntimeError(f'Refusing to overwrite a different archived file: {new}')
        original_sha = sha256(old)
        old.replace(new)
        assert sha256(new) == original_sha, f'Archive move changed bytes: {new}'
    old_sources = output / 'sources'
    if old_sources.exists() and not any(old_sources.iterdir()):
        old_sources.rmdir()


def pack(source_dir: Path, output: Path, archive: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    archive_legacy_files(output, archive)
    manifest = {
        'schemaVersion': 2,
        'storageRoots': {
            'pathBase': 'repository root',
            'runtime': Path(os.path.relpath(output, ROOT)).as_posix(),
            'archive': Path(os.path.relpath(archive, ROOT)).as_posix(),
        },
        'purpose': 'Lossless cutouts from user-selected imagegen assets for the main-room slice only.',
        'operation': 'Rectangular RGBA crop only; no resize, recolor, alpha edits, background removal, interpolation or redrawing.',
        'coordinateConvention': 'Source rectangles: x/y/width/height; bounds are right/bottom exclusive. Anchor suggestions are crop-local source pixels.',
        'sources': {},
        'assets': [],
        'risks': [
            'Source PNGs and the unused complete-cabinet cutout are archived outside public/. Only four runtime PNGs are shipped; archive file references are repository paths, not public URLs.',
            'Both selected sources have alpha maximum 254, with zero fully opaque alpha-255 pixels. This is preserved exactly.',
            'Low-alpha colored fringe/glow remains around silhouettes and within rectangular crops. It may produce visible tinted halos on light backgrounds.',
            'Cabinet modules are literal rectangular cuts. Their crop boundary may cross continuous wood; module joins need visual review at integration.',
            'Plants are isolated below the people. The right shoe has alpha>127 pixels through source y561; the vine crop starts at y571, above its first solid leaf at y579.',
            'Anchor suggestions are manual contact-point estimates, not generated hitboxes. Existing gameplay collision/foot positions must remain authoritative.',
        ],
    }
    images = {}
    for source_id, filename in SOURCES.items():
        original = source_dir / filename
        copied = archive / 'sources' / filename
        if copied.exists():
            if copied.read_bytes() != original.read_bytes():
                raise RuntimeError(f'Refusing to overwrite a different archived source: {copied}')
        else:
            shutil.copyfile(original, copied)
        image = Image.open(original)
        image.load()
        assert image.mode == 'RGBA' and image.size == (1536, 1024), f'Unexpected selected source: {original}'
        images[source_id] = image
        manifest['sources'][source_id] = {
            'originalFilename': filename,
            'storage': 'archive',
            'file': f'sources/{filename}',
            'repositoryFile': (Path(manifest['storageRoots']['archive']) / 'sources' / filename).as_posix(),
            'sha256': sha256(original),
            'size': {'width': image.width, 'height': image.height},
            'mode': image.mode,
            'alpha': alpha_stats(image),
        }

    for asset_id, source_id, rect, source_anchor, note in ASSETS:
        x, y, width, height = rect
        crop = images[source_id].crop(source_box(rect))
        filename = f'{asset_id}.png'
        storage = 'archive' if asset_id == 'cabinet-full' else 'runtime'
        path = (archive if storage == 'archive' else output) / filename
        crop.save(path, format='PNG')
        ax, ay = source_anchor[0] - x, source_anchor[1] - y
        manifest['assets'].append({
            'id': asset_id, 'file': filename,
            'storage': storage,
            'repositoryFile': (Path(manifest['storageRoots'][storage]) / filename).as_posix(),
            **({'url': f'/art/generated/main-v1/{filename}'} if storage == 'runtime' else {}),
            'source': source_id,
            'sourceSha256': manifest['sources'][source_id]['sha256'],
            'sourceRect': {'x': x, 'y': y, 'width': width, 'height': height},
            'size': {'width': width, 'height': height},
            'sha256': sha256(path),
            'rgbaPixelsSha256': hashlib.sha256(crop.tobytes()).hexdigest(),
            'alpha': alpha_stats(crop),
            'anchorSuggestion': {
                'sourcePixels': list(source_anchor), 'localPixels': [ax, ay],
                'normalized': [round(ax / width, 8), round(ay / height, 8)],
                'note': note,
            },
            'pixelVerification': 'Every output RGBA sample equals the corresponding original source sample, including hidden RGB under alpha zero.',
        })
    manifest['verification'] = verify(output, manifest, source_dir, archive)
    manifest['runtimePngBytes'] = sum((output / asset['file']).stat().st_size for asset in manifest['assets'] if asset['storage'] == 'runtime')
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--archive-dir', type=Path, default=None,
                        help='Non-public source/reference archive (default: assets/generated/main-v1).')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if args.verify_only:
        manifest = json.loads((args.output_dir / 'manifest.json').read_text(encoding='utf-8'))
        result = verify(args.output_dir, manifest, archive=args.archive_dir)
    else:
        manifest = pack(args.source_dir, args.output_dir, args.archive_dir or DEFAULT_ARCHIVE)
        result = manifest['verification']
    print(json.dumps(result, ensure_ascii=False))
    for asset in manifest['assets']:
        print(f'{asset.get("url", asset["repositoryFile"])} {asset["size"]["width"]}x{asset["size"]["height"]}')
    print(f'Runtime PNG bytes: {manifest["runtimePngBytes"]}; public directory total: '
          f'{sum(path.stat().st_size for path in args.output_dir.rglob("*") if path.is_file())}')


if __name__ == '__main__':
    main()
