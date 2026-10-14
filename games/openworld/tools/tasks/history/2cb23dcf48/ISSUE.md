# Labels belong to the rules; the overworld is entered by standing on it

## What is wanted

Two related things.

**1. What an input does is said by the rule that answers it, not by an engine-side table.**
Today the HUD's label for an input comes from a table inside the engine, keyed by rule id. It should come from the rules themselves. A rule, or one of its `{do}` answers, may carry a `label` (a text with `{target}`, `{instrument}` placeholders) that says what an input reaching it does ("Eat {instrument}", "Feed {instrument} to {target}", "Enter {target}"). The engine's label table is removed.

- The dry run collects labels along the chain of rules an input passes through. The input shows the receiver's label first, before the label of the act's own rule. If none is found it shows the input's default label, with a `?` when the outcome is undefined.
- Every input-reached rule in the content says what it does: the core rules, tools, building helpers, the ford and the quest rules. Eating, drinking and dressing have a label for oneself and a different one for others. Open/close, lock/unlock and wake/listen have a label per answer.
- Patches can carry labels too: the mod spec, the validator (it checks the text and its placeholders, and warns when an input-reached rule has no label), the modder's prompt, and the Mod Console template.

**2. The overworld is entered by standing on it.**
- Pressing E (hands) with nothing pointed at falls back to what one is standing on, when the place in front has no answer of its own (a place of the overworld, a bed). Standing on any tile of a block, facing any way, E enters that block.
- Wild places are named by their ground, e.g. "The wild forest" / "森林荒野".
- A target whose base covers more than its cell is outlined whole in the client, not only its one cell.
- Blows or other acts on a place of the overworld that are out of reach say so ("Out of reach — go in first (E)").

## Expected behaviour

- With the hoe held facing grass, the `use` input is labelled "Till grass" (the tool's label with the target's name), not just "Till".
- With an apple held and a hungry farmer nearby:
  - the `self` input is labelled "Eat Apple";
  - `use` on the farmer is labelled "Feed Apple to farmer";
  - `use` on a well, which nothing answers, is `unknown` and labelled "Use Apple on well" (the default, with the instrument and target names).
- After a patch rule (origin `patch`) is added for apples used on a well, with its own `label` "Toss {instrument} into {target}", the same input is no longer unknown and reads "Toss Apple into well". The patch's label replaces the default.
- On every walkable overworld tile, for each of the four facings, the `hands` input plans rule `site/enter` on that tile's place, and its label starts with "Enter ". This holds for every walkable tile (there are well over 300), and every such tile has a place of the overworld on it or covering it.
- The name of a wild forest place in Chinese is "森林荒野".

## Requirements

- A rule, or a `{do}` leaf of a rule's tree, accepts an optional `label` (bilingual text with placeholders).
- The label of a plan is: the receiver's collected label if any, else the act's own collected label, else the default label (with `?` when undefined). Labels in the chain are collected by the dry run.
- The engine's table of labels by rule id is removed; content rules provide the text.
- Content rules reached by an input carry labels as described above, including per-answer labels for eating/feeding, drinking/giving to drink, wearing, open/close, lock/unlock and wake/listen.
- Patch rules can declare `label`. The validator checks its text and placeholders, and warns when an input-reached patch rule has none. The modder's prompt documents it; the Mod Console template includes a placeholder label.
- E with no pointed target falls back to the thing stood on, only when the place in front has no answer of its own.
- Wild overworld places are named by their ground in both languages.
- Key views for the client carry the rectangle of a target whose footprint exceeds one cell, and the focus outline draws that whole rectangle.
- Out-of-reach actions on an overworld place yield a label saying so.
- Existing behaviour of the inputs (what runs, what is asked to confirm) is unchanged; only labels and the standing-on fallback change.

## Interface

- `Rule.label?: Text` and the `{do}` tree leaf `label?: Text` (engine rule/tree types). `Text` is the engine's existing bilingual text type.
- Patch spec (`ModSpec` rule entries) accepts `label?: Text`.
- `KeyView.rect?: [x: number, y: number, w: number, h: number]` in the client frame's key views: the target's whole footprint in tiles.
- No other new names.
