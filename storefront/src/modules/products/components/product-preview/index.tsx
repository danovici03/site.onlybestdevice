import { Text } from "@medusajs/ui"
import { listProducts } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { OUTLET_BADGE_LABEL, isOutletProduct } from "@lib/util/outlet"
import {
  SHOWROOM_BADGE_LABEL,
  isShowroomProduct,
} from "@lib/util/showroom"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  // const pricedProduct = await listProducts({
  //   regionId: region.id,
  //   queryParams: { id: [product.id!] },
  // }).then(({ response }) => response.products[0])

  // if (!pricedProduct) {
  //   return null
  // }

  const { cheapestPrice } = getProductPrice({
    product,
  })

  const outlet = isOutletProduct(product)
  const showroom = !outlet && isShowroomProduct(product)

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group">
      <div data-testid="product-wrapper">
        <div className="relative">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
          />
          {outlet && (
            <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-brand-accent text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
              {OUTLET_BADGE_LABEL}
            </span>
          )}
          {showroom && (
            <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white text-[10px] font-bold uppercase tracking-widest text-brand-dark shadow-sm">
              {SHOWROOM_BADGE_LABEL}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 txt-compact-medium mt-4">
          <Text
            className="text-ui-fg-subtle truncate"
            data-testid="product-title"
          >
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
