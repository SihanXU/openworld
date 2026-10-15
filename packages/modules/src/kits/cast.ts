// A kit skill wound up and let go (docs/skills.md): one pipeline for the minor monsters (the kit goal) and the bosses
// (the encounter goal). Taking a skill up, the caster faces its foe, says the skill's name, locks the cells and stands;
// when the wind-up runs out the skill is its act (design.md §5.13, A2) — `use` with its own body on the aimed cell,
// carrying the skill and the locked origin and aim — which its own rule answers (usually with `unleash`). A wind-up is
// behaviour memory, kept here beside the state (docs/creatures.md §4): a save taken mid wind-up only loses the wind-up.

import type { EncounterDef, Engine, Entity, Id, KitSkill, Pos } from '@openworld/engine'
import { axis, cellsOf } from './pattern.ts'

/** The warning red, for a skill that names no colour of its own. */
export const TELEGRAPH_RED = 0xe0483c
/** How many skills one may chain (`then`) after the first. */
export const CHAIN_MAX = 4

/** A wind-up under way. */
export interface Pending {
  skill: KitSkill
  /** The foe it was aimed at (a chained skill aims at it afresh). */
  target?: Id
  origin: Pos
  aim: Pos
  tiles: [number, number][]
  start: number
  releaseAt: number
  /** The blow's power, when its behaviour sets it (an encounter's phase); else the act's own (its attack). */
  power?: number
  /** An encounter's wind-up: drawn as a boss's warning, scaled by its phase. */
  boss?: { windupMul: number; floor: number; powerMul: number }
  /** How many skills came before it in its chain. */
  chain: number
}

/** The nearest entry a type or one of its ancestors names in a table by type. */
export function nearest<T>(table: Record<string, T> | undefined, type: string): [string, T] | undefined {
  if (!table) return undefined
  for (let t = type; t; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : '') if (table[t]) return [t, table[t]]
  return undefined
}

/** The kits' memory: who is winding up what (behaviour memory, never the world's state). */
export class Kits {
  pending = new Map<Id, Pending>()
  constructor(private eng: Engine) {}

  /** The kit of a thing: the nearest its type or an ancestor names. */
  kitOf(e: Entity): KitSkill[] | undefined {
    return nearest(this.eng.world.onto.data.kits, e.type)?.[1]
  }

  skillOf(e: Entity, id: unknown): KitSkill | undefined {
    return typeof id === 'string' ? this.kitOf(e)?.find((s) => s.id === id) : undefined
  }

  /** The boss fight a thing's type is (the nearest its type or an ancestor names), and its id (the type's last name). */
  encounterOf(e: Entity): { id: string; def: EncounterDef } | undefined {
    const hit = nearest(this.eng.world.onto.data.encounters, e.type)
    return hit && { id: hit[0].split('/').pop()!, def: hit[1] }
  }
}

export const kitsOf = (eng: Engine): Kits => eng.world.ext.get('kits') as Kits

const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export function faceToward(e: Entity, from: Pos, to: Pos): void {
  const [vx, vy] = axis(from, to)
  e.facing = vx > 0 ? 'right' : vx < 0 ? 'left' : vy > 0 ? 'down' : 'up'
}

/** A time scaled by a phase, never below its floor (one written shorter than the floor stays as it is written). */
export const scaled = (ticks: number, mul: number, floor: number) => Math.max(Math.min(ticks, floor), Math.round(ticks * mul))

/** How long a skill winds up: an encounter's scaled by its phase. */
const windupOf = (skill: KitSkill, boss: Pending['boss']) => (boss ? scaled(skill.windup, boss.windupMul, boss.floor) : skill.windup)

/**
 * Take a skill up against a foe standing at `at`: face it, lock the cells, say the skill's name. (A gallery and the
 * tests begin one by hand: the caster need not be in range.)
 */
export function beginCast(eng: Engine, e: Entity, skill: KitSkill, at: Pos, opts: { target?: Id; boss?: Pending['boss']; chain?: number } = {}): Pending | undefined {
  const w = eng.world, now = w.state.tick
  const pos = w.posOf(e)
  if (!pos) return undefined
  faceToward(e, pos, at)
  const p: Pending = {
    skill, target: opts.target, origin: { ...pos }, aim: { map: pos.map, x: at.x, y: at.y, ...(pos.z && { z: pos.z }) },
    tiles: cellsOf(eng, skill, pos, at), start: now, releaseAt: now + windupOf(skill, opts.boss), boss: opts.boss, chain: opts.chain ?? 0,
  }
  // an encounter's phase scales its blow (unrounded: the rule's multiple is rounded where it lands)
  if (opts.boss) p.power = w.stat(e, 'atk', 1) * opts.boss.powerMul
  kitsOf(eng).pending.set(e.id, p)
  w.fx.push({ t: 'say', who: e.id, text: skill.name })
  return p
}

/**
 * A caster's wind-up, one tick on: `none` when it winds nothing up; `lost` when it lost the skill (held, stunned or
 * frozen, unless the skill is steady: then its wind-up waits); `released` when the skill was let go (a chained skill may
 * be winding up after it); else `waiting`.
 */
export function stepCast(eng: Engine, e: Entity, active: string): 'none' | 'waiting' | 'released' | 'lost' {
  const w = eng.world, kits = kitsOf(eng)
  const p = kits.pending.get(e.id)
  if (!p) return 'none'
  if (w.num(e, 'hp') <= 0 || e.place.on !== 'tile' || e.place.map !== active) {
    kits.pending.delete(e.id)
    return 'lost'
  }
  if (eng.busy(e)) {
    // a steady skill waits out the hold (an act is refused one who is held); any other is lost
    if (!p.skill.steady) {
      kits.pending.delete(e.id)
      return 'lost'
    }
    p.start++
    p.releaseAt++
    return 'waiting'
  }
  if (w.state.tick < p.releaseAt) return 'waiting'
  releaseCast(eng, e, p)
  return 'released'
}

/** The wind-up runs out: the skill is the caster's act, its own body on the aimed cell; a skill it chains begins. */
export function releaseCast(eng: Engine, e: Entity, p: Pending): void {
  const w = eng.world, kits = kitsOf(eng)
  kits.pending.delete(e.id)
  // a dash or a line goes as far as the marks; a leap or a disk lands where it was aimed
  const last = p.skill.shape === 'line' && p.tiles.length ? p.tiles[p.tiles.length - 1] : undefined
  const end = last ? { map: p.aim.map, x: last[0], y: last[1] } : p.aim
  const z = e.place.on === 'tile' ? e.place.z : undefined
  const aimed = w.cellTop(end.map, end.x, end.y, z) ?? w.cellTop(end.map, end.x, end.y)
  const pos = w.posOf(e)
  if (aimed && pos) {
    eng.act('use', e.id, { e: aimed.id }, {
      instrument: null,
      params: { kit: p.skill.id, ox: p.origin.x, oy: p.origin.y, ax: p.aim.x, ay: p.aim.y, ...(p.power !== undefined && { power: p.power }) },
      reach: dist(pos, end) + 1,
    })
  }
  // a second arrow, a second wave: the next skill of the chain, aimed afresh at the same foe
  const next = p.skill.then && p.chain < CHAIN_MAX ? kits.skillOf(e, p.skill.then) : undefined
  const foe = p.target ? w.get(p.target) : undefined
  const at = foe && w.num(foe, 'hp') > 0 ? w.posOf(foe) : undefined
  if (next && w.num(e, 'hp') > 0 && e.place.on === 'tile' && w.posOf(e)) beginCast(eng, e, next, at && at.map === p.aim.map ? at : p.aim, { target: p.target, boss: p.boss, chain: p.chain + 1 })
}
