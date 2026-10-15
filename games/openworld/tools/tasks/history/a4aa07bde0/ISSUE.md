# E on a bed with bare ground ahead should lie down; eaten food should be gone; ore and ingot values; wiki indexing of rule-made kinds

## What is wrong

Several things in the base's general cases behave wrongly or are missing:

1. **E falls to the ground's "touched" instead of the bed.** The player stands on a bed, points at nothing, and the cell in front is bare ground. The planner picks the ground's "touched" answer and E never reaches the bed. An unknown answer already falls through to what one stands on; "only the ground touched" should too.
2. **Eaten food stays in the creature.** When a creature snaps up food held out to it, the food stays in its contents and drops when the creature falls. The food should be gone once eaten.
3. **Ore and ingot values are wrong.** The price table's `item/material/ore` and `item/material/ingot` prefixes match nothing (the real types are `iron_ore`, `gold_ore`, `iron_ingot`, `gold_ingot`), so all of them are worth the generic material value of 2.
4. **The wiki does not credit rules with the kinds they make through their host's props.** A rule that spawns or transforms into `@prop:smelts` or `@prop:cookedType` (or `@prop:host.<key>`) is not connected to the kinds it produces, so ingots' and cooked food's pages cannot say how they are made. Smelting and cooking also have no "ways" entry in the wiki.
5. **The Mod Console's copy-as-prompt asks for the wrong thing.** It asks for a class-wide rule. Learned rules are now one type's answer at one open leaf (design.md §5.16).

## Expected behaviour

- Player on a bed, `facing` set to the bare-ground side, E with nothing pointed at: the plan is the `hands` verb on the bed. If the ground ahead has an answer that does something (not merely "touched"), that still wins as before. If what stands on the player's tile has no answer that does something, behaviour is unchanged.
- A creature offered an edible item (e.g. bread to a green slime): the offer is defined, and after a tick the bread no longer exists and the slime's contents are empty. Rope offered to a creature still lashes it down (frozen) and goes onto it (holder is the slime).
- Values: iron ore 6, gold ore 20, iron ingot 15, gold ingot 15 (gold's material multiplier then makes the gold ingot 75).
- A bare hand on a wild creature gets bitten (hp drops after a tick). Warming hands at a lit campfire removes `wet`. Iron ore used on a lit forge becomes `item/material/iron_ingot`. Gold ore used on a cold forge stays `item/material/gold_ore`.
- The wiki credits `smelt/ore` for the ingots and cooking rules for cooked food, by reading the host types' prop value, and lists smelting and cooking among the ways to obtain these items.
- The copy-as-prompt text asks for a patch answering the event for the host's own type at the open leaf it fell into: host exactly `{"type": <host's type>}`, `on` the event's kind, `hole` the request's `hole.rule` (followed by `#` and the path joined with `&` when the path is non-empty), `at` the request's `hole.at`. A case not answered is `{"undefined": true}`, never `inherit`.

## Requirements

- Planning E with no pointed spot must fall to the standing-tile answer when the target ahead is unanswered, or is ground (terrain or a laid floor) with a plan that changes nothing, and the standing-tile answer is defined and changes something.
- Feeding an edible item to a creature must tell the item it is eaten, and the item must remove itself on that news. Other news to edible things is only noted.
- Food eaten is destroyed by food's own rule, not by the creature.
- The price table must use the real type ids so the four values above hold.
- Wiki indexing of rule-made kinds must resolve `@prop:<key>` and `@prop:host.<key>` against each type that the rule's host selector could match (type prefix and required tags), using string props only, and must not list a rule twice for one kind.
- The wiki gains ways for the forge-smelting rule and the two cooking rules.
- The copy-as-prompt wording follows the description above.

## Interface

None
