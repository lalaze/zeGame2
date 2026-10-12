# Supporting review supplement

Reviewed current UI action log, background-pause and catalog logs, and all11 screenshots available through08:28UTC. These show the advertised empty-menu warning, readable first story, explicit ledger revenue/cost/profit, actionable stockout, waiting-tab safeguard, active bakery, three-cat cap and all-room map. No new P1/P2 confirmed from these artifacts. Screenshot08 captures a room pan rather than a stable endpoint, so it should not be interpreted as a missing day-control defect. Viewport-emulation screenshots remain desktop-browser evidence only.

## Confirmed P3: Cats browsing state resets

Opening a room invokes panel.refresh at src/main.ts:287–289. Refresh clears the render signature (src/ui/panel.ts:426–429); update rebuilds and constructs a new PetPanel (463–481,700–709). Its defaults are catalog mode/all filter/first unowned cat (src/ui/pets.ts:11–21). Consequently My cats reverts to Choose a cat, including on unrelated room purchases. Leaving Cats for another management tab then returning has the same effect. Saved cats, care, cash and identity are not changed by this UI reset.

An isolated DOM reproduction appended only to a disposable /tmp checkout tests owned→refresh→catalog and owned→Pantry→Cats→catalog, with exact serialized state equality. This confirms a presentation-state issue rather than pet data loss. Log: cat-subview-reproduction.log. Fix consideration: keep pet browsing state in the parent Panel and restore it after rebuild, like existing menu filters. Do not persist transient tab state in gameplay save unless intentionally designed.

## New opt-in story reachability evidence

Ran the existing REGULAR_GUESTS_EVIDENCE runner in a disposable git archive of HEAD17286bb with shared node_modules. Existing committed evidence in the working checkout was not rewritten. Result:1test/1file passed,0failures,3.41s. Each seed13/517/2026 reached all60chapters by business day19. Runner includes daily serialize/deserialize, explicit idempotent reads and pending live-visit restoration. Output: regulars-reachability-recheck.log and regulars-reachability-recheck.json.

These are automated actual-Sim trajectories with synthetic initial10000coins/100000beans. They are not human playtests or proof that a normal player naturally funds that inventory. No new story/identity/progression injection was added to the runner.

## Remaining high-value risks, not known defects

- Campaign duration/care at4× and their separate prepaid expense accounting through normal/forced settlement and reload.
- Mobile360px all-tools HUD with reputation, Regulars, Cats controls and long Chinese text; stable scene endpoint after navigation.
- Forced Settle now confirmation vs cancellation with a genuinely pending accepted meal; reviews/flavor/story credit once only.
- Genuine insolvency action and legacy-v10 restore on isolated fixture origin; no changes to player's original save.

Earlier price finding remains P3 exact-price truncation, with no mismatch between quote and actual debit. HUD Today is intentionally revenue with ambiguous copy. No production edits were performed.
