import strings from '../strings'
import { getTodayAndTomorrow } from '../utils/matchShutdown'

function formatDateLabel(dateStr) {
  const { today, tomorrow } = getTodayAndTomorrow()
  if (dateStr === today) return `${strings.today} · ${dateStr}`
  if (dateStr === tomorrow) return `${strings.tomorrow} · ${dateStr}`
  return dateStr
}

export default function ResultCard({ match, variant = 'alert' }) {
  if (variant === 'clear') {
    return (
      <article className="w-full max-w-sm overflow-hidden rounded-2xl border border-leaf-400/40 bg-gradient-to-br from-leaf-400/15 via-white/95 to-white/95 shadow-sm backdrop-blur-md animate-fade-in">
        <div className="border-l-4 border-leaf-500 px-5 py-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf-500/15 text-leaf-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="font-display text-xl font-semibold text-leaf-600">{strings.noPowerCut}</h2>
          </div>
          <p className="text-sm leading-relaxed text-ink-700">{strings.noPowerCutNote}</p>
        </div>
      </article>
    )
  }

  return (
    <article className="w-full max-w-sm overflow-hidden rounded-2xl border border-ember-500/30 bg-gradient-to-br from-ember-500/15 via-white/95 to-white/95 shadow-sm backdrop-blur-md animate-fade-in">
      <div className="border-l-4 border-ember-600 px-5 py-5">
        <div className="mb-3 flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember-500/15 text-ember-600">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-ember-700">{strings.powerCutFound}</h2>
            {match.matchedLocality && (
              <p className="mt-0.5 text-sm text-ink-700">
                Matched: {match.matchedLocality}
                {match.matchedQuery && match.matchedQuery !== match.matchedLocality
                  ? ` (via “${match.matchedQuery}”)`
                  : ''}
              </p>
            )}
          </div>
        </div>

        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-200">{strings.date}</dt>
            <dd className="font-medium text-ink-900">{formatDateLabel(match.date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-200">{strings.time}</dt>
            <dd className="font-medium text-ink-900">
              {match.fromTime} – {match.toTime}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-200">{strings.reason}</dt>
            <dd className="text-right font-medium text-ink-900">{match.reason}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-200">{strings.circle}</dt>
            <dd className="font-medium text-ink-900">{match.circle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-200">{strings.substation}</dt>
            <dd className="text-right font-medium text-ink-900">{match.substation}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-200">{strings.feeder}</dt>
            <dd className="text-right font-medium text-ink-900">{match.feeder}</dd>
          </div>
          <div>
            <dt className="mb-1 text-ink-200">{strings.localities}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {(match.localities || []).map((name) => (
                <span
                  key={name}
                  className="rounded-md bg-ember-500/10 px-2 py-0.5 text-xs font-medium text-ember-700"
                >
                  {name}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
