# The economy: one standard price for every item (2026-10-27)

What a thing is worth decides what a merchant asks for it, what it pays, what a gift means and what a fine takes. Until
now the prices were a hand-written table, one number per kind, and the stall's and the store's shelves had numbers of
their own. A made thing was priced by its kind alone, then multiplied by its material, its quality and its level, so
cheap things made dear ones and the difference could be sold. A club from a log was worth five logs. A bow from sticks
and grass was worth four times what it took. A gold ring was worth almost three times its ingot. At level twenty, a
masterwork iron sword was worth twenty-five times its ingots. Ore smelted by hand at a forge was a gold bar worth three
times its ore.

This page sets out what replaces that table. The code is in `games/openworld/content/src/prices.ts`, the engine's bound
on made things is `params.made` (`packages/engine/src/effects.ts`, the `craft` primitive), and
`games/openworld/content/test/economy.test.ts` holds every rule below.

## 1. What the world gives

Some things are not made. They are gathered, grown, caught, mined, felled, dropped by monsters, or only ever found:
treasure, relics, documents, found arms. Each of these has a listed price (`items.ts` `VALUES`). That price is what one
is worth as it comes: of its own material, common, of the first level. The anchor is a day's work, a few dozen
Dawnmarks:

| kind | price | | kind | price |
|---|---|---|---|---|
| stick, stone, grass, flower, ash | 0.5 | | iron ore | 8 |
| log | 2 | | gold ore | 40 (five times iron, as gold's material is) |
| coal, wheat | 2 | | leather | 12 |
| herb, fireweed, frostcap | 6 | | gem | 50 |
| raw fish | 12 (the Dawnscale 160) | | bucket of milk | 20 |

A seed is priced at what the stall asks for it, less its quarter. A crop and a fish are priced at twice what the stall
pays for them, as before.

## 2. What is made

A made thing is worth what it was made of, plus the work once:

    raw(made)   = what its makings are worth as the world gave them, shared among as many as the making gives
    price(made) = raw(made) × LABOUR        (LABOUR = 1.25)

A made ingredient counts at its raw content, not at its own price. A bucket is three planks and a grass handle. The
planks count as the half-log each one is, not as planks. So the work is counted once however long the chain is:
log → plank → bucket is worth what the log and the grass were, and a quarter.

"Made" covers every recipe that turns items into an item (a form's makeup, the forge and anvil, the arcane workshop, the
sets). It also covers every rule that turns one thing into another:

- cooking (`cookedType`)
- smelting ore by hand at a lit forge (`smelts`)
- filling a vessel (`waterType`)
- cheese from milk over a fire (two cheeses, and the bucket back)

A kind may be made several ways: an iron sword and a steel one, healing from honey or from petals. It is priced by its
cheapest way, per its material's factor, so no way of making it is worth more than it took. The materials' factors are
set so that the ways agree:

- Gold's factor is five, and a gold bar's ore is five times iron's.
- Steel's factor is 1.9 (it was 1.6), as a steel bar's makings are.

A region's own form of a made kind is priced as its base is, with a named piece at three times.

What a recipe makes takes its main ingredient's material, as the engine makes it. The exception is a recipe that makes
the thing as it names it, a skill book (`madeOfMain`).

## 3. What a merchant does with a price

A merchant sells at the price and a quarter and buys at half (`MARKUP`, `MARKDOWN`, shared with `social.ts`). At full
regard it asks three tenths less and pays a fifth more (`DISCOUNT`). Every shelf asks the same: the stall, the general
store, and what the stall buys back (`shelfPrice`, `buyBackPrice`). No shop has numbers of its own any more. The one
exception is the chapel's bookstand, which keeps its teaching price (60, a profession's 120), above any book's standard.

A merchant never pays for what is worth less than a coin to it. It says so and does not buy it (`social.ts` `buys`).
Before, every sale fetched at least one coin, and a seed bought at 0.8 sold for 1.

## 4. Why nothing comes from nothing

A thing bought from a merchant at full regard costs 1.25 × 0.7 = 0.875 of its price. A made thing sold to one at full
regard fetches 0.5 × 1.2 = 0.6 of its own price, which is at most 0.6 × LABOUR × the quality's share of what its makings
were worth.

- At the best share (1.15): 0.8625 < 0.875.
- Buying a made part instead of its raw makings costs more again.
- A long chain adds the work once.

So nothing bought, made and sold again gives back what it cost. The same holds for every rule above, and for every
shelf against every merchant. The test checks all of it with the real rounding: every recipe at every quality, at the
top gear level, with every knack that raises what the stall pays.

What a maker makes of their own gathering is their gain, as it should be:

- Crafting raises a thing's sale from 0.6 of its raw content to 0.75.
- A knack that adds to a making's yield is its own reward, beyond this. The smelter's extra bar is one; the
  cheesemaker's cheese is another.

## 5. A maker's level and hand

A found piece's material, quality and level multiply its price. A made piece's would too, and that is where the
largest loop was. A level-twenty maker forges level-twenty gear, and a masterwork was worth three and a half times a
common one. So the engine bounds what is made (`params.made`). A made thing is worth what its kind is worth, of what it
is made of, as a common piece of the first level. Its quality's share is added on top: crude 0.8, fine 1.08,
masterwork 1.15, Vowbound and Stigmatic 1.15 (`MADE_QUALITY`).

When its level and quality would make it dearer, it keeps that bound as its `worth` prop, fixed as it is made. The
society module's `value` reads it, and a learned rule may never write it (`mod.ts` `WORTH`). The piece's stats are its
level's and its quality's as before: only its price is held.

## 6. What changed for the player

- Arms, tools and gear made of what lies about are cheap: a club, a bow, a stone pickaxe or a fishing rod is a few
  coins. Forged iron and steel are worth their bars.
- Bars are worth their ore. A gold ingot is 50, and a gold ring, earring or crown is priced by its gold.
- A healing potion is priced from the field's petals (about 9), and the store asks 12 for one.
- Cheese is priced from milk (about 10).
- A jar of honey makes six candles, not two.
- Feed and fertilizer are priced from their wheat and grass.
- Flowers, sticks, stones and grass no longer sell to merchants.
