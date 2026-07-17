import { useEffect, useRef, useState } from 'react'
import strings from './strings'
import CheckButton from './components/CheckButton'
import LoadingState from './components/LoadingState'
import LocalitySearch from './components/LocalitySearch'
import ResultCard from './components/ResultCard'
import { getCurrentPosition } from './utils/geolocation'
import { reverseGeocode } from './utils/reverseGeocode'
import { matchShutdowns, matchShutdownsFromCandidates } from './utils/matchShutdown'
import { loadShutdowns } from './utils/loadShutdowns'

const STATUS = {
  IDLE: 'idle',
  LOCATING: 'locating',
  GEOCODING: 'geocoding',
  MATCHING: 'matching',
  RESULT: 'result',
  DENIED: 'denied',
  ERROR: 'error',
}

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE)
  const [locality, setLocality] = useState('')
  const [candidateLabels, setCandidateLabels] = useState([])
  const [matches, setMatches] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [dataset, setDataset] = useState([])
  const [dataSource, setDataSource] = useState('bundled')
  const [dataReady, setDataReady] = useState(false)
  const datasetRef = useRef([])

  useEffect(() => {
    let active = true
    loadShutdowns().then(({ records, source }) => {
      if (!active) return
      datasetRef.current = records
      setDataset(records)
      setDataSource(source)
      setDataReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  async function applyLocalityMatch(nameOrCandidates) {
    const isMulti = Array.isArray(nameOrCandidates)
    const candidates = isMulti
      ? nameOrCandidates
      : [{ name: nameOrCandidates, source: 'manual', strength: 'primary' }]
    const displayName = candidates[0]?.name || ''

    setLocality(displayName)
    setCandidateLabels(
      candidates
        .filter((c) => c.strength !== 'weak')
        .map((c) => c.name)
        .slice(0, 6),
    )
    setStatus(STATUS.MATCHING)

    let records = datasetRef.current
    if (!records.length) {
      const loaded = await loadShutdowns()
      records = loaded.records
      datasetRef.current = records
      setDataset(records)
      setDataSource(loaded.source)
      setDataReady(true)
    }

    await new Promise((r) => window.setTimeout(r, 200))

    const found = isMulti
      ? matchShutdownsFromCandidates(candidates, records)
      : matchShutdowns(displayName, records)

    setMatches(found)
    setStatus(STATUS.RESULT)
  }

  async function handleCheckArea() {
    setErrorMessage('')
    setMatches([])
    setLocality('')
    setCandidateLabels([])
    setStatus(STATUS.LOCATING)

    try {
      const { latitude, longitude } = await getCurrentPosition()
      setStatus(STATUS.GEOCODING)

      const geo = await reverseGeocode(latitude, longitude)
      await applyLocalityMatch(geo.candidates)
    } catch (err) {
      const code = err?.message || ''

      if (code === 'GEOLOCATION_DENIED') {
        setStatus(STATUS.DENIED)
        return
      }

      if (code === 'GEOCODE_FAILED' || code === 'GEOCODE_NO_LOCALITY') {
        setErrorMessage(strings.geocodeFailed)
        setStatus(STATUS.ERROR)
        return
      }

      setErrorMessage(strings.gpsUnavailable)
      setStatus(STATUS.ERROR)
    }
  }

  const isLoading =
    !dataReady ||
    status === STATUS.LOCATING ||
    status === STATUS.GEOCODING ||
    status === STATUS.MATCHING

  const loadingMessage = !dataReady
    ? strings.matchingShutdowns
    : status === STATUS.GEOCODING
      ? strings.checkingArea
      : status === STATUS.MATCHING
        ? strings.matchingShutdowns
        : strings.checkingLocation

  const showSearch =
    dataReady &&
    (status === STATUS.DENIED ||
      status === STATUS.ERROR ||
      status === STATUS.RESULT ||
      status === STATUS.IDLE)

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#f7f4ef] text-ink-900">
      {/* Tamil Nadu heritage background — soft, professional wash */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.14] sm:opacity-[0.16]"
          style={{
            backgroundImage: "url('/tn-heritage-bg.jpg')",
            backgroundPosition: 'center 20%',
          }}
        />
        {/* Soft cream wash so content stays readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#f7f4ef]/88 via-[#f7f4ef]/78 to-[#f7f4ef]/92" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_0%,_rgba(247,244,239,0.55)_70%)]" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-ember-500/12 blur-3xl" />
        <div className="absolute -right-16 top-40 h-64 w-64 rounded-full bg-leaf-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 pt-10 sm:px-8 sm:pt-14">
        <header className="mb-10 text-center animate-fade-in">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ember-600">
            Tamil Nadu · TANGEDCO
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
            {strings.appName}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-700 sm:text-lg">
            {strings.tagline}
          </p>
        </header>

        <main className="flex flex-1 flex-col items-center gap-6">
          {dataReady &&
            (status === STATUS.IDLE || status === STATUS.ERROR || status === STATUS.DENIED) && (
              <CheckButton onClick={handleCheckArea} disabled={isLoading} />
            )}

          {isLoading && <LoadingState message={loadingMessage} />}

          {status === STATUS.DENIED && (
            <div className="w-full max-w-sm rounded-2xl border border-ember-500/25 bg-white/80 px-5 py-4 text-center shadow-sm animate-fade-in">
              <h2 className="font-display text-lg font-semibold text-ember-700">
                {strings.gpsDeniedTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{strings.gpsDeniedBody}</p>
            </div>
          )}

          {status === STATUS.ERROR && errorMessage && (
            <div className="w-full max-w-sm rounded-2xl border border-ember-500/25 bg-white/80 px-5 py-4 text-center text-sm text-ink-700 shadow-sm animate-fade-in">
              {errorMessage}
            </div>
          )}

          {status === STATUS.RESULT && (
            <div className="flex w-full flex-col items-center gap-4">
              <div className="w-full max-w-sm rounded-xl border border-ink-200/80 bg-white/85 px-4 py-3 text-center shadow-sm backdrop-blur-md">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-200">
                  {strings.detectedArea}
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-ink-900">{locality}</p>
                {candidateLabels.length > 1 && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-700">
                    Also searched: {candidateLabels.slice(1).join(' · ')}
                  </p>
                )}
              </div>

              {matches.length > 0 ? (
                matches.map((match) => <ResultCard key={match.id} match={match} />)
              ) : (
                <ResultCard variant="clear" />
              )}

              <button
                type="button"
                onClick={handleCheckArea}
                className="text-sm font-medium text-ember-600 underline-offset-2 transition hover:underline"
              >
                {strings.tryAgain}
              </button>
            </div>
          )}

          {showSearch && !isLoading && (
            <div className="mt-2 w-full max-w-sm">
              <LocalitySearch
                initialValue={status === STATUS.RESULT ? locality : ''}
                onSelect={applyLocalityMatch}
                records={dataset}
              />
            </div>
          )}
        </main>

        <footer className="mt-12 border-t border-ink-200/60 pt-5 text-center">
          <p className="text-xs leading-relaxed text-ink-700/80">{strings.disclaimer}</p>
          <p className="mt-2 text-[11px] text-ink-200">
            {dataSource === 'live'
              ? `Showing latest published shutdown data (${dataset.length} records).`
              : 'Showing sample data — live TANGEDCO data not loaded yet.'}
          </p>
        </footer>
      </div>
    </div>
  )
}
