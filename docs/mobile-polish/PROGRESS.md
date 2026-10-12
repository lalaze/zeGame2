# Mobile polish progress

## Status
2026-10-12: Started on requested dot cloud checkout. Verified joyful-sloth and clean working tree before creating these docs. No repository AGENTS.md found under /workspace. Read existing first-10-minutes plans and acceptance.

## Evidence
Final validation: 666 passed, 6 existing opt-in skips; build and independent review passed. See ACCEPTANCE.md.

## Next
Implementation and available-cloud validation complete; evidence bundle awaiting final delivery review.

## Blockers/coverage limits
No physical mobile device is connected or authorized. Do not claim real touch, OS soft keyboard, mobile Safari or address-bar behavior from desktop simulation.

## Resume
Read this file and PLAN.md, inspect git diff, continue the earliest incomplete gate. Source: /workspace/shared/zeGame2. Existing /workspace/shared/cafeqa.sh serves prior task ports 5181–5185 and must not be reused for new test storage; use separate mobile-polish preview/origins. Build with npm run build, npm test. Browser network and shell network are isolated; launch QA server via cloud desktop terminal if needed. Keep test progress evidence here and logs/screenshots in this directory. No commit/push.

## Baseline gate passed / 03:16 UTC
Cloud Chromium, independent 5190/5191/5192 origins; real mouse/keyboard UI in 360×720 EN, 390×720 中文, 430×720 EN iframe viewports. All three created, inspected 50 starter beans, selected menu, served at 1×, normally drained/settled, claimed reward, upgraded Espresso, bought 10 beans and reopened. Day-1 reports: 360: 9 served/$27/+18; 390: 7 served/$21/+14; 430: 10 served/$42/+32. No injected save/clock/speed. DOM measured body width equals viewport in all three.

Priority findings:
1. Confirmed map→Arrange café leaves arrangeBar hidden by CSS (hidden=false, visibility=hidden), stranding mobile controls. Screenshot baseline-360-map-arrange.jpg.
2. Small hit boxes: settings 36px wide, arrows 30×38, speed 25×16–19, close 16–19px tall; onboarding swatches 24×24. Details logs/baseline-targets.json.
3. Furnish list scrollTop 1648→0 after clicking the already-active Furnish tab. Full navigation labels truncate at 360px. Screenshots baseline-360-navigation.jpg and width reopened captures.
4. Source-execution audit confirms immediate pointerdown placement accepts drag/cancel gestures, no up/cancel guard. This is synthetic input evidence, not a touch-hardware result.

Now implementing: dock service/furnishing controls outside scene on phone widths, comfortable targets, readable navigation, viewport-aware dialogs, panel position preservation and release-only gesture safety. Panel, input and responsive changes were integrated with focused regressions.

## Stage 2 / operation safety passed
- Replaced tiny over-canvas service controls with responsive docking outside the café. 44px targets, full tab labels, scrollable panel chrome and preserved browsing positions. Quantity/filter selected state is exposed through ARIA.
- New release-only native pointer recognizer cancels drags, outside releases, extra pointers, cancellations, geometry/view changes and live modal/save/background guards. These branches are automated native-event fixtures; real browser mouse select/place/store is separately verified.
- Real scroll: Furnish 1861 → same tab 1861 → Pantry/return 1861; 390→1180→390 yields desktop 1785, phone 1861. See logs/scroll-regression.json.

## Stage 3 / responsive and furnishing regression
- Map→Arrange now exits overview. Real browser focus goes to Done after the transition; keyboard Enter returns to Arrange café. Last stored-clock placement hides its Place action and correctly focuses Furnish instead.
- Selected existing wall clock, attempted illegal floor placement (red ghost + feedback), stored it, and placed it from storage using normal mouse UI. No claim of touch-hardware verification.
- Found 720×390 panel-scroll height 0 in intermediate layout; corrected to two columns with a 173px scroll area. Very short portrait uses outer vertical scrolling, while dialogs retain bounded scroll bodies/actions.
- Reduced-height 360×320 name editing: input and footer reachable, Enter advances and Save works. Bakery input/footer layout also reaches the footer; actual keyboard value persistence and focus were subsequently verified. This is viewport simulation, not OS keyboard execution.
- Advanced bakery fixture earned funds through normal purchases/service, including the built-in 4× speed solely for unlocking later UI (final six first-loop tests used 1×). Found quantity forecast overflow (368px scroll / 345px visible); separated bakery quantities/actions and wrapped forecast copy, now 345/345. Final EN/中文 width audits passed.
- Found a long bakery-open toast visually covering service controls after guide dismissal; extended in-flow mobile feedback to that state and verified non-overlap. No receipt suppression.

## Six final loop results
360 EN: 15 guests, $45 revenue, +$30. 390 中文: 17, $63, +$46. 430 EN: 16, $48, +$32. 360 中文: 12, $36, +$24. 390 EN: 10, $54, +$44. 430 中文: 9, $39, +$30.
Each created → starter stock → menu → default 1× → normal close/drain → settlement → goal claim → Espresso Lv2 → 10-bean purchase → refresh preserving cash → day 2 reopen. Exact actions/reports: logs/ui-actions.json, final-reports.json, final-runs.json. Six final target audits report no visible button/summary below 44px and body/document widths exactly 360/390/430; later bakery branches audited separately.

## Performance
10-second cloud Chromium 390×720 live-game sample: 599 rAF intervals, median/p95 16.7ms, 0 intervals over 50ms, 0 long tasks. No performance code change was warranted. This does not establish mobile hardware performance.

## Final gates passed / 03:58 UTC
- Numeric blur/held-button race was reproduced with a 600ms real mouse press and fixed. Typed 23 + held +5 = 28 once; typed 19 + Tab retains 19 and plus focus. Tests cover release, cancel, blur, and closed-dialog release.
- Final English/Chinese bakery width audits all pass. Long opening feedback sits above controls; recorded rectangles do not overlap.
- Real mouse drag cancellation, illegal clock position, clock storage/placement and successful floor-succulent move verified; Chinese390 keyboard Enter exits furnishing. Screenshot evidence added.
- Native Chromium background pause/return and foreground resume confirmed (about79 seconds wall time); see native-pause screenshots/timing. Six refresh comparisons already matched.
- Independent final review: no remaining P1/P2; 661 tests passed /6 existing skips;60 files, TypeScript/build and diff checks passed.
- No commit/push. No permissions or environment blocker. Physical-device coverage remains explicitly open in ACCEPTANCE.md.

## Remaining
Parent final delivery review only. Evidence archive contains test-only screenshots/logs and documentation, no source or credentials. Do not describe this as physical-phone testing.

## Resume details
QA server: /workspace/shared/cafe-mobile-servers.py serves /workspace/shared/zeGame2-mobile-preview on ports5190–5199, launched via the cloud desktop terminal. Source build can be refreshed with npm run build and copying dist/. to that preview directory; wrappers are QA-only and not shipped. Existing user port5173 and prior task ports5181–5185 are separate and must remain untouched. Open the appropriate qa-360.html/qa-390.html/qa-430.html through cloud Chromium. The header viewport selector changes only iframe geometry. Use a fresh unused origin for a new café rather than resetting user data. After a tool/context restart read current browser documentation, list tabs, and bind the test URL; browser variable names are not persistent recovery requirements. Shell and cloud browser networks are isolated; launch a missing server via the cloud terminal, not by assuming shell localhost is browser localhost.

## Additional independent-review P3 / 04:15 UTC
Authorized fix: inactive tabs now retain catalog-relative positions across desktop/mobile scroll containers. Shared conversion in panel-scroll.ts is used by both Panel and responsive docking; rebuilds preserve the same logical position. Five regression cases added, focused27 and full666/6skip pass, build/diff pass. Actual UI forward1118→1118 and reverse361→361 pass; original independent757 reproduction is within1px after correction. Independent reverse and360/430-width checks passed (under0.5px quantization); no remaining confirmed defects. Root final review passed; replacing the original Library ZIP identity.
