"use client"

import { clx } from "@medusajs/ui"
import {
  ArrowRightOnRectangle,
  ArrowUturnLeft,
  BellAlert,
} from "@medusajs/icons"
import { useParams, usePathname } from "next/navigation"

import ChevronDown from "@modules/common/icons/chevron-down"
import User from "@modules/common/icons/user"
import MapPin from "@modules/common/icons/map-pin"
import Package from "@modules/common/icons/package"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { signout } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: t.nav.overview, icon: User, exact: true },
  { href: "/account/profile", label: t.nav.profile, icon: User },
  { href: "/account/addresses", label: t.nav.addresses, icon: MapPin },
  { href: "/account/orders", label: t.nav.orders, icon: Package },
  { href: "/account/returns", label: t.nav.returns, icon: ArrowUturnLeft },
  { href: "/account/preferences", label: t.nav.preferences, icon: BellAlert },
]

const isActive = (route: string, countryCode: string, item: NavItem) => {
  const relative = route.split(countryCode)[1] || ""
  if (item.exact) return relative === item.href
  return relative.startsWith(item.href)
}

const AccountNav = ({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) => {
  const route = usePathname()
  const { countryCode } = useParams() as { countryCode: string }

  const handleLogout = async () => {
    await signout(countryCode)
  }

  return (
    <nav aria-label={t.nav.section}>
      {/* Mobile — accordion-style top entry → list */}
      <div className="small:hidden" data-testid="mobile-account-nav">
        {route !== `/${countryCode}/account` ? (
          <LocalizedClientLink
            href="/account"
            className="inline-flex items-center gap-x-2 text-sm text-brand-dark/70 hover:text-brand-dark"
            data-testid="account-main-link"
          >
            <ChevronDown className="rotate-90" />
            <span>{t.nav.section}</span>
          </LocalizedClientLink>
        ) : (
          <>
            <ul className="rounded-3xl bg-white border border-brand-dark/[0.06] overflow-hidden">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <LocalizedClientLink
                      href={item.href}
                      className="flex items-center justify-between px-5 py-4 border-b border-brand-dark/[0.06] last:border-b-0 hover:bg-brand-dark/[0.02]"
                      data-testid={`${item.href.split("/").pop()}-link`}
                    >
                      <span className="flex items-center gap-x-3">
                        <Icon size={18} />
                        <span className="text-sm">{item.label}</span>
                      </span>
                      <ChevronDown className="-rotate-90 text-brand-dark/40" />
                    </LocalizedClientLink>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-between w-full px-5 py-4 hover:bg-brand-dark/[0.02] text-left"
                  data-testid="logout-button"
                >
                  <span className="flex items-center gap-x-3 text-brand-accent">
                    <ArrowRightOnRectangle />
                    <span className="text-sm">{t.nav.logout}</span>
                  </span>
                  <ChevronDown className="-rotate-90 text-brand-dark/40" />
                </button>
              </li>
            </ul>
          </>
        )}
      </div>

      {/* Desktop — sticky sidebar */}
      <div className="hidden small:block" data-testid="account-nav">
        <div className="rounded-3xl bg-white border border-brand-dark/[0.06] p-6">
          <p className="text-xs uppercase tracking-wider text-brand-dark/50 mb-4">
            {t.nav.section}
          </p>
          <ul className="flex flex-col gap-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = isActive(route ?? "", countryCode, item)
              return (
                <li key={item.href}>
                  <LocalizedClientLink
                    href={item.href}
                    className={clx(
                      "flex items-center gap-x-3 rounded-full px-4 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-brand-dark text-white"
                        : "text-brand-dark/70 hover:bg-brand-dark/[0.04] hover:text-brand-dark",
                    )}
                    data-testid={`${item.href.split("/").pop()}-link`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </LocalizedClientLink>
                </li>
              )
            })}
          </ul>
          <hr className="my-4 border-brand-dark/[0.08]" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-x-3 rounded-full px-4 py-2.5 text-sm text-brand-accent hover:bg-brand-accent/10 transition-colors"
            data-testid="logout-button"
          >
            <ArrowRightOnRectangle />
            <span>{t.nav.logout}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default AccountNav
