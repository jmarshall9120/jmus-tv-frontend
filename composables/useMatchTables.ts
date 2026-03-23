/**
 * Match Tables composable backed by static demo data.
 */

export interface StationMapping {
  id: string
  raw: string
  normalized: string
  aliases: string[]
  createdAt?: string
  updatedAt?: string
}

export interface TfnAssignment {
  station: string
  start_date?: string
  end_date?: string
  is_station?: boolean
  spot_length?: string
  language?: string
  commercial_title?: string
}

export interface TfnMapping {
  id: string
  tfn: string
  station: string
  aliases: string[]
  assignments: TfnAssignment[]
  isStation: boolean
  createdAt?: string
  updatedAt?: string
}

interface STDMatchItem {
  PK: string
  SK: string
  type: string
  canonical_name: string | null
  aliases: string[]
  context: string | null
  _created_at?: string
  _updated_at?: string
  _is_retired: boolean
}

interface StubMatchTables {
  stations: STDMatchItem[]
  tfns: STDMatchItem[]
}

function parseAssignments(context: string | null): TfnAssignment[] {
  if (!context) return []
  try {
    const parsed = JSON.parse(context) as { assignments?: TfnAssignment[] }
    return Array.isArray(parsed.assignments) ? parsed.assignments : []
  } catch {
    return []
  }
}

function toStation(item: STDMatchItem): StationMapping {
  return {
    id: item.SK,
    raw: item.aliases?.[0] ?? '',
    normalized: item.canonical_name ?? '',
    aliases: item.aliases ?? [],
    createdAt: item._created_at,
    updatedAt: item._updated_at,
  }
}

function toTfn(item: STDMatchItem): TfnMapping {
  const assignments = parseAssignments(item.context)
  const station = assignments[0]?.station ?? item.aliases?.[0] ?? ''
  return {
    id: item.SK,
    tfn: item.canonical_name ?? '',
    station,
    aliases: item.aliases ?? (station ? [station] : []),
    assignments,
    isStation: Boolean(assignments[0]?.is_station),
    createdAt: item._created_at,
    updatedAt: item._updated_at,
  }
}

async function loadStub(): Promise<StubMatchTables> {
  const response = await fetch('/stub-match-tables.json')
  if (!response.ok) throw new Error('Failed to load stub match table data')
  return response.json() as Promise<StubMatchTables>
}

export function useMatchTables() {
  async function listStationMappings(limit = 100): Promise<StationMapping[]> {
    const data = await loadStub()
    return (data.stations ?? []).slice(0, limit).map(toStation)
  }

  async function listTfnMappings(limit = 100): Promise<TfnMapping[]> {
    const data = await loadStub()
    return (data.tfns ?? []).slice(0, limit).map(toTfn)
  }

  async function createStationMapping(data: { normalized: string; aliases: string[] }): Promise<StationMapping> {
    const aliases = data.aliases.length ? data.aliases : [data.normalized]
    const raw = aliases[0] ?? data.normalized
    return {
      id: `STATION#${data.normalized}`,
      raw,
      normalized: data.normalized,
      aliases,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  async function createTfnMapping(data: { tfn: string; assignments: TfnAssignment[] }): Promise<TfnMapping> {
    if (!data.assignments.length) throw new Error('At least one assignment is required')
    const firstAssignment = data.assignments[0]
    if (!firstAssignment) throw new Error('At least one assignment is required')
    return {
      id: `TFN#${data.tfn.replace(/[^0-9]/g, '')}`,
      tfn: data.tfn,
      station: firstAssignment.station,
      aliases: [firstAssignment.station],
      assignments: data.assignments,
      isStation: Boolean(firstAssignment.is_station),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  async function updateStationMapping(_sk: string, _data: { aliases?: string[] }): Promise<void> {}

  async function updateTfnMapping(_sk: string, data: { assignments?: TfnAssignment[] }): Promise<void> {
    if (data.assignments && data.assignments.length === 0) {
      throw new Error('At least one assignment is required')
    }
  }

  async function deleteStationMapping(_sk: string): Promise<void> {}

  async function deleteTfnMapping(_sk: string): Promise<void> {}

  return {
    listStationMappings,
    listTfnMappings,
    createStationMapping,
    createTfnMapping,
    updateStationMapping,
    updateTfnMapping,
    deleteStationMapping,
    deleteTfnMapping,
  }
}
