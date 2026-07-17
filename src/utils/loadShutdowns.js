import bundled from '../data/shutdowns.json'

/**
 * Load the shutdown dataset and optional scrape metadata.
 *
 * Prefers live data at /shutdowns.json (written by the scraper).
 * Falls back to the bundled sample if live data is missing.
 *
 * @returns {Promise<{
 *   records: object[],
 *   source: 'live' | 'bundled',
 *   meta: object | null
 * }>}
 */
export async function loadShutdowns() {
  let meta = null
  try {
    const metaRes = await fetch('/shutdowns.meta.json', { cache: 'no-store' })
    if (metaRes.ok) {
      meta = await metaRes.json()
    }
  } catch {
    // Meta is optional.
  }

  try {
    const res = await fetch('/shutdowns.json', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return { records: data, source: 'live', meta }
      }
    }
  } catch {
    // Ignore and fall back to bundled data.
  }

  return { records: bundled, source: 'bundled', meta }
}

/**
 * Format lastFetchedAt for the footer, e.g. "17 Jul 2026, 6:05 AM".
 */
export function formatLastFetched(meta) {
  if (!meta?.lastFetchedAt) return null
  const d = new Date(meta.lastFetchedAt)
  if (Number.isNaN(d.getTime())) return meta.lastFetchedAt

  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
