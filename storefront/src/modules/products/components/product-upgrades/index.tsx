"use client"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { Check, Sparkle } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"

export type UpgradeSelection = {
  productId: string
  variantId: string
}

const pickDefaultVariant = (product: HttpTypes.StoreProduct) => {
  const variants = product.variants ?? []
  if (variants.length === 0) return undefined
  return (
    variants.find((v) => {
      const qty = (v as any).inventory_quantity as number | undefined
      const manage = v.manage_inventory
      const backorder = v.allow_backorder
      if (!manage) return true
      if (backorder) return true
      return (qty ?? 0) > 0
    }) ?? variants[0]
  )
}

type ProductUpgradesProps = {
  upgrades: HttpTypes.StoreProduct[]
  selectedVariantIds: string[]
  onToggle: (selection: UpgradeSelection, checked: boolean) => void
  disabled?: boolean
}

const ProductUpgrades = ({
  upgrades,
  selectedVariantIds,
  onToggle,
  disabled,
}: ProductUpgradesProps) => {
  if (upgrades.length === 0) return null

  return (
    <div className="rounded-2xl border border-brand-dark/10 bg-white">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Sparkle size={16} weight="fill" className="text-brand-accent" />
        <span className="font-bold text-sm text-brand-dark">
          Completa l'ambiente
        </span>
      </div>
      <ul className="flex flex-col">
        {upgrades.map((p) => {
          const variant = pickDefaultVariant(p)
          if (!variant?.id) return null
          const checked = selectedVariantIds.includes(variant.id)
          const { variantPrice, cheapestPrice } = getProductPrice({
            product: p,
            variantId: variant.id,
          })
          const price = variantPrice ?? cheapestPrice
          const thumb = p.thumbnail ?? p.images?.[0]?.url

          return (
            <li
              key={p.id}
              className="border-t border-brand-dark/5 first:border-t"
            >
              <label
                className={clx(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                  {
                    "bg-brand-light/40": checked,
                    "hover:bg-brand-light/30": !checked,
                    "opacity-50 cursor-not-allowed": disabled,
                  }
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) =>
                    onToggle(
                      { productId: p.id, variantId: variant.id! },
                      e.target.checked
                    )
                  }
                />
                <span
                  className={clx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    checked
                      ? "bg-brand-dark border-brand-dark text-white"
                      : "bg-white border-brand-dark/25"
                  )}
                  aria-hidden
                >
                  {checked && <Check size={12} weight="bold" />}
                </span>
                {thumb && (
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-brand-light">
                    <Image
                      src={thumb}
                      alt={p.title ?? ""}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  {p.collection && (
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-brand-dark/50 font-bold">
                      {p.collection.title}
                    </span>
                  )}
                  <span className="block text-sm font-bold text-brand-dark truncate">
                    {p.title}
                  </span>
                </span>
                {price && (
                  <span className="text-sm font-bold text-brand-dark shrink-0">
                    {price.calculated_price}
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ProductUpgrades
