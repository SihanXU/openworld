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
- **Bait / 鱼饵**: while holding a fishing rod, right-click yourself to choose a bait stack and confirm it. One bait is consumed and the number of casts shown for it is added (`home/bait`, `home/rod`). While casts remain, only bait with the same name and quality can be added; spend the current bait before changing it. The original inventory route still works: hold bait and right-click the rod in the bag, then choose **Apply bait (+N casts) / 装上鱼饵（+N次）**. The rod's icon shows its loaded bait, and its tooltip shows the remaining casts, including zero.
- **鱼饵**：手持鱼竿时右键自己，选择一种鱼饵并确认；确认后消耗一份，并增加该鱼饵标注的抛竿次数（`home/bait`、`home/rod`）。鱼竿还有抛竿次数时，只能追加同名、同品质的鱼饵；用完后才能换饵。原背包操作仍可使用：手持鱼饵，在背包里右键鱼竿并选择**装上鱼饵（+N次）**。鱼竿图标会显示已挂鱼饵，提示框会显示剩余次数，耗尽时显示 0。
- **Casting**: hold the rod and left-click water (it reaches three cells). A baited hook bites 70% of the time (a
  bite or not, a baited cast is spent), a bare one 35%; the water is stirred after, and nothing bites there until
  it settles.
- **The Held Ground fishing fight**: on the Held Ground and its grounds, a cast waits one to three seconds; a bite
  lasts two seconds. The wooden fishing panel shows a 40% control zone for ordinary catches and 34% for rare ones.
  Hold the left mouse button or Space to raise the zone, and release to lower it; keep the swimming fish inside to
  fill the catch meter. Fish slow near the ends and make short pauses and bursts. Esc cancels without a catch or bait
  refund. A pause or lost window focus freezes the fight and clears the held input. Loading a save ends an unfinished
  line; bait already spent and stirred water remain, and no fish is awarded.
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
  (`fixture/nature/mist`, its `ring`: `haven/mist-lifts`) and pays 20, 40, 60. Right-clicking a ring shows the
  required Alberic route and its land level, materials and completion reward.
- **Grounds** (`haven.zone.<id>`): places of their own, 32 × 24, peaceful, a way back at their south edge —
  the quarry (land 1: boulders, iron, coal and a gold vein, stone that comes back), the timberland (land 1:
  dense woods, mushrooms, berries), the lakeside (land 2: a deep lake with pike) and the hot springs (land 3:
  three healing springs, herbs, frostcap). Opened, a ground's card has "Go ➜": the steward sends one there
  (`go:<id>`, a push). Built in `tools/src/demo/quest/haven.ts` `buildHavenGrounds`.
- **Buildings** (`haven.build.<id>`): a plot staked out at the heart for each (`fixture/build/plot/<id>`) looks
  every few seconds whether it is built (`haven/plot-<id>`) and becomes it: the workshop (a workbench), the
  kitchen hearth (a campfire, lit), the storehouse (`fixture/container/storehouse`, forty places, open), the
  weaving shed (a loom), the apothecary (a cauldron), and three residents' tents (2026-10-12). A building
  **unlocks recipes** (2026-10-21, `HavenUpgrade.recipes` → `Recipe.unlockedBy`, the fact it sets): the
  workshop the club, the shield and the bow (and an Apiarist's bee box), the weaving shed cloth and a
  Leatherworker's gear; unlocked, they are made anywhere from the bag — no workbench or loom is stood beside
  (world-model.md §6.4). A building has **levels** (the same fact at 2, 3…; `HavenUpgrade.value`, each after the one
  before): Workshop II (candles, lanterns, a Forge Builder's forge, an Apiarist's bee box); the smithy's two upgrades,
  which stake no plot — a bellows (`haven.build.smithy` 1: a skilled smith's heavy arms, plate, tools and jewellery at
  any anvil) and a hardened anvil (2: the professions' sets); and the **arcane workshop** (`haven.build.arcane`, a plot
  east-south of the sword that becomes `fixture/craft/arcane`, a station opened by a hand: content `arcane.ts` — wands,
  staves (a mage's), healing and fireproof draughts, spell books of the mage's spells; raised again, staves of fire and
  frost and the deeper spells' books).
- **The residents** (content `social.ts` `SOCIAL.residence`; the society module's `moveIn`): one held in full
  regard who is not bound to the main story (tag `storybound`) may be asked, once Alberic has fallen, to come
  and live in the Held Ground. A bed by the camp is there from the first (`home.camp`); each residents' tent
  built adds two in front of it (`home.lodge<n>.a/b`, open when `haven.build.lodge<n>` is set), seven in all.
  Asked with a bed free, they go at once and keep the ground's days from then on (`NpcData.resident`: asleep
  at their bed 21–7, about it 7–21); with none free they say so. Older saves get the tents' plots
  (`migratePlots`, with the Held Ground's other plots and Cass's loom).

### Resident work orders (2026-10-22)

On the steward panel's **Residents** page, assign at most one job to each actual resident who is an adult, has an
open bed here, and is not protected or bound to another duty. A harvest order names a real, available warehouse
and the exact crop cells the resident may work; no cell is selected automatically. A new crop planted in an
authorized cell later is included, while crops on other cells remain untouched.

The first job is a **hand harvester**. It uses the existing hand-pick rule: one crop plus the resident's own `pick`
bonus, and one returned seed. It does not use sickles, sow, water, fertilize, milk, or sell. Its output goes into the
resident's physical cargo and then the selected physical warehouse; it does not spend the Held Ground's upgrade
stock or take anything from a private bag. Full storage stops the next harvest, including at the 999-item stack
limit.

The second job is a **feeder**. The player explicitly selects a real available warehouse and owned animals; the
list starts empty, stays tied to those animal IDs, and does not add newborns. An owned animal may remain selected
while already fed, but the resident fetches exactly one real feed item only when that animal needs it. The resident
uses the same feeding rule as a person, so eggs and breeding keep their usual effects; the job never milks or sells
anything. The manual Stockman action keeps its normal nearby herd behavior. A feed already carried for an animal
that dies, leaves the ground, or gets fed by someone else is returned as that same item when it is safe to do so;
if the selected warehouse cannot take it, it remains tracked for recovery. Existing livestock without provable
ownership cannot be assigned, and animals owned by another person are unavailable.

Older saves may contain livestock with no recorded owner. While beside the steward, the player can claim one eligible animal at a time through the Residents page after confirming that animal. Claiming checks the animal again on its own event, does not infer ownership from its home or birth location, and does not assign a job. Once claimed, the player can explicitly select it for feeding. Other unowned animals remain unchanged until individually claimed.

Work advances only while the player is on the Held Ground and the clock is running. The resident keeps the current
day schedule and rests from 21:00 to 07:00; leaving the map, a paused order, an ineligible worker, a blocked route,
or an unavailable warehouse pauses the job with a status message. Close the steward panel to let time pass.

Task cargo remains a physical, saved item. If the warehouse disappears or the job is revoked while cargo is in
transit, use **Put task cargo down for recovery**. The resident (or retained body) leaves only tracked job cargo at
their feet; the panel reports the map and coordinates. Pick it up from that ground tile. Private items are left alone,
and cargo already moved out of the resident's custody is never moved remotely.
