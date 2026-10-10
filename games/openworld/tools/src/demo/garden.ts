// A small kitchen garden in Firstlight Village. Fixed placement after scenery
// preserves the rest of the map's seeded composition. The final row is bare for sowing.
import { CROP_STAGES, FIRSTLIGHT, GARDEN_CROPS } from '@openworld-game/content'
import { MapBuilder, type ItemSpec } from './builder.ts'

export const GARDEN = FIRSTLIGHT.garden

/** Terrains drawn as trees: their canopies (up to 48px, the big ones) reach two rows up and a column to each side. */
export const CANOPIES = new Set(['tree', 'tree_autumn', 'tree_blossom', 'pine', 'pine_snow', 'charred_tree'])

/** The cells from which a canopy would reach over a rect: beside it and the two rows south of it, a column wider on each side. */
function reaching(x0: number, y0: number, w: number, h: number): [number, number][] {
  const out: [number, number][] = []
  const inside = (x: number, y: number) => x >= x0 && x < x0 + w && y < y0 + h
  for (let y = y0; y < y0 + h + 2; y++) for (let x = x0 - 1; x <= x0 + w; x++) if (!inside(x, y)) out.push([x, y])
  return out
}

/** The cells from which a canopy would hide a plot or the supplies crate. */
export function reachingPlots(): [number, number][] {
  return [...reaching(GARDEN.x, GARDEN.y, GARDEN.width, GARDEN.height), ...reaching(...GARDEN.supplies, 1, 1)]
}

export function plantGarden(m: MapBuilder): void {
  // Scattered cosmetic grass must not occupy a sowing plot.
  m.entities = m.entities.filter((e) => !(['fixture/nature/tuft', 'fixture/nature/flowers', 'fixture/nature/leaves'].includes(e.type) && e.place.on === 'tile'
    && e.place.x >= GARDEN.x && e.place.x < GARDEN.x + GARDEN.width
    && e.place.y >= GARDEN.y && e.place.y < GARDEN.y + GARDEN.height))
  m.rect(GARDEN.x, GARDEN.y, GARDEN.width, GARDEN.height, 'farmland')
  // A tree beside or just south of the garden would hide a plot (or the supplies crate) under its canopy, and the pointer there meets the tree.
  for (const [x, y] of reachingPlots()) if (CANOPIES.has(m.get(x, y))) m.set(x, y, 'grass')
  GARDEN_CROPS.forEach((c, column) => {
    CROP_STAGES.forEach((stage, row) => m.fixture(`fixture/crop/${c.id}/${stage}`,
      GARDEN.x + column, GARDEN.y + row, { id: `ford.garden.${c.id}.${stage}` }))
  })
  const seeds: ItemSpec[] = GARDEN_CROPS.flatMap((c) => Array<string>(2).fill(`item/seed/${c.id}`))
  m.fixture('fixture/container/crate', ...GARDEN.supplies, {
    id: 'ford.garden.supplies', name: { en: 'Garden Supplies', zh: '菜圃工具箱' }, props: { capacity: 24, maxHp: 12, hp: 12 },
  }, [...seeds, 'item/tool/hoe', 'item/tool/sickle', 'item/vessel/bucket/water', 'item/tool/smith_hammer',
    ...Array<string>(4).fill('item/material/plank'), ...Array<string>(4).fill('item/material/stick'), ...Array<string>(4).fill('item/material/stone')])
  // Stable stock IDs cannot collide with a previously visited meadow's generated items.
  m.entities.filter((e) => e.place.on === 'inside' && e.place.holder === 'ford.garden.supplies')
    .forEach((e, i) => { e.id = `ford.garden.stock.${i}` })
}
