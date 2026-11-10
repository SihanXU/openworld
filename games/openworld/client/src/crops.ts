// Original illustrated crop sprites. Fixtures sit on one tile and can overhang upward;
// icons use the game's 16px inventory grid. Source atlases and prompts live in docs/crops.md.
import { CROP_STAGES, FLOWER_CROPS, VEGETABLE_CROPS } from '@openworld-game/content'
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

/** Existing pack flower variants, not generated species portraits. */
const nature = (x: number, y: number): SpriteDef => ({ img: 'Backgrounds/Tilesets/TilesetNature.png', x: x * 16, y: y * 16, w: 16, h: 16, ax: 8, ay: 16 })
export const FLOWER_FIXTURES: Catalog['fixtures'] = Object.fromEntries(FLOWER_CROPS.flatMap(c => [
  ['fixture:' + c.id + '_sprout', { base: nature(7, 10) }],
  ['fixture:' + c.id + '_young', { base: nature(8, 10) }],
  ['fixture:' + c.id + '_ripe', { base: nature(c.flowerTile[0], c.flowerTile[1]) }],
]))
export const FLOWER_ITEMS: Record<string, SpriteDef> = Object.fromEntries(FLOWER_CROPS.flatMap(c => [
  ['item:' + c.id, nature(c.flowerTile[0], c.flowerTile[1])],
  ['item:' + c.id + '_seed', nature(6, 10)],
]))
