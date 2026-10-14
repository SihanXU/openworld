# What is worn shows on the look: helmets, hats, circlets, crowns of thorns, breastplates, pauldrons and cloaks

## What is wanted

Every person has a look (a body, a part per slot, a colour per key). Today, putting on a helmet or a breastplate changes nothing about how its bearer looks. We want what a person wears to show on them:

- An item type can name the look part it is worn as, with a `look` prop on the item type.
- The worn item shows in its material's colour (an iron helmet is iron-grey, a bronze one bronze).
- The world exposes the bearer's **seen look**: the bearer's own look with what they wear laid over it. The frame snapshot, the look's derived tags (`look:armoured`, `look:helmeted`, …) and the modder's look words must all read the seen look, so that the map sprite, the portrait and the tags change together when a piece goes on, and change back when it comes off.
- The bearer's own look (`Entity.look`) is never modified by wearing or taking off.

The worn items that need parts: helmet, hat, circlet (crown), crown of thorns, breastplate, pauldrons and cloak. Some of these need look slots and parts that do not exist yet: an armour slot and a cloak slot, a circlet, and a crown of thorns. These parts are worn-only: they are never drawn by chance when a look is generated, and are never offered in the character creator. The map sprite must be able to draw each of them, so the look table, the sprite code and the portrait layer stack all know the new slots.

## Expected behaviour

- A player holding an iron breastplate and a bronze helmet who wears both: the snapshot's look for the player has `parts.armour = 'armour.plate'`, `parts.hat = 'hat.helm'`, `colors['armour.1']` equal to the table's colour for iron, and `colors['hat.1']` equal to the table's colour for bronze. The player's own `look` is unchanged (deep-equal to before). The tags `look:armoured` and `look:helmeted` are present on the player. The composed map sprite of the seen look differs from that of the own look.
- Taking both off again: the snapshot's look deep-equals the own look, and `look:armoured` is gone.
- A worn item whose part is unknown to the table, or one that does not fit the bearer's body, changes nothing.
- A worn item with no known material colour shows with the part's default colour (no stale colour left from the bearer's own look in that slot).
- A bearer with no object look (none, or a plain string) or in a world without a look table is left as it is.
- Item types that name a part: helmet → `hat.helm`, hat → `hat.cap`, circlet (crown) → `hat.circlet`, crown of thorns → `hat.thorns`, breastplate → `armour.plate`, pauldrons → `cloak.pauldrons`, cloak → `cloak.cloak`.
- Helmets must fit any adult body, not just men.
- The look table can map a material to a colour.

## Requirements

- Add a `materials` map to the look table (material id → `#rrggbb` or colour id); the content table fills it from the materials' own colours.
- Add the `armour` and `cloak` slots to the look slots, and mark them as worn-only; add a way to mark a part as worn-only so the generator never picks it and the creator never offers it (the creator also hides the worn-only slots).
- Add the parts `hat.circlet`, `hat.thorns`, `armour.plate`, `cloak.cloak`, `cloak.pauldrons`, each with default colour, words, and look tags (e.g. `look:armoured` for the breastplate and pauldrons, `look:crowned`, `look:cloaked`).
- Every part in the table (except age) must have map grids for its slot. Provide map grids for the new parts for each facing and walk frame, drawn over the outfit and before the head's parts. Nothing may be drawn that the table does not know.
- The portrait layer stack includes `armour` and `cloak` layers between outfit and face.
- Tags derived from the look must follow what is worn, including when the worn set changes (cached tags must not go stale).
- The wiki's and creator's slot name lists know the new slots.
- Entity info words (the modder's look words) describe the seen look.
- At least seven item types in the ontology name a look part, and each names a part that exists in the table.

## Interface

- `wornLook(look: Look, worn: { part: string; material?: string }[], table: LookTable): Look` — in `packages/engine/src/looks.ts`. Returns the look with each worn part placed in its slot, coloured by the material's colour in `table.materials`; returns the same look when nothing is worn; does not mutate its input.
- `World.seenLook(e: Entity): string | Look | undefined` — in `packages/engine/src/world.ts`. The entity's look as seen.
- `LookTable.materials?: Record<string, string>` — in `packages/engine/src/types.ts`.
- `LookGen.worn?: boolean` — in `packages/content/src/looks.ts`; marks a part only worn things bring.
- `WORN_SLOTS: Set<string>` — exported from `packages/content/src/looks.ts`, containing `'armour'` and `'cloak'`.
- `LOOK_SLOTS` in `packages/content/src/looks.ts` gains `'cloak'` and `'armour'` (before `'outfit'`).
- `WEARS: Record<string, OutfitPix>` — new file `packages/client/src/assets/figure/pixwear.ts`; map grids keyed by part id for `armour.plate`, `cloak.cloak` and `cloak.pauldrons`.
- `HATS` in `packages/client/src/assets/figure/pixhead.ts` gains `hat.circlet` and `hat.thorns`.
- `LAYER_Z` in `packages/client/src/assets/figure/portrait.ts` gains `'armour'` and `'cloak'` after `'outfit'`.
- New part ids in the content look table: `hat.circlet`, `hat.thorns`, `armour.plate`, `cloak.cloak`, `cloak.pauldrons`.
- New item prop `look` (string, a look part id) on the item types listed above.
