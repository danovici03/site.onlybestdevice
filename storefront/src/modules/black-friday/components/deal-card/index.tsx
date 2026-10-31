import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import {
  formatLei,
  lowestOffer,
  supportsInstallments,
} from "@lib/util/installments"
import Image from "@modules/common/components/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Cardul paginii Black Friday. Nu e `ProductCard` cu altă temă: acela e scris
 * pe fond alb și pune stocul, culorile și livrarea înaintea prețului. Aici
 * reducerea conduce, iar poza pe alb rămâne singura zonă luminoasă din card.
 */
const DealCard = ({
  product,
  priority,
}: {
  product: HttpTypes.StoreProduct
  priority?: boolean
}) => {
  const { cheapestPrice: price } = getProductPrice({ product })
  const thumb = product.thumbnail ?? product.images?.[0]?.url
  const isSale = price?.price_type === "sale"

  const installment =
    price &&
    typeof price.calculated_price_number === "number" &&
    supportsInstallments(price.currency_code)
      ? lowestOffer(price.calculated_price_number)
      : null

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="bf-card group"
      data-testid="product-wrapper"
    >
      <div className="bf-card-image">
        {thumb && (
          <Image
            src={thumb}
            alt={product.title ?? ""}
            fill
            sizes="(min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className="object-contain p-[8%] transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
          />
        )}
        {isSale && price.percentage_diff && (
          <span className="bf-card-discount bf-display">
            -{price.percentage_diff}%
          </span>
        )}
      </div>

      <h3 className="bf-card-title" data-testid="product-title">
        {product.title}
      </h3>

      {price && (
        <div className="bf-card-prices">
          <span className="bf-display bf-card-price" data-testid="price">
            {price.calculated_price}
          </span>
          {isSale && (
            <span className="bf-card-old-price" data-testid="original-price">
              {price.original_price}
            </span>
          )}
        </div>
      )}

      {installment && (
        <span className="bf-card-installment">
          Rate de la {formatLei(installment.monthly)}/lună
        </span>
      )}
    </LocalizedClientLink>
  )
}

export default DealCard
