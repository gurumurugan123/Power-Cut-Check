import strings from '../strings'

export default function CheckButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative w-full max-w-sm overflow-hidden rounded-2xl bg-ember-600 px-8 py-5 text-lg font-semibold text-white shadow-glow transition duration-300 hover:bg-ember-500 hover:shadow-[0_16px_48px_-12px_rgba(196,93,34,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
    >
      <span className="relative z-10 flex items-center justify-center gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition group-hover:bg-white/25"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="M4.93 19.07l2.83-2.83" />
            <path d="M16.24 7.76l2.83-2.83" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        {strings.checkButton}
      </span>
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition duration-700 group-hover:translate-x-full"
        aria-hidden="true"
      />
    </button>
  )
}
