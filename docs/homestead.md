# The homestead (the Held Ground at work)

Built 2026-10-07. The Held Ground (docs/chapter-1.md §12) is the player's camp; this is what makes it a working
place. Content: `content/src/homestead.ts` (items in `items.ts`); the map's stall and pond in
`tools/src/demo/quest/haven.ts`; the panel is the menu's `shop` tab (`runtime/src/ui/menu.ts`). Proved by demo H2.
How the ground grows (its steward's panel, the stock, the grounds, the buildings, the residents) is below,
"The Held Ground's panel".

## The coin and the stall

- **The Dawnmark** (晨辉币, `item/misc/thornmark`) is the Held Ground's coin, and since 2026-10-11 every
  merchant's (docs/npc-sandbox.md §2.10). Alberic gives 30 at his welcome; the land's three widenings pay
  20, 40, 60 as they are built in his panel, the residents' tents 30, 50, 80 (below); the rest comes from
  selling (and a few favours: docs/quests.md).
- **Alberic's stall** (`fixture/furniture/stall/trade`, tags `stall`, `station:stall`) stands beside his post.
  A hand on it (E) opens the stall panel: four tabs — **Farming**, **Ranching**, **Fishing**, **Sell** — and
  the coin one carries.
- Buying and selling are **made at the stall as anything is made at a station** (`SHOP_RECIPES`, appended to
  `RECIPES`; `Recipe.group` names the shelf): the engine's `craft` uses up what one gives and puts what one
  gets in the bag. Away from the stall nothing is traded. No shipping bin (CLAUDE.md: no copying one game's
  own loops).

| Shelf | Offers (count for price) |
|---|---|
| Farming | wheat seeds 5/5, carrot 5/8, turnip 5/6, tomato 5/12, pumpkin 3/15, berry 3/10, herb 3/8, fertilizer 3/10, acorn 1/4, hoe 1/12, sickle 1/10, bucket 1/8 |
| Ranching | feed 5/6, bucket 1/8, crated hen 1/40, crated calf 1/120 (the same bucket is also on the farming shelf) |
| Fishing | bait 5/5, fishing rod 1/25 |
| Sell (one for) | wheat 3, carrot 5, turnip 4, tomato 6, pumpkin 14, berries 1, herb 3, egg 4, bucket of milk 12, fish 6, golden carp 30, old boot 1 |

## Farming (as before, Stardew/Minecraft)

Seeds sown on tilled earth take root; watering starts a full growth stage at the plant's own pace; a sickle harvests a
ripe crop (its yield and two seeds), a hand picks one; perennials grow back. **Fertilizer** (`item/material/
fertilizer`) worked into a growing crop is as ash: one more at harvest (`farm/fertilizer`, `farm/fertilize`).

Stages take **one hour** for turnip, parsnip and radish; **four hours** for pumpkin, cauliflower, melon, corn and
blueberry; **two hours** for the rest. There are two stages from seed to first harvest; a perennial regrows one.
Seeds and plants say these times in their tooltips. A dry crop waits, and watering starts its whole stage, however
long it waited beforehand.

**Irrigation** supplies two stages from one watering without slowing either stage; a sprinkler's neighbours get the
same benefit at their own pace. The `stage` clock measures growth, `watered` supplies the current stage, and
`irrigated` holds the next stage's water. The last stage spends all water before a perennial is harvested.
Older saves' finite `watered` clocks become `stage` clocks with exactly the same deadline (`GameDef.upgradeSave`).

With the thirty-coin welcome, five turnip seeds and an empty bucket cost fourteen. The pond fills the bucket;
five turnips picked by hand sell for twenty, leaving thirty-six coins, the bucket, and five returned seeds.
The fishing alternative is a rod (25) and five bait (5); one bait supplies five casts. Neither path needs extra funds.

**The crops** (content `crops.ts` VEGETABLE_CROPS; 2026-10-07 the ten after carrot, turnip, tomato and pumpkin, after
Stardew's fields): parsnip, potato, radish, cauliflower, melon, and five that **bear again** after the harvest —
corn, blueberries, strawberry, hot pepper, eggplant. Firstlight's garden grows only the first four (`GARDEN_CROPS`);
the rest come from the stall. Their sprites (`lsw/Crops/<id>/`) are drawn by `tools/src/art/crops-more.ts` over the
illustrated crops' sprout and young plant of their habit (leafy, sprawling, climbing).

| Seed (count / price) | Sells for | | Seed | Sells for |
|---|---|---|---|---|
| parsnip 5/5 | 4 | | corn 3/18 (again) | 5 |
| potato 5/10 | 6 | | blueberry 3/24 (again) | 3 |
| radish 5/8 | 5 | | strawberry 3/20 (again) | 6 |
| cauliflower 3/20 | 18 | | hot pepper 3/14 (again) | 4 |
| melon 3/24 | 22 | | eggplant 3/16 (again) | 6 |

## Ranching (Minecraft's feeding, Stardew's daily produce)

- **Feed** given to a beast (`home/feed`): it is fed for a day (`fed`, `home/fed`), content.
- **Milk**: an empty bucket used on a cow that is fed and not yet milked today gives a bucket of milk (the
  bucket becomes it; the cow is told and is `milked` for the day). Unfed, or milked already, it will not
  (`home/milk`).
- **Eggs**: hens lay every three hours (their stage), fed or not.
- **Beasts in crates** (`item/misc/crate_hen`, `crate_calf`): set down (G), the beast walks out (`home/crate`).
  The Held Ground keeps no beasts of its own (since 2026-10-11): they are bought, crated, at the stall.

- **Breeding** (Minecraft's; `home/breed-cow`, `home/breed-chicken`): a cow or a hen fed (feed, or wheat) calls to
  the fed of its kind within three cells; one that hears it, fed and not resting, bears a **calf** or a **chick**
  beside it, and both parents rest a day (`bred`). The young (`actor/creature/animal/calf`, `chick`: their parents'
  sprites, smaller) grow up in two days (a stage) and are not milked, do not lay and do not breed meanwhile.

## Fishing

- **The fish pond** lies north of the planted sword; any water fishes.
- **A rod** is made at hand from two sticks and two grass (the crafting panel), or bought.
- **Bait** used on a rod baits it: the rod keeps the casts (`bait` prop, five a bait; `home/bait`, `home/rod`).
  The rod's tooltip shows the remaining baited casts, including zero.
- A cast is a left click with the rod on water (it reaches three cells): a baited hook bites 70% of the time (a
  bite or not, a baited cast is spent), a bare one 35%; the water is stirred after, and nothing bites there until
  it settles.
- What bites (`core/fish`, `CATCH`), after Stardew's waters, tried in order:

| Fish | When / where | Sells for |
|---|---|---|
| Dawnscale (晨鳞鱼) | first light (05–08), 3% | 80 |
| Golden carp | 6% in shallow water, 10% in deep water (after the Dawnscale branch) | 30 |
| Soggy boot | 8% | 1 |
| Catfish | in rain or storm | 20 |
| Eel | at night (20–05) | 18 |
| Pike | deep water (the Held Ground's east pond and the Lakeside's lake have deep middles; a Deep Fisher, any water) | 16 |
| Sunfish | by day (06–19) | 6 |
| Perch | otherwise, often | 8 |
| Raw fish | otherwise | 6 |

## The Held Ground's panel (2026-10-11)

Alberic is the ground's steward (`actor/person/steward`, tag `haven-steward`). His talk's "The Held Ground…"
(`haven/steward`) opens its panel (`runtime/src/ui/homestead.ts`; content `haven.ts` `HAVEN_UPGRADES`; the
client game's `homestead` entry): a round chart of the ground (what is held green, each ring of mist still
standing dashed), the land's level, the **stock**, and three tabs of what the ground can grow into. The
widening errands (`haven1–3`) are gone; `content/src/migrateHaven.ts` drops them from older saves, keeping how
far the land goes and what was carried.

- **The stock**: what an upgrade asks for is handed to the steward (G, or from the panel: a stack dragged onto
  a card's slot hands as many as it lacks; a click hands all that open upgrades lack). It goes into the
  ground's stock (`haven.stock.<type>` on him, copied to the story for the panel: `haven/stock`), the thing
  itself used up; anything else handed to him is a gift. Every upgrade is built from the stock.
- **Land** (`haven.size`, one after another): the Grove (10 logs, 10 stones), the Meadow (20 planks, 5 iron
  ore), the Old Bounds (30 planks, 30 stones, 3 gold ore). Each lifts a ring of mist round the planted sword
  (`fixture/nature/mist`, its `ring`: `haven/mist-lifts`) and pays 20, 40, 60.
- **Grounds** (`haven.zone.<id>`): places of their own, 32 × 24, peaceful, a way back at their south edge —
  the quarry (land 1: boulders, iron, coal and a gold vein, stone that comes back), the timberland (land 1:
  dense woods, mushrooms, berries), the lakeside (land 2: a deep lake with pike) and the hot springs (land 3:
  three healing springs, herbs, frostcap). Opened, a ground's card has "Go ➜": the steward sends one there
  (`go:<id>`, a push). Built in `tools/src/demo/quest/haven.ts` `buildHavenGrounds`.
- **Buildings** (`haven.build.<id>`): a plot staked out at the heart for each (`fixture/build/plot/<id>`) looks
  every few seconds whether it is built (`haven/plot-<id>`) and becomes it: the workshop (a workbench), the
  kitchen hearth (a campfire, lit), the storehouse (`fixture/container/storehouse`, forty places, open), the
  weaving shed (a loom), the apothecary (a cauldron), and three residents' tents (2026-10-12).
- **The residents** (content `social.ts` `SOCIAL.residence`; the society module's `moveIn`): one held in full
  regard who is not bound to the main story (tag `storybound`) may be asked, once Alberic has fallen, to come
  and live in the Held Ground. A bed by the camp is there from the first (`home.camp`); each residents' tent
  built adds two in front of it (`home.lodge<n>.a/b`, open when `haven.build.lodge<n>` is set), seven in all.
  Asked with a bed free, they go at once and keep the ground's days from then on (`NpcData.resident`: asleep
  at their bed 21–7, about it 7–21); with none free they say so. Older saves get the tents' plots
  (`migratePlots`, with the Held Ground's other plots and Cass's loom).
