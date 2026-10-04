# OpenWorld

A web-playable 2D JRPG world whose rules are code. An LLM acts as a live modder: when an
interaction is undefined, it writes a type-level rule patch that the engine validates,
applies, and keeps. When interactions are defined, the game runs on its own.

Successor to BardOS. Design: [docs/design.md](docs/design.md).

## Worlds

- **The Ford** (default, hand-crafted demo): a river crossing at the edge of the world — a
  ferrykeeper, a stranded peddler, slimes — with a meadow west of it and a forest south of that,
  and one goal: the far bank. The place teaches three ways across; anything else the world
  learns from the player counts too. It is the development scaffold of a world meant to reach
  hundreds of maps; every element it holds witnesses a requirement
  ([docs/game-design.md](docs/game-design.md) §9, proven by `packages/tools/test/demo.test.ts`).

The event model — one AI interface, the outcome of an event — is in
[docs/design.md](docs/design.md) §5.4–5.14.

## Run

```bash
npm install
npm run gen:world     # the Ford → packages/client/public/world/
npm run dev           # http://localhost:5173, with the modder service on :8787
npm run build         # static site in packages/client/dist
```

With Nix, `nix develop` (or `direnv allow`, through `.envrc`) gives Node 24 with npm; install
with `npm ci` to keep the lockfile as it is.

Controls: WASD/arrows move (Shift walks) · **E** hands (talk, open, push) · **F** take ·
**left click** use the held thing (weapons strike; click yourself to eat) · **right click** put
it there (place, store, hand over) — on the topmost thing drawn where you point; hold to choose another · **1–0** / wheel
choose what to hold · **Esc** menu · **I** inventory · **J** journal and Threadbook ·
**`** Mod Console (dev).

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

The offline modder is an SWE-style agent that improves its own way of working; the same agent
runs SWE-bench-style instances from a self-state snapshot ([docs/rsi.md](docs/rsi.md)):

```bash
npm run agent -- swe --instances instances.jsonl --state var/modder-state --out predictions.jsonl
npm run improve -- --select 8 --confirm 8   # one turn of the outer loop
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
```
