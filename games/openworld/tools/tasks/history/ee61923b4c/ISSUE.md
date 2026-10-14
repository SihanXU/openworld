# A patch may raise the story's own topics (e.g. `dragon_slain`), making people speak of events that haven't happened

## What is wrong

A patch can notify the story of a topic that the story raises itself, such as `dragon_slain`. People then say their written "the dragon is dead" lines while the dragon is still alive.

The protected-fact check only covers `setProp` on the story. The `topic` op goes through `story/topic`, so it slips past that check. Nothing in the world marks the story's own topics as protected, and the validator never looks at which topic a patch raises.

Two related problems:

- Protected-fact matching is a bare string-prefix test. A protected key `topic.crown` would also wrongly cover an unrelated name like `topic.crown_polished`.
- Authors of patches are not told that the story's topics are off limits.

## Expected behaviour

The engine can list the topics the story raises itself. The world protects each as `topic.<id>`. The validator refuses any patch, whether the player's or the world's, that raises one of them.

A patch can raise a topic in two ways, and both are refused when the topic is one of the story's:
- a notice to the story: an `emit` with impulse `notify`, `params.what` = `"topic"` and `params.value` = the topic id;
- the story's own `topic` effect, in a rule hosted by the story.

Patches may still raise topics of their own (a new id).

Protected keys match themselves and what hangs from them, not mere string prefixes:
- `topic.crown` covers `topic.crown` and `topic.crown.days`, but not `topic.crown_polished`.
- A protected entry ending in `.` (such as `ford.`) still acts as a prefix.

Examples, with the story's topics including `crown` and `dragon_slain`:
- A patch notifies the story with `dragon_slain`: refused, with an error saying the story raises the topic `"dragon_slain"` itself.
- A story-hosted patch rule uses `topic` with id `crown`: refused with the same kind of error naming `"crown"`. This holds in both player and world modes.
- A patch notifies with `feather_rumour`, `crown_polished` or `theft`: accepted, with no topic error.

Which topics count as the story's:
- Topics named by `topic` commands in the story's steps' scripts.
- Topics named by `topic` effects in the story's own rules. This covers both `do` leaves and the default effects of holes.
- A topic whose id is passed as a param (an id starting with `@`) is not the story's. For example, a witness's `theft` ("that is mine") is anyone's news and is not protected.

In the demo world, the protected facts are the existing ones plus `topic.<id>` for every story topic. The story's steps are used for both the world's step list and the topic collection.

The authoring rules shown to the patch-writing agent gain a line. A patch's topic is news of its own with a new snake_case id. The story's own topics are raised by the story when they happen, and a patch raising one is refused.

## Requirements

- A function collects the story's topics from a list of steps and a list of rules. It returns each topic id once, with no duplicates.
- The collection includes topics from the steps' `topic` script commands and from the story rules' `topic` effects, in both `do` leaves and hole defaults.
- Topic ids starting with `@` (passed as params) are excluded.
- The demo world's `protectedFacts` contains `topic.<id>` for each story topic. The topics must include at least `crossed`, `crown`, `dragon_slain`, `flame_stolen`, `winch_mended` and `tree_felled`, and must not include `theft`.
- The validator reports an error for a patch effect that raises a protected topic by a notice or by `topic`. The message contains `raises the topic "<id>" itself`. This applies with and without the world flag.
- A topic that merely begins with a protected topic's name (`crown_polished` against `topic.crown`) is not refused.
- The existing world-event rule, that a patch on the story may not change a protected fact, uses the same key-matching (exact key or what hangs from it, or a `.`-ending prefix).
- Existing patches that are valid today stay valid.
- The authoring rules gain the line described above.

## Interface

- `storyTopics(steps: StepDef[], rules: Rule[]): string[]` in `packages/engine/src/story.ts`, exported from `@lsw/engine`. It returns the unique topic ids the story raises.
- No other new public names. Internally the validator gets a helper for protected-key matching, and the demo world builds its steps list once and reuses it.
