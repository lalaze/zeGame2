# Signature drinks: design decisions

The existing economy is a static menu with exponentially upgraded prices. Custom drinks use immutable recipe-encoded IDs rather than reusable numbered slots: editing/deleting a saved card cannot reinterpret historical sales or in-flight orders. User names are labels, never recipe identities or progression keys.

Four base families: coffee, tea, milk and fruit. Use existing ingredient unlocks. Quantities, incompatible pairs, total additions and costs are bounded and validated. A small quarter-serving trial consumes real stock; saving does not consume again. Recipe testing is deterministic and canonical duplicates cannot earn practice. Only actual successful handoff counts as sales and practice.

Initial local price proposal: ingredient cost × 1.6 + 2, without static-menu level multipliers. Preparation increases with ingredient amount and complexity. This offers early/mid-game variety, not an exponential late-game money bypass. All labels must distinguish ordinary ingredient margin from final tips/route bonuses.

Saved recipes: at most six; on menu: at most three. Changes require closed preparation phase, protecting orders already accepted. The custom workbench explains its automatic 30/100 delivery practice alongside existing paid standard-menu signature research.

## Final deterministic sensory rules
Formula quality starts at4.0: exactly one addition +0.1; double milk or double cream +0.2 (nonstacking); double sugar −0.2; double spice −0.1; three additions −0.1. Clamp3.7–4.3, rounded to one decimal. Successful-delivery practice adds0.3 at30 and0.5 at100 to custom quality, capped5. Stock-menu quality and paid research are unchanged. These are transparent gameplay rules, not real culinary claims.

Quarter trial remnants are valid stored inventory. Purchases remain whole units: forecast and rescue affordability round missing units upward before quoting, so displayed cost equals an executable purchase and fractional leftovers cannot strand a player.
