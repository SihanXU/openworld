// A person's day, counted by the hour (the People mode's warnings): which hours nothing covers, and which two
// entries cover at once. An entry runs from its hour up to (not including) its end, past midnight if it ends
// earlier than it starts; 0 to 24 is the whole day.

export function dayHours(entries: { from: number; to: number }[]): { empty: number[]; twice: number[] } {
  const hours = new Array<number>(24).fill(0)
  for (const e of entries) {
    const from = Math.floor(e.from)
    let span = Math.floor(e.to) - from
    if (span < 0) span += 24
    for (let i = 0; i < Math.min(span, 24); i++) hours[(((from + i) % 24) + 24) % 24]++
  }
  return { empty: hours.flatMap((n, h) => (n === 0 ? [h] : [])), twice: hours.flatMap((n, h) => (n > 1 ? [h] : [])) }
}
