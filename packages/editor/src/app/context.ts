// What every part of the editor shares: the project, the canvas, the map shown, what is selected; and the modes
// (the map, the people, the database, the rules, the story, the quests, the holes) as one interface.

import type { Ontology } from '@openworld/engine'
import type { Canvas, CellEvent, Overlay } from './canvas.ts'
import type { Store } from './store.ts'

export interface Selection {
  cell?: { x: number; y: number }
  entity?: string
  portal?: number
  person?: string
}

export interface Ctx {
  store: Store
  canvas: Canvas
  /** The map the canvas shows. */
  map: string
  sel: Selection
  /** The compiled project's ontology (the standard library's under the project's). */
  onto(): Ontology
  showMap(id: string, at?: { x: number; y: number }): void
  /** Draw the panels again (the selection or the project changed). */
  refresh(): void
  /** Save and play: from the start, a cell, or (`scene`) with a step of the story begun at once. */
  playtest(at?: { map: string; x: number; y: number }, o?: { scene?: string }): Promise<void>
  /** Ask for a cell on a map (the canvas shown, the maps to choose among): the cell picked, or none (Esc). */
  pick(why: string, map?: string): Promise<{ map: string; x: number; y: number } | undefined>
  /** Open a mode, at a file of it (the validation panel's links). */
  open(mode: string, file?: string, at?: string): void
}

export interface Mode {
  id: string
  label: string
  /** Draw its tools (left) and its inspector (right). */
  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void
  /** A mode that needs the middle of the window (the rules, the story, the quests) draws there instead of the canvas. */
  main?(ctx: Ctx, el: HTMLElement): void
  /** The canvas's cell under the tool (or the picker, the right button). */
  cell?(ctx: Ctx, c: { x: number; y: number }, ev: CellEvent): void
  /** A key pressed over the editor while no field is typed in: true when the mode took it. */
  keydown?(ctx: Ctx, e: KeyboardEvent): boolean
  overlay?(ctx: Ctx): Overlay | undefined
  /** Open at a file (and a place in it). */
  focus?(ctx: Ctx, file: string, at?: string): void
}
