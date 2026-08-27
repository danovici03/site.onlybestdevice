"use client"

import { addWarrantyToCart } from "@lib/data/cart"
import { useSessionRefresh } from "@lib/context/session-context"
import { warrantyOptionsFor } from "@lib/util/warranty"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { ShieldPlus } from "@phosphor-icons/react/dist/ssr"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"

type WarrantyOfferProps = {
  /** Produsul de serviciu „Garanție extinsă" cu variantele lui. */
  warranty?: HttpTypes.StoreProduct
  /** Linia de coș pentru care se oferă garanția. */
  item: HttpTypes.StoreCartLineItem
  /** Variantă strânsă, pentru rezumatul din finalizare. */
  compact?: boolean
}

/**
 * Propunerea de garanție extinsă din coș și din rezumatul de finalizare, pentru
 * produsele care n-au primit-o pe pagina de produs. Discretă intenționat: o
 * bandă subțire sub produs, nu un card care concurează cu butonul de finalizare.
 *
 * Garanția acoperă câte o bucată, deci se adaugă în cantitatea liniei, iar
 * legătura cu produsul o face serverul, în `metadata` liniei — altfel n-am ști
 * cui i s-a oferit deja. Prețul e cel al produsului acoperit, nu unul fix.
 */
const WarrantyOffer = ({ warranty, item, compact }: WarrantyOfferProps) => {
  const countryCode = useParams().countryCode as string
  const refresh = useSessionRefresh()
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState(false)

  // `item.product` poartă `metadata`, deci prețul afișat aici e cel al
  // produsului acoperit — vezi `+items.product.metadata` din `retrieveCart`.
  const options = useMemo(
    () => warrantyOptionsFor(item.product, warranty),
    [item.product, warranty]
  )

  if (!options.length || !item.product_id) return null

  const add = async (variantId: string) => {
    setAddingId(variantId)
    setError(false)
    try {
      await addWarrantyToCart({
        variantId,
        targetProductId: item.product_id!,
        quantity: item.quantity,
        countryCode,
      })
      await refresh()
    } catch {
      setError(true)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div
      className={clx(
        "flex flex-wrap items-center rounded-2xl border border-emerald-600/20 bg-emerald-50/50",
        compact
          ? "mt-2 gap-x-2 gap-y-1.5 px-2.5 py-2"
          : "mt-3 gap-x-3 gap-y-2 px-3.5 py-2.5"
      )}
      data-testid="warranty-offer"
    >
      <ShieldPlus
        size={compact ? 14 : 16}
        weight="fill"
        className="shrink-0 text-emerald-600"
      />
      <span
        className={clx(
          "font-bold text-brand-dark",
          compact ? "text-[11px]" : "text-xs"
        )}
      >
        {error
          ? "Nu s-a putut adăuga. Încearcă din nou."
          : "Adaugă garanție extinsă"}
      </span>

      <span className="ml-auto flex flex-wrap items-center gap-1.5">
        {options.map((option) => {
          const busy = addingId === option.variantId

          return (
            <button
              key={option.variantId}
              type="button"
              onClick={() => add(option.variantId)}
              disabled={addingId !== null}
              className={clx(
                "rounded-full border border-emerald-600/30 bg-white font-bold text-emerald-800 transition-colors",
                "hover:border-emerald-600 hover:bg-emerald-600 hover:text-white",
                "disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-emerald-800",
                compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
              )}
            >
              {busy ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-700 align-middle" />
              ) : (
                <>
                  {option.title} · {option.price}
                </>
              )}
            </button>
          )
        })}
      </span>
    </div>
  )
}

export default WarrantyOffer
