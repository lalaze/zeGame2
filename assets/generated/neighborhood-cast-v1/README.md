# Neighborhood cast expansion

Six new guests append IDs 30–35 to the existing cast: 银发织衫, 红帽画手,
雨巷双辫, 松绿书商, 珊瑚发带 and 麦穗旅人. Each has nine authored walking
poses and three seated/petting poses; whole-figure mirroring supplies the left
views. The dining paintings include the same walnut chair and olive cushion.

The built-in `image_gen` tool generated all four transparent source atlases.
`prompt-0.txt`, `prompt-1.txt`, `dining-prompt-0.txt` and
`dining-prompt-1.txt` preserve the exact prompts. The standing reference was
`../cozy-cast-v7/sources/group-1.png`. Dining used
`../cozy-dining-v3/sources/group-1.png` for furniture and the new standing
atlas for identity. `generation.json` records the selected generated files.

Run `node scripts/build-neighborhood-cast.mjs` to compile the intact paintings
onto the existing density-2 master palette. New runtime atlases live in
`public/art/generated/cozy-cast-v8/` and `cozy-dining-v4/`. Their manifests
reference the unchanged first 30 atlases in the previous packs. Existing cast
IDs and story identities remain stable. A saved partial 30-person cycle finishes
before all 36 people join the next shuffled cycle.

The same expansion adds six recruitable staff: 青禾/Qinghe and 琥珀/Amber
(baristas), 小满/Xiaoman and 冬青/Holly (servers), 栗子/Chestnut and 白露/Bailu
(cooks). These use the existing eight-family `cozy-team-v7` painter with
individually selected looks, including ponytail, sidepart, braids and waves.
Staff art is assembled from that existing authored family, not newly generated
staff atlases. Each recruit has an introduction and three bilingual work stories.
The original free staffing order and purchased capacity are preserved.

The production sprite gallery includes all 36 guests, all 15 named staff and a
dedicated preview of the 12 additions at `sprite-preview.html#new-neighbors`.

Checks and desktop/mobile captures are in `artifacts/neighborhood-cast/`.
