# The AI setting: a level per kind of work, answers kept by tier, the model detected

## What is wanted

The AI should be configured like a game's graphics settings. Five kinds of work each get a level of **off / low / medium / high**:

- **things**: the player acting on things.
- **people**: the player acting on people and creatures.
- **world**: what the world asks by itself.
- **create**: making new kinds, and drawing them.
- **prefetch**: asking ahead.

There are presets, and **medium is the game exactly as it was before this setting**.

The wait is the same at every level (`AI_WAIT_MS`, the player's 20 s). A level is how much the AI does inside that wait:
- what it sees;
- what it may use;
- how hard it thinks;
- what is checked before the answer ships.

A stronger model therefore carries a higher setting.

Answers learned from the AI are kept by tier. Detection plays real questions at every tier and recommends a level per kind. The options show the setting and the detection. The editor and the claude-code backend follow the setting.

## Expected behaviour

**Kinds of work.**
- A player act on a thing is `things`. This includes an act on oneself, and an event whose host is a thing such as a held stone.
- A player act whose host is a person or creature is `people`.
- Any event that does not come from the player is `world`.
- The engine's classification of an event and the classification of a recorded request must agree.

**Reading a setting back.**
- `qualityOf(raw)` keeps the fields that are valid and takes the medium default for the rest. For example, `{things:'low', people:'ultra', create:'off'}` gives medium with `things` low and `create` off. Junk input gives the medium preset.
- `presetOf(q)` names the preset a setting equals, or returns undefined (it is "custom").
- `tiersFrom('low')` is `['low','medium','high']`. `tiersFrom('high')` is `['high']`. Off takes every tier's answers, lowest first.

**Off.**
- An undefined outcome for a kind set to off asks no one: the default runs at once and the record is `fallback`.
- The `undefined` effect reports `asked: false`.
- The provider is never called.
- Answers already in the library still apply, and a patch submitted by hand is still accepted.

**Tiers.**
- `Engine.quality` is the player's setting. It is not world state and is never saved. The default is medium.
- Each request carries its `tier` and `create`. Its scenario carries `tier` too. A request with no tier means medium.
- A learned rule carries its tier. A medium rule has no tier field, as before.
- An answer is placed in the tier its question was asked at. Each tier has its own trees.
- An event takes its own tier's answer first, then a higher tier's. A higher answer serves lower settings; a lower one never serves a higher setting.
  - Example: with a low answer present, medium and high still hit the hole.
  - Example: once a high answer exists, medium and high use it and low keeps its own.
- A question that failed, was dismissed, or went unreachable is not asked again at that tier. Other tiers stay free to ask.
- A submitted rule whose tier differs from the question's tier is refused with a message containing "asked at the low tier, not the high". A tier that is not low, medium or high is refused with "tier must be one of low|medium|high".
- The shared world library follows the same rule. A lower answer does not cover a higher question. A higher answer covers a medium or low question.

**What the AI is shown, by tier.**

| | low | medium | high |
|---|---|---|---|
| terrain window | 3×3 | as before | as before |
| nearby things | none | as before | within 4 cells, up to 32 things |
| recently said lines | none | as before | as before |
| rules in force | none | as before | 16 |

The scenario an answer is judged in is the same at every tier, apart from carrying the tier.

**The workload of a tier over the harness.** The wait times are never changed.
- **medium** is the harness itself (the same object).
- **low:**
  - no catalogue lookup;
  - no reasoning;
  - no repair rounds;
  - no review, audit, escalation or revision after shipping;
  - the answer changes its host only. Impulses emitted to other things are removed from the patch, and `withoutChains` reports that as a fix. A patch with nothing to remove comes back unchanged.
- **high:**
  - medium reasoning;
  - at least two repair rounds;
  - a blocking review before the answer ships (on fast providers).
- The creation level gates making and drawing. At off, a design that asks to create new kinds is sent back with the message "Making new kinds is off at this setting", and the next answer must use what the world has. The first prompt also says "Making new kinds is off".
- An episode records the `{tier, create}` it was asked at.

**Detection.**
- The modder plays its own service history and the game's probes at every tier, on the base game with a dry modder. Nothing is committed to the library and nothing is recorded as an episode.
- It recommends a level per kind: the highest tier answered within the wait at least 3 times in 4. A kind with no tier that does so is `off`. With no runs the default is medium. `create` is recommended alongside.
  - Example: things answered at all tiers, people at low and medium only, world never gives `{things:'high', people:'medium', world:'off', create:'high'}`.
- HTTP: `GET /quality` and `POST /quality/detect`, this machine only.
- A game supplies its probes lazily (`GameDef.probes`). The OpenWorld probes are generated by `npm run probes` from the Ford's six hole scenarios, sweep cells for things and people, and a day of the world on its own. The Ford scenarios are shared between ford-live and the probes.
- `npm run probes` loads them only when a detection runs.

**Other consumers.**
- Runtime options get an AI section:
  - the presets;
  - a row per kind;
  - the detection and its recommendation, with an "apply" button.
- Prefetch follows the setting. `?prefetch=1` still asks for medium.
- The editor's hole-asking runs at the high tier, so an author's answer serves every setting.
- The claude-code backend runs a call at the effort it asks for. The configured effort is the least; a call asking for more reasoning (`medium` or `high`) gets that effort, never less.
- Docs: design.md §13 "The AI setting", the wiki pages 世界会学 and 选项.
- The whole-night tests (`rest`, `death`) get the heavy tests' 90 s timeout.

## Requirements

- Medium behaves exactly as before the setting: same requests, same rule shape, same pipeline.
- The setting is never written to a save or to the harness.
- The wait does not change with the level.
- Resolution order is own tier, then higher tiers. It never falls to a lower one except for off, which accepts all tiers.
- A failure at one tier does not block asking at another.
- A tier mismatch or invalid tier in a submitted rule fails validation with the messages above.
- Detection must leave the library and episode log untouched.
- The probes data is a lazy chunk, not loaded by a player.
- Typecheck and the existing suite keep passing.

## Interface

**`@openworld/engine`** (`quality.ts`, exported from the index; `Tier` is `'low'|'medium'|'high'` in `types.ts`):
- `type AiLevel = 'off'|'low'|'medium'|'high'`
- `type AiCategory = 'things'|'people'|'world'`
- `interface AiQuality { things: AiLevel; people: AiLevel; world: AiLevel; create: AiLevel; prefetch: AiLevel }`
- `const PRESETS: Record<AiLevel, AiQuality>`
- `const DEFAULT_QUALITY: AiQuality`
- `const TIERS: Tier[]`
- `isTier(x: unknown): x is Tier`
- `tierOfLevel(level: AiLevel): Tier` (off and medium give medium)
- `tiersFrom(level: AiLevel): Tier[]`
- `qualityOf(raw: unknown): AiQuality`
- `presetOf(q: AiQuality): AiLevel | undefined`
- `categoryOf(world: World, ev: GameEvent): AiCategory`
- `categoryOfRequest(req: ModRequest): AiCategory`
- `ruleTier(rule: Rule): Tier` (no field means medium)
- `tierOfRequest(req: ModRequest): Tier`
- `Engine.quality: AiQuality`
- `Engine.tier?: Tier` (one tier over the setting, for sandboxes)
- `Engine.tierOf(ev: GameEvent): Tier`
- `Rule.tier?: Tier`
- `Scenario.tier?: Tier`
- `ModRequest.tier?: Tier`
- `ModRequest.create?: AiLevel`
- `GameDef.probes?: () => Promise<ModRequest[]>`
- `RuleLibrary.resolve` takes an optional tier supplier as a fourth argument.
- `patchKey(host, on, hole, tier?)` gains the tier.

**`@openworld/agent`:**
- `effortOf(floor: string | undefined, reasoning: ChatOptions['reasoning']): string`
- `Episode.quality?: { tier: string; create: string }`

**`@openworld/modder`:**
- `workloadOf(req: Pick<ModRequest,'tier'|'create'|'scenario'>): Workload`
  - It has at least `find: boolean`, `chains: boolean`, `create: AiLevel`.
  - Tier comes from `req.tier`, else `req.scenario.tier`, else medium.
  - Create defaults to medium.
- `envelope(harness, workload): Harness`
- `withoutChains(patch: Patch): { patch: Patch; fixes: string[] }`
- `type DetectRun = { probe: string; summary: string; category: AiCategory; tier: Tier; ok: boolean; outcome: string; ms: number; cost: number; calls: number }`
- `recommendOf(runs: DetectRun[]): { things: AiLevel; people: AiLevel; world: AiLevel; create: AiLevel }`
- `gatherProbes(modder: Modder, history: ModRequest[]): { category: AiCategory; … }[]`
- `class Detector(modder, { probes })`:
  - `plan(): Promise<{ probes: number; runs: number }>`
  - `start(): Promise<{ started: boolean; total: number }>`
  - `running: boolean`
  - `error?: string`
  - `last?: { runs: DetectRun[]; recommend: … }`
- `Modder` option `probes?: () => Promise<ModRequest[]>`
- `WorldLibrary.covering(req)` is tier-aware.
- Endpoints `GET /quality` and `POST /quality/detect`.
- The harness's `auditOf` helper is used by the tests to read the audit setting.

**Game and tools:**
- `games/openworld/content/src/probes.ts` exports `PROBES: ModRequest[]` (from `probes.json`).
- The OpenWorld `GAME.probes` loads it.
- `games/openworld/tools/src/probes.ts` is the generator, run by the new `npm run probes` script.
- `games/openworld/tools/src/fordScenarios.ts` exports `Ford`, `W`, `ready`, `ofType`, `ticks` and `SCENARIOS`. It is shared by ford-live and the probes.
