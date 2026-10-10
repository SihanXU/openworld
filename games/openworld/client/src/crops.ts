// Original illustrated crop sprites. Fixtures sit on one tile and can overhang upward;
// icons use the game's 16px inventory grid. Source atlases and prompts live in docs/crops.md.
import { CROP_STAGES, VEGETABLE_CROPS } from '@openworld-game/content'
import type { Catalog, SpriteDef } from '@openworld/runtime/src/assets/types.ts'

function sprite(id: string, part: string): SpriteDef {
  const plant = (CROP_STAGES as readonly string[]).includes(part)
  const h = plant ? 24 : 16
  return { img: `lsw/Crops/${id}/${part}.png`, x: 0, y: 0, w: 16, h, ax: 8, ay: h }
}

export const CROP_FIXTURES: Catalog['fixtures'] = Object.fromEntries(
  VEGETABLE_CROPS.flatMap((c) => CROP_STAGES.map((stage) => [`fixture:${c.id}_${stage}`, { base: sprite(c.id, stage) }])),
)

export const CROP_ITEMS: Record<string, SpriteDef> = Object.fromEntries(
  VEGETABLE_CROPS.flatMap((c) => [
    [`item:${c.id}`, sprite(c.id, 'produce')],
    [`item:${c.id}_seed`, sprite(c.id, 'seeds')],
  ]),
)
