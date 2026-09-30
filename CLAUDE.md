# CLAUDE.md — Large Symbolic World

A web-playable 2D JRPG world whose state and rules are code; an LLM modder (later)
patches undefined interactions at runtime. Successor to BardOS (`C:\Users\chica\文字游戏`).
Design: [docs/design.md](docs/design.md). Paper draft lives in Notion ("Large Symbolic World").

## Working agreements

- Converse with the user in Chinese; write code, comments and docs in English.
- Aim every step at the final deliverable at full scale (dozens+ maps, thousands of NPCs,
  tens of thousands of items, a public web demo). No shrunken "MVP first" plans.
- The subject is the WORLD (vs neural world models), not agents. NPCs are content.
- Commit/push only when asked. End commit messages with the Co-Authored-By line.

## Architecture (strict dependency direction)

```
client (Phaser 4 + DOM HUD)  →  engine (pure TS, in a Web Worker)  →  Mod port  →  [later] modder service
```

- `packages/engine` — pure, deterministic, no DOM/AI. World state + indices (`world.ts`),
  rule matching/specificity/library (`rules.ts`), effect primitives (`effects.ts`), event
  dispatch + tick + movement + combat (`engine.ts`), NPC two-fidelity sim (`npc.ts`),
  creatures (`creatures.ts`), Mod port: ModSpec / ModRequest / validatePatch / records
  (`mod.ts`), sandbox replay (`sandbox.ts`), snapshots for rendering (`snapshot.ts`),
  new game / save (`game.ts`).
- `packages/content` — ontology (terrains, statuses, elements, types), item catalogue
  (forms × materials × qualities × elements), the BASE RULE LIBRARY (`rules.ts`), chunk codec.
- `packages/tools` — `genWorld.ts` (Saenvar at full scale → `packages/client/public/world/`),
  `stress.ts` (loads every map, simulates, checks invariants), `coverage.ts` (every item form ×
  every target × every verb through the rule library; the numbers in `docs/roadmap.md` §1).
- `packages/client` — `worker.ts` runs the engine at 10 ticks/s; `scene.ts` renders
  snapshots; `hud.ts` HUD + Mod Console (the human-operated Mod port); `art/` procedural
  pixel art (no image assets).

## Rules of thumb

- New behaviour = a rule (data) in `content/src/rules.ts` or a patch. New primitive,
  condition or event kind = an engine change (and add it to the ModSpec docs in `effects.ts`/`mod.ts`).
- Rules address classes (types/tags/statuses), never instances, unless unavoidable.
- Specificity decides which rule fires: (instance-bound, type depth, constraint count, priority).
  Base rules must not tie at equal specificity on overlapping patterns — the validator checks it.
- Only player interactions can be *undefined*; hits/ticks/status events simply have no effect
  when unmatched.
- Only the player steps onto portals; NPCs transfer from the adjacent tile.
- After changing rules, run `npm run coverage`, commit the refreshed baseline with them and
  update `docs/roadmap.md` §1. The coverage test fails if any form or target loses an answer
  or a purpose.

## Commands

```bash
npm install
npm run gen:world        # regenerate the world files (deterministic seed)
npm run dev              # client at http://localhost:5173
npm test                 # vitest (engine + base rules + Mod port)
npm run typecheck
npm run coverage         # interaction coverage (roadmap §1) + refresh its test baseline
npx tsx packages/tools/src/stress.ts 6   # full-scale stress run (6 game-hours)
npm run build            # gen:world + static build → packages/client/dist
```
