# The action (E, right click) must act only on open ground or oneself for held-thing uses, every key must go to the framed cell without a pointer, and `actionOf` must live in its own module

## What is wrong

Review of the action (Stardew-style contextual input on E / the right click) found several problems:

1. **The held thing is used on oneself too eagerly.** The action treats "use the held thing on oneself" (eat, drink, put on) as available even over a thing the bare hands could try. With bread in hand over a carrot sprout, the action should try the sprout, not eat the bread. Armour or a weapon must not be put on unasked by the action when aimed at a thing. Also, the action ignores uses the world has never seen when aimed at oneself, although the right click used to count those (the modder's answer).
2. **Keys without a pointer go to different places.** Without the pointer, only the action was sent to the cell the keys found close by (the "assist"); F, G, and the chooser went to the cell in front. So the frame could show one cell while F or the chooser acted on another. Also, while a key is walking the player, the assist still moves the keys and the frame ahead to things passed, causing lurching.
3. **A stale press is acted on.** If the worker has not answered a press's aim in good time, the press is still acted on after a short wait, on a spot the pointer has since left.
4. **`actionOf` has no home of its own.** It lives in the cursor UI module and is tied to a page, so it cannot be held to a table by a test without that module.
5. The design document (§5.2) and the in-game controls help still describe the old behaviour.

## Expected behaviour

### The action's choice
`actionOf(keys, held, allow?)` returns the input the action makes, or `undefined` for nothing:

- No keys: nothing.
- Someone is there: `hands` (a word), even with a weapon or tool in hand (handing over is G's alone).
- A thing the bare hands do something with (known act, not the ground): `hands`.
- A thing that can be taken, not the ground, and not another's property (a theft): `take`. For another's thing whose hands act is unknown, the result is `hands` (the experiment), never `take`.
- "Open ground or oneself" means: there is no hands view, or the hands view is the ground, or hands are not allowed by the lesson. Only there:
  - a held built thing or fixture (type begins with `structure/` or `fixture/`) is set down (`put`) if the put view is on the ground and not unknown. On rock, where the bed cannot rest, the put is not offered and the result is nothing.
  - otherwise, if a use on oneself is among the keys, a held thing is used on oneself (`self`). This includes a use whose outcome is unknown (the modder's), since such a use only appears among the keys when the pointer is on oneself.
- Over a thing the hands could try (hands unknown, not the ground), a held bed or held bread gives the hands' experiment, not `put` or `self`.
- The bare ground with nothing in hand: nothing.
- A lesson's allowed inputs are respected: the action is the first allowed input that answers; if `self` is not among the keys in a tutorial that allows only move/select/self, the result is nothing; with it, `self`; a lesson that only allows take gives `take`, not the word.

### Without the pointer
- Every key (E, F, G, left click) and the chooser's list go to the cell the keys found close by, i.e. the one the frame shows. F takes the stone the frame shows. The chooser lists that cell, and the choice goes to that same cell. The list reply carries the cell it was made for.
- While a key is walking the player, there is no assist: the keys and the frame keep to the cell in front, faint and steady, and move to what the keys found once the key is released.
- The assist is no longer a separate flag on the key message.

### Stale presses
A press whose aim the worker has not answered within one second is dropped, not acted on.

### Documentation
design.md §5.2 and the controls help describe the action on oneself and the left click's use on oneself.

## Requirements

- `actionOf` is in its own module `src/action.ts` of the runtime package, with no page or UI dependency, and the old location no longer defines it.
- `placeable` is exported from the same module, and other code that used it imports it from there.
- Behaviour of `actionOf` matches every case in the Expected behaviour section, including lesson-allowed inputs.
- The `key` message to the worker no longer carries an assist flag; without a tile it goes to the assisted cell, with face-turning toward it.
- The `choices` request without a tile uses the assisted cell and replies with that tile.
- The assisted cell is not computed while a key walks the player.
- The frame's walking state follows the key walking the player, not a timer of the player standing.
- A press waiting on the worker's answer is dropped after one second.
- Existing tests continue to pass.

## Interface

In `packages/runtime/src/action.ts`:

- `placeable(type: string): boolean` — true for types starting with `structure/` or `fixture/`.
- `actionOf(k: Frame['keys'], held: string | undefined, allow?: readonly string[]): Key | undefined` — the action's choice as described above.
