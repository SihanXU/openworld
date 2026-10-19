// The interface's colours (docs/looks.md §9): the game's palette (`ClientGame.palette`) set on the page's root as the
// --look-* variables game.css draws every panel from, and its tone (ink on paper, or paper on ink). What is left out
// keeps the runtime's own.

import { game, type UiPalette } from '../game.ts'

const KEYS = ['ink', 'paper', 'accent', 'gold', 'good', 'bad', 'cool', 'xp'] as const

/** The game's palette onto the page (once, as the page starts; again if it changes). */
export function applyPalette(palette: UiPalette | undefined = game().palette, root: HTMLElement = document.documentElement): void {
  for (const key of KEYS) {
    const value = palette?.[key]
    if (value) root.style.setProperty(`--look-${key}`, value)
    else root.style.removeProperty(`--look-${key}`)
  }
  root.dataset.uiTone = palette?.tone ?? 'paper'
}
