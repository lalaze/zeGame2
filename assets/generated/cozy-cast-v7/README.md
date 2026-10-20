# Whole-figure café guests v7 — richer rendering

The same 30 guest identities, outfits, accessories, poses and sheet layout as
[v6](../cozy-cast-v6/README.md), repainted so the guests match the room art:
four to five shades per material, a consistent warm key light from the upper
left, wool/knit/denim texture, hair painted as locks with highlight strands, and
eyes with an iris, a highlight pixel and a lash line. v6 asked for "two or three
shades per material", which left guests flatter than the furniture around them.

Built-in `image_gen` (Codex) produced ten transparent 6×6 atlases. Each prompt is
its v6 prompt with only the reference and style sentences replaced; `prompt-N.txt`
holds the exact text and any `prompt-N-edit.txt` a narrowly scoped edit pass.
References, in order: the v6 sheet for identity and layout, the approved v7 sheet 0
for consistent rendering across the set, `cafe-style-sample-v1/sample.png` and
`cozy-world-v2/region-reading.png`. Selected source bytes are in `sources/`;
`generation.json` lists each sheet's original output and `candidates/` records
every attempt and the sheet-0 pilot. Sheets 1–9 name the pilot's selected file,
`candidates/group-0-a.png`, as their rendering reference; it was byte-identical to
`sources/group-0.png` and removed after selection.

`node scripts/build-cozy-cast-v7.mjs` compiles them exactly like v6 (gutter-found
complete figures, the shared dominant-colour resampler, master-palette snapping)
into `public/art/generated/cozy-cast-v7/`. Frame size, contacts and the manifest
schema are unchanged; the manifest version is 7. Guest sheets snap to the master
palette without the staff-only `team-*` midtones, so saved-look recolouring keeps
working by three-shade ramp.

Seated guests at tables keep the matched person-and-chair paintings of
[cozy-dining-v3](../cozy-dining-v3/README.md), whose shading already matches this
rendering at game scale.
