# Agent notes: Tiny Bean Café

A pixel-art café game (Vite + TypeScript + Phaser), installed as a PWA. The user plays it only on
their phone, in portrait with touch, so check UI changes at phone size first.

- `npm test` runs everything in about 80 seconds.
- `npm run build` ships to the user's phone: `vite preview` on :4174 serves `dist/` from this
  checkout over the tailnet. Ask before running it. To check that a build works, run
  `npx vite build --outDir <scratch dir> --emptyOutDir` instead.
- The user usually has uncommitted work of their own. Read `git status` first, stage only the
  files you changed (never `git add -A`), and commit only when asked.

## Where art lives

| Path | What it is |
| --- | --- |
| `public/art/` | What the game ships: lossless WebP. Never edit it by hand |
| `assets/art-masters/` | The PNG master of every shipped WebP; tests and offline tools read pixels here (`artMaster()` in `scripts/art-files.mjs`). `webp.json` lists them. For 414 files that once shipped as GIF, the master is the full-colour original and `convert-art-webp.mjs` ships its GIF reduction (`quantised` in `webp.json`, `gifEra` in `assets/generated/PACKS.json`) |
| `scripts/runtime-art.json` | The art downloaded at install, by PNG name. Anything else loads on demand |
| `assets/generated/PACKS.json` | Every pack under `public/art`: what loads it, its sources, its build commands and whether it can be regenerated. Look here first; `scripts/art-packs.test.mjs` keeps it in step |
| `assets/generated/<pack>/` | What rebuilds shipped art: kits, prompts, references, manifests, chosen takes. Current packs have a README with their regenerate, build and check commands (start with `cozy-cast-v9` and `cozy-team-v9`) |
| `assets/legacy-packs/` | Packs the game no longer loads that scripts still read. Not live |
| `/Volumes/data/zeGame2-library` | The art library, outside git, at the same repo-relative paths: retired art, QA screenshots and video. See `assets/ART-LIBRARY.md` |

Art direction: on 2026-11-23 the user chose a new look for the whole game, a soft, cozy cross-section
(`assets/generated/art-direction-v1`). New art follows it. Until it replaces the shipped art, the
shipped style is style B (`assets/generated/cozy-cast-v9/style-b.png`, palette `docs/art-grid/palette.json`).

## Rules for art

1. **Decide what is live from what the game loads**: the `src/render/*-assets.ts` catalogs, the
   pack manifests under `public/art`, and `scripts/runtime-art.json`. A folder in
   `assets/generated` or the library is not live just because it exists, and the highest version
   number is not automatically the current one.
2. **Leave the library, `assets/legacy-packs` and superseded packs alone** unless the task is about
   them. Don't search or read through them, and use manifests rather than opening images to
   find out what a pack holds.
3. **Only art the user has chosen goes into the repo.** Takes land where a pack's script writes
   them (for example `kits/customer-N/take-T`). Exploration, style tests, comparison sheets and
   review images go straight to the library, at the path they would have had in the repo.
   Show the user the candidates and let them pick. Record the pick (for kits, `selected.json`)
   and move the rejected takes to the library.
4. **Shipping art**: run the pack's build script, then `node scripts/convert-art-webp.mjs`, then
   the pack's checks and tests. Every new file under `public/art` must be listed in
   `scripts/runtime-art.json` (or belong to a pack in `LAZY_PACKS` in `convert-art-webp.mjs`).
   Otherwise it is not converted and `scripts/art-webp.test.mjs` fails.
5. **Never delete art.** If nothing reads a pack any more, move it to the same path in the
   library. If the game stopped loading it but a script still reads it, move it to
   `assets/legacy-packs` and repoint the script. Either way, take its entries out of
   `scripts/runtime-art.json` and `assets/art-masters/webp.json`, and move its masters with it.
6. **Reach the library through `scripts/art-files.mjs`** (`librarySource()`, `ART_LIBRARY`,
   `hasArtLibrary`), never through a hard-coded path. A test that needs library files must skip
   when `hasArtLibrary` is false.
7. **QA media stays out of git.** Screenshots, recordings and zips written under `docs/` or
   `artifacts/` are ignored. Move one to the same path in the library if it is worth keeping. The
   JSON, logs and notes there are tracked, and tests read many of them, so don't move or rewrite
   them.
