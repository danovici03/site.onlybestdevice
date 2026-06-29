import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import Image from "next/image"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  valueImages?: Record<string, string>
  "data-testid"?: string
}

const DIMENSION_TITLE_RE = /dimension|misur|tagli/i

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  valueImages,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)
  const isDimensionOption = DIMENSION_TITLE_RE.test(option.title ?? title ?? "")
  const hasAnyImage =
    !isDimensionOption &&
    !!valueImages &&
    filteredOptions.some((v) => valueImages[v])

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-brand-dark/60">{title}</span>
        {current && (
          <span className="font-bold text-brand-dark">{current}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2" data-testid={dataTestId}>
        {filteredOptions.map((v) => {
          const isActive = v === current
          const image = valueImages?.[v]

          if (hasAnyImage && image) {
            return (
              <button
                key={v}
                type="button"
                onClick={() => updateOption(option.id, v)}
                disabled={disabled}
                aria-label={v}
                aria-pressed={isActive}
                title={v}
                data-testid="option-button"
                className={clx(
                  "relative h-14 w-14 rounded-2xl overflow-hidden border-2 transition-all bg-brand-light",
                  {
                    "border-brand-dark ring-2 ring-brand-dark/10 ring-offset-2 ring-offset-white":
                      isActive,
                    "border-transparent hover:border-brand-dark/30": !isActive,
                    "opacity-50 cursor-not-allowed": disabled,
                  }
                )}
              >
                <Image
                  src={image}
                  alt={v}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </button>
            )
          }

          if (isDimensionOption) {
            const parts = v.split(/\s*[x×]\s*/i).filter(Boolean)
            return (
              <button
                key={v}
                type="button"
                onClick={() => updateOption(option.id, v)}
                disabled={disabled}
                aria-label={v}
                aria-pressed={isActive}
                title={v}
                data-testid="option-button"
                className={clx(
                  "h-14 w-14 rounded-2xl border-2 transition-all flex flex-col items-center justify-center leading-tight text-[11px] font-bold",
                  {
                    "border-brand-dark bg-brand-dark text-white": isActive,
                    "border-brand-dark/15 bg-white text-brand-dark hover:border-brand-dark/40":
                      !isActive,
                    "opacity-50 cursor-not-allowed": disabled,
                  }
                )}
              >
                {parts.length >= 2 ? (
                  <>
                    <span>{parts[0]}</span>
                    <span>x{parts.slice(1).join("x")}</span>
                  </>
                ) : (
                  <span>{v}</span>
                )}
              </button>
            )
          }

          return (
            <button
              key={v}
              type="button"
              onClick={() => updateOption(option.id, v)}
              disabled={disabled}
              data-testid="option-button"
              className={clx(
                "px-5 py-2.5 rounded-full text-sm font-bold border transition-all",
                {
                  "bg-brand-dark text-white border-brand-dark": isActive,
                  "bg-white text-brand-dark border-brand-dark/15 hover:border-brand-dark/40":
                    !isActive,
                  "opacity-50 cursor-not-allowed": disabled,
                }
              )}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
