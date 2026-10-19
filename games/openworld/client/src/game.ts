// OpenWorld, the game, as the runtime plays it (packages/runtime/src/game.ts, docs/engine-split.md): its content
// and catalogue, and the code only this game has: its wilderness, its upgrades of older saves, its dev summons, its
// own panels (ui/panels.ts: the companion's, the Held Ground's).

import type { ClientGame } from '@openworld/runtime/src/game.ts'
import { describeItem, fishingBaitContextAction, fishingRodIconDecoration } from './itemTips.ts'
import {
  BOON_BY_ID,
  ALBERIC_CAMPAIGN,
  BOSS_LAYOUT,
  BUILDINGS,
  COIN,
  COMPANION_LAYOUT,
  COMPANION_NAME,
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
  migrateCompanionName,
  migrateOverworld,
  migrateWaypoints,
  migrateSmithy,
  migrateHaven,
  migrateHavenHeart,
  migrateStats,
  STATS_LAYOUT,
  migrateGear,
  GEAR_LAYOUT,
  migrateVows,
  VOWS_LAYOUT,
  VOWS,
  migratePlots,
  PLOTS_LAYOUT,
  migrateStock,
  STOCK_LAYOUT,
  migrateTents,
  HAVEN_LAYOUT,
  SMITHY_LAYOUT,
  WAYPOINTS_LAYOUT,
  OVERWORLD_LAYOUT,
  migrateFirstlight,
  skillsForProfession,
  stationName,
  SHOPS,
  wildChunkFor,
} from '@openworld-game/content'
import { CATALOG } from './catalog.ts'
import { PANELS } from './ui/panels.ts'

export const CLIENT_GAME: ClientGame = {
  describeItem,
  itemIconDecoration: (item) => fishingRodIconDecoration(item, FORM_BY_ID),
  itemContextAction: fishingBaitContextAction,
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
    boonTitle: { en: "Lumi's Powers", zh: '露米的力量' },
    boonSealedDoc: { en: "Lumi takes up part of a seal's power when its bearer falls.", zh: '击败持印者后，露米会接住其圣印的一部分力量。' },
    boonOne: { en: 'Lumi carries one power at a time.', zh: '露米一次只能携带一种力量。' },
    boonGained: { en: "Lumi takes up the seal's power", zh: '露米接住了圣印之力' },
    // a monster's own piece of gear (content trophies.ts), and the two tiers the story names (content items.ts QUALITIES)
    tipTrophy: { en: 'Trophy', zh: '专属装备' },
    'tier:vowed': { en: 'Vowbound — left by one who swore a vow. It still remembers.', zh: '遗誓——立誓之人留下的东西。它还记得那个誓言。' },
    'tier:legendary': { en: "Stigmatic — it bears one of the First Martyr's five wounds. Suffering brings one nearer to God.", zh: '圣痕——它带着初殉者五道伤痕中的一道。苦难使人接近神。' },
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
    // and was renamed Lumi
    if (!w.fact(COMPANION_NAME)) game.engine.author(() => migrateCompanionName(game))
    // the world map became a place to a tile
    if (!w.fact(OVERWORLD_LAYOUT)) {
      const overworld = await chunk('overworld')
      game.engine.author(() => migrateOverworld(game, overworld))
    }
    // Cloudtop's waypoint statue was removed
    if (!w.fact(WAYPOINTS_LAYOUT)) game.engine.author(() => migrateWaypoints(game))
    // the smithies of Firstlight Village and the Held Ground
    if (!w.fact(SMITHY_LAYOUT)) {
      const maps = await Promise.all(['meadow', 'haven'].map(chunk))
      game.engine.author(() => migrateSmithy(game, maps))
    }
    // the Held Ground widens at its heart, no longer by errands
    if (!w.fact(HAVEN_LAYOUT)) game.engine.author(() => migrateHaven(game))
    // its heart is the planted sword, not an altar
    game.engine.author(() => migrateHavenHeart(game))
    // the plots at the Held Ground's heart (its buildings, the residents' tents) and Cass's loom on Firstlight's square
    // (only for maps a save has been to: the others come as built)
    if (!w.fact(PLOTS_LAYOUT)) {
      const maps = await Promise.all(['haven', 'meadow'].filter((id) => w.state.loadedMaps.includes(id)).map(chunk))
      game.engine.author(() => migratePlots(game, maps))
    }
    // the people who traded before keep what they sold and sell what they sell now
    if (!w.fact(STOCK_LAYOUT)) game.engine.author(() => migrateStock(game, index))
    // standing your ground, stealth and perception left the gear for luck
    if (!w.fact(STATS_LAYOUT)) game.engine.author(() => migrateStats(game))
    // gear came in levels: what has none is of the first
    if (!w.fact(GEAR_LAYOUT)) game.engine.author(() => migrateGear(game))
    // the Vowbound took their vows, and rolled the extras the named ones never had
    if (!w.fact(VOWS_LAYOUT)) game.engine.author(() => migrateVows(game))
    // the tents have rooms behind their flaps (only for maps a save has been to: the others come as built)
    const tentMaps = ['ford', 'forest', 'haven'].filter((id) => w.state.loadedMaps.includes(id))
    if (tentMaps.length) {
      const maps = await Promise.all(tentMaps.map(chunk))
      game.engine.author(() => migrateTents(game, maps))
    }
  },
  fresh(game) {
    const w = game.engine.world
    game.engine.author(() => (w.setFact(FIRSTLIGHT_LAYOUT, true), w.setFact(BOSS_LAYOUT, true), w.setFact(COMPANION_LAYOUT, true), w.setFact(COMPANION_NAME, true), w.setFact(OVERWORLD_LAYOUT, true), w.setFact(WAYPOINTS_LAYOUT, true), w.setFact(SMITHY_LAYOUT, true), w.setFact(HAVEN_LAYOUT, true), w.setFact(PLOTS_LAYOUT, true), w.setFact(STOCK_LAYOUT, true), w.setFact(STATS_LAYOUT, true), w.setFact(GEAR_LAYOUT, true), w.setFact(VOWS_LAYOUT, true)))
  },
  summon(kit, at, id) {
    const body = createBoss(kit, at, id)
    // the campaign's knight as Chapter 1 sets him (tools quest/chapter1.ts)
    if (kit === 'alberic') body.props = { ...ALBERIC_CAMPAIGN }
    return { body, say: { en: 'The White Knight stands in his field again.', zh: '白骑士再次站在了他的田野上。' } }
  },
  dev: {
    shortcuts: [
      { label: 'Emberfall, by the lit forge', debug: { op: 'teleport', map: 'emberfall', x: 31, y: 8 } },
      { label: '召唤白骑士 · Summon the White Knight (East Road)', debug: { op: 'summon', kit: 'alberic', map: 'eastroad', x: 40, y: 15, from: [30, 12] } },
    ],
  },
  items: { forms: FORM_BY_ID, materials: MATERIALS, relics: RELICS, vows: VOWS, coin: COIN },
  crafting: { recipes: RECIPES, stationName, placements: PLACEMENTS, buildings: BUILDINGS, shops: SHOPS },
  skills: {
    all: SKILLS,
    directions: SKILL_DIRECTIONS,
    branches: SKILL_BRANCHES,
    professions: SKILL_PROFESSIONS,
    branchesFor: branchesForProfession,
    forProfession: skillsForProfession,
  },
  boons: BOON_BY_ID,
  // the companion's panel and the Held Ground's (its steward's: the land, its grounds, its buildings, the stock)
  panels: PANELS,
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
