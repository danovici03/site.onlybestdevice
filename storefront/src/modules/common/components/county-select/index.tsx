"use client"

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react"
import { filterCounties } from "@lib/util/counties"
import { clx } from "@medusajs/ui"
import { CaretDown, Check } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

type CountySelectProps = {
  label: string
  name: string
  /** Controlat (checkout). Lasă gol pentru formularele cu `form action`. */
  value?: string
  onChange?: (value: string) => void
  /** Necontrolat: valoarea inițială din adresa salvată. */
  defaultValue?: string
  required?: boolean
  placeholder?: string
  "data-testid"?: string
}

/**
 * Câmp de județ cu căutare. 42 de opțiuni sunt prea multe pentru un <select>
 * nativ, care caută doar după prima literă și doar de la începutul numelui.
 * Aici se scrie „severin" și apare Caraș-Severin, cu sau fără diacritice.
 *
 * Carcasa e aceeași ca la `Input` (înălțime, bordură, etichetă flotantă), iar
 * lista se ancorează prin portal ca să nu fie tăiată de modalele din cont.
 */
const CountySelect = ({
  label,
  name,
  value,
  onChange,
  defaultValue,
  required,
  placeholder = "Caută județul",
  "data-testid": dataTestid,
}: CountySelectProps) => {
  const [query, setQuery] = useState("")
  const [internal, setInternal] = useState(defaultValue ?? "")

  const selected = value !== undefined ? value : internal
  const select = (next: string | null) => {
    const county = next ?? ""
    if (onChange) onChange(county)
    else setInternal(county)
  }

  const matches = filterCounties(query)

  return (
    <div className="flex flex-col w-full">
      <Combobox
        value={selected || null}
        onChange={select}
        onClose={() => setQuery("")}
        immediate
      >
        {/* Valoarea reală pentru form action-urile din cont; ComboboxInput
            ține doar textul căutat. */}
        <input type="hidden" name={name} value={selected} />

        <div className="flex relative z-0 w-full txt-compact-medium">
          <ComboboxInput
            aria-label={label}
            required={required}
            displayValue={(county: string | null) => county ?? ""}
            onChange={(e) => setQuery(e.target.value)}
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
          {matches.length === 0 ? (
            <div className="px-4 py-2.5 text-sm text-brand-dark/50">
              Niciun județ pentru „{query}”
            </div>
          ) : (
            matches.map((county) => (
              <ComboboxOption
                key={county}
                value={county}
                className={clx(
                  "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-brand-dark",
                  "data-[focus]:bg-brand-light data-[selected]:font-bold"
                )}
              >
                <Check
                  size={14}
                  weight="bold"
                  className={clx(
                    "shrink-0 text-emerald-600",
                    county === selected ? "opacity-100" : "opacity-0"
                  )}
                />
                {county}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </Combobox>
    </div>
  )
}

export default CountySelect
