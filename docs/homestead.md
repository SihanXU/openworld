# The homestead (the Held Ground at work)

Built 2026-10-07. The Held Ground (docs/chapter-1.md §12) is the player's camp; this is what makes it a working
place. Content: `content/src/homestead.ts` (items in `items.ts`); the map's stall and pond in
`tools/src/demo/quest/haven.ts`; the panel is the menu's `shop` tab (`client/src/ui/menu.ts`). Proved by demo H2.

## The coin and the stall

- **The Dawnmark** (晨辉币, `item/misc/thornmark`) is the Held Ground's coin. Alberic gives 30 at his welcome;
  his widening errands pay 20, 40, 60; the rest comes from selling.
- **Alberic's stall** (`fixture/furniture/stall/trade`, tags `stall`, `station:stall`) stands beside his post.
  A hand on it (E) opens the stall panel: four tabs — **Farming**, **Ranching**, **Fishing**, **Sell** — and
  the coin one carries.
- Buying and selling are **made at the stall as anything is made at a station** (`SHOP_RECIPES`, appended to
  `RECIPES`; `Recipe.group` names the shelf): the engine's `craft` uses up what one gives and puts what one
  gets in the bag. Away from the stall nothing is traded. No shipping bin (CLAUDE.md: no copying one game's
  own loops).

| Shelf | Offers (count for price) |
|---|---|
| Farming | wheat seeds 5/5, carrot 5/8, turnip 5/6, tomato 5/12, pumpkin 3/15, berry 3/10, herb 3/8, fertilizer 3/10, acorn 1/4 |
| Ranching | feed 5/6, bucket 1/8, crated hen 1/40, crated calf 1/120 |
| Fishing | bait 5/5, fishing rod 1/25 |
| Sell (one for) | wheat 3, carrot 5, turnip 4, tomato 6, pumpkin 14, berries 1, herb 3, egg 4, bucket of milk 12, fish 6, golden carp 30, old boot 1 |

## Farming (as before, Stardew/Minecraft)

Seeds sown on tilled earth take root; watering starts a growth timer (two hours a stage); a sickle harvests a
ripe crop (its yield and two seeds), a hand picks one; perennials grow back. **Fertilizer** (`item/material/
fertilizer`) worked into a growing crop is as ash: one more at harvest (`farm/fertilizer`, `farm/fertilize`).

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
  The Held Ground starts with a cow and two hens.

- **Breeding** (Minecraft's; `home/breed-cow`, `home/breed-chicken`): a cow or a hen fed (feed, or wheat) calls to
  the fed of its kind within three cells; one that hears it, fed and not resting, bears a **calf** or a **chick**
  beside it, and both parents rest a day (`bred`). The young (`actor/creature/animal/calf`, `chick`: their parents'
  sprites, smaller) grow up in two days (a stage) and are not milked, do not lay and do not breed meanwhile.

## Fishing

- **The fish pond** lies north of the planted sword; any water fishes.
- **A rod** is made at hand from two sticks and two grass (the crafting panel), or bought.
- **Bait** used on a rod baits it: the rod keeps the casts (`bait` prop, five a bait; `home/bait`, `home/rod`).
- A cast is a left click with the rod on water (it reaches three cells): a baited hook bites 70% of the time (a
  bite or not, a baited cast is spent), a bare one 35%; the water is stirred after, and nothing bites there until
  it settles.
- What bites (`core/fish`, `CATCH`), after Stardew's waters, tried in order:

| Fish | When / where | Sells for |
|---|---|---|
| Dawnscale (晨鳞鱼) | first light (05–08), 3% | 80 |
| Golden carp | 6%, anywhere | 30 |
| Soggy boot | 8% | 1 |
| Catfish | in rain or storm | 20 |
| Eel | at night (20–05) | 18 |
| Pike | deep water (the Held Ground's lake has a deep middle) | 16 |
| Sunfish | by day (06–19) | 6 |
| Perch | otherwise, often | 8 |
| Raw fish | otherwise | 6 |
