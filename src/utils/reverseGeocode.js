/**
 * Reverse-geocode coordinates via OpenStreetMap Nominatim and build a
 * multi-candidate search list (not just suburb).
 *
 * Candidate strength:
 *   primary   — suburb / neighbourhood / village (best for TNPDCL locality match)
 *   secondary — road, place name, useful display_name parts
 *   weak      — city / county / district / postcode (fallback only; too broad alone)
 */

const SKIP_DISPLAY_PARTS = new Set(
  [
    'india',
    'tamil nadu',
    'tamilnadu',
    'in-tn',
    'south india',
  ].map((s) => s.toLowerCase()),
)

const ROAD_SUFFIX =
  /\b(road|rd|street|st|avenue|ave|lane|ln|nagar|layout|cross|bus stop|busstand)\b/gi

function clean(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSkippablePart(part) {
  const lower = part.toLowerCase()
  if (!part || part.length < 3) return true
  if (SKIP_DISPLAY_PARTS.has(lower)) return true
  if (/^\d{5,6}$/.test(part)) return true // bare postcode as display part — kept separately
  if (/^ward\s*\d+/i.test(part)) return true
  if (/zone$/i.test(part) && part.split(/\s+/).length <= 3) return true
  if (/^iso/i.test(part)) return true
  return false
}

/**
 * @param {object} address
 * @param {string} displayName
 * @param {string} [placeName]
 * @returns {{ locality: string, displayName: string, address: object, candidates: Array<{name: string, source: string, strength: 'primary'|'secondary'|'weak'}> }}
 */
export function buildLocationCandidates(address = {}, displayName = '', placeName = '') {
  const candidates = []
  const seen = new Set()

  function add(name, source, strength) {
    const cleaned = clean(name)
    if (!cleaned) return
    const key = cleaned.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({ name: cleaned, source, strength })
  }

  // 1. Primary locality fields
  add(address.suburb, 'suburb', 'primary')
  add(address.neighbourhood, 'neighbourhood', 'primary')
  add(address.village, 'village', 'primary')
  add(address.hamlet, 'hamlet', 'primary')
  add(address.locality, 'locality', 'primary')
  add(address.quarter, 'quarter', 'primary')

  // 2. Road (+ short form without Road/Street)
  if (address.road) {
    add(address.road, 'road', 'secondary')
    const roadBase = clean(address.road.replace(ROAD_SUFFIX, ''))
    if (roadBase && roadBase.length >= 3) {
      add(roadBase, 'road_base', 'secondary')
    }
  }

  // Place / office / amenity name from Nominatim (often the POI, not a locality)
  if (placeName) {
    add(placeName, 'place_name', 'secondary')
  }

  // 3. Useful parts of display_name
  const parts = String(displayName || '')
    .split(',')
    .map((p) => clean(p))
    .filter((p) => !isSkippablePart(p))

  for (const part of parts) {
    // Skip if already added; treat remaining as secondary unless very broad
    const lower = part.toLowerCase()
    if (seen.has(lower)) continue
    if (
      lower === clean(address.city || '').toLowerCase() ||
      lower === clean(address.county || '').toLowerCase() ||
      lower === clean(address.state || '').toLowerCase() ||
      lower === clean(address.state_district || '').toLowerCase() ||
      lower === clean(address.city_district || '').toLowerCase()
    ) {
      continue // those go into weak tier below
    }
    add(part, 'display_name', 'secondary')
  }

  // 4. Weaker geographic fallbacks
  add(address.city_district, 'city_district', 'weak')
  add(address.town, 'town', 'weak')
  add(address.city, 'city', 'weak')
  add(address.municipality, 'municipality', 'weak')
  add(address.county, 'county', 'weak')
  add(address.state_district, 'state_district', 'weak')

  // 5. Postcode (exact-ish; rarely in TNPDCL tables, but keep for later)
  if (address.postcode) {
    add(address.postcode, 'postcode', 'weak')
  }

  const locality =
    candidates.find((c) => c.strength === 'primary')?.name ||
    candidates.find((c) => c.strength === 'secondary')?.name ||
    candidates[0]?.name ||
    null

  return {
    locality,
    displayName: displayName || locality || '',
    address,
    candidates,
  }
}

/**
 * @param {number} lat
 * @param {number} lon
 */
export async function reverseGeocode(lat, lon) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('GEOCODE_FAILED')
  }

  const data = await response.json()
  const address = data.address || {}
  const built = buildLocationCandidates(address, data.display_name || '', data.name || '')

  if (!built.locality || built.candidates.length === 0) {
    throw new Error('GEOCODE_NO_LOCALITY')
  }

  return built
}
