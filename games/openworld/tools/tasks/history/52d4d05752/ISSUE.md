# Inviting a person to live in the Held Ground fails at "full regard", ignores the verb's conditions, and hard-codes the residents' day

## What is wrong

Several faults sit around the "Come and live in the Held Ground?" invitation.

1. **The regard needed is unreachable in practice.** The invite requires regard 100. A liking fades by a hundredth a day (rounded to a tenth), so a person who reached 100 reads below 100 for roughly 72 game minutes after the last gain. In practice a person held in "full regard" cannot be invited a day later. `ResidenceDef.at` exists in the engine types but is never read; the verb and the effect use a literal 100.
2. **The talk tree invites without checking.** The tree's invite branch runs `moveIn` unconditionally, and `Controls.talk` does not check that the verb is offered. Saying `invite` to anyone moves them in, including people the main story needs where they are (Ilse, Alberic), people who already live there, and strangers with little regard. It also works before the Held Ground is the player's own.
3. **The residents' day is hard-coded in the engine.** `moveIn` writes this game's day (asleep 21 to 7, "live" by day) into the resident's schedule, so a different game or a different content setup cannot choose its own.
4. **An invited follower keeps following.** A person who is following the player and is invited to move in still carries their follow/waiting state afterwards.
5. **The talk panel's hearts do not match the promise.** The panel shows ten hearts for the regard, but the rounding at the top end means a regard just below 100 (such as 95) does not read as ten whole hearts.
6. **`storybound` is not a recognised instance tag.** The content uses "storybound" to mark people who stay where they are, but the ontology's validator does not know it as an instance tag (as it does `merchant`, `fence`, `hireling`).

## Expected behaviour

**Threshold.** The residence's regard mark is 95 in OpenWorld's content (`SOCIAL.residence.at`). Both the talk verb's condition and `moveIn` compare against `residence.at`, not a literal. A person given full regard (100) is still invitable one day later and five days later (100 fades to about 95 after five days). 

**Talk branch.** When the `invite` word is said, the branch re-checks everything the verb asks, whether or not the verb was offered. Each refusal leaves the person where they are, with no residence set, and they say a line of their own saying why:

| Condition fails | Result |
|---|---|
| The person is storybound (e.g. Ilse) | Stays; line saying they cannot leave, they are needed here (zh: contains 离不开) |
| The person already lives in the Held Ground | Stays; line saying they live there already |
| The Held Ground is not yet the player's own (the White Knight, Alberic, is not defeated: `sins.defeated.alberic` below 1) | Stays; line saying the player has no ground of their own (zh: contains 自己的地方) |
| Regard is below `residence.at` (e.g. a stranger such as Cass) | Stays; line saying they do not know the player well enough (zh: contains 没熟) |

When all hold and a bed is free, the person moves in.

**`moveIn` itself.**
- Does nothing if regard toward the actor is below `residence.at`.
- Does nothing if the host already lives on that residence's map.
- Builds the resident's schedule from the residence's own `days` data: each span goes at the bed or at the bed's day place, with the given activity.
- Clears the host's `follow` and `waiting` props, so an invited follower goes to the Held Ground and follows no longer.
- With no bed free, still says the "full" line, as before.

**Content.** In OpenWorld's `SOCIAL.residence`, `at` is 95 and `days` is: 21 to 7 at the bed, sleeping; 7 to 21 at the day place, living. A resident's schedule after moving in matches these spans exactly (from, to, activity).

**Hearts.** The talk panel's ten hearts are computed by a shared function: a heart for every ten points, rounded, so a heart is whole from its fifth point and half before that. Examples (counting whole as 1, half as 0.5): 0 → 0, 3 → 0.5, 5 → 1, 12 → 1.5, 15 → 2, 50 → 5, 51 → 5.5, 90 → 9, 91 → 9.5, 94.9 → 9.5. A negative regard shows ten empty hearts. 95 and 100 both read as ten whole hearts.

**Tag.** `storybound` is one of the ontology's known instance tags.

## Requirements

- The invite talk verb's regard condition and `moveIn`'s regard check both use `residence.at`; there is no literal 100 left for this purpose.
- `ResidenceDef` gains a required `days` list; the generated ontology JSON schema is regenerated to include it (and the updated `at` description).
- The invite branch of the talk tree refuses, with distinct lines, for: storybound, already resident, Held Ground not yet one's own, and insufficient regard. It checks these independently of whether the verb was offered. Only when none refuses does it run `moveIn`.
- `moveIn` is a no-op (no move, no resident data, no prop change) for insufficient regard or an existing resident of that map.
- `moveIn` takes the resident's schedule from `residence.days` and no longer hard-codes any hours or activities.
- `moveIn` clears `follow` and `waiting` on the invited host.
- Invite verb conditions and the branch's checks share one definition of what the invite asks, so that they cannot drift apart.
- Hearts: regard is clamped to 0–100; heart *i* (0-based) is `on` if regard ≥ (i+1)·10 − 5, `half` if regard > i·10, otherwise empty. The talk panel uses this function.
- `storybound` is accepted by the ontology validator as an instance tag.
- The wiki page 友谊 states the new mark (95) and the hearts rounding.

## Interface

- `heartsOf(regard: number): ('on' | 'half' | '')[]` — in `packages/runtime/src/ui/hearts.ts`. Returns exactly ten entries.
- `ResidenceDef.days: { from: number; to: number; at: 'bed' | 'day'; activity: string }[]` — in `packages/engine/src/types.ts`. `'bed'` means the bed's own anchor position; `'day'` means its `.day` anchor position.
- `SOCIAL.residence.days` and `SOCIAL.residence.at = 95` — OpenWorld content, `games/openworld/content/src/social.ts` (exported `SOCIAL` from `@openworld-game/content`).
- Instance tag `'storybound'` — added to the ontology's list of known instance tags in `games/openworld/content/src/ontology.ts`.
