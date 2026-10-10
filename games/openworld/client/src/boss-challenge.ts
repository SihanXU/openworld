// A fresh, disposable game per challenge. No persistence and no campaign/trainer changes.
import { Game, OFFHAND, RuleLibrary, learnSkill, type Text, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, BOSSES, BOSS_BY_ID, BOSS_ARENA, PROFESSION_BY_ID, SKILLS, STORY_RULES, buildOntology, createBoss, decodeChunk, type RawChunk } from '@openworld-game/content'

export const CHALLENGE_LOADOUTS: Record<string, { hp: number; atk: number; def: number; icon: string; tip: Text }> = {
  assassin: { hp: 110, atk: 5, def: 1, icon: 'assassin', tip: { en: 'Iron dagger · openers, backstabs and three-hit finishers.', zh: '铁匕首 · 绕后背刺，抓住先手，三连击收尾。' } },
  warrior: { hp: 160, atk: 5, def: 2, icon: 'shield', tip: { en: 'Iron sword and shield · reduced damage and healing counterattacks.', zh: '铁剑与木盾 · 铁壁减伤，挨打后的反击可以回血。' } },
  ranger: { hp: 100, atk: 4, def: 1, icon: 'critical', tip: { en: 'Bow · seven-tile shots, aimed damage and mobile volleys.', zh: '长弓 · 七格射程，站稳增伤，命中后加速走位。' } },
  mage: { hp: 90, atk: 4, def: 1, icon: 'flame', tip: { en: 'Ember staff · elemental power, spell echoes and a mana shield.', zh: '炽焰法杖 · 元素增伤、法术回响与法力护盾。' } },
}

export function createBossChallenge(index: WorldIndex, raw: RawChunk, profession: string, bossId: string): Game {
  const loadout = CHALLENGE_LOADOUTS[profession], role = PROFESSION_BY_ID[profession]
  if (!loadout || !role?.weapon || !BOSS_BY_ID[bossId]) throw new Error('Unknown challenge profession or boss')
  const settings = structuredClone(index)
  // Trial choices come from current content, even when the fetched map index is older.
  settings.bosses = structuredClone(BOSSES)
  Object.assign(settings, { start: { map: BOSS_ARENA.map, x: 23, y: 17 }, npcs: [], companions: [], steps: [], quests: [], invariants: [], waypoints: [], startHour: 12 })
  const looks: Record<string, string> = { assassin: 'NinjaDark', warrior: 'Knight', ranger: 'Hunter', mage: 'SorcererOrange' }
  settings.player = { id: 'player', type: 'actor/person/player', look: looks[profession], facing: 'up', place: { on: 'tile', ...settings.start },
    props: { hp: loadout.hp, maxHp: loadout.hp, atk: loadout.atk, def: loadout.def, profession, level: 20, xp: 0, maxHunger: 0, skillPoints: 100 } }
  const game = Game.create(settings, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const chunk = decodeChunk(structuredClone(raw))
  chunk.entities = chunk.entities.filter((e) => !e.type.startsWith('actor/'))
  chunk.entities.push(createBoss(bossId, BOSS_ARENA, BOSS_ARENA.id))
  chunk.map.appear = []
  chunk.map.portals = [] // a trial cannot accidentally stream into the campaign
  chunk.map.zone = 'peaceful' // suppress unrelated nighttime spawns, not the authored boss
  game.loadChunk(chunk)
  const w = game.engine.world, player = w.player
  const shared = new Set(['light-footed', 'quick-hands', 'strength', 'vitality'])
  const pending = SKILLS.filter((s) => shared.has(s.id) || s.profession === profession)
  // the trial is built by its author, not played into being
  game.engine.author(() => {
    while (pending.length) {
      const next = pending.findIndex((s) => learnSkill(w, player, s))
      if (next === -1) throw new Error('Invalid challenge skill prerequisites')
      pending.splice(next, 1)
    }
    player.props!.skillPoints = 0
    player.props!.hp = w.num(player, 'maxHp')
    const weapon = w.create(role.weapon!.type, { on: 'hand', holder: player.id }, structuredClone(role.weapon))
    // the warrior's shield, worn in the off hand
    if (role.offhand) w.setProp(player, OFFHAND, w.create(role.offhand.type, { on: 'inside', holder: player.id }, structuredClone(role.offhand)).id)
    if (profession === 'mage') {
      (weapon.props ??= {}).element = 'fire'
      weapon.name = { en: 'Challenge Ember Staff', zh: '试炼·炽焰法杖' }
    }
  })
  game.engine.controls.sync()
  w.fx = []
  return game
}

export function challengeOutcome(game: Game): 'victory' | 'defeat' | undefined {
  const w = game.engine.world, boss = w.get(BOSS_ARENA.id)
  if (w.num(w.player, 'hp') <= 0 || w.hasStatus({ e: w.player.id }, 'down')) return 'defeat'
  if (!boss || w.num(boss, 'hp') <= 0) return 'victory'
  return undefined
}
