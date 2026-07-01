import { useMemo } from "react"

import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { account as t } from "@lib/i18n/account.it"
import { OrderStatusBadge } from "../status-badge"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
}

const OrderCard = ({ order }: OrderCardProps) => {
  const numberOfLines = useMemo(
    () => order.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0,
    [order],
  )

  const firstThumb = order.items?.find((i) => i.thumbnail)?.thumbnail
  const placedOn = new Date(order.created_at).toLocaleDateString(
    "ro-RO",
    DATE_FORMAT,
  )

  return (
    <LocalizedClientLink
      href={`/account/orders/details/${order.id}`}
      className="block group"
      data-testid="order-card"
    >
      <article className="flex items-center gap-4 small:gap-6 rounded-3xl bg-white border border-brand-dark/[0.06] p-4 small:p-5 transition-colors group-hover:border-brand-dark/[0.15]">
        <div className="shrink-0 w-20 h-20 small:w-24 small:h-24 rounded-2xl overflow-hidden bg-brand-light">
          <Thumbnail thumbnail={firstThumb} images={[]} size="full" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <span
              className="text-sm font-semibold text-brand-dark"
              data-testid="order-display-id"
            >
              {t.orders.orderNumber} #{order.display_id}
            </span>
            <OrderStatusBadge order={order} />
          </div>
          <p className="text-xs text-brand-dark/60" data-testid="order-created-at">
            {t.orders.placedOn} {placedOn}
          </p>
          <p className="text-xs text-brand-dark/60 mt-0.5">
            {numberOfLines}{" "}
            {numberOfLines === 1 ? "produs" : "produse"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className="font-serif text-lg small:text-xl text-brand-dark"
            data-testid="order-amount"
          >
            {convertToLocale({
              amount: order.total,
              currency_code: order.currency_code,
              locale: "ro-RO",
            })}
          </p>
          <span className="text-xs text-brand-accent group-hover:underline">
            {t.orders.seeDetails} →
          </span>
        </div>
      </article>
    </LocalizedClientLink>
  )
}

export default OrderCard
