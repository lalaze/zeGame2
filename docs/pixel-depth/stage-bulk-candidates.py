"""Stage frozen authored candidates only. Never modifies runtime code/preload.

Input: JSON domains [{name, root, manifests:[paths]}]. Only PNGs selected by
final manifest file/source fields are copied. Other PNGs (old failures, contact
sheets and duplicate packed proofs) are excluded. Original JSON is retained
beside portable JSON so authoring metadata remains recoverable.
"""
import argparse, hashlib, json, os, shutil
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('spec')
p.add_argument('--destination', required=True)
p.add_argument('--write', action='store_true')
p.add_argument('--refresh-metadata', action='store_true')
a = p.parse_args()
spec = json.loads(Path(a.spec).read_text())
destination = Path(a.destination).resolve()
repo = Path(spec['repo']).resolve()
selected = {}
metadata = {}
mapping = {}
rows = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values(): yield from walk(child)
    elif isinstance(value, list):
        for child in value: yield from walk(child)

for domain in spec['domains']:
    root = Path(domain['root']).resolve()
    for m in domain['manifests']:
        manifest = Path(m).resolve()
        for row in walk(json.loads(manifest.read_text())):
            if not ('file' in row and 'source' in row): continue
            if not row.get('source_crop', row.get('sourceCrop')): continue
            for key, category in [('source', 'source'), ('file', 'crop')]:
                original = Path(row[key])
                if not original.is_absolute(): original = manifest.parent / original
                original = original.resolve()
                if not original.is_file(): raise ValueError(f'Missing selected {original}')
                if original.is_relative_to(repo):
                    mapping[str(original)] = original
                    continue
                relative = original.relative_to(root)
                failed = category == 'crop' and str(row.get('status', '')).startswith('failed')
                target = destination / domain['name'] / ('failed-frames' if failed else '') / relative
                record = {'domain': domain['name'], 'category': category, 'sourcePath': str(original),
                          'path': str(target.relative_to(destination)), 'bytes': original.stat().st_size,
                          'sha256': digest(original), 'status': ('retained_original_source' if category == 'source' else row.get('status', 'candidate_pending_runtime_review'))}
                if original in selected and selected[original]['path'] != record['path']:
                    raise ValueError(f'Conflicting selected path {original}')
                selected[original] = record
                mapping[str(original)] = target
    for original in root.rglob('*'):
        if not original.is_file() or original.suffix.lower() not in {'.json', '.md', '.txt', '.py'}: continue
        if any(part in {'rejected', '__pycache__'} for part in original.relative_to(root).parts): continue
        if original.name.startswith('UNUSED-'): continue
        target = destination / domain['name'] / original.relative_to(root)
        metadata[original] = target
        mapping[str(original.resolve())] = target

for extra in spec.get('extraMetadata', []):
    original = Path(extra['source']).resolve()
    if not original.is_file(): raise ValueError(f'Missing extra metadata {original}')
    target = destination / extra['path']
    metadata[original] = target
    mapping[str(original)] = target

# Resolve references to already-committed/integrated images without duplicating.
existing_hash = {r['sha256']: destination / r['path'] for r in selected.values()}
for image in (repo / 'public/art/generated').rglob('*.png'):
    existing_hash.setdefault(digest(image), image)

unresolved = set()
def portable(value, original_json, target_json):
    if isinstance(value, dict):
        result = {k: portable(v, original_json, target_json) for k,v in value.items()
                  if k not in {'sheet', 'sheetRect', 'repeatProof'}}
        omitted = {k: value[k] for k in ('sheet', 'sheetRect', 'repeatProof') if k in value}
        if omitted:
            result['omittedRegenerableProofMetadata'] = omitted
        return result
    if isinstance(value, list): return [portable(v, original_json, target_json) for v in value]
    if not isinstance(value, str): return value
    candidate = Path(value)
    # Only transform exact existing path values, never prose or prompts.
    if len(value) > 4096 or '\n' in value: return value
    try:
        original_path = candidate if candidate.is_absolute() else original_json.parent / candidate
        original_path = original_path.resolve()
        target = mapping.get(str(original_path))
        if target is None and original_path.is_file() and original_path.suffix.lower() == '.png':
            target = existing_hash.get(digest(original_path))
        if target is None and original_path.is_file() and original_path.is_relative_to(repo): target = original_path
        if target is not None: return os.path.relpath(target, target_json.parent)
        if candidate.is_absolute() and original_path.is_file(): unresolved.add(value)
    except (OSError, ValueError): pass
    return value

if a.write:
    if destination.exists() and not a.refresh_metadata: raise ValueError('Destination exists; refuse to overwrite a previous freeze')
    destination.mkdir(parents=True, exist_ok=a.refresh_metadata)
    for original, record in selected.items():
        target = destination / record['path']; target.parent.mkdir(parents=True, exist_ok=True)
        if a.refresh_metadata:
            assert target.is_file() and digest(target) == record['sha256'], f'Image changed before metadata refresh: {target}'
        else:
            shutil.copy2(original, target)
        assert digest(target) == record['sha256']
    for original, target in metadata.items():
        target.parent.mkdir(parents=True, exist_ok=True)
        if original.suffix == '.json':
            content = json.loads(original.read_text())
            target.with_suffix('.original.json').write_bytes(original.read_bytes())
            target.write_text(json.dumps(portable(content, original, target), indent=2, ensure_ascii=False)+'\n')
        else: shutil.copy2(original, target)

report = {'phase': 'frozen candidates only; no runtime integration', 'selectedImages': list(selected.values()),
          'totals': {}, 'metadataOriginalFiles': len(metadata), 'unresolvedHistoricalReferences': sorted(unresolved)}
for name in [d['name'] for d in spec['domains']]:
    group = [r for r in selected.values() if r['domain'] == name]
    report['totals'][name] = {category: {'count':sum(r['category']==category for r in group),
                           'bytes':sum(r['bytes'] for r in group if r['category']==category)} for category in ['source','crop']}
report['selectedImageBytes'] = sum(r['bytes'] for r in selected.values())
report['largestImage'] = max(selected.values(), key=lambda r:r['bytes'])
if a.write:
    (destination/'FREEZE-MANIFEST.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n')
print(json.dumps({'write':a.write, 'images':len(selected), 'bytes':report['selectedImageBytes'],
                  'largest':report['largestImage'], 'totals':report['totals'], 'unresolved':len(unresolved)},indent=2))
