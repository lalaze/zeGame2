# Living cats — implementation and acceptance plan

Current status: ALL FIVE STAGES AND POST-AUDIT P2 REPAIRS PASSED (2026-10-12 07:05 UTC). Commit/push authorized by the user on2026-10-12 after final review.

## Goal
Turn up to three adopted cats into recognizable autonomous residents, preserving every breed, adoption/care price, care consumption, traffic benefit and service rule. Keep the café quiet, warm and legible on desktop and mobile.

## Stage gates
1. Autonomous behavior: independent actors, sustained patrol/sleep/groom/stretch/window observation; safe reachable routes through existing doorways; only open public rooms; no economic/service mutation. Gate: pure behavioral/navigation tests.
2. Personality and environment: stable saved playful/quiet/affectionate traits and cozy/window/explore preferences; meaningful behavior weights; catbed/window destinations and safe fallback; arrangement invalidation; empty care causes rest and refill restores activity. Gate: compatibility, preference, furniture and conservation tests.
3. Interaction and animation: cached breed-specific pixel animation; feedback and name/personality/current state; individual selection and locate controls for three cats; subtle guest attention without changing service; reduced-motion support. Gate: UI/render tests and real browser desktop/mobile-emulated demonstration.
4. Final verification: old/new save reload, paused/hidden return, mobile touch targets and layout, three-cat timing measurements, full npm test/build, independent review. Gate: evidence and limitations recorded; repair failures before claiming completion.

## Safety and evidence
- Never touch the original localhost:5173 user save. Use a new independent browser origin and synthetic test saves, clearly labeled.
- No commit, push, login, new software or unrelated environment changes.
- Browser evidence is desktop and mobile emulation, not a physical phone or independent new-player study.
- Evidence package contains only reports/logs/screenshots, no source code or credentials.
- Existing local mobile-polish commit and all prior functionality remain intact.

## Stage 5 — reciprocal guest interaction (authorized 2026-10-12)
Research found real seated guests are `waiting`/`sitting`, fixed at `seatSpot`; `seatApproach` is the clear floor point in front. Existing guest hearts were cosmetic proximity only. Implement a separate read-only visual binding to a real guest, leaving all simulation actors and economics untouched.

- One interaction at a time: cared-for affectionate cats may approach a stable seated guest in the same reachable room; playful cats less often, quiet cats do not initiate. Long individual/global cooldowns.
- Safe approach → brief nuzzle/look-up → seated guest reaches down/pets → safe departure. Reuse floor navigation; never move or reserve a guest.
- Cancel on departure/movement, empty care, layout changes, unreachable route or timeout. Freeze at dt=0; rebuild without bindings on reload. No new saved data.
- Cached breed/cast artwork and static reduced-motion poses; existing numbered selection, detail panel, mobile controls retained.
- Gates: pure phase/cancellation/navigation tests; paired identical-seed economic/service conservation; real cloud-browser interaction frames/mobile/performance; full test/build; independent final review. Clearly distinguish synthetic fixtures, engine tests and actual browser visuals. Replace existing Library evidence identity only after review.

## Post-audit repair gate — 2026-10-12
Fix reviewer-reproduced persistent-server deadlock in ordinary cat walking (including depleted-care rest), and head-left walking art rendered backward on rightward journeys. Preserve safe movement, existing interaction facing and all service/economy rules. Gate: exact1200-second natural-Sim reproduction, long-run motion/rest and blocked/cancel tests, per-breed pixel orientation checks, full tests/build/economy comparison, independent re-audit and browser-visible demonstration. No commit/push.
