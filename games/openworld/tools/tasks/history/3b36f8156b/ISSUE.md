# Woodcutting: replace the one-swing chop with a multi-step axe and shovel cycle

## What is wanted

Right now an axe used on a tree fells it in a single swing, leaving a stump and one log. Replace this with a fuller woodcutting loop:

- An axe first **notches** a tree, then **fells** it on the second swing.
- An axe **splits** a log into planks.
- An axe **breaks down** a charred tree.
- A shovel **digs a stump out** for good.
- A stump left alone **grows back** into a tree after two game days, but waits while someone is standing on it.

Pines must behave like other trees, through the `tree` tag rather than by being named specifically.

Two supporting changes are also wanted:

- **Interaction with loose items.** Items lying on a tile can be stacked (for example a stick on top of logs, on a stump). Interacting with a held item should reach the topmost loose item that the held item has an interaction for, and then the ground beneath it. An axe must be able to reach a log lying under a stick, and a shovel must be able to reach the stump under the logs.
- **Coverage.** The coverage tool's count of "forms without a purpose" should treat a form that an interaction rule singles out as its target (such as a log, which an axe splits) as having a purpose.

## Expected behaviour

Setting: the player faces a tile and holds the item named.

**Notch and fell**
- Axe on an un-notched tree: the tree gets a short-lived "notched" status (it fades after about 100 ticks). The terrain stays a tree. The interaction is reported by rule id `wood/notch`.
- Axe on a notched tree (rule id `wood/fell`): the notch is removed, the terrain becomes `stump`, and the tile gains two logs (`item/material/log`) and one stick (`item/material/stick`). The stump is marked as "regrowing".
- If a notched tree is left alone for more than 100 ticks, the notch heals and the next axe swing is a notch again (`wood/notch`). This applies to pines as well.

**Splitting**
- Axe on a log (rule id `wood/split`): the log becomes two planks (`item/material/plank`). One tree therefore yields four planks after splitting both logs. With the stick on top, the axe still reaches each log in turn.

**Charred trees**
- Axe on a `charred_tree` (rule id `wood/char`): the terrain becomes `ash` and one `item/material/coal` is left on the tile.

**Digging out**
- Shovel (`item/tool/shovel`, tag `tool:shovel`) on a stump (rule id `wood/uproot`): the "regrowing" status is removed, the terrain becomes `dirt`, and a stick is left behind. The stump never grows back.

**Regrowth**
- A felled stump has a "regrowing" status lasting two game days (a day is 24 × 600 ticks). When it expires, if no actor is on that tile, the terrain becomes `tree` again.
- If an actor is standing on the stump when it expires, the tree does not grow. The stump stays and the status is renewed for another 600 ticks (one hour), then tried again. Once the tile is clear on a later attempt, the tree grows.
- A grove of five felled trees, with one stump dug out, after two days is `tree, dirt, tree, tree, tree`. After one day all the untouched stumps are still stumps.

## Requirements

- The old single-swing chop rule (`core/chop`) is removed. An axe on a tree no longer produces a stump on the first swing.
- Notching applies only to a tree (tile with tags `tree` and `flammable`) that is not already notched; felling applies only to a notched one. Pines qualify through the `tree` tag.
- Two new statuses exist: `notched` (duration 100 ticks) and `regrowing` (duration 28800 ticks, i.e. two days).
- Felling yields exactly two logs and one stick on the tile, sets the terrain to `stump`, clears `notched`, and adds `regrowing`.
- Regrowth is an expiry-driven rule, with the occupied case handled as described above, so that a tree never grows around an actor.
- Digging a stump out removes the pending regrowth.
- Rules are registered in the base rule set, so the existing rule library picks them up with the stated ids: `wood/notch`, `wood/fell`, `wood/split`, `wood/uproot`, `wood/char`. Regrowth rules also exist for the free and occupied cases.
- When the player interacts using a held item on a tile with loose items, the engine tries the topmost item first; if the held item has no interaction with it, it tries the next one down, and finally the terrain. The result's `rule.id` must reflect the rule that actually fired.
- Coverage: a form is counted as having a purpose if any interaction rule's target selector, when it is purposeful (names a type, id, or a non-material tag), matches that form. The count of forms without a purpose should drop accordingly (from 61 to 59 with this content).
- The "undefined interactions" percentage in coverage stays unchanged.

## Interface

None. The tests use only the rule ids `wood/notch`, `wood/fell`, `wood/split`, `wood/uproot` and `wood/char`, the statuses `notched` and `regrowing`, and existing names (`buildSandbox`, `RuleLibrary`, `BASE_RULES`, `buildOntology`, `playerVerb`, and so on).
