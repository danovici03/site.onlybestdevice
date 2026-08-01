import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import SideMenuCartCount from "@modules/layout/components/side-menu/cart-count"
import { MagnifyingGlass, User } from "@phosphor-icons/react/dist/ssr"
import { resolveMegaMenu } from "@modules/layout/components/mega-menu/resolve"
import NavInteractive from "./nav-interactive"

/**
 * Nav-ul stă în layout, deci se randează deasupra fiecărei pagini. Nu are voie
 * să citească cookie-uri: ar face tot catalogul dinamic. De aceea limba curentă
 * se citește în `LanguageSelect`, din browser, iar coșul vine din
 * `SessionProvider`.
 */
export default async function Nav({ countryCode }: { countryCode: string }) {
  const [regions, locales, megaMenu] = await Promise.all([
    // O eroare aici scoate tot site-ul, nu doar selectorul de țară. Cât
    // backend-ul repornește la un deploy, lista de regiuni lipsește pentru
    // câteva secunde — SideMenu are gardă pe `regions`, așa că degradăm la
    // listă goală.
    listRegions()
      .then((regions: StoreRegion[]) => regions)
      .catch((e) => {
        console.error("[nav] regiunile n-au putut fi citite:", e?.message ?? e)
        return [] as StoreRegion[]
      }),
    listLocales(),
    resolveMegaMenu(countryCode),
  ])

  const left = (
    <>
      <div className="lg:hidden">
        <SideMenu
          regions={regions}
          locales={locales}
          cartIndicator={<SideMenuCartCount />}
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
      <CartButton />
    </>
  )

  return <NavInteractive left={left} right={right} megaMenu={megaMenu} />
}
