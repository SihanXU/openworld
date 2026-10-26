# The Pilgrim's Road: four places between the Ford and the White Knight, and five new First Seal stages

## What is wanted

Right now, crossing the Ford drops the pilgrim straight onto the East Road and the White Knight. Chapter 1 (docs/chapter-1.md §14) calls for a stretch of story in between, built around the Church of the Five and the knight's past. Add it. Nothing in it is gated: the player may skip any of it and go on to the knight.

The four places, in order east of the river:

1. **The Pilgrims' Rest.** The first map east of the Ford, where the road east begins.
   - A chapel of the Five holds an altar of the five wounds, where the pilgrim kneels to take the oath.
   - A hostel stands beside it.
   - Father Caius (the priest, essential, bound to the story), Maud and her daughter Wynn live here. Maud and Wynn form a household.
2. **The Pilgrim's Road.** Five wayside shrines, one for each of the Five Sufferings, each lit by a different offering.
   - Brother Ezra, a penitent, lives on this road.
3. **The Abbey of the Thorn**, north of the road. It is where Alberic was made a knight.
   - Its hall holds Alberic's statue, the Order's roll and his journal, and the writ of relief that was never sent.
   - Its crypt holds the Order's last keeper (id `ABBOT_ID`), who guards the Order's seal.
4. **The Kneeling Field.** It shows the pilgrims who came before, in stone, and leads on to the East Road.

The wiki gets pages for the places and the people.

## Expected behaviour

**The route.** From the Ford's east edge one now enters the Rest (map id `waystation`). Its cell sits directly east of the Ford's. The East Road (`eastroad`) is reached from the Kneeling Field (`kneelfield`) through the field's east edge. The Rest leads to the Pilgrim's Road (`pilgrimway`). The abbey is reached from the road by an opening in its north edge. The overworld lists the new places.

**First Seal stages.** The quest gains five stages and matching objectives. The earlier ones are unchanged.
- Crossing the Ford now moves the quest to stage 40, whose hint points to the Rest and the oath. It no longer points straight at the knight.
- The oath fact (`PILGRIMAGE.oath`, `ch1.oath`) is set when the pilgrim kneels at the altar. This gives stage 50, which grants 20 xp and one Pilgrim's Scallop and shows the five shrine objectives.
- When all five shrines are lit, the story fact `ch1.shrines` is set and the quest reaches stage 60, which shows the writ and seal objectives.
- Reading the writ sets `ch1.writ`. Taking the Order's seal sets `ch1.order_seal`. When both are done, the quest reaches stage 70, which grants 40 xp and shows the field objective.
- Arriving at the Kneeling Field sets `ch1.kneelfield` and gives stage 80, which shows the knight objective.
- Stage 100 (the knight is down) completes the quest as before, and now also marks the oath, the five shrines, the writ, the seal and the field as done.

Arriving at the Rest also sets `ch1.rest`.

**Wayside shrines.** There are five, each its own kind of fixture, with ids `crown`, `scourge`, `scales`, `nails` and `lance`. Each is a readable, holy stone fixture carrying text about its suffering. A shrine is lit by laying a thing on it (the `put` act, the shrine receiving it), and each accepts only one kind of thing:
- crown: a wearable for the head slot (for example a hat)
- scourge: a fibre item (a rope)
- scales: an edible (bread)
- nails: a metal item (an iron ingot)
- lance: a light (a candle)

What happens when something is laid on a shrine:
- With the right offering, the offering is consumed and disappears. The shrine gains the `lit` status. A sparkle effect and a log line appear. The story is told that this shrine's fact is now set (`shrineFact(id)` is `ch1.shrines.<id>`).
- With the wrong offering, nothing lights. The log says what the shrine asks, in the player's language (for example, the crown shrine's message mentions "戴在头上" in Chinese). The thing laid stays where it was, still in existence.
- A shrine that is already lit only says it already burns, and takes nothing.
- When all five are lit, `ch1.shrines` becomes 1.

**Items.** There are two new important items.
- The Order's Seal (`item/valuable/order_seal`) is a holy, metal amulet worn at the neck, with a small defence bonus. It drops from the last keeper when he is defeated, and the keeper's death leaves it on the crypt map.
- The Writ of Relief (`item/document/writ_of_relief`) is a readable letter. It starts in the abbey hall. Picking it up and reading it sets `ch1.writ`.

**People and scenes.**
- Caius greets a first-time visitor, and his own lines change once `ch1.writ` is set and once Alberic is defeated.
- Ezra keeps to the Pilgrim's Road.
- Maud and Wynn stay at the Rest, in the Rest, its chapel or its hostel.
- Caius, Maud and Wynn are inside those three maps.
- The Kneeling Field holds scarecrows standing in for the stone pilgrims. They need not be sculpted individually, but there must be at least one.
- The demo plays all of it through.

## Requirements

- The Rest's cell is directly east of the Ford's cell. The Kneeling Field's east exit gives onto `eastroad`.
- All of these maps and ids exist: `waystation`, `waystation.chapel`, `waystation.hostel`, `pilgrimway`, `abbey.hall`, `abbey.crypt`, `kneelfield`.
- Shrines are placed as `way.shrine.<id>` entities on `pilgrimway`. The altar at the Rest chapel is the oath point. Each shrine has an open tile next to it that a player can stand on to lay something.
- Arriving at the Rest, kneeling at the altar, reading the writ, taking the seal and arriving at the Kneeling Field each fire their own story scene. The facts are set once the scene ends.
- The keeper `ABBOT_ID` stands in `abbey.crypt`. He is a boss-grade opponent who can be killed. The seal is the loot.
- The story rules (`STORY_RULES`) include the five shrine rules.
- The ontology includes the new shrine types, the two items, and the NPCs `npc.caius`, `npc.ezra`, `npc.maud` and `npc.wynn`.
- Existing behaviour is otherwise unchanged. In particular the river is still a barrier on the overworld, reachable only through the Ford. The East Road still has its two wolves and a boar. Emberfall still opens when the White Knight falls.

## Interface

In `games/openworld/content/src/pilgrimage.ts`, exported from the content package index:
- `PILGRIMAGE`: `{ arrived: 'ch1.rest', oath: 'ch1.oath', shrines: 'ch1.shrines', writ: 'ch1.writ', seal: 'ch1.order_seal', field: 'ch1.kneelfield' }` (as const)
- `ABBOT_ID: string` = `'abbey.abbot'`
- `ORDER_SEAL: string` = `'item/valuable/order_seal'`
- `WRIT: string` = `'item/document/writ_of_relief'`
- `interface Wayshrine { id: string; name: {en; zh}; takes: Selector; asks: {en; zh}; text: {en; zh} }`
- `WAYSHRINES: Wayshrine[]` (the five shrines, in order)
- `shrineFact(id: string): string`
- `PILGRIMAGE_TYPES: TypeDef[]` (the generic `fixture/sacred/wayshrine` plus one `fixture/sacred/wayshrine/<id>` per shrine)
- `PILGRIMAGE_RULES: Rule[]` (one rule per shrine, handling the receive impulse)

In `games/openworld/tools/src/demo/quest/pilgrimage.ts`:
- `PILGRIM`: map size and edge-opening data. It has `rest`, `way`, `abbey` and `field` entries, each with `w` and `h`, and `west`/`east`/`north`/`south` opening rows or columns as relevant. `PILGRIM.field.w` and `PILGRIM.field.east` (an array of rows, including the one used for crossing) are used by the tests. It also has a `shrines` list of positions.
- Map builders for the Rest, its chapel and hostel, the Pilgrim's Road, the abbey hall and crypt, and the Kneeling Field.

New people definitions are exported from `tools/src/demo/people/` (`caius`, `ezra`, `maud`, `wynn`) and added to `PEOPLE`. The `HOUSEHOLDS` map gets a `pilgrims` entry (`npc.maud`, `npc.wynn`).
