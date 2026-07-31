import { Metadata } from "next"

import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import { ConsentProvider } from "@lib/context/consent-context"
import { CartDrawerProvider } from "@lib/context/cart-drawer-context"
import BottomNav from "@modules/layout/components/bottom-nav"
import CartDrawer from "@modules/layout/components/cart-drawer"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import CookieConsent from "@modules/layout/components/cookie-consent"
import WhatsAppWidget from "@modules/layout/components/whatsapp-widget"
import TopBar from "@modules/layout/components/top-bar"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const customer = await retrieveCustomer()
  const cart = await retrieveCart()

  return (
    <ConsentProvider>
      <CartDrawerProvider>
        <TopBar />
        <Nav countryCode={countryCode} />
        {customer && cart && (
          <CartMismatchBanner customer={customer} cart={cart} />
        )}

        {props.children}
        <Footer />
        <div
          aria-hidden
          className="lg:hidden"
          style={{
            height: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.5rem)",
          }}
        />
        <BottomNav />
        <CartDrawer cart={cart} />
        <CookieConsent />
        <WhatsAppWidget />
      </CartDrawerProvider>
    </ConsentProvider>
  )
}
