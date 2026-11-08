import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { sourceVersion } from '../src/agent/source-version.ts'

it('reuses the fingerprint and detects same-size source edits and new files', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-version-'))
  const git = (...args: string[]) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true })
  git('init', '-q')
  writeFileSync(join(root, 'source.ts'), 'base\n')
  git('add', 'source.ts')
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture')
  writeFileSync(join(root, 'source.ts'), 'edit\n')
  writeFileSync(join(root, 'new.ts'), 'new\n')
  const initial = sourceVersion(root)
  expect(sourceVersion(root)).toBe(initial)
  writeFileSync(join(root, 'source.ts'), 'next\n')
  expect(sourceVersion(root)).not.toBe(initial)
  const changed = sourceVersion(root)
  writeFileSync(join(root, 'new.ts'), 'now\n')
  expect(sourceVersion(root)).not.toBe(changed)
})

it('detects a different base tree with the same candidate patch', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-version-base-'))
  const git = (...args: string[]) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: root, encoding: 'utf8', windowsHide: true })
  git('init', '-q')
  writeFileSync(join(root, 'provider.ts'), 'base\n')
  git('add', 'provider.ts')
  git('commit', '-qm', 'first tree')
  const first = git('rev-parse', 'HEAD').trim()
  writeFileSync(join(root, 'game.ts'), 'unreviewed\n')
  git('add', 'game.ts')
  git('commit', '-qm', 'second tree')
  writeFileSync(join(root, 'provider.ts'), 'edit\n')
  const second = sourceVersion(root)
  const patch = git('diff', '--binary', 'HEAD')
  git('switch', '--detach', first)
  expect(git('diff', '--binary', 'HEAD')).toBe(patch)
  expect(sourceVersion(root)).not.toBe(second)
})
