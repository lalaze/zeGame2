**Changes**
- **1. Frames:** Master-palette walnut, honey and brass joinery with crisp 2px outlines and directional bevels.
- **2. Buttons:** Raised surfaces, one-art-pixel pressed travel, selected markers, disabled states and visible keyboard focus.
- **3. Hierarchy:** Unified HUD/action materials; inset tool faces expose more room art without shrinking hit targets.
- **4. Forms:** Pixel checkboxes, fields, select chevrons, existing steppers, progress bars and disclosures; native semantics retained.
- **5. Typography:** Existing pixel fonts preserved, with locale inheritance and 16px phone form text.

**Files**
`src/style.css:2961`, `src/ui/pixel-chrome.test.ts:1`, `docs/art-grid/README.md:38`, `artifacts/art-grid/round-5/report.json:1`.

**Verification**
Typecheck and build pass. All 21 focused tests pass. Full suite: **2,513 passed; 103 baseline failures plus four baseline suite-load failures; zero new failures**. No existing test contracts changed. No new PNGs, so PNG conformance checking was unnecessary.

**Remaining Gaps**
Browser visual acceptance—including DPR 1/2/3 crispness, responsive overflow and live interactions—remains pending outside the sandbox; the report contains the complete checklist. Native spinner glyphs and select-popup internals remain browser-rendered. No gameplay changes, commits or stash operations.