# Hunger should fall in two paces: fast while fed, slow once hungry

## What is wrong

Hunger falls far too fast. A point is lost every 30 game minutes (300 ticks), so a full bar (20) empties in about 10 game hours. A body does not work this way: it goes through a meal's span between meals, but days without food.

A related scheduling defect shows up once paces can change. A period that runs on a host's own pace (a per-host interval, or a pace set by the host's statuses) fires when the global tick is a multiple of that host's interval. After the host's pace changes (for example, it falls asleep, or becomes hungry and so slower), the next multiple of the new, longer interval can arrive almost immediately. A sleeper with a low stomach is woken by hunger the same night it lay down.

## Expected behaviour

**Two paces for hunger**
- **Fed** (hunger at or above 60 % of `maxHunger`): one point every 480 ticks (48 game minutes). From full (20) down to six tenths (12) takes about 6.4 game hours, which is a meal's span. A meal (8 points, e.g. steak or pie) fills it again.
- **Hungry** (hunger below 60 % of `maxHunger`): the hunger period runs 7.5 times slower, one point every 3600 ticks (6 game hours). Six tenths to empty takes about 3 days, and full to empty about 3.3 days.
- **Asleep** keeps its factor of 4. When the host is both asleep and hungry the factors multiply (4 × 7.5 = 30 times the base interval).
- The heal threshold (90 % and up) and starvation damage (at 0) are unchanged.

**The hungry status**
- A host whose hunger drops under the line (60 % of its own `maxHunger`) gains the status `hungry`. Rising back to or over the line removes it. The line is crossed in both directions and each crossing is observable as a threshold event; the upward one is distinguishable from the downward one.
- A host that is under the line but lacks the status (an old save, or a thing whose hunger was set directly) gets the status at its next hunger point.

**Scheduling**
- A period on a host's own pace comes by progress. The progress is the ticks gone by over the interval at the host's current pace, and it is carried over a change of pace. A change of pace never makes the next event come at once, and it never stretches an old-pace wait after the change.
  - Example: a host that had run most of a slow interval and then returns to the fast pace gets its next point within one fast interval, and every one after that exactly one fast interval apart.
- The first event for a host still falls on the clock's old beat. If the clock jumps, the period catches up.
- Consequences: a sleeper with a low (but non-zero) stomach sleeps the night through without being woken by hunger. A sleeper with an empty stomach is still woken by hunger in the night and is hurt by a point.
- Periods that have no per-host pace keep firing on the clock's beat as before.

**Skills and saves**
- Iron Stomach and Frugal keep their relative effect: each grants +240 on the base interval, which is now 480 (so 720 with Iron Stomach, 960 with both). Their descriptions are updated to the new scale.
- Saves with the interval on the old scale (300, 450, 600) migrate to the new scale (480, 720, 960). The early-absolute-150 Iron Stomach save is migrated first to 450 and then on to 720.
- Iron Stomach on the fed pace: a host with hunger over 60 % and Iron Stomach loses nothing at tick 480 and loses a point at tick 720.

## Requirements

- Fed hunger interval is 480 ticks. Hungry slows it by a factor of 7.5. Asleep keeps 4. Several pace factors multiply rather than the largest being taken.
- The `hungry` status exists and is added and removed by a base rule on crossing the 60 % line down and up. The line is a declared threshold, not hard-coded in the hunger rule.
- The threshold definition can express a line as a share of another prop of the same thing, and can be declared to fire in both directions. An upward crossing carries the param `way` with value `up`. A downward crossing carries no such param, so existing rules that react to downward crossings are unaffected. Existing `lte` thresholds (e.g. `broken` at hp ≤ 0) behave as before.
- The hunger rule repairs a host that is under the line without the status when its next point falls.
- Per-host-paced periods are scheduled by carried-over progress as described above. A fractional pace product is rounded to a whole interval of at least 1 tick.
- Skill intervals and their docs are updated, and old-scale saves are migrated on load.
- The mod-facing description of `threshold/cross` mentions the new `hungry` line and the `way` param.
- The existing suite still passes, with the tests that encoded the old pace or the old wake-up behaviour updated.

## Interface

In `@lsw/engine` (`packages/engine/src/hunger.ts`, exported from the package):
- `HUNGER_EVERY: number`, now `480` (was `300`).
- `HUNGRY_PACE: number` = `7.5`, the factor by which the hunger period is slower while hungry.
- `HUNGRY_BELOW: number` = `0.6`, the share of `maxHunger` under which one is hungry.

Also used from `@lsw/engine`: `TICKS_PER_HOUR` (already exists in the calendar module; it must be exported from the package root if it is not already).

`ThresholdDef` (`packages/engine/src/types.ts`):
- `lte?: number` (now optional).
- `below?: { prop: string; mul: number }`: the line is `mul` times the thing's value of `prop`; crossed when the value comes under it.
- `both?: boolean`: also crossed upward; the event then carries param `way: 'up'`.

Content:
- Status id `hungry` (name en "hungry", zh "饿了").
- Threshold `hungry` on `hunger`, with `below: { prop: 'maxHunger', mul: HUNGRY_BELOW }` and `both: true`.
- Rule id `body/hungry`, on `threshold/cross`, adding the status `hungry` on a downward crossing and removing it on a `way: up` crossing.
- The `hunger` period's `paceBy` is `{ asleep: 4, hungry: HUNGRY_PACE }`.
