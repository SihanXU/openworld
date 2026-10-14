# Fix what the story playthrough left: whelps linger, ice never lets go, ceilings break when carried off, and a backend out of quota is hammered

## What is wrong

A full playthrough of the story turned up several faults in the game and in the modder service:

1. **Whelps after the dragon.** Once the dragon is slain and the end card shown, its whelps are still there and a fight follows.
2. **Ice locks a wet thing.** In the rain, a wet creature struck by an ice weapon again and again stays frozen through the whole fight (a frost wand held the barrow warden frozen, 40 → 40 hp).
3. **Ceilings broken by being taken down.** A ceiling taken down into the hand is treated as a floor that lost its support. It "comes down", breaks, and gives back one plank of two instead of the whole ceiling.
4. **The wand Tobin gives.** After Tobin says "That one is yours now", the wand is still marked as his.
5. **Oskar's line.** It reads as if the warden were still to be fought, even after the warden has fallen. The fire-resistance draught is named inconsistently (the item says 抗火药剂, elsewhere 防火药剂).
6. **A person's line holds up the next act.** While a person's line is on screen (for example a turn-in's thanks), F or G only close it, and the act needs a second press. Handing the smith five ores takes ten keys.
7. **Modder under a failing backend.** When the backend is out of quota or throttled, every request still runs a live attempt, an offline escalation and a reflection, each failing on the same error. The failure is also recorded as a lesson.

## Expected behaviour

- **Whelps:** while the dragon lives, whelps stay as they are. Once the dragon is slain (story fact `mq.dragon` is 1), whelps vanish over time, one by one, with a small effect and a log line. After enough time none are left.
- **Ice:** an ice strike on a wet thing freezes it. After it has been frozen it is `thawed` for a while (80 ticks) and a further ice strike does not freeze it again. A wet creature struck repeatedly over 400 ticks is frozen for no more than about 45 ticks in total and gets to fight back (the player loses hp). Ice on a burning thing still puts out the fire as before.
- **Ceiling:** put a ceiling over a door with G, then take it down with the ceiling plan. It ends up in the player's hand, intact. A floor whose supporting wall is broken still comes down and breaks.
- **Tobin's wand:** when the player takes the wand in his sight with the charm fact set, Tobin says the "yours now" line and the wand's `owner` becomes the empty string, so no one cries thief.
- **Oskar:** his rescue-quest line makes sense both before and after the warden falls. New Chinese line: 可算来了。我跟着那丫头回家。那个守卫要是还在，你小心点。 The draught's Chinese name is 防火药剂 everywhere.
- **Dismissing a line:** with a person's line open (not a scene's line, not a card, not a question) and no menu open, pressing F or G puts the line away and the key then acts as usual. Scene dialogue, cards and questions keep their current behaviour.
- **Modder:** a failure whose error matches a backend-down condition (such as session limit, usage limit, rate limit, 429, quota, overloaded, insufficient_quota) is not a lesson and is not escalated or reflected on. For five minutes after one, no model call is made. Requests meanwhile get outcome `unavailable` and the game plays its defaults. The first request that hit the error still reports `failed`.

## Requirements

- Whelps are removed only after the dragon is slain, and not before.
- Ice freezing a wet host also marks it `thawed`. A host that is `thawed` is not frozen again until the status wears off.
- `thawed` is a status with a duration of 80 and the display name "thawing" / 刚解冻.
- A floor or ceiling that has been carried off (placed in a bag or held in a hand) does not trigger the collapse rule.
- The wand Tobin gives is cleared of its owner when he says it is the player's, via a notification to the wand.
- Oskar's line text is updated as described and the draught's Chinese name is 防火药剂.
- F and G dismiss a person's line and then act. They must not dismiss scene dialogue, cards or questions. Pause state is re-synced after a dismissal.
- Backend-down failures set a pause of five minutes. During it, `resolve` returns `unavailable` without calling the model. The reason is kept in diagnostics.
- Backend-down failures produce no reflection and no lesson. Other failures behave as before.
- Existing tests keep passing, except that the check on Oskar's old line is updated to the new text.

## Interface

- Story rule `mq/whelps-scatter` in `packages/content/src/quest.ts`. It applies to whelps (`actor/creature/whelp`) on the period named `orphaned`.
- Period `orphaned` (every 5 ticks, hosted by `actor/creature/whelp`) in the ontology in `packages/content/src/ontology.ts`.
- Status `thawed` in `STATUSES` in `packages/content/src/ontology.ts`.
- Story rule `ford/wand-given` in `packages/content/src/ford.ts`. It applies to the wand type, on `impulse/notify` with param `what: 'yours'`, and sets `owner` to `''`.
- `Hud.dismissLine(): boolean` in `packages/client/src/ui/hud.ts`. It returns true if it put a person's line away.
- No new exported names are needed in the modder. The backend-down behaviour is internal to `Modder`, and tests use only `resolve`, `settled` and the `unavailable` / `failed` outcomes.
