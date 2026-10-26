# Durability, materials and tool efficiency: things break by blows, fire and hurt, and every breakable thing has an end

## What is wanted

Right now, hitting or burning things works through ad-hoc, per-type rules: a pickaxe has special rules for rock, boulders and veins with "crack" counters and an endless "chip" rule, an axe has a two-step notch/fell rule on trees, and fixtures such as barrels shatter at the first blow. Anything not covered (e.g. an axe blow on a stump) is undefined and gets handed to the AI. Fire hurts bodies through a separate scorch rule and does nothing to trees, walls or other things.

Replace this with one general model, "durability × material × instrument":

- Things that can be broken have durability (`maxHp` / `hp`) and are made of a **material**. Materials are world data, each with a **category** (wood, plant, stone, ore, metal, soil, skin, organic, flesh, fibre, bone, crystal) and a **hardness**.
- A strike on anything with durability takes off durability: the blow's power times how well the **instrument** works on the target's material category. The instrument is the thing that struck, or else the striker's own body. How well each instrument works on each category is a data table (rows for tool capabilities like `tool:axe`, `tool:pickaxe`, `tool:shovel`, `tool:hammer`, and for edges like `edge:cut`, `edge:blunt`, `edge:pierce`, `edge:dig`, `edge:magic`); the best applicable row counts.
- An instrument softer than its target does nothing to it: the player is told "Too hard." and nothing is asked of the AI (no undefined event).
- Hurting something with no durability changes nothing.
- When durability reaches none, the thing is **broken** (the threshold formerly called "defeated" is renamed for everything). What follows is defined for every breakable thing: the essential (people, the player) go down; a thing with a **makeup** breaks down into a share of it (the recovery rate, 0.5, is world data) in its own material, whatever it holds spills out, and it is gone; anything else is simply removed.
- Fire is a damage channel too: burning wears down anything with durability. A burning wooden wall ends as a black "burnt wall" rather than disappearing.

## Expected behaviour

- A stone axe fells a living tree in two blows. The first blow lowers its durability and leaves it notched (the notch heals, and the tree is whole again, if left alone); the second fells it into a stump with logs (and a stick, now and then an acorn; a woodcutter gets a log more). A tree broken while burning becomes a charred tree. A tree turned into a stump (or any thing turned into another form) gets the new form's full durability.
- An axe blow on a stump breaks it, and the stump returns logs (its makeup × recovery rate) — no longer undefined.
- Bare hands on a tree: "Too hard.", the tree untouched, no unanswered question.
- A wooden club on rock: "Too hard.", rock untouched, nothing asked.
- A stone pickaxe breaks rock in two blows into stone, leaving walkable ground. Boulders break in two blows into stones; ore veins break in two blows and their ore (iron ore, coal) pops out. The old crack counters and the endless pickaxe chip are gone.
- A burning wooden wall loses durability as it burns and ends as a burnt wall (a new terrain, built as a solid wall that is itself breakable into coal). Burning also wears trees, bodies and other burnable things with durability; the separate fire scorch rule is merged into this.
- Breakable containers (barrel, crate, clay pot) have durability and break when broken, spilling their contents (into planks for the wooden ones).
- Trees, pines, bushes, rock, cave walls, stone walls, wooden walls, roofs, stumps, charred trees, boulders, veins and the breakable containers all have material, durability and makeup (the clay pot only a material and durability). Creatures are made of flesh. Pickaxe, shovel, hoe, sickle and smith hammer have a power.
- Everything that listened for "defeated" (bosses, the dragon quest, combat defeat) now listens for "broken", with the same behaviour as before.

## Requirements

- Item materials carry a category and a hardness; the world also knows flesh, plant, gel, earth, ice and ore as materials, so every material a thing can be made of resolves to a category and hardness.
- A thing's material is its `material:<id>` tag, or else its type's `material` prop.
- The ontology holds the materials, the efficiency table and the parameters (recovery rate 0.5) as data.
- The `hurt` effect gains a blow mode (multiplies by the instrument's best efficiency row for the target's material, nothing if the instrument is softer, with "Too hard." told). `hurt` on something without durability does nothing.
- A new `breakdown` primitive and a `makeup` condition (true when the host has a makeup) exist; the root outcome of "broken" uses them: the essential go down, those with a makeup break down, the rest are removed (with contents dropped).
- The breakdown's parts pop out toward the magnet like other drops, are in the host's material, and the host's contents spill.
- Every damage channel (a blow with a fitting tool, and fire on what burns) reaches every breakable type; every breakable type has a defined end for "broken"; no breakable type is left to the AI's guess; nothing without durability is harmed.
- Existing behaviour that is not about breaking (other tool uses, hoeing, fishing, etc.) is unchanged. The client can draw the burnt wall (sprite and tint), and maps can place it with its own terrain character.

## Interface

- `MaterialDef` (type exported from `@lsw/engine`): `{ id: string; category: string; hardness: number }`.
- `Ontology.materials?: Record<string, MaterialDef>` — materials by id.
- `Ontology.efficiency?: Record<string, Record<string, number>>` — rows `tool:<x>` and `edge:<x>`, each mapping a material category to a multiplier.
- `Ontology.params?: Record<string, number>` — includes `recovery` (0.5).
- `Material` in `packages/content/src/items.ts` gains `category: string` and `hardness: number`; new export `MATERIAL_DEFS: Record<string, MaterialDef>` there.
- `packages/content/src/ontology.ts`: new exports `RECOVERY` (0.5) and `EFFICIENCY`; new terrain `burnt_wall` (map character `K`).
- Effect `{ op: 'hurt', amount, element?, pierce?, blow? }` — `blow?: boolean` added.
- New effect `{ op: 'breakdown' }`.
- New condition `{ makeup: <role> }` (e.g. `{ makeup: 'host' }`).
- Threshold name `broken` replaces `defeated` in `Ontology.thresholds` (`{ name: 'broken', prop: 'hp', lte: 0 }`).
- New rule ids: `core/break`, `wood/notch`, `wood/heal`, `fire/wear`, `fire/burnt-wall`; `wood/fell` now fires on `threshold/cross`; removed: `fire/scorch`, `mine/rock`, `mine/crack`, `mine/chip`, `mine/vein`.
- `burnt_wall` sprite entry in the client catalog and a tint in the client ground renderer.
