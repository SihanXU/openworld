# Skill tree: lay out the start in the middle with four branch panels growing left, right, up and down, with branch tabs

## What is wanted

The skill tree is currently laid out radially: each branch is a sector around the start and its skills sit on rings. This is hard to read, especially for deep branches such as a profession's, where nodes crowd together.

Lay each direction of the tree out like the talent grids of action RPGs (Diablo II, World of Warcraft):

- The start is in the middle, and the direction's four branches grow out from it like a cross: left, right, up and down.
- Each branch has a panel of its own. Its hub is nearest the start, and its skills sit in rows going outward by depth, so what a skill needs is always in the row before it.
- Within a branch, columns follow a tidy tree: each leaf gets its own column, a skill is centred over the skills that grow from it, and a capstone that joins two arms sits between them (unless another skill already stands there in its row).
- The narrow branches go left and right, near the start. The wide ones go up and down, past the side ones, so no panel overlaps another.
- Links are square elbows (out from the previous node, across, then out into the next), not curves. The trunks from the start to the hubs follow the same rule.
- The overview fits the whole cross. Branch tabs sit under the direction tabs: "All" plus one per branch. Choosing a tab, or clicking a hub, closes in on that branch's panel at a readable zoom. "All" returns to the overview. The selected tab is marked.
- The view must be able to zoom out far enough to fit the whole cross, and the overview must not sit under the tab bar.

## Expected behaviour

- For each direction, the branches use all four ways (left, right, up, down) between them. Each branch's hub lies at a positive distance from the start along its own way.
- For every skill, its position along its branch's way is farther out than the position of each thing it requires (the parents, or the branch hub for a first skill).
- Every layout position (the start at 0,0, all hubs and all skill nodes) is more than 90 units from every other. This holds for each direction with no profession and with the assassin, warrior, ranger and mage professions.
- No two branch panels overlap (touching edges are allowed), for every direction and profession above.
- The existing `layoutBranches(direction)` and `layoutSkills(skills, direction, profession)` still work, returning the hub and skill positions of the new layout. `layoutBranches` must also accept an optional skill list and profession so the hubs match the profession's layout.
- A profession's branch, with its extra skills, is laid out with the same rules and fits its own panel.

## Requirements

- Positions are `{ x, y }` only (the old polar `angle` is gone).
- Depth: a skill with no prerequisites in its branch is row 0, otherwise one row below its deepest prerequisite in that branch.
- Branches are assigned ways in the order of the direction's branch list, cycling left, right, up, down.
- Each branch's hub sits straight behind the middle of its first-row skills, so the line into the branch is straight.
- Panel size follows the branch's columns, and its extent runs from just before the hub to past the last row.
- Up/down branches are pushed out far enough that their panels clear the side branches' panels.
- Links to prerequisites that are not in the layout (for example, another profession's) are skipped rather than crashing.
- The layout updates when the direction or profession changes.
- The page's tabs use the existing styling conventions, are labelled in English and Chinese, and the branch name appears with its icon.

## Interface

In `packages/client/src/ui/skillLayout.ts`:

- `layoutTree(skills?: SkillDef[], direction?: SkillDirection, profession?: string): TreeLayout` — defaults are `SKILLS`, `'combat'`, `''`.
- `interface TreeLayout { hubs: Map<string, Placed>; nodes: Map<string, Placed>; panels: Map<string, Panel>; ways: Map<string, Way> }` — keyed by branch id for `hubs`, `panels` and `ways`, and by skill id for `nodes`.
- `interface Panel { x: number; y: number; w: number; h: number }` — a branch's frame (top-left corner and size).
- `type Way = 'left' | 'right' | 'up' | 'down'` — which way a branch grows from the start.
- `interface Placed { x: number; y: number }` (the `angle` field is removed).
- `const COL: number` and `const ROW: number` — the distance across one column and down one row of a branch, exported.
- `layoutBranches(direction: SkillDirection, skills?: SkillDef[], profession?: string): Map<string, Placed>` — extended with the optional parameters.
- `layoutSkills(skills?, direction?, profession?)` keeps its signature, returning the skill positions.

In `packages/client/src/ui/skilltree.ts`:

- `SkillTree.focus(branch: string): void` — closes in on one branch's panel.
