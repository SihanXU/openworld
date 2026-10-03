import type { PlacementNeed, PlacementRecipe, Text } from '@lsw/engine'
import { VEGETABLE_CROPS } from './crops.ts'

const text = (en: string, zh: string): Text => ({ en, zh })
const material = (id: string, en: string, zh: string, count: number): PlacementNeed =>
  ({ match: { type: `item/material/${id}` }, name: text(en, zh), sprite: `item:${id}`, count, consume: true })
const tool = (tag: string, en: string, zh: string, sprite: string): PlacementNeed =>
  ({ match: { tags: [tag] }, name: text(en, zh), sprite, count: 1 })
const hammer = tool('tool:hammer', 'Hammer', '锤子', 'item:hammer')
const put = (need: number, rule: string, target?: 'tile'): PlacementRecipe['steps'][number] => ({ need, rule, verb: 'put', target })
const hit = (need: number, rule: string): PlacementRecipe['steps'][number] => ({ need, rule, verb: 'interact' })
const building = (id: string, en: string, zh: string, descEn: string, descZh: string, result: string, needs: PlacementNeed[], steps: PlacementRecipe['steps']): PlacementRecipe =>
  ({ id, category: 'building', name: text(en, zh), description: text(descEn, descZh), sprite: `fixture:${id}`,
    target: 'tile', site: { tags: ['ground'], notTags: ['solid', 'liquid'] }, empty: 'all', result, needs, steps })

export const BUILDINGS: PlacementRecipe[] = [
  building('campfire', 'Campfire', '营火', 'Light with a torch; warmth, cooking and a safe night.', '建好后用火把点燃，可取暖、烹饪、照亮夜晚。', 'fixture/light/campfire',
    [material('stone', 'Stone', '石头', 2), material('stick', 'Stick', '树枝', 2)],
    [put(0, 'core/put-down', 'tile'), put(0, 'build/ring'), put(1, 'build/ring-stick'), put(1, 'build/campfire')]),
  building('crate', 'Crate', '板条箱', 'Compact storage. Leave build mode and press E to open.', '小型储物空间。退出建筑模式后按 E 打开。', 'fixture/container/crate',
    [material('plank', 'Plank', '木板', 2), hammer], [put(0, 'core/put-down', 'tile'), put(0, 'build/start-frame'), hit(1, 'build/finish-crate')]),
  building('chest', 'Wooden Chest', '木箱', 'Larger storage for a growing camp.', '更大的储物空间，适合营地物资。', 'fixture/container/chest',
    [material('plank', 'Plank', '木板', 4), hammer], [put(0, 'core/put-down', 'tile'), put(0, 'build/start-frame'), put(0, 'build/add-plank'), put(0, 'build/add-plank'), hit(1, 'build/finish-chest')]),
  building('fence', 'Fence', '栅栏', 'Blocks passage. Place several to mark a garden.', '阻挡通行，可连续放置围出菜圃。', 'fixture/fence',
    [material('stick', 'Stick', '树枝', 2), hammer], [put(0, 'core/put-down', 'tile'), put(0, 'build/stakes'), hit(1, 'build/fence')]),
  building('sign', 'Sign', '路牌', 'A blank sign; write on it with a quill and ink.', '空白路牌，携带墨水后可用羽毛笔题字。', 'fixture/sign',
    [material('stick', 'Stick', '树枝', 1), material('plank', 'Plank', '木板', 1), hammer], [put(0, 'core/put-down', 'tile'), put(1, 'build/post'), hit(2, 'build/sign')]),
]

export const FARMING: PlacementRecipe[] = [
  { id: 'till', category: 'farming', name: text('Till Soil', '开垦耕地'), sprite: 'item:hoe',
    description: text('Hoe empty soil into farmland.', '用锄头将空地翻成耕地。'), target: 'tile', site: { tags: ['diggable'] }, empty: 'non-actors', excludeTerrain: ['farmland'],
    needs: [tool('tool:hoe', 'Hoe', '锄头', 'item:hoe')], steps: [hit(0, 'core/till')] },
  ...VEGETABLE_CROPS.map((c): PlacementRecipe => ({ id: `sow-${c.id}`, category: 'farming', name: text(`Sow ${c.en}`, `播种${c.zh}`), sprite: `item:${c.id}_seed`,
    description: text('One seed on empty farmland. Water at each growing stage.', '消耗一份种子，在空耕地播种。每个生长阶段都需要浇水。'), target: 'tile', site: { type: 'tile/farmland' }, empty: 'non-actors',
    needs: [{ match: { type: `item/seed/${c.id}` }, name: text(`${c.en} Seeds`, `${c.zh}种子`), sprite: `item:${c.id}_seed`, count: 1, consume: true }], steps: [hit(0, 'farm/sow')] })),
  { id: 'water', category: 'farming', name: text('Water', '浇水'), sprite: 'item:bucket_water',
    description: text('One watering grows one stage after two game hours.', '浇水后两小时成长一阶段；水桶变为空桶。'), target: 'entity', site: { tags: ['crop', 'growing'], notStatus: ['watered'] },
    needs: [tool('liquid:water', 'Water Vessel', '装满水的容器', 'item:bucket_water')], steps: [hit(0, 'farm/water')] },
  { id: 'fill', category: 'farming', name: text('Refill Water', '装水'), sprite: 'item:bucket',
    description: text('Refill an empty vessel at the river or a well.', '靠近河水或水井，将空桶装满。'), target: 'either', site: { tags: ['water-source'] },
    needs: [tool('empty-vessel', 'Empty Vessel', '空容器', 'item:bucket')], steps: [hit(0, 'core/fill-water')] },
  { id: 'harvest', category: 'farming', name: text('Harvest', '收割'), sprite: 'item:sickle',
    description: text('Sickle harvest returns produce and seeds. Tomatoes regrow.', '用镰刀收成熟作物，获得食物与种子；番茄会再生。'), target: 'entity', site: { tags: ['crop', 'ripe'] },
    needs: [tool('tool:sickle', 'Sickle', '镰刀', 'item:sickle')], steps: [{ need: 0, verb: 'interact', rule: ['farm/harvest', 'farm/harvest-perennial'] }] },
]
export const PLACEMENTS = [...BUILDINGS, ...FARMING]
export const PLACEMENT_BY_ID: Record<string, PlacementRecipe> = Object.fromEntries(PLACEMENTS.map((r) => [r.id, r]))
