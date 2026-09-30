# Large Symbolic World

A web-playable 2D JRPG world at large scale whose rules are code. An LLM acts as a live
modder: when an interaction is undefined, it writes a type-level rule patch that the engine
validates, applies, and keeps. When interactions are defined, the game runs on its own.

Successor to BardOS. Design: [docs/design.md](docs/design.md).

## The world (generated, deterministic)

Saenvar, six regions: 460 maps (49 exterior + 411 interiors), ~2,400 NPCs on daily schedules,
~670 creatures, ~27,700 items (~1,000 distinct kinds), ~6,900 fixtures — ~37,700 entities.
All maps loaded into one engine: ~0.3 s to load, ~0.5 ms per simulation tick with 200 NPCs
on the active map (`packages/tools/src/stress.ts`).

## Run

```bash
npm install
npm run gen:world   # writes packages/client/public/world/
npm run dev         # http://localhost:5173
npm run build       # static site in packages/client/dist (~12 MB, deploy anywhere)
```

Controls: WASD/arrows move · **F** take · **G** put · **E** interact (with the held item) ·
**U** use on yourself · **Space** attack/cast · **1–9** hold an item · **Q** stow ·
**`** Mod Console · **L** language · **H** help.

## Status

Phase 1 (game infra) — engine, base rules (object interactions, elemental reactions, fire,
combat), NPC schedules, 460-map world, web client, and the Mod port (undefined interaction →
request + ModSpec → patch → validation → shared rule library), exercised by hand from the
Mod Console. The LLM modder is not wired in yet.

```bash
npm test                                  # engine + rules + Mod port + coverage
npm run coverage                          # interaction coverage (roadmap §1)
npx tsx packages/tools/src/stress.ts 6    # all maps loaded, 6 game-hours simulated
```
