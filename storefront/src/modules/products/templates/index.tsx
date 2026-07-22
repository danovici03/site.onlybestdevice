import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductCompare from "@modules/products/components/product-compare"
import ProductHighlights from "@modules/products/components/product-highlights"
import PhoneVariantSelect from "@modules/products/components/phone-variant-select"
import ProductReviews from "@modules/products/components/product-reviews"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import type { ReviewStatsDTO } from "@lib/data/reviews"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  upgrades?: HttpTypes.StoreProduct[]
  warranty?: HttpTypes.StoreProduct
  reviewStats?: ReviewStatsDTO
  reviewSort?: string
  reviewPage?: string
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  upgrades = [],
  warranty,
  reviewStats,
  reviewSort,
  reviewPage,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <>
      <section
        className="content-container py-6 lg:py-12"
        data-testid="product-container"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 flex flex-col gap-8">
            <ImageGallery product={product} />
            <ProductHighlights product={product} />
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28 flex flex-col gap-y-8">
              <ProductInfo product={product} reviewStats={reviewStats} />
              <PhoneVariantSelect product={product} />
              <Suspense
                fallback={
                  <ProductActions
                    disabled={true}
                    product={product}
                    region={region}
                    upgrades={upgrades}
                    warranty={warranty}
                  />
                }
              >
                <ProductActionsWrapper
                  id={product.id}
                  region={region}
                  upgrades={upgrades}
                  warranty={warranty}
                />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="mt-20 lg:mt-28">
          <ProductTabs
            product={product}
            reviewCount={reviewStats?.total}
            reviews={
              <Suspense
                fallback={
                  <div className="h-48 rounded-3xl bg-brand-light animate-pulse" />
                }
              >
                <ProductReviews
                  productId={product.id}
                  countryCode={countryCode}
                  sort={reviewSort}
                  page={reviewPage}
                />
              </Suspense>
            }
          />
        </div>
      </section>

      <ProductCompare product={product} />

      <section
        className="content-container my-16 lg:my-24"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </section>
    </>
  )
}

export default ProductTemplate
