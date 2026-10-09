// The looks bodies are drawn from (docs/looks.md): the bodies, the parts and the colours of the world's one
// character creator. Every person — the hand-written ones, the crowd, the player, one the modder brings — is a
// look of this table: the map sprite, the portrait and the look's tags and words all come from it.
//
// A part says what slot it fills, which bodies it is drawn for, the colour keys it is painted in (its own,
// `<slot>.<n>`, and the shared skin, hair and eyes), the tags it gives its bearer and the words for it; `gen`
// is how the generator (`generateLook`) weighs it for a person. Its pictures are the client's
// (client/src/assets/looks/: the portrait layers, the map sprite's grids).

import type { Look, LookBodyDef, LookColorDef, LookPartDef, LookTable, Text } from '@lsw/engine'
import { LOOK_TAG, lookColor, lookTags } from '@lsw/engine'

const T = (en: string, zh: string): Text => ({ en, zh })

/** The slots of a look, in the order the words are said. */
export const LOOK_SLOTS = ['hair', 'face', 'beard', 'age', 'mark', 'glasses', 'hat', 'outfit'] as const
export type LookSlot = (typeof LOOK_SLOTS)[number]

export const LOOK_BODIES: Record<string, LookBodyDef> = {
  woman: { name: T('woman', '女人'), sex: 'female', age: 'adult' },
  man: { name: T('man', '男人'), sex: 'male', age: 'adult' },
  girl: { name: T('girl', '女孩'), sex: 'female', age: 'child', tags: [LOOK_TAG + 'child'] },
  boy: { name: T('boy', '男孩'), sex: 'male', age: 'child', tags: [LOOK_TAG + 'child'] },
}

const grey = { hair: [LOOK_TAG + 'grey-haired'] }
const red = { hair: [LOOK_TAG + 'red-haired'] }
const fair = { hair: [LOOK_TAG + 'fair-haired'] }
const dark = { hair: [LOOK_TAG + 'dark-haired'] }

/** Named colours: hair, skin, eyes, cloth, leather and metal. `#rrggbb` is a colour too (the creator's picker); it is called by the nearest named one. */
export const LOOK_COLORS: Record<string, LookColorDef> = {
  // hair
  black: { hex: '#2a2830', name: T('black', '黑'), for: ['hair', 'cloth'], tags: dark },
  raven: { hex: '#232842', name: T('blue-black', '鸦青'), for: ['hair'], tags: dark },
  umber: { hex: '#4a3226', name: T('dark brown', '深棕'), for: ['hair', 'cloth', 'leather'], tags: dark },
  chestnut: { hex: '#7a4a2e', name: T('chestnut', '栗'), for: ['hair'] },
  auburn: { hex: '#8c3a28', name: T('auburn', '赤褐'), for: ['hair'], tags: red },
  copper: { hex: '#b8602e', name: T('copper', '铜'), for: ['hair', 'metal'], tags: red },
  honey: { hex: '#c79348', name: T('honey', '蜜'), for: ['hair'], tags: fair },
  gold: { hex: '#e2c070', name: T('golden', '金'), for: ['hair', 'metal'], tags: fair },
  ash: { hex: '#c4b99c', name: T('ash-blond', '灰金'), for: ['hair'], tags: fair },
  silver: { hex: '#c8cbd6', name: T('silver', '银'), for: ['hair', 'metal'], tags: grey },
  snow: { hex: '#ebe8e2', name: T('white', '白'), for: ['hair', 'cloth'], tags: grey },
  steelgrey: { hex: '#85848b', name: T('grey', '灰'), for: ['hair', 'cloth'], tags: grey },
  lilac: { hex: '#a28ac4', name: T('lilac', '淡紫'), for: ['hair', 'eyes'] },
  rose: { hex: '#c97b8c', name: T('rose', '蔷薇'), for: ['hair', 'cloth'] },
  // skin
  porcelain: { hex: '#f7e4d8', name: T('pale', '白皙'), for: ['skin'] },
  fair: { hex: '#f2d3be', name: T('fair', '白净'), for: ['skin'] },
  light: { hex: '#e8bf9f', name: T('light', '浅'), for: ['skin'] },
  warm: { hex: '#d9a47f', name: T('warm', '暖'), for: ['skin'] },
  tan: { hex: '#bf855f', name: T('tanned', '黝'), for: ['skin'] },
  brown: { hex: '#93603f', name: T('brown', '棕'), for: ['skin'] },
  deep: { hex: '#6b4430', name: T('dark', '深'), for: ['skin'] },
  // eyes
  hazel: { hex: '#7b6a34', name: T('hazel', '榛'), for: ['eyes'] },
  amber: { hex: '#b9772a', name: T('amber', '琥珀'), for: ['eyes'] },
  bark: { hex: '#6b4129', name: T('brown', '褐'), for: ['eyes'] },
  leaf: { hex: '#4f8a4f', name: T('green', '绿'), for: ['eyes', 'cloth'] },
  sky: { hex: '#4a74b0', name: T('blue', '蓝'), for: ['eyes'] },
  storm: { hex: '#6f7a88', name: T('grey', '灰'), for: ['eyes'] },
  violet: { hex: '#7c5aa6', name: T('violet', '紫'), for: ['eyes'] },
  ember: { hex: '#b03a32', name: T('red', '赤'), for: ['eyes'] },
  // cloth
  linen: { hex: '#d9cfb6', name: T('linen', '亚麻'), for: ['cloth'] },
  undyed: { hex: '#b5a585', name: T('undyed', '本白'), for: ['cloth'] },
  russet: { hex: '#94492c', name: T('russet', '赭红'), for: ['cloth'] },
  madder: { hex: '#a23a3a', name: T('red', '茜红'), for: ['cloth'] },
  ochre: { hex: '#c0993c', name: T('ochre', '赭黄'), for: ['cloth'] },
  mustard: { hex: '#b3912f', name: T('mustard', '芥黄'), for: ['cloth'] },
  moss: { hex: '#66784a', name: T('moss', '苔绿'), for: ['cloth'] },
  forest: { hex: '#3f5a3a', name: T('dark green', '墨绿'), for: ['cloth'] },
  teal: { hex: '#3d7472', name: T('teal', '青'), for: ['cloth'] },
  woad: { hex: '#4a6290', name: T('blue', '菘蓝'), for: ['cloth'] },
  indigo: { hex: '#323f5e', name: T('indigo', '靛'), for: ['cloth'] },
  plum: { hex: '#6a3f5e', name: T('plum', '梅紫'), for: ['cloth'] },
  slate: { hex: '#5a6370', name: T('slate', '石板灰'), for: ['cloth'] },
  charcoal: { hex: '#393940', name: T('charcoal', '炭灰'), for: ['cloth'] },
  ivory: { hex: '#ece6d6', name: T('white', '象牙白'), for: ['cloth'] },
  // leather and metal
  leather: { hex: '#7a5132', name: T('leather', '皮革'), for: ['leather', 'cloth'] },
  darkleather: { hex: '#47301f', name: T('dark leather', '深色皮革'), for: ['leather'] },
  iron: { hex: '#878d97', name: T('iron', '铁'), for: ['metal'] },
  steel: { hex: '#aab1bc', name: T('steel', '钢'), for: ['metal'] },
  bronze: { hex: '#a6733a', name: T('bronze', '青铜'), for: ['metal'] },
}

/** How the generator weighs a part for a person: whose it is, at what ages, for which roles, and its colours. */
export interface LookGen {
  /** Base weight (default 1; 0: never picked by chance, only given). */
  w?: number
  sex?: 'female' | 'male'
  /** The ages it is picked for: [from, to]. */
  ages?: [number, number]
  /** Roles it suits: picked for them eight times as often, and for others only at its base weight if `only` is not set. */
  roles?: string[]
  only?: boolean
  /** The colours its own keys are picked from (`1` → colour ids). */
  colors?: Record<string, string[]>
}

export interface LookPart extends LookPartDef {
  /** The words for it, `{c}` its first colour's name (the hair's for hair and beards, its own `1` for the rest). */
  say: Text
  gen?: LookGen
}

const SKIN_EYES_HAIR = ['eyes', 'hair'] as LookPartDef['uses']
const ADULTS = ['woman', 'man']
const CHILDREN = ['girl', 'boy']
const CLOTH_PLAIN = ['linen', 'undyed', 'russet', 'ochre', 'moss', 'woad', 'slate', 'umber']
const CLOTH_DYED = ['madder', 'mustard', 'forest', 'teal', 'indigo', 'plum', 'rose', 'ivory']

/** The parts (docs/looks.md §3). */
export const LOOK_PARTS: Record<string, LookPart> = {
  // ---------------------------------------------------------------- faces: eyes, brows, mouth (with every mood)
  'face.soft': { slot: 'face', name: T('soft eyes', '温柔的眼睛'), bodies: ADULTS, uses: SKIN_EYES_HAIR, say: T('soft {c} eyes', '温柔的{c}色眼睛'), gen: { sex: 'female' } },
  'face.bright': { slot: 'face', name: T('bright eyes', '明亮的眼睛'), bodies: ADULTS, uses: SKIN_EYES_HAIR, say: T('bright {c} eyes', '明亮的{c}色眼睛'), gen: { ages: [14, 40] } },
  'face.keen': { slot: 'face', name: T('keen eyes', '锐利的眼睛'), bodies: ADULTS, uses: SKIN_EYES_HAIR, say: T('keen {c} eyes', '锐利的{c}色眼睛') },
  'face.stern': { slot: 'face', name: T('stern brows', '严肃的浓眉'), bodies: ADULTS, uses: SKIN_EYES_HAIR, tags: [LOOK_TAG + 'stern'], say: T('heavy brows over {c} eyes', '浓眉下一双{c}色眼睛'), gen: { sex: 'male', ages: [25, 99] } },
  'face.weary': { slot: 'face', name: T('heavy-lidded eyes', '倦怠的眼睛'), bodies: ADULTS, uses: SKIN_EYES_HAIR, say: T('heavy-lidded {c} eyes', '眼皮沉沉的{c}色眼睛'), gen: { ages: [40, 99] } },
  'face.child': { slot: 'face', name: T('wide eyes', '圆圆的眼睛'), bodies: CHILDREN, uses: SKIN_EYES_HAIR, say: T('wide {c} eyes', '圆圆的{c}色眼睛') },

  // ---------------------------------------------------------------- hair (front and back)
  'hair.short': { slot: 'hair', name: T('short hair', '短发'), bodies: ADULTS, uses: ['hair'], say: T('short {c} hair', '{c}色短发'), gen: { sex: 'male' } },
  'hair.messy': { slot: 'hair', name: T('tousled hair', '乱发'), bodies: ADULTS, uses: ['hair'], say: T('tousled {c} hair', '乱蓬蓬的{c}发'), gen: { ages: [14, 50] } },
  'hair.swept': { slot: 'hair', name: T('swept-back hair', '背头'), bodies: ADULTS, uses: ['hair'], say: T('{c} hair swept back', '向后梳的{c}发'), gen: { sex: 'male', ages: [25, 99] } },
  'hair.cropped': { slot: 'hair', name: T('cropped hair', '寸头'), bodies: ADULTS, uses: ['hair'], say: T('cropped {c} hair', '剃短的{c}发'), gen: { sex: 'male', roles: ['guard', 'soldier', 'trainer', 'smith'] } },
  'hair.thin': { slot: 'hair', name: T('thinning hair', '稀疏的头发'), bodies: ['man'], uses: ['hair'], tags: [LOOK_TAG + 'balding'], say: T('thinning {c} hair', '稀疏的{c}发'), gen: { sex: 'male', ages: [50, 99] } },
  'hair.tied': { slot: 'hair', name: T('hair tied back', '束在脑后的长发'), bodies: ADULTS, uses: ['hair'], tags: [LOOK_TAG + 'long-haired'], say: T('long {c} hair tied back', '束在脑后的{c}色长发') },
  'hair.bob': { slot: 'hair', name: T('bob', '齐耳短发'), bodies: ADULTS, uses: ['hair'], say: T('a {c} bob', '{c}色齐耳短发'), gen: { sex: 'female', ages: [14, 60] } },
  'hair.long': { slot: 'hair', name: T('long hair', '长发'), bodies: ADULTS, uses: ['hair'], tags: [LOOK_TAG + 'long-haired'], say: T('long {c} hair', '{c}色长发'), gen: { sex: 'female', ages: [14, 50] } },
  'hair.wavy': { slot: 'hair', name: T('wavy hair', '卷发'), bodies: ADULTS, uses: ['hair'], tags: [LOOK_TAG + 'long-haired'], say: T('wavy {c} hair', '{c}色卷发'), gen: { sex: 'female', ages: [14, 50] } },
  'hair.braid': { slot: 'hair', name: T('braid', '麻花辫'), bodies: ADULTS, uses: ['hair'], tags: [LOOK_TAG + 'long-haired'], say: T('a {c} braid over the shoulder', '搭在肩上的{c}色麻花辫'), gen: { sex: 'female' } },
  'hair.bun': { slot: 'hair', name: T('bun', '发髻'), bodies: ADULTS, uses: ['hair'], say: T('{c} hair in a bun', '盘起的{c}发髻'), gen: { sex: 'female', ages: [30, 99] } },
  'hair.ponytail': { slot: 'hair', name: T('ponytail', '马尾'), bodies: ADULTS, uses: ['hair'], tags: [LOOK_TAG + 'long-haired'], say: T('a {c} ponytail', '{c}色马尾'), gen: { ages: [14, 45] } },
  'hair.pigtails': { slot: 'hair', name: T('pigtails', '双辫'), bodies: CHILDREN, uses: ['hair'], say: T('{c} pigtails', '{c}色双辫'), gen: { sex: 'female' } },
  'hair.tuft': { slot: 'hair', name: T('tufty hair', '翘发'), bodies: CHILDREN, uses: ['hair'], say: T('tufty {c} hair', '翘翘的{c}发'), gen: { sex: 'male' } },
  'hair.childbob': { slot: 'hair', name: T('bowl cut', '锅盖头'), bodies: CHILDREN, uses: ['hair'], say: T('a {c} bowl cut', '{c}色锅盖头') },

  // ---------------------------------------------------------------- beards, age, marks, glasses
  'beard.full': { slot: 'beard', name: T('full beard', '络腮胡'), bodies: ['man'], uses: ['hair'], tags: [LOOK_TAG + 'bearded'], say: T('a full {c} beard', '一把{c}色络腮胡'), gen: { ages: [30, 99] } },
  'beard.moustache': { slot: 'beard', name: T('moustache', '八字胡'), bodies: ['man'], uses: ['hair'], tags: [LOOK_TAG + 'bearded'], say: T('a {c} moustache', '{c}色八字胡'), gen: { ages: [25, 99] } },
  'beard.stubble': { slot: 'beard', name: T('stubble', '胡茬'), bodies: ['man'], uses: ['hair'], say: T('{c} stubble', '{c}色胡茬'), gen: { ages: [20, 70] } },
  'age.lined': { slot: 'age', name: T('lined face', '皱纹'), bodies: ADULTS, uses: ['skin'], tags: [LOOK_TAG + 'old'], say: T('a lined face', '满脸皱纹'), gen: { ages: [55, 999] } },
  'mark.scar': { slot: 'mark', name: T('scar', '伤疤'), bodies: ADULTS, uses: ['skin'], tags: [LOOK_TAG + 'scarred'], say: T('a scar across the cheek', '脸颊上一道伤疤'), gen: { w: 0.3, roles: ['guard', 'soldier', 'smith', 'hunter', 'trainer'] } },
  'mark.freckles': { slot: 'mark', name: T('freckles', '雀斑'), uses: ['skin'], tags: [LOOK_TAG + 'freckled'], say: T('freckles', '一脸雀斑'), gen: { w: 0.5, ages: [5, 35] } },
  'glasses.round': { slot: 'glasses', name: T('round spectacles', '圆眼镜'), bodies: ADULTS, colors: { 1: 'bronze' }, tags: [LOOK_TAG + 'spectacled'], say: T('round spectacles', '一副圆眼镜'), gen: { w: 0.1, roles: ['scholar'], ages: [16, 99], colors: { 1: ['bronze', 'iron', 'gold'] } } },

  // ---------------------------------------------------------------- hats
  'hat.straw': { slot: 'hat', name: T('straw hat', '草帽'), bodies: ADULTS, colors: { 1: 'ochre' }, tags: [LOOK_TAG + 'hatted'], say: T('a straw hat', '一顶草帽'), gen: { roles: ['farmer', 'herder', 'fisher'], only: true, colors: { 1: ['ochre', 'mustard', 'linen'] } } },
  'hat.kerchief': { slot: 'hat', name: T('headscarf', '头巾'), bodies: ['woman'], colors: { 1: 'russet' }, say: T('a {c} headscarf', '{c}色头巾'), gen: { sex: 'female', ages: [35, 99], roles: ['farmer', 'elder', 'innkeeper', 'ferrykeeper', 'villager'], colors: { 1: CLOTH_PLAIN } } },
  'hat.hood': { slot: 'hat', name: T('hood', '兜帽'), bodies: ADULTS, colors: { 1: 'charcoal' }, tags: [LOOK_TAG + 'hooded'], say: T('a {c} hood', '{c}色兜帽'), gen: { roles: ['stranger', 'traveler', 'hunter'], only: true, colors: { 1: ['charcoal', 'slate', 'umber', 'forest'] } } },
  'hat.helm': { slot: 'hat', name: T('helmet', '头盔'), bodies: ['man'], colors: { 1: 'iron' }, tags: [LOOK_TAG + 'helmeted'], say: T('an {c} helmet', '{c}头盔'), gen: { roles: ['guard', 'soldier'], only: true, colors: { 1: ['iron', 'steel'] } } },
  'hat.cap': { slot: 'hat', name: T('cap', '便帽'), bodies: ADULTS, colors: { 1: 'umber', 2: 'darkleather' }, tags: [LOOK_TAG + 'hatted'], say: T('a {c} cap', '{c}色便帽'), gen: { roles: ['miller', 'peddler', 'sailor', 'villager'], colors: { 1: CLOTH_PLAIN } } },

  // ---------------------------------------------------------------- outfits (1: main cloth, 2: second cloth, 3: leather or metal)
  'outfit.dress': { slot: 'outfit', name: T('village dress', '村妇长裙'), bodies: ['woman'], colors: { 1: 'woad', 2: 'linen' }, say: T('a {c} dress', '{c}色长裙'), gen: { roles: ['villager', 'elder'], colors: { 1: [...CLOTH_PLAIN, ...CLOTH_DYED], 2: ['linen', 'ivory', 'undyed'] } } },
  'outfit.workdress': { slot: 'outfit', name: T('work dress and apron', '干活的裙子与围裙'), bodies: ['woman'], colors: { 1: 'moss', 2: 'linen', 3: 'leather' }, say: T('a {c} work dress with an apron', '{c}色干活裙配围裙'), gen: { roles: ['farmer', 'herder', 'innkeeper', 'miller'], only: true, colors: { 1: CLOTH_PLAIN, 2: ['linen', 'ivory', 'undyed'] } } },
  'outfit.shawl': { slot: 'outfit', name: T('long dress and shawl', '长裙与披肩'), bodies: ['woman'], colors: { 1: 'plum', 2: 'undyed' }, say: T('a long {c} dress and a shawl', '{c}色长裙，披着披肩'), gen: { ages: [45, 99], roles: ['elder', 'ferrykeeper', 'villager'], colors: { 1: ['plum', 'indigo', 'umber', 'slate', 'forest'], 2: ['undyed', 'linen', 'steelgrey'] } } },
  'outfit.oilcloth': { slot: 'outfit', name: T('oilcloth coat', '油布外衣'), bodies: ADULTS, colors: { 1: 'ochre', 2: 'umber' }, say: T('a {c} oilcloth coat', '{c}色油布外衣'), gen: { roles: ['ferrykeeper', 'fisher', 'sailor'], only: true, colors: { 1: ['ochre', 'mustard', 'slate'] } } },
  'outfit.robe': { slot: 'outfit', name: T("herbalist's robe", '草药师长袍'), bodies: ['woman'], colors: { 1: 'forest', 2: 'linen', 3: 'leather' }, say: T("a {c} herbalist's robe", '{c}色草药师长袍'), gen: { roles: ['herbalist', 'mage'], only: true, colors: { 1: ['forest', 'moss', 'teal', 'plum'] } } },
  'outfit.coat': { slot: 'outfit', name: T("scholar's coat", '学者长外套'), bodies: ADULTS, colors: { 1: 'indigo', 2: 'ivory', 3: 'bronze' }, say: T('a long {c} coat', '{c}色长外套'), gen: { roles: ['scholar', 'noble', 'steward'], only: true, colors: { 1: ['indigo', 'plum', 'forest', 'charcoal'] } } },
  'outfit.vestment': { slot: 'outfit', name: T('vestment', '祭衣'), bodies: ADULTS, colors: { 1: 'ivory', 2: 'madder', 3: 'gold' }, tags: [LOOK_TAG + 'robed'], say: T('a {c} vestment with a stole', '{c}色祭衣与圣带'), gen: { roles: ['priest'], only: true, colors: { 1: ['ivory', 'snow', 'charcoal'], 2: ['madder', 'indigo'] } } },
  'outfit.tunic': { slot: 'outfit', name: T('tunic', '束腰短衣'), bodies: ['man'], colors: { 1: 'moss', 2: 'umber', 3: 'leather' }, say: T('a {c} tunic', '{c}色短衣'), gen: { roles: ['villager', 'herder', 'traveler'], colors: { 1: [...CLOTH_PLAIN, ...CLOTH_DYED] } } },
  'outfit.workshirt': { slot: 'outfit', name: T('work shirt', '挽袖衬衫'), bodies: ['man'], colors: { 1: 'linen', 2: 'umber', 3: 'leather' }, say: T('a {c} shirt, sleeves rolled', '挽起袖子的{c}色衬衫'), gen: { roles: ['farmer', 'miller', 'villager', 'herder'], colors: { 1: ['linen', 'undyed', 'ochre', 'woad'], 2: ['umber', 'slate', 'moss'] } } },
  'outfit.apron': { slot: 'outfit', name: T("smith's apron", '铁匠皮围裙'), bodies: ['man'], colors: { 1: 'darkleather', 2: 'linen', 3: 'umber' }, tags: [LOOK_TAG + 'bare-armed'], say: T("a {c} smith's apron, arms bare", '{c}铁匠围裙，光着胳膊'), gen: { roles: ['smith', 'miner'], only: true, colors: { 1: ['darkleather', 'leather'] } } },
  'outfit.travel': { slot: 'outfit', name: T('travelling coat', '旅行外套'), bodies: ADULTS, colors: { 1: 'russet', 2: 'linen', 3: 'leather' }, say: T('a {c} travelling coat with satchel straps', '{c}色旅行外套，斜挎包带'), gen: { roles: ['peddler', 'traveler', 'merchant', 'bard'], only: true, colors: { 1: ['russet', 'mustard', 'teal', 'madder', 'umber'] } } },
  'outfit.gambeson': { slot: 'outfit', name: T('gambeson and tabard', '棉甲与罩袍'), bodies: ['man'], colors: { 1: 'madder', 2: 'undyed', 3: 'iron' }, tags: [LOOK_TAG + 'armoured'], say: T("a guard's {c} tabard over a gambeson", '棉甲外罩{c}色卫兵罩袍'), gen: { roles: ['guard', 'soldier'], only: true, colors: { 1: ['madder', 'woad', 'forest'] } } },
  'outfit.plate': { slot: 'outfit', name: T('plate and surcoat', '板甲与罩衣'), bodies: ['man'], colors: { 1: 'ivory', 2: 'gold', 3: 'steel' }, tags: [LOOK_TAG + 'armoured'], say: T('plate armour under a {c} surcoat', '板甲外罩{c}色罩衣'), gen: { roles: ['guard', 'soldier', 'noble'], only: true, w: 0.3, colors: { 1: ['ivory', 'madder', 'indigo'] } } },
  'outfit.gi': { slot: 'outfit', name: T("drillmaster's wrap", '武师短褂'), bodies: ['man'], colors: { 1: 'undyed', 2: 'umber' }, say: T("a {c} drillmaster's wrap", '{c}色武师短褂'), gen: { roles: ['trainer'], only: true } },
  'outfit.cloak': { slot: 'outfit', name: T('long cloak', '长斗篷'), bodies: ADULTS, colors: { 1: 'charcoal', 2: 'slate', 3: 'leather' }, tags: [LOOK_TAG + 'cloaked'], say: T('a long {c} cloak', '{c}色长斗篷'), gen: { roles: ['stranger', 'traveler', 'hunter'], only: true, colors: { 1: ['charcoal', 'slate', 'umber', 'forest'] } } },
  'outfit.adventurer': { slot: 'outfit', name: T("adventurer's gear", '冒险者装束'), bodies: ADULTS, colors: { 1: 'teal', 2: 'linen', 3: 'leather' }, say: T("{c} adventurer's gear", '{c}色冒险者装束'), gen: { w: 0, colors: { 1: [...CLOTH_PLAIN, ...CLOTH_DYED] } } },
  'outfit.smock': { slot: 'outfit', name: T("child's smock", '孩子的罩衫'), bodies: CHILDREN, colors: { 1: 'woad', 2: 'linen' }, say: T("a {c} child's smock", '{c}色罩衫'), gen: { colors: { 1: [...CLOTH_PLAIN, ...CLOTH_DYED] } } },
  'outfit.pinafore': { slot: 'outfit', name: T('pinafore dress', '背带裙'), bodies: ['girl'], colors: { 1: 'rose', 2: 'ivory' }, say: T('a {c} pinafore dress', '{c}色背带裙'), gen: { colors: { 1: ['rose', 'madder', 'woad', 'moss', 'mustard'] } } },
}

export const LOOK_TABLE: LookTable = {
  slots: [...LOOK_SLOTS],
  bodies: LOOK_BODIES,
  parts: LOOK_PARTS,
  colors: LOOK_COLORS,
}

// ================================================================== the generator

/** What an author chooses of a look: the rest the generator draws (a part `null`: that slot left empty). */
export interface LookPins {
  body?: string
  parts?: Record<string, string | null>
  colors?: Record<string, string>
}

/** Who a look is for: what the generator weighs parts and colours by. */
export interface LookFor {
  sex: 'female' | 'male'
  age: number
  role?: string
}

/** A small seeded random (mulberry32 over a string's hash): the same seed, the same look. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19))
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(r: () => number, items: [T, number][]): T | undefined {
  const total = items.reduce((s, [, w]) => s + w, 0)
  if (total <= 0) return undefined
  let x = r() * total
  for (const [it, w] of items) if ((x -= w) < 0) return it
  return items[items.length - 1][0]
}

/** The body a person has: a child's under fourteen. */
export function bodyFor(who: LookFor): string {
  return who.age < 14 ? (who.sex === 'female' ? 'girl' : 'boy') : who.sex === 'female' ? 'woman' : 'man'
}

/** How a part weighs for a person (0: not for them). */
function weightOf(p: LookPart, body: string, who: LookFor): number {
  const g = p.gen ?? {}
  if (p.bodies && !p.bodies.includes(body)) return 0
  if (g.ages && (who.age < g.ages[0] || who.age > g.ages[1])) return 0
  const suits = !!who.role && !!g.roles?.includes(who.role)
  if (g.only && !suits) return 0
  let w = g.w ?? 1
  if (suits) w = Math.max(w, 1) * 8
  if (g.sex && g.sex !== who.sex) w *= 0.08
  return w
}

const HAIR_YOUNG: [string, number][] = [['black', 3], ['raven', 1], ['umber', 4], ['chestnut', 4], ['auburn', 2], ['copper', 1.5], ['honey', 2], ['gold', 1.5], ['ash', 1.5], ['lilac', 0.3], ['rose', 0.3]]
const HAIR_GREYING: [string, number][] = [['steelgrey', 4], ['silver', 3], ['umber', 1.5], ['ash', 1], ['black', 1]]
const HAIR_OLD: [string, number][] = [['silver', 4], ['snow', 3], ['steelgrey', 3]]
const SKIN: [string, number][] = [['porcelain', 1], ['fair', 3], ['light', 4], ['warm', 3], ['tan', 2], ['brown', 1.2], ['deep', 0.8]]
const EYES: [string, number][] = [['bark', 4], ['hazel', 3], ['amber', 2], ['leaf', 2], ['sky', 2], ['storm', 2], ['violet', 0.4], ['ember', 0.2]]

/** How likely a slot that may stay empty is filled, for a person. */
function chanceOf(slot: string, who: LookFor, body: string): number {
  const child = LOOK_BODIES[body].age === 'child'
  if (slot === 'beard') return who.sex === 'male' && !child ? (who.age >= 40 ? 0.55 : 0.3) : 0
  if (slot === 'age') return who.age >= 55 ? 1 : 0
  if (slot === 'mark') return 0.18
  if (slot === 'glasses') return who.role === 'scholar' ? 0.7 : 0.04
  if (slot === 'hat') return ['guard', 'soldier', 'farmer', 'stranger'].includes(who.role ?? '') ? 0.75 : 0.15
  return 1
}

/**
 * A look for a person, from a seed (their id: the same person, the same look): a body by sex and age, a part
 * per slot by how it suits them, colours by age and part. `given` pins what the author chose; the rest is drawn.
 */
export function generateLook(seed: string, who: LookFor, given: LookPins = {}): Look {
  const r = rng(seed)
  const body = given.body ?? bodyFor(who)
  const parts: Record<string, string> = {}
  for (const slot of LOOK_SLOTS) {
    const pinned = given.parts?.[slot]
    if (pinned !== undefined) {
      if (pinned) parts[slot] = pinned
      continue
    }
    const roll = r()
    if (roll >= chanceOf(slot, who, body)) continue
    const id = pick(r, Object.entries(LOOK_PARTS).filter(([, p]) => p.slot === slot).map(([id, p]) => [id, weightOf(p, body, who)] as [string, number]))
    if (id) parts[slot] = id
  }
  const colors: Record<string, string> = {}
  colors.skin = given.colors?.skin ?? pick(r, SKIN)!
  colors.hair = given.colors?.hair ?? pick(r, who.age >= 62 ? HAIR_OLD : who.age >= 45 ? HAIR_GREYING : HAIR_YOUNG)!
  colors.eyes = given.colors?.eyes ?? pick(r, EYES)!
  for (const [slot, id] of Object.entries(parts))
    for (const [n, options] of Object.entries(LOOK_PARTS[id].gen?.colors ?? {})) {
      const key = `${slot}.${n}`
      if (!given.colors?.[key]) colors[key] = options[Math.floor(r() * options.length)]
    }
  for (const [k, v] of Object.entries(given.colors ?? {})) colors[k] = v
  return { body, parts, colors }
}

/** The look a new game starts from, before the player makes their own (the new-game panel). */
export const PLAYER_LOOK: Look = generateLook('player', { sex: 'female', age: 19, role: 'traveler' }, {
  parts: { hair: 'hair.ponytail', face: 'face.bright', outfit: 'outfit.adventurer', hat: null, mark: null, glasses: null, beard: null },
  colors: { hair: 'chestnut', eyes: 'amber', skin: 'light', 'outfit.1': 'teal', 'outfit.2': 'linen', 'outfit.3': 'leather' },
})

// ================================================================== words

/** The name of a colour: a named one's, else the nearest named one's. */
export function colorName(c: string | undefined): Text | undefined {
  if (!c) return undefined
  if (LOOK_COLORS[c]) return LOOK_COLORS[c].name
  if (!/^#[0-9a-f]{6}$/i.test(c)) return undefined
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [r, g, b] = rgb(c)
  let best: LookColorDef | undefined
  let d = Infinity
  for (const def of Object.values(LOOK_COLORS)) {
    const [r2, g2, b2] = rgb(def.hex)
    const dd = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2
    if (dd < d) (d = dd), (best = def)
  }
  return best?.name
}

const fill = (t: Text, c: Text | undefined): Text => {
  const o = typeof t === 'string' ? { en: t } : t
  return { en: o.en.replace('{c}', c ? (typeof c === 'string' ? c : c.en) : ''), zh: (o.zh ?? o.en).replace('{c}', c ? (typeof c === 'string' ? c : (c.zh ?? c.en)) : '') }
}

/** Who a look shows, in words: the body by age ("an old woman"), then each part ("silver hair in a bun, soft brown eyes, …"). */
export function describeLook(look: Look, who?: { age?: number }): { en: string; zh: string } {
  const body = LOOK_BODIES[look.body]
  const age = who?.age
  const en: string[] = []
  const zh: string[] = []
  const old = age !== undefined && age >= 60
  const young = age !== undefined && age < 30 && body?.age === 'adult'
  en.push(body?.age === 'child' ? `a ${body.sex === 'female' ? 'girl' : 'boy'}` : `${old ? 'an old' : young ? 'a young' : 'a'} ${body?.sex === 'female' ? 'woman' : 'man'}`)
  zh.push(body?.age === 'child' ? (body.sex === 'female' ? '女孩' : '男孩') : `${old ? '老' : young ? '年轻' : ''}${body?.sex === 'female' ? (old ? '妇人' : '女人') : old ? '人' : '男人'}`)
  const said: { en: string; zh: string }[] = []
  for (const slot of LOOK_SLOTS) {
    const id = look.parts[slot]
    const p = id ? LOOK_PARTS[id] : undefined
    if (!p) continue
    const key = p.uses?.includes('hair') && slot !== 'face' ? 'hair' : slot === 'face' ? 'eyes' : `${slot}.1`
    const t = fill(p.say, colorName(lookColor(look, key, LOOK_TABLE)))
    said.push({ en: typeof t === 'string' ? t : t.en, zh: typeof t === 'string' ? t : (t.zh ?? t.en) })
  }
  return { en: [en.join(' '), ...said.map((s) => s.en)].join(', '), zh: [zh.join(''), ...said.map((s) => s.zh)].join('，') }
}

/** The tags a look gives, against the world's table. */
export const tagsOfLook = (look: Look): string[] => lookTags(look, LOOK_TABLE)
