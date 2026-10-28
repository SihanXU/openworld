# Quests

Status: **agreed 2026-10-09, built** (supersedes the 2026-10-03 system). The user asked for a
Bethesda-style, event-driven quest system ("做成贝塞斯达那种事件驱动的任务系统，完备一点") and accepted
every recommendation:
- Side quests and radiant favours are accepted or declined in the talk panel; main quests begin by
  themselves.
- Objective markers are on the minimap, the world map and the screen's edge (an option turns them off).
- The main line moves to the new system in one go.
- Radiant favours grow out of the NPC sandbox, and the village has a notice board.
- The modder does not author quests this round.

## 1. References

| | What we take | What we do not |
|---|---|---|
| Skyrim / Fallout (Creation Kit) | quests as records with **stages** (a number, a journal line, what happens on reaching it, complete/fail); **objectives** apart from stages (shown, done, failed, with targets and markers); **aliases** filled when a quest starts (a specific ref, a match by conditions, one made on the spot, one from the event that started it, a location) with flags (essential, quest item, optional); the **Story Manager**: world events start quests whose conditions hold and whose aliases fill (radiant); dialogue topics gated by stage; scenes cast by alias | Papyrus fragments (our stage effects are data); compass-only UI |
| Elin (decompiled, 2026-10-09) | offers that sit on a person before they are accepted (radiant), accepted quests apart; references by id that survive a dormant map; deadlines on the clock; difficulty and reward as formulas; a cap on favours | world code calling specific quests (`GetPhase<QuestX>() == 8`); a bare int phase whose meaning is C#; six hard-coded hooks |

## 2. The model

A **quest** is content (`QuestDef`, `WorldIndex.quests`). A **quest under way** is a resident thing,
`quest.<id>` (a radiant one `quest.<id>.<n>`), of type `resident/quest`. Its props are its state:

| prop | what |
|---|---|
| `quest` | its definition's id |
| `state` | `offered` · `active` · `done` · `failed` |
| `stage` | the stage it stands at (0 before the first) |
| `stage.<n>` | the tick each stage was reached (the journal reads these) |
| `alias.<name>` | who or where an alias is (an entity id, or a place: `map` / `map:region`) |
| `obj.<id>` | an objective's state: `shown` · `done` · `failed` |
| `count.<id>` | a counting objective's count (kills) |
| `by` | who took it on |

Like any thing, a quest answers events with its rules, which **read anything and write only
itself** (design.md §5.6). Anything else that wants a quest to move on **notifies** it
(`impulse/notify` with what `stage`, `accept`, `decline` or `fail`), and the quest answers. That is
our SetStage. No patch may host a rule on a quest, and none may write one (mod.ts).

### 2.1 Definition (`QuestDef`)

```ts
{ id, kind: 'main' | 'side' | 'favor' | 'guide', title, summary,   // guide: a lesson the companion begins herself
  aliases?: Record<name, AliasDef>,          // who and what it is about
  objectives?: ObjectiveDef[],               // what the journal and the markers show
  stages: StageDef[],                        // the first is where it begins
  start: { auto: Trigger }                   // begins by itself (main quests)
       | { offer: alias, when?: Trigger }    // a person offers it (E): accept or decline
       | { news: NewsKind, when?: Trigger, chance?, most? }   // radiant: on world news, if its aliases fill
       | { manual: true },                   // begun only by an effect (startQuest)
  deadline?: hours,                          // past it, an active quest fails (an offer is withdrawn)
  repeat?: 'daily' | 'always',               // may begin again once over
  offer?, accepted?, declined?, waiting? }   // the giver's lines
```

- **Aliases** (`AliasDef`) are filled when the quest begins (or is offered):
  - Ways to fill one:
    - `id`: a specific thing.
    - `find`: a selector, optionally on a map or near another alias, the nearest or a random match, never another alias's.
    - `make`: a thing made on the spot, in an alias's bag or at a place.
    - `from`: a role of the news that began it (`actor`, `target`, `item`, `source`).
    - `place`: a map or a named area.
  - Flags:
    - `optional`: may stay empty. A quest whose required aliases do not fill does not begin.
    - `essential`: they cannot die while it runs; they go down instead.
    - `keep`: a quest item. No merchant buys it while the quest runs.
  - The taker is always the alias `player`.
- **Objectives** (`ObjectiveDef`):
  - `text`, which may name aliases as `{alias}`.
  - `target`: the aliases it points at, for markers. With `talk`, a "?" appears over the person.
  - `count`: `{ carry: Selector }` (what the taker holds now), `{ kill: Selector, map? }` (kept in
    `count.<id>`) or `{ fact: key }` (a number the story keeps), with `need`.
  - `on`: a trigger that marks it done, with a `say` line from its target.
  - `optional`.
  - Stages show, complete and fail objectives. Without any `show`, all are shown from the start.
- **Stages** (`QuestStage`): `n`; `on`, the trigger that sets it, from `from` (stages it may follow;
  default any lower); `log`, the journal line; `hint`, Lumi's tip; `show` / `done` / `fail`
  (objectives); `say` / `by` (a line, by an alias; by default the one spoken to, else the giver);
  `take` (things the taker hands over to an alias, default the giver); `reward` (xp, items, coin,
  regard with aliases, the story's facts); `do`, effects run as the quest's own outcome (a scene,
  another quest, a topic told to the story); `lessons` (the tutorial's drills, docs/prologue.md);
  `complete` / `fail`.

### 2.2 Triggers

A trigger is data. Each kind listens for some news and holds on some state. Stages and objectives
are checked when news they listen for arrives, and once more when their quest reaches a stage. No
quest polls.

| trigger | holds when | news |
|---|---|---|
| `{ talk: alias, topic? }` | the taker speaks to the alias (E, or one of the quest's topics in the talk panel) | `talk` |
| `{ kill: alias \| Selector, map? }` | the alias, or one of a class (felled by the taker), is brought down | `kill` |
| `{ gone: alias }` | the alias is dead or destroyed | `gone` |
| `{ enter: place }` | the taker is on that map or in that area | `enter` |
| `{ carry: Selector \| alias, count? }` | the taker holds that many | `carry` |
| `{ give: Selector \| alias, to: alias }` | the taker hands it to the alias (G) | `give` |
| `{ fact: { key: Cmp } }` | the story's facts | `fact` |
| `{ quest: { id: Cmp } }`, `{ done: id }` | another quest's stage, or that it is over | `quest` |
| `{ step: id }` | a step of the story has played | `step` |
| `{ objectives: ids \| 'all' }` | those objectives are done (counts met) | `quest` (its own) |
| `{ all }`, `{ any }`, `{ not }` | combinations | their parts' |

### 2.3 News and the Story Manager

The engine turns what happens into **news**, after every outcome, and the quests that listen
**see** it: a `seen` event, params `news` and its facts, roles `actor`, `target` and `item`. The
kinds of news:

| news | made when |
|---|---|
| `talk` | a person spoken to by someone with a quest (their `quest` effect) |
| `kill` | anything's `broken` threshold crossed |
| `gone` | an alias dies (`die`) or is destroyed |
| `enter` | the taker enters a named area, or comes onto a map |
| `carry` | the taker's bag or hands change (the `held` / `in` relations) |
| `give` | the taker hands something to a person (`offered`) |
| `fact` | the story's props change |
| `quest` | a quest's stage or state changes |
| `step` | a step of the story plays |
| `deed`, `wanted`, `hungry`, `night` | the social world's: a theft witnessed by its victim (`social.ts`); a bounty raised; a hungry person who found no meal (`conduct.ts`); the evening |

Who sees the news:
- A quest under way sees what it listens for: what its next stages' and open objectives'
  triggers name. A `talk`, `kill`, `gone` or `give` must concern one of its aliases, or a class
  it counts.
- **The story** sees every kind any quest starts on. Its rule (`story/manager`) is the Story
  Manager:
  - it begins the `auto` quests whose trigger now holds;
  - on a radiant quest's news it rolls the chance, fills the aliases, and if they fill and the
    quest's `most` is not reached, makes the offer (state `offered`, the giver alias is the one
    who offers it, `deadline` hours to accept).

### 2.4 Talking (E)

A person spoken to runs their `quest` effect (the people's talk rule). In order:
1. **Hand-ins and talk objectives.** If a quest under way has a stage or objective whose `talk`
   trigger names them and the rest of its trigger holds now, the quest sees the `talk` news and the
   person says that stage's line.
2. **Offers.** If they have offers for the speaker (a side quest they give, a radiant favour), they
   say the offer. The talk panel lists **接受「…」** and **拒绝** for each offer.
3. **Topics.** If a quest under way has topics of theirs at its stage (`topics`: a label, a line,
   the stage it moves to), the panel lists them. These are Bethesda's quest dialogue topics.
4. **Waiting lines.** A quest of theirs under way: its `waiting` line.
5. **An ordinary line.**

Accepting:
- A side quest begins (state `active`, its first stage).
- A radiant offer becomes active.
- Declining withdraws a radiant offer. A side quest stays on offer.

### 2.5 The player's view

- **The journal (L)** has three tabs: under way, done, failed. Each quest shows:
  - its title, kind and giver;
  - its summary;
  - its open objectives with counts; done ones ticked, failed ones struck through;
  - its log, the stages' lines in the order they were reached.

  One quest is **tracked** (★). The latest main quest is tracked by default, and the player can
  choose another.
- **The tracker** at the top right shows the tracked quest's title and open objectives.
- **Markers**, for the tracked quest's open objectives' targets:
  - on the minimap and the world map;
  - for a target on this map but off the screen, an arrow at the screen's edge;
  - for one elsewhere, the map's name beside the objective.

  A target that is a person or a thing is marked where it is, and a named area of a map (the pond, the barrow's mouth)
  at its middle. A whole map (Brin's grassland) is marked at its middle only from elsewhere. Once one is on it, the
  marker moves to the nearest of what the objective counts felling there, while one still stands (the dead on the
  grassland). Otherwise there is no marker on it: its middle is no particular spot (`quests.ts` `targets`, `quarry`).

  The options turn markers and the tracker off.
- **Over heads**: a yellow **!** means an offer; a **?** means someone to speak to (a talk
  objective, or a hand-in ready now).
- **Lumi** (E on the companion) says the tracked quest's open objectives and its stage's hint. Her panel's road
  page shows the main quest under way and, beside it, her **guides** (kind `guide`, `quests/guides.ts`): the
  teaching quests she begins herself, each with her tip; a guide never takes the main quest's place as the one
  tracked by default.

### 2.6 Rules of thumb

- Scenes and rules never set a quest's stage themselves. They change the story's facts (or
  notify the quest), and the quest's triggers answer. A scene does not need to know which quest
  it belongs to.
- **Essential** is data:
  - a person record may carry `essential` (someone the story's scenes need);
  - a quest's aliases flag the rest while it runs;
  - the demo test checks that everyone who speaks in a scene is essential by their record.
- Radiant quests are generic kinds of favour, never another game's content: recover what was
  stolen, bring a meal, deliver a parcel, clear the night-born.

## 3. The quests (the demo)

| id | kind | begins | stages (abridged) |
|---|---|---|---|
| `awakening` 醒来 | main | auto, in the clearing | eat, gather, axe, planks, fire, house, the night, the morning; the tutorial's lessons on its stages |
| `descent` 下山 | main | auto, on Cloudtop / the foot (or when `awakening` is done) | the shrine stone; something the world never saw; down to the Ford; west to the village |
| `rescue` 古墓里的失踪者 | main | auto, at the village's welcome | the barrow mouth; Lina, Oskar, the warden; back to Rowan |
| `vigil` 守夜之备 | main | auto, once `rescue` is done | oil, dawnbloom, the bell; to Ilse |
| `first_seal` 第一印 | main | auto, once `vigil` is done | the night of thanks; the letter; the pilgrim's road and the river; the White Knight |
| `crown_home` 荆棘冠 | main | auto, the knight down | bring the Crown home |
| `dragon_road` 屠龙之路 | main | auto, `crown_home` done | to Emberfall; Mara; arm (ore, coal, fireweed, frostcap, blade, draught); the pass; the dragon |
| `pilgrim`, `stew`, `ring`, `thorns`, `drawings`, `measure`, `templar`, `nail`, `watch`, `herd`, `scallop`, `band` | side | offered | as before, each now with stages and a log (the Held Ground's widening errands `haven1–3` were removed 2026-10-11: the ground grows from its steward's panel, docs/homestead.md) |
| `firewood` | favor (daily) | offered | four logs a day for Gus |
| `recover` 失物 | favor (radiant) | news `deed`: a theft its victim saw and did not get back | get the thing back (from the thief, by talk, or however) and bring it to its owner |
| `meal` 一口吃的 | favor (radiant) | news `hungry`: one who found no meal | bring them something to eat (G) |
| `parcel` 捎个东西 | favor (radiant) | news `morning`, a household's errand | carry a parcel to someone of another household |
| `cull` 清剿夜行者 | favor (radiant) | news `night`, from one who keeps the watch | put down night-born near the village |
| `guide_skill` 第一个技能点 | guide | auto, the beat `guide_skill` (a skill point unspent, in a game proper) | learn a skill (the beat `guide_skill_learned`) |
| `guide_profession` 选一条路 | guide | auto, the beat `guide_profession` (level 5, no profession) | a word with Bram; a profession chosen (the beat `guide_profession_chosen`) |
| `guide_fish` 第一竿 | guide | auto, entering `meadow:pond` | a rod carried; a fish carried; bait paid |
| `guide_farm` 菜圃的一课 | guide | auto, entering `meadow:garden` | the hoe, the sickle and seeds from the crate; a vegetable carried, a crop on the bare row (the beat `guide_sowed`), a crop watered near (`guide_watered`) |

**The guides** (2026-10-13) are Lumi's own: a beat of the story notices the moment (`StepCond`: the leader's
props, a skill learned, a crop on cells, a status near) and the quest answers it as the main line answers steps;
her lines are the stages' `say`, `by: 'pip'`, and her panel lists them beside the main road. Their beats come last
among the story's steps (one step plays at a poll: a lesson never delays the story's own moment). Their regions
(`meadow:pond`, `meadow:garden`) are the map's (`FIRSTLIGHT.regions`), witnessed by the demo test (W20).

The notice board in Firstlight Village (E) lists the radiant favours on offer, and accepts them.

## 4. Where it lives

- engine: `quests.ts`:
  - the instances;
  - aliases and how they fill;
  - triggers to conditions;
  - news and who sees it;
  - the Story Manager's starts and offers;
  - stages, objectives, rewards, failure and deadlines;
  - talk business and topics;
  - the journal, marks, targets and tracking;
  - essential and kept as derived tags.

  Elsewhere in the engine:
  - primitives in `effects.ts`: `quest`, `startQuest`, `stage`, `advance`, `begin`, `accept`, `decline`, `failQuest`;
  - the `quest` step condition and the `stage` scene command in `story.ts`;
  - the news hooks in `engine.ts`;
  - the derived tags in `world.ts`;
  - the journal, tracker and targets in `snapshot.ts`.
- content:
  - `quests/*.ts`: the definitions (`guides.ts` the companion's guides and the beats they wait on);
  - the quest rules in `rules.ts`: `quest/news`, `quest/notify`, `quest/due`, `story/manager`;
  - the notice board.
- client:
  - the journal (`ui/questlog.ts`);
  - the tracker and the marks (`hud.ts`);
  - markers on the minimap and the world map (`worldmap.ts`);
  - edge arrows (`render/scene.ts`);
  - offers and topics in the talk panel;
  - options for markers and the tracker.

## Peaceful and combat zones (`engine/src/appear.ts`)

Every map is a combat zone unless it is marked peaceful (`MapData.zone`). The peaceful ones are
the Ford's camp, Firstlight Village, Emberfall and the mountaintop.

At night (21:00–05:00), in a combat zone under the open sky:
- zombies and bats come out 6–10 tiles from the player, every 6 seconds, up to 4 at a time;
- at dawn they crumble a few at a time.

The minimap shows the zone. This is the world's own behaviour: one of its appearances
(`Ontology.appear`) makes them appear on its `appear` period, and their own rule on the `dawn`
period crumbles them.
