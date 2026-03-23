/**
 * Parse CSV text into an array of row objects (first line = headers).
 * Handles quoted fields; numeric columns are cast to number when possible.
 */
export function parseCsv<T extends Record<string, unknown>>(
  raw: string,
  options?: {
    /** Keys to keep as strings (e.g. ids, dates); others are cast to number when possible */
    stringKeys?: Set<string> | string[]
  }
): T[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const rawHeaders = parseCsvLine(lines[0]!)
  const headers = rawHeaders.map((h) => (h ?? '').trim())
  const stringKeys = options?.stringKeys
    ? new Set(Array.isArray(options.stringKeys) ? options.stringKeys : options.stringKeys)
    : new Set<string>()

  const rows: T[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!)
    const row: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j] ?? `col_${j}`
      let val: unknown = values[j] ?? ''
      if (!stringKeys.has(key) && typeof val === 'string') {
        const n = Number(val)
        val = Number.isNaN(n) ? val : n
      }
      row[key] = val
    }
    rows.push(row as T)
  }
  return rows
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let cell = ''
      i++
      while (i < line.length) {
        if (line[i] === '"') {
          i++
          if (line[i] === '"') {
            cell += '"'
            i++
          } else break
        } else {
          cell += line[i]
          i++
        }
      }
      out.push(cell)
      if (line[i] === ',') i++
    } else {
      let cell = ''
      while (i < line.length && line[i] !== ',') {
        cell += line[i]
        i++
      }
      out.push(cell.trim())
      if (line[i] === ',') i++
    }
  }
  return out
}
