# The hungry sell their food back: loaves circulate between buyers instead of being eaten

## What is wrong

Since every person in the world became a trader, hungry people buy food from the nearest person who sells it. The bought loaf goes into the buyer's bag and so counts as the buyer's own stock. The buyer must wait out a cooldown before eating, and in that time another hungry person buys the loaf from them. The loaf passes from hand to hand and is never eaten. In a two-day run, one person bought 525 loaves and ate one. Others did the same, and they stood next to one another instead of at their work.

The headless world check (`check:world`) shows the effect. Many people-hours are off their schedule (57 of 686, against a 5% limit), so the check fails.

There is a second, smaller problem in the same check. An hour spent held in the cells (jailed) is counted as off schedule. A jailed person cannot keep a schedule, so these hours should not count, just as hours spent flat on the ground (down) or under threat do not count. One person, caught stealing a meal, spent his days in the cells and was counted against the schedule.

## Expected behaviour

- A merchant who is hungry does not offer food. Anything edible in its bag is left out of what it offers for sale. Other goods are offered as before.
- Because a hungry holder offers no food, no one can buy it from them. The holder eats it, and the loaf does not change hands.
- When the holder is no longer hungry, its food is offered again like the rest of its goods.
- Example: two hungry people both have coin, and only one holds a loaf. The holder's offer does not include the loaf, and the other person is never offered it. No purchase takes place, and the holder eats the loaf in due course. If the holder is then fed and given a new loaf, the new loaf is in the offer.
- In the world check, an hour in which the person is jailed is skipped, as hours of being down or threatened already are. It counts neither as on schedule nor off schedule.
- After the change, the world check's off-schedule share falls under the 5% limit (a small number of hours, a few out of about 660).

## Requirements

- What a merchant offers is decided by the merchant's current hunger. A hungry merchant's offer has no edible items. A merchant who is not hungry offers its edible items as before.
- Coin, worn items, frozen items and items that aren't the merchant's own to sell stay excluded as before.
- A hungry seller never makes a sale of food, so a loaf held by a hungry person is eaten, not bought.
- The world check does not count hours when the person is jailed in either its on-schedule or off-schedule totals.
- Behaviour for non-hungry merchants, and for non-food goods, is unchanged.

## Interface

None
