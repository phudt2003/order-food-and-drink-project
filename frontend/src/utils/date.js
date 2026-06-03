export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

export const getDateKeyInTimeZone = (value, timeZone = DEFAULT_TIMEZONE) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''

  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    // en-CA => YYYY-MM-DD
    return fmt.format(date)
  } catch {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
}

export const isSameDayInTimeZone = (a, b, timeZone = DEFAULT_TIMEZONE) => {
  const ka = getDateKeyInTimeZone(a, timeZone)
  const kb = getDateKeyInTimeZone(b, timeZone)
  return Boolean(ka && kb && ka === kb)
}

export const isCheckedInToday = (lastCheckInDate, timeZone = DEFAULT_TIMEZONE) =>
  isSameDayInTimeZone(lastCheckInDate, new Date(), timeZone)

// Backwards-compatible alias (old code expected this)
export const isToday = (value) => isCheckedInToday(value, DEFAULT_TIMEZONE)
