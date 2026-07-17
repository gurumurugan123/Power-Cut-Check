import bundled from '../data/shutdowns.json'

/**
 * Load the shutdown dataset.
 *
 * Prefers live data served at /shutdowns.json (written by the scraper into
 * the public/ folder, updatable without a rebuild). Falls back to the sample
 * dataset bundled at build time if the live file is missing or invalid.
 *
 * The matching logic makes no assumption about how this JSON was produced —
 * only its shape.
 *
 * @returns {Promise<{ records: object[], source: 'live' | 'bundled' }>}
 */
export async function loadShutdowns() {
  try {
    const res = await fetch('/shutdowns.json', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return { records: data, source: 'live' }
      }
    }
  } catch {
    // Ignore and fall back to bundled data.
  }
  return { records: bundled, source: 'bundled' }
}
