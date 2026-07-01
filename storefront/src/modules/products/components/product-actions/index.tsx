"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import {
  ArrowUUpLeft,
  Clock,
  EnvelopeSimple,
  FacebookLogo,
  MapPin,
  Minus,
  Plus,
  Recycle,
  ShieldCheck,
  ShoppingBag,
  Storefront,
  WhatsappLogo,
  XLogo,
} from "@phosphor-icons/react/dist/ssr"
import { COMPANY } from "@lib/util/company-info"
import { isOutletProduct } from "@lib/util/outlet"
import KlarnaMessaging from "@modules/products/components/klarna-messaging"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import ProductUpgrades, {
  UpgradeSelection,
} from "@modules/products/components/product-upgrades"
import { isEqual } from "lodash"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import MobileActions from "./mobile-actions"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  upgrades?: HttpTypes.StoreProduct[]
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  upgrades = [],
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isBuyingNow, setIsBuyingNow] = useState(false)
  const [upgradeSelections, setUpgradeSelections] = useState<UpgradeSelection[]>(
    []
  )
  const [addError, setAddError] = useState<string | null>(null)
  const countryCode = useParams().countryCode as string

  const toggleUpgrade = (selection: UpgradeSelection, checked: boolean) => {
    setUpgradeSelections((prev) => {
      const without = prev.filter((s) => s.productId !== selection.productId)
      return checked ? [...without, selection] : without
    })
  }
  const selectedUpgradeIds = upgradeSelections.map((s) => s.variantId)

  // Preselect options from URL ?v_id, or from the only variant when there is one.
  useEffect(() => {
    const variants = product.variants ?? []
    if (variants.length === 0) return

    const urlVariantId = searchParams.get("v_id")
    const fromUrl = urlVariantId
      ? variants.find((v) => v.id === urlVariantId)
      : undefined
    const fallback = variants.length === 1 ? variants[0] : undefined
    const target = fromUrl ?? fallback

    if (target) {
      setOptions(optionsAsKeymap(target.options) ?? {})
    }
    // Run only when the product changes — we don't want to fight user clicks
    // by re-applying the URL on every searchParams change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  const valueImagesByOption = useMemo(() => {
    const variants = product.variants ?? []
    const variantImage = (v: HttpTypes.StoreProductVariant) =>
      (v as any)?.images?.[0]?.url ?? (v.metadata as any)?.image

    const map: Record<string, Record<string, string>> = {}

    for (const opt of product.options ?? []) {
      const valueMap: Record<string, string> = {}

      for (const value of opt.values ?? []) {
        // 1. Prefer a variant that matches the user's other selected options
        //    AND has this option's value. Falls back to any variant with the value.
        const otherSelections = Object.entries(options).filter(
          ([oid, val]) => oid !== opt.id && val
        )

        const candidates = variants.filter((v) =>
          (v.options ?? []).some(
            (vo: any) => vo.option_id === opt.id && vo.value === value.value
          )
        )

        const preferred =
          candidates.find((v) =>
            otherSelections.every(([oid, val]) =>
              (v.options ?? []).some(
                (vo: any) => vo.option_id === oid && vo.value === val
              )
            )
          ) ?? candidates[0]

        const image = preferred ? variantImage(preferred) : undefined
        if (typeof image === "string") valueMap[value.value] = image
      }

      if (Object.keys(valueMap).length > 0) map[opt.id] = valueMap
    }
    return map
  }, [product.options, product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant])

  const inStock = useMemo(() => {
    if (selectedVariant && !selectedVariant.manage_inventory) return true
    if (selectedVariant?.allow_backorder) return true
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    )
      return true
    return false
  }, [selectedVariant])

  const lowStockCount = useMemo(() => {
    if (!selectedVariant?.manage_inventory) return null
    if (selectedVariant?.allow_backorder) return null
    const qty = selectedVariant?.inventory_quantity ?? 0
    if (qty > 0 && qty <= 10) return qty
    return null
  }, [selectedVariant])

  const maxStock = useMemo(() => {
    if (!selectedVariant?.manage_inventory) return 99
    if (selectedVariant?.allow_backorder) return 99
    return Math.max(1, selectedVariant?.inventory_quantity ?? 1)
  }, [selectedVariant])

  const isBackorder = useMemo(() => {
    if (!selectedVariant?.manage_inventory) return false
    if (!selectedVariant?.allow_backorder) return false
    return (selectedVariant?.inventory_quantity ?? 0) <= 0
  }, [selectedVariant])

  const leadTimeWeeks = useMemo(() => {
    const raw = (product.metadata as any)?.lead_time_weeks
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null
  }, [product.metadata])

  useEffect(() => {
    setQuantity((q) => Math.min(q, maxStock))
  }, [maxStock])

  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: selectedVariant?.id,
  })
  const selectedPrice = selectedVariant ? variantPrice : cheapestPrice
  const onSale = selectedPrice?.price_type === "sale"

  const actionsRef = useRef<HTMLDivElement>(null)
  const inView = useIntersection(actionsRef, "0px")

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null
    setIsAdding(true)
    setAddError(null)
    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity,
        countryCode,
      })
      for (const sel of upgradeSelections) {
        await addToCart({
          variantId: sel.variantId,
          quantity: 1,
          countryCode,
        })
      }
      setUpgradeSelections([])
    } catch (e) {
      setAddError(
        e instanceof Error
          ? e.message
          : "A apărut o eroare. Încearcă din nou."
      )
    } finally {
      setIsAdding(false)
    }
  }

  const handleBuyNow = async () => {
    if (!selectedVariant?.id) return null
    setIsBuyingNow(true)
    await addToCart({
      variantId: selectedVariant.id,
      quantity,
      countryCode,
    })
    router.push(`/${countryCode}/cart`)
  }

  const ctaLabel = !selectedVariant
    ? "Selectează opțiunile"
    : !inStock || !isValidVariant
    ? "Stoc epuizat"
    : "Adaugă în coș"

  const cartDisabled =
    !inStock || !selectedVariant || !!disabled || isAdding || !isValidVariant

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? ""
  const shareText = encodeURIComponent(product.title ?? "")
  const encodedUrl = encodeURIComponent(`${baseUrl}${pathname}`)

  return (
    <>
      <div className="flex flex-col gap-y-6" ref={actionsRef}>
        <div className="flex items-baseline gap-3 pb-6 border-b border-brand-dark/10">
          {selectedPrice ? (
            <>
              <span
                className={clx(
                  "font-serif text-3xl lg:text-4xl",
                  onSale ? "text-brand-accent" : "text-brand-dark"
                )}
                data-testid="product-price"
                data-value={selectedPrice.calculated_price_number}
              >
                {!selectedVariant && (
                  <span className="text-base font-sans text-brand-dark/50 mr-2">
                    Da
                  </span>
                )}
                {selectedPrice.calculated_price}
              </span>
              {onSale && (
                <>
                  <span
                    className="text-brand-dark/40 line-through text-lg"
                    data-testid="original-product-price"
                    data-value={selectedPrice.original_price_number}
                  >
                    {selectedPrice.original_price}
                  </span>
                  <span className="bg-brand-accent text-white px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                    -{selectedPrice.percentage_diff}%
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="block w-32 h-9 bg-brand-light animate-pulse rounded-md" />
          )}
        </div>

        {(product.variants?.length ?? 0) > 1 && (
          <div className="flex flex-col gap-y-5">
            {(product.options || []).map((option) => (
              <OptionSelect
                key={option.id}
                option={option}
                current={options[option.id]}
                updateOption={setOptionValue}
                title={option.title ?? ""}
                valueImages={valueImagesByOption[option.id]}
                data-testid="product-options"
                disabled={!!disabled || isAdding}
              />
            ))}
          </div>
        )}

        <ProductUpgrades
          upgrades={upgrades}
          selectedVariantIds={selectedUpgradeIds}
          onToggle={toggleUpgrade}
          disabled={!!disabled || isAdding}
        />

        {lowStockCount !== null && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
              </span>
              <span className="text-brand-dark/80">
                Grăbește-te, au mai rămas doar{" "}
                <span className="font-bold text-brand-dark">
                  {lowStockCount} {lowStockCount === 1 ? "bucată" : "bucăți"}
                </span>{" "}
                în stoc.
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full bg-brand-light overflow-hidden"
              role="progressbar"
              aria-valuenow={lowStockCount}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-label="Disponibilitate în stoc"
            >
              <div
                className="h-full bg-brand-accent rounded-full transition-all"
                style={{
                  width: `${Math.max(8, Math.min(100, (lowStockCount / 10) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {isBackorder && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-brand-dark/10 bg-brand-light/60 px-4 py-3 text-sm">
            <Clock size={18} weight="regular" className="mt-0.5 text-brand-dark/70 shrink-0" />
            <span className="text-brand-dark/80">
              <span className="font-bold text-brand-dark">La comandă</span>
              {leadTimeWeeks ? (
                <>
                  {" · "}livrare în{" "}
                  <span className="font-bold text-brand-dark">
                    {leadTimeWeeks} săptămâni
                  </span>
                </>
              ) : null}
              . Produsul este adus la comandă, în configurația selectată.
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="flex items-center justify-between bg-brand-light rounded-full px-2 py-2 sm:py-0 sm:w-36">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={cartDisabled || quantity <= 1}
              className="w-10 h-10 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-colors disabled:opacity-40"
              aria-label="Scade cantitatea"
            >
              <Minus size={16} weight="bold" />
            </button>
            <span
              className="font-bold text-brand-dark min-w-[1.5rem] text-center"
              data-testid="quantity-display"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
              disabled={cartDisabled || quantity >= maxStock}
              className="w-10 h-10 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-colors disabled:opacity-40"
              aria-label="Crește cantitatea"
            >
              <Plus size={16} weight="bold" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={cartDisabled}
            data-testid="add-product-button"
            className="flex-1 bg-brand-dark text-white rounded-full px-6 py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:hover:bg-brand-dark"
          >
            {isAdding ? (
              <span
                className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"
                aria-label="Se încarcă"
              />
            ) : (
              <ShoppingBag size={18} weight="bold" />
            )}
            <span>{ctaLabel}</span>
            {selectedPrice && inStock && isValidVariant && (
              <span className="opacity-70">
                · {selectedPrice.calculated_price}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={cartDisabled || isBuyingNow}
          className="w-full py-4 rounded-full border border-brand-dark text-brand-dark font-bold text-sm hover:bg-brand-dark hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-dark"
        >
          {isBuyingNow ? "Se redirecționează…" : "Cumpără acum"}
        </button>

        <a
          href={`https://wa.me/${COMPANY.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Bună! Aș dori informații despre produsul "${product.title}".`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors text-sm"
        >
          <WhatsappLogo size={18} weight="fill" className="text-[#25D366]" />
          <span className="font-bold text-brand-dark">Ai întrebări?</span>
          <span className="text-brand-dark/50">Scrie-ne pe WhatsApp</span>
        </a>

        {selectedPrice?.calculated_price_number ? (
          <KlarnaMessaging
            amount={selectedPrice.calculated_price_number}
            currency={selectedPrice.currency_code ?? "eur"}
          />
        ) : null}

        {addError && (
          <p
            role="alert"
            className="text-sm text-brand-accent bg-brand-accent/10 border border-brand-accent/20 rounded-2xl px-4 py-3"
          >
            {addError}
          </p>
        )}

        <ul className="flex flex-col gap-2 text-sm">
          {[
            {
              Icon: MapPin,
              title: "Verificare la livrare",
              note: "Deschizi coletul înainte de a plăti",
            },
            {
              Icon: Recycle,
              title: "Livrare rapidă",
              note: "Curier în 1–3 zile lucrătoare",
            },
            {
              Icon: ArrowUUpLeft,
              title: "Retur în 14 zile",
              note: "Returnare gratuită, rambursare completă",
            },
            {
              Icon: ShieldCheck,
              title: isOutletProduct(product)
                ? "Garanție 12 luni"
                : "Garanție 24 de luni",
              note: isOutletProduct(product)
                ? "Conform legislației în vigoare"
                : "Inclusă la fiecare achiziție",
            },
            {
              Icon: Storefront,
              title: "Ridicare personală",
              note: "Gata în 1–2 zile lucrătoare",
            },
          ].map(({ Icon, title, note }) => (
            <li
              key={title}
              className="flex items-center gap-3 px-4 py-3 rounded-full bg-brand-light"
            >
              <Icon
                size={18}
                weight="regular"
                className="text-brand-dark shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-brand-dark leading-tight">
                  {title}
                </span>
                <span className="block text-xs text-brand-dark/60 leading-tight mt-0.5 truncate">
                  {note}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-brand-dark/60">Distribuie</span>
          <div className="flex items-center gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Distribuie pe X"
              className="w-9 h-9 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark hover:bg-brand-dark hover:text-white hover:border-brand-dark transition-colors"
            >
              <XLogo size={14} weight="bold" />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Distribuie pe Facebook"
              className="w-9 h-9 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark hover:bg-brand-dark hover:text-white hover:border-brand-dark transition-colors"
            >
              <FacebookLogo size={14} weight="bold" />
            </a>
            <a
              href={`https://wa.me/?text=${shareText}%20${encodedUrl}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Distribuie pe WhatsApp"
              className="w-9 h-9 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark hover:bg-brand-dark hover:text-white hover:border-brand-dark transition-colors"
            >
              <WhatsappLogo size={14} weight="bold" />
            </a>
            <a
              href={`mailto:?subject=${shareText}&body=${encodedUrl}`}
              aria-label="Distribuie prin email"
              className="w-9 h-9 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark hover:bg-brand-dark hover:text-white hover:border-brand-dark transition-colors"
            >
              <EnvelopeSimple size={14} weight="bold" />
            </a>
          </div>
        </div>

        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
