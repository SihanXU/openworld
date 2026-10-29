# Music and ambience

Status: **built 2026-10-25** (route A of the plan the user approved that day: the pack's music re-cast, a music
system that follows the game's state, an ambience made as it plays; route C, a soundtrack of our own, is being sampled
apart — §6). The runtime's side is `packages/runtime/src/audio/`; OpenWorld's table is `games/openworld/client/src/catalog.ts`
`music` with `loudness.json`.

## 1. Why

The pack's music is cheerful 8-bit made for another game. Each map played one short loop for ever, as loud as the
file happened to be (the pack's pieces span 14 dB), the same by day and by night, in a fight and out of it. Our
setting is a dark fairy tale of suffering and lengthening nights. The plan, from how other games pair their music:

| Game | What it does | What we took |
|---|---|---|
| Zelda: Breath of the Wild | the wilds almost silent, a few piano phrases; towns full themes, day and night versions | rests in the wilds; versions by the hour |
| Stardew Valley | a few pieces each morning, then the ambience; rain its own; quiet nights | the day has a rhythm |
| Minecraft (C418) | pieces minutes apart, silence between | the rests |
| Hollow Knight | a theme per area over its ambience; boss music by phase | areas, phases |
| Blasphemous | sacred chant, drones, strings for a religion of suffering | the palette of the soundtrack to come (§6) |
| Skyrim | music by kind (explore, town, dungeon, combat), combat on top, a sting out | the director's order |
| Elden Ring | field silence; boss's second phase its own piece | silence before the knight, his second phase |
| Octopath Traveler | a night version is the day's with fewer instruments | the versions |

## 2. The director (`audio/music.ts`)

One director decides what plays, first to last:

1. **the title**: its own cue (`title`) while the cover is up, whatever place shows behind it;
2. **a scene's music**: a scene's `music` command (engine `SceneCmd`, `story.ts`), a cue or `''` for silence, until the
   scene ends (`Frame.scene.music`);
3. **a boss fight**: while the camera holds over the arena, `boss:<kind>:<phase>`, `boss:<kind>`, `boss` (the kind's last
   segment also: `boss:alberic:2`);
4. **a fight**: `battle` (its `night` version by night) from the frame's `player.fighting` (the engine's `fightTick`,
   FIGHT_TICKS) and held 7 s past it, faded in in 0.6 s, out in 3 s;
5. **the place**: the map's mood (`MapData.music`; a map naming none: `outdoor`, `indoor`, `dark` by its light) in the
   version for the moment.

The place's piece is **held** while anything plays over it and taken up again where it was. A change of the hour or
the weather **waits for the end of the piece playing** (a one-piece loop changes at once); a change of map crossfades.
Death silences it all. The moment is the frame's: the hour and `night.dusk/dawn`, which move as the story's night
lengthens, so dusk music comes earlier as the seals fall.

**Cues** (`assets/types.ts` `MusicCue`): pieces (`tracks`, played in a shuffled round never repeating one), `rest`
(silence between pieces, `[least, most]` seconds: the wilds), `volume`, `like` (the same as another cue), `at` (the
versions: `dawn`, `day`, `dusk`, `night`, `rain`, `storm`, `snow`, `fog`; the weather's first). A plain string is a cue of
one piece, as before. `audio/cues.ts` resolves them (pure, used by the tests).

**Loudness**: every file's integrated loudness is measured (`npm run loudness`, ffmpeg EBU R128 → `loudness.json`) and
every piece is played at −16 LUFS (boosted by at most 9 dB). Pieces stream through `<audio>` elements into the music
bus, so nothing long is decoded into memory. A page not yet touched starts them on the first touch.

## 3. The ambience (`audio/ambience.ts`)

Made as it plays, WebAudio, no files: the **wind** (brown noise through a wandering band; keener over snow and in a
storm; a thin whistle on cold heights), the **rain** (hiss and drops; muffled under a roof), **running water** by how
much is near the middle of the view, a **fire's** roar and crackles by its nearness (indoors too: a hearth), **birds** by
day (four kinds of song, more at morning), **crickets** by night where it is not cold or wet, now and then an **owl**,
in the dark a **hum** and **drips** that ring, a **room's** quiet indoors, **thunder** rolling in after a strike's flash.
The scene tells it each second what is near (`render/scene.ts` `hearFrame`: terrain tagged `water` and `cold` within 7
cells, the nearest thing `lit` or `burning`).

## 4. Levels (`audio/soundscape.ts`)

Two buses, music and ambience, at the player's levels (Options and the title's settings: Music, Ambience; 0.8 by
default), into the sound manager's own way out, so its mute holds. A jingle (a level gained, a quest done, a seal's
power taken up) ducks the music under it. Measured from the game's own output (2026-10-25, defaults, RMS): music
−26.7 dB; the ambience by the title's fire −34.9, a day's or a night's bed −42, rain −36.6, a storm −32.7, a river −38.2,
a fire up close −35.5, a cave −41.8 — the ambience sits under the music, louder only where the world is (a storm).

## 5. OpenWorld's table

Firstlight's outdoor daytime cue (`firstlight`) uses the user-selected `车水马龙.wav`, encoded as
`public/assets/lsw/Audio/Musics/che-shui-ma-long.ogg` (Vorbis quality 6, 44.1 kHz stereo, about 92 seconds).
It keeps the village's 15–40 second rests and its existing dusk, night and rain cues. The Held Ground (`haven`)
uses the same theme throughout the day and weather, with a fixed five-second rest after each play. Firstlight's
general store also uses `firstlight`: entering or leaving keeps the current piece and its position (or its rest),
including the square's dusk, night and rain versions. Music uses the world's weather indoors too; the ambience
still follows the roof. Other towns and interiors keep their existing tables. The dragon uses `战斗爽.wav`,
encoded as `public/assets/lsw/Audio/Musics/battle-thrill.ogg` (about 61.5 seconds), looping without a rest;
ordinary fights and the White Knight keep their music. Rebuild the world after changing a map's cue; loaded saves fetch
the map data again, so the new cue also applies to existing characters.

Moods: `cloudtop`, `field` (dawn, dusk, night, rain versions), `village` (dusk by the fire, an almost silent night,
rain), `millbrook`, `river` (the Reed Bend), `ford`, `forest` / `dark_forest`, `hollow`, `dell`, `ruins`, `kneelfield`,
`interior` (and its night), `shop`, `temple`, `cave`, `crypt` (the barrow, its crypts), `dungeon`, `worldmap`, `haven`.
The scenes': `severin` (the night of the flame, the grey man at the crown), `revelation` (the letter), `sorrow` (the
knight's death), `ending` (Part One's card, Chapter One's, the dragon's), `credits`; silence as one steps into the
knight's ring. `games/openworld/tools/test/music.test.ts` holds every map to a cue at every hour and weather, every cue
the runtime and the scenes ask for to the table, every file to the assets and a measured loudness.

## 6. A soundtrack of our own (route C)

The pack stays a stand-in. The direction: a small acoustic ensemble (string quartet, piano, guitar or lute, recorder,
accordion, harp, wordless choir, organ, bells), with motifs — *Firstlight* (warm, rising: title, village, campfire,
endings), *the Five Sufferings* (five descending notes, Phrygian: chapels, shrines, the Seal-bearers), *Lumi* (harp or
celesta), *the grey man* (cold, dissonant). Samples of ten core cues are made with an open model (ACE-Step) on
lmmslab-03 for the user to judge; the table takes them as they are chosen (`npm run loudness` measures them).
