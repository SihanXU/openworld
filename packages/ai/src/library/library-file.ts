// A library's log in a file (library.ts `LogStore`): one JSON line per entry, its identity beside it
// (`<file>.id`). Loaded by the package's Node entry, which lets a library be named by its file's path (and gives the
// validation cache Node's own hash, faster than the one a browser has).

import { appendFileSync, existsSync, mkdirSync, readFileSync, truncateSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { useKeyHash, useLogFiles, type LogStore } from './library.ts'

export function fileLog(file: string): LogStore {
  const id = logIdentity(file)
  return {
    id,
    lines() {
      if (!existsSync(file)) return []
      const text = readFileSync(file, 'utf8')
      // a last line cut short (the service stopped mid-write): cut back to the last whole line, so the next
      // entry starts a line of its own (appended onto the torn one, it would be lost on the next start, and its seq used again)
      if (text && !text.endsWith('\n')) {
        const cut = text.lastIndexOf('\n') + 1
        let whole = false
        try {
          JSON.parse(text.slice(cut))
          whole = true
        } catch {
          /* torn */
        }
        if (whole) appendFileSync(file, '\n')
        else truncateSync(file, Buffer.byteLength(text.slice(0, cut)))
      }
      return text.split('\n')
    },
    append(line) {
      mkdirSync(dirname(file), { recursive: true })
      appendFileSync(file, line + '\n')
    },
  }
}

/** The identity of the log in `file`: read from beside it, or made with the file (a log with no identity of its own gets one). */
function logIdentity(file: string): string {
  const side = `${file}.id`
  if (existsSync(file) && existsSync(side)) {
    const id = readFileSync(side, 'utf8').trim()
    if (id) return id
  }
  const id = randomUUID()
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, '')
  writeFileSync(side, `${id}\n`)
  return id
}

useLogFiles(fileLog)
useKeyHash((text) => createHash('sha256').update(text).digest('hex'))
