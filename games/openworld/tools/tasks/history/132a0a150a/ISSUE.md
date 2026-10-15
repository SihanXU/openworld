# Add the deeper life skill branches (gathering, agriculture, husbandry, smithing) and the smithing, ranch and forest content they work on

## What is wrong (for a feature): What is wanted

The skill tree's life branches are thin. Add twenty nodes each to **gathering**, **agriculture**, **husbandry** and **smithing**, 76 new life skills in all (gathering already has four skills, which count toward its twenty, so the numbers must work out to exactly twenty per branch). Each skill works in one of three ways:

- it grants a **number** that rules read as an amount (more logs, more ore, more harvest of a crop kind, more eggs, more cheese, more honey, and so on);
- it grants a **tag** (`skill:<id>`) that rules branch on (a sharp axe, a wide hoe, a herdsman's feeding);
- it **teaches a recipe**.

The world also lacks the content these skills act on. Add:

- **Smithing**: smelting ore at a forge into ingots (iron, gold, steel), and forging at an anvil (weapons, armour, metal tools, jewellery, a portable forge and anvil). The maker's craft lifts the quality and power of what is made.
- **Forest**: mushroom rings to pick and wild beehives to take honey from (in the demo's forest, L1). Reeds may also be cut for grass.
- **Ranch and farm**: cheese from milk over a fire, feed from wheat, compost, leather gear, a bee box.
- **Stall**: it also buys ore, coal, honey, cheese, leather and feathers.
- The existing rules (felling, mining, fishing, tilling, watering, harvesting, feeding, milking, breeding, butchering) must read the new skills. Harvesting stays a single rule that branches on the crop's kind.
- Each new skill needs an icon, and the client's crafting panel must show a recipe's skill requirement and treat it as unavailable until learned.

## Expected behaviour

**Skill counts.** Each of gathering, agriculture, husbandry and smithing has exactly 20 skills, and each has at least one capstone costing 2 points. The new life skills as a whole number 76.

**Smithing**
- At a forge, ore and coal craft into an ingot. An ingot's material is its metal (iron, gold or steel). Iron smelting is open to anyone. A player with Efficient Smelting gets more ingots from the same inputs (two ingots instead of one in the basic iron recipe, as the first craft yields 1 and the second, after learning, yields 2). Steel and gold smelting are refused until Steelworking / Goldsmith is learned.
- At an anvil, with a smith's hammer carried, ingots (plus planks, sticks or logs) are worked into gear. The gear takes the ingot's metal as its material. A player with Weaponsmith forges a sword whose `power` is one higher than an unskilled player's. An armorsmith's armour guards better.
- Some recipes are refused without their skill: warhammer and halberd (heavy arms), pauldrons and breastplate (plate work), and so on.
- Craft quality rises with skills (Apprentice Smith, Fine Craft, Grandmaster Smith, etc.) so that a dagger made by a player with those skills comes out `quality:fine` or `quality:masterwork`.
- Recipes may name a required `skill`, and may name a `bonus` stat that scales their yield or price.

**Agriculture**
- Harvesting a ripe carrot with a sickle yields 2 carrots and 2 seeds unskilled. With Farmer (+1 seed), Bountiful (+1 crop) and Root Farmer (+2 roots), it yields 5 carrots and 3 seeds.
- Picking a ripe crop by hand yields 2 with Green Fingers.
- A wide hoe tills the 3×3 diggable ground around the target. A sprinkler waters the growing crops around a watered one. Irrigation makes the watering last more than twice as long as the base (well over 1200 ticks remaining, in the test's terms).
- A Seed Saver digging up a young plant gets 2 more seeds (3 in total). A Market Gardener sells crops for 25% more at the stall (cauliflower sells for 18 → round(18×1.25)); a Seed Merchant buys seeds 50% more (wheat seeds for 5 coins → round(5×1.5)).

**Husbandry**
- Feed given to an animal lasts a day, or two days for a Herdsman. A Stockman's feeding also feeds hungry animals within radius 2. An Egg Collector's fed hen lays an egg at once.
- A bucket of milk used on a lit cookware fire makes cheese (2 by default, 3 with Cheesemaker) and leaves an empty bucket.
- A butcher gets more meat from a felled cow, and a tanner gets leather (the unskilled cow gives 2 meat, the butcher 3; the tanner 1 leather).
- Wheat crafts into feed by hand: 3 feed from the basic recipe, 5 more with Feed Maker (so 8 total across the two crafts).
- Milkers, quick breeders and breeders shorten the milking/rest times and give twins; a hen whisperer's feeding sometimes hatches a chick.

**Gathering**
- Prospector: a broken ore vein gives one ore more. Stonecutter: a broken boulder gives one stone more. Heavy Pick: the pickaxe hits harder against a boulder than without.
- Carpenter: splitting a log with an axe gives 3 planks. Herbalist: eating a herb heals twice as much. Master Angler: a catch brings up an extra fish.
- Gem Finder: a broken vein sometimes holds a gem. Forager: mushroom rings and reeds give one more.

**Forest (demo L1)**
- The forest has exactly 3 mushroom rings and 2 wild beehives.
- A hand on a mushroom ring gives 1 mushroom, then nothing more until it regrows (a day).
- A hand on a hive gives 1 honey once a day and the bees sting (hp drops) a player who is not a Beekeeper. A Beekeeper takes no damage and, with `honey` granted at 1, takes 2 more honey (honey total 3 after two hives).

**Client**
- An ingot has an icon. The crafting panel marks a recipe that needs a skill and disables it until the skill is known.

## Requirements

- Exactly 76 new life skills, exported as `LIFE_SKILLS`; gathering, agriculture, husbandry and smithing each have 20 skills in `SKILLS`, each with a 2-cost capstone at least.
- Every new skill has an icon key registered with the client's skill-art key list.
- New skill IDs used by behaviour above: `sharp-axe`, `carpenter`, `forester`, `timber-master`, `prospector`, `heavy-pick`, `stonecutter`, `gem-finder`, `deep-vein`, `forager`, `herbalist`, `angler`, `bait-saver`, `lucky-catch`, `deep-fisher`, `master-angler`, `farmer`, `green-fingers`, `wide-hoe`, `bountiful`, `seed-merchant`, `perennial-keeper`, `fruit-farmer`, `berry-farmer`, `irrigation`, `sprinkler`, `composter`, `rich-soil`, `grain-farmer`, `root-farmer`, `gourd-farmer`, `herb-gardener`, `seed-saver`, `market-gardener`, `golden-harvest`, `master-farmer`, `herdsman`, `milker`, `egg-collector`, `breeder`, `butcher`, `beekeeper`, `cheesemaker`, `dairy-master`, `coop-keeper`, `hen-whisperer`, `quick-breeder`, `stockman`, `feed-maker`, `tanner`, `leatherworker`, `plucker`, `apiarist`, `royal-jelly`, `rancher`, `master-rancher`, `apprentice-smith`, `forge-builder`, `efficient-smelting`, `weaponsmith`, `armorsmith`, `fine-craft`, `steelworking`, `goldsmith`, `jeweler`, `ore-merchant`, `tool-smith`, `keen-edge`, `heavy-arms`, `master-weaponsmith`, `plate-work`, `reinforced`, `master-armorsmith`, `masterwork`, `legendary-smith`, `grandmaster-smith`.
- Recipe IDs: `smith/smelt-iron`, `smith/smelt-gold`, `smith/smelt-steel`, `smith/sword`, `smith/dagger`, `smith/helmet`, `smith/warhammer`, `smith/breastplate`, `ranch/feed`, plus the stall's `shop/sell/food-cauliflower` and `shop/buy/seed-wheat` (existing ones must continue to work with skill bonuses).
- New content types: `item/material/ingot` (with metal materials iron, steel, gold), `fixture/nature/mushroom_ring`, `fixture/nature/beehive`, and the smith's forge and anvil fixtures that skills can build. Smithing recipes use station `forge` / `anvil` and the tool `tool:hammer` (satisfied by the carried `item/tool/smith_hammer`).
- Skills that grant numbers must add them as props on the player when learned; rules read those as amounts (e.g. `mineOre`, `mineStone`, `splitPlanks`, `forage`, `honey`, `cheese`, `harvest`, `seeds`, `digSeeds`, `harvest:<kind>`, `buy:farm`, `sell:farm`, `sell:ranch`, `sell:smith`, `smelt`, `feedMaking`).
- A recipe may name a required skill (`Recipe.skill`) and a bonus stat (`Recipe.bonus`); the engine's craft must refuse a recipe whose skill is not known and scale yield or price by the bonus.
- Harvesting remains one rule that branches on the crop's kind rather than one rule per crop.
- The demo's forest contains 3 mushroom rings and 2 wild beehives at start.
- Existing behaviour is unchanged for a player with none of the new skills.

## Interface

- `LIFE_SKILLS: SkillDef[]`: exported from `@lsw/content` (new file `packages/content/src/life.ts`, re-exported from the content index). Holds the 76 new life skills.
- `LIFE_RECIPES: Recipe[]`, `LIFE_SELLS: Recipe[]`, `LIFE_RULES: Rule[]`: exported from `packages/content/src/life.ts` (smithing/ranch/farm recipes, the stall's new buy-backs, and the new rules). They must be part of the content's `RECIPE_BY_ID` and `BASE_RULES` so that the recipe IDs above resolve.
- `INGOT: string` (`'item/material/ingot'`): exported from `life.ts`.
- `Recipe.skill?: string` and `Recipe.bonus?: string`: new optional fields on the engine's `Recipe` type (`@lsw/engine`).
- New item type `item/material/ingot` (icon `item:ingot`), tool item `item/tool/smith_hammer`, and fixtures `fixture/nature/mushroom_ring`, `fixture/nature/beehive`, `fixture/craft/forge`, `fixture/craft/anvil` (plus the buildable `fixture/craft/forge/smith`, `fixture/craft/anvil/smith`, and `fixture/nature/beehive/box`).
- Client: `'item:ingot'` catalog entry and the new skill icon keys added to `SKILL_ART_KEYS` in `packages/client/src/ui/skillIcons.ts`.
