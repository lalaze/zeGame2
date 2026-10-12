# Price presentation findings

Confirmed P3 misleading purchase display, not a debit/calculation defect. Espresso base cost8, growth1.12: first upgrade from Lv1 charges8.96; displayed cost truncates to8. Starting at66 leaves57.04 (display57). Next cost10.0352 leaves47.0048 (display47). Both quote and buy use the same exact number. Exact reproduction using production modules is in pricing-reproduction.json.

References: src/game/data.ts:82,161; src/game/economy.ts:62–65,98–101,128–134; src/game/format.ts:8,19; src/ui/panel.ts:785. Affordability checks exact price, so exactly8 coins can show an unaffordable button labeled8. Scope extends to fractional upgrades and prices wherever formatMoney is reused. Suggested future change: distinguish precise transaction prices/cash from compact summaries; avoid modifying economic formulas to repair presentation.

HUD Today +$36 intentionally reads state.today.revenue, not profit: src/main.ts:799–802, src/locales/en.json:216. Label ambiguity is P3 copy issue; recommend “Revenue today” (and matching Chinese). Full ledger distinguishes revenue/cost/profit.

No production source modified by this investigation.

# Launch disposable harness

From repository root, after existing build:

    QA=$(mktemp -d /tmp/tiny-bean-full-qa.XXXXXX)
    cp -R dist/. "$QA/"
    cp docs/playtest/2026-10-12/harness.html "$QA/harness.html"
    cp -R docs/playtest/2026-10-12/fixtures "$QA/fixtures"
    python3 -m http.server 5221 --bind 0.0.0.0 --directory "$QA"

Open http://127.0.0.1:5221/harness.html. Check port unused first; choose another unused 5221–5299 if necessary. Harness refuses loading/writing on other origins. Fixtures generated through current production serialize/deserialize; all existing story fixtures are separate copied evidence, not newly simulated stories. Funded-start fixture injects only cash and an ordinary QA profile. Advanced fixture intentionally injects day19,1M cash,all55 recipes,all3 extension rooms,kitchen,2000 of each ingredient,espresso/latte/roll/donut selected and10 rolls/donuts morning bake. No cats, campaign, upgrades or story progress injected into these new fixtures; purchase/adopt through UI as needed.

Additional requested fixtures: insolvency.json has zero cash/beans, goal15 (no unclaimed rewards), otherwise starter state. Generator asserts production canEmergencyRestock is true after deserialize. legacy-v10.json stores an explicitly synthetic v10 save with1234.5 coins, day5, goal6 and no pets/promotion/regularGuests fields; generator verifies current parser migrates to v13 while preserving cash/profile. These are deliberately prepared boundary fixtures, not historical player saves. Requested sizes360×720,390×720,430×720,720×390 and1000×740 are all available.
