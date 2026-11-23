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
| `assets/generated/cozy-cast-v5`, `-v6`, `-v7`, `cozy-cast-v9-pilot`, `cozy-team-v9-pilot`, `staff-v1`, `neighborhood-cast-v1` | Superseded generations |
| images under `assets/generated/bulk-candidates/` | Source crops of `public/art/generated/catalog-v1`. Their manifests stay in git |

`.gitignore` covers all of these paths, so a screenshot or recording written under `docs/` or
`artifacts/` stays out of git; move it to the same path in the library if it is worth keeping.

## What still reads it

- Tests that check runtime art against the bulk-candidates crops find them with `librarySource()`
  from `scripts/art-files.mjs`, and skip those checks on a machine without the library.
- `scripts/pack-runtime-catalog.cjs` reads the crops from the library.
- The build scripts of superseded packs (`build-cozy-cast-v5.py`, `build-cozy-cast-v6.mjs`,
  `build-cozy-cast-v7.mjs`, `build-neighborhood-cast.mjs`) need their sources from it.
- Screenshots linked from READMEs under `docs/` are at the same path in the library.

The library also has `docs/street-art-v2/source/`, which moved back into git the same day as
`assets/generated/street-art-v2/source/` because it rebuilds the street. That copy is a duplicate.

## What stays in git

What the game ships (`public/art`, its PNG masters in `assets/art-masters`) and what rebuilds it
(kits, prompts, references and manifests under `assets/generated`). Packs that no longer ship but
that tools still read are in `assets/legacy-packs`. Once a take or a version is replaced, move it
here rather than deleting it.
