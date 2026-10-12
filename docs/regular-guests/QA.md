# Verification and reproduction

## Results

- Final `npm test`: **799 passed, 9 skipped**, 70 files passed, 1 skipped. Skips are existing opt-in experiments plus the regular-guest evidence writer; their opt-in scope is not represented as a default pass.
- Final `npm run build`: passed TypeScript and production build. Chinese font subset regenerated from final localized content.
- Final affected core/content/journal/i18n suite: **43 passed**.
- Independent review suite: **12 passed** (included above and in full suite).
- Opt-in real-Sim reachability runner: **1 passed**, three seeds, every one reaching all **60 chapters by business day 19**.
- `git diff --check`: clean. Validation was completed before the separately authorized commit/push.

## Reachability experiment

Run:

```sh
REGULAR_GUESTS_EVIDENCE=1 npx vitest run scripts/regular-guests-evidence.test.ts --reporter=verbose
```

Seeds 13 / 517 / 2026 served 2524 / 2544 / 2537 customers in 19 business days respectively. Every guest's five chapters unlocked through actual Sim arrival and successful handoff events. The runner records guest/chapter/day/count/time for all 180 unlocks in `logs/reachability.json`.

Initial conditions are explicitly synthetic: 10,000 coins, 100,000 beans, normal base equipment, an espresso-only menu and a named QA profile. No synthetic story progress, identities, successful visits, upgrades or recipe unlocks are injected. Each day runs 600 game seconds, then normal closing/draining/settlement. The journal is serialized and parsed after every business day; all fields must round-trip unchanged. No chapters are read until all 60 are unlocked. Afterwards explicit reads and rereads are checked for idempotence. A live order is captured and restored through the production SaveSession.

This proves event-path reachability with sufficient stock. It does **not** claim a first-time player naturally earns the initial stock, finishes all stories in 19 short sessions, or has those outcomes without careful service. Visits continue on long business days, but story day gates require the player to close/open normally. No real-world time or consecutive-login requirement exists.

`fixtures/fresh.json`, `first-day.json`, `all-stories.json` and `live-service.json` are generated test saves. They are not player saves. Never load them on a real player's origin.

## Browser verification

Used the dot cloud Chromium browser, isolated origin `http://127.0.0.1:5216`, and an explicit QA harness. The production build ran in real iframes sized **1000×740** and **390×844 CSS pixels**. This is real browser rendering, **not** a physical phone, mobile browser engine, or human/new-player playtest.

Checked:

- English and Chinese desktop/mobile journal and short story views; pixel portraits and Chinese glyphs rendered.
- Twelve-person list scrolls inside the dialog; its Close row remains separate and reachable. Desktop list: client/scroll widths both 525px, scroll height 3657px and client height 554px.
- Mobile document width/scroll width both 390px; English and Chinese story body widths both 326px with no horizontal overflow. Observed story buttons and both status-strip buttons were at least 44px high.
- Ordinary mobile scene, management docking, reputation strip and new Regulars badge remain usable together.
- First-day fixture shows only two met people, one chapter each, and ten unnamed future regulars. Fresh fixture shows zero names/portraits/titles, only the 0/12 total.
- Next conditions are visible: Mina's second story needs café day 3 and at least two successful handoffs; daily limit and reading independence are stated without revealing locked titles.
- Next/Previous and Read later do not mark chapters read. Explicit Finished reading changes the unread badge from 48 to 47 exactly once. A new page load retains the completed read and skipped unread chapters.
- Escape closes the dialog and restores focus to the Regulars button.
- Actual live-service pause: after an explicit save while the journal was open, 23.966 seconds of measured wall time and page navigation left dayTime exactly 7.2631133333333135, served 2525, coins 18451 and the entire journal unchanged. Otto's pending visit 744 remained pending. See `logs/browser-pause.json`.
- Existing document-visibility pause/save logic was preserved and reviewed; hidden-tab input safety remains covered by the full existing suite. The separate real-browser measurement above verifies modal pause, not an independent hidden-tab timing experiment.
- Captured browser diagnostics contained 147 extension metadata-transport errors, no entries from the game origin, and no other error/warning entries. See `logs/browser-console.json`; these extension errors are not labeled game errors.

Screenshots are in `screenshots/`, with filename suffixes identifying language, viewport and scenario. They show the harness label so the synthetic origin and viewport methodology are explicit.

To recreate the visual fixture safely: generate the evidence saves, build, copy `dist/` to a new QA-only directory, add the generated fixtures under `fixtures/`, and copy `scripts/regular-guests-qa.html` to `harness.html`. Serve that directory from an unused local port. The screenshot run used port 5216; choose another unused origin if it is already in use. The harness Load button overwrites **only that origin's** localStorage.

## Known limits

- Favorite drinks intentionally influence the order mix when eligible. Unchanged prices, tips, inventory consumption, queue/service/review/settlement rules do not imply identical totals for every multi-item menu.
- No additional financial rewards, traffic bonuses, forced story popups, timers or choices were added.
- Appearance definitions are reused from the existing pixel cast; this feature gives twelve of them persistent names and stories, rather than replacing all thirty designs.
- These validation results describe the pre-commit implementation. Publication was authorized separately after acceptance.
