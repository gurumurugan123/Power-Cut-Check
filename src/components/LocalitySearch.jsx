import { useEffect, useId, useRef, useState } from 'react'
import strings from '../strings'
import { suggestLocalities } from '../utils/matchShutdown'

export default function LocalitySearch({ onSelect, initialValue = '', records }) {
  const listId = useId()
  const [query, setQuery] = useState(initialValue)
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const containerRef = useRef(null)

  useEffect(() => {
    setQuery(initialValue)
  }, [initialValue])

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function updateQuery(value) {
    setQuery(value)
    const next = suggestLocalities(value, records)
    setSuggestions(next)
    setOpen(next.length > 0)
    setHighlight(-1)
  }

  function choose(locality) {
    setQuery(locality)
    setOpen(false)
    setSuggestions([])
    onSelect(locality)
  }

  function handleKeyDown(event) {
    if (!open || suggestions.length === 0) {
      if (event.key === 'Enter' && query.trim()) {
        event.preventDefault()
        onSelect(query.trim())
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const pick = highlight >= 0 ? suggestions[highlight] : query.trim()
      if (pick) choose(pick)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <label htmlFor={listId} className="mb-2 block text-left text-sm font-medium text-ink-700">
        {strings.searchHint}
      </label>
      <div className="relative">
        <input
          id={listId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${listId}-list`}
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onFocus={() => {
            const next = suggestLocalities(query, records)
            setSuggestions(next)
            setOpen(next.length > 0)
          }}
          onKeyDown={handleKeyDown}
          placeholder={strings.searchPlaceholder}
          className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3.5 pr-12 text-base text-ink-900 shadow-sm outline-none transition placeholder:text-ink-200 focus:border-ember-500 focus:ring-2 focus:ring-ember-500/25"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => query.trim() && onSelect(query.trim())}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-ink-700"
          aria-label="Search"
        >
          Go
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((name, index) => (
            <li key={name} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                className={`w-full px-4 py-2.5 text-left text-sm transition ${
                  index === highlight
                    ? 'bg-ember-500/10 text-ember-700'
                    : 'text-ink-800 hover:bg-ink-50'
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
