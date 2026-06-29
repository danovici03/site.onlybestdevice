import { cookies as nextCookies } from "next/headers"

import { account as t } from "@lib/i18n/account.it"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import AccountCard from "@modules/account/components/account-card"
import CartTotals from "@modules/common/components/cart-totals"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import OnboardingCta from "@modules/order/components/onboarding-cta"
import Thumbnail from "@modules/products/components/thumbnail"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
}

const paymentLabelFor = (providerId?: string) => {
  if (!providerId) return t.orderConfirmed.paymentTitles.fallback
  if (
    providerId.startsWith("pp_stripe_") ||
    providerId.startsWith("pp_medusa-")
  )
    return t.orderConfirmed.paymentTitles.card
  if (providerId.startsWith("pp_paypal"))
    return t.orderConfirmed.paymentTitles.paypal
  if (providerId.startsWith("pp_stripe-ideal"))
    return t.orderConfirmed.paymentTitles.ideal
  if (providerId.startsWith("pp_stripe-bancontact"))
    return t.orderConfirmed.paymentTitles.bancontact
  if (providerId.startsWith("pp_system_default"))
    return t.orderConfirmed.paymentTitles.manual
  return t.orderConfirmed.paymentTitles.fallback
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

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()
  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"

  const placedOn = new Date(order.created_at).toLocaleDateString(
    "it-IT",
    DATE_FMT
  )

  const money = (amount?: number | null) =>
    amount == null
      ? "—"
      : convertToLocale({
          amount,
          currency_code: order.currency_code,
          locale: "it-IT",
        })

  const shippingMethod = order.shipping_methods?.[0]
  const payment = order.payment_collections?.[0]?.payments?.[0]
  const paymentTitle = paymentLabelFor(payment?.provider_id)
  const paidAt = payment?.created_at
    ? new Date(payment.created_at).toLocaleString("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <div className="bg-brand-light/40 py-10 small:py-16 min-h-[calc(100vh-64px)]">
      <div className="content-container max-w-7xl mx-auto flex flex-col gap-6">
        {isOnboarding && <OnboardingCta orderId={order.id} />}

        <header
          className="rounded-3xl bg-white border border-brand-dark/[0.06] shadow-sm p-6 small:p-10 text-center"
          data-testid="order-complete-container"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-accent/10 text-brand-accent text-xs uppercase tracking-wider px-3 py-1 mb-6">
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-1.5 rounded-full bg-brand-accent"
            />
            {t.orderConfirmed.badge}
          </span>
          <h1 className="font-serif text-4xl small:text-5xl text-brand-dark tracking-tight mb-3">
            {t.orderConfirmed.title}
          </h1>
          <p className="text-brand-dark/70 text-base small:text-lg">
            {t.orderConfirmed.subtitle}
          </p>
          <p className="text-sm text-brand-dark/60 mt-4">
            {t.orderConfirmed.emailNotice}{" "}
            <span
              className="text-brand-dark font-medium"
              data-testid="order-email"
            >
              {order.email}
            </span>
            .
          </p>

          <dl className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-6">
            <div className="text-center">
              <dt className="text-xs uppercase tracking-wider text-brand-dark/50">
                {t.orderConfirmed.orderNumber}
              </dt>
              <dd
                className="font-serif text-lg text-brand-dark mt-1"
                data-testid="order-id"
              >
                #{order.display_id}
              </dd>
            </div>
            <div className="text-center">
              <dt className="text-xs uppercase tracking-wider text-brand-dark/50">
                {t.orderConfirmed.placedOn}
              </dt>
              <dd
                className="font-serif text-lg text-brand-dark mt-1"
                data-testid="order-date"
              >
                {placedOn}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap justify-center gap-3 mt-8 pt-8 border-t border-brand-dark/[0.06]">
            <LocalizedClientLink
              href={`/api/invoice/${order.id}`}
              className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors"
              data-testid="download-invoice-button"
            >
              {t.orderConfirmed.downloadInvoice}
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/account/orders"
              className="inline-flex items-center justify-center rounded-full border border-brand-dark/[0.15] text-brand-dark px-6 py-3 text-sm font-medium hover:bg-brand-dark/[0.05] transition-colors"
            >
              {t.orderConfirmed.viewOrders}
            </LocalizedClientLink>
          </div>
        </header>

        <div className="grid grid-cols-1 small:grid-cols-3 gap-6">
          <AccountCard
            className="small:col-span-2"
            title={`${t.orderConfirmed.itemsTitle} (${order.items?.length ?? 0})`}
          >
            <ul
              className="divide-y divide-brand-dark/[0.06] -mx-2"
              data-testid="products-table"
            >
              {order.items?.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-4 px-2 py-4"
                  data-testid="product-row"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-light shrink-0">
                    <Thumbnail
                      thumbnail={item.thumbnail}
                      images={[]}
                      size="full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium text-brand-dark truncate"
                      data-testid="product-name"
                    >
                      {item.product_title || item.title}
                    </p>
                    {item.variant_title && (
                      <p className="text-xs text-brand-dark/60">
                        {item.variant_title}
                      </p>
                    )}
                    <p className="text-xs text-brand-dark/60 mt-1">
                      <span data-testid="product-quantity">
                        {item.quantity}
                      </span>
                      {" × "}
                      {money(item.unit_price)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-brand-dark tabular-nums">
                      {money(item.total)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </AccountCard>

          <AccountCard title={t.orderConfirmed.summaryTitle}>
            <CartTotals totals={order} />
          </AccountCard>
        </div>

        <div className="grid grid-cols-1 small:grid-cols-3 gap-6">
          <AccountCard
            title={t.orderConfirmed.shippingAddress}
            data-testid="shipping-address-summary"
          >
            {formatAddress(order.shipping_address) || (
              <p className="text-sm text-brand-dark/50">—</p>
            )}
          </AccountCard>

          <AccountCard title={t.orderConfirmed.shippingMethod}>
            {shippingMethod ? (
              <div className="text-sm text-brand-dark/80">
                <p className="text-brand-dark font-medium">
                  {shippingMethod.name}
                </p>
                <p className="text-brand-dark/60 mt-1 tabular-nums">
                  {money(shippingMethod.total)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-brand-dark/50">—</p>
            )}
          </AccountCard>

          <AccountCard title={t.orderConfirmed.paymentMethod}>
            <div className="text-sm text-brand-dark/80">
              <p
                className="text-brand-dark font-medium"
                data-testid="payment-method"
              >
                {paymentTitle}
              </p>
              {payment && (
                <p className="text-brand-dark/60 mt-1 tabular-nums">
                  {money(payment.amount)}
                </p>
              )}
              {paidAt && (
                <p className="text-xs text-brand-dark/50 mt-1">
                  {t.orderConfirmed.paidAt} {paidAt}
                </p>
              )}
            </div>
          </AccountCard>
        </div>

        <AccountCard
          title={t.orderConfirmed.nextStepsTitle}
          description={t.orderConfirmed.nextStepsBody}
        >
          <ul className="flex flex-col gap-y-2 text-sm text-brand-dark/80">
            <li>
              <LocalizedClientLink
                href="/suport"
                className="text-brand-dark hover:text-brand-accent underline underline-offset-4 decoration-brand-dark/20"
              >
                {t.layout.helpCta}
              </LocalizedClientLink>
            </li>
            <li>
              <LocalizedClientLink
                href="/retur"
                className="text-brand-dark hover:text-brand-accent underline underline-offset-4 decoration-brand-dark/20"
              >
                {t.orders.requestReturn}
              </LocalizedClientLink>
            </li>
            <li>
              <LocalizedClientLink
                href="/faq"
                className="text-brand-dark hover:text-brand-accent underline underline-offset-4 decoration-brand-dark/20"
              >
                FAQ
              </LocalizedClientLink>
            </li>
          </ul>
        </AccountCard>
      </div>
    </div>
  )
}
