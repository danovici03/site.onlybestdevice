import { XMarkMini } from "@medusajs/icons"
import { Badge, Input, Text } from "@medusajs/ui"
import { KeyboardEvent, ReactNode, useMemo, useState } from "react"

export type ChipSuggestion = {
  value: string
  /** Linia gri de sub valoare (ex. „42 produse · 8 GB, 12 GB"). */
  hint?: ReactNode
}

/**
 * Listă de texte editată ca etichete: Enter sau virgulă adaugă, × scoate.
 *
 * Folosită pentru sursele unui filtru (etichete din fișa tehnică) și pentru
 * alias-urile unei valori. La surse, sugestiile sunt etichetele reale din
 * catalog: o sursă scrisă „aproape corect" („Memorie Ram" în loc de „Memorie
 * RAM") ar trece de validare, dar potrivirea ignoră doar diacriticele și
 * majusculele, nu și greșelile — deci alegerea din listă e calea sigură.
 */
const ChipInput = ({
  values,
  onChange,
  placeholder,
  suggestions = [],
  maxSuggestions = 8,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: ChipSuggestion[]
  maxSuggestions?: number
}) => {
  const [draft, setDraft] = useState("")
  const [focused, setFocused] = useState(false)

  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase())

  const add = (raw: string) => {
    const v = raw.trim()
    if (!v || has(v)) return setDraft("")
    onChange([...values, v])
    setDraft("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add(draft)
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return suggestions
      .filter((s) => !values.some((v) => v.toLowerCase() === s.value.toLowerCase()))
      .filter((s) => !q || s.value.toLowerCase().includes(q))
      .slice(0, maxSuggestions)
  }, [draft, suggestions, values, maxSuggestions])

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} size="2xsmall" className="gap-1 pr-1">
              {v}
              <button
                type="button"
                aria-label={`Scoate ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-ui-fg-muted hover:text-ui-fg-base"
              >
                <XMarkMini />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          size="small"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          // Întârziere: altfel blur-ul închide lista înainte ca click-ul pe o
          // sugestie să ajungă la ea.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {focused && matches.length > 0 && (
          <div className="bg-ui-bg-base shadow-elevation-flyout absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg p-1">
            {matches.map((s) => (
              <button
                key={s.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s.value)}
                className="hover:bg-ui-bg-base-hover flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left"
              >
                <Text size="small" leading="compact" weight="plus">
                  {s.value}
                </Text>
                {s.hint && (
                  <Text size="xsmall" leading="compact" className="text-ui-fg-subtle truncate max-w-full">
                    {s.hint}
                  </Text>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ChipInput
