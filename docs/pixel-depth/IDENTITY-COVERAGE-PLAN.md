# Identity-preserving generated bitmap coverage plan

Status: architecture proposal, 2026-10-13. This document changes no runtime, saved identities, palettes, simulation, assets or loading policy. Asset and memory counts below are a measured snapshot; future layer counts and budgets are explicitly estimates. New character geometry, painted material layers, masks and accessories must be authored with imagegen and reviewed before use.

## Decision

Use two complementary content models:

1. **Custom owners and randomized staff:** imagegen-authored, registered bitmap layers plus deterministic runtime material/palette composition. Generate geometry by hairstyle, role, direction and action, not one full PNG for every color combination.
2. **Thirty fixed customers:** retain exact cast IDs and their authored design recipes. Deliver complete identity packs, using reviewed shared layers where they truly match, with identity-specific outfit/hair/accessory layers or full frames where they do not. Never substitute one fixed person for another.

Keep the current complete generated owner, Mina and Siamese packs as working reference/fallback boundaries. The first additional proof should be one owner hairstyle and one owner body set, including all nine authored stand/walk poses. Preview it before enabling a wider eligibility rule. Do not call all identities complete when only palette composition or one hairstyle has been verified.

## 1. Current coverage and invariants

| Population | Identity contract | Generated bitmap coverage now | Remaining coverage |
|---|---|---|---|
| Owner | Saved five-axis `profile.look` | All-zero tuple only; nine authored walking/standing poses, left mirrored | Other 2,303 standard tuples; the four style controls must keep their identities |
| Baristas | Each `Sim.baristas[i].look`; owner replaces first spot only when a profile exists | No general randomized-barista coverage in Scene | All ordinary barista looks; adapter's optional `baseBarista` switch is not a general permission to remap |
| Servers | Each `server.look`, role-specific uniform | Legacy fine sprites | All supported tuples and carrying/acknowledgment alignment |
| Cooks | Each `cook.look`, toque and uniform rules | Legacy fine sprites | All supported tuples, station-facing/work/carry alignment |
| Fixed customers | Cast ID **and** matching saved Look, plus design recipe | Cast 0/Mina only, complete 15 authored poses | Cast IDs 1–29, complete standing/walking/sitting/petting identity sets |
| Legacy/custom customers | Missing cast ID or mismatching saved Look | Legacy fine sprites | Preserve exactly until a separate parametric-customer proof exists |
| Resident cats | One of 12 breed IDs | Siamese only, all 14 actions | Ginger, tuxedo, calico, tabby, black, white, british, american, ragdoll, persian, mainecoon |

The initial onboarding Look is randomized, not automatically all-zero. Thus the current generated owner bitmap does not cover most newly randomized profiles. Existing legacy/fine fallback is intentional, not a reason to loosen identity matching.

### Exact combinatorics and existing visual aliases

`LOOK_RANGES` and `Sim.randomLook()` use 4 skins × 6 hair colors × 4 styles × 8 shirt/apron values × 3 pants = **2,304 stored tuples per role**, or **9,216 role+Look keys** across owner/barista/server/cook. This is the identity namespace, not a request to download 9,216 painted people.

Existing renderer semantics must be preserved:

- Skin selects `SKINS`; hair selects `HAIRS`; pants selects `PANTS`. Existing warm ramps, skin-dependent cheek color, eyes and shoes remain separately controlled materials.
- Owner `shirt` selects apron color; the underlying staff shirt is fixed cream `#eee0c2`. With style 3 it also determines the knitted-hat color through the same shifted shirt palette described below.
- Barista apron is fixed green `#627451`; server apron is fixed blue `#536f78`. Their underlying shirt is fixed cream. `shirt` still matters for style 3: that style is a knitted hat whose color is `SHIRTS[(shirt + 3) % 8]`.
- Cook shirt is `#f0e7d3`, apron `#865332`, and toque uses fixed white/cream materials. Cook style 3 intentionally renders as style 0 under the toque. Do not turn this existing alias into a newly visible colored hat or save rewrite.
- Within standard ranges, current geometry/material recipes have owner 2,304, barista 792, server 792 and cook 216 visible combinations, totaling 4,104. These are renderer-level equivalence classes, not permission to discard the original Look values. A canonical *art recipe* may share results only after tests prove equality under the existing role rules.
- Runtime snapshot validation currently accepts each Look field in 0…7 (32,768 raw tuples), wider than `LOOK_RANGES`; the profile parser has separate per-axis clamps. An art adapter must not tighten save validation. Values outside standard ranges should retain exact legacy fallback initially. Blind modulo normalization is unsafe: skin 4 reuses skin-0's base ramp but the legacy blush branch still checks raw `skin < 2`.
- Staff are randomized only when `Sim.sync()` appends a new worker. Existing Looks survive moves, room resizes, closing and supported open/closing snapshots. Prep saves intentionally omit runtime staff; reloading prep may randomize them again. Art must neither consume the simulation RNG nor promise/change this persistence behavior.
- Onboarding exposes skin, hair/style and apron choices, but no pants picker. Pants is nevertheless randomized and saved; omitting it from composition or cache identity would still change the character.

### Cast identity is richer than Look

`CUSTOMER_CAST` has eight customer hairstyles, ten outfit types, five accessory categories and individual accent colors. The stored Look only carries `hairstyle % 4`; it does not uniquely encode the intended full silhouette. Resolve through cast ID + exact expected Look + role, and include a design/content revision in art cache keys. A saved cast ID with a different Look currently renders a valid hybrid: design silhouette/accessories plus saved palette. Exact-match fallback must preserve that hybrid, not overwrite it. Do not infer a narrative identity for older visits missing one. The complete cast ledger is in section 8.

## 2. Authoring contract for layered human art

### Separate materials and occlusion deliberately

Author isolated bitmap plates against a common registration template. Suggested layer graph, explicitly ordered per direction:

- Rear hair / hat rear.
- Far limbs and trousers; rear garment panels when required by a walking pose.
- Neck/body skin, shirt and role apron, with their pose-specific silhouettes.
- Head skin and fixed facial details; cheek material kept distinct from eyes/mouth/outline.
- Front hair / bangs, front headwear, role trims and accessories.
- Near arm/hand and held-object contact layer when the pose requires foreground occlusion.

This is an ordering contract, not a mandate to use one full-size image for every bullet. A direction may combine compatible layers or need separate near/far pieces. Never extract a supposedly universal skin/hair mask from a finished flattened person using approximate color flood-fill; dark hair, face shading, uniform seams and outlines overlap in color. Request clean registered material layers from imagegen. If the generator cannot deliver a clean reusable layer, keep a reviewed full-frame exception rather than hide defects behind procedural patching.

Hairstyles need front/rear occlusion geometry, not just four recolors. Hair style 3's knitted hat is its own material. Cook headwear requires a reviewed cap compatibility recipe. Long hair must overlap collars consistently in front/side/back. Current custom faces share base geometry; reproducing that factorization is valid, but removing hairstyle/skin identity is not.

### Runtime palette composition is rendering

For new **explicitly palette-ready** layers, immutable source pixels provide alpha, material identity and authored highlight/shadow information. A pure compositor maps those material tones through the existing `SKINS`, `HAIRS`, `SHIRTS`, `PANTS` and role-specific ramps into a new in-memory canvas. Fixed eyes, outlines, shoes and trims are not tinted by the garment selection. Palette choice must not alter silhouette or source alpha.

This is the same kind of runtime appearance selection already performed by `character()`, now using fine painted bitmap geometry. It is not permission to recolor the saved original owner/Mina/Siamese PNGs, overwrite reference images, repaint a flattened person, invent a new silhouette with code, or change the palettes/Look controls. All substantive new raster artwork and material masks still come from imagegen. Crop/packing tools may make lossless, byte-preserving atlas regions and metadata; they must not perform visual cleanup, inpainting or resizing of the saved originals.

A palette-ready plate may use validated neutral tone ramps or an authored material-ID/tone representation. Do not promise that unconstrained generated RGB values already form exact indexed masks. Validate the actual output first. Preserve alpha and avoid halos from premultiplication, global hue rotation or tinting the whole sprite. At dark skin/light hair and light skin/dark hair extremes, manually inspect facial contrast and seams.

### Shared units and contacts

Every source family must declare a source-to-logical scale and source anchors. One calibrated scale per authored sheet/family is allowed; per-frame height fitting is not. Keep down/up/right stand/stepA/stepB phase assignments, mirror left only where approved, and register the whole composed pose at walking foot **(9,27)** in logical **18×28**, with **4×** physical backing (72×112). If a hairstyle or garment genuinely overflows, extend the envelope with an explicit draw offset and mirrored contact calculation; do not squash it to fit.

Per-pose metadata should cover foot, neck join, face/eye line, head origin, near/far hand or tray contact where relevant, occlusion order and any draw offset. Attach the same head identity to body pose anchors; do not independently resize the head on each step. Preserve the existing Scene gait/bob timing to avoid double bobbing. Existing barista visual scale 1.18 must remain an explicit presentation choice, not get accidentally applied twice to new plates.

For customer seated/petting poses, declare hip/seat, foot and pet-hand points separately. Existing contracts differ: legacy sit is 18×26 and pet is 18×34; Mina uses 18×29 sit and 22×34 pet with x offset −2. Keep `s.y−33` placement and physical crop conversion explicit. Never use standing foot normalization for sitting. Keep upper/lower table occlusion and cup/food/hand attachments registered.

## 3. First proof: one head style + one owner role body

**Authoring gate:** one owner hairstyle-0 face/hair family in front/back/right views, preserving the approved all-zero owner's short brown hair and identity; one neutral-material owner body set in all nine down/up/right × stand/stepA/stepB poses. Include clean hand skin, shirt, apron, trousers/shoes, fixed facial details and front/rear hair masks. Use the existing identity-preserving owner reference. Do not use the earlier green-apron/bun image.

An initial front-facing three-pose plate may be reviewed to reject seams early, but it is not an integrable complete identity set. Runtime publication requires all nine poses and all required layers. Left walking can be mirrored as today.

**First implementation target, after asset approval:** a preview-only pure compositor returning `CharacterFrames` + contact metadata, through the same shared renderer used by Scene and UI. Eligibility is restricted to owner, hairstyle 0, valid standard indices, and a complete layer set. Other hairstyles/roles remain legacy. The current generated owner stays available until this proof is accepted; no broad resolver switch during experiments.

One style exposes 4 × 6 × 8 × 3 = **576 mechanically composable owner tuples**, not 2,304. Suggested manual review sample: all-zero; darkest skin/lightest hair; lightest skin/dark hair; dark apron; pale apron; each pants extreme; a randomized tuple. Review every direction and both gait phases at actual desktop/390-pixel scale, and inspect joins at large scale. Mechanical tests can enumerate 576 combinations without claiming that a human has visually reviewed all 576.

Acceptance gates:

1. Exact saved keys/palette controls and role semantics; no state mutation, RNG calls, price/path/seat changes.
2. Full pose/layer completeness; invalid/missing material, image or contact rejects the whole applicable set.
3. Same person across preview, stand, both steps and all directions; fixed neck/eye/foot; no layer seams or alpha halos.
4. Every standard color index tested for mapping; outside-range legacy snapshots stay on exact fallback.
5. Owner editor randomize/change/cancel/close/reopen cannot publish stale asynchronous results; opening confirmation, main icon and hairstyle-choice thumbnails use the same recipe/content revision.
6. Existing source-release, clone/second-Scene, context-loss/reload, reduced-motion and layout/contact tests pass. Timings and working-set sizes are measured, not assumed.

Only after this proof: complete styles 1–3, then role bodies for barista/server/cook with cap/hat compatibility. A single extra body role is not coverage of every randomized worker until its layer combinations and shared color semantics pass the same gates.

## 4. Customers and cats: bounded identity packs

For each of the 29 remaining customer designs, inventory silhouette/accessory requirements before choosing reusable parts. A glasses/cardigan head can reuse a compatible base, but a bob, braid, satchel, scarf, dress or hoodie must retain its own painted geometry. Publish nine authored walking frames plus two seated and four petting frames atomically; allow left walking mirroring only under an explicit manifest convention. Sharing garments does not justify giving two cast IDs the same face/hair/outfit recipe accidentally.

The customer resolver should keep exact cast+Look checks and pin one content revision/render family for the duration of a live visit. If a pack is unavailable at arrival, use the whole legacy identity for that visit; do not switch from legacy walking to generated sitting when a download finishes. Prewarming may choose upcoming appearance IDs but must never advance the cast cycle or simulation RNG. Restored live visits without presentation metadata can consistently choose a whole available family on restore, without changing the simulation/save schema.

Cats are a separate morphology problem. The remaining eleven breeds are not blanket palette swaps of Siamese: long-haired coats, masks, patchwork and silhouettes differ. Each must eventually receive its own reviewed complete 14-action pack or an explicitly reviewed breed-layer recipe. Reuse palette composition only for intentionally authored equivalent materials; do not silently relabel one breed.

## 5. Atlas and lifetime strategy

### Stage A: keep the working renderer contract

Use source atlases/layer packs plus lazy composition while keeping current logical canvases and `fineSpriteArt` backing. The existing `CharacterFrames` callers, UI crops, physical crop math and fallback behavior stay simple. A source atlas reduces request count; it does **not** remove its decoded RGBA footprint or the need for correct source rect/anchor metadata.

Keep source masters outside `public`. Pack only runtime-selected content into versioned immutable atlas URLs with a small manifest. Preserve source pixels exactly when packing, add transparent gutters, use nearest sampling and validate alpha/region bounds. Do not ship both masters and packed atlases. Measure compressed bytes after real assets exist; art entropy controls compression.

### Stage B: optional composed-output atlases

The current texture helper uploads one canvas per displayed pose, and Phaser holds the uploaded textures strongly. A WeakMap alone is not an eviction policy. Packing twelve composed walking frames into one per-look atlas can reduce texture objects/binds, but is a separate renderer interface change: a frame needs an atlas texture rect, logical size, density and anchors. Returning the whole atlas as every `fineSpriteArt(frame).canvas` would break current draw/crop/UI code.

Only introduce this after Stage A works. Update Scene image selection, `logicalCrop`, mirrors, seated cutouts, UI image export, previews and texture disposal together. Keep a logical thumbnail/export path without permanently copying every physical frame. Two-pixel gutters around 72×112 tiles give a 4×3 atlas of 304×348, 423,168 raw RGBA bytes, versus 387,072 bytes for twelve exact tiles. This trades roughly 9.3% pixel overhead for fewer texture objects; it is not automatic memory compression.

### Bounded loading and ownership

- Separate mandatory shell/main assets and the current owner's needed style/role dependencies from optional customer/breed/role packs.
- Limit decode/composition concurrency to one identity family initially, and at most two network requests in flight; record timings before widening. Limits are scheduling budgets, not gameplay caps.
- Load source-only material atlases without uploading them to Phaser unless they are actually rendered directly. Current `this.load.image` creates original texture ownership; do not replicate that waste across all layers.
- Keep one bounded reusable material/template working set for the active roles and hairstyles. A parametric atlas may be needed again for a new Look: unlike a complete fixed-identity source pack, it cannot be unconditionally destroyed after the first person's bake. Either retain compact in-memory material/tone/alpha data under a byte budget, or re-decode the versioned compressed asset when needed.
- Fixed identity packs can continue successful-bake source release. Shared templates need reference counts/dependency ownership so releasing one composed person cannot invalidate another or the editor. Final canvases must never read unloaded source images.
- Pin all live actors and active preview consumers; evict only unpinned final results and their actual Phaser texture keys. Start with an unpinned LRU budget of eight human sets and two cat sets, measured by physical bytes, not merely entry count. Pins are a correctness exception: if a live working set exceeds the target, use legacy for new unpinned arrivals and report metrics rather than evict someone mid-action.
- Coalesce same-key loads; track scene/content generation tokens; late tasks cannot install old looks or publish into a new Scene. Clear/reload must restore dependencies. Different TextureManagers must not share manager-local GPU keys.
- Audit the legacy `charCache`, currently an unbounded Map, before enabling hundreds of rapid editor combinations: a bounded new cache alone does not bound legacy fallbacks or Phaser's texture list. Preserve exact fallback output while designing any later eviction.

### Service Worker is part of the plan

Currently `scripts/precache.mjs` includes every built file except maps/SW, and `public/sw.js` installs it with `cache.addAll(... cache:'reload')`. Consequently Scene lazy loading alone still downloads every optional pack during SW installation. First split shell precache from optional versioned art runtime caching, with bounded storage and recoverable quota failures. Decide explicitly whether “all 30 customers available offline” is required; it costs network/storage and cannot be claimed while only shell assets are installed. Keep previous content until the new mandatory shell succeeds; avoid whole-library re-downloads for a small code change. This is proposed work, not a change made here.

## 6. Measured baseline and budgets

Measurements from current runtime PNG files (58 images; source sheets excluded):

| Quantity | Bytes | MiB | Interpretation |
|---|---:|---:|---|
| Current compressed PNG payload | 14,058,459 | 13.407 | Main props + owner + Mina + Siamese; currently all preloaded/pre-cached |
| All original decoded RGBA | 43,490,012 | 41.475 | Width × height × 4, not measured process RSS/GPU allocation |
| Released owner + Mina source RGBA | 9,167,868 | 8.743 | Successful complete 24-image source pack release |
| Released Siamese source RGBA | 13,224,488 | 12.612 | Successful complete 14-image source pack release |
| One 12-frame human walk set, logical + 4× backing | 411,264 | 0.392 | Before Phaser ImageData/GPU overhead |
| Mina full 18-frame set, logical + backing | 685,712 | 0.654 | Includes two larger seated and four padded pet frames |
| Siamese 14-frame set, logical + backing | 411,264 | 0.392 | 24×18 at density 4 |

A displayed full 12-frame walk set is approximately 1.130 MiB when counting logical canvases, backing canvases, Phaser CanvasTexture ImageData and one GPU copy. Mina's full set is approximately 1.885 MiB under the same accounting. These are capacity estimates, not device memory measurements; browser copies/driver padding and which frames have actually uploaded matter.

Eagerly composing 2,304 owner looks would already cost **903.656 MiB** in logical+backing canvases alone. All 9,216 role keys would cost **3,614.625 MiB** before ImageData/GPU. Even collapsing only the proven legacy visual aliases (4,104 recipes) still costs **1,609.638 MiB**. Generate geometry once and compose only needed appearances.

Illustrative first-proof **canonical in-memory template** budget: 45 full-body material tiles (nine poses × five material groups, 72×112) plus 15 head tiles (three views × five groups, 72×64) = **1,728,000 raw RGBA bytes / 1.648 MiB** before atlas padding. A 512×1024 canonical template atlas is 2 MiB raw. Actual authoring may require more or fewer near/far layers; this is a capacity example, not a committed asset count or measured compressed size. It is **not** a claim that losslessly packing today's large source images yields a 2 MiB download or decoded source atlas. Original-resolution layers may be much larger; measure and cap that transient decode separately.

Runtime sampling into canonical templates is presentation, not rewriting the masters. A later distribution build could export exactly those approved compositor results as compact runtime atlases, retaining the original imagegen sources unchanged and verifying against the same renderer's golden pixels. Such derived distribution exports require their own reviewed asset-build step; no source image is resized or exported by this planning task. Until that step exists, keep original-resolution source/transfer budgets distinct from the canonical template budget.

A retained one-byte tone plus alpha representation may reduce palette-ready material RAM; fixed-color/outline layers still need their true color data. Validate fidelity before using such a representation. It must be created in memory from deliberately authored material layers, not guessed from current full-color PNGs.

The previous 44-image, pre-cat exact lossless WebP experiment reduced 9,994,923 PNG bytes to 7,108,248 bytes (28.88%), with identical decoded RGBA including transparent RGB. This does not measure the new cat pack or predict layered compression, and changes neither decoded memory nor layer completeness. Format conversion remains a separate optional packaging step, not deployed by this plan.

## 7. Proposed file ownership and implementation order

1. **Authoring/manifest only:** new imagegen layer source family, immutable provenance, source bounds, scale, material schema, pose/head/foot/contact registrations; reviewed reference sheets. No edits to existing accepted PNGs.
2. **Pure renderer proof:** proposed `src/render/bitmap-material-compose.ts` and tests; proposed generated-human-layer manifest/adapter. Inputs are loaded sources + Look/role, outputs are existing `CharacterFrames`/contacts with complete-set fallback. No Phaser dependency or state mutation.
3. **Shared presentation resolver:** role/Look/cast keyed resolver and lifecycle cache. Existing `generated-main-art.ts` bridge should delegate to the same result for Scene, editor, confirmation, main icon, hairstyle thumbnails, regular guests, upgrade icons and art-preview tooling. Preserve old signatures/fallbacks until all consumers are migrated explicitly.
4. **Scene integration:** walking foot/face registration, role uniform semantics, tray/cup/dough/bar UI attachments, station facing, physical crop conversion. Keep collision/depth/navigation coordinates unchanged.
5. **Loader/SW budgeting:** dependency manifests, source-only loads, release and pin-aware eviction, shell versus optional caching. Add quota/error/reload/second-Scene tests before adding large numbers of identities.
6. **Optional output atlas:** only after measured texture pressure justifies the descriptor/API changes in Stage B.
7. **Content rollout:** remaining three owner styles, three staff role bodies, then batches of fixed customer identities and distinct breeds; each batch remains an explicit coverage ledger entry with actual visual review status.

Required verification spans identity mapping, all saved standard axes, role aliases, legacy out-of-range fallback, complete pose readiness, palette alpha preservation, mirrored contacts, seated table crops, footsteps/gait order, interrupted editor changes, two simultaneous renderers, active-visit pins, source release, GPU eviction, offline/reload/quota handling, desktop and 390-pixel real play. No claim is made that all variants have already been painted, generated, rendered or visually reviewed.

## 8. Fixed customer ledger

Only row 0 currently has a complete generated bitmap identity. All other rows retain the existing fine-sprite implementation. `hairstyle` is the customer-specific 0…7 value, not the truncated saved Look style.

| ID | Existing catalog label | Hair style | Outfit | Accessory | Generated status |
|---:|---|---:|---|---|---|
| 0 | 晨读常客 | 0 | cardigan | glasses | Ready: Mina, 15 authored poses |
| 1 | 海盐条纹 | 2 | stripe | none | Not yet generated |
| 2 | 花店姑娘 | 4 | overalls | bow | Not yet generated |
| 3 | 蜂蜜围巾 | 3 | scarf | none | Not yet generated |
| 4 | 紫藤画家 | 5 | jacket | satchel | Not yet generated |
| 5 | 草莓裙摆 | 6 | dress | headband | Not yet generated |
| 6 | 薄荷骑手 | 7 | hoodie | none | Not yet generated |
| 7 | 奶油书迷 | 0 | vest | glasses | Not yet generated |
| 8 | 枫叶邮差 | 4 | duffle | satchel | Not yet generated |
| 9 | 蓝莓水手 | 6 | sailor | bow | Not yet generated |
| 10 | 苔绿园丁 | 3 | overalls | satchel | Not yet generated |
| 11 | 杏黄毛衣 | 5 | stripe | glasses | Not yet generated |
| 12 | 丁香发带 | 2 | dress | headband | Not yet generated |
| 13 | 桃子开衫 | 1 | cardigan | bow | Not yet generated |
| 14 | 湖绿旅人 | 7 | jacket | satchel | Not yet generated |
| 15 | 燕麦绒帽 | 3 | hoodie | glasses | Not yet generated |
| 16 | 砖红背心 | 6 | vest | none | Not yet generated |
| 17 | 雨天风衣 | 0 | duffle | glasses | Not yet generated |
| 18 | 青苹果领结 | 4 | sailor | bow | Not yet generated |
| 19 | 向日葵裙 | 1 | dress | headband | Not yet generated |
| 20 | 葡萄连帽衫 | 5 | hoodie | none | Not yet generated |
| 21 | 玫瑰围巾 | 7 | scarf | glasses | Not yet generated |
| 22 | 松石背带 | 6 | overalls | headband | Not yet generated |
| 23 | 香草针织 | 2 | stripe | satchel | Not yet generated |
| 24 | 肉桂短夹克 | 5 | jacket | none | Not yet generated |
| 25 | 雾蓝发辫 | 4 | cardigan | bow | Not yet generated |
| 26 | 橄榄学者 | 7 | vest | glasses | Not yet generated |
| 27 | 金盏牛角扣 | 0 | duffle | none | Not yet generated |
| 28 | 紫苏小领衫 | 1 | sailor | headband | Not yet generated |
| 29 | 蜜桃旅行包 | 2 | scarf | satchel | Not yet generated |

## Source audit

- `src/game/state.ts`: `Look`, `LOOK_RANGES`, profile parsing.
- `src/game/sim.ts`: `randomLook`, `sync`, `snapshot`, `restore`, `resizeScene`, staff lifecycle.
- `src/game/sim-snapshot.ts`: wider historical runtime Look acceptance.
- `src/game/save-session.ts`: prep runtime omission.
- `src/game/customer-cast.ts`: all 30 immutable design recipes and cast cycle.
- `src/game/pets.ts`: all 12 breed identities.
- `src/render/sprites.ts`: palettes, hairstyle/hat/toque logic, role outfits, `character` and unbounded `charCache`, legacy frame envelopes.
- `src/render/generated-staff-art.ts`, `generated-customer-art.ts`, `generated-cat-art.ts`: current eligibility, complete-set rules, scales/anchors and source-entry release.
- `src/render/phaser/cafe-scene.ts`: current eager preload, adapters, role renderers, carry/contact attachments and source cleanup.
- `src/render/phaser/textures.ts`, `src/render/fine-sprite-art.ts`: texture ownership, per-manager keys, backing/crop contracts.
- `src/ui/onboarding.ts`, `generated-owner-preview.ts`, `regular-guests.ts`, `pets.ts`, `src/main.ts`, `src/art-preview.ts`: presentation consumers.
- `scripts/precache.mjs`, `public/sw.js`: whole-output precache behavior.

This audit is read-only except for this document. No proposed compositor, atlas, resolver, cache or loading policy is implemented here.
