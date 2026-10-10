// A folder written as a .zip (the export's, for itch.io and the like): deflated entries, a central directory,
// no dependency. Node only.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

/** The DOS time and date a zip entry carries. */
function dosTime(d: Date): { time: number; date: number } {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }
}

/** Every file under a folder, with / between folders, in name order. */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => statSync(join(dir, f)).isFile())
    .map((f) => f.split(sep).join('/'))
    .sort()
}

/** Zip a folder's files (their paths from it) into `out`; its size in bytes. */
export function zipFolder(dir: string, out: string, now = new Date()): number {
  const { time, date } = dosTime(now)
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const name of filesUnder(dir)) {
    const data = readFileSync(join(dir, name))
    const packed = deflateRawSync(data)
    const store = packed.length >= data.length
    const body = store ? data : packed
    const crc = crc32(data)
    const path = Buffer.from(name, 'utf8')
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0)
    head.writeUInt16LE(20, 4)
    head.writeUInt16LE(0x0800, 6) // the names are UTF-8
    head.writeUInt16LE(store ? 0 : 8, 8)
    head.writeUInt16LE(time, 10)
    head.writeUInt16LE(date, 12)
    head.writeUInt32LE(crc, 14)
    head.writeUInt32LE(body.length, 18)
    head.writeUInt32LE(data.length, 22)
    head.writeUInt16LE(path.length, 26)
    head.writeUInt16LE(0, 28)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(store ? 0 : 8, 10)
    entry.writeUInt16LE(time, 12)
    entry.writeUInt16LE(date, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(body.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(path.length, 28)
    entry.writeUInt32LE(offset, 42)
    locals.push(head, path, body)
    central.push(entry, path)
    offset += head.length + path.length + body.length
  }
  const dirBytes = central.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(central.length / 2, 8)
  end.writeUInt16LE(central.length / 2, 10)
  end.writeUInt32LE(dirBytes, 12)
  end.writeUInt32LE(offset, 16)
  const all = Buffer.concat([...locals, ...central, end])
  writeFileSync(out, all)
  return all.length
}
