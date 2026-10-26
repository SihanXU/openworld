// The self-state's files on disk (files.ts): what a caller gets under Node when it names none.

import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { useDefaultFiles, type Files } from './files.ts'

export const nodeFiles: Files = {
  join: (...parts) => join(...parts),
  exists: (p) => existsSync(p),
  read: (p) => readFileSync(p, 'utf8'),
  write: (p, text) => writeFileSync(p, text),
  append: (p, text) => appendFileSync(p, text),
  mkdir: (p) => void mkdirSync(p, { recursive: true }),
  list: (p) => readdirSync(p),
  copy: (from, to) => cpSync(from, to, { recursive: true }),
  rename: (from, to) => renameSync(from, to),
  tempDir: (prefix) => mkdtempSync(join(tmpdir(), prefix)),
}

useDefaultFiles(() => nodeFiles)
