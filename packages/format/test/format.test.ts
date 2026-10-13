// The project format (docs/engine-split.md §5): the compiler finds what is wrong with a project, as the
// editor's validation panel shows it, and the files are written as the format writes them.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile, formatJson, mergeOntology, type Project } from '../src/index.ts'
import { readProject } from '../src/node.ts'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const STARTER = join(ROOT, 'games/starter')
const fresh = (): Project => readProject(STARTER)
/** (judged where the starter is: a copy of the engine alone, an engine task's workspace, has none) */
const here = existsSync(STARTER)
const codes = (p: Project) => compile(p).problems.map((x) => `${x.code}: ${x.message}`)

describe.skipIf(!here)('the compiler', () => {
  it('compiles the starter clean, its world in the runtime\'s own format', () => {
    const c = compile(fresh())
    expect(c.problems).toEqual([])
    expect(c.index.maps.map((m) => m.id).sort()).toEqual(['cottage', 'glade'])
    expect(c.chunks.find((x) => x.map.id === 'glade')?.map.rows).toHaveLength(16)
    // the standard library under the project's own: its roots and its resident types
    expect(c.bundle.rules.some((r) => r.id === 'core/use')).toBe(true)
    expect(c.bundle.ontology.types['resident/story']).toBeDefined()
    // the anchors of a person's day, put in place
    expect(c.index.npcs[0].npc?.schedule[0]).toMatchObject({ map: 'cottage', x: 5, y: 2, activity: 'sleep' })
  })

  it('finds what is wrong: unknown types, portals to nowhere, anchors on rock, rows of the wrong width, a person\'s day at no anchor', () => {
    const p = fresh()
    const glade = p.maps.find((m) => m.data.map.id === 'glade')!.data
    glade.entities.push({ id: 'glade.ghost', type: 'ghost/nothing', place: { on: 'tile', map: 'glade', x: 3, y: 3 } })
    glade.map.portals.push({ x: 0, y: 5, to: 'nowhere', tx: 1, ty: 1 })
    glade.map.anchors!.rock = [0, 0]
    glade.map.rows[3] = glade.map.rows[3].slice(1)
    p.people[0].data.npc!.schedule[1] = { from: 6, to: 12, at: 'glade:nowhere', activity: 'wander' }
    const found = codes(p).join('\n')
    expect(found).toMatch(/reference: glade.ghost is of an unknown type "ghost\/nothing"/)
    expect(found).toMatch(/portal: glade: portal 1 leads to "nowhere"/)
    expect(found).toMatch(/anchor: glade: the anchor "rock" \(0,0\) is on solid ground/)
    expect(found).toMatch(/size: glade: row 3 is 23 wide/)
    expect(found).toMatch(/reference: npc.mira: no anchor "glade:nowhere"/)
  })

  it('finds rules that tie, rules that write past their host, and a root that inherits', () => {
    const p = fresh()
    const axe = p.rules[0].data.find((r) => r.id === 'glade/axe')!
    p.rules[0].data.push({ ...structuredClone(axe), id: 'glade/axe-again' })
    p.rules[0].data.push({ id: 'glade/root', on: 'act/use', tree: 'inherit' })
    p.rules[0].data.push({ id: 'glade/far', host: { type: 'fixture/sign' }, on: 'impulse/handle', tree: { do: [{ op: 'addStatus', status: 'wet', of: 'actor' } as never] } })
    const found = codes(p).join('\n')
    expect(found).toMatch(/tie: glade\/axe and glade\/axe-again are equally specific/)
    expect(found).toMatch(/glade\/root is a root and inherits/)
    expect(found).toMatch(/rule: .*(host|of)/)
  })

  it('a project\'s rule of a library rule\'s id takes its place; its types go over the library\'s', () => {
    const p = fresh()
    p.rules[0].data.push({ id: 'core/bump', doc: 'Bumping wets.', on: 'bump', tree: { do: [{ op: 'addStatus', status: 'wet' }] } })
    const c = compile(p)
    expect(c.bundle.rules.filter((r) => r.id === 'core/bump')).toHaveLength(1)
    expect(c.bundle.rules.find((r) => r.id === 'core/bump')?.doc).toBe('Bumping wets.')
    const onto = mergeOntology([{ types: [{ id: 'actor/person', name: { en: 'soul', zh: '魂' } }] }], { modules: ['x'] })
    expect(onto.types['actor/person'].name).toEqual({ en: 'soul', zh: '魂' })
    expect(onto.types['actor/creature']).toBeDefined()
    expect(onto.modules).toEqual(['x'])
  })

  it('gear sets are keyed by id: a later file\'s set replaces the earlier\'s of its id and keeps the rest', () => {
    const set = (id: string, atk: number) => ({ id, name: id, pieces: 2, bonuses: [{ pieces: 2, props: { atk }, text: `+${atk}` }] })
    const onto = mergeOntology([{ sets: [set('wolf', 1), set('bear', 2)] }, { sets: [set('wolf', 5), set('owl', 3)] }], {})
    expect(onto.sets?.map((s) => [s.id, s.bonuses[0].props.atk])).toEqual([['wolf', 5], ['bear', 2], ['owl', 3]])
  })
})

describe.skipIf(!here)('the files', () => {
  const json = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const at = join(dir, f); return statSync(at).isDirectory() ? json(at) : f.endsWith('.json') && f !== 'package.json' && f !== 'tsconfig.json' ? [at] : [] })
  it('the starter and the standard library are written as the format writes them (what the editor saves diffs clean)', () => {
    for (const f of [...json(STARTER), ...json(join(ROOT, 'packages/stdlib'))]) {
      const text = readFileSync(f, 'utf8')
      expect(formatJson(JSON.parse(text)), f).toBe(text)
    }
  })

  it('writes a value on one line when it fits, and each member on its own when it does not', () => {
    expect(formatJson({ en: 'Log', zh: '木头' })).toBe('{ "en": "Log", "zh": "木头" }\n')
    expect(formatJson({ rows: ['ab', 'cd'], long: 'x'.repeat(120) })).toBe(`{\n  "rows": ["ab", "cd"],\n  "long": "${'x'.repeat(120)}"\n}\n`)
  })
})
