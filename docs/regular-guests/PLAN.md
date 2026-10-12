# Regular guests and neighborhood stories

## Scope

Twelve named regular guests, five bilingual chapters each (60 total), integrated into ordinary café visits. No purchases, reward multipliers, extra arrivals, forced daily login, or external clock requirements. Existing cats, tutorial, mobile controls, customer reviews, table service, prices and settlement rules remain.

## Design and interfaces

- `src/game/regular-guests-content.ts`: names, roles, personalities, drink preferences, existing pixel cast identities, and 60 localized chapter definitions.
- `src/game/regular-guests.ts`: validated persistent journal, encounter/actual handoff progression, read state, and menu-safe preferences.
- `src/game/sim.ts`: use the existing shuffled 30-appearance cycle. A qualifying cast appearance becomes a regular after its debut day. No independent arrival or economic random stream is added.
- `src/ui/regular-guests.ts`: manual journal and short skippable reading dialogs; `showModal` safely pauses the existing simulation.
- The first two characters can appear on day 1; another pair becomes eligible on days 3, 5, 7, 9 and 11. Each cast appearance appears once per shuffled 30-arrival cycle, not according to wall-clock time.
- Chapter N requires N successful handoffs and café day >= debut day + 2 × (N−1). At most one new chapter per guest per day. Reading never gates future chapters. Failed service does not advance chapters; merely loading or reopening the journal does not advance anything.
- A preference may only choose an unlocked, selected and currently supplyable drink. Missing preferences fall back through normal service without unlocking recipes or generating ingredients.
- Unknown people remain a count, not a spoiled list. Existing names, identities, successful visits, unlocked stories and explicit read state persist. Old saves start without fabricated history.

## Stages and acceptance

1. **Story design.** Complete 12 distinct cast/role/preference definitions and bilingual five-part arcs; document all triggers in `STORIES.md`.
2. **One complete guest.** Mina's encounter → actual successful handoff → five business-day chapters → skip/read/reread → save restore vertical slice.
3. **All twelve.** Expand shared rules; prove all 60 chapters reachable through actual multi-day Sim visits with deterministic seeds. Fixture funding/stock must be labeled.
4. **Journal and durability.** Failed service, repeated updates, repeated reading, background/pause, reload mid-service, old saves and malformed data checked independently.
5. **Bilingual desktop/mobile.** Build and complete regression suite; inspect actual cloud-browser UI at desktop and 390px CSS width in English and Chinese. Preserve screenshots. Browser viewport testing is not a physical-device or human playtest.
6. **Independent review and handoff.** Independent code/content review, resolve material findings, rerun affected checks; package only docs/logs/screenshots for native Library delivery. No commit/push authorized.

## Evidence rules

- Keep synthetic UI fixtures separate from natural arrival/service event evidence.
- Use an independent browser origin and test-only saved café; never touch the user's `5173` origin or real assets.
- Record exact commands, test counts, final state and source revision/diff checksums.
- No claim of economic equality for changed preferred-order mix. Preserve service/payment formulas and demonstrate identical unmodified-path behavior separately.
