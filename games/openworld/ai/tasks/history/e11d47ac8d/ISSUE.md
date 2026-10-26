# The Pilgrim's Road: the abandoned cart's loaf and the Kneeling Field's straw subjects must be playable through the player's own inputs

## What is wrong

The Pilgrim's Road demo requirement (PR1) is being moved from set-up shortcuts (teleporting, creating items directly in the bag, damaging the keeper with a debug call) to a run played only through the player's own inputs: walking through doors and region edges, reading with E, taking with F, laying with G, and fighting with blows. Two things in the content stop that run from working as the game's own data says it should:

1. **The way's loaf does not lie in the cart.** On the Pilgrim's Road the loaf of bread is placed at its own spot, and the abandoned pilgrims' cart is a separate fixture standing elsewhere on the map. The road's lore and the demo describe "a loaf left in an abandoned cart". A player who takes the loaf with F at the cart's cell finds nothing there, and the loaf offered to the Shrine of Scales is not the cart's. The loaf also has no distinguishing name, so it cannot be told apart from other bread on the map.
2. **The Kneeling Field's straw subjects cannot be read.** The six scarecrows ("A kneeling subject") carry a descriptive text, but they are not marked as readable, so E on one says nothing. The field's stones (the gravestones) already read; the straw subjects must read too.

## Expected behaviour

- On the Pilgrim's Road map, there is an abandoned cart fixture and a loaf of bread (`item/food/bread`) lying at that very cell, on the cart. The loaf has the name "A pilgrim's loaf" (zh: 朝圣者的面包). The cart keeps its name "An abandoned pilgrims' cart" (被丢下的朝圣者推车).
- A player standing beside the cart and using F on the cart's cell takes the loaf into the bag. Laying that loaf on the Shrine of Scales with G lights it.
- The other four offerings (the pilgrim's hat, the penitent's plaited cord, the dented helm, the candle) remain on the road where they lie and are each taken with F.
- Each of the six straw subjects in the Kneeling Field, read with E, says its text. The Chinese text includes "脸朝东".
- The Kneeling Field's stones remain readable, and the other fixtures on the road keep working as before.

## Requirements

- The loaf of bread on the Pilgrim's Road shares its cell with the abandoned cart (the cart is at the same position as before, and the loaf is moved onto it, not the other way round).
- The loaf is named "A pilgrim's loaf" / 朝圣者的面包, so that it can be found distinctly among the map's bread.
- Taking it with F at the cart's cell puts it in the player's bag.
- All six "A kneeling subject" scarecrows in the Kneeling Field are readable, with their existing text unchanged.
- No other things on either map are moved, renamed or removed; the number and kinds of fixtures and items are otherwise unchanged.
- The Pilgrim's Road demo requirement can be walked through end to end with player inputs only: through the Rest, the chapel oath, the road's offerings, the abbey, the keeper's crypt and the Kneeling Field. Every type it lists as witnessed (including the cart and the scarecrow) is actually present and exercised.

## Interface

None
