# The player's own model (bring your own key)

Agreed 2026-10-25. The model a world asks is the player's: chosen in the game's options (the service, the model,
the key), called from the player's own browser, and paid for on the player's own account. The key never reaches
the game's server. The modder service (design.md §11) stays, for development, the editor and a hosted demo, but
a published game needs no server-side model.

## 1. What runs where

```
page (options: Your model)  ──key, once──▶  modder worker (in the page)  ──HTTPS──▶  the service chosen
                                               ▲ MessagePort: health, resolve, progress, patches, fault
engine worker ──── ModderLink ─────────────────┘
               └── a modder service over HTTP (?modder=<url>, VITE_MODDER_URL, the local one in development)
```

- **The modder worker** (`packages/runtime/src/modderWorker.ts`, `localModder.ts`) runs the modder's live pipeline
  (`@openworld/modder/src/browser.ts`) with the agent's browser part (`@openworld/agent/src/core.ts`). The page
  makes it when it is first wanted: with the page when a model is kept in this browser, else when the options
  open. It is handed the game **as data** (the ontology and the base rules: no game code), and imports the
  engine's modules, whose primitives judge a patch.
- **The engine's worker** asks a modder through `ModderLink` (`modderLink.ts`): `serviceLink(url)` over HTTP, as
  before, or `portLink(port)` to the player's own. Both answer the same five questions, so prefetching, adopting
  an answer's definitions, the shared log's sync and faults work the same. A patch from either still goes through
  the engine's own validator.
- **Which modder:** a service the page names (`?modder=<url>`; `?modder=off`: none) first; else the player's own
  model, once chosen; else the default service (VITE_MODDER_URL, `localhost:8787` in development). The page tells
  the engine's worker with every game it begins or loads (`init.modderPort` / `init.modder`) and when the player
  chooses another model (`{ t: 'modder' }`).
- **The library.** The player's own modder keeps its library in memory: the client's own patches come with every
  request (its workspace), and the answers it takes are in the client's library, stored in the browser as ever.
  Its log (`patches`) carries what it commits and removes in this page, so a patch its audit takes out leaves the
  client's library too. Nothing goes back to a shared library (§5).
- **The self-state** (memory, skills, harness) is files in memory (`MemFiles`, `packages/agent/src/files.ts`),
  kept in this browser (the newest 300 episodes). Its harness is the default's live part: no reflection on the
  player's account, no offline escalation or revision (the offline profile is the service's: `useOffline`, Node
  only), and a learned rule set aside here leaves at once (`faults.remove: 1`: one client).

## 2. The key

- Typed in the options' **Your model** (`ui/modelSettings.ts`), sent once to the modder's worker, and kept there.
  The page keeps only its hint (`sk-or-…1234`); the form clears it once used.
- Kept in this browser only when the player asks (**in this browser**: IndexedDB `lsw-modder`, apart from the
  saves; **until this page closes**: the worker's memory). A flag in localStorage (`lsw.model`) says only that the
  worker should start with the page. Clearing the site's data removes it; **Forget the key** removes it at once.
- Sent to the service chosen, in the header that service reads, and nowhere else: never over the engine's port,
  never into a save or the library, never to the game's server. A key kept for one service is never sent to another
  (a test, a list or a choice of another service without a key typed goes without one).
- Taken out of every error the modder passes on (`scrub`).
- What can still read it: anyone using the same browser profile (the options say so), and any script running on the
  game's page. The game's pages load scripts from their own origin only (a Content-Security-Policy says so).

`packages/runtime/test/own-modder.test.ts` holds these; `packages/agent/test/providers.test.ts` what each service
is sent; `packages/engine/test/boundaries.test.ts` that what a browser runs reaches no Node module.

## 3. The services

`packages/agent/src/providerList.ts`: OpenRouter, Anthropic (its own API, with the header that allows a browser),
OpenAI, DeepSeek, Moonshot (Kimi), Google Gemini (its OpenAI-compatible endpoint), Ollama (on the player's machine,
no key; it must be started with `OLLAMA_ORIGINS` allowing the page) and any other OpenAI-compatible address.
A service a browser may not call (no CORS) fails its **Test** with a plain message; OpenRouter reaches most models.
The model list is the service's own (`/models`, Anthropic's `/v1/models`); a name may also be typed.

OpenRouter's own request fields (`reasoning`, `provider`, `usage`) go to OpenRouter only: another service refuses a
field it does not know.

## 4. What it spends

Every call is counted (`Spending` in `localModder.ts`): today's cost, calls and tokens, and the total, kept in this
browser. The player may set a daily cap in USD; once spent, a call is refused before it goes out (its error says
*quota*, so the modder pauses, and the world answers by its defaults until the next day). A service that does not
say a call's price (OpenAI's own, DeepSeek…) is counted in calls and tokens, and shown as unpriced. The detection
(design.md §13) runs on the player's key too, after the player confirms.

## 5. Not built yet

- **The desktop application:** the key in the system's keychain (Electron `safeStorage`) and calls made from its
  main process (no CORS limit, so every service works).
- **Sharing what a player's model learned:** an opt-in upload of patches (never the key) to the shared library,
  validated and replayed there, held apart until independent clients agree or a model the team runs reviews it.
- **The self-state's seed:** the player's modder starts from the default harness; a snapshot of the service's
  lessons and skills (read-only) could be shipped with the game.
