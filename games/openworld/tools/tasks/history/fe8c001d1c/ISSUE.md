# The Shrine of the Nails can still destroy the ninth nail of Joss's errand

## What is wrong

The wayside shrines keep a list of things they refuse to take (the KEPT list in `pilgrimage.ts`). It refuses relics, items tagged as mattering most (`important`), bound items, and keepsakes.

The ninth nail (`item/misc/ninth_nail`), which Joss's errand needs, carries none of those marks. It is metal, so the Shrine of the Nails asks for it. A player can lay it there, the shrine accepts it and lights, and the nail is destroyed. The errand then cannot be completed, and the game gives no warning.

The Order's seal is already protected from this, because it is tagged as important. The ninth nail is not.

There is also a stale doc comment on the engine's clock accessor (`World.hour()` in `world.ts`). It says a game minute is 7 ticks, but `calendar.ts` defines it as 10 ticks (`TICKS_PER_MINUTE`).

## Expected behaviour

- Laying the ninth nail on the Shrine of the Nails is refused. The nail stays with the player, the shrine does not light, and the `ch1.shrines.nails` fact stays unset (0).
- The existing protections hold:
  - The Crown of Thorns is still refused by the Shrine of the Crown.
  - The Order's seal is still refused by the Shrine of the Nails.
- The shrines still accept what they actually ask for. Offering it lights the shrine and consumes the offering.
- The `hour()` doc comment states that a game minute is 10 ticks.

## Requirements

- The ninth nail item is marked with the same "important" tag the Order's seal uses, so the existing KEPT logic refuses it. Do not add a special case to the shrine code.
- The nail keeps its existing tags (metal, iron, conductive, sharp). Only the importance marking is added.
- The ninth nail on the Shrine of the Nails leaves the shrine unlit and the nail in the player's possession.
- Behaviour for the Crown of Thorns, the Order's seal and legitimate offerings is unchanged.
- The `hour()` comment in `world.ts` is corrected to say 10 ticks per game minute. This is a comment-only change with no behavioural effect.

## Interface

None
