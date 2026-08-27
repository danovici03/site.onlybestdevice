"use client"

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { CaretDown } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef, useState } from "react"

export type LocalitySuggestion = {
  name: string
  county: string
  postalCode: string
}

type LocalitySelectProps = {
  label: string
  name: string
  /** Numele localității (exact ce ajunge în `address.city`). */
  value: string
  /** Text liber, la fiecare tastă. */
  onChange: (value: string) => void
  /** Alegere din listă: aduce și județul, uneori și codul poștal. */
  onSelect: (locality: LocalitySuggestion) => void
  /** Județul deja completat — avantajează localitățile din el la căutare. */
  county?: string
  required?: boolean
  "data-testid"?: string
}

/** Cât la sugestiile din bara de căutare: o tastare normală nu cere nimic. */
const DEBOUNCE_MS = 150
const MIN_QUERY = 2

/**
 * Câmp de localitate cu autocomplete din nomenclatorul SIRUTA (~13.800 de
 * intrări, servite de `/api/localities`).
 *
 * Alegerea din listă completează județul și, unde codul poștal e neambiguu,
 * și pe acela — clientul umple un singur câmp în loc de trei, iar denumirea
 * care ajunge pe AWB e cea oficială, nu „Cluj Napoca" sau „Bucuresti sect 3".
 *
 * Textul liber rămâne permis: nomenclatorul are lipsuri (cartiere, denumiri
 * noi), iar un câmp care refuză ce scrie clientul e mai rău decât unul care
 * acceptă o denumire neoficială.
 */
const LocalitySelect = ({
  label,
  name,
  value,
  onChange,
  onSelect,
  county,
  required,
  "data-testid": dataTestid,
}: LocalitySelectProps) => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LocalitySuggestion[]>([])

  // Nu cerem sugestii pentru valoarea venită din coș sau din geolocalizare:
  // lista s-ar deschide singură peste formular la încărcarea paginii.
  const typed = useRef(false)

  useEffect(() => {
    if (!typed.current || query.trim().length < MIN_QUERY) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/localities?q=${encodeURIComponent(query.trim())}` +
            (county ? `&county=${encodeURIComponent(county)}` : ""),
          { signal: controller.signal }
        )
        const data = await res.json()
        setResults(Array.isArray(data.localities) ? data.localities : [])
      } catch {
        // Abort la fiecare tastă e normal, nu o eroare de raportat.
        if (!controller.signal.aborted) setResults([])
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, county])

  // Numele se repetă (1.415 omonime în nomenclator), deci opțiunile au nevoie
  // de o valoare unică. `value` din formular e numele simplu, iar `displayValue`
  // taie sufixul — așa merge și pentru valoarea venită din coș.
  const keyOf = (l: LocalitySuggestion) => `${l.name}|${l.county}`

  const handleSelect = (composite: string | null) => {
    if (!composite) return
    const picked = results.find((l) => keyOf(l) === composite)
    if (picked) onSelect(picked)
    else onChange(composite.split("|")[0])
    setQuery("")
  }

  return (
    <div className="flex flex-col w-full">
      <Combobox value={value || null} onChange={handleSelect} immediate>
        {/* Valoarea reală pentru formularele cu `form action` (contul). */}
        <input type="hidden" name={name} value={value} />

        <div className="flex relative z-0 w-full txt-compact-medium">
          <ComboboxInput
            aria-label={label}
            required={required}
            autoComplete="address-level2"
            displayValue={(v: string | null) => v?.split("|")[0] ?? ""}
            onChange={(e) => {
              typed.current = true
              setQuery(e.target.value)
              onChange(e.target.value)
            }}
            placeholder=" "
            data-testid={dataTestid}
            className="pt-4 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-ui-border-base hover:bg-ui-bg-field-hover"
          />
          <label
            className="flex items-center justify-center mx-3 px-1 absolute duration-300 top-3 -z-1 origin-0 text-ui-fg-subtle -translate-y-2 text-xsmall-regular"
            aria-hidden
          >
            {label}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <ComboboxButton className="absolute right-3 inset-y-0 flex items-center text-ui-fg-subtle">
            <CaretDown size={14} weight="bold" />
          </ComboboxButton>
        </div>

        <ComboboxOptions
          anchor="bottom start"
          className="z-[90] mt-1 max-h-64 w-[var(--input-width)] overflow-y-auto rounded-md border border-ui-border-base bg-white py-1 shadow-lg empty:hidden"
        >
          {results.map((locality) => (
            <ComboboxOption
              key={keyOf(locality)}
              value={keyOf(locality)}
              className={clx(
                "flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm text-brand-dark",
                "data-[focus]:bg-brand-light"
              )}
            >
              <span className="truncate">{locality.name}</span>
              <span className="shrink-0 text-xs text-brand-dark/45">
                jud. {locality.county}
              </span>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </Combobox>
    </div>
  )
}

export default LocalitySelect
