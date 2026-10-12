# P3 first style-preview scroll correction

2026-10-12. Scope: the independently reviewed first-selection scrolling defect only. No economic, save, stage, or operating-style rules changed.

## Change and regression

`src/ui/cafe-styles.ts` now resolves the mounted `.modal-body` inside the style-choice click callback, after rendering the preview. The first render happens before modal mounting, so the previous callback captured a null container and did not reset its scroll. Heading focus remains on the new preview heading, and previewing alone still does not apply a style or save state.

Four new cases in `src/ui/cafe-styles.test.ts` cover header/preparation entry × mixed/coffee initial focus. Each starts with nonzero scroll, checks the first and subsequent choices reset scroll to zero, verifies heading focus and the Apply control, preserves state/save-call counts, and checks Escape close/return behavior.

- Before the fix: all four new cases failed with scrollTop 480 rather than 0; the previous 23 tests passed. [Red-first log](logs/p3-red.log).
- After the fix: 84 focused tests passed across six files, including dialogs, preparation, mobile structure, prices, and actual-source background pause. [Focused log](logs/p3-focused.log).
- Complete ordinary suite: 919 passed, 17 explicitly opt-in skipped; 87 files passed, one skipped. [Full log](logs/p3-all-tests.log).
- `npm run build -- --outDir /workspace/shared/cafe-styles-final-build` passed, including normal font generation, TypeScript, and Vite. [Build log](logs/p3-build.log).
- Route contract: 6 passed, 2 opt-in skipped. [Route log](logs/p3-routes.log).
- `git diff --check` passed. No timeout changes or disabled assertions.

## Scope and evidence integrity

The gameplay evidence fingerprint remains `9c47eab7d2f2b1fe47e094df3f22c41f6a6a51043c338e952a6de37a27352c4d`. No long economic matrix was rerun for this UI-only fix. All frozen results, including adverse garden comparisons, remain unchanged. Earlier 72-case and 16-case browser evidence predates this correction and is not represented as a new full browser sweep. Unit tests use happy-dom and do not alone establish native layout or physical-device behavior.

No commit or push. Existing six-style working changes were retained. The production origin on port 5173 and player saves were not accessed.

## Independent recheck and native-browser limit

A separate real-module DOM recheck passed all four entry/initial-focus combinations: first and subsequent selections both reset scrollTop to 0 and focus H3. Its focused four-file run passed 71 tests. [Independent evidence](screens/p3-independent-qa.json).

The dot-cloud Chromium attempt could not reach the disposable UI-only harness at isolated port 5294 (`net::ERR_CONNECTION_REFUSED`), including one bounded retry. No game startup or save access was involved. Both temporary servers were stopped. This is a native-browser verification gap, not a successful visual/physical-device test; no new screenshot is claimed.

The final source patch also applies to the clean baseline and all 34 source files match byte-for-byte. [Patch check](logs/p3-patch-apply-check.json).
