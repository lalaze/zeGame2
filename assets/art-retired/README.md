# Retired art

Finished art the game no longer uses, kept for reference and left out of `public/` so it
is neither shipped nor precached. Nothing here is loaded at runtime.

| Pack | Why it was retired |
| --- | --- |
| `cozy-cast-v4` | Same ten outfits as `CustomerOutfit`, built from separate heads and bodies. Replaced by the whole-figure guests in `cozy-cast-v7`/`v8`. |
| `cozy-cast-v6` | The same 30 guests as `cozy-cast-v7`, which repaints them with richer shading. |
| `cozy-owner-v5`, `cozy-owner-v6` | Earlier owner figures whose hairstyles are all in `TEAM_HAIRSTYLES`. Only the unimported `cozy-owner-art.ts` and `cozy-owner-companion-art.ts` reach for them. |
| `reference-characters-v1` | First character family, replaced by the cozy cast, team and seating sheets. |
| `cafe-attendant-v1` | About three heads tall with a small head, against the team's rounded 2.3-head figures. Removed on purpose in `eddfa58` to unify the staff. |
| `cozy-dining-set-v2` | The gingham dining layout rejected for `cozy-dining-v3`: no hanging cloth, so guests sit at a visible table top. Its seated guests are also baked into one picture. |

The gingham table on its own (`assets/generated/cozy-dining-table-v1`) lives on as placeable furniture; see `scripts/pack-gingham-table.mjs`.
