# The Pilgrim's Road: shrines destroy relics, the Rest replays after the knight, the oath's scallop skips an errand, old saves at stage 40, and the Rest's litany opens a shop

## What is wrong

Several defects on the Pilgrim's Road (docs/chapter-1.md §14):

1. **Shrines take what must not be given away.** The five wayside shrines accept anything matching what they ask. The Shrine of the Crown takes the Crown of Thorns (worn on the head) and the Shrine of the Nails takes the Order's Seal (metal). The offering is consumed, so a player who killed the knight first can lose the Crown for good.
2. **The Pilgrims' Rest plays as if the knight were still standing.** Father Caius's welcome and the oath scene still play after the White Knight has fallen, and his first-meeting line tells the pilgrim to kneel before "the Seal-bearer will know you have". The only way east to Emberfall runs through the Rest, so every player who defeated the knight meets this.
3. **The oath's reward is the errand's scallop.** Swearing the oath gives the ordinary Pilgrim's Scallop, which counts as the scallop *The Pilgrim Before* asks for, so that errand jumps to stage 20 without the player finding anything.
4. **Older saves at the First Seal's stage 40 show the wrong objective.** Stage 40 used to show the White Knight. Since the Pilgrim's Road came between the river and the knight, it shows the oath at the Rest. A save made before still shows the knight.
5. **The litany on the Rest's chapel bookstand opens Firstlight's book shop.** Pressing E there should read the written litany, as with any written thing.

## Expected behaviour

**Shrines.**
- Laying a relic, something tagged important, something bound, or a keepsake on any shrine is refused. The item stays with the pilgrim, the shrine does not light, no shrine fact is set, and the log says (en and zh) that the item is not a thing to give away. The zh text contains `不是能献出去的东西`.
- Specifically: the Crown of Thorns (`item/relic/crown_of_thorns`) on the Shrine of the Crown and the Order's Seal on the Shrine of the Nails are refused.
- Offerings that are not kept still work as before: a hat on the Crown shrine, an iron ingot on the Nails shrine light them and are consumed. An already-lit shrine still says it already burns.
- Each shrine's `takes` selector must itself exclude those kinds.

**The Rest.**
- With the knight down (`sins.defeated.alberic` non-zero), arriving at the Rest does not play `rest_arrival` (the `ch1.rest` fact stays 0), and kneeling at the chapel altar does not play `pilgrim_oath` (`ch1.oath` stays 0). Instead a new scene `rest_after` plays on arrival: Father Caius greets the one who came from the east and from the knight.
- With the knight still standing, the welcome and the oath play exactly as before, and `rest_after` does not play.
- Caius's first-meeting line says nothing of kneeling or of a Seal-bearer waiting on the road, in either state. The English contains no "kneel" and no "Seal-bearer will", and the Chinese contains no `跪`. He introduces himself and his post instead.
- Caius gets a second line for the fact that the knight fell, about the road east being open.

**The oath's scallop.**
- The oath's reward is a new Sworn Scallop: type `item/valuable/scallop/sworn`, tag `sworn`, an amulet worn on the neck, quality Fine, otherwise like the scallop (holy, keepsake, wearable).
- Receiving it leaves *The Pilgrim Before* at its current stage. Taking the pilgrim's real scallop at the forest camp still moves it on to stage 20. The errand's ask must not match a sworn scallop.

**Old saves.** Loading a save where `quest.first_seal` is active at stage 40 and has no `obj.oath` marks `obj.oath` as shown and clears `obj.knight` if it was shown. The journal then lists only the oath as open, and the oath's own fact (`ch1.oath`) moves the quest to stage 50 as usual. Saves that already have `obj.oath` are untouched.

**The litany.**
- E on the bookstand in the Rest's chapel reads it (label "Read The Litany of the Five", the text is said, no panel opens).
- The church's bookstand in Firstlight (`church.books`) still opens `shop:books`, with the label "Trade at …" on that answer only.
- The same holds for the general store's counter: written things are read, others open their shop.

## Requirements

- A shrine refuses items tagged `relic`, `important`, `bound`, or `keepsake` before checking what it asks for, and does not consume them.
- The kept tags are shared by all five shrines and available to content as one exported list.
- The refusal appears on each shrine's `takes` (excluding these tags) and as a refusing branch with its own message.
- `rest_arrival` and `pilgrim_oath` require the knight not to have fallen. `rest_after` requires the knight to have fallen and the map to be the Rest.
- The Sworn Scallop is a new item form with its own type. The oath reward uses it, and the errand's scallop ask excludes the `sworn` tag.
- Save upgrade for first_seal stage 40 as above, in the game's `upgradeSave`.
- Shop rules for counters and bookstands inherit core/read when the host is `readable` and has a `text`; otherwise they open their shop panel, and the "Trade at" label belongs to that branch only.
- Demo PR1 expects the oath's reward to be the sworn scallop.

## Interface

- `SWORN_SCALLOP` — `string` constant, `'item/valuable/scallop/sworn'`. Defined in the content's `pilgrimage.ts` and exported from `@openworld-game/content`.
- `KEPT` — `string[]` constant, `['relic', 'important', 'bound', 'keepsake']`. Exported from content's `pilgrimage.ts`.
- New item form `item/valuable/scallop/sworn` (English "Sworn Scallop", Chinese "立誓扇贝"), tags `holy`, `keepsake`, `wearable`, `sworn`, `quality:fine`.
- New story step id `rest_after` (the fact `seen.rest_after` is set when it plays).
