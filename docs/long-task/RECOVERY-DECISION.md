# Absolute insolvency: approved one-bean recovery

## Confirmed condition

A café has no cash sufficient to complete any unlocked recipe, no ready shelf or paid in-flight batch, and no usable ingredient combination. If it also has no claimable one-off goal reward, the current game has no recurring source of free ingredients or money. In particular, zero cash plus zero stock cannot produce another sale. Low reputation alone is not this condition: arrival suppression is capped at 25%, and fresh reviews can replace old reviews.

A reachable example after exhausting goal rewards: a café has 50 coins and no ingredients, then books noteLocal for 50. Booking is allowed because a menu exists; it does not reserve working capital. The promotion consumes prepaid time, but cannot create goods to sell. Cat adoption, upgrades or deliberately wasted baking can similarly exhaust working capital.

## Existing options

- Claim an eligible remaining goal: can restore liquidity, but is finite and sometimes locked behind an unaffordable prerequisite. Do not classify a brand-new café with an available first-day grant as absolutely unrecoverable.
- Change menu and restock if a complete cheaper recipe is affordable. The new restock fallback fixes partial-budget fragmentation without creating money.
- No ingredient/equipment sale or downgrade/refund API is present. Decorations can be stored, not sold for coins. Creator promotion explicitly has no refund.
- Settings → Reset café exists, but deletes the café, money and upgrades. It is a new game, not an economic recovery path. No user save was reset during this audit.

## Smallest proposed gameplay decision

Offer a narrowly gated emergency-restock action providing one espresso bean when the café cannot fund or make any saleable serving. This is new gameplay, not a correction to accounting. It would transfer at most one coin of inventory per activation and would need an explicit grant entry in reconciliation, no simultaneous accumulated free stock, transparent UI text, and regression coverage for repeated use, saves and promotion/cat interactions.

Alternative: retain insolvency as a loss state with a clear warning and reset flow. A supplier loan would avoid a free grant but requires debt persistence, repayment and failure semantics, making it materially larger than the minimal fix.

## Approval and implementation (2026-10-12)

The user explicitly approved the proposed one-bean emergency supply. The earlier proposal above is historical; this is no longer a pending product decision. Loans, money grants, refunds and automatic sales remain outside the change.

Entry: preparation dialog, next to normal restocking. It appears only when the audited eligibility predicate succeeds. The button provides exactly one coffee bean, keeps cash and earned revenue unchanged, and adds the existing espresso recipe to the menu if absent. There is no menu limit in current gameplay; existing selected dishes are never removed. Chinese and English copy disclose the bean and menu change.

Eligibility is evaluated again when clicked: preparation phase only; valid state and already-owned espresso; less than one coin and no beans; no serving available from any unlocked accessible recipe, including off-menu dishes; no affordable full recipe; no usable paid shelf or outstanding production; no claimable goal, free day-count reward or actually reachable free comfort reward. Suspended legacy bakery stock without an owned kitchen is not a usable serving. An unknown/malformed state fails closed rather than becoming a save-repair mechanism.

The comfort check now proves actual reachability: freely store movable objects in a scratch state, choose the best already-owned room styles, enumerate legal placements with the same canPlace rules used by the game, and search nonoverlapping placements until the goal is met. Distinct furniture kinds contribute once. Only an actual witness blocks aid; exhausting the exact finite search permits aid. No unowned purchases, added rooms, timeouts or search cutoffs are assumed. The previous upper-bound-only implementation was rejected and corrected.

A32-entry exact-result cache is keyed by remaining required comfort, current main-table count, open regions and distinct owned furniture definitions. Style changes are reflected in required comfort; placements/storage quantities collapse to ownership because all objects can be freely stored and rearranged. Validity, cash, ingredients, production and live goal checks run before cached reachability. Cache eviction never limits search correctness. Regression tests cover changed ownership, styles, goals, cash/stock, tables and regions. The preparation UI checks on render/click, not every frame.

Independent performance testing includes1024wall-decoration subsets and cache-evicted representative stress inventories: complex unreachable walls mean0.77ms/max0.98ms; all low-comfort owned furniture at maximum regions/tables mean2.82ms/max4.90ms; warm checks mean0.025–0.056ms. This is measured practical coverage, not a universal worst-case bound. Full reproducible measurements are in logs/emergency-layout-performance.txt.

The new bean immediately makes the predicate false, including after save/reload or repeat clicks. There is no lifetime quota: if the player consumes/wastes all usable supplies and again reaches genuine insolvency with no normal recovery route, a later one-bean grant may become available. This cannot accumulate free beans while stock, usable paid food, purchasing power or reward recovery remains. Deliberately returning to insolvency can obtain another bean; preventing that with lifetime quotas or debt would be a different unapproved policy.

Experimental accounting recognizes each granted bean as a one-coin inventory contribution, separate from earned revenue and operating profit. Ongoing verification and exact seeded results are recorded in EMERGENCY-RECOVERY.md and PROGRESS.md.
