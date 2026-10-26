# Economy check mishandles a type named twice in a step, so self-returning chance and duplicate parts are miscounted

## What is wrong

The economy check turns recipes, breakable things and rules into linear-programme steps, each with a `takes` map and a `gives` map of counts by type. When the same type appears more than once on one side of a step, the entries are not combined: a later entry overwrites an earlier one. This gives wrong amounts in these cases:

- A breakable thing's makeup lists the same part twice (for example once certain and once with a chance). Only the later entry's amount survives, so the break step gives too little.
- A recipe needs the same type in more than one entry. Only the last need's count survives, so the recipe takes too little.
- A thing that gives itself back by chance (a stick ground into a stone that also returns the stick one time in five, or a thing whose makeup includes itself with a chance) must be counted correctly, including when the check compares it with other steps. The chance has to be counted as expected value, so the economy check can tell when such a loop breaks even and when it makes something from nothing.

## Expected behaviour

- Within one step, all entries naming the same type on the same side (`takes` or `gives`) are added together.
- For a break step, the expected yield of a part is `count × (chance, default 1) × recovery`, summed over every makeup entry naming that type.
  - Example: a makeup of 1 stone, 1 stone at chance 0.5, and the thing itself at chance 0.2, with recovery 1, gives 1.5 stones and 0.2 of the thing.
- For a recipe, if the same type is needed in several entries, the step takes the sum of their counts.
- Rule steps for a grind that destroys a stick and always spawns a stone, and with chance p also spawns a stick:
  - For p = 0.2 the step takes 1 stick, gives 1 stone and gives 0.2 sticks.
  - Together with a recipe of 5 stones for 4 sticks, there is no free lunch (1 / (1 − 0.2) = 1.25 stones per stick, so 4 sticks give 5 stones: exactly even).
  - For p = 0.25, with the same recipe, 4 sticks give 5⅓ stones, so there is a free lunch that makes stone (a third of a stone from nothing).
  - For p = 1 (the stick always comes back), the check finds a free lunch of one stone from nothing on its own, since the stick never goes.

## Requirements

- Duplicate types within a recipe's needs are summed in the step's `takes`.
- Duplicate types within a makeup are summed in the break step's `gives`, each entry weighted by its count, chance (default 1) and the recovery factor.
- A break step for a thing whose makeup includes itself with a chance gives back that expected amount of itself, and the step is still produced.
- The free-lunch check gives the correct verdicts for the grind cases above: none at p = 0.2 with the 5-for-4 recipe, a stone-making one at p = 0.25, and one stone from nothing at p = 1.
- Existing behaviour for steps with no duplicate types is unchanged.

## Interface

None
