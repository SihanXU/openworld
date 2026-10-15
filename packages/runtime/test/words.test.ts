/// <reference types="node" />

// The runtime says no one game's words (docs/engine-split.md §15): it is the engine's player, and a game's people,
// places, coin and panels come from the game (ClientGame: its texts, catalogue, tables, its own panels). Its code names
// none of OpenWorld's — but for the files still listed, its boss art and preview, which the list only lets shrink.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')
/** OpenWorld's own names: its companion, its knight and his ground, its village and trainer, its coin, its tiers. */
const NAMES = /Lumi|露米|Alberic|阿尔贝里克|Dawnmark|晨辉|Thornmark|Held Ground|誓守|Firstlight|初原|\bBram\b|布拉姆|Vowbound|遗誓|Stigmatic|圣痕/i
/**
 * Files that still name this game's bosses (P2's leftovers, docs/engine-split.md §8: the White Knight's art and clips,
 * his preview, the sins' colours on the boss bar, his drawing): the list only shrinks.
 */
const STILL_THE_GAMES = new Set(['assets/bosses.ts', 'boss-preview.ts', 'render/boss-animation.ts', 'render/scene.ts'])

/** A file's code, its comments left out (a comment may say whose idea a thing was). */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n')

describe("the runtime says no one game's words", () => {
  const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(ts|css)$/.test(f))

  it("its code names none of OpenWorld's people, places, coin or tiers", () => {
    const found: string[] = []
    for (const f of files) {
      const where = relative(SRC, join(SRC, f)).split(sep).join('/')
      if (STILL_THE_GAMES.has(where)) continue
      code(readFileSync(join(SRC, f), 'utf8'))
        .split('\n')
        .forEach((line, i) => NAMES.test(line) && found.push(`${where}:${i + 1}: ${line.trim().slice(0, 80)}`))
    }
    expect(found).toEqual([])
  })

  it('each file still listed still needs it', () => {
    const still = [...STILL_THE_GAMES].filter((f) => NAMES.test(code(readFileSync(join(SRC, f), 'utf8'))))
    expect(still.sort()).toEqual([...STILL_THE_GAMES].sort())
  })
})
