// A small kitchen garden in Firstlight Village. Fixed placement after scenery
// preserves the rest of the map's seeded composition. The final row is bare for sowing.
import { CROP_STAGES, FIRSTLIGHT, GARDEN_CROPS } from '@lsw/content'
import { MapBuilder, type ItemSpec } from './builder.ts'

export const GARDEN = FIRSTLIGHT.garden

export function plantGarden(m: MapBuilder): void {
  // Scattered cosmetic grass must not occupy a sowing plot.
  m.entities = m.entities.filter((e) => !(['fixture/nature/tuft', 'fixture/nature/flowers', 'fixture/nature/leaves'].includes(e.type) && e.place.on === 'tile'
    && e.place.x >= GARDEN.x && e.place.x < GARDEN.x + GARDEN.width
    && e.place.y >= GARDEN.y && e.place.y < GARDEN.y + GARDEN.height))
  m.rect(GARDEN.x, GARDEN.y, GARDEN.width, GARDEN.height, 'farmland')
  GARDEN_CROPS.forEach((c, column) => {
    CROP_STAGES.forEach((stage, row) => m.fixture(`fixture/crop/${c.id}/${stage}`,
      GARDEN.x + column, GARDEN.y + row, { id: `ford.garden.${c.id}.${stage}` }))
  })
  const seeds: ItemSpec[] = GARDEN_CROPS.flatMap((c) => Array<string>(2).fill(`item/seed/${c.id}`))
  m.fixture('fixture/container/crate', ...GARDEN.supplies, {
    id: 'ford.garden.supplies', name: { en: 'Garden Supplies', zh: '菜圃工具箱' }, props: { capacity: 24 },
  }, [...seeds, 'item/tool/hoe', 'item/tool/sickle', 'item/vessel/bucket/water', 'item/tool/smith_hammer',
    ...Array<string>(4).fill('item/material/plank'), ...Array<string>(4).fill('item/material/stick'), ...Array<string>(4).fill('item/material/stone')])
  // Stable stock IDs cannot collide with a previously visited meadow's generated items.
  m.entities.filter((e) => e.place.on === 'inside' && e.place.holder === 'ford.garden.supplies')
    .forEach((e, i) => { e.id = `ford.garden.stock.${i}` })
}
