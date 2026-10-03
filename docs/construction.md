# Construction and the kitchen garden

B toggles a live-world construction palette. Choose Structures or Farming, choose a
recipe, move next to a tile and left click (or press E). Green means valid; red shows
an occupied tile, unsuitable target, missing material/tool or an out-of-reach target.
B, Escape or right click leaves the mode. WASD still moves; Space and the normal
use/put inputs do not attack or drop equipment while the palette is active. Menus,
dialogues, questions and scenes close the palette. Building mode does not pause time.

The inspiration is the gather-materials / craft-structures interaction described by
[Klei's Don't Starve overview](https://support.klei.com/hc/en-us/articles/360029554792-What-is-Don-t-Starve).
Recipes, game objects, artwork and world rules remain this project's own.

## Initial structures

| Structure | Consumed materials | Required tool | Use |
|---|---|---|---|
| Campfire | 2 stones, 2 sticks | none | Built unlit; use a torch to light it, then cook and shelter at night |
| Crate | 2 planks | hammer | 6-item storage, E to open after leaving build mode |
| Wooden chest | 4 planks | hammer | 12-item storage |
| Fence | 2 sticks | hammer | Blocks passage, repeat placement for a boundary |
| Sign | 1 stick, 1 plank | hammer | Blank sign; existing quill + ink interaction writes on it |

Tools are retained. Resources must be in the actor's bag or hand, not in nearby
containers. Occupied tiles (including the actor's own tile) cannot hold a building.
Built structures are ordinary saved world entities; storage, lighting, collision,
ownership, fire and dismantling use their existing rules. A completed chest or crate
is dismantled with an axe and returns half its planks, as before.

`content/src/construction.ts` contains palette data and sequences of existing rule IDs.
`engine/src/placement.ts` checks the actor, reach, site and carried items, rehearses
the entire sequence in a deterministic cloned engine, then executes those same
interactions. No new effect primitive and no client-side resource spending. A
missing or overridden rule refuses the recipe before any material is spent. The
planner works for any actor, not just the player.

The C crafting panel also offers stone hoes, sickles and hammers, plus a wooden
bucket. Logs split into planks with an axe using the existing woodworking rule.

## Four original crops

Carrot, turnip, tomato and pumpkin each have three visible stages, an edible
harvest and a distinct seed pouch. [Crop art and exact imagegen prompts](crop-art.md).
Their food restores 3, 4, 2 and 6 hunger respectively through the existing eating rule.

1. Till empty diggable soil with a hoe.
2. Sow one seed on empty farmland.
3. Water the sprout. After two game hours it becomes a young plant.
4. Refill the empty bucket at a river or well, then water again.
5. After another two hours, use Harvest with a sickle: two produce and two seeds
   (ash fertilizer increases produce by one). Hand picking with F still works,
   yielding one produce and one seed.

Tomato plants regrow from the young stage after harvest. The other vegetables leave
an empty farmland tile. Watered stages cannot be watered twice; an unwatered plant
does not advance. Each game hour is 600 ticks, approximately one minute of play.

A new game's garden is in Firstlight Village (the former meadow, stable ID `meadow`),
x26–29 / y22–25, with all three stages shown and the bottom row empty for sowing.
Its tool crate at (31,23)
contains two seed pouches per crop, a hoe, sickle, full bucket, hammer, and four each
of planks, sticks and stones (24 item instances, matching its capacity). Nothing is
placed in the player's bag automatically. Existing gardens and remaining supplies move
from the Ford without resetting inventories or respawning harvested crops. The Ford
no longer contains authored farmland. [Village layout and save migration](firstlight-village.md).

## Verification

Regression coverage includes all five structure sequences, exact costs, retained
tools, non-player actors, invalid/occupied/frozen/distant targets, no-spend rule
failures, four complete crop lifecycles, refill, regrowth and selected bucket
preservation. The real demo test opens its supply crate, sows/waters a crop, builds
and opens a chest and saves/reloads both. Asset tests cover 20 native-resolution
RGBA sprites, four retained source atlases and every palette sprite reference.

Final checks: `npm run check` (258 tests), `npm run build`, `npm run coverage`,
`npm run check:world` (two game days, no off-schedule NPCs), and 61 isolated DOM /
placement / sprite browser assertions. Full-game automated browser startup was
unreliable under accelerated headless rendering; the DOM check therefore loads
the actual generated map and real engine directly, not a mocked spending system.
