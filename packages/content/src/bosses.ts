// The seven sins: authored encounter kits. Six bodies span tiles; Envy is deliberately tiny.
import type { BossDef, BossSkill, Entity, Game, MapChunk, Pos, Rule, StatusDef, TypeDef } from '@lsw/engine'

const L = (en: string, zh: string) => ({ en, zh })
const skill = (sin: string, id: string, en: string, zh: string, shape: BossSkill['shape'], aim: BossSkill['aim'], radius: number, damage: number, windup: number, recovery: number, extra: Partial<BossSkill> = {}): BossSkill => ({
  id, name: L(en, zh), shape, aim, radius, damage, windup, recovery,
  fx: `sin:${sin}:${id}`, action: aim === 'self' ? 'attack' : 'cast', ...extra,
})

export const BOSSES: BossDef[] = [
  { id: 'greed', name: L('The Gilt Tollkeeper · Greed', '铸税者 · 贪婪'), footprint: [5, 3], hp: 1400, defense: 2, sight: 11, leash: 12, color: 0xe8b44a, enrageAt: 0.5, skills: [
    skill('greed', 'stamp', 'Gilded Stamp', '征税重钳', 'cone', 'self', 6, 26, 16, 10, { shift: 'push' }),
    skill('greed', 'coins', 'Coin Storm', '散财风暴', 'ring', 'self', 6, 22, 20, 12),
    skill('greed', 'chains', 'Debt Collection', '索债金链', 'cross', 'target', 4, 24, 16, 10, { shift: 'pull' }),
  ] },
  { id: 'gluttony', name: L('The Banquet Maw · Gluttony', '饕宴巨口 · 暴食'), footprint: [5, 4], hp: 1800, defense: 2, sight: 11, leash: 12, color: 0xa0c447, enrageAt: 0.5, skills: [
    skill('gluttony', 'bite', 'Banquet Bite', '宴席巨噬', 'cone', 'self', 6, 34, 20, 12, { heal: 40 }),
    skill('gluttony', 'soup', 'Cauldron Spill', '酸汤倾泻', 'circle', 'target', 3, 26, 18, 10, { status: 'mired' }),
    skill('gluttony', 'gulp', 'Empty the Table', '吞尽满席', 'circle', 'self', 7, 30, 24, 14, { shift: 'pull', heal: 30 }),
  ] },
  { id: 'sloth', name: L('The Drowsing Monastery · Sloth', '眠钟古寺 · 懒惰'), footprint: [7, 5], hp: 2200, defense: 4, sight: 12, leash: 12, color: 0xad9ad8, enrageAt: 0.45, skills: [
    skill('sloth', 'stomp', 'Rooted Stomp', '千钧迟踏', 'circle', 'self', 7, 46, 26, 18, { shift: 'push' }),
    skill('sloth', 'dream', 'Drowsing Chimes', '沉眠钟雾', 'spots', 'target', 5, 30, 20, 16, { status: 'mired' }),
    skill('sloth', 'shell', 'Monastery Wall', '古寺回响', 'ring', 'self', 8, 40, 28, 18),
  ] },
  { id: 'lust', name: L('The Velvet Lure · Lust', '绯愿兰后 · 色欲'), footprint: [5, 3], hp: 1600, defense: 2, sight: 12, leash: 12, color: 0xe578a7, enrageAt: 0.5, skills: [
    skill('lust', 'petal', 'Velvet Crescent', '绯瓣弧斩', 'cone', 'self', 7, 30, 16, 10),
    skill('lust', 'lure', 'False Promise', '虚愿花印', 'spots', 'target', 4, 24, 18, 10, { shift: 'pull', status: 'entranced' }),
    skill('lust', 'thorns', 'Thorn Covenant', '荆棘誓约', 'cross', 'target', 6, 32, 20, 12, { status: 'mired' }),
  ] },
  { id: 'wrath', name: L('The Cinder Executioner · Wrath', '烬炉刑官 · 愤怒'), footprint: [5, 4], hp: 2100, defense: 3, sight: 12, leash: 12, color: 0xf07548, enrageAt: 0.6, skills: [
    skill('wrath', 'cleave', 'Execution Stroke', '断罪斧落', 'line', 'self', 8, 44, 18, 10, { shift: 'push' }),
    skill('wrath', 'fissure', 'Furnace Fault', '熔炉裂隙', 'cross', 'target', 6, 32, 20, 12, { element: 'fire' }),
    skill('wrath', 'rage', 'Ashen Roar', '怒烬震环', 'ring', 'self', 7, 38, 18, 12, { element: 'fire' }),
  ] },
  { id: 'envy', name: L('The Face Thief · Envy', '窃面者 · 嫉妒'), footprint: [1, 1], hp: 1000, defense: 1, sight: 12, leash: 12, color: 0x56d7a0, enrageAt: 0.5, skills: [
    skill('envy', 'daggers', 'Borrowed Blades', '借影双刃', 'cone', 'self', 3, 24, 10, 8),
    skill('envy', 'mirror', 'Shattered Faces', '碎面镜雨', 'spots', 'target', 3, 20, 14, 10),
    skill('envy', 'blink', 'Stolen Footstep', '窃步瞬身', 'circle', 'target', 2, 24, 12, 8, { blink: true }),
  ] },
  { id: 'pride', name: L('The Crown Without a King · Pride', '无王之冠 · 傲慢'), footprint: [5, 4], hp: 2600, defense: 3, sight: 12, leash: 12, color: 0x9aafff, enrageAt: 0.5, skills: [
    skill('pride', 'wing', 'Royal Rebuff', '王翼斥退', 'cone', 'self', 7, 42, 18, 12, { shift: 'push' }),
    skill('pride', 'mirror', 'Perfect Reflection', '完美镜裁', 'cross', 'target', 7, 36, 22, 14),
    skill('pride', 'crown', 'Kneel Before the Crown', '万象俯首', 'ring', 'target', 5, 44, 24, 16),
  ] },
]
export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]))
export const BOSS_TYPES: TypeDef[] = [
  { id: 'actor/creature/sin', kind: 'actor', name: L('Sin sovereign', '原罪领主'), tags: ['boss'], props: { range: 1 } },
  ...BOSSES.map((b): TypeDef => ({ id: `actor/creature/sin/${b.id}`, kind: 'actor', name: b.name, sprite: `boss:sin:${b.id}`, footprint: b.footprint,
    tags: b.id === 'envy' ? ['small'] : ['large'], props: { hp: b.hp, maxHp: b.hp, def: b.defense, atk: b.skills[0].damage, speed: 8 } })),
]
export const BOSS_STATUSES: StatusDef[] = [
  { id: 'mired', name: L('Mired', '迟滞'), duration: 25, moveDelay: 1.7 },
  { id: 'entranced', name: L('Entranced', '迷眩'), duration: 8, immobilize: true },
]

/** Rewards happen once, then the death animation has two seconds before removal. */
export const BOSS_RULES: Rule[] = [
  // a sin at no health goes down for two seconds (its death), leaves its reward, and tells the story
  ...BOSSES.map((b): Rule => ({
    id: `sins/${b.id}-defeated`,
    source: { origin: 'base', note: 'story' },
    host: { type: `actor/creature/sin/${b.id}`, notStatus: ['down'] },
    on: 'threshold/cross',
    tree: { if: { param: { key: 'name', cmp: 'defeated' } }, then: { do: [
      { op: 'setProp', key: 'hp', value: 0 },
      { op: 'addStatus', status: 'down', duration: 20 },
      { op: 'emit', impulse: 'notify', to: 'story', params: { what: `sin.${b.id}` } },
      { op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'defeat', xp: { prop: 'maxHp', of: 'host' } } },
      { op: 'dropContents', still: true },
      { op: 'spawn', type: 'item/material/iron_ore', at: 'host', count: b.id === 'greed' ? 2 : 4 },
      { op: 'log', text: L('Defeated {host}.', '击败了{host}。') },
    ] }, else: 'inherit' },
  })),
  { id: 'sins/death-fades', source: { origin: 'base' }, host: { type: 'actor/creature/sin' }, on: 'time/timer', tree: { if: { param: { key: 'status', cmp: 'down' } }, then: { do: [{ op: 'destroy' }] }, else: 'inherit' } },
  {
    id: 'sins/story',
    source: { origin: 'base', note: 'story' },
    doc: 'The story keeps which sins have fallen.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: BOSSES.reduceRight<Rule['tree']>((rest, b) => ({ if: { param: { key: 'what', cmp: `sin.${b.id}` } }, then: { do: [{ op: 'setFact', key: `sins.defeated.${b.id}`, value: 1 }] }, else: rest }), 'inherit'),
  },
]

export const FIRST_BOSS = { map: 'eastroad', x: 23, y: 15, id: 'eastroad.sin.greed' } as const
export const BOSS_LAYOUT = 'content.seven-sins-v2'
export function createBoss(id: string, at: Pos, entityId = `sin.${id}`): Entity {
  const b = BOSS_BY_ID[id]
  if (!b) throw new Error(`Unknown boss kit: ${id}`)
  return { id: entityId, type: `actor/creature/sin/${id}`, name: b.name, place: { on: 'tile', ...at }, facing: 'down', boss: { kit: id, phase: 1, action: 'idle' },
    ai: { behaviour: 'melee', temper: 'aggressive', home: { ...at }, sight: b.sight, leash: b.leash } }
}

/** Add the new encounter to an already visited East Road, without recreating a defeated boss. */
export function migrateBosses(game: Game, road?: MapChunk): void {
  const w = game.engine.world
  if (w.fact(BOSS_LAYOUT)) return
  if (road && w.state.loadedMaps.includes(FIRST_BOSS.map)) {
    game.loadMapData(road.map)
    const boss = road.entities.find((e) => e.id === FIRST_BOSS.id)
    const existing = w.get(FIRST_BOSS.id)
    if (existing && w.num(existing, 'hp') > 0) {
      // Preserve the proportion of health lost in v1, not its obsolete absolute HP.
      if (w.fact('content.seven-sins-v1') && existing.props?.maxHp !== BOSS_BY_ID.greed.hp) {
        const ratio = Math.min(1, w.num(existing, 'hp') / Number(existing.props?.maxHp ?? 120))
        Object.assign(existing.props ??= {}, { hp: Math.max(1, Math.round(BOSS_BY_ID.greed.hp * ratio)), maxHp: BOSS_BY_ID.greed.hp })
        delete existing.boss!.pending
      }
      const at = w.posOf(existing)!
      if (!w.fits(existing, at.map, at.x, at.y)) {
        const free = game.engine.nearestFree(at, existing)
        if (!free) return
        w.place(existing, { on: 'tile', ...free }); existing.ai!.home = free
      }
    }
    if (boss && !w.get(boss.id) && !w.fact('sins.defeated.greed')) {
      const added = w.add(structuredClone(boss)), at = w.posOf(added)!
      if (!w.fits(added, at.map, at.x, at.y)) {
        const free = game.engine.nearestFree(at, added)
        if (free) { w.place(added, { on: 'tile', ...free }); added.ai!.home = free }
        else {
          // A heavily built-up encounter site is retried on a later load; never overlap
          // the player's structures or consume the migration marker without a safe spawn.
          w.destroy(added)
          return
        }
      }
    }
  }
  w.setFact(BOSS_LAYOUT, true)
}
