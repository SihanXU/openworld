// The claude-code backend reads a deadline of 0 as the harness means it: off (the offline profile's design calls
// carry deadlineMs 0; read as 0 ms, every offline call on this backend failed at once).

import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeCodeModel } from '../src/models/model-node.ts'

describe('the claude-code backend', () => {
  it('takes deadlineMs 0 as no deadline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-fake-claude-'))
    const bin = join(dir, 'claude')
    writeFileSync(bin, `#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'{"ok":true}',usage:{input_tokens:1,output_tokens:1}})),50))\n`)
    chmodSync(bin, 0o755)
    const model = new ClaudeCodeModel({ model: 'claude-opus-5-5', effort: 'low', bin })
    const r = await model.chat([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], { json: true, deadlineMs: 0 })
    expect(r.content).toBe('{"ok":true}')
  })
})
