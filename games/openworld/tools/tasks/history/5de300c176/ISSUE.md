# Sleeping through a night should pass asleep, with hunger falling four times slower

## What is wrong

When the player sleeps in a bed, the whole night is run at once, but hunger falls at the waking rate the entire time. A night from half past nine in the evening to six in the morning (eight and a half hours) costs about 17 of 20 hunger points. Anyone who isn't nearly full goes hungry during the night, takes hunger damage, and wakes up starving and hurt. Sleep also doesn't mark the sleeper as sleeping. They aren't immobilized, aren't drawn lying down, and nothing wakes them when something goes wrong.

The tutorial's text for the night ("Eat your fill, then sleep…") assumes this punishing behaviour.

## What is wanted

1. Sleeping puts the sleeper in an `asleep` status for the length of the night. While asleep they are immobilized, and the client draws them lying down, as it does for someone who is down or out cold.
2. Periods can be slowed by statuses, and this is data on the period definition, not a special case in code. The hunger period, for a host that is `asleep`, comes four times slower.
3. Harm wakes the sleeper. If the player loses hp during the sleep fast-forward, the `asleep` status is cleared, the rest of the night is not slept through, and the log says why:
   - "Hunger wakes you." if they are starving (hunger at 0 or below).
   - "Something hurts you awake." for any other hurt.
   
   The existing "Hurt, you stop on the way." message stays for the case of travelling on the road, where the player is not asleep.
4. The tutorial's hints and bedtime line should stop telling the player to "eat your fill" before sleeping. They should say not to sleep on an empty stomach (hunger wakes you in the night), in both English and Chinese.

## Expected behaviour

- The player with full hunger (20) in a bed at about 21:30 uses the bed. They are `asleep` immediately. After the night's time has run, the hour is 6, `asleep` is gone, hunger has dropped by only about four points (no more than 5, instead of 17), hp is full, and the player is not busy.
- The player with hunger 2 uses the bed at the same time. Hunger runs out partway through the night. They lose 1 hp, which wakes them in the small hours, after bedtime and before 6 in the morning of the next day. The log contains exactly "Hunger wakes you.", `asleep` is cleared, and the player is not busy and can get up and act.
- Awake, hunger falls at its normal rate. Statuses that do not appear in a period's pace data have no effect on that period's interval.
- A host with several slowing statuses takes the largest factor, not the product. The slowed interval stays a whole number of at least one.

## Requirements

- Add an `asleep` status that immobilizes and has no fixed duration of its own. It is set to last as long as the sleep fast-forward.
- `sleepUntil` must report how many ticks the sleep takes, so the status can be set for that long.
- Sleeping applies `asleep` only to the player (the one at the keys), as the fast-forward already does.
- Period definitions accept an optional map from status id to a slowdown factor. A host with one of those statuses gets the period's interval multiplied by the factor. This applies to both the base `every` and an `everyProp` override such as Iron Stomach's.
- The hunger period is configured so `asleep` gives a factor of 4. The vitals period is unchanged.
- When hp drops during the fast-forward and the player is asleep, clear `asleep` and break out of the fast-forward. The message depends on the cause as described above.
- The client's lying-down rendering includes `asleep`.
- Update the tutorial text to the new wording, in both languages.

## Interface

- Status id `asleep` in the content ontology's `STATUSES`: `{ id: 'asleep', name: { en: 'asleep', zh: '睡着' }, immobilize: true }`.
- `PeriodDef.paceBy?: Record<string, number>` in `packages/engine/src/types.ts`: status id mapped to the factor by which the period's interval is multiplied for a host that has the status.
- `Engine.sleepUntil(hour: number): number` in `packages/engine/src/engine.ts`: it now returns the number of ticks the fast-forward will run (it returned nothing before).
