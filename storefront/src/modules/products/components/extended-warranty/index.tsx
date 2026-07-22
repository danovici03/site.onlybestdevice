"use client"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { Check, ShieldPlus } from "@phosphor-icons/react/dist/ssr"

type ExtendedWarrantyProps = {
  warranty?: HttpTypes.StoreProduct
  selectedVariantId: string | null
  onSelect: (variantId: string | null) => void
  disabled?: boolean
}

/**
 * Card „Adaugă garanție extinsă" de sub butonul de adăugare în coș.
 * Sursa de adevăr e produsul de serviciu `garantie-extinsa` din Medusa
 * (variante „+1 an" / „+2 ani") — prețurile se editează din Admin.
 * Selecția e un radio cu toggle-off: încă un click pe opțiunea activă
 * o deselectează.
 */
const ExtendedWarranty = ({
  warranty,
  selectedVariantId,
  onSelect,
  disabled,
}: ExtendedWarrantyProps) => {
  const variants = warranty?.variants ?? []
  if (!warranty || variants.length === 0) return null

  return (
    <div
      className={clx(
        "rounded-2xl border transition-colors",
        selectedVariantId
          ? "border-emerald-500/60 bg-emerald-50/60"
          : "border-brand-dark/10 bg-white"
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldPlus size={22} weight="fill" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-sm text-brand-dark">
            Adaugă garanție extinsă
          </span>
          <span className="block text-xs text-brand-dark/60 mt-0.5 leading-snug">
            Protecție suplimentară după expirarea garanției standard
          </span>
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 px-4 pt-3 text-xs text-brand-dark/70">
        <li className="flex items-center gap-2">
          <Check size={14} weight="bold" className="text-emerald-600 shrink-0" />
          Acoperă defecte de funcționare — piese și manoperă incluse
        </li>
        <li className="flex items-center gap-2">
          <Check size={14} weight="bold" className="text-emerald-600 shrink-0" />
          Liniște și siguranță, fără costuri neprevăzute
        </li>
      </ul>

      <div className="grid grid-cols-2 gap-2 p-4">
        {variants.map((v) => {
          if (!v.id) return null
          const checked = selectedVariantId === v.id
          const { variantPrice } = getProductPrice({
            product: warranty,
            variantId: v.id,
          })

          return (
            <button
              type="button"
              key={v.id}
              onClick={() => onSelect(checked ? null : v.id!)}
              disabled={disabled}
              aria-pressed={checked}
              className={clx(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                checked
                  ? "border-emerald-600 bg-white shadow-sm"
                  : "border-brand-dark/15 bg-white hover:border-brand-dark/40",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
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
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-brand-dark leading-tight">
                  {v.title}
                </span>
                {variantPrice && (
                  <span className="block text-xs font-bold text-emerald-700 leading-tight mt-0.5">
                    {variantPrice.calculated_price}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ExtendedWarranty
