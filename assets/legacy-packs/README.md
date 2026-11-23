# Legacy packs

Packs the game no longer loads, moved out of `public/` on 2026-11-22 so they stay out of the build.
They stay in git because tools still read them:

- `cozy-team-v7`: the hairstyle and seated references `scripts/art-gen/team-batch.mjs` shows
  Codex when it repaints staff looks 0 to 7 and the chef.
- `cafe-style-sample-v1`: the images of `cafe-style-sample.html` (dev server only).
- `cozy-cast-v5`, `cozy-cast-v7`, `cozy-cast-v8`, `cozy-dining-v4`, `cozy-team-v8`: what their
  superseded build scripts write, now here instead of `public/`. `cozy-cast-v8` and
  `cozy-dining-v4` point into `cozy-cast-v7`, so they move together.
- `rooms/`: room backdrops exported from the art preview. Rooms are drawn in code; nothing loads these.

Retired art nothing reads goes to the art library instead (`assets/ART-LIBRARY.md`).
