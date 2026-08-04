"use client"

import { ReactNode } from "react"
import { useParams, usePathname } from "next/navigation"
import {
  House,
  Handbag,
  Storefront,
  User,
} from "@phosphor-icons/react/dist/ssr"
import { clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { useConsent } from "@lib/context/consent-context"
import { useFooterInView } from "@lib/hooks/use-footer-in-view"
import { useScrolledPast } from "@lib/hooks/use-scrolled-past"

type Item = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; weight?: any }>
  matchPrefixes?: string[]
  badge?: ReactNode
  /** Când e setat, tab-ul deschide un panou în loc să navigheze. */
  onSelect?: () => void
}

type Props = {
  cartIndicator: ReactNode
}

export default function BottomNavClient({ cartIndicator }: Props) {
  const pathname = usePathname()
  const { countryCode } = useParams<{ countryCode: string }>()
  const scrolled = useScrolledPast(160)
  const { open: openCart } = useCartDrawer()
  const { decided } = useConsent()
  const footerInView = useFooterInView()
  const visible = scrolled && decided && !footerInView
  const stripped = pathname.replace(new RegExp(`^/${countryCode}`), "") || "/"

  // Hide on product detail pages — they have their own sticky buy bar.
  if (stripped.startsWith("/products/")) return null

  const items: Item[] = [
    { href: "/", label: "Home", icon: House },
    {
      href: "/store",
      label: "Catalog",
      icon: Storefront,
      matchPrefixes: ["/store", "/categories", "/collections", "/products"],
    },
    {
      href: "/cart",
      label: "Coș",
      icon: Handbag,
      matchPrefixes: ["/cart", "/checkout"],
      badge: cartIndicator,
      onSelect: openCart,
    },
    {
      href: "/account",
      label: "Account",
      icon: User,
      matchPrefixes: ["/account"],
    },
  ]

  const isActive = (item: Item) => {
    if (item.matchPrefixes?.length) {
      return item.matchPrefixes.some((p) =>
        p === "/" ? stripped === "/" : stripped.startsWith(p)
      )
    }
    return item.href === "/" ? stripped === "/" : stripped.startsWith(item.href)
  }

  return (
    <nav
      aria-label="Navigazione principale mobile"
      aria-hidden={!visible}
      className={clx(
        "lg:hidden fixed inset-x-0 bottom-0 z-[60] bg-brand-dark text-white rounded-t-[2rem] shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around px-2 pt-2 pb-2">
        {items.map((item) => {
          const active = isActive(item)
          const Icon = item.icon
          const className = clx(
            "w-full flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-colors",
            active ? "text-brand-accent" : "text-white/70 hover:text-white"
          )
          const content = (
            <>
              <span className="relative">
                <Icon size={24} weight={active ? "fill" : "regular"} />
                {item.badge}
              </span>
              <span
                className={clx(
                  "text-[11px] leading-none tracking-wide",
                  active ? "font-bold" : "font-medium"
                )}
              >
                {item.label}
              </span>
            </>
          )

          return (
            <li key={item.href} className="flex-1">
              {item.onSelect ? (
                <button
                  type="button"
                  onClick={item.onSelect}
                  tabIndex={visible ? 0 : -1}
                  aria-haspopup="dialog"
                  className={className}
                >
                  {content}
                </button>
              ) : (
                <LocalizedClientLink
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  tabIndex={visible ? 0 : -1}
                  className={className}
                >
                  {content}
                </LocalizedClientLink>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
