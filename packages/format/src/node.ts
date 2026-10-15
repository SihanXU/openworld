// A project's folder read, and a compiled game written (node only: the browser never imports this file).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { compile } from './compile.ts'
import { formatJson } from './json.ts'
import type { Compiled, GameJson, Project, Sourced } from './project.ts'

const readJson = <T>(file: string): T => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`)
  }
}

/** The JSON files of a folder of the project, in name order, each with its path from the project's root. */
function files<T>(root: string, dir: string): Sourced<T>[] {
  const at = join(root, dir)
  if (!existsSync(at)) return []
  return readdirSync(at)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: relative(root, join(at, f)).replace(/\\/g, '/'), data: readJson<T>(join(at, f)) }))
}

/** A project's folder (docs/engine-split.md §5) as the compiler takes it. */
export function readProject(root: string): Project {
  return {
    game: readJson<GameJson>(join(root, 'game.json')),
    ontology: files(root, 'ontology'),
    rules: files(root, 'rules'),
    maps: files(root, 'maps'),
    people: files(root, 'people'),
    quests: files(root, 'quests'),
    story: files(root, 'story'),
    ...(existsSync(join(root, 'catalog.json')) && { catalog: readJson(join(root, 'catalog.json')) }),
    client: files(root, 'client'),
    learned: files(root, 'learned'),
    locales: files(root, 'locales'),
    // what the world's index carries beyond the format's own (a module's data: the codex's entries)
    ...(existsSync(join(root, 'extra.json')) && { extra: readJson(join(root, 'extra.json')) }),
  }
}

/** A project's folder compiled. */
export const compileProject = (root: string): Compiled => compile(readProject(root))

/**
 * A compiled game written where the runtime fetches it: `bundle.json`, and the world beside it
 * (`world/index.json`, `world/maps/<id>.json`). The folder is made anew.
 */
export function writeCompiled(out: string, c: Compiled): void {
  rmSync(join(out, 'world'), { recursive: true, force: true })
  mkdirSync(join(out, 'world', 'maps'), { recursive: true })
  writeFileSync(join(out, 'bundle.json'), JSON.stringify(c.bundle))
  writeFileSync(join(out, 'world', 'index.json'), JSON.stringify(c.index))
  for (const ch of c.chunks) writeFileSync(join(out, 'world', 'maps', `${ch.map.id}.json`), JSON.stringify(ch))
}

/** A project file written as the format writes it (json.ts). */
export function writeProjectFile(file: string, value: unknown): void {
  writeFileSync(file, formatJson(value))
}
