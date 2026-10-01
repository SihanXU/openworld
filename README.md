# Large Symbolic World

A web-playable 2D JRPG world whose rules are code. An LLM acts as a live modder: when an
interaction is undefined, it writes a type-level rule patch that the engine validates,
applies, and keeps. When interactions are defined, the game runs on its own.

Successor to BardOS. Design: [docs/design.md](docs/design.md).

## Worlds

- **Hearthvale** (default, hand-crafted demo): a village with five buildings and interiors,
  Whisperwood, and Slime Hollow — 8 maps, 12 hand-written villagers with routines, 30
  creatures, ~110 curated items, and a short opening quest that walks through the verbs and
  the elemental rules before handing over the open world.
- **Saenvar** (`?world=saenvar`, generated for scale): 460 maps, ~2,400 NPCs, ~27,700 items
  (~1,000 kinds). Same engine and renderer; used for scaling experiments.

## Run

```bash
npm install
npm run gen:world     # Hearthvale → packages/client/public/world/
npm run gen:saenvar   # optional: the 460-map world → public/world-saenvar/
npm run dev           # http://localhost:5173  (add ?world=saenvar for the large world)
npm run build         # static site in packages/client/dist
```

Controls: WASD/arrows move · **E** interact (with the held item) · **F** take · **G** put ·
**U** use on yourself · **Space** attack/cast · **1–9** hold an item · **Q** stow ·
**↑↓** choose in an open chest · **`** Mod Console · **L** language · **M** sound · **H** help.

## The modder

The game is complete without it: undefined interactions fall back, and can be patched by hand
in the Mod Console. With the modder service running, they are patched live, and every
accepted patch joins the shared rule library that all clients sync from.

```bash
# the model comes from .env (not committed): LSW_MODEL_KEY=..., LSW_MODEL=moonshotai/kimi-k3,
# LSW_MODEL_PROVIDERS=together,parasail,inference-net (any OpenAI-compatible endpoint; default OpenRouter)
npm run modder -- serve
# or offline, with a scripted model (rope on a creature is the one interaction it knows)
npm run modder -- serve 8787 --script packages/modder/fixtures/offline.json --data var/offline
```

The dev client finds it at `http://localhost:8787`. Elsewhere, point the client at it with
`?modder=<url>` or `VITE_MODDER_URL` at build time; `?modder=off` disables it.

Data lives in `var/` (not committed):
- `library.jsonl` — the shared library's append-only patch log;
- `modder-state/` — the modder's memory, skills and harness ([docs/rsi.md](docs/rsi.md)).

```bash
npm run curriculum -- 20         # resolve 20 sampled undefined interactions offline (quality profile)
npm run latency -- --n 20        # the live profile on 20 fresh interactions: latency, validity, cost
npm run modder -- stats          # library and self-state numbers
npm run modder -- snapshot <label>   # freeze the self-state (benchmark checkpoints)
npm run modder -- export [label]     # the self-state as one document
npm run modder -- library remove <rule-id>   # roll a patch back
```

## Art & audio

[Ninja Adventure asset pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by
Pixel-boy & AAA, CC0. The full pack goes in `assets/ninja-adventure/` (not committed);
`npm run assets` copies the subset the catalogue uses into `packages/client/public/assets/na/`
(committed, so the site builds without the pack).

## Checks

```bash
npm test                                  # engine, base rules, story, Mod port, coverage, modder
npm run typecheck
npm run coverage                          # interaction coverage (roadmap §1, §3)
npx tsx packages/tools/src/stress.ts 6    # Saenvar: all maps loaded, 6 game-hours simulated
```
