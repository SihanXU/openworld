# Tutorial lessons: spotlight one thing, draw its key, lock the rest

## What is wanted

The tutorial currently teaches through long lines from the companion, Pip, and the player may do anything at any time. It should instead teach by the deed, through short **lessons**. Each stage of the tutorial holds an ordered list of lessons. Each lesson teaches one thing and has:

- one short line from Pip;
- a focus to spotlight: a thing, a terrain cell near a spot, the player, a spot, an outline of cells, or a part of a panel;
- the key to press, drawn over the focus;
- optionally a lock: while the lesson lasts, only what it teaches works;
- the world state that ends it.

The story tracks which lesson is at hand and marks each one done. The player can skip the lesson at hand (Esc held). The player-input layer enforces the locks. The world also gets a training dummy beside where the house goes, which the blow lesson uses.

## Expected behaviour

**Lesson order and progress**
- The lesson at hand is the first lesson of the leader's current stage not yet marked done. It is absent while a scene plays, when the stage has no lessons, when all of its lessons are done, and in a game without the tutorial.
- A lesson begins (Pip says its line) only after Pip's last story line has been read. Allow a short delay, about 30 ticks.
- A lesson ends when its done-state holds. The story records it as done and the view is told. Skipping the lesson at hand marks it done the same way, and whatever it locked works again.
- Stage-ending beats keep their behaviour but their lines become short (the tutorial no longer explains keys in the beat lines). Stage hints stay for E on Pip.

**Stage 1 (stage numbers match the tutorial's stages)**
1. `move`: WASD, only moving works. Done when the player stands on the spot (15,12).
2. `take`: F on the berries. Moving and taking work. Done when berries are carried.
3. `hold`: choose the berries' toolbar slot. Done when the berries are in hand.
4. `eat`: right click on yourself. Done when the story's meal count is at least 1.

**Stage 2**
- `bag`: opening the bag (I). Done when the story has noted the bag was opened. Only moving and the bag work.
- `stick`, `stone`, `grass`: F on each. Done when carried. No lock.

**Stage 3**
- `craft`: C opens crafting. Only the stone axe can be made. Done when the axe is carried.

**Stage 4**
- `hold-axe`: put the axe in hand (select only).
- `chop`: a tree of the east grove, near (27,12), not the nearest to the player. Left click; select, use and move work. Done when a log is carried.
- `split`: C, making only planks. Done when a plank is carried.

**Stage 5**
- `campfire`: B, only the campfire may be set down. Taking still works so the player can gather for it. Done when a campfire stands within 12 of the player.
- `torch`: make a torch. No lock.
- `light`: left click the fire. Done when a lit campfire is within 12.

**Stage 6**
- `wall`: B, wall only, and only on the outlined cells (20,11), (19,12), (21,12). Moving, building, setting down, selecting, crafting, using and taking work. Done when walls stand on all of those cells.
- `door`: a door within 10, with the door cell (20,13) spotlit.
- `bed`: a bed within 10, with the bed cell (20,12) spotlit.
- `ceiling`: choose the floor in B and R turns it into the ceiling. Done when a bedroom room exists.

**Stage 7**
- `chooser`: long-press E on the bed. Done when the story has noted that the chooser was used.
- `dummy`: left click the dummy until it topples. Only moving, selecting and using work. Done when the story has counted a dummy toppled.
- `shut`: E on the door. Done when a shut door, of exactly that type, is within 10 (an open door does not count).
- `sleep`: E on the bed. Done when the player is asleep.

**Stage 8 (`TUTORIAL_DONE`)**
- `map`: M. Done when the story has noted the map was opened.

**Locks, in the player-input layer**
- Every input is asked whether it is allowed. The inputs are: moving, take, put, use, self, hands, select (toolbar), craft, build, rotate, bag, map and chooser. Moving, the toolbar, crafting, building and setting down are all gated, and so is the attack key.
- A lesson with no allow list allows everything. With one, anything not listed does nothing.
- For making, building and setting down, a lesson with `only` also restricts which type may be made or set down. If it also names cells, the type can only be set down on those cells.
- A refused input is shown once per short interval, not on every tick a key is held. The key shakes and Pip repeats the lesson.
- A lock never keeps the player from what the lesson itself needs. A question already asked passed the gate when it was asked, and answering it is not re-gated. In the build palette, making a thing on the spot in order to set it down is allowed whenever setting it down is allowed.
- Which actor the keys move is not asked.

**Training dummy**
- A training dummy stands at (23,13) in the tutorial map. It is solid, has 12 health, and is made of wood.
- When it is knocked down (health gone) it stands up again at full health instead of being removed. It makes a puff effect and a log line. The story is notified, and the tutorial's dummy count goes up by 1.

**Skipping and the view**
- The frame carries the lesson at hand: its id, key, allow list, only list, focus, its index within its stage, and the number of lessons in the stage.
- The focus is resolved to:
  - the nearest entity of the type on the player's map, filtered by status if one is named;
  - the player;
  - the nearest terrain cell, measured from the given `from` point if there is one, otherwise from the player;
  - a spot;
  - the outline cells;
  - a panel part.
- Skipping the first lesson (`move`) marks it done and makes `take` the lesson at hand. The view for `take` shows key F, allow `['move','take']`, index 1, and its focus is the nearest berries.

## Requirements

- Each stage's lessons are as specified above, in order, and are reachable from the stage's objective.
- The lesson at hand, and which lessons are done, are kept in the story. The story provides a way to skip the lesson at hand and a way to be told a panel was opened or the chooser used.
- The new done-conditions work:
  - holding something of a type;
  - standing within a radius of a spot;
  - at least N things of a type on given cells;
  - `near` with an `exact` flag that matches the exact type only.
- Blocked inputs do nothing and emit the refusal effect. Done lessons are announced with an effect that names the lesson.
- Moving, taking, using, selecting, crafting, building and setting down all honour the locks.
- The dummy rule fires only for dummies, and the full tutorial can be played through using the player's own inputs, with each lesson reaching done in order.
- A game without the tutorial has no lessons and allows all inputs.

## Interface

All names below are exported from the engine and content packages as listed.

**`@lsw/engine`**
- `type LessonInput = 'move' | 'hands' | 'take' | 'put' | 'use' | 'self' | 'select' | 'craft' | 'build' | 'rotate' | 'bag' | 'map' | 'chooser'`
- `interface Lesson { id: string; say?: Text; key?: string; focus?: { type?: string; status?: string; terrain?: string; from?: [number, number]; self?: boolean; spot?: [number, number]; cells?: [number, number][]; ui?: string }; allow?: LessonInput[]; only?: string[]; cells?: [number, number][]; done: StepCond }`
- `StepCond` gains `holding?: string`, `spot?: { x: number; y: number; r?: number }` (r defaults to 1) and `on?: { type: string; cells: [number, number][]; count?: number }` (count defaults to 1); `near` gains `exact?: boolean`.
- `FxEvent` gains `{ t: 'lesson'; done?: string; blocked?: LessonInput }`.
- `Story.lesson(): { def: Lesson; index: number; total: number } | undefined`
- `Story.skipLesson(): void`
- `Story.ui(what: string): void` — the story notes `ui.<what>`.
- `Controls.allows(input: LessonInput, what?: { type?: string; at?: { x: number; y: number } }): boolean`
- `Frame.lesson?: LessonView`, and `interface LessonView { id: string; key?: string; allow?: LessonInput[]; only?: string[]; focus?: { id?: string; tile?: [number, number]; cells?: [number, number][]; ui?: string }; index: number; total: number }`
- `Objective.lessons?: Lesson[]` on the content side. Guide stages also accept `lessons`.

**`@lsw/content`**
- `TUTORIAL_LESSONS: Record<number, Lesson[]>` — the lessons by stage.
- `TUTORIAL_HOUSE = { bed: [20, 12], walls: [[20, 11], [19, 12], [21, 12]], door: [20, 13] }` (readonly).
- `TUTORIAL_DUMMY = [23, 13]` (readonly).
- Rule `train/dummy` on the `fixture/dummy` type. The tutorial map places a `fixture/dummy` at `TUTORIAL_DUMMY`.
