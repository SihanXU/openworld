// The editor's modes as the header shows them: in the groups an author works in — the world (its maps and people),
// its content (the database, the pictures and sounds, the rules), its story (the steps and the quests), the AI —
// and the rest (the game's settings, its languages, the search) under More. A mode no group names is under More.

const GROUPS: string[][] = [
  ['map', 'people'],
  ['database', 'assets', 'rules'],
  ['story', 'quests'],
  ['holes', 'things'],
]

/** The modes in their groups (each in the order given, the ones there are), and the rest. */
export function navGroups(ids: string[]): { groups: string[][]; more: string[] } {
  const grouped = new Set(GROUPS.flat())
  return {
    groups: GROUPS.map((g) => g.filter((id) => ids.includes(id))).filter((g) => g.length),
    more: ids.filter((id) => !grouped.has(id)),
  }
}
