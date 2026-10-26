# Firstlight's church becomes Sister Ilse's chapel behind Astra's altar, and Chapter 1's lore agrees on one timeline

## What is wanted

Chapter 1's content currently contradicts the project's canon (docs/lore.md) in several places. Bring it in line, and merge Firstlight Village's "church of the First Dawn" into Sister Ilse's chapel.

**One timeline, three hundred years.**
- Fennick squired for the White Knight Alberic in the long hold. By then Alberic had worn the crown about 250 years. Fennick saw the crown take more of him each year. The beat of `fennick_memory` is unchanged: the forgotten name, Fennick leaving that night.
- The journal's brother is Hugh, not Tomas. Tomas the warden stays a sworn brother of the Order, buried a century ago.
- The writ's forty years and the journal's forty-first year are left side by side in the narration, with no attempt to reconcile them.

**The Church speaks of the mission only.**
- The Holy See's notice and Caius's oath and greeting say: seek out the Seal-bearers, overcome them, bring the instruments home. They no longer promise mercy to those who kneel.
- The Nails are shown only in the Church's reading: "he accepted death upon the holy wood". This applies to the shrine text and to Caius's oath.
- The litany on the Rest's bookstand says 极夜, not 长夜.

**The kneeling stones mean one thing.**
- The Kneeling Field is where pilgrims knelt to pray before going on.
- Its stones, as on the East Road, are those who would not kneel to the knight. The stone text, the quest log and the quest summary say so.
- "Maren of the Salt Coast" on the Field's stones becomes Ysolde, because Maren is now the abbey's Sister Maren.

**The abbey follows the ossuary under Thornwood Hollow.**
- The Order's roll lists forty-one names.
- The abbey yard has memorial stones, not graves, for Brother Odo (held the gate at Varn three days, did not kneel), Sister Maren and Brother Tomas. They lie under Thornwood Hollow. Brother Giles the gardener keeps a real grave in the yard.
- The crypt under the abbey is the abbey's priors', named "The Abbey Crypt" (修道院地下墓室). Its niches are priors' niches.
- The pilgrims' hostel book is no longer written in "the warden's hand".

**Lumi's lines stay light.** Where Lumi (Pip) reacts to the penitent's talk of the flag, the writ and the Field, her lines are lighter, not grim.

**Firstlight's church is Sister Ilse's chapel.**
- The temple on the village square stands behind Astra's altar. Its door is one step above the altar.
- It is named "Firstlight Chapel" (初原村礼拜堂). Brother Anselm keeps its bookstand and greets players as the chapel's keeper. Sister Ilse is tied to him.
- "Church of the First Dawn" no longer names it. The First Dawn's chapel is Dawn Hill's, "Chapel of the First Dawn" (初晓礼拜堂).
- The village's chapel sign (`village.church.sign`) stands by the chapel door and says whose chapel it is. A save made before this change has the sign on the east road, and loading it must move the sign and update its text.

## Expected behaviour

- On a new world, the `meadow` map's portal to `meadow.church` is two tiles above Astra's altar (`village.astra`) in y and equal in x. `meadow.church` is named `{ en: 'Firstlight Chapel', zh: '初原村礼拜堂' }`. The bookstand `church.books` is on `meadow.church`. The map `chapel` is named `{ en: 'Chapel of the First Dawn', zh: '初晓礼拜堂' }`. The sign `village.church.sign` stands at the new location.
- Loading a save whose sign is still at the old east-road tile (51, 17) on `meadow`, with the old "church of the First Dawn" text, moves the sign to the new tile and gives it the new English and Chinese text. A sign already elsewhere is left alone.
- E on the Rest's litany bookstand reads it, as before, and the read text now ends "…极夜便不会归来".
- The Church's shop panel, `shop:books`, still opens on the chapel's bookstand in Firstlight and is now labelled "Chapel Bookstand" / 礼拜堂书架.

## Requirements

- All the lore changes above are made in the content (maps, scenes, shrine, quest text, people's lines and ties), with matching English and Chinese text.
- Maren on the Field's stones is Ysolde. Giles keeps his grave.
- The abbey crypt's name and niches are the priors'.
- The sign move is part of the game's own save upgrade. It only applies when the sign is a tile on `meadow` at the old position, and it is safe to run on a save where the sign is already at the new position.
- The old-save sign position and the new position are exported from the content package alongside the sign's id and texts, so other code can use them.
- Existing behaviours the lore changes don't touch are unchanged: shrine offerings, the oath flow and its facts, quest stages and numbers, the shop's shelves and recipes.

## Interface

- `CHAPEL_SIGN` — exported from `games/openworld/content/src/village.ts`, and re-exported from the `@openworld-game/content` package entry:
  ```ts
  export const CHAPEL_SIGN: {
    id: string                // 'village.church.sign'
    at: readonly [number, number]   // where the sign stands now: [22, 12]
    was: readonly [number, number]  // where it stood on the east road: [51, 17]
    text: string              // English sign text naming Firstlight Chapel, Sister Ilse and Brother Anselm
    text_zh: string           // the same in Chinese
  }
  ```
