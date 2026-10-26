// A game's own panels (ui/panels.ts): opened by key, told whose rule opened them; made once per factory (two keys, one
// panel), at once or loaded when first opened; shown, drawn each frame while open, hidden as the menu closes; a key no
// panel answers is left to the runtime; a panel may decline to open.

import { describe, expect, it } from 'vitest'
import type { Frame } from '@openworld/engine'
import { PanelRegistry, type GamePanel, type PanelContext, type PanelFactory } from '../src/ui/panels.ts'

/** A host as the registry uses one: its class list (no DOM in node). */
function host(): HTMLElement {
  const classes = new Set(['hidden'])
  return { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) } } as unknown as HTMLElement
}
const frame = (tick: number) => ({ tick }) as unknown as Frame

/** A panel that records what it was told. */
function recording(decline = false) {
  const log: string[] = []
  const make = (ctx: PanelContext): GamePanel => ({
    show: (f, o) => (log.push(`show ${o.panel} by ${o.by ?? '-'} at ${f?.tick ?? '-'} (${ctx.host ? 'host' : 'none'})`), decline ? false : undefined),
    render: (f) => void log.push(`render ${f.tick}`),
  })
  return { log, make }
}

function registry(factories: Record<string, PanelFactory>) {
  const hosts: string[] = []
  const r = new PanelRegistry(
    () => factories,
    (h) => ({ host: h, send: {} as PanelContext['send'], close: () => r.close(), paint: () => {}, openQuests: () => {} }),
    (key) => (hosts.push(key), host()),
  )
  return { r, hosts }
}

describe("a game's own panels", () => {
  it('releases transient work once when its host closes, including a shortcut or another panel', () => {
    let hidden = 0
    const { r } = registry({ restyle: () => ({ show() {}, render() {}, hide() { hidden++ } }) })
    r.open('restyle', frame(1))
    r.close()
    r.close()
    expect(hidden).toBe(1)
    r.open('restyle', frame(2))
    r.close()
    expect(hidden).toBe(2)
  })
  it('opens the panel a key names, told whose rule opened it, and draws it each frame while it is open', () => {
    const p = recording()
    const { r, hosts } = registry({ haven: p.make })
    expect(r.has('haven')).toBe(true)
    expect(r.has('shop')).toBe(false)
    expect(r.anyOpen).toBe(false)
    expect(r.open('haven', frame(1), 'npc.alberic')).toBe(true)
    expect(r.anyOpen).toBe(true)
    r.onFrame(frame(2))
    r.close()
    expect(r.anyOpen).toBe(false)
    r.onFrame(frame(3))
    expect(p.log).toEqual(['show haven by npc.alberic at 1 (host)', 'render 2'])
    expect(hosts).toEqual(['haven'])
  })

  it('a key no panel answers is not opened', () => {
    const { r, hosts } = registry({})
    expect(r.open('companion', frame(1))).toBe(false)
    expect(r.anyOpen).toBe(false)
    expect(hosts).toEqual([])
  })

  it('one factory under two keys is one panel, told which key opened it', () => {
    const p = recording()
    const { r, hosts } = registry({ companion: p.make, boons: p.make })
    r.open('companion', frame(1))
    r.open('boons', frame(2), 'statue')
    expect(hosts).toEqual(['companion'])
    expect(p.log).toEqual(['show companion by - at 1 (host)', 'show boons by statue at 2 (host)'])
  })

  it('a panel loaded when first opened is shown once it is ready, on the latest frame; closed meanwhile, it is not', async () => {
    const p = recording()
    let ready!: () => void
    const loaded = new Promise<void>((ok) => (ready = ok))
    const { r } = registry({ haven: async (ctx) => (await loaded, p.make(ctx)) })
    r.open('haven', frame(1), 'npc.alberic')
    // open (time stops) while it loads
    expect(r.anyOpen).toBe(true)
    r.onFrame(frame(2))
    ready()
    await loaded
    await Promise.resolve()
    expect(p.log).toEqual(['show haven by npc.alberic at 2 (host)'])
    // closed before a slower one is ready: never shown
    const q = recording()
    let go!: () => void
    const slow = new Promise<void>((ok) => (go = ok))
    const { r: r2 } = registry({ boons: async (ctx) => (await slow, q.make(ctx)) })
    r2.open('boons', frame(1))
    r2.close()
    go()
    await slow
    await Promise.resolve()
    expect(q.log).toEqual([])
    expect(r2.anyOpen).toBe(false)
  })

  it('a panel with nothing to show declines, and stays shut', () => {
    const p = recording(true)
    const { r } = registry({ boons: p.make })
    expect(r.open('boons', frame(1))).toBe(true)
    expect(r.anyOpen).toBe(false)
    r.onFrame(frame(2))
    expect(p.log).toEqual(['show boons by - at 1 (host)'])
  })
})
