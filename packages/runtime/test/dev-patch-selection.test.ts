import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModConsole } from '../src/ui/dev.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))

function view(record: string | undefined, value: string, original: string, selected: string | undefined, present = true) {
  const editor = present ? { dataset: { record }, value, defaultValue: original } : null
  const close = { onclick: undefined }
  const dev = { innerHTML: '', querySelector: () => editor, querySelectorAll: () => [] }
  vi.stubGlobal('document', { querySelector: (selector: string) => selector === '#devClose' ? close : dev })
  const detail = vi.fn()
  const console = Object.assign(Object.create(ModConsole.prototype), {
    tab: 'undefined', selected, modder: { online: false }, renderUndefinedTab: detail,
  }) as ModConsole
  console.render()
  return { detail }
}

afterEach(() => vi.unstubAllGlobals())

describe('the patch editor belongs to its selected event', () => {
  it('opens with no records and no previous editor', () => {
    const { detail } = view(undefined, '', '', undefined, false)
    expect(detail).toHaveBeenCalledWith(undefined)
  })

  it('does not carry a previous event’s patch or manual draft to a different event', () => {
    const { detail } = view('req-old', '{"manual":"old event"}', '{"patch":"old"}', 'req-new')
    expect(detail).toHaveBeenCalledWith(undefined)
  })

  it('refreshes an untouched editor when an answer arrives for the same event', () => {
    const { detail } = view('req-current', '', '', 'req-current')
    expect(detail).toHaveBeenCalledWith(undefined)
  })

  it('keeps a hand-edited draft across background updates of that same event', () => {
    const { detail } = view('req-current', '{"manual":"keep"}', '{"patch":"original"}', 'req-current')
    expect(detail).toHaveBeenCalledWith('{"manual":"keep"}')
  })
})
