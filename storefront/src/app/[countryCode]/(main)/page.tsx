import { Metadata } from "next"

import BestSellers from "@modules/home/components/best-sellers"
import FeaturedRail from "@modules/home/components/featured-rail"
import Hero from "@modules/home/components/hero"
import OffersRail from "@modules/home/components/offers-rail"
import Rooms from "@modules/home/components/rooms"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: { absolute: "onlybestdevice – Telefoane, laptopuri și tablete, în rate" },
  description:
    "Telefoane, laptopuri, tablete și accesorii noi de la Apple, Samsung și alții. Garanție 24 de luni, plată cu cardul sau în rate, retur gratuit în 14 zile.",
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
      <Hero />
      <Rooms />
      <FeaturedRail countryCode={countryCode} />
      <OffersRail countryCode={countryCode} />
      <BestSellers countryCode={countryCode} />
    </>
  )
}
