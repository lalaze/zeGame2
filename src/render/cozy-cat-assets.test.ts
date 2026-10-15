import { describe, expect, it } from 'vitest';
import source from '../../public/art/generated/cozy-cats-v2/manifest.json';
import { validateCozyCatManifest, type CozyCatManifest } from './cozy-cat-assets';

const manifest = source as unknown as CozyCatManifest;
validateCozyCatManifest(manifest);

describe('cozy cat complete identities and scene contacts', () => {
  it('accepts all twelve complete fourteen-pose packs with shared unclipped envelopes', () => {
    expect(() => validateCozyCatManifest(manifest)).not.toThrow();
    expect(manifest.breeds.flatMap(b => b.frames)).toHaveLength(168);
  });

  it('rejects an incomplete breed rather than publishing a mixed animation', () => {
    const first = manifest.breeds[0];
    expect(() => validateCozyCatManifest({ ...manifest, breeds: [{ ...first, frames: first.frames.slice(1) }, ...manifest.breeds.slice(1)] })).toThrow();
  });

  it('rejects duplicate animation states and breed identities', () => {
    const first = manifest.breeds[0];
    expect(() => validateCozyCatManifest({ ...manifest, breeds: [{ ...first, frames: [first.frames[1], ...first.frames.slice(1)] }, ...manifest.breeds.slice(1)] })).toThrow();
    expect(() => validateCozyCatManifest({ ...manifest, breeds: [first, first, ...manifest.breeds.slice(2)] })).toThrow();
  });

  it('rejects scales that would clip the raised nuzzle and stretch poses', () => {
    const first = manifest.breeds[0];
    expect(() => validateCozyCatManifest({ ...manifest, breeds: [{ ...first, scale: first.scale * 2 }, ...manifest.breeds.slice(1)] })).toThrow('envelope');
  });

  it('rejects contacts outside the actual source crop', () => {
    const first = manifest.breeds[0];
    const frame = { ...first.frames[0], headContact: { x: -1, y: -1 } };
    expect(() => validateCozyCatManifest({ ...manifest, breeds: [{ ...first, frames: [frame, ...first.frames.slice(1)] }, ...manifest.breeds.slice(1)] })).toThrow('contact');
  });
});
