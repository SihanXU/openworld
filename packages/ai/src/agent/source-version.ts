// Verification evidence is tied to actual candidate source, including unstaged new files.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readlinkSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const cached = new Map<string, { key: string; version: string }>()

export function sourceVersion(root: string): string {
  const git = (...args: string[]) => execFileSync('git', ['-c', 'core.safecrlf=false', '-c', 'core.longpaths=true', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
  const tree = git('rev-parse', 'HEAD^{tree}').trim()
  const untracked = new Set(git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(path => path && !/^(?:\.tmp|\.agent|var|node_modules|dist)\//.test(path)).sort())
  const diff = git('diff', '--raw', '--no-renames', '--no-ext-diff', '-z', tree)
  const changed = diff.split('\0').filter((path, i) => i % 2 === 1 && path)
  const key = createHash('sha256').update(tree).update(diff)
  for (const path of new Set([...changed, ...untracked])) {
    const file = resolve(root, path), stat = lstatSync(file, { throwIfNoEntry: false })
    key.update(JSON.stringify([path, stat?.mode, stat?.size]))
    if (stat?.isSymbolicLink()) key.update(readlinkSync(file))
    if (stat?.isFile() || (untracked.has(path) && stat?.isSymbolicLink() && statSync(file, { throwIfNoEntry: false })?.isFile())) key.update(readFileSync(file))
  }
  const fingerprint = key.digest('hex'), previous = cached.get(root)
  if (previous?.key === fingerprint) return previous.version

  // Bind clean tracked files to the same base as the patch, and only rebuild the binary patch when source changes.
  const hash = createHash('sha256').update(tree).update(git('diff', '--binary', '--no-ext-diff', tree))
  for (const path of untracked) {
    const file = resolve(root, path)
    if (statSync(file, { throwIfNoEntry: false })?.isFile()) hash.update(path).update(readFileSync(file))
  }
  const version = hash.digest('hex')
  cached.set(root, { key: fingerprint, version })
  return version
}
