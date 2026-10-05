import { describe, expect, it } from 'vitest'
import { OntologyIndex, RuleLibrary, buildSandbox, performPlacement, type Effect, type Rule, type Tree } from '@lsw/engine'
import { BASE_RULES, BUILDINGS, RECIPES, RECOVERY, STORY_RULES, TERRAINS, WILD_GROUNDS, buildOntology, decodeChunk, wildChunk } from '@lsw/content'
import { economySteps, freeLunch } from '@lsw/modder'
import { buildFord } from '../src/demo/world.ts'

// The economy (world-model.md §6.4, §10.2, D23): what is built and broken back returns no more
// than went in; no two steps (a recipe, a break, a rule's conversion) make more of a thing than
// they took; and without the AI, everything the recipes and buildings ask for can be had from the
// world as it starts, and what it yields by itself.

const onto = buildOntology()
const index = new OntologyIndex(onto)
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** The effects of a rule's tree, every branch. */
function effectsOf(t: Tree): Effect[] {
  if (typeof t === 'string') return []
  if ('if' in t) return [...effectsOf(t.then), ...effectsOf(t.else ?? 'inherit')]
  return 'do' in t ? t.do : []
}

/** A conversion: what goes in, what comes out (expected counts). */
interface Step {
  name: string
  takes: Map<string, number>
  gives: Map<string, number>
}

/** Every step the data and the base rules say: recipes, breaking down, items a rule turns into others. */
function steps(): Step[] {
  const out: Step[] = []
  for (const r of RECIPES) out.push({ name: `recipe ${r.id}`, takes: new Map(r.needs.map((n) => [n.type, n.count])), gives: new Map([[r.make.type, 1]]) })
  for (const id of Object.keys(onto.types)) {
    const r = index.resolve(id)
    if (typeof r.props.maxHp === 'number' && r.makeup?.length) out.push({ name: `break ${id}`, takes: new Map([[id, 1]]), gives: new Map(r.makeup.map((m) => [m.type, m.count * (m.chance ?? 1) * RECOVERY])) })
  }
  // an item a rule turns into another, and what it spawns beside it (a log split into planks)
  for (const rule of BASE_RULES as Rule[]) {
    const host = rule.host?.type
    if (!host?.startsWith('item/') || !onto.types[host]) continue
    const fx = effectsOf(rule.tree)
    const into = fx.find((e): e is Extract<Effect, { op: 'transform' }> => e.op === 'transform' && !e.into.startsWith('@'))
    if (!into) continue
    const gives = new Map([[into.into, 1]])
    for (const e of fx) if (e.op === 'spawn' && !e.type.startsWith('@') && typeof (e.count ?? 1) === 'number') gives.set(e.type, (gives.get(e.type) ?? 0) + Number(e.count ?? 1))
    out.push({ name: `rule ${rule.id}`, takes: new Map([[host, 1]]), gives })
  }
  return out
}

describe('the economy (world-model.md §10.2)', () => {
  it('no step and no two steps in a row make more of a thing than they took', () => {
    const all = steps()
    const gains: string[] = []
    for (const a of all) for (const [t, n] of a.gives) if (n > (a.takes.get(t) ?? 0) && a.takes.has(t)) gains.push(`${a.name}: ${t} ${a.takes.get(t)} → ${n}`)
    // A then B: what A gives, B takes; per unit of a thing A took, how much of it comes back
    for (const a of all)
      for (const b of all) {
        if (a === b) continue
        for (const [mid, made] of a.gives) {
          const need = b.takes.get(mid)
          if (!need) continue
          const runs = made / need
          for (const [t, took] of a.takes) {
            const back = (b.gives.get(t) ?? 0) * runs
            if (back > took + 1e-9) gains.push(`${a.name} then ${b.name}: ${t} ${took} → ${back}`)
          }
        }
      }
    expect(gains).toEqual([])
  })

  it('no mix of steps, of any length, makes more of anything than it takes (a linear programme)', () => {
    expect(freeLunch(economySteps(onto, [...lib().rules.values()], RECOVERY))).toBeUndefined()
  })

  it('build and break back: each building, broken, returns no more of anything than went into it', () => {
    const over: string[] = []
    for (const b of BUILDINGS) {
      const consumed = b.needs.filter((n) => n.consume)
      const eng = buildSandbox(
        {
          terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
          entities: [
            { key: 'actor', type: 'actor/person/player', x: 2, y: 3, props: { atk: 6 } },
            ...b.needs.flatMap((n, i) => Array.from({ length: n.consume ? n.count : 1 }, (_, k) => ({ key: `need${i}.${k}`, type: n.match.type ?? Object.keys(onto.types).find((t) => (n.match.tags ?? []).every((tag) => index.resolve(t).tags.includes(tag)) && t.startsWith('item/'))!, x: 2, y: 3, inside: 'actor' }))),
          ],
          event: {},
        },
        onto,
        lib(),
      )
      eng.world.get('actor')!.facing = 'up'
      const res = performPlacement(eng, 'actor', b, { map: 'sandbox', x: 2, y: 2 })
      expect([b.id, res.ok]).toEqual([b.id, true])
      const made = eng.world.placedAt('sandbox', 2, 2).find((e) => e.type === b.result)
      expect([b.id, !!made]).toEqual([b.id, true])
      // broken by blows (fire would do as well): with what works best on what it is made of
      const tool = index.resolve(made!.type).props.material === 'stone' ? 'item/tool/pickaxe' : 'item/tool/smith_hammer'
      eng.author(() => eng.world.add({ id: 'breaker', type: tool, tags: ['material:iron'], place: { on: 'hand', holder: 'actor' } }))
      for (let i = 0; i < 20 && eng.world.get(made!.id); i++) eng.act('use', 'actor', { e: made!.id }, { params: { attack: true } })
      expect([b.id, eng.world.get(made!.id)]).toEqual([b.id, undefined])
      const back = new Map<string, number>()
      for (const e of eng.world.placedAt('sandbox', 2, 2)) back.set(e.type, (back.get(e.type) ?? 0) + 1)
      for (const n of consumed) {
        const t = n.match.type!
        if ((back.get(t) ?? 0) > n.count) over.push(`${b.id}: ${t} ${n.count} in, ${back.get(t)} back`)
      }
      for (const [t] of back) if (!consumed.some((n) => n.match.type === t)) over.push(`${b.id}: ${t} back, never went in`)
    }
    expect(over).toEqual([])
  })

  it('reachability: without the AI, everything the recipes and buildings ask for can be had from the world as it starts', () => {
    const { index: world, chunks } = buildFord()
    const have = new Set<string>()
    const present = new Set<string>()
    for (const c of chunks.map(decodeChunk)) {
      for (const t of new Set(c.map.terrain)) present.add(`tile/${t}`)
      for (const e of c.entities) (e.type.startsWith('item/') ? have : present).add(e.type)
      for (const a of [...(c.map.appear ?? []), ...(onto.appear ?? [])]) for (const t of Object.keys(a.types)) (t.startsWith('item/') ? have : present).add(t)
    }
    for (const n of world.npcs) for (const it of (n as { _items?: { type: string }[] })._items ?? []) have.add(it.type)
    const stations = new Set([...present].flatMap((t) => index.resolve(t).tags.filter((x) => x.startsWith('station:')).map((x) => x.slice(8))))
    stations.add('hands')
    // what breaks gives its makeup; what a rule on a present thing spawns, it gives
    const spawnsOf = (type: string) =>
      (BASE_RULES as Rule[]).filter((r) => r.host && (!r.host.type || type === r.host.type || type.startsWith(r.host.type + '/')) && (r.host.tags ?? []).every((t) => index.resolve(type).tags.includes(t))).flatMap((r) =>
        effectsOf(r.tree).flatMap((e) => (e.op === 'spawn' && !e.type.startsWith('@') ? [e.type] : e.op === 'transform' && !e.into.startsWith('@') ? [e.into] : [])),
      )
    for (let round = 0; round < 8; round++) {
      for (const t of [...present, ...have]) {
        for (const m of index.resolve(t).makeup ?? []) if (typeof index.resolve(t).props.maxHp === 'number') have.add(m.type)
        for (const s of spawnsOf(t)) (s.startsWith('item/') ? have : present).add(s)
      }
      for (const r of RECIPES) if (stations.has(r.station ?? 'hands') && r.needs.every((n) => have.has(n.type))) have.add(r.make.type)
    }
    const missing: string[] = []
    for (const r of RECIPES) {
      if (!stations.has(r.station ?? 'hands')) missing.push(`${r.id}: no ${r.station} in the world`)
      for (const n of r.needs) if (!have.has(n.type)) missing.push(`${r.id}: ${n.type}`)
    }
    for (const b of BUILDINGS)
      for (const n of b.needs) {
        const ok = n.match.type ? have.has(n.match.type) : [...have].some((t) => (n.match.tags ?? []).every((tag) => index.resolve(t).tags.includes(tag)))
        if (!ok) missing.push(`${b.id}: ${JSON.stringify(n.match)}`)
      }
    expect(missing).toEqual([])
    expect(TERRAINS.length).toBeGreaterThan(0)
  })

  it('reachability with renewables (world-model.md §10.2, W7): everything the recipes and buildings ask for comes back without end — from what appears by itself, from the wilderness that is made as one goes, or from a stage that returns (a stump grows back into a tree, a seed into a plant that gives seed, a hen lays)', () => {
    const { chunks } = buildFord()
    // what a type leads to: what it becomes or leaves (a rule on it, its stage), what breaking it gives, what it makes (a recipe)
    const prop = (type: string, ref: string) => {
      const key = ref.slice(6).replace(/^host\./, '')
      const v = index.resolve(type).props[key]
      return typeof v === 'string' ? v : undefined
    }
    const named = (type: string, t: string) => (t.startsWith('@prop:') ? prop(type, t) : t)
    const edges = new Map<string, Set<string>>()
    const stageEdges: [string, string][] = []
    const link = (a: string, b: string | undefined) => {
      if (!b || !onto.types[b]) return
      if (!edges.has(a)) edges.set(a, new Set())
      edges.get(a)!.add(b)
    }
    const types = Object.keys(onto.types)
    for (const t of types) {
      const r = index.resolve(t)
      if (typeof r.props.maxHp === 'number') for (const m of r.makeup ?? []) link(t, m.type)
      for (const rule of BASE_RULES as Rule[]) {
        const h = rule.host
        if (!h || (h.type && t !== h.type && !t.startsWith(h.type + '/')) || !(h.tags ?? []).every((x) => r.tags.includes(x))) continue
        for (const e of effectsOf(rule.tree)) if (e.op === 'spawn') link(t, named(t, e.type)); else if (e.op === 'transform') link(t, named(t, e.into))
      }
      const st = r.stage
      if (st) {
        // a stage with nothing next returns to itself: what it leaves comes again and again
        const next = st.into ?? t
        link(t, next)
        stageEdges.push([t, next])
        for (const y of st.yields ?? []) (link(t, y.type), stageEdges.push([t, y.type]))
      }
    }
    for (const r of RECIPES) for (const n of r.needs) link(n.type, r.make.type)
    const reach = (from: string): Set<string> => {
      const seen = new Set([from])
      const todo = [from]
      while (todo.length) for (const b of edges.get(todo.pop()!) ?? []) if (!seen.has(b)) (seen.add(b), todo.push(b))
      return seen
    }
    // the sources without end: what appears by itself (each map's and the world's), the wilderness's things and
    // grounds (made anew wherever one goes), and every stage on a cycle (only time makes more: a stage edge on it)
    const sources = new Set<string>()
    for (const c of chunks.map(decodeChunk)) for (const a of c.map.appear ?? []) for (const t of Object.keys(a.types)) sources.add(t)
    for (const a of onto.appear ?? []) for (const t of Object.keys(a.types)) sources.add(t)
    for (const g of WILD_GROUNDS)
      for (let i = 0; i < 6; i++) {
        const c = wildChunk(7 + i, i, 2 * i, g, undefined)
        for (const t of new Set(c.map.terrain)) sources.add(`tile/${t}`)
        for (const e of c.entities) sources.add(e.type)
        for (const a of c.map.appear ?? []) for (const t of Object.keys(a.types)) sources.add(t)
      }
    const cycles: string[] = []
    for (const [a, b] of stageEdges) if (reach(b).has(a)) (sources.add(a), cycles.push(`${a} → ${b}`))
    // a stump grows back into the tree it was felled from; a seed grows into a plant that gives seed; a hen lays
    expect(cycles).toEqual(expect.arrayContaining(['tile/stump → tile/tree', 'actor/creature/animal/chicken → actor/creature/animal/chicken', 'fixture/crop/wheat/young → fixture/crop/wheat/ripe']))
    const renewable = new Set<string>()
    for (const s of sources) for (const t of reach(s)) renewable.add(t)
    const finite: string[] = []
    for (const r of RECIPES) for (const n of r.needs) if (!renewable.has(n.type)) finite.push(`${r.id}: ${n.type}`)
    for (const b of BUILDINGS)
      for (const n of b.needs) {
        const ok = n.match.type ? renewable.has(n.match.type) : [...renewable].some((t) => (n.match.tags ?? []).every((tag) => index.resolve(t).tags.includes(tag)))
        if (!ok) finite.push(`${b.id}: ${JSON.stringify(n.match)}`)
      }
    expect([...new Set(finite)]).toEqual([])
  })
})
