# Companion Lumi, trophy gear, enterable buildings and tents, residents of the Held Ground, and the Dawnmark

## What is wanted

A bundle of related changes to the openworld game's content and engine behaviour:

1. **The companion is renamed Lumi** (formerly Pip, 小啾 → 露米). Every line of dialogue, quest text, boon text, and the fairy's own name uses the new name. Older saves have their fairy renamed on load, keeping everything else about her. Fresh games are marked as already renamed.
2. **Lumi keeps two tiles off her leader**, not one. She is spoken to (E, "hands") from that distance. When the player's E targets a tile where Lumi hovers, the companion is the target, unless a person is within reach on that tile, in which case the person is the target. Speaking to her opens a **companion panel** (portrait, main road, the seals' powers, moods by seal). She needs a portrait look. Each boon records which seal it belongs to.
3. **Every building and tent can be entered.** Every house, shop, store, teahouse, inn, longhouse, smithy, straw hut, temple, igloo and cabin stamped on any map has a door leading to an interior room and back. Tents are entered by a hand on them and left by their flap. Older saves' tents are brought up to date with their interior properties.
4. **Gear gets rolled affixes and monster trophies.**
   - Every wearable or wielded piece rolls small extra affixes when made.
   - Each monster kind has its own trophy piece, which may drop into the bag of whoever fells it (a chance per felling, guaranteed at the 50th felling without one).
   - The forged profession gear is split in two sets: **armour** (head, shoulders, body, hands, waist, feet; bonuses at 2, 4, 6 pieces) and **trinkets** (neck, ear, ring; bonuses at 2 and 3). Weapon and off hand belong to neither set. Monster families have their own sets as well.
5. **Regard and residents.**
   - Regard with a person is shown as ten hearts; liking fades more slowly; merchants give up to 30% off at full regard.
   - A person at full regard who is not bound to the main story can be invited to live in the Held Ground. They get a bed at the camp from the start, and the steward can raise up to three **residents' tents** (two beds each; seven beds in all). Plots for them are staked at the heart's edge. Moved in, the resident's days are the Held Ground's.
   - Older saves with a Held Ground get the new plots staked.
6. **The currency is renamed the Dawnmark (晨辉币)**, replacing the Thornmark (银荆币), in names and text.
7. Interface-only changes (interaction keys in one translucent row above the player, weapon swing animations for sword/bow/staff following the attacker, restyled skill tree, new Lumi art) accompany this but are not the focus of behavioural checks.

## Expected behaviour

- Talking to the fairy (`pip` entity) via hands emits a panel effect for `companion`, wherever the player is.
- The companion settles at Chebyshev distance 2 from a stopped leader, stays put when the leader turns toward her, and has `handsRange` 2. Planning E at her tile targets her; planning E at a tile holding both a person and her targets the person.
- A player striking the fairy still downs her but does not remove her (she is essential).
- Forged set data lists, in order: `shadowfang, shadowfang_trinkets, oathguard, oathguard_trinkets, windrunner, windrunner_trinkets, starweave, starweave_trinkets` (then monster sets). Each armour set has 6 pieces, each trinkets set 3. Forged head/body/feet carry the set id; neck/ring carry `<set>_trinkets`; weapon and off hand carry no set. Two armour pieces give the first bonus, four the second (the dodge for a Shadowfang jerkin, boots and shoulders is base + 0.02 + 0.02 + 0.03).
- Inviting a person at full regard (e.g. Tam, after Alberic is defeated and regard is maxed) places them in `haven` at slot `home.camp`. The residence beds are `home.camp`, then `home.lodge1.a`, `home.lodge1.b` when lodge 1 is built, and so on. Plot fixtures `fixture/build/plot/lodge1|2|3` exist at the Held Ground; once the steward builds one, it becomes `fixture/tent`.
- Tents in the world number three on the Ford maps, each having an `interior`, `interiorX`, `interiorY`.

## Requirements

- Rename Pip to Lumi in all names and strings, English and Chinese, including quests, prologue beats, boons and comments; add a one-time rename migration with a version fact.
- Fresh games set the rename fact and the lodge layout fact; old saves run both migrations at load.
- The companion keeps two tiles from its leader; `handsRange` of 2 on the companion type; E prefers a person over a companion on the same tile.
- Opening the companion panel when talking to her; add her portrait look and the seal number on each boon.
- All the listed building stamps have doors to interior maps; tents have interiors and an exit by the flap.
- Items that are worn or wielded roll affixes at creation unless traits are disabled; a monster's defeat can award its trophy piece, with a guaranteed drop at the 50th.
- Forged sets are split into armour and trinkets with the piece counts and bonus thresholds above; the weapon and off hand are in neither.
- Three residents' tent upgrades (lodge1–3) with plots, costs and unlocks; residence beds follow them.
- The currency's display names become Dawnmark / 晨辉币 (the underlying item id may stay).
- Existing tests that mention Pip, Thornmarks or the earlier set shape must be satisfied under the new names and shapes.

## Interface

New names (content package, exported from `@openworld-game/content`):

- `COMPANION_NAME: string` — fact id `'content.lumi-v1'`, in `migrateCompanion.ts`.
- `migrateCompanionName(game: Game): void` — renames every `actor/companion/fairy` to `{ en: 'Lumi', zh: '露米' }`, sets `COMPANION_NAME`.
- `COMPANION_LOOK: Look` — Lumi's portrait, in `looks.ts`.
- `LODGES_LAYOUT: string` — fact id `'content.haven-lodges-v1'`, in `migrateHaven.ts`.
- `migrateLodges(game: Game, plots: { id: string; at: readonly [number, number] }[]): void` — in `migrateHaven.ts`; stakes `haven.plot.<id>` fixtures for an existing Held Ground.
- `migrateTents(game: Game, chunks: MapChunk[]): void` — in new `migrateTents.ts`, exported from the content index; copies `interior`, `interiorX`, `interiorY` onto saved tents.
- New module `trophies.ts` (exported from the content index) providing `AFFIX_TABLE`, `TROPHIES`, `TROPHY_OF`, `TROPHY_SETS`.
- `BoonDef.seal: number` — new field in `boons.ts`.
- `HAVEN_UPGRADES` gains entries `lodge1`, `lodge2`, `lodge3` (each with `plot`).
- Ontology types `fixture/build/plot/lodge1`, `lodge2`, `lodge3`; companion type prop `handsRange: 2`; `sets` now includes the trophy sets; `affixes` set to `AFFIX_TABLE`.
- Client: `CLIENT_GAME.companion = { look, epithet: { en, zh } }`.
- A `companion` panel (the panel effect's `panel` value).
- The rule operation `trophy` and the `trophy`/`trophyChance` props on monster kinds.
