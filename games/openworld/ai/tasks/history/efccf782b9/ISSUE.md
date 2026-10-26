# Engine hard-codes OpenWorld's quality ids in `craft`; skill tree first layout and fifth branch are wrong; stale world files and lockfile entries remain

## What is wrong

A review of main after the profession-trees merge found four problems.

1. **The engine's `craft` effect names one game's content.** It hard-codes OpenWorld's quality ids (`crude`, `common`, `fine`, `masterwork`, `vowed`) and the stats `<station>:masterwork` and `<station>:vowed`. A game whose qualities have other ids cannot get quality tiers, lifts or "beyond reach" qualities from its own data.
2. **The skill tree's first layout is built for the wrong direction.** It is laid out for the default direction `combat`, not for the game's own first direction, which is the direction shown first.
3. **A direction with more than four branches draws the fifth branch on top of the first.** Branches past the fourth overlap earlier panels.
4. **Leftover files in the repository.**
   - 24 generated world files under `packages/client/public/world/` were committed by the merge. That path predates the split, is no longer gitignored, and nothing reads it.
   - `package-lock.json` still has `extraneous` entries for the old `@lsw/*` folders and `"peer": true` flags the merge's npm added.

## Expected behaviour

### Quality of a crafted item

Quality comes from the game's ontology data, not from fixed ids.

- **Tiers a maker can reach** are the ontology's qualities that have a `from`, ordered by `from` ascending. The base tier is still chosen from the maker's level plus `craft:<station>` against the recipe's level, as before.
- **The lift.** The maker's `<station>:lift` stat is the chance of moving the made quality one tier up among those tiers. If the quality is already the top tier, there is nothing above it and it stays. A lift of 0 or absent never rolls.
- **Qualities beyond reach.** A quality with no `from` is made outright with the chance given by the maker's `<station>:<quality id>` stat. If one of these is made, it takes precedence over the lift.
- **OpenWorld's behaviour is unchanged:** same chances, same order of random rolls, same results.
- With a test game with qualities `rough` (from -99), `plain` (from 0), `good` (from 5), `mythic` (no `from`) and a hand-made recipe at station `hands`:
  - no stats gives no quality tags (the base tier `plain` carries none);
  - `hands:lift: 1` gives `quality:good`;
  - `hands:mythic: 1` gives `quality:mythic`;
  - `craft:hands: 5` with `hands:lift: 1` gives `quality:good` (already at the top tier, so nothing to lift into).

### OpenWorld content

- The Masterwork skill grants `anvil:lift` (0.15) instead of `anvil:masterwork`. The Legendary Smith grant (`anvil:vowed`) is unchanged.
- An older save with a numeric `anvil:masterwork` prop (any `<station>:masterwork`) is converted when loaded: the value moves to `<station>:lift` and the old prop is removed. This is part of the game's `upgradeSave`.

### Skill tree layout

- The tree's first layout, before any direction is chosen, uses the game's first direction (falling back to `combat` only if the game has none).
- A direction with more than four branches goes round the four sides again. Each further branch stands beyond the previous branch on its side, with some room between panels, so that no two branch panels overlap.
- With 4, 6 and 9 branches in one direction, every branch has a panel, every skill is placed, no two panels overlap, and every skill lies inside its own branch's panel.

### Repository hygiene

- The 24 generated world files under `packages/client/public/world/` are deleted.
- `package-lock.json` has the `extraneous` `@lsw/*` entries and the merge's `"peer": true` flags removed, and `npm install --package-lock-only` leaves it unchanged.

## Requirements

- The engine's craft logic references no OpenWorld quality id or `<station>:masterwork` / `<station>:vowed` stat; everything comes from `onto.data.qualities` and the maker's stats.
- Reachable tiers are those qualities with a `from`, in ascending `from` order. A quality with no `from` is never a reachable tier or a lift target.
- `<station>:lift` moves the quality one tier up and no further than the top tier.
- A quality with no `from` is rolled by its own `<station>:<id>` stat; when it is made, it wins over the lift.
- Random rolls are made only when the relevant stat is above 0, in the same order as before, so OpenWorld's results are unchanged.
- The Masterwork skill grants exactly `{ 'anvil:lift': 0.15 }`.
- `upgradeSave` converts every numeric `<station>:masterwork` prop on entities to `<station>:lift` and removes the old prop.
- The first skill-tree layout uses the game's first direction.
- Branch panels in one direction never overlap, for any number of branches. Skills stay inside their own branch's panel.
- The world files and lockfile entries described above are removed.
- The typecheck and existing suites keep passing.

## Interface

None. The change adds no new names: the engine's `craft` effect, the `upgradeSave` of OpenWorld's game definition, the Masterwork skill's grant, `layoutTree` and the skill tree's initial layout are existing code with changed behaviour. The new stat names are the data convention `<station>:lift` and `<station>:<quality id>`.
