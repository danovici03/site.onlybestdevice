import { Metadata } from "next"

import { getBaseURL } from "@lib/util/env"
import { ConsentProvider } from "@lib/context/consent-context"
import { CartDrawerProvider } from "@lib/context/cart-drawer-context"
import { SessionProvider } from "@lib/context/session-context"
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

/**
 * Nimic din acest layout nu are voie să citească cookie-uri: se randează
 * deasupra fiecărei pagini din `(main)`, deci o singură citire face TOT
 * catalogul dinamic și necache-uibil. Coșul și clientul logat stau în
 * `SessionProvider`, care le ia din browser după hidratare.
 */
export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  return (
    <ConsentProvider>
      <SessionProvider>
        <CartDrawerProvider>
          <TopBar />
          <Nav countryCode={countryCode} />
          <CartMismatchBanner />

          {props.children}
          {/* Spațiul pentru bara de jos e padding pe footer, nu un div după
              el: bara se ascunde tocmai când footerul intră în cadru, iar un
              div separat rămânea ca o bandă goală, în culoarea paginii, sub
              footerul închis la culoare. */}
          <Footer />
          <BottomNav />
          <CartDrawer />
          <CookieConsent />
          <WhatsAppWidget />
        </CartDrawerProvider>
      </SessionProvider>
    </ConsentProvider>
  )
}
