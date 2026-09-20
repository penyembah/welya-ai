import { isSameDay } from "date-fns"

// Free blocks between events for rendering the day timeline; planning itself happens on the server.
export function freeSlotsFor(date, events, dayStart = 8, dayEnd = 18) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.start), date) && e.type !== "deadline" && e.type !== "reminder").sort((a, b) => new Date(a.start) - new Date(b.start))
  const slots = []
  let cursor = new Date(date)
  cursor.setHours(dayStart, 0, 0, 0)
  const end = new Date(date)
  end.setHours(dayEnd, 0, 0, 0)
  for (const e of dayEvents) {
    const s = new Date(e.start)
    if (s - cursor >= 60 * 60 * 1000) slots.push({ start: new Date(cursor), end: s })
    const eEnd = new Date(e.end)
    if (eEnd > cursor) cursor = eEnd
  }
  if (end - cursor >= 60 * 60 * 1000) slots.push({ start: new Date(cursor), end })
  return slots
}
