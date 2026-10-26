// A game's own panels (docs/engine-split.md §15): the runtime draws its own — the bag, crafting, the journal, a
// module's (the skill tree, a trainer's professions, the waypoints' powers) — and a game adds its own by key
// (ClientGame.panels), each opened by a rule's `panel` effect of that key and told the host whose rule opened it (the
// fx's `by`). A factory may load its panel when it is first opened (a promise), so the game's worker and its tools never
// load the panel's code. One factory named by several keys makes one panel, told which key opened it.

import type { Frame, ItemInfo } from '@openworld/engine'
import type { MenuSend } from './menu.ts'

/** A panel of the game's own, drawn into the host the runtime gives it. */
export interface GamePanel {
  /**
   * Opened by a rule (again, if it was open): on the frame of the moment (none before the first), the key that opened it
   * and the host whose rule did. `false`: nothing to show now, and it stays shut.
   */
  show(f: Frame | undefined, opened: { panel: string; by?: string }): void | false
  /** Each frame while it is open. */
  render(f: Frame): void
  /** Release transient UI work when closed, including by another panel or shortcut. */
  hide?(): void
}

/** What the runtime gives a game's panel to work with. */
export interface PanelContext {
  /** Where it draws: an overlay the runtime shows while the panel is open, and hides as the menu closes (or a click on its backdrop). */
  host: HTMLElement
  /** The player's acts (the menu's: speak, offer, boon, track…). */
  send: MenuSend
  /** Shut it (and whatever else of the menu is open). */
  close(): void
  /** Paint items' icons into the elements marked `data-icon` (the crafting panel's `need:<type>` icons among them). */
  paint(items: ItemInfo[]): void
  /** Open the quest log. */
  openQuests(): void
}

/** How a game's panel is made: at once, or loaded when it is first opened. */
export type PanelFactory = (ctx: PanelContext) => GamePanel | Promise<GamePanel>

interface Made {
  host: HTMLElement
  panel?: GamePanel
  /** The panel is still being made: whether it is wanted open, and by what (shown once it is ready). */
  pending?: { panel: string; by?: string }
}

/** The panels by key: made the first time one is opened, kept, shown and hidden. */
export class PanelRegistry {
  private made = new Map<PanelFactory, Made>()
  private latest?: Frame

  constructor(
    /** The factories by key (read each time: the game is handed over after the runtime's modules load). */
    private factories: () => Record<string, PanelFactory | undefined>,
    private context: (host: HTMLElement) => PanelContext,
    /** A new host, hidden, for a panel opened by this key. */
    private makeHost: (key: string) => HTMLElement,
  ) {}

  /** Some panel answers this key. */
  has(key: string): boolean {
    return !!this.factories()[key]
  }

  /** Open the panel a key names, for the host that opened it: false when no panel answers the key. */
  open(key: string, f: Frame | undefined, by?: string): boolean {
    const make = this.factories()[key]
    if (!make) return false
    if (f) this.latest = f
    const opened = { panel: key, by }
    let m = this.made.get(make)
    if (!m) {
      const made: Made = { host: this.makeHost(key) }
      m = made
      this.made.set(make, made)
      const p = make(this.context(made.host))
      if (isPromise(p))
        p.then(
          (panel) => {
            made.panel = panel
            const want = made.pending
            made.pending = undefined
            if (want && isOpen(made) && panel.show(this.latest, want) === false) hide(made)
          },
          (e: unknown) => {
            console.error(`the panel "${key}" could not be made:`, e)
            made.pending = undefined
            hide(made)
          },
        )
      else made.panel = p
    }
    m.host.classList.remove('hidden')
    if (!m.panel) m.pending = opened
    else if (m.panel.show(f ?? this.latest, opened) === false) hide(m)
    return true
  }

  /** Some panel of these is open. */
  get anyOpen(): boolean {
    for (const m of this.made.values()) if (isOpen(m)) return true
    return false
  }

  /** A new frame: each open panel draws it. */
  onFrame(f: Frame): void {
    this.latest = f
    for (const m of this.made.values()) if (m.panel && isOpen(m)) m.panel.render(f)
  }

  /** Hide them all. */
  close(): void {
    for (const m of this.made.values()) hide(m)
  }
}

const isOpen = (m: Made) => !m.host.classList.contains('hidden')
const hide = (m: Made) => {
  if (isOpen(m)) m.panel?.hide?.()
  m.pending = undefined
  m.host.classList.add('hidden')
}
const isPromise = <T>(x: T | Promise<T>): x is Promise<T> => typeof (x as { then?: unknown }).then === 'function'
