# Economy check: weigh chance by expectation, return the simplex's dual, and prove "no free lunch" with prices

## What is wrong (for a fix) or What is wanted (for a feature)

The economy check (the modder package's economy module) looks for a "free lunch": a mix of conversion steps that leaves at least one thing more and nothing fewer. It has gaps.

1. **Chance is ignored or mishandled.** `ruleSteps` turns each leaf of a rule's tree into a step, treating all branches as exclusive. A rule that branches on `chance` is not counted by its odds. A lottery that loses on average (for example, three stones three times in ten, which is 0.9 stones per stick) can be reported as a free lunch. Nested rolls, rolls inside `all`, and items taken in by an emit that has a `chance` are not weighed either. A spawn count read from the host's kind (a property of the host's type, as a tree carries `logs`) is not counted.
2. **The simplex gives only a primal answer.** `simplexMax` returns just `x`. It silently stops when the problem is unbounded, accepts a negative `b`, and has a loose bound on pivots. It gives no dual, so there is no way to prove that no free lunch exists.
3. **No proof of "no free lunch".** When the check passes, nothing shows why. A set of prices would serve as the proof.

## Expected behaviour

### Chance in `ruleSteps`

Chance is counted by expectation: a run repeated without end gives on average what it gives once, weighed by its odds.

- A `chance: p` branch mixes its two ways. The "then" way counts with weight p and the "else" way with weight 1−p, on both what is taken and what is given.
  - Example: a stick host, `chance: 0.3`, then = destroy and spawn 3 stones, else = destroy. This gives one step that takes 1 stick and gives 0.9 stone. With a world step "2 stones → 1 stick", there is no free lunch.
  - The same rule with `chance: 0.8` gives 2.4 stones per stick, and the free lunch exists. Its net `makes` is stone only.
- A chance that sits inside an `all` condition counts the same way. The odds are the product of the `chance` entries in the `all`.
- Nested chances multiply. 0.5 then 0.5 with 4 stones gives 1 stone on average.
- A choice the state makes is the player's. A condition on what the item is, for example `is: {role: 'item', sel: {type}}`, is not a roll, so each way stays a step of its own.
  - When such a condition sits beside a roll in the same `all`, the mix (state condition holds, roll weighed) is one step. The else way alone (the state condition fails) is also its own step.
  - Example: `all[item is stone, chance 0.5]`, then = 5 stones, else = 1 stone. This yields steps giving 3 stones (the mix of 5 and 1 at 50%) and 1 stone (the else alone), and a free lunch exists with the craft step.
  - A pure `chance` (or an `all` of only chances) has no such extra step.
- An emit of impulse `taken` to the `item` into `contents` that carries a `chance` takes the item by that chance. With `chance: 0.25` it takes 0.25 of the item. With no chance it takes 1.
- A spawn `count` may be an amount reading a property of the host's type (`{prop, of: 'host', mul?, add?}`). It counts as the host type's numeric property × mul + add. For example, a property `yield: 3` with `add: 1` counts as 4. A count that cannot be known here (a param) is not counted. A count of zero or less gives nothing.
- A step is kept only when it takes something and gives something (above a small epsilon). An outcome that takes nothing or gives nothing is dropped, as before.

### The simplex

`simplexMax(A, b, c)` maximises c·x subject to Ax ≤ b, x ≥ 0, with b ≥ 0.

- It returns an object with the optimum `x`, the dual `y` (one entry ≥ 0 per row of A) and the `value`. Strong duality holds: c·x = b·y = value. The dual is feasible: Aᵀy ≥ c.
- On the textbook programme (max 3x+5y; x ≤ 4, 2y ≤ 12, 3x+2y ≤ 18) it returns x = (2, 6), value 36, y = (0, 1.5, 1).
- It does not cycle on degenerate vertices. Chvátal's example (A = [[0.5,−5.5,−2.5,9],[0.5,−1.5,−0.5,1],[1,0,0,0]], b = [0,0,1], c = [10,−57,−9,−24]) gives value 1 and x = (1,0,1,0).
- It throws an error whose message contains "unbounded" when the programme is unbounded (for example A = [[1,−1]], b = [1], c = [1,1]).
- It throws an error whose message contains "b must be" when any b < 0.
- It throws if it runs past a generous bound on pivots, which guards against floating-point trouble.

### `freeLunch`

- It uses the new `simplexMax` result and the returned `value` as the gain. A gain below a small threshold (about 1e-7) is no free lunch.
- It checks the mix it returns by hand: if any thing would be left fewer than it started (beyond a tolerance near 1e-6), it throws.
- It agrees with Bellman-Ford on random markets of one-in, one-out exchanges: a free lunch exists exactly when there is a positive-gain cycle.
- It still finds multi-input, multi-output free lunches. For example, 2 wood + 1 stone → axe; axe → wood + stone + handle; handle → 2 wood gives a net `makes` of `[{type: 'wood', n: 1}]`. With handle → 1 wood there is no lunch.

### `prices`

`prices(steps)` returns a `Map<thing, price>` when there is no free lunch, and `undefined` when there is one.

- Every price is ≥ 1.
- For every step, the value of what it gives (at these prices) is ≤ the value of what it takes.
- With no steps, every thing has price 1 (and an empty map when there are no things).
- On random markets, it returns a map exactly when there is no arbitrage.
- On the base content's economy (all of `economySteps` over the library's rules), it returns prices where no step gains value. That economy has more than 20 steps, since the base content's rolls are weighed in.

## Requirements

- `ruleSteps` weighs `chance` conditions (bare, inside `all`, and nested) by their odds, for both what is taken and what is given.
- State-dependent conditions remain separate steps (a choice for the player). A state condition beside a roll in `all` adds the extra "else alone" step; a pure chance does not.
- A `taken`-into-contents emit with `chance` takes the item by that chance (default 1).
- A spawn count read from the host's type property (with `mul` and `add`) is counted. Params are not.
- `simplexMax` returns `{ x, y, value }`, with `y ≥ 0` and `b·y = c·x`.
- `simplexMax` uses Bland's rule so it cannot cycle on degenerate vertices.
- `simplexMax` throws on unbounded programmes (message contains "unbounded") and on negative `b` (message contains "b must be"), and guards the pivot count.
- `freeLunch` verifies the mix it returns and throws if the mix leaves a thing fewer.
- `prices` is exported from the modder package (it must be importable from `@lsw/modder`, as `freeLunch` and `economySteps` are).
- Existing behaviour for rules without chance is unchanged: each non-chance branch is its own step, and steps that take or give nothing are dropped.

## Interface

- `prices(steps: Step[]): Map<string, number> | undefined` in `packages/modder/src/economy.ts`, exported from the `@lsw/modder` package.
- `interface Solution { x: number[]; y: number[]; value: number }` in `packages/modder/src/economy.ts`.
  - `x`: the optimum.
  - `y`: the dual, one value ≥ 0 per row of A.
  - `value`: the optimum value.
- `simplexMax(A: number[][], b: number[], c: number[]): Solution` in `packages/modder/src/economy.ts`. Its return type changes from `number[]` to `Solution`.
- `ruleSteps(rule: Rule, onto: Ontology): Step[]` keeps its signature. Its behaviour changes as above.
- `freeLunch(steps: Step[])` keeps its signature. Its behaviour changes as above.
