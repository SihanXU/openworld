// The continent as kept, for the valley's test (valley.test.ts): its rows, and which cells are the west bank's.
import { readFileSync } from 'node:fs'
import { CONTINENT_FILE, inPocket } from '../src/demo/continent/generate.ts'

export { inPocket }
export const readContinentRows = (): string[] => (JSON.parse(readFileSync(CONTINENT_FILE, 'utf8')) as { rows: string[] }).rows
