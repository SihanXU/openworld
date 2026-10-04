import { describe, expect, it } from 'vitest'
import { OntologyIndex, RuleLibrary, buildSandbox, performPlacement, type Effect, type Rule, type Tree } from '@lsw/engine'
import { BASE_RULES, BUILDINGS, RECIPES, RECOVERY, STORY_RULES, TERRAINS, buildOntology, decodeChunk } from '@lsw/content'
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
      for (const f of c.map.forage ?? []) have.add(f.type)
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
})
