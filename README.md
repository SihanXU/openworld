# OpenWorld

A web-playable 2D JRPG world whose rules are code. An LLM acts as a live modder: when an
interaction is undefined, it writes a type-level rule patch that the engine validates,
applies, and keeps. When interactions are defined, the game runs on its own.

Successor to BardOS. Design: [docs/design.md](docs/design.md).

OpenWorld is both the engine and, for now, the name of its first game. The engine side lives in
`packages/` (`engine`, `runtime`, `modder`, `agent`) and imports no game; each game lives in
`games/<id>/` and hands itself over (this one: `games/openworld/`, with its content, maps, tools,
art, wiki generator and app in `client/`). The OpenWorld Editor makes games on the engine in the manner
of RPG Maker — a program of its own, in the browser or as a desktop application:
[docs/engine-split.md](docs/engine-split.md).

## Worlds

- **The Ford** (default, hand-crafted demo): a river crossing at the edge of the world — a
  ferrykeeper, a stranded peddler, slimes — with a meadow west of it and a forest south of that,
  and one goal: the far bank. The place teaches three ways across; anything else the world
  learns from the player counts too. It is the development scaffold of a world meant to reach
  hundreds of maps; every element it holds witnesses a requirement
  ([docs/game-design.md](docs/game-design.md) §9, proven by `games/openworld/tools/test/demo.test.ts`).

The event model — one AI interface, the outcome of an event — is in
[docs/design.md](docs/design.md) §5.4–5.14.

## Run

```bash
npm install
npm run gen:world     # the Ford → games/openworld/public/world/
npm run dev           # http://localhost:5173, with the modder service on :8787
npm run build         # static site in games/openworld/client/dist
```

## The engine, its player and its editor

OpenWorld is also the engine the game runs on ([docs/engine-split.md](docs/engine-split.md)): the kernel and
its optional modules in `packages/`, each game in `games/<id>/` — this one, and `games/starter`, the smallest
whole game, written as data files and played by the kernel with no module.

```bash
npm run play          # the engine's player, http://localhost:5174/?game=/games/starter/ (or /games/openworld/)
npm run editor        # the OpenWorld Editor, http://localhost:5175/editor/ — projects in any folder; the game,
                      # maps, people, database, pictures and sounds, rules, story, quests, and the holes with
                      # the AI as co-author; playtest from any cell; export a game anyone can play
npm run editor:build  # the editor as a program of its own (packages/editor/dist), then npm run editor:start
npm run desktop       # the editor as a desktop application (npm run desktop:dist: its installers)
npm run game -- check games/starter        # a project's problems (build <project> --out <dir>: a bundle)
npm run bake          # OpenWorld written as a project in the format → games/openworld/project/
```

Controls: WASD/arrows move (Shift walks) · **E** hands (talk, open, push) · **F** take · **G** put
(place, store, hand over) · **left click** use the held thing (weapons strike; click yourself to eat) ·
**right click** the action, as the cursor shows (talk, open, pick up, set down a bed, eat) — on the
topmost thing drawn where you point; hold to choose another · **1–0** / wheel
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
npm run modder -- serve 8787 --script packages/ai/fixtures/offline.json --data var/offline
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

## Wiki

The game's Chinese wiki (and design proposal), in the shape of the Stardew Valley wiki: a page for
every system, control, item, fixture, person, creature, boss, place and quest, plus the setting.
Pages are Markdown files in `wiki/pages/` that anyone on the team can edit on GitHub; tables,
infoboxes, schedules, dialogue and maps are generated from the game's own data at build time.
How to edit: `wiki/pages/帮助/编辑入门.md`. Live at `http://35.239.4.44:5175/wiki/`, rebuilt a minute
after a change reaches main.

```bash
npm run wiki          # http://localhost:5180/wiki/, rebuilt when wiki/ changes
npm run wiki:check    # links, templates, and completeness (every thing and system has a page)
npm run wiki:build    # the static site in games/openworld/wiki/out
```

## Art & audio

[Ninja Adventure asset pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by
Pixel-boy & AAA, CC0. The full pack goes in `assets/ninja-adventure/` (not committed);
`npm run assets` copies the subset the catalogue uses into `games/openworld/public/assets/na/`
(committed, so the site builds without the pack).

## Checks

```bash
npm test                                  # engine, base rules, story, Mod port, coverage, modder
npm run typecheck
npm run coverage                          # interaction coverage (roadmap §1, §3)
```

## Pixel UI components

Run the game locally and open `http://127.0.0.1:5173/ui-lab.html` for the interactive component
workshop (`?lang=en` for English). The workshop runs without a world or model service, and is not
included in the production build. It includes inventory, journal, settings and trading examples,
all control states, nested confirmations, keyboard navigation, and screen-edge context menus.

The reusable DOM components live in `packages/runtime/src/ui/components/index.ts`. They receive
content and callbacks; game state and worker messages stay with their callers:

```ts
import { button, createWindow, element } from '@openworld/runtime/src/ui/components/index.ts'

const panel = createWindow({ title: '旅途日志', size: 'md' }, [
  element('p', '', ['渡口的守船人正在等你。']),
])
panel.footer.append(button({ label: '继续旅程', tone: 'primary', onClick: () => panel.hide() }))
panel.show()
// Keep the handle for reuse; call panel.destroy() when its owner is disposed.
```

`mountWindow(surface, { onClose, view, size })` adapts an existing panel without replacing its
business nodes, event handlers or data attributes. It builds fixed header/footer areas around a
scrollable body, remembers focus and scrolling across renders of the same `view`, and integrates
with the shared keyboard manager. Existing `PanelFactory`/`PanelContext` extensions remain valid;
an optional `GamePanel.hide()` releases transient work when a panel closes through any path.
Use `choiceTile({ label, artwork, selected, onClick })` for named item choices. Its separate
art and label rows keep long names aligned; `pixelArtwork()` trims transparent preview padding
and preserves sprite proportions in a 64×48 inset, without modifying the source used in the world.
The building palette in `ui/building.css` arranges these choices into three, two or one column
according to its available width and keeps its header outside the scrolling catalogue.
Use `confirmDialog()` for nested choices and `trackFloating()` for anchored popups; dispose the
tracking callback when its popup closes. `itemSlotHtml()` is the trusted-template adapter for
frame-rendered item grids; pass names and attributes separately, never interpolate player input
into its HTML content.

The theme has one ownership chain: `tokens.css` (palette, font aliases and dimensions),
`components.css` (shared chrome), and `layout.css` (game compositions and responsive behavior).
The honey-coloured wood frame uses an original nine-slice SVG (`ui/assets/window-frame.svg`);
shared icons use a 12×12 pixel grid instead of platform-dependent symbols. `creator.css` and
`cover.css` compose these controls into the portrait dresser and the two-page new-game flow.
Features, clothing and colours have separate tabs; moving between the traveller and journey
pages keeps the chosen appearance, difficulty and save slot. Only starting an occupied slot
asks for overwrite confirmation.
The older content-specific styles are in the lower-priority `legacy` layer. New panels should use
the shared components rather than adding another global override. Use 12px for compact metadata,
24px for window headings, and 48px for the cover title. The journal uses 16px/26px prose,
14px controls/section headings, and 12px metadata; `questlog.css` owns its reading layout.
All sizes use the bundled Fusion Pixel font declared in `styles.css`, without a font CDN.
The workshop renders the actual `QuestLog`, including long bilingual titles and objectives,
progress counts, locations, and completed/failed states.

Windows use 480/800/1120px maximum sizes, constrained by available space, with 24px outer margins
or 8px on narrow/short screens. Inventory reflows below an 880px content width; list/detail and
forms reflow below 720px. Keep item indices stable when columns change. Titles and window-level
actions remain visible while content scrolls. Tab height is measured; maps and skill trees measure
their own toolbars and preserve the point at the viewport centre during resize. Floating UI
uses the visible viewport, including its offset when the on-screen keyboard appears.

```bash
npx playwright install chromium            # once, unless using an existing Chromium
npm run test:ui                            # generates the world, then runs browser checks
```

For an existing browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable. The tests cover
Chinese and English at 1920×1080, 1366×768, 1024×768, 800×600, 844×390, 390×844 and 360×640,
continuous resize, font failure, nested dismissal/focus, and real game windows. The reduced
683×384 viewport also checks the layout space available at 200% zoom on a 1366×768 desktop;
it does not emulate a real browser zoom setting. Full phone gameplay controls are outside this UI change.

Visual references: [previous UI audit](docs/figures/ui-audit/bag.jpg),
[character creation](docs/figures/ui-system/creator-desktop.jpg),
[colour palettes](docs/figures/ui-system/creator-palette.jpg),
[narrow character creation](docs/figures/ui-system/creator-narrow.jpg),
[journey and saves](docs/figures/ui-system/journey-desktop.jpg),
[current inventory](docs/figures/ui-system/inventory-desktop.jpg),
[narrow inventory](docs/figures/ui-system/inventory-narrow.jpg),
[narrow skill tree](docs/figures/ui-system/skills-narrow.jpg),
[building choices](docs/figures/ui-system/building-palette-en.png),
[the in-game journal](docs/figures/ui-system/quest-typography-live-en.png),
and [narrow journal objectives](docs/figures/ui-system/quest-typography-mobile-zh.png).
