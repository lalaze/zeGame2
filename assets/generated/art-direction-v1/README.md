# Art direction v1: soft, cozy cross-section (chosen 2026-11-23)

`target-shot.png` is where the whole game's art is heading. The café is a multi-storey building
shown in cross-section, with a rooftop terrace, a seating floor, the counter on the ground floor
and the kitchen and roastery in the basement. It is soft hand-drawn 2D: thin warm-brown lines, a
low-saturation pastel palette (cream, sage, dusty pink, honey, soft teal) and lamp glow on every
floor. Characters are cute and round, with dot eyes.

The user picked it (direction N) from 17 concept shots made over three rounds; the rest were
deleted. It replaces style B (`cozy-cast-v9/style-b.png`) as the reference for new art. Since
2026-11-24 the game draws it: the building of `src/render/floors/`, with the art of
`../floor-sample-v1`. The style B pixel room still opens with `?pixel`.

It is a concept, made with Codex image generation (`scripts/art-gen/codex-image.mjs`) from
`prompts/common.txt` followed by `prompts/style.txt`, without a reference image. Its text, UI and
characters are approximate, and a phone screen is taller than its 2:3.

The building follows the café's own growth: the ground floor holds the counter and the first two
tables, a seating floor opens above for tables three to five and another for six to eight, and the
kitchen is the basement. The floors view that draws it is `src/render/floors/` (open the game with
`?floors`), and its art is `../floor-sample-v1`.
