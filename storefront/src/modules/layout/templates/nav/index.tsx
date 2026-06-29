import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import SideMenuCartCount from "@modules/layout/components/side-menu/cart-count"
import {
  MagnifyingGlass,
  ShoppingBag,
  User,
} from "@phosphor-icons/react/dist/ssr"
import { resolveMegaMenu } from "@modules/layout/components/mega-menu/resolve"
import NavInteractive from "./nav-interactive"

export default async function Nav({ countryCode }: { countryCode: string }) {
  const [regions, locales, currentLocale, megaMenu] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    resolveMegaMenu(countryCode),
  ])

  const left = (
    <>
      <div className="lg:hidden">
        <SideMenu
          regions={regions}
          locales={locales}
          currentLocale={currentLocale}
          cartIndicator={
            <Suspense fallback={null}>
              <SideMenuCartCount />
            </Suspense>
          }
        />
      </div>
      <LocalizedClientLink
        href="/"
        className="flex items-center shrink-0"
        data-testid="nav-store-link"
        aria-label="onlybestdevice — Acasă"
      >
        <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight select-none">
          onlybest<span className="text-brand-accent">device</span>
        </span>
      </LocalizedClientLink>
    </>
  )

  const right = (
    <>
      <button
        type="button"
        className="hover:text-brand-accent transition-colors"
        aria-label="Caută"
      >
        <MagnifyingGlass size={26} weight="light" />
      </button>
      <LocalizedClientLink
        href="/account"
        className="hidden sm:block hover:text-brand-accent transition-colors"
        data-testid="nav-account-link"
        aria-label="Account"
      >
        <User size={26} weight="light" />
      </LocalizedClientLink>
      <Suspense
        fallback={
          <LocalizedClientLink
            href="/cart"
            className="hover:text-brand-accent transition-colors relative"
            data-testid="nav-cart-link"
            aria-label="Coș"
          >
            <ShoppingBag size={26} weight="light" />
            <span className="absolute -top-1 -right-1 bg-brand-dark text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              0
            </span>
          </LocalizedClientLink>
        }
      >
        <CartButton />
      </Suspense>
    </>
  )

  return <NavInteractive left={left} right={right} megaMenu={megaMenu} />
}
