#!/usr/bin/env python3
"""Create a deterministic, portable reserve gallery ZIP, never including game saves.
Run from anywhere with Python 3: python3 scripts/package-reserve-library.py
Only explicitly owned reserve artifacts and the hand-maintained galleries/docs are
included. Refuse symlinks and refuse to overwrite an archive edited by the user.
"""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKS = ('seasonal', 'workshop', 'neighborhood', 'hobby', 'travel', 'ambient')
OUT = ROOT / 'artifacts' / 'tiny-bean-reserve-library.zip'
RECEIPT = ROOT / 'artifacts' / 'tiny-bean-reserve-library.zip.sha256'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def checked(relative):
    raw = ROOT / relative
    absolute = raw.resolve()
    if not absolute.is_relative_to(ROOT) or not raw.is_file():
        raise ValueError(f'Outside/missing archive source: {relative}')
    for part in [raw, *raw.parents]:
        if part == ROOT:
            break
        if part.is_symlink():
            raise ValueError(f'Symlink archive source: {relative}')
    return absolute


def main():
    paths = set()
    for name in PACKS:
        directory = f'assets/generated/{name}-reserve-v1'
        index_path = f'{directory}/generated-file-index.json'
        index = json.loads(checked(index_path).read_text())
        if index['packId'] != f'{name}-reserve-v1':
            raise ValueError(f'Ownership index mismatch: {name}')
        for entry in index['files']:
            rel = entry['path']
            if Path(rel).is_absolute() or '..' in Path(rel).parts or '\\' in rel:
                raise ValueError(f'Unsafe owned path: {rel}')
            full = f'{directory}/{rel}'
            if digest(checked(full).read_bytes()) != entry['sha256']:
                raise ValueError(f'Generated file was edited: {full}')
            paths.add(full)
        paths.add(index_path)
        for manual in ('index.html', 'README.md'):
            rel = f'{directory}/{manual}'
            if (ROOT / rel).exists():
                checked(rel)
                paths.add(rel)
    for name in ('index.html', 'README.md', 'catalog.js', 'manifest.json', 'verification-report.json', 'overview.png', 'overview.json'):
        rel = f'assets/generated/reserve-library/{name}'
        checked(rel)
        paths.add(rel)
    for name in ('README.md', 'palette.json', 'palette.png', 'palette-spec.json'):
        rel = f'docs/art-grid/{name}'
        checked(rel)
        paths.add(rel)
    if OUT.is_symlink() or RECEIPT.is_symlink() or OUT.parent.is_symlink():
        raise ValueError('Refusing a symlink archive destination')
    if OUT.exists():
        if not RECEIPT.is_file() or digest(OUT.read_bytes()) != RECEIPT.read_text().strip():
            raise ValueError('Archive is user-modified/unowned; preserve it before repackaging')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    readme = ('Tiny Bean Cafe reserve library\n\n'
              'Open assets/generated/reserve-library/index.html in a browser.\n'
              'For animation previews open assets/generated/ambient-reserve-v1/index.html.\n'
              'Keep the folder structure intact. No server, internet or game save is needed.\n'
              '960 static PNGs (240 base designs with 4 variations) + 32 animation clips (256 frames).\n'
              'Atlas/strip copies do not count as new designs. All assets remain reserve-only.\n'
              'Original procedural pixel art; not AI image-model output.\n'
              'Generator scripts and production integration belong to the full source repository;\n'
              'this portable bundle contains images, metadata, previews, palette and notes only.\n'
              'References to game source files in documentation require the full repository.\n')
    landing = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
               '<meta name="viewport" content="width=device-width,initial-scale=1">'
               '<title>Tiny Bean Café 素材库</title>'
               '<style>body{max-width:720px;margin:10vh auto;padding:24px;background:#f5efdf;color:#44382e;font:18px/1.8 system-ui}a{display:block;padding:16px;margin:16px 0;background:#e3e9d8;color:#34533d;border-radius:8px}small{color:#7c6d5d}</style>'
               '<h1>小店素材仓库</h1><p>960 张静态 PNG · 240 种基础造型<br>32 段动画 · 256 帧</p>'
               '<a href="assets/generated/reserve-library/index.html">打开静态素材画廊 →</a>'
               '<a href="assets/generated/ambient-reserve-v1/index.html">打开动态特效预览 →</a>'
               '<small>离线可用，无需服务器。请保留目录结构。所有素材仅为储备，未自动接入游戏。</small></html>')
    contents = {'tiny-bean-reserve/START-HERE.txt': readme.encode('utf-8'),
                'tiny-bean-reserve/index.html': landing.encode('utf-8')}
    contents.update({f'tiny-bean-reserve/{rel}': checked(rel).read_bytes() for rel in sorted(paths)})
    with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(contents.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(OUT) as archive:
        if archive.testzip() is not None:
            raise ValueError('ZIP CRC verification failed')
        if len(archive.infolist()) != len(contents):
            raise ValueError('ZIP entry count mismatch')
        for name, data in contents.items():
            if archive.read(name) != data:
                raise ValueError(f'ZIP readback mismatch: {name}')
    sha = digest(OUT.read_bytes())
    RECEIPT.write_text(sha + '\n')
    print(json.dumps({'status': 'passed', 'archive': str(OUT.relative_to(ROOT)), 'files': len(contents), 'bytes': OUT.stat().st_size, 'sha256': sha, 'checks': ['source ownership SHA-256', 'no symlinks', 'ZIP CRC', 'every entry byte readback', 'fixed timestamps and sorted entries']}, indent=2))


if __name__ == '__main__':
    main()
