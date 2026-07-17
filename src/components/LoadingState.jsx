import strings from '../strings'

export default function LoadingState({ message }) {
  return (
    <div
      className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-ink-200/60 bg-white/85 px-6 py-10 text-center shadow-sm backdrop-blur-md animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 rounded-full border-2 border-ember-500/20" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-ember-500" />
        <span className="absolute inset-3 rounded-full bg-ember-500/10" />
      </div>
      <p className="font-sans text-base font-medium text-ink-800">
        {message || strings.checkingLocation}
      </p>
    </div>
  )
}
