# Aim at what is drawn: an input carries a stack of things, and the map holds no decor layer

## What is wanted

Right now an input aims at a tile, and the engine decides which layer on that tile to act on. The view knows what is actually drawn at the pointer, but the engine cannot use that. Part of the map's look is also a separate "decor" layer of pictures that are not things in the world, so they cannot be picked, burned or interacted with.

Two changes are wanted.

1. **Point and pick.** An input aims at a point on the map. The view tests the pictures' own pixels and hands the engine everything drawn there, top first: things, then a canopy reaching over from another tile, with the ground last. A short press acts on the top of that stack. A long press (the chooser) can act on any layer. With the keyboard, or with no stack supplied, the stack is what stands on the front tile, in drawing order.

2. **No picture without a thing.** The map consists only of terrain and things. The decor layer is removed from the map data, the loader and the renderer. Everything that was decor on the demo map (the Ford) becomes an entity of a real type. That covers the camp's bench, rack, firewood, chopping stump, lantern, sign, boulders, bones and tent, and the ground's flowers, reeds, ferns, tufts, leaves, pebbles and moss. Things of one type may have varied looks, chosen per thing.

The generated 460-map world (Saenvar) and the tools only it used are removed. The dev modder runs under `tsx watch` so it validates against current content.

## Expected behaviour

- The aim carries a tile and an optional stack of references (things by id, or tiles for trees and tall grass reaching over), top first.
- If the aimed tile is the player's own tile or one of its 8 neighbours, the key acts there, using the supplied stack if there is one. Otherwise it acts on the tile in front, with no stack.
- The layers at a spot are the supplied stack, with the ground of the tile always last. Duplicates are dropped. Refs that are on another map or out of bounds are dropped.
- Without a supplied stack, the layers at a tile are in drawing order: people and creatures first, then items (the top of a pile first), then fixtures, then the ground. The player's own tile is no longer special-cased. The player is an ordinary actor in the stack.
  - For example, a tile holding a fixture, two items lying on it and the ground now gives `['item', 'item', 'fixture', 'ground']`. It used to give fixture first.
- A short press plans on the top layer only. The previous search for the first layer the rules answer for, and the "bare ground" special cases, are gone. If the rule library does not define what the top layer does, the plan is an experiment (`unknown`), which goes to the Mod port when run.
- The chooser lists every layer in the stack, each with what the key would do there.
- Example on the Ford: with the old axe held, standing beside the chopping stump and pointing at the stump's tile with a stack of just the stump:
  - `use` plans on the stump.
  - The chooser lists exactly the stump and then the tile's ground.
  - Running the plan is an experiment, and the world is asked about the interaction with the stump as target.
- A thing drawn over a neighbouring tile is met there. Pointing at the tile left of the tent with a stack of just the tent, `hands` targets the tent.
- The Ford map's raw chunk no longer has a `decor` field. Every one of these types exists as an entity on the Ford: `fixture/tent`, `fixture/furniture/bench/log`, `fixture/furniture/rack`, `fixture/nature/logpile/stack`, `fixture/nature/stump`, `fixture/light/lantern`, `fixture/nature/boulder`, `fixture/sign`, `item/material/bone`, `fixture/nature/moss`, `fixture/nature/flowers`, `fixture/nature/reeds`, `fixture/nature/ferns`, `fixture/nature/leaves`, `fixture/nature/pebbles`, `fixture/nature/tuft`.

## Requirements

- Add an `Aim` type (tile plus optional stack) to the engine, and let the controls' aiming, layering, planning and choosing take it.
- `layers` accepts an optional stack and orders layers as described above. `plan` and `choices` accept an `Aim`. `plan` takes an optional layer index, default 0, the top.
- Persons are recognised without excluding the player.
- Remove `decor` from `MapData`, the raw map type, the map decoder, the catalog and its types, asset listing and the renderer. Remove the bare-ground rules.
- Add the missing entity types to the ontology (log bench, cooking rack, firewood stack, stump, lantern post, tent, flowers, reeds, ferns, tuft, leaves, pebbles, moss), with sensible tags, and solid or not as fits. Ground cover is not solid. Add catalog sprites for them, with per-thing variants, flat-on-ground and loosely placed flags where they apply.
- The Ford content places these as entities instead of decor.
- The client's renderer gets a screen-point aim function. It hits-tests the opaque pixels of the drawn things and of tree/grass tiles, sorts by depth top first, and returns the tile plus the stack. The mouse handler re-aims every frame, since things move, and uses it for clicks.
- Remove the Saenvar world generation, its script, and the `?world=saenvar` switch. The modder launch config runs the modder under `tsx watch`.
- Existing behaviour not touched by the above is unchanged.

## Interface

- `Aim` in `packages/engine/src/types.ts`, exported from the engine package:
  ```ts
  interface Aim { x: number; y: number; stack?: Ref[] }
  ```
- `Controls.aim(at?: Aim): { at: Pos; stack?: Ref[] } | undefined`
- `Controls.layers(at: Pos, stack?: Ref[]): Ref[]`
- `Controls.plan(key: Key, aim?: Aim, layer?: number): Plan | undefined` (layer defaults to 0)
- `Controls.choices(key: Key, aim?: Aim): { layer: number; name: Text; plan?: Plan }[]`
- `WorldScene.aimAtScreen(sx: number, sy: number): Aim | undefined` in `packages/client/src/render/scene.ts`, replacing `tileAtScreen`.
- New entity type ids on the ontology: `fixture/furniture/bench/log`, `fixture/furniture/rack`, `fixture/light/lantern`, `fixture/tent`, `fixture/nature/logpile/stack`, `fixture/nature/stump`, `fixture/nature/flowers`, `fixture/nature/reeds`, `fixture/nature/ferns`, `fixture/nature/tuft`, `fixture/nature/leaves`, `fixture/nature/pebbles`, `fixture/nature/moss`.
- Catalog fixture entries gain optional `variants?: SpriteDef[]`, `ground?: boolean` and `loose?: boolean`.
- Removed: `MapData.decor`, `RawMap.decor`, `Catalog.decor`, the `gen:saenvar` script.
