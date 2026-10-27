/** Thai (Buddhist era) date helpers. */

const TH_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const

/** 543 years difference between Buddhist era and the Gregorian calendar. */
export const BE_YEAR_OFFSET = 543

/** Format a stored date string as a Thai display date (พ.ศ.).
 * Accepts both Gregorian `YYYY-MM-DD` and accidentally-stored พ.ศ. (`YYYY >= 2400`). */
export function formatDateThai(ymd: string | null | undefined): string {
  if (!ymd) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  let year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (year >= 2400) year -= BE_YEAR_OFFSET
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return ymd
  }
  return `${day} ${TH_MONTHS[month - 1]} ${year + BE_YEAR_OFFSET}`
}

const pad = (n: number) => String(n).padStart(2, '0')

function parseYmd(ymd: string | undefined): { y: number; m: number; d: number } | null {
  if (!ymd) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, m: mo, d }
}

/**
 * Build a free-text Thai date into a Gregorian `YYYY-MM-DD` string (for the DB).
 * Accepts `d/m/P.P.` separated by `/`, `-`, `.` or spaces — e.g. `6/9/2569`.
 * A 4-digit year >= 2400 is treated as พ.ศ.; anything else as ค.ศ.
 * Returns '' when the input is empty or unparseable (invalid dates included).
 */
export function parseThaiDateText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\-.\s]+/)
  if (parts.length !== 3) return ''
  const d = Number(parts[0])
  const mo = Number(parts[1])
  const y = Number(parts[2])
  if (!Number.isInteger(d) || !Number.isInteger(mo) || !Number.isInteger(y)) return ''
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return ''
  const gy = y >= 2400 ? y - BE_YEAR_OFFSET : y
  if (gy < 1900 || gy > 2200) return ''
  const dt = new Date(gy, mo - 1, d)
  if (dt.getFullYear() !== gy || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return ''
  return `${gy}-${pad(mo)}-${pad(d)}`
}

/** Convert a stored Gregorian `YYYY-MM-DD` to the ฟอร์มเติม text (d/m/พ.ศ.). */
export function toThaiDateText(ymd: string | undefined): string {
  const parsed = parseYmd(ymd)
  if (!parsed) return ''
  return `${parsed.d}/${parsed.m}/${parsed.y + BE_YEAR_OFFSET}`
}