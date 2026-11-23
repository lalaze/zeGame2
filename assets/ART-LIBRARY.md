# Art library

Art the game does not load, and QA media, live outside git in `/Volumes/data/zeGame2-library`
(set `ZEGAME_ART_LIBRARY` to use another copy), under the same repo-relative paths. They moved
there on 2026-11-22; the library's `moved-2026-11-22.json` lists every file with its SHA-256, and
every one is still in git history before that date.

| In the library | What it is |
| --- | --- |
| `dogfood-output/` | Playtest recordings and screenshots |
| images, video and zips under `artifacts/` and `docs/` | QA screenshots and recordings. Their JSON, logs and notes stay in git, because tests read them |
| `assets/art-retired/` | Retired packs |

`.gitignore` covers all of these paths, so a screenshot or recording written under `docs/` or
`artifacts/` stays out of git; move it to the same path in the library if it is worth keeping.

## Deleted on 2026-11-23

At the user's request, when the game chose a new art direction (`assets/generated/art-direction-v1`),
these were deleted from the library; its `deleted-2026-11-23.json` lists every file:

- `assets/generated/bulk-candidates/` images: the source crops of `public/art/generated/catalog-v1`.
  Their manifests stay in git.
- Superseded generations: `assets/generated/cozy-cast-v5`, `-v6`, `-v7`, `cozy-cast-v9-pilot`,
  `cozy-team-v9-pilot`, `staff-v1`, `neighborhood-cast-v1`.
- The concept shots and pilots of the art-direction search (never in git).

What moved there on 2026-11-22 is still in git history before 8f2c6b1. Restore it from there to run
what needed it: the checks against the bulk-candidates crops (`hasSourceCrops` in
`scripts/art-files.mjs`; they skip without them), `scripts/pack-runtime-catalog.cjs`, and the build
scripts of superseded packs (`build-cozy-cast-v5.py`, `build-cozy-cast-v6.mjs`, `build-cozy-cast-v7.mjs`,
`build-neighborhood-cast.mjs`).

## What still reads it

- Screenshots linked from READMEs under `docs/` are at the same path in the library.

The library also has `docs/street-art-v2/source/`, which moved back into git the same day as
`assets/generated/street-art-v2/source/` because it rebuilds the street. That copy is a duplicate.

## What stays in git

What the game ships (`public/art`, its PNG masters in `assets/art-masters`) and what rebuilds it
(kits, prompts, references and manifests under `assets/generated`). Packs that no longer ship but
that tools still read are in `assets/legacy-packs`. Once a take or a version is replaced, move it
here rather than deleting it.
