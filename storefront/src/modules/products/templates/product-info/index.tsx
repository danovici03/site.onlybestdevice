import {
  SHOWROOM_BADGE_LABEL,
  SHOWROOM_DESCRIPTION,
  isShowroomProduct,
} from "@lib/util/showroom"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductBreadcrumbs, {
  type ProductCrumb,
} from "@modules/products/components/product-breadcrumbs"
import ProductRating from "@modules/products/components/product-rating"
import type { ReviewStatsDTO } from "@lib/data/reviews"
import { Storefront } from "@phosphor-icons/react/dist/ssr"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
  reviewStats?: ReviewStatsDTO
  /** Categorie → marcă, calculate pe server (au nevoie de ierarhia completă). */
  crumbs?: ProductCrumb[]
}

const ProductInfo = ({ product, reviewStats, crumbs = [] }: ProductInfoProps) => {
  const meta = (product.metadata ?? {}) as Record<string, unknown>
  // Prefer real review aggregate; fall back to legacy metadata rating
  // (kept for products that haven't received any review yet).
  const ratingRaw =
    reviewStats && reviewStats.total > 0
      ? reviewStats.average
      : typeof meta.rating === "number"
        ? meta.rating
        : typeof meta.rating === "string"
          ? Number(meta.rating)
          : null
  const reviewCountRaw =
    reviewStats && reviewStats.total > 0
      ? reviewStats.total
      : typeof meta.review_count === "number"
        ? meta.review_count
        : typeof meta.review_count === "string"
          ? Number(meta.review_count)
          : null
  const rating = ratingRaw && !Number.isNaN(ratingRaw) ? ratingRaw : null
  const reviewCount =
    reviewCountRaw && !Number.isNaN(reviewCountRaw) ? reviewCountRaw : undefined
  const showroom = isShowroomProduct(product)
  // Ultimul crumb: modelul, nu titlul variantei. `phone_model` e pus de
  // parserul de telefoane; pentru restul catalogului tăiem la prima virgulă
  // („Husă Spigen …, Clear" → „Husă Spigen …").
  const modelName =
    typeof meta.phone_model === "string" && meta.phone_model.trim()
      ? meta.phone_model.trim()
      : product.title.split(",")[0].trim() || product.title

  return (
    <div id="product-info" className="flex flex-col gap-y-4">
      {crumbs.length ? (
        <ProductBreadcrumbs crumbs={crumbs} current={modelName} />
      ) : (
        product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50 hover:text-brand-dark transition-colors"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )
      )}
      <h1
        className="text-2xl sm:text-3xl font-bold leading-snug tracking-[-0.02em] text-brand-dark break-words"
        data-testid="product-title"
      >
        {product.title}
      </h1>
      {rating !== null && (
        <a
          href="#reviews"
          className="self-start rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          aria-label="Mergi la recenziile clienților"
        >
          <ProductRating rating={rating} reviewCount={reviewCount} />
        </a>
      )}
      {showroom && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-brand-accent/30 bg-brand-accent/5 p-4"
          data-testid="product-showroom-note"
        >
          <Storefront
            size={20}
            weight="duotone"
            className="text-brand-accent shrink-0 mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.18em] font-bold text-brand-accent">
              {SHOWROOM_BADGE_LABEL}
            </span>
            <p className="text-sm text-brand-dark/70 leading-relaxed">
              {SHOWROOM_DESCRIPTION}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductInfo
