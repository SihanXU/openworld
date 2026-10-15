# Chapter 1 before the White Knight: Cloudtop start, a codex of what has been met, and an isolated boss-clip preview

## What is wanted

Several linked changes to the game, its content and its client:

1. **Chapter 1 story and content.** The first chapter plays out on the "five sufferings" lore, from the barrow's rescue to the White Knight. After the barrow quest is done the quest stage is 0.5, and that night the village gives thanks at the flame. The grey man (Severin) then takes the Firstlight and goes offstage (stage 0.6). At dawn the Church's courier brings a proclamation letter and leaves again (stage 0.7). Sister Ilse sends the player on the pilgrim's road (Fennick, Joss, Hesper), after which the quest stage is 1. Past the far bank, the road east leads into the knight's kingdom of thorns, where the White Knight (Alberic) is a softer version of his Boss Challenge self. The road to Emberfall stays shut while he stands. After he falls, the Crown of Thorns and the fairy's first power follow, then the grey man again, a longer night, and the return home.
2. **A new game starts on Cloudtop** (map `summit`), not at the foot of the mountain. The cut there leads down to the Mountain Foot, and the foot's north edge no longer drops the player onto the overworld. Pip's "the world answers" beat waits for the seal stone. Waypoints exist for the places along the way.
3. **The tutorial is its own mode**, started from the title. It writes no save, and walking out of the tutorial map returns to the title. The new-game panel no longer offers a tutorial/skip choice.
4. **A codex** replaces the journal's content. It lists every item kind, every person and every creature kind with a place in the story. Things carried or seen near are marked as known, and this is saved with the game. The Threadbook is its last page.
5. **Bottom-right buttons**: quests, build, bag, skills in one row, then codex, craft, options, with at most four to a row. The bag, craft and options panels lose their tabs, and the clock's `!` and `☰` buttons are removed.
6. **Boss Studio preview.** An isolated boss action clip plays on the render clock at its own frame rate. It is not driven by combat snapshots or repeated re-rendering.
7. **The night length is story-driven.** Dusk and dawn used by the renderer follow the frame's night values.

## Expected behaviour

### Codex (engine)
- For a freshly created game, the codex view has three lists: `items`, `people`, `creatures`.
  - `items` holds every concrete item kind (more than 100), including `item/food/berries`.
  - `people` holds exactly the world's companions followed by its NPCs, in that order, by id.
  - `creatures` holds creature kinds that have a place in the story. `actor/creature/sin/alberic` is in; `actor/creature/sin/pride` is not.
  - Nothing is known at the start for items and creatures.
- After the player carries `item/food/berries`, a green slime stands two tiles away, and a bat stands fifteen tiles away, recording the codex marks as known: the berries, the green slime, and the person Pip (the companion near the player). The far bat is not known.
- The codex survives a save and load: a loaded game's codex serialises equal to the saved game's.

### Boss Studio preview (client scene)
- After a preview mode is selected for a boss entity, the scene renders that action's clip from the first pose. It uses the render clock, ignoring any combat animation clock and any stale sample. It advances one clip frame per 50 ms and then holds or loops. A death clip holds its last frame (31).
- The preview works for every facing and keeps its timeline when the facing changes.
- Choosing the same mode again restarts it.
- The preview does not mutate the entity snapshot, and does not read the combat animation clock.
- Choosing `live` goes back to what the encounter shows.

### Story and start
- A new game begins on `summit` at the spawn point with the foot-of-mountain prologue stage. The player walks down through the cut to `foot`.
- The road to Emberfall refuses crossing until Alberic is defeated and the crown scene has been seen.
- Crossing the far bank no longer ends the story with a card.

## Requirements

- Add a codex to the engine game object. It provides `view`, `record` and `toJSON`, and its state is part of the save and is restored on load.
- The codex frame/worker protocol carries a codex version with each frame, so the client knows when to re-request the codex. A separate `codex` request returns the full view.
- Entries have an id, a display name, a known flag, and optional group, sprite, look, type, stats and where.
- The client draws the same character look for a person in the world and in the codex.
- The frame carries `night` with `dusk` and `dawn` (default 21 and 5). The renderer's darkness follows them.
- The boss preview plays only on the scene's render timeline.
- The tutorial run is separate: no slot, no save, and back to the title when the map changes away from `tutorial`.
- Hud send hooks: remove `openMenu`, add `toggleCraft` and `toggleOptions`.
- Catalog art is added for the new fixtures (chalk stone, door, bridge, man; briar), the new items (crown of thorns, warm ember, ninth nail) and the three new corner buttons (journal, craft, options).
- The existing Chapter 1 and demo scenarios described above hold: the village welcome fact `seen.village_arrival`, the stage 0.5 after the rescue, the offstage map, and the five waypoints `wp.eastroad`, `wp.foot`, `wp.ford`, `wp.summit`, `wp.village`.

## Interface

- `Game.codex` (engine), an object with:
  - `view(world: World, index: WorldIndex): CodexView`
  - `record(world: World): void`
  - `toJSON(): unknown`
- `CodexView` (exported from `@lsw/engine`): `{ items: CodexEntry[]; people: CodexEntry[]; creatures: CodexEntry[] }`
- `CodexEntry` (exported from `@lsw/engine`): `{ id: string; name: Text; known: boolean; group?: string; sprite?: string; look?: string; type?: string; stats?: { hp: number; atk: number; def: number }; where?: Text }`
- `WorldScene.setBossPreview(id: string, mode: BossPreviewMode): void` in `packages/client/src/render/scene.ts`. A mode of `'live'` clears the preview.
- `personLook(id: string, type: string, look?: string): string` in `packages/client/src/assets/looks.ts`.
- Protocol: `ToWorker` gains `{ t: 'codex' }`. `FromWorker` gains `{ t: 'codex'; codex: CodexView }`, and the `frame` message gains `codex: number`.
- `Frame.night?: { dusk: number; dawn: number }` (engine).
- `CoverHandlers.tutorial(): void` in `packages/client/src/ui/cover.ts`.
- `HudSend.toggleCraft(): void` and `HudSend.toggleOptions(): void`; `HudSend.openMenu` is removed.
- Content exports used by tests: `DRAWINGS`, `ALBERIC_ID`, `BOSS_BY_ID`, `OBJECTIVES` (with stage 0.5 defined), from `@lsw/content`.
- Catalog keys: `fixture:chalk_stone`, `fixture:chalk_door`, `fixture:chalk_bridge`, `fixture:chalk_man`, `fixture:briar`, `item:crown_of_thorns`, `item:warm_ember`, `item:ninth_nail`, and ui `cornerJournal`, `cornerCraft`, `cornerOptions`.
