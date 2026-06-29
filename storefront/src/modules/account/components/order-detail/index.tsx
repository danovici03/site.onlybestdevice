import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import AccountCard from "../account-card"
import { OrderStatusBadge } from "../status-badge"
import { convertToLocale } from "@lib/util/money"
import { account as t } from "@lib/i18n/account.it"

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
}

const RETURN_WINDOW_DAYS = 14

// A delivered order is eligible for a return if it was marked delivered
// (or shipped, as a fallback proxy) within the past 14 days.
const isReturnable = (order: HttpTypes.StoreOrder) => {
  const status = order.fulfillment_status
  if (status !== "delivered" && status !== "shipped") return false
  const ref =
    (order as any).delivered_at ||
    (order as any).shipped_at ||
    order.updated_at ||
    order.created_at
  if (!ref) return false
  const days = (Date.now() - new Date(ref).getTime()) / 86_400_000
  return days <= RETURN_WINDOW_DAYS
}

const formatAddress = (a?: HttpTypes.StoreOrder["shipping_address"]) => {
  if (!a) return null
  return (
    <address className="not-italic text-sm text-brand-dark/80 leading-relaxed">
      <div className="text-brand-dark font-medium">
        {a.first_name} {a.last_name}
      </div>
      {a.company && <div>{a.company}</div>}
      <div>
        {a.address_1}
        {a.address_2 ? `, ${a.address_2}` : ""}
      </div>
      <div>
        {a.postal_code} {a.city}
        {a.province ? ` (${a.province})` : ""}
      </div>
      <div className="uppercase text-xs text-brand-dark/50 mt-1">
        {a.country_code}
      </div>
      {a.phone && <div className="text-xs text-brand-dark/50">{a.phone}</div>}
    </address>
  )
}

const OrderDetail = ({ order }: { order: HttpTypes.StoreOrder }) => {
  const money = (amount?: number | null) =>
    amount == null
      ? "—"
      : convertToLocale({
          amount,
          currency_code: order.currency_code,
          locale: "it-IT",
        })

  const placedOn = new Date(order.created_at).toLocaleDateString("it-IT", DATE_FMT)
  const canReturn = isReturnable(order)
  const paymentLabel = (order.payment_collections?.[0]?.payments?.[0] as any)
    ?.provider_id

  return (
    <div className="flex flex-col gap-6" data-testid="order-detail">
      <LocalizedClientLink
        href="/account/orders"
        className="inline-flex items-center gap-x-2 text-sm text-brand-dark/60 hover:text-brand-dark w-fit"
        data-testid="back-to-orders"
      >
        ← {t.orders.backToOrders}
      </LocalizedClientLink>

      <header className="rounded-3xl bg-white border border-brand-dark/[0.06] p-6 small:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-dark/50 mb-1">
              {t.orders.orderNumber}
            </p>
            <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
              #{order.display_id}
            </h1>
            <p className="text-sm text-brand-dark/60 mt-2">
              {t.orders.placedOn} {placedOn}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <OrderStatusBadge order={order} />
            <p className="font-serif text-2xl text-brand-dark">
              {money(order.total)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-brand-dark/[0.06]">
          <LocalizedClientLink
            href={`/api/invoice/${order.id}`}
            className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-accent transition-colors"
            data-testid="download-invoice-button"
          >
            {t.orders.downloadInvoice}
          </LocalizedClientLink>
          <LocalizedClientLink
            href={canReturn ? `/account/orders/details/${order.id}/return` : "#"}
            aria-disabled={!canReturn}
            className={clx(
              "inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors",
              canReturn
                ? "border-brand-dark/[0.15] text-brand-dark hover:bg-brand-dark/[0.05]"
                : "border-brand-dark/[0.08] text-brand-dark/40 pointer-events-none",
            )}
            data-testid="request-return-button"
          >
            {t.orders.requestReturn}
          </LocalizedClientLink>
          {!canReturn && order.fulfillment_status === "delivered" && (
            <p className="text-xs text-brand-dark/50 self-center">
              {t.returns.windowExpired}
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 small:grid-cols-3 gap-6">
        {/* Items */}
        <AccountCard
          className="small:col-span-2"
          title={`${t.orders.items} (${order.items?.length ?? 0})`}
        >
          <ul className="divide-y divide-brand-dark/[0.06] -mx-2">
            {order.items?.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-2 py-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-light shrink-0">
                  <Thumbnail
                    thumbnail={item.thumbnail}
                    images={[]}
                    size="full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-dark truncate">
                    {item.product_title || item.title}
                  </p>
                  {item.variant_title && (
                    <p className="text-xs text-brand-dark/60">
                      {item.variant_title}
                    </p>
                  )}
                  <p className="text-xs text-brand-dark/60 mt-1">
                    {t.orders.items}: {item.quantity}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-brand-dark">
                    {money(item.total)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </AccountCard>

        {/* Summary */}
        <AccountCard title={t.orders.summary}>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label={t.orders.subtotal} value={money(order.subtotal)} />
            {order.discount_total > 0 && (
              <Row
                label={t.orders.discount}
                value={`- ${money(order.discount_total)}`}
              />
            )}
            <Row label={t.orders.shipping} value={money(order.shipping_total)} />
            <Row label={t.orders.tax} value={money(order.tax_total)} />
            <div className="border-t border-brand-dark/[0.06] mt-2 pt-3 flex items-center justify-between">
              <dt className="font-semibold text-brand-dark">{t.orders.total}</dt>
              <dd className="font-serif text-xl text-brand-dark">
                {money(order.total)}
              </dd>
            </div>
          </dl>
        </AccountCard>
      </div>

      {/* Addresses + payment */}
      <div className="grid grid-cols-1 small:grid-cols-3 gap-6">
        <AccountCard title={t.orders.shippingAddress}>
          {formatAddress(order.shipping_address) || (
            <p className="text-sm text-brand-dark/50">—</p>
          )}
        </AccountCard>
        <AccountCard title={t.orders.billingAddress}>
          {formatAddress(order.billing_address) || (
            <p className="text-sm text-brand-dark/50">—</p>
          )}
        </AccountCard>
        <AccountCard title={t.orders.paymentMethod}>
          <p className="text-sm text-brand-dark/80">
            {paymentLabel
              ? paymentLabel
                  .replace(/^pp_/, "")
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "—"}
          </p>
        </AccountCard>
      </div>
    </div>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <dt className="text-brand-dark/70">{label}</dt>
    <dd className="text-brand-dark">{value}</dd>
  </div>
)

export default OrderDetail
