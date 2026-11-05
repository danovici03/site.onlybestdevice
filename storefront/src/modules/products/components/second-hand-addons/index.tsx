"use client"

import { AddonOption } from "@lib/util/second-hand"
import { clx } from "@medusajs/ui"
import {
  BatteryFull,
  Check,
  DeviceMobile,
} from "@phosphor-icons/react/dist/ssr"

type SecondHandAddonsProps = {
  options: AddonOption[]
  selectedVariantIds: string[]
  onToggle: (variantId: string) => void
  disabled?: boolean
}

const ICONS = {
  battery: BatteryFull,
  screen_protector: DeviceMobile,
} as const

const NOTES = {
  battery: "Înlocuită de noi înainte de livrare",
  screen_protector: "Montată de echipa noastră, fără bule",
} as const

/**
 * Opțiunile pentru produsele Second Hand: „Baterie nouă 100%" și „Folie de
 * sticlă montată". Ca la garanția extinsă, stau deasupra butonului — intră în
 * coș odată cu telefonul, legate de el. Spre deosebire de garanție (o singură
 * durată), aici se pot bifa amândouă.
 */
const SecondHandAddons = ({
  options,
  selectedVariantIds,
  onToggle,
  disabled,
}: SecondHandAddonsProps) => {
  if (options.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-brand-dark">
        Pregătim telefonul pentru tine
      </span>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const checked = selectedVariantIds.includes(option.variantId)
          const Icon = ICONS[option.key]
          return (
            <button
              type="button"
              key={option.variantId}
              onClick={() => onToggle(option.variantId)}
              disabled={disabled}
              aria-pressed={checked}
              className={clx(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                checked
                  ? "border-emerald-600 bg-emerald-50/60"
                  : "border-brand-dark/10 bg-white hover:border-brand-dark/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={clx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  checked
                    ? "bg-emerald-600 text-white"
                    : "bg-brand-light text-brand-dark"
                )}
                aria-hidden
              >
                <Icon size={18} weight="fill" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-brand-dark leading-tight">
                  {option.title}
                </span>
                <span className="block text-xs text-brand-dark/60 leading-tight mt-0.5">
                  {NOTES[option.key]}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold text-emerald-700">
                + {option.price}
              </span>
              <span
                className={clx(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  checked
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-brand-dark/25"
                )}
                aria-hidden
              >
                {checked && <Check size={12} weight="bold" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SecondHandAddons
