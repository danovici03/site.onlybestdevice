import { getProductPrice } from "@lib/util/get-product-price"
import { OUTLET_BADGE_LABEL, isOutletProduct } from "@lib/util/outlet"
import {
  SHOWROOM_BADGE_LABEL,
  isShowroomProduct,
} from "@lib/util/showroom"
import {
  getPhoneColorSwatches,
  getPhoneSpec,
} from "@lib/util/phone-group"
import { HttpTypes } from "@medusajs/types"
import { Star } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const getBadge = (product: HttpTypes.StoreProduct): string | null => {
  if (isOutletProduct(product)) return OUTLET_BADGE_LABEL
  if (isShowroomProduct(product)) return SHOWROOM_BADGE_LABEL
  const tags = (product.tags ?? []).map((t) => t.value?.toLowerCase() ?? "")
  if (tags.includes("new") || tags.includes("nuovo")) return "Nuovo"
  if (tags.includes("bestseller") || tags.includes("best-seller"))
    return "Best seller"
  if (tags.includes("sale") || tags.includes("saldo")) return "Saldo"
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
    /color|colore|finitura|tessuto|materiale/i.test(o.title ?? "")
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
  const isOutletBadge = badge === OUTLET_BADGE_LABEL
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
            <span
              className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                isOutletBadge
                  ? "bg-brand-accent text-white"
                  : "bg-white text-brand-dark"
              }`}
            >
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
        <div className="flex flex-1 flex-col gap-1.5 px-1 pt-3">
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
            className="font-bold text-brand-dark leading-tight line-clamp-2 group-hover:text-brand-accent transition-colors"
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
                  className={`h-5 w-5 rounded-full shrink-0 ${
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
          {cheapestPrice && (
            <div className="mt-auto flex items-baseline gap-2 pt-2">
              <span
                className={`text-lg font-bold ${
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
        </div>
      </div>
    </LocalizedClientLink>
  )
}

export default ProductCard
