// OpenWorld, the game, as the runtime plays it (packages/runtime/src/game.ts, docs/engine-split.md): its content
// and catalogue, and the code only this game has: its wilderness, its upgrades of older saves, its dev summons.

import type { ClientGame } from '@openworld/runtime/src/game.ts'
import {
  BOON_BY_ID,
  BOSS_LAYOUT,
  BUILDINGS,
  COIN,
  COMPANION_LAYOUT,
  FIRSTLIGHT_LAYOUT,
  FORM_BY_ID,
  GAME,
  LOOK_BODIES,
  LOOK_COLORS,
  LOOK_PARTS,
  LOOK_SLOTS,
  LOOK_TABLE,
  MATERIALS,
  PLACEMENTS,
  PLAYER_LOOK,
  RECIPES,
  RELICS,
  SKILLS,
  SKILL_BRANCHES,
  SKILL_DIRECTIONS,
  SKILL_PROFESSIONS,
  WORN_SLOTS,
  branchesForProfession,
  createBoss,
  describeLook,
  generateLook,
  migrateBosses,
  migrateCompanion,
  migrateFirstlight,
  skillsForProfession,
  stationName,
  wildChunkFor,
} from '@openworld-game/content'
import { CATALOG } from './catalog.ts'

export const CLIENT_GAME: ClientGame = {
  ...GAME,
  catalog: CATALOG,
  // its saves and its library keep the names they had before there were other games on the page
  saves: 'world',
  cover: {
    title: 'OpenWorld',
    kicker: { en: 'A world whose rules are code', zh: '一个规则即代码的世界' },
    subtitle: { en: 'What the world has never seen, it learns — and remembers.', zh: '这个世界从没见过的事，它会学会，并且记住。' },
    tutorial: true,
    challenge: { label: { en: 'Boss Challenge', zh: '首领挑战' }, href: 'boss-gallery.html?challenge=1' },
    art: true,
    companion: 'lsw/Companion/Fairy/SpriteSheet.png',
  },
  // the interface's words about the Ford's own people: the trainer, the fairy who carries the seals' powers
  texts: {
    skillNoProfession: { en: 'No profession yet. At level 5, Bram the trainer sets you on one in the drill yard of Firstlight Village (crossed blades over his head): assassin, warrior, ranger or mage.', zh: '还没有职业。到 5 级后，去初原村操练场找职业导师布拉姆（头顶有交叉双剑标记）选择：刺客、战士、游侠或法师。' },
    boonTitle: { en: "Pip's Powers", zh: '小啾的力量' },
    boonSealedDoc: { en: "Pip takes up part of a seal's power when its bearer falls.", zh: '击败持印者后，小啾会接住其圣印的一部分力量。' },
    boonOne: { en: 'Pip carries one power at a time.', zh: '小啾一次只能携带一种力量。' },
  },
  // a wilderness is made from the world's seed and its cell (world-model.md §5.7); the rest is fetched
  wild: wildChunkFor,
  async upgrade(game, { index, chunk }) {
    const w = game.engine.world
    if (!w.fact(FIRSTLIGHT_LAYOUT)) {
      const [ford, village] = await Promise.all(['ford', 'meadow'].map(chunk))
      game.engine.author(() => migrateFirstlight(game, index, ford, village))
    }
    // the removed boss kits' bodies go
    if (!w.fact(BOSS_LAYOUT)) game.engine.author(() => migrateBosses(game))
    // the bird became a fairy
    if (!w.fact(COMPANION_LAYOUT)) game.engine.author(() => migrateCompanion(game))
  },
  fresh(game) {
    const w = game.engine.world
    game.engine.author(() => (w.setFact(FIRSTLIGHT_LAYOUT, true), w.setFact(BOSS_LAYOUT, true), w.setFact(COMPANION_LAYOUT, true)))
  },
  summon(kit, at, id) {
    const body = createBoss(kit, at, id)
    // the campaign's knight as Chapter 1 sets him (tools quest/chapter1.ts)
    if (kit === 'alberic') body.props = { hp: 300, maxHp: 300, def: 1, atk: 5, skillScale: 0.4 }
    return { body, say: { en: 'The White Knight stands in his field again.', zh: '白骑士再次站在了他的田野上。' } }
  },
  dev: {
    shortcuts: [
      { label: 'Emberfall, by the lit forge', debug: { op: 'teleport', map: 'emberfall', x: 31, y: 8 } },
      { label: '召唤白骑士 · Summon the White Knight (East Road)', debug: { op: 'summon', kit: 'alberic', map: 'eastroad', x: 40, y: 15, from: [30, 12] } },
    ],
  },
  items: { forms: FORM_BY_ID, materials: MATERIALS, relics: RELICS, coin: COIN },
  crafting: { recipes: RECIPES, stationName, placements: PLACEMENTS, buildings: BUILDINGS },
  skills: {
    all: SKILLS,
    directions: SKILL_DIRECTIONS,
    branches: SKILL_BRANCHES,
    professions: SKILL_PROFESSIONS,
    branchesFor: branchesForProfession,
    forProfession: skillsForProfession,
  },
  boons: BOON_BY_ID,
  looks: {
    table: LOOK_TABLE,
    slots: LOOK_SLOTS,
    worn: WORN_SLOTS,
    bodies: LOOK_BODIES,
    colors: LOOK_COLORS,
    parts: LOOK_PARTS,
    player: PLAYER_LOOK,
    generate: generateLook,
    describe: describeLook,
  },
}
