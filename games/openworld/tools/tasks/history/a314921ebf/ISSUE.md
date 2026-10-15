# No input aims a blow at oneself; the engine exposes the ground test and the key views mark ground and person targets

## What is wrong

The engine's controls currently plan a blow on the player's own entity. A click or key whose target is the player's own place, with nothing to use there, produces an attack with the bare body (or with a weapon kept in the main hand). A held weapon used on oneself is also planned as a blow. Per design.md §5.2, no input should ever strike the one at the keys.

The runtime's interaction layer also needs more from the engine than it gets. It has to tell whether a key's target is bare ground and whether it is someone to talk to. The key views in the snapshot do not say either, and the controls' test for "is this the ground" is not available outside the class.

## Expected behaviour

- With the player as the target and nothing held, the `use` and `self` inputs plan no blow. This holds whether the bare body or a weapon kept in the main hand would have done the striking.
- With a weapon held and the player as the target, no blow is planned. Other things held (food, drink, clothing) can still be used on oneself: eating, drinking and putting on work as before.
- Blows on other targets are unchanged: creatures, people (blade drawn), things, and the reach/alignment rules for ranged weapons.
- Each key view in the frame's `keys` reports:
  - whether its target is the ground (a terrain or a floor laid there), and
  - whether its target is someone to talk to (a person or companion).
- The controls' ground test can be called from outside the class.

## Requirements

- Planning a use of any kind with the player's own entity as target never yields a blow (no `attack` act with no instance, and no weapon blow).
- Using a carried non-weapon thing on oneself is still planned, once for each carried thing, as before.
- The completeness check over the inputs still finds every other act reachable. Only the bare attack on oneself drops out of the set of acts the inputs make.
- `KeyView` carries optional boolean flags for "target is ground" and "target is a person". They are set from the same notion of ground the controls use, and from whether the target is a person or companion.
- No other key-view fields change meaning.

## Interface

- `Controls.ground(r: Ref): boolean`, in `packages/engine/src/controls.ts`. It changes from private to public. It is true when the ref is a terrain or has a floor space, or is a bare cell id.
- `KeyView.ground?: boolean`, in `packages/engine/src/snapshot.ts`. The key's target is the ground: a terrain, a floor.
- `KeyView.person?: boolean`, in `packages/engine/src/snapshot.ts`. The key's target is someone to talk to: a person, a companion.
