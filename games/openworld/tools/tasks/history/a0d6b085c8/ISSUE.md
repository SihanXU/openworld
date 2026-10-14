# Worn items should live on the body, not in the bag or the hand

## What is wrong

An item the player wears (recorded in the player's `wear:<slot>` props) is still treated as if it were carried in the bag, and it can stay in the hand:

- A worn item still occupies a bag slot, so putting something on does not free the slot it came from.
- A worn item can stay in the hand, even though it is on the body.
- When two items are alike (same stack key), such as two identical rings with one worn, the worn one is still counted in the bag stack. The stack then shows too many items, or is marked as worn when one copy is still plainly in the bag.
- Bag-based actions (placing on the ground, moving into or out of a chest, magnet pickup, readying a stack in the hand) can pick up the worn item as if it were an ordinary bag item.

## Expected behaviour

- Wearing an item removes it from the bag's slots. The number of filled bag slots goes down by one, and the snapshot's `player.worn[<slot>]` still shows the item.
- Taking the item off from the equipment (calling `wear` on the item again) clears the `wear:<slot>` prop and brings the item back into the bag. The filled slot count returns to its earlier value.
- If the player is holding an item and it becomes worn, the hand lets go of it. It is no longer `player.held`, and it is back in the player's inventory contents.
- Wearing a hand-held item through the usual "use on self" route puts it on and it leaves the hand. Taking it off is then done from the equipment (`controls.wear(id)`), not by using it on self again. After it is taken off, the item can be held again and worn again.
- With two alike rings in the bag and one worn, the bag shows a single stack with count 1 and no `worn` marking. The worn ring is not part of that stack.
- Worn items count as worn whether or not they currently give the player a benefit.
- Bag-based actions never act on worn items. These are: selecting a stack into the hand, placing on the cell in front, moving to or from an open chest, and magnet pickup.
- Equipping a main-hand weapon that replaces another one sends the replaced weapon back to the bag. The hand is then not holding the newly worn weapon, so selecting an empty hand slot leaves the hand empty and the worn main-hand weapon is the one used in combat.

## Requirements

- Items referenced by the player's `wear:*` props are excluded from the bag's slot stacks, both in the controls' slot syncing and in the snapshot's slot list.
- Items referenced by the player's `wear:*` props are never held in the hand after slot syncing. If the held item is worn, it is released to the player's inventory (inside the player).
- Controls expose a way to get the set of worn item ids, regardless of whether the item currently works for the player.
- Controls expose the carried-items map in two modes: the full one (bag and hand, including worn items) and a bag-only one that omits worn items.
- Slot syncing, hand selection, placing, chest transfers and magnet pickup use the bag-only mode.
- Existing behaviour for items that are not worn is unchanged.

## Interface

In `packages/engine/src/controls.ts`, class `Controls`:

- `wornIds(): Set<string>` is new and public. It returns the ids of everything referenced by the player's `wear:*` props.
- `carried(bag = false): Map<string, Entity[]>` was private and is now public. With `bag` true it omits worn items. With the default it includes everything carried in the bag and the hand.

No other new names.
