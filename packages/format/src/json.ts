// How a project's files are written (docs/engine-split.md §5): JSON, stable and readable, so that what the
// editor saves and what an author writes by hand diff well under git. A value goes on one line when it fits;
// otherwise each member goes on a line of its own. Map rows stay one string per row.

const WIDTH = 110

/** A project file's text: two spaces, a value on one line when it fits in the width, a newline at the end. */
export function formatJson(value: unknown, width = WIDTH): string {
  return write(value, '', width) + '\n'
}

/** `lead`: what stands before the value on its line (its indent and its key). */
function write(v: unknown, indent: string, width: number, lead = indent.length): string {
  const flat = JSON.stringify(v)
  if (flat === undefined) return 'null'
  const one = spaced(v, flat)
  if (v === null || typeof v !== 'object' || lead + one.length <= width) return one
  const inner = indent + '  '
  if (Array.isArray(v)) return '[\n' + v.map((x) => inner + write(x, inner, width)).join(',\n') + '\n' + indent + ']'
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined)
  return '{\n' + entries.map(([k, x]) => { const key = inner + JSON.stringify(k) + ': '; return key + write(x, inner, width, key.length) }).join(',\n') + '\n' + indent + '}'
}

/** A one-line value with a space after its commas and colons ({ "en": "Log", "zh": "木头" }). */
function spaced(v: unknown, flat: string): string {
  if (v === null || typeof v !== 'object') return flat
  if (Array.isArray(v)) return v.length ? '[' + v.map((x) => spaced(x, JSON.stringify(x) ?? 'null')).join(', ') + ']' : '[]'
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined)
  return entries.length ? '{ ' + entries.map(([k, x]) => JSON.stringify(k) + ': ' + spaced(x, JSON.stringify(x))).join(', ') + ' }' : '{}'
}
