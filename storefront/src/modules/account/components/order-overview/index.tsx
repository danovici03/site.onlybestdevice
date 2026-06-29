import OrderCard from "../order-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { account as t } from "@lib/i18n/account.it"

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  if (orders?.length) {
    return (
      <ul className="flex flex-col gap-3 small:gap-4" data-testid="orders-list">
        {orders.map((o) => (
          <li key={o.id}>
            <OrderCard order={o} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div
      className="rounded-3xl bg-white border border-brand-dark/[0.06] p-8 text-center"
      data-testid="no-orders-container"
    >
      <h2 className="font-serif text-2xl text-brand-dark tracking-tight mb-2">
        {t.orders.empty}
      </h2>
      <p className="text-sm text-brand-dark/60 mb-6">{t.overview.intro}</p>
      <LocalizedClientLink
        href="/store"
        className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors"
        data-testid="continue-shopping-button"
      >
        {t.orders.emptyCta}
      </LocalizedClientLink>
    </div>
  )
}

export default OrderOverview
