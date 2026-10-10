// Modules (docs/engine-split.md §4): what a game adds to the kernel. A game's ontology names the modules it
// uses (`Ontology.modules`); each engine made over it installs them in that order. A module brings its own
// effect primitives, conditions and goals, the words the ModSpec gives them, and fills the kernel's slots
// (the hooks below, the combat and society slots on the engine). The kernel imports no module: a module
// registers itself when its package is loaded, and an ontology naming one that is not loaded is refused.

import type { Engine } from './engine.ts'
import type { Scene } from './creatures.ts'
import type { EffectRunner } from './effects.ts'
import type { Roles } from './rules.ts'
import type { Frame } from './snapshot.ts'
import type { Entity, GameEvent, Id, PropValue, Ref, SkillDef, Text } from './types.ts'
import type { World } from './world.ts'

/** A goal of the behaviour system (behaviour.ts): the first of an actor's goals that applies takes its turn. */
export interface Goal {
  /** It waits for the actor's own pace (its step's cooldown) and for it to be free. */
  paced: boolean
  /** It goes on even while a person's own round waits on one who faces them (a threat, the law). */
  urgent?: boolean
  run(eng: Engine, e: Entity, sc: Scene): boolean
}

/** An effect primitive's work: in its host's outcome, as the kernel's own are (effects.ts). */
export type EffectImpl = (fx: EffectRunner, eff: any, ev: GameEvent) => void

/** A condition's reading (rules.ts `evalCond`): it applies when its key is in the condition. */
export type CondImpl = (c: any, roles: Roles, world: World, ev?: GameEvent) => boolean

/** What a module tells the patch's author (the ModSpec, mod.ts). */
export interface ModuleSpec {
  /** Its primitives: `name {args}` → what it does. */
  primitives?: Record<string, string>
  /** Its primitives that only the story and the world may use. */
  residentOnly?: string[]
  /** Its conditions, as the ModSpec lists them. */
  conditions?: string[]
  /** What an author must know of it. */
  rules?: string[]
}

export interface EngineModule {
  id: string
  /** Modules that must be installed before it. */
  needs?: string[]
  effects?: Record<string, EffectImpl>
  conds?: Record<string, CondImpl>
  goals?: Record<string, Goal>
  spec?: ModuleSpec
  /** With every engine made over an ontology that names it: its own state, and the slots it fills. */
  install?(eng: Engine): void
  /** An older save brought up to the module as it is now (on loading, as the author, after the kernel's own). */
  upgrade?(eng: Engine): void
}

const MODULES = new Map<string, EngineModule>()

/** A module's package registers it as it loads. */
export function registerModule(m: EngineModule): void {
  MODULES.set(m.id, m)
}

export function registeredModule(id: string): EngineModule | undefined {
  return MODULES.get(id)
}

/** Every module registered (the ones a game may name), in the order they were. */
export function registeredModules(): EngineModule[] {
  return [...MODULES.values()]
}

/** The modules an ontology names, in its order, each after the ones it needs. */
export function modulesOf(names: string[] | undefined): EngineModule[] {
  const out: EngineModule[] = []
  const add = (id: string, why: string) => {
    if (out.some((m) => m.id === id)) return
    const m = MODULES.get(id)
    if (!m) throw new Error(`the module "${id}" (${why}) is not loaded: import its package before making the engine`)
    for (const n of m.needs ?? []) add(n, `needed by ${id}`)
    out.push(m)
  }
  for (const id of names ?? []) add(id, 'named by the ontology')
  return out
}

/** Where in a tick a module's own step runs (engine.ts `tick`). */
export type TickPhase = 'status' | 'behaviour' | 'end'

/**
 * What the kernel asks its modules at its own steps. Each list is called in the modules' order; an empty one
 * leaves the kernel's own behaviour.
 */
export interface EngineHooks {
  /** A step of every tick, after the kernel's own of that phase. */
  tick: { phase: TickPhase; run: (active: string) => void }[]
  /** The player has come onto a map (after the map is the active one). */
  enterMap: ((map: string) => void)[]
  /** The residents a world needs beyond the world and the story (made on a new game, and for older saves). */
  residents: (() => Entity[])[]
  /** An act of learning that names what the kernel does not learn (a profession): true when the module took it. */
  learn: ((host: Entity, ev: GameEvent) => boolean)[]
  /** The one at the keys learned a skill in the tree. */
  learned: ((def: SkillDef) => void)[]
  /** What a module adds to the frame the client draws (its HUD's fields). */
  frame: ((f: Frame) => void)[]
  /** Why one asleep woke, when it was hurt in its sleep: the first that has a word. */
  woke: ((e: Entity) => { en: string; zh: string } | undefined)[]
}

export const noHooks = (): EngineHooks => ({ tick: [], enterMap: [], residents: [], learn: [], learned: [], frame: [], woke: [] })

/**
 * A blow as the striker's talents shape it: its power, and what the act carries beyond it (a critical, a
 * bleed it opens, health it draws back: the combat module's params, read again in the struck one's `wounded`).
 */
export interface Strike {
  power: number
  params?: Record<string, PropValue>
}

/**
 * The combat slot: how blows, reach and pace are worked out. The kernel's own is plain — a blow is the
 * striker's attack and the weapon's power, a step's pace its base slowed by its statuses — and a combat
 * module (classes) puts its own in its place.
 */
export interface Combat {
  /** May the actor fight with (or wear) this item; if not, what is said (aim: the input's label over the target). */
  refuses(a: Entity, item: Entity, act: 'fight' | 'wear' | 'aim'): Text | undefined
  /** Reach the actor adds to what it strikes with. */
  reach(a: Entity, weapon: Entity | undefined): number
  /** The pace of a step or a blow (ticks), from its base. */
  delay(a: Entity, base: number, kind: 'move' | 'attack'): number
  /** A blow about to be made (primary: the one aimed, not one beside it). */
  strike(a: Entity, victim: Entity | undefined, base: number, range: number, weapon: Entity | undefined, primary: boolean): Strike
  /** The striker's memory after its blow resolved (before: the victim's health before it). */
  struck(a: Entity, victim: Entity | undefined, strike: Strike, before: number, range: number, primary: boolean): void
  /** Others a blow lands on besides its target (a sweep's sides). */
  besides(a: Entity, target: Entity | undefined, range: number): Entity[]
  /** The harm the struck one takes of a blow (its dodges, guards, the brink), in its own outcome. */
  damage(e: Entity, harm: number, attacker: Entity | undefined, pierce: boolean): number
  /** Its health after a blow that would leave it this much (a once-a-day rise from a lethal blow). */
  lethal(e: Entity, hp: number): number
  /** What a landed blow carries beyond its harm, on the struck one (by: the blow's event). */
  wounded(e: Entity, by: GameEvent | undefined, attacker: Entity | undefined): void
  /** The actor made a step (mobility talents count it). */
  stepped(e: Entity): void
}

/**
 * The society slot (docs/npc-sandbox.md): whose things are, who notices an act and how it stands to them, fear
 * and the watch. Without a society module nothing is anyone's, everyone who can see an act sees it, and no one
 * keeps a watch.
 */
export interface Society {
  /** Whose a thing is: a person, a household (`household:<id>`), or nobody. */
  ownerOf(e: Entity): string | undefined
  /** How an owner stands to someone: theirs, their household's, another's, nobody's. */
  relation(owner: string | undefined, to: Entity): 'mine' | 'ours' | 'another' | 'nobody'
  /** Is the thing another's than someone's (it would be stolen in their hands)? */
  isAnothers(thing: Entity, who: Entity): boolean
  /** What a thing is worth (coin). */
  value(thing: Entity): number
  /** Does a seer in sight of an act notice it (one sneaking, a hand in a pocket)? */
  notices(seer: Entity, doer: Entity, facts: { from?: PropValue; whose?: PropValue; worn?: PropValue }, d: number, sight: number): boolean
  /** How a deed's victim stands to someone who sees it: me, ours, kin, other, none. */
  victim(against: string | undefined, seer: Entity): string
  /** A person struck who does not fight back fears the one who struck. */
  frighten(e: Entity, of: Id): void
  /** A person who fought: whether it fights on (a foe still up and near), else it calms. */
  fightOn(e: Entity, sc: Scene): boolean
  /** The watch that keeps the law where a thing is (the receiver `watch`). */
  watchOf(e: Entity | undefined): Ref | undefined
  /** What the modder is told of how a person stands to another: regard, and the deeds it remembers of them. */
  brief(e: Entity, toward: Id): { regard: number; knows: string[] } | undefined
  /** The deed a seen event holds, if any: its name. */
  deedName(seen: GameEvent): Text | undefined
}

export const noSociety = (): Society => ({
  ownerOf: () => undefined,
  relation: () => 'nobody',
  isAnothers: () => false,
  value: () => 0,
  notices: () => true,
  victim: () => 'none',
  frighten: () => {},
  fightOn: () => true,
  watchOf: () => undefined,
  brief: () => undefined,
  deedName: () => undefined,
})
