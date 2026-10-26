// A library's log in a file (library.ts `LogStore`): one JSON line per entry, its identity beside it
// (`<file>.id`). Loaded by the package's Node entry, which lets a library be named by its file's path (and gives the
// validation cache Node's own hash, faster than the one a browser has). One process writes a log: it holds `<file>.lock`
// (its pid) while it runs, so `library remove` beside a running service is refused instead of writing a seq twice.

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, truncateSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { useKeyHash, useLogFiles, type LogStore } from './library.ts'

export function fileLog(file: string): LogStore {
  lock(file)
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
      const size = existsSync(file) ? statSync(file).size : 0
      try {
        appendFileSync(file, line + '\n')
      } catch (err) {
        // a write cut short (the disk full) leaves no part of a line for the next one to be appended onto
        try {
          truncateSync(file, size)
        } catch {
          /* nothing was written */
        }
        throw err
      }
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

/** The logs this process holds, released when it exits (one killed leaves its lock behind: the next opener takes it over). */
const held = new Set<string>()
process.on('exit', () => {
  for (const lockFile of held) {
    try {
      if (readFileSync(lockFile, 'utf8').trim() === String(process.pid)) unlinkSync(lockFile)
    } catch {
      /* gone already */
    }
  }
})

/** Take the log's lock for this process: refused while another live process holds it. */
function lock(file: string): void {
  const lockFile = `${file}.lock`
  if (held.has(lockFile)) return
  mkdirSync(dirname(file), { recursive: true })
  for (;;) {
    try {
      writeFileSync(lockFile, `${process.pid}\n`, { flag: 'wx' })
      held.add(lockFile)
      return
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }
    let pid = NaN
    try {
      pid = Number(readFileSync(lockFile, 'utf8').trim())
    } catch {
      continue // released meanwhile
    }
    if (pid === process.pid) return void held.add(lockFile)
    if (Number.isInteger(pid) && pid > 0 && alive(pid))
      throw new Error(`the library log ${file} is open in another process (pid ${pid}): stop it first (or remove ${lockFile} if no such process is the modder)`)
    // its holder is gone: take it over
    try {
      unlinkSync(lockFile)
    } catch {
      /* another took it over first: try again */
    }
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // (EPERM: it lives, under another user)
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

useLogFiles(fileLog)
useKeyHash((text) => createHash('sha256').update(text).digest('hex'))
