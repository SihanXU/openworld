# Tutorial building parts: a hand-made door, bed and torch, and a door that opens and shuts

## What is wanted

The tutorial needs a few things the engine and content do not yet offer:

1. **Doors.** A player can make a wooden door by hand from planks and set it down like a wall. While shut it blocks movement; the player can open it and shut it again by interacting with it (E, "hands"). Whether open or shut, a door counts as the edge of a room, exactly as a wall does, so opening a door does not merge the room with the outside or make it vanish.
2. **A bed and a torch made by hand.** The bed is crafted from planks and grass and can be carried, then set down where one sleeps. The torch is crafted from a stick and grass.
3. **A new game that can begin at its own hour with statuses.** The default start and named starts should both be able to specify an hour and statuses the player begins with. A new status, "out cold", means the player lies still for a while and then comes round. It should be drawn like a character who is down (lying on the ground).
4. **Richer story triggers.** Story step conditions should be able to read more of the world (see below).
5. **Portals that wait on the story.** A portal may stay closed until a story fact holds. Until then its tile behaves as plain ground.

## Expected behaviour

**Building a bedroom (the case that matters most).** On an open meadow, with the player standing in the middle:
- Place a bed under the player, walls on three sides, a door on the fourth, then a floor over the player's tile. The area is then covered and `roomsOf` reports exactly one room, tagged `role:bedroom`.
- The door starts shut (`structure/door`) and nothing passes. Interacting with it with "hands" offers the label "Open Wooden Door". After running it, the door becomes `structure/door/open`, and the room list still has exactly one room.
- The player can walk out through the open door.
- Interacting with the open door from outside shuts it again (`structure/door`), and that tile is no longer walkable.
- The door's name is "Wooden Door" (zh 木门); the open form is "Open Door" (zh 开着的门).

**Start with hour and statuses.**
- A start definition may carry an hour of day 1 and a map of statuses to durations in ticks. The world index may carry the same for its default start. A named start's own values are used when that start is chosen. Otherwise the default start's values are used. The hour falls back to the world's start hour, then to the usual default.
- The player begins with each status lasting its given number of ticks from the game's starting tick.
- The `out_cold` status (en "out cold", zh 昏迷) lasts 50 ticks and immobilizes. It is drawn lying down like `down`.

**Story conditions.**
- Carrying: the leader may be required to carry each of a list of types (a plain string still works as before).
- Statuses: the leader must have (true) or must not have (false) each named status.
- Near: the existing "something of a type is within r tiles" can also require that thing to have a given status, e.g. a lit fire.
- Room: a room with a given role exists on the leader's map.
- Morning after: true from the first 05:00 after the named step has played. If that step played in the small hours (night, before noon), it means that same day's 05:00. If it played in the evening, it means the next day's. It is false if the step has not played.

**Portals.** A portal with a story-fact requirement is only a portal when that fact holds. Until then, stepping onto its tile is ordinary movement. Portals without the requirement behave as before.

**Client.** The door (shut and open) and the bed need sprites in the client catalog.

## Requirements

- A door is crafted by hand from 2 planks, is solid when shut, and is placed like a wall. Its open form is not solid.
- Interacting with a shut door opens it and interacting with an open door shuts it, each with a matching label ("Open …", "Close …").
- Door tiles, shut or open, never become part of a room's interior. They bound it, like walls, so room detection yields the same single room whether the door is open or shut.
- The bed is crafted by hand from 2 planks and 2 grass, and is carryable. It still works as a bed (sleeping, with its existing hand-range behaviour).
- The torch is crafted by hand from 1 stick and 1 grass.
- A new game honours start hour and start statuses for both the default and named starts. Existing behaviour is unchanged when neither is given.
- All story condition extensions are optional, and existing conditions keep working.
- A portal waits on its story fact, and an unopened portal does not block or transfer anything.
- The `out_cold` status renders the same lying-down pose as `down`.

## Interface

- `StartDef.hour?: number` and `StartDef.statuses?: Record<string, number>` in `packages/engine/src/game.ts`.
- `WorldIndex.begin?: Omit<StartDef, 'at'>` in `packages/engine/src/game.ts`: how the default start begins.
- `StepCond` in `packages/engine/src/types.ts`:
  - `carrying?: string | string[]`
  - `statuses?: Record<string, boolean>`
  - `near?: { type: string; r: number; status?: string }`
  - `room?: string`
  - `morningAfter?: string`
- `Portal.opensWhen?: string` in `packages/engine/src/types.ts`.
- New content types: `structure/door` and `structure/door/open` (tag `door` on the shut door).
- New rules: `build/door-open` and `build/door-shut`.
- New status: `out_cold`.
- Client catalog sprite keys: `structure:door`, `structure:door_open`, `fixture:bed`.
