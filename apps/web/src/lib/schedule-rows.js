// Client-side twin of extractScheduleRows in apps/api/src/lib/welya-ai.ts — used when an
// AI action button carries no structured rows (older messages) and we must read them from the reply text.
const DAY_WORDS = "senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun"
const TIME = "\\d{1,2}[.:]\\d{2}"
const RANGE = new RegExp(`(${TIME})\\s*[–—-]\\s*(${TIME})`, "i")
const DAY_ONLY = new RegExp(`^(${DAY_WORDS})$`, "i")
const DAY_LEAD = new RegExp(`^(${DAY_WORDS})\\b[\\s:,-]*`, "i")

export function extractScheduleRows(text = "") {
  const rows = []
  let currentDay = null
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/\*\*|__|`/g, "").replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()
    if (!line) continue
    if (DAY_ONLY.test(line)) {
      currentDay = line
      continue
    }
    const range = RANGE.exec(line)
    if (!range) continue
    let day = currentDay
    const lead = DAY_LEAD.exec(line)
    if (lead && line.indexOf(lead[1]) < range.index) day = lead[1]
    if (!day) continue
    let rest = line.slice(range.index + range[0].length).replace(/^[\s—–:,-]+/, "")
    rest = rest.split(/\s+[—–]\s+/)[0].replace(/\s*\([^)]*\)\s*$/, "").trim()
    if (!rest) continue
    const location = /\b(?:ruang|room|lab|r\.)\s*[\w.\-]+/i.exec(line)?.[0] ?? null
    rows.push({ title: rest, day, start: range[1], end: range[2], location })
  }
  return rows
}

export const DAY_INDEX = { mon: 0, monday: 0, senin: 0, tue: 1, tuesday: 1, selasa: 1, wed: 2, wednesday: 2, rabu: 2, thu: 3, thursday: 3, kamis: 3, fri: 4, friday: 4, jumat: 4, "jum'at": 4, sat: 5, saturday: 5, sabtu: 5, sun: 6, sunday: 6, minggu: 6 }

export function parseClock(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})[.:](\d{2})$/)
  return match ? [Number(match[1]), Number(match[2])] : null
}
