import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildModSpec, buildSandbox, checkExpectations, type Expectation } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()

describe('propEq (hidden)', () => {
  const eng = buildSandbox({ entities: [{ key: 'box', type: 'fixture/container/chest', x: 1, y: 1, props: { coins: 3, owner: 'maren' } }], event: {} }, onto, new RuleLibrary(BASE_RULES))
  const check = (x: unknown) => checkExpectations(eng, [x as Expectation])

  it('passes when the property equals the value', () => {
    expect(check({ key: 'box', propEq: ['coins', 3] })).toEqual([])
    expect(check({ key: 'box', propEq: ['owner', 'maren'] })).toEqual([])
  })

  it('reports what the property is when it differs', () => {
    expect(check({ key: 'box', propEq: ['coins', 4] }).join()).toMatch(/coins/)
    expect(check({ key: 'box', propEq: ['coins', 4] }).join()).toMatch(/3/)
    expect(check({ key: 'box', propEq: ['owner', 'brann'] })).toHaveLength(1)
  })

  it('is described to patch authors', () => {
    expect(buildModSpec(onto, new RuleLibrary(BASE_RULES)).expectations.join(' ')).toMatch(/propEq/)
  })
})
