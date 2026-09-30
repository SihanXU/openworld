# Large Symbolic World — Roadmap

Status: **proposed** (2026-09-30).

Scope: make the world that already exists respond to the player, and add simple gameplay
loops on top of it — storage, woodcutting, building, farming and their neighbours. Almost
all of it is base rules in `packages/content/src/rules.ts` and new types in the ontology;
the engine and client changes it needs are small and are listed in §5.

## 1. Baseline

`npm run coverage` resolves every item form (110, held as its bare type, plus the empty hand)
against 92 targets — every fixture type, with containers also open, the chest also locked and
lightable fixtures also lit, every terrain, a person, a creature, yourself, and an item on the
ground — with `put` and `interact` (`take` and `interact` for the empty hand; only `interact`
on yourself). 20,313 combinations:

| Outcome | Count | Share |
|---|---|---|
| A rule written for that case | 689 | 3.4% |
| A generic answer (set down, store, hand over, splash water or oil, examine, nothing to take) | 5,318 | 26.2% |
| Undefined | 14,306 | 70.4% |

A form or fixture type has a purpose when a rule that answers it singles it out by what it is
for (a tag or type other than a material: "anything flammable burns in a fire" does not
count), or, for a form, when it adds power to attacks.

What that looks like in play:

- **61 of 110 item forms have no purpose.** They can be carried, handed to someone, or
  burnt in a fire, and nothing else. That includes the shovel, sickle, smith hammer, knife,
  fishing rod, rope, broom and lockpick; seeds, ore, coal, stone, planks, wool and wax;
  every book, scroll and map; all armour and clothing; the coin pouch.
- **18 of 38 fixture types have no purpose** beyond catching fire: table, chair, bed, bench,
  counter, stall, anvil, cauldron, loom, altar, statue, seal stone, haystack, log pile,
  beehive, mushroom ring, fence, training dummy.
- **Basic physical actions are missing.** Putting an apple on a table is undefined. So is
  dropping something in water, taking anything from a fixture that is not a container, and
  using most items on yourself.
- **Chains stop halfway.** A hoe makes farmland, and seeds are tagged `plantable`, but no
  rule sows them. The cauldron is `cookware` but cannot be lit, so nothing ever cooks in
  it. A bomb put in a campfire burns away quietly. A chest hands back only its first item,
  and nothing shows what is inside. The pack has no stacks.

## 2. Principles

- **Behaviour is rules.** Each loop below is a handful of rules, types and statuses. An
  engine change is listed only where no rule can do the job.
- **Three verbs, one hand, no menus.** Choices are made in the world: what you hold, what
  you put it on, how much is already there.
- **Rules address classes.** `tool:axe` on anything tagged `tree`, never one tree.
- **Timers are statuses.** Growth, regrowth and bites are statuses with a duration and a
  rule on `expire`. Expiry is checked when the player is on the map, so a crop left alone
  is simply ready when you come back; no background simulation is needed.
- **No catch-all for "interact holding X".** Base rules cover what a player expects from a
  farming and crafting world. Odd combinations stay undefined and remain the Mod port's.
- **Full scale.** Every loop is placed by the world generator in all six regions, not only
  in Hearthvale.

Time, for the durations below: 600 ticks are one game hour and one minute of play.

## 3. Order

| # | Milestone | Depends on |
|---|---|---|
| M0 | Coverage report | — |
| M1 | Hands, surfaces and storage | — |
| M2 | Woodcutting | M1 (stacks) |
| M3 | Building | M2 (planks) |
| M4 | Farming | M1 (stacks, facing indicator) |
| M5 | Gathering and fishing | M1 |
| M6 | Cooking | M4 (wheat), M5 (fish) |
| M7 | Mining and smithing | M3 (hammer, frames) |
| M8 | Wearing, resting, trading | M1 |
| M9 | Every item has a purpose | all of the above |

M1–M4 are the core. M5–M9 can follow in any order.

## 4. Milestones

### M0 — Coverage report

Land the sweep behind §1 as `packages/tools/src/coverage.ts`: the matrix, the list of forms
and fixture types without a purpose, and the three counts. It is the progress meter for
everything below and runs with the tests: `npm test` fails if any form or target answers fewer
combinations, or any form or fixture type loses its purpose, than the committed baseline.

Done when: `npm run coverage` reproduces the §1 numbers on the current tree.

### M1 — Hands, surfaces and storage

The verbs always have a physical answer, and containers become usable.

Player flow:

1. **G** facing a table, counter, stall, bench, altar or anvil sets the held item on it.
   **F** takes it back.
2. **E** on a chest opens it and a panel shows what is inside. **F** takes the highlighted
   item (choose with the arrow keys, a number, or a click); **G** stores the held item;
   **E** closes it.
3. A full container refuses. A key locks an unlocked container again.
4. The pack groups identical items into stacks (`Plank ×4`); **1–9** holds one from a stack.

| Rule | When | Effect |
|---|---|---|
| `core/put-on-surface` | put · fixture tagged `surface` | item moves onto the fixture's tile |
| `core/put-in-water` | put · water tile, when no other rule (filling a vessel) claims it | refused: "It would sink." Nothing is lost |
| `core/put-in-lava` | put · lava tile, `flammable` item | item burns up |
| `core/put-blocked` | put · solid tile | "There is no room there." |
| `core/store-full` | put · open container at capacity | "It is full." |
| `core/lock` | interact · `key` on a closed, unlocked container | container gains `locked` |

Content: tag `surface` on table, counter, stall, bench, altar, anvil. A `capacity` prop per
container type: chest and wardrobe 12, shelf and bookshelf 8, crate 6, barrel and sack 4,
pot 2.

Needs: E1, E2, E3, C1, C2, C3, C4 (§5).

Done when: an item can be put on and taken from every surface; any chosen item can be taken
from a chest of twelve; nothing a player puts down anywhere is lost.

### M2 — Woodcutting

Replaces the one-swing `core/chop`.

Player flow:

1. **E** with an axe on a tree: the first swing notches it, the second fells it. It leaves
   a stump, two logs and a stick.
2. **E** with an axe on a log lying on the ground splits it into two planks.
3. A stump left alone grows back into a tree after two game days. **E** with a shovel digs
   the stump out for good and turns the tile to dirt.
4. **E** with an axe on a charred tree yields coal and leaves ash.

| Rule | When | Effect |
|---|---|---|
| `wood/notch` | interact · `tool:axe` on a `tree` tile without `notched` | tile gains `notched`; leaves fall |
| `wood/fell` | interact · `tool:axe` on a `notched` tree | tile becomes `stump` with `regrowing`; spawn 2 logs, 1 stick |
| `wood/regrow` | expire `regrowing` on a stump | tile becomes `tree` |
| `wood/split` | interact · `tool:axe` on a log item | log becomes a plank; spawn a second plank |
| `wood/uproot` | interact · `tool:shovel` on a stump | tile becomes `dirt`; spawn a stick |
| `wood/char` | interact · `tool:axe` on a charred tree | tile becomes `ash`; spawn coal |

Content: statuses `notched` (100 ticks) and `regrowing` (28,800 ticks). Pines follow the
same rules through the `tree` tag.

Done when: one tree becomes four planks; a cleared grove has regrown two game days later
except where stumps were dug out.

### M3 — Building

Things are built where they will stand, from a frame that counts what has been put in.

Player flow, for a chest:

1. **G** a plank onto a plank lying on the ground: the two become a wooden frame.
2. **G** more planks onto the frame. **E** empty-handed reads its progress ("A frame of 3
   planks. One more makes a chest.").
3. **E** with a hammer finishes it: a crate at two planks, a chest at four.
4. **E** with an axe on a crate or chest you no longer want spills its contents and returns
   half the planks.

| Rule | When | Effect |
|---|---|---|
| `build/start-frame` | put · plank on a plank item | target becomes `fixture/build/frame` with `planks: 2`; held plank consumed |
| `build/add-plank` | put · plank on a frame with fewer than 4 | `planks` + 1; held plank consumed |
| `build/read-frame` | interact · empty hand on a frame | reports progress and what a hammer would make now |
| `build/finish-crate` | interact · `tool:hammer` on a frame, `planks` = 2 | frame becomes a crate |
| `build/finish-chest` | interact · `tool:hammer` on a frame, `planks` = 4 | frame becomes a chest |
| `build/unfinished` | interact · `tool:hammer` on a frame, `planks` = 3 | "One more plank." |
| `build/dismantle` | interact · `tool:axe` on a wooden container | contents spill; spawn planks; fixture removed |

Other buildables use the same pattern:

| Result | Made from |
|---|---|
| Fence | stick on stick makes stakes; hammer |
| Campfire (unlit) | stone on stone makes a ring; add two sticks |
| Bridge | plank put on shallow water; the tile becomes `bridge` |
| Sign | plank on a stick; hammer; write on it with quill and ink |

Content: `fixture/build/frame`, `/stakes`, `/ring` and their art. A hammer is added to the
Hearthvale kit and to farm and home loot; today it spawns only in smithies.

Needs: E5.

Done when: starting from an axe, a hammer and a forest, the player builds a chest beside
their field, fills it, and crosses the Hearthvale pond on a bridge they laid.

### M4 — Farming

Player flow:

1. **E** with a hoe turns grass or dirt into farmland (exists today).
2. **G** seeds onto farmland: a sprout appears.
3. **E** with a water bucket waters it. Two game hours later it has grown one stage. Water
   the young plant again; two hours later it is ripe.
4. **E** with a sickle harvests two of the crop and two seeds. **F** with bare hands picks
   one of each.
5. Ash put on a growing plant fertilizes it: one more of the crop at harvest.
6. **E** with a shovel digs a plant up and returns its seed.

Ripe wheat is tagged `dry` and `flammable`, so the existing fire rules burn a ripe field
and leave ash — which is fertilizer.

| Rule | When | Effect |
|---|---|---|
| `farm/sow` | put or interact · `plantable` item on farmland | the seed moves to the tile and becomes its `cropType` |
| `farm/water` | put or interact · water on a `growing` crop without `watered` | crop gains `watered`; vessel empties |
| `farm/grow` | expire `watered` on a `growing` crop | crop becomes its `nextType` |
| `farm/harvest` | interact · `tool:sickle` on a `ripe` crop | spawn 2 × `yieldType` and 2 × `seedType`; crop removed |
| `farm/pick` | take · empty hand on a `ripe` crop | 1 × `yieldType` to hand, 1 × `seedType` to the tile; crop removed |
| `farm/fertilize` | put · ash on a `growing` crop | crop gains `fertilized`; ash consumed |
| `farm/harvest-rich` | as `farm/harvest`, crop is `fertilized` | one more of the crop |
| `farm/dig-up` | interact · `tool:shovel` on a crop | crop becomes its seed again |

| Crop | Seed | Yields | Notes |
|---|---|---|---|
| Wheat | wheat seeds (today's generic "Seeds") | wheat | ripe stage is `dry`, `flammable` |
| Herb | herb seeds | herb | |
| Berry bush | berry seeds | berries | perennial: picking returns it to `young` instead of removing it |
| Oak | acorn (a felled tree drops one, 25%) | — | no watering; after two game days the tile becomes `tree` |

Content: types `fixture/crop/<plant>/{sprout,young,ripe}` as siblings, each with
`nextType`; tags `crop`, `growing`, `ripe`; props `yieldType`, `seedType`. Seed types
`item/seed/<plant>` with `cropType`. Statuses `watered` (1,200 ticks) and `fertilized`.
Crops do not block movement.

World: the generator already lays up to three fenced fields in every village, half of them
farmland and half dry grass; all become farmland, sown at mixed stages. Farm containers
hold seeds; Hearthvale gets a small plot beside the well and
a hoe, a sickle and four seeds in the kit.

Needs: E4, C3.

Done when: starting with four seeds the player ends a game day with more seeds than they
began with, and a torch dropped in ripe wheat costs them the harvest.

### M5 — Gathering and fishing

**Gathering.** **F** empty-handed on a source gives its produce and marks it `picked` until
it regrows.

| Source | Gives | Regrows | Notes |
|---|---|---|---|
| Bush (tile) | berries | 1 game day | |
| Flowers (tile) | herb | 1 game day | |
| Mushroom ring | mushroom | 1 game day | |
| Haystack | wheat | never; 6 per stack | |
| Log pile | log | never; 6 per pile | |
| Beehive | honey jar | 2 game days | stings for 3 unless `smoked`: **E** with a torch first |
| Snow (tile), with a shovel | snowball | — | the snowball exists today and nothing produces it |

**Fishing.** A timing game in three rules.

1. **E** with a fishing rod on water casts a line.
2. After about five seconds the water splashes: a bite, lasting a second and a half.
3. **E** again during the bite lands a raw fish in the pack. Too late and it is gone.

| Rule | When | Effect |
|---|---|---|
| `fish/cast` | interact · `tool:fishing` on water without `line` or `bite` | tile gains `line` |
| `fish/bite` | expire `line` on water | tile gains `bite`; splash; "A bite!" |
| `fish/land` | interact · `tool:fishing` on water with `bite` | `bite` removed; spawn a raw fish to the actor |

Content: statuses `picked`, `smoked`, `line` (50 ticks), `bite` (15 ticks). A fishing
rod in the Hearthvale kit.

Done when: a player with no food walks out, gathers and fishes, and returns with a meal.

### M6 — Cooking

- **Cauldron.** Tag it `lightable` so the existing `core/cook` reaches it.
- **Bread.** Wheat becomes `cookable` with `cookedType` bread: hold it to a lit fireplace.
- **Stew.** Pour water into a lit cauldron, put in three ingredients, then **E** with a cup
  or plate to ladle out a stew worth more than its parts.
- **Salting.** Salt on raw meat or fish cures it: worth more health than raw, no fire
  needed.
- **Explosives.** A bomb or firecracker put in a fire, or touched with a flame, explodes
  through the existing `spread` and `hit` primitives instead of burning away.

| Rule | When | Effect |
|---|---|---|
| `cook/fill-cauldron` | put or interact · water on a cauldron | cauldron gains `filled`; vessel empties |
| `cook/add-to-stew` | put · edible or cookable item on a lit, `filled` cauldron | item consumed; `ingredients` + 1 |
| `cook/ladle` | interact · cup or plate on a cauldron, `ingredients` ≥ 3 | held vessel becomes a stew; `ingredients` reset |
| `cook/salt` | put or interact · salt on a `raw` item | item gains `salted` and 3 `heal`, loses `cookable`; salt consumed |
| `fire/detonate` | put · `explosive` item on a lit fixture, or a flame on an `explosive` | explosion; fire spreads; nearby actors are hit |

Content: `item/food/stew`; status `filled`; tag `salted`.

Done when: a harvest and a catch become bread and stew without leaving the village square.

### M7 — Mining and smithing

- **Ore.** Mining a cave wall has a chance to drop iron ore or coal with the stone. A
  boulder breaks into stones after three hits instead of yielding forever.
- **Smelting.** Ore put into a lit forge becomes an ingot. Coal put into a forge makes it
  `hot` for a game hour; smelting needs `hot`.
- **Smithing.** The anvil carries a pattern. **E** empty-handed turns it to the next
  pattern and names it (axe, pickaxe, hoe, shovel, sickle, knife, hammer). Put an ingot
  and a stick on the anvil, then **E** with a hammer: they become the tool on the pattern.

| Rule | When | Effect |
|---|---|---|
| `mine/ore`, `mine/coal` | as `core/mine-rock` on a cave wall, by chance | also spawn ore or coal |
| `mine/crack-boulder` | interact · `tool:pickaxe` on a boulder | `cracks` + 1; at 3 the boulder becomes stones |
| `smith/stoke` | put · coal on a lit forge | forge gains `hot` |
| `smith/smelt` | put · `ore` on a `hot` forge | ore becomes its ingot |
| `smith/turn-pattern` | interact · empty hand on an anvil | `pattern` advances; names the new one |
| `smith/forge-tool` | interact · `tool:hammer` on an anvil holding an ingot and a stick | both consumed; spawn the patterned tool |

Content: `item/material/ingot/{iron,gold}`; status `hot`.

Needs: E3 (counting what lies on the anvil), E5.

Done when: a player with a pickaxe and a hammer leaves a cave and makes their own hoe.

### M8 — Wearing, resting, trading

- **Wearing.** **U** with armour or clothing puts it on: it stays in the pack tagged `worn`
  and its `armor` prop is added to defence. **U** again takes it off. One item per slot
  (head, body, hands, feet).
- **Resting.** **E** on a bed sleeps until 06:00 and restores full health.
- **Trading.** **U** with a coin pouch empties it into a `coins` counter on the player.
  **G** an item onto a merchant sells it for its `value`. **F** on an item on a shop shelf
  buys it if `coins` covers the price, and refuses otherwise.

Needs: E3, E6, E7, E8.

Done when: a player sells a harvest in the nearest village, buys a helmet with the coins,
wears it, and sleeps the night at an inn.

### M9 — Every item has a purpose

One rule each for what is still inert after M1–M8.

| Thing | Rule |
|---|---|
| Book, letter, map | **U** reads it: its text appears |
| Scroll (elemental) | **E** at a target casts its element once; the scroll is consumed |
| Flute, lute | **U** plays it: notes, and people nearby remark on it |
| Bell | **U** rings it: people nearby turn to face you |
| Dice | **U** rolls one to six |
| Mirror | **U** lists your current statuses |
| Soap | with water, removes `oiled` |
| Broom | **E** on an ash tile sweeps it back to bare ground |
| Knife | **E** on a bush, herb or mushroom ring gathers without marking it `picked` for as long |
| Lockpick | **E** on a locked container: opens it by chance, breaks otherwise |
| Rope | put on a stick makes a fishing rod |
| Cup, goblet, cooking pot | hold water like a bucket |
| Wool | at a loom becomes cloth |
| Wax | with rope makes a candle |
| Quill and ink | **E** on a sign or chest writes a label |
| Rag doll | given to a child: a line of thanks only children say |
| Potions | antidote clears statuses; fireproof draught grants `fireproof`; murky potion is random |
| Snowball | thrown: a small ice hit |
| Ring shard | put on a seal stone: the stone lights |
| Altar | water put on it becomes holy water |
| Statue, seal stone | **E** reads an inscription |
| Well, fountain, trough | **E** empty-handed drinks |
| Training dummy | hits show their damage number |

Done when: the coverage report lists no item form and no fixture type without a specific
rule.

## 5. Engine and client changes

| # | Change | For |
|---|---|---|
| E1 | `take` prefers a loose item on a fixture's tile over the fixture, unless the fixture is an open container with contents | M1 |
| E2 | The frame carries the contents of the open container the player faces; `take` accepts a chosen item id | M1 |
| E3 | Condition `count`: how many entities matching a selector are in a role's contents or on its tile | M1, M7, M8 |
| E4 | `spawn.type` accepts `@prop:` read from a named role, as `transform.into` already does for its own entity | M4 |
| E5 | Text templates read props: `{target.planks}` | M3, M7 |
| E6 | `addProp.delta` accepts an `Amount`, so it can read another role's prop | M8 |
| E7 | Property comparisons between roles (`actor.coins` ≥ `target.value`) | M8 |
| E8 | Primitive `advanceTime` | M8 |
| C1 | Items draw above the surface fixture they lie on; today they draw beneath every fixture | M1 |
| C2 | The pack and the container panel show stacks | M1 |
| C3 | An outline on the tile the player faces | M1, M4 |
| C4 | Container panel in the HUD | M1 |

Every engine change is added to the ModSpec docs in the same commit, and each milestone's
rules come with tests beside the existing ones in `packages/content/test`.

## 6. Choices to confirm

| # | Question | Recommendation |
|---|---|---|
| 1 | How does the player choose what to craft without a menu? | Count on a frame for building (M3), a pattern on the anvil for smithing (M7). Both are in-world and need no new verb. |
| 2 | Should an item put in water be lost? | No: refuse. Losing a key to a mis-press is not a fun rule. |
| 3 | Growth speed | Two game hours per watering, so a crop takes about four minutes of play. Tune after playing it. |
| 4 | Are village fields, chests and shop shelves free to take from? | Yes until M8 adds prices; ownership and theft are not in this roadmap. |
