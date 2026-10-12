# Living cats — acceptance record

Current status: ALL FIVE STAGES AND POST-AUDIT P2 REPAIRS PASSED (2026-10-12 07:05 UTC). Commit/push authorized by the user on2026-10-12 after final review.

## What changed
- Every adopted breed now has its own autonomous, numbered resident. The owned list can locate or greet each cat.
- Sustained strolling, naps, grooming, stretching and window watching use cached pixel-art poses. Cats retain the existing breed appearance.
- Playful, quiet and affectionate temperaments and favorite room/spot are saved per cat. Temperament affects travel, rest and greeting; beds/windows influence destinations, with reachable fallbacks.
- Residents follow the existing public-room doorways, avoid furniture and tables, yield to people and do not reserve staff/customer paths. Kitchen access is excluded.
- No-care cats rest; refilling restores activity. Adoption cap, adoption prices, care consumption, care purchases and traffic bonuses are unchanged.
- Direct taps show identity/personality/activity/care. Touch hit areas scale to at least 44 CSS pixels; explicit controls are 44px high. Reduced motion holds walk/groom poses and removes greeting particle motion while retaining static feedback.
- Refresh restores identity/preferences and safely reconstructs transient actors/routes. It deliberately does not replay a saved in-progress walk or save arbitrary world coordinates.

## Stages 1–4 automated evidence (historical baseline)
- npm test: 720 passed, 7 skipped. Six skips are previous opt-in suites; the seventh is the new opt-in benchmark. The evidence command separately passes all 5 tests.
- npm run build: passed, including TypeScript. git diff --check: passed.
- 17 dedicated engine tests cover behaviors, personality differences, room boundaries/doorways, furnishing clearance, care exhaustion/recovery, pause, resize, newly built tables, moved/stored beds, dense legal furnishing and distinct destinations.
- Persistence, UI, pixel-frame caching and scene-hit tests cover old/corrupt saves, all 12 breed frames, dialog/care behavior, controls, and one resident draw pass per frame.
- Three paired 360-second seeded runs retain exact equality of GameState and customer/server/cook/pass state with and without cosmetic cat updates. See logs/performance.json.
- Three-cat Node measurements: 12,000 updates at dt=0.05; mean about 0.0065ms/update, p95 about 0.0075ms. These measure the engine only, not rendering or a phone.

## Actual browser evidence
- Separate synthetic origins 5210/5211; original user5173 save untouched.
- Desktop scene click opens correct name/personality/activity dialog; pet action returns to the scene with heart/happy-pose/text feedback. Find cat follows actual room and shows matching number.
- Legacy v11 fixture with empty supplies migrated to three unique saved personality/preference records. $8 refill changed cash exactly 97,100→97,092 and restored only ginger care to180, activity and +8% bonus. Remaining cats stayed asleep.
- English360 and Chinese390/430 workflows exercised; Chinese dialog audit at360/390/430 reports body width equal viewport and 44px action heights.
- Existing reading-room bed moved and stored through real Arrange controls, followed by a care refill. Engine tests separately verify path retargeting for both stationary and traveling cats.
- Three-cat live-service Chromium390×720 measurement: 601 rAF intervals, median/p95 16.7ms, zero intervals over50ms, zero long tasks. See logs/cat-browser-performance.json.

- Native Chromium tab switch: background for68.591 seconds, café clock remained2:48 on return, then resumed to3:28 normally. No background page probing was used. See native-pause screenshots and logs/cat-background-timing.json.

## Review and repairs
Independent code review found table-upgrade entrapment, stale traveling-bed goals and duplicate resident rendering. All repaired and regression-tested; final review found no remaining blockers. Additional legal dense-furnishing and shared-destination tests ensure three residents remain present and distinguishable.

## Coverage limits
Desktop Chromium with CSS viewport emulation, not physical-device testing or an independent new-player trial. Timing describes this cloud computer only. Reduced-motion handling is code/test reviewed; a physical device setting was not changed. No commits, pushes, publishing, new software or login changes were made.

## Evidence distinctions
Cross-room safety, doorway coordinates and no-obstacle-crossing conclusions come from deterministic engine tests and code review, not a human playtester. Actual browser UI observations show resident room labels changing and Find cat selecting those rooms, but do not independently prove every route segment. The five-behavior image is an explicitly labeled composed QA display of the real production sprite functions; other scene screenshots are actual game observations using synthetic saves.

## Stage 5 — actual reciprocal guest interaction
- Cared-for affectionate residents can approach a real stable seated guest; playful residents do so less often, quiet residents do not initiate. Only same-room reachable seats qualify. Five ordinary cat behaviors remain.
- Sequence: safe approach → nuzzle/look-up2s → seated guest hand response3s → safe retreat. Cat/guest identity is fixed for the visit. No chasing a departing guest. At most one pair globally; long cooldowns and at most one greeting per observed seated visit.
- Real guest position/seat/phase are read-only. No added payment, traffic, care usage, patience, service, income or order effects.
- Empty care, guest departure/movement, furnishing changes, pause-time layout changes, missing route and timeout cancel safely. Return anchors resize and occupied origins use another clear point. Reload builds fresh unbound actors; no interaction is stored or replayed.
- All12 breeds have look-up/nuzzle poses; all30 guest appearances retain their head, clothing and skin in hand-response poses. Reduced motion uses fixed cat/hand frames plus static heart; existing thoughts share their original budget and avoid paired bodies.

### Final checks
-751 tests passed,7 opt-in skips; standalone evidence7/7; TypeScript/build and diff-check passed.36 engine tests. Independent engine/render review and follow-up cloud-overlap review passed with no remaining blockers.
- Three paired360-second seeded services each observed actual interaction phases, with exact equality of full GameState and customer/server/cook/pass records. No empty-test economic claim.
-12,000 advancing-Sim updates with3cats: mean0.0223ms, p950.0416ms, p990.1610ms. Engine-only Node timing, machine-dependent.
- Actual Chromium390×720 final frame sample:601 intervals/10s, median/p9516.7ms, no>50ms frames and no long tasks. Earlier sample552 intervals/p9533.3ms retained for transparency. No physical-phone performance claim.

### Actual UI vs synthetic/engine evidence
- Isolated5213 loaded a synthetic service save generated by normal Sim advancement; its production SaveSession identity/seat/timer restoration was tested. Guest timers were never manually lengthened.
- Cloud browser naturally displayed calico approaching/nuzzling/being petted in reading room. A neighboring thought covered the response, exposing a real rendering issue; fixed and independently reviewed.
- Final production browser images show playful ginger approaching, nuzzling and enjoying a seated guest's hand response in the terrace. The final gesture is unobscured. Timestamp log identifies the phases. These are actual live-game captures, not drawn mockups.
-390-width native mouse click on the scene opened the correct Oreo dialog,44px buttons verified, dismissed normally. Find cat and free Pet controls used successfully. Refresh and foreground return resumed service normally. Desktop-emulated input, not physical touch hardware.
- Background scene stayed at21:04 while the art tab was foreground; native return resumed21:06 without a large catch-up. Phase-specific pause/cancellation and blocked-route safety are automated engine tests, not a human scenario test.
- The visual contact sheet is clearly labeled composed QA art: production five-behavior frames and paired-gesture frames, not a live scene. Reduced-motion rendering is code/test/static-sheet evidence; OS reduced-motion preference was not toggled on real hardware.

### Scope boundaries
This remains a visual interaction. No guest decisions or service are delayed. No new cats, prices, perks or monetization. No commit/push. Original5173 user save untouched. The new stage has no new physical-device/new-player study, nor a full real-UI replay of every cancellation branch.

## Post-audit P2 repair — independent verification
The parent audit found two gaps in prior coverage: an idle server could stall ordinary walking indefinitely, and the walking raster's head-left convention was flipped incorrectly on rightward travel. Both are fixed without service/economy changes.

- The exact default-server/ginger/seed13 reproduction now still moves at1200s, with max route stall2s. Empty care sleeps after3.3s instead of retaining an impossible route.
- Default and upgraded server levels0/1/2 all pass1200s progress checks. Three seeded1200s open services have exact GameState+Sim runtime equality with cats enabled/disabled; interactions actually occur. See repair-long-sim.json.
- Dynamic re-routing uses ordinary speed and existing static/doorway geometry; unusable targets choose safe fallback space. Paused time does not accrue a blockage timer. Care/rest and interaction cancellation regressions are covered.
- Per-breed head-pixel tests verify left/right walking orientation. Stationary/guest-facing conventions remain unchanged.
- Full standard suite760pass/8opt-in skips; independent suite with both evidence switches762pass/6pre-existing skips; build/diff-check pass. First parallel audit run timed out in two5s tests under concurrent load, then passed in full with maxWorkers2. Both logs retained.
- Independent reviewer additionally tested blocked doorways with/without care, sleeping away from the door, cancelled guest approaches, reset and removal timer cleanup; no new blocking findings.

### Repair browser coverage
Actual production cloud Chromium on independent5214 captured a leftward pair and a three-frame rightward sequence. Cat head matches displacement direction in both cases; default idle server remained in place. No scripted relocation or random override. Captures are ordinary scene observations, not the exact seed13 unit harness. The deterministic1200-second deadlock/rest proof is separately labeled automated in repair-long-sim.json. The contact sheet now also shows production left/right flip behavior and remains labeled composed QA art.
