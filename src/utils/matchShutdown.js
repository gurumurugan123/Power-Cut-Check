import Fuse from 'fuse.js'
import shutdowns from '../data/shutdowns.json'

/**
 * Format a Date as YYYY-MM-DD in the user's local timezone.
 * @param {Date} date
 */
function toLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Today and tomorrow as YYYY-MM-DD (local).
 */
export function getTodayAndTomorrow() {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  return {
    today: toLocalDateString(today),
    tomorrow: toLocalDateString(tomorrow),
  }
}

/**
 * Normalize a place name for indexing (trim + collapse spaces).
 */
function cleanName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ignore junk tokens from scraped Location columns (e.g. truncated "P", "M").
 * Short names cause false hits via query.includes("p") inside "Gandhipuram".
 */
const MIN_SEARCHABLE_LEN = 3

function isSearchableName(name) {
  const cleaned = cleanName(name)
  if (cleaned.length < MIN_SEARCHABLE_LEN) return false
  // Reject single-token all-punctuation / bare initials leftovers
  if (/^[A-Za-z]$/.test(cleaned)) return false
  return true
}

/**
 * Strong match rules (no fuzzy):
 * - exact equal
 * - indexed name contains the full query  ("KADUVETTIPALAYAM 110 KV" contains "KADUVETTIPALAYAM")
 * - query contains indexed name ONLY if that name is long enough
 *   (blocks "Gandhipuram".includes("P") / ".includes("M")")
 */
function isStrongNameMatch(queryLower, nameLower) {
  if (!queryLower || !nameLower) return false
  if (nameLower === queryLower) return true
  if (nameLower.includes(queryLower) && queryLower.length >= MIN_SEARCHABLE_LEN) return true
  // Contained-in-query: require meaningful length so 1–2 letter scraps never match
  if (queryLower.includes(nameLower) && nameLower.length >= 4) return true
  return false
}

/**
 * Keep records whose outage date is today or any future published date.
 * Past outages are ignored. Matches TNPDCL tables that list upcoming days
 * (e.g. 20-07-2026 when today is 17-07-2026).
 */
function isUpcoming(recordDate, today) {
  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) return false
  return recordDate >= today
}

/**
 * Flatten shutdown records into searchable name entries.
 * Searches localities AND substation / feeder / town, because GPS/Nominatim
 * often returns a substation-area name (e.g. "KADUVETTIPALAYAM") rather than
 * a village from the Location column.
 */
function buildSearchIndex(records, today) {
  const entries = []

  for (const record of records) {
    if (!isUpcoming(record.date, today)) continue

    const add = (name, field) => {
      const cleaned = cleanName(name)
      if (!isSearchableName(cleaned)) return
      entries.push({ name: cleaned, field, record })
    }

    for (const locality of record.localities || []) {
      add(locality, 'locality')
    }
    add(record.substation, 'substation')
    add(record.feeder, 'feeder')
    add(record.town, 'town')
  }

  return entries
}

/**
 * Fuzzy-match a place name against upcoming shutdown records.
 *
 * Prefer exact / substring hits (e.g. "KADUVETTIPALAYAM" ↔
 * "KADUVETTIPALAYAM 110 KV") before looser fuzzy matches, so shared
 * suffixes like "palayam" don't create false positives.
 *
 * @param {string} localityName
 * @param {object[]} [records=shutdowns]
 * @param {{ allowTownField?: boolean, allowFuzzy?: boolean }} [options]
 * @returns {object[]} unique matched shutdown records, soonest date first
 */
export function matchShutdowns(localityName, records = shutdowns, options = {}) {
  if (!localityName || !localityName.trim()) return []

  const { allowTownField = true, allowFuzzy = true } = options
  const query = localityName.trim()
  const queryLower = query.toLowerCase()
  const { today } = getTodayAndTomorrow()
  let index = buildSearchIndex(records, today)

  if (!allowTownField) {
    index = index.filter((e) => e.field !== 'town')
  }

  if (index.length === 0) return []

  // Avoid matching tiny queries (e.g. "SS") against everything
  if (queryLower.length < MIN_SEARCHABLE_LEN) return []

  const strongHits = index.filter((entry) =>
    isStrongNameMatch(queryLower, entry.name.toLowerCase()),
  )

  let ranked
  if (strongHits.length > 0) {
    ranked = strongHits.map((item) => ({ item, score: 0 }))
  } else if (allowFuzzy) {
    // Only fuzzy against reasonably long index names
    const fuseIndex = index.filter((e) => e.name.length >= 4)
    const fuse = new Fuse(fuseIndex, {
      keys: ['name'],
      threshold: 0.28,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 4,
    })
    ranked = fuse.search(query)
  } else {
    ranked = []
  }

  const seen = new Set()
  const matches = []

  for (const result of ranked) {
    const record = result.item.record
    if (seen.has(record.id)) continue
    seen.add(record.id)
    matches.push({
      ...record,
      // Hide truncated junk letters from the UI chips
      localities: (record.localities || []).filter((n) => isSearchableName(n)),
      matchedLocality: result.item.name,
      matchedField: result.item.field,
      matchedQuery: query,
      matchScore: result.score,
    })
  }

  matches.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.fromTime || '').localeCompare(b.fromTime || '')
  })

  return matches
}

/**
 * Match using multiple Nominatim candidates (primary → secondary → weak).
 * Weak candidates (city/county) never match the `town` field, otherwise
 * "Coimbatore" would hit every CBE record.
 *
 * @param {Array<{name: string, source?: string, strength?: string}>|string[]} candidates
 * @param {object[]} [records=shutdowns]
 * @returns {object[]}
 */
export function matchShutdownsFromCandidates(candidates, records = shutdowns) {
  const list = (candidates || [])
    .map((c) => (typeof c === 'string' ? { name: c, strength: 'primary' } : c))
    .filter((c) => c && c.name)

  if (list.length === 0) return []

  const byStrength = {
    primary: list.filter((c) => c.strength === 'primary'),
    secondary: list.filter((c) => c.strength === 'secondary'),
    weak: list.filter((c) => c.strength === 'weak' || !c.strength),
  }

  function runBatch(batch, options) {
    const found = []
    const seen = new Set()
    for (const candidate of batch) {
      const hits = matchShutdowns(candidate.name, records, options)
      for (const hit of hits) {
        if (seen.has(hit.id)) continue
        seen.add(hit.id)
        found.push({
          ...hit,
          matchedQuery: candidate.name,
          matchedSource: candidate.source || 'query',
          matchedStrength: candidate.strength || 'primary',
        })
      }
    }
    return found
  }

  // Strong tiers first (suburb, road, display parts)
  let matches = [
    ...runBatch(byStrength.primary, { allowTownField: true, allowFuzzy: true }),
    ...runBatch(byStrength.secondary, { allowTownField: true, allowFuzzy: true }),
  ]

  // Deduplicate across primary+secondary
  const seen = new Set()
  matches = matches.filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })

  // Weak fallback only if nothing specific matched
  if (matches.length === 0) {
    matches = runBatch(byStrength.weak, {
      allowTownField: false,
      allowFuzzy: false, // city names must be exact/substring only
    })
  }

  matches.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.fromTime || '').localeCompare(b.fromTime || '')
  })

  return matches
}

/**
 * Unique searchable names from the full dataset (for autocomplete).
 * Includes localities, substations, feeders, and towns.
 */
export function getAllLocalities(records = shutdowns) {
  const set = new Set()
  for (const record of records) {
    for (const locality of record.localities || []) {
      const name = cleanName(locality)
      if (isSearchableName(name)) set.add(name)
    }
    for (const field of ['substation', 'feeder', 'town']) {
      const name = cleanName(record[field])
      if (isSearchableName(name)) set.add(name)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

/**
 * Autocomplete suggestions for a query string.
 */
export function suggestLocalities(query, records = shutdowns, limit = 8) {
  const all = getAllLocalities(records)
  if (!query || !query.trim()) return all.slice(0, limit)

  const fuse = new Fuse(
    all.map((name) => ({ name })),
    {
      keys: ['name'],
      threshold: 0.4,
      ignoreLocation: true,
    },
  )

  return fuse
    .search(query.trim())
    .slice(0, limit)
    .map((r) => r.item.name)
}

export { shutdowns }
