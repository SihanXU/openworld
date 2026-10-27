# Boss rooms

Status: **agreed 2026-10-27** (the user's word: "我们现在要给boss加一个单独的boss房，boss的场景单独设计，然后进入方式和类魂一样，
有雾墙挡着"; the five decisions below, all as proposed). The White Knight's is built first (§4.1), then the Warden's and Prior
Wendel's (§4.2–4.3); Part Two's come with it.

Why: the White Knight stood in the middle of the East Road, on the same map as the burned farm, Edda's barn, the wolves and
whoever walked by; the people went on with their day while he fought, and his thorns grew across the road. Prior Wendel
waited in the same vault as the crypt's skeletons. A boss's fight is a scene of its own and is drawn as one.

## 1. The decisions

1. **Once through the fog, the fight is to the end.** The fog seals behind one; it parts again only when the boss falls,
   or when one falls and rises outside.
2. **Falling there drops one's bundle** as anywhere (`body/rise`): what one carried lies in the arena, to be fetched.
3. **Every boss has an arena map of its own**, designed for the fight: no residents, no one's schedule passes through,
   its own ground, light and music.
4. **The White Knight bars the road east**: past the burned farm a hedge of his thorns closes the East Road from edge to
   edge; its one gate is his fog, his arena lies behind it, and the road goes on east only out of the arena's far side.
5. **A stake at the fog is where one rises**: putting a hand on the fog makes it one's home (the Stake of Marika's
   lesson), so a fallen run-back is short.

## 2. The flow (learned from Dark Souls' fog gates, Elden Ring's stakes and its graces in a felled boss's arena)

1. **Before the fog**: an approach drawn for it — a gate in the thorns, an arch, the top of a stair — and in its gap a
   wall of gold-white fog.
2. **Through**: a hand on the fog (E) takes one through into the arena (the fog's `interior`, as a tent's room is
   entered), and makes the fog one's home.
3. **Inside**: the fog one came through stands sealed behind one, and the arena's other ways too. The first time, the
   boss's own scene plays (the knight's "None cross that do not kneel"); his health plate and his music come with the
   fight, as they did.
4. **Falling**: one rises at the fog outside (its stake), one's bundle left in the arena; as one goes the boss is told
   the one it fought has fallen, and is whole again — its health, its phase, its place — when one comes back.
5. **The boss falls**: every fog of its arena lifts (it looks, now and then, whether the story knows its fall). The arena
   stays, open, quiet; what the story does after the fight happens there (the Crown's scene).

The people are never in it: an arena has no residents and no schedule leads into it, a fog is only passed by a hand on
it (the people never handle one), and the story sets its own on the stage by its scene commands. Lumi follows her
leader through, as she follows across every way.

## 3. How it is built (inside the event model)

- **The fog** (`fixture/fog`, content ontology): solid, opaque, drawn as a bank of moving gold-white mist. Its props:
  `boss` (the boss whose room it closes), `interior`/`interiorX`/`interiorY` on an outer fog (where it leads). Its rules
  (content `bossrooms.ts`):
  - `fog/enter`: a hand on an outer fog: the hand's owner is pushed through (`push`, as `tent/enter`) and told it is
    their home now (`notify`, `what: 'home'`, `body/rise`).
  - `fog/sealed`: a hand on an inner fog while its boss stands: it does not part, and says so.
  - `fog/holds`: anything else done to a fog — a blow, a fire, something put to it or used on it — passes through mist:
    defined, nothing changes. No hole is left on a fog for a model to answer, so nothing opens a boss's room but its door.
  - `fog/lifts`: now and then (its period) a fog looks whether the story knows its boss fallen (`sins.defeated.<id>`,
    `BOSS_ROOMS`); if so it lifts (`poof`, `destroy`).
- **Nothing breaks in** (the user's word of 2026-10-27: the world's trees and walls can be felled and broken, so a room
  must not be got into round its fog): an arena is a map of its own with no cell on the world map, so felling its woods
  or walking off its edge leads nowhere, and its only ways in are the portals under its fogs; the knight's hedge across
  the East Road is a terrain of its own, `thornhedge` (solid, no health, not flammable: no blade, fire or tool opens it).
  The same day bushes became something one walks through, as tall grass (`bush` is no longer solid).
- **The ways under the fogs** are ordinary portals: an outer fog stands on the portal into its arena, the inner fogs on
  the arena's portals out; a fog standing on a portal keeps everyone off it, and once it has lifted the portal is walked
  onto as any door. Neither is at a map's edge, so an arena takes no cell of the world map (the continent is unchanged).
- **The boss made whole**: one who rises at home tells the bosses on the map they fell on (`body/rise` emits `notify`,
  `what: 'foe-fell'`, filtered to the tag `boss`); a boss answers with the kits module's new primitive `rally` — its
  health whole, its encounter's memory begun again, home. A rule, an impulse and the host writing only itself: a fight
  is reset the way everything else changes. (A boss on a map one has left hears it when the map wakes.)
- **Rising where one fell** (the death screen's other choice, Easy's) is not a fall that resets: the fight goes on.

## 4. The rooms

### 4.1 The White Knight: the Kingdom (`kingdom`)

- **The East Road**: past the burned farm, the knight's hedge — a wall of his thorns (`thornhedge`) — crosses the map
  from its north edge to its south; its gate on the road is his fog, the waypoint statue (`wp.eastroad`)
  before it. East of the hedge the road goes on to its edge and Emberfall (Part Two's), reached only out of the arena.
- **The arena**: his field ringed by thorns, the kneeling stones of those who would not kneel standing in rings, his
  mended pennants on lance-shafts, a ruined shrine where he keeps his post; open ground enough for a body three cells wide
  and his rings and lines. In at its west, out at its east (a thorn arch to the East Road beyond the hedge). The ninth
  nail, the wedding band and the gauntlets of his host lie in it.
- **The story**: `kingdom` plays on coming in; `crown` plays there once he falls; the grey man comes and goes there.

### 4.2 The Warden: the sanctum (`sanctum`)

The barrow's octagonal arena is already a map of its own; its stair in from the ossuary gets a fog.

### 4.3 Prior Wendel: the priors' tomb

The tomb at the crypt's head walled off from the vault and made a room of its own behind a fog in its arch; the vault
before it keeps the crypt's skeletons.

### 4.4 Part Two

The cyclops's deep chamber in the old mine and the dragon's lair, the same way.

## 5. Checks

- Each boss's room: through the fog one is in, sealed; the boss falls and every fog of it lifts; falling there one rises
  at its fog, the boss whole again; no resident's schedule reaches it.
- The release's reach (`release.test.ts`): Emberfall only through the knight's arena (and only with Part Two open).
- The demo's requirements that walked to the knight walk through his fog.
