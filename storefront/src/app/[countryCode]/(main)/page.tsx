import { Metadata } from "next"

import BestSellers from "@modules/home/components/best-sellers"
import FeaturedRail from "@modules/home/components/featured-rail"
import Hero from "@modules/home/components/hero"
import OffersRail from "@modules/home/components/offers-rail"
import Rooms from "@modules/home/components/rooms"
import { getRegion } from "@lib/data/regions"
import { canonical } from "@lib/util/canonical"
import { COMPANY } from "@lib/util/company-info"
import { getBaseURL } from "@lib/util/env"

export const metadata: Metadata = {
  title: { absolute: "Onlybestdevice – Telefoane, laptopuri și tablete, în rate" },
  description:
    "Onlybestdevice: telefoane, laptopuri, tablete și accesorii noi de la Apple, Samsung și alții. Garanție 24 de luni, plată cu cardul sau în rate, retur gratuit în 14 zile.",
  alternates: canonical(""),
}

/**
 * Numele site-ului din rezultatele Google vine din blocul `WebSite`; fără el,
 * Google îl ghicește din titlu sau din domeniu. `Organization` îi leagă de
 * firmă și de profilurile sociale.
 */
const siteJsonLd = (countryCode: string) => {
  const base = getBaseURL().replace(/\/$/, "")
  const url = `${base}/${countryCode}`
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: COMPANY.marchio,
      alternateName: ["Only Best Device", COMPANY.dominio],
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: COMPANY.marchio,
      legalName: COMPANY.ragioneSociale,
      url,
      logo: `${base}/apple-icon.png`,
      email: COMPANY.email,
      sameAs: Object.values(COMPANY.social),
    },
  ]
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(countryCode)) }}
      />
      <Hero />
      <Rooms />
      <FeaturedRail countryCode={countryCode} />
      <OffersRail countryCode={countryCode} />
      <BestSellers countryCode={countryCode} />
    </>
  )
}
