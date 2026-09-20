import {
  addDays,
  differenceInCalendarDays,
  format,
  isPast,
  isSameDay,
  isToday,
  isTomorrow,
  set,
  startOfWeek,
} from "date-fns"

export function at(dayOffset, hour = 9, minute = 0) {
  return set(addDays(new Date(), dayOffset), {
    hours: hour,
    minutes: minute,
    seconds: 0,
    milliseconds: 0,
  }).toISOString()
}

export function fmtTime(iso) {
  return format(new Date(iso), "HH:mm")
}

export function fmtDate(iso, pattern = "EEE, d MMM") {
  return format(new Date(iso), pattern)
}

export function fmtDateTime(iso) {
  return format(new Date(iso), "EEE, d MMM · HH:mm")
}

export function relativeDeadline(iso) {
  const date = new Date(iso)
  if (isToday(date)) return `Today · ${fmtTime(iso)}`
  if (isTomorrow(date)) return `Tomorrow · ${fmtTime(iso)}`
  const diff = differenceInCalendarDays(date, new Date())
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff < 7) return `In ${diff} days`
  return fmtDate(iso)
}

export function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

export function isOverdue(task) {
  return task.status !== "done" && isPast(new Date(task.deadline))
}

export function isDueToday(task) {
  return isToday(new Date(task.deadline))
}

export function sameDay(isoA, dateB) {
  return isSameDay(new Date(isoA), dateB)
}

export function weekStart(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function formatDuration(minutes) {
  if (!minutes) return "—"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function todayWeekday() {
  const i = new Date().getDay()
  return WEEKDAYS[(i + 6) % 7]
}
