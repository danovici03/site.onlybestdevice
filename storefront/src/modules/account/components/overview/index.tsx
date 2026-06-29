import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { account as t } from "@lib/i18n/account.it"
import AccountCard from "../account-card"
import OrderCard from "../order-card"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
}

type AddressLike = NonNullable<HttpTypes.StoreCustomer["addresses"]>[number]

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  if (!customer) return { percent: 0, missing: [] as string[] }
  const checks: Array<[boolean, string]> = [
    [!!customer.email, t.profile.emailLabel],
    [!!(customer.first_name && customer.last_name), t.profile.nameLabel],
    [!!customer.phone, t.profile.phoneLabel],
    [
      !!customer.addresses?.find((a) => a.is_default_billing),
      t.profile.billingLabel,
    ],
  ]
  const done = checks.filter(([ok]) => ok).length
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label)
  return { percent: Math.round((done / checks.length) * 100), missing }
}

const AddressPreview = ({ address }: { address: AddressLike }) => (
  <address className="not-italic text-sm text-brand-dark/80 leading-relaxed">
    {(address.first_name || address.last_name) && (
      <div className="text-brand-dark font-medium">
        {address.first_name} {address.last_name}
      </div>
    )}
    {address.company && <div>{address.company}</div>}
    <div>
      {address.address_1}
      {address.address_2 ? `, ${address.address_2}` : ""}
    </div>
    <div>
      {address.postal_code} {address.city}
      {address.province ? ` (${address.province})` : ""}
    </div>
    <div className="uppercase text-xs text-brand-dark/50 mt-1">
      {address.country_code}
    </div>
  </address>
)

const Overview = ({ customer, orders }: OverviewProps) => {
  const { percent, missing } = getProfileCompletion(customer)
  const defaultShipping = customer?.addresses?.find(
    (a) => a.is_default_shipping,
  )
  const recentOrders = orders?.slice(0, 3) ?? []

  return (
    <div data-testid="overview-page-wrapper" className="flex flex-col gap-6">
      {/* Welcome header */}
      <header className="px-1">
        <p className="text-sm text-brand-dark/60">{t.overview.hello},</p>
        <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
          {customer?.first_name || t.overview.helloFallback}
        </h1>
        {customer?.email && (
          <p
            className="text-sm text-brand-dark/60 mt-2"
            data-testid="customer-email"
            data-value={customer.email}
          >
            {customer.email}
          </p>
        )}
      </header>

      <p className="text-sm text-brand-dark/70 px-1">{t.overview.intro}</p>

      {/* Profile completion + default address */}
      <div className="grid grid-cols-1 small:grid-cols-2 gap-4 small:gap-6">
        <AccountCard
          title={t.overview.profileCompletion}
          action={
            <LocalizedClientLink
              href="/account/profile"
              className="text-sm text-brand-accent hover:underline"
            >
              {t.common.edit}
            </LocalizedClientLink>
          }
        >
          <div className="flex items-end gap-3 mb-3">
            <span
              className="font-serif text-5xl text-brand-dark leading-none"
              data-testid="customer-profile-completion"
              data-value={percent}
            >
              {percent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-brand-dark/[0.08] overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          {missing.length > 0 && (
            <p className="text-xs text-brand-dark/60 mt-3">
              {t.overview.profileCompletionHint}
              <br />
              <span className="text-brand-dark/80">
                Da completare: {missing.join(", ")}
              </span>
            </p>
          )}
        </AccountCard>

        <AccountCard
          title={t.overview.defaultAddress}
          action={
            defaultShipping ? (
              <LocalizedClientLink
                href="/account/addresses"
                className="text-sm text-brand-accent hover:underline"
              >
                {t.common.edit}
              </LocalizedClientLink>
            ) : null
          }
        >
          {defaultShipping ? (
            <AddressPreview address={defaultShipping} />
          ) : (
            <div>
              <p className="text-sm text-brand-dark/60 mb-4">
                {t.overview.noDefaultAddress}
              </p>
              <LocalizedClientLink
                href="/account/addresses"
                className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-accent transition-colors"
              >
                {t.overview.addAddress}
              </LocalizedClientLink>
            </div>
          )}
        </AccountCard>
      </div>

      {/* Recent orders */}
      <AccountCard
        title={t.overview.recentOrders}
        action={
          recentOrders.length > 0 ? (
            <LocalizedClientLink
              href="/account/orders"
              className="text-sm text-brand-accent hover:underline"
            >
              {t.common.seeAll}
            </LocalizedClientLink>
          ) : null
        }
      >
        {recentOrders.length > 0 ? (
          <ul
            className="flex flex-col gap-3 small:gap-4"
            data-testid="orders-wrapper"
          >
            {recentOrders.map((order) => (
              <li
                key={order.id}
                data-testid="order-wrapper"
                data-value={order.id}
              >
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
        ) : (
          <div
            className="text-center py-6"
            data-testid="no-orders-message"
          >
            <p className="text-sm text-brand-dark/60 mb-4">
              {t.overview.noOrders}
            </p>
            <LocalizedClientLink
              href="/store"
              className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-accent transition-colors"
            >
              {t.overview.noOrdersCta}
            </LocalizedClientLink>
          </div>
        )}
      </AccountCard>
    </div>
  )
}

export default Overview
