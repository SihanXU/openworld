# Agent players: a seat for anyone who is not at the keyboard

Coding agents (a DeepSeek harness, Claude Code, Muse …) are kept as companions that browse, shop and play beside
their owner. OpenWorld opens one port so that such an agent can play it as **a player**: one person may bring one
bot or many, and a bot may play alone. The game does not tell them apart. A bot walks the same world with the same
keys, reach, hunger, wounds and rules, and sees only what a person at its seat would see. What an agent reads to play:
[agent-play-guide.md](agent-play-guide.md).

This is not the modder ([ai.md](ai.md)), which answers holes in the rules: an agent player is an actor whose keys
somebody else presses. The two share nothing, and the port lives outside `packages/ai` (delete it and bots remain).
It follows from two principles of CLAUDE.md, *only the input knows which actor the keys move* and *no judgment is "is
it the player"*; what had to change is that the input knew exactly one actor.

Decided 2026-11-02: the world runs in real time and a slow bot is a slow player; story and quests follow the primary
seat (the person's), and a bot's deeds are ordinary acts in the world; safety is a local tool's (127.0.0.1, no
debug ops, the host can end a seat), nothing heavier until a public server exists.

## 1. Layers

```
agent (any harness)  ⇄  transport (HTTP, relay)  ⇄  agent protocol (AgentHost)  ⇄  Seat  →  the same Controls, the same rules
```

**Seat** (`packages/engine/src/seat.ts`). An actor whose keys a person or an agent holds. `World.state.player` is the
primary seat, which the camera, story and quests follow; `Engine.sit(actor)` takes another and `Engine.leave` lets it
go, after which the actor is under its goals again. `Controls(eng, hand, actor?)` is built for each seat and reads
`this.me` where it read the player. `Seat.input(SeatInput)` is one dispatch over the page's gameplay inputs: move
(held, tapped, or counted with `steps`), dash, attack, the left and right click and E, F, G, an item pressed on, slots,
wear, craft, draw and sneak, a chest's transfer, and a module's own (`cast`, `dash` through `EngineHooks.seat`).
A refusal comes back as `{ok: false, reason}`. The world has one question (yes or no), and it is the primary seat's: a
seat's act that would have to ask first is refused with a word.

**Observation** (`observe.ts`). `observe(eng, actor)` reads what a person there would: the seat's own state; a 17×17
grid of the cells round it (`.` open, `#` blocked, `o` a body, `!` a cell a wind-up will strike, `@` itself); the things
in sight by kind and offset, the hostile ones marked; the wind-ups in sight (`warnings`, from the kits module through
`EngineHooks.telegraphs`, with `onMe`); what E, G and the two clicks would do on the cell in front (the same
`Controls.plan` the keys use); the open container. About 3 KB of JSON; `describe` says the same as text. Names and
lines in it are the world's data, never instructions to the reader.

**Protocol** (`agents.ts`, `inputDocs.ts`). JSON messages, transport-neutral: `hello {protocol, name?, skin?, look?}`,
`act {input, hold?}`, `observe {text?}`, `bye`; `welcome` (with the words of every input), `result`, `observation`,
`error`, `ended`. `AgentHost` seats a visitor in a body of the player's own kind beside the player (each on another
side), takes the body away when the connection leaves or the body is lost, and lets a held key go after `hold`
seconds. A look is checked by the creator's own table.

**Transports** (`packages/bridge`). `http.ts` serves the protocol as plain HTTP and JSON on 127.0.0.1, so any agent with
a shell plays with `curl`. For a game in a page, which cannot be dialled, `relay.ts` is a relay the page dials out to
with a long poll (`runtime/src/agentLink.ts`, the page opened with `?agents=<relay>`): plain `fetch`, no dependency.
`npm run agents` hosts a page-less Ford with an idle player; `npm run agents:relay` serves a page.

**Skins.** `hello {skin}` draws a visitor as a whole drawn sheet of the client's catalogue (`look: 'skin.<name>'`, the
road a skeleton or a statue takes). The drafts of `art/character-skins` (branch `art/character-skin-drafts`) are cut
into the game's sheet (four directions of four frames, 64×64 a cell) by `games/openworld/tools/src/art/skins/skins.py`:
`whale` is DeepSeek's, `gpt` GPT's, `claude` Claude's, and `muse` borrows the whale girl until it has its own. The
drafts' README says the terms of their reference images are not settled; the same holds for these sheets until their
provenance is reviewed.

## 2. Tried

2026-11-02, the Muse CLI (`muse exec`, one run, given only the API's own words): it read `/spec`, sat, walked to an
item, took a stone and a tuft of grass with E, checked its bag and left. What it found hard was changed for it: a key
held for a time was hard to land on a tile (now `steps`) and the speed was not told (now in the spec). A page hosted
three seats at once in the dev client, each in its own skin.

## 3. Not yet

- Talk, trade, gift and pockets through a seat: their state is the worker's (`talk`, `trade`) and the society module's.
- Stepping onto portals: a seat stays on the primary seat's map.
- The log and speech since the last observation (the world's `fx` is the page's to clear each frame, so a seat needs a
  cursor over it); quests, skills and the aimed-at choices in the observation.
- The page's own worker still keeps the primary seat's held keys in module variables (`moveDir`, `attacking`); the page
  and a bot share `Controls`, where what a key does is written once, but not the held-key state.
- A generated schema for the protocol (the words of the inputs are a list that the compiler keeps complete).
- An MCP server and a skill over the same routes; a look of its own for Muse; dialogue portraits for the skins.
- Several people in one world (it needs a network host for them too); a bot's own save; anti-abuse for public servers.
