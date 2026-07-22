import { getProductPrice } from "@lib/util/get-product-price"
import {
  SHOWROOM_BADGE_LABEL,
  isShowroomProduct,
} from "@lib/util/showroom"
import {
  getPhoneColorSwatches,
  getPhoneSpec,
} from "@lib/util/phone-group"
import { convertToLocale } from "@lib/util/money"
import {
  formatLei,
  lowestOffer,
  supportsInstallments,
} from "@lib/util/installments"
import { HttpTypes } from "@medusajs/types"
import { CreditCard, Star, Truck } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const getBadge = (product: HttpTypes.StoreProduct): string | null => {
  if (isShowroomProduct(product)) return SHOWROOM_BADGE_LABEL
  const tags = (product.tags ?? []).map((t) => t.value?.toLowerCase() ?? "")
  if (tags.includes("new") || tags.includes("nuovo") || tags.includes("nou"))
    return "Nou"
  if (tags.includes("bestseller") || tags.includes("best-seller"))
    return "Best seller"
  if (tags.includes("sale") || tags.includes("saldo") || tags.includes("reducere"))
    return "Reducere"
  return null
}

const getRating = (product: HttpTypes.StoreProduct): number | null => {
  const meta = (product.metadata ?? {}) as Record<string, unknown>
  const r = meta.rating
  if (typeof r === "number") return r
  if (typeof r === "string") {
    const n = Number(r)
    return Number.isNaN(n) ? null : n
  }
  return null
}

const getColorOption = (product: HttpTypes.StoreProduct) => {
  return (product.options ?? []).find((o) =>
    /colou?r|culoare/i.test(o.title ?? "")
  )
}

// În stoc dacă vreo variantă e cumpărabilă. Produsele importate au
// manage_inventory=false (mereu disponibile), deci implicit „În stoc"; arătăm
// „Stoc epuizat" doar când inventarul e gestionat și e 0.
const isInStock = (product: HttpTypes.StoreProduct): boolean => {
  const variants = product.variants ?? []
  if (!variants.length) return true
  return variants.some((v) => {
    const mi = (v as any).manage_inventory
    if (mi === false || mi == null) return true
    if ((v as any).allow_backorder) return true
    return ((v as any).inventory_quantity ?? 0) > 0
  })
}

type ProductCardProps = {
  product: HttpTypes.StoreProduct
  priority?: boolean
}

const ProductCard = ({ product, priority }: ProductCardProps) => {
  const { cheapestPrice } = getProductPrice({ product })
  const badge = getBadge(product)
  const rating = getRating(product)
  const colorOption = getColorOption(product)

  const swatches: { value: string; image?: string }[] = (
    colorOption?.values ?? []
  )
    .map((v) => {
      const variant = (product.variants ?? []).find((variantItem) =>
        (variantItem.options ?? []).some(
          (vo: any) => vo.option_id === colorOption?.id && vo.value === v.value
        )
      )
      const image = (variant as any)?.images?.[0]?.url as string | undefined
      return { value: v.value, image }
    })
    .slice(0, 4)

  // Telefoane: linie scurtă de spec + pastile de culoare ale grupului (modelul
  // legat). Pastilele sunt pur vizuale aici — comutarea reală se face pe pagina
  // produsului ("când dai pe el").
  const phoneSpec = getPhoneSpec(product)
  const phoneSwatches = getPhoneColorSwatches(product)

  const thumb = product.thumbnail ?? product.images?.[0]?.url
  const isSale = cheapestPrice?.price_type === "sale"
  const inStock = isInStock(product)

  // Cât economisește clientul față de prețul de listă (doar când e reducere).
  const savedAmount =
    cheapestPrice &&
    typeof cheapestPrice.original_price_number === "number" &&
    typeof cheapestPrice.calculated_price_number === "number"
      ? cheapestPrice.original_price_number -
        cheapestPrice.calculated_price_number
      : 0
  const savedLabel =
    savedAmount > 0
      ? convertToLocale({
          amount: savedAmount,
          currency_code: cheapestPrice!.currency_code,
        })
      : null

  // Rata minimă (cel mai lung termen). Se ascunde sub pragul de finanțare, deci
  // accesoriile ieftine nu promit rate. Vezi `installments.ts`.
  const installment =
    cheapestPrice &&
    typeof cheapestPrice.calculated_price_number === "number" &&
    supportsInstallments(cheapestPrice.currency_code)
      ? lowestOffer(cheapestPrice.calculated_price_number)
      : null

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group block h-full"
      data-testid="product-wrapper"
    >
      <div className="flex h-full flex-col rounded-[1.5rem] border border-brand-dark/[0.07] bg-white p-2.5 sm:p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_14px_30px_-14px_rgba(16,24,40,0.22)]">
        <div className="relative aspect-square w-full overflow-hidden rounded-[1.1rem] bg-brand-light">
          {thumb && (
            <Image
              src={thumb}
              alt={product.title ?? ""}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 640px) 33vw, 50vw"
              priority={priority}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          )}
          {badge && (
            <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm bg-white text-brand-dark">
              {badge}
            </span>
          )}
          {rating !== null && (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-xs font-bold text-brand-dark shadow-sm">
              <Star size={12} weight="fill" className="text-brand-accent" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 sm:gap-1.5 px-1 pt-2.5 sm:pt-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
              inStock ? "text-emerald-600" : "text-brand-dark/40"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                inStock ? "bg-emerald-500" : "bg-brand-dark/30"
              }`}
            />
            {inStock ? "În stoc" : "Stoc epuizat"}
          </span>
          <h3
            className="text-sm sm:text-base font-bold text-brand-dark leading-tight line-clamp-2 group-hover:text-brand-accent transition-colors"
            data-testid="product-title"
          >
            {product.title}
          </h3>
          {phoneSpec && (
            <span className="text-xs font-medium text-brand-dark/55 truncate">
              {phoneSpec}
            </span>
          )}
          {phoneSwatches.length > 0 ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              {phoneSwatches.slice(0, 5).map((s) => (
                <span
                  key={s.color}
                  title={s.color}
                  aria-label={s.color}
                  className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full shrink-0 ${
                    s.isCurrent
                      ? "ring-2 ring-offset-1 ring-brand-dark/60 border border-white"
                      : "border border-brand-dark/15"
                  }`}
                  style={{ backgroundColor: s.hex ?? "#e5e7eb" }}
                />
              ))}
              {phoneSwatches.length > 5 && (
                <span className="text-[10px] font-bold text-brand-dark/45">
                  +{phoneSwatches.length - 5}
                </span>
              )}
            </div>
          ) : swatches.length > 0 ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              {swatches.map((s) =>
                s.image ? (
                  <span
                    key={s.value}
                    className="relative h-5 w-5 rounded-md overflow-hidden border border-brand-dark/10"
                    title={s.value}
                  >
                    <Image src={s.image} alt={s.value} fill sizes="20px" />
                  </span>
                ) : (
                  <span
                    key={s.value}
                    className="px-1.5 h-5 inline-flex items-center rounded-md bg-brand-light text-[10px] font-bold text-brand-dark/70"
                  >
                    {s.value}
                  </span>
                )
              )}
            </div>
          ) : null}

          {/* Livrare + rate, sub culori. Rămân aici (nu în blocul de jos) ca să
              nu concureze vizual cu prețul, care e ancora cardului. */}
          {(inStock || installment) && (
            <div className="mt-1.5 flex flex-col gap-1">
              {inStock && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-dark/55">
                  <Truck size={13} weight="bold" className="shrink-0" />
                  {/* Pe mobil cardul e îngust — scurtăm eticheta, nu o tăiem. */}
                  <span className="truncate">
                    Livrare
                    <span className="hidden sm:inline"> estimativă</span> 24/48 h
                  </span>
                </span>
              )}
              {installment && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-dark/55">
                  <CreditCard size={13} weight="bold" className="shrink-0" />
                  Rate de la{" "}
                  <span className="font-bold text-brand-dark">
                    {formatLei(installment.monthly)}
                  </span>
                  /lună
                </span>
              )}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-1 pt-2">
            {cheapestPrice && (
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-base sm:text-lg font-bold ${
                    isSale ? "text-brand-accent" : "text-brand-dark"
                  }`}
                  data-testid="price"
                >
                  {cheapestPrice.calculated_price}
                </span>
                {isSale && (
                  <span
                    className="text-xs font-medium text-brand-dark/40 line-through"
                    data-testid="original-price"
                  >
                    {cheapestPrice.original_price}
                  </span>
                )}
              </div>
            )}
            {savedLabel && (
              <span
                className="inline-flex w-fit items-center rounded-full bg-brand-accent/10 px-2 py-0.5 text-[11px] font-bold text-brand-accent"
                data-testid="savings"
              >
                Economisești {savedLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}

export default ProductCard
