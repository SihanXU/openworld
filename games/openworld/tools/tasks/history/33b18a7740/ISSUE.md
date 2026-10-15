# Play-session fixes: gifts take a slot, keys keep their target, what lies on a thing comes first, health floors at 0

## What is wrong

Playing a new save turned up several faults in the engine's controls and damage handling, plus some client behaviour:

1. **Gifts have no slot.** A thing that reaches the player's bag without an input (a scene's `give`, such as Hesper's bread, or a reward) is carried but appears in no slot. Slots are synchronised only after the player's own inputs.
2. **A key does not do what its label said.** The label on G named Tobin, the merchant. He stepped off the spot before the key was pressed, and the bread was set down on the ground where he had stood.
3. **A small thing lying on a larger one cannot be reached.** With a wand lying on Tobin's cart, the pointer meets the cart's large sprite first, so F shows nothing and the wand cannot be taken.
4. **Health goes negative.** After a heavy blow, health reached -959.
5. **Client faults:**
   - Progress is lost if a tab closes or crashes, because the game saves only on sleep.
   - The key-label box is hidden when the player stands directly above the target.
   - The map name does not relabel on a language switch.
   - The "no modder" notice includes the model's English summary in the player's log.
   - The modder prefetch fires too eagerly: it waits half a second, allows 40 per session, and counts a pointer sweeping across things of one class as one wait. There is no way to turn it off.
6. **The Mountain Foot waypoint is named as the place** ("山脚" / "Mountain Foot"), not as a statue.

## Expected behaviour

- **Gifts.** When something enters the player's bag or hand by any route other than the player's input, the next tick gives it a slot. The slots in the world state and in the snapshot's `player.slots` both show it. Before the tick the slot is still empty. A tick with no change to the bag does not resync slots.
- **Key target.** If a key's label named a person or creature and that target has since moved but is still within the key's reach, pressing the key acts on that target. If the target is out of reach, the key acts on whatever is under the pointer now. If the key is pressed with an explicit layer choice, the choice wins. The target the label showed must be remembered per key from the last frame in which the label was computed.
- **Layers.** At a tile where something stands or lies loose (a body or a loose item) on a fixture or structure, the view's stack entries for that fixture or structure come after what lies on it. With a cart and a wand at one tile, and the view offering only the cart:
  - the first layer is the wand;
  - the `take` plan's target is the wand.
- **Health.** Damage never takes health below 0. A blow of 999 against a creature leaves hp at exactly 0, and the creature is felled. The same blow against the player leaves hp at 0, not a negative number. Phoenix-style rescue and fell thresholds still work.
- **Autosave.** A quiet save (no message to the player) runs every 60 seconds and each time a new map arrives. It is skipped while the cover (title) or the death screen is open, or when there is no slot.
- **Label box.** If the player stands just above the target, so the box above it would cover the player, the box goes below the target.
- **Map name.** Switching language relabels the current map name immediately.
- **No-modder notice.** The player sees only the localized "no modder" notice. The model's English summary goes to the console instead.
- **Prefetch.**
  - The pointer must rest on one spot for 1.5 s (15 ticks) before a prefetch starts. Moving to another spot restarts the wait.
  - At most 12 prefetches run per session.
  - A page loaded with `?prefetch=0` makes none. The page tells the worker through the init message.
- **Naming.** The Mountain Foot waypoint's name is "Mountain Foot statue" in English and "山脚传送雕像" in Chinese.

## Requirements

- A bag change that bypasses inputs gets its slot on the next tick, with no change to the sync that follows the player's own inputs.
- A key press acts on the target its label named while the key still reaches it. Otherwise it behaves as before.
- What lies on a thing comes before the thing in the layer order, both in the layer list and in plan selection. Birds overhead still come last.
- Health never goes below 0, for any entity, whatever the blow. Existing rescue and fell logic keeps working.
- Autosave never runs while the cover or the death screen is open, and it is quiet.
- Prefetch honours the dwell, the per-session cap and the off switch described above.
- The Mountain Foot waypoint carries the new bilingual name.
- Existing behaviour is otherwise unchanged. The suite and typecheck stay clean.

## Interface

- `Controls.planFor(key: Key, aim: Aim | undefined, layer?: number, shown?: Ref): Plan | undefined` in `packages/engine/src/controls.ts`. It returns the plan for the key, keeping `shown` as the target while the key still reaches it. With no `shown`, or when `shown` is already the target, it returns the same as `plan(key, aim, layer)`.
- `Controls.keep(): void` in `packages/engine/src/controls.ts`. It is called each tick and gives any item that entered the bag or hand without an input its slot.
- The init message in `packages/client/src/protocol.ts` gains an optional field `prefetch?: boolean`. `false` turns prefetch off, and the client sets it from `?prefetch=0`.
