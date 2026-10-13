# Bulk generation handoff — 2026-10-13 09:28 UTC

## User-selected order / freeze

1. Generate the complete remaining selected-style resource library, with authoring QA and explicit missing/candidate status.
2. Freeze and submit/push the currently validated code through the separately assigned push owner. Only the root's release after generation permits that operation.
3. After remote SHA readback succeeds, integrate new resources and run game/visual validation.

No new gameplay integration or rendering refactor starts during step1. Current integrated code:1521passed/28skipped, production build passed; recoverable09:16checkpoint exists in6verified Library parts. New bulk assets remain in independent scratch folders. A generated candidate is not a runtime-validated asset or an accepted whole scene.

## Authoritative catalog

BULK-ASSET-CATALOG.json is extracted from current real modules. It includes exact55menu IDs/recipes/category/logical bare dimensions,12ingredients,39placeable items with surface/footprint/logical dimensions,35decoration choices,30customer identities including full design recipe,12breeds,5areas,kitchen layout,upgrade icons,existing61bitmap URLs and skin/hair/shirt/pants palettes. These are visual contracts only. Prices, inventory, routes, saves, seating and collisions do not change.

Existing generated PNGs are reusable selected-style resources, not missing work:11 main furniture/food modules,6 service props,3 wall assets,9 owner poses,15 Mina poses,14 Siamese poses and3 menu additions; exact61entries are in the JSON. Never regenerate an already-delivered asset merely to make a new count.

## Batch A — food, ingredients, compact UI

Remaining50menu IDs:coffee12,tea11,bread15,pastry12. Reuse espresso/latte/eggtart/croissant/cake. Generate independently recognizable actual foods based on ID and recipe, not color-swapped generic cups. No trays, shelves, labels, text or locked stock baked in. Native-aspect fit into catalog logical envelope; source can be larger. Runtime later supplies outline and padding. Independent RGBA crops,10–12px transparent padding, source-sheet coordinates and full alpha retained. Shared light:upper-left warm daylight.

Ingredients:all12IDs in JSON, distinct containers/food identities; preserve quantities as runtime text. Upgrade IDs in JSON need matching equipment/action thumbnail; do not alter their unlock semantics. Shared misc assets:empty cup/saucer,empty serving tray,water carafe+glass,plate,coin/star,heart,drop,crown,map/location,arrow,film,spark,order waiting/ready/served feedback. Keep numbers, timers, progress, labels and accessibility text runtime. Dynamic signature drinks cannot be enumerated:author reusable cup bases,liquid/foam/topping visual layers keyed by current recipe semantics; no invented new ingredient or static named-recipe icons replacing player choices. Review src/render/signature-drink-art.ts and current renderer before naming layers.

## Batch B — fixed customers

29missingcastIDs1–29, each15poses:down/up/right × stand/stepA/stepB (9;leftwalk mirrorsright), right/left × sit/sitPetA/sitPetB (6). Cast0Mina is reusable. Preserve exact ID,skin,hair,8-way customer hairstyle,outfit/accessory/accent; the saved Look's hairStyle modulo4 is NOT the whole customer silhouette. Consult src/render/sprites.ts customer drawing code and IDENTITY-COVERAGE-PLAN.md cast ledger; do not interpret names as permission to change ethnicity, hair or costume.

One identity stays the same across all poses. Stand18×28logical with4×backing target; source figure size can differ but whole family uses one scale and foot registration, never per-frame fit. Head/chibi proportions must match accepted owner/Mina references. Sitting uses fixed hip/seatContact; pet poses include authored hand contact. No chairs,cups,food,pets,human petting hands external to the character,shadows or badges baked into actor. Preserve real different stride/passing poses,not duplicated standing images. Manifest every frame:source/crop,size,opaqueQA bbox(alpha>128),foot,seatContact where relevant,petContact forpetposes,shared scale family,front/back/right direction. Entire sourcealpha remains intact.

## Batch C — cats

11missingbreeds,14states each:idle,swish,blink,happy,walkA,walkB,sleep,groomA,groomB,stretch,watch,lookUp,nuzzleA,nuzzleB. Siamese14reusable. Coat pattern,ear/face shape,eye color and fur length follow existing breed art; inspect current catFrames palette/geometry,not another breed's screenshot. Walking authored head-left, runtime mirrors when needed. Raised lookUp/nuzzle have genuinely different lifted chest/head,not stretchedneck. No food,people,hands,props or state symbols baked in. Eachposefoot/headContact measured; family/sheet scale shared,not individualheightnormalization. Current generated envelope24×18,foot(12,17),4×backing is a fit target,not an instruction to erase extended tail/ears. If a breed needs wider frame,declareit for later integration review.

## Batch D — custom owner and staff

Saved namespace2304Looks per role,not2304PNGrequests. There are 15 role/style recipes: owner, barista and server each use4 hairstyles; cook uses3 (existing style3 aliases style0 plus the chef hat). Source inspection confirms owner/barista share geometry and differ only in apron mapping. Therefore generate11 physical nine-pose families (4 shared owner/barista,4 server,3 cook),99 material-coded frames, while retaining15 distinct role/style recipes. Current full-color defaultowner9frames remain available. Color controls/hiddenpants remain independent; out-of-range oldsavevalues retain legacy fallback until reviewed.

Registered multi-layer imagegen sheets were tried twice and rejected for scale/position/material drift. Do not reuse them as valid masks. A single-canvas down-stand material-IDcandidate exists separately and is unaccepted. Explicit authored ID hue families:skinred0,hairgreen120,apronblue240,pantsyellow60,fixedshirtcyan180,blushmagenta300,fixedshoe/metalorange30,neutraleyes/outline/highlight; beaniehatpurple270for existing shirt+3rule. Runtime later maps declared tone to existing palettes androleuniformrules. This is deliberately authored coding,not guessing masks from old full-color images. Newfamilies are candidate_pending_render_review until hue ownership, silhouette, fixed details and extremeLooks pass. Do not claim all2304looks covered merely because a rainbow atlas was generated.

## Batch E — placeables and selected decor

39placeable IDs from JSON; existing mainplant/vine can be reused only if identity and envelope actually match. All retain exact grid footprints and anchor conventions. Floor sprites:centeredfoot at(cx,footY); wall objects:center insidetheir existing wall footprint. World painter and shop thumbnail must share the same art. Image source aspect preserved; no squeezing wide assets into narrow oldbounds. Declare render overflow separately from unchanged collision footprint.

Clock is LIVE analogtime:generate hand-free face/frame,center/radius metadata; hands remain dynamic. Catbed MUST empty; display_cabinet/coffee_cart inventory-sensitive surfaces empty; moving/tray/food layers remain separate. Posters may contain fixed illustration but no new illegible generated labels. Lights:unlit body separate from runtimeglow. Gramophone/piano remain decorative unless existing gameplaystates say otherwise.

Active initialworker ownsclock/coatrack/bookshelf/catbed in cafe-movable-v1; coordinate with it to complete this domain without duplication.

35decor choices include4*_none states requiring no bitmap. Remaining31choices grouped7wallmaterials,6floorpatterns,5countermaterialsets,3sillplants,4ceilingchoices,3rugs,3neonmotifs. Counter variants need separate top/front modules; wallpapers/floors need repeatable material tiles and edge metadata. Keep dynamicdaylight/shadows outside texture. Ceiling greenery/lights and rugs remain independent transparent layers. Text neons use runtime text or blank mountingbody,not changed caféname/menu.

## Batch F — five room environments / kitchen

All areas320logicalwidth with adaptiveheight; nominal wallband0–80, gameplay floor starts at existing layoutFLOOR_Y. Generate modular structural/background layers,not one image with fixedpeople/tables/furniture/menus. Reuse approvedmainwindow/board/lamp/countermodules; add remaining doors/windowexterior/tree/cloud/trim/curtain/tableware assets as independently composable pieces. Windows require real transparent apertures; time-of-daysky is dynamic. Frontwall/doorframe foreground remain separate to preserve occlusion.

Reading:bookcases nominal73×65each, central casement+drapes108×53, smallbookstack/planter; reusablearmchairs/lamp. Greenhouse:53pxwide glass/trussbay modules with transparentglass,fullheight80; independent hangingpots,96×18pottingbench modules,plants. Terrace:pergola posts/beams,fence/masonry modules,festoonlamps andflowers; underlyingdynamicoutdoors remains separate. All three keep independentdrawn signs with runtime text. Exact compositions src/render/region-art.ts.

Kitchen:cooler,dryStore,handSink,mixer,proofer,kettle,deckOven,convection,fryer,hood,bench,sheeter,standMixer,rack,pastryFridge,bins,dishPit,emptyinstalled/uninstalled hookup states. Exact x/width/foot data in JSON and src/game/kitchen.ts; actual rise and movingparts src/render/kitchen-art.ts. Rack22×46,fridge20×38,bins40×20,dishpit64×38,bench104×42 envelopes. Generate emptyrack/fridge and equipmentbody separate from food/stock, mixerarms,steam,bubblingwater,ovenhotlight. No bakedworkingmachine in locked/uninstalledroom. Kitchenclocks/status/labels remain liveUI.

## Delivery and generation gate

Each batch folder contains immutable source images,independentPNG crops,manifest+README,explicit reused/missing/candidate/produced IDs. Manifest tracks sourcecrop,fullsize,alpha,opaqueQA bbox andsemantic anchors; alpha>128 only measures bounds and never deletes lowalpha edges. Ordinarylosslesscropping/packing is allowed; substantivepaintedit usesimagegen. Check sourceplate boundaries rather than assuming equalcells. No duplicate frame renamed as animation. Record honestquality failures.

Generation gate means every requested ID/state has either a real candidate or explicit blocking gap, not that runtime validation passed. Root must receive exact gaps before approvingpush/nextstage. Stagecompletion ledger and artifact hashes should accompany the frozen code handoff. No codecommit/push by assetworkers.
